import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/productionApi';

interface ConsolidadoRow {
    encuestaId: number;
    fecha: string;
    ordenProduccion: string;
    cliente?: string;
    referencia?: string;
    material?: string;
    cantidadTotal: number;
    cantidadRecuperada: number;
    cantidadParaDespacho: number;
    descripcionNovedad?: string;
    totalProcesos: number;
    // NC data
    ncId?: number;
    tipoReclamacion?: string;
    cantidadNC: number;
    item?: string;
    tipoDefecto?: string;
    responsable?: string;
    areaInvolucrada?: string;
    cargo?: string;
    valorNC: number;
    producto?: string;
    salidaNC?: string;
    controles?: string;
    ncCompleto: boolean;
}

const emptyNCForm = {
    tipoReclamacion: '',
    cantidadNC: '0',
    item: '',
    tipoDefecto: '',
    responsable: '',
    areaInvolucrada: '',
    cargo: '',
    valorNC: '0',
    producto: '',
    salidaNC: '',
    controles: '',
};

export default function ConsolidadoNCView() {
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [rows, setRows] = useState<ConsolidadoRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRow, setSelectedRow] = useState<ConsolidadoRow | null>(null);
    const [formData, setFormData] = useState({ ...emptyNCForm });

    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`consolidadonc/consolidado?mes=${mes}&anio=${anio}`);
            setRows(res.data);
        } catch (err) {
            console.error('Error loading consolidado', err);
        } finally {
            setLoading(false);
        }
    }, [mes, anio]);

    useEffect(() => { loadData(); }, [loadData]);

    const openEdit = (row: ConsolidadoRow) => {
        setSelectedRow(row);
        setFormData({
            tipoReclamacion: row.tipoReclamacion || '',
            cantidadNC: (row.cantidadNC || 0).toString(),
            item: row.item || '',
            tipoDefecto: row.tipoDefecto || '',
            responsable: row.responsable || '',
            areaInvolucrada: row.areaInvolucrada || '',
            cargo: row.cargo || '',
            valorNC: (row.valorNC || 0).toString(),
            producto: row.producto || '',
            salidaNC: row.salidaNC || '',
            controles: row.controles || '',
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!selectedRow) return;
        try {
            await api.post('consolidadonc/guardar', {
                ncId: selectedRow.ncId || null,
                encuestaProduccionId: selectedRow.encuestaId,
                tipoReclamacion: formData.tipoReclamacion,
                cantidadNC: parseFloat(formData.cantidadNC) || 0,
                item: formData.item,
                tipoDefecto: formData.tipoDefecto,
                responsable: formData.responsable,
                areaInvolucrada: formData.areaInvolucrada,
                cargo: formData.cargo,
                valorNC: parseFloat(formData.valorNC) || 0,
                producto: formData.producto,
                salidaNC: formData.salidaNC,
                controles: formData.controles,
            });
            setModalVisible(false);
            loadData();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Error al guardar';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString();
    const formatCurrency = (v: number) => `$${(v || 0).toLocaleString('es-CO')}`;
    const setField = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

    const pendientes = rows.filter(r => !r.ncCompleto).length;
    const completas = rows.filter(r => r.ncCompleto).length;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>📋 Consolidado de NC</Text>
                <View style={styles.statsRow}>
                    <View style={[styles.statBadge, { backgroundColor: '#FED7D7' }]}>
                        <Text style={[styles.statText, { color: '#C53030' }]}>⚠️ Pendientes: {pendientes}</Text>
                    </View>
                    <View style={[styles.statBadge, { backgroundColor: '#C6F6D5' }]}>
                        <Text style={[styles.statText, { color: '#276749' }]}>✅ Completas: {completas}</Text>
                    </View>
                    <View style={[styles.statBadge, { backgroundColor: '#E2E8F0' }]}>
                        <Text style={[styles.statText, { color: '#4A5568' }]}>📊 Total: {rows.length}</Text>
                    </View>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Mes:</Text>
                    <View style={styles.pickerWrap}>
                        <Picker selectedValue={mes} onValueChange={(v) => setMes(Number(v))} style={styles.picker}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                <Picker.Item key={m} label={meses[m]} value={m} />
                            ))}
                        </Picker>
                    </View>
                </View>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Año:</Text>
                    <View style={styles.pickerWrap}>
                        <Picker selectedValue={anio} onValueChange={(v) => setAnio(Number(v))} style={styles.picker}>
                            {[2024, 2025, 2026].map(a => (
                                <Picker.Item key={a} label={a.toString()} value={a} />
                            ))}
                        </Picker>
                    </View>
                </View>
                <TouchableOpacity style={styles.btnRefresh} onPress={loadData}>
                    <Text style={styles.btnText}>🔄 Actualizar</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3182CE" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView horizontal>
                    <View>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: 55 }]}>NC #</Text>
                            <Text style={[styles.th, { width: 85 }]}>Fecha</Text>
                            <Text style={[styles.th, { width: 65 }]}>OP</Text>
                            <Text style={[styles.th, { width: 120 }]}>Cliente</Text>
                            <Text style={[styles.th, { width: 150 }]}>Referencia</Text>
                            <Text style={[styles.th, { width: 110 }]}>Tipo Reclam.</Text>
                            <Text style={[styles.th, { width: 70 }]}>Cant NC</Text>
                            <Text style={[styles.th, { width: 80 }]}>Cant Total</Text>
                            <Text style={[styles.th, { width: 90 }]}>Item</Text>
                            <Text style={[styles.th, { width: 160 }]}>Desc. Novedad</Text>
                            <Text style={[styles.th, { width: 110 }]}>Tipo Defecto</Text>
                            <Text style={[styles.th, { width: 110 }]}>Responsable</Text>
                            <Text style={[styles.th, { width: 110 }]}>Área</Text>
                            <Text style={[styles.th, { width: 90 }]}>Cargo</Text>
                            <Text style={[styles.th, { width: 100 }]}>Valor NC</Text>
                            <Text style={[styles.th, { width: 110 }]}>Producto</Text>
                            <Text style={[styles.th, { width: 110 }]}>Salida NC</Text>
                            <Text style={[styles.th, { width: 110 }]}>Controles</Text>
                            <Text style={[styles.th, { width: 70 }]}>Acción</Text>
                        </View>

                        {/* Table Body */}
                        <ScrollView style={{ maxHeight: 500 }}>
                            {rows.length === 0 ? (
                                <View style={styles.emptyRow}>
                                    <Text style={styles.emptyText}>No hay encuestas de producción para este período</Text>
                                </View>
                            ) : (
                                rows.map((row, idx) => {
                                    const isPending = !row.ncCompleto;
                                    const bgColor = isPending
                                        ? '#FFFAF0' // warm yellow for pending
                                        : (idx % 2 === 0 ? '#fff' : '#F7FAFC');
                                    const borderLeft = isPending ? '#ED8936' : 'transparent';

                                    return (
                                        <TouchableOpacity
                                            key={row.encuestaId}
                                            style={[styles.row, { backgroundColor: bgColor, borderLeftWidth: 3, borderLeftColor: borderLeft }]}
                                            onPress={() => openEdit(row)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.cell, { width: 55, fontWeight: 'bold', color: row.ncId ? '#2D3748' : '#A0AEC0' }]}>
                                                {row.ncId || '—'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 85 }]}>{formatDate(row.fecha)}</Text>
                                            <Text style={[styles.cell, { width: 65, fontWeight: 'bold' }]}>{row.ordenProduccion}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{row.cliente || '-'}</Text>
                                            <Text style={[styles.cell, { width: 150 }]} numberOfLines={1}>{row.referencia || '-'}</Text>
                                            <Text style={[styles.cell, { width: 110, color: row.tipoReclamacion ? '#2D3748' : '#E57373' }]}>
                                                {row.tipoReclamacion || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 70, fontWeight: 'bold', color: row.cantidadNC > 0 ? '#E53E3E' : '#E57373' }]}>
                                                {row.cantidadNC}
                                            </Text>
                                            <Text style={[styles.cell, { width: 80 }]}>{row.cantidadTotal}</Text>
                                            <Text style={[styles.cell, { width: 90, color: row.item ? '#2D3748' : '#E57373' }]}>
                                                {row.item || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 160 }]} numberOfLines={2}>
                                                {row.descripcionNovedad || '-'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.tipoDefecto ? '#2D3748' : '#E57373' }]}>
                                                {row.tipoDefecto || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.responsable ? '#2D3748' : '#E57373' }]}>
                                                {row.responsable || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.areaInvolucrada ? '#2D3748' : '#E57373' }]}>
                                                {row.areaInvolucrada || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 90, color: row.cargo ? '#2D3748' : '#E57373' }]}>
                                                {row.cargo || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 100, fontWeight: 'bold', color: row.valorNC > 0 ? '#38A169' : '#E57373' }]}>
                                                {row.valorNC > 0 ? formatCurrency(row.valorNC) : '$0'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.producto ? '#2D3748' : '#E57373' }]}>
                                                {row.producto || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.salidaNC ? '#2D3748' : '#E57373' }]}>
                                                {row.salidaNC || 'Sin llenar'}
                                            </Text>
                                            <Text style={[styles.cell, { width: 110, color: row.controles ? '#2D3748' : '#E57373' }]}>
                                                {row.controles || 'Sin llenar'}
                                            </Text>
                                            <View style={[styles.cell, { width: 70, alignItems: 'center' }]}>
                                                <View style={[styles.editBadge, { backgroundColor: isPending ? '#ED8936' : '#3182CE' }]}>
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                                        {isPending ? 'Llenar' : 'Editar'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </ScrollView>
            )}

            {/* Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>
                                {selectedRow?.ncId ? '✏️ Editar Datos NC' : '📝 Llenar Datos NC'}
                            </Text>

                            {/* Info from encuesta (read-only) */}
                            {selectedRow && (
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoTitle}>Datos de la Encuesta de Producción</Text>
                                    <View style={styles.infoGrid}>
                                        <Text style={styles.infoItem}>📅 Fecha: <Text style={styles.infoValue}>{formatDate(selectedRow.fecha)}</Text></Text>
                                        <Text style={styles.infoItem}>📦 OP: <Text style={styles.infoValue}>{selectedRow.ordenProduccion}</Text></Text>
                                        <Text style={styles.infoItem}>👤 Cliente: <Text style={styles.infoValue}>{selectedRow.cliente || '-'}</Text></Text>
                                        <Text style={styles.infoItem}>📄 Referencia: <Text style={styles.infoValue}>{selectedRow.referencia || '-'}</Text></Text>
                                        <Text style={styles.infoItem}>📊 Cantidad Total: <Text style={styles.infoValue}>{selectedRow.cantidadTotal}</Text></Text>
                                        <Text style={styles.infoItem}>📝 Novedad: <Text style={styles.infoValue}>{selectedRow.descripcionNovedad || '-'}</Text></Text>
                                    </View>
                                </View>
                            )}

                            <Text style={styles.sectionTitle}>Campos NC (ingreso manual)</Text>

                            {/* Manual fields in 2-column grid */}
                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Tipo Reclamación</Text>
                                    <TextInput style={styles.input} value={formData.tipoReclamacion} onChangeText={(v) => setField('tipoReclamacion', v)} placeholder="Ej: Nuevo, Repetido..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Cantidad NC</Text>
                                    <TextInput style={styles.input} value={formData.cantidadNC} onChangeText={(v) => setField('cantidadNC', v)} keyboardType="numeric" />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Item</Text>
                                    <TextInput style={styles.input} value={formData.item} onChangeText={(v) => setField('item', v)} placeholder="Item..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Tipo de Defecto</Text>
                                    <TextInput style={styles.input} value={formData.tipoDefecto} onChangeText={(v) => setField('tipoDefecto', v)} placeholder="Tipo de defecto..." />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Responsable</Text>
                                    <TextInput style={styles.input} value={formData.responsable} onChangeText={(v) => setField('responsable', v)} placeholder="Nombre..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Área Involucrada</Text>
                                    <TextInput style={styles.input} value={formData.areaInvolucrada} onChangeText={(v) => setField('areaInvolucrada', v)} placeholder="Área..." />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Cargo</Text>
                                    <TextInput style={styles.input} value={formData.cargo} onChangeText={(v) => setField('cargo', v)} placeholder="Cargo..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Valor NC (COP $)</Text>
                                    <TextInput style={styles.input} value={formData.valorNC} onChangeText={(v) => setField('valorNC', v)} keyboardType="numeric" placeholder="0" />
                                </View>
                            </View>

                            <View style={styles.formGrid}>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Producto</Text>
                                    <TextInput style={styles.input} value={formData.producto} onChangeText={(v) => setField('producto', v)} placeholder="Producto..." />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.formLabel}>Salida NC</Text>
                                    <TextInput style={styles.input} value={formData.salidaNC} onChangeText={(v) => setField('salidaNC', v)} placeholder="Salida NC..." />
                                </View>
                            </View>

                            <View style={{ marginBottom: 12 }}>
                                <Text style={styles.formLabel}>Controles</Text>
                                <TextInput style={[styles.input, { height: 70 }]} value={formData.controles} onChangeText={(v) => setField('controles', v)} multiline placeholder="Controles aplicados..." />
                            </View>

                            {/* Buttons */}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                    <Text style={styles.saveBtnText}>💾 Guardar NC</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15, backgroundColor: '#F5F7FA' },
    header: { marginBottom: 12 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 8 },
    statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    statBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    statText: { fontSize: 12, fontWeight: '700' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, flexWrap: 'wrap' },
    filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568' },
    pickerWrap: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, backgroundColor: '#fff', height: 36, justifyContent: 'center', minWidth: 120 },
    picker: { height: 36 },
    btnRefresh: { backgroundColor: '#3182CE', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#2D3748', padding: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
    th: { color: '#fff', fontWeight: 'bold', fontSize: 11, paddingHorizontal: 3 },
    row: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', cursor: 'pointer' as any },
    cell: { fontSize: 11, color: '#2D3748', paddingHorizontal: 3 },
    emptyRow: { padding: 30, alignItems: 'center' },
    emptyText: { color: '#A0AEC0', fontStyle: 'italic' },
    editBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '92%', maxWidth: 750, maxHeight: '92%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748', marginBottom: 12, textAlign: 'center' },
    infoBox: { backgroundColor: '#EBF8FF', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3182CE' },
    infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#2C5282', marginBottom: 8 },
    infoGrid: { gap: 4 },
    infoItem: { fontSize: 12, color: '#4A5568' },
    infoValue: { fontWeight: 'bold', color: '#2D3748' },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A5568', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 4 },
    formGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    formCol: { flex: 1 },
    formLabel: { fontSize: 12, fontWeight: '600', color: '#4A5568', marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, padding: 8, fontSize: 13, backgroundColor: '#fff' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E0' },
    cancelBtnText: { color: '#4A5568', fontWeight: '600' },
    saveBtn: { backgroundColor: '#38A169', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
    saveBtnText: { color: '#fff', fontWeight: 'bold' },
});
