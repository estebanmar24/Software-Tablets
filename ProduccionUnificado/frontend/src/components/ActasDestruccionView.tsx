import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Platform, TextInput } from 'react-native';
import { api, API_URL } from '../services/productionApi';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const SERVER_URL = API_URL.replace('/api', '');

interface ActaProceso {
    id?: number;
    proceso: string;
    motivo: string;
    cantidad: number;
}

interface ActaResumen {
    id: number;
    fecha: string;
    ordenProduccion: string;
    cliente: string;
    producto: string;
    cantidadActaDestruccion: number;
    procesoReporta: string;
    estado: string;
    tienePdf: boolean;
    fechaCreacion: string;
}

interface ActaDetalle {
    id: number;
    fecha: string;
    ordenProduccion: string;
    cliente: string;
    producto: string;
    cantidadActaDestruccion: number;
    motivo: string;
    procesoReporta: string;
    cantidadOP: number;
    cantidadRealDespachada: number;
    faltante: number;
    estado: string;
    archivoPdfUrl?: string;
    fechaCreacion: string;
    procesos: ActaProceso[];
}

const PROCESOS = [
    "Conversión", "Corrugadora", "Guillotina", "Impresión", "Laminado",
    "Estampado", "Troquelado", "Screen", "Colaminadora", "Despique",
    "Pegadora", "Terminados", "Taller Externo", "Tejedora",
    "Diseño", "Facturación", "Despachos", "Comercial"
];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ActasDestruccionView() {
    const [loading, setLoading] = useState(false);
    const [actas, setActas] = useState<ActaResumen[]>([]);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());

    // Form modal
    const [formVisible, setFormVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        ordenProduccion: '',
        cliente: '',
        producto: '',
        cantidadActaDestruccion: '',
        motivo: '',
        procesoReporta: '',
        cantidadOP: '',
        cantidadRealDespachada: '',
        faltante: '',
        estado: 'Terminado',
    });
    const [procesosBreakdown, setProcesosBreakdown] = useState<ActaProceso[]>([{ proceso: '', motivo: '', cantidad: 0 }]);

    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [editId, setEditId] = useState<number | null>(null);

    // Detail modal
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedActa, setSelectedActa] = useState<ActaDetalle | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadActas = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`ActasDestruccion?mes=${mes}&anio=${anio}`);
            setActas(response.data);
        } catch (error) {
            console.error('Error loading actas', error);
        } finally {
            setLoading(false);
        }
    }, [mes, anio]);

    useEffect(() => { loadActas(); }, [loadActas]);

    const resetForm = () => {
        setFormData({
            fecha: new Date().toISOString().split('T')[0],
            ordenProduccion: '',
            cliente: '',
            producto: '',
            cantidadActaDestruccion: '',
            motivo: '',
            procesoReporta: '',
            cantidadOP: '',
            cantidadRealDespachada: '',
            faltante: '',
            estado: 'Terminado',
        });
        setProcesosBreakdown([{ proceso: '', motivo: '', cantidad: 0 }]);
        setPdfBase64(null);
        setPdfFileName(null);
        setEditId(null);
    };

    const addProcesoRow = () => {
        setProcesosBreakdown([{ proceso: '', motivo: '', cantidad: 0 }, ...procesosBreakdown]);
    };

    const removeProcesoRow = (index: number) => {
        const newRows = [...procesosBreakdown];
        newRows.splice(index, 1);
        setProcesosBreakdown(newRows);
    };

    const updateProcesoRow = (index: number, field: keyof ActaProceso, value: any) => {
        const newRows = [...procesosBreakdown];
        newRows[index] = { ...newRows[index], [field]: value };
        setProcesosBreakdown(newRows);

        // Auto-update total quantity if all rows have quantities
        if (field === 'cantidad') {
            const total = newRows.reduce((acc, curr) => acc + (parseFloat(curr.cantidad as any) || 0), 0);
            setFormData(prev => ({ ...prev, cantidadActaDestruccion: total.toString() }));
        }
    };

    const pickPdf = async () => {
        try {
            if (Platform.OS === 'web') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/pdf';
                input.onchange = async (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const base64 = reader.result as string;
                            setPdfBase64(base64);
                            setPdfFileName(file.name);
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            } else {
                const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                    const asset = result.assets[0];
                    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
                    setPdfBase64(`data:application/pdf;base64,${base64}`);
                    setPdfFileName(asset.name);
                }
            }
        } catch (error) {
            console.error('Error picking PDF', error);
        }
    };

    const handleSave = async () => {
        if (!formData.ordenProduccion || !formData.cliente || !formData.producto) {
            Alert.alert('Error', 'Por favor complete los campos obligatorios: OP, Cliente y Producto');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                cantidadActaDestruccion: parseFloat(formData.cantidadActaDestruccion) || 0,
                cantidadOP: parseFloat(formData.cantidadOP) || 0,
                cantidadRealDespachada: parseFloat(formData.cantidadRealDespachada) || 0,
                faltante: parseFloat(formData.faltante) || 0,
                archivoPdfBase64: pdfBase64,
                procesos: procesosBreakdown.map(p => ({
                    ...p,
                    cantidad: parseFloat(p.cantidad as any) || 0
                }))
            };

            if (editId) {
                await api.put(`ActasDestruccion/${editId}`, payload);
                Alert.alert('Éxito', 'Acta de destrucción actualizada correctamente');
            } else {
                await api.post('ActasDestruccion', payload);
                Alert.alert('Éxito', 'Acta de destrucción guardada correctamente');
            }
            setFormVisible(false);
            resetForm();
            loadActas();
        } catch (error: any) {
            console.error('Error saving acta', error);
            Alert.alert('Error', 'No se pudo guardar el acta: ' + (error.response?.data?.message || error.message));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = () => {
        if (!selectedActa) return;
        setEditId(selectedActa.id);
        setFormData({
            fecha: selectedActa.fecha.split('T')[0],
            ordenProduccion: selectedActa.ordenProduccion,
            cliente: selectedActa.cliente,
            producto: selectedActa.producto,
            cantidadActaDestruccion: selectedActa.cantidadActaDestruccion.toString(),
            motivo: selectedActa.motivo || '',
            procesoReporta: selectedActa.procesoReporta || '',
            cantidadOP: selectedActa.cantidadOP.toString(),
            cantidadRealDespachada: selectedActa.cantidadRealDespachada.toString(),
            faltante: selectedActa.faltante.toString(),
            estado: selectedActa.estado,
        });
        setProcesosBreakdown(selectedActa.procesos || []);
        setPdfBase64(null);
        setPdfFileName(selectedActa.archivoPdfUrl ? 'Documento actual' : null);
        setDetailVisible(false);
        setFormVisible(true);
    };

    const openDetail = async (id: number) => {
        setLoadingDetail(true);
        setSelectedActa(null);
        setDetailVisible(true);
        try {
            const response = await api.get(`ActasDestruccion/${id}`);
            setSelectedActa(response.data);
        } catch (error) {
            console.error('Error loading detail', error);
            Alert.alert('Error', 'No se pudo cargar el detalle');
        } finally {
            setLoadingDetail(false);
        }
    };

    const deleteActa = async (id: number) => {
        if (Platform.OS === 'web') {
            if (!window.confirm('¿Está seguro de eliminar esta acta?')) return;
        } else {
            // Alert handle in native
        }
        try {
            await api.delete(`ActasDestruccion/${id}`);
            Alert.alert('Éxito', 'Acta eliminada');
            setDetailVisible(false);
            loadActas();
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el acta');
        }
    };

    const openPdf = (url: string) => {
        const fullUrl = `${SERVER_URL}/${url}`;
        if (Platform.OS === 'web') {
            window.open(fullUrl, '_blank');
        }
    };

    const exportExcel = () => {
        const url = `${API_URL}/ActasDestruccion/export-excel?mes=${mes}&anio=${anio}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Auto-calculate Faltante
    useEffect(() => {
        const op = parseFloat(formData.cantidadOP) || 0;
        const desp = parseFloat(formData.cantidadRealDespachada) || 0;
        const falt = op - desp;
        setFormData(prev => ({ ...prev, faltante: falt.toString() })); // Permite negativos o positivos
    }, [formData.cantidadOP, formData.cantidadRealDespachada]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.filterRow}>
                    <Text style={styles.filterLabel}>Mes:</Text>
                    {Platform.OS === 'web' ? (
                        <select
                            value={mes}
                            onChange={(e: any) => setMes(parseInt(e.target.value))}
                            style={{ height: 36, border: '1px solid #CBD5E0', borderRadius: 6, paddingLeft: 8, fontSize: 14, marginRight: 15 } as any}
                        >
                            {MESES.map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    ) : (
                        <TextInput value={mes.toString()} onChangeText={t => setMes(parseInt(t) || 1)} style={styles.filterInput} keyboardType="numeric" />
                    )}
                    <Text style={styles.filterLabel}>Año:</Text>
                    {Platform.OS === 'web' ? (
                        <select
                            value={anio}
                            onChange={(e: any) => setAnio(parseInt(e.target.value))}
                            style={{ height: 36, border: '1px solid #CBD5E0', borderRadius: 6, paddingLeft: 8, fontSize: 14 } as any}
                        >
                            {[2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    ) : (
                        <TextInput value={anio.toString()} onChangeText={t => setAnio(parseInt(t) || 2026)} style={styles.filterInput} keyboardType="numeric" />
                    )}
                </View>
                <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={loadActas}>
                        <Text style={styles.btnText}>🔄 Actualizar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#38A169', marginLeft: 10 }]} onPress={exportExcel}>
                        <Text style={styles.btnText}>📊 Excel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#DD6B20', marginLeft: 10 }]} onPress={() => { resetForm(); setFormVisible(true); }}>
                        <Text style={styles.btnText}>➕ Nueva Acta</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Table */}
            {loading ? (
                <ActivityIndicator size="large" color="#3182CE" style={{ marginTop: 50 }} />
            ) : (
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { flex: 1 }]}>Fecha</Text>
                        <Text style={[styles.headerCell, { flex: 0.8 }]}>OP</Text>
                        <Text style={[styles.headerCell, { flex: 1.5 }]}>Cliente</Text>
                        <Text style={[styles.headerCell, { flex: 1.5 }]}>Producto</Text>
                        <Text style={[styles.headerCell, { flex: 0.8 }]}>Total Destrucción</Text>
                        <Text style={[styles.headerCell, { flex: 0.8 }]}>Estado</Text>
                        <Text style={[styles.headerCell, { flex: 0.5 }]}>PDF</Text>
                        <Text style={[styles.headerCell, { flex: 0.5, textAlign: 'center' }]}>Acción</Text>
                    </View>
                    <ScrollView style={styles.tableBody}>
                        {actas.length > 0 ? actas.map((a, idx) => (
                            <TouchableOpacity key={a.id} style={[styles.row, idx % 2 === 0 && { backgroundColor: '#F7FAFC' }]} onPress={() => openDetail(a.id)}>
                                <Text style={[styles.cell, { flex: 1 }]}>{new Date(a.fecha).toLocaleDateString()}</Text>
                                <Text style={[styles.cell, { flex: 0.8 }]}>{a.ordenProduccion}</Text>
                                <Text style={[styles.cell, { flex: 1.5 }]} numberOfLines={1}>{a.cliente}</Text>
                                <Text style={[styles.cell, { flex: 1.5 }]} numberOfLines={1}>{a.producto}</Text>
                                <Text style={[styles.cell, { flex: 0.8 }]}>{a.cantidadActaDestruccion.toLocaleString()}</Text>
                                <Text style={[styles.cell, { flex: 0.8, color: a.estado === 'Terminado' ? '#38A169' : '#DD6B20', fontWeight: 'bold' }]}>{a.estado}</Text>
                                <Text style={[styles.cell, { flex: 0.5, textAlign: 'center' }]}>{a.tienePdf ? '📄' : '—'}</Text>
                                <Text style={[styles.cell, { flex: 0.5, textAlign: 'center', color: '#3182CE' }]}>👁️</Text>
                            </TouchableOpacity>
                        )) : (
                            <Text style={styles.emptyText}>No hay actas registradas para este periodo.</Text>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* ======== FORM MODAL ======== */}
            <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 850, width: '95%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editId ? '✏️ Editar Acta de Destrucción' : '📝 Nueva Acta de Destrucción'}</Text>
                            <TouchableOpacity onPress={() => setFormVisible(false)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {/* General Data */}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Información General</Text>
                            </View>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Fecha *</Text>
                                    {Platform.OS === 'web' ? (
                                        <input type="date" value={formData.fecha} onChange={(e: any) => updateField('fecha', e.target.value)} style={styles.webInput as any} />
                                    ) : (
                                        <TextInput style={styles.input} value={formData.fecha} onChangeText={v => updateField('fecha', v)} placeholder="YYYY-MM-DD" />
                                    )}
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>OP *</Text>
                                    <TextInput style={styles.input} value={formData.ordenProduccion} onChangeText={v => updateField('ordenProduccion', v)} placeholder="Número de OP" />
                                </View>
                                <View style={[styles.formGroup, { flex: 1.5 }]}>
                                    <Text style={styles.label}>Cliente *</Text>
                                    <TextInput style={styles.input} value={formData.cliente} onChangeText={v => updateField('cliente', v)} placeholder="Nombre del cliente" />
                                </View>
                            </View>
                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 2 }]}>
                                    <Text style={styles.label}>Producto *</Text>
                                    <TextInput style={styles.input} value={formData.producto} onChangeText={v => updateField('producto', v)} placeholder="Descripción del producto" />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Estado *</Text>
                                    {Platform.OS === 'web' ? (
                                        <select value={formData.estado} onChange={(e: any) => updateField('estado', e.target.value)} style={styles.webInput as any}>
                                            <option value="Terminado">Terminado</option>
                                            <option value="Parcial">Parcial</option>
                                        </select>
                                    ) : (
                                        <TextInput style={styles.input} value={formData.estado} onChangeText={v => updateField('estado', v)} />
                                    )}
                                </View>
                            </View>

                            {/* Processes Breakdown */}
                            <View style={[styles.sectionHeader, { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' }]}>
                                <Text style={styles.sectionTitle}>Desglose de Procesos y Motivos</Text>
                                <TouchableOpacity style={styles.addBtn} onPress={addProcesoRow}>
                                    <Text style={styles.addBtnText}>+ Añadir Proceso</Text>
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.breakdownContainer}>
                                <View style={styles.breakdownHeader}>
                                    <Text style={[styles.breakdownHeaderCell, { flex: 1.5 }]}>Proceso</Text>
                                    <Text style={[styles.breakdownHeaderCell, { flex: 3 }]}>Motivo Específico</Text>
                                    <Text style={[styles.breakdownHeaderCell, { flex: 1 }]}>Cantidad</Text>
                                    <Text style={[styles.breakdownHeaderCell, { flex: 0.5 }]}></Text>
                                </View>
                                {procesosBreakdown.map((row, index) => (
                                    <View key={index} style={styles.breakdownRow}>
                                        <View style={{ flex: 1.5 }}>
                                            {Platform.OS === 'web' ? (
                                                <select value={row.proceso} onChange={(e: any) => updateProcesoRow(index, 'proceso', e.target.value)} style={styles.webInputCompact as any}>
                                                    <option value="">-- Proceso --</option>
                                                    {PROCESOS.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            ) : <TextInput style={styles.inputCompact} value={row.proceso} onChangeText={v => updateProcesoRow(index, 'proceso', v)} />}
                                        </View>
                                        <View style={{ flex: 3, marginLeft: 10 }}>
                                            <TextInput style={styles.inputCompact} value={row.motivo} onChangeText={v => updateProcesoRow(index, 'motivo', v)} placeholder="Escribe el motivo..." />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <TextInput style={styles.inputCompact} value={row.cantidad.toString()} onChangeText={v => updateProcesoRow(index, 'cantidad', v)} keyboardType="numeric" placeholder="0" />
                                        </View>
                                        <TouchableOpacity onPress={() => removeProcesoRow(index)} style={{ flex: 0.5, alignItems: 'center' }}>
                                            <Text style={{ color: '#E53E3E', fontSize: 18 }}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <View style={styles.totalSummaryRow}>
                                    <Text style={styles.totalText}>Total Acta de Destrucción: {formData.cantidadActaDestruccion || '0'}</Text>
                                </View>
                            </View>

                            {/* Extra Quantities */}
                            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                                <Text style={styles.sectionTitle}>Balance de Cantidades OP</Text>
                            </View>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Cantidad OP</Text>
                                    <TextInput style={styles.input} value={formData.cantidadOP} onChangeText={v => updateField('cantidadOP', v)} keyboardType="numeric" />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Cant. Real Despachada</Text>
                                    <TextInput style={styles.input} value={formData.cantidadRealDespachada} onChangeText={v => updateField('cantidadRealDespachada', v)} keyboardType="numeric" />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Faltante / Sobrante</Text>
                                    <View style={[styles.input, { backgroundColor: '#F7FAFC', borderStyle: 'dashed' }]}>
                                        <Text style={{ color: parseFloat(formData.faltante) > 0 ? '#C53030' : '#2F855A', fontWeight: 'bold' }}>
                                            {formData.faltante || '0'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* File */}
                            <View style={{ marginTop: 20 }}>
                                <Text style={styles.label}>Documento Respaldo (PDF)</Text>
                                <TouchableOpacity style={styles.pdfDropZone} onPress={pickPdf}>
                                    <Text style={styles.pdfLabel}>{pdfFileName ? `✅ ${pdfFileName}` : 'Subir archivo PDF'}</Text>
                                    <Text style={styles.pdfSub}>Selecciona el documento oficial de destrucción</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginTop: 30, marginBottom: 20, alignItems: 'center' }}>
                                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                                    {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>💾 {editId ? 'Guardar Cambios' : 'Registrar Acta'}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ======== DETAIL MODAL ======== */}
            <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 750 }]}>
                        <View style={[styles.modalHeader, { backgroundColor: '#2C5282' }]}>
                            <Text style={styles.modalTitle}>🔍 Detalle de Acta #{selectedActa?.id}</Text>
                            <TouchableOpacity onPress={() => setDetailVisible(false)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {loadingDetail ? (
                             <ActivityIndicator size="large" color="#3182CE" style={{ padding: 60 }} />
                        ) : selectedActa ? (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailGrid}>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>FECHA</Text><Text style={styles.detailValue}>{new Date(selectedActa.fecha).toLocaleDateString()}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>ORDEN PRODUCCIÓN</Text><Text style={styles.detailValue}>{selectedActa.ordenProduccion}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>CLIENTE</Text><Text style={styles.detailValue}>{selectedActa.cliente}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>PRODUCTO</Text><Text style={styles.detailValue}>{selectedActa.producto}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>TOTAL DESTRUIDO</Text><Text style={[styles.detailValue, { fontSize: 20, color: '#2C5282' }]}>{selectedActa.cantidadActaDestruccion.toLocaleString()}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>ESTADO</Text><Text style={[styles.detailValue, { color: selectedActa.estado === 'Terminado' ? '#2F855A' : '#C05621' }]}>{selectedActa.estado}</Text></View>
                                </View>

                                {selectedActa.procesos && selectedActa.procesos.length > 0 && (
                                    <View style={{ marginTop: 20 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Desglose por Procesos</Text>
                                        <View style={styles.detailTable}>
                                            <View style={styles.detailTableHeader}>
                                                <Text style={[styles.detailHeaderCell, { flex: 1.5 }]}>Proceso</Text>
                                                <Text style={[styles.detailHeaderCell, { flex: 3 }]}>Motivo</Text>
                                                <Text style={[styles.detailHeaderCell, { flex: 1 }]}>Cantidad</Text>
                                            </View>
                                            {selectedActa.procesos.map((p, i) => (
                                                <View key={i} style={[styles.detailTableRow, i % 2 === 0 && { backgroundColor: '#F9FAFB' }]}>
                                                    <Text style={[styles.detailCell, { flex: 1.5, fontWeight: 'bold' }]}>{p.proceso}</Text>
                                                    <Text style={[styles.detailCell, { flex: 3 }]}>{p.motivo}</Text>
                                                    <Text style={[styles.detailCell, { flex: 1 }]}>{p.cantidad.toLocaleString()}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                <View style={[styles.detailGrid, { marginTop: 20, backgroundColor: '#F7FAFC', padding: 15, borderRadius: 10 }]}>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>CANTIDAD OP</Text><Text style={styles.detailValue}>{selectedActa.cantidadOP.toLocaleString()}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>CANT. DESPACHADA</Text><Text style={styles.detailValue}>{selectedActa.cantidadRealDespachada.toLocaleString()}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>DIFERENCIA (FALTANTE/SOBRANTE)</Text><Text style={[styles.detailValue, { color: selectedActa.faltante > 0 ? '#C53030' : '#2F855A' }]}>{selectedActa.faltante.toLocaleString()}</Text></View>
                                </View>

                                {selectedActa.archivoPdfUrl && (
                                    <TouchableOpacity style={styles.viewPdfBtn} onPress={() => openPdf(selectedActa.archivoPdfUrl!)}>
                                        <Text style={styles.viewPdfBtnText}>📄 Ver Documento PDF Adjunto</Text>
                                    </TouchableOpacity>
                                )}

                                <View style={styles.actionRow}>
                                    <TouchableOpacity style={styles.editActionBtn} onPress={handleEdit}>
                                        <Text style={styles.editActionText}>✏️ Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteActionBtn} onPress={() => deleteActa(selectedActa.id)}>
                                        <Text style={styles.deleteActionText}>🗑️ Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15, backgroundColor: '#F8FAFC' },
    header: { marginBottom: 20, backgroundColor: 'white', padding: 15, borderRadius: 12, elevation: 2 },
    filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    filterLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginRight: 10 },
    filterInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, height: 40, width: 90, fontSize: 14, backgroundColor: '#F1F5F9' },
    btnRow: { flexDirection: 'row', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#3182CE', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, elevation: 1 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    tableContainer: { flex: 1, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', elevation: 2 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F1F5F9', paddingVertical: 14, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerCell: { fontWeight: '700', color: '#475569', fontSize: 12, textTransform: 'uppercase' },
    tableBody: { flex: 1 },
    row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    cell: { fontSize: 14, color: '#334155' },
    emptyText: { padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: 'white', maxHeight: '95%', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2 },
    modalHeader: { backgroundColor: '#E67E22', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    closeBtn: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    modalBody: { padding: 20 },

    sectionHeader: { borderLeftWidth: 4, borderLeftColor: '#E67E22', paddingLeft: 10, marginBottom: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
    formRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    formGroup: { flex: 1 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#FFFFFF' },
    webInput: { height: 42, border: '1px solid #CBD5E0', borderRadius: 10, paddingLeft: 12, fontSize: 15, backgroundColor: 'white', width: '100%' },
    
    addBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E0' },
    addBtnText: { color: '#2C5282', fontWeight: 'bold', fontSize: 12 },
    
    breakdownContainer: { marginBottom: 10, borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 12, overflow: 'hidden', backgroundColor: '#F8FAFC' },
    breakdownHeader: { flexDirection: 'row', backgroundColor: '#EDF2F7', padding: 12, borderBottomWidth: 1, borderBottomColor: '#CBD5E0' },
    breakdownHeaderCell: { fontSize: 13, fontWeight: 'bold', color: '#4A5568', textTransform: 'uppercase' },
    breakdownRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', alignItems: 'center', backgroundColor: 'white' },
    webInputCompact: { height: 40, border: '1px solid #CBD5E0', borderRadius: 8, paddingLeft: 10, fontSize: 14, backgroundColor: 'white', width: '100%', outline: 'none' },
    inputCompact: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: 'white' },
    totalSummaryRow: { backgroundColor: '#2C5282', padding: 15, alignItems: 'flex-end' },
    totalText: { fontWeight: 'bold', color: 'white', fontSize: 16 },

    pdfDropZone: { backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#CBD5E0', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center' },
    pdfLabel: { fontSize: 15, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
    pdfSub: { fontSize: 12, color: '#94A3B8' },

    saveBtn: { backgroundColor: '#2F855A', paddingHorizontal: 35, paddingVertical: 14, borderRadius: 12, elevation: 4 },
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    detailItem: { width: '48%', marginBottom: 15 },
    detailLabel: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8', letterSpacing: 0.5 },
    detailValue: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
    
    detailTable: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
    detailTableHeader: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 12 },
    detailHeaderCell: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
    detailTableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    detailCell: { fontSize: 14, color: '#334155' },

    viewPdfBtn: { backgroundColor: '#EBF8FF', padding: 16, borderRadius: 12, marginTop: 25, alignItems: 'center', borderWidth: 1, borderColor: '#BEE3F8' },
    viewPdfBtnText: { color: '#2B6CB0', fontWeight: 'bold', fontSize: 15 },
    
    actionRow: { marginTop: 30, flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 10 },
    editActionBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E0' },
    editActionText: { color: '#4A5568', fontWeight: 'bold' },
    deleteActionBtn: { backgroundColor: '#FFF5F5', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FEB2B2' },
    deleteActionText: { color: '#C53030', fontWeight: 'bold' },
});
