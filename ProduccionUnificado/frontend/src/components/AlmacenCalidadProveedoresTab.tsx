import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
    type Requisicion,
    type EvaluacionProveedorPedido,
    TIPOS_REQUISICION,
    type TipoRequisicionId,
    formatFechaDisplay,
    esRequisicionEnCalidadProveedores,
    getEvaluacionesProveedorRequisicion,
    OPCIONES_FILTRO_CALIDAD_PROVEEDOR,
} from '../data/almacenMockData';

const FILAS_POR_PAGINA = 10;

type FiltroCalidadValor = (typeof OPCIONES_FILTRO_CALIDAD_PROVEEDOR)[number]['id'];

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
    inputBackground: string;
};

interface AlmacenCalidadProveedoresTabProps {
    requisiciones: Requisicion[];
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
    isWide: boolean;
}

type FilaCalidad = EvaluacionProveedorPedido & { tipoRequisicion: TipoRequisicionId };

function cumpleFiltroCalidad(fila: FilaCalidad, filtro: FiltroCalidadValor): boolean {
    if (filtro === 'todos') return true;
    if (filtro === 'a_tiempo') return fila.entregoATiempo === true;
    if (filtro === 'retraso') return fila.entregoATiempo === false;
    if (filtro === 'parciales') return fila.numEnvios > 1;
    return true;
}

function badgePuntualidad(
    ev: EvaluacionProveedorPedido,
    colors: ThemeColors
): { label: string; bg: string; border: string; text: string } {
    if (ev.entregoATiempo === null) {
        return {
            label: 'Sin fecha',
            bg: 'rgba(148, 163, 184, 0.2)',
            border: '#94A3B8',
            text: colors.subText,
        };
    }
    if (ev.entregoATiempo) {
        const dias = ev.diasRetrasoUltimaVsRequerida ?? 0;
        const label =
            dias < 0
                ? `A tiempo (${Math.abs(dias)} d antes)`
                : 'A tiempo (mismo día)';
        return {
            label,
            bg: 'rgba(16, 185, 129, 0.15)',
            border: '#10B981',
            text: '#34D399',
        };
    }
    const dias = ev.diasRetrasoUltimaVsRequerida ?? 0;
    return {
        label: `Retraso ${dias} d`,
        bg: 'rgba(239, 68, 68, 0.15)',
        border: '#EF4444',
        text: '#F87171',
    };
}

function textoDiasEntreEnvios(ev: EvaluacionProveedorPedido): string {
    if (ev.numEnvios <= 1) return '—';
    if (ev.diasEntreParciales === null) return '—';
    return `${ev.diasEntreParciales} d`;
}

