import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/productionApi';

export default function DayDetailModal({ visible, onClose, onSaveSuccess, dayInfo, actividades }) {
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState([]);

    useEffect(() => {
        if (visible && dayInfo) {
            if (dayInfo.produccionDiariaId) {
                loadDetails();
            } else {
                setDetails([createEmptyDetailRow()]);
            }
        } else {
            setDetails([]);
        }
    }, [visible, dayInfo]);

    const createEmptyDetailRow = () => ({
        horaInicio: '',
        horaFin: '',
        actividadId: 0,
        tiros: 0,
        referenciaOP: '',
        observaciones: ''
    });

    const loadDetails = async () => {
        setLoading(true);
        try {
            console.log("[DEBUG] Modal fetching details for:", dayInfo.produccionDiariaId);
            const res = await api.get(`produccion/dia-detalle/${dayInfo.produccionDiariaId}`);
            const existing = res.data || [];
            if (existing.length === 0) {
                setDetails([createEmptyDetailRow()]);
            } else {
                setDetails([...existing, createEmptyDetailRow()]);
            }
        } catch (e) {
            console.error('Error loading day details:', e);
            const msg = 'No se pudieron cargar los detalles del día.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('Error', msg);
            setDetails([createEmptyDetailRow()]);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Check if activity is "Producción" (código 02)
    const isProduccionActivity = (actividadId) => {
        if (!actividadId || actividadId == 0) return false;
        // Use == (loose) because Picker on web may return string values
        const act = actividades.find(a => (a.id || a.Id) == actividadId);
        if (!act) return false;
        const codigo = (act.codigo || act.Codigo || '').toString().trim();
        const nombre = (act.nombre || act.Nombre || '').toLowerCase();
        return codigo === '02' || nombre.includes('producc');
    };

    const updateDetailRow = (index, field, value) => {
        const updated = [...details];
        updated[index] = { ...updated[index], [field]: value };

        // If activity changed to non-production, reset Tiros only
        if (field === 'actividadId' && !isProduccionActivity(value)) {
            updated[index].tiros = 0;
        }

        setDetails(updated);

        // Auto-add new row if last row has data
        const lastRow = updated[updated.length - 1];
        if (index === updated.length - 1 && lastRow.horaInicio && lastRow.horaFin && lastRow.actividadId) {
            setDetails([...updated, createEmptyDetailRow()]);
        }
    };

    const insertRowAbove = (index) => {
        const newRow = createEmptyDetailRow();

        // Smart Time Calculation
        // End time of new row = Start time of current row
        if (details[index].horaInicio) {
            newRow.horaFin = details[index].horaInicio;
        }
        // Start time of new row = End time of previous row (if exists)
        if (index > 0 && details[index - 1].horaFin) {
            newRow.horaInicio = details[index - 1].horaFin;
        }

        const updated = [...details];
        updated.splice(index, 0, newRow);
        setDetails(updated);
    };

    const insertRowBelow = (index) => {
        const newRow = createEmptyDetailRow();

        // Smart Time Calculation
        // Start time of new row = End time of current row
        if (details[index].horaFin) {
            newRow.horaInicio = details[index].horaFin;
        }
        // End time of new row = Start time of next row (if exists)
        if (index < details.length - 1 && details[index + 1].horaInicio) {
            newRow.horaFin = details[index + 1].horaInicio;
        }

        const updated = [...details];
        updated.splice(index + 1, 0, newRow);
        setDetails(updated);
    };

    const deleteDetailRow = (index) => {
        if (details.length <= 1) return;
        const updated = details.filter((_, i) => i !== index);
        setDetails(updated);
    };

    const calculateDuration = (start, end) => {
        if (!start || !end) return '-';
        try {
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;
            let diff = endMins - startMins;
            if (diff < 0) diff += 1440; // Handles crossing midnight
            const hours = Math.floor(diff / 60);
            const mins = diff % 60;
            return `${hours}h ${mins}m`;
        } catch {
            return '-';
        }
    };

    const saveDayDetail = async () => {
        const validRows = details.filter(r => r.horaInicio && r.horaFin && r.actividadId);
        if (validRows.length === 0) {
            Alert.alert('Aviso', 'No hay filas válidas para guardar (requiere Inicio, Fin y Actividad)');
            return;
        }

        setLoading(true);
        try {
            let currentId = dayInfo.produccionDiariaId;

            // 1. If no header ID, create it first using produccion/mensual (partial)
            if (!currentId) {
                console.log("[DEBUG] No header ID found, creating it first...");
                // Build a minimal header record
                const headerPayload = [{
                    Fecha: dayInfo.fechaISO || dayInfo.fecha, // Expecting ISO or what we have
                    UsuarioId: Number(dayInfo.usuarioId),
                    MaquinaId: Number(dayInfo.maquinaId),
                    DiaLaborado: 1
                }];

                console.log("[DEBUG] headerPayload:", JSON.stringify(headerPayload));
                const headerRes = await api.post('produccion/mensual', headerPayload);
                console.log("[DEBUG] headerRes response:", JSON.stringify(headerRes.data));

                const results = headerRes.data?.results;
                if (results && results.length > 0) {
                    currentId = results[0].id;
                    console.log("[DEBUG] Created header ID:", currentId);
                } else {
                    console.warn("[DEBUG] Results missing or empty in response:", headerRes.data);
                    throw new Error("No se pudo obtener el ID del nuevo registro principal.");
                }
            }

            // 2. Save the details using the currentId
            const payload = validRows.map(r => ({
                produccionDiariaId: Number(currentId),
                horaInicio: r.horaInicio,
                horaFin: r.horaFin,
                actividadId: Number(r.actividadId),
                tiros: Number(r.tiros) || 0,
                referenciaOP: r.referenciaOP || '',
                observaciones: r.observaciones || ''
            }));

            console.log("[DEBUG] Saving payload:", payload);
            await api.post('produccion/dia-detalle', payload);

            Alert.alert('Éxito', 'Detalles guardados correctamente');

            // Return BOTH the payload and the new ID if we created one
            if (onSaveSuccess) onSaveSuccess(payload, currentId);
            if (onClose) onClose();
        } catch (e) {
            console.error('Error saving day details:', e);
            const errorMsg = e.response?.data?.message || e.message || "Error desconocido";
            Alert.alert('Error', `No se pudieron guardar los detalles: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { maxWidth: 900, maxHeight: '90%', width: '95%' }]}>
                    <Text style={styles.modalTitle}>📋 Día Detallado</Text>
                    <View style={styles.infoRow}>
                        <Text><Text style={{ fontWeight: 'bold' }}>Operario:</Text> {dayInfo?.operario || 'N/A'}</Text>
                        <Text><Text style={{ fontWeight: 'bold' }}>Fecha:</Text> {dayInfo?.fecha || 'N/A'}</Text>
                        <Text><Text style={{ fontWeight: 'bold' }}>Máquina:</Text> {dayInfo?.maquina || 'N/A'}</Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#2980b9" style={{ margin: 20 }} />
                    ) : (
                        <ScrollView style={{ maxHeight: 400 }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerText, { width: 70 }]}>Inicio</Text>
                                <Text style={[styles.headerText, { width: 70 }]}>Fin</Text>
                                <Text style={[styles.headerText, { width: 60 }]}>Tiempo</Text>
                                <Text style={[styles.headerText, { flex: 1.5 }]}>Actividad</Text>
                                <Text style={[styles.headerText, { width: 70, marginLeft: 2 }]}>OP</Text>
                                <Text style={[styles.headerText, { width: 70, marginLeft: 2 }]}>Tiros</Text>
                                <Text style={[styles.headerText, { flex: 1 }]}>Observaciones</Text>
                                <Text style={{ width: 90, textAlign: 'center', color: 'white', fontWeight: 'bold' }}>Acciones</Text>
                            </View>

                            {details.map((row, idx) => (
                                <View key={idx} style={[styles.row, { backgroundColor: idx % 2 === 0 ? '#f5f9ff' : 'white' }]}>
                                    <TextInput
                                        style={styles.timeInput}
                                        value={row.horaInicio}
                                        placeholder="HH:MM"
                                        onChangeText={(v) => updateDetailRow(idx, 'horaInicio', v)}
                                    />
                                    <TextInput
                                        style={styles.timeInput}
                                        value={row.horaFin}
                                        placeholder="HH:MM"
                                        onChangeText={(v) => updateDetailRow(idx, 'horaFin', v)}
                                    />
                                    <Text style={{ width: 60, textAlign: 'center', fontSize: 12 }}>
                                        {calculateDuration(row.horaInicio, row.horaFin)}
                                    </Text>
                                    <View style={{ flex: 1.5 }}>
                                        <Picker
                                            selectedValue={row.actividadId}
                                            style={{ height: 30, fontSize: 11 }}
                                            onValueChange={(v) => updateDetailRow(idx, 'actividadId', v)}
                                        >
                                            <Picker.Item label="Seleccionar..." value={0} />
                                            {actividades.map(a => (
                                                <Picker.Item key={a.id} label={`${a.codigo} - ${a.nombre}`} value={a.id} />
                                            ))}
                                        </Picker>
                                    </View>
                                    <TextInput
                                        style={[styles.input, { width: 70 }]}
                                        value={row.referenciaOP || ''}
                                        placeholder="OP"
                                        onChangeText={(v) => updateDetailRow(idx, 'referenciaOP', v)}
                                    />
                                    <TextInput
                                        style={[styles.input, { width: 70 }, !isProduccionActivity(row.actividadId) && { backgroundColor: '#ffe0e0', color: '#999' }]}
                                        value={String(row.tiros || 0)}
                                        keyboardType="numeric"
                                        editable={isProduccionActivity(row.actividadId)}
                                        onChangeText={(v) => updateDetailRow(idx, 'tiros', parseInt(v) || 0)}
                                    />
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        value={row.observaciones || ''}
                                        placeholder="Obs..."
                                        onChangeText={(v) => updateDetailRow(idx, 'observaciones', v)}
                                    />

                                    {/* Action Buttons */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', width: 90, justifyContent: 'space-around' }}>
                                        <TouchableOpacity onPress={() => insertRowAbove(idx)} style={[styles.actionBtn, { backgroundColor: '#e0f2f1' }]}>
                                            <Text style={[styles.actionBtnText, { color: '#00695c' }]}>↑</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => insertRowBelow(idx)} style={[styles.actionBtn, { backgroundColor: '#e3f2fd' }]}>
                                            <Text style={[styles.actionBtnText, { color: '#1565c0' }]}>↓</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => deleteDetailRow(idx)} style={[styles.actionBtn, { backgroundColor: '#ffecec' }]}>
                                            <Text style={[styles.actionBtnText, { color: 'red' }]}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: '#27ae60' }]} onPress={saveDayDetail}>
                            <Text style={styles.btnText}>💾 Guardar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: '#95a5a6' }]} onPress={onClose}>
                            <Text style={styles.btnText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, padding: 10, backgroundColor: '#f0f8ff', borderRadius: 5 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#2980b9', padding: 8, borderRadius: 4 },
    headerText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
    row: { flexDirection: 'row', padding: 4, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
    timeInput: { width: 70, borderWidth: 1, borderColor: '#ccc', padding: 4, borderRadius: 3, textAlign: 'center', marginRight: 2 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 4, borderRadius: 3, textAlign: 'center', marginLeft: 2 },
    buttonRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
    btn: { flex: 1, padding: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: 'bold' },
    actionBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
    actionBtnText: { fontSize: 14, fontWeight: 'bold' }
});
