import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView } from 'react-native';

interface ExpenseHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    gasto: {
        fechaCreacion?: string;
        fechaModificacion?: string;
        precio: number;
        rubroNombre?: string;
        // Add other relevant fields if needed for context
    } | null;
}

export function ExpenseHistoryModal({ visible, onClose, gasto }: ExpenseHistoryModalProps) {
    if (!gasto) return null;

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
                        <Text style={styles.title}>Historial del Gasto</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>


                        <View style={styles.historyContainer}>
                            <View style={styles.historyItem}>
                                <View style={styles.iconContainer}>
                                    <Text style={styles.icon}>📅</Text>
                                </View>
                                <View style={styles.historyTextContainer}>
                                    <Text style={styles.historyLabel}>Fecha de Creación</Text>
                                    <Text style={styles.historyValue}>
                                        {gasto.fechaCreacion
                                            ? new Date(gasto.fechaCreacion).toLocaleString('es-CO', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })
                                            : 'No disponible'}
                                    </Text>
                                </View>
                            </View>

                            {gasto.fechaModificacion && (
                                <View style={styles.historyItem}>
                                    <View style={[styles.iconContainer, styles.iconContainerModified]}>
                                        <Text style={styles.icon}>✏️</Text>
                                    </View>
                                    <View style={styles.historyTextContainer}>
                                        <Text style={styles.historyLabel}>Última Modificación</Text>
                                        <Text style={styles.historyValue}>
                                            {new Date(gasto.fechaModificacion).toLocaleString('es-CO', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', // Center vertically for a popup feel
        alignItems: 'center',
        padding: 20
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: '100%',
        maxWidth: 500, // Limit width on larger screens
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#F8F9FA',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    closeButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 8,
    },
    closeButtonText: {
        color: '#4A5568',
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        padding: 24,
    },
    infoCard: {
        backgroundColor: '#F7FAFC',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        alignItems: 'center'
    },
    label: {
        fontSize: 12,
        color: '#718096',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5
    },
    value: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 12,
        textAlign: 'center'
    },
    priceValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#28A745',
    },
    historyContainer: {
        gap: 16,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E6FFFA', // Light teal for creation
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    iconContainerModified: {
        backgroundColor: '#FFF5F5', // Light red/pink for modification
    },
    icon: {
        fontSize: 20,
    },
    historyTextContainer: {
        flex: 1,
    },
    historyLabel: {
        fontSize: 12,
        color: '#718096',
        marginBottom: 2,
    },
    historyValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2D3748',
    }
});
