import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, useWindowDimensions, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens from the Production System
import CaptureGridScreen from '../screens/CaptureGridScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MachineParamsScreen from '../screens/MachineParamsScreen';
import ListsScreen from '../screens/ListsScreen';
import CartasScreen from '../screens/CartasScreen';
import QualityView from './QualityView';

// Theme Provider
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

interface AdminDashboardProps {
    onBack: () => void;
}

type TabName = 'captura' | 'tablero' | 'historial' | 'maquinas' | 'operarios' | 'cartas' | 'calidad';

const tabs: { key: TabName; label: string; icon: string }[] = [
    { key: 'captura', label: 'Captura Mensual', icon: '📝' },
    { key: 'tablero', label: 'Tablero Semáforos', icon: '🚦' },
    { key: 'historial', label: 'Historial', icon: '📋' },
    { key: 'maquinas', label: 'Config Máquinas', icon: '⚙️' },
    { key: 'operarios', label: 'Operarios', icon: '👥' },
    { key: 'calidad', label: 'Calidad', icon: '✅' },
    { key: 'cartas', label: 'Cartas', icon: '📄' },
];

/**
 * COMPONENTE DE TARJETA DEL DASHBOARD
 */
interface DashboardCardProps {
    title: string;
    description: string;
    icon: string;
    onPress: () => void;
    color?: string;
}

function DashboardCard({ title, description, icon, onPress, color = '#E6FFFA' }: DashboardCardProps) {
    return (
        <View style={[styles.cardContainer, { backgroundColor: color }]}>
            <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>{icon}</Text>
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription}>{description}</Text>
            <TouchableOpacity style={styles.cardButton} onPress={onPress}>
                <Text style={styles.cardButtonText}>Abrir</Text>
            </TouchableOpacity>
        </View>
    );
}

