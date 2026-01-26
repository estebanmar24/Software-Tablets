import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert } from 'react-native';

interface ProductionCardProps {
    onAddTiros: (value: number) => void;
    onOpenWasteModal: () => void;
    disabled?: boolean;
}

export function ProductionCard({ onAddTiros, onOpenWasteModal, disabled = false }: ProductionCardProps) {
    const [tirosInput, setTirosInput] = useState('');

    const handleAddTiros = () => {
        if (disabled) return;
        const value = parseInt(tirosInput, 10);
        if (!isNaN(value) && value > 0) {
            onAddTiros(value);
            setTirosInput('');
        }
    };

    return (
        <View style={[styles.container, disabled && styles.containerDisabled]}>
            <Text style={[styles.title, disabled && styles.textDisabled]}>REGISTRO DE PRODUCCIÓN</Text>

            <View style={styles.section}>
                <Text style={[styles.label, disabled && styles.textDisabled]}>Tiros</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={[
                            styles.input,
                            disabled && styles.inputDisabled,
                            // @ts-ignore
                            Platform.OS === 'web' && { outlineWidth: 0 }
                        ]}
                        value={tirosInput}
                        onChangeText={(text) => {
                            if (/^\d*$/.test(text)) {
                                setTirosInput(text);
                            } else {
                                Alert.alert("Error", "Solo se permiten números enteros");
                            }
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={disabled ? "#CBD5E0" : "#A0AEC0"}
                        editable={!disabled}
                    />
                    <TouchableOpacity
                        style={[styles.addButton, disabled && styles.buttonDisabled]}
                        onPress={handleAddTiros}
                        disabled={disabled}
                    >
                        <Text style={styles.addButtonText}>Agregar</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.section, { marginTop: 10 }]}>
                <TouchableOpacity
                    style={[styles.wasteButton, disabled && styles.buttonDisabled]}
                    onPress={onOpenWasteModal}
                    disabled={disabled}
                >
                    <Text style={styles.wasteButtonText}>AGREGAR DESPERDICIO</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    containerDisabled: {
        backgroundColor: '#F7FAFC',
        borderColor: '#E2E8F0',
        opacity: 0.8,
    },
    textDisabled: {
        color: '#A0AEC0',
    },
    inputDisabled: {
        backgroundColor: '#EDF2F7',
        color: '#A0AEC0',
        borderColor: '#CBD5E0',
    },
    buttonDisabled: {
        backgroundColor: '#CBD5E0',
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#718096',
        marginBottom: 20,
        textTransform: 'uppercase',
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#718096',
        marginBottom: 8,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    input: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E8ECF0', // Mismo color que los bordes de actividades
        borderRadius: 8, // Igual que las actividades
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#2D3748',
    },
    addButton: {
        backgroundColor: '#9AE6B4', // Greenish
        borderRadius: 6,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
    },
    addButtonScrap: {
        backgroundColor: '#FC8181', // Reddish for scrap/desperdicio? Or same?
        // Mockup shows distinct colors maybe? Or same?
        // Let's use the same green for "AddTo" distinct for semantic?
        // Mock shows "Agregar" in Green. Both seem green in some UIs but maybe "Scrap" is implicit.
        // Let's keep Green for adding.

    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    wasteButton: {
        backgroundColor: '#E53E3E', // Rojo intenso
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wasteButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
