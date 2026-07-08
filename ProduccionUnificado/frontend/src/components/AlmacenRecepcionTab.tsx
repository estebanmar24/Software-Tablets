import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
} from 'react-native';
import { almacenAlert } from '../utils/almacenAlert';
import {
    type Requisicion,
    type RecepcionLineaProveedor,
    TIPOS_REQUISICION,
    type TipoRequisicionId,
    formatFechaHoy,
    formatFechaDisplay,
    getTipoRequisicionLabel,
    esRequisicionEnRecepcion,
    puedeRegistrarRecepcionEnvio,
    getCantidadRecibidaProveedor,
    getCantidadPedidaOriginalProveedor,
    getSaldoPendienteProveedor,
    getResumenCantidadesPedido,
    OPCIONES_FILTRO_ESTADO_RECEPCION,
    getProveedoresPendientesRecepcion,
    getResumenRecepcionProveedores,
    getFechaEntregaResumenPedido,
    getFechaUltimaRecepcion,
    normalizarPedido,
    pedidoRecepcionCompleta,
    getEvaluacionesProveedorRequisicion,
    formatearConsecutivoOrdenCompra,
    textoIngresadoPorRecepcion,
} from '../data/almacenMockData';
import { extraerMensajeErrorApi } from '../services/almacenApi';
import AlmacenEstadoBadge from './AlmacenEstadoBadge';
import AlmacenContadorBadge from './AlmacenContadorBadge';
import AlmacenCampoFecha from './AlmacenCampoFecha';
import AlmacenFiltroEstado, { type FiltroEstadoValor } from './AlmacenFiltroEstado';

const RECEPCIONES_POR_PAGINA = 10;

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
    inputBackground: string;
};

interface AlmacenRecepcionTabProps {
    requisiciones: Requisicion[];
    onRegistrarRecepcion: (requisicionId: string, linea: RecepcionLineaProveedor) => Promise<Requisicion>;
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
    isWide: boolean;
}

function GrupoSiNo({
    label,
    value,
    onChange,
    motivo,
    onMotivoChange,
    motivoPlaceholder,
    colors,
    inputBg,
    required,
    showMotivoOnNo = true,
}: {
    label: string;
    value: boolean | null;
    onChange: (v: boolean) => void;
    motivo: string;
    onMotivoChange: (t: string) => void;
    motivoPlaceholder: string;
    colors: ThemeColors;
    inputBg: string;
    required?: boolean;
    showMotivoOnNo?: boolean;
}) {
    return (
        <View style={recStyles.campoGrupo}>
            <Text style={[recStyles.label, { color: colors.subText }]}>
                {label}
                {required ? ' *' : ''}
            </Text>
            <View style={recStyles.siNoRow}>
                <TouchableOpacity
                    style={[
                        recStyles.siNoBtn,
                        { borderColor: colors.border },
                        value === true && recStyles.siNoBtnActivo,
                    ]}
                    onPress={() => onChange(true)}
                >
                    <Text
                        style={[
                            recStyles.siNoBtnText,
                            { color: value === true ? '#FFF' : colors.text },
                        ]}
                    >
                        Sí
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        recStyles.siNoBtn,
                        { borderColor: colors.border },
                        value === false && recStyles.siNoBtnActivo,
                    ]}
                    onPress={() => onChange(false)}
                >
                    <Text
                        style={[
                            recStyles.siNoBtnText,
                            { color: value === false ? '#FFF' : colors.text },
                        ]}
                    >
                        No
                    </Text>
                </TouchableOpacity>
            </View>
            {value === false && showMotivoOnNo && (
                <TextInput
                    style={[
                        recStyles.input,
                        recStyles.textArea,
                        {
                            backgroundColor: inputBg,
                            borderColor: colors.border,
                            color: colors.text,
                        },
                    ]}
                    placeholder={motivoPlaceholder}
                    placeholderTextColor={colors.subText}
                    value={motivo}
                    onChangeText={onMotivoChange}
                    multiline
                />
            )}
        </View>
    );
}

