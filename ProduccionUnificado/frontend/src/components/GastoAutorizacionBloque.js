import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MedioPagoGastoControls, { medioPagoToFlags, flagsToMedioPago, MedioPagoBadge, showAlertMedioPagoRequerido } from './MedioPagoGastoControls';
import GastoAutorizacionComentariosModal from './GastoAutorizacionComentariosModal';
import {
    getAutorizacionesGasto,
    crearAutorizacionGasto,
    actualizarAutorizacionGasto,
    eliminarAutorizacionGasto,
    autorizarSolicitudGasto,
    rechazarSolicitudGasto,
    colorEstadoAutorizacion,
    labelEstadoAutorizacion,
    ESTADOS_AUTORIZACION,
} from '../services/gastosAutorizacionApi';
import { esRubroSinAutorizacion } from '../utils/gastoAutorizacionIntegracion';
import { proveedorMatchesRubro } from '../utils/proveedorRubros';

const FILTROS = [
    { key: 'todos', label: 'Todas' },
    { key: ESTADOS_AUTORIZACION.pendiente, label: 'Pendientes' },
    { key: ESTADOS_AUTORIZACION.autorizada, label: 'Autorizadas' },
    { key: ESTADOS_AUTORIZACION.noAutorizada, label: 'No autorizadas' },
];

