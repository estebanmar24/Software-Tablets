import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as planeacionApi from '../services/planeacionApi';

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

    if (loading && personal.length === 0) {
        return <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>👥 Listado de Personal de Almacén (Horas Extras)</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => { resetForm(); setShowModal(true); }}
                >
                    <Text style={styles.addButtonText}>+ Nuevo Personal de Almacén</Text>
                </TouchableOpacity>
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
