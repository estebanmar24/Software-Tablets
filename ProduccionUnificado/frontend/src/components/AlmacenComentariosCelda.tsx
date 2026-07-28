import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    type Requisicion,
    previewUltimoComentario,
    contarComentariosRequisicion,
} from '../data/almacenMockData';

type ThemeColors = {
    primary: string;
    subText: string;
    text: string;
};

interface AlmacenComentariosCeldaProps {
    requisicion: Requisicion;
    onPress: () => void;
    colors: ThemeColors;
}

export default function AlmacenComentariosCelda({
    requisicion: req,
    onPress,
    colors,
}: AlmacenComentariosCeldaProps) {
    const total =
        req.totalComentarios ??
        (contarComentariosRequisicion(req.comentarios) || (req.observacion?.trim() ? 1 : 0));
    const preview = previewUltimoComentario(req);

    return (
        <TouchableOpacity
            style={styles.celda}
            onPress={onPress}
            accessibilityLabel={`Ver comentarios de ${req.codigo}`}
        >
            <View style={styles.top}>
                <MaterialCommunityIcons
                    name="comment-text-outline"
                    size={16}
                    color={total > 0 ? colors.primary : colors.subText}
                />
                <Text style={[styles.contador, { color: total > 0 ? colors.primary : colors.subText }]}>
                    {total}
                </Text>
            </View>
            <Text
                style={[styles.preview, { color: preview ? colors.text : colors.subText }]}
                numberOfLines={2}
            >
                {preview || 'Sin comentarios'}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    celda: {
        paddingVertical: 2,
        gap: 4,
    },
    top: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    contador: {
        fontSize: 12,
        fontWeight: '800',
    },
    preview: {
        fontSize: 12,
        lineHeight: 16,
    },
});
