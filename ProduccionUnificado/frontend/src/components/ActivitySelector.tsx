import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Actividad } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface ActivitySelectorProps {
    actividades: Actividad[];
    selectedActividad: Actividad | null;
    onSelect: (actividad: Actividad) => void;
    disabled: boolean;
}

export function ActivitySelector({
    actividades,
    selectedActividad,
    onSelect,
    disabled,
}: ActivitySelectorProps) {
    const { colors, isDarkMode } = useTheme();
    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Seleccionar Actividad</Text>
            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.chipsContainer}>
                    {actividades.map((actividad) => {
                        const isSelected = selectedActividad?.id === actividad.id;
                        return (
                            <TouchableOpacity
                                key={actividad.id}
                                style={[
                                    styles.chip,
                                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                                    isSelected && [styles.chipSelected, { backgroundColor: colors.primary, borderColor: colors.primary }],
                                    disabled && styles.chipDisabled,
                                ]}
                                onPress={() => !disabled && onSelect(actividad)}
                                disabled={disabled}
                            >
                                <Text style={[styles.chipCode, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.primary }]}>{actividad.codigo}</Text>
                                <Text
                                    style={[
                                        styles.chipName,
                                        { color: colors.text },
                                        isSelected && styles.chipNameSelected,
                                    ]}
                                    numberOfLines={2}
                                >
                                    {actividad.nombre}
                                </Text>
                                {isSelected && (
                                    <Text style={styles.checkmark}>✓</Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
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
    scrollContainer: {
        maxHeight: 280,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        backgroundColor: '#F5F7FA',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 2,
        borderColor: '#E8ECF0',
        minWidth: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chipSelected: {
        backgroundColor: '#96BDF0',
        borderColor: '#96BDF0',
    },
    chipProductiva: {
        borderColor: '#28A745',
        backgroundColor: '#F0FFF4',
    },
    chipProductivaSelected: {
        backgroundColor: '#28A745',
        borderColor: '#28A745',
    },
    chipDisabled: {
        opacity: 0.5,
    },
    chipCode: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF', // Blanco sobre fondo azul
        backgroundColor: '#96BDF0', // Azul marca
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    chipName: {
        fontSize: 13,
        color: '#000000',
        flex: 1,
    },
    chipNameSelected: {
        color: '#FFFFFF',
    },
    checkmark: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
