import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { TiempoProceso } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { HistoryModal } from './HistoryModal';

interface ActivityHistoryProps {
    historial: TiempoProceso[];
}

export function ActivityHistory({ historial }: Omit<ActivityHistoryProps, 'onClearData'>) {
    const [modalVisible, setModalVisible] = useState(false);
    const { colors, isDarkMode } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Historial de Actividades</Text>
                <TouchableOpacity
                    style={[styles.historyButton, { backgroundColor: isDarkMode ? '#1F2937' : '#EDF2F7' }]}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={[styles.historyButtonText, { color: colors.text }]}>Ver Historial</Text>
                </TouchableOpacity>
            </View>

            {historial.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No hay registros de actividades</Text>
                    <Text style={styles.emptySubtext}>
                        Los registros aparecerán aquí cuando detenga el cronómetro
                    </Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {historial.slice(0, 5).map((item, index) => (
                        <View key={item.id || index} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                            {/* Hora */}
                            <View style={styles.timeColumn}>
                                <Text style={[styles.timeText, { color: colors.primary }]}>{item.horaFin}</Text>
                            </View>

                            {/* Actividad */}
                            <View style={styles.activityColumn}>
                                <Text style={[styles.activityCode, { backgroundColor: colors.primary }]}>{item.actividadCodigo}</Text>
                                <View style={styles.activityDetails}>
                                    <Text style={[styles.activityName, { color: colors.text }]} numberOfLines={1}>
                                        {item.actividadNombre}
                                    </Text>
                                    {/* Mostrar observaciones si existen */}
                                    {item.observaciones ? (
                                        <Text style={[styles.observacionesText, { color: colors.subText }]} numberOfLines={1}>
                                            {item.observaciones}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>

                            {/* Métricas (Tiros y Desperdicio) */}
                            <View style={styles.metricsColumn}>
                                {item.tiros > 0 && (
                                    <View style={styles.metricItem}>
                                        <Text style={[styles.metricLabel, { color: colors.subText }]}>Tiros:</Text>
                                        <Text style={styles.metricValueGood}>{item.tiros}</Text>
                                    </View>
                                )}
                                {item.desperdicio > 0 && (
                                    <View style={styles.metricItem}>
                                        <Text style={[styles.metricLabel, { color: colors.subText }]}>Desperdicio:</Text>
                                        <Text style={styles.metricValueWaste}>{item.desperdicio}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Duración */}
                            <View style={styles.durationColumn}>
                                <Text style={[styles.durationText, { color: colors.text }]}>{item.duracion}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            <HistoryModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                historial={historial}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        flex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2D3748',
    },
    historyButton: {
        backgroundColor: '#EDF2F7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    historyButtonText: {
        color: '#2D3748',
        fontSize: 12,
        fontWeight: '600',
    },
    scrollContainer: {
        flex: 1,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    timeColumn: {
        width: 65,
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#96BDF0',
        fontVariant: ['tabular-nums'],
    },
    activityColumn: {
        flex: 1, // Toma el espacio restante
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activityDetails: {
        flex: 1,
    },
    activityCode: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        backgroundColor: '#96BDF0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        minWidth: 24,
        textAlign: 'center',
    },
    activityName: {
        fontSize: 14,
        color: '#4A5568',
        fontWeight: '500',
    },
    observacionesText: {
        fontSize: 11,
        color: '#A0AEC0',
        marginTop: 2,
        fontStyle: 'italic',
    },
    metricsColumn: {
        width: 100, // Espacio fijo para métricas
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metricLabel: {
        fontSize: 11,
        color: '#718096',
    },
    metricValueGood: {
        fontSize: 12,
        fontWeight: '700',
        color: '#28A745',
    },
    metricValueWaste: {
        fontSize: 12,
        fontWeight: '700',
        color: '#E53E3E',
    },
    durationColumn: {
        width: 70,
        alignItems: 'flex-end',
    },
    durationText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E3A5F',
        fontVariant: ['tabular-nums'],
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    emptySubtext: {
        fontSize: 13,
        color: '#D1D5DB',
        marginTop: 4,
        textAlign: 'center',
    },
});
