import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, RefreshControl, ScrollView, TextInput, Image, ActivityIndicator, Keyboard, Modal, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL as API_BASE_URL } from '../services/productionApi';

// Componente TextInput estable que no pierde el foco al escribir
const StableTextInput = memo(function StableTextInput({ value, onChangeText, style, ...props }) {
    const [localValue, setLocalValue] = useState(value || '');

    useEffect(() => {
        if (value !== localValue) {
            setLocalValue(value || '');
        }
    }, [value]);

    const handleChange = useCallback((text) => {
        setLocalValue(text);
        if (onChangeText) {
            onChangeText(text);
        }
    }, [onChangeText]);

    return (
        <TextInput
            style={style}
            value={localValue}
            onChangeText={handleChange}
            blurOnSubmit={false}
            {...props}
        />
    );
});

// Componentes helper movidos fuera para evitar re-render
const SectionCard = memo(function SectionCard({ title, icon, children }) {
    return (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
});

const FormField = memo(function FormField({ label, required, children }) {
    return (
        <View style={styles.formField}>
            <Text style={styles.fieldLabel}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>
            {children}
        </View>
    );
});

const CumpleButton = memo(function CumpleButton({ value, selected, onPress, color }) {
    return (
        <TouchableOpacity
            style={[styles.cumpleBtn, selected && { backgroundColor: color, borderColor: color }]}
            onPress={() => onPress(value)}
        >
            <Text style={[styles.cumpleBtnText, selected && styles.cumpleBtnTextSelected]}>
                {value ? '✓ CUMPLE' : '✗ NO CUMPLE'}
            </Text>
        </TouchableOpacity>
    );
});

const CumpleNoCumple = memo(function CumpleNoCumple({ value, onChange, label }) {
    return (
        <View style={styles.cumpleContainer}>
            <Text style={styles.cumpleLabel}>{label}</Text>
            <View style={styles.cumpleBtns}>
                <CumpleButton value={true} selected={value === true} onPress={onChange} color="#10B981" />
                <CumpleButton value={false} selected={value === false} onPress={onChange} color="#EF4444" />
            </View>
        </View>
    );
});

export default function CalidadScreen({ navigation }) {
    const [currentScreen, setCurrentScreen] = useState('list');
    const [editingId, setEditingId] = useState(null);
    const [encuestas, setEncuestas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [usuarios, setUsuarios] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [procesos, setProcesos] = useState([]);
    const [tiposNovedad, setTiposNovedad] = useState([]);
    const [estados, setEstados] = useState([]);

    const [operarioId, setOperarioId] = useState(null);
    const [auxiliarId, setAuxiliarId] = useState(null);
    const [ordenProduccion, setOrdenProduccion] = useState('');
    const [cantidadProducir, setCantidadProducir] = useState('');
    const [maquinaId, setMaquinaId] = useState(null);
    const [proceso, setProceso] = useState('');
    const [cantidadEvaluada, setCantidadEvaluada] = useState('');
    const [estadoProceso, setEstadoProceso] = useState('En proceso');
    const [tieneFichaTecnica, setTieneFichaTecnica] = useState(true);
    const [correctoRegistroFormatos, setCorrectoRegistroFormatos] = useState(true);
    const [aprobacionArranque, setAprobacionArranque] = useState(true);
    const [observacion, setObservacion] = useState('');
    const [novedades, setNovedades] = useState([{ tipoNovedad: '', fotoBase64: null, fotoUri: null, descripcion: '', cantidadDefectuosa: '' }]);
    const [saving, setSaving] = useState(false);

    const scrollViewRef = useRef(null);

    // Modal para ver imagen en grande
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const abrirImagenGrande = (uri) => {
        setSelectedImage(uri);
        setImageModalVisible(true);
    };

    const cargarEncuestas = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/calidad/encuestas`);
            setEncuestas(response.data);
        } catch (error) {
            console.error('Error cargando encuestas:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const cargarDatosFormulario = async () => {
        try {
            const [usuariosRes, maquinasRes, procesosRes, novedadesRes, estadosRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/usuarios`),
                axios.get(`${API_BASE_URL}/maquinas`),
                axios.get(`${API_BASE_URL}/calidad/procesos`),
                axios.get(`${API_BASE_URL}/calidad/novedades`),
                axios.get(`${API_BASE_URL}/calidad/estados`),
            ]);
            setUsuarios(usuariosRes.data);
            setMaquinas(maquinasRes.data);
            setProcesos(procesosRes.data);
            setTiposNovedad(novedadesRes.data);
            setEstados(estadosRes.data);
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    };

    useEffect(() => {
        cargarEncuestas();
        cargarDatosFormulario();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        cargarEncuestas();
    }, [cargarEncuestas]);

    const resetForm = () => {
        setEditingId(null);
        setOperarioId(null);
        setAuxiliarId(null);
        setOrdenProduccion('');
        setCantidadProducir('');
        setMaquinaId(null);
        setProceso('');
        setCantidadEvaluada('');
        setEstadoProceso('En proceso');
        setTieneFichaTecnica(true);
        setCorrectoRegistroFormatos(true);
        setAprobacionArranque(true);
        setObservacion('');
        setNovedades([{ tipoNovedad: '', fotoBase64: null, fotoUri: null, descripcion: '', cantidadDefectuosa: '' }]);
    };

    const abrirFormulario = () => {
        resetForm();
        setCurrentScreen('form');
    };

    const editarEncuesta = async (id) => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/calidad/encuestas/${id}`);
            const enc = response.data;

            setEditingId(enc.id);
            setOperarioId(enc.operarioId);
            setAuxiliarId(enc.auxiliarId);
            setOrdenProduccion(enc.ordenProduccion);
            setCantidadProducir(enc.cantidadProducir.toString());
            setMaquinaId(enc.maquinaId);
            setProceso(enc.proceso);
            setCantidadEvaluada(enc.cantidadEvaluada.toString());
            setEstadoProceso(enc.estadoProceso);
            setTieneFichaTecnica(enc.tieneFichaTecnica);
            setCorrectoRegistroFormatos(enc.correctoRegistroFormatos);
            setAprobacionArranque(enc.aprobacionArranque);
            setObservacion(enc.observacion || '');

            if (enc.novedades && enc.novedades.length > 0) {
                setNovedades(enc.novedades.map(n => ({
                    id: n.id,
                    tipoNovedad: n.tipoNovedad,
                    fotoBase64: null,
                    fotoUri: n.fotoUrl, // Ya viene con URL completa del servidor
                    descripcion: n.descripcion || '',
                    cantidadDefectuosa: n.cantidadDefectuosa ? n.cantidadDefectuosa.toString() : '0'
                })));
            } else {
                setNovedades([{ tipoNovedad: '', fotoBase64: null, fotoUri: null, descripcion: '', cantidadDefectuosa: '' }]);
            }

            setCurrentScreen('form');
        } catch (error) {
            console.error('Error cargando encuesta:', error);
            Alert.alert('Error', 'No se pudo cargar la encuesta');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getEstadoColor = (estado) => estado === 'Terminado' ? '#10B981' : '#F59E0B';

    const eliminarEncuesta = (id, ordenProduccion) => {
        Alert.alert(
            '🗑️ Eliminar Encuesta',
            `¿Está seguro que desea eliminar la encuesta OP: ${ordenProduccion}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await axios.delete(`${API_BASE_URL}/calidad/encuestas/${id}`);
                            Alert.alert('✅ Eliminada', 'La encuesta fue eliminada correctamente');
                            cargarEncuestas();
                        } catch (error) {
                            console.error('Error eliminando:', error);
                            Alert.alert('Error', 'No se pudo eliminar la encuesta');
                        }
                    }
                }
            ]
        );
    };

    const agregarNovedad = () => {
        setNovedades([...novedades, { tipoNovedad: '', fotoBase64: null, fotoUri: null, descripcion: '', cantidadDefectuosa: '' }]);
    };

    const actualizarNovedad = (index, field, value) => {
        const nuevasNovedades = [...novedades];
        nuevasNovedades[index][field] = value;
        setNovedades(nuevasNovedades);
    };

    const eliminarNovedad = (index) => {
        if (novedades.length > 1) {
            setNovedades(novedades.filter((_, i) => i !== index));
        }
    };

    const tomarFoto = async (index) => {
        Keyboard.dismiss();
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true, aspect: [4, 3], quality: 0.7, base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                actualizarNovedad(index, 'fotoBase64', result.assets[0].base64);
                actualizarNovedad(index, 'fotoUri', result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error tomando foto:', error);
        }
    };

    const seleccionarFoto = async (index) => {
        Keyboard.dismiss();
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita acceso a la galería');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true, aspect: [4, 3], quality: 0.7, base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                actualizarNovedad(index, 'fotoBase64', result.assets[0].base64);
                actualizarNovedad(index, 'fotoUri', result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error seleccionando foto:', error);
        }
    };

    const confirmarBorrarFoto = (index) => {
        const novedad = novedades[index];
        Alert.alert(
            '🗑️ Eliminar Imagen',
            '¿Está seguro que desea eliminar esta imagen?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        // Si la novedad tiene ID y tiene una foto del servidor, eliminar del servidor
                        if (novedad.id && novedad.fotoUri && novedad.fotoUri.startsWith('http')) {
                            try {
                                await axios.delete(`${API_BASE_URL}/calidad/novedades/${novedad.id}/foto`);
                                console.log('Foto eliminada del servidor');
                            } catch (error) {
                                console.error('Error eliminando foto del servidor:', error);
                                // Continuar aunque falle - la foto se quitará del formulario
                            }
                        }
                        // Limpiar del estado local
                        actualizarNovedad(index, 'fotoBase64', null);
                        actualizarNovedad(index, 'fotoUri', null);
                    }
                }
            ]
        );
    };

    const validarFormulario = () => {
        if (!operarioId) return 'Seleccione un operario';
        if (!ordenProduccion.trim()) return 'Ingrese el número de orden';
        if (!cantidadProducir || isNaN(parseFloat(cantidadProducir))) return 'Ingrese cantidad a producir';
        if (!maquinaId) return 'Seleccione una máquina';
        if (!proceso) return 'Seleccione un proceso';
        if (!cantidadEvaluada || isNaN(parseFloat(cantidadEvaluada))) return 'Ingrese cantidad evaluada';

        return null;
    };

    const guardarEncuesta = async () => {
        Keyboard.dismiss();
        const error = validarFormulario();
        if (error) {
            Alert.alert('Validación', error);
            return;
        }
        setSaving(true);
        try {
            const novedadesValidas = novedades.filter(n => n.tipoNovedad).map(n => ({
                tipoNovedad: n.tipoNovedad,
                fotoBase64: n.fotoBase64,
                descripcion: n.descripcion,
                cantidadDefectuosa: parseInt(n.cantidadDefectuosa) || 0
            }));
            const data = {
                operarioId, auxiliarId: auxiliarId || null, ordenProduccion,
                cantidadProducir: parseFloat(cantidadProducir), maquinaId, proceso,
                cantidadEvaluada: parseFloat(cantidadEvaluada), estadoProceso,
                tieneFichaTecnica, correctoRegistroFormatos, aprobacionArranque,
                observacion: observacion || null, novedades: novedadesValidas
            };

            if (editingId) {
                await axios.delete(`${API_BASE_URL}/calidad/encuestas/${editingId}`);
            }

            await axios.post(`${API_BASE_URL}/calidad/encuestas`, data);
            Alert.alert('✅ Éxito', editingId ? 'Encuesta actualizada' : 'Encuesta guardada');
            setCurrentScreen('list');
            cargarEncuestas();
        } catch (error) {
            console.error('Error guardando encuesta:', error);
            Alert.alert('Error', 'No se pudo guardar la encuesta');
        } finally {
            setSaving(false);
        }
    };

    const renderEncuesta = ({ item }) => (
        <View style={styles.historyCard}>
            <TouchableOpacity onPress={() => editarEncuesta(item.id)}>
                <View style={styles.historyHeader}>
                    <View style={styles.historyOP}>
                        <Text style={styles.historyOPLabel}>OP</Text>
                        <Text style={styles.historyOPValue}>{item.ordenProduccion}</Text>
                    </View>
                    <View style={[styles.estadoPill, { backgroundColor: getEstadoColor(item.estadoProceso) }]}>
                        <Text style={styles.estadoPillText}>{item.estadoProceso}</Text>
                    </View>
                </View>
                <View style={styles.historyBody}>
                    <View style={styles.historyRow}>
                        <Text style={styles.historyIcon}>👷</Text>
                        <Text style={styles.historyText}>{item.operario}</Text>
                    </View>
                    <View style={styles.historyRow}>
                        <Text style={styles.historyIcon}>🏭</Text>
                        <Text style={styles.historyText}>{item.maquina}</Text>
                    </View>
                    <View style={styles.historyRow}>
                        <Text style={styles.historyIcon}>⚙️</Text>
                        <Text style={styles.historyText}>{item.proceso}</Text>
                    </View>
                </View>
                <View style={styles.historyFooter}>
                    <Text style={styles.historyDate}>📅 {formatDate(item.fechaCreacion)}</Text>
                    <View style={styles.historyBadges}>
                        {item.totalNovedades > 0 && (
                            <View style={styles.badge}><Text style={styles.badgeText}>⚠️ {item.totalNovedades}</Text></View>
                        )}
                        {item.tieneFotos && (
                            <View style={[styles.badge, { backgroundColor: '#3B82F6' }]}><Text style={styles.badgeText}>📷</Text></View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
            <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => editarEncuesta(item.id)}>
                    <Text style={styles.editBtnText}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => eliminarEncuesta(item.id, item.ordenProduccion)}>
                    <Text style={styles.deleteBtnText}>🗑️ Eliminar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // LIST VIEW
    if (currentScreen === 'list') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
                        <Text style={styles.headerBackText}>← Volver</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>🔍 Control de Calidad</Text>
                </View>

                <TouchableOpacity style={styles.newBtn} onPress={abrirFormulario}>
                    <Text style={styles.newBtnIcon}>+</Text>
                    <Text style={styles.newBtnText}>Nueva Toma de Calidad</Text>
                </TouchableOpacity>

                <Text style={styles.listTitle}>📋 Historial de Encuestas</Text>

                {encuestas.length === 0 && !loading ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📝</Text>
                        <Text style={styles.emptyText}>No hay encuestas registradas</Text>
                        <Text style={styles.emptySubtext}>Presiona el botón verde para crear una</Text>
                    </View>
                ) : (
                    <FlatList
                        data={encuestas}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderEncuesta}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>
        );
    }

    // FORM VIEW
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setCurrentScreen('list')} style={styles.headerBackBtn}>
                    <Text style={styles.headerBackText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {editingId ? '✏️ Editar Encuesta' : '📝 Nueva Toma de Calidad'}
                </Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                automaticallyAdjustContentInsets={false}
                automaticallyAdjustsScrollIndicatorInsets={false}
            >
                <View style={styles.formContainer}>
                    {/* Información del Operario */}
                    <SectionCard title="Información del Personal" icon="👥">
                        <FormField label="Operario" required>
                            <View style={styles.pickerWrapper}>
                                <Picker mode="dropdown"
                                    selectedValue={operarioId}
                                    onValueChange={setOperarioId}
                                    style={styles.picker}
                                    dropdownIconColor="#1E40AF"
                                >
                                    <Picker.Item label="-- Seleccionar --" value={null} color="#444444" />
                                    {usuarios.map(u => <Picker.Item key={u.id} label={u.nombre} value={u.id} color="#000000" />)}
                                </Picker>
                            </View>
                        </FormField>
                        <FormField label="Auxiliar">
                            <View style={styles.pickerWrapper}>
                                <Picker mode="dropdown"
                                    selectedValue={auxiliarId}
                                    onValueChange={setAuxiliarId}
                                    style={styles.picker}
                                    dropdownIconColor="#1E40AF"
                                >
                                    <Picker.Item label="-- Ninguno --" value={null} color="#444444" />
                                    {usuarios.map(u => <Picker.Item key={u.id} label={u.nombre} value={u.id} color="#000000" />)}
                                </Picker>
                            </View>
                        </FormField>
                    </SectionCard>

                    {/* Información de Producción */}
                    <SectionCard title="Información de Producción" icon="🏭">
                        <FormField label="Número de Orden de Producción" required>
                            <StableTextInput
                                style={styles.input}
                                value={ordenProduccion}
                                onChangeText={setOrdenProduccion}
                                placeholder="Ej: OP-12345"
                                placeholderTextColor="#9CA3AF"
                                returnKeyType="next"
                            />
                        </FormField>
                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <FormField label="Cantidad a Producir" required>
                                    <StableTextInput
                                        style={styles.input}
                                        value={cantidadProducir}
                                        onChangeText={setCantidadProducir}
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor="#9CA3AF"
                                        returnKeyType="next"
                                    />
                                </FormField>
                            </View>
                            <View style={styles.halfField}>
                                <FormField label="Cantidad Evaluada" required>
                                    <StableTextInput
                                        style={styles.input}
                                        value={cantidadEvaluada}
                                        onChangeText={setCantidadEvaluada}
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor="#9CA3AF"
                                        returnKeyType="next"
                                    />
                                </FormField>
                            </View>
                        </View>
                        <FormField label="Máquina" required>
                            <View style={styles.pickerWrapper}>
                                <Picker mode="dropdown"
                                    selectedValue={maquinaId}
                                    onValueChange={setMaquinaId}
                                    style={styles.picker}
                                    dropdownIconColor="#1E40AF"
                                >
                                    <Picker.Item label="-- Seleccionar --" value={null} color="#444444" />
                                    {maquinas.map(m => <Picker.Item key={m.id} label={m.nombre} value={m.id} color="#000000" />)}
                                </Picker>
                            </View>
                        </FormField>
                        <FormField label="Proceso" required>
                            <View style={styles.pickerWrapper}>
                                <Picker mode="dropdown"
                                    selectedValue={proceso}
                                    onValueChange={setProceso}
                                    style={styles.picker}
                                    dropdownIconColor="#1E40AF"
                                >
                                    <Picker.Item label="-- Seleccionar --" value="" color="#444444" />
                                    {procesos.map(p => <Picker.Item key={p} label={p} value={p} color="#000000" />)}
                                </Picker>
                            </View>
                        </FormField>
                        <FormField label="Estado del Proceso" required>
                            <View style={styles.pickerWrapper}>
                                <Picker mode="dropdown"
                                    selectedValue={estadoProceso}
                                    onValueChange={setEstadoProceso}
                                    style={styles.picker}
                                    dropdownIconColor="#1E40AF"
                                >
                                    {estados.map(e => <Picker.Item key={e} label={e} value={e} color="#000000" />)}
                                </Picker>
                            </View>
                        </FormField>
                    </SectionCard>

                    {/* Verificación de Cumplimiento */}
                    <SectionCard title="Verificación de Cumplimiento" icon="✅">
                        <CumpleNoCumple label="¿Tiene Ficha Técnica soporte del proceso?" value={tieneFichaTecnica} onChange={setTieneFichaTecnica} />
                        <CumpleNoCumple label="¿El personal realiza el correcto registro en los formatos?" value={correctoRegistroFormatos} onChange={setCorrectoRegistroFormatos} />
                        <CumpleNoCumple label="¿Tiene Aprobación del Arranque?" value={aprobacionArranque} onChange={setAprobacionArranque} />
                    </SectionCard>

                    {/* Novedades */}
                    <SectionCard title="Novedades Presentadas" icon="⚠️">
                        {novedades.map((novedad, index) => (
                            <View key={index} style={styles.novedadItem}>
                                <View style={styles.novedadHeader}>
                                    <Text style={styles.novedadNum}>#{index + 1}</Text>
                                    {novedades.length > 1 && (
                                        <TouchableOpacity onPress={() => eliminarNovedad(index)} style={styles.deleteNovedadBtn}>
                                            <Text style={styles.deleteNovedadText}>🗑️</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={styles.pickerWrapper}>
                                    <Picker mode="dropdown"
                                        selectedValue={novedad.tipoNovedad}
                                        onValueChange={(v) => actualizarNovedad(index, 'tipoNovedad', v)}
                                        style={styles.picker}
                                        dropdownIconColor="#92400E"
                                    >
                                        <Picker.Item label="-- Seleccionar novedad --" value="" color="#444444" />
                                        {tiposNovedad.map(t => <Picker.Item key={t} label={t} value={t} color="#000000" />)}
                                    </Picker>
                                </View>

                                {novedad.tipoNovedad && (
                                    <>
                                        {/* Campo cantidad defectuosa */}
                                        <View style={styles.cantidadDefectuosaContainer}>
                                            <Text style={styles.cantidadDefectuosaLabel}>📦 Cantidad con defecto:</Text>
                                            <StableTextInput
                                                style={styles.cantidadDefectuosaInput}
                                                value={novedad.cantidadDefectuosa}
                                                onChangeText={(v) => actualizarNovedad(index, 'cantidadDefectuosa', v)}
                                                keyboardType="number-pad"
                                                placeholder="0"
                                                placeholderTextColor="#9CA3AF"
                                                returnKeyType="done"
                                            />
                                        </View>

                                        <View style={styles.fotoActions}>
                                            <Text style={styles.fotoLabel}>📷 Adjuntar evidencia:</Text>
                                            <View style={styles.fotoBtns}>
                                                <TouchableOpacity style={styles.fotoActionBtn} onPress={() => tomarFoto(index)}>
                                                    <Text style={styles.fotoActionText}>📸 Cámara</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.fotoActionBtn} onPress={() => seleccionarFoto(index)}>
                                                    <Text style={styles.fotoActionText}>🖼️ Galería</Text>
                                                </TouchableOpacity>
                                            </View>
                                            {novedad.fotoUri && (
                                                <View style={styles.fotoPreviewContainer}>
                                                    <TouchableOpacity onPress={() => abrirImagenGrande(novedad.fotoUri)}>
                                                        <Image source={{ uri: novedad.fotoUri }} style={styles.fotoPreview} />
                                                        <View style={styles.tapToZoomHint}>
                                                            <Text style={styles.tapToZoomText}>🔍 Toca para ampliar</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.removeFoto} onPress={() => confirmarBorrarFoto(index)}>
                                                        <Text style={styles.removeFotoText}>✕</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </>
                                )}
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addNovedadBtn} onPress={agregarNovedad}>
                            <Text style={styles.addNovedadText}>+ Agregar otra novedad</Text>
                        </TouchableOpacity>
                    </SectionCard>

                    {/* Observaciones */}
                    <SectionCard title="Observaciones" icon="📝">
                        <StableTextInput
                            style={[styles.input, styles.textArea]}
                            value={observacion}
                            onChangeText={setObservacion}
                            placeholder="Escriba sus observaciones aquí..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </SectionCard>

                    {/* Botón Guardar */}
                    <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={guardarEncuesta} disabled={saving}>
                        {saving ? <ActivityIndicator color="white" size="small" /> : (
                            <>
                                <Text style={styles.saveBtnIcon}>✓</Text>
                                <Text style={styles.saveBtnText}>
                                    {editingId ? 'Actualizar Encuesta' : 'Enviar Encuesta'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Modal para ver imagen en grande */}
            <Modal
                visible={imageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setImageModalVisible(false)}
            >
                <View style={styles.imageModalContainer}>
                    <TouchableOpacity
                        style={styles.imageModalCloseBtn}
                        onPress={() => setImageModalVisible(false)}
                    >
                        <Text style={styles.imageModalCloseText}>✕ Cerrar</Text>
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.imageModalImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    scrollView: { flex: 1 },

    header: { backgroundColor: '#1E40AF', paddingTop: 40, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    headerBackBtn: { marginRight: 15, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    headerBackText: { color: 'white', fontSize: 14, fontWeight: '600' },
    headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1 },

    newBtn: { backgroundColor: '#10B981', margin: 16, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    newBtnIcon: { color: 'white', fontSize: 24, fontWeight: 'bold', marginRight: 8 },
    newBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

    // Card action buttons
    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    editBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#EEF2FF', borderBottomLeftRadius: 16 },
    editBtnText: { color: '#4F46E5', fontSize: 14, fontWeight: '600' },
    deleteBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FEF2F2', borderBottomRightRadius: 16 },
    deleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },

    listTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 12, color: '#1F2937' },
    listContent: { paddingHorizontal: 16, paddingBottom: 20 },

    historyCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
    historyHeader: { backgroundColor: '#1E40AF', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyOP: { flexDirection: 'row', alignItems: 'center' },
    historyOPLabel: { backgroundColor: 'rgba(255,255,255,0.3)', color: 'white', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    historyOPValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    estadoPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    estadoPillText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    historyBody: { padding: 14 },
    historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    historyIcon: { fontSize: 16, marginRight: 10, width: 24 },
    historyText: { fontSize: 14, color: '#4B5563', flex: 1 },
    historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    historyDate: { fontSize: 12, color: '#6B7280' },
    historyBadges: { flexDirection: 'row' },
    badge: { backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 6 },
    badgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
    editHint: { backgroundColor: '#EEF2FF', paddingVertical: 6, alignItems: 'center' },
    editHintText: { color: '#4F46E5', fontSize: 12, fontWeight: '500' },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyText: { fontSize: 18, color: '#4B5563', fontWeight: '600', marginBottom: 6 },
    emptySubtext: { fontSize: 14, color: '#9CA3AF' },

    formContainer: { padding: 16 },
    sectionCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#E5E7EB' },
    sectionIcon: { fontSize: 24, marginRight: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
    formField: { marginBottom: 16 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    required: { color: '#EF4444' },
    pickerWrapper: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', overflow: 'hidden' },
    picker: { height: 50, color: '#1F2937' },
    input: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', padding: 14, fontSize: 16, color: '#1F2937' },
    textArea: { height: 100, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },

    cumpleContainer: { marginBottom: 16, backgroundColor: '#F9FAFB', padding: 14, borderRadius: 12 },
    cumpleLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },
    cumpleBtns: { flexDirection: 'row', gap: 10 },
    cumpleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: 'white' },
    cumpleBtnText: { fontSize: 13, fontWeight: 'bold', color: '#4B5563' },
    cumpleBtnTextSelected: { color: 'white' },

    novedadItem: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FCD34D' },
    novedadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    novedadNum: { backgroundColor: '#F59E0B', color: 'white', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    deleteNovedadBtn: { padding: 4 },
    deleteNovedadText: { fontSize: 18 },

    cantidadDefectuosaContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'white', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' },
    cantidadDefectuosaLabel: { fontSize: 13, color: '#92400E', fontWeight: '600', flex: 1 },
    cantidadDefectuosaInput: { width: 80, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D', padding: 8, fontSize: 16, textAlign: 'center', color: '#1F2937' },

    fotoActions: { marginTop: 12 },
    fotoLabel: { fontSize: 13, color: '#92400E', marginBottom: 8, fontWeight: '600' },
    fotoBtns: { flexDirection: 'row', gap: 10 },
    fotoActionBtn: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' },
    fotoActionText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
    fotoPreviewContainer: { marginTop: 12, position: 'relative' },
    fotoPreview: { width: '100%', height: 150, borderRadius: 10, backgroundColor: '#E5E7EB' },
    removeFoto: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    removeFotoText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    addNovedadBtn: { borderWidth: 2, borderColor: '#F59E0B', borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center' },
    addNovedadText: { color: '#92400E', fontSize: 15, fontWeight: 'bold' },

    saveBtn: { backgroundColor: '#10B981', padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    saveBtnDisabled: { backgroundColor: '#9CA3AF' },
    saveBtnIcon: { color: 'white', fontSize: 20, marginRight: 8 },
    saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

    // Modal de imagen
    imageModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    imageModalCloseBtn: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, zIndex: 10 },
    imageModalCloseText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    imageModalImage: { width: Dimensions.get('window').width - 20, height: Dimensions.get('window').height - 150 },

    // Hint para ampliar
    tapToZoomHint: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, alignItems: 'center', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    tapToZoomText: { color: 'white', fontSize: 12, fontWeight: '600' },
});
