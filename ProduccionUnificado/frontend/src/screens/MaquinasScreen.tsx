import React, { useState, useEffect } from 'react';
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

type SubModule = 'HOJA_VIDA' | 'CRONOGRAMA' | 'TICKETS_DANOS';

interface BitacoraEntry {
    id?: number;
    hojaVidaId: number;
    fecha: string;
    turno: string;
    descripcion: string;
    estadoMaquina: string;
    registradoPor: string;
    fechaRegistro?: string;
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

const FormInput = ({ label, value, onChangeText, placeholder, multiline = false, colors, isDarkMode }: any) => (
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

export default function MaquinasScreen({ onBack, publicId, publicMode }: { onBack?: () => void; publicId?: number; publicMode?: boolean }) {
    const { colors, isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState<SubModule>(publicMode ? 'HOJA_VIDA' : 'HOJA_VIDA');
    const [hojasVida, setHojasVida] = useState<HojaVida[]>([]);
    const [bitacoras, setBitacoras] = useState<BitacoraEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [fileServerUrl, setFileServerUrl] = useState('');
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [selectedMaqName, setSelectedMaqName] = useState('');
    const [selectedMaqId, setSelectedMaqId] = useState<number | null>(null);
    const [bitacoraModalVisible, setBitacoraModalVisible] = useState(false);
    const [isEditingBitacora, setIsEditingBitacora] = useState(false);
    const [bitacoraForm, setBitacoraForm] = useState<BitacoraEntry>({
        hojaVidaId: 0,
        fecha: new Date().toISOString(),
        turno: 'Mañana',
        descripcion: '',
        estadoMaquina: 'Operativa',
        registradoPor: ''
    });

    useEffect(() => {
        if (publicMode && publicId) {
            handlePublicDownload(publicId);
        }
    }, [publicMode, publicId]);

    const [publicData, setPublicData] = useState<{ hoja: HojaVida, bitacoras: BitacoraEntry[] } | null>(null);

    const handlePublicDownload = async (id: number) => {
        setLoading(true);
        try {
            const resp = await api.get(`PublicMaquinas/HojaVida/${id}`);
            const hoja = resp.data.hojaVida || resp.data.HojaVida;
            const bitacoras = resp.data.bitacoras || resp.data.Bitacoras || [];

            if (!hoja) throw new Error("Máquina no encontrada");

            setPublicData({ hoja, bitacoras });
            
            // Configurar URL del servidor para fotos (usar la raíz, no /api)
            const url = await getFileServerUrl();
            setFileServerUrl(url);
        } catch (e: any) {
            console.error("Error carga pública:", e);
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
        } else if (activeTab === 'TICKETS_DANOS') {
            loadBitacoras();
            loadHojasVida(); // Necesitamos las máquinas para el selector
        }
    }, [activeTab]);

    const loadHojasVida = async () => {
        setLoading(true);
        try {
            const res = await api.get('HojaVidaMaquinas');
            setHojasVida(res.data);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar las hojas de vida.");
        } finally {
            setLoading(false);
        }
    };

    const loadBitacoras = async () => {
        setLoading(true);
        try {
            const res = await api.get('BitacorasMaquinas');
            setBitacoras(res.data);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar las bitácoras.");
        } finally {
            setLoading(false);
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

    const uploadFile = async (uri: string) => {
        setUploadingImage(true);
        try {
            const formData = new FormData();
            let filename = uri.split('/').pop() || 'photo.jpg';
            // Si el nombre extraído no tiene extensión (común en blobs de navegador), forzar .jpg
            if (!filename.includes('.') || filename.length < 5) {
                filename = `foto_${Date.now()}.jpg`;
            }

            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                const blob = await response.blob();
                formData.append('Archivo', blob, filename);
            } else {
                formData.append('Archivo', { uri, name: filename, type } as any);
            }

            const res = await api.post('HojaVidaMaquinas/upload-foto', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const newFoto = { url: res.data.url };
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
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Scale to B64 error", error);
            return "";
        }
    };

    const handleExportPdf = async (item: HojaVida, dataBitacoras?: BitacoraEntry[]) => {
        try {
            // Si no se pasaron las bitácoras, las cargamos
            let listTickets = dataBitacoras;
            if (!listTickets) {
                const resp = await api.get(`BitacorasMaquinas/PorMaquina/${item.id}`);
                listTickets = resp.data;
            }

            const doc = new jsPDF();
            const margin = 15;
            const tableWidth = 180;
            const pageHeight = doc.internal.pageSize.height;
            let currentY = 15;

            // Función para dibujar la cabecera exacta
            const drawFormatHeader = (pageNum: number) => {
                doc.setDrawColor(0);
                doc.setLineWidth(0.3);
                doc.setFont("helvetica", "bold");
                
                // Cuadro exterior
                doc.rect(margin, currentY, tableWidth, 30);
                
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

            // 1. TABLA INFORMACIÓN Y FOTO
            const mainTableH = 60;
            doc.rect(margin, currentY, tableWidth, mainTableH);
            doc.line(margin + 45, currentY, margin + 45, currentY + mainTableH);
            doc.line(margin + 95, currentY, margin + 95, currentY + mainTableH);
            for(let i=1; i<6; i++) doc.line(margin, currentY + (i*10), margin + 95, currentY + (i*10));
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("Maquina", margin + 2, currentY + 7);
            doc.text("Numero de Inventario", margin + 47, currentY + 7);
            doc.text("Marca", margin + 2, currentY + 17);
            doc.text("Serie", margin + 47, currentY + 17);
            doc.text("Modelo", margin + 2, currentY + 27);
            doc.text("Tipo", margin + 47, currentY + 27);
            doc.text("Fecha de compra", margin + 2, currentY + 37);
            doc.text("Vida Útil", margin + 47, currentY + 37);
            doc.text("Proceso", margin + 2, currentY + 47);
            doc.text("Ubicación", margin + 47, currentY + 47);
            
            doc.setFont("helvetica", "normal");
            doc.text(item.nombre || "", margin + 43, currentY + 7, { align: 'right' });
            doc.text(item.numeroInventario || "", margin + 93, currentY + 7, { align: 'right' });
            doc.text(item.marca || "", margin + 43, currentY + 17, { align: 'right' });
            doc.text(item.serie || "", margin + 93, currentY + 17, { align: 'right' });
            doc.text(item.modelo || "", margin + 43, currentY + 27, { align: 'right' });
            doc.text(item.color || "", margin + 93, currentY + 27, { align: 'right' });
            doc.text(item.fechaCompra ? new Date(item.fechaCompra).toLocaleDateString() : "", margin + 43, currentY + 37, { align: 'right' });
            doc.text(item.vidaUtil || "", margin + 93, currentY + 37, { align: 'right' });
            doc.text(item.proceso || "", margin + 43, currentY + 47, { align: 'right' });
            doc.text(item.ubicacion || "", margin + 93, currentY + 47, { align: 'right' });
            
            doc.setFont("helvetica", "bold");
            doc.text("Fotografía", margin + 137, currentY + 7, { align: 'center' });

            if (item.fotos && item.fotos.length > 0) {
                try {
                    const fullUrl = (item.fotos[0].url.startsWith('http') || item.fotos[0].url.startsWith('data')) 
                        ? item.fotos[0].url : fileServerUrl + item.fotos[0].url;
                    const b64 = await urlToBase64(fullUrl);
                    if (b64) doc.addImage(b64, 'JPEG', margin + 97, currentY + 10, 80, 48);
                } catch(e) {}
            }
            currentY += mainTableH + 5;

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
                                        ? foto.url : fileServerUrl + foto.url;
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
                    new Date(b.fecha).toLocaleDateString(),
                    b.turno,
                    b.descripcion,
                    b.estadoMaquina,
                    b.registradoPor || 'N/A'
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Fecha', 'Turno', 'Descripción', 'Estado', 'Autor']],
                    body: bitacoraData,
                    margin: { left: margin },
                    tableWidth: tableWidth,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 100, 100] },
                    styles: { fontSize: 8 }
                });

                currentY = (doc as any).lastAutoTable.finalY + 10;
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

                // Insertar logo - Intentamos con URL absoluta y cache breaker
                try {
                    const cacheBreaker = `?v=${new Date().getTime()}`;
                    const logoUrl = window.location.origin + '/empresa-logo.jpeg' + cacheBreaker;
                    const logo64 = await urlToBase64(logoUrl);
                    if (logo64) {
                        doc.addImage(logo64, 'JPEG', margin + 2, 17, 46, 26);
                    } else {
                        throw new Error("Logo base64 empty");
                    }
                } catch(e) {
                     // Si falla, intentamos con la ruta de assets (haciendo fallback)
                     try {
                        const fallbackUrl = window.location.origin + '/assets/assets/logo_perla.c3c0eba23d358a42b2ce52660c5ffef5.png';
                        const backup64 = await urlToBase64(fallbackUrl);
                        if (backup64) doc.addImage(backup64, 'PNG', margin + 2, 17, 46, 26);
                     } catch(err) {}
                }
            }

            doc.save(`HojaVida_${item.nombre.replace(/ /g, '_')}.pdf`);
        } catch (error) {
            console.error("PDF Error", error);
            Alert.alert("Error", "No se pudo generar el formato dinámico.");
        }
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
                                <Text style={[styles.maquinaName, { color: colors.text }]}>{item.nombre}</Text>
                                <Text style={[styles.maquinaSub, { color: colors.subText }]}>Inv: {item.numeroInventario || 'N/A'} | Marca: {item.marca || 'N/A'}</Text>
                            </View>
                            
                            {item.fotos && item.fotos.length > 0 && (
                                <View style={styles.thumbnailContainer}>
                                    <Image source={{ uri: (item.fotos[0].url.startsWith('http') || item.fotos[0].url.startsWith('data') || item.fotos[0].url.startsWith('blob')) ? item.fotos[0].url : fileServerUrl + item.fotos[0].url }} style={styles.thumbnail} />
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
                                        style={{ backgroundColor: '#10B981', paddingVertical: 18, paddingHorizontal: 30, borderRadius: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                                        onPress={() => handleExportPdf(publicData.hoja, publicData.bitacoras)}
                                    >
                                        <MaterialCommunityIcons name="download" size={24} color="white" style={{ marginRight: 10 }} />
                                        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>DESCARGAR PDF</Text>
                                    </TouchableOpacity>
                                </View>
                                
                                <Text style={{ color: '#718096', fontSize: 13, marginTop: 40, textAlign: 'center', paddingHorizontal: 40 }}>
                                    Toca el botón verde para generar y descargar la Hoja de Vida oficial de este equipo.
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
                        {activeTab === 'CRONOGRAMA' && (
                            <View style={styles.emptyView}>
                                <MaterialCommunityIcons name="calendar-multiselect" size={80} color={colors.subText} opacity={0.3} />
                                <Text style={[styles.emptySubtitle, { color: colors.subText }]}>Cronogramas de mantenimiento en desarrollo.</Text>
                            </View>
                        )}
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
                                        return (
                                            <View style={[styles.bitacoraCard, { backgroundColor: isDarkMode ? '#1e293b' : 'white', borderLeftColor: item.estadoMaquina === 'Operativa' ? '#10B981' : '#EF4444' }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.bitacoraTitle, { color: colors.text }]}>{maq?.nombre || 'Máquina desconocida'}</Text>
                                                    <View style={styles.bitacoraRow}>
                                                        <MaterialCommunityIcons name="clock-outline" size={14} color={colors.subText} />
                                                        <Text style={[styles.bitacoraDate, { color: colors.subText }]}> {new Date(item.fecha).toLocaleString()} - {item.turno}</Text>
                                                    </View>
                                                    <Text style={[styles.bitacoraDesc, { color: colors.text }]}>{item.descripcion}</Text>
                                                    <Text style={[styles.bitacoraUser, { color: colors.primary }]}>Generado por: {item.registradoPor || 'Anónimo'}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => handleDeleteBitacora(item)}>
                                                    <MaterialCommunityIcons name="delete-outline" size={22} color="#EF4444" />
                                                </TouchableOpacity>
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
                                            const doc = new jsPDF({ unit: 'mm', format: [100, 100] }); // Formato pequeño p/etiqueta
                                            doc.setFontSize(10);
                                            doc.text("HOJA DE VIDA - EQUIPO", 50, 10, { align: 'center' });
                                            doc.setFont("helvetica", "bold");
                                            doc.setFontSize(12);
                                            doc.text(selectedMaqName, 50, 16, { align: 'center' });
                                            doc.addImage(b64, 'PNG', 15, 20, 70, 70);
                                            doc.setFontSize(8);
                                            doc.setFont("helvetica", "normal");
                                            doc.text("Escanee para descargar ficha técnica", 50, 95, { align: 'center' });
                                            doc.save(`QR_${selectedMaqName.replace(/ /g, '_')}.pdf`);
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

            {/* Modal de Tickets */}
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
                            <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: colors.border }]}>
                                <ScrollView horizontal style={{ paddingVertical: 10 }}>
                                    {hojasVida.map(maq => (
                                        <TouchableOpacity 
                                            key={maq.id} 
                                            onPress={() => setBitacoraForm({...bitacoraForm, hojaVidaId: maq.id!})}
                                            style={[
                                                styles.maqOption, 
                                                bitacoraForm.hojaVidaId === maq.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                                            ]}
                                        >
                                            <Text style={[styles.maqOptionText, bitacoraForm.hojaVidaId === maq.id && { color: 'white' }]}>{maq.nombre}</Text>
                                        </TouchableOpacity>
                                    ))}
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
                                    <FormInput label="Estado Máquina" value={bitacoraForm.estadoMaquina} onChangeText={(t: string) => setBitacoraForm({...bitacoraForm, estadoMaquina: t})} placeholder="Operativa / Parada" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                            </View>

                            <FormInput label="Quién registra" value={bitacoraForm.registradoPor} onChangeText={(t: string) => setBitacoraForm({...bitacoraForm, registradoPor: t})} placeholder="Nombre completo" colors={colors} isDarkMode={isDarkMode} />
                            <FormInput label="Descripción de la Novedad / Actividad *" value={bitacoraForm.descripcion} onChangeText={(t: string) => setBitacoraForm({...bitacoraForm, descripcion: t})} placeholder="Escribe aquí los detalles..." multiline colors={colors} isDarkMode={isDarkMode} />

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

                            <FormInput label="Nombre de la Máquina *" value={form.nombre} onChangeText={(txt: string) => setForm({ ...form, nombre: txt })} placeholder="Ej: Prensa Heidelberg" colors={colors} isDarkMode={isDarkMode} />
                            
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
                                                source={{ uri: (foto.url.startsWith('http') || foto.url.startsWith('data') || foto.url.startsWith('blob')) ? foto.url : fileServerUrl + foto.url }} 
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
                                    <FormInput label="Nro Inventario" value={form.numeroInventario} onChangeText={(txt: string) => setForm({ ...form, numeroInventario: txt })} placeholder="Ej: MQ-001" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Marca" value={form.marca} onChangeText={(txt: string) => setForm({ ...form, marca: txt })} placeholder="Ej: Heidelberg" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <FormInput label="Modelo" value={form.modelo} onChangeText={(txt: string) => setForm({ ...form, modelo: txt })} placeholder="Ej: SM-74" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Serie / Serial" value={form.serie} onChangeText={(txt: string) => setForm({ ...form, serie: txt })} placeholder="S/N: 12345" colors={colors} isDarkMode={isDarkMode} />
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
                                    <FormInput label="Vida Útil Est." value={form.vidaUtil} onChangeText={(txt: string) => setForm({ ...form, vidaUtil: txt })} placeholder="Ej: 10 años" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <FormInput label="Proceso" value={form.proceso} onChangeText={(t: string) => setForm({...form, proceso: t})} placeholder="Ej: Impresión, Corte..." colors={colors} isDarkMode={isDarkMode} />
                                <FormInput label="Ubicación" value={form.ubicacion} onChangeText={(t: string) => setForm({...form, ubicacion: t})} placeholder="Ej: Planta 1/2..." colors={colors} isDarkMode={isDarkMode} />
                            </View>

                            <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 15 }]}>Ficha Técnica (Opcional)</Text>
                            <View style={styles.formRow}>
                                <FormInput label="Voltaje" value={form.voltaje} onChangeText={(t: string) => setForm({...form, voltaje: t})} placeholder="Ej: 110V / 220V" colors={colors} isDarkMode={isDarkMode} />
                                <FormInput label="Corriente" value={form.corriente} onChangeText={(t: string) => setForm({...form, corriente: t})} placeholder="Ej: 10A" colors={colors} isDarkMode={isDarkMode} />
                            </View>
                            <View style={styles.formRow}>
                                <FormInput label="Potencia" value={form.potencia} onChangeText={(t: string) => setForm({...form, potencia: t})} placeholder="Ej: 1500W" colors={colors} isDarkMode={isDarkMode} />
                                <FormInput label="Dimensiones" value={form.dimensiones} onChangeText={(t: string) => setForm({...form, dimensiones: t})} placeholder="Ej: 100x80x150cm" colors={colors} isDarkMode={isDarkMode} />
                            </View>
                            <View style={styles.formRow}>
                                <FormInput label="Peso" value={form.peso} onChangeText={(t: string) => setForm({...form, peso: t})} placeholder="Ej: 80kg" colors={colors} isDarkMode={isDarkMode} />
                            </View>
                            <FormInput label="Otros Detalles Técnicos" value={form.otroTecnico} onChangeText={(t: string) => setForm({...form, otroTecnico: t})} placeholder="..." multiline colors={colors} isDarkMode={isDarkMode} />

                            <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 15 }]}>Seguridad y Riesgos</Text>
                            <FormInput label="EPPS" value={form.eppsYRiesgos} onChangeText={(t: string) => setForm({...form, eppsYRiesgos: t})} placeholder="Lista de EPPS necesarios..." multiline colors={colors} isDarkMode={isDarkMode} />
                            <FormInput label="Señalización Requerida" value={form.senalizacion} onChangeText={(txt: string) => setForm({ ...form, senalizacion: txt })} placeholder="Uso de cofia, etc..." multiline colors={colors} isDarkMode={isDarkMode} />
                            <FormInput label="Riesgos Asociados" value={form.riesgosAsociados} onChangeText={(txt: string) => setForm({ ...form, riesgosAsociados: txt })} placeholder="Detalle los riesgos operacionales..." multiline colors={colors} isDarkMode={isDarkMode} />

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { backgroundColor: 'transparent', borderBottomWidth: 1 },
    tabsScroll: { paddingHorizontal: 10, paddingVertical: 10 },
    tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: 'transparent', marginRight: 10 },
    activeTabButton: { borderBottomWidth: 3 },
    tabText: { marginLeft: 8, fontWeight: 'bold', fontSize: 13 },
    
    listContainer: { flex: 1 },
    maquinaCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 12, borderLeftWidth: 5, elevation: 3, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
    maquinaInfo: { flex: 1 },
    maquinaName: { fontSize: 18, fontWeight: 'bold' },
    maquinaSub: { fontSize: 14, marginTop: 4 },
    
    thumbnailContainer: { marginRight: 15, position: 'relative' },
    thumbnail: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f0f0f0' },
    photoCount: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4 },
    photoCountText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

    actionButtons: { flexDirection: 'row', gap: 12 },
    actionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptySubtitle: { fontSize: 15, textAlign: 'center', marginTop: 15, lineHeight: 22 },
    
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '95%', maxWidth: 800, maxHeight: '95%', borderRadius: 15, overflow: 'hidden' },
    modalHeader: { padding: 20, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    formScroll: { flex: 1 },
    formatHeader: { flexDirection: 'row', marginBottom: 20, gap: 10 },
    badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },
    
    photoUploadSection: { marginBottom: 20 },
    photoList: { flexDirection: 'row', marginTop: 10 },
    addPhotoBtn: { width: 100, height: 100, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    addPhotoText: { fontSize: 12, fontWeight: 'bold', marginTop: 5 },
    photoWrapper: { position: 'relative', marginRight: 15 },
    photoItem: { width: 100, height: 100, borderRadius: 12 },
    removePhotoBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: 'white', borderRadius: 11 },

    formGroup: { marginBottom: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, borderLeftWidth: 4, paddingLeft: 10, alignSelf: 'flex-start' },
    label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
    row: { flexDirection: 'row', marginBottom: 0 },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, marginBottom: 40, gap: 10 },
    btnCancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
    btnCancelText: { fontWeight: 'bold' },
    btnSave: { flex: 1, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 10 },
    btnSaveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Bitacora Styles
    bitacoraCard: { padding: 15, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, elevation: 2, shadowOpacity: 0.1 },
    bitacoraTitle: { fontSize: 16, fontWeight: 'bold' },
    bitacoraRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    bitacoraDate: { fontSize: 12 },
    bitacoraDesc: { fontSize: 14, marginTop: 5, lineHeight: 20 },
    bitacoraUser: { fontSize: 12, fontWeight: 'bold', marginTop: 8 },
    
    pickerContainer: { borderWidth: 1, borderRadius: 8, padding: 5, marginBottom: 15 },
    maqOption: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', marginRight: 10 },
    maqOptionText: { fontSize: 13, fontWeight: 'bold' },
    
    turnosContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
    turnoBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
    turnoText: { fontSize: 12, fontWeight: 'bold' }
});
