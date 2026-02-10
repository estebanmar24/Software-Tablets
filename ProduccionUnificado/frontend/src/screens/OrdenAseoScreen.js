/**
 * Orden y Aseo Survey Screen
 * Simple surveys for cleanliness and organization audits
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Modal, Alert, ActivityIndicator, Platform, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { removeToken } from '../services/authStorage';
import {
    getProcesos, getPlantas, getEncuestas, getEncuesta,
    crearEncuesta, eliminarEncuesta, getFotoUrl
} from '../services/ordenAseoApi';

const PREGUNTAS = [
    { key: 'ImplementosAseo', label: '¿Los implementos de aseo se encuentran en su respectivo soporte y bien ubicados?' },
    { key: 'HerramientasLugar', label: '¿Las herramientas en el lugar de trabajo están acomodadas, limpias y se encuentran en su sitio?' },
    { key: 'TarrosRotulados', label: '¿Existen tarros debidamente rotulados y bien etiquetados?' },
    { key: 'AreaDespejada', label: '¿El área de trabajo se encuentra despejada con los materiales debidamente identificados y en su lugar?' },
    { key: 'RutasEvacuacion', label: '¿Las rutas de evacuación están despejadas?' },
    { key: 'MesasTrabajo', label: '¿Las mesas de trabajo están limpias, sin elementos no permitidos?' }
];

export default function OrdenAseoScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [encuestas, setEncuestas] = useState([]);
    const [procesos, setProcesos] = useState([]);
    const [plantas, setPlantas] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null); // Fix: Define editingId state

    // Form state
    const [formData, setFormData] = useState({
        procesoAuditado: '',
        nombreAuditado: '',
        planta: '',
        implementosAseo: false,
        fotoImplementosAseoBase64: [],
        herramientasLugar: false,
        fotoHerramientasLugarBase64: [],
        tarrosRotulados: false,
        fotoTarrosRotuladosBase64: [],
        areaDespejada: false,
        fotoAreaDespejadaBase64: [],
        rutasEvacuacion: false,
        fotoRutasEvacuacionBase64: [],
        mesasTrabajo: false,
        fotoMesasTrabajoBase64: [],
        observaciones: ''
    });

    const [showProcesoDropdown, setShowProcesoDropdown] = useState(false);
    const [showPlantaDropdown, setShowPlantaDropdown] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [enc, proc, plan] = await Promise.all([
                getEncuestas(),
                getProcesos(),
                getPlantas()
            ]);
            setEncuestas(enc);
            setProcesos(proc);
            setPlantas(plan);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const resetForm = () => {
        setFormData({
            procesoAuditado: '',
            nombreAuditado: '',
            planta: '',
            implementosAseo: false,
            implementosAseo: false,
            fotoImplementosAseoBase64: [],
            herramientasLugar: false,
            fotoHerramientasLugarBase64: [],
            tarrosRotulados: false,
            fotoTarrosRotuladosBase64: [],
            areaDespejada: false,
            fotoAreaDespejadaBase64: [],
            rutasEvacuacion: false,
            fotoRutasEvacuacionBase64: [],
            mesasTrabajo: false,
            fotoMesasTrabajoBase64: [],
            observaciones: ''
        });
    };

    const handleNuevaEncuesta = () => {
        resetForm();
        setEditingId(null);
        setShowModal(true);
    };

    const handleGuardar = async () => {
        if (!formData.procesoAuditado) {
            Alert.alert('Error', 'Seleccione un proceso');
            return;
        }
        if (!formData.nombreAuditado.trim()) {
            Alert.alert('Error', 'Ingrese el nombre del auditado');
            return;
        }
        if (!formData.planta) {
            Alert.alert('Error', 'Seleccione una planta');
            return;
        }

        try {
            setSaving(true);
            await crearEncuesta(formData);
            Alert.alert('Éxito', 'Encuesta guardada correctamente');
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving:', error);
            Alert.alert('Error', 'No se pudo guardar la encuesta');
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar esta encuesta?')) {
                try {
                    await eliminarEncuesta(id);
                    loadData();
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar');
                }
            }
        } else {
            Alert.alert('Confirmar', '¿Eliminar esta encuesta?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive', onPress: async () => {
                        try {
                            await eliminarEncuesta(id);
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]);
        }
    };

    const tomarFoto = async (preguntaKey) => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Error', 'Se necesitan permisos de cámara');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                base64: true,
                quality: 0.5
            });

            if (!result.canceled && result.assets[0].base64) {
                const fotoKey = `foto${preguntaKey}Base64`;
                const newPhoto = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setFormData(prev => ({
                    ...prev,
                    [fotoKey]: [...(prev[fotoKey] || []), newPhoto]
                }));
            }
        } catch (error) {
            console.error('Error taking photo:', error);
        }
    };

    const seleccionarFoto = async (preguntaKey) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                base64: true,
                quality: 0.5
            });

            if (!result.canceled && result.assets[0].base64) {
                const fotoKey = `foto${preguntaKey}Base64`;
                const newPhoto = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setFormData(prev => ({
                    ...prev,
                    [fotoKey]: [...(prev[fotoKey] || []), newPhoto]
                }));
            }
        } catch (error) {
            console.error('Error selecting photo:', error);
        }
    };

    const eliminarFoto = (preguntaKey, index) => {
        const fotoKey = `foto${preguntaKey}Base64`;
        setFormData(prev => {
            const newPhotos = [...(prev[fotoKey] || [])];
            newPhotos.splice(index, 1);
            return { ...prev, [fotoKey]: newPhotos };
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Fecha inválida';
        try {
            const date = new Date(dateString);
            // Check for invalid date
            if (isNaN(date.getTime())) return dateString || '-';

            return date.toLocaleDateString('es-CO', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (error) {
            console.log('Error formating date:', error);
            return String(dateString);
        }
    };

    const CumpleButton = ({ selected, value, onPress }) => (
        <TouchableOpacity
            style={[
                styles.cumpleBtn,
                value && styles.cumpleBtnActive,
                !value && !selected && styles.cumpleBtnNeutral,
                !value && selected && styles.noCumpleBtnActive
            ]}
            onPress={onPress}
        >
            <Text style={[
                styles.cumpleBtnText,
                (selected && (value || !value)) && styles.cumpleBtnTextActive
            ]}>
                {value ? '✓ CUMPLE' : '✗ NO CUMPLE'}
            </Text>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <ActivityIndicator size="large" color="#4A90A4" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header Redesigned to match CalidadScreen */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
                    <Text style={styles.headerBackText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Orden y Aseo</Text>
                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => {
                        Alert.alert("Sesión", "¿Desea cerrar sesión?", [
                            { text: "Cancelar", style: "cancel" },
                            {
                                text: "Salir", onPress: async () => {
                                    await removeToken();
                                    // Use goBack() because App.tsx handles the state reset logic in the callback
                                    navigation.goBack();
                                }
                            }
                        ]);
                    }}
                >
                    <Text style={styles.logoutBtnText}>Salir</Text>
                </TouchableOpacity>
            </View>

            {/* New Survey Button - Prominent like CalidadScreen */}
            <TouchableOpacity style={styles.newBtn} onPress={handleNuevaEncuesta}>
                <Text style={styles.newBtnIcon}>+</Text>
                <Text style={styles.newBtnText}>Nueva Encuesta</Text>
            </TouchableOpacity>

            <View style={styles.statsBar}>
                <Text style={styles.statsText}>{encuestas.length} encuestas registradas</Text>
            </View>

            {/* Survey List */}
            <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 20 }}>
                {encuestas.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📝</Text>
                        <Text style={styles.emptyText}>No hay encuestas</Text>
                        <Text style={styles.emptySubtext}>Presiona el botón verde para crear una</Text>
                    </View>
                ) : (
                    encuestas.map(enc => (
                        <View key={enc.id} style={styles.encuestaCard}>
                            <View style={styles.encuestaHeader}>
                                <View style={styles.encuestaInfo}>
                                    <View style={styles.row}>
                                        <Text style={styles.encuestaProceso}>{enc.procesoAuditado}</Text>
                                        <View style={[
                                            styles.cumpleBadge,
                                            enc.totalCumple === 6 && styles.cumpleBadgeFull,
                                            enc.totalCumple < 4 && styles.cumpleBadgeLow
                                        ]}>
                                            <Text style={styles.cumpleBadgeText}>{enc.totalCumple}/6</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.encuestaAuditado}>👤 {enc.nombreAuditado}</Text>
                                    <Text style={styles.encuestaPlanta}>🏭 {enc.planta}</Text>
                                    <Text style={styles.encuestaFecha}>📅 {formatDate(enc.fechaCreacion)}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleEliminar(enc.id)}
                                >
                                    <Text style={styles.deleteBtnText}>🗑️</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Modal for New Survey */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView nestedScrollEnabled={true}>
                            <Text style={styles.modalTitle}>
                                {editingId ? 'Editar Encuesta' : 'Nueva Encuesta de Orden y Aseo'}
                            </Text>

                            {/* Proceso Dropdown */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Proceso Auditado *</Text>
                                <TouchableOpacity
                                    style={styles.dropdown}
                                    onPress={() => setShowProcesoDropdown(!showProcesoDropdown)}
                                >
                                    <Text style={formData.procesoAuditado ? styles.dropdownText : styles.dropdownPlaceholder}>
                                        {formData.procesoAuditado || 'Seleccionar proceso...'}
                                    </Text>
                                    <Text>▼</Text>
                                </TouchableOpacity>
                                {showProcesoDropdown && (
                                    <View style={styles.dropdownList}>
                                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                                            {procesos.map((p, i) => (
                                                <TouchableOpacity
                                                    key={i}
                                                    style={styles.dropdownItem}
                                                    onPress={() => {
                                                        setFormData(prev => ({ ...prev, procesoAuditado: p }));
                                                        setShowProcesoDropdown(false);
                                                    }}
                                                >
                                                    <Text style={styles.dropdownItemText}>{p}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Nombre Auditado */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Nombre del Auditado *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={formData.nombreAuditado}
                                    onChangeText={text => setFormData(prev => ({ ...prev, nombreAuditado: text }))}
                                    placeholder="Ingrese el nombre..."
                                    placeholderTextColor="#999" // Add explicit placeholder color
                                />
                            </View>

                            {/* Preguntas CUMPLE/NO CUMPLE */}
                            {PREGUNTAS.map((pregunta, index) => {
                                const preguntaKeyLower = pregunta.key.charAt(0).toLowerCase() + pregunta.key.slice(1);
                                const fotoKey = `foto${pregunta.key}Base64`;
                                const hasFoto = formData[fotoKey];
                                const cumple = formData[preguntaKeyLower];

                                return (
                                    <View key={pregunta.key} style={styles.preguntaCard}>
                                        <Text style={styles.preguntaNumero}>{index + 1}</Text>
                                        <Text style={styles.preguntaLabel}>{pregunta.label}</Text>

                                        <View style={styles.cumpleContainer}>
                                            <TouchableOpacity
                                                style={[styles.cumpleOption, cumple && styles.cumpleOptionActive]}
                                                onPress={() => setFormData(prev => ({ ...prev, [preguntaKeyLower]: true }))}
                                            >
                                                <Text style={[styles.cumpleOptionText, cumple && styles.cumpleOptionTextActive]}>
                                                    ✓ CUMPLE
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.noCumpleOption, !cumple && styles.noCumpleOptionActive]}
                                                onPress={() => setFormData(prev => ({ ...prev, [preguntaKeyLower]: false }))}
                                            >
                                                <Text style={[styles.noCumpleOptionText, !cumple && styles.noCumpleOptionTextActive]}>
                                                    ✗ NO CUMPLE
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Photo Section */}
                                        <View style={styles.fotoSection}>
                                            <View style={styles.fotoActions}>
                                                <TouchableOpacity
                                                    style={styles.fotoBtn}
                                                    onPress={() => tomarFoto(pregunta.key)}
                                                >
                                                    <Text style={styles.fotoBtnText}>📷 Foto</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.fotoBtn}
                                                    onPress={() => seleccionarFoto(pregunta.key)}
                                                >
                                                    <Text style={styles.fotoBtnText}>🖼️ Galería</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {(formData[fotoKey] && formData[fotoKey].length > 0) && (
                                                <ScrollView horizontal style={styles.fotoGallery}>
                                                    {formData[fotoKey].map((foto, idx) => (
                                                        <View key={idx} style={styles.fotoPreviewContainer}>
                                                            <Image source={{ uri: foto }} style={styles.fotoPreview} />
                                                            <TouchableOpacity
                                                                style={styles.fotoDeleteBtn}
                                                                onPress={() => eliminarFoto(pregunta.key, idx)}
                                                            >
                                                                <Text style={styles.fotoDeleteText}>✕</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}

                            {/* Planta Dropdown */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Planta *</Text>
                                <TouchableOpacity
                                    style={styles.dropdown}
                                    onPress={() => setShowPlantaDropdown(!showPlantaDropdown)}
                                >
                                    <Text style={formData.planta ? styles.dropdownText : styles.dropdownPlaceholder}>
                                        {formData.planta || 'Seleccionar planta...'}
                                    </Text>
                                    <Text>▼</Text>
                                </TouchableOpacity>
                                {showPlantaDropdown && (
                                    <View style={styles.dropdownList}>
                                        {plantas.map((p, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setFormData(prev => ({ ...prev, planta: p }));
                                                    setShowPlantaDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.dropdownItemText}>{p}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Observaciones */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Observaciones</Text>
                                <TextInput
                                    style={[styles.textInput, { height: 80 }]}
                                    value={formData.observaciones}
                                    onChangeText={text => setFormData(prev => ({ ...prev, observaciones: text }))}
                                    placeholder="Observaciones adicionales..."
                                    multiline
                                />
                            </View>

                            {/* Buttons */}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => setShowModal(false)}
                                >
                                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                                    onPress={handleGuardar}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>💾 Guardar</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f8'
    },
    // Updated Header Styles
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 15,
        paddingHorizontal: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 10
    },
    headerBackBtn: {
        padding: 8,
    },
    headerBackText: {
        fontSize: 24,
        color: '#666',
        fontWeight: 'bold'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a2e',
        flex: 1,
        textAlign: 'center'
    },
    logoutBtn: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6
    },
    logoutBtnText: {
        color: '#ef4444',
        fontWeight: 'bold',
        fontSize: 14
    },
    // New Survey Button Styles
    newBtn: {
        backgroundColor: '#4CAF50',
        margin: 20,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    newBtnIcon: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginRight: 8
    },
    newBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    statsBar: {
        paddingHorizontal: 20,
        marginBottom: 10
    },
    statsText: {
        color: '#666',
        fontSize: 14
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 20
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 10
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666'
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        marginTop: 4
    },
    encuestaCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },
    encuestaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    encuestaInfo: {
        flex: 1
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    encuestaProceso: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a2e',
        flex: 1
    },
    encuestaAuditado: {
        fontSize: 14,
        color: '#444',
        marginBottom: 2
    },
    encuestaPlanta: {
        fontSize: 13,
        color: '#666',
        marginBottom: 2
    },
    encuestaFecha: {
        fontSize: 12,
        color: '#999',
        marginTop: 4
    },
    // Badges
    cumpleBadge: {
        backgroundColor: '#FFC107',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8
    },
    cumpleBadgeFull: {
        backgroundColor: '#4CAF50'
    },
    cumpleBadgeLow: {
        backgroundColor: '#f44336'
    },
    cumpleBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12
    },
    deleteBtn: {
        padding: 8,
        justifyContent: 'center'
    },
    deleteBtnText: {
        fontSize: 20
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 600,
        maxHeight: '90%'
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 20,
        textAlign: 'center'
    },
    formGroup: {
        marginBottom: 16
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
        color: '#333' // Enforce text color
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f9f9f9'
    },
    dropdownText: {
        fontSize: 16,
        color: '#333'
    },
    dropdownPlaceholder: {
        fontSize: 16,
        color: '#999'
    },
    dropdownList: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginTop: 4,
        backgroundColor: '#fff',
        maxHeight: 200
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    // Added explicit style for dropdown items
    dropdownItemText: {
        fontSize: 16,
        color: '#333'
    },
    preguntaCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16
    },
    // ... existing styles ...
    preguntaNumero: {
        position: 'absolute',
        top: -10,
        left: 10,
        backgroundColor: '#4A90A4',
        color: '#fff',
        width: 28,
        height: 28,
        borderRadius: 14,
        textAlign: 'center',
        lineHeight: 28,
        fontWeight: 'bold',
        fontSize: 14,
        overflow: 'hidden'
    },
    preguntaLabel: {
        fontSize: 14,
        color: '#333',
        marginTop: 8,
        marginBottom: 12,
        lineHeight: 20
    },
    cardActions: {
        flexDirection: 'row',
        gap: 16
    },
    editBtn: {
        // Optional styling if needed, default transparent is fine
    },
    cumpleContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12
    },
    cumpleOption: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#4CAF50',
        alignItems: 'center'
    },
    cumpleOptionActive: {
        backgroundColor: '#4CAF50'
    },
    cumpleOptionText: {
        color: '#4CAF50',
        fontWeight: 'bold'
    },
    cumpleOptionTextActive: {
        color: '#fff'
    },
    noCumpleOption: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#f44336',
        alignItems: 'center'
    },
    noCumpleOptionActive: {
        backgroundColor: '#f44336'
    },
    noCumpleOptionText: {
        color: '#f44336',
        fontWeight: 'bold'
    },
    noCumpleOptionTextActive: {
        color: '#fff'
    },
    fotoSection: {
        marginTop: 8
    },
    fotoActions: {
        flexDirection: 'row',
        gap: 12
    },
    fotoBtn: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6
    },
    fotoBtnText: {
        fontSize: 14,
        color: '#333'
    },
    fotoGallery: {
        marginTop: 12,
        flexDirection: 'row'
    },
    fotoPreviewContainer: {
        position: 'relative',
        width: 100,
        height: 100,
        marginRight: 12,
        marginBottom: 4
    },
    fotoPreview: {
        width: 100,
        height: 100,
        borderRadius: 8
    },
    fotoDeleteBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#f44336',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    fotoDeleteText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 24
    },
    cancelBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#ddd',
        alignItems: 'center'
    },
    cancelBtnText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 16
    },
    saveBtn: {
        flex: 1,
        backgroundColor: '#4CAF50',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center'
    },
    saveBtnDisabled: {
        backgroundColor: '#aaa'
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    }
});
