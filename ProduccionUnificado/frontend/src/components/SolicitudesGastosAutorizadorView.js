import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MedioPagoGastoControls, { MedioPagoBadge } from './MedioPagoGastoControls';
import GastoAutorizacionComentariosModal from './GastoAutorizacionComentariosModal';
import { useTheme } from '../contexts/ThemeContext';
import {
    getAutorizacionesGastoConsolidado,
    autorizarSolicitudGasto,
    rechazarSolicitudGasto,
    colorEstadoAutorizacion,
    labelEstadoAutorizacion,
    etiquetaModuloGasto,
    moduloContabilidadToKey,
    ESTADOS_AUTORIZACION,
} from '../services/gastosAutorizacionApi';

const FILTROS = [
    { key: ESTADOS_AUTORIZACION.pendiente, label: 'Pendientes' },
    { key: 'todos', label: 'Todas' },
    { key: ESTADOS_AUTORIZACION.autorizada, label: 'Autorizadas' },
    { key: ESTADOS_AUTORIZACION.noAutorizada, label: 'No autorizadas' },
];

const AREAS = [
    { label: 'Todas las áreas', value: '' },
    { label: 'Producción', value: 'Producción' },
    { label: 'Talleres', value: 'Talleres' },
    { label: 'Mantenimiento', value: 'Mantenimiento' },
    { label: 'Gestión Humana', value: 'Gestión Humana' },
    { label: 'SST', value: 'SST' },
    { label: 'Planeación', value: 'Planeación' },
    { label: 'Diseño', value: 'Diseño' },
];

const MESES = [
    { label: 'Todo el año', value: 0 },
    { label: 'Enero', value: 1 },
    { label: 'Febrero', value: 2 },
    { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Mayo', value: 5 },
    { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 },
    { label: 'Noviembre', value: 11 },
    { label: 'Diciembre', value: 12 },
];

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-CO');
}