function AdminDashboardContent({ onBack }: AdminDashboardProps) {
    // Mode: 'MENU' (Grid de tarjetas) | 'CONTENT' (Tabs existentes)
    const [mode, setMode] = useState<'MENU' | 'CONTENT'>('MENU');
    const [activeTab, setActiveTab] = useState<TabName>('captura');
    const { width } = useWindowDimensions();

    useEffect(() => {
        async function loadTab() {
            try {
                // Use localStorage for web, AsyncStorage for mobile
                let savedTab: string | null = null;
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                    savedTab = window.localStorage.getItem('adminActiveTab');
                } else {
                    savedTab = await AsyncStorage.getItem('adminActiveTab');
                }
                if (savedTab && ['captura', 'tablero', 'historial', 'maquinas', 'operarios', 'cartas', 'calidad'].includes(savedTab)) {
                    setActiveTab(savedTab as TabName);
                }
            } catch (e) { console.log(e); }
        }
        loadTab();
    }, []);

    useEffect(() => {
        // Save to localStorage on web, AsyncStorage on mobile
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('adminActiveTab', activeTab);
        } else {
            AsyncStorage.setItem('adminActiveTab', activeTab);
        }
    }, [activeTab]);

    // Mock navigation object for screens that expect navigation prop
    const mockNavigation = {
        navigate: (screen: string, params?: any) => {
            console.log('Navigate to:', screen, params);
            // Map screen names to tabs
            const screenToTab: Record<string, TabName> = {
                'Captura Mensual': 'captura',
                'Tablero Semáforos': 'tablero',
                'Historial': 'historial',
                'Calidad': 'calidad',
                'Config Máquinas': 'maquinas',
                'Listas (Operarios)': 'operarios',
                'Cartas': 'cartas',
            };
            if (screenToTab[screen]) {
                setActiveTab(screenToTab[screen]);
            }
        },
        addListener: (event: string, callback: () => void) => {
            // Return unsubscribe function
            return () => { };
        },
        goBack: () => setMode('MENU'), // Volver al menú principal
    };

    const renderActiveScreen = () => {
        switch (activeTab) {
            case 'captura':
                return <CaptureGridScreen navigation={mockNavigation} />;
            case 'tablero':
                return <DashboardScreen navigation={mockNavigation} />;
            case 'historial':
                return <HistoryScreen navigation={mockNavigation} />;
            case 'maquinas':
                return <MachineParamsScreen navigation={mockNavigation} />;
            case 'operarios':
                return <ListsScreen navigation={mockNavigation} />;
            case 'calidad':
                return <QualityView />;
            case 'cartas':
                return <CartasScreen navigation={mockNavigation} />;
            default:
                return null;
        }
    };

    // --- VISTA CONTENT (SISTEMA ACTUAL) ---
    if (mode === 'CONTENT') {
        return (
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setMode('MENU')}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Administración Master</Text>
                    <View style={{ width: 120 }} />
                </View>

                {/* Tab Navigation */}
                <View style={styles.tabBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
                        {tabs.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text style={styles.tabIcon}>{tab.icon}</Text>
                                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {renderActiveScreen()}
                </View>
            </View>
        );
    }

    // --- VISTA MENU (NUEVO DASHBOARD) ---
    const handlePlaceholderPress = (moduleName: string) => {
        Alert.alert('Próximamente', `El módulo "${moduleName}" estará disponible pronto.`);
    };

    return (
        <View style={styles.menuContainer}>
            <View style={styles.panelContainer}>
                <View style={styles.menuHeader}>
                    <TouchableOpacity style={styles.backButtonSimple} onPress={onBack}>
                        <Text style={styles.backButtonSimpleText}>← Salir</Text>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.menuTitle}>Panel del Administrador</Text>
                        <Text style={styles.menuSubtitle}>Selecciona un módulo para administrar la información de la organización.</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.cardsGrid} showsVerticalScrollIndicator={false}>
                    <DashboardCard
                        title="Cuadro Master"
                        description="Indicadores generales de gestión"
                        icon="📊" // Chart
                        onPress={() => setMode('CONTENT')}
                    />
                    <DashboardCard
                        title="Cuadro Presupuestos Producción"
                        description="Control de presupuestos de producción"
                        icon="🏭" // Factory
                        onPress={() => handlePlaceholderPress('Cuadro Presupuestos Producción')}
                    />
                    <DashboardCard
                        title="Cuadros Presupuesto Talleres y Despachos"
                        description="Costos de talleres y despachos"
                        icon="🚚" // Truck
                        onPress={() => handlePlaceholderPress('Cuadros Presupuesto Talleres y Despachos')}
                    />
                    <DashboardCard
                        title="Presupuesto"
                        description="Gestión global de presupuestos"
                        icon="💰" // Money bag
                        onPress={() => handlePlaceholderPress('Presupuesto')}
                    />
                    <DashboardCard
                        title="Gestión Humana"
                        description="Información de personal y equipos"
                        icon="👥" // Users
                        onPress={() => handlePlaceholderPress('Gestión Humana')}
                    />
                    <DashboardCard
                        title="Presupuestos SST"
                        description="Seguimiento de presupuestos SST"
                        icon="📋" // Clipboard
                        onPress={() => handlePlaceholderPress('Presupuestos SST')}
                    />
                </ScrollView>
            </View>
        </View>
    );
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
    return (
        <ThemeProvider>
            <AdminDashboardContent onBack={onBack} />
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    // Styles for MENU Mode
    menuContainer: {
        flex: 1,
        backgroundColor: '#96BDF0', // Updated blue color requested by user
        padding: 40, // Padding around the main white panel
        justifyContent: 'center', // Center vertically
        alignItems: 'center', // Center horizontally
    },
    panelContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 30,
        width: '100%',
        maxWidth: 1200, // Max width for large screens
        flex: 1, // Take available height
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    menuHeader: {
        marginBottom: 30,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonSimple: {
        marginRight: 20,
        padding: 10,
    },
    backButtonSimpleText: {
        fontSize: 16,
        color: '#2D3748',
        fontWeight: 'bold',
    },
    menuTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    menuSubtitle: {
        fontSize: 16,
        color: '#718096',
        marginTop: 5,
    },
    cardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 20,
        paddingBottom: 20,
    },
    // Card Component Styles
    cardContainer: {
        width: 280,
        height: 320,
        backgroundColor: '#E6FFFA', // Light green-ish tint from screenshot
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    cardIcon: {
        fontSize: 40,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        textAlign: 'center',
        marginBottom: 5,
    },
    cardDescription: {
        fontSize: 14,
        color: '#718096',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    cardButton: {
        backgroundColor: '#3182CE', // Blue button
        paddingVertical: 10,
        paddingHorizontal: 30,
        borderRadius: 25,
        width: '80%',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Existing Styles for CONTENT Mode
    header: {
        backgroundColor: '#2D3748',
        padding: 16,
        paddingTop: Platform.OS === 'web' ? 16 : 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    backButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontWeight: '500',
    },
    tabBar: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    tabScrollContent: {
        paddingHorizontal: 10,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginHorizontal: 4,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#4299E1',
        backgroundColor: '#EBF8FF',
    },
    tabIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    tabText: {
        fontSize: 14,
        color: '#718096',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#2B6CB0',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
});
