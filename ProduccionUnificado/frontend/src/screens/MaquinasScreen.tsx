import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput, Modal, Image, Platform, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../services/productionApi';
import { getFileServerUrl } from '../services/apiConfig';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
// Eliminamos el SERVER_URL estático y usaremos un estado para cargarlo dinámicamente

type SubModule = 'STATS' | 'HOJA_VIDA' | 'CRONOGRAMA';

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

export default function MaquinasScreen() {
    const { colors, isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState<SubModule>('HOJA_VIDA');
    const [hojasVida, setHojasVida] = useState<HojaVida[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [fileServerUrl, setFileServerUrl] = useState('');

    useEffect(() => {
        const loadUrl = async () => {
            const url = await getFileServerUrl();
            setFileServerUrl(url);
        };
        loadUrl();
    }, []);

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
            fotos: hoja.fotos || []
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
                    style={[styles.tabButton, activeTab === 'STATS' && [styles.activeTabButton, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('STATS')}
                >
                    <MaterialCommunityIcons name="chart-box-outline" size={20} color={activeTab === 'STATS' ? colors.primary : colors.subText} />
                    <Text style={[styles.tabText, { color: activeTab === 'STATS' ? colors.primary : colors.subText }]}>Estadísticas</Text>
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
                            
                            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.subText} />
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
            {renderHeader()}
            
            <View style={{ flex: 1 }}>
                {activeTab === 'HOJA_VIDA' && renderHojaVidaList()}
                {activeTab === 'STATS' && (
                    <View style={styles.emptyView}>
                        <MaterialCommunityIcons name="chart-arc" size={80} color={colors.subText} opacity={0.3} />
                        <Text style={[styles.emptySubtitle, { color: colors.subText }]}>Módulo de estadísticas en desarrollo.</Text>
                    </View>
                )}
                {activeTab === 'CRONOGRAMA' && (
                    <View style={styles.emptyView}>
                        <MaterialCommunityIcons name="calendar-multiselect" size={80} color={colors.subText} opacity={0.3} />
                        <Text style={[styles.emptySubtitle, { color: colors.subText }]}>Cronograma de mantenimientos en desarrollo.</Text>
                    </View>
                )}
            </View>

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
                                    <FormInput label="Color" value={form.color} onChangeText={(txt: string) => setForm({ ...form, color: txt })} placeholder="Ej: Gris" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FormInput label="Vida Útil Est." value={form.vidaUtil} onChangeText={(txt: string) => setForm({ ...form, vidaUtil: txt })} placeholder="Ej: 10 años" colors={colors} isDarkMode={isDarkMode} />
                                </View>
                            </View>

                            <FormInput label="EPPS" value={form.eppsYRiesgos} onChangeText={(txt: string) => setForm({ ...form, eppsYRiesgos: txt })} placeholder="Describa los EPPS necesarios..." multiline colors={colors} isDarkMode={isDarkMode} />
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
    label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
    row: { flexDirection: 'row', marginBottom: 0 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, marginBottom: 40, gap: 10 },
    btnCancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
    btnCancelText: { fontWeight: 'bold' },
    btnSave: { flex: 1, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 10 },
    btnSaveText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
