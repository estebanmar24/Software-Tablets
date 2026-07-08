import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Platform,
    useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { almacenAlert } from '../utils/almacenAlert';
import AlmacenConfirmModal from './AlmacenConfirmModal';
import { generarOrdenCompraPdf, generarOrdenCompraConsolidadaPdf } from '../utils/almacenOrdenCompraPdf';
import {
    type Requisicion,
    type ProveedorAsignado,
    type ProveedorCatalogo,
    type ProductoInsumo,
    type DatosPedido,
    type TipoRequisicionId,
    type ConsolidarPedidoPayload,
    type OrdenCompra,
    TIPOS_REQUISICION,
    formatFechaHoy,
    formatFechaDisplay,
    getTipoRequisicionLabel,
    esRequisicionEnPedidos,
    esRequisicionConPedidoActivo,
    compareEstadoRequisicion,
    OPCIONES_FILTRO_ESTADO_PEDIDOS,
    normalizarProveedoresPedido,
    normalizarPedido,
    getFechaEntregaResumenPedido,
    getResumenCantidadesPedido,
    getSaldoPendienteProveedor,
    getCantidadRecibidaProveedor,
    getCantidadPedidaOriginalProveedor,
    esProveedorConRecepcionParcial,
    tieneProveedoresConRecepcionParcial,
    findProveedorCatalogoPorNombre,
    filtrarProveedorCatalogo,
    datosProveedorDesdeCatalogo,
    resumenProveedorContacto,
    GRUPOS_CATEGORIAS_PROVEEDOR,
    proveedorIncluyeIvaEnOrden,
    responsableIvaDesdeCategoria,
    enriquecerProveedorFiscal,
    getLineasFiscalesProveedor,
    resolverCostoEstandarProducto,
    resolverPrecioInicialProveedor,
    formatearMonedaCop,
    formatearPrecioCopMientrasEscribe,
    formatPrecioCopInput,
    getPrecioUnitarioDisplay,
    parsePrecioCopInput,
    getCantidadTotalPedido,
    getSubtotalProveedor,
    getTotalPedidoMonetario,
    formatearConsecutivoOrdenCompra,
    labelFormaPagoAlmacen,
    textoIngresadoPorPedido,
} from '../data/almacenMockData';
import { extraerMensajeErrorApi, importarProveedoresExcel, getOrdenCompra, listarOrdenesCompraPorProveedor } from '../services/almacenApi';
import AlmacenEstadoBadge from './AlmacenEstadoBadge';
import AlmacenContadorBadge from './AlmacenContadorBadge';
import AlmacenFiltroEstado, { type FiltroEstadoValor } from './AlmacenFiltroEstado';
import AlmacenCampoFecha from './AlmacenCampoFecha';

const PEDIDOS_POR_PAGINA = 10;
const CATALOGO_POR_PAGINA = 15;
const PRODUCTOS_POR_PAGINA = 15;
const PROVEEDOR_PICKER_POR_PAGINA = 12;

type FiltroCategoriaProducto = 'todas' | TipoRequisicionId;

function descripcionProductoVisible(p: ProductoInsumo): string {
    const d = (p.descripcion ?? '').trim();
    if (!d) return '';
    if (d.localeCompare(p.nombre.trim(), undefined, { sensitivity: 'accent' }) === 0) return '';
    return d;
}

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
    inputBackground: string;
};

type PaginacionBarProps = {
    paginaActual: number;
    totalPaginas: number;
    indiceInicio: number;
    indiceFin: number;
    totalItems: number;
    onAnterior: () => void;
    onSiguiente: () => void;
    colors: ThemeColors;
    compacto?: boolean;
    etiquetaItems?: string;
};

