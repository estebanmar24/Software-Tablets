import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import QualityView from './QualityView';
import EncuestaCalidadProduccionView from './EncuestaCalidadProduccionView';
import PlanAccionView from './PlanAccionView';
import ConsolidadoNCView from './ConsolidadoNCView';
import CalidadExternaView from './CalidadExternaView';
import ActasDestruccionView from './ActasDestruccionView';
import InformeSemanalCalidadView from './InformeSemanalCalidadView';

type CalidadTab =
    | 'calidad_encuestas'
    | 'calidad_informe_semanal'
    | 'calidad_prod'
    | 'calidad_consolidado'
    | 'calidad_planes'
    | 'calidad_ext'
    | 'calidad_actas';

interface TabDef {
    key: CalidadTab;
    label: string;
    icon: string;
}

const tabs: TabDef[] = [
    { key: 'calidad_encuestas', label: 'Control en Proceso de Calidad y Novedades', icon: '✅' },
    { key: 'calidad_informe_semanal', label: 'Informe Semanal', icon: '📊' },
    { key: 'calidad_prod', label: 'Reporte de NC a Calidad', icon: '📦' },
    { key: 'calidad_consolidado', label: 'Consolidado de NC', icon: '📋' },
    { key: 'calidad_planes', label: 'Planes de Acción', icon: '🚀' },
    { key: 'calidad_ext', label: 'Calidad Externa', icon: '🏭' },
    { key: 'calidad_actas', label: 'Actas de Destrucción', icon: '📜' },
];

interface CalidadDashboardProps {
    onTabChange?: (title: string) => void;
    navigation: any;
    userArea?: string;
    userRole?: string;
    permissions?: string;
}

export default function CalidadDashboard({ onTabChange, navigation, userArea, userRole, permissions }: CalidadDashboardProps) {
    const [activeTab, setActiveTab] = useState<CalidadTab>('calidad_encuestas');

    const filteredTabs = React.useMemo(() => {
        let perms: Record<string, boolean> = {};
        try {
            perms = permissions ? JSON.parse(permissions) : {};
        } catch (e) {
            console.error('Error parsing permissions in calidad dashboard:', e);
        }

        if (Object.keys(perms).length === 0) return tabs;

        return tabs.filter(tab => {
            if (tab.key === 'calidad_informe_semanal') {
                return perms[tab.key] === true || perms['calidad_encuestas'] === true;
            }
            return perms[tab.key] === true;
        });
    }, [permissions]);

    const handleTabChange = (tab: TabDef) => {
        setActiveTab(tab.key);
        if (onTabChange) {
            onTabChange(tab.label);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'calidad_encuestas':
                return <QualityView navigation={navigation} />;
            case 'calidad_informe_semanal':
                return <InformeSemanalCalidadView />;
            case 'calidad_prod':
                return <EncuestaCalidadProduccionView />;
            case 'calidad_planes':
                return <PlanAccionView userArea={userArea} userRole={userRole} />;
            case 'calidad_consolidado':
                return <ConsolidadoNCView />;
            case 'calidad_ext':
                return <CalidadExternaView />;
            case 'calidad_actas':
                return <ActasDestruccionView />;
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Tab bar */}
            <View style={styles.tabBar}>
                {filteredTabs.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => handleTabChange(tab)}
                    >
                        <Text style={styles.tabIcon}>{tab.icon}</Text>
                        <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <View style={styles.content}>
                {renderContent()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 2,
        borderBottomColor: '#E2E8F0',
        paddingHorizontal: 10,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
        marginRight: 5,
    },
    tabActive: {
        borderBottomColor: '#3182CE',
        backgroundColor: '#EBF8FF',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    tabIcon: { fontSize: 18, marginRight: 8 },
    tabLabel: { fontSize: 14, fontWeight: '500', color: '#718096' },
    tabLabelActive: { color: '#3182CE', fontWeight: '700' },
    content: { flex: 1 },
});
