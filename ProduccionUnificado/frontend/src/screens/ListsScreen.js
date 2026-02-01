import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, Alert, TouchableOpacity, Modal, Platform, Switch } from 'react-native';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../services/productionApi';

export default function ListsScreen({ navigation }) {
    const [usuarios, setUsuarios] = useState([]);
    const [newUsuario, setNewUsuario] = useState('');
    const [newSalario, setNewSalario] = useState(''); // NEW STATE
    const [esPorHoras, setEsPorHoras] = useState(false);
    const [loading, setLoading] = useState(false);

    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');
    const [editSalario, setEditSalario] = useState(''); // NEW EDIT STATE
    const [editEsPorHoras, setEditEsPorHoras] = useState(false);

    const [showInactive, setShowInactive] = useState(false); // NEW STATE

    useEffect(() => {
        loadUsuarios();
    }, [showInactive]); // Reload when toggle changes

    const loadUsuarios = async () => {
        setLoading(true);
        try {
            const res = await getUsuarios(showInactive);
            let data = res.data;
            // If showing inactive, we want ONLY the inactive ones, not mixed.
            if (showInactive) {
                data = data.filter(u => !u.activo);
            }
            setUsuarios(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUsuario = async () => {
        if (!newUsuario.trim()) return;
        try {
            await createUsuario({
                nombre: newUsuario,
                estado: true,
                activo: true,
                esPorHoras: esPorHoras,
                salario: newSalario ? parseFloat(newSalario) : 0
            });
            setNewUsuario('');
            setNewSalario('');
            setEsPorHoras(false);
            loadUsuarios();
            if (Platform.OS === 'web') {
                alert("Operario agregado");
            } else {
                Alert.alert("Éxito", "Operario agregado");
            }
        } catch (error) {
            console.error('Add usuario error:', error);
            if (Platform.OS === 'web') {
                alert("Error: No se pudo agregar");
            } else {
                Alert.alert("Error", "No se pudo agregar");
            }
        }
    };

    const handleEditPress = (user) => {
        setEditingUser(user);
        setEditName(user.nombre);
        setEditSalario(user.salario ? user.salario.toString() : '');
        setEditEsPorHoras(user.esPorHoras || false);
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return;
        try {
            await updateUsuario(editingUser.id, {
                nombre: editName,
                estado: editingUser.estado,
                activo: editingUser.activo,
                esPorHoras: editEsPorHoras,
                salario: editSalario ? parseFloat(editSalario) : 0
            });
            setEditModalVisible(false);
            setEditingUser(null);
            loadUsuarios();
            if (Platform.OS === 'web') {
                alert("Operario actualizado");
            } else {
                Alert.alert("Éxito", "Operario actualizado");
            }
        } catch (error) {
            console.error('Update usuario error:', error);
            if (Platform.OS === 'web') {
                alert("Error: No se pudo actualizar");
            } else {
                Alert.alert("Error", "No se pudo actualizar");
            }
        }
    };

    const handleRestorePress = async (user) => {
        try {
            await updateUsuario(user.id, {
                ...user,
                activo: true
            });
            loadUsuarios();
            if (Platform.OS === 'web') {
                alert("Operario restaurado");
            } else {
                Alert.alert("Éxito", "Operario restaurado");
            }
        } catch (error) {
            console.error('Restore usuario error:', error);
            alert("Error al restaurar");
        }
    };

    const handleDeletePress = (user) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Eliminar a ${user.nombre}?`)) {
                deleteUsuario(user.id)
                    .then(() => {
                        loadUsuarios();
                        alert("Operario eliminado");
                    })
                    .catch(() => alert("Error: No se pudo eliminar"));
            }
        } else {
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
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Gestión de Listas - Operarios</Text>

            <View style={styles.addBox}>
                <View style={{ flex: 1, gap: 10 }}>
                    <TextInput
                        style={styles.input}
                        value={newUsuario}
                        onChangeText={setNewUsuario}
                        placeholder="Nombre del operario"
                    />
                    <TextInput
                        style={styles.input}
                        value={newSalario}
                        onChangeText={setNewSalario}
                        placeholder="Salario (Mensual)"
                        keyboardType="numeric"
                    />
                    <View style={styles.switchContainer}>
                        <Text>Por Horas:</Text>
                        <Switch value={esPorHoras} onValueChange={setEsPorHoras} />
                    </View>
                </View>
                <TouchableOpacity style={[styles.addButton, { alignSelf: 'center' }]} onPress={handleAddUsuario}>
                    <Text style={styles.addButtonText}>AGREGAR</Text>
                </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={styles.subHeader}>Operarios {showInactive ? "Eliminados" : "Activos"}:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text>Ver Papelera</Text>
                    <Switch value={showInactive} onValueChange={setShowInactive} />
                </View>
            </View>

            <FlatList
                data={usuarios}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={[styles.item, !item.activo && { opacity: 0.5, backgroundColor: '#f9f9f9' }]}>
                        <View>
                            <Text style={styles.itemText}>
                                {item.nombre} {item.esPorHoras ? "🕒" : ""} {!item.activo && "(Eliminado)"}
                            </Text>
                            {item.esPorHoras ? (
                                <Text style={{ fontSize: 13, color: '#059669', marginTop: 2 }}>
                                    💰 Por Horas
                                </Text>
                            ) : (
                                item.salario != null && (
                                    <Text style={{ fontSize: 13, color: '#059669', marginTop: 2 }}>
                                        💰 {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.salario)}
                                    </Text>
                                )
                            )}
                        </View>
                        <View style={styles.actionButtons}>
                            {!item.activo ? (
                                <TouchableOpacity
                                    style={[styles.editBtn, { backgroundColor: '#E8F5E9' }]}
                                    onPress={() => handleRestorePress(item)}
                                >
                                    <Text style={styles.btnText}>♻️</Text>
                                </TouchableOpacity>
                            ) : (
                                <>
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
                                </>
                            )}
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
                        <TextInput
                            style={styles.modalInput}
                            value={editSalario}
                            onChangeText={setEditSalario}
                            placeholder="Salario (Mensual)"
                            keyboardType="numeric"
                        />
                        <View style={[styles.switchContainer, { marginBottom: 20 }]}>
                            <Text style={{ fontSize: 16 }}>Por Horas:</Text>
                            <Switch value={editEsPorHoras} onValueChange={setEditEsPorHoras} />
                        </View>

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
    saveBtnText: { color: '#fff', fontWeight: 'bold' },
    switchContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }
});
