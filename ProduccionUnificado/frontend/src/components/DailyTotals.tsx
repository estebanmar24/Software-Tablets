import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DailyTotalsProps {
    tirosTotales: number;
    desperdicioTotal: number;
    meta?: number;
    valorPorTiro?: number;
}

export function DailyTotals({ tirosTotales, desperdicioTotal, meta = 0, valorPorTiro = 0 }: DailyTotalsProps) {
    const formatNumber = (num: number): string => {
        return num.toLocaleString('es-CO');
    };

    const formatCurrency = (num: number): string => {
        return num.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Calcular rendimiento (%)
    const rendimiento = meta > 0 ? ((tirosTotales / meta) * 100) : 0;

    // Calcular bonificación: (tiros - meta) * valorPorTiro (solo si supera la meta)
    const tirosExcedente = Math.max(0, tirosTotales - meta);
    const bonificacion = tirosExcedente * valorPorTiro;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Producción del Día</Text>

            {/* Primera fila: Tiros y Desperdicio */}
            <View style={styles.cardsRow}>
                <View style={[styles.card, styles.cardTiros]}>
                    <Text style={styles.cardValue}>{formatNumber(tirosTotales)}</Text>
                    <Text style={styles.cardLabel}>Tiros</Text>
                </View>
                <View style={[styles.card, styles.cardDesperdicio]}>
                    <Text style={styles.cardValue}>{formatNumber(desperdicioTotal)}</Text>
                    <Text style={styles.cardLabel}>Desperdicio</Text>
                </View>
            </View>

            {/* Segunda fila: Rendimiento y Bonificación */}
            <View style={[styles.cardsRow, { marginTop: 12 }]}>
                <View style={[styles.card, styles.cardRendimiento]}>
                    {meta > 0 ? (
                        <>
                            <Text style={[styles.cardValue, rendimiento >= 100 ? styles.valueGood : styles.valueLow]}>
                                {rendimiento.toFixed(1)}%
                            </Text>
                            <Text style={styles.cardLabel}>Rendimiento</Text>
                            <Text style={styles.cardSubLabel}>Meta: {formatNumber(meta)}</Text>
                        </>
                    ) : (
                        <>
                            <Text style={[styles.cardValue, { color: '#A0AEC0' }]}>--%</Text>
                            <Text style={styles.cardLabel}>Rendimiento</Text>
                            <Text style={styles.cardSubLabel}>Seleccione Máquina</Text>
                        </>
                    )}
                </View>
                <View style={[styles.card, styles.cardBonificacion]}>
                    <Text style={[styles.cardValue, bonificacion > 0 ? styles.valueGood : { color: '#A0AEC0' }]}>
                        {formatCurrency(bonificacion)}
                    </Text>
                    <Text style={styles.cardLabel}>Bonificación</Text>
                    {bonificacion > 0 && (
                        <Text style={styles.cardSubLabel}>+{formatNumber(tirosExcedente)} tiros extra</Text>
                    )}
                </View>
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
        gap: 8,
        flexWrap: 'wrap',
    },
    card: {
        flex: 1,
        minWidth: 100,
        borderRadius: 10,
        padding: 12,
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
    cardRendimiento: {
        backgroundColor: '#F0FFF4',
        borderWidth: 1,
        borderColor: '#C6F6D5',
    },
    cardBonificacion: {
        backgroundColor: '#FAF5FF',
        borderWidth: 1,
        borderColor: '#E9D8FD',
    },
    cardValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E3A5F',
        fontVariant: ['tabular-nums'],
    },
    valueGood: {
        color: '#276749',
    },
    valueLow: {
        color: '#C53030',
    },
    cardLabel: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
        fontWeight: '500',
    },
    cardSubLabel: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2,
    },
});

