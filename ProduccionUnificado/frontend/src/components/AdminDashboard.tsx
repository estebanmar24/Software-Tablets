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
    role?: string;
    displayName?: string;
}

type TabName = 'captura' | 'tablero' | 'historial' | 'maquinas' | 'operarios' | 'cartas' | 'calidad';

const allTabs: { key: TabName; label: string; icon: string; roles: string[] }[] = [
    { key: 'captura', label: 'Captura Mensual', icon: '📝', roles: ['admin', 'produccion'] },
    { key: 'tablero', label: 'Tablero Semáforos', icon: '🚦', roles: ['admin', 'produccion'] },
    { key: 'historial', label: 'Historial', icon: '📋', roles: ['admin'] },
    { key: 'maquinas', label: 'Config Máquinas', icon: '⚙️', roles: ['admin', 'talleres'] },
    { key: 'operarios', label: 'Operarios', icon: '👥', roles: ['admin', 'gh'] },
    { key: 'calidad', label: 'Calidad', icon: '✅', roles: ['admin', 'calidad'] },
    { key: 'cartas', label: 'Cartas', icon: '📄', roles: ['admin'] },
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
    disabled?: boolean;
}

function DashboardCard({ title, description, icon, onPress, color = '#E6FFFA', disabled }: DashboardCardProps) {
    return (
        <View style={[styles.cardContainer, { backgroundColor: disabled ? '#E0E0E0' : color }, disabled && { opacity: 0.7 }]}>
            <View style={styles.cardIconContainer}>
                <Text style={[styles.cardIcon, disabled && { opacity: 0.5 }]}>{icon}</Text>
            </View>
            <Text style={[styles.cardTitle, disabled && { color: '#757575' }]}>{title}</Text>
            <Text style={[styles.cardDescription, disabled && { color: '#9E9E9E' }]}>{description}</Text>
            <TouchableOpacity
                style={[styles.cardButton, disabled && { backgroundColor: '#BDBDBD' }]}
                onPress={onPress}
                disabled={disabled}
            >
                <Text style={styles.cardButtonText}>{disabled ? 'Bloqueado' : 'Abrir'}</Text>
            </TouchableOpacity>
        </View>
    );
}

function AdminDashboardContent({ onBack, role = 'admin', displayName }: AdminDashboardProps) {
    // Mode: 'MENU' (Grid de tarjetas) | 'CONTENT' (Tabs existentes)
    const [mode, setMode] = useState<'MENU' | 'CONTENT'>('MENU');
    const [activeTab, setActiveTab] = useState<TabName>('captura');
    const { width } = useWindowDimensions();

    const tabs = allTabs.filter(t => t.roles.includes(role));

    useEffect(() => {
        if (tabs.length > 0 && !tabs.find(t => t.key === activeTab)) {
            setActiveTab(tabs[0].key);
        }
    }, [tabs, activeTab]);

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
                const validKeys = allTabs.map(t => t.key) as string[];
                if (savedTab && validKeys.includes(savedTab)) {
                    // Check if role has access
                    const tabInfo = allTabs.find(t => t.key === savedTab);
                    if (tabInfo && tabInfo.roles.includes(role)) {
                        setActiveTab(savedTab as TabName);
                    }
                }
            } catch (e) { console.log(e); }
        }
        loadTab();
    }, [role]);

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

    const isMasterEnabled = role === 'admin'; // Solo admin ve el cuadro master completo
    const isCalidadEnabled = role === 'admin' || role === 'calidad';
    const isProduccionEnabled = role === 'admin' || role === 'produccion';
    const isTalleresEnabled = role === 'admin' || role === 'talleres';
    const isPresupuestoEnabled = role === 'admin' || role === 'presupuesto';
    const isGHEnabled = role === 'admin' || role === 'gh';
    const isSSTEnabled = role === 'admin' || role === 'sst';

    const roleDisplayNames: Record<string, string> = {
        'admin': 'Administrador',
        'sst': 'Seguridad y Salud en el Trabajo',
        'gh': 'Gestión Humana',
        'produccion': 'Producción',
        'talleres': 'Talleres y Despachos',
        'presupuesto': 'Presupuesto General',
        'calidad': 'Calidad'
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
                        <Text style={styles.menuSubtitle}>
                            Usuario: {displayName || roleDisplayNames[role] || role.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.cardsGrid} showsVerticalScrollIndicator={false}>
                    <DashboardCard
                        title="Cuadro Master"
                        description="Indicadores generales de gestión"
                        icon="📊"
                        onPress={() => { setActiveTab('captura'); setMode('CONTENT'); }}
                        disabled={!isMasterEnabled}
                    />
                    <DashboardCard
                        title="Cuadro Presupuestos Producción"
                        description="Control de presupuestos de producción"
                        icon="🏭"
                        onPress={() => handlePlaceholderPress('Presupuestos Producción')}
                        disabled={!isProduccionEnabled}
                    />
                    <DashboardCard
                        title="Cuadro Presupuesto Talleres y Despachos"
                        description="Costos de talleres y despachos"
                        icon="🔧"
                        onPress={() => handlePlaceholderPress('Talleres y Despachos')}
                        disabled={!isTalleresEnabled}
                    />
                    <DashboardCard
                        title="Presupuesto"
                        description="Gestión global de presupuestos"
                        icon="💰"
                        onPress={() => handlePlaceholderPress('Presupuesto')}
                        disabled={!isPresupuestoEnabled}
                    />
                    <DashboardCard
                        title="Gestión Humana"
                        description="Información de personal y equipos"
                        icon="👥"
                        onPress={() => handlePlaceholderPress('Gestión Humana')}
                        disabled={!isGHEnabled}
                    />
                    <DashboardCard
                        title="Presupuestos SST"
                        description="Seguimiento de presupuestos SST"
                        icon="📋"
                        onPress={() => handlePlaceholderPress('SST')}
                        disabled={!isSSTEnabled}
                    />
                </ScrollView>
            </View>
        </View>
    );
}

export function AdminDashboard({ onBack, role, displayName }: AdminDashboardProps) {
    return (
        <ThemeProvider>
            <AdminDashboardContent onBack={onBack} role={role} displayName={displayName} />
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
