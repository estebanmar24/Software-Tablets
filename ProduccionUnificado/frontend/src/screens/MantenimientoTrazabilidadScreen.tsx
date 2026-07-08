import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    useWindowDimensions,
    Platform,
    Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { mantenimientoApi } from '../services/mantenimientoApi';

type TrazabilidadItem = {
    id: number;
    modulo: string;
    entidad: string;
    accion: string;
    entidadId?: number | null;
    descripcion: string;
    usuarioNombre?: string | null;
    fecha: string;
    esHistorico: boolean;
};

const ACCIONES = ['', 'Crear', 'Actualizar', 'Eliminar', 'Ajuste', 'Recalcular', 'Registro histórico'];
const PAGE_SIZE = 25;

function formatFecha(fecha: string) {
    try {
        const d = new Date(fecha);
        if (Number.isNaN(d.getTime())) return fecha;
        return d.toLocaleString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return fecha;
    }
}

function accionColor(accion: string) {
    switch (accion) {
        case 'Crear':
            return '#10B981';
        case 'Actualizar':
        case 'Ajuste':
            return '#3B82F6';
        case 'Eliminar':
            return '#EF4444';
        case 'Recalcular':
            return '#8B5CF6';
        default:
            return '#6B7280';
    }
}

export default function MantenimientoTrazabilidadScreen({ onBack }: { onBack?: () => void }) {
    const { colors, isDarkMode } = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 900;

    const [items, setItems] = useState<TrazabilidadItem[]>([]);
    const [modulos, setModulos] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [cargando, setCargando] = useState(true);
    const [exportando, setExportando] = useState(false);
    const [error, setError] = useState('');

    const [filtroModulo, setFiltroModulo] = useState('');
    const [filtroAccion, setFiltroAccion] = useState('');
    const [busqueda, setBusqueda] = useState('');

    const cardBg = isDarkMode ? '#1E293B' : colors.card;
    const inputBg = isDarkMode ? '#0F172A' : colors.inputBackground;

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const data = await mantenimientoApi.getTrazabilidad({
                modulo: filtroModulo || undefined,
                accion: filtroAccion || undefined,
                q: busqueda.trim() || undefined,
                page,
                pageSize: PAGE_SIZE,
            });
            setItems(data.items ?? []);
            setModulos(data.modulos ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages ?? 1);
        } catch (e: unknown) {
            const err = e as { response?: { status?: number; data?: { message?: string } } };
            if (err?.response?.status === 403) {
                setError('Solo usuarios con rol Administrador pueden ver la trazabilidad.');
            } else {
                setError(err?.response?.data?.message ?? 'No se pudo cargar la trazabilidad.');
            }
            setItems([]);
        } finally {
            setCargando(false);
        }
    }, [filtroModulo, filtroAccion, busqueda, page]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const rango = useMemo(() => {
        if (total === 0) return '0';
        const inicio = (page - 1) * PAGE_SIZE + 1;
        const fin = Math.min(page * PAGE_SIZE, total);
        return `${inicio}–${fin}`;
    }, [page, total]);

    const modulosOpciones = useMemo(() => {
        const base = ['', ...modulos];
        if (filtroModulo && !base.includes(filtroModulo)) base.push(filtroModulo);
        return [...new Set(base)];
    }, [modulos, filtroModulo]);

    const handleExportarExcel = async () => {
        setExportando(true);
        try {
            const blob = await mantenimientoApi.exportarTrazabilidadExcel({
                modulo: filtroModulo || undefined,
                accion: filtroAccion || undefined,
                q: busqueda.trim() || undefined,
            });

            if (Platform.OS === 'web') {
                const fileBlob = new Blob([blob], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
                const url = window.URL.createObjectURL(fileBlob);
                const a = document.createElement('a');
                const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const sufijo = filtroModulo ? `_${filtroModulo}` : '';
                a.href = url;
                a.download = `Trazabilidad_Mantenimiento${sufijo}_${fecha}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                Alert.alert('Exportar Excel', 'La descarga de Excel está disponible en la versión web.');
            }
        } catch (e: unknown) {
            const err = e as { response?: { status?: number; data?: Blob } };
            let mensaje = 'No se pudo exportar el Excel.';
            if (err?.response?.status === 404) {
                mensaje = 'No hay registros para exportar con los filtros actuales.';
            }
            Alert.alert('Error al exportar', mensaje);
        } finally {
            setExportando(false);
        }
    };

    return (
        <ScrollView
            style={[styles.wrap, { backgroundColor: isDarkMode ? colors.background : '#F3F4F6' }]}
            contentContainerStyle={styles.content}
        >
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
                <Text style={[styles.titulo, { color: colors.text }]}>Trazabilidad de Mantenimiento</Text>
                <View style={styles.tituloRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.subtitulo, { color: colors.subText, marginBottom: 0 }]}>
                            Registro de todas las acciones del módulo: hojas de vida, gastos, inventario, consumos y
                            catálogos. Solo visible para Administrador.
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.btnExportar,
                            { backgroundColor: '#10B981', borderColor: '#059669' },
                            (exportando || total === 0) && { opacity: 0.55 },
                        ]}
                        onPress={handleExportarExcel}
                        disabled={exportando || total === 0}
                    >
                        {exportando ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.btnExportarText}>Descargar Excel</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.filtros}>
                    <View style={[styles.filtroBox, isWide && { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.subText }]}>Buscar</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, borderColor: colors.border, color: colors.text }]}
                            placeholder="Descripción, usuario, entidad..."
                            placeholderTextColor={colors.subText}
                            value={busqueda}
                            onChangeText={(t) => {
                                setBusqueda(t);
                                setPage(1);
                            }}
                        />
                    </View>
                    <View style={styles.chipsRow}>
                        {modulosOpciones.map((m) => (
                            <TouchableOpacity
                                key={m || 'todos'}
                                style={[
                                    styles.chip,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor:
                                            filtroModulo === m
                                                ? isDarkMode
                                                    ? 'rgba(59,130,246,0.25)'
                                                    : 'rgba(59,130,246,0.12)'
                                                : 'transparent',
                                    },
                                ]}
                                onPress={() => {
                                    setFiltroModulo(m);
                                    setPage(1);
                                }}
                            >
                                <Text style={{ color: filtroModulo === m ? colors.primary : colors.text, fontSize: 13 }}>
                                    {m || 'Todos'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.chipsRow}>
                        {ACCIONES.map((a) => (
                            <TouchableOpacity
                                key={a || 'todas'}
                                style={[
                                    styles.chip,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor:
                                            filtroAccion === a
                                                ? isDarkMode
                                                    ? 'rgba(16,185,129,0.2)'
                                                    : 'rgba(16,185,129,0.1)'
                                                : 'transparent',
                                    },
                                ]}
                                onPress={() => {
                                    setFiltroAccion(a);
                                    setPage(1);
                                }}
                            >
                                <Text style={{ color: filtroAccion === a ? '#10B981' : colors.text, fontSize: 13 }}>
                                    {a || 'Todas'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {error ? (
                    <View style={[styles.errorBox, { borderColor: '#EF4444' }]}>
                        <Text style={{ color: '#EF4444' }}>{error}</Text>
                    </View>
                ) : null}

                {cargando ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
                ) : items.length === 0 ? (
                    <Text style={[styles.vacio, { color: colors.subText }]}>No hay registros con los filtros actuales.</Text>
                ) : (
                    <View style={[styles.tabla, { borderColor: colors.border }]}>
                        {isWide ? (
                            <View style={[styles.tablaHeader, { backgroundColor: isDarkMode ? '#0F172A' : '#F9FAFB' }]}>
                                <Text style={[styles.th, { flex: 1.1, color: colors.subText }]}>Fecha</Text>
                                <Text style={[styles.th, { flex: 0.7, color: colors.subText }]}>Módulo</Text>
                                <Text style={[styles.th, { flex: 0.6, color: colors.subText }]}>Acción</Text>
                                <Text style={[styles.th, { flex: 2.2, color: colors.subText }]}>Descripción</Text>
                                <Text style={[styles.th, { flex: 0.9, color: colors.subText }]}>Usuario</Text>
                            </View>
                        ) : null}
                        {items.map((item) => (
                            <View
                                key={item.id}
                                style={[
                                    styles.fila,
                                    { borderBottomColor: colors.border },
                                    isWide && { flexDirection: 'row', alignItems: 'center' },
                                ]}
                            >
                                {isWide ? (
                                    <>
                                        <Text style={[styles.td, { flex: 1.1, color: colors.subText }]}>
                                            {formatFecha(item.fecha)}
                                            {item.esHistorico ? ' · hist.' : ''}
                                        </Text>
                                        <Text style={[styles.td, { flex: 0.7, color: colors.text }]}>{item.modulo}</Text>
                                        <View style={{ flex: 0.6 }}>
                                            <Text style={[styles.badge, { color: accionColor(item.accion) }]}>
                                                {item.accion}
                                            </Text>
                                        </View>
                                        <Text style={[styles.td, { flex: 2.2, color: colors.text }]}>{item.descripcion}</Text>
                                        <Text style={[styles.td, { flex: 0.9, color: colors.subText }]}>
                                            {item.usuarioNombre ?? '—'}
                                        </Text>
                                    </>
                                ) : (
                                    <View style={{ gap: 4 }}>
                                        <View style={styles.filaTop}>
                                            <Text style={[styles.badge, { color: accionColor(item.accion) }]}>{item.accion}</Text>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>{item.modulo}</Text>
                                        </View>
                                        <Text style={{ color: colors.text, fontWeight: '600' }}>{item.descripcion}</Text>
                                        <Text style={{ color: colors.subText, fontSize: 12 }}>
                                            {formatFecha(item.fecha)}
                                            {item.usuarioNombre ? ` · ${item.usuarioNombre}` : ''}
                                            {item.esHistorico ? ' · histórico' : ''}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                <View style={[styles.paginacion, { borderTopColor: colors.border }]}>
                    <Text style={{ color: colors.subText, fontSize: 13 }}>
                        Mostrando {rango} de {total} · Página {page} de {totalPages}
                    </Text>
                    <View style={styles.paginacionBtns}>
                        <TouchableOpacity
                            style={[styles.pagBtn, { borderColor: colors.border }, page <= 1 && styles.pagBtnDisabled]}
                            disabled={page <= 1}
                            onPress={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <Text style={{ color: colors.text }}>← Anterior</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.pagBtn,
                                styles.pagBtnPrimary,
                                page >= totalPages && styles.pagBtnDisabled,
                            ]}
                            disabled={page >= totalPages}
                            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            <Text style={{ color: '#FFF' }}>Siguiente →</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1 },
    content: { padding: 16, paddingBottom: 32 },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    titulo: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
    tituloRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
    },
    subtitulo: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
    btnExportar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 150,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnExportarText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    filtros: { gap: 12, marginBottom: 16 },
    filtroBox: { minWidth: 200 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: {
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    errorBox: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    vacio: { textAlign: 'center', paddingVertical: 32, fontSize: 15 },
    tabla: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
    tablaHeader: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    th: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    fila: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    filaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    td: { fontSize: 14 },
    badge: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    paginacion: {
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    paginacionBtns: { flexDirection: 'row', gap: 8 },
    pagBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    pagBtnPrimary: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    pagBtnDisabled: { opacity: 0.45 },
});
