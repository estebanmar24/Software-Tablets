import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
    type EstadoRequisicion,
    getEstadoRequisicionStyle,
} from '../data/almacenMockData';

interface AlmacenEstadoBadgeProps {
    estado: EstadoRequisicion;
}

/** Badge unificado para Requisición, Pedidos y Recepción. */
export default function AlmacenEstadoBadge({ estado }: AlmacenEstadoBadgeProps) {
    const config = getEstadoRequisicionStyle(estado);

    return (
        <View style={[styles.pill, { backgroundColor: config.bg, borderColor: config.border }]}>
            <Text style={[styles.text, { color: config.text }]}>{estado}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    text: { fontSize: 13, fontWeight: '600' },
});