export default function AlmacenRecepcionTab({
    requisiciones,
    onRegistrarRecepcion,
    colors,
    isDarkMode,
    cardBg,
    isWide,
}: AlmacenRecepcionTabProps) {
    const inputBg = isDarkMode ? '#0F172A' : colors.inputBackground;
    const [tipoActivo, setTipoActivo] = useState<TipoRequisicionId>('consumo_diario');
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoValor>('todos');
    const [pagina, setPagina] = useState(1);
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
    const [modalId, setModalId] = useState<string | null>(null);
    const [proveedorSeleccionadoId, setProveedorSeleccionadoId] = useState<string | null>(null);

    const [codigoRecepcion, setCodigoRecepcion] = useState('');
    const [fechaLlegada, setFechaLlegada] = useState(formatFechaHoy());
    const [calidadEsperada, setCalidadEsperada] = useState<boolean | null>(null);
    const [motivoCalidad, setMotivoCalidad] = useState('');
    const [facturaEntregada, setFacturaEntregada] = useState<boolean | null>(null);
    const [motivoFactura, setMotivoFactura] = useState('');
    const [pedidoCompleto, setPedidoCompleto] = useState<boolean | null>(null);
    const [cantidadLlegada, setCantidadLlegada] = useState('');
    const [nuevaFechaLlegada, setNuevaFechaLlegada] = useState('');
    const [motivoParcial, setMotivoParcial] = useState('');
    const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const guardandoRef = useRef(false);

    const elegibles = useMemo(() => requisiciones.filter(esRequisicionEnRecepcion), [requisiciones]);

    const conteoPorTipo = useMemo(() => {
        const map: Record<TipoRequisicionId, number> = {
            consumo_diario: 0,
            cajas_empaque: 0,
            gomas_adhesivos: 0,
            pantone: 0,
        };
        elegibles.forEach((r) => {
            map[r.tipoRequisicion] = (map[r.tipoRequisicion] ?? 0) + 1;
        });
        return map;
    }, [elegibles]);

    const tipoActivoMeta = useMemo(
        () => TIPOS_REQUISICION.find((t) => t.id === tipoActivo) ?? TIPOS_REQUISICION[0],
        [tipoActivo]
    );

    const recepcionesDelTipoSinEstado = useMemo(
        () => elegibles.filter((r) => r.tipoRequisicion === tipoActivo),
        [elegibles, tipoActivo]
    );

    const conteoEstadoEnTipo = useMemo(() => {
        const base = recepcionesDelTipoSinEstado;
        return {
            todos: base.length,
            Pedido: base.filter((r) => r.estado === 'Pedido').length,
            Parcial: base.filter((r) => r.estado === 'Parcial').length,
            'En Almacen': base.filter((r) => r.estado === 'En Almacen').length,
        };
    }, [recepcionesDelTipoSinEstado]);

    const listaDelTipo = useMemo(() => {
        const filtradas =
            filtroEstado === 'todos'
                ? recepcionesDelTipoSinEstado
                : recepcionesDelTipoSinEstado.filter((r) => r.estado === filtroEstado);
        return [...filtradas].sort((a, b) => {
            if (filtroEstado === 'En Almacen') {
                const fa = getFechaUltimaRecepcion(a) ?? '';
                const fb = getFechaUltimaRecepcion(b) ?? '';
                return fb.localeCompare(fa) || b.codigo.localeCompare(a.codigo);
            }
            return b.codigo.localeCompare(a.codigo);
        });
    }, [recepcionesDelTipoSinEstado, filtroEstado]);

    const totalTipo = listaDelTipo.length;
    const totalPaginas = Math.max(1, Math.ceil(totalTipo / RECEPCIONES_POR_PAGINA));
    const paginaActual = Math.min(pagina, totalPaginas);
    const indiceInicio = (paginaActual - 1) * RECEPCIONES_POR_PAGINA;
    const indiceFin = Math.min(indiceInicio + RECEPCIONES_POR_PAGINA, totalTipo);
    const listaPagina = useMemo(
        () => listaDelTipo.slice(indiceInicio, indiceFin),
        [listaDelTipo, indiceInicio, indiceFin]
    );

    useEffect(() => {
        if (pagina > totalPaginas) setPagina(totalPaginas);
    }, [pagina, totalPaginas, tipoActivo, filtroEstado]);

    const handleCambioFiltroEstado = (estado: FiltroEstadoValor) => {
        setFiltroEstado(estado);
        setPagina(1);
        setExpandidas({});
    };

    const reqModal = elegibles.find((r) => r.id === modalId);
    const pedidoModal = reqModal?.pedido ? normalizarPedido(reqModal.pedido) : null;
    const proveedoresPendientesModal = pedidoModal ? getProveedoresPendientesRecepcion(pedidoModal) : [];
    const proveedorActivo = proveedoresPendientesModal.find((p) => p.id === proveedorSeleccionadoId);
    const cantidadMaxProveedor = proveedorActivo
        ? getSaldoPendienteProveedor(reqModal?.recepcion, proveedorActivo)
        : 0;

    const mostrarErrorRecepcion = (mensaje: string) => {
        setErrorValidacion(mensaje);
        almacenAlert('Complete los campos', mensaje);
    };

    const resetFormularioRecepcion = () => {
        setErrorValidacion(null);
        setCodigoRecepcion('');
        setFechaLlegada(formatFechaHoy());
        setCalidadEsperada(null);
        setMotivoCalidad('');
        setFacturaEntregada(null);
        setMotivoFactura('');
        setPedidoCompleto(null);
        setCantidadLlegada('');
        setNuevaFechaLlegada('');
        setMotivoParcial('');
    };

    const abrirModal = (req: Requisicion) => {
        if (!req.pedido) return;
        const pendientes = getProveedoresPendientesRecepcion(req.pedido);
        setModalId(req.id);
        setProveedorSeleccionadoId(pendientes[0]?.id ?? null);
        resetFormularioRecepcion();
    };

    const cerrarModal = () => {
        setModalId(null);
        setProveedorSeleccionadoId(null);
        setErrorValidacion(null);
    };

    const seleccionarProveedorRecepcion = (id: string) => {
        setProveedorSeleccionadoId(id);
        resetFormularioRecepcion();
    };

    const toggleDetalle = (id: string) => {
        setExpandidas((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const verHistorial = (id: string) => {
        setExpandidas((prev) => ({ ...prev, [id]: true }));
    };

    const handleCambioTipo = (tipo: TipoRequisicionId) => {
        setTipoActivo(tipo);
        setPagina(1);
        setExpandidas({});
    };

    const guardarRecepcion = async () => {
        if (guardandoRef.current) return;

        guardandoRef.current = true;
        setGuardando(true);

        const liberarGuardado = () => {
            guardandoRef.current = false;
            setGuardando(false);
        };

        setErrorValidacion(null);

        if (!reqModal?.pedido || !proveedorActivo) {
            mostrarErrorRecepcion('Seleccione el envío del proveedor que está recibiendo.');
            liberarGuardado();
            return;
        }

        if (!codigoRecepcion.trim()) {
            mostrarErrorRecepcion('Indique el código de recepción que asigna el usuario.');
            liberarGuardado();
            return;
        }
        if (!fechaLlegada.trim()) {
            mostrarErrorRecepcion('La fecha de llegada es obligatoria.');
            liberarGuardado();
            return;
        }
        if (calidadEsperada === null) {
            mostrarErrorRecepcion('Indique si la calidad fue la esperada (Sí o No).');
            liberarGuardado();
            return;
        }
        if (!calidadEsperada && !motivoCalidad.trim()) {
            mostrarErrorRecepcion('Explique por qué la calidad no fue la esperada.');
            liberarGuardado();
            return;
        }
        if (facturaEntregada === null) {
            mostrarErrorRecepcion('Indique si la factura fue entregada (Sí o No).');
            liberarGuardado();
            return;
        }
        if (!facturaEntregada && !motivoFactura.trim()) {
            mostrarErrorRecepcion('Explique por qué no se entregó la factura.');
            liberarGuardado();
            return;
        }
        if (pedidoCompleto === null) {
            mostrarErrorRecepcion(
                'Indique si llegó todo el saldo pendiente de este proveedor (Sí o No).'
            );
            liberarGuardado();
            return;
        }

        const saldoPendiente = cantidadMaxProveedor;
        const pedidoOriginalProveedor = proveedorActivo
            ? getCantidadPedidaOriginalProveedor(reqModal?.recepcion, proveedorActivo) ||
              proveedorActivo.cantidad
            : 0;
        let cantidadRecibida: number;
        let esRecepcionCompletaProveedor: boolean;

        if (pedidoCompleto) {
            cantidadRecibida = saldoPendiente;
            esRecepcionCompletaProveedor = true;
        } else {
            const qty = parseFloat(cantidadLlegada.replace(',', '.'));
            if (!qty || qty <= 0) {
                mostrarErrorRecepcion('Ingrese la cantidad que llegó (mayor a cero).');
                liberarGuardado();
                return;
            }
            if (qty > saldoPendiente) {
                mostrarErrorRecepcion(
                    `La cantidad no puede superar el saldo pendiente de ${proveedorActivo.nombre} (${saldoPendiente} ${reqModal.unidad}).`
                );
                liberarGuardado();
                return;
            }
            if (qty >= saldoPendiente - 0.0001) {
                mostrarErrorRecepcion(
                    `Si llegó todo el saldo (${saldoPendiente} ${reqModal.unidad}), marque «Sí» en «¿Llegó todo el saldo pendiente?».`
                );
                liberarGuardado();
                return;
            }
            if (!motivoParcial.trim()) {
                mostrarErrorRecepcion('Explique por qué solo llegó esa cantidad de este proveedor.');
                liberarGuardado();
                return;
            }
            cantidadRecibida = qty;
            esRecepcionCompletaProveedor = false;
        }

        const linea: RecepcionLineaProveedor = {
            proveedorId: proveedorActivo.id,
            nombreProveedor: proveedorActivo.nombre,
            codigoUsuario: codigoRecepcion.trim(),
            fechaLlegada,
            calidadEsperada,
            ...(calidadEsperada ? {} : { motivoCalidadNo: motivoCalidad.trim() }),
            facturaEntregada,
            ...(facturaEntregada ? {} : { motivoFacturaNo: motivoFactura.trim() }),
            cantidadRecibida,
            cantidadPedidaEnMomento: pedidoOriginalProveedor,
            pedidoCompleto: esRecepcionCompletaProveedor,
            ...(!esRecepcionCompletaProveedor ? { motivoCantidadParcial: motivoParcial.trim() } : {}),
        };

        try {
            const actualizada = await onRegistrarRecepcion(reqModal.id, linea);
            const recepcionCompleta =
                actualizada.estado === 'En Almacen' ||
                (actualizada.pedido ? pedidoRecepcionCompleta(actualizada.pedido) : false);
            cerrarModal();
            if (recepcionCompleta) {
                setFiltroEstado('En Almacen');
                setPagina(1);
                setExpandidas({ [actualizada.id]: true });
                almacenAlert('Guardado', 'Se guardó con éxito.');
            } else {
                if (actualizada.estado === 'Parcial') {
                    setFiltroEstado('Parcial');
                    setPagina(1);
                }
                almacenAlert('Guardado', 'Se guardó con éxito.');
            }
        } catch (error) {
            mostrarErrorRecepcion(extraerMensajeErrorApi(error, 'No se pudo registrar la recepción.'));
        } finally {
            liberarGuardado();
        }
    };

    const fmtFecha = (iso?: string) => (iso ? iso : '—');

    const tabla = (
        <>
            <View style={[recStyles.tableHead, { borderBottomColor: colors.border }]}>
                {[
                    '',
                    'COD. REQ',
                    'INSUMO / CANT. PEDIDO',
                    'FECHA PEDIDO',
                    'LLEGADA EST.',
                    'PROVEEDORES',
                    'CÓD. RECEPCIÓN',
                    'INGRESADO POR',
                    'ESTADO',
                    'ACCIONES',
                ].map((col) => (
                    <Text
                        key={col}
                        style={[
                            recStyles.th,
                            { color: colors.subText },
                            col === '' && { width: 36 },
                            col === 'COD. REQ' && { width: 90 },
                            col === 'INSUMO / CANT. PEDIDO' && { flex: 1.5, minWidth: 170 },
                            col === 'FECHA PEDIDO' && { width: 110 },
                            col === 'LLEGADA EST.' && { width: 120 },
                            col === 'PROVEEDORES' && { flex: 1.1, minWidth: 130 },
                            col === 'CÓD. RECEPCIÓN' && { width: 130 },
                            col === 'INGRESADO POR' && { width: 120 },
                            col === 'ESTADO' && { width: 130 },
                            col === 'ACCIONES' && { width: 150 },
                        ]}
                    >
                        {col}
                    </Text>
                ))}
            </View>

            {listaPagina.map((req) => {
                const expandida = !!expandidas[req.id];
                const pedido = normalizarPedido(req.pedido!);
                const provs = pedido.proveedores;
                const resumenCant = getResumenCantidadesPedido(pedido, req.recepcion);
                const resumenEnvios = getResumenRecepcionProveedores(pedido);
                const codigosRecepcion = (req.recepcion?.lineas ?? [])
                    .map((l) => l.codigoUsuario)
                    .filter(Boolean);
                const fechaUltimaRecepcion = getFechaUltimaRecepcion(req);
                const enHistorial = req.estado === 'En Almacen';
                return (
                    <View key={req.id}>
                        <View
                            style={[
                                recStyles.tableRow,
                                { borderBottomColor: colors.border },
                                enHistorial && {
                                    borderLeftWidth: 3,
                                    borderLeftColor: '#10B981',
                                    paddingLeft: 6,
                                },
                            ]}
                        >
                            <TouchableOpacity style={recStyles.expandBtn} onPress={() => toggleDetalle(req.id)}>
                                <Text style={{ color: colors.primary, fontSize: 16 }}>{expandida ? '▼' : '▶'}</Text>
                            </TouchableOpacity>
                            <Text style={[recStyles.td, { width: 90, color: colors.text }]}>{req.codigo}</Text>
                            <View style={{ flex: 1.5, minWidth: 170, paddingRight: 8 }}>
                                <Text style={[recStyles.td, { color: colors.text, fontWeight: '600' }]}>
                                    {req.producto}
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 13 }}>
                                    Pedido: {resumenCant.totalPedido} {req.unidad}
                                </Text>
                                <Text style={{ color: '#34D399', fontSize: 12 }}>
                                    Recibido: {resumenCant.recibido} {req.unidad}
                                </Text>
                                {resumenCant.pendiente > 0 ? (
                                    <Text style={{ color: '#FBBF24', fontSize: 12 }}>
                                        Pendiente: {resumenCant.pendiente} {req.unidad}
                                    </Text>
                                ) : enHistorial ? (
                                    <Text style={{ color: '#34D399', fontSize: 12, fontWeight: '600' }}>
                                        ✓ Recibido al 100%
                                    </Text>
                                ) : null}
                                {fechaUltimaRecepcion ? (
                                    <Text style={{ color: colors.subText, fontSize: 11 }}>
                                        Últ. recepción: {formatFechaDisplay(fechaUltimaRecepcion)}
                                    </Text>
                                ) : null}
                                <Text style={{ color: colors.subText, fontSize: 11 }}>
                                    Req: {req.cantidad} {req.unidad}
                                </Text>
                            </View>
                            <Text style={[recStyles.td, { width: 110, color: colors.text }]}>
                                {fmtFecha(pedido.fechaPedido)}
                            </Text>
                            <Text style={[recStyles.td, { width: 120, color: colors.text }]}>
                                {getFechaEntregaResumenPedido(pedido)}
                            </Text>
                            <View style={{ flex: 1.1, minWidth: 130, paddingRight: 8 }}>
                                <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 4 }}>
                                    Envíos: {resumenEnvios.recibidos}/{resumenEnvios.total}
                                </Text>
                                <View style={recStyles.tagsRow}>
                                    {provs.map((p) => {
                                        const recibidoProv = getCantidadRecibidaProveedor(
                                            req.recepcion,
                                            p.id
                                        );
                                        const saldo = getSaldoPendienteProveedor(req.recepcion, p);
                                        return (
                                            <View
                                                key={p.id}
                                                style={[
                                                    recStyles.tag,
                                                    {
                                                        backgroundColor: p.recibido
                                                            ? 'rgba(16, 185, 129, 0.25)'
                                                            : isDarkMode
                                                              ? '#334155'
                                                              : '#E2E8F0',
                                                        borderWidth: p.recibido ? 1 : 0,
                                                        borderColor: '#10B981',
                                                    },
                                                ]}
                                            >
                                                <Text style={{ color: colors.text, fontSize: 12 }}>
                                                    {p.recibido ? '✓ ' : ''}
                                                    {p.nombre}
                                                    {recibidoProv > 0 ? ` · ${recibidoProv} rec.` : ''}
                                                    {!p.recibido && saldo > 0
                                                        ? ` · faltan ${saldo} ${req.unidad}`
                                                        : ''}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                            <View style={{ width: 130, paddingRight: 6 }}>
                                {codigosRecepcion.length === 0 ? (
                                    <Text style={{ color: colors.subText }}>—</Text>
                                ) : (
                                    codigosRecepcion.map((cod) => (
                                        <Text
                                            key={cod}
                                            style={{ color: colors.text, fontSize: 12, marginBottom: 2 }}
                                            numberOfLines={1}
                                        >
                                            {cod}
                                        </Text>
                                    ))
                                )}
                            </View>
                            <Text
                                style={[recStyles.td, { width: 120, color: colors.text, paddingRight: 6 }]}
                                numberOfLines={2}
                            >
                                {textoIngresadoPorRecepcion(req)}
                            </Text>
                            <View style={{ width: 130 }}>
                                <AlmacenEstadoBadge estado={req.estado} />
                            </View>
                            <View style={{ width: 150 }}>
                                {puedeRegistrarRecepcionEnvio(req) ? (
                                    <TouchableOpacity style={recStyles.btnPrimario} onPress={() => abrirModal(req)}>
                                        <Text style={recStyles.btnPrimarioText}>Recibir envío</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[recStyles.btnSecundario, { borderColor: colors.border }]}
                                        onPress={() => verHistorial(req.id)}
                                    >
                                        <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                                            Ver historial
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {expandida && (
                            <View
                                style={[
                                    recStyles.detallePanel,
                                    {
                                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                        borderBottomColor: colors.border,
                                    },
                                ]}
                            >
                                <Text style={[recStyles.detalleTitulo, { color: colors.text }]}>
                                    Datos del pedido
                                </Text>
                                <View style={recStyles.detalleGrid}>
                                    {[
                                        ['Tipo', getTipoRequisicionLabel(req.tipoRequisicion)],
                                        ['Orden producción', req.ordenProduccion],
                                        ['Cliente', req.cliente],
                                        ['Referencia', req.referencia],
                                        ['Fecha solicitud', req.fechaSolicitud],
                                        ['Fecha requerida', req.fechaRequerida],
                                        ['Total pedido', `${resumenCant.totalPedido} ${req.unidad}`],
                                        ['Recibido', `${resumenCant.recibido} ${req.unidad}`],
                                        ['Pendiente', `${resumenCant.pendiente} ${req.unidad}`],
                                        ['Ingresado por', textoIngresadoPorRecepcion(req)],
                                        ['Observación pedido', req.observacion?.trim() || '—'],
                                    ].map(([k, v]) => (
                                        <View key={k} style={recStyles.detalleItem}>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>{k}</Text>
                                            <Text style={{ color: colors.text, fontSize: 14 }}>{v}</Text>
                                        </View>
                                    ))}
                                </View>
                                <View style={{ marginTop: 16 }}>
                                    <Text style={[recStyles.detalleSubtitulo, { color: colors.subText }]}>
                                        Cantidad por proveedor (pedido)
                                    </Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator
                                        contentContainerStyle={recStyles.proveedorColumnasWrap}
                                    >
                                        {provs.map((p) => {
                                            const recibidoProv = getCantidadRecibidaProveedor(
                                                req.recepcion,
                                                p.id,
                                            );
                                            const pedidoOrig = getCantidadPedidaOriginalProveedor(
                                                req.recepcion,
                                                p,
                                            );
                                            const saldo = getSaldoPendienteProveedor(req.recepcion, p);
                                            const estadoLabel = p.recibido
                                                ? '✓ Cerrado'
                                                : saldo > 0
                                                  ? `Faltan ${saldo} ${req.unidad}`
                                                  : 'Pendiente';
                                            const estadoColor = p.recibido
                                                ? '#22C55E'
                                                : saldo > 0
                                                  ? '#F59E0B'
                                                  : colors.subText;
                                            const filas = [
                                                ...(p.numeroOrdenCompra != null && p.numeroOrdenCompra > 0
                                                    ? ([
                                                          [
                                                              'Nº orden compra',
                                                              formatearConsecutivoOrdenCompra(p.numeroOrdenCompra),
                                                              colors.primary,
                                                          ],
                                                      ] as const)
                                                    : []),
                                                ['Pedido', `${pedidoOrig} ${req.unidad}`, colors.text],
                                                [
                                                    'Recibido',
                                                    `${recibidoProv} ${req.unidad}`,
                                                    recibidoProv > 0 ? '#22C55E' : colors.text,
                                                ],
                                                [
                                                    'Pendiente',
                                                    saldo > 0 ? `${saldo} ${req.unidad}` : '—',
                                                    saldo > 0 ? '#F59E0B' : colors.subText,
                                                ],
                                                [
                                                    'Próx. llegada',
                                                    p.fechaEntregaEstimada && !p.recibido
                                                        ? formatFechaDisplay(p.fechaEntregaEstimada)
                                                        : '—',
                                                    colors.text,
                                                ],
                                                ['Estado', estadoLabel, estadoColor],
                                            ] as const;
                                            return (
                                                <View
                                                    key={p.id}
                                                    style={[
                                                        recStyles.proveedorColumna,
                                                        {
                                                            backgroundColor: isDarkMode
                                                                ? '#1E293B'
                                                                : '#FFFFFF',
                                                            borderColor: colors.border,
                                                        },
                                                    ]}
                                                >
                                                    {p.numeroOrdenCompra != null && p.numeroOrdenCompra > 0 ? (
                                                        <View
                                                            style={[
                                                                recStyles.ocBadge,
                                                                {
                                                                    backgroundColor: isDarkMode
                                                                        ? 'rgba(59,130,246,0.2)'
                                                                        : 'rgba(59,130,246,0.12)',
                                                                },
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    recStyles.ocBadgeText,
                                                                    { color: colors.primary },
                                                                ]}
                                                            >
                                                                OC{' '}
                                                                {formatearConsecutivoOrdenCompra(p.numeroOrdenCompra)}
                                                            </Text>
                                                        </View>
                                                    ) : null}
                                                    <Text
                                                        style={[
                                                            recStyles.proveedorColumnaTitulo,
                                                            { color: colors.text },
                                                        ]}
                                                    >
                                                        {p.nombre}
                                                    </Text>
                                                    {filas.map(([label, valor, colorValor]) => (
                                                        <View key={label} style={recStyles.proveedorColumnaFila}>
                                                            <Text
                                                                style={[
                                                                    recStyles.proveedorColumnaLabel,
                                                                    { color: colors.subText },
                                                                ]}
                                                            >
                                                                {label}
                                                            </Text>
                                                            <Text
                                                                style={[
                                                                    recStyles.proveedorColumnaValor,
                                                                    {
                                                                        color: colorValor,
                                                                        fontWeight:
                                                                            label === 'Estado' ? '600' : '400',
                                                                    },
                                                                ]}
                                                            >
                                                                {valor}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                                {(req.recepcion?.lineas?.length ?? 0) > 0 && (
                                    <View style={{ marginTop: 16 }}>
                                        <Text style={[recStyles.detalleSubtitulo, { color: colors.subText }]}>
                                            Historial de recepciones (cada envío guardado)
                                        </Text>
                                        {enHistorial && fechaUltimaRecepcion ? (
                                            <Text style={{ color: '#34D399', fontSize: 13, marginBottom: 8 }}>
                                                Pedido cerrado en almacén · última llegada{' '}
                                                {formatFechaDisplay(fechaUltimaRecepcion)}
                                            </Text>
                                        ) : null}
                                        <ScrollView horizontal showsHorizontalScrollIndicator>
                                            <View style={recStyles.detalleTable}>
                                                <View
                                                    style={[
                                                        recStyles.detalleTableHead,
                                                        { borderBottomColor: colors.border },
                                                    ]}
                                                >
                                                    {(
                                                        [
                                                            ['Envío', 52],
                                                            ['Fecha', 88],
                                                            ['Código', 72],
                                                            ['Registrado por', 120],
                                                            ['Proveedor', 140],
                                                            ['Cantidad', 88],
                                                            ['Tipo', 88],
                                                            ['Motivo', 120],
                                                        ] as const
                                                    ).map(([label, w]) => (
                                                        <Text
                                                            key={label}
                                                            style={[
                                                                recStyles.detalleTh,
                                                                { width: w, color: colors.subText },
                                                            ]}
                                                        >
                                                            {label.toUpperCase()}
                                                        </Text>
                                                    ))}
                                                </View>
                                                {getEvaluacionesProveedorRequisicion(req).flatMap((ev) =>
                                                    ev.llegadas.map((l) => {
                                                        const linea = req.recepcion!.lineas.find(
                                                            (x) =>
                                                                x.proveedorId === ev.proveedorId &&
                                                                x.codigoUsuario === l.codigoUsuario &&
                                                                x.fechaLlegada === l.fechaLlegada,
                                                        );
                                                        return (
                                                            <View
                                                                key={`${ev.proveedorId}-${l.orden}-${l.codigoUsuario}`}
                                                                style={[
                                                                    recStyles.detalleTableRow,
                                                                    {
                                                                        borderBottomColor: colors.border,
                                                                    },
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 52, color: colors.text },
                                                                    ]}
                                                                >
                                                                    {l.orden}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 88, color: colors.text },
                                                                    ]}
                                                                >
                                                                    {formatFechaDisplay(l.fechaLlegada)}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 72, color: colors.text },
                                                                    ]}
                                                                >
                                                                    {l.codigoUsuario}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 120, color: colors.text },
                                                                    ]}
                                                                    numberOfLines={2}
                                                                >
                                                                    {linea?.registradoPorNombre || '—'}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 140, color: colors.text },
                                                                    ]}
                                                                    numberOfLines={2}
                                                                >
                                                                    {ev.nombreProveedor}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 88, color: colors.text },
                                                                    ]}
                                                                >
                                                                    {l.cantidadRecibida} {req.unidad}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        {
                                                                            width: 88,
                                                                            color: l.esParcial ? '#F59E0B' : '#22C55E',
                                                                        },
                                                                    ]}
                                                                >
                                                                    {l.esParcial
                                                                        ? `Parcial · ${l.cantidadRecibida}/${l.saldoPendienteAntes ?? ev.cantidadPedidaTotal}`
                                                                        : 'Completo'}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        recStyles.detalleTd,
                                                                        { width: 120, color: colors.subText },
                                                                    ]}
                                                                    numberOfLines={2}
                                                                >
                                                                    {linea?.motivoCantidadParcial?.trim() || '—'}
                                                                </Text>
                                                            </View>
                                                        );
                                                    }),
                                                )}
                                            </View>
                                        </ScrollView>
                                        <Text style={{ color: colors.subText, fontSize: 11, marginTop: 8 }}>
                                            Evaluación de puntualidad en la pestaña Calidad proveedores.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            })}
        </>
    );

    return (
        <View style={[recStyles.card, recStyles.cardRecepcion, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <View style={recStyles.cardHeader}>
                <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={[recStyles.titulo, { color: colors.text }]}>Recepción de pedidos</Text>
                    <Text style={[recStyles.subtitulo, { color: colors.subText }]}>{tipoActivoMeta.label}</Text>
                </View>
            </View>

            <Text style={[recStyles.ayuda, { color: colors.subText }]}>
                Reciba cada envío por proveedor. Los pedidos en tránsito aparecen en «En tránsito»; al recibir el 100 %
                pasan a «Historial» y siguen consultables con el detalle de cada llegada.
            </Text>

            <AlmacenFiltroEstado
                opciones={OPCIONES_FILTRO_ESTADO_RECEPCION}
                activo={filtroEstado}
                onChange={handleCambioFiltroEstado}
                conteos={conteoEstadoEnTipo}
                colors={colors}
                isDarkMode={isDarkMode}
            />

            {filtroEstado === 'En Almacen' && totalTipo > 0 && (
                <Text style={[recStyles.historialBanner, { color: colors.subText, borderColor: colors.border }]}>
                    {totalTipo} pedido{totalTipo === 1 ? '' : 's'} recibido{totalTipo === 1 ? '' : 's'} al 100 %. Pulse
                    «Ver historial» o ▶ para ver fechas, códigos y cantidades de cada envío.
                </Text>
            )}

            {totalTipo === 0 ? (
                <Text style={[recStyles.vacio, { color: colors.subText }]}>
                    {filtroEstado === 'todos'
                        ? `No hay recepciones en «${tipoActivoMeta.label}».`
                        : filtroEstado === 'En Almacen'
                          ? `Aún no hay pedidos en historial para «${tipoActivoMeta.label}». Al completar una recepción al 100 % aparecerá aquí.`
                          : `No hay registros en estado «${
                                OPCIONES_FILTRO_ESTADO_RECEPCION.find((o) => o.id === filtroEstado)?.label ??
                                filtroEstado
                            }» en «${tipoActivoMeta.label}».`}
                </Text>
            ) : (
                <>
                    {isWide ? (
                        <View style={recStyles.tableWrap}>{tabla}</View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={recStyles.tableWrapNarrow}>{tabla}</View>
                        </ScrollView>
                    )}

                    <View style={[recStyles.paginationBar, { borderTopColor: colors.border }]}>
                        <Text style={[recStyles.paginationInfo, { color: colors.subText }]}>
                            Mostrando {indiceInicio + 1}–{indiceFin} de {totalTipo} · Página {paginaActual} de{' '}
                            {totalPaginas}
                        </Text>
                        <View style={recStyles.paginationControls}>
                            <TouchableOpacity
                                style={[
                                    recStyles.paginationBtn,
                                    { borderColor: colors.border },
                                    paginaActual <= 1 && recStyles.paginationBtnDisabled,
                                ]}
                                onPress={() => setPagina((p) => Math.max(1, p - 1))}
                                disabled={paginaActual <= 1}
                            >
                                <Text
                                    style={{
                                        color: paginaActual <= 1 ? colors.subText : colors.text,
                                        fontWeight: '600',
                                    }}
                                >
                                    ← Anterior
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    recStyles.paginationBtn,
                                    recStyles.paginationBtnPrimary,
                                    paginaActual >= totalPaginas && recStyles.paginationBtnDisabled,
                                ]}
                                onPress={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                                disabled={paginaActual >= totalPaginas}
                            >
                                <Text style={recStyles.paginationBtnTextPrimary}>Siguiente →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}

            <View
                style={[
                    recStyles.sheetTabsBar,
                    {
                        backgroundColor: isDarkMode ? '#0F172A' : '#E8ECF0',
                        borderTopColor: colors.border,
                    },
                ]}
            >
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={recStyles.sheetTabsScroll}>
                    {TIPOS_REQUISICION.map((tipo) => {
                        const activa = tipoActivo === tipo.id;
                        const count = conteoPorTipo[tipo.id] ?? 0;
                        return (
                            <TouchableOpacity
                                key={tipo.id}
                                style={[
                                    recStyles.sheetTab,
                                    {
                                        backgroundColor: activa
                                            ? isDarkMode
                                                ? '#1E293B'
                                                : '#FFFFFF'
                                            : isDarkMode
                                              ? '#1E293B'
                                              : '#D1D9E6',
                                        borderTopColor: activa ? tipo.accentColor : 'transparent',
                                    },
                                    activa && recStyles.sheetTabActive,
                                ]}
                                onPress={() => handleCambioTipo(tipo.id)}
                                activeOpacity={0.85}
                            >
                                <Text
                                    style={[
                                        recStyles.sheetTabText,
                                        { color: activa ? colors.text : colors.subText, fontWeight: activa ? '700' : '500' },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {tipo.label}
                                </Text>
                                {count > 0 && (
                                    <AlmacenContadorBadge
                                        count={count}
                                        accentColor={tipo.accentColor}
                                        variant="tab"
                                        activo={activa}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <Modal visible={!!modalId} transparent animationType="fade" onRequestClose={cerrarModal}>
                <View style={recStyles.modalOverlay}>
                    <View
                        style={[recStyles.modalBox, { backgroundColor: cardBg, borderColor: colors.border }]}
                    >
                        <Text style={[recStyles.modalTitle, { color: colors.text }]}>
                            Recibir envío — {reqModal?.codigo}
                        </Text>
                        {reqModal?.pedido && proveedorActivo && (
                            <Text style={{ color: colors.subText, marginBottom: 12 }}>
                                {reqModal.producto} · {proveedorActivo.nombre}: {cantidadMaxProveedor}{' '}
                                {reqModal.unidad}
                                {proveedorActivo.fechaEntregaEstimada
                                    ? ` · est. ${formatFechaDisplay(proveedorActivo.fechaEntregaEstimada)}`
                                    : ''}
                            </Text>
                        )}

                        {proveedoresPendientesModal.length > 1 && (
                            <View style={recStyles.selectorProv}>
                                <Text style={[recStyles.label, { color: colors.subText, marginTop: 0 }]}>
                                    Proveedor a recibir *
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {proveedoresPendientesModal.map((p) => {
                                        const activo = p.id === proveedorSeleccionadoId;
                                        return (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={[
                                                    recStyles.chipProv,
                                                    {
                                                        borderColor: activo ? colors.primary : colors.border,
                                                        backgroundColor: activo
                                                            ? `${colors.primary}22`
                                                            : inputBg,
                                                    },
                                                ]}
                                                onPress={() => seleccionarProveedorRecepcion(p.id)}
                                            >
                                                <Text
                                                    style={{
                                                        color: activo ? colors.text : colors.subText,
                                                        fontWeight: activo ? '700' : '500',
                                                        fontSize: 13,
                                                    }}
                                                >
                                                    {p.nombre} ({p.cantidad} {reqModal?.unidad})
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
                            <Text style={[recStyles.label, { color: colors.subText }]}>Código de recepción *</Text>
                            <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 6 }}>
                                Código del Xpertis
                            </Text>
                            <TextInput
                                style={[
                                    recStyles.input,
                                    {
                                        backgroundColor: inputBg,
                                        borderColor: colors.border,
                                        color: colors.text,
                                    },
                                ]}
                                placeholder="Ej. REC-2026-0142"
                                placeholderTextColor={colors.subText}
                                value={codigoRecepcion}
                                onChangeText={(t) => {
                                    setCodigoRecepcion(t);
                                    setErrorValidacion(null);
                                }}
                                autoCapitalize="characters"
                            />

                            <Text style={[recStyles.label, { color: colors.subText }]}>Fecha de llegada *</Text>
                            <AlmacenCampoFecha
                                value={fechaLlegada}
                                onChange={(v) => {
                                    setFechaLlegada(v);
                                    setErrorValidacion(null);
                                }}
                                colors={colors}
                                isDarkMode={isDarkMode}
                                inputBg={inputBg}
                            />

                            <GrupoSiNo
                                label="Calidad esperada"
                                value={calidadEsperada}
                                onChange={setCalidadEsperada}
                                motivo={motivoCalidad}
                                onMotivoChange={setMotivoCalidad}
                                motivoPlaceholder="¿Por qué la calidad no fue la esperada?"
                                colors={colors}
                                inputBg={inputBg}
                                required
                            />

                            <GrupoSiNo
                                label="Factura entregada"
                                value={facturaEntregada}
                                onChange={setFacturaEntregada}
                                motivo={motivoFactura}
                                onMotivoChange={setMotivoFactura}
                                motivoPlaceholder="¿Por qué no se entregó la factura?"
                                colors={colors}
                                inputBg={inputBg}
                                required
                            />

                            <GrupoSiNo
                                label={`¿Llegó todo el saldo pendiente de ${proveedorActivo?.nombre ?? 'este proveedor'}? (${cantidadMaxProveedor} ${reqModal?.unidad ?? ''})`}
                                value={pedidoCompleto}
                                onChange={setPedidoCompleto}
                                motivo=""
                                onMotivoChange={() => {}}
                                motivoPlaceholder=""
                                colors={colors}
                                inputBg={inputBg}
                                required
                                showMotivoOnNo={false}
                            />

                            {pedidoCompleto === true && (
                                <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 8 }}>
                                    Se registrarán {cantidadMaxProveedor} {reqModal?.unidad} (todo el saldo
                                    pendiente de este proveedor).
                                </Text>
                            )}

                            {pedidoCompleto === false && (
                                <View style={recStyles.parcialBlock}>
                                    <Text style={[recStyles.label, { color: colors.subText }]}>
                                        Cantidad que llegó en este envío * (saldo pendiente:{' '}
                                        {cantidadMaxProveedor} {reqModal?.unidad})
                                    </Text>
                                    <View
                                        style={[
                                            recStyles.cantidadConUnidad,
                                            { backgroundColor: inputBg, borderColor: colors.border },
                                        ]}
                                    >
                                        <TextInput
                                            style={[recStyles.cantidadInput, { color: colors.text }]}
                                            placeholder="Cantidad"
                                            placeholderTextColor={colors.subText}
                                            value={cantidadLlegada}
                                            onChangeText={(t) => setCantidadLlegada(t.replace(/[^0-9.,]/g, ''))}
                                            keyboardType="decimal-pad"
                                        />
                                        {reqModal?.unidad ? (
                                            <Text style={[recStyles.unidadAlLado, { color: colors.subText }]}>
                                                {reqModal.unidad}
                                            </Text>
                                        ) : null}
                                    </View>

                                    <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 8 }}>
                                        El sistema guardará esta llegada en el historial y dejará pendiente el
                                        saldo. La próxima fecha de llegada se registra en Pedidos → Completar pedido.
                                    </Text>

                                    <Text style={[recStyles.label, { color: colors.subText, marginTop: 14 }]}>
                                        Motivo de llegada parcial *
                                    </Text>
                                    <TextInput
                                        style={[
                                            recStyles.input,
                                            recStyles.textArea,
                                            {
                                                backgroundColor: inputBg,
                                                borderColor: colors.border,
                                                color: colors.text,
                                            },
                                        ]}
                                        placeholder="Explique por qué solo llegó esa cantidad"
                                        placeholderTextColor={colors.subText}
                                        value={motivoParcial}
                                        onChangeText={setMotivoParcial}
                                        multiline
                                    />
                                </View>
                            )}
                        </ScrollView>

                        {errorValidacion ? (
                            <View
                                style={[
                                    recStyles.errorBanner,
                                    {
                                        backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                                        borderColor: '#EF4444',
                                    },
                                ]}
                            >
                                <Text style={{ color: '#F87171', fontSize: 13, lineHeight: 18 }}>
                                    {errorValidacion}
                                </Text>
                            </View>
                        ) : null}

                        <View style={recStyles.modalFooter}>
                            <TouchableOpacity
                                style={[recStyles.btnSecundario, { borderColor: colors.border }]}
                                onPress={cerrarModal}
                            >
                                <Text style={{ color: colors.text }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[recStyles.btnPrimario, guardando && { opacity: 0.6 }]}
                                onPress={guardarRecepcion}
                                disabled={guardando}
                            >
                                <Text style={recStyles.btnPrimarioText}>
                                    {guardando ? 'Guardando…' : 'Guardar recepción'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const recStyles = StyleSheet.create({
    card: { borderRadius: 12, borderWidth: 1, padding: 24 },
    cardRecepcion: { paddingBottom: 0, overflow: 'hidden' },
    cardHeader: { marginBottom: 8 },
    titulo: { fontSize: 20, fontWeight: '600' },
    subtitulo: { fontSize: 14, marginTop: 4, fontWeight: '500' },
    ayuda: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
    historialBanner: {
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 8,
        borderStyle: 'dashed',
    },
    vacio: { textAlign: 'center', paddingVertical: 40, fontSize: 15 },
    tableWrap: { width: '100%' },
    tableWrapNarrow: { minWidth: 1180, width: '100%' },
    tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, marginBottom: 4 },
    th: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingRight: 6 },
    tableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
    td: { fontSize: 14 },
    expandBtn: { width: 36, paddingTop: 2 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    detallePanel: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, marginLeft: 36 },
    detalleTitulo: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    detalleSubtitulo: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
    detalleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    detalleItem: { width: '30%', minWidth: 180, marginBottom: 8 },
    detalleTable: { minWidth: 576 },
    detalleTableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
    detalleTableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
    detalleTh: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, paddingRight: 8 },
    detalleTd: { fontSize: 13, paddingRight: 8 },
    proveedorColumnasWrap: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: 12,
        paddingBottom: 4,
    },
    proveedorColumna: {
        width: 300,
        minWidth: 280,
        maxWidth: 380,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
    },
    ocBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 8,
    },
    ocBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    proveedorColumnaTitulo: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 19,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(148,163,184,0.4)',
        flexShrink: 1,
    },
    proveedorColumnaFila: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    proveedorColumnaLabel: { fontSize: 11, flex: 1 },
    proveedorColumnaValor: { fontSize: 13, flex: 1, textAlign: 'right' },
    btnPrimario: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnPrimarioText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
    btnSecundario: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sheetTabsBar: {
        marginTop: 20,
        marginHorizontal: -24,
        borderTopWidth: 1,
        paddingTop: 2,
    },
    sheetTabsScroll: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4, gap: 2 },
    sheetTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: 3,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        minWidth: 120,
        maxWidth: 220,
    },
    sheetTabActive: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: -2 },
        elevation: 2,
    },
    sheetTabText: { fontSize: 12, flexShrink: 1 },
    sheetTabBadge: {
        marginLeft: 8,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    sheetTabBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    paginationBar: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    paginationInfo: { fontSize: 14, flex: 1, minWidth: 200 },
    paginationControls: { flexDirection: 'row', gap: 10 },
    paginationBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
    },
    paginationBtnPrimary: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    paginationBtnDisabled: { opacity: 0.45 },
    paginationBtnTextPrimary: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalBox: { width: '100%', maxWidth: 560, borderRadius: 12, borderWidth: 1, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 14 },
    input: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 15,
    },
    textArea: {
        minHeight: 88,
        height: 'auto',
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        textAlignVertical: 'top',
    },
    campoGrupo: { marginTop: 4 },
    siNoRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    siNoBtn: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 72,
        alignItems: 'center',
    },
    siNoBtnActivo: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    siNoBtnText: { fontSize: 14, fontWeight: '600' },
    parcialBlock: { marginTop: 4 },
    selectorProv: { marginBottom: 12 },
    chipProv: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
        marginTop: 6,
    },
    cantidadConUnidad: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 160,
        maxWidth: 200,
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
    },
    cantidadInput: { flex: 1, fontSize: 15 },
    unidadAlLado: { fontSize: 14, fontWeight: '600', marginLeft: 6 },
    errorBanner: {
        marginTop: 10,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
});
