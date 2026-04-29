import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as planeacionApi from '../services/planeacionApi';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function PlaneacionPersonalScreen() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [personal, setPersonal] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        cedula: '',
        salario: ''
    });

    // Excel Report State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportFechaInicio, setReportFechaInicio] = useState(new Date().toISOString().split('T')[0]);
    const [reportFechaFin, setReportFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [generatingReport, setGeneratingReport] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await planeacionApi.getPersonal();
            setPersonal(data);
        } catch (error) {
            console.error('Error loading personal:', error);
            Alert.alert('Error', 'No se pudo cargar el listado de personal');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const resetForm = () => {
        setEditItem(null);
        setFormData({ nombre: '', cedula: '', salario: '' });
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            nombre: item.nombre,
            cedula: item.cedula,
            salario: item.salario.toString()
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.nombre || !formData.cedula || !formData.salario) {
            Alert.alert('Error', 'Todos los campos son obligatorios');
            return;
        }

        setSaving(true);
        try {
            const data = {
                ...formData,
                salario: parseFloat(formData.salario),
                activo: true
            };

            if (editItem) {
                await planeacionApi.updatePersonal(editItem.id, { ...data, id: editItem.id });
            } else {
                await planeacionApi.createPersonal(data);
            }

            Alert.alert('Éxito', editItem ? 'Personal actualizado' : 'Personal creado');
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving personal:', error);
            Alert.alert('Error', 'No se pudo guardar la información');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try {
                await planeacionApi.deletePersonal(id);
                loadData();
                Alert.alert('Éxito', 'Personal eliminado');
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Desea eliminar este registro?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Desea eliminar este registro?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
            ]);
        }
    };

    // Excel Report Generation for Horas Extras
    const handleGenerateReport = async () => {
        if (!reportFechaInicio || !reportFechaFin) {
            Alert.alert('Error', 'Por favor seleccione ambas fechas');
            return;
        }

        try {
            setGeneratingReport(true);

            // Parse date range to determine which months to fetch
            const startDate = new Date(reportFechaInicio);
            const endDate = new Date(reportFechaFin);

            // Fetch gastos for each month in the range
            let allGastos = [];
            let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            while (currentDate <= endDate) {
                try {
                    const monthGastos = await planeacionApi.getGastos(currentDate.getFullYear(), currentDate.getMonth() + 1);
                    allGastos = allGastos.concat(monthGastos || []);
                } catch (e) {
                    console.error(`Error loading gastos for ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}:`, e);
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            // Filter to only overtime and recargo entries within the date range
            const horasExtras = allGastos.filter(g => {
                if (!g.personalId) return false; // Only payroll entries (horas extras/recargos)
                const fecha = new Date(g.fecha);
                return fecha >= startDate && fecha <= endDate;
            });

            if (horasExtras.length === 0) {
                Alert.alert('Sin datos', 'No hay registros de horas extras/recargos en el rango seleccionado');
                return;
            }

            // Generate Excel using xlsx
            const XLSX = await import('xlsx');

            // Calculate Valor Hora: Salario / 220 (horas laborales mensuales legales Colombia)
            const excelData = horasExtras.map(item => {
                const salario = item.personalSalario || 0;
                const valorHora = salario > 0 ? salario / 220 : 0;
                const factor = item.tipoHoraFactor || item.tipoRecargoFactor || 1;
                return {
                    'Fecha': new Date(item.fecha).toLocaleDateString('es-CO'),
                    'Nombre Operario': item.personalNombre || 'N/A',
                    'Identificacion': item.personalCedula || 'N/A',
                    'OP': item.numeroOP || '',
                    'Salario': salario ? `$ ${new Intl.NumberFormat('es-CO').format(salario)}` : '$ 0',
                    'Valor Hora': valorHora ? `$ ${new Intl.NumberFormat('es-CO').format(Math.round(valorHora))}` : '$ 0',
                    'Tipo': item.tipoHoraNombre || item.tipoRecargoNombre || 'N/A',
                    'Numero Horas': item.cantidadHoras || 0,
                    'Factor': factor,
                    'Valor a Pagar': item.precio || 0,
                    'Comentarios': item.observaciones || ''
                };
            });

            // Calculate Total
            const totalValor = excelData.reduce((sum, item) => sum + (item['Valor a Pagar'] || 0), 0);

            // Format 'Valor a Pagar' for display rows
            const formattedData = excelData.map(item => ({
                ...item,
                'Valor a Pagar': `$ ${Math.round(item['Valor a Pagar']).toLocaleString('es-CO')}`
            }));

            // Add Total Row
            formattedData.push({
                'Fecha': '',
                'Nombre Operario': '',
                'Identificacion': '',
                'OP': '',
                'Salario': '',
                'Valor Hora': '',
                'Tipo': '',
                'Numero Horas': '',
                'Factor': 'TOTAL:',
                'Valor a Pagar': `$ ${Math.round(totalValor).toLocaleString('es-CO')}`,
                'Comentarios': ''
            });

            // Create workbook
            const ws = XLSX.utils.json_to_sheet(formattedData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Horas Extras');

            // Set column widths
            ws['!cols'] = [
                { wch: 12 },  // Fecha
                { wch: 25 },  // Nombre Operario
                { wch: 15 },  // Identificacion
                { wch: 10 },  // OP
                { wch: 15 },  // Salario
                { wch: 15 },  // Valor Hora
                { wch: 20 },  // Tipo
                { wch: 15 },  // Numero Horas
                { wch: 10 },  // Factor
                { wch: 20 },  // Valor a Pagar
                { wch: 30 },  // Comentarios
            ];

            const fileName = `HorasExtras_Planeacion_${reportFechaInicio}_${reportFechaFin}.xlsx`;

            if (Platform.OS === 'web') {
                XLSX.writeFile(wb, fileName);
                Alert.alert('Éxito', `Se descargó el archivo ${fileName}`);
            } else {
                const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
                const uri = FileSystem.documentDirectory + fileName;
                await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Compartir Reporte de Horas Extras'
                });
            }

            setShowReportModal(false);
        } catch (error) {
            console.error('Error generating report:', error);
            Alert.alert('Error', 'No se pudo generar el reporte');
        } finally {
            setGeneratingReport(false);
        }
    };

    if (loading && personal.length === 0) {
        return <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>👥 Listado de Personal de Almacén (Horas Extras)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: '#059669' }]}
                        onPress={() => setShowReportModal(true)}
                    >
                        <Text style={styles.addButtonText}>📊 Excel H. Extras</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => { resetForm(); setShowModal(true); }}
                    >
                        <Text style={styles.addButtonText}>+ Nuevo Personal de Almacén</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.list}>
                {personal.map(item => (
                    <View key={item.id} style={styles.card}>
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardNombre}>{item.nombre}</Text>
                            <Text style={styles.cardSub}>C.C. {item.cedula}</Text>
                            <Text style={styles.cardSalario}>Salario: {planeacionApi.formatCurrency(item.salario)}</Text>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                                <Text style={styles.btnText}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                                <Text style={styles.btnText}>🗑️</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
                {personal.length === 0 && (
                    <Text style={styles.emptyText}>No hay personal registrado.</Text>
                )}
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Nuevo'} Personal de Almacén</Text>

                        <Text style={styles.label}>Nombre Completo</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.nombre}
                            onChangeText={(t) => setFormData(p => ({ ...p, nombre: t }))}
                            placeholder="Nombre..."
                        />

                        <Text style={styles.label}>Cédula</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.cedula}
                            onChangeText={(t) => setFormData(p => ({ ...p, cedula: t }))}
                            placeholder="Número de documento..."
                            keyboardType="numeric"
                        />

                        <Text style={styles.label}>Salario Mensual</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.salario}
                            onChangeText={(t) => setFormData(p => ({ ...p, salario: t }))}
                            placeholder="Ej: 1300000"
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Excel Report Modal */}
            <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 450, padding: 24 }]}>
                        <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 20 }]}>📊 Reporte de Horas Extras - Planeación</Text>

                        <View style={{ backgroundColor: '#ECFDF5', padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#059669' }}>
                            <Text style={{ fontSize: 13, color: '#065F46' }}>
                                💡 Selecciona el rango de fechas para exportar los registros de horas extras y recargos a Excel.
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { marginBottom: 6 }]}>📅 Fecha Inicio</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={reportFechaInicio}
                                        onChange={(e) => setReportFechaInicio(e.target.value)}
                                        style={{
                                            padding: 12, fontSize: 15, borderRadius: 8,
                                            border: '2px solid #E2E8F0', backgroundColor: '#FFF',
                                            width: '100%', cursor: 'pointer', boxSizing: 'border-box'
                                        }}
                                    />
                                ) : (
                                    <TextInput
                                        style={styles.input}
                                        value={reportFechaInicio}
                                        onChangeText={setReportFechaInicio}
                                        placeholder="YYYY-MM-DD"
                                    />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { marginBottom: 6 }]}>📅 Fecha Fin</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={reportFechaFin}
                                        onChange={(e) => setReportFechaFin(e.target.value)}
                                        style={{
                                            padding: 12, fontSize: 15, borderRadius: 8,
                                            border: '2px solid #E2E8F0', backgroundColor: '#FFF',
                                            width: '100%', cursor: 'pointer', boxSizing: 'border-box'
                                        }}
                                    />
                                ) : (
                                    <TextInput
                                        style={styles.input}
                                        value={reportFechaFin}
                                        onChangeText={setReportFechaFin}
                                        placeholder="YYYY-MM-DD"
                                    />
                                )}
                            </View>
                        </View>

                        <View style={[styles.modalButtons, { marginTop: 24 }]}>
                            <TouchableOpacity style={[styles.cancelBtn, { paddingHorizontal: 20 }]} onPress={() => setShowReportModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: '#059669', paddingHorizontal: 20 }, generatingReport && { opacity: 0.7 }]}
                                onPress={handleGenerateReport}
                                disabled={generatingReport}
                            >
                                {generatingReport ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>📥 Generar Excel</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
    addButton: { backgroundColor: '#2563EB', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    list: { flex: 1 },
    card: {
        backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E7EB',
        ...Platform.select({ web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' } })
    },
    cardInfo: { flex: 1 },
    cardNombre: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    cardSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    cardSalario: { fontSize: 14, color: '#374151', marginTop: 4, fontWeight: '500' },
    cardActions: { flexDirection: 'row', gap: 10 },
    editBtn: { backgroundColor: '#F3F4F6', padding: 8, borderRadius: 6 },
    deleteBtn: { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6 },
    btnText: { fontSize: 16 },
    emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', padding: 25, borderRadius: 15, width: '90%', maxWidth: 450 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#111827' },
    label: { fontSize: 14, color: '#374151', marginBottom: 5, fontWeight: 'bold' },
    input: {
        backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB',
        borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
    cancelBtnText: { color: '#4B5563', fontWeight: 'bold' },
    submitBtn: { backgroundColor: '#2563EB', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 8 },
    submitBtnText: { color: '#FFF', fontWeight: 'bold' }
});
