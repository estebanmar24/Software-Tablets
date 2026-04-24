import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface InventarioMantenimientoScreenProps {
    onBack: () => void;
}

const InventarioMantenimientoScreen: React.FC<InventarioMantenimientoScreenProps> = ({ onBack }) => {
    const { colors, isDarkMode } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB', borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={[styles.backButtonText, { color: colors.primary }]}>← Volver</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Inventario de Mantenimiento</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Módulo en Desarrollo</Text>
                    <Text style={[styles.cardText, { color: colors.subText }]}>
                        Este módulo permitirá gestionar el inventario de repuestos y herramientas de mantenimiento.
                    </Text>
                    <View style={styles.placeholderIcon}>
                        <Text style={{ fontSize: 60 }}>📦</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 5,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
        alignItems: 'center',
    },
    card: {
        width: '100%',
        maxWidth: 600,
        padding: 30,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    cardText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 25,
    },
    placeholderIcon: {
        marginTop: 20,
    }
});

export default InventarioMantenimientoScreen;
