import { authFetch } from '../services/authFetch';
import { getToken, removeToken } from '../services/authStorage';
import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ScrollView, TextInput, ActivityIndicator, Keyboard, Modal, Dimensions, RefreshControl, Image, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/productionApi';

// --- Local Helpers ---
const SectionCard = memo(function SectionCard({ title, icon, children, style }: any) {
    return (
        <View style={[styles.sectionCard, style]}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
});

const FormField = memo(function FormField({ label, required, children, style }: any) {
    return (
        <View style={[styles.formField, style]}>
            <Text style={styles.fieldLabel}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>
            {children}
        </View>
    );
});

const SERVER_URL = api.defaults.baseURL ? api.defaults.baseURL.split('/api')[0] : '';

const ChoiceField = memo(function ChoiceField({ value, onSelect, options = ['SI', 'NO'], photos = [], onTakePhoto, onRemovePhoto, onEnlargePhoto }: any) {
    const isPositive = (opt: string) => {
        const upper = opt.toUpperCase();
        return upper === 'SI' || upper === 'CUMPLE';
    };

    return (
        <View style={styles.choiceFieldContainer}>
            {/* Row 1: Choice buttons */}
            <View style={styles.choiceContainer}>
                {options.map((opt: string) => {
                    const optIsPositive = isPositive(opt);
                    const currentIsSelected = value !== null && value !== undefined &&
                        (optIsPositive ? value === true : value === false);
                    return (
                        <TouchableOpacity
                            key={opt}
                            style={styles.choiceOption}
                            onPress={() => onSelect(optIsPositive)}
                        >
                            <View style={[styles.choiceCircle, currentIsSelected && styles.choiceCircleActive]} />
                            <Text style={[styles.choiceOptionText, currentIsSelected && styles.choiceOptionTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Row 2: Photos (full width, wrapping) */}
            {photos.length > 0 && (
                <View style={styles.photosRowContainer}>
                    {photos.map((uri: string, idx: number) => (
                        <TouchableOpacity
                            key={idx}
                            style={styles.photoPreviewContainer}
                            onPress={() => onEnlargePhoto && onEnlargePhoto(uri.startsWith('data') ? uri : (SERVER_URL + uri))}
                        >
                            <Image
                                source={{ uri: uri.startsWith('data') ? uri : (SERVER_URL + uri) }}
                                style={styles.photoPreview}
                            />
                            <TouchableOpacity style={styles.removePhotoBtn} onPress={() => onRemovePhoto(idx)}>
                                <Text style={styles.removePhotoText}>{String.fromCharCode(10005)}</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Row 3: Camera + Gallery buttons */}
            {onTakePhoto && (
                <View style={styles.photoBtnsRow}>
                    <TouchableOpacity style={styles.addPhotoBtnCamera} onPress={() => onTakePhoto('camera')}>
                        <Text style={styles.addPhotoIconLarge}>{String.fromCodePoint(0x1F4F8)}</Text>
                        <Text style={styles.addPhotoTextSmall}>Camara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addPhotoBtnGallery} onPress={() => onTakePhoto('gallery')}>
                        <Text style={styles.addPhotoIconLarge}>{String.fromCodePoint(0x1F5BC)}</Text>
                        <Text style={styles.addPhotoTextSmall}>Galeria</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
});

interface Taller {
    id: number;
    nombre: string;
}

interface EncuestaResumen {
    id: number;
    tallerNombre: string;
    ordenProduccion: string;
    estadoProceso: string;
    fechaCreacion: string;
}

interface CalidadTalleresScreenProps {
    onLogout: () => void;
    username: string;
}

export default function CalidadTalleresScreen({ onLogout, username }: CalidadTalleresScreenProps) {
    const [view, setView] = useState<'history' | 'form'>('history');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Image enlargement modal
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const openImage = (uri: string) => setEnlargedImage(uri);
    const closeImage = () => setEnlargedImage(null);

    // Data
    const [talleres, setTalleres] = useState<Taller[]>([]);
    const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([]);

    // Form State - Identificación
    const [tallerId, setTallerId] = useState<number | 'otro' | null>(null);
    const [nombreTallerNuevo, setNombreTallerNuevo] = useState('');

    // Form State - Tiempos
    const [horaLlegada, setHoraLlegada] = useState('');
    const [periodoLlegada, setPeriodoLlegada] = useState('AM');
    const [horaSalida, setHoraSalida] = useState('');
    const [periodoSalida, setPeriodoSalida] = useState('PM');

    // Form State - Producción
    const [ordenProduccion, setOrdenProduccion] = useState('');
    const [numeroRemision, setNumeroRemision] = useState('');
    const [cantidadProducir, setCantidadProducir] = useState('');
    const [cantidadEvaluada, setCantidadEvaluada] = useState('');
    const [estadoProceso, setEstadoProceso] = useState('');

    // Form State - Requerimientos (CUMPLE / NO CUMPLE)
    const [tieneMuestra, setTieneMuestra] = useState<boolean | null>(null);
    const [tipoProducto, setTipoProducto] = useState('');
    const [conoceFormaEmpaque, setConoceFormaEmpaque] = useState<boolean | null>(null);
    const [tieneRemision, setTieneRemision] = useState<boolean | null>(null);
    const [tieneInsumosCompletos, setTieneInsumosCompletos] = useState<boolean | null>(null);

    // Form State - Puntos Criticos (SI / NO)
    const [variacionTono, setVariacionTono] = useState<boolean | null>(null);
    const [quebradoArrugado, setQuebradoArrugado] = useState<boolean | null>(null);
    const [esquinaDefectuosa, setEsquinaDefectuosa] = useState<boolean | null>(null);
    const [presenciaPestanas, setPresenciaPestanas] = useState<boolean | null>(null);
    const [desgasteImpresion, setDesgasteImpresion] = useState<boolean | null>(null);
    const [manchas, setManchas] = useState<boolean | null>(null);
    const [reservaPega, setReservaPega] = useState<boolean | null>(null);
    const [grafadoRoto, setGrafadoRoto] = useState<boolean | null>(null);

    // Form State - Logistica
    const [novedadBPM, setNovedadBPM] = useState<boolean | null>(null);
    const [usaCofia, setUsaCofia] = useState<boolean | null>(null);
    const [insumosPendientes, setInsumosPendientes] = useState<boolean | null>(null);
    const [tipoInsumosPendientes, setTipoInsumosPendientes] = useState('Ninguno');
    const [observaciones, setObservaciones] = useState('');

    // Form State - Fotos
    const [photos, setPhotos] = useState<{[key: string]: string[]}>({});

    // --- Helpers ---
    const formatTimeInput = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        const limited = cleaned.slice(0, 4);
        if (limited.length > 2) {
            return `${limited.slice(0, 2)}:${limited.slice(2)}`;
        }
        return limited;
    };

    const timeToMinutes = (timeStr: string, period: string) => {
        if (!timeStr || !timeStr.includes(':')) return 0;
        let [hours, minutes] = timeStr.split(':').map(Number);
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const pickImage = async (key: string, useCamera: boolean) => {
        if (Platform.OS === 'web') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            if (useCamera) (input as any).capture = 'environment';
            input.onchange = async (e: any) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev: any) => {
                    const base64 = ev.target.result as string;
                    setPhotos(prev => ({
                        ...prev,
                        [key]: [...(prev[key] || []), base64]
                    }));
                };
                reader.readAsDataURL(file);
            };
            input.click();
            return;
        }

        try {
            const { status } = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita acceso a la ' + (useCamera ? 'camara' : 'galeria'));
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.5, base64: true })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.5, base64: true });

            if (!result.canceled && result.assets[0].base64) {
                const base64 = 'data:image/jpeg;base64,' + result.assets[0].base64;
                setPhotos(prev => ({
                    ...prev,
                    [key]: [...(prev[key] || []), base64]
                }));
            }
        } catch (error) {
            console.error('Error picking image', error);
        }
    };

    const handlePhotoPress = (key: string, source: string) => {
        if (source === 'camera') {
            pickImage(key, true);
        } else {
            pickImage(key, false);
        }
    };

    const removePhoto = (key: string, index: number) => {
        setPhotos(prev => ({
            ...prev,
            [key]: (prev[key] || []).filter((_, i) => i !== index)
        }));
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [talleresRes, encuestasRes] = await Promise.all([
                api.get('/CalidadTalleres/talleres'),
                api.get('/CalidadTalleres')
            ]);
            setTalleres(talleresRes.data);
            setEncuestas(encuestasRes.data);
        } catch (error) {
            console.error("Error loading data", error);
            Alert.alert("Error", "No se pudo cargar la información del servidor.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setTallerId(null);
        setNombreTallerNuevo('');
        setHoraLlegada('');
        setPeriodoLlegada('AM');
        setHoraSalida('');
        setPeriodoSalida('PM');
        setOrdenProduccion('');
        setNumeroRemision('');
        setCantidadProducir('');
        setCantidadEvaluada('');
        setEstadoProceso('');
        setTieneMuestra(null);
        setTipoProducto('');
        setConoceFormaEmpaque(null);
        setTieneRemision(null);
        setTieneInsumosCompletos(null);
        setVariacionTono(null);
        setQuebradoArrugado(null);
        setEsquinaDefectuosa(null);
        setPresenciaPestanas(null);
        setDesgasteImpresion(null);
        setManchas(null);
        setReservaPega(null);
        setGrafadoRoto(null);
        setNovedadBPM(null);
        setUsaCofia(null);
        setInsumosPendientes(null);
        setTipoInsumosPendientes('Ninguno');
        setObservaciones('');
        setPhotos({});
    };

    const handleSave = async () => {
        if (!tallerId || !ordenProduccion || !estadoProceso || !cantidadProducir ||
            tieneMuestra === null || conoceFormaEmpaque === null || tieneRemision === null ||
            tieneInsumosCompletos === null || novedadBPM === null || usaCofia === null ||
            insumosPendientes === null) {
            Alert.alert("Campos incompletos", "Por favor completa todos los campos obligatorios (*)");
            return;
        }

        if (tallerId === 'otro' && !nombreTallerNuevo.trim()) {
            Alert.alert("Nombre faltante", "Por favor ingresa el nombre del taller externo.");
            return;
        }

        const minsLlegada = timeToMinutes(horaLlegada, periodoLlegada);
        const minsSalida = timeToMinutes(horaSalida, periodoSalida);

        if (minsLlegada >= minsSalida) {
            Alert.alert("Horario inválido", "La hora de llegada debe ser menor a la hora de salida.");
            return;
        }

        if (horaLlegada.length < 5 || horaSalida.length < 5) {
            Alert.alert("Hora incompleta", "Por favor ingresa las horas en formato HH:mm");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                tallerId: tallerId === 'otro' ? 0 : tallerId,
                nombreTallerNuevo: tallerId === 'otro' ? nombreTallerNuevo : null,
                horaLlegada: `${horaLlegada.trim()} ${periodoLlegada}`,
                horaSalida: `${horaSalida.trim()} ${periodoSalida}`,
                ordenProduccion,
                numeroRemision,
                cantidadProducir: parseFloat(cantidadProducir) || 0,
                cantidadEvaluada: parseFloat(cantidadEvaluada) || 0,
                estadoProceso,
                tieneMuestra,
                tipoProducto,
                conoceFormaEmpaque,
                tieneRemision,
                tieneInsumosCompletos,
                variacionTono,
                quebradoArrugado,
                esquinaDefectuosa,
                presenciaPestanas,
                desgasteImpresion,
                manchas,
                reservaPega,
                grafadoRoto,
                novedadBPM,
                usaCofia,
                insumosPendientes,
                tipoInsumosPendientes,
                observaciones,
                fotoVariacionTonoBase64: (photos['variacionTono'] || []).join('|||'),
                fotoQuebradoArrugadoBase64: (photos['quebradoArrugado'] || []).join('|||'),
                fotoEsquinaDefectuosaBase64: (photos['esquinaDefectuosa'] || []).join('|||'),
                fotoPresenciaPestanasBase64: (photos['presenciaPestanas'] || []).join('|||'),
                fotoDesgasteImpresionBase64: (photos['desgasteImpresion'] || []).join('|||'),
                fotoManchasBase64: (photos['manchas'] || []).join('|||'),
                fotoReservaPegaBase64: (photos['reservaPega'] || []).join('|||'),
                fotoGrafadoRotoBase64: (photos['grafadoRoto'] || []).join('|||'),
                fotoNovedadBPMBase64: (photos['novedadBPM'] || []).join('|||'),
                fotoUsaCofiaBase64: (photos['usaCofia'] || []).join('|||'),
                fotoInsumosPendientesBase64: (photos['insumosPendientes'] || []).join('|||')
            };

            if (editingId) await api.put('/CalidadTalleres/' + editingId, payload); else await api.post('/CalidadTalleres', payload);
            Alert.alert("Éxito", "Encuesta guardada correctamente.");
            resetForm();
            setView('history');
            loadInitialData();
        } catch (error) {
            console.error("Error saving encuesta", error);
            Alert.alert("Error", "No se pudo guardar la encuesta.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: number) => {
        const performDelete = async () => {
            try {
                await api.delete('/CalidadTalleres/' + id);
                Alert.alert("Éxito", "Encuesta eliminada.");
                loadInitialData();
            } catch(e) {
                console.error(e);
                Alert.alert("Error", "No se pudo eliminar.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Estás seguro de eliminar esta toma de calidad?')) performDelete();
        } else {
            Alert.alert("Confirmar", "¿Estás seguro de eliminar esta toma de calidad?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: performDelete }
            ]);
        }
    };

    const handleEdit = async (id: number) => {
        try {
            setLoading(true);
            const res = await api.get('/CalidadTalleres/' + id);
            const data = res.data;
            if (!data) return;

            setEditingId(data.id);
            setTallerId(data.tallerId);
            setNombreTallerNuevo(data.nombreTallerNuevo || '');

            if (data.horaLlegada) {
                const parts = data.horaLlegada.split(' ');
                setHoraLlegada(parts[0]);
                setPeriodoLlegada(parts[1] || 'AM');
            }
            if (data.horaSalida) {
                const parts = data.horaSalida.split(' ');
                setHoraSalida(parts[0]);
                setPeriodoSalida(parts[1] || 'PM');
            }

            setOrdenProduccion(data.ordenProduccion || '');
            setNumeroRemision(data.numeroRemision || '');
            setCantidadProducir(data.cantidadProducir?.toString() || '0');
            setCantidadEvaluada(data.cantidadEvaluada?.toString() || '0');
            setEstadoProceso(data.estadoProceso || '');

            setTieneMuestra(data.tieneMuestra);
            setTipoProducto(data.tipoProducto || '');
            setConoceFormaEmpaque(data.conoceFormaEmpaque);
            setTieneRemision(data.tieneRemision);
            setTieneInsumosCompletos(data.tieneInsumosCompletos);

            setVariacionTono(data.variacionTono);
            setQuebradoArrugado(data.quebradoArrugado);
            setEsquinaDefectuosa(data.esquinaDefectuosa);
            setPresenciaPestanas(data.presenciaPestanas);
            setDesgasteImpresion(data.desgasteImpresion);
            setManchas(data.manchas);
            setReservaPega(data.reservaPega);
            setGrafadoRoto(data.grafadoRoto);

            setNovedadBPM(data.novedadBPM);
            setUsaCofia(data.usaCofia);
            setInsumosPendientes(data.insumosPendientes);
            setTipoInsumosPendientes(data.tipoInsumosPendientes || 'Ninguno');
            setObservaciones(data.observaciones || '');

            // Helper: split photos supporting both new '|||' and legacy ';' separator
            const splitPhotos = (str: string | null | undefined): string[] => {
                if (!str) return [];
                // If contains '|||' use that, otherwise fall back to ';'
                const sep = str.includes('|||') ? '|||' : ';';
                return str.split(sep).map(s => s.trim()).filter(Boolean);
            };

            setPhotos({
                variacionTono: splitPhotos(data.fotoVariacionTono),
                quebradoArrugado: splitPhotos(data.fotoQuebradoArrugado),
                esquinaDefectuosa: splitPhotos(data.fotoEsquinaDefectuosa),
                presenciaPestanas: splitPhotos(data.fotoPresenciaPestanas),
                desgasteImpresion: splitPhotos(data.fotoDesgasteImpresion),
                manchas: splitPhotos(data.fotoManchas),
                reservaPega: splitPhotos(data.fotoReservaPega),
                grafadoRoto: splitPhotos(data.fotoGrafadoRoto),
                novedadBPM: splitPhotos(data.fotoNovedadBPM),
                usaCofia: splitPhotos(data.fotoUsaCofia),
                insumosPendientes: splitPhotos(data.fotoInsumosPendientes),
            });


            setView('form');
        } catch(e) {
            console.error(e);
            Alert.alert("Error", "No se pudo cargar la encuesta.");
        } finally {
            setLoading(false);
        }
    };

    const renderHistoryItem = ({ item }: { item: any }) => (
        <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
                <View style={styles.historyOP}>
                    <Text style={styles.historyOPLabel}>OP</Text>
                    <Text style={styles.historyOPValue}>{item.ordenProduccion || 'S/N'}</Text>
                </View>
                <View style={[styles.estadoPill, { backgroundColor: item.estadoProceso === 'Finalizado' ? '#10B981' : '#F59E0B' }]}>
                    <Text style={styles.estadoPillText}>{item.estadoProceso || 'Pendiente'}</Text>
                </View>
            </View>
            <View style={styles.historyBody}>
                <View style={{flex: 1}}>
                    <View style={styles.historyRow}>
                        <Text style={styles.historyIcon}>🏭</Text>
                        <Text style={styles.historyText}>{item.tallerNombre}</Text>
                    </View>
                    <View style={styles.historyRow}>
                        <Text style={styles.historyIcon}>🕵️</Text>
                        <Text style={styles.historyText}>{item.inspector}</Text>
                    </View>
                    <View style={styles.historyRow}>
                        <Text style={styles.historyIcon}>🕒</Text>
                        <Text style={styles.historyText}>{new Date(item.fechaCreacion).toLocaleString()}</Text>
                    </View>
                </View>
                <View style={styles.historyActions}>
                    <TouchableOpacity style={styles.actionBtnEdit} onPress={() => handleEdit(item.id)}>
                        <Text style={styles.actionBtnIcon}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnDelete} onPress={() => handleDelete(item.id)}>
                        <Text style={styles.actionBtnIcon}>🗑️</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    if (view === 'form') {
        return (
            <View style={styles.container}>
                {/* Fullscreen image overlay */}
                {enlargedImage && (
                    <TouchableOpacity
                        style={styles.enlargedOverlay}
                        onPress={closeImage}
                        activeOpacity={1}
                    >
                        <Image source={{ uri: enlargedImage }} style={styles.enlargedImage} resizeMode="contain" />
                        <Text style={styles.enlargedClose}>✕ Cerrar</Text>
                    </TouchableOpacity>
                )}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerBackBtn} onPress={() => setView('history')}>
                        <Text style={styles.headerBackText}>← Volver</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{editingId ? 'Editar Toma de Calidad' : 'Nueva Toma de Calidad'}</Text>
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.formContainer}>
                    <SectionCard title="Identificación del Taller" icon="🏬">
                        <FormField label="Nombre del Taller Externo" required>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={tallerId}
                                    onValueChange={(val) => setTallerId(val)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="-- Seleccionar --" value={null} />
                                    {talleres.map(t => (
                                        <Picker.Item key={t.id} label={t.nombre} value={t.id} />
                                    ))}
                                    <Picker.Item label="+ OTRO (Ingresar nuevo)" value="otro" color="#1E40AF" />
                                </Picker>
                            </View>
                        </FormField>

                        {tallerId === 'otro' && (
                            <FormField label="Especifique el nombre del Taller" required>
                                <TextInput
                                    style={styles.input}
                                    value={nombreTallerNuevo}
                                    onChangeText={setNombreTallerNuevo}
                                    placeholder="Nombre del nuevo taller..."
                                    autoCapitalize="characters"
                                />
                            </FormField>
                        )}
                    </SectionCard>

                    <SectionCard title="Tiempos y Logística" icon="⏱️">
                        <FormField label="Hora Llegada" required>
                            <View style={styles.timeInputContainer}>
                                <TextInput
                                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                    value={horaLlegada}
                                    onChangeText={(text) => setHoraLlegada(formatTimeInput(text))}
                                    placeholder="HH:mm"
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                                <TouchableOpacity
                                    style={styles.periodToggle}
                                    onPress={() => setPeriodoLlegada(p => p === 'AM' ? 'PM' : 'AM')}
                                >
                                    <Text style={styles.periodToggleText}>{periodoLlegada}</Text>
                                </TouchableOpacity>
                            </View>
                        </FormField>

                        <FormField label="Hora Salida" required>
                            <View style={styles.timeInputContainer}>
                                <TextInput
                                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                    value={horaSalida}
                                    onChangeText={(text) => setHoraSalida(formatTimeInput(text))}
                                    placeholder="HH:mm"
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                                <TouchableOpacity
                                    style={styles.periodToggle}
                                    onPress={() => setPeriodoSalida(p => p === 'AM' ? 'PM' : 'AM')}
                                >
                                    <Text style={styles.periodToggleText}>{periodoSalida}</Text>
                                </TouchableOpacity>
                            </View>
                        </FormField>
                    </SectionCard>

                    <SectionCard title="Requerimientos Iniciales" icon="📋">
                        <FormField label="Tiene Muestra del producto a elaborar" required>
                            <ChoiceField value={tieneMuestra} onSelect={setTieneMuestra} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>

                        <FormField label="TIPO DE PRODUCTO ELABORADO">
                            <View style={styles.pickerWrapper}>
                                <Picker selectedValue={tipoProducto} onValueChange={setTipoProducto} style={styles.picker}>
                                    <Picker.Item label="-- Elegir --" value="" />
                                    <Picker.Item label="BOLSAS" value="BOLSAS" />
                                    <Picker.Item label="PLEGADIZA LINEAL" value="PLEGADIZA LINEAL" />
                                    <Picker.Item label="PLEGADIZA LINEAL + AUTOMATICO" value="PLEGADIZA LINEAL + AUTOMATICO" />
                                    <Picker.Item label="PLEGADIZA LINEAL + AUTOMATICO+VENTANILLA" value="PLEGADIZA LINEAL + AUTOMATICO+VENTANILLA" />
                                    <Picker.Item label="PLEGADIZA 04 PUNTAS" value="PLEGADIZA 04 PUNTAS" />
                                    <Picker.Item label="PLEGADIZA 06 PUNTAS" value="PLEGADIZA 06 PUNTAS" />
                                </Picker>
                            </View>
                        </FormField>

                        <FormField label="Conoce la forma de empaque ?" required>
                            <ChoiceField value={conoceFormaEmpaque} onSelect={setConoceFormaEmpaque} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>

                        <FormField label="Tiene remisión del producto a elaborar ?" required>
                            <ChoiceField value={tieneRemision} onSelect={setTieneRemision} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>

                        <FormField label="Tiene insumos completo para elaborar el producto ?" required>
                            <ChoiceField value={tieneInsumosCompletos} onSelect={setTieneInsumosCompletos} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>
                    </SectionCard>

                    <SectionCard title="Datos de Producción" icon="📦">
                        <FormField label="Número de Orden de Producción" required>
                            <TextInput
                                style={styles.input}
                                value={ordenProduccion}
                                onChangeText={setOrdenProduccion}
                                placeholder="Ej: OP-123456"
                            />
                        </FormField>
                        <FormField label="Número de Remisión" required>
                            <TextInput
                                style={styles.input}
                                value={numeroRemision}
                                onChangeText={setNumeroRemision}
                                placeholder="Ej: REM-789"
                            />
                        </FormField>
                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <FormField label="Cantidad a Producir" required>
                                    <TextInput
                                        style={styles.input}
                                        value={cantidadProducir}
                                        onChangeText={setCantidadProducir}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </FormField>
                            </View>
                            <View style={styles.halfField}>
                                <FormField label="Cantidad Evaluada" required>
                                    <TextInput
                                        style={styles.input}
                                        value={cantidadEvaluada}
                                        onChangeText={setCantidadEvaluada}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </FormField>
                            </View>
                        </View>
                    </SectionCard>

                    <SectionCard title="Puntos Criticos de Calidad" icon="">
                        <FormField label="Variacion de Tono">
                            <ChoiceField value={variacionTono} onSelect={setVariacionTono} options={['SI', 'NO']} photos={photos['variacionTono'] || []} onTakePhoto={(s: string) => handlePhotoPress('variacionTono', s)} onRemovePhoto={(idx: number) => removePhoto('variacionTono', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Quebrado o arrugado">
                            <ChoiceField value={quebradoArrugado} onSelect={setQuebradoArrugado} options={['SI', 'NO']} photos={photos['quebradoArrugado'] || []} onTakePhoto={(s: string) => handlePhotoPress('quebradoArrugado', s)} onRemovePhoto={(idx: number) => removePhoto('quebradoArrugado', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Esquina defectuosa">
                            <ChoiceField value={esquinaDefectuosa} onSelect={setEsquinaDefectuosa} options={['SI', 'NO']} photos={photos['esquinaDefectuosa'] || []} onTakePhoto={(s: string) => handlePhotoPress('esquinaDefectuosa', s)} onRemovePhoto={(idx: number) => removePhoto('esquinaDefectuosa', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Presencia de PESTANAS">
                            <ChoiceField value={presenciaPestanas} onSelect={setPresenciaPestanas} options={['SI', 'NO']} photos={photos['presenciaPestanas'] || []} onTakePhoto={(s: string) => handlePhotoPress('presenciaPestanas', s)} onRemovePhoto={(idx: number) => removePhoto('presenciaPestanas', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Desgaste de la impresion por roce o friccion">
                            <ChoiceField value={desgasteImpresion} onSelect={setDesgasteImpresion} options={['SI', 'NO']} photos={photos['desgasteImpresion'] || []} onTakePhoto={(s: string) => handlePhotoPress('desgasteImpresion', s)} onRemovePhoto={(idx: number) => removePhoto('desgasteImpresion', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Manchas">
                            <ChoiceField value={manchas} onSelect={setManchas} options={['SI', 'NO']} photos={photos['manchas'] || []} onTakePhoto={(s: string) => handlePhotoPress('manchas', s)} onRemovePhoto={(idx: number) => removePhoto('manchas', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Reserva para pega">
                            <ChoiceField value={reservaPega} onSelect={setReservaPega} options={['SI', 'NO']} photos={photos['reservaPega'] || []} onTakePhoto={(s: string) => handlePhotoPress('reservaPega', s)} onRemovePhoto={(idx: number) => removePhoto('reservaPega', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Grafado roto y/o falta de corte">
                            <ChoiceField value={grafadoRoto} onSelect={setGrafadoRoto} options={['SI', 'NO']} photos={photos['grafadoRoto'] || []} onTakePhoto={(s: string) => handlePhotoPress('grafadoRoto', s)} onRemovePhoto={(idx: number) => removePhoto('grafadoRoto', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                    </SectionCard>

                    <SectionCard title="Higiene y Logistica" icon="">
                        <FormField label="Tiene novedad en BPM ?" required>
                            <ChoiceField value={novedadBPM} onSelect={setNovedadBPM} options={['SI', 'NO']} photos={photos['novedadBPM'] || []} onTakePhoto={(s: string) => handlePhotoPress('novedadBPM', s)} onRemovePhoto={(idx: number) => removePhoto('novedadBPM', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="La persona usa cofia ?" required>
                            <ChoiceField value={usaCofia} onSelect={setUsaCofia} options={['SI', 'NO']} photos={photos['usaCofia'] || []} onTakePhoto={(s: string) => handlePhotoPress('usaCofia', s)} onRemovePhoto={(idx: number) => removePhoto('usaCofia', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        <FormField label="Insumos pendientes x recoger en taller?" required>
                            <ChoiceField value={insumosPendientes} onSelect={setInsumosPendientes} options={['SI', 'NO']} photos={photos['insumosPendientes'] || []} onTakePhoto={(s: string) => handlePhotoPress('insumosPendientes', s)} onRemovePhoto={(idx: number) => removePhoto('insumosPendientes', idx)} onEnlargePhoto={openImage} />
                        </FormField>
                        {insumosPendientes && (
                            <FormField label="Tipo de Insumos pendientes x recoger" required>
                                <View style={styles.pickerWrapper}>
                                    <Picker selectedValue={tipoInsumosPendientes} onValueChange={setTipoInsumosPendientes} style={styles.picker}>
                                        <Picker.Item label="Goma" value="Goma" />
                                        <Picker.Item label="Cajas" value="Cajas" />
                                        <Picker.Item label="Strech" value="Strech" />
                                        <Picker.Item label="Ninguno" value="Ninguno" />
                                    </Picker>
                                </View>
                            </FormField>
                        )}
                    </SectionCard>

                    <SectionCard title="Finalización" icon="🏁">
                        <FormField label="Estado del Proceso" required>
                            <View style={styles.pickerWrapper}>
                                <Picker selectedValue={estadoProceso} onValueChange={(val) => setEstadoProceso(val)} style={styles.picker}>
                                    <Picker.Item label="-- Elegir --" value="" />
                                    <Picker.Item label="Iniciando proceso" value="Iniciando proceso" />
                                    <Picker.Item label="En proceso bolsas armadas" value="En proceso bolsas armadas" />
                                    <Picker.Item label="Finalizado" value="Finalizado" />
                                </Picker>
                            </View>
                        </FormField>

                        <FormField label="Observación del proceso">
                            <TextInput
                                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                                value={observaciones}
                                onChangeText={setObservaciones}
                                placeholder="Tu respuesta..."
                                multiline
                            />
                        </FormField>
                    </SectionCard>

                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text style={styles.saveBtnIcon}>💾</Text>
                                <Text style={styles.saveBtnText}>Guardar Registro</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Encuestas Calidad - Talleres</Text>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => {
                    if (Platform.OS === 'web') {
                        const confirmed = window.confirm('Desea cerrar sesion?');
                        if (confirmed) {
                            removeToken().then(() => {
                                if (onLogout) onLogout();
                                window.location.reload();
                            });
                        }
                    } else {
                        Alert.alert('Cerrar Sesion', 'Desea cerrar sesion?', [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Salir', onPress: () => removeToken().then(() => onLogout()) }
                        ]);
                    }
                }}>
                    <Text style={styles.logoutBtnText}>Cerrar Sesion</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newBtn} onPress={() => { setView('form'); resetForm(); }}>
                <Text style={styles.newBtnIcon}>+</Text>
                <Text style={styles.newBtnText}>Nueva Toma de Calidad</Text>
            </TouchableOpacity>

            <Text style={styles.listTitle}>📋 Historial ({username})</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 50 }} />
            ) : encuestas.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📝</Text>
                    <Text style={styles.emptyText}>No hay registros hoy</Text>
                    <Text style={styles.emptySubtext}>Pulsa el botón verde para empezar</Text>
                </View>
            ) : (
                <FlatList
                    data={encuestas}
                    renderItem={renderHistoryItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInitialData} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    scrollView: { flex: 1 },
    header: { backgroundColor: '#96BDF0', paddingTop: 40, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    headerBackBtn: { marginRight: 15, backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    headerBackText: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
    headerTitle: { color: '#1F2937', fontSize: 18, fontWeight: 'bold', flex: 1 },
    logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
    logoutBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
    newBtn: { backgroundColor: '#10B981', margin: 16, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    newBtnIcon: { color: 'white', fontSize: 24, fontWeight: 'bold', marginRight: 8 },
    newBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    listTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 12, color: '#1F2937' },
    listContent: { paddingHorizontal: 16, paddingBottom: 20 },
    historyCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
    historyHeader: { backgroundColor: '#96BDF0', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyOP: { flexDirection: 'row', alignItems: 'center' },
    historyOPLabel: { backgroundColor: 'rgba(0,0,0,0.1)', color: '#1F2937', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    historyOPValue: { color: '#1F2937', fontSize: 16, fontWeight: 'bold' },
    estadoPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    estadoPillText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    historyBody: { padding: 14, flexDirection: 'row', alignItems: 'center' },
    historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    historyIcon: { fontSize: 16, marginRight: 10, width: 24 },
    historyText: { fontSize: 14, color: '#4B5563', flex: 1 },
    historyActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 10 },
    actionBtnEdit: { backgroundColor: '#3B82F6', padding: 8, borderRadius: 8, marginLeft: 10 },
    actionBtnDelete: { backgroundColor: '#EF4444', padding: 8, borderRadius: 8, marginLeft: 10 },
    actionBtnIcon: { fontSize: 16 },
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
    timeInputContainer: { flexDirection: 'row', alignItems: 'center' },
    periodToggle: { backgroundColor: '#F3F4F6', borderTopRightRadius: 12, borderBottomRightRadius: 12, borderWidth: 1.5, borderLeftWidth: 0, borderColor: '#D1D5DB', width: 60, height: 50, justifyContent: 'center', alignItems: 'center' },
    periodToggleText: { color: '#1E3A8A', fontWeight: 'bold', fontSize: 16 },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    saveBtn: { backgroundColor: '#10B981', padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    saveBtnDisabled: { backgroundColor: '#9CA3AF' },
    saveBtnIcon: { color: 'white', fontSize: 20, marginRight: 8 },
    saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

    // ChoiceField Styles
    choiceFieldContainer: { flexDirection: 'column', width: '100%' },
    choiceContainer: { borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', overflow: 'hidden', marginBottom: 8 },
    choiceOption: { padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'white' },
    choiceCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12 },
    choiceCircleActive: { borderColor: '#1E3A8A', backgroundColor: '#1E3A8A' },
    choiceOptionText: { fontSize: 15, color: '#374151', textTransform: 'uppercase' },
    choiceOptionTextActive: { color: '#1E3A8A', fontWeight: 'bold' },
    photosRowContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    photoBtnsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    addPhotoBtnCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DBEAFE', height: 60, borderRadius: 10, borderWidth: 1.5, borderColor: '#3B82F6' },
    addPhotoBtnGallery: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D1FAE5', height: 60, borderRadius: 10, borderWidth: 1.5, borderColor: '#10B981' },
    addPhotoIconLarge: { fontSize: 22 },
    addPhotoTextSmall: { fontSize: 9, fontWeight: '700', color: '#374151', marginTop: 2 },
    photoPreviewContainer: { position: 'relative', margin: 2 },
    photoPreview: { width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderColor: '#10B981' },
    removePhotoBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white', zIndex: 10 },
    removePhotoText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    // Enlarged image overlay
    enlargedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999, justifyContent: 'center', alignItems: 'center' },
    enlargedImage: { width: '95%', height: '80%' },
    enlargedClose: { color: 'white', marginTop: 16, fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
});
