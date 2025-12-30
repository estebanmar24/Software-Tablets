import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Modal, Image, Alert, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { API_URL } from '../services/productionApi';

const SERVER_URL = API_URL.replace('/api', '');

interface Novedad {
    tipoNovedad: string;
    observacion?: string;
    fotoUrl?: string;
}

interface EncuestaDetalle {
    id: number;
    fechaCreacion: string;
    operario: { nombre: string };
    auxiliar?: { nombre: string };
    maquina: { nombre: string };
    ordenProduccion: string;
    proceso: string;
    estadoProceso: string;
    novedades: Novedad[];
}

interface EncuestaResumen {
    id: number;
    fechaCreacion: string;
    operario: string;
    maquina: string;
    ordenProduccion: string;
    proceso: string;
    estadoProceso: string;
    totalNovedades: number;
    totalFotos: number;
    tiposNovedad: string[];
}

export default function QualityView() {
    const [loading, setLoading] = useState(false);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([]);
    const [selectedEncuesta, setSelectedEncuesta] = useState<EncuestaDetalle | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const meses = [
        { id: 1, nombre: 'Enero' }, { id: 2, nombre: 'Febrero' }, { id: 3, nombre: 'Marzo' },
        { id: 4, nombre: 'Abril' }, { id: 5, nombre: 'Mayo' }, { id: 6, nombre: 'Junio' },
        { id: 7, nombre: 'Julio' }, { id: 8, nombre: 'Agosto' }, { id: 9, nombre: 'Septiembre' },
        { id: 10, nombre: 'Octubre' }, { id: 11, nombre: 'Noviembre' }, { id: 12, nombre: 'Diciembre' }
    ];

    const anios = [2024, 2025, 2026];

    useEffect(() => {
        loadEncuestas();
    }, [mes, anio]);

    const loadEncuestas = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/calidad/encuestas?mes=${mes}&anio=${anio}`);
            setEncuestas(response.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar las encuestas de calidad');
        } finally {
            setLoading(false);
        }
    };

    const openDetalle = async (id: number) => {
        setLoadingDetail(true);
        setSelectedEncuesta(null);
        setModalVisible(true);
        try {
            const response = await axios.get(`${API_URL}/calidad/encuestas/${id}`);
            setSelectedEncuesta(response.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo cargar el detalle de la encuesta');
            setModalVisible(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    // --- DASHBOARD CALCULATIONS ---
    const stats = useMemo(() => {
        const total = encuestas.length;
        if (total === 0) return null;

        const withDefects = encuestas.filter(e => e.totalNovedades > 0).length;
        const clean = total - withDefects;
        const defectRate = ((withDefects / total) * 100).toFixed(1);
        const cleanRate = ((clean / total) * 100).toFixed(1);

        // Top Defects
        const defectCounts: Record<string, number> = {};
        encuestas.forEach(e => {
            if (e.tiposNovedad && e.tiposNovedad.length > 0) {
                e.tiposNovedad.forEach(type => {
                    defectCounts[type] = (defectCounts[type] || 0) + 1;
                });
            }
        });

        const topDefects = Object.entries(defectCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Machine Breakdown
        const machineStats: Record<string, { total: number, defects: number }> = {};
        encuestas.forEach(e => {
            if (!machineStats[e.maquina]) {
                machineStats[e.maquina] = { total: 0, defects: 0 };
            }
            machineStats[e.maquina].total++;
            if (e.totalNovedades > 0) {
                machineStats[e.maquina].defects++;
            }
        });

        const machineList = Object.entries(machineStats)
            .map(([name, stat]) => ({
                name,
                total: stat.total,
                defects: stat.defects,
                rate: ((stat.defects / stat.total) * 100).toFixed(0)
            }))
            .sort((a, b) => parseInt(b.rate) - parseInt(a.rate));

        return {
            total,
            withDefects,
            clean,
            defectRate,
            cleanRate,
            topDefects,
            machineList
        };
    }, [encuestas]);


    const renderItem = ({ item }: { item: EncuestaResumen }) => (
        <TouchableOpacity style={styles.row} onPress={() => openDetalle(item.id)}>
            <Text style={[styles.cell, { flex: 1 }]}>{new Date(item.fechaCreacion).toLocaleDateString()} {new Date(item.fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={[styles.cell, { flex: 1.5 }]}>{item.operario}</Text>
            <Text style={[styles.cell, { flex: 1.5 }]}>{item.maquina}</Text>
            <Text style={[styles.cell, { flex: 0.8 }]}>{item.ordenProduccion}</Text>
            <Text style={[styles.cell, { flex: 1 }]}>{item.proceso}</Text>
            <Text style={[styles.cell, { flex: 0.8, color: item.estadoProceso === 'Terminado' ? 'green' : 'orange' }]}>{item.estadoProceso}</Text>
            <Text style={[styles.cell, { flex: 0.6, textAlign: 'center' }]}>
                {item.totalNovedades > 0 ? (
                    <Text style={{ color: 'red', fontWeight: 'bold' }}>{item.totalNovedades}</Text>
                ) : (
                    <Text style={{ color: 'green' }}>✓</Text>
                )}
            </Text>
            <Text style={[styles.cell, { flex: 0.5, textAlign: 'center' }]}>
                {item.totalFotos > 0 ? `📷 (${item.totalFotos})` : ''}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header Filters */}
            <View style={styles.header}>
                <View style={styles.filterGroup}>
                    <Text style={styles.label}>Mes:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={mes}
                            onValueChange={(itemValue) => setMes(itemValue)}
                            style={styles.picker}
                        >
                            {meses.map((m) => <Picker.Item key={m.id} label={m.nombre} value={m.id} />)}
                        </Picker>
                    </View>
                </View>
                <View style={styles.filterGroup}>
                    <Text style={styles.label}>Año:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={anio}
                            onValueChange={(itemValue) => setAnio(itemValue)}
                            style={styles.picker}
                        >
                            {anios.map((a) => <Picker.Item key={a} label={a.toString()} value={a} />)}
                        </Picker>
                    </View>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadEncuestas}>
                    <Text style={styles.refreshBtnText}>Actualizar</Text>
                </TouchableOpacity>
            </View>

            {loading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />}

            {!loading && (
                <View style={{ flex: 1 }}>
                    {/* Dashboard Section */}
                    <View style={{ height: 250 }}>
                        <ScrollView style={styles.dashboardContainer} contentContainerStyle={{ paddingBottom: 20 }}>
                            {stats ? (
                                <>
                                    {/* Main Cards */}
                                    <View style={styles.cardsRow}>
                                        <View style={[styles.card, { borderLeftColor: '#2196F3' }]}>
                                            <Text style={styles.cardUnic}>Total</Text>
                                            <Text style={styles.cardValue}>{stats.total}</Text>
                                        </View>
                                        <View style={[styles.card, { borderLeftColor: '#4CAF50' }]}>
                                            <Text style={styles.cardUnic}>Calidad OK</Text>
                                            <Text style={styles.cardValue}>{stats.cleanRate}%</Text>
                                            <Text style={styles.cardSub}>{stats.clean} encuestas</Text>
                                        </View>
                                        <View style={[styles.card, { borderLeftColor: '#F44336' }]}>
                                            <Text style={styles.cardUnic}>Con Defectos</Text>
                                            <Text style={styles.cardValue}>{stats.withDefects}</Text>
                                            <Text style={styles.cardSub}>{stats.defectRate}%</Text>
                                        </View>
                                    </View>

                                    <View style={styles.chartsRow}>
                                        {/* Top Defects */}
                                        <View style={styles.chartCard}>
                                            <Text style={styles.chartTitle}>Top 5 Defectos Recurrentes</Text>
                                            {stats.topDefects.length > 0 ? (
                                                stats.topDefects.map((d, i) => (
                                                    <View key={i} style={styles.chartItem}>
                                                        <Text style={styles.chartLabel}>{i + 1}. {d.name}</Text>
                                                        <View style={styles.barContainer}>
                                                            <View style={[styles.barFill, { width: `${Math.min((d.count / stats.withDefects) * 100, 100)}%` }]} />
                                                        </View>
                                                        <Text style={styles.chartCount}>{d.count}</Text>
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.noDataText}>No hay defectos reportados</Text>
                                            )}
                                        </View>

                                        {/* Machine Breakdown */}
                                        <View style={styles.chartCard}>
                                            <Text style={styles.chartTitle}>Calidad por Máquina</Text>
                                            <View style={styles.tableHeader}>
                                                <Text style={[styles.th, { flex: 2 }]}>Máquina</Text>
                                                <Text style={styles.th}>Total</Text>
                                                <Text style={styles.th}>Fallos</Text>
                                            </View>
                                            {stats.machineList.slice(0, 5).map((m, i) => (
                                                <View key={i} style={styles.tableRow}>
                                                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{m.name}</Text>
                                                    <Text style={styles.td}>{m.total}</Text>
                                                    <View style={[styles.badge, { backgroundColor: parseInt(m.rate) > 20 ? '#ffebee' : '#e8f5e9' }]}>
                                                        <Text style={{ color: parseInt(m.rate) > 20 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
                                                            {m.defects > 0 ? `${m.defects}` : '-'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <Text style={styles.emptyText}>Selecciona fechas para ver el dashboard.</Text>
                            )}
                        </ScrollView>
                    </View>

                    {/* Detailed List Header - Sticky */}
                    <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cellHeader, { flex: 1 }]}>Fecha</Text>
                        <Text style={[styles.cellHeader, { flex: 1.5 }]}>Operario</Text>
                        <Text style={[styles.cellHeader, { flex: 1.5 }]}>Máquina</Text>
                        <Text style={[styles.cellHeader, { flex: 0.8 }]}>OP</Text>
                        <Text style={[styles.cellHeader, { flex: 1 }]}>Proceso</Text>
                        <Text style={[styles.cellHeader, { flex: 0.8 }]}>Estado</Text>
                        <Text style={[styles.cellHeader, { flex: 0.6 }]}>Nov.</Text>
                        <Text style={[styles.cellHeader, { flex: 0.5 }]}>Foto</Text>
                    </View>

                    <FlatList
                        data={encuestas}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron encuestas en este periodo.</Text>}
                    />
                </View>
            )}

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detalle de Encuesta</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>X</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingDetail || !selectedEncuesta ? (
                            <ActivityIndicator size="large" color="#0000ff" style={{ margin: 20 }} />
                        ) : (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Información General:</Text>
                                    <Text>Fecha: {new Date(selectedEncuesta.fechaCreacion).toLocaleString()}</Text>
                                    <Text>Operario: {selectedEncuesta.operario?.nombre}</Text>
                                    {selectedEncuesta.auxiliar && <Text>Auxiliar: {selectedEncuesta.auxiliar.nombre}</Text>}
                                    <Text>Máquina: {selectedEncuesta.maquina?.nombre}</Text>
                                    <Text>Orden Producción: {selectedEncuesta.ordenProduccion}</Text>
                                    <Text>Proceso: {selectedEncuesta.proceso}</Text>
                                    <Text>Estado: {selectedEncuesta.estadoProceso}</Text>
                                </View>

                                <Text style={[styles.detailLabel, { marginTop: 15 }]}>Novedades y Hallazgos:</Text>
                                {selectedEncuesta.novedades && selectedEncuesta.novedades.length > 0 ? (
                                    selectedEncuesta.novedades.map((nov, index) => (
                                        <View key={index} style={styles.noveltyCard}>
                                            <Text style={styles.noveltyTitle}>{nov.tipoNovedad}</Text>
                                            {nov.observacion ? <Text style={styles.noveltyText}>Obs: {nov.observacion}</Text> : null}
                                            {nov.fotoUrl ? (
                                                <Image
                                                    source={{ uri: nov.fotoUrl.startsWith('http') ? nov.fotoUrl : `${SERVER_URL}/${nov.fotoUrl}` }}
                                                    style={styles.noveltyImage}
                                                    resizeMode="contain"
                                                />
                                            ) : null}
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.noNoveltyText}>Sin novedades registradas.</Text>
                                )}
                            </ScrollView>
                        )}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeModalBtnText}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        elevation: 2,
    },
    filterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    label: {
        fontWeight: 'bold',
        marginRight: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        width: 150,
        backgroundColor: '#fff',
    },
    picker: {
        height: 40,
        width: '100%',
    },
    refreshBtn: {
        backgroundColor: '#2196F3',
        padding: 10,
        borderRadius: 4,
        marginLeft: 'auto',
    },
    refreshBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    // Dashboard Styles
    dashboardContainer: {
        marginBottom: 10,
    },
    cardsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 5,
        elevation: 2,
        borderLeftWidth: 5,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardUnic: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginBottom: 5,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    cardSub: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    chartsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    chartCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 5,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
        textAlign: 'center'
    },
    chartItem: {
        marginBottom: 10,
    },
    chartLabel: {
        fontSize: 13,
        color: '#555',
        marginBottom: 2,
    },
    barContainer: {
        height: 8,
        backgroundColor: '#eee',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#FF7043',
    },
    chartCount: {
        position: 'absolute',
        right: 0,
        top: 0,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    noDataText: {
        textAlign: 'center',
        padding: 20,
        color: '#aaa',
        fontStyle: 'italic',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 5,
        marginBottom: 5,
    },
    th: {
        flex: 1,
        fontWeight: 'bold',
        fontSize: 12,
        color: '#666',
        textAlign: 'center'
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        alignItems: 'center'
    },
    td: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
        color: '#333'
    },
    badge: {
        flex: 1,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 50,
        alignSelf: 'center'
    },
    // List Styles
    row: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    headerRow: {
        backgroundColor: '#e0e0e0',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    cell: {
        fontSize: 14,
        paddingHorizontal: 5,
    },
    cellHeader: {
        fontWeight: 'bold',
        fontSize: 14,
        paddingHorizontal: 5,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
        color: '#666',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        height: '80%',
        backgroundColor: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: '#f0f0f0',
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
    },
    modalBody: {
        padding: 20,
    },
    detailSection: {
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#f9f9f9',
        borderRadius: 5,
    },
    detailLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    noveltyCard: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    noveltyTitle: {
        fontWeight: 'bold',
        fontSize: 15,
        color: '#333',
    },
    noveltyText: {
        fontStyle: 'italic',
        color: '#555',
        marginVertical: 5,
    },
    noveltyImage: {
        width: '100%',
        height: 200,
        marginTop: 10,
        borderRadius: 5,
        backgroundColor: '#eee'
    },
    noNoveltyText: {
        fontStyle: 'italic',
        color: '#888',
        textAlign: 'center',
        marginTop: 10,
    },
    modalFooter: {
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        alignItems: 'flex-end',
    },
    closeModalBtn: {
        backgroundColor: '#666',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    closeModalBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
