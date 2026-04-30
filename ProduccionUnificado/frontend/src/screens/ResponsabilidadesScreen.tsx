import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, Switch, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface User {
    id: number;
    username: string;
    role: string;
    nombreMostrar: string;
    area: string;
    email?: string;
    activo: boolean;
    permissions?: string;
}

interface ViewPermission {
    id: string;
    label: string;
    module: string;
}

const MODULE_VIEWS: Record<string, ViewPermission[]> = {
    'produccion': [
        { id: 'prod_captura', label: 'Captura Mensual', module: 'Produccion' },
        { id: 'prod_desperdicio', label: 'Desperdicio', module: 'Produccion' },
        { id: 'prod_tablero', label: 'Tablero Semáforos', module: 'Produccion' },
        { id: 'prod_historial', label: 'Historial', module: 'Produccion' },
        { id: 'prod_maquinas', label: 'Config Máquinas', module: 'Produccion' },
        { id: 'prod_operarios', label: 'Operarios', module: 'Produccion' },
        { id: 'prod_calidad', label: 'Novedades de OP', module: 'Produccion' },
        { id: 'prod_cartas', label: 'Cartas', module: 'Produccion' },
        { id: 'prod_calidad_ext', label: 'Calidad Externa', module: 'Produccion' },
        { id: 'prod_gastos_raw', label: 'Gastos de Producción', module: 'Produccion' },
    ],
    'talleres': [
        { id: 'mant_maquinas', label: 'Hojas de Vida / Maq', module: 'Mantenimiento' },
        { id: 'mant_gastos', label: 'Gastos Mantenimiento', module: 'Mantenimiento' },
        { id: 'mant_inventario', label: 'Inventario Repuestos', module: 'Mantenimiento' },
        { id: 'talleres_gastos', label: 'Gastos Talleres', module: 'Talleres' },
    ],
    'sst': [
        { id: 'sst_presupuesto', label: 'Presupuesto Anual', module: 'SST' },
        { id: 'sst_gastos', label: 'Captura de Gastos', module: 'SST' },
    ],
    'gh': [
        { id: 'gh_gastos', label: 'Gestión Humana Gastos', module: 'GH' },
    ],
    'planeacion': [
        { id: 'plan_gastos', label: 'Gastos Planeación', module: 'Planeación' },
    ],
    'diseno': [
        { id: 'diseno_gastos', label: 'Gastos Diseño', module: 'Diseño' },
    ],
    'calidad': [
        { id: 'cal_dash_encuestas', label: 'Control Calidad/Nov', module: 'Calidad' },
        { id: 'cal_dash_nc_report', label: 'Reporte NC Calidad', module: 'Calidad' },
        { id: 'cal_dash_consolidado', label: 'Consolidado de NC', module: 'Calidad' },
        { id: 'cal_dash_planes', label: 'Planes de Acción', module: 'Calidad' },
        { id: 'cal_dash_externa', label: 'Calidad Externa', module: 'Calidad' },
        { id: 'cal_dash_actas', label: 'Actas Destrucción', module: 'Calidad' },
    ],
    'develop': [
        { id: 'dev_usuarios', label: 'Gestión de Usuarios', module: 'Desarrollo' },
        { id: 'dev_permisos', label: 'Adm. Responsabilidades', module: 'Desarrollo' },
    ],
};

interface ResponsabilidadesScreenProps {
    onBack: () => void;
    users: User[];
}

