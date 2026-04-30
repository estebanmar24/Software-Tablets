import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput, Modal, Image, Platform, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../services/productionApi';
import { getFileServerUrl, getApiBaseUrl } from '../services/apiConfig';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
// Eliminamos el SERVER_URL estático y usaremos un estado para cargarlo dinámicamente

type SubModule = 'HOJA_VIDA' | 'CRONOGRAMA' | 'TICKETS_DANOS' | 'MANTENIMIENTOS';

interface BitacoraEntry {
    id?: number;
    hojaVidaId: number;
    fecha: string;
    turno: string;
    descripcion: string;
    estadoMaquina: string;
    registradoPor: string;
    fechaRegistro?: string;
    consecutivo?: number;
    resuelto?: boolean;
}

interface MantenimientoEntry {
    id?: number;
    hojaVidaId: number;
    consecutivo?: number;
    fecha: string;
    tipo: string;
    ejecutadoPor: string;
    tipoPersonal: string; // Interno o Externo
    ticketId?: number;
    observacion: string;
    fotos?: { id?: number; url: string }[];
}

interface HojaVida {
    id?: number;
    nombre: string;
    numeroInventario: string;
    marca: string;
    serie: string;
    modelo: string;
    color: string;
    fechaCompra?: string;
    vidaUtil: string;
    proceso?: string;
    ubicacion?: string;
    voltaje?: string;
    corriente?: string;
    potencia?: string;
    dimensiones?: string;
    peso?: string;
    otroTecnico?: string;
    fotoUrl: string;
    eppsYRiesgos: string;
    senalizacion: string;
    riesgosAsociados: string;
    codigoFormato: string;
    versionFormato: string;
    mantenimientos?: any[];
    fotos?: { id?: number; url: string }[];
}


