import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';

interface User {
    id: number;
    username: string;
    role: string;
    nombreMostrar: string;
}

export default function UserManagementScreen({ onBack }: { onBack: () => void }) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // const [role, setRole] = useState('admin'); // Removed single role
    const [selectedRoles, setSelectedRoles] = useState<string[]>(['produccion']); // Multi-role state
    const [nombreMostrar, setNombreMostrar] = useState('');

    const rolesDisponibles = [
        { label: 'Administrador Master', value: 'admin' },
        { label: 'Control Calidad', value: 'calidad' },
        { label: 'Gerente Producción', value: 'produccion' },
        { label: 'Seguridad y Salud', value: 'sst' },
        { label: 'Gestión Humana', value: 'gh' },
        { label: 'Talleres', value: 'talleres' },
        { label: 'Presupuesto', value: 'presupuesto' },
        { label: 'Desarrollador', value: 'develop' }
    ];

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los usuarios');
        } finally {
            setLoading(false);
        }
    };

    const toggleRole = (value: string) => {
        if (selectedRoles.includes(value)) {
            setSelectedRoles(selectedRoles.filter(r => r !== value));
        } else {
            setSelectedRoles([...selectedRoles, value]);
        }
    };

    const handleSave = async () => {
        if (selectedRoles.length === 0 || !nombreMostrar) {
            Alert.alert('Error', 'Debe seleccionar al menos un rol y escribir un nombre');
            return;
        }

        if (!isEditing && (!username || !password)) {
            Alert.alert('Error', 'Usuario y contraseña son obligatorios para crear');
            return;
        }

        const roleString = selectedRoles.join(',');

        try {
            if (isEditing && editingId) {
                await updateUser(editingId, { role: roleString, nombreMostrar, password: password || undefined });
                Alert.alert('Éxito', 'Usuario actualizado');
            } else {
                await createUser({ username, password, role: roleString, nombreMostrar });
                Alert.alert('Éxito', 'Usuario creado');
            }
            setModalVisible(false);
            loadUsers();
            resetForm();
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', error.message || 'Error al guardar');
        }
    };

    const confirmDelete = (user: User) => {
        Alert.alert(
            'Eliminar Usuario',
            `¿Está seguro de eliminar a ${user.username}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteUser(user.id);
                            loadUsers();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]
        );
    };

    const openEdit = (user: User) => {
        setEditingId(user.id);
        setUsername(user.username);
        // Split role string into array, defaulting to empty if null
        setSelectedRoles(user.role ? user.role.split(',').map(r => r.trim()) : []);
        setNombreMostrar(user.nombreMostrar);
        setPassword(''); // Password blank on edit
        setIsEditing(true);
        setModalVisible(true);
    };

    const openNew = () => {
        resetForm();
        setIsEditing(false);
        setModalVisible(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setUsername('');
        setPassword('');
        setSelectedRoles(['produccion']);
        setNombreMostrar('');
    };

    const renderItem = ({ item }: { item: User }) => {
        // Split roles for display
        const userRoles = item.role ? item.role.split(',') : [];
        return (
            <View style={styles.card}>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.nombreMostrar}</Text>
                    <Text style={styles.cardSubtitle}>Usuario: {item.username}</Text>
                    <View style={styles.rolesContainer}>
                        {userRoles.map((r, i) => (
                            <View key={i} style={[styles.badge, { backgroundColor: r.trim() === 'develop' ? '#000' : '#2196F3', marginRight: 4, marginBottom: 4 }]}>
                                <Text style={styles.badgeText}>{r.trim()}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                        <Text style={styles.btnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
                        <Text style={styles.btnText}>Borrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backText}>← Salir</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Gestión de Usuarios (DB)</Text>
                <TouchableOpacity onPress={openNew} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Nuevo Usuario</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={users}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                refreshing={loading}
                onRefresh={loadUsers}
                contentContainerStyle={styles.list}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</Text>

                        <ScrollView>
                            <Text style={styles.label}>Usuario (Login):</Text>
                            <TextInput
                                style={[styles.input, isEditing && styles.disabledInput]}
                                value={username}
                                onChangeText={setUsername}
                                editable={!isEditing}
                                autoCapitalize="none"
                            />

                            <Text style={styles.label}>Nombre para mostrar:</Text>
                            <TextInput
                                style={styles.input}
                                value={nombreMostrar}
                                onChangeText={setNombreMostrar}
                            />

                            <Text style={styles.label}>Roles:</Text>
                            <View style={styles.rolesList}>
                                {rolesDisponibles.map(r => {
                                    const isSelected = selectedRoles.includes(r.value);
                                    return (
                                        <TouchableOpacity
                                            key={r.value}
                                            style={[styles.roleOption, isSelected && styles.roleOptionSelected]}
                                            onPress={() => toggleRole(r.value)}
                                        >
                                            <Text style={[styles.roleOptionText, isSelected && styles.roleOptionTextSelected]}>
                                                {isSelected ? '☑' : '☐'} {r.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Contraseña:</Text>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder={isEditing ? "(Dejar en blanco para no cambiar)" : "Requerida"}
                                secureTextEntry
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#333', justifyContent: 'space-between' },
    title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    backBtn: { padding: 10 },
    backText: { color: 'white', fontSize: 16 },
    addBtn: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 5 },
    addBtnText: { color: 'white', fontWeight: 'bold' },
    // List styles
    list: { padding: 15 },
    card: { backgroundColor: 'white', borderRadius: 8, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowOpacity: 0.1, elevation: 2 },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    cardSubtitle: { color: '#666', marginVertical: 4 },
    rolesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: 'white', fontSize: 12 },
    cardActions: { flexDirection: 'row' },
    editBtn: { backgroundColor: '#FFC107', padding: 8, borderRadius: 4, marginRight: 5 },
    deleteBtn: { backgroundColor: '#F44336', padding: 8, borderRadius: 4 },
    btnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxWidth: 500, backgroundColor: 'white', borderRadius: 10, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, backgroundColor: '#fff' },
    disabledInput: { backgroundColor: '#eee', color: '#888' },

    // Multi-select styles
    rolesList: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 5, marginBottom: 15 },
    roleOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center' },
    roleOptionSelected: { backgroundColor: '#e3f2fd' },
    roleOptionText: { fontSize: 14, color: '#333' },
    roleOptionTextSelected: { color: '#1976D2', fontWeight: 'bold' },

    modalActions: { flexDirection: 'row', marginTop: 30, justifyContent: 'flex-end', gap: 10 },
    cancelBtn: { padding: 12, borderRadius: 5, backgroundColor: '#eee' },
    cancelText: { fontWeight: 'bold', color: '#333' },
    saveBtn: { padding: 12, borderRadius: 5, backgroundColor: '#2196F3' },
    saveText: { fontWeight: 'bold', color: 'white' },
});