export default function ResponsabilidadesScreen({ onBack, users }: ResponsabilidadesScreenProps) {
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});

    React.useEffect(() => {
        if (selectedUser) {
            try {
                const perms = selectedUser.permissions ? JSON.parse(selectedUser.permissions) : {};
                setPermissions(perms);
            } catch (e) {
                console.error('Error parsing permissions:', e);
                setPermissions({});
            }
        }
    }, [selectedUser]);

    const handleSave = async () => {
        if (!selectedUser) return;

        try {
            const { updateUser } = require('../services/api');
            const updatedUser = {
                ...selectedUser,
                permissions: JSON.stringify(permissions)
            };
            
            await updateUser(selectedUser.id, updatedUser);
            Alert.alert('Éxito', 'Responsabilidades guardadas correctamente');
            setSelectedUser(null);
        } catch (error) {
            console.error('Error updating permissions:', error);
            Alert.alert('Error', 'No se pudieron guardar los cambios');
        }
    };

    const togglePermission = (permId: string) => {
        setPermissions(prev => ({ ...prev, [permId]: !prev[permId] }));
    };

    const filteredUsers = users.filter(u => 
        u.nombreMostrar.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    const renderUserItem = ({ item }: { item: User }) => (
        <TouchableOpacity 
            style={styles.card} 
            onPress={() => {
                console.log('Usuario seleccionado:', item.username);
                setSelectedUser(item);
            }}
        >
            <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.nombreMostrar}</Text>
                <Text style={styles.cardArea}>Usuario: {item.username}</Text>
                <View style={styles.rolesContainer}>
                    {item.role.split(',').map((r, i) => (
                        <View key={i} style={styles.badge}>
                            <Text style={styles.badgeText}>{r.trim().toUpperCase()}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <MaterialIcons name="settings" size={28} color="#6366F1" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color="white" />
                        <Text style={styles.backText}>Volver</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Administrador de Responsabilidades</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.searchContainer}>
                    <MaterialIcons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Click en un usuario para configurar sus vistas..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            <FlatList
                data={filteredUsers}
                renderItem={renderUserItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.list}
            />

            {/* Panel de Cuadrícula (Reemplaza al Modal para mayor compatibilidad) */}
            {selectedUser && (
                <View style={styles.overlayContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Configurar Vistas</Text>
                                <Text style={styles.modalSubtitle}>{selectedUser.nombreMostrar} ({selectedUser.username})</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.closeBtn}>
                                <MaterialIcons name="close" size={32} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.gridScroll}>
                            {selectedUser.role.split(',').map(role => {
                                const cleanRole = role.trim().toLowerCase();
                                const views = MODULE_VIEWS[cleanRole];
                                if (!views) return null;

                                return (
                                    <View key={role} style={styles.moduleSection}>
                                        <Text style={styles.moduleHeader}>{cleanRole.toUpperCase()}</Text>
                                        <View style={styles.gridContainer}>
                                            {views.map(view => (
                                                <TouchableOpacity 
                                                    key={view.id} 
                                                    style={[styles.gridItem, permissions[view.id] && styles.gridItemActive]}
                                                    onPress={() => togglePermission(view.id)}
                                                >
                                                    <View style={styles.gridItemTop}>
                                                        <MaterialIcons 
                                                            name={permissions[view.id] ? "check-circle" : "radio-button-unchecked"} 
                                                            size={24} 
                                                            color={permissions[view.id] ? "#10B981" : "#CBD5E1"} 
                                                        />
                                                        <Switch 
                                                            value={!!permissions[view.id]} 
                                                            onValueChange={() => togglePermission(view.id)}
                                                        />
                                                    </View>
                                                    <Text style={[styles.gridLabel, permissions[view.id] && styles.gridLabelActive]}>
                                                        {view.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedUser(null)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { backgroundColor: '#1E293B', padding: 20, paddingTop: 40, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backText: { color: 'white', marginLeft: 8, fontSize: 16 },
    title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 12, height: 45 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#1E293B' },
    list: { padding: 16 },
    card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2 },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    cardArea: { fontSize: 13, color: '#64748B', marginBottom: 8 },
    rolesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    badgeText: { fontSize: 9, color: '#64748B', fontWeight: 'bold' },

    // Overlay Styles (En lugar de Modal)
    overlayContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end', zIndex: 1000 },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '90%', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    modalTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
    modalSubtitle: { fontSize: 15, color: '#64748B', marginTop: 4 },
    closeBtn: { padding: 4 },
    gridScroll: { flex: 1 },
    moduleSection: { marginBottom: 32 },
    moduleHeader: { fontSize: 13, fontWeight: '900', color: '#6366F1', letterSpacing: 1.5, marginBottom: 16, backgroundColor: '#EEF2FF', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#F1F5F9', height: 120, justifyContent: 'space-between' },
    gridItemActive: { backgroundColor: '#F0FDF4', borderColor: '#10B981' },
    gridItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    gridLabel: { fontSize: 15, fontWeight: '700', color: '#475569', marginTop: 12 },
    gridLabelActive: { color: '#065F46' },
    modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingBottom: 30 },
    cancelBtn: { flex: 1, padding: 18, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center' },
    cancelBtnText: { fontWeight: 'bold', color: '#475569', fontSize: 16 },
    saveBtn: { flex: 2, padding: 18, borderRadius: 15, backgroundColor: '#6366F1', alignItems: 'center' },
    saveBtnText: { fontWeight: 'bold', color: 'white', fontSize: 16 }
});
