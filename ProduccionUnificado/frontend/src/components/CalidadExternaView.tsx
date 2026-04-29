import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image, Alert, Dimensions, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { api, API_URL } from '../services/productionApi';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const SERVER_URL = API_URL.replace('/api', '');

interface EncuestaResumen {
    id: number;
    tallerNombre: string;
    ordenProduccion: string;
    estadoProceso: string;
    inspector: string;
    fechaCreacion: string;
}

interface EncuestaDetalle {
    id: number;
    tallerNombre: string;
    horaLlegada: string;
    horaSalida: string;
    ordenProduccion: string;
    numeroRemision: string;
    cantidadProducir: number;
    cantidadEvaluada: number;
    estadoProceso: string;
    tieneMuestra: boolean;
    tipoProducto: string;
    conoceFormaEmpaque: boolean;
    tieneRemision: boolean;
    tieneInsumosCompletos: boolean;
    variacionTono: boolean;
    fotoVariacionTono?: string;
    quebradoArrugado: boolean;
    fotoQuebradoArrugado?: string;
    esquinaDefectuosa: boolean;
    fotoEsquinaDefectuosa?: string;
    presenciaPestanas: boolean;
    fotoPresenciaPestanas?: string;
    desgasteImpresion: boolean;
    fotoDesgasteImpresion?: string;
    manchas: boolean;
    fotoManchas?: string;
    reservaPega: boolean;
    fotoReservaPega?: string;
    grafadoRoto: boolean;
    fotoGrafadoRoto?: string;
    novedadBPM: boolean;
    fotoNovedadBPM?: string;
    usaCofia: boolean;
    fotoUsaCofia?: string;
    insumosPendientes: boolean;
    fotoInsumosPendientes?: string;
    tipoInsumosPendientes?: string;
    observaciones?: string;
    inspector: string;
    fechaCreacion: string;
}

