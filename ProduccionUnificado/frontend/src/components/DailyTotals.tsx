import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DailyTotalsProps {
    tirosTotales: number;
    desperdicioTotal: number;
    meta?: number;
}

export function DailyTotals({ tirosTotales, desperdicioTotal, meta = 0 }: DailyTotalsProps) {
    const formatNumber = (num: number): string => {
        return num.toLocaleString('es-CO');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Producción del Día</Text>
            <View style={styles.cardsRow}>
                <View style={[styles.card, styles.cardTiros]}>
                    <Text style={styles.cardValue}>{formatNumber(tirosTotales)}</Text>
                    <Text style={styles.cardLabel}>Tiros</Text>
                </View>
                <View style={[styles.card, styles.cardDesperdicio]}>
                    <Text style={styles.cardValue}>{formatNumber(desperdicioTotal)}</Text>
                    <Text style={styles.cardLabel}>Desperdicio Total</Text>
                </View>
            </View>

            {/* Eficiencia / Rendimiento - Siempre visible */}
            <View style={styles.efficiencyContainer}>
                <Text style={styles.efficiencyLabel}>Rendimiento del Operario</Text>
                {meta > 0 ? (
                    <>
                        <Text style={styles.efficiencyValue}>
                            {((tirosTotales / meta) * 100).toFixed(1)}%
                        </Text>
                        <Text style={styles.efficiencyMeta}>
                            Meta: {formatNumber(meta)} tiros
                        </Text>
                    </>
                ) : (
                    <>
                        <Text style={[styles.efficiencyValue, { color: '#A0AEC0' }]}>-- %</Text>
                        <Text style={[styles.efficiencyMeta, { color: '#A0AEC0' }]}>
                            Seleccione Máquina
                        </Text>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E3A5F',
        marginBottom: 12,
    },
    cardsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    card: {
        flex: 1,
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
    },
    cardTiros: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    cardDesperdicio: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    cardValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1E3A5F',
        fontVariant: ['tabular-nums'],
    },
    cardLabel: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
        fontWeight: '500',
    },
    efficiencyContainer: {
        marginTop: 12,
        backgroundColor: '#F0FFF4',
        borderWidth: 1,
        borderColor: '#C6F6D5',
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
    },
    efficiencyLabel: {
        fontSize: 12,
        color: '#2F855A',
        fontWeight: '600',
        marginBottom: 4,
    },
    efficiencyValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#276749',
    },
    efficiencyMeta: {
        fontSize: 11,
        color: '#48BB78',
        marginTop: 2,
    },
});
