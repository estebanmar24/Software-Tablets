import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Modal, Platform, Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../services/productionApi';
import { getFileServerUrl } from '../services/apiConfig';

const AREAS = ["Gerencia", "SST", "Planeacion", "Gestion Humana", "Talleres y Despachos", "Calidad", "Produccion", "Almacen", "Diseño", "Contabilidad"];

interface PlanAccion {
    id: number;
    proceso: string;
    hallazgo: string;
    causaRaiz: string;
    accionCorrectiva: string;
    responsable: string;
    fechaInicio: string;
    fechaCompromiso: string;
    estado: string;
    porcentajeAvance: number;
    evidencias: PlanAccionEvidencia[];
    observaciones?: string;
    diasRestantes: number;
    semaforo: string;
    fechaCreacion: string;
}

interface PlanAccionEvidencia {
    id: number;
    filePath: string;
    fileName: string;
    fileType: string;
}

interface PlanAccionEvidenciaUpload {
    fileName: string;
    base64Data: string;
    fileType: string;
}

const emptyForm = {
    proceso: '',
    hallazgo: '',
    causaRaiz: '',
    accionCorrectiva: '',
    responsable: '',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaCompromiso: new Date().toISOString().split('T')[0],
    estado: 'pendiente',
    porcentajeAvance: 0,
    nuevasEvidencias: [] as PlanAccionEvidenciaUpload[],
    evidenciasAnteriores: [] as PlanAccionEvidencia[],
    observaciones: '',
};

interface PlanAccionViewProps {
    onClose?: () => void;
    userArea?: string;
    userRole?: string;
    canCreate?: boolean;
}