export default function GastoAutorizacionBloque({
    modulo,
    anio,
    mes,
    displayName,
    proveedores = [],
    rubros = [],
    tiposServicio = [],
    formatCurrency,
    formatDate,
    onRegistrarGasto,
    onRegistrarDirecto,
    refreshKey = 0,
}) {
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [showRegistroModal, setShowRegistroModal] = useState(false);
    const [pasoRegistro, setPasoRegistro] = useState('rubro');
    const [editTarget, setEditTarget] = useState(null);
    const [rubroSeleccionadoId, setRubroSeleccionadoId] = useState('');
    const [showRechazoModal, setShowRechazoModal] = useState(false);
    const [rechazoTarget, setRechazoTarget] = useState(null);
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [saving, setSaving] = useState(false);
    const [comentariosModalItem, setComentariosModalItem] = useState(null);
    const [form, setForm] = useState({
        proveedorId: '',
        fechaAproximada: new Date().toISOString().split('T')[0],
        cantidad: '',
        razon: '',
    });
    const [medioPago, setMedioPago] = useState(null);

    const rubrosActivos = rubros.filter((r) => r.activo !== false);

    const proveedoresFiltrados = useMemo(() => {
        if (!rubroSeleccionadoId) return [];
        return proveedores.filter((p) => proveedorMatchesRubro(p, rubroSeleccionadoId, tiposServicio));
    }, [proveedores, rubroSeleccionadoId, tiposServicio]);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAutorizacionesGasto(modulo, anio, mes, filtroEstado);
            setLista(data);
        } catch (e) {
            console.error('Error cargando autorizaciones:', e);
        } finally {
            setLoading(false);
        }
    }, [modulo, anio, mes, filtroEstado]);

    useEffect(() => {
        void cargar();
    }, [cargar, refreshKey]);

    const resetForm = () => {
        setForm({
            proveedorId: '',
            fechaAproximada: new Date().toISOString().split('T')[0],
            cantidad: '',
            razon: '',
        });
        setMedioPago(null);
        setRubroSeleccionadoId('');
        setPasoRegistro('rubro');
        setEditTarget(null);
    };

    const cerrarRegistroModal = () => {
        setShowRegistroModal(false);
        resetForm();
    };

    const abrirRegistro = () => {
        resetForm();
        setShowRegistroModal(true);
    };

    const abrirEditar = (item) => {
        setEditTarget(item);
        setRubroSeleccionadoId(item.rubroId ? String(item.rubroId) : '');
        setForm({
            proveedorId: item.proveedorId ? String(item.proveedorId) : '',
            fechaAproximada: item.fechaAproximada?.split('T')[0] || new Date().toISOString().split('T')[0],
            cantidad: String(item.cantidad ?? ''),
            razon: item.razon || '',
        });
        setMedioPago(flagsToMedioPago(!!item.esSolicitudCredito, !!item.esEfectivo));
        setPasoRegistro('autorizacion');
        setShowRegistroModal(true);
    };

    const confirmarEliminar = async (item) => {
        const ok =
            Platform.OS === 'web'
                ? window.confirm(`¿Eliminar la solicitud de ${item.proveedorNombre || 'este gasto'}?`)
                : await new Promise((resolve) =>
                      Alert.alert('Eliminar', '¿Eliminar esta solicitud de autorización?', [
                          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
                      ])
                  );
        if (!ok) return;
        try {
            await eliminarAutorizacionGasto(item.id);
            await cargar();
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo eliminar.');
        }
    };

    const buildPayload = () => {
        const rubro = rubrosActivos.find((r) => String(r.id) === String(rubroSeleccionadoId));
        const prov = proveedoresFiltrados.find((p) => String(p.id) === String(form.proveedorId))
            || proveedores.find((p) => String(p.id) === String(form.proveedorId));
        const flags = medioPagoToFlags(medioPago);
        return {
            modulo,
            rubroId: rubroSeleccionadoId,
            rubroNombre: rubro?.nombre ?? '',
            proveedorId: form.proveedorId,
            proveedorNombre: prov?.nombre ?? '',
            fechaAproximada: form.fechaAproximada,
            cantidad: Number(form.cantidad),
            razon: form.razon.trim(),
            esSolicitudCredito: flags.esSolicitudCredito,
            esEfectivo: flags.esEfectivo,
            anio,
            mes,
        };
    };

    const continuarDesdeRubro = () => {
        if (!rubroSeleccionadoId) {
            Alert.alert('Error', 'Seleccione un rubro.');
            return;
        }

        const rubro = rubrosActivos.find((r) => String(r.id) === String(rubroSeleccionadoId));
        const nombreRubro = rubro?.nombre || '';

        if (onRegistrarDirecto && esRubroSinAutorizacion(nombreRubro)) {
            cerrarRegistroModal();
            onRegistrarDirecto(rubroSeleccionadoId);
            return;
        }

        setPasoRegistro('autorizacion');
        setForm((prev) => ({
            ...prev,
            proveedorId: proveedoresFiltrados.some((p) => String(p.id) === String(prev.proveedorId)) ? prev.proveedorId : '',
        }));
    };

    const enviarSolicitud = async () => {
        if (!form.proveedorId) {
            Alert.alert('Error', 'Seleccione un proveedor.');
            return;
        }
        if (!form.cantidad || Number(form.cantidad) <= 0) {
            Alert.alert('Error', 'Indique una cantidad válida.');
            return;
        }
        if (!form.razon.trim()) {
            Alert.alert('Error', 'Indique la razón del gasto.');
            return;
        }
        if (!medioPago) {
            showAlertMedioPagoRequerido();
            return;
        }
        if (!proveedoresFiltrados.some((p) => String(p.id) === String(form.proveedorId))) {
            Alert.alert('Error', 'Seleccione un proveedor asignado a este rubro.');
            return;
        }

        setSaving(true);
        try {
            const payload = buildPayload();
            if (editTarget) {
                await actualizarAutorizacionGasto(editTarget.id, payload);
                Alert.alert('Actualizado', editTarget.estadoAutorizacion === ESTADOS_AUTORIZACION.autorizada
                    ? 'La solicitud volvió a pendiente para nueva autorización.'
                    : 'Solicitud actualizada.');
            } else {
                await crearAutorizacionGasto(payload);
                Alert.alert('Registro enviado', 'Queda pendiente de autorización por Nohora Ortiz.');
            }
            cerrarRegistroModal();
            await cargar();
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'No se pudo guardar la solicitud.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const handleAutorizar = async (item) => {
        const ok =
            Platform.OS === 'web'
                ? window.confirm(`¿Autorizar el gasto de ${item.proveedorNombre}?`)
                : await new Promise((resolve) =>
                      Alert.alert('Autorizar', `¿Autorizar el gasto de ${item.proveedorNombre}?`, [
                          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Autorizar', onPress: () => resolve(true) },
                      ])
                  );
        if (!ok) return;
        try {
            await autorizarSolicitudGasto(item.id);
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
            await cargar();
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo rechazar.');
        } finally {
            setSaving(false);
        }
    };

    const rubroSeleccionado = rubrosActivos.find((r) => String(r.id) === String(rubroSeleccionadoId));

    const handleComentariosActualizados = useCallback((solicitudId, total) => {
        setLista((prev) =>
            prev.map((item) =>
                String(item.id) === String(solicitudId) ? { ...item, totalComentarios: total } : item
            )
        );
    }, []);

    const comentariosTheme = {
        text: '#0F172A',
        subText: '#64748B',
        border: '#E2E8F0',
        primary: '#2563EB',
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.sectionTitle}>Autorizaciones de pago</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosRow}>
                {FILTROS.map((f) => {
                    const active = filtroEstado === f.key;
                    return (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filtroChip, active && styles.filtroChipActive]}
                            onPress={() => setFiltroEstado(f.key)}
                        >
                            <Text style={[styles.filtroChipText, active && styles.filtroChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading ? (
                <ActivityIndicator color="#2563EB" style={{ marginVertical: 12 }} />
            ) : lista.length === 0 ? (
                <Text style={styles.empty}>No hay solicitudes en este filtro.</Text>
            ) : (
                lista.map((item) => (
                    <View key={item.id} style={styles.card}>
                        <View style={styles.cardTop}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.proveedor}>{item.proveedorNombre || 'Proveedor'}</Text>
                                {item.rubroNombre ? (
                                    <Text style={styles.rubroTag}>Rubro: {item.rubroNombre}</Text>
                                ) : null}
                                <Text style={styles.meta}>
                                    {item.solicitadoPorNombre ? `Solicitó: ${item.solicitadoPorNombre}` : ''}
                                    {item.fechaAproximada ? ` · Fecha aprox.: ${formatDate(item.fechaAproximada)}` : ''}
                                </Text>
                                <Text style={styles.razon}>{item.razon}</Text>
                                {item.estadoAutorizacion === ESTADOS_AUTORIZACION.noAutorizada && item.motivoRechazo ? (
                                    <Text style={styles.rechazo}>Motivo rechazo: {item.motivoRechazo}</Text>
                                ) : null}
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                <View
                                    style={[
                                        styles.badge,
                                        { backgroundColor: colorEstadoAutorizacion(item.estadoAutorizacion) + '22' },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.badgeText,
                                            { color: colorEstadoAutorizacion(item.estadoAutorizacion) },
                                        ]}
                                    >
                                        {labelEstadoAutorizacion(item.estadoAutorizacion)}
                                    </Text>
                                </View>
                                <Text style={styles.monto}>{formatCurrency(item.cantidad)}</Text>
                                <MedioPagoBadge
                                    esSolicitudCredito={item.esSolicitudCredito}
                                    esEfectivo={item.esEfectivo}
                                    compact
                                />
                            </View>
                        </View>

                        <View style={styles.acciones}>
                            <TouchableOpacity
                                style={styles.btnComentarios}
                                onPress={() => setComentariosModalItem(item)}
                            >
                                <MaterialCommunityIcons
                                    name="comment-text-outline"
                                    size={16}
                                    color={(item.totalComentarios || 0) > 0 ? '#2563EB' : '#64748B'}
                                />
                                <Text style={styles.btnComentariosText}>
                                    Comentarios ({item.totalComentarios || 0})
                                </Text>
                            </TouchableOpacity>
                            {item.puedeEditar ? (
                                <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEditar(item)}>
                                    <Text style={styles.btnEditarText}>Editar</Text>
                                </TouchableOpacity>
                            ) : null}
                            {item.puedeEliminar ? (
                                <TouchableOpacity style={styles.btnEliminar} onPress={() => confirmarEliminar(item)}>
                                    <Text style={styles.btnEliminarText}>Eliminar</Text>
                                </TouchableOpacity>
                            ) : null}
                            {item.puedeAutorizar ? (
                                <>
                                    <TouchableOpacity style={styles.btnOk} onPress={() => handleAutorizar(item)}>
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
                                        <Text style={styles.btnNoText}>No autorizar</Text>
                                    </TouchableOpacity>
                                </>
                            ) : null}
                            {item.puedeRegistrarGasto && onRegistrarGasto ? (
                                <TouchableOpacity style={styles.btnRegistrar} onPress={() => onRegistrarGasto(item)}>
                                    <Text style={styles.btnRegistrarText}>Registrar gasto</Text>
                                </TouchableOpacity>
                            ) : null}
                            {item.gastoId ? (
                                <Text style={styles.usada}>Gasto registrado #{item.gastoId}</Text>
                            ) : null}
                        </View>
                    </View>
                ))
            )}

            <TouchableOpacity style={styles.addButton} onPress={abrirRegistro}>
                <Text style={styles.addButtonText}>+ Registrar gasto</Text>
            </TouchableOpacity>

            <Modal visible={showRegistroModal} transparent animationType="fade">
                <View style={styles.overlay}>
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
                        <View style={styles.modalBox}>
                            {pasoRegistro === 'rubro' ? (
                                <>
                                    <Text style={styles.modalTitle}>Registrar gasto</Text>
                                    <Text style={styles.modalHint}>Seleccione el tipo de gasto o rubro para continuar.</Text>

                                    <Text style={styles.label}>Rubro *</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker
                                            selectedValue={rubroSeleccionadoId}
                                            onValueChange={setRubroSeleccionadoId}
                                        >
                                            <Picker.Item label="Seleccione un rubro..." value="" />
                                            {rubrosActivos.map((r) => (
                                                <Picker.Item key={r.id} label={r.nombre} value={String(r.id)} />
                                            ))}
                                        </Picker>
                                    </View>

                                    {rubroSeleccionado && onRegistrarDirecto && esRubroSinAutorizacion(rubroSeleccionado.nombre) ? (
                                        <Text style={styles.hintDirecto}>
                                            Horas extras y recargos se registran directamente, sin autorización previa.
                                        </Text>
                                    ) : rubroSeleccionado ? (
                                        <Text style={styles.hintAuth}>
                                            Este rubro requiere autorización de Nohora Ortiz antes del registro completo.
                                        </Text>
                                    ) : (
                                        <Text style={styles.hintNeutral}>Seleccione un rubro para continuar...</Text>
                                    )}

                                    <View style={styles.modalFooter}>
                                        <TouchableOpacity style={styles.btnCancel} onPress={cerrarRegistroModal}>
                                            <Text>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.btnOk} onPress={continuarDesdeRubro}>
                                            <Text style={styles.btnOkText}>Continuar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.backLink}
                                        onPress={() => setPasoRegistro('rubro')}
                                    >
                                        <Text style={styles.backLinkText}>← Cambiar rubro</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.modalTitle}>Registrar gasto</Text>
                                    {rubroSeleccionado ? (
                                        <Text style={styles.rubroBadge}>Rubro: {rubroSeleccionado.nombre}</Text>
                                    ) : null}
                                    <Text style={styles.modalHint}>
                                        Complete estos datos. Nohora Ortiz debe autorizar antes de continuar con el registro completo.
                                    </Text>

                                    <Text style={styles.label}>Proveedor *</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker
                                            selectedValue={form.proveedorId}
                                            onValueChange={(v) => setForm((p) => ({ ...p, proveedorId: v }))}
                                        >
                                            <Picker.Item label="Seleccionar proveedor..." value="" />
                                            {proveedoresFiltrados.length === 0 ? (
                                                <Picker.Item label="(Sin proveedores para este rubro)" value="" />
                                            ) : null}
                                            {proveedoresFiltrados.map((p) => (
                                                <Picker.Item key={p.id} label={p.nombre} value={String(p.id)} />
                                            ))}
                                        </Picker>
                                    </View>

                                    <Text style={styles.label}>Fecha aproximada del gasto *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form.fechaAproximada}
                                        onChangeText={(t) => setForm((p) => ({ ...p, fechaAproximada: t }))}
                                        placeholder="YYYY-MM-DD"
                                    />

                                    <Text style={styles.label}>Cantidad (monto) *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form.cantidad}
                                        onChangeText={(t) => setForm((p) => ({ ...p, cantidad: t.replace(/[^\d.]/g, '') }))}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />

                                    <Text style={styles.label}>Razón del gasto *</Text>
                                    <TextInput
                                        style={[styles.input, styles.inputMultiline]}
                                        value={form.razon}
                                        onChangeText={(t) => setForm((p) => ({ ...p, razon: t }))}
                                        multiline
                                        numberOfLines={3}
                                        placeholder="Explique para qué es el gasto..."
                                    />

                                    <MedioPagoGastoControls
                                        value={medioPago}
                                        onChange={setMedioPago}
                                        colors={{
                                            text: '#111',
                                            subText: '#64748b',
                                            primary: '#2563EB',
                                            border: '#E5E7EB',
                                            card: '#fff',
                                        }}
                                    />

                                    <View style={styles.modalFooter}>
                                        <TouchableOpacity style={styles.btnCancel} onPress={cerrarRegistroModal}>
                                            <Text>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btnOk, saving && { opacity: 0.6 }]}
                                            onPress={enviarSolicitud}
                                            disabled={saving}
                                        >
                                            <Text style={styles.btnOkText}>{saving ? 'Guardando…' : editTarget ? 'Guardar' : 'Enviar'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            <Modal visible={showRechazoModal} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Motivo del rechazo</Text>
                        <TextInput
                            style={[styles.input, styles.inputMultiline]}
                            value={motivoRechazo}
                            onChangeText={setMotivoRechazo}
                            multiline
                            placeholder="Indique por qué no se autoriza..."
                        />
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowRechazoModal(false)}>
                                <Text>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnNo, saving && { opacity: 0.6 }]}
                                onPress={confirmarRechazo}
                                disabled={saving}
                            >
                                <Text style={styles.btnNoText}>Confirmar rechazo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <GastoAutorizacionComentariosModal
                visible={!!comentariosModalItem}
                solicitud={comentariosModalItem}
                onClose={() => setComentariosModalItem(null)}
                onComentariosActualizados={handleComentariosActualizados}
                colors={comentariosTheme}
                isDarkMode={false}
                cardBg="#FFFFFF"
                inputBg="#F8FAFC"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: 16, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
    addButton: {
        backgroundColor: '#2563EB',
        marginTop: 4,
        marginBottom: 8,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    filtrosRow: { marginBottom: 10, maxHeight: 40 },
    filtroChip: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        backgroundColor: '#fff',
    },
    filtroChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    filtroChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
    filtroChipTextActive: { color: '#fff' },
    empty: { color: '#64748B', fontSize: 13, marginVertical: 8 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 12,
        marginBottom: 10,
    },
    cardTop: { flexDirection: 'row', gap: 10 },
    proveedor: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    rubroTag: { fontSize: 12, fontWeight: '600', color: '#2563EB', marginTop: 2 },
    meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
    razon: { fontSize: 13, color: '#334155', marginTop: 6 },
    rechazo: { fontSize: 12, color: '#B91C1C', marginTop: 6, fontWeight: '600' },
    monto: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    btnComentarios: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    btnComentariosText: { color: '#475569', fontWeight: '700', fontSize: 12 },
    btnOk: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    btnOkText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    btnNo: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    btnNoText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    btnRegistrar: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    btnRegistrarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    btnEditar: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    btnEditarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    btnEliminar: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    btnEliminarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    usada: { fontSize: 12, color: '#64748B', alignSelf: 'center' },
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
    modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    modalHint: { fontSize: 12, color: '#64748B', marginBottom: 12 },
    rubroBadge: { fontSize: 13, fontWeight: '700', color: '#2563EB', marginBottom: 8 },
    hintDirecto: { fontSize: 12, color: '#059669', marginTop: 8, fontStyle: 'italic' },
    hintAuth: { fontSize: 12, color: '#B45309', marginTop: 8, fontStyle: 'italic' },
    hintNeutral: { fontSize: 12, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' },
    backLink: { marginBottom: 8 },
    backLinkText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 8 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, fontSize: 14 },
    inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
    pickerWrap: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, overflow: 'hidden' },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    btnCancel: { paddingHorizontal: 14, paddingVertical: 10 },
});
