import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import QualityView from './QualityView';
import EncuestaCalidadProduccionView from './EncuestaCalidadProduccionView';
import ConsolidadoNCView from './ConsolidadoNCView';

type CalidadTab = 'encuestas' | 'produccion' | 'consolidadoNC';

interface TabDef {
    key: CalidadTab;
    label: string;
    icon: string;
}

const tabs: TabDef[] = [
    { key: 'encuestas', label: 'Encuestas Calidad', icon: '✅' },
    { key: 'produccion', label: 'Encuesta Producción', icon: '📦' },
    { key: 'consolidadoNC', label: 'Consolidado de NC', icon: '📋' },
];

export default function CalidadDashboard() {
    const [activeTab, setActiveTab] = useState<CalidadTab>('encuestas');

    const renderContent = () => {
        switch (activeTab) {
            case 'encuestas':
                return <QualityView />;
            case 'produccion':
                return <EncuestaCalidadProduccionView />;
            case 'consolidadoNC':
                return <ConsolidadoNCView />;
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Tab bar */}
            <View style={styles.tabBar}>
                {tabs.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => setActiveTab(tab.key)}
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
