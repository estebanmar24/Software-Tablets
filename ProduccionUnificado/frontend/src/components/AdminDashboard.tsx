import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, useWindowDimensions, Image, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens from the Production System
import CaptureGridScreen from '../screens/CaptureGridScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MachineParamsScreen from '../screens/MachineParamsScreen';
import ListsScreen from '../screens/ListsScreen';
import CartasScreen from '../screens/CartasScreen';
import QualityView from './QualityView';
import EquipmentMaintenanceScreen from '../screens/EquipmentMaintenanceScreen';
import SSTPresupuestosScreen from '../screens/SSTPresupuestosScreen';
import SSTGastosScreen from '../screens/SSTGastosScreen';
import GHGastosScreen from '../screens/GHGastosScreen';
import ProduccionGastosScreen from '../screens/ProduccionGastosScreen';
import TalleresGastosScreen from '../screens/TalleresGastosScreen';
import DesperdicioScreen from '../screens/DesperdicioScreen';
// @ts-ignore
const DesperdicioScreenComp: any = DesperdicioScreen;
import CalidadDashboard from './CalidadDashboard';
import PlaneacionGastosScreen from '../screens/PlaneacionGastosScreen';
import DisenoGastosScreen from '../screens/DisenoGastosScreen';
import TicketsScreen from '../screens/TicketsScreen';
import MantenimientoGastosScreen from '../screens/MantenimientoGastosScreen';
import CalidadExternaView from './CalidadExternaView';
import PlanAccionView from './PlanAccionView';
import UserManagementScreen from '../screens/UserManagementScreen';
import MaquinasScreen from '../screens/MaquinasScreen';
import { api } from '../services/productionApi';


// Theme Provider
import { ThemeProvider, useTheme, ThemeContext, lightColors } from '../contexts/ThemeContext';

interface AdminDashboardProps {
    onBack: () => void;
    role?: string;
    displayName?: string;
    area?: string;
}

type TabName = 'captura' | 'desperdicio' | 'tablero' | 'historial' | 'maquinas' | 'operarios' | 'cartas' | 'calidad' | 'calidadExterna';

const allTabs: { key: TabName; label: string; icon: string; roles: string[] }[] = [
    { key: 'captura', label: 'Captura Mensual', icon: '📝', roles: ['admin', 'master', 'produccion'] },
    { key: 'desperdicio', label: 'Desperdicio', icon: '🗑️', roles: ['admin', 'master', 'produccion'] },
    { key: 'tablero', label: 'Tablero Semáforos', icon: '🚦', roles: ['admin', 'master', 'produccion'] },
    { key: 'historial', label: 'Historial', icon: '📋', roles: ['admin', 'master'] },
    { key: 'maquinas', label: 'Config Máquinas', icon: '⚙️', roles: ['admin', 'master', 'talleres'] },
    { key: 'operarios', label: 'Operarios', icon: '👥', roles: ['admin', 'master', 'gh'] },
    { key: 'calidad', label: 'Novedades de OP y Calidad', icon: '✅', roles: ['admin', 'master', 'calidad'] },
    { key: 'cartas', label: 'Cartas', icon: '📄', roles: ['admin', 'master'] },
    { key: 'calidadExterna', label: 'Calidad Externa', icon: '🏭', roles: ['admin', 'calidad', 'modulo_calidad'] },
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

function DashboardCard({ title, description, icon, onPress, color, disabled }: DashboardCardProps) {
    const { colors, isDarkMode } = useTheme();

    const cardBg = disabled
        ? (isDarkMode ? '#1F2937' : '#E0E0E0')
        : (isDarkMode ? '#111827' : (color || '#E6FFFA'));

    const iconContainerBg = isDarkMode ? '#020617' : '#FFFFFF';

    return (
        <View style={[
            styles.cardContainer,
            { backgroundColor: cardBg, borderColor: isDarkMode ? '#1F2937' : colors.border, borderWidth: isDarkMode ? 1 : 0 },
            disabled && { opacity: 0.6 }
        ]}>
            <View style={[styles.cardIconContainer, { backgroundColor: iconContainerBg }]}>
                <Text style={[styles.cardIcon, disabled && { opacity: 0.5 }]}>{icon}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.cardDescription, { color: colors.subText }]}>{description}</Text>
            <TouchableOpacity
                style={[styles.cardButton, { backgroundColor: isDarkMode ? colors.primary : '#3182CE' }, disabled && { backgroundColor: isDarkMode ? '#374151' : '#BDBDBD' }]}
                onPress={onPress}
                disabled={disabled}
            >
                <Text style={styles.cardButtonText}>{disabled ? 'Bloqueado' : 'Abrir'}</Text>
            </TouchableOpacity>
        </View>
    );
}