const FormInput = ({ label, value, onChangeText, placeholder, multiline = false, colors, isDarkMode, styles }: any) => (
    <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <TextInput
            style={[
                styles.input, 
                { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border },
                multiline && { height: 80, textAlignVertical: 'top' }
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.subText}
            multiline={multiline}
        />
    </View>
);

const SERVER_URL = (api.defaults.baseURL && api.defaults.baseURL.includes('http')) 
    ? api.defaults.baseURL.split('/api')[0] 
    : (typeof window !== 'undefined' ? window.location.origin : '');

export default function MaquinasScreen({ onBack, publicId, publicMode }: { onBack?: () => void; publicId?: number; publicMode?: boolean }) {
    const { colors, isDarkMode } = useTheme();
    const styles = getStyles(isDarkMode, colors);

    const [activeTab, setActiveTab] = useState<SubModule>(publicMode ? 'HOJA_VIDA' : 'HOJA_VIDA');
    const [hojasVida, setHojasVida] = useState<HojaVida[]>([]);
    const [bitacoras, setBitacoras] = useState<BitacoraEntry[]>([]);
    const [mantenimientos, setMantenimientos] = useState<MantenimientoEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [selectedMaqName, setSelectedMaqName] = useState('');
    const [selectedMaqId, setSelectedMaqId] = useState<number | null>(null);
    const [bitacoraModalVisible, setBitacoraModalVisible] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfReadyUrl, setPdfReadyUrl] = useState<string | null>(null);
    const [isEditingBitacora, setIsEditingBitacora] = useState(false);
    
    // ScrollView ref for machine tabs
    const maqScrollRef = useRef<ScrollView>(null);
    const maqScrollX = useRef(0);

    // Cronograma States
    const [cronogramaActividades, setCronogramaActividades] = useState<any[]>([]);
    const [cronogramaRegistros, setCronogramaRegistros] = useState<any[]>([]);
    const [selectedCronogramaMaq, setSelectedCronogramaMaq] = useState<HojaVida | null>(null);
    const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());
    const [newActividadNombre, setNewActividadNombre] = useState('');
    const [newActividadTipo, setNewActividadTipo] = useState('preventivo');
    const [loadingCronograma, setLoadingCronograma] = useState(false);
    const [selectedMesCronograma, setSelectedMesCronograma] = useState<number | null>(null); // 1-12
    const [cronogramaSemanaOffset, setCronogramaSemanaOffset] = useState(0); 
    const [statusPicker, setStatusPicker] = useState<{ actId: number, mes: number, dia: number } | null>(null);
    const [selectedActsForMantenimiento, setSelectedActsForMantenimiento] = useState<number[]>([]);
    const [actModalVisible, setActModalVisible] = useState(false);
    const [editingAct, setEditingAct] = useState<any>(null);
    const [mantenimientoModalVisible, setMantenimientoModalVisible] = useState(false);
    const [isEditingMantenimiento, setIsEditingMantenimiento] = useState(false);
    const [mantenimientoForm, setMantenimientoForm] = useState<MantenimientoEntry>({
        hojaVidaId: 0,
        fecha: new Date().toISOString(),
        tipo: 'Preventivo',
        ejecutadoPor: '',
        tipoPersonal: 'Interno',
        ticketId: undefined,
        observacion: '',
        fotos: []
    });
    const [bitacoraForm, setBitacoraForm] = useState<BitacoraEntry>({
        hojaVidaId: 0,
        fecha: new Date().toISOString(),
        turno: 'Mañana',
        descripcion: '',
        estadoMaquina: 'Operativa',
        registradoPor: ''
    });

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageModalVisible, setImageModalVisible] = useState(false);

    const openImage = (url: string) => {
        const fullUrl = url.startsWith('http') ? url : (SERVER_URL + url);
        setSelectedImage(fullUrl);
        setImageModalVisible(true);
    };

    const loadMantenimientos = async () => {
        if (publicMode) return;
        try {
            const resp = await api.get('MantenimientosMaquinas');
            setMantenimientos(resp.data);
        } catch (error) {
            console.error("Error cargando mantenimientos:", error);
        }
    };

    useEffect(() => {
        // Bloqueamos la carga de datos privados si estamos en el modo QR público
        if (!publicMode) {
            loadHojasVida();
            loadBitacoras();
            loadMantenimientos();
        }
    }, [publicMode]);

    useEffect(() => {
        if (publicMode && publicId) {
            handlePublicDownload(publicId);
        }
    }, [publicMode, publicId]);

    const pickMantenimientoImage = async (useCamera: boolean = false) => {
        try {
            const { status } = useCamera 
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert("Permiso denegado", "Se requieren permisos para añadir fotos.");
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
                : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });

            if (!result.canceled && result.assets && result.assets[0].uri) {
                setUploadingImage(true);
                const uri = result.assets[0].uri;
                const fileName = uri.split('/').pop() || 'upload.jpg';
                
                const url = await uploadFoto(uri, fileName);

                if (url) {
                    const newFoto = { url: url };
                    setMantenimientoForm(prev => ({
                        ...prev,
                        fotos: [...(prev.fotos || []), newFoto]
                    }));
                }
            }
        } catch (error) {
            console.error("Upload Error", error);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveMantenimiento = async () => {
        if (mantenimientoForm.hojaVidaId === 0 || !mantenimientoForm.ejecutadoPor) {
            Alert.alert("Error", "Debe seleccionar una máquina y el responsable.");
            return;
        }

        setSaving(true);
        try {
            // Preparamos el objeto para que coincida con el modelo de C#
            const payload = {
                id: mantenimientoForm.id || 0,
                hojaVidaId: mantenimientoForm.hojaVidaId,
                consecutivo: mantenimientoForm.consecutivo || 0,
                ticketId: mantenimientoForm.ticketId || null,
                tipoPersonal: mantenimientoForm.tipoPersonal || 'Interno',
                fecha: new Date().toISOString(),
                tipoMantenimiento: mantenimientoForm.tipo,
                ejecutadoPor: mantenimientoForm.ejecutadoPor,
                observacion: `${mantenimientoForm.observacion}\n\nActividades realizadas:\n${cronogramaActividades.filter(a => selectedActsForMantenimiento.includes(a.id)).map(a => `- ${a.operacion}`).join('\n')}`.trim(),
                fotos: mantenimientoForm.fotos?.map(f => ({ url: f.url })) || []
            };

            if (isEditingMantenimiento && mantenimientoForm.id) {
                await api.put(`MantenimientosMaquinas/${mantenimientoForm.id}`, payload);
            } else {
                await api.post('MantenimientosMaquinas', payload);
            }

            // --- SINCRONIZACIÓN AUTOMÁTICA CON CRONOGRAMA ---
            if (selectedActsForMantenimiento.length > 0) {
                const now = new Date();
                const d = now.getDate();
                const m = now.getMonth() + 1;
                const a = now.getFullYear();

                try {
                    await Promise.all(selectedActsForMantenimiento.map(actId => 
                        api.post('Cronogramas/ToggleStatus', {
                            hojaVidaId: Number(mantenimientoForm.hojaVidaId),
                            actividadId: Number(actId),
                            anio: a,
                            mes: m,
                            dia: d,
                            estado: 1 // EJECUTADO
                        }).catch(e => console.error("Error sincronizando actividad:", e))
                    ));

                    // Recargar cronograma si es la misma máquina y año
                    if (selectedCronogramaMaq?.id === mantenimientoForm.hojaVidaId && selectedAnio === a) {
                        loadCronogramaData(mantenimientoForm.hojaVidaId, a);
                    }
                } catch (syncErr) {
                    console.error("Sync Error", syncErr);
                }
            }

            Alert.alert("Éxito", "Mantenimiento guardado y sincronizado con cronograma.");
            setMantenimientoModalVisible(false);
            loadMantenimientos(); 
            loadBitacoras(); // Refrescar tickets para actualizar etiquetas de resuelto
            
            // Reset form and selections
            setSelectedActsForMantenimiento([]);
            setMantenimientoForm({
                hojaVidaId: 0,
                fecha: new Date().toISOString(),
                tipo: 'Preventivo',
                ejecutadoPor: '',
                observacion: '',
                fotos: []
            });
        } catch (error) {
            console.error("Error guardando mantenimiento:", error);
            Alert.alert("Error", "No se pudo guardar el registro en el servidor.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMantenimiento = (id: number) => {
        if (Platform.OS === 'web') {
            if (window.confirm("¿Estás seguro de borrar este registro?")) {
                (async () => {
                    try {
                        await api.delete(`MantenimientosMaquinas/${id}`);
                        loadMantenimientos();
                    } catch (error) {
                        alert("No se pudo eliminar el mantenimiento.");
                    }
                })();
            }
            return;
        }

        Alert.alert(
            "Eliminar Mantenimiento",
            "¿Estás seguro de borrar este registro?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Eliminar", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`MantenimientosMaquinas/${id}`);
                            loadMantenimientos();
                        } catch (error) {
                            Alert.alert("Error", "No se pudo eliminar.");
                        }
                    }
                }
            ]
        );
    };

    const [publicData, setPublicData] = useState<{ hoja: HojaVida, bitacoras: BitacoraEntry[] } | null>(null);

    const handlePublicDownload = async (id: number) => {
        setLoading(true);
        try {
            const endpoint = `PublicMaquinas/HojaVida/${id}`;
            const resp = await api.get(endpoint, {
                headers: { 
                    Authorization: '',
                    'Cache-Control': 'no-cache' 
                }
            });
            
            const hoja = resp.data.hojaVida || resp.data.HojaVida;
            const bitacoras = resp.data.bitacoras || resp.data.Bitacoras || [];

            if (!hoja) throw new Error("Máquina no encontrada");

            setPublicData({ hoja, bitacoras });
        } catch (error: any) {
            console.error("Public Download Error", error);
            Alert.alert("Error", "No se pudo cargar la información de la máquina.");
        } finally {
            setLoading(false);
        }
    };

    // Form State
    const [form, setForm] = useState<HojaVida>({
        nombre: '',
        numeroInventario: '',
        marca: '',
        serie: '',
        modelo: '',
        color: '',
        fechaCompra: new Date().toISOString(),
        vidaUtil: '',
        fotoUrl: '',
        eppsYRiesgos: '',
        senalizacion: '',
        riesgosAsociados: '',
        codigoFormato: 'FO-GM-001',
        versionFormato: '0',
        fotos: []
    });

    useEffect(() => {
        if (activeTab === 'HOJA_VIDA') {
            loadHojasVida();
        } else if (activeTab === 'CRONOGRAMA') {
            loadHojasVida();
            if (hojasVida.length > 0 && !selectedCronogramaMaq) {
                setSelectedCronogramaMaq(hojasVida[0]);
            }
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'CRONOGRAMA' && selectedCronogramaMaq) {
            loadCronogramaData(selectedCronogramaMaq.id, selectedAnio);
        }
    }, [selectedCronogramaMaq, selectedAnio, activeTab]);

    const loadCronogramaData = async (maquinaId: number, anio: number) => {
        setLoadingCronograma(true);
        try {
            const resp = await api.get(`Cronogramas/FullData`, { params: { maquinaId, anio } });
            setCronogramaActividades(resp.data.actividades);
            setCronogramaRegistros(resp.data.registros);
        } catch (error) {
            console.error("Error cargando cronograma:", error);
        } finally {
            setLoadingCronograma(false);
        }
    };

    const toggleCronogramaStatus = async (actividadId: number, mes: number, dia: number = 0, forcedStatus?: number) => {
        if (!selectedCronogramaMaq) return;
        try {
            const reg = cronogramaRegistros.find(r => 
                (Number(r.actividadId || r.ActividadId) === actividadId) && 
                Number(r.mes) === mes && Number(r.dia || r.Dia) === dia && 
                (r.anio === selectedAnio || r.Anio === selectedAnio)
            );

            let newEstado = 1;
            if (forcedStatus !== undefined) {
                newEstado = forcedStatus;
            } else if (reg) {
                newEstado = (reg.estado % 5) + 1;
            }

            await api.post('Cronogramas/ToggleStatus', {
                hojaVidaId: Number(selectedCronogramaMaq.id),
                actividadId: Number(actividadId),
                anio: Number(selectedAnio),
                mes: Number(mes),
                dia: Number(dia),
                estado: newEstado
            });
            loadCronogramaData(selectedCronogramaMaq.id, selectedAnio);
        } catch (error) {
            console.error("Error al cambiar estado:", error);
        }
    };

    const handleAddActividad = async () => {
        if (!newActividadNombre.trim()) return;
        try {
            const payload = { 
                operacion: newActividadNombre.trim(),
                categoria: "General",
                tipoMantenimiento: newActividadTipo,
                activo: true
            };
            await api.post('Cronogramas/Actividad', payload);
            setNewActividadNombre('');
            
            // Forzar recarga inmediata
            if (selectedCronogramaMaq) {
                await loadCronogramaData(selectedCronogramaMaq.id, selectedAnio);
            }
        } catch (error: any) {
            console.error("Error añadiendo actividad:", error);
            Alert.alert("Error", "No se pudo guardar la actividad. Revisa la conexión al servidor.");
        }
    };

    const handleDeleteActividad = (id: number) => {
        const confirmar = window.confirm("¿Estás seguro de que deseas eliminar esta actividad del cronograma?");
        if (confirmar) {
            (async () => {
                try {
                    await api.delete(`Cronogramas/Actividad/${id}`);
                    if (selectedCronogramaMaq) loadCronogramaData(selectedCronogramaMaq.id, selectedAnio);
                } catch (error) {
                    console.error("Error borrando:", error);
                }
            })();
        }
    };

    const handleEditActividad = (act: any) => {
        setEditingAct({ ...act, tipoMantenimiento: act.tipoMantenimiento || 'preventivo' });
        setActModalVisible(true);
    };

    const handleSaveEditActividad = async () => {
        if (!editingAct || !editingAct.operacion.trim()) return;
        try {
            await api.put(`Cronogramas/Actividad/${editingAct.id}`, editingAct);
            setActModalVisible(false);
            if (selectedCronogramaMaq) loadCronogramaData(selectedCronogramaMaq.id, selectedAnio);
        } catch (error) {
            console.error("Error editando:", error);
            Alert.alert("Error", "No se pudo actualizar la actividad.");
        }
    };

    const loadHojasVida = async () => {
        if (publicMode) return;
        try {
            const resp = await api.get('HojaVidaMaquinas');
            setHojasVida(resp.data);
        } catch (error) {
            console.error("Error cargando hojas de vida:", error);
        }
    };

    const loadBitacoras = async () => {
        if (publicMode) return;
        try {
            const resp = await api.get('BitacorasMaquinas');
            setBitacoras(resp.data);
        } catch (error) {
            console.error("Error cargando bitácoras:", error);
        }
    };

    const loadUsuarios = async () => {
        if (publicMode) return;
        try {
            const resp = await api.get('usuarios');
            setUsuarios(resp.data);
        } catch (error) {
            console.error("Error cargando usuarios:", error);
        }
    };

    const handleSave = async () => {
        if (!form.nombre) {
            Alert.alert("Faltan datos", "El nombre de la máquina es obligatorio.");
            return;
        }

        setSaving(true);
        try {
            if (isEditing && form.id) {
                await api.put(`HojaVidaMaquinas/${form.id}`, form);
                Alert.alert("Éxito", "Hoja de vida actualizada correctamente.");
            } else {
                await api.post('HojaVidaMaquinas', form);
                Alert.alert("Éxito", "Hoja de vida creada correctamente.");
            }
            setModalVisible(false);
            loadHojasVida();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Ocurrió un error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBitacora = async () => {
        if (!bitacoraForm.hojaVidaId || !bitacoraForm.descripcion) {
            Alert.alert("Faltan datos", "Selecciona una máquina y escribe una descripción.");
            return;
        }

        setSaving(true);
        try {
            await api.post('BitacorasMaquinas', bitacoraForm);
            Alert.alert("Éxito", "Registro de bitácora guardado.");
            setBitacoraModalVisible(false);
            loadBitacoras();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo guardar la bitácora.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBitacora = (item: BitacoraEntry) => {
        if (Platform.OS === 'web') {
            if (window.confirm("¿Estás seguro de eliminar esta entrada de la bitácora?")) {
                (async () => {
                    try {
                        await api.delete(`BitacorasMaquinas/${item.id}`);
                        loadBitacoras();
                    } catch (error) {
                        alert("No se pudo eliminar el registro.");
                    }
                })();
            }
            return;
        }

        Alert.alert(
            "Eliminar Registro",
            "¿Estás seguro de eliminar esta entrada de la bitácora?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Eliminar", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`BitacorasMaquinas/${item.id}`);
                            loadBitacoras();
                        } catch (error) {
                            Alert.alert("Error", "No se pudo eliminar.");
                        }
                    }
                }
            ]
        );
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para subir fotos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0].uri) {
                uploadFile(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image', error);
        }
    };

    const uploadFoto = async (uri: string, fileName: string) => {
        try {
            const formData = new FormData();
            
            if (Platform.OS === 'web') {
                // En web, convertimos la URI (blob o base64) a un Blob real
                const response = await fetch(uri);
                const blob = await response.blob();
                formData.append('Archivo', blob, fileName);
            } else {
                // En nativo (celular)
                // @ts-ignore
                formData.append('Archivo', {
                    uri,
                    name: fileName,
                    type: 'image/jpeg'
                });
            }

            // IMPORTANTE: En Web no enviamos Content-Type manual para que el navegador ponga el boundary correcto
            const res = await api.post('HojaVidaMaquinas/upload-foto', formData);
            return res.data.url;
        } catch (error) {
            console.error("Error subiendo foto:", error);
            throw error;
        }
    };

    const uploadFile = async (uri: string) => {
        setUploadingImage(true);
        try {
            let filename = uri.split('/').pop() || 'photo.jpg';
            if (!filename.includes('.') || filename.length < 5) {
                filename = `foto_${Date.now()}.jpg`;
            }

            const url = await uploadFoto(uri, filename);

            const newFoto = { url: url };
            setForm(prev => ({
                ...prev,
                fotos: [...(prev.fotos || []), newFoto]
            }));

        } catch (error) {
            console.error('Error uploading photo', error);
            Alert.alert("Error", "No se pudo subir la foto.");
        } finally {
            setUploadingImage(false);
        }
    };

    const removeFoto = (index: number) => {
        setForm(prev => ({
            ...prev,
            fotos: (prev.fotos || []).filter((_, i) => i !== index)
        }));
    };

    const openEdit = (hoja: HojaVida) => {
        setForm({
            ...hoja,
            fotos: hoja.fotos || [],
            proceso: hoja.proceso || '',
            ubicacion: hoja.ubicacion || '',
            voltaje: hoja.voltaje || '',
            corriente: hoja.corriente || '',
            potencia: hoja.potencia || '',
            dimensiones: hoja.dimensiones || '',
            peso: hoja.peso || '',
            otroTecnico: hoja.otroTecnico || ''
        });
        setIsEditing(true);
        setModalVisible(true);
    };

    const openNew = () => {
        setForm({
            nombre: '',
            numeroInventario: '',
            marca: '',
            serie: '',
            modelo: '',
            color: '',
            fechaCompra: new Date().toISOString(),
            vidaUtil: '',
            proceso: '',
            ubicacion: '',
            voltaje: '',
            corriente: '',
            potencia: '',
            dimensiones: '',
            peso: '',
            otroTecnico: '',
            fotoUrl: '',
            eppsYRiesgos: '',
            senalizacion: '',
            riesgosAsociados: '',
            codigoFormato: 'FO-GM-001',
            versionFormato: '0',
            fotos: []
        });
        setIsEditing(false);
        setModalVisible(true);
    };

    const handleDelete = (item: HojaVida) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Estás seguro de que deseas eliminar la hoja de vida de "${item.nombre}"?`)) {
                (async () => {
                    try {
                        await api.delete(`HojaVidaMaquinas/${item.id}`);
                        loadHojasVida();
                    } catch (error) {
                        alert("No se pudo eliminar el registro.");
                    }
                })();
            }
            return;
        }

        Alert.alert(
            "Eliminar Hoja de Vida",
            `¿Estás seguro de que deseas eliminar la hoja de vida de "${item.nombre}"?`,
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Eliminar", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            await api.delete(`HojaVidaMaquinas/${item.id}`);
                            loadHojasVida();
                        } catch (error) {
                            Alert.alert("Error", "No se pudo eliminar el registro.");
                        }
                    }
                }
            ]
        );
    };

    const urlToBase64 = async (url: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new (window as any).Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch (e) {
                    resolve("");
                }
            };
            img.onerror = () => {
                // Si el método de imagen falla, intentamos fetch como último recurso
                fetch(url, { mode: 'cors' })
                    .then(r => r.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = () => resolve("");
                        reader.readAsDataURL(blob);
                    })
            };
            img.src = url;
        });
    };

    const handleExportTicketPdf = async (ticket: BitacoraEntry, machine: HojaVida) => {
        try {

            const doc = new jsPDF();
            const margin = 15;
            const tableWidth = 180;
            let currentY = 15;

            // Header Box
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(margin, currentY, tableWidth, 30);

            // Logo
            try {
                const logoUrl = window.location.origin + '/empresa-logo.jpeg';
                const logo64 = await urlToBase64(logoUrl);
                if (logo64) doc.addImage(logo64, 'JPEG', margin + 5, currentY + 3, 44, 24);
            } catch(e) {}

            doc.line(margin + 55, currentY, margin + 55, currentY + 30);
            doc.line(margin + 135, currentY, margin + 135, currentY + 30);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("REGISTRO DE NOVEDAD / DAÑO", margin + 95, currentY + 12, { align: 'center' });
            doc.setFontSize(14);
            const tNumber = ticket.consecutivo ?? ticket.Consecutivo ?? ticket.id ?? 0;
            doc.text(`TICKET #${tNumber}`, margin + 95, currentY + 22, { align: 'center' });

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text("Código: FO-GM-002", margin + 138, currentY + 10);
            doc.text("Versión: 1", margin + 138, currentY + 20);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, margin + 138, currentY + 28);

            currentY += 40;

            // Machine Info Table
            autoTable(doc, {
                startY: currentY,
                head: [['INFORMACIÓN DEL EQUIPO', 'DETALLES']],
                body: [
                    ['Nombre de Máquina', machine.nombre || 'N/A'],
                    ['Número de Inventario', machine.numeroInventario || 'N/A'],
                    ['Marca / Modelo', `${machine.marca || 'N/A'} / ${machine.modelo || 'N/A'}`],
                    ['Ubicación', machine.ubicacion || 'N/A']
                ],
                margin: { left: margin },
                tableWidth: tableWidth,
                theme: 'grid',
                headStyles: { fillColor: [80, 80, 80] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;

            // Ticket Details Table
            autoTable(doc, {
                startY: currentY,
                head: [['DATOS DEL REPORTE', 'VALOR']],
                body: [
                    ['Fecha y Hora Reporte', new Date(ticket.fecha).toLocaleString()],
                    ['Turno', ticket.turno],
                    ['Reportado Por', ticket.registradoPor || 'N/A'],
                    ['Estado de Máquina', ticket.estadoMaquina || 'N/A']
                ],
                margin: { left: margin },
                tableWidth: tableWidth,
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
            });

            currentY = (doc as any).lastAutoTable.finalY + 15;

            // Description Section
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("DESCRIPCIÓN DETALLADA DE LA NOVEDAD:", margin, currentY);
            currentY += 7;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            const splitDesc = doc.splitTextToSize(ticket.descripcion || "Sin descripción", tableWidth);
            doc.text(splitDesc, margin, currentY);
            
            currentY += (splitDesc.length * 6) + 20;

            // Signature Section
            if (currentY > 250) {
                doc.addPage();
                currentY = 30;
            }
            
            doc.line(margin, currentY, margin + 70, currentY);
            doc.setFontSize(9);
            doc.text("Firma de quien reporta", margin, currentY + 5);
            doc.text(ticket.registradoPor || "", margin, currentY + 10);

            doc.line(margin + 110, currentY, margin + 180, currentY);
            doc.text("Firma de Mantenimiento / Jefe de Área", margin + 110, currentY + 5);

            const pdfName = `Ticket_${ticket.consecutivo ?? ticket.id ?? 0}_${machine.nombre.replace(/ /g, '_')}.pdf`;
            doc.save(pdfName);
        } catch (error) {
            console.error("Error PDF Ticket:", error);
            Alert.alert("Error", "No se pudo generar el PDF del ticket.");
        }
    };

    const handleExportMaintenancePdf = async (maint: MantenimientoEntry, machine: HojaVida) => {
        const doc = new jsPDF();
        const logoB64 = await urlToBase64(window.location.origin + '/empresa-logo.jpeg');
        
        // Buscar ticket asociado si existe
        const ticketId = maint.ticketId || maint.TicketId;
        const associatedTicket = ticketId ? bitacoras.find(b => b.id === ticketId) : null;
        
        // --- CABECERA ---
        // Dibujar marco de cabecera
        doc.rect(10, 10, 190, 25); // Marco principal
        doc.line(45, 10, 45, 35); // Separador Logo
        doc.line(160, 10, 160, 35); // Separador Control
        
        // Logo
        if (logoB64) {
            doc.addImage(logoB64, 'JPEG', 12, 12, 30, 20);
        }
        
        // Título Central
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO", 102.5, 16, { align: 'center' });
        doc.setFontSize(12);
        doc.text("REGISTRO DE MANTENIMIENTO", 102.5, 23, { align: 'center' });
        doc.setFontSize(11);
        doc.text("ALEPH S.A.S", 102.5, 30, { align: 'center' });
        
        // Tabla de Control (Derecha)
        doc.setFontSize(8);
        doc.line(160, 16, 200, 16); // Línea 1
        doc.line(160, 22, 200, 22); // Línea 2
        doc.line(160, 28, 200, 28); // Línea 3
        
        doc.text("Codigo: SST-FT-", 162, 14);
        doc.text("Version: 02", 162, 20);
        doc.text("Fecha: 13/02/2026", 162, 26);
        doc.text("Pagina 1 de 1", 162, 32);

        // --- SECCIÓN: SOLICITUD DE MANTENIMIENTO ---
        doc.setFillColor(41, 73, 106); // Azul oscuro
        doc.rect(10, 35, 190, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text("SOLICITUD DE MANTENIMIENTO", 105, 40, { align: 'center' });
        
        doc.setTextColor(0, 0, 0);
        
        // Tabla de Solicitud (Datos del Ticket)
        const ticketDate = associatedTicket ? new Date(associatedTicket.fecha) : new Date(maint.fecha);
        const dia = ticketDate.getDate().toString().padStart(2, '0');
        const mes = (ticketDate.getMonth() + 1).toString().padStart(2, '0');
        const anio = ticketDate.getFullYear().toString();

        autoTable(doc, {
            startY: 42,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
            body: [
                [
                    { content: 'FECHA DE SOLICITUD DE MANTENIMIENTO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', cellWidth: 40 } },
                    { content: 'DIA', styles: { halign: 'center', cellWidth: 15 } },
                    { content: 'MES', styles: { halign: 'center', cellWidth: 15 } },
                    { content: 'AÑO', styles: { halign: 'center', cellWidth: 15 } },
                    { content: 'TIPO DE MANTENIMIENTO :', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { content: (maint.tipoMantenimiento || maint.tipo || '').toUpperCase(), styles: { halign: 'center', fontStyle: 'bold', cellWidth: 65 } }
                ],
                [
                    { content: dia, styles: { halign: 'center' } },
                    { content: mes, styles: { halign: 'center' } },
                    { content: anio, styles: { halign: 'center' } },
                    { content: ' ', colSpan: 2 } 
                ]
            ]
        });

        // Nombre del equipo y Descripción Inicial
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: 'linebreak' },
            body: [
                [
                    { content: 'NOMBRE DEL EQUIPO Y CODIGO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { content: `${machine.nombre} - ${machine.codigo || ''}`, styles: { cellWidth: 150 } }
                ],
                [
                    { content: 'DESCRIPCIÓN DE ESTADO INICIAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center' } }
                ],
                [
                    { content: associatedTicket?.descripcion || 'No se especificó descripción de ticket.', colSpan: 2, styles: { minHeight: 15 } }
                ],
                [
                    { content: 'NOMBRE O AREA QUIEN SOLICITA', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { content: (associatedTicket?.registradoPor || 'ÁREA TÉCNICA').toUpperCase(), styles: { cellWidth: 150 } }
                ]
            ]
        });

        // --- SECCIÓN: ORDEN DE TRABAJO DE MANTENIMIENTO ---
        doc.setFillColor(41, 73, 106);
        doc.rect(10, (doc as any).lastAutoTable.finalY, 190, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text("ORDEN DE TRABAJO DE MANTENIMIENTO", 105, (doc as any).lastAutoTable.finalY + 5, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        const maintDate = new Date(maint.fecha);
        const mDia = maintDate.getDate().toString().padStart(2, '0');
        const mMes = (maintDate.getMonth() + 1).toString().padStart(2, '0');
        const mAnio = maintDate.getFullYear().toString();

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 7,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
            body: [
                [
                    { content: 'FECHA DE REALIZACIÓN DEL MANTENIMIENTO', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', cellWidth: 40 } },
                    { content: 'DIA', styles: { halign: 'center', cellWidth: 15 } },
                    { content: 'MES', styles: { halign: 'center', cellWidth: 15 } },
                    { content: 'AÑO', styles: { halign: 'center', cellWidth: 15 } },
                    { content: 'REALIZADO POR:', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { content: (maint.ejecutadoPor || '').toUpperCase(), styles: { cellWidth: 65 } }
                ],
                [
                    { content: mDia, styles: { halign: 'center' } },
                    { content: mMes, styles: { halign: 'center' } },
                    { content: mAnio, styles: { halign: 'center' } },
                    { content: 'TIPO DE MANTENIMIENTO A EJECUTAR', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { content: (maint.tipoMantenimiento || maint.tipo || '').toUpperCase(), styles: { halign: 'center', fontStyle: 'bold', cellWidth: 65 } }
                ],
                [
                    { content: 'NOMBRE DEL EQUIPO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { content: machine.nombre.toUpperCase(), colSpan: 5 }
                ],
                [
                    { content: 'TIEMPO', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 40 } },
                    { 
                        content: (() => {
                            const dateStr = maint.fechaRegistro || maint.fecha;
                            const date = new Date(dateStr);
                            // Si la fecha viene de la DB en UTC, esto la convertirá a la local del navegador
                            return date.toLocaleString('es-CO', { 
                                year: 'numeric', 
                                month: 'numeric', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit',
                                hour12: true 
                            });
                        })(), 
                        colSpan: 5 
                    }
                ]
            ]
        });

        // Recursos Necesarios
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
            body: [
                [
                    { content: 'RECURSOS NECESARIOS', rowSpan: 2, styles: { fontStyle: 'bold', valign: 'middle', halign: 'center', cellWidth: 40 } },
                    { content: 'EQUIPOS', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 50 } },
                    { content: 'MATERIALES / HERRAMIENTAS', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 50 } },
                    { content: 'REPUESTOS', styles: { fontStyle: 'bold', halign: 'center', cellWidth: 50 } }
                ],
                [
                    { content: ' ', styles: { minHeight: 15 } },
                    { content: ' ' },
                    { content: ' ' }
                ],
                [
                    { content: 'DESCRIPCION DE LA ACTIVIDAD A EJECUTAR', colSpan: 4, styles: { fontStyle: 'bold', halign: 'center' } }
                ],
                [
                    { content: maint.observacion, colSpan: 4, styles: { minHeight: 40 } }
                ],
                [
                    { content: 'VALOR TOTAL DEL MANTENIMIENTO', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center' } },
                    { content: ' ', styles: { halign: 'right' } }
                ],
                [
                    { content: 'NOMBRE DE QUIEN RECIBE Y VERIFICA', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center' } },
                    { content: 'FIRMA DE QUIEN RECIBE Y VERIFICA', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center' } }
                ],
                [
                    { content: ' ', colSpan: 2, styles: { minHeight: 15 } },
                    { content: ' ', colSpan: 2 }
                ]
            ]
        });

        // --- Guardado / Descarga ---
        const filename = `Mantenimiento_${maint.consecutivo || maint.id}_${machine.nombre.replace(/ /g, '_')}.pdf`;
        if (Platform.OS === 'web') {
            const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
            if (isMobile) {
                doc.output('dataurlnewwindow');
            } else {
                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            }
        } else {
            doc.save(filename);
        }
    };

    const handleExportPdf = async (item: HojaVida, dataBitacoras?: BitacoraEntry[]) => {

        try {
            // Cargar Tickets (Bitácoras)
            let listTickets = dataBitacoras;
            if (!listTickets) {
                const resp = await api.get('BitacorasMaquinas', { params: { hojaVidaId: item.id } });
                listTickets = resp.data;
            }

            // Cargar Mantenimientos
            const mantenResp = await api.get('MantenimientosMaquinas', { params: { hojaVidaId: item.id } });
            const listMantenimientos = mantenResp.data;

            const doc = new jsPDF();
            const margin = 15;
            const tableWidth = 180;
            const pageHeight = doc.internal.pageSize.height;
            let currentY = 15;

            // Cargar Logo de la Empresa desde el servidor
            let logoBase64 = '';
            try {
                logoBase64 = await urlToBase64(SERVER_URL + "/empresa-logo.jpeg");
            } catch (e) {
                console.warn("No se pudo cargar el logo desde el servidor");
            }

            // Función para dibujar la cabecera exacta
            const drawFormatHeader = (pageNum: number) => {
                doc.setDrawColor(0);
                doc.setLineWidth(0.3);
                doc.setFont("helvetica", "bold");
                
                // Cuadro exterior
                doc.rect(margin, currentY, tableWidth, 30);

                // Insertar Logo si existe
                if (logoBase64) {
                    doc.addImage(logoBase64, 'JPEG', margin + 2, currentY + 2, 46, 26);
                }
                
                // Líneas verticales
                doc.line(margin + 50, currentY, margin + 50, currentY + 30);
                doc.line(margin + 125, currentY, margin + 125, currentY + 30);
                doc.line(margin + 145, currentY, margin + 145, currentY + 30);
                
                // Líneas horizontales sección derecha
                doc.line(margin + 125, currentY + 10, margin + 180, currentY + 10);
                doc.line(margin + 125, currentY + 20, margin + 180, currentY + 20);
                
                // Sección Central: Título
                doc.setFillColor(230, 230, 230);
                doc.rect(margin + 50, currentY, 75, 10, 'F');
                doc.rect(margin + 50, currentY, 75, 10, 'D');
                doc.setFontSize(10);
                doc.text("MANTENIMIENTO", margin + 87.5, currentY + 7, { align: 'center' });
                
                doc.setFontSize(8.5);
                doc.text("HOJA DE VIDA DE EQUIPOS Y", margin + 87.5, currentY + 17, { align: 'center' });
                doc.text("HERRAMIENTAS", margin + 87.5, currentY + 23, { align: 'center' });
                
                // Sección Derecha: Metadata
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.text("Código:", margin + 127, currentY + 7);
                doc.text("Versión:", margin + 127, currentY + 17);
                doc.text("Página:", margin + 127, currentY + 27);
                
                doc.text(item.codigoFormato || "FO-GM-001", margin + 147, currentY + 7);
                doc.text(item.versionFormato || "0", margin + 147, currentY + 17);
                // No escribimos el total aún, lo haremos al final
                doc.text(`${pageNum} de `, margin + 147, currentY + 27);
            };

            const checkNewPage = (needed: number) => {
                if (currentY + needed > pageHeight - 20) {
                    doc.addPage();
                    currentY = 15;
                    drawFormatHeader(doc.internal.pages.length - 1);
                    currentY += 35;
                    return true;
                }
                return false;
            };

            // --- INICIO DIBUJO ---
            drawFormatHeader(1);
            currentY += 35;

            // 1. TABLA INFORMACIÓN Y FOTO (Layout de una sola columna para más espacio)
            const rowH = 10; 
            const numRows = 10;
            const leftPartW = 100; // Ancho para etiquetas y valores
            const infoTableH = rowH * numRows;
            
            doc.rect(margin, currentY, tableWidth, infoTableH);
            doc.line(margin + leftPartW, currentY, margin + leftPartW, currentY + infoTableH);
            
            // Dibujar líneas horizontales en la parte izquierda
            for(let i=1; i < numRows; i++) {
                doc.line(margin, currentY + (i * rowH), margin + leftPartW, currentY + (i * rowH));
            }
            
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            const labels = [
                "Maquina:", "Inventario:", "Marca:", "Serie:", 
                "Modelo:", "Tipo:", "F. Compra:", "Vida Útil:", 
                "Proceso:", "Ubicación:"
            ];
            
            const values = [
                item.nombre || "",
                item.numeroInventario || "",
                item.marca || "",
                item.serie || "",
                item.modelo || "",
                item.tipo || "",
                item.fechaCompra ? new Date(item.fechaCompra).toLocaleDateString() : "",
                item.vidaUtil || "",
                item.proceso || "",
                item.ubicacion || ""
            ];

            // Helper para ajustar fuente dinámicamente y evitar solapamientos
            const drawAutoValue = (text: string, x: number, y: number, maxW: number) => {
                let size = 9;
                doc.setFontSize(size);
                doc.setFont("helvetica", "normal");
                while (doc.getTextWidth(text || "") > maxW && size > 5) {
                    size -= 0.3;
                    doc.setFontSize(size);
                }
                doc.text(text || "", x, y, { align: 'left' });
            };

            const xVal = margin + 20; 
            const wVal = leftPartW - 22; 

            labels.forEach((label, i) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.text(label, margin + 2, currentY + (i * rowH) + 6.5);
                drawAutoValue(values[i], xVal, currentY + (i * rowH) + 6.5, wVal);
            });
            
            doc.setFont("helvetica", "bold");
            doc.text("Fotografía", margin + leftPartW + (tableWidth - leftPartW)/2, currentY + 7, { align: 'center' });
            
            if (item.fotos && item.fotos.length > 0) {
                try {
                    const fullUrl = (item.fotos[0].url.startsWith('http') || item.fotos[0].url.startsWith('data')) 
                        ? item.fotos[0].url : SERVER_URL + item.fotos[0].url;
                    const b64 = await urlToBase64(fullUrl);
                    if (b64) {
                        doc.addImage(b64, 'JPEG', margin + leftPartW + 2, currentY + 12, (tableWidth - leftPartW) - 4, infoTableH - 16);
                    }
                } catch(e) {
                    console.warn("No se pudo cargar la foto de la máquina");
                }
            }
            currentY += infoTableH + 5;

            // 1.1 SECCIÓN FICHA TÉCNICA (NUEVA - SIEMPRE VISIBLE)
            checkNewPage(45);
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, currentY, tableWidth, 7, 'F');
            doc.rect(margin, currentY, tableWidth, 7, 'D');
            doc.setFont("helvetica", "bold");
            doc.text("FICHA TÉCNICA", margin + (tableWidth/2), currentY + 5, { align: 'center' });
            currentY += 7;
            
            const fichaH = 30;
            doc.rect(margin, currentY, tableWidth, fichaH);
            doc.line(margin + 60, currentY, margin + 60, currentY + fichaH);
            doc.line(margin + 120, currentY, margin + 120, currentY + fichaH);
            
            doc.setFontSize(8);
            // Columna 1: Voltaje y Corriente
            doc.setFont("helvetica", "bold"); doc.text("Voltaje:", margin + 2, currentY + 5);
            doc.setFont("helvetica", "normal"); doc.text(item.voltaje || 'N/A', margin + 20, currentY + 5);
            doc.setFont("helvetica", "bold"); doc.text("Corriente:", margin + 2, currentY + 13);
            doc.setFont("helvetica", "normal"); doc.text(item.corriente || 'N/A', margin + 20, currentY + 13);
            
            // Columna 2: Potencia y Peso
            doc.setFont("helvetica", "bold"); doc.text("Potencia:", margin + 62, currentY + 5);
            doc.setFont("helvetica", "normal"); doc.text(item.potencia || 'N/A', margin + 80, currentY + 5);
            doc.setFont("helvetica", "bold"); doc.text("Peso:", margin + 62, currentY + 13);
            doc.setFont("helvetica", "normal"); doc.text(item.peso || 'N/A', margin + 80, currentY + 13);
            
            // Columna 3: Dimensiones y Otros
            doc.setFont("helvetica", "bold"); doc.text("Dimensiones:", margin + 122, currentY + 5);
            doc.setFont("helvetica", "normal"); doc.text(item.dimensiones || 'N/A', margin + 145, currentY + 5);
            
            doc.setFont("helvetica", "bold"); doc.text("Otros:", margin + 122, currentY + 13);
            const otroText = doc.splitTextToSize(item.otroTecnico || 'N/A', 60);
            doc.text(otroText, margin + 122, currentY + 18);
            
            currentY += fichaH + 5;

            // 2. SECCIONES EPPS Y SEÑALIZACIÓN (LADO A LADO)
            checkNewPage(45);
            const halfWidth = tableWidth / 2;
            
            // Calculamos alturas dinámicas para que el cuadro sea uniforme
            const eppsLines = doc.splitTextToSize(item.eppsYRiesgos || "Sin datos", halfWidth - 10);
            const senaLines = doc.splitTextToSize(item.senalizacion || "Sin datos", halfWidth - 10);
            const combinedH = Math.max(35, Math.max(eppsLines.length, senaLines.length) * 5 + 15);
            
            // Dibujar Encabezados Lado a Lado
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, currentY, halfWidth, 7, 'F');
            doc.rect(margin, currentY, halfWidth, 7, 'D');
            doc.rect(margin + halfWidth, currentY, halfWidth, 7, 'F');
            doc.rect(margin + halfWidth, currentY, halfWidth, 7, 'D');
            
            doc.setFont("helvetica", "bold");
            doc.text("EPPS", margin + (halfWidth/2), currentY + 5, { align: 'center' });
            doc.text("SEÑALIZACION REQUERIDA", margin + halfWidth + (halfWidth/2), currentY + 5, { align: 'center' });
            
            currentY += 7;
            
            // Dibujar Contenidos Lado a Lado
            doc.rect(margin, currentY, halfWidth, combinedH);
            doc.rect(margin + halfWidth, currentY, halfWidth, combinedH);
            
            doc.setFont("helvetica", "normal");
            doc.text(eppsLines, margin + 5, currentY + 8);
            doc.text(senaLines, margin + halfWidth + 5, currentY + 8);
            
            currentY += combinedH + 5;

            // 3. RIESGOS ASOCIADOS
            checkNewPage(45);
            doc.setFillColor(230, 230, 230);
            doc.rect(margin, currentY, tableWidth, 7, 'F');
            doc.rect(margin, currentY, tableWidth, 7, 'D');
            doc.setFont("helvetica", "bold");
            doc.text("RIESGOS ASOCIADOS", margin + (tableWidth/2), currentY + 5, { align: 'center' });
            currentY += 7;
            const riesgosLines = doc.splitTextToSize(item.riesgosAsociados || "Sin datos", tableWidth - 10);
            const riesgosH = Math.max(30, riesgosLines.length * 5 + 10);
            doc.rect(margin, currentY, tableWidth, riesgosH);
            doc.setFont("helvetica", "normal");
            doc.text(riesgosLines, margin + 5, currentY + 8);
            currentY += riesgosH + 10;

            // 5. MÁS FOTOS (Si hay más de una)
            if (item.fotos && item.fotos.length > 1) {
                checkNewPage(60);
                doc.setFont("helvetica", "bold");
                doc.text("ANEXO FOTOGRÁFICO", margin, currentY);
                currentY += 5;
                
                let photoX = margin;
                const photoSize = 55;

                for (let i = 1; i < item.fotos.length; i++) {
                    const foto = item.fotos[i];
                    if (checkNewPage(photoSize + 10)) {
                        photoX = margin;
                    }

                    try {
                        const fullUrl = (foto.url.startsWith('http') || foto.url.startsWith('data')) 
                                        ? foto.url : SERVER_URL + foto.url;
                        const b64 = await urlToBase64(fullUrl);
                        if (b64) {
                            doc.addImage(b64, 'JPEG', photoX, currentY, photoSize, photoSize);
                            photoX += photoSize + 5;
                            if (photoX + photoSize > margin + tableWidth) {
                                photoX = margin;
                                currentY += photoSize + 5;
                            }
                        }
                    } catch(e) {}
                }
            }
            // 4. BITÁCORA DE NOVEDADES (Tickets de daños)
            if (listTickets && listTickets.length > 0) {
                checkNewPage(45);
                doc.setFillColor(230, 230, 230);
                doc.rect(margin, currentY, tableWidth, 7, 'F');
                doc.rect(margin, currentY, tableWidth, 7, 'D');
                doc.setFont("helvetica", "bold");
                doc.text("HISTORIAL DE NOVEDADES Y DAÑOS (TICKETS)", margin + (tableWidth/2), currentY + 5, { align: 'center' });
                currentY += 7;

                const bitacoraData = listTickets.map(b => [
                    b.consecutivo ?? b.Consecutivo ?? '-',
                    new Date(b.fecha).toLocaleDateString(),
                    b.turno,
                    b.descripcion,
                    b.estadoMaquina,
                    b.registradoPor || 'N/A'
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['#', 'Fecha', 'Turno', 'Descripción', 'Estado', 'Autor']],
                    body: bitacoraData,
                    margin: { left: margin },
                    tableWidth: tableWidth,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 100, 100] },
                    styles: { fontSize: 8 }
                });

                currentY = (doc as any).lastAutoTable.finalY + 10;
            }

            // --- 4. HISTORIAL DE MANTENIMIENTOS CON FOTOS (NUEVO) ---
            if (listMantenimientos && listMantenimientos.length > 0) {
                checkNewPage(40);
                doc.setFillColor(230, 230, 230);
                doc.rect(margin, currentY, tableWidth, 7, 'F');
                doc.rect(margin, currentY, tableWidth, 7, 'D');
                doc.setFont("helvetica", "bold");
                doc.text("HISTORIAL DE MANTENIMIENTOS", margin + (tableWidth/2), currentY + 5, { align: 'center' });
                currentY += 10;

                for (const m of listMantenimientos) {
                    // Verificar espacio para el encabezado del mantenimiento
                    checkNewPage(25);

                    // Pequeña tabla/fila para el resumen del mantenimiento
                    autoTable(doc, {
                        startY: currentY,
                        head: [['#', 'Fecha', 'Tipo', 'Ejecutado Por', 'Ticket', 'Observación']],
                        body: [[
                            m.consecutivo || '-',
                            new Date(m.fecha).toLocaleDateString(),
                            m.tipoMantenimiento || m.tipo,
                            m.ejecutadoPor,
                            (m.ticketId || m.TicketId) ? `#${m.ticketId || m.TicketId}` : '-',
                            m.observacion
                        ]],
                        margin: { left: margin },
                        tableWidth: tableWidth,
                        theme: 'grid',
                        headStyles: { fillColor: [80, 80, 80] },
                        styles: { fontSize: 8 }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 5;

                    currentY += 5; // Espacio entre mantenimientos
                }
            }

            // --- 5. RESUMEN DE CRONOGRAMA ANUAL ---
            try {
                const year = new Date().getFullYear();
                const respC = await api.get(`Cronogramas/FullData`, { params: { maquinaId: hoja.id, anio: year } });
                const cActs = respC.data.actividades;
                const cRegs = respC.data.registros;

                if (cActs && cActs.length > 0) {
                    checkNewPage(40);
                    doc.setFillColor(230, 230, 230);
                    doc.rect(margin, currentY, tableWidth, 7, 'F');
                    doc.rect(margin, currentY, tableWidth, 7, 'D');
                    doc.setFont("helvetica", "bold");
                    doc.text(`RESUMEN CRONOGRAMA DE MANTENIMIENTO - ${year}`, margin + (tableWidth/2), currentY + 5, { align: 'center' });
                    currentY += 10;

                    const mesesH = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                    const bodyCron = cActs.map((a: any) => {
                        const row = [a.operacion];
                        for (let m = 1; m <= 12; m++) {
                            const found = cRegs.find((r: any) => r.actividadId === a.id && r.mes === m);
                            row.push(found ? (found.estado === 1 ? 'E' : 'A') : '');
                        }
                        return row;
                    });

                    autoTable(doc, {
                        startY: currentY,
                        head: [['ACTIVIDAD / MES', ...mesesH]],
                        body: bodyCron,
                        margin: { left: margin },
                        tableWidth: tableWidth,
                        theme: 'grid',
                        headStyles: { fillColor: [80, 80, 80], fontSize: 7, halign: 'center' },
                        styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
                        columnStyles: { 0: { halign: 'left', cellWidth: 50 } },
                        didDrawCell: (data) => {
                            // Pintar celdas según contenido
                            if (data.section === 'body' && data.column.index > 0) {
                                const val = data.cell.text[0];
                                if (val === 'E') {
                                    doc.setFillColor(16, 185, 129); // Verde
                                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                                    doc.setTextColor(255, 255, 255);
                                    doc.text('E', data.cell.x + (data.cell.width/2), data.cell.y + (data.cell.height/2) + 1, { align: 'center' });
                                } else if (val === 'A') {
                                    doc.setFillColor(245, 158, 11); // Naranja/Amarillo
                                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                                    doc.setTextColor(255, 255, 255);
                                    doc.text('A', data.cell.x + (data.cell.width/2), data.cell.y + (data.cell.height/2) + 1, { align: 'center' });
                                }
                            }
                        }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 10;
                }
            } catch (e) {
                console.warn("Error agregando cronograma al PDF", e);
            }

            // --- FINALIZACIÓN: LOGO Y TOTAL PÁGINAS ---
            const totalPages = doc.internal.pages.length - 1;
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                // Escribimos el total de forma unificada
                // Borramos el anterior escribiendo sobre él en blanco si fuera necesario, 
                // o simplemente lo posicionamos bien.
                doc.text(`${totalPages}`, margin + 158, 15 + 27);

                // Insertar logo - Intentamos pero no bloqueamos si falla
                try {
                    const cacheBreaker = `?v=${new Date().getTime()}`;
                    const logoUrl = window.location.origin + '/empresa-logo.jpeg' + cacheBreaker;
                    const logo64 = await urlToBase64(logoUrl);
                    if (logo64) {
                        doc.addImage(logo64, 'JPEG', margin + 2, 17, 46, 26);
                    }
                } catch(e) {
                     console.warn("Logo load failed, continuing without logo");
                }
            }

            // --- GENERAR PDF ---
            const filename = `HojaVida_${item.nombre.replace(/ /g, '_')}.pdf`;
            doc.save(filename);
            return "ok";
        } catch (error) {
            console.error("PDF Error", error);
            Alert.alert("Error", "No se pudo generar el formato.");
            return null;
        }
    };


    const renderCronograma = () => {
        const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mesesSiglas = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const diasSemanaNombres = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

        const getStatusStyles = (estado: number) => {
            switch(Number(estado)) {
                case 1: return { color: '#84cc16', text: 'E', icon: 'check-bold', label: 'EJECUTADO' }; 
                case 2: return { color: '#eab308', text: 'A', icon: 'clock-fast', label: 'APLAZADO' }; 
                case 3: return { color: '#ef4444', text: 'NE', icon: 'close-thick', label: 'NO EJECUTADO' }; 
                case 4: return { color: '#f97316', text: 'P', icon: 'calendar-edit', label: 'PROGRAMADO' }; 
                case 5: return { color: '#06b6d4', text: 'I', icon: 'progress-alert', label: 'INCOMPLETO' }; 
                default: return { color: (isDarkMode ? '#334155' : '#f1f5f9'), text: '•', icon: null, label: 'PENDIENTE' };
            }
        };

        const getMonthCalculatedStatus = (actId: number, mesNum: number) => {
            const list = Array.isArray(cronogramaRegistros) ? cronogramaRegistros : [];
            const daily = list.filter(r => {
                const rid = r.actividadId !== undefined ? r.actividadId : r.ActividadId;
                const rmes = r.mes !== undefined ? r.mes : r.Mes;
                const rdia = r.dia !== undefined ? r.dia : r.Dia;
                const ranio = r.anio !== undefined ? r.anio : r.Anio;
                const restado = r.estado !== undefined ? r.estado : r.Estado;

                return Number(rid) === Number(actId) && 
                       Number(rmes) === Number(mesNum) && 
                       Number(ranio) === Number(selectedAnio) &&
                       Number(rdia || 0) > 0 &&
                       Number(restado || 0) > 0;
            });
            
            if (daily.length > 0) {
                if (daily.some(r => Number(r.estado ?? r.Estado) === 1)) return 1;
                if (daily.some(r => Number(r.estado ?? r.Estado) === 2)) return 2;
                if (daily.some(r => Number(r.estado ?? r.Estado) === 5)) return 5;
                if (daily.some(r => Number(r.estado ?? r.Estado) === 3)) return 3;
                return 4;
            }
            return 0;
        };

        const getGlobalStats = () => {
            const global = { E: 0, A: 0, NE: 0, P: 0, I: 0 };
            const mStats = mesesNombres.map((_, idx) => {
                const mesNum = idx + 1;
                const stats = { E: 0, A: 0, NE: 0, P: 0, I: 0, total: 0, mesNum };
                cronogramaActividades.forEach(act => {
                    const s = getMonthCalculatedStatus(act.id, mesNum);
                    if (s === 1) { stats.E++; global.E++; }
                    else if (s === 2) { stats.A++; global.A++; }
                    else if (s === 3) { stats.NE++; global.NE++; }
                    else if (s === 4) { stats.P++; global.P++; }
                    else if (s === 5) { stats.I++; global.I++; }
                    stats.total++;
                });
                const comp = stats.total > 0 ? Math.round((stats.E / stats.total) * 100) : 0;
                return { ...stats, comp };
            });
            return { global, mStats };
        };

        const { global, mStats } = getGlobalStats();
        const totalYearCells = (cronogramaActividades.length * 12) || 1;
        const totalComp = Math.round((global.E / totalYearCells) * 100);

        const renderDashboard = () => (
            <View style={{ flex: 1, padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                    <View>
                        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Cronograma de Mantenimiento</Text>
                        <Text style={{ fontSize: 16, color: colors.subText }}>Selecciona un mes para registrar actividades</Text>
                    </View>
                    <View style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', padding: 15, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, alignItems: 'center', minWidth: 150 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.subText, marginBottom: 5 }}>CUMPLIMIENTO ANUAL</Text>
                        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#84cc16' }}>{totalComp}%</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
                    {mStats.map((ms, idx) => (
                        <TouchableOpacity 
                            key={idx}
                            onPress={() => { setSelectedMesCronograma(ms.mesNum); setCronogramaSemanaOffset(0); }}
                            style={{ 
                                width: '23%', minHeight: 160, backgroundColor: isDarkMode ? '#1e293b' : 'white',
                                borderRadius: 20, padding: 20, elevation: 4, borderLeftWidth: 8,
                                borderLeftColor: ms.comp > 80 ? '#84cc16' : ms.comp > 40 ? '#eab308' : '#64748b'
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkMode ? 'white' : '#1e293b' }}>{mesesNombres[idx]}</Text>
                                <View style={{ backgroundColor: '#ebf8ff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                                    <Text style={{ color: '#3182ce', fontWeight: 'bold', fontSize: 14 }}>{ms.comp}%</Text>
                                </View>
                            </View>
                            <View style={{ height: 8, backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 15 }}>
                                <View style={{ width: `${ms.comp}%`, height: '100%', backgroundColor: '#84cc16' }} />
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                {[
                                    { k: 'E', c: '#84cc16', v: ms.E },
                                    { k: 'A', c: '#eab308', v: ms.A },
                                    { k: 'NE', c: '#ef4444', v: ms.NE },
                                    { k: 'P', c: '#f97316', v: ms.P },
                                    { k: 'I', c: '#06b6d4', v: ms.I },
                                ].map(s => (
                                    <View key={s.k} style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: s.c }}>{s.v}</Text>
                                        <Text style={{ fontSize: 10, color: '#64748b' }}>{s.k}</Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );

        const renderMonthDetail = () => {
            const getVisibleDays = (offset = cronogramaSemanaOffset) => {
                if (!selectedMesCronograma) return [];
                const firstOfMonth = new Date(selectedAnio, selectedMesCronograma - 1, 1);
                const dayIdx = firstOfMonth.getDay(); 
                const diffToMonday = dayIdx === 0 ? -6 : 1 - dayIdx;
                const startPoint = new Date(firstOfMonth);
                startPoint.setDate(firstOfMonth.getDate() + diffToMonday + (offset * 7));
                
                return Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(startPoint);
                    d.setDate(startPoint.getDate() + i);
                    return { date: d, dayIdx: i };
                }).filter(item => item.date.getMonth() + 1 === selectedMesCronograma);
            };

            const hasDaysInOffset = (offset: number) => {
                const days = getVisibleDays(offset);
                return days.length > 0;
            };

            const visibleDays = getVisibleDays();
            const currentMStats = mStats[selectedMesCronograma! - 1];

            return (
                <View style={{ flex: 1, flexDirection: 'row', padding: 15, gap: 15 }}>
                    <View style={{ flex: 3.5, backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: 12, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: colors.border }}>
                        <ScrollView style={{ flex: 1 }}>
                            <ScrollView horizontal>
                                <View>
                                    <View style={{ flexDirection: 'row', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                        <View style={{ width: 300, padding: 15, flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity onPress={() => setSelectedMesCronograma(null)} style={{ marginRight: 15, padding: 8, backgroundColor: colors.primary, borderRadius: 8 }}>
                                                <MaterialCommunityIcons name="view-dashboard" size={16} color="white" />
                                            </TouchableOpacity>
                                            <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 13 }}>{mesesNombres[selectedMesCronograma! - 1].toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row' }}>
                                            <TouchableOpacity 
                                                onPress={() => setCronogramaSemanaOffset(v => v - 1)} 
                                                disabled={!hasDaysInOffset(cronogramaSemanaOffset - 1)}
                                                style={{ width: 45, justifyContent: 'center', alignItems: 'center', opacity: hasDaysInOffset(cronogramaSemanaOffset - 1) ? 1 : 0.2 }}
                                            >
                                                <MaterialCommunityIcons name="chevron-left" size={30} color={colors.primary} />
                                            </TouchableOpacity>

                                            {visibleDays.map((item, idx) => (
                                                <View key={idx} style={{ width: 80, paddingVertical: 10, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: colors.border }}>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 11, color: colors.primary }}>{diasSemanaNombres[item.dayIdx]}</Text>
                                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{item.date.getDate()}</Text>
                                                </View>
                                            ))}

                                            <TouchableOpacity 
                                                onPress={() => setCronogramaSemanaOffset(v => v + 1)} 
                                                disabled={!hasDaysInOffset(cronogramaSemanaOffset + 1)}
                                                style={{ width: 45, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: colors.border, opacity: hasDaysInOffset(cronogramaSemanaOffset + 1) ? 1 : 0.2 }}
                                            >
                                                <MaterialCommunityIcons name="chevron-right" size={30} color={colors.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {cronogramaActividades.map((act, index) => (
                                        <View key={act.id} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: index % 2 === 0 ? (isDarkMode ? '#1e293b' : 'white') : (isDarkMode ? '#0f172a' : '#f8fafc') }}>
                                            <View style={{ width: 300, padding: 12, flexDirection: 'row', alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 12, color: colors.text, fontWeight: 'bold' }}>{act.operacion}</Text>
                                                    <View style={{ backgroundColor: (act.tipoMantenimiento || 'preventivo') === 'correctivo' ? '#ef444420' : (act.tipoMantenimiento || 'preventivo') === 'preventivo' ? '#3B82F620' : '#84cc1620', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: (act.tipoMantenimiento || 'preventivo') === 'correctivo' ? '#ef4444' : (act.tipoMantenimiento || 'preventivo') === 'preventivo' ? '#3B82F6' : '#84cc16' }}>{(act.tipoMantenimiento || 'preventivo').toUpperCase()}</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity onPress={() => handleEditActividad(act)} style={{ padding: 6 }}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} /></TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDeleteActividad(act.id)} style={{ padding: 6 }}><MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" /></TouchableOpacity>
                                            </View>

                                            <View style={{ width: 45, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderLeftWidth: 1, borderLeftColor: colors.border }} />
                                            {visibleDays.map((item, idx) => {
                                                const m = item.date.getMonth() + 1;
                                                const d = item.date.getDate();
                                                
                                                const list = Array.isArray(cronogramaRegistros) ? cronogramaRegistros : [];
                                                const reg = list.find(r => 
                                                    Number(r.actividadId || r.ActividadId) === Number(act.id) && 
                                                    Number(r.mes || r.Mes) === Number(m) && 
                                                    Number(r.dia || r.Dia) === Number(d) && 
                                                    Number(r.anio || r.Anio) === Number(selectedAnio)
                                                );
                                                const s = getStatusStyles(reg?.estado || 0);
                                                const isPickerActive = statusPicker?.actId === act.id && statusPicker?.mes === m && statusPicker?.dia === d;

                                                return (
                                                    <View key={idx} style={{ position: 'relative', zIndex: isPickerActive ? 10000 : 1 }}>
                                                        <TouchableOpacity 
                                                            onPress={() => setStatusPicker({ actId: act.id, mes: m, dia: d })}
                                                            style={{ width: 80, height: 60, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            {s.icon ? (
                                                                <MaterialCommunityIcons name={s.icon as any} size={24} color="white" />
                                                            ) : (
                                                                <Text style={{ color: isDarkMode ? '#475569' : '#cbd5e0', fontWeight: 'bold', fontSize: 14 }}>{s.text}</Text>
                                                            )}
                                                        </TouchableOpacity>

                                                        {isPickerActive && (
                                                            <View style={{ 
                                                                position: 'absolute', top: -55, left: -40, width: 220, height: 50, 
                                                                backgroundColor: '#1e293b', borderRadius: 25, flexDirection: 'row', 
                                                                alignItems: 'center', justifyContent: 'space-around', zIndex: 10001,
                                                                paddingHorizontal: 15, elevation: 20
                                                            }}>
                                                                {[1, 2, 3, 4, 5, 0].map(st => {
                                                                    const pickStyle = getStatusStyles(st);
                                                                    return (
                                                                        <TouchableOpacity 
                                                                            key={st} 
                                                                            onPress={async () => { 
                                                                                try {
                                                                                    await toggleCronogramaStatus(act.id, m, d, st); 
                                                                                    setStatusPicker(null); 
                                                                                } catch (err) {
                                                                                    Alert.alert("Error", "No se pudo actualizar el estado.");
                                                                                }
                                                                            }} 
                                                                            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: st === 0 ? '#4b5563' : pickStyle.color, alignItems: 'center', justifyContent: 'center' }}
                                                                        >
                                                                            <MaterialCommunityIcons name={(st === 0 ? 'close' : pickStyle.icon) as any} size={14} color="white" />
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                            <View style={{ width: 45, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderLeftWidth: 1, borderLeftColor: colors.border }} />
                                        </View>
                                    ))}
                                    <View style={{ padding: 15, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderTopWidth: 1, borderTopColor: colors.border }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <TextInput 
                                                style={{ flex: 1, height: 45, backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.text }}
                                                placeholder="Nombre de la nueva operación..."
                                                placeholderTextColor={colors.subText}
                                                value={newActividadNombre}
                                                onChangeText={setNewActividadNombre}
                                            />
                                            <TouchableOpacity onPress={handleAddActividad} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 10 }}><MaterialCommunityIcons name="plus" size={24} color="white" /></TouchableOpacity>
                                        </View>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {['correctivo', 'preventivo', 'limpieza', 'ajuste', 'calibracion'].map(t => (
                                                <TouchableOpacity 
                                                    key={t} 
                                                    onPress={() => setNewActividadTipo(t)}
                                                    style={[{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, newActividadTipo === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                                >
                                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: newActividadTipo === t ? 'white' : colors.subText }}>{t.toUpperCase()}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>
                        </ScrollView>
                    </View>
                    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: 20, overflow: 'hidden', elevation: 4, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ backgroundColor: '#1e293b', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>RESUMEN: {mesesSiglas[selectedMesCronograma! - 1]}</Text></View>
                        <View style={{ flex: 1, padding: 15, gap: 10 }}>
                            <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#ebf8ff', padding: 15, borderRadius: 15, alignItems: 'center' }}><Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>{currentMStats.comp}%</Text></View>
                            {[1, 2, 3, 4, 5].map(st => {
                                const stStyle = getStatusStyles(st);
                                const count = currentMStats[stStyle.text as keyof typeof global] || 0;
                                return (
                                    <View key={st} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 12, borderLeftWidth: 5, borderLeftColor: stStyle.color, height: 50 }}>
                                        <View style={{ flex: 1, paddingHorizontal: 12 }}><Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.subText }}>{stStyle.label}</Text></View>
                                        <View style={{ paddingHorizontal: 15 }}><Text style={{ color: stStyle.color, fontWeight: 'bold', fontSize: 16 }}>{count}</Text></View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            );
        };

        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={{ padding: 10, paddingVertical: 12, backgroundColor: isDarkMode ? '#1e293b' : '#1a202c', flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 8 }}>
                     <TouchableOpacity 
                         onPress={() => { maqScrollX.current = Math.max(0, maqScrollX.current - 300); maqScrollRef.current?.scrollTo({ x: maqScrollX.current, animated: true }); }}
                         style={{ padding: 6, backgroundColor: '#374151', borderRadius: 8 }}
                     >
                         <MaterialCommunityIcons name="chevron-left" size={22} color="#9CA3AF" />
                     </TouchableOpacity>
                     <ScrollView 
                         ref={maqScrollRef}
                         horizontal 
                         showsHorizontalScrollIndicator={true} 
                         style={{ flex: 1 }}
                         contentContainerStyle={{ paddingVertical: 4 }}
                         onScroll={(e) => { maqScrollX.current = e.nativeEvent.contentOffset.x; }}
                         scrollEventThrottle={16}
                     >
                        {hojasVida.map(maq => (
                            <TouchableOpacity key={maq.id} onPress={() => { setSelectedCronogramaMaq(maq); setSelectedMesCronograma(null); }} style={[{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 25, marginRight: 8, borderWidth: 1.5, borderColor: '#4b5563' }, selectedCronogramaMaq?.id === maq.id && { backgroundColor: '#3182ce', borderColor: '#3182ce' }]}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }} numberOfLines={1}>{maq.nombre}</Text>
                            </TouchableOpacity>
                        ))}
                     </ScrollView>
                     <TouchableOpacity 
                         onPress={() => { maqScrollX.current = maqScrollX.current + 300; maqScrollRef.current?.scrollTo({ x: maqScrollX.current, animated: true }); }}
                         style={{ padding: 6, backgroundColor: '#374151', borderRadius: 8 }}
                     >
                         <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
                     </TouchableOpacity>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#2d3748', padding: 10, borderRadius: 15 }}>
                        <TouchableOpacity onPress={() => setSelectedAnio(v => v - 1)}><MaterialCommunityIcons name="chevron-left" size={32} color="white" /></TouchableOpacity>
                        <Text style={{ fontWeight: 'bold', fontSize: 20, color: 'white' }}>{selectedAnio}</Text>
                        <TouchableOpacity onPress={() => setSelectedAnio(v => v + 1)}><MaterialCommunityIcons name="chevron-right" size={32} color="white" /></TouchableOpacity>
                     </View>
                </View>
                {loadingCronograma ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#3182ce" /><Text style={{ marginTop: 15, color: '#64748b', fontSize: 16 }}>Actualizando cronograma...</Text></View>
                ) : (
                    <ScrollView style={{ flex: 1 }}>{!selectedMesCronograma ? renderDashboard() : renderMonthDetail()}</ScrollView>
                )}
            </View>
        );
    };

    const renderHeader = () => (
        <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'HOJA_VIDA' && [styles.activeTabButton, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('HOJA_VIDA')}
                >
                    <MaterialCommunityIcons name="file-document-outline" size={20} color={activeTab === 'HOJA_VIDA' ? colors.primary : colors.subText} />
                    <Text style={[styles.tabText, { color: activeTab === 'HOJA_VIDA' ? colors.primary : colors.subText }]}>Hoja de Vida</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'CRONOGRAMA' && [styles.activeTabButton, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('CRONOGRAMA')}
                >
                    <MaterialCommunityIcons name="calendar-clock" size={20} color={activeTab === 'CRONOGRAMA' ? colors.primary : colors.subText} />
                    <Text style={[styles.tabText, { color: activeTab === 'CRONOGRAMA' ? colors.primary : colors.subText }]}>Cronogramas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'TICKETS_DANOS' && [styles.activeTabButton, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('TICKETS_DANOS')}
                >
                    <MaterialCommunityIcons name="alert-octagon-outline" size={20} color={activeTab === 'TICKETS_DANOS' ? colors.primary : colors.subText} />
                    <Text style={[styles.tabText, { color: activeTab === 'TICKETS_DANOS' ? colors.primary : colors.subText }]}>Tickets de daños</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'MANTENIMIENTOS' && [styles.activeTabButton, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('MANTENIMIENTOS')}
                >
                    <MaterialCommunityIcons name="wrench-outline" size={20} color={activeTab === 'MANTENIMIENTOS' ? colors.primary : colors.subText} />
                    <Text style={[styles.tabText, { color: activeTab === 'MANTENIMIENTOS' ? colors.primary : colors.subText }]}>Mantenimientos</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );

    const renderHojaVidaList = () => (
        <View style={styles.listContainer}>
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={hojasVida}
                    keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[styles.maquinaCard, { backgroundColor: isDarkMode ? '#111827' : 'white', borderLeftColor: colors.primary }]}
                            onPress={() => openEdit(item)}
                        >
                            <View style={styles.maquinaInfo}>
                                <Text style={[styles.maquinaName, { color: colors.text }]}>{item.nombre.toLowerCase()}</Text>
                                <Text style={[styles.maquinaSub, { color: colors.subText }]}>Inv: {item.numeroInventario || 'N/A'} | Marca: {item.marca || 'N/A'}</Text>
                            </View>
                            
                            {item.fotos && item.fotos.length > 0 && (
                                <View style={styles.thumbnailContainer}>
                                    <Image source={{ uri: (item.fotos[0].url.startsWith('http') || item.fotos[0].url.startsWith('data') || item.fotos[0].url.startsWith('blob')) ? item.fotos[0].url : SERVER_URL + item.fotos[0].url }} style={styles.thumbnail} />
                                    {item.fotos.length > 1 && (
                                        <View style={styles.photoCount}>
                                            <Text style={styles.photoCountText}>+{item.fotos.length - 1}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            
                            <View style={styles.actionButtons}>
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]} 
                                    onPress={() => handleExportPdf(item)}
                                >
                                    <MaterialCommunityIcons name="file-pdf-box" size={24} color="#E11D48" />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]} 
                                    onPress={() => {
                                        setSelectedMaqName(item.nombre);
                                        setSelectedMaqId(item.id!);
                                        setQrModalVisible(true);
                                    }}
                                >
                                    <MaterialCommunityIcons name="qrcode" size={24} color={colors.primary} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: '#EF444415' }]} 
                                    onPress={() => handleDelete(item)}
                                >
                                    <MaterialCommunityIcons name="delete-outline" size={24} color="#EF4444" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]} 
                                    onPress={() => openEdit(item)}
                                >
                                    <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.subText} />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyView}>
                            <MaterialCommunityIcons name="file-search-outline" size={60} color={colors.subText} opacity={0.5} />
                            <Text style={[styles.emptySubtitle, { color: colors.subText }]}>No hay hojas de vida registradas. Comienza creando una nueva.</Text>
                        </View>
                    }
                    contentContainerStyle={{ padding: 15 }}
                />
            )}
            <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openNew}>
                <MaterialCommunityIcons name="plus" size={32} color="white" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {!publicMode && renderHeader()}
            
            <View style={{ flex: 1 }}>
                {publicMode ? (
                    <View style={[styles.emptyView, { backgroundColor: '#f8fafc' }]}>
                        {loading ? (
                            <>
                                <ActivityIndicator size="large" color="#3182CE" />
                                <Text style={[styles.modalTitle, { color: '#2d3748', marginTop: 20 }]}>Buscando máquina...</Text>
                            </>
                        ) : publicData ? (
                            <View style={{ width: '100%', alignItems: 'center' }}>
                                <View style={{ backgroundColor: 'white', padding: 25, borderRadius: 20, width: '90%', maxWidth: 400, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                                    <MaterialCommunityIcons name="file-document-check" size={60} color="#10B981" />
                                    <Text style={[styles.modalTitle, { color: '#1a202c', textAlign: 'center', marginTop: 15 }]}>¡Máquina Encontrada!</Text>
                                    <Text style={{ fontSize: 18, color: '#4a5568', fontWeight: '600', marginTop: 5 }}>{publicData.hoja.nombre}</Text>
                                    <Text style={{ fontSize: 14, color: '#718096', marginBottom: 25 }}>Inventario: {publicData.hoja.numeroInventario || 'N/A'}</Text>
                                    
                                    <TouchableOpacity 
                                        style={{ 
                                            backgroundColor: '#3B82F6', 
                                            paddingVertical: 18, 
                                            paddingHorizontal: 30, 
                                            borderRadius: 12, 
                                            width: '100%', 
                                            flexDirection: 'row', 
                                            justifyContent: 'center', 
                                            alignItems: 'center', 
                                            opacity: generatingPdf ? 0.7 : 1, 
                                            elevation: 4 
                                        }}
                                        onPress={async () => {
                                            if (generatingPdf) return;
                                            setGeneratingPdf(true);
                                            try {
                                                await handleExportPdf(publicData.hoja, publicData.bitacoras);
                                            } finally {
                                                setGeneratingPdf(false);
                                            }
                                        }}
                                    >
                                        {generatingPdf ? (
                                            <ActivityIndicator color="white" style={{ marginRight: 10 }} />
                                        ) : (
                                            <MaterialCommunityIcons 
                                                name="file-pdf-box" 
                                                size={24} 
                                                color="white" 
                                                style={{ marginRight: 10 }} 
                                            />
                                        )}
                                        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                                            {generatingPdf ? 'GENERANDO REPORTE...' : 'DESCARGAR PDF OFICIAL'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                
                                <Text style={{ color: '#718096', fontSize: 13, marginTop: 40, textAlign: 'center', paddingHorizontal: 40 }}>
                                    Pulsa el botón azul para generar y descargar la Hoja de Vida oficial de este equipo.
                                </Text>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <MaterialCommunityIcons name="alert-circle-outline" size={80} color="#EF4444" />
                                <Text style={[styles.modalTitle, { color: '#2d3748', marginTop: 20 }]}>No se pudo cargar</Text>
                                <Text style={[styles.emptySubtitle, { color: '#718096', textAlign: 'center' }]}>No encontramos información para esta máquina o hubo un error de conexión.</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <>
                        {activeTab === 'HOJA_VIDA' && renderHojaVidaList()}
                        {activeTab === 'CRONOGRAMA' && renderCronograma()}
                        {activeTab === 'TICKETS_DANOS' && (
                            <View style={styles.listContainer}>
                                <FlatList
                                    data={bitacoras}
                                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                                    contentContainerStyle={{ padding: 15 }}
                                    ListEmptyComponent={() => (
                                        <View style={styles.emptyView}>
                                            <MaterialCommunityIcons name="alert-box-outline" size={80} color={colors.subText} opacity={0.3} />
                                            <Text style={[styles.emptySubtitle, { color: colors.subText }]}>No hay tickets de daños registrados.</Text>
                                        </View>
                                    )}
                                    renderItem={({ item }) => {
                                        const maq = hojasVida.find(h => h.id === item.hojaVidaId);
                                        const tNum = item.consecutivo ?? item.Consecutivo ?? item.id ?? 0;
                                        return (
                                            <View style={[styles.bitacoraCard, { backgroundColor: isDarkMode ? '#1e293b' : 'white', borderLeftColor: item.estadoMaquina === 'Operativa' ? '#10B981' : '#EF4444' }]}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                        <Text style={[styles.bitacoraTitle, { color: colors.text, marginBottom: 0 }]}>{maq?.nombre || 'Máquina'} - Ticket #{tNum}</Text>
                                                        <View style={[styles.badge, { backgroundColor: item.resuelto ? '#10B98120' : '#F59E0B20', marginLeft: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
                                                            <Text style={[styles.badgeText, { color: item.resuelto ? '#10B981' : '#F59E0B', fontSize: 10 }]}>
                                                                {item.resuelto ? 'RESUELTO' : 'NO RESUELTO'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View style={styles.bitacoraRow}>
                                                        <MaterialCommunityIcons name="clock-outline" size={14} color={colors.subText} />
                                                        <Text style={[styles.bitacoraDate, { color: colors.subText }]}> {new Date(item.fecha).toLocaleString()} - {item.turno}</Text>
                                                    </View>
                                                    <Text style={[styles.bitacoraDesc, { color: colors.text }]}>{item.descripcion}</Text>
                                                    <Text style={[styles.bitacoraUser, { color: colors.primary }]}>Generado por: {item.registradoPor || 'Anónimo'}</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <TouchableOpacity 
                                                        onPress={() => handleExportTicketPdf(item, maq!)}
                                                        style={{ marginRight: 15, padding: 5 }}
                                                    >
                                                        <MaterialCommunityIcons name="file-pdf-box" size={24} color="#E11D48" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleDeleteBitacora(item)}>
                                                        <MaterialCommunityIcons name="delete-outline" size={22} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    }}
                                />
                                <TouchableOpacity 
                                    style={[styles.fab, { backgroundColor: colors.primary }]} 
                                    onPress={() => {
                                        setBitacoraForm({
                                            hojaVidaId: 0,
                                            fecha: new Date().toISOString(),
                                            turno: 'Mañana',
                                            descripcion: '',
                                            estadoMaquina: 'Operativa',
                                            registradoPor: ''
                                        });
                                        setBitacoraModalVisible(true);
                                    }}
                                >
                                    <MaterialCommunityIcons name="plus-box" size={30} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                        {activeTab === 'MANTENIMIENTOS' && (
                            <View style={styles.listContainer}>
                                <FlatList
                                    data={mantenimientos}
                                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                                    contentContainerStyle={{ padding: 15 }}
                                    ListEmptyComponent={() => (
                                        <View style={styles.emptyView}>
                                            <MaterialCommunityIcons name="wrench-clock" size={80} color={colors.subText} opacity={0.3} />
                                            <Text style={[styles.emptySubtitle, { color: colors.subText }]}>No hay mantenimientos registrados.</Text>
                                        </View>
                                    )}
                                    renderItem={({ item }) => {
                                        const maq = hojasVida.find(h => h.id === item.hojaVidaId);
                                        return (
                                            <View style={[styles.bitacoraCard, { backgroundColor: isDarkMode ? '#1e293b' : 'white', borderLeftColor: '#3B82F6' }]}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={styles.rowBetween}>
                                                        <Text style={[styles.bitacoraTitle, { color: colors.text }]}>{maq?.nombre || 'Máquina'} - #{item.consecutivo ?? item.Consecutivo ?? 0}</Text>
                                                        <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                                                            <Text style={[styles.badgeText, { color: colors.primary, fontSize: 10, fontWeight: 'bold' }]}>{item.tipoMantenimiento || item.tipo}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={styles.bitacoraRow}>
                                                        <MaterialCommunityIcons name="calendar-range" size={14} color={colors.subText} />
                                                        <Text style={[styles.bitacoraDate, { color: colors.subText }]}> {new Date(item.fecha).toLocaleDateString()}</Text>
                                                    </View>
                                                    <Text style={[styles.bitacoraDesc, { color: colors.text, marginVertical: 5, fontSize: 14 }]}>{item.observacion}</Text>
                                                    
                                                    <View style={{ flexDirection: 'row', gap: 10, marginVertical: 5 }}>
                                                        <View style={{ backgroundColor: (item.tipoPersonal || item.TipoPersonal) === 'Externo' ? '#F59E0B20' : '#10B98120', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 }}>
                                                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: (item.tipoPersonal || item.TipoPersonal) === 'Externo' ? '#D97706' : '#059669' }}>{(item.tipoPersonal || item.TipoPersonal || 'Interno').toUpperCase()}</Text>
                                                        </View>
                                                        {(item.ticketId || item.TicketId) && (
                                                            <View style={{ backgroundColor: '#EF444420', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 }}>
                                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#DC2626' }}>TICKET #{item.ticketId || item.TicketId}</Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    {item.fotos && item.fotos.length > 0 && (
                                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                                                            {item.fotos.map((f, i) => (
                                                                <TouchableOpacity key={i} onPress={() => openImage(f.url)}>
                                                                    <Image 
                                                                        source={{ uri: f.url.startsWith('http') ? f.url : (SERVER_URL + f.url) }} 
                                                                        style={{ width: 85, height: 85, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: colors.border }} 
                                                                    />
                                                                </TouchableOpacity>
                                                            ))}
                                                        </ScrollView>
                                                    )}
                                                    
                                                    <Text style={[styles.bitacoraUser, { color: colors.primary }]}>Por: {item.ejecutadoPor}</Text>
                                                </View>
                                                <View style={{ justifyContent: 'space-around', marginLeft: 15 }}>
                                                    <TouchableOpacity 
                                                        onPress={() => handleExportMaintenancePdf(item, maq!)}
                                                        style={{ padding: 5 }}
                                                    >
                                                        <MaterialCommunityIcons name="file-pdf-box" size={26} color="#3B82F6" />
                                                    </TouchableOpacity>

                                                    <TouchableOpacity onPress={() => {
                                                        setMantenimientoForm({
                                                            ...item,
                                                            tipo: item.tipoMantenimiento || item.tipo || 'Preventivo',
                                                            tipoPersonal: item.tipoPersonal || 'Interno',
                                                            ticketId: item.ticketId
                                                        });
                                                        setIsEditingMantenimiento(true);
                                                        setMantenimientoModalVisible(true);
                                         setSelectedActsForMantenimiento([]);
                                                    }}>
                                                        <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.subText} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleDeleteMantenimiento(item.id!)}>
                                                        <MaterialCommunityIcons name="delete-outline" size={24} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    }}
                                />
                                <TouchableOpacity 
                                    style={[styles.fab, { backgroundColor: colors.primary }]} 
                                    onPress={() => {
                                        setMantenimientoForm({
                                            hojaVidaId: 0,
                                            fecha: new Date().toISOString(),
                                            tipo: 'Preventivo',
                                            ejecutadoPor: '',
                                            tipoPersonal: 'Interno',
                                            ticketId: undefined,
                                            observacion: '',
                                            fotos: []
                                        });
                                        setIsEditingMantenimiento(false);
                                        setMantenimientoModalVisible(true);
                                    }}
                                >
                                    <MaterialCommunityIcons name="wrench" size={30} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* Modal de Código QR */}
            <Modal visible={qrModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 400, alignItems: 'center', padding: 30 }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 10 }]}>Código QR - Hoja de Vida</Text>
                        <Text style={[styles.maquinaName, { color: colors.subText, marginBottom: 20 }]}>{selectedMaqName}</Text>
                        
                        {selectedMaqId && (
                            <View style={{ alignItems: 'center' }}>
                                <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 5 }}>
                                    <Image 
                                        source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('https://perla.work/?maqId=' + selectedMaqId)}` }} 
                                        style={{ width: 250, height: 250 }}
                                    />
                                </View>
                                
                                <TouchableOpacity 
                                    style={{ backgroundColor: colors.primary, marginTop: 20, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={async () => {
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent('https://perla.work/?maqId=' + selectedMaqId)}`;
                                        const b64 = await urlToBase64(qrUrl);
                                        if (b64) {
                                            const doc = new jsPDF({ unit: 'mm', format: [100, 100] });
                                            doc.setFontSize(10);
                                            doc.text("HOJA DE VIDA - EQUIPO", 50, 10, { align: 'center' });
                                            doc.setFont("helvetica", "bold");
                                            doc.setFontSize(12);
                                            doc.text(selectedMaqName, 50, 16, { align: 'center' });
                                            doc.addImage(b64, 'PNG', 15, 20, 70, 70);
                                            doc.setFontSize(8);
                                            doc.setFont("helvetica", "normal");
                                            doc.text("Escanee para descargar ficha técnica", 50, 95, { align: 'center' });
                                            
                                            const filename = `QR_${selectedMaqName.replace(/ /g, '_')}.pdf`;
                                            
                                            if (Platform.OS === 'web') {
                                                const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                if (isMobile) {
                                                    doc.output('dataurlnewwindow');
                                                } else {
                                                    const blob = doc.output('blob');
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = filename;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    setTimeout(() => {
                                                        document.body.removeChild(a);
                                                        URL.revokeObjectURL(url);
                                                    }, 100);
                                                }
                                            } else {
                                                doc.save(filename);
                                            }
                                        }
                                    }}
                                >
                                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="white" style={{ marginRight: 8 }} />
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Descargar PDF para Imprimir</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 20, textAlign: 'center' }}>
                            Escanea este código para descargar directamente la Hoja de Vida de este equipo.
                        </Text>
                        
                        <TouchableOpacity 
                            style={[styles.btnCancel, { marginTop: 30, width: '100%', alignItems: 'center' }]} 
                            onPress={() => setQrModalVisible(false)}
                        >
                            <Text style={[styles.btnCancelText, { color: colors.text }]}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal de Mantenimientos */}
            <Modal visible={mantenimientoModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 500 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {isEditingMantenimiento ? 'Editar Mantenimiento' : 'Agregar Mantenimiento'}
                            </Text>
                            <TouchableOpacity onPress={() => setMantenimientoModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ padding: 20 }}>
                            <Text style={[styles.label, { color: colors.text }]}>Máquina Atendida *</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: colors.border, height: 180 }]}>
                                <ScrollView style={{ paddingVertical: 5 }}>
                                    {hojasVida.map(maq => {
                                        const isSelected = mantenimientoForm.hojaVidaId === maq.id;
                                        return (
                                            <TouchableOpacity 
                                                key={maq.id} 
                                                onPress={() => {
                                                    const newId = isSelected ? 0 : maq.id!;
                                                    setMantenimientoForm(prev => ({
                                                        ...prev,
                                                        hojaVidaId: newId
                                                    }));
                                                    if (newId !== 0) {
                                                        loadCronogramaData(newId, selectedAnio);
                                                    }
                                                    setSelectedActsForMantenimiento([]);
                                                }}
                                                style={[
                                                    styles.maqListOption, 
                                                    isSelected && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
                                                ]}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={isSelected ? "checkbox-marked-circle" : "circle-outline"} 
                                                    size={22} 
                                                    color={isSelected ? "white" : colors.subText} 
                                                />
                                                <Text style={[
                                                    styles.maqOptionText, 
                                                    { marginLeft: 12, color: isSelected ? 'white' : (isDarkMode ? '#e2e8f0' : '#4a5568') }
                                                ]}>
                                                    {maq.nombre}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Tipo de Mantenimiento</Text>
                            <View style={[styles.turnosContainer, { flexWrap: 'wrap' }]}>
                                {['Correctivo', 'Preventivo', 'Limpieza', 'Ajuste', 'Calibración'].map(t => (
                                    <TouchableOpacity 
                                        key={t} 
                                        onPress={() => {
                                            setMantenimientoForm({...mantenimientoForm, tipo: t});
                                            setSelectedActsForMantenimiento([]); // Reset al cambiar tipo
                                        }}
                                        style={[styles.turnoBtn, { borderColor: colors.border, paddingHorizontal: 12, marginBottom: 8 }, mantenimientoForm.tipo === t && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                                    >
                                        <Text style={[styles.turnoText, { fontSize: 11, color: mantenimientoForm.tipo === t ? 'white' : colors.text }]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Mostrar Actividades según el tipo seleccionado */}
                            <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Actividades de {mantenimientoForm.tipo} Programadas</Text>
                            <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderRadius: 10, padding: 10, marginBottom: 15 }}>
                                {cronogramaActividades.filter(a => (a.tipoMantenimiento || 'preventivo').toLowerCase() === mantenimientoForm.tipo.toLowerCase()).length === 0 ? (
                                    <Text style={{ fontSize: 11, color: colors.subText, fontStyle: 'italic' }}>No hay actividades de tipo {mantenimientoForm.tipo.toLowerCase()} definidas para esta máquina.</Text>
                                ) : (
                                    cronogramaActividades.filter(a => (a.tipoMantenimiento || 'preventivo').toLowerCase() === mantenimientoForm.tipo.toLowerCase()).map(act => {
                                        const isChecked = selectedActsForMantenimiento.includes(act.id);
                                        return (
                                            <TouchableOpacity 
                                                key={act.id} 
                                                onPress={() => {
                                                    if (isChecked) setSelectedActsForMantenimiento(prev => prev.filter(id => id !== act.id));
                                                    else setSelectedActsForMantenimiento(prev => [...prev, act.id]);
                                                }}
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"} 
                                                    size={22} 
                                                    color={isChecked ? "#3B82F6" : colors.subText} 
                                                />
                                                <Text style={{ marginLeft: 10, fontSize: 12, color: colors.text, flex: 1 }}>{act.operacion}</Text>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>

                            <Text style={[styles.label, { color: colors.text }]}>Tipo de Personal *</Text>
                            <View style={styles.turnosContainer}>
                                {['Interno', 'Externo'].map(tp => (
                                    <TouchableOpacity 
                                        key={tp} 
                                        onPress={() => setMantenimientoForm({...mantenimientoForm, tipoPersonal: tp})}
                                        style={[styles.turnoBtn, { borderColor: colors.border }, mantenimientoForm.tipoPersonal === tp && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                                    >
                                        <Text style={[styles.turnoText, { color: mantenimientoForm.tipoPersonal === tp ? 'white' : colors.text }]}>{tp}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {mantenimientoForm.tipo === 'Correctivo' && (
                                <>
                                    <Text style={[styles.label, { color: colors.text }]}>Vincular con Ticket de Daño *</Text>
                                    <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: colors.border, height: 150 }]}>
                                        <ScrollView style={{ paddingVertical: 5 }}>
                                            {bitacoras.filter(b => b.hojaVidaId === mantenimientoForm.hojaVidaId).length === 0 ? (
                                                <Text style={{ padding: 15, color: colors.subText, textAlign: 'center', fontSize: 12 }}>No hay tickets para esta máquina.</Text>
                                            ) : (
                                                bitacoras.filter(b => b.hojaVidaId === mantenimientoForm.hojaVidaId).map(b => {
                                                    const isSelected = mantenimientoForm.ticketId === b.id;
                                                    return (
                                                        <TouchableOpacity 
                                                            key={b.id} 
                                                            onPress={() => setMantenimientoForm(prev => ({
                                                                ...prev,
                                                                ticketId: isSelected ? undefined : b.id
                                                            }))}
                                                            style={[
                                                                styles.maqListOption, 
                                                                isSelected && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
                                                            ]}
                                                        >
                                                            <MaterialCommunityIcons 
                                                                name={isSelected ? "checkbox-marked-circle" : "circle-outline"} 
                                                                size={20} 
                                                                color={isSelected ? "white" : colors.subText} 
                                                            />
                                                            <View style={{ marginLeft: 10, flex: 1 }}>
                                                                <Text style={[styles.maqOptionText, { fontSize: 11, color: isSelected ? 'white' : colors.text }]}>#{b.id} - {new Date(b.fecha).toLocaleDateString()}</Text>
                                                                <Text style={{ fontSize: 10, color: isSelected ? '#e2e8f0' : colors.subText }} numberOfLines={1}>{b.descripcion}</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })
                                            )}
                                        </ScrollView>
                                    </View>
                                </>
                            )}

                            <FormInput label="Ejecutado por *" value={mantenimientoForm.ejecutadoPor} onChangeText={(t: string) => setMantenimientoForm({...mantenimientoForm, ejecutadoPor: t})} placeholder="Nombre del técnico" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            <FormInput label="Observaciones / Detalles" value={mantenimientoForm.observacion} onChangeText={(t: string) => setMantenimientoForm({...mantenimientoForm, observacion: t})} placeholder="Detalle lo realizado..." multiline colors={colors} isDarkMode={isDarkMode} styles={styles} />

                            <View style={styles.photoUploadSection}>
                                <Text style={[styles.label, { color: colors.text }]}>Fotos del Mantenimiento</Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { backgroundColor: colors.primary + '20', flex: 1, height: 45, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} 
                                        onPress={() => pickMantenimientoImage(true)}
                                    >
                                        <MaterialCommunityIcons name="camera" size={20} color={colors.primary} />
                                        <Text style={{ color: colors.primary, marginLeft: 8, fontWeight: 'bold' }}>Cámara</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, { backgroundColor: '#10B98120', flex: 1, height: 45, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} 
                                        onPress={() => pickMantenimientoImage(false)}
                                    >
                                        <MaterialCommunityIcons name="image-multiple" size={20} color="#10B981" />
                                        <Text style={{ color: '#10B981', marginLeft: 8, fontWeight: 'bold' }}>Galería</Text>
                                    </TouchableOpacity>
                                </View>

                                {uploadingImage && <ActivityIndicator color={colors.primary} style={{ marginBottom: 10 }} />}

                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {mantenimientoForm.fotos?.map((foto, index) => (
                                        <View key={index} style={styles.photoWrapper}>
                                            <Image 
                                                source={{ uri: foto.url.startsWith('http') ? foto.url : SERVER_URL + foto.url }} 
                                                style={styles.photoItem} 
                                            />
                                            <TouchableOpacity 
                                                style={styles.removePhotoBadge} 
                                                onPress={() => {
                                                    const newFotos = [...(mantenimientoForm.fotos || [])];
                                                    newFotos.splice(index, 1);
                                                    setMantenimientoForm({...mantenimientoForm, fotos: newFotos});
                                                }}
                                            >
                                                <MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            <TouchableOpacity 
                                style={[styles.btnSave, { backgroundColor: colors.primary, marginTop: 25, marginBottom: 30 }]} 
                                onPress={handleSaveMantenimiento}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <MaterialCommunityIcons name="content-save-check" size={22} color="white" style={{ marginRight: 8 }} />
                                        <Text style={styles.btnSaveText}>{isEditingMantenimiento ? 'Actualizar' : 'Guardar'} Registro</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            <Modal visible={bitacoraModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 500 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Reportar Daño / Ticket</Text>
                            <TouchableOpacity onPress={() => setBitacoraModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ padding: 20 }}>
                            <Text style={[styles.label, { color: colors.text }]}>Máquina Afectada</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: colors.border, height: 180 }]}>
                                <ScrollView style={{ paddingVertical: 5 }}>
                                    {hojasVida.map(maq => {
                                        const isSelected = bitacoraForm.hojaVidaId === maq.id;
                                        return (
                                            <TouchableOpacity 
                                                key={maq.id} 
                                                onPress={() => setBitacoraForm(prev => ({
                                                    ...prev,
                                                    hojaVidaId: isSelected ? 0 : maq.id!
                                                }))}
                                                style={[
                                                    styles.maqListOption, 
                                                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={isSelected ? "checkbox-marked-circle" : "circle-outline"} 
                                                    size={22} 
                                                    color={isSelected ? "white" : colors.subText} 
                                                />
                                                <Text style={[
                                                    styles.maqOptionText, 
                                                    { marginLeft: 12, color: isSelected ? 'white' : (isDarkMode ? '#e2e8f0' : '#4a5568') }
                                                ]}>
                                                    {maq.nombre}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Turno</Text>
                                    <View style={styles.turnosContainer}>
                                        {['Mañana', 'Tarde', 'Noche'].map(t => (
                                            <TouchableOpacity 
                                                key={t} 
                                                onPress={() => setBitacoraForm({...bitacoraForm, turno: t})}
                                                style={[styles.turnoBtn, { borderColor: colors.border }, bitacoraForm.turno === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                            >
                                                <Text style={[styles.turnoText, { color: bitacoraForm.turno === t ? 'white' : colors.text }]}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Estado Máquina" value={bitacoraForm.estadoMaquina} onChangeText={(t: string) => setBitacoraForm({...bitacoraForm, estadoMaquina: t})} placeholder="Operativa / Parada" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                </View>
                            </View>

                            <FormInput label="Quién registra" value={bitacoraForm.registradoPor} onChangeText={(t: string) => setBitacoraForm({...bitacoraForm, registradoPor: t})} placeholder="Nombre completo" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            <FormInput label="Descripción de la Novedad / Actividad *" value={bitacoraForm.descripcion} onChangeText={(t: string) => setBitacoraForm({...bitacoraForm, descripcion: t})} placeholder="Escribe aquí los detalles..." multiline colors={colors} isDarkMode={isDarkMode} styles={styles} />

                            <TouchableOpacity 
                                style={[styles.btnSave, { backgroundColor: colors.primary, marginTop: 20 }]} 
                                onPress={handleSaveBitacora}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.btnSaveText}>Guardar en Bitácora</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal de Registro/Edición */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {isEditing ? 'Editar Hoja de Vida' : 'Nueva Hoja de Vida'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} disabled={saving}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.formScroll} contentContainerStyle={{ padding: 20 }}>
                            {/* Header Format Data */}
                            <View style={styles.formatHeader}>
                                <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                                    <Text style={[styles.badgeText, { color: colors.primary }]}>Código: {form.codigoFormato}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: '#4CAF5020' }]}>
                                    <Text style={[styles.badgeText, { color: '#4CAF50' }]}>Versión: {form.versionFormato}</Text>
                                </View>
                            </View>

                            <FormInput label="Nombre de la Máquina *" value={form.nombre} onChangeText={(txt: string) => setForm({ ...form, nombre: txt })} placeholder="Ej: Prensa Heidelberg" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            
                            {/* Foto Section */}
                            <View style={styles.photoUploadSection}>
                                <Text style={[styles.label, { color: colors.text }]}>Fotografías de la Máquina</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    <TouchableOpacity 
                                        style={[styles.addPhotoBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]} 
                                        onPress={pickImage}
                                        disabled={uploadingImage}
                                    >
                                        {uploadingImage ? (
                                            <ActivityIndicator color={colors.primary} />
                                        ) : (
                                            <>
                                                <MaterialCommunityIcons name="camera-plus" size={32} color={colors.primary} />
                                                <Text style={[styles.addPhotoText, { color: colors.primary }]}>Añadir</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    
                                    {form.fotos?.map((foto, index) => (
                                        <View key={index} style={styles.photoWrapper}>
                                            <Image 
                                                source={{ uri: (foto.url.startsWith('http') || foto.url.startsWith('data') || foto.url.startsWith('blob')) ? foto.url : SERVER_URL + foto.url }} 
                                                style={styles.photoItem} 
                                            />
                                            <TouchableOpacity 
                                                style={styles.removePhotoBadge} 
                                                onPress={() => removeFoto(index)}
                                            >
                                                <MaterialCommunityIcons name="close-circle" size={22} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <FormInput label="Nro Inventario" value={form.numeroInventario} onChangeText={(txt: string) => setForm({ ...form, numeroInventario: txt })} placeholder="Ej: MQ-001" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Marca" value={form.marca} onChangeText={(txt: string) => setForm({ ...form, marca: txt })} placeholder="Ej: Heidelberg" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <FormInput label="Modelo" value={form.modelo} onChangeText={(txt: string) => setForm({ ...form, modelo: txt })} placeholder="Ej: SM-74" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Serie / Serial" value={form.serie} onChangeText={(txt: string) => setForm({ ...form, serie: txt })} placeholder="S/N: 12345" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Tipo de Máquina</Text>
                                    <View style={styles.turnosContainer}>
                                        {['Manual', 'Automática'].map(t => (
                                            <TouchableOpacity 
                                                key={t} 
                                                onPress={() => setForm({...form, color: t})}
                                                style={[styles.turnoBtn, { borderColor: colors.border }, form.color === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                            >
                                                <Text style={[styles.turnoText, { color: form.color === t ? 'white' : colors.text }]}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Vida Útil Est." value={form.vidaUtil} onChangeText={(txt: string) => setForm({ ...form, vidaUtil: txt })} placeholder="Ej: 10 años" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <FormInput label="Proceso" value={form.proceso} onChangeText={(t: string) => setForm({...form, proceso: t})} placeholder="Ej: Impresión, Corte..." colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                <FormInput label="Ubicación" value={form.ubicacion} onChangeText={(t: string) => setForm({...form, ubicacion: t})} placeholder="Ej: Planta 1/2..." colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            </View>

                            <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 15 }]}>Ficha Técnica (Opcional)</Text>
                            <View style={styles.formRow}>
                                <FormInput label="Voltaje" value={form.voltaje} onChangeText={(t: string) => setForm({...form, voltaje: t})} placeholder="Ej: 110V / 220V" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                <FormInput label="Corriente" value={form.corriente} onChangeText={(t: string) => setForm({...form, corriente: t})} placeholder="Ej: 10A" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            </View>
                            <View style={styles.formRow}>
                                <FormInput label="Potencia" value={form.potencia} onChangeText={(t: string) => setForm({...form, potencia: t})} placeholder="Ej: 1500W" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                                <FormInput label="Dimensiones" value={form.dimensiones} onChangeText={(t: string) => setForm({...form, dimensiones: t})} placeholder="Ej: 100x80x150cm" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            </View>
                            <View style={styles.formRow}>
                                <FormInput label="Peso" value={form.peso} onChangeText={(t: string) => setForm({...form, peso: t})} placeholder="Ej: 80kg" colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            </View>
                            <FormInput label="Otros Detalles Técnicos" value={form.otroTecnico} onChangeText={(t: string) => setForm({...form, otroTecnico: t})} placeholder="..." multiline colors={colors} isDarkMode={isDarkMode} styles={styles} />

                            <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 15 }]}>Seguridad y Riesgos</Text>
                            <FormInput label="EPPS" value={form.eppsYRiesgos} onChangeText={(t: string) => setForm({...form, eppsYRiesgos: t})} placeholder="Lista de EPPS necesarios..." multiline colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            <FormInput label="Señalización Requerida" value={form.senalizacion} onChangeText={(txt: string) => setForm({ ...form, senalizacion: txt })} placeholder="Uso de cofia, etc..." multiline colors={colors} isDarkMode={isDarkMode} styles={styles} />
                            <FormInput label="Riesgos Asociados" value={form.riesgosAsociados} onChangeText={(txt: string) => setForm({ ...form, riesgosAsociados: txt })} placeholder="Detalle los riesgos operacionales..." multiline colors={colors} isDarkMode={isDarkMode} styles={styles} />

                            <View style={styles.modalActions}>
                                <TouchableOpacity 
                                    style={[styles.btnCancel, { borderColor: colors.border }]} 
                                    onPress={() => setModalVisible(false)}
                                    disabled={saving}
                                >
                                    <Text style={[styles.btnCancelText, { color: colors.subText }]}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.btnSave, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]} 
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="content-save-outline" size={20} color="white" />
                                            <Text style={styles.btnSaveText}>Guardar Hoja de Vida</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            {/* Visor de Imagen en Pantalla Completa */}
            <Modal
                visible={imageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setImageModalVisible(false)}
            >
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={1}
                    onPress={() => setImageModalVisible(false)}
                >
                    {selectedImage && (
                        <Image 
                            source={{ uri: selectedImage }} 
                            style={{ width: '95%', height: '85%', borderRadius: 10 }}
                            resizeMode="contain"
                        />
                    )}
                    <TouchableOpacity 
                        style={{ position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 25 }}
                        onPress={() => setImageModalVisible(false)}
                    >
                        <MaterialCommunityIcons name="close" size={30} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', position: 'absolute', bottom: 40, fontWeight: 'bold' }}>Toca en cualquier lugar para cerrar</Text>
                </TouchableOpacity>
            </Modal>
            
            {/* Modal para Editar Actividades del Cronograma */}
            <Modal visible={actModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 450 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Actividad</Text>
                            <TouchableOpacity onPress={() => setActModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ padding: 20 }}>
                            <Text style={[styles.label, { color: colors.text }]}>Nombre de la Operación / Actividad</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border, marginBottom: 20 }]}
                                value={editingAct?.operacion}
                                onChangeText={(t) => setEditingAct({ ...editingAct, operacion: t })}
                                placeholder="Ej: Limpiar rodillos"
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.text, marginBottom: 10 }]}>Tipo de Mantenimiento</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {['correctivo', 'preventivo', 'limpieza', 'ajuste', 'calibracion'].map(t => (
                                    <TouchableOpacity 
                                        key={t} 
                                        onPress={() => setEditingAct({ ...editingAct, tipoMantenimiento: t })}
                                        style={[
                                            { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }, 
                                            editingAct?.tipoMantenimiento === t && { backgroundColor: (colors.primary || '#3B82F6'), borderColor: (colors.primary || '#3B82F6') }
                                        ]}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: editingAct?.tipoMantenimiento === t ? 'white' : colors.text }}>{t.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity 
                                style={[styles.btnSave, { backgroundColor: (colors.primary || '#3B82F6'), marginTop: 30 }]} 
                                onPress={handleSaveEditActividad}
                            >
                                <MaterialCommunityIcons name="check-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.btnSaveText}>Actualizar Actividad</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (isDarkMode: boolean, colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    headerContainer: { backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.border },
    tabsScroll: { paddingHorizontal: 10, paddingVertical: 10 },
    tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: 'transparent', marginRight: 10 },
    activeTabButton: { borderBottomWidth: 3, borderBottomColor: colors.primary },
    tabText: { marginLeft: 8, fontWeight: 'bold', fontSize: 13, color: colors.text },
    
    listContainer: { flex: 1 },
    maquinaCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 15, 
        borderRadius: 12, 
        marginBottom: 12, 
        borderLeftWidth: 5, 
        backgroundColor: colors.card,
        elevation: 3, 
        shadowOpacity: 0.1, 
        shadowRadius: 3, 
        shadowOffset: { width: 0, height: 2 },
        borderColor: colors.border
    },
    maquinaInfo: { flex: 1 },
    maquinaName: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    maquinaSub: { fontSize: 14, marginTop: 4, color: colors.subText },
    
    thumbnailContainer: { marginRight: 15, position: 'relative' },
    thumbnail: { width: 60, height: 60, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#f0f0f0' },
    photoCount: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4 },
    photoCountText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

    actionButtons: { flexDirection: 'row', gap: 12 },
    actionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptySubtitle: { fontSize: 15, textAlign: 'center', marginTop: 15, lineHeight: 22, color: colors.subText },
    
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3, backgroundColor: colors.primary },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '95%', maxWidth: 800, maxHeight: '95%', borderRadius: 15, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    formScroll: { flex: 1 },
    photoList: { flexDirection: 'row', marginTop: 10 },
    addPhotoBtn: { width: 100, height: 100, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    addPhotoText: { fontSize: 12, fontWeight: 'bold', marginTop: 5, color: colors.subText },
    photoWrapper: { position: 'relative', marginRight: 15 },
    photoItem: { width: 100, height: 100, borderRadius: 12 },
    removePhotoBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.card, borderRadius: 11, borderWidth: 1, borderColor: colors.border },

    formGroup: { marginBottom: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, borderLeftWidth: 4, paddingLeft: 10, alignSelf: 'flex-start', color: colors.text },
    label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: colors.text },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: colors.text, borderColor: colors.border },
    row: { flexDirection: 'row', marginBottom: 0 },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, marginBottom: 40, gap: 10 },
    btnCancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
    btnCancelText: { fontWeight: 'bold', color: colors.subText },
    btnSave: { flex: 1, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary },
    btnSaveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    bitacoraCard: { 
        padding: 15, 
        borderRadius: 12, 
        marginBottom: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderLeftWidth: 5, 
        backgroundColor: colors.card,
        elevation: 2, 
        shadowOpacity: 0.1,
        borderColor: colors.border
    },
    bitacoraTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    bitacoraRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    bitacoraDate: { fontSize: 12, color: colors.subText },
    bitacoraDesc: { fontSize: 14, marginTop: 5, lineHeight: 20, color: colors.text },
    bitacoraUser: { fontSize: 12, fontWeight: 'bold', marginTop: 8, color: colors.subText },
    
    pickerContainer: { borderWidth: 1, borderRadius: 8, padding: 5, marginBottom: 15, borderColor: colors.border, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' },
    maqOption: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 10, borderColor: colors.border },
    maqListOption: { 
        paddingHorizontal: 15, 
        paddingVertical: 12, 
        borderRadius: 8, 
        borderWidth: 1, 
        marginBottom: 5, 
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: colors.border
    },
    maqOptionText: { fontSize: 13, fontWeight: 'bold', color: colors.text },
    
    turnosContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
    turnoBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    turnoText: { fontSize: 12, fontWeight: 'bold', color: colors.text },
    cronogramaCell: { width: 50, height: 50, borderRightWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    cronogramaHeaderCell: { width: 50, padding: 10, borderRightWidth: 1, borderColor: colors.border, alignItems: 'center' }
});
