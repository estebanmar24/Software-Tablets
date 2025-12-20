import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button, Modal, TextInput, ScrollView, Alert, Image, Switch } from 'react-native';
import { getMaquinas, updateMaquina, createMaquina } from '../services/productionApi';

export default function MachineParamsScreen({ navigation }) {
    const [maquinas, setMaquinas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMachine, setEditingMachine] = useState(null);

    // Form State
    const [form, setForm] = useState({
        nombre: '',
        meta100Porciento: '',
        metaRendimiento: '', // Auto-calculated (75% of meta100)
        metaDesperdicio: '',
        valorPorTiro: '',
        tirosReferencia: '',
        importancia: '',
        activa: true
    });

    const loadMaquinas = async () => {
        setLoading(true);
        try {
            const res = await getMaquinas();
            setMaquinas(res.data);
        } catch (error) {
            Alert.alert("Error", "Error cargando máquinas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMaquinas();
    }, []);

    // Auto-calculate metaRendimiento when meta100Porciento changes
    const handleMeta100Change = (value) => {
        const meta100 = parseInt(value) || 0;
        const meta75 = Math.round(meta100 * 0.75);
        setForm({
            ...form,
            meta100Porciento: value,
            metaRendimiento: meta75.toString()
        });
    };

    const openEdit = (maquina) => {
        setEditingMachine(maquina);
        const meta100 = maquina.meta100Porciento || maquina.metaRendimiento || 0;
        setForm({
            nombre: maquina.nombre,
            meta100Porciento: meta100.toString(),
            metaRendimiento: maquina.metaRendimiento?.toString() || Math.round(meta100 * 0.75).toString(),
            metaDesperdicio: maquina.metaDesperdicio?.toString() || '0',
            valorPorTiro: maquina.valorPorTiro?.toString() || '0',
            tirosReferencia: maquina.tirosReferencia?.toString() || '0',
            importancia: maquina.importancia?.toString() || '1',
            activa: maquina.activa !== false
        });
        setModalVisible(true);
    };

    const openNew = () => {
        setEditingMachine(null);
        setForm({
            nombre: '',
            meta100Porciento: '0',
            metaRendimiento: '0',
            metaDesperdicio: '0',
            valorPorTiro: '0',
            tirosReferencia: '0',
            importancia: '0',
            activa: true
        });
        setModalVisible(true);
    };

    // Calculate total importancia percentage (excluding current editing machine)
    const calcularTotalImportancia = () => {
        return maquinas
            .filter(m => m.activa !== false && (!editingMachine || m.id !== editingMachine.id))
            .reduce((sum, m) => sum + (m.importancia || 0), 0);
    };

    const totalImportanciaOthers = calcularTotalImportancia();
    const totalImportanciaAll = maquinas
        .filter(m => m.activa !== false)
        .reduce((sum, m) => sum + (m.importancia || 0), 0);

    const handleSave = async () => {
        const payload = {
            id: editingMachine ? editingMachine.id : 0,
            nombre: form.nombre,
            meta100Porciento: parseInt(form.meta100Porciento) || 0,
            metaRendimiento: parseInt(form.metaRendimiento) || 0,
            metaDesperdicio: parseFloat(form.metaDesperdicio) || 0,
            valorPorTiro: parseFloat(form.valorPorTiro) || 0,
            tirosReferencia: parseInt(form.tirosReferencia) || 0,
            importancia: parseInt(form.importancia) || 1,
            semaforoMin: 0,
            semaforoNormal: 0,
            semaforoMax: 0,
            activa: form.activa
        };

        try {
            if (editingMachine) {
                await updateMaquina(editingMachine.id, payload);
            } else {
                await createMaquina(payload);
            }
            setModalVisible(false);
            loadMaquinas();
            Alert.alert("Éxito", "Guardado correctamente");
        } catch (error) {
            console.log(error);
            Alert.alert("Error", "No se pudo guardar");
        }
    };

    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    return (
        <View style={styles.container}>
            {/* Header with Logo */}
            <View style={styles.headerContainer}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                <Text style={styles.header}>Parámetros de Máquinas</Text>
            </View>

            <Button title="Nueva Máquina" onPress={openNew} />

            {/* Total Importancia Warning */}
            <View style={[styles.totalBar, totalImportanciaAll !== 100 && styles.totalBarWarning]}>
                <Text style={styles.totalText}>
                    Total Importancia: {totalImportanciaAll}%
                    {totalImportanciaAll !== 100 && ' ⚠️ Debe sumar 100%'}
                </Text>
            </View>

            <FlatList
                data={maquinas}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.card, !item.activa && styles.cardInactive]}
                        onPress={() => openEdit(item)}
                    >
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>{item.nombre}</Text>
                            <Text style={[styles.badge, item.activa ? styles.badgeActive : styles.badgeInactive]}>
                                {item.activa !== false ? 'Activa' : 'Inactiva'}
                            </Text>
                        </View>
                        <Text>Meta 100%: {item.meta100Porciento || '-'} | Meta 75%: {item.metaRendimiento}</Text>
                        <Text>Valor/Tiro: ${item.valorPorTiro} | Importancia: {item.importancia || 0}%</Text>
                    </TouchableOpacity>
                )}
            />

            <Modal visible={modalVisible} animationType="slide">
                <ScrollView contentContainerStyle={styles.modalContainer}>
                    <Text style={styles.header}>{editingMachine ? 'Editar' : 'Nueva'} Máquina</Text>

                    {/* Activa Switch */}
                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Máquina Activa:</Text>
                        <Switch
                            value={form.activa}
                            onValueChange={(value) => setForm({ ...form, activa: value })}
                            trackColor={{ false: '#ccc', true: '#4CAF50' }}
                            thumbColor={form.activa ? '#fff' : '#f4f3f4'}
                        />
                        <Text style={[styles.switchLabel, { color: form.activa ? '#4CAF50' : '#999' }]}>
                            {form.activa ? 'Sí' : 'No'}
                        </Text>
                    </View>

                    <Text style={styles.label}>Nombre:</Text>
                    <TextInput style={styles.input} value={form.nombre} onChangeText={t => setForm({ ...form, nombre: t })} />

                    <Text style={styles.label}>Importancia (%, suma de todas debe ser 100%):</Text>
                    <View style={styles.importanciaRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            keyboardType="numeric"
                            value={form.importancia}
                            onChangeText={t => setForm({ ...form, importancia: t })}
                        />
                        <Text style={styles.percentSign}>%</Text>
                    </View>
                    <Text style={[styles.hintText, (totalImportanciaOthers + (parseInt(form.importancia) || 0)) !== 100 && styles.hintWarning]}>
                        Otras máquinas: {totalImportanciaOthers}% | Total: {totalImportanciaOthers + (parseInt(form.importancia) || 0)}%
                    </Text>

                    <Text style={styles.label}>Meta 100% (Tiros):</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={form.meta100Porciento}
                        onChangeText={handleMeta100Change}
                    />

                    <Text style={styles.label}>Meta 75% (Calculado automáticamente):</Text>
                    <TextInput
                        style={[styles.input, styles.inputDisabled]}
                        keyboardType="numeric"
                        value={form.metaRendimiento}
                        editable={false}
                    />

                    <Text style={styles.label}>Meta Desperdicio (0.07 = 7%):</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.metaDesperdicio} onChangeText={t => setForm({ ...form, metaDesperdicio: t })} />

                    <Text style={styles.label}>Valor Por Tiro ($):</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.valorPorTiro} onChangeText={t => setForm({ ...form, valorPorTiro: t })} />

                    <Text style={styles.label}>Tiros Referencia (para cambios OP):</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.tirosReferencia} onChangeText={t => setForm({ ...form, tirosReferencia: t })} />

                    <View style={styles.buttonRow}>
                        <Button title="Guardar" onPress={handleSave} />
                        <View style={{ width: 10 }} />
                        <Button title="Cancelar" color="red" onPress={() => setModalVisible(false)} />
                    </View>
                </ScrollView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' },
    logo: { width: 50, height: 50, marginRight: 15 },
    header: { fontSize: 22, fontWeight: 'bold' },
    card: { padding: 15, backgroundColor: '#90CAF9', marginBottom: 10, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#0D47A1' },
    cardInactive: { backgroundColor: '#E3F2FD', borderLeftColor: '#42A5F5' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    cardTitle: { fontWeight: 'bold', fontSize: 18 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, fontWeight: 'bold' },
    badgeActive: { backgroundColor: '#C8E6C9', color: '#2E7D32' },
    badgeInactive: { backgroundColor: '#FFCDD2', color: '#C62828' },
    modalContainer: { padding: 20 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginBottom: 15, fontSize: 16 },
    inputDisabled: { backgroundColor: '#f5f5f5', color: '#999' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#333' },
    switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingVertical: 10, backgroundColor: '#f9f9f9', borderRadius: 8, paddingHorizontal: 10 },
    switchLabel: { marginLeft: 10, fontSize: 16, fontWeight: '500' },
    buttonRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    totalBar: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginVertical: 10, alignItems: 'center' },
    totalBarWarning: { backgroundColor: '#FFF3E0' },
    totalText: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
    importanciaRow: { flexDirection: 'row', alignItems: 'center' },
    percentSign: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#666' },
    hintText: { fontSize: 12, color: '#666', marginBottom: 15, marginTop: -10 },
    hintWarning: { color: '#E65100', fontWeight: '600' }
});

