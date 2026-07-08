import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AlmacenContadorBadgeProps {
    count: number;
    /** Color del estado o categoría (ej. #F59E0B, #22C55E). */
    accentColor?: string;
    variant?: 'filtro' | 'tab';
    activo?: boolean;
    /** Pendiente / en tránsito: resaltar en rojo cuando hay ítems por atender. */
    destacarPendiente?: boolean;
}

export default function AlmacenContadorBadge({
    count,
    accentColor = '#3B82F6',
    variant = 'filtro',
    activo = false,
    destacarPendiente = false,
}: AlmacenContadorBadgeProps) {
    const tieneItems = count > 0;

    let bg = accentColor;
    if (!tieneItems) {
        bg = '#CBD5E1';
    } else if (destacarPendiente && !activo) {
        bg = '#EF4444';
    }

    const size = tieneItems ? 20 : 18;
    const fontSize = tieneItems ? 10 : 9;

    return (
        <View
            style={[
                styles.badge,
                variant === 'tab' ? styles.badgeTab : styles.badgeFiltro,
                {
                    minWidth: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: bg,
                    opacity: tieneItems ? 1 : 0.55,
                },
            ]}
        >
            <Text style={[styles.text, { fontSize, lineHeight: fontSize + 2 }]}>{count}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeFiltro: {
        marginLeft: 10,
    },
    badgeTab: {
        marginLeft: 12,
    },
    text: {
        color: '#FFFFFF',
        fontWeight: '600',
        textAlign: 'center',
    },
});
