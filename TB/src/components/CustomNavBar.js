
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const CustomNavBar = ({ navigation, activeRoute }) => {
    const { colors } = useTheme();

    // Ordered list of routes and their display labels
    const routes = [
        { name: 'Captura Mensual', label: 'Captura Mensual' },
        { name: 'Tablero Semáforos', label: 'Tablero Semáforos' },
        { name: 'Cartas', label: 'Cartas' },
        { name: 'Historial', label: 'Historial' },
        { name: 'Config Máquinas', label: 'Config Máquinas' },
        { name: 'Listas (Operarios)', label: 'Listas' }
    ];

    return (
        <View style={[styles.navBar, { backgroundColor: colors.headerBackground, borderColor: colors.border }]}>
            {routes.map((route) => {
                const isActive = activeRoute === route.name;
                return (
                    <TouchableOpacity
                        key={route.name}
                        onPress={() => navigation.navigate(route.name)}
                        style={[
                            styles.navButton,
                            {
                                backgroundColor: isActive ? '#e8f0fe' : colors.card,
                                borderColor: isActive ? '#2196f3' : colors.border
                            }
                        ]}
                    >
                        <Text style={[
                            styles.navButtonText,
                            {
                                color: isActive ? '#1565c0' : colors.text,
                                fontWeight: isActive ? 'bold' : 'normal'
                            }
                        ]}>
                            {route.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
        paddingVertical: 10,
        marginBottom: 20,
        borderBottomWidth: 1,
        ...Platform.select({
            web: { width: '100%' }
        })
    },
    navButton: {
        padding: 8,
        borderRadius: 5,
        borderWidth: 1,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
        cursor: 'pointer' // Helps on Web, ignored on native
    },
    navButtonText: {
        fontSize: 12
    }
});

export default CustomNavBar;