export default function SolicitudesGastosAutorizadorView({ onPendingCountChange }) {
    const { colors, isDarkMode } = useTheme();
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtroEstado, setFiltroEstado] = useState(ESTADOS_AUTORIZACION.pendiente);
    const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
    const [filtroArea, setFiltroArea] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showRechazoModal, setShowRechazoModal] = useState(false);
    const [rechazoTarget, setRechazoTarget] = useState(null);
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [saving, setSaving] = useState(false);
    const [comentariosModalItem, setComentariosModalItem] = useState(null);

    const onPendingCountChangeRef = useRef(onPendingCountChange);
    onPendingCountChangeRef.current = onPendingCountChange;

    const cardBg = isDarkMode ? '#111827' : '#FFFFFF';
    const cardBorder = isDarkMode ? '#1F2937' : '#E2E8F0';
    const inputBg = isDarkMode ? '#0F172A' : '#F8FAFC';
    const chipBg = isDarkMode ? '#1F2937' : '#F1F5F9';

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAutorizacionesGastoConsolidado({
                anio: filtroAnio,
                mes: filtroMes > 0 ? filtroMes : undefined,
                modulo: filtroArea ? moduloContabilidadToKey(filtroArea) : undefined,
                estado: filtroEstado,
                search: searchQuery || undefined,
            });
            setLista(data);
            if (onPendingCountChangeRef.current) {
                const pendientes = data.filter(
                    (s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.pendiente
                ).length;
                onPendingCountChangeRef.current(
                    filtroEstado === ESTADOS_AUTORIZACION.pendiente ? pendientes : null
                );
            }
        } catch (e) {
            console.error('Error cargando solicitudes:', e);
            Alert.alert('Error', 'No se pudieron cargar las solicitudes de gastos.');
        } finally {
            setLoading(false);
        }
    }, [filtroAnio, filtroMes, filtroArea, filtroEstado, searchQuery]);

    useEffect(() => {
        if (comentariosModalItem) return;
        const timer = setTimeout(() => {
            void cargar();
        }, 350);
        return () => clearTimeout(timer);
    }, [cargar, comentariosModalItem]);

    const handleComentariosActualizados = useCallback((solicitudId, total) => {
        setLista((prev) =>
            prev.map((item) =>
                String(item.id) === String(solicitudId) ? { ...item, totalComentarios: total } : item
            )
        );
        setComentariosModalItem((prev) =>
            prev && String(prev.id) === String(solicitudId) ? { ...prev, totalComentarios: total } : prev
        );
    }, []);

    const comentariosModalSolicitud = useMemo(() => {
        if (!comentariosModalItem) return null;
        return (
            lista.find((item) => String(item.id) === String(comentariosModalItem.id)) ?? comentariosModalItem
        );
    }, [lista, comentariosModalItem]);

    const resumen = useMemo(() => {
        const pendientes = lista.filter((s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.pendiente).length;
        const autorizadas = lista.filter((s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.autorizada).length;
        const noAutorizadas = lista.filter((s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.noAutorizada).length;
        return { total: lista.length, pendientes, autorizadas, noAutorizadas };
    }, [lista]);

    const handleAutorizar = async (item) => {
        try {
            await autorizarSolicitudGasto(item.id);
            Alert.alert('Autorizada', 'La solicitud fue autorizada correctamente.');
            await cargar();
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo autorizar.');
        }
    };

    const confirmarRechazo = async () => {
        if (!rechazoTarget) return;
        if (!motivoRechazo.trim()) {
            Alert.alert('Error', 'Indique el motivo del rechazo.');
            return;
        }
        setSaving(true);
        try {
            await rechazarSolicitudGasto(rechazoTarget.id, motivoRechazo.trim());
            setShowRechazoModal(false);
            setRechazoTarget(null);
            setMotivoRechazo('');
            Alert.alert('Rechazada', 'La solicitud fue marcada como no autorizada.');
            await cargar();
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo rechazar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.wrap}>
            <View style={[styles.toolbar, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.toolbarRow}>
                    <TouchableOpacity
                        style={[styles.compactBtn, { backgroundColor: chipBg }]}
                        onPress={() => setFiltroAnio((y) => (y <= 2025 ? 2026 : 2025))}
                    >
                        <MaterialCommunityIcons name="calendar" size={16} color={colors.primary} />
                        <Text style={[styles.compactBtnText, { color: colors.text }]}>{filtroAnio}</Text>
                    </TouchableOpacity>
                    {Platform.OS === 'web' ? (
                        <select
                            value={filtroMes}
                            onChange={(e) => setFiltroMes(parseInt(e.target.value, 10))}
                            style={{
                                background: chipBg,
                                color: isDarkMode ? '#FFF' : '#334155',
                                border: `1px solid ${cardBorder}`,
                                borderRadius: 8,
                                padding: '6px 10px',
                                fontWeight: 700,
                                fontSize: 13,
                            }}
                        >
                            {MESES.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    ) : null}
                    {Platform.OS === 'web' ? (
                        <select
                            value={filtroArea}
                            onChange={(e) => setFiltroArea(e.target.value)}
                            style={{
                                background: chipBg,
                                color: isDarkMode ? '#FFF' : '#334155',
                                border: `1px solid ${cardBorder}`,
                                borderRadius: 8,
                                padding: '6px 10px',
                                fontWeight: 700,
                                fontSize: 13,
                                minWidth: 140,
                            }}
                        >
                            {AREAS.map((a) => (
                                <option key={a.value || 'all'} value={a.value}>{a.label}</option>
                            ))}
                        </select>
                    ) : null}
                    <TextInput
                        style={[styles.searchInput, { backgroundColor: chipBg, color: colors.text, borderColor: cardBorder }]}
                        placeholder="Buscar..."
                        placeholderTextColor={colors.subText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <TouchableOpacity onPress={cargar}>
                        <MaterialCommunityIcons name="refresh" size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosRow}>
                    {FILTROS.map((f) => {
                        const active = filtroEstado === f.key;
                        return (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    styles.filtroChip,
                                    { backgroundColor: active ? colors.primary : chipBg, borderColor: active ? colors.primary : cardBorder },
                                ]}
                                onPress={() => setFiltroEstado(f.key)}
                            >
                                <Text style={[styles.filtroChipText, { color: active ? '#FFF' : colors.text }]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <View style={styles.resumenRow}>
                    <Text style={[styles.resumenText, { color: colors.subText }]}>
                        {resumen.total} solicitud{resumen.total !== 1 ? 'es' : ''}
                        {filtroEstado === 'todos' ? ` · ${resumen.pendientes} pendientes` : ''}
                    </Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : lista.length === 0 ? (
                <Text style={[styles.empty, { color: colors.subText }]}>
                    {filtroEstado === ESTADOS_AUTORIZACION.pendiente
                        ? 'No hay solicitudes pendientes de autorización.'
                        : 'No hay solicitudes con estos filtros.'}
                </Text>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                    {lista.map((item) => {
                        const moduloLabel = etiquetaModuloGasto(item.modulo);
                        const estadoColor = colorEstadoAutorizacion(item.estadoAutorizacion);
                        return (
                            <View key={`${item.modulo}-${item.id}`} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                                <View style={styles.cardTop}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.moduloRow}>
                                            <View style={[styles.moduloTag, { backgroundColor: colors.primary + '22' }]}>
                                                <Text style={[styles.moduloTagText, { color: colors.primary }]}>
                                                    {moduloLabel.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={[styles.fecha, { color: colors.subText }]}>
                                                {formatDate(item.fechaSolicitud)}
                                            </Text>
                                        </View>
                                        <Text style={[styles.proveedor, { color: colors.text }]}>
                                            {item.proveedorNombre || 'Sin proveedor'}
                                        </Text>
                                        {item.rubroNombre ? (
                                            <Text style={[styles.rubroTag, { color: colors.primary }]}>
                                                Rubro: {item.rubroNombre}
                                            </Text>
                                        ) : null}
                                        <Text style={[styles.meta, { color: colors.subText }]}>
                                            {item.solicitadoPorNombre ? `Solicitó: ${item.solicitadoPorNombre}` : ''}
                                            {item.fechaAproximada ? ` · Fecha aprox.: ${formatDate(item.fechaAproximada)}` : ''}
                                        </Text>
                                        <Text style={[styles.razon, { color: colors.text }]}>{item.razon}</Text>
                                        {item.estadoAutorizacion === ESTADOS_AUTORIZACION.noAutorizada && item.motivoRechazo ? (
                                            <Text style={styles.rechazo}>Motivo rechazo: {item.motivoRechazo}</Text>
                                        ) : null}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        <View style={[styles.badge, { backgroundColor: estadoColor + '22' }]}>
                                            <Text style={[styles.badgeText, { color: estadoColor }]}>
                                                {labelEstadoAutorizacion(item.estadoAutorizacion)}
                                            </Text>
                                        </View>
                                        <Text style={[styles.monto, { color: colors.text }]}>
                                            {formatCurrency(item.cantidad)}
                                        </Text>
                                        <MedioPagoBadge
                                            esSolicitudCredito={item.esSolicitudCredito}
                                            esEfectivo={item.esEfectivo}
                                            compact
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.comentariosBtn, { borderColor: cardBorder, backgroundColor: chipBg }]}
                                    onPress={() => setComentariosModalItem(item)}
                                >
                                    <MaterialCommunityIcons
                                        name="comment-text-outline"
                                        size={18}
                                        color={(item.totalComentarios || 0) > 0 ? colors.primary : colors.subText}
                                    />
                                    <Text
                                        style={[
                                            styles.comentariosBtnText,
                                            { color: (item.totalComentarios || 0) > 0 ? colors.primary : colors.subText },
                                        ]}
                                    >
                                        Comentarios ({item.totalComentarios || 0})
                                    </Text>
                                </TouchableOpacity>

                                {item.puedeAutorizar ? (
                                    <View style={styles.acciones}>
                                        <TouchableOpacity style={styles.btnOk} onPress={() => handleAutorizar(item)}>
                                            <MaterialCommunityIcons name="check-circle" size={16} color="#FFF" />
                                            <Text style={styles.btnOkText}>Autorizar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.btnNo}
                                            onPress={() => {
                                                setRechazoTarget(item);
                                                setMotivoRechazo('');
                                                setShowRechazoModal(true);
                                            }}
                                        >
                                            <MaterialCommunityIcons name="close-circle" size={16} color="#FFF" />
                                            <Text style={styles.btnNoText}>No autorizar</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : item.gastoId ? (
                                    <Text style={[styles.usada, { color: colors.subText }]}>Gasto registrado #{item.gastoId}</Text>
                                ) : item.autorizadoPorNombre && item.estadoAutorizacion !== ESTADOS_AUTORIZACION.pendiente ? (
                                    <Text style={[styles.usada, { color: colors.subText }]}>
                                        {item.estadoAutorizacion === ESTADOS_AUTORIZACION.autorizada ? 'Autorizado' : 'Revisado'} por {item.autorizadoPorNombre}
                                    </Text>
                                ) : null}
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <Modal visible={showRechazoModal} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={[styles.modalBox, { backgroundColor: cardBg }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Motivo del rechazo</Text>
                        <TextInput
                            style={[styles.inputMultiline, { borderColor: cardBorder, color: colors.text, backgroundColor: chipBg }]}
                            value={motivoRechazo}
                            onChangeText={setMotivoRechazo}
                            multiline
                            placeholder="Indique por qué no se autoriza..."
                            placeholderTextColor={colors.subText}
                        />
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowRechazoModal(false)}>
                                <Text style={{ color: colors.text }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnNo, saving && { opacity: 0.6 }]}
                                onPress={confirmarRechazo}
                                disabled={saving}
                            >
                                <Text style={styles.btnNoText}>{saving ? 'Guardando...' : 'Confirmar rechazo'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <GastoAutorizacionComentariosModal
                visible={!!comentariosModalSolicitud}
                solicitud={comentariosModalSolicitud}
                onClose={() => setComentariosModalItem(null)}
                onComentariosActualizados={handleComentariosActualizados}
                colors={colors}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                inputBg={inputBg}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, padding: 16 },
    toolbar: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
    toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 },
    compactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    compactBtnText: { fontSize: 13, fontWeight: '700' },
    searchInput: { flex: 1, minWidth: 160, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
    filtrosRow: { maxHeight: 42, marginBottom: 8 },
    filtroChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
    filtroChipText: { fontSize: 12, fontWeight: '700' },
    resumenRow: { marginTop: 4 },
    resumenText: { fontSize: 12, fontWeight: '600' },
    empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
    listContent: { paddingBottom: 24 },
    card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
    cardTop: { flexDirection: 'row', gap: 12 },
    moduloRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
    moduloTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    moduloTagText: { fontSize: 10, fontWeight: '800' },
    fecha: { fontSize: 12 },
    proveedor: { fontSize: 16, fontWeight: '700' },
    rubroTag: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    meta: { fontSize: 12, marginTop: 2 },
    razon: { fontSize: 13, marginTop: 6 },
    rechazo: { fontSize: 12, color: '#B91C1C', marginTop: 6, fontWeight: '600' },
    monto: { fontSize: 16, fontWeight: '800' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    btnOk: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    btnOkText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnNo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    btnNoText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    usada: { fontSize: 12, marginTop: 10, fontStyle: 'italic' },
    comentariosBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    comentariosBtnText: { fontSize: 13, fontWeight: '700' },
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 20 },
    modalBox: { borderRadius: 12, padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
    inputMultiline: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    btnCancel: { paddingHorizontal: 14, paddingVertical: 10 },
});