export default function CalidadExternaView() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([]);
    
    // Detalle Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedEncuesta, setSelectedEncuesta] = useState<EncuestaDetalle | null>(null);

    // Image Modal
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [enlargedImageUri, setEnlargedImageUri] = useState<string | null>(null);

    useEffect(() => {
        loadEncuestas();
    }, []);

    const loadEncuestas = async () => {
        setLoading(true);
        try {
            const response = await api.get('CalidadTalleres');
            setEncuestas(response.data);
        } catch (error) {
            console.error('Error loading quality external', error);
            Alert.alert('Error', 'No se pudieron cargar las encuestas de calidad externa');
        } finally {
            setLoading(false);
        }
    };

    const openDetalle = async (id: number) => {
        setLoadingDetail(true);
        setSelectedEncuesta(null);
        try {
            const response = await api.get(`CalidadTalleres/${id}`);
            setSelectedEncuesta(response.data);
            setModalVisible(true);
        } catch (error) {
            console.error('Error loading detail', error);
            Alert.alert('Error', 'No se pudo cargar el detalle de la encuesta');
        } finally {
            setLoadingDetail(false);
        }
    };

    const openImageModal = (uri: string) => {
        setEnlargedImageUri(uri);
        setImageModalVisible(true);
    };

    const exportExcel = async () => {
        try {
            const url = `${API_URL}/CalidadTalleres/export-excel`;
            if (Platform.OS === 'web') {
                window.open(url, '_blank');
            } else {
                const fileUri = (FileSystem as any).documentDirectory + `CalidadTalleres_${new Date().getTime()}.xlsx`;
                const result = await FileSystem.downloadAsync(url, fileUri);
                if (result.status === 200) {
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(fileUri);
                    } else {
                        Alert.alert('Excel guardado', 'Se descargó el archivo: ' + fileUri);
                    }
                }
            }
        } catch(error: any) {
            console.error('Error exporting excel', error);
            Alert.alert('Error', 'No se pudo exportar a Excel');
        }
    };

    const renderItem = ({ item }: { item: EncuestaResumen }) => (
        <TouchableOpacity style={styles.row} onPress={() => openDetalle(item.id)}>
            <Text style={[styles.cell, { flex: 1.5 }]}>{new Date(item.fechaCreacion).toLocaleDateString()} {new Date(item.fechaCreacion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{item.tallerNombre}</Text>
            <Text style={[styles.cell, { flex: 1 }]}>{item.ordenProduccion}</Text>
            <Text style={[styles.cell, { flex: 1, color: item.estadoProceso === 'Terminado' ? 'green' : 'orange' }]}>{item.estadoProceso}</Text>
            <Text style={[styles.cell, { flex: 1.5 }]}>{item.inspector}</Text>
            <Text style={[styles.cell, { flex: 0.5, textAlign: 'center', color: '#3182CE' }]}>Ver Detalle 👁️</Text>
        </TouchableOpacity>
    );

    
    const renderPhotoItem = (label: string, fotoUrl?: string, stateBoolean?: boolean) => {
        // Always show: display the attribute label + value. Only skip if both are undefined/null (field not captured)
        if (stateBoolean === undefined || stateBoolean === null) return null;

        const urls = (fotoUrl || '').split(/\|\|\||\|\||;/).filter(u => u.trim());

        return (
            <View style={[styles.photoDefectContainer, { width: '100%', alignItems: 'flex-start' }]}>
                <Text style={[styles.photoDefectLabel, { color: stateBoolean ? '#C53030' : '#276749' }]}>
                    {label}: {stateBoolean ? 'Sí' : 'No'}
                </Text>
                {urls.length > 0 ? (
                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                        {urls.map((url, idx) => {
                            let fullPhotoUrl = url.trim();
                            if (fullPhotoUrl && !fullPhotoUrl.startsWith('http') && !fullPhotoUrl.startsWith('data:')) {
                                fullPhotoUrl = `${SERVER_URL}${fullPhotoUrl}`;
                            }
                            return (
                                <TouchableOpacity key={idx} onPress={() => openImageModal(fullPhotoUrl)} style={{margin: 4}}>
                                    <Image
                                        source={{ uri: fullPhotoUrl }}
                                        style={styles.defectImage}
                                        onError={() => console.warn('Image load error:', fullPhotoUrl)}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={{color: '#999', fontSize: 12, marginTop: 3, fontStyle: 'italic'}}>Sin foto</Text>
                )}
            </View>
        );
    };


    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadEncuestas}>
                    <Text style={styles.refreshBtnText}>Actualizar 🔄</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.refreshBtn, {backgroundColor: '#38A169', marginLeft: 10}]} onPress={exportExcel}>
                    <Text style={styles.refreshBtnText}>Exportar Excel 📊</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3182CE" style={{ marginTop: 50 }} />
            ) : (
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { flex: 1.5 }]}>Fecha</Text>
                        <Text style={[styles.headerCell, { flex: 2 }]}>Taller Externo</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>OP</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>Estado OP</Text>
                        <Text style={[styles.headerCell, { flex: 1.5 }]}>Inspector</Text>
                        <Text style={[styles.headerCell, { flex: 0.5, textAlign: 'center' }]}>Acción</Text>
                    </View>
                    <ScrollView style={styles.tableBody}>
                        {encuestas.length > 0 ? encuestas.map(e => (
                            <React.Fragment key={e.id}>{renderItem({item: e})}</React.Fragment>
                        )) : (
                            <Text style={styles.emptyText}>No hay encuestas registradas.</Text>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* DETALLE MODAL */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detalle Encuesta Taller Externo</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeModalText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {loadingDetail ? (
                            <ActivityIndicator size="large" color="#3182CE" style={{ padding: 50 }} />
                        ) : selectedEncuesta ? (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailGrid}>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Taller:</Text><Text style={styles.detailValue}>{selectedEncuesta.tallerNombre}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Inspector:</Text><Text style={styles.detailValue}>{selectedEncuesta.inspector}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>OP:</Text><Text style={styles.detailValue}>{selectedEncuesta.ordenProduccion}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Remisión:</Text><Text style={styles.detailValue}>{selectedEncuesta.numeroRemision}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Fecha:</Text><Text style={styles.detailValue}>{new Date(selectedEncuesta.fechaCreacion).toLocaleString()}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Estado de Proceso:</Text><Text style={styles.detailValue}>{selectedEncuesta.estadoProceso}</Text></View>
                                    
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Cant. a Producir:</Text><Text style={styles.detailValue}>{selectedEncuesta.cantidadProducir}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Cant. Evaluada:</Text><Text style={styles.detailValue}>{selectedEncuesta.cantidadEvaluada}</Text></View>
                                    
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Hora Llegada:</Text><Text style={styles.detailValue}>{selectedEncuesta.horaLlegada || 'N/A'}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Hora Salida:</Text><Text style={styles.detailValue}>{selectedEncuesta.horaSalida || 'N/A'}</Text></View>
                                </View>

                                <Text style={styles.sectionTitle}>Documentación y Condiciones</Text>
                                <View style={styles.detailGrid}>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Tiene Muestra:</Text><Text style={styles.detailValue}>{selectedEncuesta.tieneMuestra ? 'SÍ' : 'NO'}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Tipo Producto:</Text><Text style={styles.detailValue}>{selectedEncuesta.tipoProducto}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Conoce Empaque:</Text><Text style={styles.detailValue}>{selectedEncuesta.conoceFormaEmpaque ? 'SÍ' : 'NO'}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Tiene Remisión:</Text><Text style={styles.detailValue}>{selectedEncuesta.tieneRemision ? 'SÍ' : 'NO'}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Insumos Completos:</Text><Text style={styles.detailValue}>{selectedEncuesta.tieneInsumosCompletos ? 'SÍ' : 'NO'}</Text></View>
                                    <View style={styles.detailItem}><Text style={styles.detailLabel}>Insumos Pendientes:</Text><Text style={styles.detailValue}>{selectedEncuesta.insumosPendientes ? `SÍ (${selectedEncuesta.tipoInsumosPendientes})` : 'NO'}</Text></View>
                                </View>

                                <Text style={styles.sectionTitle}>Hallazgos de Inspección (Atributos)</Text>
                                <View style={styles.photosGrid}>
                                    {renderPhotoItem('Variación Tono', selectedEncuesta.fotoVariacionTono, selectedEncuesta.variacionTono)}
                                    {renderPhotoItem('Quebrado/Arrugado', selectedEncuesta.fotoQuebradoArrugado, selectedEncuesta.quebradoArrugado)}
                                    {renderPhotoItem('Esquina Defectuosa', selectedEncuesta.fotoEsquinaDefectuosa, selectedEncuesta.esquinaDefectuosa)}
                                    {renderPhotoItem('Presencia de Pestañas', selectedEncuesta.fotoPresenciaPestanas, selectedEncuesta.presenciaPestanas)}
                                    {renderPhotoItem('Desgaste/Impresión', selectedEncuesta.fotoDesgasteImpresion, selectedEncuesta.desgasteImpresion)}
                                    {renderPhotoItem('Manchas', selectedEncuesta.fotoManchas, selectedEncuesta.manchas)}
                                    {renderPhotoItem('Reserva de Pega', selectedEncuesta.fotoReservaPega, selectedEncuesta.reservaPega)}
                                    {renderPhotoItem('Grafado Roto', selectedEncuesta.fotoGrafadoRoto, selectedEncuesta.grafadoRoto)}
                                </View>

                                <Text style={styles.sectionTitle}>Higiene y Control</Text>
                                <View style={styles.photosGrid}>
                                    {renderPhotoItem('Novedad BPM', selectedEncuesta.fotoNovedadBPM, selectedEncuesta.novedadBPM)}
                                    {renderPhotoItem('Usa Cofia', selectedEncuesta.fotoUsaCofia, selectedEncuesta.usaCofia)}
                                    {renderPhotoItem('Insumos Pendientes', selectedEncuesta.fotoInsumosPendientes, selectedEncuesta.insumosPendientes)}
                                </View>

                                {selectedEncuesta.observaciones && (
                                    <>
                                        <Text style={styles.sectionTitle}>Observaciones</Text>
                                        <Text style={styles.obsText}>{selectedEncuesta.observaciones}</Text>
                                    </>
                                )}

                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* ENLARGED IMAGE MODAL */}
            <Modal
                visible={imageModalVisible}
                transparent={true}
                onRequestClose={() => setImageModalVisible(false)}
            >
                <View style={styles.fullScreenOverlay}>
                    <TouchableOpacity style={styles.closeImageBtn} onPress={() => setImageModalVisible(false)}>
                        <Text style={styles.closeImageText}>✕ CERRAR</Text>
                    </TouchableOpacity>
                    {enlargedImageUri && (
                        <Image source={{ uri: enlargedImageUri }} style={styles.fullScreenImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, justifyContent: 'flex-start' },
    refreshBtn: {
        backgroundColor: '#3182CE',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        elevation: 2,
    },
    refreshBtnText: { color: 'white', fontWeight: 'bold' },
    tableContainer: { flex: 1, backgroundColor: 'white', borderRadius: 10, overflow: 'hidden', elevation: 3 },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F7FAFC',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerCell: { fontWeight: 'bold', color: '#4A5568', fontSize: 13 },
    tableBody: { flex: 1 },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF2F7',
        alignItems: 'center',
    },
    cell: { fontSize: 13, color: '#2D3748' },
    emptyText: { padding: 20, textAlign: 'center', color: '#A0AEC0' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: {
        backgroundColor: 'white',
        width: '90%',
        height: '90%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    modalHeader: {
        backgroundColor: '#3182CE',
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    closeModalText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    modalBody: { flex: 1, padding: 20 },
    
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2C5282', marginTop: 25, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 5 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    detailItem: { width: '50%', marginBottom: 15, paddingRight: 10 },
    detailLabel: { fontSize: 12, color: '#718096', marginBottom: 2 },
    detailValue: { fontSize: 14, color: '#2D3748', fontWeight: '500' },
    
    photosGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
    photoDefectContainer: { width: 140, marginRight: 15, marginBottom: 20, alignItems: 'center' },
    photoDefectLabel: { fontSize: 12, fontWeight: 'bold', color: '#4A5568', marginBottom: 5, textAlign: 'center' },
    defectImage: { width: 140, height: 100, borderRadius: 8, backgroundColor: '#EDF2F7' },
    
    obsText: { fontSize: 14, color: '#4A5568', fontStyle: 'italic', backgroundColor: '#F7FAFC', padding: 15, borderRadius: 8 },

    fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    closeImageBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 8 },
    closeImageText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    fullScreenImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
});