function AdminDashboardContent({ onBack, role = 'admin', displayName, area }: AdminDashboardProps) {
    const { colors, isDarkMode } = useTheme();
    // Mode: 'MENU' | 'CONTENT' ...
    const [mode, setMode] = useState<'MENU' | 'CONTENT' | 'EQUIPOS' | 'SST_PRESUPUESTO' | 'SST_GASTOS' | 'GH_GASTOS' | 'PRODUCCION_GASTOS' | 'MANTENIMIENTO_GASTOS' | 'TALLERES_GASTOS' | 'CALIDAD' | 'PLANEACION_GASTOS' | 'DISENO_GASTOS' | 'TICKETS' | 'CALIDAD_EXTERNA' | 'PLANES_ACCION' | 'USUARIOS' | 'MAQUINAS'>(() => {

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            const savedMode = window.localStorage.getItem('adminDashboardMode');
            if (savedMode === 'CONTENT' || savedMode === 'EQUIPOS' || savedMode === 'MENU' || savedMode === 'SST_PRESUPUESTO' || savedMode === 'SST_GASTOS' || savedMode === 'GH_GASTOS' || savedMode === 'PRODUCCION_GASTOS' || savedMode === 'MANTENIMIENTO_GASTOS' || savedMode === 'TALLERES_GASTOS' || savedMode === 'CALIDAD' || savedMode === 'PLANEACION_GASTOS' || savedMode === 'DISENO_GASTOS' || savedMode === 'TICKETS' || savedMode === 'CALIDAD_EXTERNA' || savedMode === 'PLANES_ACCION' || savedMode === 'USUARIOS' || savedMode === 'MAQUINAS') {

                return savedMode as any;
            }
        }
        return 'MENU';
    });
    const [activeTab, setActiveTab] = useState<string>('captura');
    const [qualityTitle, setQualityTitle] = useState<string>('Control en Proceso de Calidad y Novedades');
    const [pendingPlansCount, setPendingPlansCount] = useState(0);
    const [resumen, setResumen] = useState<any>(null);
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const userRoles = (role || '').split(',').map(r => r.trim().toLowerCase());
    const tabs = allTabs.filter(t => t.roles && t.roles.some(r => userRoles.includes(r)));

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
                    if (tabInfo && tabInfo.roles.some(r => userRoles.includes(r))) {
                        setActiveTab(savedTab as TabName);
                    }
                }
            } catch (e) { console.log(e); }
        }
        loadTab();
    }, [role]);

    useEffect(() => {
        if (area) {
            const fetchCount = async () => {
                try {
                    const res = await api.get(`planaccion/pendientes/area/${encodeURIComponent(area)}/count`);
                    setPendingPlansCount(res.data);
                } catch (e) {
                    // Ignore gracefully
                }
            };
            fetchCount();
        }
    }, [area]);

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
            case 'desperdicio':
                return <DesperdicioScreenComp navigation={mockNavigation} />;
            case 'tablero':
                return <DashboardScreen navigation={mockNavigation} />;
            case 'historial':
                return <HistoryScreen navigation={mockNavigation} />;
            case 'maquinas':
                return <MachineParamsScreen navigation={mockNavigation} />;
            case 'operarios':
                return <ListsScreen navigation={mockNavigation} />;
            case 'calidad':
                return <QualityView navigation={mockNavigation} />;
            case 'cartas':
                return <CartasScreen navigation={mockNavigation} />;
            case 'calidadExterna':
                return <CalidadExternaView />;
            default:
                return null;
        }
    };

    // --- VISTA EQUIPOS (MANTENIMIENTO) ---
    if (mode === 'EQUIPOS') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Mantenimiento de Equipos</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <EquipmentMaintenanceScreen onBack={() => { }} />
            </View>
        );
    }

    // --- VISTA SST PRESUPUESTOS (ADMIN) ---
    if (mode === 'SST_PRESUPUESTO') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gestión de Presupuestos</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <SSTPresupuestosScreen />
            </View>
        );
    }

    // --- VISTA SST GASTOS ---
    if (mode === 'SST_GASTOS') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Captura de Gastos SST</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <SSTGastosScreen navigation={mockNavigation} />
            </View>
        );
    }

    // --- VISTA GH (GESTIÓN HUMANA) GASTOS ---
    if (mode === 'GH_GASTOS') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gestión Humana - Gastos</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <GHGastosScreen navigation={mockNavigation} />
            </View>
        );
    }

    // --- VISTA PRODUCCION GASTOS ---
    if (mode === 'PRODUCCION_GASTOS') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gastos de Producción</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <ProduccionGastosScreen />
            </View>
        );
    }

    // --- VISTA PLANEACION GASTOS ---
    if (mode === 'PLANEACION_GASTOS') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gastos de Planeación</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <PlaneacionGastosScreen navigation={{ goBack: () => setMode('MENU') } as any} />
            </View>
        );
    }

    // --- VISTA PLANEADOR DE MAQUINAS ---
    if (mode === 'CALIDAD_EXTERNA') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Planeación de Máquinas</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <CalidadExternaView />
            </View>
        );
    }


    // --- VISTA DISENO GASTOS ---
    if (mode === 'DISENO_GASTOS') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gastos de Diseño</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <DisenoGastosScreen />
            </View>
        );
    }

    // --- VISTA TALLERES Y DESPACHOS GASTOS ---
    if (mode === 'TALLERES_GASTOS') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gastos de Talleres y Despachos</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <TalleresGastosScreen navigation={{ goBack: () => setMode('MENU') } as any} />
            </View>
        );
    }

    // --- VISTA CALIDAD (DASHBOARD INDEPENDIENTE) ---
    if (mode === 'CALIDAD') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>{qualityTitle}</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <CalidadDashboard
                    onTabChange={setQualityTitle}
                    navigation={mockNavigation}
                    userArea={area}
                    userRole={role}
                />
            </View>
        );
    }

    // --- VISTA TICKETS ---
    if (mode === 'TICKETS') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Tickets de Errores</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <TicketsScreen displayName={displayName} />
            </View>
        );
    }

    // --- VISTA MANTENIMIENTO GASTOS ---
    if (mode === 'MANTENIMIENTO_GASTOS') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gastos de Mantenimiento</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                {/* @ts-ignore */}
                <MantenimientoGastosScreen />
            </View>
        );
    }

    // --- VISTA PLANES DE ACCION ---
    if (mode === 'PLANES_ACCION') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Planes de Acción</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <PlanAccionView
                    userArea={area}
                    userRole={role}
                    canCreate={false}
                    onClose={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}
                />
            </View>
        );
    }

    // --- VISTA USUARIOS ---
    if (mode === 'USUARIOS') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Gestión de Usuarios</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <UserManagementScreen onBack={() => {
                    setMode('MENU');
                    if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                }} />
            </View>
        );
    }

    // --- VISTA MAQUINAS ---
    if (mode === 'MAQUINAS') {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        setMode('MENU');
                        if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                    }}>
                        <Text style={styles.backButtonText}>← Volver al Panel</Text>
                    </TouchableOpacity>
                    <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                        <Text style={styles.title}>Módulo de Máquinas</Text>
                    </View>
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.contentHeaderLogo, isDarkMode && { opacity: 0.95 }]}
                        resizeMode="contain"
                    />
                </View>
                <MaquinasScreen />
            </View>
        );
    }

    // --- VISTA CONTENT (SISTEMA ACTUAL) ---
    if (mode === 'CONTENT') {
        return (
            <ThemeContext.Provider value={{ isDarkMode: false, toggleTheme: () => { }, colors: lightColors }}>
                <View style={[styles.container, { backgroundColor: lightColors.background }]}>
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: lightColors.headerBackground }]}>
                        <TouchableOpacity style={styles.backButton} onPress={() => {
                            setMode('MENU');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MENU');
                        }}>
                            <Text style={styles.backButtonText}>← Volver al Panel</Text>
                        </TouchableOpacity>
                        <View style={styles.centeredTitleContainer} pointerEvents="box-none">
                            <Text style={styles.title}>Administración Master</Text>
                        </View>
                        <Image
                            source={require('../../assets/logo_perla.png')}
                            style={[styles.contentHeaderLogo]}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Tab Navigation */}
                    <View style={[styles.tabBar, { backgroundColor: lightColors.card, borderBottomColor: lightColors.border }]}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
                            {tabs.map((tab) => (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[
                                        styles.tab,
                                        activeTab === tab.key && [styles.activeTab, { borderBottomColor: '#4299E1', backgroundColor: '#EBF8FF' }]
                                    ]}
                                    onPress={() => setActiveTab(tab.key)}
                                >
                                    <Text style={[styles.tabIcon, { color: activeTab === tab.key ? '#4299E1' : lightColors.subText }]}>{tab.icon}</Text>
                                    <Text style={[
                                        styles.tabText,
                                        { color: lightColors.subText },
                                        activeTab === tab.key && [styles.activeTabText, { color: '#4299E1' }]
                                    ]}>
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
            </ThemeContext.Provider>
        );
    }

    // --- VISTA MENU (NUEVO DASHBOARD) ---
    const handlePlaceholderPress = (moduleName: string) => {
        Alert.alert('Próximamente', `El módulo "${moduleName}" estará disponible pronto.`);
    };

    const isMasterEnabled = userRoles.includes('admin') || userRoles.includes('master');
    const isCalidadEnabled = userRoles.includes('admin') || userRoles.includes('modulo_calidad');
    const isProduccionEnabled = userRoles.includes('admin') || userRoles.includes('produccion');
    const isTalleresEnabled = userRoles.includes('admin') || userRoles.includes('talleres');
    const isPresupuestoEnabled = userRoles.includes('admin') || userRoles.includes('presupuesto');
    const isGHEnabled = userRoles.includes('admin') || userRoles.includes('gh');
    const isSSTEnabled = userRoles.includes('admin') || userRoles.includes('sst');
    const isEquiposEnabled = userRoles.includes('admin') || userRoles.includes('equipos');
    const isMantenimientoEnabled = userRoles.includes('admin') || userRoles.includes('mantenimiento') || userRoles.includes('talleres');
    const isPlaneacionEnabled = userRoles.includes('admin') || userRoles.includes('planeacion');
    const isDisenoEnabled = userRoles.includes('admin') || userRoles.includes('diseno');
    const isPlaneadorEnabled = userRoles.includes('admin') || userRoles.includes('calidad') || userRoles.includes('modulo_calidad') || userRoles.includes('planeador');
    const isMaquinasEnabled = userRoles.includes('admin') || userRoles.includes('maquinas');

    const roleDisplayNames: Record<string, string> = {
        'admin': 'Administrador',
        'sst': 'Seguridad y Salud en el Trabajo',
        'gh': 'Gestión Humana',
        'produccion': 'Producción',
        'talleres': 'Talleres y Despachos',
        'presupuesto': 'Presupuesto General',
        'calidad': 'Control en proceso de Novedades de OP y Calidad',
        'modulo_calidad': 'Módulo Novedades de OP y Calidad',
        'equipos': 'Mantenimiento Equipos',
        'planeacion': 'Planeación',
        'planeador': 'Planeador de Máquinas',
        'maquinas': 'Maquinas',
        'diseno': 'Diseño'
    };

    return (
        <View style={[styles.menuContainer, { backgroundColor: isDarkMode ? colors.background : '#96BDF0' }]}>
            <View style={[styles.panelContainer, { backgroundColor: isDarkMode ? '#05070A' : '#FFFFFF' }]}>
                <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.backButtonSimple} onPress={onBack}>
                        <Text style={[styles.backButtonSimpleText, { color: colors.text }]}>← Salir</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1, paddingRight: isMobile ? 0 : 250 }}>
                        <Text style={[styles.menuTitle, { color: colors.text, fontSize: isMobile ? 22 : 28 }]}>Panel del Administrador</Text>
                        <Text style={[styles.menuSubtitle, { color: colors.subText, fontSize: isMobile ? 14 : 16 }]}>
                            Usuario: {displayName || roleDisplayNames[role] || role.toUpperCase()}
                        </Text>
                    </View>
                    {!isMobile && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                                style={[styles.ticketHeaderBtn, { marginRight: 15 }]}
                                onPress={() => {
                                    setMode('PLANES_ACCION');
                                    if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'PLANES_ACCION');
                                }}
                            >
                                <Text style={{ fontSize: 20 }}>🎯</Text>
                                <Text style={[styles.ticketHeaderBtnText, { color: colors.text }]}>Planes Acción</Text>
                                {pendingPlansCount > 0 && (
                                    <View style={{
                                        position: 'absolute', top: -10, right: -10, backgroundColor: 'red',
                                        borderRadius: 15, paddingHorizontal: 8, paddingVertical: 2,
                                        minWidth: 24, alignItems: 'center'
                                    }}>
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>{pendingPlansCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.ticketHeaderBtn}
                                onPress={() => {
                                    setMode('TICKETS');
                                    if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'TICKETS');
                                }}
                            >
                                <Text style={{ fontSize: 20 }}>🎫</Text>
                                <Text style={[styles.ticketHeaderBtnText, { color: colors.text }]}>Tickets</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <Image
                        source={require('../../assets/logo_perla.png')}
                        style={[styles.headerLogo, isMobile && styles.headerLogoMobile]}
                        resizeMode="contain"
                    />
                </View>

                {isMobile && (
                    <TouchableOpacity
                        style={[styles.ticketHeaderBtn, { alignSelf: 'center', marginBottom: 20, width: '100%', justifyContent: 'center' }]}
                        onPress={() => {
                            setMode('TICKETS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'TICKETS');
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>🎫</Text>
                        <Text style={[styles.ticketHeaderBtnText, { color: colors.text }]}>Tickets de Errores</Text>
                    </TouchableOpacity>
                )}

                <ScrollView contentContainerStyle={styles.cardsGrid} showsVerticalScrollIndicator={false}>
                    <DashboardCard
                        title="Cuadro Master"
                        description="Indicadores generales de gestión"
                        icon="📊"
                        onPress={() => {
                            setMode('CONTENT');
                            setActiveTab('captura');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'CONTENT');
                        }}
                        disabled={!isMasterEnabled}
                    />

                    <DashboardCard
                        title="Gastos Producción"
                        description="Extras, Mantenimiento y Refrigerios"
                        icon="🛠️"
                        onPress={() => {
                            setMode('PRODUCCION_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'PRODUCCION_GASTOS');
                        }}
                        disabled={!isProduccionEnabled}
                    />
                    <DashboardCard
                        title="Gastos de Mantenimiento"
                        description="Gestión de gastos de mantenimiento, repuestos y maquinaria"
                        icon="⚙️"
                        onPress={() => {
                            setMode('MANTENIMIENTO_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MANTENIMIENTO_GASTOS');
                        }}
                        disabled={!isMantenimientoEnabled}
                    />
                    <DashboardCard
                        title="Cuadro Presupuesto Talleres y Despachos"
                        description="Costos de talleres y despachos"
                        icon="🔧"
                        onPress={() => {
                            setMode('TALLERES_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'TALLERES_GASTOS');
                        }}
                        disabled={!isTalleresEnabled}
                    />
                    <DashboardCard
                        title="Presupuesto"
                        description="Gestión global de presupuestos"
                        icon="💰"
                        onPress={() => {
                            setMode('SST_PRESUPUESTO');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'SST_PRESUPUESTO');
                        }}
                        disabled={!isPresupuestoEnabled && !userRoles.includes('admin')}
                    />
                    <DashboardCard
                        title="Gestión Humana"
                        description="Gastos, Cotizaciones y Proveedores GH"
                        icon="👥"
                        onPress={() => {
                            setMode('GH_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'GH_GASTOS');
                        }}
                        disabled={!isGHEnabled}
                    />
                    <DashboardCard
                        title="Presupuestos SST"
                        description="Seguimiento de presupuestos SST"
                        icon="📋"
                        onPress={() => {
                            setMode('SST_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'SST_GASTOS');
                        }}
                        disabled={!isSSTEnabled}
                    />
                    <DashboardCard
                        title="Mantenimiento Equipos"
                        description="Control de equipos de cómputo"
                        icon="💻"
                        onPress={() => {
                            setMode('EQUIPOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'EQUIPOS');
                        }}
                        disabled={!isEquiposEnabled}
                    />
                    <DashboardCard
                        title="Novedades de OP y Calidad"
                        description="Control en proceso y NC"
                        icon="✅"
                        onPress={() => {
                            setMode('CALIDAD');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'CALIDAD');
                        }}
                        disabled={!isCalidadEnabled}
                    />

                    <DashboardCard
                        title="Planeación"
                        description="Gastos y Presupuestos de Planeación"
                        icon="📅"
                        onPress={() => {
                            setMode('PLANEACION_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'PLANEACION_GASTOS');
                        }}
                        disabled={!isPlaneacionEnabled}
                    />

                    <DashboardCard
                        title="Diseño"
                        description="Gastos del Departamento de Diseño"
                        icon="🎨"
                        onPress={() => {
                            setMode('DISENO_GASTOS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'DISENO_GASTOS');
                        }}
                        disabled={!isDisenoEnabled}
                    />

                    <DashboardCard
                        title="Planeador Máquinas"
                        description="Programación de OPs por Horarios"
                        icon="🏭"
                        onPress={() => {
                            setMode('CALIDAD_EXTERNA');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'CALIDAD_EXTERNA');
                        }}
                        disabled={!isPlaneadorEnabled}
                    />

                    <DashboardCard
                        title="Máquinas"
                        description="Gestión integral y Estado de Máquinas"
                        icon="🤖"
                        onPress={() => {
                            setMode('MAQUINAS');
                            if (Platform.OS === 'web') localStorage.setItem('adminDashboardMode', 'MAQUINAS');
                        }}
                        disabled={!isMaquinasEnabled}
                    />
                </ScrollView>

            </View>
        </View>
    );
}

export function AdminDashboard({ onBack, role, displayName, area }: AdminDashboardProps) {
    return <AdminDashboardContent onBack={onBack} role={role} displayName={displayName} area={area} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent', // Inherit from parent
    },
    // Styles for MENU Mode
    menuContainer: {
        flex: 1,
        backgroundColor: 'transparent', // Use container background
        padding: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 40 : 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    panelContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 30 : 15,
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
        flexWrap: 'wrap',
    },
    backButtonSimple: {
        marginRight: 15,
        padding: 5,
        zIndex: 10,
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
        width: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 280 : '100%',
        maxWidth: 350,
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
        position: 'relative', // Added
        height: Platform.OS === 'web' ? 70 : 100, // Fixed height for alignment
    },
    centeredTitleContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: Platform.OS === 'web' ? 0 : 40,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 150, // Prevent overlapping buttons/logo
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    backButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        zIndex: 10, // Ensure it's on top
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
    headerLogo: {
        width: 220,
        height: 110,
        position: 'absolute',
        top: 0,
        right: 0,
    },
    headerLogoMobile: {
        position: 'relative',
        width: 120,
        height: 60,
        marginTop: 10,
    },
    contentHeaderLogo: {
        width: 140,
        height: 70,
        position: 'absolute',
        top: 5,
        right: 15,
        zIndex: 10, // Added
    },
    ticketHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(49, 130, 206, 0.12)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        marginRight: 240,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(49, 130, 206, 0.25)',
    },
    ticketHeaderBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