function PaginacionBar({
    paginaActual,
    totalPaginas,
    indiceInicio,
    indiceFin,
    totalItems,
    onAnterior,
    onSiguiente,
    colors,
    compacto,
    etiquetaItems = 'ítem',
}: PaginacionBarProps) {
    if (totalItems <= 0) return null;
    const btnStyle = compacto ? pedidoStyles.catalogoPaginationBtn : pedidoStyles.paginationBtn;
    return (
        <View style={[pedidoStyles.catalogoPaginationBar, { borderTopColor: colors.border }]}>
            <Text style={[pedidoStyles.catalogoPaginationInfo, { color: colors.subText }]}>
                {totalPaginas > 1
                    ? `Página ${paginaActual} de ${totalPaginas} · ${indiceInicio + 1}–${indiceFin} de ${totalItems}`
                    : `${totalItems} ${etiquetaItems}`}
            </Text>
            {totalPaginas > 1 ? (
                <View style={pedidoStyles.paginationControls}>
                    <TouchableOpacity
                        style={[
                            btnStyle,
                            { borderColor: colors.border },
                            paginaActual <= 1 && pedidoStyles.paginationBtnDisabled,
                        ]}
                        onPress={onAnterior}
                        disabled={paginaActual <= 1}
                    >
                        <Text
                            style={[
                                pedidoStyles.btnSecundarioText,
                                { color: paginaActual <= 1 ? colors.subText : colors.text, fontSize: compacto ? 13 : 15 },
                            ]}
                        >
                            ← Anterior
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            btnStyle,
                            pedidoStyles.paginationBtnPrimary,
                            paginaActual >= totalPaginas && pedidoStyles.paginationBtnDisabled,
                        ]}
                        onPress={onSiguiente}
                        disabled={paginaActual >= totalPaginas}
                    >
                        <Text style={[pedidoStyles.paginationBtnTextPrimary, compacto && { fontSize: 13 }]}>
                            Siguiente →
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
}

type GruposCategoriaProveedorChipsProps = {
    categoriaActiva?: string;
    onSeleccionar: (id: string | undefined) => void;
    disabled?: boolean;
    colors: ThemeColors;
};

function GruposCategoriaProveedorChips({
    categoriaActiva,
    onSeleccionar,
    disabled,
    colors,
}: GruposCategoriaProveedorChipsProps) {
    return (
        <>
            {GRUPOS_CATEGORIAS_PROVEEDOR.map((grupo) => (
                <View key={grupo.titulo} style={{ marginBottom: 8 }}>
                    <Text style={[pedidoStyles.labelMini, { color: colors.subText, marginBottom: 6 }]}>
                        {grupo.titulo}
                    </Text>
                    <View style={pedidoStyles.catalogoChipsRow}>
                        {grupo.categorias.map((cat) => {
                            const activo = categoriaActiva === cat.id;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        pedidoStyles.filtroChip,
                                        { borderColor: colors.border },
                                        activo && {
                                            backgroundColor: colors.primary,
                                            borderColor: colors.primary,
                                        },
                                    ]}
                                    disabled={disabled}
                                    onPress={() => onSeleccionar(activo ? undefined : cat.id)}
                                >
                                    <Text
                                        style={[
                                            pedidoStyles.filtroChipText,
                                            { color: activo ? '#fff' : colors.text },
                                        ]}
                                    >
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ))}
        </>
    );
}

type ProveedorCatalogoPickerProps = {
    catalogo: ProveedorCatalogo[];
    busqueda: string;
    onBusquedaChange: (texto: string) => void;
    pagina: number;
    onPaginaChange: (pagina: number) => void;
    onSeleccionar: (cat: ProveedorCatalogo) => void;
    seleccionadoId?: string;
    colors: ThemeColors;
    isDarkMode: boolean;
    inputBg: string;
    listMaxHeight: number;
    soloLectura?: boolean;
};

function ProveedorCatalogoPicker({
    catalogo,
    busqueda,
    onBusquedaChange,
    pagina,
    onPaginaChange,
    onSeleccionar,
    seleccionadoId,
    colors,
    isDarkMode,
    inputBg,
    listMaxHeight,
    soloLectura,
}: ProveedorCatalogoPickerProps) {
    const filtrados = useMemo(
        () => filtrarProveedorCatalogo(catalogo, busqueda),
        [catalogo, busqueda]
    );
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PROVEEDOR_PICKER_POR_PAGINA));
    const paginaActual = Math.min(pagina, totalPaginas);
    const indiceInicio = (paginaActual - 1) * PROVEEDOR_PICKER_POR_PAGINA;
    const indiceFin = Math.min(indiceInicio + PROVEEDOR_PICKER_POR_PAGINA, filtrados.length);
    const paginaItems = filtrados.slice(indiceInicio, indiceFin);

    useEffect(() => {
        if (pagina > totalPaginas && totalPaginas > 0) onPaginaChange(totalPaginas);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagina, totalPaginas]);

    return (
        <View style={pedidoStyles.provPickerPanel}>
            <View style={pedidoStyles.provPickerHeader}>
                <Text style={[pedidoStyles.provPickerTitulo, { color: colors.text }]}>Catálogo</Text>
                <View style={[pedidoStyles.provPickerBadge, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                    <Text style={[pedidoStyles.provPickerBadgeText, { color: colors.subText }]}>
                        {busqueda.trim()
                            ? `${filtrados.length} de ${catalogo.length}`
                            : catalogo.length}
                    </Text>
                </View>
            </View>
            <TextInput
                style={[
                    pedidoStyles.inputCompact,
                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Buscar por nombre, NIT o teléfono…"
                placeholderTextColor={colors.subText}
                value={busqueda}
                editable={!soloLectura}
                onChangeText={(t) => {
                    onBusquedaChange(t);
                    onPaginaChange(1);
                }}
            />
            <View
                style={[
                    pedidoStyles.provPickerList,
                    {
                        borderColor: colors.border,
                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                        maxHeight: listMaxHeight,
                    },
                ]}
            >
                <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    style={Platform.OS === 'web' ? pedidoStyles.provPickerListScrollWeb : undefined}
                >
                    {filtrados.length === 0 ? (
                        <Text style={[pedidoStyles.sinResultados, { color: colors.subText }]}>
                            {catalogo.length === 0
                                ? 'No hay proveedores. Importe el Excel con + Proveedores.'
                                : 'Sin coincidencias. Pruebe otro término o escriba el nombre manualmente.'}
                        </Text>
                    ) : (
                        paginaItems.map((cat, idx) => {
                            const seleccionado = seleccionadoId === cat.id;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        pedidoStyles.provPickerItem,
                                        {
                                            borderBottomColor: colors.border,
                                            borderBottomWidth: idx < paginaItems.length - 1 ? 1 : 0,
                                            backgroundColor: seleccionado
                                                ? isDarkMode
                                                    ? 'rgba(59, 130, 246, 0.2)'
                                                    : 'rgba(59, 130, 246, 0.1)'
                                                : 'transparent',
                                        },
                                    ]}
                                    onPress={() => !soloLectura && onSeleccionar(cat)}
                                    disabled={soloLectura}
                                    activeOpacity={0.75}
                                >
                                    <Text
                                        style={{
                                            color: colors.text,
                                            fontWeight: seleccionado ? '700' : '600',
                                            fontSize: 13,
                                        }}
                                        numberOfLines={2}
                                    >
                                        {cat.nombre}
                                    </Text>
                                    <Text style={{ color: colors.subText, fontSize: 11 }} numberOfLines={2}>
                                        {resumenProveedorContacto(cat)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </View>
            <PaginacionBar
                paginaActual={paginaActual}
                totalPaginas={totalPaginas}
                indiceInicio={indiceInicio}
                indiceFin={indiceFin}
                totalItems={filtrados.length}
                onAnterior={() => onPaginaChange(Math.max(1, paginaActual - 1))}
                onSiguiente={() => onPaginaChange(Math.min(totalPaginas, paginaActual + 1))}
                colors={colors}
                compacto
            />
        </View>
    );
}

interface AlmacenPedidosTabProps {
    requisiciones: Requisicion[];
    productos: ProductoInsumo[];
    onGuardarPedido: (requisicionId: string, datos: DatosPedido) => Promise<void>;
    onConsolidarPedido: (payload: ConsolidarPedidoPayload) => Promise<OrdenCompra>;
    onMarcarProveedorPagado: (
        requisicionId: string,
        proveedorId: string,
        pagado: boolean,
        formaPago?: 'credito' | 'efectivo'
    ) => Promise<void>;
    onGuardarProveedorCatalogo: (payload: {
        id?: string;
        nombre: string;
        nit?: string;
        correo?: string;
        telefonoTrabajo?: string;
        telefonoMovil?: string;
        direccion?: string;
        categoria?: string;
        responsableIva?: boolean;
    }) => Promise<ProveedorCatalogo>;
    onRecargarCatalogoProveedores: () => Promise<void>;
    onRecargarCatalogoProductos: () => Promise<void>;
    onGuardarProductoCatalogo: (payload: {
        id?: string;
        nombre: string;
        descripcion?: string;
        costoEstandar?: number;
        tipoRequisicion: TipoRequisicionId;
        unidadSugerida?: string;
    }) => Promise<ProductoInsumo>;
    onEliminarProductoCatalogo: (id: string) => Promise<void>;
    onEliminarProveedorCatalogo: (id: string) => Promise<void>;
    unidadesMedida: string[];
    catalogoProveedores: ProveedorCatalogo[];
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
    isWide: boolean;
}

const emptyProveedor = (fechaReferencia = '', precioUnitario?: number): ProveedorAsignado => ({
    id: String(Date.now() + Math.random()),
    nombre: '',
    cantidad: 0,
    fechaEntregaEstimada: fechaReferencia,
    precioUnitario,
    precioUnitarioTexto: formatPrecioCopInput(precioUnitario),
    responsableIva: false,
});

type ParcialPendienteEdit = {
    id: string;
    nombre: string;
    recibido: number;
    cantidadPendiente: number;
    cantidadPendienteTexto: string;
    fechaEntregaEstimada: string;
};

type LineaConsolidarEdit = {
    requisicionId: string;
    codigo: string;
    producto: string;
    cantidad: number;
    unidad: string;
    precioUnitario?: number;
    precioUnitarioTexto: string;
    fechaEntregaEstimada: string;
};

export default function AlmacenPedidosTab({
    requisiciones,
    productos,
    onGuardarPedido,
    onConsolidarPedido,
    onMarcarProveedorPagado,
    onGuardarProveedorCatalogo,
    onRecargarCatalogoProveedores,
    onRecargarCatalogoProductos,
    onGuardarProductoCatalogo,
    onEliminarProductoCatalogo,
    onEliminarProveedorCatalogo,
    unidadesMedida,
    catalogoProveedores,
    colors,
    isDarkMode,
    cardBg,
    isWide,
}: AlmacenPedidosTabProps) {
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const catalogoScrollMax = Math.max(320, Math.min(windowHeight * 0.68, 680));
    const modalPedidoScrollMax = Math.max(400, Math.min(windowHeight * 0.72, 720));
    const provPickerListMax = Math.max(260, Math.min(windowHeight * 0.32, 380));
    const modalPedidoAncho = Math.min(Math.max(windowWidth - 48, 560), 960);
    const inputBg = isDarkMode ? '#0F172A' : colors.inputBackground;
    const [tipoActivo, setTipoActivo] = useState<TipoRequisicionId>('consumo_diario');
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoValor>('todos');
    const [paginaPedido, setPaginaPedido] = useState(1);
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
    const [modalPedidoId, setModalPedidoId] = useState<string | null>(null);
    const [fechaPedido, setFechaPedido] = useState(formatFechaHoy());
    const [proveedores, setProveedores] = useState<ProveedorAsignado[]>([emptyProveedor()]);
    const [parcialPendientes, setParcialPendientes] = useState<ParcialPendienteEdit[]>([]);
    const [proveedorExpandidoId, setProveedorExpandidoId] = useState<string | null>(null);
    const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
    const [modalCatalogo, setModalCatalogo] = useState(false);
    const [modalListaProveedores, setModalListaProveedores] = useState(false);
    const [modalListaProductos, setModalListaProductos] = useState(false);
    const [modalFormProducto, setModalFormProducto] = useState(false);
    const [busquedaProductos, setBusquedaProductos] = useState('');
    const [filtroCategoriaProductos, setFiltroCategoriaProductos] = useState<FiltroCategoriaProducto>('todas');
    const [filtroUnidadProductos, setFiltroUnidadProductos] = useState<string>('todas');
    const [paginaProductos, setPaginaProductos] = useState(1);
    const [productoEditandoId, setProductoEditandoId] = useState<string | null>(null);
    const [prodNombre, setProdNombre] = useState('');
    const [prodDescripcion, setProdDescripcion] = useState('');
    const [prodCosto, setProdCosto] = useState('');
    const [prodTipo, setProdTipo] = useState<TipoRequisicionId>('consumo_diario');
    const [prodUnidad, setProdUnidad] = useState('');
    const [errorProductoForm, setErrorProductoForm] = useState<string | null>(null);
    const [guardandoProducto, setGuardandoProducto] = useState(false);
    const [confirmEliminarProducto, setConfirmEliminarProducto] = useState<ProductoInsumo | null>(null);
    const [confirmEliminarProveedor, setConfirmEliminarProveedor] = useState<ProveedorCatalogo | null>(null);
    const [eliminandoProveedor, setEliminandoProveedor] = useState(false);
    const [eliminandoProducto, setEliminandoProducto] = useState(false);
    const [catalogoEditandoId, setCatalogoEditandoId] = useState<string | null>(null);
    const [catNombre, setCatNombre] = useState('');
    const [catNit, setCatNit] = useState('');
    const [catCorreo, setCatCorreo] = useState('');
    const [catTelefonoTrabajo, setCatTelefonoTrabajo] = useState('');
    const [catTelefonoMovil, setCatTelefonoMovil] = useState('');
    const [catDireccion, setCatDireccion] = useState('');
    const [catCategoria, setCatCategoria] = useState<string | undefined>(undefined);
    const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
    const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
    const [busquedaPickerPorProveedor, setBusquedaPickerPorProveedor] = useState<Record<string, string>>({});
    const [paginaPickerPorProveedor, setPaginaPickerPorProveedor] = useState<Record<string, number>>({});
    const [guardando, setGuardando] = useState(false);
    const [importandoExcel, setImportandoExcel] = useState(false);
    const [paginaCatalogo, setPaginaCatalogo] = useState(1);
    const [generandoOcProveedorId, setGenerandoOcProveedorId] = useState<string | null>(null);
    const [marcandoPagadoKey, setMarcandoPagadoKey] = useState<string | null>(null);
    const [modalFormaPago, setModalFormaPago] = useState<{
        reqId: string;
        prov: ProveedorAsignado;
    } | null>(null);
    const [modalOcProveedorId, setModalOcProveedorId] = useState<string | null>(null);
    const [ordenesCompraPicker, setOrdenesCompraPicker] = useState<OrdenCompra[]>([]);
    const [cargandoOcPicker, setCargandoOcPicker] = useState(false);
    const [seleccionConsolidar, setSeleccionConsolidar] = useState<Record<string, boolean>>({});
    const [modalConsolidar, setModalConsolidar] = useState(false);
    const [fechaPedidoConsolidar, setFechaPedidoConsolidar] = useState(formatFechaHoy());
    const [fechaEntregaConsolidar, setFechaEntregaConsolidar] = useState('');
    const [proveedorConsolidar, setProveedorConsolidar] = useState<ProveedorAsignado>(emptyProveedor());
    const [lineasConsolidar, setLineasConsolidar] = useState<LineaConsolidarEdit[]>([]);
    const [guardandoConsolidar, setGuardandoConsolidar] = useState(false);
    const [errorConsolidar, setErrorConsolidar] = useState<string | null>(null);
    const [busquedaConsolidarProv, setBusquedaConsolidarProv] = useState('');
    const [paginaConsolidarProv, setPaginaConsolidarProv] = useState(1);
    const [pickerConsolidarProvAbierto, setPickerConsolidarProvAbierto] = useState(false);

    const pedidosElegibles = useMemo(
        () => requisiciones.filter((r) => esRequisicionEnPedidos(r.estado)),
        [requisiciones]
    );

    const conteoPorTipo = useMemo(() => {
        const map: Record<TipoRequisicionId, number> = {
            consumo_diario: 0,
            cajas_empaque: 0,
            gomas_adhesivos: 0,
            pantone: 0,
        };
        pedidosElegibles.forEach((r) => {
            map[r.tipoRequisicion] = (map[r.tipoRequisicion] ?? 0) + 1;
        });
        return map;
    }, [pedidosElegibles]);

    const tipoActivoMeta = useMemo(
        () => TIPOS_REQUISICION.find((t) => t.id === tipoActivo) ?? TIPOS_REQUISICION[0],
        [tipoActivo]
    );

    const pedidosDelTipoSinEstado = useMemo(
        () => pedidosElegibles.filter((r) => r.tipoRequisicion === tipoActivo),
        [pedidosElegibles, tipoActivo]
    );

    const conteoEstadoEnTipo = useMemo(() => {
        const base = pedidosDelTipoSinEstado;
        return {
            todos: base.length,
            Pendiente: base.filter((r) => r.estado === 'Pendiente').length,
            Pedido: base.filter((r) => r.estado === 'Pedido').length,
            Parcial: base.filter((r) => r.estado === 'Parcial').length,
            'En Almacen': base.filter((r) => r.estado === 'En Almacen').length,
        };
    }, [pedidosDelTipoSinEstado]);

    const listaDelTipo = useMemo(() => {
        const filtradas =
            filtroEstado === 'todos'
                ? pedidosDelTipoSinEstado
                : pedidosDelTipoSinEstado.filter((r) => r.estado === filtroEstado);
        return [...filtradas].sort((a, b) => {
            const porEstado = compareEstadoRequisicion(a.estado, b.estado);
            if (porEstado !== 0) return porEstado;
            return b.codigo.localeCompare(a.codigo);
        });
    }, [pedidosDelTipoSinEstado, filtroEstado]);

    const modoSeleccionConsolidar = filtroEstado === 'Pendiente';

    const reqsSeleccionadasConsolidar = useMemo(
        () => pedidosDelTipoSinEstado.filter((r) => r.estado === 'Pendiente' && seleccionConsolidar[r.id]),
        [pedidosDelTipoSinEstado, seleccionConsolidar]
    );

    const totalPedidosTipo = listaDelTipo.length;
    const totalPaginas = Math.max(1, Math.ceil(totalPedidosTipo / PEDIDOS_POR_PAGINA));
    const paginaActual = Math.min(paginaPedido, totalPaginas);
    const indiceInicio = (paginaActual - 1) * PEDIDOS_POR_PAGINA;
    const indiceFin = Math.min(indiceInicio + PEDIDOS_POR_PAGINA, totalPedidosTipo);
    const listaPagina = useMemo(
        () => listaDelTipo.slice(indiceInicio, indiceFin),
        [listaDelTipo, indiceInicio, indiceFin]
    );

    useEffect(() => {
        if (paginaPedido > totalPaginas) {
            setPaginaPedido(totalPaginas);
        }
    }, [paginaPedido, totalPaginas, tipoActivo, filtroEstado]);

    useEffect(() => {
        if (!modoSeleccionConsolidar) setSeleccionConsolidar({});
    }, [modoSeleccionConsolidar, tipoActivo]);

    const reqModal = pedidosElegibles.find((r) => r.id === modalPedidoId);

    const costoCatalogoModal = useMemo(() => {
        if (!reqModal) return undefined;
        return resolverCostoEstandarProducto(reqModal.producto, productos);
    }, [reqModal, productos]);

    const cantidadPedidaModal = useMemo(
        () => getCantidadTotalPedido({ fechaPedido, fechaEntregaEstimada: '', proveedores }),
        [fechaPedido, proveedores]
    );

    const totalPedidoModal = useMemo(
        () => getTotalPedidoMonetario({ fechaPedido, fechaEntregaEstimada: '', proveedores }),
        [fechaPedido, proveedores]
    );

    const handleCambioTipo = (tipo: TipoRequisicionId) => {
        setTipoActivo(tipo);
        setPaginaPedido(1);
        setExpandidas({});
    };

    const handleCambioFiltroEstado = (estado: FiltroEstadoValor) => {
        setFiltroEstado(estado);
        setPaginaPedido(1);
        setExpandidas({});
    };

    const toggleDetalle = (id: string) => {
        setExpandidas((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const mapProveedorConPrecio = (req: Requisicion, p: ProveedorAsignado): ProveedorAsignado => {
        const precio = resolverPrecioInicialProveedor(
            req.producto,
            productos,
            p.precioUnitario,
            req.pedido?.precioUnitario
        );
        return {
            ...p,
            precioUnitario: precio,
            precioUnitarioTexto: formatPrecioCopInput(precio),
        };
    };

    const mapProveedorParaEdicion = (req: Requisicion, p: ProveedorAsignado): ProveedorAsignado => {
        let base = mapProveedorConPrecio(req, { ...p });
        const cat = base.catalogoId
            ? catalogoProveedores.find((c) => c.id === base.catalogoId)
            : findProveedorCatalogoPorNombre(catalogoProveedores, base.nombre);
        if (cat) {
            base = {
                ...base,
                categoria: base.categoria ?? cat.categoria,
                responsableIva: base.responsableIva ?? cat.responsableIva ?? false,
            };
        } else if (base.responsableIva == null) {
            base = { ...base, responsableIva: false };
        }
        if (req.estado !== 'Parcial') return base;
        const saldo = getSaldoPendienteProveedor(req.recepcion, base);
        if (saldo > 0 && !base.recibido) {
            return { ...base, cantidad: saldo };
        }
        return base;
    };

    const abrirModalPedido = async (req: Requisicion, editar: boolean) => {
        await onRecargarCatalogoProveedores();
        setModalPedidoId(req.id);
        setErrorValidacion(null);
        const costoCatalogo = resolverCostoEstandarProducto(req.producto, productos);
        if (editar && req.pedido) {
            const pedidoNorm = normalizarPedido(req.pedido);
            setFechaPedido(pedidoNorm.fechaPedido);
            if (req.estado === 'Parcial') {
                const conRecepcionParcial = pedidoNorm.proveedores.filter((p) =>
                    esProveedorConRecepcionParcial(req.recepcion, p)
                );
                if (conRecepcionParcial.length > 0) {
                    const pendientes = conRecepcionParcial.map((p) => {
                        const recibido = getCantidadRecibidaProveedor(req.recepcion, p.id);
                        const cantidadPendiente = getSaldoPendienteProveedor(req.recepcion, p);
                        return {
                            id: p.id,
                            nombre: p.nombre,
                            recibido,
                            cantidadPendiente,
                            cantidadPendienteTexto:
                                cantidadPendiente > 0 ? String(cantidadPendiente) : '',
                            fechaEntregaEstimada: p.fechaEntregaEstimada ?? '',
                        };
                    });
                    setParcialPendientes(pendientes);
                    setProveedores([]);
                } else {
                    setParcialPendientes([]);
                    const provs = pedidoNorm.proveedores.map((p) => mapProveedorParaEdicion(req, { ...p }));
                    setProveedores(provs);
                    setProveedorExpandidoId(provs[0]?.id ?? null);
                }
            } else {
                setParcialPendientes([]);
                const provs = pedidoNorm.proveedores.map((p) => mapProveedorParaEdicion(req, { ...p }));
                setProveedores(provs);
                setProveedorExpandidoId(provs[0]?.id ?? null);
            }
        } else {
            setParcialPendientes([]);
            setFechaPedido(formatFechaHoy());
            const nuevo = emptyProveedor('', costoCatalogo);
            setProveedores([nuevo]);
            setProveedorExpandidoId(nuevo.id);
        }
    };

    const cerrarModal = () => {
        setModalPedidoId(null);
        setParcialPendientes([]);
        setProveedorExpandidoId(null);
        setBusquedaPickerPorProveedor({});
        setPaginaPickerPorProveedor({});
        setErrorValidacion(null);
    };

    const getBusquedaPicker = (provId: string) => busquedaPickerPorProveedor[provId] ?? '';
    const setBusquedaPicker = (provId: string, texto: string) => {
        setBusquedaPickerPorProveedor((prev) => ({ ...prev, [provId]: texto }));
    };
    const getPaginaPicker = (provId: string) => paginaPickerPorProveedor[provId] ?? 1;
    const setPaginaPicker = (provId: string, pagina: number) => {
        setPaginaPickerPorProveedor((prev) => ({ ...prev, [provId]: pagina }));
    };

    const agregarProveedor = () => {
        const costoCatalogo = reqModal
            ? resolverCostoEstandarProducto(reqModal.producto, productos)
            : undefined;
        const nuevo = emptyProveedor(proveedores[0]?.fechaEntregaEstimada ?? '', costoCatalogo);
        setProveedores((p) => [...p, nuevo]);
        setProveedorExpandidoId(nuevo.id);
        setErrorValidacion(null);
    };

    const quitarProveedor = (id: string) => {
        const next = proveedores.filter((x) => x.id !== id);
        const lista = next.length > 0 ? next : [emptyProveedor()];
        setProveedores(lista);
        if (proveedorExpandidoId === id || next.length === 0) {
            setProveedorExpandidoId(lista[0].id);
        }
        setErrorValidacion(null);
    };

    const toggleProveedorExpandido = (id: string) => {
        setProveedorExpandidoId((prev) => (prev === id ? null : id));
    };

    const aplicarCatalogoAProveedor = (id: string, cat: ProveedorCatalogo) => {
        setProveedores((prev) =>
            prev.map((p) =>
                p.id === id
                    ? { ...p, ...datosProveedorDesdeCatalogo(cat), agregarAOrdenCompraId: undefined, agregarAOrdenCompraNumero: undefined }
                    : p
            )
        );
        setBusquedaPicker(id, '');
        setPaginaPicker(id, 1);
        setErrorValidacion(null);
    };

    const abrirPickerOcProveedor = async (prov: ProveedorAsignado) => {
        if (!prov.nombre.trim()) {
            mostrarError('Indique primero el nombre del proveedor.');
            return;
        }
        setModalOcProveedorId(prov.id);
        setOrdenesCompraPicker([]);
        setCargandoOcPicker(true);
        try {
            const list = await listarOrdenesCompraPorProveedor({
                catalogoId: prov.catalogoId,
                nombre: prov.nombre.trim(),
                nit: prov.nit,
            });
            setOrdenesCompraPicker(list);
        } catch (error) {
            console.error(error);
            almacenAlert('Órdenes de compra', 'No se pudieron cargar las OC de este proveedor.');
            setModalOcProveedorId(null);
        } finally {
            setCargandoOcPicker(false);
        }
    };

    const seleccionarOcParaProveedor = (proveedorId: string, oc: OrdenCompra) => {
        setProveedores((prev) =>
            prev.map((p) =>
                p.id === proveedorId
                    ? {
                          ...p,
                          agregarAOrdenCompraId: oc.id,
                          agregarAOrdenCompraNumero: oc.numeroOrdenCompra,
                      }
                    : p
            )
        );
        setModalOcProveedorId(null);
        setErrorValidacion(null);
    };

    const quitarAdjuntoOcProveedor = (proveedorId: string) => {
        setProveedores((prev) =>
            prev.map((p) =>
                p.id === proveedorId
                    ? { ...p, agregarAOrdenCompraId: undefined, agregarAOrdenCompraNumero: undefined }
                    : p
            )
        );
    };

    const actualizarProveedor = (
        id: string,
        campo: 'nombre' | 'cantidad' | 'fechaEntregaEstimada' | 'nit' | 'telefono' | 'precioUnitario',
        valor: string
    ) => {
        setProveedores((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p;
                if (campo === 'nombre') {
                    const cat = findProveedorCatalogoPorNombre(catalogoProveedores, valor);
                    if (cat) {
                        return { ...p, ...datosProveedorDesdeCatalogo(cat), agregarAOrdenCompraId: undefined, agregarAOrdenCompraNumero: undefined };
                    }
                    return { ...p, nombre: valor, catalogoId: undefined, agregarAOrdenCompraId: undefined, agregarAOrdenCompraNumero: undefined };
                }
                if (campo === 'nit') return { ...p, nit: valor, catalogoId: undefined, agregarAOrdenCompraId: undefined, agregarAOrdenCompraNumero: undefined };
                if (campo === 'telefono') return { ...p, telefono: valor, catalogoId: undefined };
                if (campo === 'fechaEntregaEstimada') return { ...p, fechaEntregaEstimada: valor };
                if (campo === 'precioUnitario') {
                    const { display, numero } = formatearPrecioCopMientrasEscribe(valor);
                    return { ...p, precioUnitarioTexto: display, precioUnitario: numero };
                }
                const n = parseFloat(valor.replace(',', '.'));
                return { ...p, cantidad: isNaN(n) ? 0 : n };
            })
        );
    };

    const finalizarPrecioProveedor = (id: string) => {
        setProveedores((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p;
                const precio = p.precioUnitario ?? parsePrecioCopInput(p.precioUnitarioTexto ?? '');
                if (precio != null && precio > 0) {
                    return {
                        ...p,
                        precioUnitario: precio,
                        precioUnitarioTexto: formatPrecioCopInput(precio),
                    };
                }
                return { ...p, precioUnitario: undefined, precioUnitarioTexto: '' };
            })
        );
    };

    const actualizarClasificacionProveedor = (
        id: string,
        datos: Partial<Pick<ProveedorAsignado, 'categoria' | 'responsableIva'>>
    ) => {
        setProveedores((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...datos } : p))
        );
        setErrorValidacion(null);
    };

    const limpiarFormularioCatalogo = () => {
        setCatNombre('');
        setCatNit('');
        setCatCorreo('');
        setCatTelefonoTrabajo('');
        setCatTelefonoMovil('');
        setCatDireccion('');
        setCatCategoria(undefined);
        setCatalogoEditandoId(null);
        setErrorCatalogo(null);
    };

    const proveedoresCatalogoFiltrados = useMemo(() => {
        const filtrados = filtrarProveedorCatalogo(catalogoProveedores, busquedaCatalogo);
        return [...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [catalogoProveedores, busquedaCatalogo]);

    const totalCatalogoFiltrado = proveedoresCatalogoFiltrados.length;
    const totalPaginasCatalogo = Math.max(1, Math.ceil(totalCatalogoFiltrado / CATALOGO_POR_PAGINA));
    const paginaCatalogoActual = Math.min(paginaCatalogo, totalPaginasCatalogo);
    const indiceCatalogoInicio = (paginaCatalogoActual - 1) * CATALOGO_POR_PAGINA;
    const indiceCatalogoFin = Math.min(indiceCatalogoInicio + CATALOGO_POR_PAGINA, totalCatalogoFiltrado);
    const proveedoresCatalogoPagina = useMemo(
        () => proveedoresCatalogoFiltrados.slice(indiceCatalogoInicio, indiceCatalogoFin),
        [proveedoresCatalogoFiltrados, indiceCatalogoInicio, indiceCatalogoFin]
    );

    useEffect(() => {
        if (paginaCatalogo > totalPaginasCatalogo) {
            setPaginaCatalogo(totalPaginasCatalogo);
        }
    }, [paginaCatalogo, totalPaginasCatalogo]);

    const abrirModalCatalogo = () => {
        limpiarFormularioCatalogo();
        setModalListaProveedores(false);
        setModalCatalogo(true);
    };

    const cerrarModalCatalogo = () => {
        setModalCatalogo(false);
        limpiarFormularioCatalogo();
        setBusquedaCatalogo('');
        setPaginaCatalogo(1);
    };

    const abrirListaProveedores = async () => {
        await onRecargarCatalogoProveedores();
        setBusquedaCatalogo('');
        setPaginaCatalogo(1);
        setModalCatalogo(false);
        setModalListaProveedores(true);
    };

    const cerrarListaProveedores = () => {
        setModalListaProveedores(false);
        setBusquedaCatalogo('');
        setPaginaCatalogo(1);
    };

    const nuevoProveedorDesdeLista = () => {
        setModalListaProveedores(false);
        abrirModalCatalogo();
    };

    const editarProveedorDesdeLista = (c: ProveedorCatalogo) => {
        setModalListaProveedores(false);
        iniciarEdicionCatalogo(c);
        setModalCatalogo(true);
    };

    const abrirListaProductos = async () => {
        try {
            await onRecargarCatalogoProductos();
        } catch {
            almacenAlert('Catálogo de productos', 'No se pudo actualizar el listado. Se muestran los datos en caché.');
        }
        setBusquedaProductos('');
        setFiltroCategoriaProductos('todas');
        setFiltroUnidadProductos('todas');
        setPaginaProductos(1);
        setModalListaProductos(true);
    };

    const cerrarListaProductos = () => {
        setModalListaProductos(false);
        setBusquedaProductos('');
        setFiltroCategoriaProductos('todas');
        setFiltroUnidadProductos('todas');
        setPaginaProductos(1);
    };

    const limpiarFormularioProducto = () => {
        setProductoEditandoId(null);
        setProdNombre('');
        setProdDescripcion('');
        setProdCosto('');
        setProdTipo('consumo_diario');
        setProdUnidad('');
        setErrorProductoForm(null);
    };

    const cerrarFormProducto = () => {
        setModalFormProducto(false);
        limpiarFormularioProducto();
    };

    const abrirNuevoProducto = () => {
        limpiarFormularioProducto();
        setModalListaProductos(false);
        setModalFormProducto(true);
    };

    const iniciarEdicionProducto = (p: ProductoInsumo) => {
        setProductoEditandoId(p.id);
        setProdNombre(p.nombre);
        setProdDescripcion(descripcionProductoVisible(p));
        setProdCosto(p.costoEstandar != null && p.costoEstandar > 0 ? String(p.costoEstandar) : '');
        setProdTipo(p.tipoRequisicion);
        setProdUnidad(p.unidadSugerida?.trim() ?? '');
        setErrorProductoForm(null);
        setModalListaProductos(false);
        setModalFormProducto(true);
    };

    const volverAListaProductos = () => {
        cerrarFormProducto();
        setModalListaProductos(true);
    };

    const guardarProductoCatalogo = async () => {
        const nombre = prodNombre.trim();
        if (!nombre) {
            setErrorProductoForm('El nombre del producto es obligatorio.');
            return;
        }
        const costoRaw = prodCosto.trim().replace(/\./g, '').replace(',', '.');
        const costoNum = costoRaw ? Number(costoRaw) : undefined;
        if (costoRaw && (Number.isNaN(costoNum) || (costoNum ?? 0) < 0)) {
            setErrorProductoForm('El costo estimado no es válido.');
            return;
        }

        setGuardandoProducto(true);
        setErrorProductoForm(null);
        try {
            await onGuardarProductoCatalogo({
                id: productoEditandoId ?? undefined,
                nombre,
                descripcion: prodDescripcion.trim() || undefined,
                costoEstandar: costoNum,
                tipoRequisicion: prodTipo,
                unidadSugerida: prodUnidad.trim() || undefined,
            });
            cerrarFormProducto();
            setModalListaProductos(true);
        } catch (error) {
            setErrorProductoForm(extraerMensajeErrorApi(error, 'No se pudo guardar el producto.'));
        } finally {
            setGuardandoProducto(false);
        }
    };

    const confirmarEliminarProducto = async () => {
        if (!confirmEliminarProducto) return;
        setEliminandoProducto(true);
        try {
            await onEliminarProductoCatalogo(confirmEliminarProducto.id);
            setConfirmEliminarProducto(null);
        } catch (error) {
            almacenAlert('Eliminar producto', extraerMensajeErrorApi(error, 'No se pudo eliminar el producto.'));
        } finally {
            setEliminandoProducto(false);
        }
    };

    const confirmarEliminarProveedor = async () => {
        if (!confirmEliminarProveedor) return;
        setEliminandoProveedor(true);
        try {
            await onEliminarProveedorCatalogo(confirmEliminarProveedor.id);
            setConfirmEliminarProveedor(null);
        } catch (error) {
            almacenAlert('Eliminar proveedor', extraerMensajeErrorApi(error, 'No se pudo eliminar el proveedor.'));
        } finally {
            setEliminandoProveedor(false);
        }
    };

    const unidadesFiltroProductos = useMemo(() => {
        const set = new Set<string>(unidadesMedida);
        productos.forEach((p) => {
            const u = p.unidadSugerida?.trim();
            if (u) set.add(u);
        });
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [productos, unidadesMedida]);

    const productosFiltrados = useMemo(() => {
        const q = busquedaProductos.trim().toLowerCase();
        let lista = [...productos];
        if (filtroCategoriaProductos !== 'todas') {
            lista = lista.filter((p) => p.tipoRequisicion === filtroCategoriaProductos);
        }
        if (filtroUnidadProductos !== 'todas') {
            lista = lista.filter(
                (p) => (p.unidadSugerida?.trim().toLowerCase() ?? '') === filtroUnidadProductos.toLowerCase()
            );
        }
        if (q) {
            lista = lista.filter(
                (p) =>
                    p.nombre.toLowerCase().includes(q) ||
                    (p.descripcion?.toLowerCase().includes(q) ?? false) ||
                    getTipoRequisicionLabel(p.tipoRequisicion).toLowerCase().includes(q) ||
                    (p.unidadSugerida?.toLowerCase().includes(q) ?? false)
            );
        }
        return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [productos, busquedaProductos, filtroCategoriaProductos, filtroUnidadProductos]);

    const totalProductosFiltrado = productosFiltrados.length;
    const totalPaginasProductos = Math.max(1, Math.ceil(totalProductosFiltrado / PRODUCTOS_POR_PAGINA));
    const paginaProductosActual = Math.min(paginaProductos, totalPaginasProductos);
    const indiceProductosInicio = (paginaProductosActual - 1) * PRODUCTOS_POR_PAGINA;
    const indiceProductosFin = Math.min(indiceProductosInicio + PRODUCTOS_POR_PAGINA, totalProductosFiltrado);
    const productosPagina = useMemo(
        () => productosFiltrados.slice(indiceProductosInicio, indiceProductosFin),
        [productosFiltrados, indiceProductosInicio, indiceProductosFin]
    );

    useEffect(() => {
        if (paginaProductos > totalPaginasProductos) {
            setPaginaProductos(totalPaginasProductos);
        }
    }, [paginaProductos, totalPaginasProductos]);

    const iniciarEdicionCatalogo = (c: ProveedorCatalogo) => {
        setCatalogoEditandoId(c.id);
        setCatNombre(c.nombre);
        setCatNit(c.nit ?? '');
        setCatCorreo(c.correo ?? '');
        setCatTelefonoTrabajo(c.telefonoTrabajo ?? '');
        setCatTelefonoMovil(c.telefonoMovil ?? '');
        setCatDireccion(c.direccion ?? '');
        setCatCategoria(c.categoria);
        setErrorCatalogo(null);
    };

    const resumenProveedorCatalogo = (c: ProveedorCatalogo) => resumenProveedorContacto(c);

    const handleImportarProveedoresExcel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                ],
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;

            const asset = result.assets[0];
            setImportandoExcel(true);

            let archivo: File | Blob | { uri: string; name: string; type?: string };
            if (Platform.OS === 'web') {
                const webFile = (asset as { file?: File }).file;
                if (!webFile) {
                    almacenAlert('Importar Excel', 'No se pudo leer el archivo seleccionado.');
                    return;
                }
                archivo = webFile;
            } else {
                archivo = {
                    uri: asset.uri,
                    name: asset.name || 'proveedores.xlsx',
                    type:
                        asset.mimeType ||
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                };
            }

            const data = await importarProveedoresExcel(archivo, asset.name || 'proveedores.xlsx');
            await onRecargarCatalogoProveedores();
            setPaginaCatalogo(1);

            const totalFilasConDatos =
                data.importados + data.actualizados + data.omitidosDuplicados;
            const partes = [
                `${data.importados} proveedor(es) importado(s).`,
                data.actualizados > 0 ? `${data.actualizados} actualizado(s) con datos del Excel.` : null,
                data.omitidosDuplicados > 0
                    ? `${data.omitidosDuplicados} omitido(s) sin cambios.`
                    : null,
                data.filasVacias > 0 ? `${data.filasVacias} fila(s) vacía(s) ignorada(s).` : null,
                data.filasConNit > 0 ||
                data.filasConTelefono > 0 ||
                data.filasConCorreo > 0
                    ? `Contacto leído del Excel: ${data.filasConNit} con NIT, ${data.filasConTelefono} con teléfono, ${data.filasConCorreo} con correo.`
                    : totalFilasConDatos > 0
                      ? 'Advertencia: el Excel no aportó NIT, teléfono ni correo. Revise que las columnas tengan encabezados como Compañía, NIT, Teléfono, Correo.'
                      : null,
                data.columnasDetectadas ? `Columnas: ${data.columnasDetectadas}` : null,
            ].filter(Boolean);

            almacenAlert('Importación completada', partes.join('\n'));
        } catch (error) {
            almacenAlert(
                'Error al importar Excel',
                extraerMensajeErrorApi(error, 'No se pudo importar el archivo de proveedores.')
            );
        } finally {
            setImportandoExcel(false);
        }
    };

    const guardarProveedorCatalogo = async () => {
        const nombre = catNombre.trim();
        const nit = catNit.trim();
        const correo = catCorreo.trim();
        const telefonoTrabajo = catTelefonoTrabajo.trim();
        const telefonoMovil = catTelefonoMovil.trim();
        const direccion = catDireccion.trim();
        if (!nombre) {
            setErrorCatalogo('Indique el nombre del proveedor.');
            almacenAlert('Catálogo de proveedores', 'Indique el nombre del proveedor.');
            return;
        }

        const duplicado = catalogoProveedores.some(
            (c) =>
                c.nombre.trim().toLowerCase() === nombre.toLowerCase() &&
                c.id !== catalogoEditandoId
        );
        if (duplicado) {
            setErrorCatalogo('Ya existe un proveedor con ese nombre.');
            almacenAlert('Catálogo de proveedores', 'Ya existe un proveedor con ese nombre.');
            return;
        }

        setGuardando(true);
        try {
            await onGuardarProveedorCatalogo({
                id: catalogoEditandoId ?? undefined,
                nombre,
                nit: nit || undefined,
                correo: correo || undefined,
                telefonoTrabajo: telefonoTrabajo || undefined,
                telefonoMovil: telefonoMovil || undefined,
                direccion: direccion || undefined,
                categoria: catCategoria,
                responsableIva: responsableIvaDesdeCategoria(catCategoria),
            });
            almacenAlert(
                catalogoEditandoId ? 'Proveedor actualizado' : 'Proveedor guardado',
                catalogoEditandoId
                    ? `${nombre} fue actualizado en el catálogo y en los pedidos vinculados.`
                    : `${nombre} quedó en el catálogo con los datos de contacto registrados.`
            );
            limpiarFormularioCatalogo();
        } catch (error) {
            almacenAlert(
                'Error al guardar proveedor',
                extraerMensajeErrorApi(error, 'No se pudo guardar el proveedor.')
            );
        } finally {
            setGuardando(false);
        }
    };

    const mostrarError = (mensaje: string) => {
        setErrorValidacion(mensaje);
        almacenAlert('Complete los campos', mensaje);
    };

    const guardarPedidoParcial = async () => {
        if (!reqModal?.pedido) return;
        setErrorValidacion(null);

        if (parcialPendientes.length === 0) {
            mostrarError('No hay saldo pendiente por confirmar.');
            return;
        }

        const pedidoOrig = normalizarPedido(reqModal.pedido);

        for (const p of parcialPendientes) {
            if (p.cantidadPendiente <= 0) {
                mostrarError(`Indique la cantidad pendiente para ${p.nombre}.`);
                return;
            }
            const provPedido = pedidoOrig.proveedores.find((x) => x.id === p.id);
            if (!provPedido) continue;
            const saldoActual = getSaldoPendienteProveedor(reqModal.recepcion, provPedido);
            if (p.cantidadPendiente > saldoActual + 0.001) {
                mostrarError(
                    `La cantidad pendiente de ${p.nombre} no puede superar el saldo actual (${saldoActual} ${reqModal.unidad}).`
                );
                return;
            }
            const cantidadTotal = p.recibido + p.cantidadPendiente;
            if (provPedido.cantidad > 0 && cantidadTotal > provPedido.cantidad + 0.001) {
                mostrarError(
                    `La cantidad pendiente de ${p.nombre} no puede aumentar el total pedido (${provPedido.cantidad} ${reqModal.unidad}).`
                );
                return;
            }
        }

        const conSaldo = parcialPendientes.filter((p) => p.cantidadPendiente > 0);
        const sinFecha = conSaldo.filter((p) => !p.fechaEntregaEstimada.trim());
        if (sinFecha.length > 0) {
            mostrarError(
                `Indique la próxima fecha de llegada para: ${sinFecha.map((p) => p.nombre).join(', ')}.`
            );
            return;
        }

        const edits = new Map(parcialPendientes.map((p) => [p.id, p]));
        const proveedoresMerge = pedidoOrig.proveedores.map((p) => {
            const edit = edits.get(p.id);
            if (!edit) return p;
            const inferido = getCantidadPedidaOriginalProveedor(reqModal.recepcion, p);
            const cantidadTotal = inferido > 0 ? inferido : edit.recibido + edit.cantidadPendiente;
            const recibidoCompleto = edit.cantidadPendiente <= 0.0001;
            return {
                ...p,
                cantidad: cantidadTotal,
                fechaEntregaEstimada: edit.fechaEntregaEstimada.trim() || p.fechaEntregaEstimada,
                recibido: recibidoCompleto ? true : (p.recibido ?? false),
            };
        });

        const fechasOrdenadas = proveedoresMerge
            .map((p) => p.fechaEntregaEstimada)
            .filter(Boolean)
            .sort();
        const fechaResumen = fechasOrdenadas[fechasOrdenadas.length - 1] ?? pedidoOrig.fechaEntregaEstimada;

        const datosPedido: DatosPedido = normalizarPedido({
            fechaPedido: pedidoOrig.fechaPedido,
            fechaEntregaEstimada: fechaResumen,
            proveedores: proveedoresMerge.map((p) => ({ ...p, recibido: p.recibido ?? false })),
        });

        setGuardando(true);
        try {
            await onGuardarPedido(reqModal.id, datosPedido);
            await onRecargarCatalogoProveedores();
            cerrarModal();
        } catch (error) {
            mostrarError(extraerMensajeErrorApi(error, 'No se pudo confirmar el resto pendiente.'));
        } finally {
            setGuardando(false);
        }
    };

    const guardarPedido = async () => {
        if (!reqModal) return;
        setErrorValidacion(null);

        if (!fechaPedido.trim()) {
            mostrarError('Indique la fecha de pedido.');
            return;
        }
        const provValidos = proveedores.filter((p) => p.nombre.trim() && p.cantidad > 0);
        if (provValidos.length === 0) {
            mostrarError('Agregue al menos un proveedor con nombre y cantidad mayor a cero.');
            setProveedorExpandidoId(proveedores[0]?.id ?? null);
            return;
        }
        const sinFecha = provValidos.filter((p) => !p.fechaEntregaEstimada?.trim());
        if (sinFecha.length > 0) {
            const nombres = sinFecha.map((p) => p.nombre.trim() || 'Sin nombre').join(', ');
            mostrarError(`Indique la fecha de llegada estimada para: ${nombres}.`);
            setProveedorExpandidoId(sinFecha[0]?.id ?? null);
            return;
        }
        const sinNombre = proveedores.filter((p) => p.cantidad > 0 && !p.nombre.trim());
        if (sinNombre.length > 0) {
            mostrarError('Todos los proveedores con cantidad deben tener nombre.');
            setProveedorExpandidoId(sinNombre[0]?.id ?? null);
            return;
        }

        const proveedoresNorm = normalizarProveedoresPedido(provValidos);
        const fechasOrdenadas = proveedoresNorm
            .map((p) => p.fechaEntregaEstimada!)
            .filter(Boolean)
            .sort();
        const fechaResumen = fechasOrdenadas[fechasOrdenadas.length - 1] ?? '';

        const datosPedido: DatosPedido = normalizarPedido({
            fechaPedido,
            fechaEntregaEstimada: fechaResumen,
            proveedores: proveedoresNorm.map((p) => ({ ...p, recibido: p.recibido ?? false })),
        });

        setGuardando(true);
        try {
            await onGuardarPedido(reqModal.id, datosPedido);
            await onRecargarCatalogoProveedores();
            cerrarModal();
        } catch (error) {
            mostrarError(extraerMensajeErrorApi(error, 'No se pudo guardar el pedido.'));
        } finally {
            setGuardando(false);
        }
    };

    const pedidoSoloLectura = reqModal?.estado === 'En Almacen';
    const esModalParcial =
        reqModal?.estado === 'Parcial' &&
        !pedidoSoloLectura &&
        tieneProveedoresConRecepcionParcial(reqModal);

    const fmtFecha = (iso?: string) => (iso ? iso : '—');

    const solicitarOrdenCompra = async (req: Requisicion, prov: ProveedorAsignado) => {
        const incluirIva = proveedorIncluyeIvaEnOrden(prov, catalogoProveedores);
        setGenerandoOcProveedorId(prov.id);
        try {
            if (prov.ordenCompraId) {
                const oc = await getOrdenCompra(prov.ordenCompraId);
                await generarOrdenCompraConsolidadaPdf({
                    ordenCompra: oc,
                    catalogoProveedores,
                    incluirIva,
                });
                return;
            }
            await generarOrdenCompraPdf({
                requisicion: req,
                proveedor: prov,
                catalogoProveedores,
                incluirIva,
            });
        } catch (error) {
            console.error(error);
            almacenAlert('Orden de compra', 'No se pudo generar el archivo PDF.');
        } finally {
            setGenerandoOcProveedorId(null);
        }
    };

    const toggleSeleccionConsolidar = (reqId: string) => {
        setSeleccionConsolidar((prev) => ({ ...prev, [reqId]: !prev[reqId] }));
    };

    const abrirModalConsolidar = () => {
        if (reqsSeleccionadasConsolidar.length < 2) {
            almacenAlert('Pedido consolidado', 'Seleccione al menos dos requisiciones pendientes.');
            return;
        }
        const hoy = formatFechaHoy();
        setFechaPedidoConsolidar(hoy);
        setFechaEntregaConsolidar(hoy);
        setProveedorConsolidar(emptyProveedor(hoy));
        setLineasConsolidar(
            reqsSeleccionadasConsolidar.map((r) => {
                const costo = resolverCostoEstandarProducto(r.producto, productos);
                return {
                    requisicionId: r.id,
                    codigo: r.codigo,
                    producto: r.producto,
                    cantidad: r.cantidad,
                    unidad: r.unidad,
                    precioUnitario: costo,
                    precioUnitarioTexto: formatPrecioCopInput(costo),
                    fechaEntregaEstimada: hoy,
                };
            })
        );
        setErrorConsolidar(null);
        setBusquedaConsolidarProv('');
        setPaginaConsolidarProv(1);
        setPickerConsolidarProvAbierto(false);
        setModalConsolidar(true);
    };

    const cerrarModalConsolidar = () => {
        if (guardandoConsolidar) return;
        setModalConsolidar(false);
        setErrorConsolidar(null);
    };

    const guardarPedidoConsolidado = async () => {
        setErrorConsolidar(null);
        if (!fechaPedidoConsolidar.trim()) {
            setErrorConsolidar('Indique la fecha del pedido.');
            return;
        }
        if (!proveedorConsolidar.nombre.trim()) {
            setErrorConsolidar('Seleccione o escriba el proveedor.');
            return;
        }
        if (!fechaEntregaConsolidar.trim()) {
            setErrorConsolidar('Indique la fecha estimada de entrega.');
            return;
        }
        for (const l of lineasConsolidar) {
            if (!l.precioUnitario || l.precioUnitario <= 0) {
                setErrorConsolidar(`Indique el precio unitario para ${l.codigo}.`);
                return;
            }
        }

        const payload: ConsolidarPedidoPayload = {
            fechaPedido: fechaPedidoConsolidar,
            fechaEntregaEstimada: fechaEntregaConsolidar,
            proveedor: {
                nombre: proveedorConsolidar.nombre.trim(),
                nit: proveedorConsolidar.nit,
                telefono: proveedorConsolidar.telefono,
                catalogoId: proveedorConsolidar.catalogoId,
                categoria: proveedorConsolidar.categoria,
                responsableIva: proveedorConsolidar.responsableIva,
            },
            lineas: lineasConsolidar.map((l) => ({
                requisicionId: l.requisicionId,
                cantidad: l.cantidad,
                precioUnitario: l.precioUnitario,
                fechaEntregaEstimada: l.fechaEntregaEstimada || fechaEntregaConsolidar,
            })),
        };

        setGuardandoConsolidar(true);
        try {
            const oc = await onConsolidarPedido(payload);
            setSeleccionConsolidar({});
            cerrarModalConsolidar();
            const incluirIva = proveedorIncluyeIvaEnOrden(proveedorConsolidar, catalogoProveedores);
            await generarOrdenCompraConsolidadaPdf({
                ordenCompra: oc,
                catalogoProveedores,
                incluirIva,
            });
            await onRecargarCatalogoProveedores();
        } catch (error) {
            setErrorConsolidar(extraerMensajeErrorApi(error, 'No se pudo registrar el pedido consolidado.'));
        } finally {
            setGuardandoConsolidar(false);
        }
    };


    const handleMarcarPagado = async (
        reqId: string,
        prov: ProveedorAsignado,
        formaPago?: 'credito' | 'efectivo'
    ) => {
        const key = `${reqId}-${prov.id}`;
        const nuevoPagado = formaPago != null ? true : !prov.pagado;
        setMarcandoPagadoKey(key);
        try {
            await onMarcarProveedorPagado(reqId, prov.id, nuevoPagado, formaPago);
            if (formaPago != null) setModalFormaPago(null);
        } catch (error) {
            almacenAlert(
                'Error',
                extraerMensajeErrorApi(
                    error,
                    nuevoPagado ? 'No se pudo registrar el pago.' : 'No se pudo quitar el pago.'
                )
            );
        } finally {
            setMarcandoPagadoKey(null);
        }
    };

    const solicitarMarcarPagado = (reqId: string, prov: ProveedorAsignado) => {
        if (prov.pagado) {
            void handleMarcarPagado(reqId, prov);
            return;
        }
        setModalFormaPago({ reqId, prov });
    };

    const confirmarFormaPago = (formaPago: 'credito' | 'efectivo') => {
        if (!modalFormaPago) return;
        void handleMarcarPagado(modalFormaPago.reqId, modalFormaPago.prov, formaPago);
    };

    const renderControlPago = (reqId: string, prov: ProveedorAsignado, compact = false) => {
        const key = `${reqId}-${prov.id}`;
        const cargando = marcandoPagadoKey === key;
        if (prov.pagado) {
            const medio = labelFormaPagoAlmacen(prov.formaPago);
            return (
                <TouchableOpacity
                    style={[
                        pedidoStyles.badgePagado,
                        compact && pedidoStyles.badgePagadoCompacto,
                        cargando && { opacity: 0.6 },
                    ]}
                    onPress={() => solicitarMarcarPagado(reqId, prov)}
                    disabled={cargando}
                    accessibilityLabel="Quitar pago"
                >
                    <Text style={pedidoStyles.badgePagadoText}>
                        {cargando
                            ? '…'
                            : compact
                              ? medio
                                  ? `✓ Pagado · ${medio}`
                                  : '✓ Pagado'
                              : medio
                                ? `✓ Pagado · ${medio} · quitar`
                                : '✓ Pagado · quitar'}
                    </Text>
                </TouchableOpacity>
            );
        }
        return (
            <TouchableOpacity
                style={[
                    pedidoStyles.btnMarcarPago,
                    compact && pedidoStyles.btnMarcarPagoCompacto,
                    cargando && { opacity: 0.6 },
                ]}
                onPress={() => solicitarMarcarPagado(reqId, prov)}
                disabled={cargando}
            >
                <Text style={pedidoStyles.btnMarcarPagoText}>{cargando ? '…' : 'Marcar pago'}</Text>
            </TouchableOpacity>
        );
    };

    const tablaPedidos = (
        <>
            <View style={[pedidoStyles.tableHead, { borderBottomColor: colors.border }]}>
                {[
                    modoSeleccionConsolidar ? 'SEL' : '',
                    '',
                    'COD. REQ',
                    'INSUMO / CANT.',
                    'FECHA PEDIDO',
                    'LLEGADA ESTIMADA',
                    'PROVEEDORES',
                    'PRECIO / TOTAL',
                    'INGRESADO POR',
                    'ESTADO',
                    'ACCIONES',
                ].map(
                    (col) => (
                        <Text
                            key={col || 'expand'}
                            style={[
                                pedidoStyles.th,
                                { color: colors.subText },
                                col === 'SEL' && { width: 44 },
                                col === '' && { width: 36 },
                                col === 'COD. REQ' && { width: 90 },
                                col === 'INSUMO / CANT.' && { flex: 1.4, minWidth: 160 },
                                col === 'FECHA PEDIDO' && { width: 110 },
                                col === 'LLEGADA ESTIMADA' && { width: 130 },
                                col === 'PROVEEDORES' && { flex: 1.4, minWidth: 200 },
                                col === 'PRECIO / TOTAL' && { width: 160 },
                                col === 'INGRESADO POR' && { width: 120 },
                                col === 'ESTADO' && { width: 150 },
                                col === 'ACCIONES' && { width: 130 },
                            ]}
                        >
                            {col}
                        </Text>
                    )
                )}
            </View>

            {listaPagina.map((req) => {
                const expandida = !!expandidas[req.id];
                const provs = req.pedido?.proveedores ?? [];
                const totalMonetario = req.pedido ? getTotalPedidoMonetario(req.pedido) : 0;
                const resumenCant =
                    req.pedido && req.estado === 'Parcial'
                        ? getResumenCantidadesPedido(normalizarPedido(req.pedido), req.recepcion)
                        : null;
                return (
                    <View key={req.id}>
                        <View style={[pedidoStyles.tableRow, { borderBottomColor: colors.border }]}>
                            {modoSeleccionConsolidar && req.estado === 'Pendiente' ? (
                                <TouchableOpacity
                                    style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}
                                    onPress={() => toggleSeleccionConsolidar(req.id)}
                                >
                                    <Text style={{ fontSize: 18, color: colors.primary }}>
                                        {seleccionConsolidar[req.id] ? '☑' : '☐'}
                                    </Text>
                                </TouchableOpacity>
                            ) : modoSeleccionConsolidar ? (
                                <View style={{ width: 44 }} />
                            ) : null}
                            <TouchableOpacity style={pedidoStyles.expandBtn} onPress={() => toggleDetalle(req.id)}>
                                <Text style={{ color: colors.primary, fontSize: 16 }}>{expandida ? '▼' : '▶'}</Text>
                            </TouchableOpacity>
                            <Text style={[pedidoStyles.td, { width: 90, color: colors.text }]}>{req.codigo}</Text>
                            <View style={{ flex: 1.4, minWidth: 160, paddingRight: 8 }}>
                                <Text style={[pedidoStyles.td, { color: colors.text, fontWeight: '600' }]}>
                                    {req.producto}
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 13 }}>
                                    (
                                    <Text style={{ fontWeight: '700', color: colors.text }}>
                                        {req.cantidad} {req.unidad}
                                    </Text>
                                    )
                                </Text>
                                {resumenCant ? (
                                    <>
                                        <Text style={{ color: '#34D399', fontSize: 12 }}>
                                            Recibido: {resumenCant.recibido} {req.unidad}
                                        </Text>
                                        <Text style={{ color: '#FBBF24', fontSize: 12 }}>
                                            Pendiente: {resumenCant.pendiente} {req.unidad}
                                        </Text>
                                    </>
                                ) : null}
                            </View>
                            <Text style={[pedidoStyles.td, { width: 110, color: colors.text }]}>
                                {fmtFecha(req.pedido?.fechaPedido)}
                            </Text>
                            <Text style={[pedidoStyles.td, { width: 130, color: colors.text }]}>
                                {req.pedido ? getFechaEntregaResumenPedido(req.pedido) : '—'}
                            </Text>
                            <View style={{ flex: 1.4, minWidth: 200, paddingRight: 8 }}>
                                {provs.length === 0 ? (
                                    <Text style={{ color: colors.subText }}>—</Text>
                                ) : (
                                    <View style={pedidoStyles.proveedorPagoLista}>
                                        {provs.map((p) => (
                                            <View key={p.id} style={pedidoStyles.proveedorPagoItem}>
                                                <Text
                                                    style={{ color: colors.text, fontSize: 12, flex: 1 }}
                                                    numberOfLines={2}
                                                >
                                                    {p.nombre}
                                                    {req.estado === 'Parcial' && !p.recibido
                                                        ? (() => {
                                                              const saldo = getSaldoPendienteProveedor(
                                                                  req.recepcion,
                                                                  p
                                                              );
                                                              return saldo > 0
                                                                  ? ` · faltan ${saldo} ${req.unidad}`
                                                                  : '';
                                                          })()
                                                        : ''}
                                                </Text>
                                                {renderControlPago(req.id, p, true)}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={{ width: 160, paddingRight: 8 }}>
                                {provs.length > 0 && totalMonetario > 0 ? (
                                    <View>
                                        {provs.map((p) => {
                                            const subtotal = getSubtotalProveedor(p);
                                            return (
                                                <View key={p.id} style={{ marginBottom: 6 }}>
                                                    <Text
                                                        style={{ color: colors.subText, fontSize: 11 }}
                                                        numberOfLines={1}
                                                    >
                                                        {p.nombre}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            color: colors.text,
                                                            fontSize: 12,
                                                            fontWeight: '600',
                                                        }}
                                                    >
                                                        {subtotal > 0 ? formatearMonedaCop(subtotal) : '—'}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                        <View
                                            style={{
                                                marginTop: 4,
                                                paddingTop: 6,
                                                borderTopWidth: 1,
                                                borderTopColor: colors.border,
                                            }}
                                        >
                                            <Text style={{ color: colors.subText, fontSize: 11 }}>
                                                Total
                                            </Text>
                                            <Text
                                                style={{
                                                    color: colors.text,
                                                    fontSize: 13,
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {formatearMonedaCop(totalMonetario)}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={{ color: colors.subText }}>—</Text>
                                )}
                            </View>
                            <Text
                                style={[pedidoStyles.td, { width: 120, color: colors.text, paddingRight: 8 }]}
                                numberOfLines={2}
                            >
                                {textoIngresadoPorPedido(req)}
                            </Text>
                            <View style={{ width: 150 }}>
                                <AlmacenEstadoBadge estado={req.estado} />
                            </View>
                            <View style={{ width: 130 }}>
                                {esRequisicionConPedidoActivo(req.estado) ? (
                                    <TouchableOpacity
                                        style={[pedidoStyles.btnSecundario, { borderColor: colors.border }]}
                                        onPress={() => abrirModalPedido(req, true)}
                                    >
                                        <Text style={[pedidoStyles.btnTablaText, { color: colors.text }]}>
                                            {req.estado === 'En Almacen'
                                                ? 'Ver pedido'
                                                : req.estado === 'Parcial' &&
                                                    tieneProveedoresConRecepcionParcial(req)
                                                  ? 'Completar pedido'
                                                  : req.estado === 'Parcial'
                                                    ? 'Ver pedido'
                                                    : 'Editar'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={pedidoStyles.btnPrimario}
                                        onPress={() => abrirModalPedido(req, false)}
                                    >
                                        <Text style={pedidoStyles.btnPrimarioText}>Procesar pedido</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {expandida && (
                            <View
                                style={[
                                    pedidoStyles.detallePanel,
                                    {
                                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                        borderBottomColor: colors.border,
                                    },
                                ]}
                            >
                                <Text style={[pedidoStyles.detalleTitulo, { color: colors.text }]}>
                                    {req.pedido ? 'Datos del pedido' : 'Datos de la requisición'}
                                </Text>
                                <View style={pedidoStyles.detalleGrid}>
                                    {[
                                        ['Tipo', getTipoRequisicionLabel(req.tipoRequisicion)],
                                        ['Orden producción', req.ordenProduccion],
                                        ['Cliente', req.cliente],
                                        ['Referencia', req.referencia],
                                        ['Fecha solicitud', req.fechaSolicitud],
                                        ['Fecha requerida', req.fechaRequerida],
                                        ['Cantidad solicitada', `${req.cantidad} ${req.unidad}`],
                                        [
                                            'Cantidad pedida',
                                            req.pedido
                                                ? `${getCantidadTotalPedido(req.pedido)} ${req.unidad}`
                                                : '—',
                                        ],
                                        ...(req.estado === 'Parcial' && req.pedido
                                            ? (() => {
                                                  const r = getResumenCantidadesPedido(
                                                      normalizarPedido(req.pedido!),
                                                      req.recepcion
                                                  );
                                                  return [
                                                      ['Recibido', `${r.recibido} ${req.unidad}`],
                                                      ['Pendiente', `${r.pendiente} ${req.unidad}`],
                                                  ] as const;
                                              })()
                                            : []),
                                        ...(totalMonetario > 0
                                            ? ([['Total pedido', formatearMonedaCop(totalMonetario)]] as const)
                                            : []),
                                        ['Fecha pedido', fmtFecha(req.pedido?.fechaPedido)],
                                        ['Llegada estimada', req.pedido ? getFechaEntregaResumenPedido(req.pedido) : '—'],
                                        ['Ingresado por', textoIngresadoPorPedido(req)],
                                        ['Observación', req.observacion?.trim() || '—'],
                                    ].map(([k, v]) => (
                                        <View key={k} style={pedidoStyles.detalleItem}>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>{k}</Text>
                                            <Text style={{ color: colors.text, fontSize: 14 }}>{v}</Text>
                                        </View>
                                    ))}
                                </View>
                                {provs.length > 0 && (
                                    <View style={{ marginTop: 16 }}>
                                        <Text style={[pedidoStyles.detalleSubtitulo, { color: colors.subText }]}>
                                            Cantidad y precio por proveedor (pedido)
                                        </Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator
                                            contentContainerStyle={pedidoStyles.proveedorColumnasWrap}
                                        >
                                            {provs.map((p) => {
                                                const provFiscal = enriquecerProveedorFiscal(
                                                    p,
                                                    catalogoProveedores
                                                );
                                                const subtotal = getSubtotalProveedor(provFiscal);
                                                const lineasFiscales = getLineasFiscalesProveedor(
                                                    provFiscal,
                                                    catalogoProveedores
                                                );
                                                const recibidoProv = getCantidadRecibidaProveedor(
                                                    req.recepcion,
                                                    p.id
                                                );
                                                const pedidoOrig = getCantidadPedidaOriginalProveedor(
                                                    req.recepcion,
                                                    p
                                                );
                                                const saldo = getSaldoPendienteProveedor(req.recepcion, p);
                                                const filasAntes: [string, string, string][] = [
                                                    ...(p.numeroOrdenCompra != null && p.numeroOrdenCompra > 0
                                                        ? ([
                                                              [
                                                                  'Nº orden compra',
                                                                  formatearConsecutivoOrdenCompra(p.numeroOrdenCompra),
                                                                  colors.primary,
                                                              ],
                                                          ] as const)
                                                        : []),
                                                    ...(req.estado === 'Parcial'
                                                        ? ([
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
                                                          ] as const)
                                                        : []),
                                                    ['Cantidad', `${p.cantidad} ${req.unidad}`, colors.text],
                                                    [
                                                        'Precio unit.',
                                                        p.precioUnitario != null && p.precioUnitario > 0
                                                            ? `${formatearMonedaCop(p.precioUnitario)} / ${req.unidad}`
                                                            : '—',
                                                        colors.text,
                                                    ],
                                                    [
                                                        'Subtotal',
                                                        subtotal > 0 ? formatearMonedaCop(subtotal) : '—',
                                                        subtotal > 0 ? colors.primary : colors.subText,
                                                    ],
                                                ];
                                                const filasFiscales: [string, string, string][] = lineasFiscales.map(
                                                    (lf) => [
                                                        lf.etiqueta,
                                                        lf.esRetencion
                                                            ? `− ${formatearMonedaCop(lf.monto)}`
                                                            : formatearMonedaCop(lf.monto),
                                                        lf.esTotal
                                                            ? colors.primary
                                                            : lf.esRetencion
                                                              ? '#DC2626'
                                                              : colors.text,
                                                    ]
                                                );
                                                const filasDespues: [string, string, string][] = [
                                                    [
                                                        'Llegada est.',
                                                        p.fechaEntregaEstimada
                                                            ? formatFechaDisplay(p.fechaEntregaEstimada)
                                                            : '—',
                                                        colors.text,
                                                    ],
                                                    [
                                                        'Teléfono',
                                                        p.telefono?.trim() || '—',
                                                        colors.text,
                                                    ],
                                                    [
                                                        'Pago',
                                                        p.pagado
                                                            ? `Pagado${
                                                                  labelFormaPagoAlmacen(p.formaPago)
                                                                      ? ` (${labelFormaPagoAlmacen(p.formaPago)})`
                                                                      : ''
                                                              }`
                                                            : 'Pendiente',
                                                        p.pagado ? '#059669' : colors.subText,
                                                    ],
                                                ];
                                                const filas = [...filasAntes, ...filasFiscales, ...filasDespues];
                                                return (
                                                    <View
                                                        key={p.id}
                                                        style={[
                                                            pedidoStyles.proveedorColumna,
                                                            {
                                                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                                                borderColor: colors.border,
                                                            },
                                                        ]}
                                                    >
                                                        <View style={pedidoStyles.proveedorColumnaTituloWrap}>
                                                            {p.numeroOrdenCompra != null && p.numeroOrdenCompra > 0 ? (
                                                                <View
                                                                    style={[
                                                                        pedidoStyles.ocBadge,
                                                                        {
                                                                            backgroundColor: isDarkMode
                                                                                ? 'rgba(59,130,246,0.2)'
                                                                                : 'rgba(59,130,246,0.12)',
                                                                        },
                                                                    ]}
                                                                >
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.ocBadgeText,
                                                                            { color: colors.primary },
                                                                        ]}
                                                                    >
                                                                        OC{' '}
                                                                        {formatearConsecutivoOrdenCompra(
                                                                            p.numeroOrdenCompra
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                            ) : null}
                                                            <Text
                                                                style={[
                                                                    pedidoStyles.proveedorColumnaTitulo,
                                                                    { color: colors.text },
                                                                ]}
                                                            >
                                                                {p.nombre}
                                                            </Text>
                                                        </View>
                                                        {filas.map(([label, valor, colorValor]) => (
                                                            <View
                                                                key={label}
                                                                style={pedidoStyles.proveedorColumnaFila}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        pedidoStyles.proveedorColumnaLabel,
                                                                        { color: colors.subText },
                                                                    ]}
                                                                >
                                                                    {label}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        pedidoStyles.proveedorColumnaValor,
                                                                        {
                                                                            color: colorValor,
                                                                            fontWeight:
                                                                                label === 'Subtotal' || label === 'Total a pagar'
                                                                                    ? '700'
                                                                                    : '400',
                                                                        },
                                                                    ]}
                                                                >
                                                                    {valor}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                        <TouchableOpacity
                                                            style={[
                                                                pedidoStyles.btnOrdenCompra,
                                                                {
                                                                    borderColor: colors.primary,
                                                                    backgroundColor: isDarkMode
                                                                        ? 'rgba(59,130,246,0.12)'
                                                                        : 'rgba(59,130,246,0.08)',
                                                                },
                                                                generandoOcProveedorId === p.id && {
                                                                    opacity: 0.6,
                                                                },
                                                            ]}
                                                            onPress={() => solicitarOrdenCompra(req, p)}
                                                            disabled={generandoOcProveedorId === p.id}
                                                        >
                                                            <Text
                                                                style={[
                                                                    pedidoStyles.btnOrdenCompraText,
                                                                    { color: colors.primary },
                                                                ]}
                                                            >
                                                                {generandoOcProveedorId === p.id
                                                                    ? 'Generando…'
                                                                    : p.numeroOrdenCompra != null &&
                                                                        p.numeroOrdenCompra > 0
                                                                      ? `↓ Orden de compra · ${formatearConsecutivoOrdenCompra(p.numeroOrdenCompra)}`
                                                                      : '↓ Orden de compra'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <View style={{ marginTop: 8 }}>
                                                            {renderControlPago(req.id, p)}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </ScrollView>
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
        <View style={[pedidoStyles.card, pedidoStyles.cardPedidos, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <View style={pedidoStyles.cardHeader}>
                <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={[pedidoStyles.titulo, { color: colors.text }]}>Gestión de Pedidos</Text>
                    <Text style={[pedidoStyles.subtitulo, { color: colors.subText }]}>{tipoActivoMeta.label}</Text>
                </View>
                <View style={pedidoStyles.catalogoTopActions}>
                    <TouchableOpacity
                        style={[pedidoStyles.btnCatalogoTop, { borderColor: colors.border }]}
                        onPress={abrirListaProductos}
                    >
                        <Text style={[pedidoStyles.btnCatalogoTopText, { color: colors.text }]}>
                            Ver productos
                            {productos.length > 0 ? ` (${productos.length})` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[pedidoStyles.btnCatalogoTop, { borderColor: colors.border }]}
                        onPress={abrirListaProveedores}
                    >
                        <Text style={[pedidoStyles.btnCatalogoTopText, { color: colors.text }]}>
                            Ver proveedores
                            {catalogoProveedores.length > 0 ? ` (${catalogoProveedores.length})` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[pedidoStyles.btnCatalogoTop, { borderColor: colors.primary }]}
                        onPress={abrirModalCatalogo}
                    >
                        <Text style={pedidoStyles.btnCatalogoTopText}>+ Proveedores</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            pedidoStyles.btnCatalogoTop,
                            pedidoStyles.btnImportarExcelTop,
                            { borderColor: colors.primary, backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)' },
                            importandoExcel && { opacity: 0.6 },
                        ]}
                        onPress={handleImportarProveedoresExcel}
                        disabled={importandoExcel}
                    >
                        <Text style={pedidoStyles.btnCatalogoTopText}>
                            {importandoExcel ? 'Importando…' : 'Importar Excel'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={[pedidoStyles.ayuda, { color: colors.subText }]}>
                Cada requisición nueva (Pendiente) aparece aquí de inmediato. Asigne fechas y proveedores para pasarla a
                estado Pedido. Con filtro Pendiente puede seleccionar varias y generar una sola orden de compra.
            </Text>

            <AlmacenFiltroEstado
                opciones={OPCIONES_FILTRO_ESTADO_PEDIDOS}
                activo={filtroEstado}
                onChange={handleCambioFiltroEstado}
                conteos={conteoEstadoEnTipo}
                colors={colors}
                isDarkMode={isDarkMode}
            />

            {modoSeleccionConsolidar && reqsSeleccionadasConsolidar.length > 0 ? (
                <View
                    style={[
                        pedidoStyles.consolidarBar,
                        {
                            borderColor: colors.primary,
                            backgroundColor: isDarkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                        },
                    ]}
                >
                    <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>
                        {reqsSeleccionadasConsolidar.length} requisición
                        {reqsSeleccionadasConsolidar.length === 1 ? '' : 'es'} seleccionada
                        {reqsSeleccionadasConsolidar.length === 1 ? '' : 's'}
                    </Text>
                    <TouchableOpacity
                        style={[
                            pedidoStyles.btnConsolidar,
                            { backgroundColor: colors.primary },
                            reqsSeleccionadasConsolidar.length < 2 && { opacity: 0.5 },
                        ]}
                        onPress={abrirModalConsolidar}
                        disabled={reqsSeleccionadasConsolidar.length < 2}
                    >
                        <Text style={pedidoStyles.btnConsolidarText}>Pedido consolidado (1 OC)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSeleccionConsolidar({})}>
                        <Text style={{ color: colors.subText, fontSize: 13 }}>Limpiar</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {totalPedidosTipo === 0 ? (
                <Text style={[pedidoStyles.vacio, { color: colors.subText }]}>
                    {filtroEstado === 'todos'
                        ? `No hay pedidos en «${tipoActivoMeta.label}».`
                        : `No hay pedidos en estado «${
                              OPCIONES_FILTRO_ESTADO_PEDIDOS.find((o) => o.id === filtroEstado)?.label ?? filtroEstado
                          }» en «${tipoActivoMeta.label}».`}
                </Text>
            ) : (
                <>
                    {isWide ? (
                        <View style={pedidoStyles.tableWrap}>{tablaPedidos}</View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={pedidoStyles.tableWrapNarrow}>{tablaPedidos}</View>
                        </ScrollView>
                    )}

                    <View style={[pedidoStyles.paginationBar, { borderTopColor: colors.border }]}>
                        <Text style={[pedidoStyles.paginationInfo, { color: colors.subText }]}>
                            Mostrando {indiceInicio + 1}–{indiceFin} de {totalPedidosTipo} · Página {paginaActual} de{' '}
                            {totalPaginas}
                        </Text>
                        <View style={pedidoStyles.paginationControls}>
                            <TouchableOpacity
                                style={[
                                    pedidoStyles.paginationBtn,
                                    { borderColor: colors.border },
                                    paginaActual <= 1 && pedidoStyles.paginationBtnDisabled,
                                ]}
                                onPress={() => setPaginaPedido((p) => Math.max(1, p - 1))}
                                disabled={paginaActual <= 1}
                            >
                                <Text
                                    style={[
                                        pedidoStyles.btnSecundarioText,
                                        { color: paginaActual <= 1 ? colors.subText : colors.text },
                                    ]}
                                >
                                    ← Anterior
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    pedidoStyles.paginationBtn,
                                    pedidoStyles.paginationBtnPrimary,
                                    paginaActual >= totalPaginas && pedidoStyles.paginationBtnDisabled,
                                ]}
                                onPress={() => setPaginaPedido((p) => Math.min(totalPaginas, p + 1))}
                                disabled={paginaActual >= totalPaginas}
                            >
                                <Text style={pedidoStyles.paginationBtnTextPrimary}>Siguiente →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}

            <View
                style={[
                    pedidoStyles.sheetTabsBar,
                    {
                        backgroundColor: isDarkMode ? '#0F172A' : '#E8ECF0',
                        borderTopColor: colors.border,
                    },
                ]}
            >
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pedidoStyles.sheetTabsScroll}>
                    {TIPOS_REQUISICION.map((tipo) => {
                        const activa = tipoActivo === tipo.id;
                        const count = conteoPorTipo[tipo.id] ?? 0;
                        return (
                            <TouchableOpacity
                                key={tipo.id}
                                style={[
                                    pedidoStyles.sheetTab,
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
                                    activa && pedidoStyles.sheetTabActive,
                                ]}
                                onPress={() => handleCambioTipo(tipo.id)}
                                activeOpacity={0.85}
                            >
                                <Text
                                    style={[
                                        pedidoStyles.sheetTabText,
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

            <Modal visible={!!modalPedidoId} transparent animationType="fade" onRequestClose={cerrarModal}>
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            pedidoStyles.modalBoxPedido,
                            {
                                backgroundColor: cardBg,
                                borderColor: colors.border,
                                maxWidth: esModalParcial ? Math.min(modalPedidoAncho, 560) : modalPedidoAncho,
                            },
                        ]}
                    >
                        <View style={[pedidoStyles.modalPedidoHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>
                                    {pedidoSoloLectura
                                        ? 'Ver pedido'
                                        : reqModal?.estado === 'Parcial'
                                          ? 'Completar pedido parcial'
                                          : reqModal?.estado === 'Pedido'
                                            ? 'Editar pedido'
                                            : 'Procesar pedido'}
                                </Text>
                                {reqModal ? (
                                    <>
                                        <View style={pedidoStyles.modalPedidoMeta}>
                                            <View
                                                style={[
                                                    pedidoStyles.modalPedidoCodigo,
                                                    { backgroundColor: isDarkMode ? '#1E3A5F' : '#DBEAFE' },
                                                ]}
                                            >
                                                <Text
                                                    style={{
                                                        color: isDarkMode ? '#93C5FD' : '#1D4ED8',
                                                        fontWeight: '700',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {reqModal.codigo}
                                                </Text>
                                            </View>
                                            <Text style={{ color: colors.subText, fontSize: 13, flex: 1 }} numberOfLines={2}>
                                                {reqModal.producto}
                                            </Text>
                                        </View>
                                        <Text style={{ color: colors.subText, fontSize: 13, marginTop: 6 }}>
                                            Cantidad solicitada:{' '}
                                            <Text style={{ fontWeight: '700', color: colors.text }}>
                                                {reqModal.cantidad} {reqModal.unidad}
                                            </Text>
                                        </Text>
                                        {reqModal.estado === 'Parcial' && reqModal.pedido ? (
                                            (() => {
                                                const r = getResumenCantidadesPedido(
                                                    normalizarPedido(reqModal.pedido),
                                                    reqModal.recepcion
                                                );
                                                return (
                                                    <View
                                                        style={{
                                                            marginTop: 10,
                                                            padding: 12,
                                                            borderRadius: 8,
                                                            backgroundColor: isDarkMode
                                                                ? 'rgba(245,158,11,0.12)'
                                                                : '#FFFBEB',
                                                            borderWidth: 1,
                                                            borderColor: '#F59E0B',
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: '#F59E0B',
                                                                fontWeight: '700',
                                                                fontSize: 13,
                                                            }}
                                                        >
                                                            Pedido parcial — confirme el resto pendiente
                                                        </Text>
                                                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 6 }}>
                                                            Recibido: {r.recibido} {reqModal.unidad} · Pendiente:{' '}
                                                            {r.pendiente} {reqModal.unidad}
                                                        </Text>
                                                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }}>
                                                            Solo los proveedores que tuvieron una entrega parcial.
                                                            Confirme la cantidad pendiente y la próxima fecha de
                                                            llegada del resto.
                                                        </Text>
                                                    </View>
                                                );
                                            })()
                                        ) : null}
                                    </>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                onPress={cerrarModal}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[pedidoStyles.modalCerrarBtn, { borderColor: colors.border }]}
                            >
                                <Text style={{ color: colors.subText, fontSize: 18, lineHeight: 20 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={[
                                pedidoStyles.modalPedidoScroll,
                                { maxHeight: modalPedidoScrollMax },
                                Platform.OS === 'web' ? pedidoStyles.modalCatalogoScrollWeb : null,
                            ]}
                            contentContainerStyle={pedidoStyles.modalPedidoScrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                            nestedScrollEnabled
                        >
                            {esModalParcial ? (
                                <View>
                                    {parcialPendientes.length === 0 ? (
                                        <Text style={{ color: colors.subText, fontSize: 14 }}>
                                            No hay proveedores con entrega parcial por confirmar.
                                        </Text>
                                    ) : (
                                        parcialPendientes.map((p) => (
                                            <View
                                                key={p.id}
                                                style={[
                                                    pedidoStyles.provItem,
                                                    {
                                                        borderColor: colors.border,
                                                        backgroundColor: isDarkMode ? '#0F172A' : inputBg,
                                                        padding: 16,
                                                        marginBottom: 12,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={{
                                                        color: colors.text,
                                                        fontWeight: '700',
                                                        fontSize: 16,
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    {p.nombre}
                                                </Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                                                    <Text style={{ color: '#22C55E', fontSize: 13 }}>
                                                        Recibido:{' '}
                                                        <Text style={{ fontWeight: '600' }}>
                                                            {p.recibido} {reqModal?.unidad}
                                                        </Text>
                                                    </Text>
                                                    <Text style={{ color: '#F59E0B', fontSize: 13 }}>
                                                        Pendiente:{' '}
                                                        <Text style={{ fontWeight: '700' }}>
                                                            {p.cantidadPendiente} {reqModal?.unidad}
                                                        </Text>
                                                    </Text>
                                                </View>
                                                <Text style={[pedidoStyles.label, { color: colors.subText, marginBottom: 8 }]}>
                                                    Cantidad pendiente *
                                                </Text>
                                                <View
                                                    style={[
                                                        pedidoStyles.cantidadConUnidad,
                                                        {
                                                            backgroundColor: cardBg,
                                                            borderColor: colors.border,
                                                            marginLeft: 0,
                                                            marginBottom: 14,
                                                            maxWidth: 200,
                                                        },
                                                    ]}
                                                >
                                                    <TextInput
                                                        style={[pedidoStyles.cantidadInput, { color: colors.text }]}
                                                        placeholder="Cantidad"
                                                        placeholderTextColor={colors.subText}
                                                        value={p.cantidadPendienteTexto}
                                                        onChangeText={(t) => {
                                                            const limpio = t.replace(/[^0-9.,]/g, '');
                                                            const n = parseFloat(limpio.replace(',', '.'));
                                                            setParcialPendientes((prev) =>
                                                                prev.map((x) =>
                                                                    x.id === p.id
                                                                        ? {
                                                                              ...x,
                                                                              cantidadPendienteTexto: limpio,
                                                                              cantidadPendiente: isNaN(n) ? 0 : n,
                                                                          }
                                                                        : x
                                                                )
                                                            );
                                                            setErrorValidacion(null);
                                                        }}
                                                        keyboardType="decimal-pad"
                                                    />
                                                    {reqModal?.unidad ? (
                                                        <Text
                                                            style={[
                                                                pedidoStyles.unidadProveedor,
                                                                { color: colors.subText },
                                                            ]}
                                                        >
                                                            {reqModal.unidad}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <Text style={[pedidoStyles.label, { color: colors.subText, marginBottom: 8 }]}>
                                                    Próxima fecha de llegada *
                                                </Text>
                                                <AlmacenCampoFecha
                                                    value={p.fechaEntregaEstimada}
                                                    onChange={(v) => {
                                                        setParcialPendientes((prev) =>
                                                            prev.map((x) =>
                                                                x.id === p.id
                                                                    ? { ...x, fechaEntregaEstimada: v }
                                                                    : x
                                                            )
                                                        );
                                                        setErrorValidacion(null);
                                                    }}
                                                    colors={colors}
                                                    isDarkMode={isDarkMode}
                                                    inputBg={cardBg}
                                                />
                                            </View>
                                        ))
                                    )}
                                </View>
                            ) : (
                            <>
                            <View
                                style={[
                                    pedidoStyles.modalPedidoFechaCard,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor: isDarkMode ? '#0F172A' : inputBg,
                                    },
                                ]}
                            >
                                <Text style={[pedidoStyles.label, { color: colors.subText, marginBottom: 8 }]}>
                                    Fecha de pedido *
                                </Text>
                                <AlmacenCampoFecha
                                    value={fechaPedido}
                                    onChange={(v) => {
                                        setFechaPedido(v);
                                        setErrorValidacion(null);
                                    }}
                                    colors={colors}
                                    isDarkMode={isDarkMode}
                                    inputBg={cardBg}
                                />
                            </View>

                            {costoCatalogoModal != null && costoCatalogoModal > 0 ? (
                                <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                                    Costo de referencia en catálogo: {formatearMonedaCop(costoCatalogoModal)} /{' '}
                                    {reqModal?.unidad ?? 'und'}. Cada proveedor puede tener un precio distinto.
                                </Text>
                            ) : null}

                            <View style={pedidoStyles.modalPedidoSeccionHead}>
                                <Text style={[pedidoStyles.modalPedidoSeccionTitulo, { color: colors.text }]}>
                                    Proveedores asignados
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 13, lineHeight: 18 }}>
                                    Seleccione del catálogo o escriba manualmente. Puede dividir la cantidad entre varios
                                    proveedores.
                                </Text>
                            </View>

                            <View style={pedidoStyles.provLista}>
                                {proveedores.map((prov, idx) => {
                                    const expandido = proveedorExpandidoId === prov.id;
                                    const resumenNombre =
                                        prov.nombre.trim() || `Proveedor ${idx + 1} (sin asignar)`;
                                    const resumenFecha = prov.fechaEntregaEstimada
                                        ? formatFechaDisplay(prov.fechaEntregaEstimada)
                                        : 'Sin fecha';
                                    const subtotalProv = getSubtotalProveedor(prov);
                                    return (
                                        <View
                                            key={prov.id}
                                            style={[
                                                pedidoStyles.provItem,
                                                {
                                                    borderColor: expandido ? colors.primary : colors.border,
                                                    backgroundColor: isDarkMode ? '#0F172A' : inputBg,
                                                },
                                            ]}
                                        >
                                            <View style={pedidoStyles.provItemHeader}>
                                            <TouchableOpacity
                                                style={[pedidoStyles.provResumen, { flex: 1 }]}
                                                onPress={() => toggleProveedorExpandido(prov.id)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={{ color: colors.primary, fontSize: 14, width: 22 }}>
                                                    {expandido ? '▼' : '▶'}
                                                </Text>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <Text
                                                        style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}
                                                        numberOfLines={1}
                                                    >
                                                        {resumenNombre}
                                                    </Text>
                                                    <Text style={{ color: colors.subText, fontSize: 12 }} numberOfLines={2}>
                                                        {prov.cantidad > 0 ? (
                                                            <>
                                                                <Text style={{ fontWeight: '700', color: colors.text }}>
                                                                    {prov.cantidad} {reqModal?.unidad ?? ''}
                                                                </Text>
                                                                {prov.precioUnitario != null && prov.precioUnitario > 0 ? (
                                                                    <>
                                                                        {' · '}
                                                                        {formatearMonedaCop(prov.precioUnitario)} /{' '}
                                                                        {reqModal?.unidad ?? 'und'}
                                                                        {subtotalProv > 0 ? (
                                                                            <>
                                                                                {' · Subtotal '}
                                                                                <Text style={{ fontWeight: '700', color: colors.text }}>
                                                                                    {formatearMonedaCop(subtotalProv)}
                                                                                </Text>
                                                                            </>
                                                                        ) : null}
                                                                    </>
                                                                ) : null}
                                                                {' · Llegada '}
                                                                {resumenFecha}
                                                            </>
                                                        ) : (
                                                            <>Sin cantidad · Llegada {resumenFecha}</>
                                                        )}
                                                        {prov.nit ? `\nNIT ${prov.nit}` : ''}
                                                        {prov.telefono ? ` · ${prov.telefono}` : ''}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                            {!pedidoSoloLectura && (
                                                <TouchableOpacity
                                                    style={[
                                                        pedidoStyles.btnQuitarProveedor,
                                                        { borderColor: '#FECACA', backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2' },
                                                    ]}
                                                    onPress={() => quitarProveedor(prov.id)}
                                                >
                                                    <Text style={pedidoStyles.btnQuitarProveedorText}>Quitar</Text>
                                                </TouchableOpacity>
                                            )}
                                            </View>

                                            {expandido && (
                                                <View
                                                    style={[
                                                        pedidoStyles.provDetalle,
                                                        { borderTopColor: colors.border },
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            pedidoStyles.provDetalleGrid,
                                                            isWide
                                                                ? pedidoStyles.provDetalleGridWide
                                                                : pedidoStyles.provDetalleGridNarrow,
                                                        ]}
                                                    >
                                                        <ProveedorCatalogoPicker
                                                            catalogo={catalogoProveedores}
                                                            busqueda={getBusquedaPicker(prov.id)}
                                                            onBusquedaChange={(t) => setBusquedaPicker(prov.id, t)}
                                                            pagina={getPaginaPicker(prov.id)}
                                                            onPaginaChange={(p) => setPaginaPicker(prov.id, p)}
                                                            onSeleccionar={(cat) =>
                                                                aplicarCatalogoAProveedor(prov.id, cat)
                                                            }
                                                            seleccionadoId={prov.catalogoId}
                                                            colors={colors}
                                                            isDarkMode={isDarkMode}
                                                            inputBg={inputBg}
                                                            listMaxHeight={provPickerListMax}
                                                            soloLectura={pedidoSoloLectura}
                                                        />
                                                        <View style={pedidoStyles.provFormPanel}>
                                                            <Text
                                                                style={[
                                                                    pedidoStyles.provPickerTitulo,
                                                                    { color: colors.text, marginBottom: 10 },
                                                                ]}
                                                            >
                                                                Datos del proveedor
                                                            </Text>
                                                            <Text
                                                                style={[pedidoStyles.labelMini, { color: colors.subText }]}
                                                            >
                                                                Nombre *
                                                            </Text>
                                                            <TextInput
                                                                style={[
                                                                    pedidoStyles.inputCompact,
                                                                    {
                                                                        backgroundColor: cardBg,
                                                                        borderColor: colors.border,
                                                                        color: colors.text,
                                                                    },
                                                                ]}
                                                                placeholder="Nombre del proveedor"
                                                                placeholderTextColor={colors.subText}
                                                                value={prov.nombre}
                                                                editable={!pedidoSoloLectura}
                                                                onChangeText={(t) => {
                                                                    actualizarProveedor(prov.id, 'nombre', t);
                                                                    setErrorValidacion(null);
                                                                }}
                                                            />
                                                            <View style={pedidoStyles.provDetalleFila}>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.labelMini,
                                                                            { color: colors.subText },
                                                                        ]}
                                                                    >
                                                                        NIT
                                                                    </Text>
                                                                    <TextInput
                                                                        style={[
                                                                            pedidoStyles.inputCompact,
                                                                            {
                                                                                backgroundColor: cardBg,
                                                                                borderColor: colors.border,
                                                                                color: colors.text,
                                                                            },
                                                                        ]}
                                                                        placeholder="NIT"
                                                                        placeholderTextColor={colors.subText}
                                                                        value={prov.nit ?? ''}
                                                                        editable={!pedidoSoloLectura}
                                                                        onChangeText={(t) => {
                                                                            actualizarProveedor(prov.id, 'nit', t);
                                                                            setErrorValidacion(null);
                                                                        }}
                                                                    />
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.labelMini,
                                                                            { color: colors.subText },
                                                                        ]}
                                                                    >
                                                                        Teléfono
                                                                    </Text>
                                                                    <TextInput
                                                                        style={[
                                                                            pedidoStyles.inputCompact,
                                                                            {
                                                                                backgroundColor: cardBg,
                                                                                borderColor: colors.border,
                                                                                color: colors.text,
                                                                            },
                                                                        ]}
                                                                        placeholder="Teléfono"
                                                                        placeholderTextColor={colors.subText}
                                                                        value={prov.telefono ?? ''}
                                                                        editable={!pedidoSoloLectura}
                                                                        onChangeText={(t) => {
                                                                            actualizarProveedor(prov.id, 'telefono', t);
                                                                            setErrorValidacion(null);
                                                                        }}
                                                                        keyboardType="phone-pad"
                                                                    />
                                                                </View>
                                                            </View>
                                                            <Text
                                                                style={[pedidoStyles.labelMini, { color: colors.subText }]}
                                                            >
                                                                Categoría
                                                            </Text>
                                                            <GruposCategoriaProveedorChips
                                                                categoriaActiva={prov.categoria}
                                                                disabled={pedidoSoloLectura}
                                                                colors={colors}
                                                                onSeleccionar={(nuevaCat) =>
                                                                    actualizarClasificacionProveedor(prov.id, {
                                                                        categoria: nuevaCat,
                                                                        responsableIva:
                                                                            responsableIvaDesdeCategoria(nuevaCat),
                                                                    })
                                                                }
                                                            />
                                                            <View style={pedidoStyles.provDetalleFila}>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.labelMini,
                                                                            { color: colors.subText },
                                                                        ]}
                                                                    >
                                                                        {reqModal?.estado === 'Parcial' &&
                                                                        getSaldoPendienteProveedor(reqModal.recepcion, prov) > 0
                                                                            ? 'Cantidad pendiente *'
                                                                            : 'Cantidad *'}
                                                                    </Text>
                                                                    <View
                                                                        style={[
                                                                            pedidoStyles.cantidadConUnidad,
                                                                            {
                                                                                backgroundColor: cardBg,
                                                                                borderColor: colors.border,
                                                                            },
                                                                        ]}
                                                                    >
                                                                        <TextInput
                                                                            style={[
                                                                                pedidoStyles.cantidadInput,
                                                                                { color: colors.text },
                                                                            ]}
                                                                            placeholder="0"
                                                                            placeholderTextColor={colors.subText}
                                                                            value={
                                                                                prov.cantidad > 0
                                                                                    ? String(prov.cantidad)
                                                                                    : ''
                                                                            }
                                                                            editable={!pedidoSoloLectura}
                                                                            onChangeText={(t) => {
                                                                                actualizarProveedor(prov.id, 'cantidad', t);
                                                                                setErrorValidacion(null);
                                                                            }}
                                                                            keyboardType="decimal-pad"
                                                                        />
                                                                        {reqModal?.unidad ? (
                                                                            <Text
                                                                                style={[
                                                                                    pedidoStyles.unidadProveedor,
                                                                                    { color: colors.subText },
                                                                                ]}
                                                                            >
                                                                                {reqModal.unidad}
                                                                            </Text>
                                                                        ) : null}
                                                                    </View>
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.labelMini,
                                                                            { color: colors.subText },
                                                                        ]}
                                                                    >
                                                                        Precio unitario
                                                                    </Text>
                                                                    <TextInput
                                                                        style={[
                                                                            pedidoStyles.inputCompact,
                                                                            {
                                                                                backgroundColor: cardBg,
                                                                                borderColor: colors.border,
                                                                                color: colors.text,
                                                                            },
                                                                        ]}
                                                                        placeholder="Ej. 64033,61"
                                                                        placeholderTextColor={colors.subText}
                                                                        value={getPrecioUnitarioDisplay(prov)}
                                                                        editable={!pedidoSoloLectura}
                                                                        onChangeText={(t) => {
                                                                            actualizarProveedor(
                                                                                prov.id,
                                                                                'precioUnitario',
                                                                                t
                                                                            );
                                                                            setErrorValidacion(null);
                                                                        }}
                                                                        onBlur={() => finalizarPrecioProveedor(prov.id)}
                                                                        keyboardType="decimal-pad"
                                                                    />
                                                                    {subtotalProv > 0 ? (
                                                                        <Text
                                                                            style={{
                                                                                color: colors.subText,
                                                                                fontSize: 11,
                                                                                marginTop: 4,
                                                                            }}
                                                                        >
                                                                            Subtotal:{' '}
                                                                            <Text style={{ fontWeight: '700', color: colors.text }}>
                                                                                {formatearMonedaCop(subtotalProv)}
                                                                            </Text>
                                                                        </Text>
                                                                    ) : null}
                                                                </View>
                                                            </View>
                                                            <View style={pedidoStyles.provDetalleFila}>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.labelMini,
                                                                            { color: colors.subText },
                                                                        ]}
                                                                    >
                                                                        Llegada est. *
                                                                    </Text>
                                                                    <AlmacenCampoFecha
                                                                        value={prov.fechaEntregaEstimada ?? ''}
                                                                        onChange={(iso) => {
                                                                            actualizarProveedor(
                                                                                prov.id,
                                                                                'fechaEntregaEstimada',
                                                                                iso
                                                                            );
                                                                            setErrorValidacion(null);
                                                                        }}
                                                                        colors={colors}
                                                                        isDarkMode={isDarkMode}
                                                                        inputBg={cardBg}
                                                                    />
                                                                </View>
                                                            </View>
                                                            {!pedidoSoloLectura && !prov.numeroOrdenCompra ? (
                                                                <View
                                                                    style={[
                                                                        pedidoStyles.ocAdjuntoCard,
                                                                        {
                                                                            borderColor: colors.border,
                                                                            backgroundColor: isDarkMode
                                                                                ? '#1E293B'
                                                                                : '#F8FAFC',
                                                                        },
                                                                    ]}
                                                                >
                                                                    <Text
                                                                        style={[
                                                                            pedidoStyles.labelMini,
                                                                            { color: colors.subText, marginBottom: 6 },
                                                                        ]}
                                                                    >
                                                                        Orden de compra
                                                                    </Text>
                                                                    {prov.agregarAOrdenCompraId ? (
                                                                        <View style={pedidoStyles.ocAdjuntoRow}>
                                                                            <Text
                                                                                style={{
                                                                                    flex: 1,
                                                                                    color: colors.text,
                                                                                    fontSize: 13,
                                                                                    fontWeight: '600',
                                                                                }}
                                                                            >
                                                                                Adjuntar a OC existente (varios productos en
                                                                                un PDF)
                                                                            </Text>
                                                                            <TouchableOpacity
                                                                                style={[
                                                                                    pedidoStyles.btnOcQuitar,
                                                                                    { borderColor: colors.border },
                                                                                ]}
                                                                                onPress={() => quitarAdjuntoOcProveedor(prov.id)}
                                                                            >
                                                                                <Text style={{ color: colors.subText, fontSize: 12 }}>
                                                                                    Nueva OC
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    ) : (
                                                                        <Text
                                                                            style={{
                                                                                color: colors.subText,
                                                                                fontSize: 12,
                                                                                lineHeight: 18,
                                                                                marginBottom: 8,
                                                                            }}
                                                                        >
                                                                            Se creará una OC nueva solo para este proveedor.
                                                                        </Text>
                                                                    )}
                                                                    {prov.agregarAOrdenCompraId ? (
                                                                        <Text
                                                                            style={{
                                                                                color: colors.primary,
                                                                                fontSize: 13,
                                                                                fontWeight: '700',
                                                                                marginBottom: 8,
                                                                            }}
                                                                        >
                                                                            OC seleccionada:{' '}
                                                                            {prov.agregarAOrdenCompraNumero
                                                                                ? formatearConsecutivoOrdenCompra(
                                                                                      prov.agregarAOrdenCompraNumero
                                                                                  )
                                                                                : `#${prov.agregarAOrdenCompraId}`}
                                                                        </Text>
                                                                    ) : null}
                                                                    <TouchableOpacity
                                                                        style={[
                                                                            pedidoStyles.btnOcAdjuntar,
                                                                            {
                                                                                borderColor: colors.primary,
                                                                                backgroundColor: isDarkMode
                                                                                    ? 'rgba(59, 130, 246, 0.12)'
                                                                                    : 'rgba(59, 130, 246, 0.08)',
                                                                            },
                                                                        ]}
                                                                        onPress={() => void abrirPickerOcProveedor(prov)}
                                                                        disabled={!prov.nombre.trim()}
                                                                    >
                                                                        <Text
                                                                            style={{
                                                                                color: colors.primary,
                                                                                fontWeight: '600',
                                                                                fontSize: 13,
                                                                            }}
                                                                        >
                                                                            {prov.agregarAOrdenCompraId
                                                                                ? 'Cambiar OC existente'
                                                                                : 'Adjuntar a OC existente'}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}

                                {!pedidoSoloLectura && (
                                    <TouchableOpacity
                                        style={[pedidoStyles.btnAgregarProv, { borderColor: colors.border }]}
                                        onPress={agregarProveedor}
                                    >
                                        <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>
                                            + Agregar proveedor
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {totalPedidoModal > 0 || cantidadPedidaModal > 0 ? (
                                    <View
                                        style={[
                                            pedidoStyles.modalPedidoTotalCard,
                                            {
                                                borderColor: colors.border,
                                                backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>
                                                Cantidad pedida total
                                            </Text>
                                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                                                {cantidadPedidaModal} {reqModal?.unidad ?? ''}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>Total estimado</Text>
                                            <Text
                                                style={[
                                                    pedidoStyles.modalPedidoPrecioTotal,
                                                    { color: colors.text, fontSize: 18 },
                                                ]}
                                            >
                                                {totalPedidoModal > 0 ? formatearMonedaCop(totalPedidoModal) : '—'}
                                            </Text>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                            </>
                            )}

                        </ScrollView>

                        {errorValidacion ? (
                            <View
                                style={[
                                    pedidoStyles.errorBanner,
                                    pedidoStyles.modalPedidoError,
                                    {
                                        backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                                        borderColor: '#EF4444',
                                    },
                                ]}
                            >
                                <Text style={{ color: '#F87171', fontSize: 13, lineHeight: 18 }}>{errorValidacion}</Text>
                            </View>
                        ) : null}

                        <View
                            style={[
                                pedidoStyles.modalFooter,
                                pedidoStyles.modalFooterPedido,
                                { borderTopColor: colors.border },
                            ]}
                        >
                            <TouchableOpacity
                                style={[pedidoStyles.btnSecundario, { borderColor: colors.border }]}
                                onPress={cerrarModal}
                            >
                                <Text style={[pedidoStyles.btnSecundarioText, { color: colors.text }]}>Cancelar</Text>
                            </TouchableOpacity>
                            {!pedidoSoloLectura && (
                                <TouchableOpacity
                                    style={[pedidoStyles.btnPrimario, guardando && { opacity: 0.6 }]}
                                    onPress={esModalParcial ? guardarPedidoParcial : guardarPedido}
                                    disabled={guardando}
                                >
                                    <Text style={pedidoStyles.btnPrimarioText}>
                                        {guardando
                                            ? 'Guardando…'
                                            : esModalParcial
                                              ? 'Confirmar resto pendiente'
                                              : 'Guardar pedido'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={modalListaProveedores}
                transparent
                animationType="fade"
                onRequestClose={cerrarListaProveedores}
            >
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            pedidoStyles.modalBoxListaProveedores,
                            { backgroundColor: cardBg, borderColor: colors.border, maxWidth: Math.min(windowWidth - 48, 920) },
                        ]}
                    >
                        <View style={[pedidoStyles.listaProvHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>
                                    Proveedores registrados
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 13, marginTop: 4 }}>
                                    {busquedaCatalogo.trim()
                                        ? `${proveedoresCatalogoFiltrados.length} de ${catalogoProveedores.length} proveedor(es)`
                                        : `${catalogoProveedores.length} proveedor(es) en el catálogo`}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={cerrarListaProveedores}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[pedidoStyles.modalCerrarBtn, { borderColor: colors.border }]}
                            >
                                <Text style={{ color: colors.subText, fontSize: 18, lineHeight: 20 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={pedidoStyles.listaProvToolbar}>
                            <TextInput
                                style={[
                                    pedidoStyles.catalogoInput,
                                    pedidoStyles.listaProvBusqueda,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="Buscar por nombre, NIT o teléfono…"
                                placeholderTextColor={colors.subText}
                                value={busquedaCatalogo}
                                onChangeText={(t) => {
                                    setBusquedaCatalogo(t);
                                    setPaginaCatalogo(1);
                                }}
                            />
                            <TouchableOpacity
                                style={[pedidoStyles.btnCatalogoTop, { borderColor: colors.primary }]}
                                onPress={nuevoProveedorDesdeLista}
                            >
                                <Text style={pedidoStyles.btnCatalogoTopText}>+ Nuevo</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={[
                                pedidoStyles.listaProvScroll,
                                { maxHeight: catalogoScrollMax },
                                Platform.OS === 'web' ? pedidoStyles.modalCatalogoScrollWeb : null,
                            ]}
                            contentContainerStyle={pedidoStyles.listaProvScrollContent}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                            {proveedoresCatalogoFiltrados.length === 0 ? (
                                <Text style={[pedidoStyles.vacio, { color: colors.subText, paddingVertical: 32 }]}>
                                    {busquedaCatalogo.trim()
                                        ? 'No hay proveedores que coincidan con la búsqueda.'
                                        : 'No hay proveedores registrados. Use «+ Nuevo» o importe un Excel.'}
                                </Text>
                            ) : (
                                <>
                                    <View style={[pedidoStyles.listaProvTableHead, { borderBottomColor: colors.border }]}>
                                        {['NOMBRE', 'NIT', 'TELÉFONO', 'CORREO', ''].map((col) => (
                                            <Text
                                                key={col || 'acc'}
                                                style={[
                                                    pedidoStyles.listaProvTh,
                                                    { color: colors.subText },
                                                    col === 'NOMBRE' && pedidoStyles.listaProvColNombre,
                                                    col === 'NIT' && pedidoStyles.listaProvColNit,
                                                    col === 'TELÉFONO' && pedidoStyles.listaProvColTel,
                                                    col === 'CORREO' && pedidoStyles.listaProvColCorreo,
                                                    col === '' && pedidoStyles.listaProvColAcc,
                                                ]}
                                            >
                                                {col}
                                            </Text>
                                        ))}
                                    </View>
                                    {proveedoresCatalogoPagina.map((c) => (
                                        <View
                                            key={c.id}
                                            style={[pedidoStyles.listaProvRow, { borderBottomColor: colors.border }]}
                                        >
                                            <Text
                                                style={[
                                                    pedidoStyles.listaProvTd,
                                                    pedidoStyles.listaProvColNombre,
                                                    { color: colors.text, fontWeight: '600' },
                                                ]}
                                                numberOfLines={3}
                                            >
                                                {c.nombre}
                                            </Text>
                                            <Text
                                                style={[
                                                    pedidoStyles.listaProvTd,
                                                    pedidoStyles.listaProvColNit,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                {c.nit?.trim() || '—'}
                                            </Text>
                                            <Text
                                                style={[
                                                    pedidoStyles.listaProvTd,
                                                    pedidoStyles.listaProvColTel,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                {c.telefonoMovil?.trim() ||
                                                    c.telefonoTrabajo?.trim() ||
                                                    c.telefono?.trim() ||
                                                    '—'}
                                            </Text>
                                            <Text
                                                style={[
                                                    pedidoStyles.listaProvTd,
                                                    pedidoStyles.listaProvColCorreo,
                                                    { color: colors.text },
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {c.correo?.trim() || '—'}
                                            </Text>
                                            <View style={pedidoStyles.listaProvColAcc}>
                                                <TouchableOpacity
                                                    style={[
                                                        pedidoStyles.btnEditarCatalogo,
                                                        { borderColor: colors.primary },
                                                    ]}
                                                    onPress={() => editarProveedorDesdeLista(c)}
                                                >
                                                    <Text
                                                        style={[
                                                            pedidoStyles.btnEditarCatalogoText,
                                                            { color: colors.primary },
                                                        ]}
                                                    >
                                                        Editar
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        pedidoStyles.btnEditarCatalogo,
                                                        pedidoStyles.btnEliminarCatalogo,
                                                        { borderColor: '#EF4444', marginTop: 6 },
                                                    ]}
                                                    onPress={() => setConfirmEliminarProveedor(c)}
                                                >
                                                    <Text style={[pedidoStyles.btnEditarCatalogoText, { color: '#EF4444' }]}>
                                                        Borrar
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </>
                            )}
                        </ScrollView>

                        {totalCatalogoFiltrado > CATALOGO_POR_PAGINA ? (
                            <View style={[pedidoStyles.catalogoPaginationBar, { borderTopColor: colors.border }]}>
                                <Text style={[pedidoStyles.catalogoPaginationInfo, { color: colors.subText }]}>
                                    Página {paginaCatalogoActual} de {totalPaginasCatalogo} ·{' '}
                                    {indiceCatalogoInicio + 1}–{indiceCatalogoFin} de {totalCatalogoFiltrado}
                                </Text>
                                <View style={pedidoStyles.paginationControls}>
                                    <TouchableOpacity
                                        style={[
                                            pedidoStyles.catalogoPaginationBtn,
                                            { borderColor: colors.border },
                                            paginaCatalogoActual <= 1 && pedidoStyles.paginationBtnDisabled,
                                        ]}
                                        onPress={() => setPaginaCatalogo((p) => Math.max(1, p - 1))}
                                        disabled={paginaCatalogoActual <= 1}
                                    >
                                        <Text
                                            style={[
                                                pedidoStyles.btnSecundarioText,
                                                {
                                                    color: paginaCatalogoActual <= 1 ? colors.subText : colors.text,
                                                },
                                            ]}
                                        >
                                            ← Anterior
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            pedidoStyles.catalogoPaginationBtn,
                                            pedidoStyles.paginationBtnPrimary,
                                            paginaCatalogoActual >= totalPaginasCatalogo &&
                                                pedidoStyles.paginationBtnDisabled,
                                        ]}
                                        onPress={() =>
                                            setPaginaCatalogo((p) => Math.min(totalPaginasCatalogo, p + 1))
                                        }
                                        disabled={paginaCatalogoActual >= totalPaginasCatalogo}
                                    >
                                        <Text style={pedidoStyles.paginationBtnTextPrimary}>Siguiente →</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}

                        <View style={[pedidoStyles.modalFooter, pedidoStyles.modalFooterCatalogo, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[pedidoStyles.btnSecundario, { borderColor: colors.border }]}
                                onPress={cerrarListaProveedores}
                            >
                                <Text style={[pedidoStyles.btnSecundarioText, { color: colors.text }]}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={modalListaProductos}
                transparent
                animationType="fade"
                onRequestClose={cerrarListaProductos}
            >
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            pedidoStyles.modalBoxListaProveedores,
                            { backgroundColor: cardBg, borderColor: colors.border, maxWidth: Math.min(windowWidth - 48, 1040) },
                        ]}
                    >
                        <View style={[pedidoStyles.listaProvHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>
                                    Catálogo de productos
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 13, marginTop: 4 }}>
                                    {totalProductosFiltrado !== productos.length
                                        ? `${totalProductosFiltrado} de ${productos.length} producto(s)`
                                        : `${productos.length} producto(s) disponibles para pedidos`}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[pedidoStyles.btnNuevoCatalogo, { backgroundColor: colors.primary }]}
                                onPress={abrirNuevoProducto}
                            >
                                <Text style={pedidoStyles.btnNuevoCatalogoText}>+ Nuevo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={cerrarListaProductos}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[pedidoStyles.modalCerrarBtn, { borderColor: colors.border, marginLeft: 8 }]}
                            >
                                <Text style={{ color: colors.subText, fontSize: 18, lineHeight: 20 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={pedidoStyles.listaProvToolbar}>
                            <TextInput
                                style={[
                                    pedidoStyles.catalogoInput,
                                    pedidoStyles.listaProvBusqueda,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="Buscar por nombre, categoría o unidad…"
                                placeholderTextColor={colors.subText}
                                value={busquedaProductos}
                                onChangeText={(t) => {
                                    setBusquedaProductos(t);
                                    setPaginaProductos(1);
                                }}
                            />
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={pedidoStyles.filtroChipsScroll}
                            contentContainerStyle={pedidoStyles.filtroChipsContent}
                        >
                            <TouchableOpacity
                                style={[
                                    pedidoStyles.filtroChip,
                                    { borderColor: colors.border },
                                    filtroCategoriaProductos === 'todas' && {
                                        backgroundColor: colors.primary,
                                        borderColor: colors.primary,
                                    },
                                ]}
                                onPress={() => {
                                    setFiltroCategoriaProductos('todas');
                                    setPaginaProductos(1);
                                }}
                            >
                                <Text
                                    style={[
                                        pedidoStyles.filtroChipText,
                                        { color: filtroCategoriaProductos === 'todas' ? '#fff' : colors.text },
                                    ]}
                                >
                                    Todas
                                </Text>
                            </TouchableOpacity>
                            {TIPOS_REQUISICION.map((t) => {
                                const activo = filtroCategoriaProductos === t.id;
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        style={[
                                            pedidoStyles.filtroChip,
                                            { borderColor: activo ? t.accentColor : colors.border },
                                            activo && { backgroundColor: t.accentColor },
                                        ]}
                                        onPress={() => {
                                            setFiltroCategoriaProductos(t.id);
                                            setPaginaProductos(1);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                pedidoStyles.filtroChipText,
                                                { color: activo ? '#fff' : colors.text },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {unidadesFiltroProductos.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={pedidoStyles.filtroChipsScrollUnidad}
                                contentContainerStyle={pedidoStyles.filtroChipsContent}
                            >
                                <TouchableOpacity
                                    style={[
                                        pedidoStyles.filtroChip,
                                        pedidoStyles.filtroChipPequeno,
                                        { borderColor: colors.border },
                                        filtroUnidadProductos === 'todas' && {
                                            backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                                        },
                                    ]}
                                    onPress={() => {
                                        setFiltroUnidadProductos('todas');
                                        setPaginaProductos(1);
                                    }}
                                >
                                    <Text style={[pedidoStyles.filtroChipText, { color: colors.text, fontSize: 12 }]}>
                                        Unidad: todas
                                    </Text>
                                </TouchableOpacity>
                                {unidadesFiltroProductos.map((u) => {
                                    const activo = filtroUnidadProductos === u;
                                    return (
                                        <TouchableOpacity
                                            key={u}
                                            style={[
                                                pedidoStyles.filtroChip,
                                                pedidoStyles.filtroChipPequeno,
                                                { borderColor: colors.border },
                                                activo && {
                                                    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                                                },
                                            ]}
                                            onPress={() => {
                                                setFiltroUnidadProductos(u);
                                                setPaginaProductos(1);
                                            }}
                                        >
                                            <Text style={[pedidoStyles.filtroChipText, { color: colors.text, fontSize: 12 }]}>
                                                {u}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : null}

                        <ScrollView
                            style={[
                                pedidoStyles.listaProvScroll,
                                { maxHeight: catalogoScrollMax },
                                Platform.OS === 'web' ? pedidoStyles.modalCatalogoScrollWeb : null,
                            ]}
                            contentContainerStyle={pedidoStyles.listaProvScrollContent}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                            {productosPagina.length === 0 ? (
                                <Text style={[pedidoStyles.vacio, { color: colors.subText, paddingVertical: 32 }]}>
                                    {busquedaProductos.trim() || filtroCategoriaProductos !== 'todas' || filtroUnidadProductos !== 'todas'
                                        ? 'No hay productos que coincidan con los filtros.'
                                        : 'No hay productos en el catálogo.'}
                                </Text>
                            ) : (
                                <>
                                    <View style={[pedidoStyles.listaProvTableHead, { borderBottomColor: colors.border }]}>
                                        {['NOMBRE', 'CATEGORÍA', 'UNIDAD', 'COSTO EST.', ''].map((col) => (
                                            <Text
                                                key={col || 'acc'}
                                                style={[
                                                    pedidoStyles.listaProvTh,
                                                    { color: colors.subText },
                                                    col === 'NOMBRE' && pedidoStyles.listaProdColNombre,
                                                    col === 'CATEGORÍA' && pedidoStyles.listaProdColCategoria,
                                                    col === 'UNIDAD' && pedidoStyles.listaProdColUnidad,
                                                    col === 'COSTO EST.' && pedidoStyles.listaProdColCosto,
                                                    col === '' && pedidoStyles.listaProdColAcc,
                                                ]}
                                            >
                                                {col}
                                            </Text>
                                        ))}
                                    </View>
                                    {productosPagina.map((p) => {
                                        const desc = descripcionProductoVisible(p);
                                        return (
                                            <View
                                                key={p.id}
                                                style={[pedidoStyles.listaProvRow, { borderBottomColor: colors.border }]}
                                            >
                                                <View style={pedidoStyles.listaProdColNombre}>
                                                    <Text
                                                        style={[
                                                            pedidoStyles.listaProvTd,
                                                            { color: colors.text, fontWeight: '600' },
                                                        ]}
                                                        numberOfLines={2}
                                                    >
                                                        {p.nombre}
                                                    </Text>
                                                    {desc ? (
                                                        <Text
                                                            style={{ color: colors.subText, fontSize: 11, marginTop: 2 }}
                                                            numberOfLines={1}
                                                        >
                                                            {desc}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <Text
                                                    style={[
                                                        pedidoStyles.listaProvTd,
                                                        pedidoStyles.listaProdColCategoria,
                                                        { color: colors.text },
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    {getTipoRequisicionLabel(p.tipoRequisicion)}
                                                </Text>
                                                <Text
                                                    style={[
                                                        pedidoStyles.listaProvTd,
                                                        pedidoStyles.listaProdColUnidad,
                                                        { color: colors.text },
                                                    ]}
                                                >
                                                    {p.unidadSugerida?.trim() || '—'}
                                                </Text>
                                                <Text
                                                    style={[
                                                        pedidoStyles.listaProvTd,
                                                        pedidoStyles.listaProdColCosto,
                                                        { color: colors.text, fontWeight: '600' },
                                                    ]}
                                                >
                                                    {p.costoEstandar != null && p.costoEstandar > 0
                                                        ? formatearMonedaCop(p.costoEstandar)
                                                        : '—'}
                                                </Text>
                                                <View style={pedidoStyles.listaProdColAcc}>
                                                    <TouchableOpacity
                                                        style={[
                                                            pedidoStyles.btnEditarCatalogo,
                                                            { borderColor: colors.primary },
                                                        ]}
                                                        onPress={() => iniciarEdicionProducto(p)}
                                                    >
                                                        <Text
                                                            style={[
                                                                pedidoStyles.btnEditarCatalogoText,
                                                                { color: colors.primary },
                                                            ]}
                                                        >
                                                            Editar
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[
                                                            pedidoStyles.btnEditarCatalogo,
                                                            pedidoStyles.btnEliminarCatalogo,
                                                            { borderColor: '#EF4444', marginTop: 6 },
                                                        ]}
                                                        onPress={() => setConfirmEliminarProducto(p)}
                                                    >
                                                        <Text style={[pedidoStyles.btnEditarCatalogoText, { color: '#EF4444' }]}>
                                                            Borrar
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </>
                            )}
                        </ScrollView>

                        {totalProductosFiltrado > 0 ? (
                            <View style={[pedidoStyles.catalogoPaginationBarLista, { borderTopColor: colors.border }]}>
                                <PaginacionBar
                                    paginaActual={paginaProductosActual}
                                    totalPaginas={totalPaginasProductos}
                                    indiceInicio={indiceProductosInicio}
                                    indiceFin={indiceProductosFin}
                                    totalItems={totalProductosFiltrado}
                                    onAnterior={() => setPaginaProductos((p) => Math.max(1, p - 1))}
                                    onSiguiente={() =>
                                        setPaginaProductos((p) => Math.min(totalPaginasProductos, p + 1))
                                    }
                                    colors={colors}
                                    compacto
                                    etiquetaItems={`producto${totalProductosFiltrado === 1 ? '' : 's'}`}
                                />
                            </View>
                        ) : null}

                        <View style={[pedidoStyles.modalFooter, pedidoStyles.modalFooterCatalogo, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[pedidoStyles.btnSecundario, { borderColor: colors.border }]}
                                onPress={cerrarListaProductos}
                            >
                                <Text style={[pedidoStyles.btnSecundarioText, { color: colors.text }]}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={modalFormProducto} transparent animationType="fade" onRequestClose={cerrarFormProducto}>
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            pedidoStyles.modalBoxCatalogo,
                            { backgroundColor: cardBg, borderColor: colors.border, maxWidth: 520 },
                        ]}
                    >
                        <ScrollView
                            style={[
                                pedidoStyles.modalCatalogoScroll,
                                { maxHeight: catalogoScrollMax },
                                Platform.OS === 'web' ? pedidoStyles.modalCatalogoScrollWeb : null,
                            ]}
                            contentContainerStyle={pedidoStyles.modalCatalogoScrollContent}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                            <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>
                                {productoEditandoId ? 'Editar producto' : 'Nuevo producto'}
                            </Text>
                            <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                                Actualice nombre, categoría, unidad y costo estimado del insumo.
                            </Text>

                            <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Nombre *</Text>
                            <TextInput
                                style={[
                                    pedidoStyles.catalogoInput,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="Nombre del producto"
                                placeholderTextColor={colors.subText}
                                value={prodNombre}
                                onChangeText={(t) => {
                                    setProdNombre(t);
                                    setErrorProductoForm(null);
                                }}
                            />

                            <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Descripción</Text>
                            <TextInput
                                style={[
                                    pedidoStyles.catalogoInput,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="Descripción opcional"
                                placeholderTextColor={colors.subText}
                                value={prodDescripcion}
                                onChangeText={(t) => {
                                    setProdDescripcion(t);
                                    setErrorProductoForm(null);
                                }}
                                multiline
                                numberOfLines={2}
                                textAlignVertical="top"
                            />

                            <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Categoría *</Text>
                            <View style={pedidoStyles.tipoProductoGrid}>
                                {TIPOS_REQUISICION.map((t) => {
                                    const activo = prodTipo === t.id;
                                    return (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[
                                                pedidoStyles.tipoProductoChip,
                                                { borderColor: activo ? t.accentColor : colors.border },
                                                activo && { backgroundColor: `${t.accentColor}22` },
                                            ]}
                                            onPress={() => {
                                                setProdTipo(t.id);
                                                setErrorProductoForm(null);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    pedidoStyles.tipoProductoChipText,
                                                    { color: activo ? t.accentColor : colors.text },
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Unidad sugerida</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={pedidoStyles.filtroChipsContent}
                                style={{ marginBottom: 8 }}
                            >
                                {unidadesMedida.map((u) => {
                                    const activo = prodUnidad === u;
                                    return (
                                        <TouchableOpacity
                                            key={u}
                                            style={[
                                                pedidoStyles.filtroChip,
                                                pedidoStyles.filtroChipPequeno,
                                                { borderColor: activo ? colors.primary : colors.border },
                                                activo && { backgroundColor: `${colors.primary}22` },
                                            ]}
                                            onPress={() => setProdUnidad(activo ? '' : u)}
                                        >
                                            <Text
                                                style={[
                                                    pedidoStyles.filtroChipText,
                                                    { color: activo ? colors.primary : colors.text, fontSize: 12 },
                                                ]}
                                            >
                                                {u}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            <TextInput
                                style={[
                                    pedidoStyles.catalogoInput,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="O escriba otra unidad"
                                placeholderTextColor={colors.subText}
                                value={prodUnidad}
                                onChangeText={setProdUnidad}
                            />

                            <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Costo estimado (COP)</Text>
                            <TextInput
                                style={[
                                    pedidoStyles.catalogoInput,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="Ej. 15000"
                                placeholderTextColor={colors.subText}
                                value={prodCosto}
                                onChangeText={(t) => {
                                    setProdCosto(t);
                                    setErrorProductoForm(null);
                                }}
                                keyboardType="numeric"
                            />

                            {errorProductoForm ? (
                                <View
                                    style={[
                                        pedidoStyles.errorBanner,
                                        {
                                            backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                                            borderColor: '#EF4444',
                                        },
                                    ]}
                                >
                                    <Text style={{ color: '#F87171', fontSize: 13 }}>{errorProductoForm}</Text>
                                </View>
                            ) : null}

                            <View style={pedidoStyles.catalogoFormActions}>
                                <TouchableOpacity
                                    style={[pedidoStyles.btnCatalogoAccion, guardandoProducto && { opacity: 0.6 }]}
                                    onPress={guardarProductoCatalogo}
                                    disabled={guardandoProducto}
                                >
                                    <Text style={pedidoStyles.btnCatalogoAccionText}>
                                        {guardandoProducto
                                            ? 'Guardando…'
                                            : productoEditandoId
                                              ? 'Guardar cambios'
                                              : 'Agregar al catálogo'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[pedidoStyles.btnCatalogoSecundario, { borderColor: colors.border }]}
                                    onPress={volverAListaProductos}
                                >
                                    <Text style={[pedidoStyles.btnCatalogoSecundarioText, { color: colors.text }]}>
                                        Volver al listado
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <AlmacenConfirmModal
                visible={!!confirmEliminarProducto}
                titulo="Eliminar producto"
                mensaje={
                    confirmEliminarProducto
                        ? `¿Eliminar «${confirmEliminarProducto.nombre}» del catálogo? Esta acción no se puede deshacer.`
                        : ''
                }
                textoConfirmar={eliminandoProducto ? 'Eliminando…' : 'Sí, eliminar'}
                textoCancelar="Cancelar"
                icono="!"
                colors={colors}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                onConfirmar={confirmarEliminarProducto}
                onCancelar={() => !eliminandoProducto && setConfirmEliminarProducto(null)}
                onCerrar={() => !eliminandoProducto && setConfirmEliminarProducto(null)}
            />

            <AlmacenConfirmModal
                visible={!!confirmEliminarProveedor}
                titulo="Eliminar proveedor"
                mensaje={
                    confirmEliminarProveedor
                        ? `¿Eliminar «${confirmEliminarProveedor.nombre}» del catálogo? Si está en pedidos activos, no se podrá borrar hasta desvincularlo.`
                        : ''
                }
                textoConfirmar={eliminandoProveedor ? 'Eliminando…' : 'Sí, eliminar'}
                textoCancelar="Cancelar"
                icono="!"
                colors={colors}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                onConfirmar={confirmarEliminarProveedor}
                onCancelar={() => !eliminandoProveedor && setConfirmEliminarProveedor(null)}
                onCerrar={() => !eliminandoProveedor && setConfirmEliminarProveedor(null)}
            />

            <Modal
                visible={!!modalOcProveedorId}
                transparent
                animationType="fade"
                onRequestClose={() => !cargandoOcPicker && setModalOcProveedorId(null)}
            >
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            {
                                backgroundColor: cardBg,
                                borderColor: colors.border,
                                maxWidth: 520,
                                width: '92%',
                            },
                        ]}
                    >
                        <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>
                            Adjuntar a OC existente
                        </Text>
                        <Text style={{ color: colors.subText, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                            Solo se listan órdenes de compra del proveedor{' '}
                            <Text style={{ fontWeight: '700', color: colors.text }}>
                                {proveedores.find((p) => p.id === modalOcProveedorId)?.nombre?.trim() || '—'}
                            </Text>
                            . El PDF incluirá todos los productos de esa OC.
                        </Text>
                        {cargandoOcPicker ? (
                            <Text style={{ color: colors.subText, paddingVertical: 16 }}>Cargando…</Text>
                        ) : ordenesCompraPicker.length === 0 ? (
                            <Text style={{ color: colors.subText, paddingVertical: 12, lineHeight: 20 }}>
                                No hay OC emitidas para este proveedor. Se creará una nueva al guardar.
                            </Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 280 }}>
                                {ordenesCompraPicker.map((oc) => (
                                    <TouchableOpacity
                                        key={oc.id}
                                        style={[
                                            pedidoStyles.ocPickerItem,
                                            {
                                                borderColor: colors.border,
                                                backgroundColor: isDarkMode ? '#0F172A' : inputBg,
                                            },
                                        ]}
                                        onPress={() =>
                                            modalOcProveedorId &&
                                            seleccionarOcParaProveedor(modalOcProveedorId, oc)
                                        }
                                    >
                                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>
                                            OC {formatearConsecutivoOrdenCompra(oc.numeroOrdenCompra)}
                                        </Text>
                                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }}>
                                            {oc.lineas.length} producto(s) · Pedido {formatFechaDisplay(oc.fechaPedido)}
                                        </Text>
                                        <Text
                                            style={{ color: colors.text, fontSize: 12, marginTop: 4 }}
                                            numberOfLines={2}
                                        >
                                            {oc.lineas
                                                .map((l) => l.requisicionCodigo)
                                                .filter(Boolean)
                                                .join(', ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                        <TouchableOpacity
                            style={[pedidoStyles.btnSecundario, { borderColor: colors.border, marginTop: 14 }]}
                            onPress={() => setModalOcProveedorId(null)}
                            disabled={cargandoOcPicker}
                        >
                            <Text style={{ color: colors.subText, fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={!!modalFormaPago}
                transparent
                animationType="fade"
                onRequestClose={() => !marcandoPagadoKey && setModalFormaPago(null)}
            >
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            { backgroundColor: cardBg, borderColor: colors.border, maxWidth: 400 },
                        ]}
                    >
                        <Text style={[pedidoStyles.modalTitle, { color: colors.text, textAlign: 'center' }]}>
                            Registrar pago
                        </Text>
                        <Text
                            style={{
                                color: colors.subText,
                                fontSize: 14,
                                lineHeight: 21,
                                textAlign: 'center',
                                marginBottom: 8,
                            }}
                        >
                            ¿Cómo se realizó el pago a{' '}
                            <Text style={{ fontWeight: '700', color: colors.text }}>
                                {modalFormaPago?.prov.nombre ?? 'este proveedor'}
                            </Text>
                            ?
                        </Text>
                        <View style={pedidoStyles.formaPagoOpciones}>
                            <TouchableOpacity
                                style={[
                                    pedidoStyles.formaPagoBtn,
                                    {
                                        borderColor: colors.primary,
                                        backgroundColor: isDarkMode
                                            ? 'rgba(59, 130, 246, 0.15)'
                                            : 'rgba(59, 130, 246, 0.08)',
                                    },
                                    marcandoPagadoKey && { opacity: 0.6 },
                                ]}
                                onPress={() => confirmarFormaPago('credito')}
                                disabled={!!marcandoPagadoKey}
                            >
                                <Text style={[pedidoStyles.formaPagoBtnText, { color: colors.primary }]}>
                                    {marcandoPagadoKey ? '…' : 'Crédito'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    pedidoStyles.formaPagoBtn,
                                    {
                                        borderColor: '#059669',
                                        backgroundColor: isDarkMode
                                            ? 'rgba(5, 150, 105, 0.15)'
                                            : 'rgba(5, 150, 105, 0.08)',
                                    },
                                    marcandoPagadoKey && { opacity: 0.6 },
                                ]}
                                onPress={() => confirmarFormaPago('efectivo')}
                                disabled={!!marcandoPagadoKey}
                            >
                                <Text style={[pedidoStyles.formaPagoBtnText, { color: '#059669' }]}>
                                    {marcandoPagadoKey ? '…' : 'Efectivo'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[
                                pedidoStyles.btnSecundario,
                                { borderColor: colors.border, marginTop: 12 },
                                marcandoPagadoKey && { opacity: 0.6 },
                            ]}
                            onPress={() => setModalFormaPago(null)}
                            disabled={!!marcandoPagadoKey}
                        >
                            <Text style={{ color: colors.text, fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={modalConsolidar}
                transparent
                animationType="fade"
                onRequestClose={cerrarModalConsolidar}
            >
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            {
                                backgroundColor: cardBg,
                                borderColor: colors.border,
                                maxWidth: modalPedidoAncho,
                                width: '100%',
                            },
                        ]}
                    >
                        <ScrollView
                            style={{ maxHeight: modalPedidoScrollMax }}
                            contentContainerStyle={pedidoStyles.modalPedidoScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>
                                Pedido consolidado — una orden de compra
                            </Text>
                            <Text style={{ color: colors.subText, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                                Se registrará un solo pedido al proveedor con {lineasConsolidar.length} productos de
                                distintas requisiciones.
                            </Text>

                            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                                <View style={{ flex: 1, minWidth: 200 }}>
                                    <Text style={[pedidoStyles.label, { color: colors.subText, marginBottom: 8 }]}>
                                        Fecha pedido *
                                    </Text>
                                    <AlmacenCampoFecha
                                        value={fechaPedidoConsolidar}
                                        onChange={setFechaPedidoConsolidar}
                                        colors={colors}
                                        isDarkMode={isDarkMode}
                                        inputBg={inputBg}
                                    />
                                </View>
                                <View style={{ flex: 1, minWidth: 200 }}>
                                    <Text style={[pedidoStyles.label, { color: colors.subText, marginBottom: 8 }]}>
                                        Entrega estimada *
                                    </Text>
                                    <AlmacenCampoFecha
                                        value={fechaEntregaConsolidar}
                                        onChange={setFechaEntregaConsolidar}
                                        colors={colors}
                                        isDarkMode={isDarkMode}
                                        inputBg={inputBg}
                                    />
                                </View>
                            </View>

                            <Text style={[pedidoStyles.label, { color: colors.subText, marginTop: 8 }]}>
                                Proveedor *
                            </Text>
                            <TextInput
                                style={[
                                    pedidoStyles.input,
                                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                                ]}
                                placeholder="Nombre del proveedor"
                                placeholderTextColor={colors.subText}
                                value={proveedorConsolidar.nombre}
                                onChangeText={(t) =>
                                    setProveedorConsolidar((p) => ({ ...p, nombre: t, catalogoId: undefined }))
                                }
                            />
                            <TouchableOpacity
                                style={{ marginTop: 8, marginBottom: 8 }}
                                onPress={() => setPickerConsolidarProvAbierto((v) => !v)}
                            >
                                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                                    {pickerConsolidarProvAbierto ? '▲ Ocultar catálogo' : '▼ Elegir del catálogo'}
                                </Text>
                            </TouchableOpacity>
                            {pickerConsolidarProvAbierto ? (
                                <View
                                    style={[
                                        pedidoStyles.provPickerPanel,
                                        { borderColor: colors.border, backgroundColor: inputBg },
                                    ]}
                                >
                                    <TextInput
                                        style={[
                                            pedidoStyles.input,
                                            {
                                                backgroundColor: cardBg,
                                                borderColor: colors.border,
                                                color: colors.text,
                                                marginBottom: 8,
                                            },
                                        ]}
                                        placeholder="Buscar proveedor…"
                                        placeholderTextColor={colors.subText}
                                        value={busquedaConsolidarProv}
                                        onChangeText={(t) => {
                                            setBusquedaConsolidarProv(t);
                                            setPaginaConsolidarProv(1);
                                        }}
                                    />
                                    {filtrarProveedorCatalogo(catalogoProveedores, busquedaConsolidarProv)
                                        .slice(0, 8)
                                        .map((cat) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={pedidoStyles.provPickerItem}
                                                onPress={() => {
                                                    setProveedorConsolidar((p) => ({
                                                        ...p,
                                                        ...datosProveedorDesdeCatalogo(cat),
                                                    }));
                                                    setPickerConsolidarProvAbierto(false);
                                                }}
                                            >
                                                <Text style={{ color: colors.text, fontWeight: '600' }}>
                                                    {cat.nombre}
                                                </Text>
                                                <Text style={{ color: colors.subText, fontSize: 12 }}>
                                                    {resumenProveedorContacto(cat)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                </View>
                            ) : null}

                            <Text style={[pedidoStyles.label, { color: colors.subText, marginTop: 16 }]}>
                                Productos incluidos
                            </Text>
                            {lineasConsolidar.map((l) => (
                                <View
                                    key={l.requisicionId}
                                    style={[
                                        pedidoStyles.provItem,
                                        {
                                            borderColor: colors.border,
                                            backgroundColor: inputBg,
                                            padding: 12,
                                            marginBottom: 10,
                                        },
                                    ]}
                                >
                                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                                        {l.codigo} · {l.producto}
                                    </Text>
                                    <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 8 }}>
                                        Cantidad: {l.cantidad} {l.unidad}
                                    </Text>
                                    <Text style={[pedidoStyles.label, { color: colors.subText }]}>Precio unitario *</Text>
                                    <TextInput
                                        style={[
                                            pedidoStyles.input,
                                            {
                                                backgroundColor: cardBg,
                                                borderColor: colors.border,
                                                color: colors.text,
                                                maxWidth: 200,
                                            },
                                        ]}
                                        placeholder="0"
                                        placeholderTextColor={colors.subText}
                                        value={l.precioUnitarioTexto}
                                        onChangeText={(t) => {
                                            const fmt = formatearPrecioCopMientrasEscribe(t);
                                            const n = parsePrecioCopInput(fmt);
                                            setLineasConsolidar((prev) =>
                                                prev.map((x) =>
                                                    x.requisicionId === l.requisicionId
                                                        ? {
                                                              ...x,
                                                              precioUnitarioTexto: fmt,
                                                              precioUnitario: n > 0 ? n : undefined,
                                                          }
                                                        : x
                                                )
                                            );
                                        }}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            ))}

                            {errorConsolidar ? (
                                <Text style={{ color: '#EF4444', marginTop: 8, fontSize: 13 }}>{errorConsolidar}</Text>
                            ) : null}

                            <View
                                style={[
                                    pedidoStyles.modalFooter,
                                    { borderTopColor: colors.border, marginTop: 16 },
                                ]}
                            >
                                <TouchableOpacity
                                    style={[pedidoStyles.btnSecundario, { borderColor: colors.border }]}
                                    onPress={cerrarModalConsolidar}
                                    disabled={guardandoConsolidar}
                                >
                                    <Text style={{ color: colors.text, fontWeight: '600' }}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        pedidoStyles.btnPrimario,
                                        { backgroundColor: colors.primary },
                                        guardandoConsolidar && { opacity: 0.6 },
                                    ]}
                                    onPress={() => void guardarPedidoConsolidado()}
                                    disabled={guardandoConsolidar}
                                >
                                    <Text style={pedidoStyles.btnPrimarioText}>
                                        {guardandoConsolidar ? 'Guardando…' : 'Registrar y generar OC'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={modalCatalogo} transparent animationType="fade" onRequestClose={cerrarModalCatalogo}>
                <View style={pedidoStyles.modalOverlay}>
                    <View
                        style={[
                            pedidoStyles.modalBox,
                            pedidoStyles.modalBoxCatalogo,
                            { backgroundColor: cardBg, borderColor: colors.border, maxWidth: 520 },
                        ]}
                    >
                        <ScrollView
                            style={[
                                pedidoStyles.modalCatalogoScroll,
                                { maxHeight: catalogoScrollMax },
                                Platform.OS === 'web' ? pedidoStyles.modalCatalogoScrollWeb : null,
                            ]}
                            contentContainerStyle={pedidoStyles.modalCatalogoScrollContent}
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                        <Text style={[pedidoStyles.modalTitle, { color: colors.text }]}>Catálogo de proveedores</Text>
                        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                            Registre o edite proveedores con NIT y teléfono. También puede importar un Excel con una
                            columna de nombres (encabezado «Compañía», «Proveedor» o «Nombre»).
                        </Text>
                        <TouchableOpacity
                            style={[
                                pedidoStyles.btnImportarExcel,
                                { borderColor: colors.primary },
                                (importandoExcel || guardando) && { opacity: 0.6 },
                            ]}
                            onPress={handleImportarProveedoresExcel}
                            disabled={importandoExcel || guardando}
                        >
                            <Text style={[pedidoStyles.btnImportarExcelText, { color: colors.primary }]}>
                                {importandoExcel ? 'Importando Excel…' : 'Importar desde Excel'}
                            </Text>
                        </TouchableOpacity>
                        {catalogoEditandoId ? (
                            <View
                                style={[
                                    pedidoStyles.editandoBanner,
                                    {
                                        backgroundColor: isDarkMode
                                            ? 'rgba(59, 130, 246, 0.2)'
                                            : 'rgba(59, 130, 246, 0.1)',
                                        borderColor: colors.primary,
                                    },
                                ]}
                            >
                                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                                    Editando proveedor — guarde los cambios o cancele
                                </Text>
                            </View>
                        ) : null}

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Nombre *</Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="Razón social o nombre comercial"
                            placeholderTextColor={colors.subText}
                            value={catNombre}
                            onChangeText={(t) => {
                                setCatNombre(t);
                                setErrorCatalogo(null);
                            }}
                        />

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Correo</Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="correo@empresa.com"
                            placeholderTextColor={colors.subText}
                            value={catCorreo}
                            onChangeText={(t) => {
                                setCatCorreo(t);
                                setErrorCatalogo(null);
                            }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Teléfono de trabajo</Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="Ej. 601 234 5678"
                            placeholderTextColor={colors.subText}
                            value={catTelefonoTrabajo}
                            onChangeText={(t) => {
                                setCatTelefonoTrabajo(t);
                                setErrorCatalogo(null);
                            }}
                            keyboardType="phone-pad"
                        />

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Teléfono móvil</Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="Ej. 300 123 4567"
                            placeholderTextColor={colors.subText}
                            value={catTelefonoMovil}
                            onChangeText={(t) => {
                                setCatTelefonoMovil(t);
                                setErrorCatalogo(null);
                            }}
                            keyboardType="phone-pad"
                        />

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>NIT</Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="Ej. 900.123.456-1"
                            placeholderTextColor={colors.subText}
                            value={catNit}
                            onChangeText={(t) => {
                                setCatNit(t);
                                setErrorCatalogo(null);
                            }}
                        />

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Dirección</Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="Dirección del proveedor"
                            placeholderTextColor={colors.subText}
                            value={catDireccion}
                            onChangeText={(t) => {
                                setCatDireccion(t);
                                setErrorCatalogo(null);
                            }}
                            multiline
                            numberOfLines={2}
                            textAlignVertical="top"
                        />

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText }]}>Categoría</Text>
                        <GruposCategoriaProveedorChips
                            categoriaActiva={catCategoria}
                            colors={colors}
                            onSeleccionar={(id) => {
                                setCatCategoria(id);
                                setErrorCatalogo(null);
                            }}
                        />

                        {errorCatalogo ? (
                            <View
                                style={[
                                    pedidoStyles.errorBanner,
                                    {
                                        backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                                        borderColor: '#EF4444',
                                    },
                                ]}
                            >
                                <Text style={{ color: '#F87171', fontSize: 13 }}>{errorCatalogo}</Text>
                            </View>
                        ) : null}

                        <View style={pedidoStyles.catalogoFormActions}>
                            <TouchableOpacity
                                style={[pedidoStyles.btnCatalogoAccion, guardando && { opacity: 0.6 }]}
                                onPress={guardarProveedorCatalogo}
                                disabled={guardando}
                            >
                                <Text style={pedidoStyles.btnCatalogoAccionText}>
                                    {guardando
                                        ? 'Guardando…'
                                        : catalogoEditandoId
                                          ? 'Guardar cambios'
                                          : 'Agregar al catálogo'}
                                </Text>
                            </TouchableOpacity>
                            {catalogoEditandoId ? (
                                <TouchableOpacity
                                    style={[pedidoStyles.btnCatalogoSecundario, { borderColor: colors.border }]}
                                    onPress={limpiarFormularioCatalogo}
                                >
                                    <Text style={[pedidoStyles.btnCatalogoSecundarioText, { color: colors.text }]}>
                                        Cancelar edición
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <Text style={[pedidoStyles.catalogoLabel, { color: colors.subText, marginTop: 20 }]}>
                            Buscar proveedor
                        </Text>
                        <TextInput
                            style={[
                                pedidoStyles.catalogoInput,
                                { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                            ]}
                            placeholder="Nombre, NIT o teléfono…"
                            placeholderTextColor={colors.subText}
                            value={busquedaCatalogo}
                            onChangeText={(t) => {
                                setBusquedaCatalogo(t);
                                setPaginaCatalogo(1);
                            }}
                        />

                        <Text style={[pedidoStyles.label, { color: colors.subText, marginTop: 14 }]}>
                            Proveedores registrados (
                            {busquedaCatalogo.trim()
                                ? `${proveedoresCatalogoFiltrados.length} de ${catalogoProveedores.length}`
                                : catalogoProveedores.length}
                            )
                            {totalCatalogoFiltrado > 0
                                ? ` · Mostrando ${indiceCatalogoInicio + 1}–${indiceCatalogoFin}`
                                : ''}
                        </Text>
                        <View style={pedidoStyles.catalogoLista}>
                            {proveedoresCatalogoFiltrados.length === 0 ? (
                                <Text style={{ color: colors.subText, fontSize: 14, paddingVertical: 12 }}>
                                    {busquedaCatalogo.trim()
                                        ? 'No hay proveedores con ese nombre.'
                                        : 'No hay proveedores en el catálogo.'}
                                </Text>
                            ) : (
                            proveedoresCatalogoPagina.map((c) => {
                                    const editando = catalogoEditandoId === c.id;
                                    return (
                                        <View
                                            key={c.id}
                                            style={[
                                                pedidoStyles.catalogoItem,
                                                {
                                                    borderBottomColor: colors.border,
                                                    backgroundColor: editando
                                                        ? isDarkMode
                                                            ? 'rgba(59, 130, 246, 0.15)'
                                                            : 'rgba(59, 130, 246, 0.08)'
                                                        : 'transparent',
                                                },
                                            ]}
                                        >
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={{ color: colors.text, fontWeight: '600' }}>
                                                    {c.nombre}
                                                </Text>
                                                <Text style={{ color: colors.subText, fontSize: 12 }} numberOfLines={2}>
                                                    {resumenProveedorCatalogo(c)}
                                                </Text>
                                            </View>
                                            <View style={pedidoStyles.catalogoItemAcciones}>
                                            <TouchableOpacity
                                                style={[
                                                    pedidoStyles.btnEditarCatalogo,
                                                    { borderColor: colors.primary },
                                                ]}
                                                onPress={() => iniciarEdicionCatalogo(c)}
                                            >
                                                <Text
                                                    style={[
                                                        pedidoStyles.btnEditarCatalogoText,
                                                        { color: colors.primary },
                                                    ]}
                                                >
                                                    Editar
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    pedidoStyles.btnEditarCatalogo,
                                                    pedidoStyles.btnEliminarCatalogo,
                                                    { borderColor: '#EF4444', marginTop: 6 },
                                                ]}
                                                onPress={() => setConfirmEliminarProveedor(c)}
                                            >
                                                <Text style={[pedidoStyles.btnEditarCatalogoText, { color: '#EF4444' }]}>
                                                    Borrar
                                                </Text>
                                            </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                        {totalCatalogoFiltrado > CATALOGO_POR_PAGINA ? (
                            <View style={[pedidoStyles.catalogoPaginationBar, { borderTopColor: colors.border }]}>
                                <Text style={[pedidoStyles.catalogoPaginationInfo, { color: colors.subText }]}>
                                    Página {paginaCatalogoActual} de {totalPaginasCatalogo}
                                </Text>
                                <View style={pedidoStyles.paginationControls}>
                                    <TouchableOpacity
                                        style={[
                                            pedidoStyles.catalogoPaginationBtn,
                                            { borderColor: colors.border },
                                            paginaCatalogoActual <= 1 && pedidoStyles.paginationBtnDisabled,
                                        ]}
                                        onPress={() => setPaginaCatalogo((p) => Math.max(1, p - 1))}
                                        disabled={paginaCatalogoActual <= 1}
                                    >
                                        <Text
                                            style={[
                                                pedidoStyles.btnSecundarioText,
                                                {
                                                    color:
                                                        paginaCatalogoActual <= 1 ? colors.subText : colors.text,
                                                },
                                            ]}
                                        >
                                            ← Anterior
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            pedidoStyles.catalogoPaginationBtn,
                                            pedidoStyles.paginationBtnPrimary,
                                            paginaCatalogoActual >= totalPaginasCatalogo &&
                                                pedidoStyles.paginationBtnDisabled,
                                        ]}
                                        onPress={() =>
                                            setPaginaCatalogo((p) => Math.min(totalPaginasCatalogo, p + 1))
                                        }
                                        disabled={paginaCatalogoActual >= totalPaginasCatalogo}
                                    >
                                        <Text style={pedidoStyles.paginationBtnTextPrimary}>Siguiente →</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}
                        </ScrollView>

                        <View style={[pedidoStyles.modalFooter, pedidoStyles.modalFooterCatalogo, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[pedidoStyles.btnSecundario, { borderColor: colors.border }]}
                                onPress={cerrarModalCatalogo}
                            >
                                <Text style={[pedidoStyles.btnSecundarioText, { color: colors.text }]}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const pedidoStyles = StyleSheet.create({
    card: { borderRadius: 12, borderWidth: 1, padding: 24 },
    cardPedidos: { paddingBottom: 0, overflow: 'hidden' },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
        gap: 12,
    },
    titulo: { fontSize: 20, fontWeight: '600' },
    subtitulo: { fontSize: 14, marginTop: 4, fontWeight: '500' },
    catalogoTopActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    btnCatalogoTop: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        alignSelf: 'flex-start',
        justifyContent: 'center',
    },
    btnImportarExcelTop: {},
    btnCatalogoTopText: { color: '#3B82F6', fontWeight: '700', fontSize: 15 },
    btnImportarExcel: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginBottom: 16,
    },
    btnImportarExcelText: { fontWeight: '600', fontSize: 13 },
    ayuda: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
    consolidarBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    btnConsolidar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    btnConsolidarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    vacio: { textAlign: 'center', paddingVertical: 40, fontSize: 15 },
    tableWrap: { width: '100%' },
    tableWrapNarrow: { minWidth: 1100, width: '100%' },
    sheetTabsBar: {
        marginTop: 20,
        marginHorizontal: -24,
        marginBottom: 0,
        borderTopWidth: 1,
        paddingTop: 2,
    },
    sheetTabsScroll: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 4,
        gap: 2,
    },
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
    sheetTabBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
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
    paginationControls: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    paginationBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
    },
    paginationBtnPrimary: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    paginationBtnDisabled: { opacity: 0.45 },
    paginationBtnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, marginBottom: 4 },
    th: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingRight: 6 },
    tableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
    td: { fontSize: 14 },
    expandBtn: { width: 36, paddingTop: 2 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    proveedorPagoLista: { gap: 8 },
    proveedorPagoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    btnMarcarPago: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#64748B',
    },
    btnMarcarPagoCompacto: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    btnMarcarPagoText: { color: '#475569', fontSize: 12, fontWeight: '600' },
    badgePagado: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#6EE7B7',
    },
    badgePagadoCompacto: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgePagadoText: { color: '#047857', fontSize: 12, fontWeight: '700' },
    formaPagoOpciones: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginTop: 12,
    },
    formaPagoBtn: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    formaPagoBtnText: {
        fontSize: 15,
        fontWeight: '700',
    },
    ocAdjuntoCard: {
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    ocAdjuntoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    btnOcQuitar: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    btnOcAdjuntar: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    ocPickerItem: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
    },
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
        alignSelf: 'flex-start',
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnSecundarioText: { fontSize: 15, fontWeight: '600' },
    btnTablaText: { fontSize: 14, fontWeight: '600' },
    btnEditarCatalogo: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 40,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnEditarCatalogoText: { fontSize: 14, fontWeight: '600' },
    detallePanel: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        marginLeft: 36,
    },
    detalleTitulo: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    detalleSubtitulo: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
    detalleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    detalleItem: { width: '30%', minWidth: 180, marginBottom: 8 },
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
    proveedorColumnaTituloWrap: {
        width: '100%',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(148,163,184,0.4)',
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
    btnOrdenCompra: {
        marginTop: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    btnOrdenCompraText: {
        fontSize: 12,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalBox: {
        width: '100%',
        maxWidth: 520,
        maxHeight: '92%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
    },
    modalBoxPedido: {
        padding: 0,
        overflow: 'hidden',
        flexDirection: 'column',
        borderRadius: 14,
    },
    modalPedidoHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        paddingTop: 22,
        paddingBottom: 18,
        borderBottomWidth: 1,
    },
    modalPedidoMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        flexWrap: 'wrap',
    },
    modalPedidoCodigo: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    modalCerrarBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalPedidoScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    modalPedidoScrollContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 16,
    },
    modalPedidoFechaCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
    },
    modalPedidoPrecioRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-start',
    },
    modalPedidoPrecioTotal: {
        fontSize: 22,
        fontWeight: '700',
    },
    modalPedidoTotalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        gap: 12,
    },
    modalPedidoSeccionHead: {
        marginBottom: 14,
        gap: 6,
    },
    modalPedidoSeccionTitulo: {
        fontSize: 16,
        fontWeight: '700',
    },
    modalPedidoError: {
        marginHorizontal: 24,
        marginBottom: 0,
    },
    modalFooterPedido: {
        marginTop: 0,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
        justifyContent: 'flex-end',
    },
    modalBoxListaProveedores: {
        padding: 0,
        overflow: 'hidden',
        maxWidth: 920,
        width: '100%',
    },
    listaProvHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    listaProvToolbar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    listaProvBusqueda: {
        flex: 1,
        minWidth: 220,
        marginBottom: 0,
    },
    listaProvScroll: {
        paddingHorizontal: 20,
    },
    listaProvScrollContent: {
        paddingBottom: 8,
    },
    listaProvTableHead: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        marginBottom: 4,
    },
    listaProvTh: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        paddingRight: 8,
    },
    listaProvRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    listaProvTd: {
        fontSize: 13,
        paddingRight: 8,
    },
    listaProvColNombre: { flex: 2.2, minWidth: 160 },
    listaProvColNit: { flex: 1, minWidth: 90 },
    listaProvColTel: { flex: 1, minWidth: 100 },
    listaProvColCorreo: { flex: 1.2, minWidth: 120 },
    listaProvColAcc: { width: 88, alignItems: 'flex-end' },
    listaProdColNombre: { flex: 2.2, minWidth: 160 },
    listaProdColCategoria: { flex: 1.3, minWidth: 110 },
    listaProdColUnidad: { flex: 0.7, minWidth: 64 },
    listaProdColCosto: { flex: 0.9, minWidth: 90, textAlign: 'right' },
    listaProdColAcc: { width: 76, alignItems: 'flex-end' },
    btnNuevoCatalogo: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    btnNuevoCatalogoText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    btnEliminarCatalogo: { paddingVertical: 4, paddingHorizontal: 8 },
    catalogoItemAcciones: { alignItems: 'flex-end', justifyContent: 'center' },
    btnQuitarProveedor: {
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderLeftWidth: 1,
    },
    btnQuitarProveedorText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
    filtroChipsScroll: { maxHeight: 44, marginBottom: 4 },
    filtroChipsScrollUnidad: { maxHeight: 40, marginBottom: 8 },
    filtroChipsContent: {
        paddingHorizontal: 20,
        gap: 8,
        alignItems: 'center',
        flexDirection: 'row',
    },
    filtroChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    filtroChipPequeno: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
    },
    filtroChipText: { fontSize: 13, fontWeight: '600' },
    catalogoChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    checkboxIcon: { fontSize: 18, width: 22 },
    catalogoPaginationBarLista: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 4,
    },
    tipoProductoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    tipoProductoChip: {
        width: '48%',
        minWidth: 140,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    tipoProductoChipText: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
    modalBoxCatalogo: {
        padding: 0,
        overflow: 'hidden',
        flexDirection: 'column',
    },
    modalCatalogoScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    modalCatalogoScrollWeb: {
        overflowY: 'auto',
        overflowX: 'hidden',
    },
    modalCatalogoScrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    modalFooterCatalogo: {
        marginTop: 0,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
    },
    catalogoLista: {
        marginBottom: 4,
    },
    catalogoPaginationBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingTop: 12,
        marginTop: 8,
        marginBottom: 8,
        borderTopWidth: 1,
    },
    catalogoPaginationInfo: { fontSize: 13, flex: 1, minWidth: 140 },
    catalogoPaginationBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    modalScroll: { maxHeight: 420, flexGrow: 0 },
    modalScrollContent: { paddingBottom: 8 },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
    input: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 15,
    },
    fechaBtn: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        justifyContent: 'center',
    },
    provHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    provLista: { gap: 8 },
    provItem: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    provItemHeader: { flexDirection: 'row', alignItems: 'stretch' },
    provResumen: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        gap: 8,
    },
    provDetalle: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingBottom: 14,
        paddingTop: 12,
    },
    provDetalleGrid: {
        gap: 16,
    },
    provDetalleGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    provDetalleGridNarrow: {
        flexDirection: 'column',
    },
    provPickerPanel: {
        flex: 1.15,
        minWidth: 0,
        gap: 10,
    },
    provPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    provPickerTitulo: {
        fontSize: 14,
        fontWeight: '700',
    },
    provPickerBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    provPickerBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    provPickerList: {
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
        minHeight: 200,
    },
    provPickerListScrollWeb: {
        overflowY: 'auto',
    },
    provPickerItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    provFormPanel: {
        flex: 1,
        minWidth: 0,
        gap: 8,
    },
    provDetalleFila: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    btnAgregarProv: {
        marginTop: 4,
        paddingVertical: 16,
        paddingHorizontal: 16,
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputCompact: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 15,
    },
    labelMini: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
    sugerenciasBox: {
        borderWidth: 1,
        borderRadius: 8,
        marginTop: 4,
        maxHeight: 220,
        overflow: 'hidden',
    },
    sugerenciasScroll: {
        maxHeight: 200,
    },
    sinResultados: {
        padding: 12,
        fontSize: 12,
        fontStyle: 'italic',
    },
    sugerenciaItem: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    catalogoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    catalogoLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 4,
    },
    catalogoInput: {
        height: 52,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 18,
    },
    catalogoFormActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        width: '100%',
    },
    btnCatalogoAccion: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 8,
        alignSelf: 'center',
    },
    btnCatalogoAccionText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    btnCatalogoSecundario: {
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: 'center',
    },
    btnCatalogoSecundarioText: {
        fontSize: 13,
        fontWeight: '600',
    },
    editandoBanner: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
    },
    errorBanner: {
        marginTop: 10,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    provRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    cantidadConUnidad: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        minWidth: 130,
        maxWidth: 160,
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingLeft: 14,
        paddingRight: 14,
    },
    cantidadInput: {
        flex: 1,
        minWidth: 48,
        fontSize: 15,
        paddingVertical: 0,
    },
    unidadProveedor: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
        flexShrink: 0,
    },
    quitarProv: { marginLeft: 8, padding: 8 },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
});
