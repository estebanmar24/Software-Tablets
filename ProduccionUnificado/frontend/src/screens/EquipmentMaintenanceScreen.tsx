import React, { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
    TextInput, Alert, ScrollView, ActivityIndicator, Platform, Image, TouchableWithoutFeedback
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

interface Equipo {
    id: number;
    nombre: string;
    fechaInspeccion?: string;
    area?: string;
    usuarioAsignado?: string;
    correoUsuario?: string;
    contrasenaEquipo?: string;
    ubicacion?: string;
    estado: string;
    // PC
    pcMarca?: string;
    pcModelo?: string;
    pcSerie?: string;
    pcInventario?: string;
    pcCondicionesFisicas?: string;
    pcEnciende: boolean;
    pcTieneDiscoFlexible: boolean;
    pcTieneCdDvd: boolean;
    pcBotonesCompletos: boolean;
    procesador?: string;
    memoriaRam?: string;
    discoDuro?: string;
    // Monitor
    monitorMarca?: string;
    monitorModelo?: string;
    monitorSerie?: string;
    monitorCondicionesFisicas?: string;
    monitorEnciende: boolean;
    monitorColoresCorrectos: boolean;
    monitorBotonesCompletos: boolean;
    // Teclado
    tecladoMarca?: string;
    tecladoModelo?: string;
    tecladoSerie?: string;
    tecladoCondicionesFisicas?: string;
    tecladoFuncionaCorrectamente: boolean;
    tecladoBotonesCompletos: boolean;
    tecladoSeReemplazo: boolean;
    // Mouse
    mouseMarca?: string;
    mouseModelo?: string;
    mouseSerie?: string;
    mouseCondicionesFisicas?: string;
    mouseFuncionaCorrectamente: boolean;
    mouseBotonesCompletos: boolean;
    // Otros
    impresoraMarca?: string;
    impresoraModelo?: string;
    impresoraSerie?: string;
    escanerMarca?: string;
    escanerModelo?: string;
    escanerSerie?: string;
    otrosDispositivos?: string;
    // Software
    sistemaOperativo?: string;
    versionOffice?: string;
    otroSoftware?: string;
    // Fechas
    ultimoMantenimiento?: string;
    proximoMantenimiento?: string;
    // Mantenimiento
    mantenimientoRequerido?: string;
    observaciones?: string;
    prioridad?: string;
    fotoUrl?: string; // Legacy
    fotos?: { id?: number; fotoUrl: string }[]; // New Gallery
}

interface Stats {
    totalEquipos: number;
    disponibles: number;
    asignados: number;
    enMantenimiento: number;
    fueraDeServicio: number;
    mantenimientosEsteMes: number;
    porcentajeOperativos: number;
}

interface Mantenimiento {
    id: number;
    tipo: string;
    trabajoRealizado?: string;
    tecnico?: string;
    costo: number;
    fecha: string;
    proximoProgramado?: string;
    observaciones?: string;
}

interface ProximoMantenimiento {
    id: number;
    nombre: string;
    ubicacion?: string;
    area?: string;
    proximoMantenimiento: string;
    diasRestantes: number;
}

export default function EquipmentMaintenanceScreen({ onBack }: { onBack: () => void }) {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'equipos'>(() => {
        if (Platform.OS === 'web') {
            return (localStorage.getItem('equipmentTab') as 'dashboard' | 'equipos') || 'dashboard';
        }
        return 'dashboard';
    });
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [proximos, setProximos] = useState<ProximoMantenimiento[]>([]);
    const [loading, setLoading] = useState(false);

    // Filtros
    const [filtroEstado, setFiltroEstado] = useState<string>('');
    const [filtroArea, setFiltroArea] = useState<string>('');
    const [busqueda, setBusqueda] = useState('');
    const [areas, setAreas] = useState<string[]>([]);

    // Modales
    const [modalEquipo, setModalEquipo] = useState(false);
    const [modalDetalle, setModalDetalle] = useState(false);
    const [modalHistorial, setModalHistorial] = useState(false);
    const [modalMantenimiento, setModalMantenimiento] = useState(false);
    const [modalTipoEquipo, setModalTipoEquipo] = useState(false);
    const [tipoEquipoSeleccionado, setTipoEquipoSeleccionado] = useState<string>('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [equipoSeleccionado, setEquipoSeleccionado] = useState<Equipo | null>(null);
    const [historial, setHistorial] = useState<Mantenimiento[]>([]);
    const [isEditing, setIsEditing] = useState(false);

    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [equipoParaEstado, setEquipoParaEstado] = useState<Equipo | null>(null);

    // Full Screen Image
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    // Autocomplete for equipment name
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

    // Tipos de equipo disponibles
    const TIPOS_EQUIPO = [
        { id: 'computador', nombre: '💻 Equipo de Cómputo', descripcion: 'PC + Monitor + Teclado + Mouse (obligatorio)', icono: '💻' },
        { id: 'monitor', nombre: '🖥️ Monitor', descripcion: 'Solo pantalla/monitor', icono: '🖥️' },
        { id: 'mouse', nombre: '🖱️ Mouse', descripcion: 'Solo mouse', icono: '🖱️' },
        { id: 'teclado', nombre: '⌨️ Teclado', descripcion: 'Solo teclado', icono: '⌨️' },
        { id: 'impresora', nombre: '🖨️ Impresora', descripcion: 'Impresora o multifuncional', icono: '🖨️' },
        { id: 'otro', nombre: '📦 Otro Dispositivo', descripcion: 'Especificar cuál es', icono: '📦' },
    ];

    // Form state
    const [formData, setFormData] = useState<Partial<Equipo>>({});
    const [mantenimientoData, setMantenimientoData] = useState({
        tipo: 'Preventivo',
        fecha: new Date().toISOString().split('T')[0],
        trabajoRealizado: '',
        tecnico: '',
        costo: 0,
        observaciones: '',
        proximoProgramado: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (activeTab === 'equipos') {
            loadEquipos();
        }
    }, [activeTab, filtroEstado, filtroArea]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, proximosRes, areasRes] = await Promise.all([
                fetch(`${API_BASE}/equipos/stats`),
                fetch(`${API_BASE}/equipos/proximos-mantenimientos`),
                fetch(`${API_BASE}/equipos/areas`)
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (proximosRes.ok) {
                const data = await proximosRes.json();
                setProximos(data.proximos || []);
            }
            if (areasRes.ok) setAreas(await areasRes.json());
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadEquipos = async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/equipos?`;
            if (filtroEstado) url += `estado=${filtroEstado}&`;
            if (filtroArea) url += `area=${encodeURIComponent(filtroArea)}&`;
            if (busqueda) url += `buscar=${encodeURIComponent(busqueda)}`;

            const res = await fetch(url);
            if (res.ok) setEquipos(await res.json());
        } catch (error) {
            console.error('Error loading equipos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        loadEquipos();
    };

    const openNewEquipo = () => {
        setTipoEquipoSeleccionado('');
        setModalTipoEquipo(true);
    };

    const confirmarTipoEquipo = (tipo: string) => {
        setTipoEquipoSeleccionado(tipo);
        setModalTipoEquipo(false);
        setFormData({
            estado: 'Disponible',
            pcEnciende: true,
            pcBotonesCompletos: true,
            monitorEnciende: true,
            monitorColoresCorrectos: true,
            monitorBotonesCompletos: true,
            tecladoFuncionaCorrectamente: true,
            tecladoBotonesCompletos: true,
            mouseFuncionaCorrectamente: true,
            mouseBotonesCompletos: true
        });
        setIsEditing(false);
        setModalEquipo(true);
    };

    const openEditEquipo = (equipo: Equipo) => {
        setFormData(equipo);
        setIsEditing(true);
        setModalEquipo(true);
    };

    const openDetalle = async (equipo: Equipo) => {
        setEquipoSeleccionado(equipo);
        setModalDetalle(true);
    };

    const openHistorial = async (equipo: Equipo) => {
        setEquipoSeleccionado(equipo);
        try {
            const res = await fetch(`${API_BASE}/equipos/${equipo.id}/mantenimientos`);
            if (res.ok) {
                const data = await res.json();
                setHistorial(data.mantenimientos || []);
            }
        } catch (error) {
            console.error('Error loading historial:', error);
        }
        setModalHistorial(true);
    };

    const openNuevoMantenimiento = (equipo: Equipo) => {
        setEquipoSeleccionado(equipo);
        setMantenimientoData({
            tipo: 'Preventivo',
            fecha: new Date().toISOString().split('T')[0],
            trabajoRealizado: '',
            tecnico: '',
            costo: 0,
            observaciones: '',
            proximoProgramado: ''
        });
        setModalMantenimiento(true);
    };

    const handleSaveEquipo = async () => {
        if (!formData.nombre) {
            Alert.alert('Error', 'El nombre del equipo es obligatorio');
            return;
        }
        try {
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? `${API_BASE}/equipos/${formData.id}` : `${API_BASE}/equipos`;

            // Sanitize data: convert empty strings to null for DateTime fields
            const sanitizedData = { ...formData };
            const dateFields = ['fechaInspeccion', 'proximoMantenimiento', 'ultimoMantenimiento'];
            dateFields.forEach(field => {
                if ((sanitizedData as any)[field] === '') {
                    (sanitizedData as any)[field] = null;
                }
            });

            // DEBUG: Log what we're sending
            console.log('💾 Saving Equipo:', JSON.stringify(sanitizedData, null, 2));
            console.log('📷 Fotos being sent:', sanitizedData.fotos);

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitizedData)
            });

            if (res.ok) {
                Alert.alert('Éxito', isEditing ? 'Equipo actualizado' : 'Equipo creado');
                setModalEquipo(false);
                loadEquipos();
                loadData();
            } else {
                const err = await res.json();
                Alert.alert('Error', err.message || 'No se pudo guardar');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de conexión');
        }
    };

    const handleCambiarEstado = async (equipo: Equipo, nuevoEstado: string) => {
        try {
            const res = await fetch(`${API_BASE}/equipos/${equipo.id}/estado`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            if (res.ok) {
                loadEquipos();
                loadData();
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo cambiar el estado');
        }
    };

    const handleDeleteEquipo = async (id: number) => {
        // Alert.alert with buttons doesn't work on web, use window.confirm
        const shouldDelete = typeof window !== 'undefined' && Platform.OS === 'web'
            ? window.confirm('¿Eliminar este equipo?')
            : await new Promise<boolean>(resolve => {
                Alert.alert('Confirmar', '¿Eliminar este equipo?', [
                    { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }
                ]);
            });

        if (shouldDelete) {
            try {
                const res = await fetch(`${API_BASE}/equipos/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    loadEquipos();
                    loadData();
                } else {
                    Alert.alert('Error', 'No se pudo eliminar el equipo');
                }
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        }
    };

    const handleSaveMantenimiento = async () => {
        if (!equipoSeleccionado) return;
        try {
            // Sanitize data: convert empty strings to null for DateTime fields
            const sanitizedData = { ...mantenimientoData };
            if (sanitizedData.proximoProgramado === '') {
                (sanitizedData as any).proximoProgramado = null;
            }

            const res = await fetch(`${API_BASE}/equipos/${equipoSeleccionado.id}/mantenimientos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitizedData)
            });
            if (res.ok) {
                Alert.alert('Éxito', 'Mantenimiento registrado');
                setModalMantenimiento(false);
                loadEquipos();
                loadData();
            } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Error', err.message || 'No se pudo registrar');
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo registrar');
        }
    };

    const handleDeleteMantenimiento = async (mantenimientoId: number) => {
        // Use window.confirm on web, Alert.alert on native
        const doDelete = async () => {
            try {
                const res = await fetch(`${API_BASE}/equipos/mantenimientos/${mantenimientoId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    if (Platform.OS === 'web') {
                        alert('Mantenimiento eliminado');
                    } else {
                        Alert.alert('Éxito', 'Mantenimiento eliminado');
                    }
                    // Reload historial
                    if (equipoSeleccionado) {
                        const histRes = await fetch(`${API_BASE}/equipos/${equipoSeleccionado.id}/mantenimientos`);
                        if (histRes.ok) {
                            const data = await histRes.json();
                            setHistorial(data.mantenimientos || []);
                        }
                    }
                } else {
                    const errData = await res.json().catch(() => ({}));
                    if (Platform.OS === 'web') {
                        alert('Error: ' + (errData.message || 'No se pudo eliminar'));
                    } else {
                        Alert.alert('Error', errData.message || 'No se pudo eliminar');
                    }
                }
            } catch (error) {
                if (Platform.OS === 'web') {
                    alert('Error: No se pudo eliminar');
                } else {
                    Alert.alert('Error', 'No se pudo eliminar');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro que desea eliminar este registro de mantenimiento?')) {
                await doDelete();
            }
        } else {
            Alert.alert(
                'Confirmar Eliminación',
                '¿Está seguro que desea eliminar este registro de mantenimiento?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: doDelete }
                ]
            );
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0]);
        }
    };

    const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
        const localUri = asset.uri;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

        const formDataImg = new FormData();

        if (Platform.OS === 'web') {
            // For Web: Fetch the blob from the URI
            const response = await fetch(localUri);
            const blob = await response.blob();

            // Ensure filename has extension (Crucial for StaticFiles middleware)
            let finalName = filename || 'image.jpg';
            if (!finalName.includes('.')) {
                const ext = blob.type.split('/')[1] || 'jpg';
                finalName = `${finalName}.${ext}`;
            }

            formDataImg.append('archivo', blob, finalName);
        } else {
            // For Mobile (iOS/Android): Use the React Native FormData object format
            // @ts-ignore
            formDataImg.append('archivo', { uri: localUri, name: filename, type });
        }

        try {
            const res = await fetch(`${API_BASE}/equipos/upload-foto`, {
                method: 'POST',
                body: formDataImg,
            });
            const data = await res.json();

            if (res.ok) {
                // Agregar a la lista de fotos
                setFormData(prev => {
                    const currentFotos = prev.fotos || [];
                    return {
                        ...prev,
                        fotos: [...currentFotos, { fotoUrl: data.url }]
                    };
                });
            } else {
                console.error('Upload error:', data);
                Alert.alert('Error', `Error al subir imagen: ${data.message || res.statusText}`);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error de conexión al subir imagen');
        }
    };


    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Disponible': return '#28a745';
            case 'Asignado': return '#007bff';
            case 'EnMantenimiento': return '#ffc107';
            case 'FueraDeServicio': return '#dc3545';
            default: return '#6c757d';
        }
    };

    const getEstadoLabel = (estado: string) => {
        switch (estado) {
            case 'EnMantenimiento': return 'En Mantenimiento';
            case 'FueraDeServicio': return 'Fuera de Servicio';
            default: return estado;
        }
    };

    const getPrioridadColor = (prioridad?: string) => {
        switch (prioridad) {
            case 'Alta': return '#dc3545'; // Rojo
            case 'Media': return '#ffc107'; // Amarillo
            case 'Baja': return '#28a745'; // Verde
            default: return '#e0e0e0'; // Gris
        }
    };

    // ==================== RENDER ====================

    const renderDashboard = () => (
        <ScrollView style={styles.dashboardContainer}>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: '#4A90D9' }]}>
                    <Text style={styles.statTitle}>Total de PCs</Text>
                    <Text style={styles.statValue}>{stats?.totalEquipos || 0}</Text>
                    <Text style={styles.statSubtitle}>Equipos registrados</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#28a745' }]}>
                    <Text style={styles.statTitle}>Operativos</Text>
                    <Text style={[styles.statValue, { color: '#28a745' }]}>
                        {(stats?.disponibles || 0) + (stats?.asignados || 0)}
                    </Text>
                    <Text style={styles.statSubtitle}>{stats?.porcentajeOperativos || 0}% del total</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#ffc107' }]}>
                    <Text style={styles.statTitle}>En Mantenimiento</Text>
                    <Text style={[styles.statValue, { color: '#ffc107' }]}>{stats?.enMantenimiento || 0}</Text>
                    <Text style={styles.statSubtitle}>En reparación</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#dc3545' }]}>
                    <Text style={styles.statTitle}>Fuera de Servicio</Text>
                    <Text style={[styles.statValue, { color: '#dc3545' }]}>{stats?.fueraDeServicio || 0}</Text>
                    <Text style={styles.statSubtitle}>No operativos</Text>
                </View>
            </View>

            {/* Próximos Mantenimientos */}
            <View style={styles.proximosSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Próximos Mantenimientos (30 días)</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{proximos.length} pendientes</Text>
                    </View>
                </View>
                {proximos.length === 0 ? (
                    <Text style={styles.emptyText}>No hay mantenimientos programados</Text>
                ) : (
                    proximos.map(item => (
                        <View key={item.id} style={styles.proximoCard}>
                            <View style={styles.proximoIcon}>
                                <Text style={{ fontSize: 20 }}>💻</Text>
                            </View>
                            <View style={styles.proximoInfo}>
                                <Text style={styles.proximoNombre}>{item.nombre}</Text>
                                <Text style={styles.proximoUbicacion}>{item.ubicacion} - {item.area}</Text>
                            </View>
                            <View style={styles.proximoFecha}>
                                <Text style={styles.proximoFechaText}>{formatDate(item.proximoMantenimiento)}</Text>
                                <View style={[styles.diasBadge, { backgroundColor: item.diasRestantes <= 7 ? '#ffc107' : '#e3f2fd' }]}>
                                    <Text style={styles.diasBadgeText}>{item.diasRestantes} días</Text>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );

    const renderEquipos = () => (
        <View style={styles.equiposContainer}>
            {/* Search and Filters */}
            <View style={styles.filterRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por nombre, marca, modelo..."
                    value={busqueda}
                    onChangeText={setBusqueda}
                    onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.addButton} onPress={openNewEquipo}>
                    <Text style={styles.addButtonText}>+ Agregar Equipo</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterChip, !filtroEstado && styles.filterChipActive]}
                    onPress={() => setFiltroEstado('')}
                >
                    <Text style={!filtroEstado ? styles.filterChipTextActive : styles.filterChipText}>Todos</Text>
                </TouchableOpacity>
                {['Disponible', 'Asignado', 'EnMantenimiento', 'FueraDeServicio'].map(est => (
                    <TouchableOpacity
                        key={est}
                        style={[styles.filterChip, filtroEstado === est && styles.filterChipActive]}
                        onPress={() => setFiltroEstado(filtroEstado === est ? '' : est)}
                    >
                        <Text style={filtroEstado === est ? styles.filterChipTextActive : styles.filterChipText}>
                            {getEstadoLabel(est)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Equipment Grid */}
            {loading ? (
                <ActivityIndicator size="large" color="#4A90D9" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={equipos}
                    keyExtractor={item => item.id.toString()}
                    numColumns={3}
                    columnWrapperStyle={styles.equiposRow}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    renderItem={({ item }) => (
                        <View style={styles.equipoCard}>
                            <View style={styles.equipoHeader}>

                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                    <Text style={styles.equipoNombre} numberOfLines={2}>{item.nombre}</Text>
                                    {((item.fotos?.length ?? 0) > 0 || !!item.fotoUrl) && (
                                        <MaterialIcons name="photo-camera" size={16} color="#4A90D9" style={{ marginLeft: 6 }} />
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) }]}
                                    onPress={() => {
                                        setEquipoParaEstado(item);
                                        setStatusModalVisible(true);
                                    }}
                                >
                                    <Text style={styles.estadoBadgeText}>{getEstadoLabel(item.estado)} ▼</Text>
                                </TouchableOpacity>
                                {item.prioridad && (
                                    <View style={[styles.estadoBadge, { backgroundColor: getPrioridadColor(item.prioridad), marginLeft: 4 }]}>
                                        <Text style={styles.estadoBadgeText}>{item.prioridad}</Text>
                                    </View>
                                )}
                            </View>

                            {item.fotoUrl && (
                                <Image
                                    source={{ uri: `${API_BASE.replace('/api', '')}${item.fotoUrl}` }}
                                    style={styles.equipoImageCard}
                                    resizeMode="cover"
                                />
                            )}

                            <Text style={styles.equipoMarca}>{item.pcMarca} {item.pcModelo}</Text>
                            <Text style={styles.equipoUbicacion}>📍 {item.ubicacion || 'Sin ubicación'}</Text>
                            <Text style={styles.equipoArea}>● {item.area || 'Sin área'}</Text>

                            <View style={styles.equipoFechas}>
                                <Text style={styles.fechaLabel}>Inspección: {formatDate(item.fechaInspeccion)}</Text>
                                <Text style={styles.fechaLabel}>Mantenimiento: {formatDate(item.ultimoMantenimiento)}</Text>
                            </View>

                            <View style={styles.equipoActions}>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => openDetalle(item)}>
                                    <Text style={styles.actionBtnText}>Hoja de Vida</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => openHistorial(item)}>
                                    <Text style={styles.actionBtnText}>Historial</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.mantenimientoBtn}
                                onPress={() => openNuevoMantenimiento(item)}
                            >
                                <Text style={styles.mantenimientoBtnText}>+ Mantenimiento</Text>
                            </TouchableOpacity>

                            {/* Quick actions */}
                            <View style={styles.quickActions}>
                                <TouchableOpacity onPress={() => openEditEquipo(item)}>
                                    <Text style={styles.quickActionText}>✏️ Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteEquipo(item.id)}>
                                    <Text style={[styles.quickActionText, { color: '#dc3545' }]}>🗑️</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No hay equipos registrados</Text>
                    }
                />
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Volver</Text>
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerIcon}>💻</Text>
                    <View>
                        <Text style={styles.headerTitle}>Control de Mantenimiento de Equipos</Text>
                        <Text style={styles.headerSubtitle}>Gestión integral de equipos de cómputo</Text>
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
                    onPress={() => {
                        setActiveTab('dashboard');
                        if (Platform.OS === 'web') localStorage.setItem('equipmentTab', 'dashboard');
                        loadData();
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
                        📊 Panel de Control
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'equipos' && styles.tabActive]}
                    onPress={() => {
                        setActiveTab('equipos');
                        if (Platform.OS === 'web') localStorage.setItem('equipmentTab', 'equipos');
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'equipos' && styles.tabTextActive]}>
                        🖥️ Equipos ({stats?.totalEquipos || 0})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'dashboard' ? renderDashboard() : renderEquipos()}

            {/* Modal: Agregar/Editar Equipo */}
            <Modal visible={modalEquipo} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 800, width: '90%', maxHeight: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {!isEditing && (
                                    <TouchableOpacity onPress={() => { setModalEquipo(false); setModalTipoEquipo(true); }} style={{ padding: 8, marginRight: 8 }}>
                                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                                    </TouchableOpacity>
                                )}
                                <Text style={styles.modalTitle}>{isEditing ? 'Editar Equipo' : 'Nuevo Equipo'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalEquipo(false)} style={{ padding: 8 }}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {/* Photo Gallery Section */}
                            <View style={styles.photoSection}>
                                <Text style={styles.label}>Galería de Fotos</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingVertical: 10 }}>

                                    {/* Add Button */}
                                    <TouchableOpacity onPress={pickImage} style={styles.addPhotoBtn}>
                                        <MaterialIcons name="add-a-photo" size={32} color="#4A90D9" />
                                        <Text style={{ fontSize: 11, marginTop: 4, color: '#4A90D9' }}>Agregar</Text>
                                    </TouchableOpacity>

                                    {/* List Photos */}
                                    {(formData.fotos || (formData.fotoUrl ? [{ fotoUrl: formData.fotoUrl }] : [])).map((foto, index) => (
                                        <View key={index} style={{ marginLeft: 12, position: 'relative' }}>
                                            <TouchableOpacity onPress={() => setFullScreenImage(foto.fotoUrl)}>
                                                <Image
                                                    source={{ uri: `${API_BASE.replace('/api', '')}${foto.fotoUrl}` }}
                                                    style={styles.photoPreview}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.deletePhotoBtn}
                                                onPress={async () => {
                                                    const performDelete = () => {
                                                        setFormData(prev => {
                                                            const current = prev.fotos || (prev.fotoUrl ? [{ fotoUrl: prev.fotoUrl }] : []);
                                                            const updated = current.filter((_, i) => i !== index);
                                                            return { ...prev, fotos: updated, fotoUrl: updated.length > 0 ? updated[0].fotoUrl : '' };
                                                        });
                                                    };

                                                    if (Platform.OS === 'web') {
                                                        if (window.confirm('¿Estás seguro que deseas eliminar esta foto? Tendrás que guardar los cambios del equipo para que sea permanente.')) {
                                                            performDelete();
                                                        }
                                                    } else {
                                                        Alert.alert(
                                                            'Eliminar Foto',
                                                            '¿Estás seguro que deseas eliminar esta foto? Tendrás que guardar los cambios del equipo para que sea permanente.',
                                                            [
                                                                { text: 'Cancelar', style: 'cancel' },
                                                                { text: 'Eliminar', style: 'destructive', onPress: performDelete }
                                                            ]
                                                        );
                                                    }
                                                }}
                                            >
                                                <MaterialIcons name="close" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Info Section */}
                            <Text style={styles.formSectionTitle}>📋 Información General</Text>
                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 2, zIndex: 1000 }]}>
                                    <Text style={styles.label}>Nombre del Equipo *</Text>
                                    <View style={{ position: 'relative' }}>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.nombre || ''}
                                            onChangeText={v => {
                                                setFormData({ ...formData, nombre: v });
                                                // Filter suggestions based on input
                                                if (v.length > 0) {
                                                    const filtered = equipos
                                                        .map(e => e.nombre)
                                                        .filter(n => n.toLowerCase().includes(v.toLowerCase()) && n !== v);
                                                    setNameSuggestions(filtered);
                                                    setShowNameSuggestions(filtered.length > 0);
                                                } else {
                                                    // Show all if empty
                                                    const allNames = equipos.map(e => e.nombre);
                                                    setNameSuggestions(allNames);
                                                    setShowNameSuggestions(allNames.length > 0);
                                                }
                                            }}
                                            onFocus={() => {
                                                const allNames = equipos.map(e => e.nombre);
                                                setNameSuggestions(allNames);
                                                setShowNameSuggestions(allNames.length > 0);
                                            }}
                                            onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                                            placeholder="Ej: PC-Gerencia-01 o seleccione existente"
                                        />
                                        {showNameSuggestions && nameSuggestions.length > 0 && (
                                            <View style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                backgroundColor: '#fff',
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: '#e0e0e0',
                                                maxHeight: 150,
                                                zIndex: 9999,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.15,
                                                shadowRadius: 4,
                                                elevation: 5
                                            }}>
                                                <ScrollView nestedScrollEnabled>
                                                    {nameSuggestions.slice(0, 10).map((name, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            onPress={() => {
                                                                setFormData({ ...formData, nombre: name });
                                                                setShowNameSuggestions(false);
                                                            }}
                                                            style={{
                                                                padding: 12,
                                                                borderBottomWidth: idx < nameSuggestions.length - 1 ? 1 : 0,
                                                                borderBottomColor: '#f0f0f0'
                                                            }}
                                                        >
                                                            <Text style={{ color: '#2c3e50', fontSize: 14 }}>💻 {name}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>Fecha Inspección</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="date"
                                            value={formData.fechaInspeccion ? formData.fechaInspeccion.split('T')[0] : ''}
                                            onChange={(e: any) => setFormData({ ...formData, fechaInspeccion: e.target.value })}
                                            style={{
                                                padding: '11px',
                                                borderRadius: 8,
                                                border: '1px solid #e0e0e0',
                                                backgroundColor: '#fff',
                                                width: '100%',
                                                fontSize: 14,
                                                fontFamily: 'System',
                                                color: '#2c3e50'
                                            }}
                                        />
                                    ) : (
                                        <TextInput
                                            style={styles.input}
                                            value={formData.fechaInspeccion?.split('T')[0]}
                                            onChangeText={v => setFormData({ ...formData, fechaInspeccion: v })}
                                            placeholder="YYYY-MM-DD"
                                        />
                                    )}
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Departamento / Área</Text>
                                    <TextInput style={styles.input} value={formData.area || ''} onChangeText={v => setFormData({ ...formData, area: v })} placeholder="Ej: Contabilidad" />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Ubicación Física</Text>
                                    <TextInput style={styles.input} value={formData.ubicacion || ''} onChangeText={v => setFormData({ ...formData, ubicacion: v })} placeholder="Ej: Piso 2, Oficina 204" />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Usuario Asignado</Text>
                                    <TextInput style={styles.input} value={formData.usuarioAsignado || ''} onChangeText={v => setFormData({ ...formData, usuarioAsignado: v })} placeholder="Nombre del responsable" />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Correo Electrónico</Text>
                                    <TextInput style={styles.input} value={formData.correoUsuario || ''} onChangeText={v => setFormData({ ...formData, correoUsuario: v })} placeholder="usuario@empresa.com" keyboardType="email-address" />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Contraseña Equipo</Text>
                                <TextInput style={styles.input} value={formData.contrasenaEquipo || ''} onChangeText={v => setFormData({ ...formData, contrasenaEquipo: v })} placeholder="Contraseña de inicio de sesión" />
                            </View>

                            <Text style={[styles.label, { marginTop: 16 }]}>Prioridad</Text>
                            <View style={styles.segmentControl}>
                                {['Alta', 'Media', 'Baja'].map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.segmentBtn, formData.prioridad === p && { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }]}
                                        onPress={() => setFormData({ ...formData, prioridad: p })}
                                    >
                                        <Text style={[styles.segmentBtnText, formData.prioridad === p && { color: getPrioridadColor(p) }]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* PC - Solo para Equipo de Cómputo */}
                            {(isEditing || tipoEquipoSeleccionado === 'computador') && (
                                <>
                                    <Text style={styles.formSectionTitle}>💻 PC</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Marca"
                                            value={formData.pcMarca || ''}
                                            onChangeText={v => setFormData({ ...formData, pcMarca: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Modelo"
                                            value={formData.pcModelo || ''}
                                            onChangeText={v => setFormData({ ...formData, pcModelo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Serie"
                                            value={formData.pcSerie || ''}
                                            onChangeText={v => setFormData({ ...formData, pcSerie: v })}
                                        />
                                    </View>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Inventario"
                                            value={formData.pcInventario || ''}
                                            onChangeText={v => setFormData({ ...formData, pcInventario: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Condiciones Físicas"
                                            value={formData.pcCondicionesFisicas || ''}
                                            onChangeText={v => setFormData({ ...formData, pcCondicionesFisicas: v })}
                                        />
                                    </View>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Procesador"
                                            value={formData.procesador || ''}
                                            onChangeText={v => setFormData({ ...formData, procesador: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Memoria RAM"
                                            value={formData.memoriaRam || ''}
                                            onChangeText={v => setFormData({ ...formData, memoriaRam: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Disco Duro"
                                            value={formData.discoDuro || ''}
                                            onChangeText={v => setFormData({ ...formData, discoDuro: v })}
                                        />
                                    </View>
                                    <View style={styles.checkboxRow}>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, pcEnciende: !formData.pcEnciende })}>
                                            <Text style={styles.checkboxIcon}>{formData.pcEnciende ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Enciende</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, pcBotonesCompletos: !formData.pcBotonesCompletos })}>
                                            <Text style={styles.checkboxIcon}>{formData.pcBotonesCompletos ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Botones Completos</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, pcTieneDiscoFlexible: !formData.pcTieneDiscoFlexible })}>
                                            <Text style={styles.checkboxIcon}>{formData.pcTieneDiscoFlexible ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Disco Flexible</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, pcTieneCdDvd: !formData.pcTieneCdDvd })}>
                                            <Text style={styles.checkboxIcon}>{formData.pcTieneCdDvd ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>CD/DVD</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {/* Monitor */}
                            {(isEditing || tipoEquipoSeleccionado === 'computador' || tipoEquipoSeleccionado === 'monitor') && (
                                <>
                                    <Text style={styles.formSectionTitle}>🖥️ Monitor</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Marca"
                                            value={formData.monitorMarca || ''}
                                            onChangeText={v => setFormData({ ...formData, monitorMarca: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Modelo"
                                            value={formData.monitorModelo || ''}
                                            onChangeText={v => setFormData({ ...formData, monitorModelo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Serie"
                                            value={formData.monitorSerie || ''}
                                            onChangeText={v => setFormData({ ...formData, monitorSerie: v })}
                                        />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Condiciones Físicas"
                                        value={formData.monitorCondicionesFisicas || ''}
                                        onChangeText={v => setFormData({ ...formData, monitorCondicionesFisicas: v })}
                                    />
                                    <View style={styles.checkboxRow}>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, monitorEnciende: !formData.monitorEnciende })}>
                                            <Text style={styles.checkboxIcon}>{formData.monitorEnciende ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Enciende</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, monitorColoresCorrectos: !formData.monitorColoresCorrectos })}>
                                            <Text style={styles.checkboxIcon}>{formData.monitorColoresCorrectos ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Colores Correctos</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, monitorBotonesCompletos: !formData.monitorBotonesCompletos })}>
                                            <Text style={styles.checkboxIcon}>{formData.monitorBotonesCompletos ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Botones Completos</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {/* Teclado */}
                            {(isEditing || tipoEquipoSeleccionado === 'computador' || tipoEquipoSeleccionado === 'teclado') && (
                                <>
                                    <Text style={styles.formSectionTitle}>⌨️ Teclado</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Marca"
                                            value={formData.tecladoMarca || ''}
                                            onChangeText={v => setFormData({ ...formData, tecladoMarca: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Modelo"
                                            value={formData.tecladoModelo || ''}
                                            onChangeText={v => setFormData({ ...formData, tecladoModelo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Serie"
                                            value={formData.tecladoSerie || ''}
                                            onChangeText={v => setFormData({ ...formData, tecladoSerie: v })}
                                        />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Condiciones Físicas"
                                        value={formData.tecladoCondicionesFisicas || ''}
                                        onChangeText={v => setFormData({ ...formData, tecladoCondicionesFisicas: v })}
                                    />
                                    <View style={styles.checkboxRow}>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, tecladoFuncionaCorrectamente: !formData.tecladoFuncionaCorrectamente })}>
                                            <Text style={styles.checkboxIcon}>{formData.tecladoFuncionaCorrectamente ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Funciona Correctamente</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, tecladoBotonesCompletos: !formData.tecladoBotonesCompletos })}>
                                            <Text style={styles.checkboxIcon}>{formData.tecladoBotonesCompletos ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Botones Completos</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, tecladoSeReemplazo: !formData.tecladoSeReemplazo })}>
                                            <Text style={styles.checkboxIcon}>{formData.tecladoSeReemplazo ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Se Reemplazó</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {/* Mouse */}
                            {(isEditing || tipoEquipoSeleccionado === 'computador' || tipoEquipoSeleccionado === 'mouse') && (
                                <>
                                    <Text style={styles.formSectionTitle}>🖱️ Mouse</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Marca"
                                            value={formData.mouseMarca || ''}
                                            onChangeText={v => setFormData({ ...formData, mouseMarca: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Modelo"
                                            value={formData.mouseModelo || ''}
                                            onChangeText={v => setFormData({ ...formData, mouseModelo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Serie"
                                            value={formData.mouseSerie || ''}
                                            onChangeText={v => setFormData({ ...formData, mouseSerie: v })}
                                        />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Condiciones Físicas"
                                        value={formData.mouseCondicionesFisicas || ''}
                                        onChangeText={v => setFormData({ ...formData, mouseCondicionesFisicas: v })}
                                    />
                                    <View style={styles.checkboxRow}>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, mouseFuncionaCorrectamente: !formData.mouseFuncionaCorrectamente })}>
                                            <Text style={styles.checkboxIcon}>{formData.mouseFuncionaCorrectamente ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Funciona Correctamente</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.checkbox} onPress={() => setFormData({ ...formData, mouseBotonesCompletos: !formData.mouseBotonesCompletos })}>
                                            <Text style={styles.checkboxIcon}>{formData.mouseBotonesCompletos ? '☑' : '☐'}</Text>
                                            <Text style={styles.checkboxLabel}>Botones Completos</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {/* Impresora, Escáner */}
                            {(isEditing || tipoEquipoSeleccionado === 'impresora') && (
                                <>
                                    <Text style={styles.formSectionTitle}>🖨️ Impresora / Escáner</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Marca (Impresora)"
                                            value={formData.impresoraMarca || ''}
                                            onChangeText={v => setFormData({ ...formData, impresoraMarca: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Modelo"
                                            value={formData.impresoraModelo || ''}
                                            onChangeText={v => setFormData({ ...formData, impresoraModelo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Serie"
                                            value={formData.impresoraSerie || ''}
                                            onChangeText={v => setFormData({ ...formData, impresoraSerie: v })}
                                        />
                                    </View>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Marca (Escáner)"
                                            value={formData.escanerMarca || ''}
                                            onChangeText={v => setFormData({ ...formData, escanerMarca: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Modelo"
                                            value={formData.escanerModelo || ''}
                                            onChangeText={v => setFormData({ ...formData, escanerModelo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Serie"
                                            value={formData.escanerSerie || ''}
                                            onChangeText={v => setFormData({ ...formData, escanerSerie: v })}
                                        />
                                    </View>
                                </>
                            )}

                            {/* Otros Dispositivos */}
                            {(isEditing || tipoEquipoSeleccionado === 'otro') && (
                                <>
                                    <Text style={styles.sectionLabel}>📦 Otros Dispositivos</Text>
                                    <TextInput
                                        style={[styles.input, { height: 60 }]}
                                        placeholder="Otros dispositivos (UPS, parlantes, cámara, etc.)"
                                        multiline
                                        value={formData.otrosDispositivos || ''}
                                        onChangeText={v => setFormData({ ...formData, otrosDispositivos: v })}
                                    />
                                </>
                            )}

                            {/* Software */}
                            {(isEditing || tipoEquipoSeleccionado === 'computador') && (
                                <>
                                    <Text style={styles.sectionLabel}>💿 Software</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                                            placeholder="Sistema Operativo"
                                            value={formData.sistemaOperativo || ''}
                                            onChangeText={v => setFormData({ ...formData, sistemaOperativo: v })}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="Office"
                                            value={formData.versionOffice || ''}
                                            onChangeText={v => setFormData({ ...formData, versionOffice: v })}
                                        />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Otro Software Instalado"
                                        value={formData.otroSoftware || ''}
                                        onChangeText={v => setFormData({ ...formData, otroSoftware: v })}
                                    />
                                </>
                            )}

                            {/* Mantenimiento Requerido */}
                            <Text style={styles.sectionLabel}>🔧 Mantenimiento Requerido</Text>
                            {Platform.OS === 'web' ? (
                                <View style={{ marginBottom: 12 }}>
                                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>F. Próx. Mantenimiento</Text>
                                    <input
                                        type="date"
                                        value={formData.proximoMantenimiento ? formData.proximoMantenimiento.split('T')[0] : ''}
                                        onChange={(e: any) => setFormData({ ...formData, proximoMantenimiento: e.target.value })}
                                        style={{
                                            padding: '12px 30px 12px 12px',
                                            borderRadius: 8,
                                            border: '1px solid #e0e0e0',
                                            backgroundColor: '#f5f7fa',
                                            width: '100%',
                                            boxSizing: 'border-box' as const,
                                            fontSize: 14,
                                            fontFamily: 'System',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </View>
                            ) : (
                                <TextInput
                                    style={styles.input}
                                    placeholder="Fecha próximo mantenimiento (YYYY-MM-DD)"
                                    value={formData.proximoMantenimiento ? formData.proximoMantenimiento.split('T')[0] : ''}
                                    onChangeText={v => setFormData({ ...formData, proximoMantenimiento: v })}
                                />
                            )}
                            <TextInput
                                style={[styles.input, { height: 80 }]}
                                placeholder="Descripción del mantenimiento que se debe realizar"
                                multiline
                                value={formData.mantenimientoRequerido || ''}
                                onChangeText={v => setFormData({ ...formData, mantenimientoRequerido: v })}
                            />
                            <TextInput
                                style={[styles.input, { height: 80 }]}
                                placeholder="Observaciones generales del equipo"
                                multiline
                                value={formData.observaciones || ''}
                                onChangeText={v => setFormData({ ...formData, observaciones: v })}
                            />

                            {/* Estado */}
                            <Text style={styles.sectionLabel}>Estado del Equipo</Text>
                            <View style={styles.estadoSelector}>
                                {['Disponible', 'Asignado', 'EnMantenimiento', 'FueraDeServicio'].map(est => (
                                    <TouchableOpacity
                                        key={est}
                                        style={[
                                            styles.estadoOption,
                                            formData.estado === est && { backgroundColor: getEstadoColor(est) }
                                        ]}
                                        onPress={() => setFormData({ ...formData, estado: est })}
                                    >
                                        <Text style={[
                                            styles.estadoOptionText,
                                            formData.estado === est && { color: '#fff' }
                                        ]}>
                                            {getEstadoLabel(est)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Footer */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.btnCancel} onPress={() => setModalEquipo(false)}>
                                    <Text style={styles.btnCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSave} onPress={handleSaveEquipo}>
                                    <Text style={styles.btnSaveText}>Guardar Cambios</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View >
            </Modal >

            {/* Modal: Hoja de Vida (Detalle) */}
            < Modal visible={modalDetalle} animationType="slide" transparent >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>📄 Hoja de Vida del Equipo</Text>
                                <TouchableOpacity onPress={() => setModalDetalle(false)}>
                                    <Text style={{ fontSize: 24 }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalSubtitle}>Información completa del equipo {equipoSeleccionado?.nombre}</Text>

                            {equipoSeleccionado && (
                                <>
                                    {/* Información Básica */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>💻 Información Básica</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Nombre del Equipo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.nombre}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Ubicación</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.ubicacion || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Departamento</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.area || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Estado Actual</Text>
                                                <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(equipoSeleccionado.estado) }]}>
                                                    <Text style={styles.estadoBadgeText}>{getEstadoLabel(equipoSeleccionado.estado)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Usuario Asignado</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.usuarioAsignado || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Correo Usuario</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.correoUsuario || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Contraseña Equipo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.contrasenaEquipo || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Fecha Inspección</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.fechaInspeccion ? formatDate(equipoSeleccionado.fechaInspeccion) : 'N/A'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Hardware - PC */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>🖥️ Hardware - PC</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Marca</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.pcMarca || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Modelo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.pcModelo || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Número de Serie</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.pcSerie || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Inventario</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.pcInventario || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Condiciones Físicas</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.pcCondicionesFisicas || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.detalleRow, { flexWrap: 'wrap' }]}>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.pcEnciende ? '✅' : '❌'} Enciende
                                            </Text>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.pcBotonesCompletos ? '✅' : '❌'} Botones Completos
                                            </Text>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.pcTieneDiscoFlexible ? '✅' : '❌'} Disco Flexible
                                            </Text>
                                            <Text style={styles.detalleValue}>
                                                {equipoSeleccionado.pcTieneCdDvd ? '✅' : '❌'} CD/DVD
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Especificaciones */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>⚙️ Especificaciones</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Procesador</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.procesador || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Memoria RAM</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.memoriaRam || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Disco Duro</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.discoDuro || 'N/A'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Monitor */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>🖥️ Monitor</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Marca</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.monitorMarca || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Modelo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.monitorModelo || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Serie</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.monitorSerie || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Condiciones Físicas</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.monitorCondicionesFisicas || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.detalleRow, { flexWrap: 'wrap' }]}>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.monitorEnciende ? '✅' : '❌'} Enciende
                                            </Text>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.monitorColoresCorrectos ? '✅' : '❌'} Colores Correctos
                                            </Text>
                                            <Text style={styles.detalleValue}>
                                                {equipoSeleccionado.monitorBotonesCompletos ? '✅' : '❌'} Botones Completos
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Teclado */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>⌨️ Teclado</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Marca</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.tecladoMarca || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Modelo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.tecladoModelo || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Serie</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.tecladoSerie || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Condiciones Físicas</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.tecladoCondicionesFisicas || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.detalleRow, { flexWrap: 'wrap' }]}>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.tecladoFuncionaCorrectamente ? '✅' : '❌'} Funciona
                                            </Text>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.tecladoBotonesCompletos ? '✅' : '❌'} Botones Completos
                                            </Text>
                                            <Text style={styles.detalleValue}>
                                                {equipoSeleccionado.tecladoSeReemplazo ? '✅' : '❌'} Se Reemplazó
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Mouse */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>🖱️ Mouse</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Marca</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.mouseMarca || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Modelo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.mouseModelo || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Serie</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.mouseSerie || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Condiciones Físicas</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.mouseCondicionesFisicas || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.detalleRow, { flexWrap: 'wrap' }]}>
                                            <Text style={[styles.detalleValue, { marginRight: 16 }]}>
                                                {equipoSeleccionado.mouseFuncionaCorrectamente ? '✅' : '❌'} Funciona
                                            </Text>
                                            <Text style={styles.detalleValue}>
                                                {equipoSeleccionado.mouseBotonesCompletos ? '✅' : '❌'} Botones Completos
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Impresora / Escáner */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>🖨️ Impresora / Escáner</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Impresora Marca</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.impresoraMarca || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Modelo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.impresoraModelo || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Serie</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.impresoraSerie || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Escáner Marca</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.escanerMarca || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Modelo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.escanerModelo || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Serie</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.escanerSerie || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        {equipoSeleccionado.otrosDispositivos && (
                                            <View style={styles.detalleRow}>
                                                <View style={styles.detalleItem}>
                                                    <Text style={styles.detalleLabel}>Otros Dispositivos</Text>
                                                    <Text style={styles.detalleValue}>{equipoSeleccionado.otrosDispositivos}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Software */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>💿 Software</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Sistema Operativo</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.sistemaOperativo || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Office</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.versionOffice || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        {equipoSeleccionado.otroSoftware && (
                                            <View style={styles.detalleRow}>
                                                <View style={styles.detalleItem}>
                                                    <Text style={styles.detalleLabel}>Otro Software</Text>
                                                    <Text style={styles.detalleValue}>{equipoSeleccionado.otroSoftware}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Mantenimiento */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>🔧 Mantenimiento</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Último Mantenimiento</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.ultimoMantenimiento ? formatDate(equipoSeleccionado.ultimoMantenimiento) : 'N/A'}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Próximo Mantenimiento</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.proximoMantenimiento ? formatDate(equipoSeleccionado.proximoMantenimiento) : 'N/A'}</Text>
                                            </View>
                                        </View>
                                        {equipoSeleccionado.mantenimientoRequerido && (
                                            <View style={styles.detalleRow}>
                                                <View style={styles.detalleItem}>
                                                    <Text style={styles.detalleLabel}>Mantenimiento Requerido</Text>
                                                    <Text style={styles.detalleValue}>{equipoSeleccionado.mantenimientoRequerido}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {equipoSeleccionado.prioridad && (
                                            <View style={styles.detalleRow}>
                                                <View style={styles.detalleItem}>
                                                    <Text style={styles.detalleLabel}>Prioridad</Text>
                                                    <Text style={styles.detalleValue}>{equipoSeleccionado.prioridad}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Observaciones */}
                                    {equipoSeleccionado.observaciones && (
                                        <View style={styles.detalleSection}>
                                            <Text style={styles.detalleSectionTitle}>📝 Observaciones</Text>
                                            <View style={styles.detalleRow}>
                                                <View style={styles.detalleItem}>
                                                    <Text style={styles.detalleValue}>{equipoSeleccionado.observaciones}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    {/* Registro */}
                                    <View style={styles.detalleSection}>
                                        <Text style={styles.detalleSectionTitle}>📅 Registro</Text>
                                        <View style={styles.detalleRow}>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Fecha Creación</Text>
                                                <Text style={styles.detalleValue}>{formatDate(equipoSeleccionado.fechaCreacion)}</Text>
                                            </View>
                                            <View style={styles.detalleItem}>
                                                <Text style={styles.detalleLabel}>Última Actualización</Text>
                                                <Text style={styles.detalleValue}>{equipoSeleccionado.fechaActualizacion ? formatDate(equipoSeleccionado.fechaActualizacion) : 'N/A'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal >

            {/* Modal: Historial de Mantenimientos */}
            < Modal visible={modalHistorial} animationType="slide" transparent >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔧 Historial de Mantenimiento</Text>
                            <TouchableOpacity onPress={() => setModalHistorial(false)}>
                                <Text style={{ fontSize: 24 }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            {equipoSeleccionado?.nombre} • {historial.length} registros
                        </Text>

                        <ScrollView>
                            {historial.length === 0 ? (
                                <Text style={styles.emptyText}>No hay mantenimientos registrados</Text>
                            ) : (
                                historial.map((m, index) => (
                                    <View key={m.id} style={styles.historialCard}>
                                        <View style={styles.historialHeader}>
                                            <View style={[styles.tipoBadge, { backgroundColor: m.tipo === 'Preventivo' ? '#17a2b8' : '#dc3545' }]}>
                                                <Text style={styles.tipoBadgeText}>{m.tipo}</Text>
                                            </View>
                                            {index === 0 && (
                                                <View style={styles.recienteBadge}>
                                                    <Text style={styles.recienteBadgeText}>Más reciente</Text>
                                                </View>
                                            )}
                                            <Text style={styles.historialFecha}>{formatDate(m.fecha)}</Text>
                                        </View>
                                        <Text style={styles.historialDescripcion}>{m.trabajoRealizado || 'Sin descripción'}</Text>
                                        <View style={styles.historialFooter}>
                                            <Text style={styles.historialTecnico}>👤 {m.tecnico || 'N/A'}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.historialCosto}>💵 ${m.costo.toFixed(2)}</Text>
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteMantenimiento(m.id)}
                                                    style={{ marginLeft: 12, padding: 4 }}
                                                >
                                                    <Text style={{ fontSize: 16, color: '#dc3545' }}>🗑️</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal >

            {/* Modal: Registrar Mantenimiento */}
            < Modal visible={modalMantenimiento} animationType="slide" transparent >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>+ Registrar Mantenimiento</Text>
                        <Text style={styles.modalSubtitle}>{equipoSeleccionado?.nombre}</Text>

                        <Text style={styles.sectionLabel}>Tipo de Mantenimiento</Text>
                        <View style={styles.tipoSelector}>
                            {['Preventivo', 'Correctivo'].map(tipo => (
                                <TouchableOpacity
                                    key={tipo}
                                    style={[
                                        styles.tipoOption,
                                        mantenimientoData.tipo === tipo && styles.tipoOptionActive
                                    ]}
                                    onPress={() => setMantenimientoData({ ...mantenimientoData, tipo })}
                                >
                                    <Text style={mantenimientoData.tipo === tipo ? styles.tipoOptionTextActive : styles.tipoOptionText}>
                                        {tipo}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Fecha del Mantenimiento */}
                        {Platform.OS === 'web' ? (
                            <View style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Fecha del Mantenimiento</Text>
                                <input
                                    type="date"
                                    value={mantenimientoData.fecha || ''}
                                    onChange={(e: any) => setMantenimientoData({ ...mantenimientoData, fecha: e.target.value })}
                                    style={{
                                        padding: '12px',
                                        borderRadius: 8,
                                        border: '1px solid #e0e0e0',
                                        backgroundColor: '#f5f7fa',
                                        width: '100%',
                                        boxSizing: 'border-box' as const,
                                        fontSize: 14
                                    }}
                                />
                            </View>
                        ) : (
                            <TextInput
                                style={styles.input}
                                placeholder="Fecha del Mantenimiento (YYYY-MM-DD)"
                                value={mantenimientoData.fecha || ''}
                                onChangeText={v => setMantenimientoData({ ...mantenimientoData, fecha: v })}
                            />
                        )}

                        <TextInput
                            style={[styles.input, { height: 80 }]}
                            placeholder="Trabajo Realizado"
                            multiline
                            value={mantenimientoData.trabajoRealizado}
                            onChangeText={v => setMantenimientoData({ ...mantenimientoData, trabajoRealizado: v })}
                        />

                        <View style={styles.row}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 8 }]}
                                placeholder="Técnico"
                                value={mantenimientoData.tecnico}
                                onChangeText={v => setMantenimientoData({ ...mantenimientoData, tecnico: v })}
                            />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Costo ($)"
                                keyboardType="numeric"
                                value={mantenimientoData.costo.toString()}
                                onChangeText={v => setMantenimientoData({ ...mantenimientoData, costo: parseFloat(v) || 0 })}
                            />
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Observaciones"
                            value={mantenimientoData.observaciones}
                            onChangeText={v => setMantenimientoData({ ...mantenimientoData, observaciones: v })}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalMantenimiento(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMantenimiento}>
                                <Text style={styles.saveBtnText}>Registrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Seleccionar Tipo de Equipo */}
            <Modal visible={modalTipoEquipo} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 600 }]}>
                        <Text style={styles.modalTitle}>Seleccionar Tipo de Equipo</Text>
                        <Text style={styles.modalSubtitle}>¿Qué tipo de equipo deseas agregar?</Text>

                        <View style={styles.tipoEquipoGrid}>
                            {TIPOS_EQUIPO.map(tipo => (
                                <TouchableOpacity
                                    key={tipo.id}
                                    style={styles.tipoEquipoCard}
                                    onPress={() => confirmarTipoEquipo(tipo.id)}
                                >
                                    <Text style={styles.tipoEquipoIcono}>{tipo.icono}</Text>
                                    <Text style={styles.tipoEquipoNombre}>{tipo.nombre.replace(tipo.icono + ' ', '')}</Text>
                                    <Text style={styles.tipoEquipoDescripcion}>{tipo.descripcion}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalTipoEquipo(false)}>
                            <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal: Cambio Rápido de Estado */}
            <Modal visible={statusModalVisible} animationType="fade" transparent>
                <TouchableWithoutFeedback onPress={() => setStatusModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => { }}>
                            <View style={styles.statusModalContent}>
                                <Text style={styles.modalTitle}>Cambiar Estado</Text>
                                {['Disponible', 'Asignado', 'EnMantenimiento', 'FueraDeServicio'].map(est => (
                                    <TouchableOpacity
                                        key={est}
                                        style={[styles.statusOption, { borderLeftColor: getEstadoColor(est) }]}
                                        onPress={() => {
                                            if (equipoParaEstado) {
                                                handleCambiarEstado(equipoParaEstado, est);
                                                setStatusModalVisible(false);
                                            }
                                        }}
                                    >
                                        <Text style={styles.statusOptionText}>{getEstadoLabel(est)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Modal: Full Screen Image */}
            <Modal visible={!!fullScreenImage} animationType="fade" transparent onRequestClose={() => setFullScreenImage(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }} onPress={() => setFullScreenImage(null)}>
                        <MaterialIcons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {fullScreenImage && (
                        <Image
                            source={{ uri: `${API_BASE.replace('/api', '')}${fullScreenImage}` }}
                            style={{ width: '100%', height: '80%' }}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f7fa' },

    // Header
    header: { backgroundColor: '#2c3e50', padding: 16, flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 16 },
    backButtonText: { color: '#fff', fontSize: 16 },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
    headerIcon: { fontSize: 32, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

    // Tabs
    tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8 },
    tab: { paddingVertical: 12, paddingHorizontal: 24, marginRight: 8, borderRadius: 24, backgroundColor: '#f5f7fa' },
    tabActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#4A90D9' },
    tabText: { color: '#666', fontSize: 14 },
    tabTextActive: { color: '#4A90D9', fontWeight: 'bold' },

    // Dashboard
    dashboardContainer: { flex: 1, padding: 16 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    statCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '24%', borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    statTitle: { fontSize: 12, color: '#666', marginBottom: 8 },
    statValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
    statSubtitle: { fontSize: 11, color: '#999', marginTop: 4 },

    // Próximos Mantenimientos
    proximosSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    badge: { backgroundColor: '#e3f2fd', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#1976d2', fontSize: 12 },
    proximoCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fafafa', borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#4A90D9' },
    proximoIcon: { width: 40, height: 40, backgroundColor: '#e3f2fd', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    proximoInfo: { flex: 1 },
    proximoNombre: { fontWeight: 'bold', color: '#333' },
    proximoUbicacion: { fontSize: 12, color: '#666' },
    proximoFecha: { alignItems: 'flex-end' },
    proximoFechaText: { fontSize: 12, color: '#666' },
    diasBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
    diasBadgeText: { fontSize: 11, color: '#333' },

    // Equipos
    equiposContainer: { flex: 1, padding: 16 },
    filterRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
    searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginRight: 12, borderWidth: 1, borderColor: '#ddd' },
    addButton: { backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    addButtonText: { color: '#fff', fontWeight: 'bold' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
    filterChipActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
    filterChipText: { color: '#666' },
    filterChipTextActive: { color: '#fff' },

    // Equipment Cards
    equiposRow: { justifyContent: 'flex-start' },
    equipoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '32%', marginRight: '1%', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    equipoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    equipoNombre: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    estadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    estadoBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    equipoMarca: { fontSize: 13, color: '#666', marginBottom: 8 },
    equipoUbicacion: { fontSize: 12, color: '#888', marginBottom: 2 },
    equipoArea: { fontSize: 12, color: '#4A90D9', marginBottom: 8 },
    equipoFechas: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 8, marginBottom: 8 },
    fechaLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
    equipoSerie: { fontSize: 11, color: '#999', marginBottom: 12 },
    equipoActions: { flexDirection: 'row', marginBottom: 8 },
    actionBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', paddingVertical: 8, borderRadius: 6, marginRight: 4, alignItems: 'center' },
    actionBtnText: { fontSize: 11, color: '#333' },
    mantenimientoBtn: { backgroundColor: '#4A90D9', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
    mantenimientoBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
    quickActionText: { fontSize: 12, color: '#666' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%', maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
    input: { backgroundColor: '#f5f7fa', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
    row: { flexDirection: 'row' },
    checkboxRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    checkbox: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 },
    checkboxIcon: { fontSize: 20, marginRight: 6, color: '#4A90D9' },
    checkboxLabel: { fontSize: 13, color: '#333' },
    estadoSelector: { flexDirection: 'row', marginBottom: 16 },
    estadoOption: { flex: 1, paddingVertical: 10, borderRadius: 8, marginRight: 8, alignItems: 'center', backgroundColor: '#f5f7fa', borderWidth: 1, borderColor: '#ddd' },
    estadoOptionText: { color: '#666' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
    cancelBtn: { paddingHorizontal: 24, paddingVertical: 12, marginRight: 12 },
    cancelBtnText: { color: '#666' },
    saveBtn: { backgroundColor: '#4A90D9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    saveBtnText: { color: '#fff', fontWeight: 'bold' },

    // Detalle
    detalleSection: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, marginBottom: 16 },
    detalleSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    detalleRow: { flexDirection: 'row', marginBottom: 12 },
    detalleItem: { flex: 1 },
    detalleLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
    detalleValue: { fontSize: 14, color: '#333', fontWeight: '500' },

    // Historial
    historialCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#17a2b8' },
    historialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    tipoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginRight: 8 },
    tipoBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    recienteBadge: { backgroundColor: '#fff3cd', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    recienteBadgeText: { color: '#856404', fontSize: 10 },
    historialFecha: { fontSize: 12, color: '#666', marginLeft: 'auto' },
    historialDescripcion: { fontSize: 14, color: '#333', marginBottom: 8, lineHeight: 20 },
    historialFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    historialTecnico: { fontSize: 12, color: '#666' },
    historialCosto: { fontSize: 12, color: '#28a745', fontWeight: 'bold' },

    // Tipo selector
    tipoSelector: { flexDirection: 'row', marginBottom: 16 },
    tipoOption: { flex: 1, paddingVertical: 12, borderRadius: 8, marginRight: 8, alignItems: 'center', backgroundColor: '#f5f7fa', borderWidth: 1, borderColor: '#ddd' },
    tipoOptionActive: { backgroundColor: '#17a2b8', borderColor: '#17a2b8' },
    tipoOptionText: { color: '#666' },
    tipoOptionTextActive: { color: '#fff', fontWeight: 'bold' },

    // Tipo Equipo Grid
    tipoEquipoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 16 },
    tipoEquipoCard: {
        width: '48%',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e0e0e0'
    },
    tipoEquipoIcono: { fontSize: 40, marginBottom: 8 },
    tipoEquipoNombre: { fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 4 },
    tipoEquipoDescripcion: { fontSize: 11, color: '#666', textAlign: 'center' },

    emptyText: { textAlign: 'center', color: '#999', padding: 40, fontSize: 14 },

    // Photo Upload Styles
    equipoImageCard: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8, resizeMode: 'cover' },

    // Status Modal Styles
    statusModalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 300 },
    statusOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', borderLeftWidth: 4, marginBottom: 8, backgroundColor: '#fafafa', borderRadius: 4 },
    statusOptionText: { fontSize: 16, color: '#333' },

    // Gallery Styles
    photoSection: { marginVertical: 20 },
    photoPreview: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    addPhotoBtn: { width: 80, height: 80, borderRadius: 8, borderStyle: 'dashed', borderWidth: 2, borderColor: '#4A90D9', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f8ff', marginLeft: 12 },
    deletePhotoBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#dc3545', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#fff' },

    formSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', marginTop: 24, marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    formRow: { flexDirection: 'row', marginHorizontal: -8, marginBottom: 16 },
    formGroup: { flex: 1, paddingHorizontal: 8 },
    label: { fontSize: 12, fontWeight: '600', color: '#7f8c8d', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

    segmentControl: { flexDirection: 'row', backgroundColor: '#f0f4f8', padding: 4, borderRadius: 8, marginBottom: 24 },
    segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    segmentBtnText: { fontSize: 13, fontWeight: '600', color: '#7f8c8d' },

    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 24, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 24 },
    btnCancel: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginRight: 12, backgroundColor: '#f8f9fa' },
    btnCancelText: { color: '#636e72', fontWeight: '600' },
    btnSave: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#4A90D9', shadowColor: '#4A90D9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    btnSaveText: { color: '#fff', fontWeight: 'bold' }
});
