import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, Alert, TouchableOpacity, Modal } from 'react-native';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../services/productionApi';

export default function ListsScreen({ navigation }) {
    const [usuarios, setUsuarios] = useState([]);
    const [newUsuario, setNewUsuario] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        loadUsuarios();
    }, []);

    const loadUsuarios = async () => {
        setLoading(true);
        try {
            const res = await getUsuarios();
            setUsuarios(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUsuario = async () => {
        if (!newUsuario.trim()) return;
        try {
            await createUsuario({ nombre: newUsuario, estado: true, activo: true });
            setNewUsuario('');
            loadUsuarios();
            Alert.alert("Éxito", "Operario agregado");
        } catch (error) {
            Alert.alert("Error", "No se pudo agregar");
        }
    };

    const handleEditPress = (user) => {
        setEditingUser(user);
        setEditName(user.nombre);
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return;
        try {
            await updateUsuario(editingUser.id, {
                nombre: editName,
                estado: editingUser.estado,
                activo: editingUser.activo
            });
            setEditModalVisible(false);
            setEditingUser(null);
            loadUsuarios();
            Alert.alert("Éxito", "Operario actualizado");
        } catch (error) {
            Alert.alert("Error", "No se pudo actualizar");
        }
    };

    const handleDeletePress = (user) => {
        Alert.alert(
            "Confirmar",
            `¿Eliminar a ${user.nombre}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteUsuario(user.id);
                            loadUsuarios();
                            Alert.alert("Éxito", "Operario eliminado");
                        } catch (error) {
                            Alert.alert("Error", "No se pudo eliminar");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Gestión de Listas - Operarios</Text>

            <View style={styles.addBox}>
                <TextInput
                    style={styles.input}
                    value={newUsuario}
                    onChangeText={setNewUsuario}
                    placeholder="Nuevo Operario"
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddUsuario}>
                    <Text style={styles.addButtonText}>AGREGAR</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.subHeader}>Operarios Activos:</Text>
            <FlatList
                data={usuarios}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.item}>
                        <Text style={styles.itemText}>{item.nombre}</Text>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.editBtn}
                                onPress={() => handleEditPress(item)}
                            >
                                <Text style={styles.btnText}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => handleDeletePress(item)}
                            >
                                <Text style={styles.btnText}>🗑️</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />

            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Editar Operario</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Nombre del operario"
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSaveEdit}
                            >
                                <Text style={styles.saveBtnText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    subHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    addBox: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10 },
    addButton: { backgroundColor: '#1976D2', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 5 },
    addButtonText: { color: '#fff', fontWeight: 'bold' },
    item: {
        padding: 15,
        borderBottomWidth: 1,
        borderColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    itemText: { fontSize: 16, flex: 1 },
    actionButtons: { flexDirection: 'row', gap: 10 },
    editBtn: { padding: 8, backgroundColor: '#FFF3E0', borderRadius: 5 },
    deleteBtn: { padding: 8, backgroundColor: '#FFEBEE', borderRadius: 5 },
    btnText: { fontSize: 18 },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 25,
        borderRadius: 10,
        width: '80%',
        maxWidth: 400
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 12,
        marginBottom: 20,
        fontSize: 16
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    cancelBtn: { padding: 12, paddingHorizontal: 20 },
    cancelBtnText: { color: '#666' },
    saveBtn: { backgroundColor: '#1976D2', padding: 12, paddingHorizontal: 20, borderRadius: 5 },
    saveBtnText: { color: '#fff', fontWeight: 'bold' }
});