export default function AlmacenCalidadProveedoresTab({
    requisiciones,
    colors,
    isDarkMode,
    cardBg,
    isWide,
}: AlmacenCalidadProveedoresTabProps) {
    const [tipoActivo, setTipoActivo] = useState<TipoRequisicionId>('consumo_diario');
    const [filtroCalidad, setFiltroCalidad] = useState<FiltroCalidadValor>('todos');
    const [pagina, setPagina] = useState(1);
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

    const elegibles = useMemo(
        () => requisiciones.filter(esRequisicionEnCalidadProveedores),
        [requisiciones]
    );

    const todasLasFilas = useMemo((): FilaCalidad[] => {
        const filas: FilaCalidad[] = [];
        elegibles.forEach((req) => {
            getEvaluacionesProveedorRequisicion(req).forEach((ev) => {
                filas.push({ ...ev, tipoRequisicion: req.tipoRequisicion });
            });
        });
        return filas.sort((a, b) => b.codigoRequisicion.localeCompare(a.codigoRequisicion));
    }, [elegibles]);

    const conteoPorTipo = useMemo(() => {
        const map: Record<TipoRequisicionId, number> = {
            consumo_diario: 0,
            cajas_empaque: 0,
            gomas_adhesivos: 0,
            pantone: 0,
        };
        todasLasFilas.forEach((f) => {
            map[f.tipoRequisicion] = (map[f.tipoRequisicion] ?? 0) + 1;
        });
        return map;
    }, [todasLasFilas]);

    const tipoActivoMeta = useMemo(
        () => TIPOS_REQUISICION.find((t) => t.id === tipoActivo) ?? TIPOS_REQUISICION[0],
        [tipoActivo]
    );

    const filasDelTipo = useMemo(
        () => todasLasFilas.filter((f) => f.tipoRequisicion === tipoActivo),
        [todasLasFilas, tipoActivo]
    );

    const conteoFiltro = useMemo(() => {
        const base = filasDelTipo;
        return {
            todos: base.length,
            a_tiempo: base.filter((f) => f.entregoATiempo === true).length,
            retraso: base.filter((f) => f.entregoATiempo === false).length,
            parciales: base.filter((f) => f.numEnvios > 1).length,
        };
    }, [filasDelTipo]);

    const listaFiltrada = useMemo(
        () => filasDelTipo.filter((f) => cumpleFiltroCalidad(f, filtroCalidad)),
        [filasDelTipo, filtroCalidad]
    );

    const total = listaFiltrada.length;
    const totalPaginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA));
    const paginaActual = Math.min(pagina, totalPaginas);
    const indiceInicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    const listaPagina = listaFiltrada.slice(indiceInicio, indiceInicio + FILAS_POR_PAGINA);

    useEffect(() => {
        if (pagina > totalPaginas) setPagina(totalPaginas);
    }, [pagina, totalPaginas, tipoActivo, filtroCalidad]);

    const toggleExpand = (key: string) => {
        setExpandidas((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const colFlex = isWide
        ? [0.9, 1.2, 1.4, 0.7, 0.55, 0.95, 0.95, 0.75, 0.85, 0.9]
        : [0.85, 1.1, 1.2, 0.65, 0.5, 0.9, 0.9, 0.7, 0.8, 0.85];

    const renderHeader = () => (
        <View style={[calStyles.tableHeader, { borderBottomColor: colors.border }]}>
            {[
                ['COD. REQ', colFlex[0]],
                ['PROVEEDOR', colFlex[1]],
                ['INSUMO', colFlex[2]],
                ['PEDIDO', colFlex[3]],
                ['ENVÍOS', colFlex[4]],
                ['1ª LLEGADA', colFlex[5]],
                ['ÚLT. LLEGADA', colFlex[6]],
                ['DÍAS ENTRE', colFlex[7]],
                ['VS REQUERIDA', colFlex[8]],
                ['PUNTUALIDAD', colFlex[9]],
            ].map(([label, flex]) => (
                <Text
                    key={label}
                    style={[calStyles.th, { color: colors.subText, flex: flex as number }]}
                >
                    {label}
                </Text>
            ))}
        </View>
    );

    return (
        <View style={[calStyles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <Text style={[calStyles.titulo, { color: colors.text }]}>Puntualidad de proveedores</Text>
            <Text style={[calStyles.ayuda, { color: colors.subText }]}>
                Cada recepción guardada (incluidos parciales) queda registrada con fecha y cantidad. Aquí
                compara la 1ª y la última llegada, los días entre envíos y el retraso respecto a la fecha
                requerida de la requisición.
            </Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={calStyles.sheetTabsScroll}
            >
                {TIPOS_REQUISICION.map((tipo) => {
                    const activo = tipoActivo === tipo.id;
                    const count = conteoPorTipo[tipo.id] ?? 0;
                    return (
                        <TouchableOpacity
                            key={tipo.id}
                            style={[
                                calStyles.sheetTab,
                                {
                                    borderTopColor: activo ? tipo.accentColor : 'transparent',
                                    backgroundColor: activo
                                        ? isDarkMode
                                            ? '#1E293B'
                                            : '#FFF'
                                        : isDarkMode
                                          ? '#0F172A'
                                          : '#F1F5F9',
                                },
                                activo && calStyles.sheetTabActive,
                            ]}
                            onPress={() => {
                                setTipoActivo(tipo.id);
                                setPagina(1);
                                setExpandidas({});
                            }}
                        >
                            <Text
                                style={[
                                    calStyles.sheetTabText,
                                    { color: activo ? colors.text : colors.subText, fontWeight: activo ? '700' : '500' },
                                ]}
                                numberOfLines={2}
                            >
                                {tipo.label}
                            </Text>
                            <View style={[calStyles.sheetTabBadge, { backgroundColor: tipo.accentColor }]}>
                                <Text style={calStyles.sheetTabBadgeText}>{count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={[calStyles.subtipo, { color: colors.text }]}>{tipoActivoMeta.label}</Text>

            <View style={calStyles.filtroWrap}>
                <Text style={[calStyles.filtroTitulo, { color: colors.subText }]}>Filtrar evaluación</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {OPCIONES_FILTRO_CALIDAD_PROVEEDOR.map((op) => {
                        const sel = filtroCalidad === op.id;
                        const count = conteoFiltro[op.id] ?? 0;
                        return (
                            <TouchableOpacity
                                key={op.id}
                                style={[
                                    calStyles.filtroChip,
                                    {
                                        borderColor: sel ? colors.primary : colors.border,
                                        backgroundColor: sel
                                            ? isDarkMode
                                                ? 'rgba(59, 130, 246, 0.25)'
                                                : 'rgba(59, 130, 246, 0.12)'
                                            : isDarkMode
                                              ? '#0F172A'
                                              : colors.inputBackground,
                                    },
                                ]}
                                onPress={() => {
                                    setFiltroCalidad(op.id);
                                    setPagina(1);
                                    setExpandidas({});
                                }}
                            >
                                <Text
                                    style={{
                                        color: sel ? colors.text : colors.subText,
                                        fontWeight: sel ? '700' : '500',
                                        fontSize: 13,
                                    }}
                                >
                                    {op.label} ({count})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {total === 0 ? (
                <Text style={[calStyles.vacio, { color: colors.subText }]}>
                    No hay recepciones registradas en esta categoría para evaluar proveedores. Registre
                    envíos en la pestaña Recepción (cada parcial genera una línea con su fecha).
                </Text>
            ) : (
                <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={isWide ? false : true}>
                        <View style={[calStyles.tableWrap, !isWide && calStyles.tableWrapNarrow]}>
                            {renderHeader()}
                            {listaPagina.map((ev) => {
                                const key = `${ev.requisicionId}-${ev.proveedorId}`;
                                const expandida = !!expandidas[key];
                                const punt = badgePuntualidad(ev, colors);
                                const vsReq =
                                    ev.diasRetrasoUltimaVsRequerida === null
                                        ? '—'
                                        : ev.diasRetrasoUltimaVsRequerida <= 0
                                          ? ev.diasRetrasoUltimaVsRequerida < 0
                                              ? `${Math.abs(ev.diasRetrasoUltimaVsRequerida)} d antes`
                                              : 'Mismo día'
                                          : `+${ev.diasRetrasoUltimaVsRequerida} d`;

                                return (
                                    <View key={key}>
                                        <View
                                            style={[
                                                calStyles.tableRow,
                                                {
                                                    borderBottomColor: colors.border,
                                                    backgroundColor: expandida
                                                        ? isDarkMode
                                                            ? 'rgba(59, 130, 246, 0.08)'
                                                            : 'rgba(59, 130, 246, 0.06)'
                                                        : 'transparent',
                                                },
                                            ]}
                                        >
                                            <TouchableOpacity
                                                style={calStyles.expandBtn}
                                                onPress={() => toggleExpand(key)}
                                            >
                                                <Text style={{ color: colors.primary, fontSize: 12 }}>
                                                    {expandida ? '▼' : '▶'}
                                                </Text>
                                            </TouchableOpacity>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[0] }]}>
                                                {ev.codigoRequisicion}
                                            </Text>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[1] }]}>
                                                {ev.nombreProveedor}
                                            </Text>
                                            <Text
                                                style={[calStyles.td, { color: colors.text, flex: colFlex[2] }]}
                                                numberOfLines={2}
                                            >
                                                {ev.producto}
                                            </Text>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[3] }]}>
                                                {ev.cantidadPedidaTotal} {ev.unidad}
                                            </Text>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[4] }]}>
                                                {ev.numEnvios}
                                            </Text>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[5] }]}>
                                                {ev.fechaPrimeraLlegada
                                                    ? formatFechaDisplay(ev.fechaPrimeraLlegada)
                                                    : '—'}
                                            </Text>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[6] }]}>
                                                {ev.fechaUltimaLlegada
                                                    ? formatFechaDisplay(ev.fechaUltimaLlegada)
                                                    : '—'}
                                            </Text>
                                            <Text
                                                style={[
                                                    calStyles.td,
                                                    {
                                                        color:
                                                            ev.numEnvios > 1 ? '#FBBF24' : colors.subText,
                                                        flex: colFlex[7],
                                                        fontWeight: ev.numEnvios > 1 ? '700' : '400',
                                                    },
                                                ]}
                                            >
                                                {textoDiasEntreEnvios(ev)}
                                            </Text>
                                            <Text style={[calStyles.td, { color: colors.text, flex: colFlex[8] }]}>
                                                {vsReq}
                                                {'\n'}
                                                <Text style={{ color: colors.subText, fontSize: 11 }}>
                                                    req. {formatFechaDisplay(ev.fechaRequerida)}
                                                </Text>
                                            </Text>
                                            <View style={[calStyles.td, { flex: colFlex[9] }]}>
                                                <View
                                                    style={[
                                                        calStyles.badge,
                                                        {
                                                            backgroundColor: punt.bg,
                                                            borderColor: punt.border,
                                                        },
                                                    ]}
                                                >
                                                    <Text style={{ color: punt.text, fontSize: 11, fontWeight: '600' }}>
                                                        {punt.label}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {expandida && (
                                            <View
                                                style={[
                                                    calStyles.detallePanel,
                                                    {
                                                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                                        borderBottomColor: colors.border,
                                                    },
                                                ]}
                                            >
                                                <Text style={[calStyles.detalleTitulo, { color: colors.text }]}>
                                                    Cronología de envíos — {ev.nombreProveedor}
                                                </Text>
                                                <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 10 }}>
                                                    Fecha requerida OP: {formatFechaDisplay(ev.fechaRequerida)}
                                                    {ev.fechaEntregaEstimada
                                                        ? ` · Estimada proveedor: ${formatFechaDisplay(ev.fechaEntregaEstimada)}`
                                                        : ''}
                                                    {!ev.calidadSiempreOk ? ' · Hubo incidencias de calidad' : ''}
                                                </Text>
                                                {ev.llegadas.map((l) => (
                                                    <View
                                                        key={`${l.orden}-${l.codigoUsuario}`}
                                                        style={[
                                                            calStyles.envioCard,
                                                            { borderColor: colors.border },
                                                        ]}
                                                    >
                                                        <Text style={{ color: colors.primary, fontWeight: '700' }}>
                                                            Envío {l.orden} de {ev.numEnvios}
                                                        </Text>
                                                        <Text style={{ color: colors.text, fontSize: 14, marginTop: 4 }}>
                                                            Llegó el {formatFechaDisplay(l.fechaLlegada)} — Cód.{' '}
                                                            {l.codigoUsuario}
                                                        </Text>
                                                        <Text style={{ color: colors.text, fontSize: 14 }}>
                                                            Cantidad: {l.cantidadRecibida} {ev.unidad}
                                                            {l.esParcial && (l.saldoPendienteAntes ?? ev.cantidadPedidaTotal) > 0
                                                                ? ` (parcial · ${l.cantidadRecibida}/${l.saldoPendienteAntes ?? ev.cantidadPedidaTotal})`
                                                                : ' (envío completo de este proveedor)'}
                                                        </Text>
                                                        {l.esParcial && l.nuevaFechaEntrega && (
                                                            <Text style={{ color: '#FBBF24', fontSize: 13 }}>
                                                                Resto prometido para:{' '}
                                                                {formatFechaDisplay(l.nuevaFechaEntrega)}
                                                            </Text>
                                                        )}
                                                        {l.motivoCantidadParcial && (
                                                            <Text style={{ color: colors.subText, fontSize: 12 }}>
                                                                Motivo: {l.motivoCantidadParcial}
                                                            </Text>
                                                        )}
                                                    </View>
                                                ))}
                                                {ev.numEnvios > 1 && ev.diasEntreParciales !== null && (
                                                    <Text
                                                        style={{
                                                            color: '#FBBF24',
                                                            fontSize: 13,
                                                            fontWeight: '600',
                                                            marginTop: 8,
                                                        }}
                                                    >
                                                        Tiempo entre el 1.er y el último envío:{' '}
                                                        {ev.diasEntreParciales} días
                                                    </Text>
                                                )}
                                                {ev.diasRetrasoUltimaVsEstimada !== null &&
                                                    ev.diasRetrasoUltimaVsEstimada > 0 && (
                                                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }}>
                                                            vs fecha estimada del proveedor: +{' '}
                                                            {ev.diasRetrasoUltimaVsEstimada} d de retraso en la
                                                            última llegada
                                                        </Text>
                                                    )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <View style={[calStyles.paginationBar, { borderTopColor: colors.border }]}>
                        <Text style={[calStyles.paginationInfo, { color: colors.subText }]}>
                            {indiceInicio + 1}–{Math.min(indiceInicio + FILAS_POR_PAGINA, total)} de {total}{' '}
                            proveedor(es)
                        </Text>
                        <View style={calStyles.paginationControls}>
                            <TouchableOpacity
                                style={[
                                    calStyles.paginationBtn,
                                    { borderColor: colors.border },
                                    paginaActual <= 1 && calStyles.paginationBtnDisabled,
                                ]}
                                disabled={paginaActual <= 1}
                                onPress={() => setPagina((p) => Math.max(1, p - 1))}
                            >
                                <Text style={{ color: colors.text }}>Anterior</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    calStyles.paginationBtn,
                                    calStyles.paginationBtnPrimary,
                                    paginaActual >= totalPaginas && calStyles.paginationBtnDisabled,
                                ]}
                                disabled={paginaActual >= totalPaginas}
                                onPress={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                            >
                                <Text style={calStyles.paginationBtnTextPrimary}>Siguiente</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}
        </View>
    );
}

const calStyles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    titulo: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
    ayuda: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
    subtipo: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    sheetTabsScroll: { gap: 4, paddingBottom: 8 },
    sheetTab: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: 3,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        minWidth: 120,
        maxWidth: 220,
        flexDirection: 'row',
        alignItems: 'center',
    },
    sheetTabActive: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    sheetTabText: { fontSize: 12, flex: 1 },
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
    filtroWrap: { marginBottom: 14 },
    filtroTitulo: { fontSize: 12, marginBottom: 8 },
    filtroChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    vacio: { fontSize: 14, fontStyle: 'italic', paddingVertical: 24, textAlign: 'center' },
    tableWrap: { width: '100%' },
    tableWrapNarrow: { minWidth: 1100 },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingLeft: 28,
        borderBottomWidth: 1,
    },
    th: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingLeft: 4,
        borderBottomWidth: 1,
    },
    expandBtn: { width: 24, alignItems: 'center' },
    td: { fontSize: 13, paddingRight: 6 },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    detallePanel: {
        padding: 14,
        paddingLeft: 32,
        borderBottomWidth: 1,
    },
    detalleTitulo: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
    envioCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
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
    paginationInfo: { fontSize: 14, flex: 1 },
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
});