export default function PlanAccionView({ onClose, userArea, userRole, canCreate = true }: PlanAccionViewProps) {
    const isAdmin = ['admin', 'master'].includes(userRole?.toLowerCase() || '');
    const canDelete = ['admin', 'master', 'calidad'].includes(userRole?.toLowerCase() || '');
    const [planes, setPlanes] = useState<PlanAccion[]>([]);
    const [showAll, setShowAll] = useState(isAdmin);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ ...emptyForm });
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PlanAccion | null>(null);
    const [fileServer, setFileServer] = useState('');

    // canCreate=false means we came from the dashboard shortcut (Consultative/Execution mode)
    const canEditCore = canCreate || !editingId;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const areaToFilter = showAll ? null : userArea;
            const url = areaToFilter ? `planaccion/area/${encodeURIComponent(areaToFilter)}` : 'planaccion';
            const res = await api.get(url);
            setPlanes(res.data);
        } catch (err) {
            console.error('Error loading plans', err);
        } finally {
            setLoading(false);
        }
    }, [userArea, showAll]);

    useEffect(() => { 
        loadData(); 
        getFileServerUrl().then(url => setFileServer(url));
    }, [loadData]);

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la galería.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0].base64) {
            const asset = result.assets[0];
            const fileName = asset.fileName || `foto_${Date.now()}.jpg`;
            const base64 = `data:image/jpeg;base64,${asset.base64}`;

            setFormData(prev => ({
                ...prev,
                nuevasEvidencias: [...prev.nuevasEvidencias, {
                    fileName,
                    base64Data: base64,
                    fileType: 'Photo'
                }]
            }));
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                // In web, we can read as base64
                if (Platform.OS === 'web') {
                    const response = await fetch(asset.uri);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result as string;
                        setFormData(prev => ({
                            ...prev,
                            nuevasEvidencias: [...prev.nuevasEvidencias, {
                                fileName: asset.name,
                                base64Data: base64,
                                fileType: 'Pdf'
                            }]
                        }));
                    };
                    reader.readAsDataURL(blob);
                } else {
                    // For mobile, you'd usually use expo-file-system to read as base64
                    // Since the user is mostly using web for this demo, I'll prioritize web base64
                    Alert.alert('Info', 'Carga de PDF optimizada para Web. En móvil requiere permisos adicionales.');
                }
            }
        } catch (err) {
            console.error('Error picking document', err);
        }
    };

    const removeNewEvidence = (index: number) => {
        setFormData(prev => ({
            ...prev,
            nuevasEvidencias: prev.nuevasEvidencias.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        const errors = [];
        if (!formData.proceso) errors.push('Debe seleccionar al menos un Proceso / Área.');
        if (!formData.hallazgo || formData.hallazgo.trim().length < 5) errors.push('El Hallazgo / Problema es obligatorio (mín. 5 caracteres).');
        if (!formData.accionCorrectiva || formData.accionCorrectiva.trim().length < 5) errors.push('La Acción Correctiva es obligatoria (mín. 5 caracteres).');
        if (!formData.responsable) errors.push('El Responsable es obligatorio.');

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(formData.fechaCompromiso)) errors.push('Formato de Fecha Compromiso inválido (YYYY-MM-DD).');

        if (errors.length > 0) {
            Alert.alert('Validación', 'Por favor corrija los siguientes errores:\n\n- ' + errors.join('\n- '));
            return;
        }

        try {
            if (editingId) {
                await api.put(`planaccion/${editingId}`, formData);
            } else {
                await api.post('planaccion', formData);
            }
            setModalVisible(false);
            loadData();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Error al guardar';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setFormData({ ...emptyForm });
        setModalVisible(true);
    };

    const openEdit = (plan: PlanAccion) => {
        setEditingId(plan.id);
        setFormData({
            proceso: plan.proceso,
            hallazgo: plan.hallazgo,
            causaRaiz: plan.causaRaiz || '',
            accionCorrectiva: plan.accionCorrectiva,
            responsable: plan.responsable,
            fechaInicio: plan.fechaInicio.split('T')[0],
            fechaCompromiso: plan.fechaCompromiso.split('T')[0],
            estado: plan.estado,
            porcentajeAvance: plan.porcentajeAvance,
            nuevasEvidencias: [],
            evidenciasAnteriores: plan.evidencias || [],
            observaciones: plan.observaciones || '',
        });
        setModalVisible(true);
    };

    const handleDeleteExistingEvidence = async (evId: number) => {
        try {
            await api.delete(`planaccion/evidencia/${evId}`);
            setFormData(prev => ({
                ...prev,
                evidenciasAnteriores: prev.evidenciasAnteriores.filter(e => e.id !== evId)
            }));
            // Refresh main list
            loadData();
        } catch (err) {
            Alert.alert('Error', 'No se pudo eliminar el archivo.');
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = () => {
            api.delete(`planaccion/${id}`).then(() => loadData());
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro de eliminar este plan de acción?')) confirmDelete();
        } else {
            Alert.alert('Eliminar', '¿Está seguro de eliminar este plan de acción?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', onPress: confirmDelete, style: 'destructive' }
            ]);
        }
    };

    const openDetail = (plan: PlanAccion) => {
        setSelectedPlan(plan);
        setDetailVisible(true);
    };

    const setField = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleArea = (area: string) => {
        const current = formData.proceso ? formData.proceso.split(',').filter(x => x) : [];
        const index = current.indexOf(area);
        let updated;
        if (index > -1) {
            updated = current.filter(x => x !== area);
        } else {
            updated = [...current, area];
        }
        setField('proceso', updated.join(','));
    };

    const getSemaforoColor = (semaforo: string) => {
        switch (semaforo) {
            case 'Verde': return '#48BB78';
            case 'Amarillo': return '#F6E05E';
            case 'Rojo': return '#F56565';
            default: return '#A0AEC0';
        }
    };

    return (
        <View style={styles.container}>
            {/* Header removed as it is now in AdminDashboard */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 15, gap: 10 }}>
                {isAdmin && (
                    <TouchableOpacity
                        style={[styles.btnFilter, { backgroundColor: showAll ? '#718096' : '#3182CE' }]}
                        onPress={() => setShowAll(!showAll)}
                    >
                        <Text style={styles.btnNewText}>
                            {showAll ? 'Filtrar: Mis Planes' : 'Ver Todos los Planes'}
                        </Text>
                    </TouchableOpacity>
                )}
                {canCreate && (
                    <TouchableOpacity style={styles.btnNew} onPress={openCreate}>
                        <Text style={styles.btnNewText}>+ Nuevo Plan</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3182CE" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView horizontal>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: 40 }]}>ID</Text>
                            <Text style={[styles.th, { width: 140 }]}>Proceso</Text>
                            <Text style={[styles.th, { width: 300 }]}>Hallazgo / Problema</Text>
                            <Text style={[styles.th, { width: 300 }]}>Acción Correctiva</Text>
                            <Text style={[styles.th, { width: 140 }]}>Responsable</Text>
                            <Text style={[styles.th, { width: 110 }]}>F. Comprom.</Text>
                            <Text style={[styles.th, { width: 100 }]}>Estado</Text>
                            <Text style={[styles.th, { width: 80 }]}>% Avan.</Text>
                            <Text style={[styles.th, { width: 40 }]}>🚦</Text>
                            <Text style={[styles.th, { width: 70 }]}>Días</Text>
                            <Text style={[styles.th, { width: 90 }]}>Acciones</Text>
                        </View>

                        <ScrollView style={{ maxHeight: 600 }}>
                            {planes.length === 0 ? (
                                <Text style={styles.emptyText}>No hay planes de acción registrados</Text>
                            ) : (
                                planes.map((plan, idx) => (
                                    <View key={plan.id} style={[styles.row, { backgroundColor: idx % 2 === 0 ? '#fff' : '#F7FAFC' }]}>
                                        <Text style={[styles.cell, { width: 40 }]}>{plan.id}</Text>
                                        <Text style={[styles.cell, { width: 140 }]}>{plan.proceso}</Text>
                                        <Text style={[styles.cell, { width: 300 }]} numberOfLines={3}>{plan.hallazgo}</Text>
                                        <Text style={[styles.cell, { width: 300 }]} numberOfLines={3}>{plan.accionCorrectiva}</Text>
                                        <Text style={[styles.cell, { width: 140 }]}>{plan.responsable}</Text>
                                        <Text style={[styles.cell, { width: 110 }]}>{new Date(plan.fechaCompromiso).toLocaleDateString()}</Text>
                                        <Text style={[styles.cell, { width: 100, textTransform: 'capitalize' }]}>{plan.estado}</Text>
                                        <Text style={[styles.cell, { width: 80, fontWeight: 'bold' }]}>{plan.porcentajeAvance}%</Text>
                                        <View style={{ width: 40, alignItems: 'center' }}>
                                            <View style={[styles.semaforo, { backgroundColor: getSemaforoColor(plan.semaforo) }]} />
                                        </View>
                                        <Text style={[styles.cell, { width: 70, color: plan.diasRestantes < 0 ? '#E53E3E' : '#2D3748', fontWeight: 'bold' }]}>
                                            {plan.diasRestantes}
                                        </Text>
                                        <View style={{ width: 90, flexDirection: 'row', gap: 10 }}>
                                            <TouchableOpacity onPress={() => openDetail(plan)}>
                                                <Text style={{ fontSize: 18 }}>👁️</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => openEdit(plan)}>
                                                <Text style={{ fontSize: 18 }}>✏️</Text>
                                            </TouchableOpacity>
                                            {canDelete && (
                                                <TouchableOpacity onPress={() => handleDelete(plan.id)}>
                                                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </ScrollView>
            )}

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>{editingId ? 'Editar Plan de Acción' : 'Nuevo Plan de Acción'}</Text>

                            <Text style={styles.label}>Proceso / Área *</Text>
                            <View style={styles.chipContainer}>
                                {AREAS.map(area => {
                                    const active = formData.proceso.split(',').includes(area);
                                    return (
                                        <TouchableOpacity
                                            key={area}
                                            style={[
                                                styles.chip,
                                                active && styles.chipActive,
                                                !canEditCore && { opacity: 0.5 }
                                            ]}
                                            onPress={() => canEditCore && toggleArea(area)}
                                            disabled={!canEditCore}
                                        >
                                            <Text style={[styles.chipText, active && { color: '#fff' }]}>{area}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Hallazgo / Problema *</Text>
                            <TextInput
                                style={[styles.input, { height: 60 }, !canEditCore && styles.disabledInput]}
                                multiline
                                value={formData.hallazgo}
                                onChangeText={v => setField('hallazgo', v)}
                                editable={canEditCore}
                            />


                            <Text style={styles.label}>Causa Raíz</Text>
                            <TextInput
                                style={[styles.input, { height: 60 }, !canEditCore && styles.disabledInput]}
                                multiline
                                value={formData.causaRaiz}
                                onChangeText={v => setField('causaRaiz', v)}
                                editable={canEditCore}
                            />

                            <Text style={styles.label}>Acción Correctiva *</Text>
                            <TextInput
                                style={[styles.input, { height: 60 }, !canEditCore && styles.disabledInput]}
                                multiline
                                value={formData.accionCorrectiva}
                                onChangeText={v => setField('accionCorrectiva', v)}
                                editable={canEditCore}
                            />

                            <View style={styles.formRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Responsable *</Text>
                                    <TextInput
                                        style={[styles.input, !canEditCore && styles.disabledInput]}
                                        value={formData.responsable}
                                        onChangeText={v => setField('responsable', v)}
                                        editable={canEditCore}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.label}>Estado</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker selectedValue={formData.estado} onValueChange={v => setField('estado', v)}>
                                            <Picker.Item label="Pendiente" value="pendiente" />
                                            <Picker.Item label="En proceso" value="en proceso" />
                                            <Picker.Item label="Cerrada" value="cerrada" />
                                            <Picker.Item label="Vencida" value="vencida" />
                                        </Picker>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Fecha Inicio</Text>
                                    <TextInput
                                        style={[styles.input, !canEditCore && styles.disabledInput]}
                                        value={formData.fechaInicio}
                                        onChangeText={v => setField('fechaInicio', v)}
                                        placeholder="YYYY-MM-DD"
                                        editable={canEditCore}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.label}>Fecha Compromiso</Text>
                                    <TextInput
                                        style={[styles.input, !canEditCore && styles.disabledInput]}
                                        value={formData.fechaCompromiso}
                                        onChangeText={v => setField('fechaCompromiso', v)}
                                        placeholder="YYYY-MM-DD"
                                        editable={canEditCore}
                                    />
                                </View>
                            </View>

                            <Text style={styles.label}>% de Avance ({formData.porcentajeAvance}%)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={formData.porcentajeAvance.toString()} onChangeText={v => setField('porcentajeAvance', parseInt(v) || 0)} />

                            <Text style={styles.label}>Archivos / Fotos Adjuntos</Text>
                            <View style={{ marginBottom: 15 }}>
                                {/* Existing Evidences */}
                                {formData.evidenciasAnteriores.map((ev) => (
                                    <View key={`ex-${ev.id}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2E8F0', padding: 8, borderRadius: 6, marginBottom: 5 }}>
                                        <Text style={{ fontSize: 18, marginRight: 8 }}>{ev.fileType.toLowerCase().includes('pdf') ? '📄' : '📷'}</Text>
                                        <Text style={{ flex: 1, color: '#2D3748' }} numberOfLines={1}>{ev.fileName}</Text>
                                        <TouchableOpacity onPress={() => handleDeleteExistingEvidence(ev.id)}>
                                            <Text style={{ color: '#E53E3E', fontSize: 18, padding: 5 }}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {/* New (Pending) Evidences */}
                                {formData.nuevasEvidencias.map((ev, idx) => (
                                    <View key={`new-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FFF4', padding: 8, borderRadius: 6, marginBottom: 5 }}>
                                        <Text style={{ fontSize: 18, marginRight: 8 }}>{ev.fileType === 'Photo' ? '📷' : '📄'}</Text>
                                        <Text style={{ flex: 1, color: '#2D3748' }} numberOfLines={1}>{ev.fileName} (Nuevo)</Text>
                                        <TouchableOpacity onPress={() => removeNewEvidence(idx)}>
                                            <Text style={{ color: '#E53E3E', fontWeight: 'bold', padding: 5, fontSize: 16 }}>X</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {formData.evidenciasAnteriores.length === 0 && formData.nuevasEvidencias.length === 0 && (
                                    <Text style={{ color: '#718096', fontStyle: 'italic', marginBottom: 5 }}>Ningún archivo adjunto</Text>
                                )}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                <TouchableOpacity style={[styles.btnImg, { flex: 1 }]} onPress={handlePickImage}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Agregar Foto</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btnImg, { backgroundColor: '#E53E3E', flex: 1 }]} onPress={handlePickDocument}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Agregar PDF</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Observaciones</Text>
                            <TextInput style={[styles.input, { height: 60 }]} multiline value={formData.observaciones} onChangeText={v => setField('observaciones', v)} />

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.btnCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
                                    <Text style={styles.btnSaveText}>💾 Guardar Plan</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal de Vista Detallada */}
            <Modal visible={detailVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 800 }]}>
                        {selectedPlan && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ borderBottomWidth: 2, borderBottomColor: '#3182CE', marginBottom: 20, paddingBottom: 10 }}>
                                    <Text style={[styles.modalTitle, { marginBottom: 5, color: '#2C5282' }]}>DETALLE DEL PLAN DE ACCIÓN</Text>
                                    <Text style={{ textAlign: 'center', color: '#718096' }}>ID: {selectedPlan.id} | Creado: {new Date(selectedPlan.fechaCreacion).toLocaleDateString()}</Text>
                                </View>

                                <View style={styles.detailCard}>
                                    <DetailItem label="Proceso" value={selectedPlan.proceso} />
                                    <DetailItem label="Estado" value={selectedPlan.estado.toUpperCase()} isStatus color={getSemaforoColor(selectedPlan.semaforo)} />
                                </View>

                                <View style={styles.detailCard}>
                                    <DetailItem label="Hallazgo / Problema" value={selectedPlan.hallazgo} isTitle />
                                    <DetailItem label="Causa Raíz" value={selectedPlan.causaRaiz || 'No especificada'} />
                                    <DetailItem label="Acción Correctiva" value={selectedPlan.accionCorrectiva} highlight />
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.detailCard, { flex: 1 }]}>
                                        <DetailItem label="Responsable" value={selectedPlan.responsable} />
                                        <DetailItem label="Avance" value={`${selectedPlan.porcentajeAvance}%`} />
                                    </View>
                                    <View style={[styles.detailCard, { flex: 1, marginLeft: 15 }]}>
                                        <DetailItem label="Fecha Inicio" value={new Date(selectedPlan.fechaInicio).toLocaleDateString()} />
                                        <DetailItem label="Fecha Compromiso" value={new Date(selectedPlan.fechaCompromiso).toLocaleDateString()} />
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                                    {selectedPlan.evidencias.map((ev, idx) => (
                                        <View key={ev.id || idx} style={[styles.detailCard, { flex: 1, minWidth: 280 }]}>
                                            <Text style={styles.detailLabel}>{ev.fileType === 'Photo' ? 'Imagen:' : 'Documento:'}</Text>
                                            <Text style={{ fontSize: 13, color: '#4A5568', marginBottom: 10 }}>{ev.fileName}</Text>
                                            {ev.fileType === 'Photo' ? (
                                                <Image
                                                    source={{ uri: `${fileServer}/${ev.filePath}` }}
                                                    style={styles.detailImage}
                                                    resizeMode="contain"
                                                />
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.btnPdfLink}
                                                    onPress={() => window.open(`${fileServer}/${ev.filePath}`, '_blank')}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>📄 Abrir PDF</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}
                                    {selectedPlan.evidencias.length === 0 && (
                                        <Text style={{ padding: 20, color: '#718096', fontStyle: 'italic' }}>No hay evidencias registradas</Text>
                                    )}
                                </View>

                                <View style={styles.detailCard}>
                                    <DetailItem label="Observaciones" value={selectedPlan.observaciones || 'Sin observaciones'} />
                                </View>

                                <TouchableOpacity style={[styles.btnSave, { alignSelf: 'center', marginTop: 20 }]} onPress={() => setDetailVisible(false)}>
                                    <Text style={styles.btnSaveText}>Cerrar Vista</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal >
        </View >
    );
}

function DetailItem({ label, value, isTitle, highlight, isStatus, color }: any) {
    return (
        <View style={{ marginBottom: 15 }}>
            <Text style={styles.detailLabel}>{label}:</Text>
            {isStatus ? (
                <View style={[styles.statusBadge, { backgroundColor: color }]}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{value}</Text>
                </View>
            ) : (
                <Text style={[
                    styles.detailValue,
                    isTitle && { fontSize: 18, fontWeight: 'bold', color: '#1A202C' },
                    highlight && { color: '#2B6CB0', fontWeight: '600' }
                ]}>
                    {value}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15, backgroundColor: '#F7FAFC' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#2D3748' },
    btnNew: { backgroundColor: '#3182CE', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6 },
    btnFilter: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6 },
    btnNewText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#2D3748', padding: 10, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
    th: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    row: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', alignItems: 'center' },
    cell: { fontSize: 13, color: '#2D3748', lineHeight: 18 },
    emptyText: { padding: 40, textAlign: 'center', color: '#718096', fontSize: 15 },
    semaforo: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', width: '90%', maxWidth: 700, padding: 20, borderRadius: 12, maxHeight: '90%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#2D3748' },
    label: { fontSize: 13, fontWeight: 'bold', color: '#4A5568', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, padding: 10, fontSize: 14, backgroundColor: '#fff' },
    formRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    pickerWrap: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 6, height: 45, justifyContent: 'center', backgroundColor: '#fff' },
    btnImg: { backgroundColor: '#718096', padding: 10, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    btnCancel: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E0' },
    btnCancelText: { color: '#4A5568', fontWeight: 'bold', fontSize: 14 },
    btnSave: { backgroundColor: '#38A169', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
    btnSaveText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    // Detail View
    detailCard: { backgroundColor: '#F7FAFC', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    detailLabel: { fontSize: 12, fontWeight: 'bold', color: '#718096', textTransform: 'uppercase', marginBottom: 4 },
    detailValue: { fontSize: 15, color: '#2D3748', lineHeight: 20 },
    detailImage: { width: '100%', height: 300, borderRadius: 8, marginTop: 10 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 5 },
    btnPdfLink: { backgroundColor: '#E53E3E', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    // Multi-Area chips
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#CBD5E0', backgroundColor: '#EDF2F7' },
    chipActive: { backgroundColor: '#3182CE', borderColor: '#3182CE' },
    chipText: { fontSize: 12, color: '#4A5568', fontWeight: '500' },
    disabledInput: { backgroundColor: '#F7FAFC', color: '#718096', borderColor: '#E2E8F0' },
});
