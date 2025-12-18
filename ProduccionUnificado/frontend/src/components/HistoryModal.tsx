import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { TiempoProceso } from '../types';

interface HistoryModalProps {
    visible: boolean;
    onClose: () => void;
    historial: TiempoProceso[];
}

export function HistoryModal({ visible, onClose, historial }: HistoryModalProps) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Historial Detallado</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={historial}
                        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={styles.itemContainer}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTime}>
                                        {new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} | {item.horaInicio} - {item.horaFin}
                                    </Text>
                                    <Text style={styles.itemDuration}>{item.duracion}</Text>
                                </View>

                                {/* Nombre de la Máquina */}
                                {item.maquinaNombre && (
                                    <Text style={styles.machineName}>
                                        {item.maquinaNombre}
                                    </Text>
                                )}

                                {/* Orden de Producción */}
                                {item.ordenProduccionNumero ? (
                                    <View style={styles.opContainer}>
                                        <Text style={styles.opLabel}>OP:</Text>
                                        <Text style={styles.opValue}>{item.ordenProduccionNumero}</Text>
                                    </View>
                                ) : null}

                                <Text style={styles.activityName}>{item.actividadNombre}</Text>

                                <View style={styles.statsRow}>
                                    <View style={styles.stat}>
                                        <Text style={styles.statLabel}>Tiros</Text>
                                        <Text style={styles.statValue}>{item.tiros}</Text>
                                    </View>
                                    <View style={styles.stat}>
                                        <Text style={styles.statLabel}>Desperdicio</Text>
                                        <Text style={styles.statValueWaste}>{item.desperdicio}</Text>
                                    </View>
                                </View>

                                {item.observaciones ? (
                                    <View style={styles.obsContainer}>
                                        <Text style={styles.obsLabel}>Observaciones:</Text>
                                        <Text style={styles.obsText}>{item.observaciones}</Text>
                                    </View>
                                ) : null}
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No hay registros para mostrar</Text>
                            </View>
                        }
                    />
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#F7FAFC',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    closeButton: {
        padding: 8,
        backgroundColor: '#EDF2F7',
        borderRadius: 8,
    },
    closeButtonText: {
        color: '#4A5568',
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    itemContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemTime: {
        fontSize: 12,
        color: '#718096',
        fontWeight: '500',
    },
    itemDuration: {
        fontSize: 12,
        color: '#718096',
        fontWeight: '500',
    },
    machineName: {
        fontSize: 13,
        color: '#4A5568',
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    activityName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2D3748',
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 8,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statLabel: {
        fontSize: 12,
        color: '#718096',
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#28A745',
    },
    statValueWaste: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#E53E3E',
    },
    obsContainer: {
        marginTop: 8,
        backgroundColor: '#F7FAFC',
        padding: 8,
        borderRadius: 6,
    },
    obsLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#718096',
        marginBottom: 2,
    },
    obsText: {
        fontSize: 13,
        color: '#4A5568',
        fontStyle: 'italic',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#A0AEC0',
        fontSize: 16,
    },
    opContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: '#EBF8FF', // Light blue background to make it stand out
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start', // Don't stretch to full width
    },
    opLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#2B6CB0',
        marginRight: 4,
    },
    opValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2C5282',
    },
});
