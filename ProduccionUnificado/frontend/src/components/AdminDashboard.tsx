import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
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

function AdminDashboardContent({ onBack }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<TabName>('captura');

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
        goBack: onBack,
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

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={styles.backButtonText}>← Volver al Timer</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Panel de Administración</Text>
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
