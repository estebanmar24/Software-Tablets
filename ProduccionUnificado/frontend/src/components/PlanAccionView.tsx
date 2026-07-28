import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const ESTADOS_FILTRO = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en proceso', label: 'En Proceso' },
    { value: 'pausado', label: 'Pausado' },
    { value: 'cerrada', label: 'Cerrada' },
    { value: 'vencida', label: 'Vencida' },
];

const AVANCE_FILTRO = [
    { value: '', label: 'Todos' },
    { value: '0', label: '0%' },
    { value: '1-49', label: '1% – 49%' },
    { value: '50-99', label: '50% – 99%' },
    { value: '100', label: '100%' },
];

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

interface AdminUsuario {
    id: number;
    username: string;
    nombreMostrar: string;
    email: string;
    area: string;
    rol: string;
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
    const [allUsers, setAllUsers] = useState<AdminUsuario[]>([]);
    const [selectedResponsables, setSelectedResponsables] = useState<{ nombre: string, email: string }[]>([]);
    const [manualResponsableText, setManualResponsableText] = useState('');

    // Filtros de listado
    const [filtroProceso, setFiltroProceso] = useState('');
    const [filtroResponsable, setFiltroResponsable] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroAvance, setFiltroAvance] = useState('');
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

    // canCreate=false means we came from the dashboard shortcut (Consultative/Execution mode)
    const canEditCore = canCreate || !editingId;

    const responsablesDisponibles = useMemo(() => {
        const set = new Set<string>();
        planes.forEach((p) => {
            (p.responsable || '')
                .split(',')
                .map((r) => r.trim())
                .filter(Boolean)
                .forEach((r) => set.add(r));
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    }, [planes]);

    const tieneFiltrosActivos = !!(
        filtroProceso || filtroResponsable || filtroEstado || filtroAvance || filtroFechaDesde || filtroFechaHasta
    );

    const limpiarFiltros = () => {
        setFiltroProceso('');
        setFiltroResponsable('');
        setFiltroEstado('');
        setFiltroAvance('');
        setFiltroFechaDesde('');
        setFiltroFechaHasta('');
    };

    const planesFiltrados = useMemo(() => {
        return planes.filter((plan) => {
            if (filtroProceso) {
                const procs = (plan.proceso || '').split(',').map((x) => x.trim().toLowerCase());
                if (!procs.includes(filtroProceso.toLowerCase())) return false;
            }
            if (filtroResponsable) {
                const reps = (plan.responsable || '').split(',').map((x) => x.trim().toLowerCase());
                if (!reps.includes(filtroResponsable.toLowerCase())) return false;
            }
            if (filtroEstado) {
                const est = (plan.estado || '').toLowerCase().replace(/\s+/g, ' ');
                const target = filtroEstado.toLowerCase();
                if (est !== target && est.replace(' ', '') !== target.replace(' ', '')) return false;
            }
            if (filtroAvance) {
                const av = Number(plan.porcentajeAvance) || 0;
                if (filtroAvance === '0' && av !== 0) return false;
                if (filtroAvance === '1-49' && (av < 1 || av > 49)) return false;
                if (filtroAvance === '50-99' && (av < 50 || av > 99)) return false;
                if (filtroAvance === '100' && av !== 100) return false;
            }
            if (filtroFechaDesde) {
                const fc = (plan.fechaCompromiso || '').slice(0, 10);
                if (!fc || fc < filtroFechaDesde) return false;
            }
            if (filtroFechaHasta) {
                const fc = (plan.fechaCompromiso || '').slice(0, 10);
                if (!fc || fc > filtroFechaHasta) return false;
            }
            return true;
        });
    }, [planes, filtroProceso, filtroResponsable, filtroEstado, filtroAvance, filtroFechaDesde, filtroFechaHasta]);

    const addManualResponsable = () => {
        const val = manualResponsableText.trim();
        if (val) {
            // Usar el nombre como email si no hay email (para evitar duplicados por nombre en manuales)
            toggleResponsable({ id: 0, nombreMostrar: val, email: val, area: '', rol: '', username: val });
            setManualResponsableText('');
        }
    };

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
        // Cargar usuarios para el selector de responsables (usando el endpoint público)
        api.get('planaccion/usuarios').then(res => setAllUsers(res.data)).catch(e => console.error(e));
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
                    // Mobile
                    // ... implementation ...
                    Alert.alert('Info', 'Carga de PDF optimizada para Web. En móvil requiere permisos adicionales.');
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleArea = (area: string) => {
        const current = formData.proceso ? formData.proceso.split(',') : [];
        const index = current.indexOf(area);
        let updated;
        if (index > -1) {
            updated = current.filter(x => x !== area);
        } else {
            updated = [...current, area];
        }
        setField('proceso', updated.join(','));
    };

    const toggleResponsable = (user: AdminUsuario) => {
        // Comparar tanto email como nombre para mayor seguridad
        const isSelected = selectedResponsables.some(r => 
            (user.email && r.email === user.email) || r.nombre === user.nombreMostrar
        );
        
        if (isSelected) {
            setSelectedResponsables(prev => prev.filter(r => 
                (user.email && r.email !== user.email) || r.nombre !== user.nombreMostrar
            ));
        } else {
            setSelectedResponsables(prev => [...prev, { nombre: user.nombreMostrar, email: user.email || user.username || '' }]);
        }
    };

    const filteredUsers = allUsers.filter(u => {
        if (!u.area) return false;
        const userAreas = u.area.split(',').map(a => a.trim().toLowerCase());
        const targetAreas = formData.proceso.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
        if (targetAreas.length === 0) return true; // Si no hay áreas seleccionadas, mostrar todos (o ninguno según lógica de negocio, aquí permito todos para facilitar selección)
        return userAreas.some(ua => targetAreas.includes(ua));
    });

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
        
        // Validación corregida: ahora mira la lista de etiquetas seleccionadas
        if (selectedResponsables.length === 0) errors.push('Debe seleccionar al menos un Responsable.');

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(formData.fechaCompromiso)) errors.push('Formato de Fecha Compromiso inválido (YYYY-MM-DD).');

        if (errors.length > 0) {
            const errorMsg = 'Por favor corrija:\n\n- ' + errors.join('\n- ');
            Platform.OS === 'web' ? alert(errorMsg) : Alert.alert('Validación', errorMsg);
            return;
        }

        try {
            const payload = {
                ...formData,
                responsable: selectedResponsables.map(r => r.nombre).join(', '),
                responsableEmails: selectedResponsables.map(r => r.email).join(',')
            };

            if (editingId) {
                await api.put(`planaccion/${editingId}`, payload);
            } else {
                await api.post('planaccion', payload);
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
        setSelectedResponsables([]);
        setManualResponsableText('');
        setModalVisible(true);
    };

    const openEdit = (plan: PlanAccion) => {
        setEditingId(plan.id);
        setManualResponsableText('');
        
        // Reconstrucción de responsables seleccionados
        const nombresArr = plan.responsable.split(',').map(s => s.trim());
        const reconResponsables = allUsers
            .filter(u => nombresArr.includes(u.nombreMostrar))
            .map(u => ({ nombre: u.nombreMostrar, email: u.email }));
        
        setSelectedResponsables(reconResponsables);

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

    const handleDeleteExistingEvidence = async (evidenceId: number) => {
        try {
            await api.delete(`planaccion/evidencia/${evidenceId}`);
            setFormData(prev => ({
                ...prev,
                evidenciasAnteriores: prev.evidenciasAnteriores.filter(ev => ev.id !== evidenceId)
            }));
            loadData();
        } catch (err) {
            console.error('Error deleting evidence', err);
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = Platform.OS === 'web' 
            ? window.confirm('¿Está seguro de eliminar este plan de acción?') 
            : true;

        if (confirmDelete) {
            api.delete(`planaccion/${id}`).then(() => loadData()).catch(e => console.error(e));
        }
    };

    const toggleShowAll = () => {
        setShowAll(!showAll);
    };

    const openDetail = (plan: PlanAccion) => {
        setSelectedPlan(plan);
        setDetailVisible(true);
    };

    const setField = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
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
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 15, gap: 10 }}>
                {isAdmin && (
                    <TouchableOpacity
                        style={[styles.btnFilter, { backgroundColor: showAll ? '#718096' : '#3182CE' }]}
                        onPress={toggleShowAll}
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

            <View style={styles.filtersCard}>
                <Text style={styles.filtersTitle}>Filtros</Text>
                <View style={styles.filtersRow}>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Proceso</Text>
                        <View style={styles.filterPickerWrap}>
                            <Picker selectedValue={filtroProceso} onValueChange={setFiltroProceso} style={styles.filterPicker}>
                                <Picker.Item label="Todos" value="" />
                                {AREAS.map((a) => (
                                    <Picker.Item key={a} label={a} value={a} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Responsable</Text>
                        <View style={styles.filterPickerWrap}>
                            <Picker selectedValue={filtroResponsable} onValueChange={setFiltroResponsable} style={styles.filterPicker}>
                                <Picker.Item label="Todos" value="" />
                                {responsablesDisponibles.map((r) => (
                                    <Picker.Item key={r} label={r} value={r} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Estado</Text>
                        <View style={styles.filterPickerWrap}>
                            <Picker selectedValue={filtroEstado} onValueChange={setFiltroEstado} style={styles.filterPicker}>
                                <Picker.Item label="Todos" value="" />
                                {ESTADOS_FILTRO.map((e) => (
                                    <Picker.Item key={e.value} label={e.label} value={e.value} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>% Avance</Text>
                        <View style={styles.filterPickerWrap}>
                            <Picker selectedValue={filtroAvance} onValueChange={setFiltroAvance} style={styles.filterPicker}>
                                {AVANCE_FILTRO.map((a) => (
                                    <Picker.Item key={a.value || 'all'} label={a.label} value={a.value} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>F. compromiso desde</Text>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={filtroFechaDesde}
                                onChange={(e: any) => setFiltroFechaDesde(e.target.value)}
                                style={{
                                    padding: 8,
                                    borderRadius: 6,
                                    border: '1px solid #CBD5E0',
                                    fontSize: 13,
                                    backgroundColor: '#fff',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    height: 40,
                                }}
                            />
                        ) : (
                            <TextInput
                                style={styles.input}
                                value={filtroFechaDesde}
                                onChangeText={setFiltroFechaDesde}
                                placeholder="YYYY-MM-DD"
                            />
                        )}
                    </View>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>F. compromiso hasta</Text>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={filtroFechaHasta}
                                onChange={(e: any) => setFiltroFechaHasta(e.target.value)}
                                style={{
                                    padding: 8,
                                    borderRadius: 6,
                                    border: '1px solid #CBD5E0',
                                    fontSize: 13,
                                    backgroundColor: '#fff',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    height: 40,
                                }}
                            />
                        ) : (
                            <TextInput
                                style={styles.input}
                                value={filtroFechaHasta}
                                onChangeText={setFiltroFechaHasta}
                                placeholder="YYYY-MM-DD"
                            />
                        )}
                    </View>
                </View>
                <View style={styles.filtersFooter}>
                    <Text style={styles.filtersCount}>
                        {planesFiltrados.length} de {planes.length} plan(es)
                    </Text>
                    {tieneFiltrosActivos && (
                        <TouchableOpacity style={styles.btnClearFilters} onPress={limpiarFiltros}>
                            <Text style={styles.btnClearFiltersText}>Limpiar filtros</Text>
                        </TouchableOpacity>
                    )}
                </View>
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
                            {planesFiltrados.length === 0 ? (
                                <Text style={styles.emptyText}>
                                    {planes.length === 0
                                        ? 'No hay planes de acción registrados'
                                        : 'Ningún plan coincide con los filtros'}
                                </Text>
                            ) : (
                                planesFiltrados.map((plan, idx) => (
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

                            <View style={{ marginBottom: 15 }}>
                                <Text style={styles.label}>Responsables Seleccionados *</Text>
                                <View style={styles.chipContainer}>
                                    {selectedResponsables.map((res, idx) => (
                                        <TouchableOpacity key={idx} style={styles.chipResponsable} onPress={() => setSelectedResponsables(prev => prev.filter((_, i) => i !== idx))}>
                                            <Text style={styles.chipResponsableText}>{res.nombre} ✕</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 5 }}>
                                    <TextInput 
                                        style={[styles.input, { flex: 1, marginBottom: 0, borderColor: manualResponsableText ? '#3182CE' : '#CBD5E0' }]} 
                                        placeholder="Escribir nombre o correo manual..."
                                        value={manualResponsableText}
                                        onChangeText={setManualResponsableText}
                                        onSubmitEditing={addManualResponsable}
                                    />
                                    <TouchableOpacity 
                                        style={[styles.btnAddManual, { backgroundColor: manualResponsableText ? '#3182CE' : '#A0AEC0' }]}
                                        onPress={addManualResponsable}
                                    >
                                        <Text style={styles.btnNewText}>Agregar</Text>
                                    </TouchableOpacity>
                                </View>
                                {manualResponsableText.length > 0 && (
                                    <Text style={{ color: '#3182CE', fontSize: 11, marginTop: 2 }}>⚠️ Toque "Agregar" para incluir a este responsable</Text>
                                )}

                                {formData.proceso.length > 0 && (
                                    <>
                                        <Text style={[styles.label, { marginTop: 15 }]}>Sugerencias del Área:</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {filteredUsers.length > 0 ? (
                                                    filteredUsers.map(u => {
                                                        const isSelected = selectedResponsables.some(r => r.email === u.email);
                                                        return (
                                                            <TouchableOpacity
                                                                key={u.id}
                                                                style={[styles.userAltChip, isSelected && styles.userAltChipSelected]}
                                                                onPress={() => toggleResponsable(u)}
                                                            >
                                                                <Text style={[styles.userAltChipText, isSelected && { color: '#fff' }]}>{u.nombreMostrar}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })
                                                ) : (
                                                    <Text style={{ color: '#718096', fontSize: 12 }}>No hay usuarios registrados en las áreas seleccionadas</Text>
                                                )}
                                            </View>
                                        </ScrollView>
                                    </>
                                )}
                            </View>

                            <View style={styles.formRow}>
                                <View style={{ flex: 1, marginLeft: 0 }}>
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
    filtersCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filtersTitle: { fontSize: 14, fontWeight: '700', color: '#2D3748', marginBottom: 10 },
    filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    filterGroup: { minWidth: 160, flexGrow: 1, flexBasis: 160 },
    filterLabel: { fontSize: 12, fontWeight: '600', color: '#718096', marginBottom: 4 },
    filterPickerWrap: {
        borderWidth: 1,
        borderColor: '#CBD5E0',
        borderRadius: 6,
        height: 40,
        justifyContent: 'center',
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    filterPicker: { height: 40 },
    filtersFooter: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    filtersCount: { fontSize: 13, color: '#4A5568', fontWeight: '600' },
    btnClearFilters: {
        backgroundColor: '#EDF2F7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#CBD5E0',
    },
    btnClearFiltersText: { color: '#4A5568', fontWeight: '700', fontSize: 12 },
    btnAddManual: { paddingHorizontal: 15, height: 45, justifyContent: 'center', borderRadius: 6, elevation: 2 },
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
    chipResponsable: { backgroundColor: '#3182CE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginRight: 5, marginBottom: 5 },
    chipResponsableText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    userAltChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: '#3182CE', backgroundColor: '#fff' },
    userAltChipSelected: { backgroundColor: '#3182CE' },
    userAltChipText: { fontSize: 12, color: '#3182CE' },
    disabledInput: { backgroundColor: '#F7FAFC', color: '#718096', borderColor: '#E2E8F0' },
});
