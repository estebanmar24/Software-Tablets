import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button, Modal, TextInput, ScrollView, Alert, Image } from 'react-native';
import { getMaquinas, updateMaquina, createMaquina } from '../services/productionApi';
// CustomNavBar removed - navigation handled by AdminDashboard

export default function MachineParamsScreen({ navigation }) {
    const [maquinas, setMaquinas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMachine, setEditingMachine] = useState(null);

    // Form State
    const [form, setForm] = useState({
        nombre: '',
        metaRendimiento: '',
        metaDesperdicio: '',
        valorPorTiro: '',
        tirosReferencia: ''
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

    const openEdit = (maquina) => {
        setEditingMachine(maquina);
        setForm({
            nombre: maquina.nombre,
            metaRendimiento: maquina.metaRendimiento.toString(),
            metaDesperdicio: maquina.metaDesperdicio.toString(),
            valorPorTiro: maquina.valorPorTiro.toString(),
            tirosReferencia: maquina.tirosReferencia.toString()
        });
        setModalVisible(true);
    };

    const openNew = () => {
        setEditingMachine(null);
        setForm({
            nombre: '',
            metaRendimiento: '0',
            metaDesperdicio: '0',
            valorPorTiro: '0',
            tirosReferencia: '0'
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        const payload = {
            id: editingMachine ? editingMachine.id : 0,
            nombre: form.nombre,
            metaRendimiento: parseInt(form.metaRendimiento),
            metaDesperdicio: parseFloat(form.metaDesperdicio),
            valorPorTiro: parseFloat(form.valorPorTiro),
            tirosReferencia: parseInt(form.tirosReferencia),
            semaforoMin: 0,
            semaforoNormal: 0,
            semaforoMax: 0,
            activa: true
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

            {/* Top Navigation */}
            {/* Top Navigation */}

            <Button title="Nueva Máquina" onPress={openNew} />

            <FlatList
                data={maquinas}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
                        <Text style={styles.cardTitle}>{item.nombre}</Text>
                        <Text>Meta: {item.metaRendimiento} | Valor: {item.valorPorTiro}</Text>
                    </TouchableOpacity>
                )}
            />

            <Modal visible={modalVisible} animationType="slide">
                <ScrollView contentContainerStyle={styles.modalContainer}>
                    <Text style={styles.header}>{editingMachine ? 'Editar' : 'Nueva'} Máquina</Text>

                    <Text>Nombre:</Text>
                    <TextInput style={styles.input} value={form.nombre} onChangeText={t => setForm({ ...form, nombre: t })} />

                    <Text>Meta Rendimiento (Tiros):</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.metaRendimiento} onChangeText={t => setForm({ ...form, metaRendimiento: t })} />

                    <Text>Meta Desperdicio (0.07 = 7%):</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.metaDesperdicio} onChangeText={t => setForm({ ...form, metaDesperdicio: t })} />

                    <Text>Valor Por Tiro:</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.valorPorTiro} onChangeText={t => setForm({ ...form, valorPorTiro: t })} />

                    <Text>Tiros Referencia:</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={form.tirosReferencia} onChangeText={t => setForm({ ...form, tirosReferencia: t })} />

                    <Button title="Guardar" onPress={handleSave} />
                    <Button title="Cancelar" color="red" onPress={() => setModalVisible(false)} />
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
    card: { padding: 15, backgroundColor: '#eee', marginBottom: 10, borderRadius: 5 },
    cardTitle: { fontWeight: 'bold', fontSize: 18 },
    modalContainer: { padding: 20 },
    input: { borderBottomWidth: 1, padding: 5, marginBottom: 15 }
});
