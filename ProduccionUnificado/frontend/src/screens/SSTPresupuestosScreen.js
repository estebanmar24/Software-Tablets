/**
 * SST Presupuestos Screen
 * Admin screen for managing monthly budget caps per TipoServicio
 * With tabs for: Producción, Talleres y Despachos, Gestión Humana, SST
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as sstApi from '../services/sstApi';
import * as ghApi from '../services/ghApi';
import * as talleresApi from '../services/talleresApi';
import { produccionApi } from '../services/produccionApi';

const TABS = [
    { key: 'produccion', label: 'Producción', icon: '🏭' },
    { key: 'talleres', label: 'Talleres y Despachos', icon: '🔧' },
    { key: 'gh', label: 'Gestión Humana', icon: '👥' },
    { key: 'sst', label: 'SST', icon: '🦺' }
];

export default function SSTPresupuestosScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('talleres'); // Default to talleres as requested? No user asked to be located there but let's default to sst or whatever was default. User asked "quiero que te ubiques en gestion de presupuestos, donde se ubica talleres y despachos". Let's set 'talleres' as default if that's what is implied.
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [gridData, setGridData] = useState(null);
    const [editedValues, setEditedValues] = useState({});

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            if (activeTab === 'sst') {
                const data = await sstApi.getPresupuestosGrid(anio);
                setGridData(data);
            } else if (activeTab === 'gh') {
                const data = await ghApi.getPresupuestosGrid(anio);
                setGridData(data);
            } else if (activeTab === 'produccion') {
                const data = await produccionApi.getPresupuestosGrid(anio);
                setGridData(data);
            } else if (activeTab === 'talleres') {
                const data = await talleresApi.getPresupuestosGrid(anio);
                setGridData(data);
            } else {
                setGridData({ tiposServicio: [], totalesMensuales: Array(12).fill(0), totalAnual: 0 });
            }
            setEditedValues({});
        } catch (error) {
            console.error('Error loading presupuestos:', error);
            Alert.alert('Error', 'No se pudieron cargar los presupuestos');
        } finally {
            setLoading(false);
        }
    }, [anio, activeTab]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Format number with thousands separator for display
    const formatWithThousands = (value) => {
        if (!value && value !== 0) return '';
        return new Intl.NumberFormat('es-CO').format(value);
    };

    // Parse formatted value back to number
    const parseFormattedValue = (value) => {
        return parseFloat(value.replace(/[^0-9]/g, '')) || 0;
    };

    const handleValueChange = (tipoServicioId, mes, value) => {
        const key = `${tipoServicioId}-${mes}`;
        const numValue = parseFormattedValue(value);
        setEditedValues(prev => ({
            ...prev,
            [key]: numValue
        }));
    };

    const getValue = (tipoServicioId, mesData) => {
        const key = `${tipoServicioId}-${mesData.mes}`;
        if (editedValues[key] !== undefined) {
            return editedValues[key];
        }
        return mesData.presupuesto || 0;
    };

    const getDisplayValue = (tipoServicioId, mesData) => {
        const value = getValue(tipoServicioId, mesData);
        return formatWithThousands(value);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const presupuestos = [];

            Object.entries(editedValues).forEach(([key, value]) => {
                const [tipoServicioId, mes] = key.split('-').map(Number);
                presupuestos.push({
                    tipoServicioId,
                    anio,
                    mes,
                    presupuesto: value
                });
            });

            if (presupuestos.length === 0) {
                Alert.alert('Info', 'No hay cambios para guardar');
                return;
            }

            // Use correct API based on active tab
            if (activeTab === 'gh') {
                await ghApi.setPresupuestosBulk(presupuestos);
            } else if (activeTab === 'produccion') {
                const prodPresupuestos = presupuestos.map(p => ({
                    rubroId: p.tipoServicioId,
                    anio: p.anio,
                    mes: p.mes,
                    presupuesto: p.presupuesto
                }));
                await produccionApi.setPresupuestosBulk(prodPresupuestos);
            } else if (activeTab === 'talleres') {
                const talleresPresupuestos = presupuestos.map(p => ({
                    rubroId: p.tipoServicioId,
                    anio: p.anio,
                    mes: p.mes,
                    presupuesto: p.presupuesto
                }));
                await talleresApi.setPresupuestosBulk(talleresPresupuestos);
            } else {
                await sstApi.setPresupuestosBulk(presupuestos);
            }

            setEditedValues({});
            await loadData();
            Alert.alert('Éxito', `Se guardaron ${presupuestos.length} presupuestos`);
        } catch (error) {
            console.error('Error saving presupuestos:', error);
            Alert.alert('Error', 'No se pudieron guardar los presupuestos');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const getTabTitle = () => {
        const tab = TABS.find(t => t.key === activeTab);
        return tab ? `${tab.icon} Gestión de Presupuestos ${tab.label}` : 'Gestión de Presupuestos';
    };

    return (
        <View style={styles.container}>
            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {TABS.map(tab => (
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
            </View>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{getTabTitle()}</Text>
                <View style={styles.yearSelector}>
                    <Text style={styles.yearLabel}>Año:</Text>
                    <Picker
                        selectedValue={anio}
                        onValueChange={setAnio}
                        style={styles.yearPicker}
                    >
                        {anios.map(a => (
                            <Picker.Item key={a} label={a.toString()} value={a} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* Summary */}
            {gridData && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Resumen {anio}</Text>
                    <Text style={styles.summaryTotal}>
                        Total Anual: {formatCurrency(gridData.totalAnual)}
                    </Text>
                </View>
            )}

            {/* Loading or Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Cargando presupuestos...</Text>
                </View>
            ) : (activeTab !== 'sst' && activeTab !== 'gh' && activeTab !== 'produccion' && activeTab !== 'talleres') ? (
                <View style={styles.placeholderContainer}>
                    <Text style={styles.placeholderIcon}>{TABS.find(t => t.key === activeTab)?.icon}</Text>
                    <Text style={styles.placeholderText}>
                        Módulo de presupuestos para {TABS.find(t => t.key === activeTab)?.label}
                    </Text>
                    <Text style={styles.placeholderSubtext}>Próximamente</Text>
                </View>
            ) : (
                <>
                    {/* Grid Table */}
                    <ScrollView style={styles.tableContainer} horizontal>
                        <View>
                            {/* Table Header */}
                            <View style={styles.tableRow}>
                                <View style={[styles.tableCell, styles.headerCell, styles.serviceNameCell]}>
                                    <Text style={styles.headerText}>Tipo de Servicio</Text>
                                </View>
                                {sstApi.MESES.map(mes => (
                                    <View key={mes.value} style={[styles.tableCell, styles.headerCell, styles.monthCell]}>
                                        <Text style={styles.headerText}>{mes.label.substring(0, 3)}</Text>
                                    </View>
                                ))}
                                <View style={[styles.tableCell, styles.headerCell, styles.totalCell]}>
                                    <Text style={styles.headerText}>Total</Text>
                                </View>
                            </View>

                            {/* Table Body */}
                            <ScrollView style={styles.tableBody}>
                                {gridData?.tiposServicio?.map((tipo, index) => {
                                    const rowTotal = tipo.meses.reduce((sum, m) => {
                                        const key = `${tipo.tipoServicioId}-${m.mes}`;
                                        const value = editedValues[key] !== undefined ? editedValues[key] : m.presupuesto;
                                        return sum + value;
                                    }, 0);

                                    return (
                                        <View
                                            key={tipo.tipoServicioId}
                                            style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
                                        >
                                            <View style={[styles.tableCell, styles.serviceNameCell]}>
                                                <Text style={styles.serviceName} numberOfLines={2}>
                                                    {tipo.tipoServicioNombre}
                                                </Text>
                                            </View>
                                            {tipo.meses.map(mesData => {
                                                const key = `${tipo.tipoServicioId}-${mesData.mes}`;
                                                const isEdited = editedValues[key] !== undefined;
                                                return (
                                                    <View key={mesData.mes} style={[styles.tableCell, styles.monthCell]}>
                                                        <TextInput
                                                            style={[
                                                                styles.input,
                                                                isEdited && styles.inputEdited
                                                            ]}
                                                            keyboardType="numeric"
                                                            value={getDisplayValue(tipo.tipoServicioId, mesData)}
                                                            onChangeText={(value) =>
                                                                handleValueChange(tipo.tipoServicioId, mesData.mes, value)
                                                            }
                                                            placeholder="0"
                                                        />
                                                    </View>
                                                );
                                            })}
                                            <View style={[styles.tableCell, styles.totalCell]}>
                                                <Text style={styles.totalText}>{formatCurrency(rowTotal)}</Text>
                                            </View>
                                        </View>
                                    );
                                })}

                                {/* Monthly Totals Row */}
                                {gridData && (
                                    <View style={[styles.tableRow, styles.totalsRow]}>
                                        <View style={[styles.tableCell, styles.serviceNameCell]}>
                                            <Text style={styles.totalRowLabel}>TOTAL MENSUAL</Text>
                                        </View>
                                        {gridData.totalesMensuales.map((total, index) => (
                                            <View key={index} style={[styles.tableCell, styles.monthCell]}>
                                                <Text style={styles.monthTotalText}>{formatCurrency(total)}</Text>
                                            </View>
                                        ))}
                                        <View style={[styles.tableCell, styles.totalCell]}>
                                            <Text style={styles.grandTotalText}>{formatCurrency(gridData.totalAnual)}</Text>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {Object.keys(editedValues).length > 0 && (
                            <Text style={styles.pendingChanges}>
                                {Object.keys(editedValues).length} cambios pendientes
                            </Text>
                        )}
                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={saving || Object.keys(editedValues).length === 0}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>💾 Guardar Cambios</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        paddingHorizontal: 16,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#F59E0B',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#FFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    loadingText: {
        marginTop: 12,
        color: '#6B7280',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    placeholderIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    placeholderText: {
        fontSize: 18,
        color: '#4B5563',
        marginBottom: 8,
    },
    placeholderSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    yearSelector: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    yearLabel: {
        marginRight: 8,
        color: '#4B5563',
    },
    yearPicker: {
        width: 120,
        height: 40,
    },
    summaryCard: {
        margin: 16,
        padding: 16,
        backgroundColor: '#EBF5FF',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#2563EB',
    },
    summaryTitle: {
        fontSize: 14,
        color: '#1E40AF',
    },
    summaryTotal: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E40AF',
        marginTop: 4,
    },
    tableContainer: {
        flex: 1,
        margin: 16,
        marginTop: 0,
    },
    tableRow: {
        flexDirection: 'row',
    },
    evenRow: {
        backgroundColor: '#FFF',
    },
    oddRow: {
        backgroundColor: '#F9FAFB',
    },
    tableCell: {
        padding: 8,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    headerCell: {
        backgroundColor: '#1E3A5F',
    },
    headerText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
    serviceNameCell: {
        width: 250,
    },
    monthCell: {
        width: 100,
    },
    totalCell: {
        width: 120,
        backgroundColor: '#F0FDF4',
    },
    serviceName: {
        fontSize: 12,
        color: '#374151',
    },
    input: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 4,
        padding: 6,
        textAlign: 'right',
        fontSize: 12,
    },
    inputEdited: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    totalText: {
        fontWeight: 'bold',
        color: '#047857',
        textAlign: 'right',
        fontSize: 12,
    },
    totalsRow: {
        backgroundColor: '#1E3A5F',
    },
    totalRowLabel: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    monthTotalText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 11,
        textAlign: 'right',
    },
    grandTotalText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'right',
    },
    tableBody: {
        maxHeight: 400,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    pendingChanges: {
        marginRight: 16,
        color: '#F59E0B',
        fontWeight: '500',
    },
    saveButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    saveButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    saveButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
});
