/**
 * Talleres y Despachos Gastos Screen
 * EXACT visual copy of ProduccionGastosScreen with Talleres-specific logic.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as talleresApi from '../services/talleresApi';
import { ExpenseHistoryModal } from '../components/ExpenseHistoryModal';

// TABS - Same structure as Produccion (sin Presupuesto)
const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },
    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'cotizaciones', label: 'Cotizaciones', icon: '📝' },
    { key: 'proveedores', label: 'Proveedores', icon: '🏢' },
    { key: 'personal', label: 'Personal', icon: '👥' },
];

const MESES = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

// Helper for consistent alerts
const showAlert = (title, message, onPress) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}: ${message}`);
        if (onPress) onPress();
    } else {
        Alert.alert(title, message, onPress ? [{ text: 'Aceptar', onPress }] : undefined);
    }
};

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$ 0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-CO');
};

// ===================== MAIN COMPONENT =====================
export default function TalleresGastosScreen() {
    const [activeTab, setActiveTab] = useState('gastos');

    return (
        <View style={styles.container}>
            {/* Tabs - EXACT PRODUCCION STYLE */}
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

            {/* Content based on active tab */}
            {activeTab === 'gastos' && <GastosTab />}
            {activeTab === 'graficas' && <GraficasTab />}
            {activeTab === 'rubros' && <RubrosTab />}
            {activeTab === 'cotizaciones' && <CotizacionesTab />}
            {activeTab === 'proveedores' && <ProveedoresTab />}
            {activeTab === 'personal' && <PersonalTab />}
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [rubros, setRubros] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [tiposHora, setTiposHora] = useState([]);
    const [tiposRecargo, setTiposRecargo] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [resumenAnual, setResumenAnual] = useState(null);
    const [presupuestoInfo, setPresupuestoInfo] = useState(null);

    // Filters for Main List
    const [filterRubro, setFilterRubro] = useState('');
    const [filterFecha, setFilterFecha] = useState('');

    const filteredGastos = useMemo(() => {
        return gastos.filter(g => {
            if (filterRubro && g.rubroId?.toString() !== filterRubro) return false;
            if (filterFecha) {
                if (filterFecha.length === 10) {
                    const parts = filterFecha.split('/');
                    if (parts.length === 3) {
                        const searchDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        if (!g.fecha.startsWith(searchDate)) return false;
                    }
                } else {
                    const formattedDate = formatDate(g.fecha);
                    if (!formattedDate.includes(filterFecha)) return false;
                }
            }
            return true;
        });
    }, [gastos, filterRubro, filterFecha]);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryGasto, setSelectedHistoryGasto] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '', proveedorId: '', numeroFactura: '', precio: '',
        fecha: new Date().toISOString().split('T')[0], observaciones: '', facturaPdfUrl: '',
        personalId: '', tipoHoraId: '', tipoRecargoId: '', cantidadHoras: '', numeroOP: ''
    });
    const [saving, setSaving] = useState(false);
    // Auto-fill price logic
    const [cotizaciones, setCotizaciones] = useState([]);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rubrosData, proveedoresData, gastosData, graficasData, cotData, personalData, maestrosData] = await Promise.all([
                talleresApi.getRubros(),
                talleresApi.getProveedores(),
                talleresApi.getGastos(anio, mes),
                talleresApi.getGraficas(anio, mes),
                talleresApi.getCotizaciones(anio, mes),
                talleresApi.getPersonal(),
                talleresApi.getMaestros()
            ]);
            console.log('DEBUG: Rubros loaded:', rubrosData);
            console.log('DEBUG: Proveedores loaded:', proveedoresData);
            console.log('DEBUG: Personal loaded:', personalData);
            setRubros(rubrosData);
            setProveedores(proveedoresData);
            setCotizaciones(cotData);
            setPersonal(personalData || []);
            setTiposHora(maestrosData.tiposHora || []);
            setTiposRecargo(maestrosData.tiposRecargo || []);

            // Sort Gastos by fecha descending (newest first), use ID as tie-breaker
            const sortedGastos = (gastosData || []).sort((a, b) => {
                const dateA = new Date(a.fecha);
                const dateB = new Date(b.fecha);
                if (dateB - dateA !== 0) return dateB - dateA;
                return b.id - a.id;
            });
            setGastos(sortedGastos);
            setGastos(sortedGastos);
            setResumen(graficasData);

            // Load Annual Data for Budget Alerts
            try {
                const anualData = await talleresApi.getGraficasAnual(anio);
                setResumenAnual(anualData);
            } catch (e) {
                console.error('Error loading annual data:', e);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            if (Platform.OS === 'web') {
                alert(`Error cargando datos: ${error.message}`);
            } else {
                Alert.alert('Error', `Error cargando datos: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadData(); }, [loadData]);

    const calculatePrice = useCallback(() => {
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        const isHorasExtras = selectedRubro?.nombre?.toLowerCase().includes('horas extras');
        const isRecargo = selectedRubro?.nombre?.toLowerCase().includes('recargo');

        console.log('DEBUG Calc:', { isHorasExtras, isRecargo, personalId: formData.personalId, cantidadHoras: formData.cantidadHoras });

        if ((isHorasExtras || isRecargo) && formData.personalId && formData.cantidadHoras) {
            const worker = personal.find(p => (p.id || p.Id)?.toString() === formData.personalId.toString());
            if (!worker) { console.log('DEBUG Calc: Worker not found'); return; }

            const salario = parseFloat(worker.salario || worker.Salario) || 0;
            const valorHoraBase = salario / 240;
            const horas = parseFloat(formData.cantidadHoras) || 0;
            let factor = 0; // Initialize to 0 to catch missing types

            if (isHorasExtras && formData.tipoHoraId) {
                const tipo = tiposHora.find(t => (t.id || t.Id)?.toString() === formData.tipoHoraId.toString());
                if (tipo) factor = parseFloat(tipo.factor || tipo.Factor);
                else console.log('DEBUG Calc: Tipo Hora not found');
            } else if (isRecargo && formData.tipoRecargoId) {
                const tipo = tiposRecargo.find(t => (t.id || t.Id)?.toString() === formData.tipoRecargoId.toString());
                if (tipo) factor = parseFloat(tipo.factor || tipo.Factor);
                else console.log('DEBUG Calc: Tipo Recargo not found');
            } else {
                return; // Missing type
            }

            console.log('DEBUG Calc:', { salario, valorHoraBase, factor, horas, total: Math.round(valorHoraBase * factor * horas) });
            const total = Math.round(valorHoraBase * factor * horas);
            setFormData(prev => ({ ...prev, precio: total.toString() }));
        }
    }, [formData.rubroId, formData.personalId, formData.cantidadHoras, formData.tipoHoraId, formData.tipoRecargoId, rubros, personal, tiposHora, tiposRecargo]);

    // Effect to auto-calculate Overtime/Recargo Price
    useEffect(() => {
        calculatePrice();
    }, [calculatePrice]);

    // Effect to auto-fill price when Rubro or Proveedor changes (Standard Expenses)
    useEffect(() => {
        if (!formData.rubroId || !formData.proveedorId) return;
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        const isHorasExtras = selectedRubro?.nombre?.toLowerCase().includes('horas extras');
        const isRecargo = selectedRubro?.nombre?.toLowerCase().includes('recargo');
        if (isHorasExtras || isRecargo) return; // Skip quote logic for overtime

        // Find matching quote for this Rubro + Proveedor + Period
        const quote = cotizaciones.find(c =>
            c.rubroId.toString() === formData.rubroId &&
            c.proveedorId.toString() === formData.proveedorId
        );

        if (quote) {
            // Simplified: If Price is empty or Invoice is empty (auto-calc mode), enforce Quote Price.
            if (!formData.numeroFactura) {
                setFormData(prev => ({ ...prev, precio: quote.precioCotizado.toString() }));
            }
        }
    }, [formData.rubroId, formData.proveedorId, cotizaciones, formData.numeroFactura, rubros]);

    // Calculate Presupuesto Info on Rubro Change
    useEffect(() => {
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        if (selectedRubro && resumen?.porRubro) {
            // Find monthly and annual stats
            // Note: API returns 'rubro' name property differently? Produccion uses 'rubroNombre', Talleres might use 'rubro'
            const rubroInfoMes = resumen.porRubro.find(r => r.rubro === selectedRubro.nombre);
            const rubroInfoAnual = resumenAnual?.porRubro?.find(r => r.rubro === selectedRubro.nombre);

            setPresupuestoInfo({
                rubroNombre: selectedRubro.nombre,
                presupuestoAnual: rubroInfoAnual?.presupuesto || 0,
                presupuestoMensual: rubroInfoMes?.presupuesto || 0,
                gastadoMes: rubroInfoMes?.gastado || 0,
                restanteMes: (rubroInfoMes?.presupuesto || 0) - (rubroInfoMes?.gastado || 0)
            });
        } else {
            setPresupuestoInfo(null);
        }
    }, [formData.rubroId, rubros, resumen, resumenAnual]);

    const resetForm = () => {
        setEditItem(null);
        setFormData({
            rubroId: '', proveedorId: '', numeroFactura: '', precio: '',
            fecha: new Date().toISOString().split('T')[0], observaciones: '', facturaPdfUrl: '',
            personalId: '', tipoHoraId: '', tipoRecargoId: '', cantidadHoras: '', numeroOP: ''
        });
    };

    const handleEdit = (gasto) => {
        setEditItem(gasto);
        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            numeroFactura: gasto.numeroFactura || '',
            precio: gasto.precio?.toString() || '',
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            observaciones: gasto.observaciones || '',
            facturaPdfUrl: gasto.facturaPdfUrl || '',
            personalId: gasto.personalId?.toString() || '',
            tipoHoraId: gasto.tipoHoraId?.toString() || '',
            tipoRecargoId: gasto.tipoRecargoId?.toString() || '',
            cantidadHoras: gasto.cantidadHoras?.toString() || '',
            numeroOP: gasto.numeroOP || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.rubroId) { showAlert('Error', 'Seleccione un Rubro'); return; }

        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        const isHorasExtras = selectedRubro?.nombre?.toLowerCase().includes('horas extras');
        const isRecargo = selectedRubro?.nombre?.toLowerCase().includes('recargo');

        if (isHorasExtras || isRecargo) {
            if (!formData.personalId) { showAlert('Error', 'Seleccione el personal'); return; }
            if (isHorasExtras && !formData.tipoHoraId) { showAlert('Error', 'Seleccione el tipo de hora'); return; }
            if (isRecargo && !formData.tipoRecargoId) { showAlert('Error', 'Seleccione el tipo de recargo'); return; }
            if (!formData.cantidadHoras) { showAlert('Error', 'Ingrese la cantidad de horas'); return; }
            // OP Number only mandatory for Overtime
            if (isHorasExtras && (!formData.numeroOP || !formData.numeroOP.trim())) { showAlert('Error', 'Ingrese el Número de OP'); return; }
        } else {
            if (!formData.proveedorId) { showAlert('Error', 'Seleccione un Proveedor'); return; }
            if (!formData.numeroFactura || !formData.numeroFactura.trim()) { showAlert('Error', 'El Número de factura es obligatorio'); return; }
        }

        if (!formData.precio || isNaN(parseFloat(formData.precio))) {
            showAlert('Error', 'El Precio debe ser un número válido');
            return;
        }

        try {
            setSaving(true);
            const gastoData = {
                rubroId: parseInt(formData.rubroId),
                proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null,
                numeroFactura: formData.numeroFactura || (isHorasExtras || isRecargo ? 'NOMINA' : ''), // Default for payroll
                precio: parseFloat(formData.precio),
                fecha: formData.fecha,
                observaciones: formData.observaciones,
                facturaPdfUrl: formData.facturaPdfUrl || null,
                anio: new Date(formData.fecha).getFullYear(),
                mes: new Date(formData.fecha).getMonth() + 1,
                personalId: formData.personalId ? parseInt(formData.personalId) : null,
                tipoHoraId: formData.tipoHoraId ? parseInt(formData.tipoHoraId) : null,
                tipoRecargoId: formData.tipoRecargoId ? parseInt(formData.tipoRecargoId) : null,
                cantidadHoras: formData.cantidadHoras ? parseFloat(formData.cantidadHoras) : null,
                numeroOP: formData.numeroOP || null
            };

            // For standard expenses check quotes
            if (!isHorasExtras && !isRecargo) {
                const quote = cotizaciones.find(c => c.rubroId == gastoData.rubroId && c.proveedorId == gastoData.proveedorId);
                if (quote) {
                    const quotePrice = parseFloat(quote.precioCotizado);
                    const currentPrice = gastoData.precio;
                    if (Math.abs(quotePrice - currentPrice) > 1 && Platform.OS === 'web') {
                        if (window.confirm(`Precio diferente a cotización (${formatCurrency(quotePrice)}). ¿Actualizar cotización?`)) {
                            await talleresApi.updateCotizacion(quote.id, { ...quote, precioCotizado: currentPrice });
                        }
                    }
                }
            }

            console.log('DEBUG Gasto Payload:', gastoData);
            if (editItem) {
                await talleresApi.updateGasto(editItem.id, { ...gastoData, id: editItem.id });
            } else {
                await talleresApi.createGasto(gastoData);
            }

            showAlert('Éxito', editItem ? 'Actualizado' : 'Ingresado', () => {
                setShowModal(false); resetForm(); loadData();
            });
        } catch (error) {
            console.error('Error saving gasto:', error);
            showAlert('Error', 'No se pudo guardar el gasto');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try { await talleresApi.deleteGasto(id); await loadData(); showAlert('Éxito', 'Gasto eliminado'); }
            catch { showAlert('Error', 'No se pudo eliminar'); }
        };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar gasto?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };

    // Helper to determine field visibility
    const selectedRubro = rubros.find(r => r.id == formData.rubroId);
    const isHorasExtras = selectedRubro?.nombre?.toLowerCase().includes('horas extras');
    const isRecargo = selectedRubro?.nombre?.toLowerCase().includes('recargo');

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
            </View>


            {/* Main List Filters */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 10, gap: 10, alignItems: 'center', backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ fontWeight: 'bold', color: '#374151', minWidth: 60 }}>Filtrar:</Text>

                <TextInput
                    style={{
                        flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB',
                        borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, height: 40
                    }}
                    placeholder="dd/mm/aaaa"
                    value={filterFecha}
                    onChangeText={(t) => {
                        if (t.length === 2 && filterFecha.length === 1) t += '/';
                        if (t.length === 5 && filterFecha.length === 4) t += '/';
                        if (t.length <= 10) setFilterFecha(t);
                    }}
                    keyboardType="numeric"
                />

                <View style={{
                    flex: 1.5, backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB',
                    borderRadius: 6, height: 40, justifyContent: 'center'
                }}>
                    <Picker
                        selectedValue={filterRubro}
                        onValueChange={setFilterRubro}
                        style={{ height: 40, width: '100%', borderWidth: 0 }}
                    >
                        <Picker.Item label="Todos los Rubros" value="" />
                        {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                    </Picker>
                </View>
            </View>

            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.presupuestoCard]}>
                    <Text style={styles.summaryLabel}>Presupuesto</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(resumen?.totalPresupuesto || 0)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.gastadoCard]}>
                    <Text style={styles.summaryLabel}>Gastado</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(resumen?.totalGastado || 0)}</Text>
                </View>
                <View style={[styles.summaryCard, (resumen?.totalRestante || 0) >= 0 ? styles.restanteCard : styles.excesoCard]}>
                    <Text style={styles.summaryLabel}>{(resumen?.totalRestante || 0) >= 0 ? 'Restante' : 'Exceso'}</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(Math.abs(resumen?.totalRestante || 0))}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
                <Text style={styles.addButtonText}>+ Agregar Gasto</Text>
            </TouchableOpacity>

            {loading ? <ActivityIndicator size="large" color="#2563EB" style={styles.loading} /> : (
                <ScrollView style={styles.listContainer}>
                    {filteredGastos.length === 0 ? (
                        <View style={styles.emptyState}><Text style={styles.emptyText}>No hay gastos registrados (con estos filtros)</Text></View>
                    ) : (
                        filteredGastos.map(gasto => (
                            <View key={gasto.id} style={styles.gastoCard}>
                                <View style={styles.gastoHeader}>
                                    <Text style={styles.gastoTipo}>{gasto.rubroNombre || gasto.Rubro?.nombre || gasto.Rubro?.Nombre || 'Sin Rubro'}</Text>
                                    <Text style={styles.gastoPrecio}>{formatCurrency(gasto.precio)}</Text>
                                </View>
                                {/* Display logic depends on type */}
                                {gasto.personalId ? (
                                    <View>
                                        <Text style={[styles.gastoRubro, { color: '#4B5563' }]}>👤 {gasto.personalNombre || gasto.PersonalNombre || gasto.Personal?.nombre || 'Personal'}</Text>
                                        {/* Show Type if exists - with fallbacks for casing */}
                                        {(gasto.tipoHoraNombre || gasto.TipoHoraNombre || gasto.tipoRecargoNombre || gasto.TipoRecargoNombre) ? (
                                            <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: 'bold', marginBottom: 2 }}>
                                                🏷️ {gasto.tipoHoraNombre || gasto.TipoHoraNombre || gasto.tipoRecargoNombre || gasto.TipoRecargoNombre}
                                                {(gasto.tipoHoraPorcentaje || gasto.TipoHoraPorcentaje) ? ` (${gasto.tipoHoraPorcentaje || gasto.TipoHoraPorcentaje}%)` : ''}
                                                {(gasto.tipoRecargoPorcentaje || gasto.TipoRecargoPorcentaje) ? ` (${gasto.tipoRecargoPorcentaje || gasto.TipoRecargoPorcentaje}%)` : ''}
                                            </Text>
                                        ) : (
                                            /* If names are missing but IDs are present, show generic label to debug */
                                            (gasto.tipoHoraId || gasto.tipoRecargoId) && (
                                                <Text style={{ fontSize: 10, color: '#9CA3AF' }}>[Detalles en proceso...]</Text>
                                            )
                                        )}
                                        <View style={styles.gastoDetails}>
                                            <Text style={styles.gastoDetail}>📋 OP: {gasto.numeroOP || gasto.NumeroOP || 'N/A'}</Text>
                                            <Text style={styles.gastoDetail}>⏱️ {gasto.cantidadHoras || gasto.CantidadHoras} hrs</Text>
                                        </View>
                                        {/* Hidden debug log in console */}
                                        {console.debug('DEBUG Gasto Card:', { id: gasto.id, typeH: gasto.tipoHoraNombre, typeR: gasto.tipoRecargoNombre })}
                                    </View>
                                ) : (
                                    <View>
                                        <Text style={styles.gastoRubro}>{gasto.proveedorNombre}</Text>
                                        <View style={styles.gastoDetails}>
                                            <Text style={styles.gastoDetail}>🏢 NIT: {gasto.proveedorNit}</Text>
                                            <Text style={styles.gastoDetail}>📄 Factura: {gasto.numeroFactura}</Text>
                                        </View>
                                    </View>
                                )}
                                <View style={styles.gastoDetails}>
                                    <Text style={styles.gastoDetail}>📅 {formatDate(gasto.fecha)}</Text>
                                </View>
                                {gasto.observaciones && <Text style={styles.gastoNota}>💬 {gasto.observaciones}</Text>}
                                <View style={styles.cardActions}>
                                    <TouchableOpacity style={styles.editCardButton} onPress={() => handleEdit(gasto)}>
                                        <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.historyButton} onPress={() => { setSelectedHistoryGasto(gasto); setShowHistoryModal(true); }}>
                                        <Text style={styles.historyButtonText}>🕒 Historial</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(gasto.id)}>
                                        <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* History Modal */}
            <ExpenseHistoryModal
                visible={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                gasto={selectedHistoryGasto}
            />

            <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar Gasto' : 'Nuevo Gasto'}</Text>
                        <ScrollView style={styles.formContainer}>
                            <Text style={styles.label}>Rubro *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.rubroId} onValueChange={(v) => {
                                    setFormData(p => ({ ...p, rubroId: v, proveedorId: '', personalId: '', tipoHoraId: '', tipoRecargoId: '' }));
                                }}>
                                    <Picker.Item label="Seleccione..." value="" />
                                    {rubros.map(r => <Picker.Item key={r.id || r.Id} label={r.nombre || r.Nombre} value={(r.id || r.Id).toString()} />)}
                                </Picker>
                            </View>

                            {/* Rubro specific fields */}
                            {(isHorasExtras || isRecargo) ? (
                                <>
                                    <Text style={styles.label}>Personal *</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker selectedValue={formData.personalId} onValueChange={(v) => setFormData(p => ({ ...p, personalId: v }))}>
                                            <Picker.Item label="Seleccione..." value="" />
                                            {personal.map(per => <Picker.Item key={per.id || per.Id} label={per.nombre || per.Nombre} value={(per.id || per.Id).toString()} />)}
                                        </Picker>
                                    </View>

                                    {isHorasExtras && (
                                        <>
                                            <Text style={styles.label}>Tipo de Hora Extra *</Text>
                                            <View style={styles.pickerContainer}>
                                                <Picker selectedValue={formData.tipoHoraId} onValueChange={(v) => setFormData(p => ({ ...p, tipoHoraId: v }))}>
                                                    <Picker.Item label="Seleccione..." value="" />
                                                    {tiposHora.map(th => <Picker.Item key={th.id || th.Id} label={`${th.nombre || th.Nombre} (${th.porcentaje || th.Porcentaje}%)`} value={(th.id || th.Id).toString()} />)}
                                                </Picker>
                                            </View>
                                        </>
                                    )}

                                    {isRecargo && (
                                        <>
                                            <Text style={styles.label}>Tipo de Recargo *</Text>
                                            <View style={styles.pickerContainer}>
                                                <Picker selectedValue={formData.tipoRecargoId} onValueChange={(v) => setFormData(p => ({ ...p, tipoRecargoId: v }))}>
                                                    <Picker.Item label="Seleccione..." value="" />
                                                    {tiposRecargo.map(tr => <Picker.Item key={tr.id || tr.Id} label={`${tr.nombre || tr.Nombre} (${tr.porcentaje || tr.Porcentaje}%)`} value={(tr.id || tr.Id).toString()} />)}
                                                </Picker>
                                            </View>
                                        </>
                                    )}

                                    <Text style={styles.label}>Cantidad de Horas *</Text>
                                    <TextInput style={styles.input} value={formData.cantidadHoras} onChangeText={(t) => setFormData(p => ({ ...p, cantidadHoras: t }))} keyboardType="numeric" placeholder="Ej: 8" />

                                    {isHorasExtras && (
                                        <>
                                            <Text style={styles.label}>Número de OP *</Text>
                                            <TextInput style={styles.input} value={formData.numeroOP} onChangeText={(t) => setFormData(p => ({ ...p, numeroOP: t }))} placeholder="Ej: OP-123" />
                                        </>
                                    )}
                                </>
                            ) : formData.rubroId ? (
                                <>
                                    <Text style={styles.label}>Proveedor *</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker selectedValue={formData.proveedorId} onValueChange={(v) => setFormData(p => ({ ...p, proveedorId: v }))}>
                                            <Picker.Item label="Seleccione..." value="" />
                                            {proveedores.map(p => <Picker.Item key={p.id || p.Id} label={`${p.nombre || p.Nombre} (${p.nitCedula || p.NitCedula})`} value={(p.id || p.Id).toString()} />)}
                                        </Picker>
                                    </View>

                                    <Text style={styles.label}>Número de Factura *</Text>
                                    <TextInput style={styles.input} value={formData.numeroFactura} onChangeText={(t) => setFormData(p => ({ ...p, numeroFactura: t }))} placeholder="Ej: FAC-001" />

                                    <Text style={styles.label}>PDF Factura</Text>
                                    {Platform.OS === 'web' && (
                                        <input type="file" accept=".pdf" onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                try {
                                                    const result = await talleresApi.uploadFactura(file);
                                                    setFormData(p => ({ ...p, facturaPdfUrl: result.url }));
                                                    Alert.alert('Éxito', 'PDF subido correctamente');
                                                } catch (err) {
                                                    Alert.alert('Error', 'No se pudo subir el PDF');
                                                }
                                            }
                                        }} style={{ marginBottom: 10 }} />
                                    )}
                                </>
                            ) : null}

                            {/* Always visible fields once Rubro is selected */}
                            {formData.rubroId ? (
                                <>
                                    <Text style={styles.label}>Fecha</Text>
                                    {Platform.OS === 'web' ? (
                                        <input type="date" value={formData.fecha} onChange={(e) => setFormData(p => ({ ...p, fecha: e.target.value }))} style={{ padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #D1D5DB', marginBottom: 10, width: '100%', boxSizing: 'border-box' }} />
                                    ) : (
                                        <TextInput style={styles.input} value={formData.fecha} onChangeText={(t) => setFormData(p => ({ ...p, fecha: t }))} placeholder="YYYY-MM-DD" />
                                    )}

                                    <Text style={styles.label}>Precio *</Text>
                                    <TextInput
                                        style={[styles.input, (isHorasExtras || isRecargo) && styles.inputDisabled]}
                                        value={formData.precio}
                                        onChangeText={(t) => setFormData(p => ({ ...p, precio: t }))}
                                        keyboardType="numeric"
                                        placeholder="$ 0"
                                        editable={!isHorasExtras && !isRecargo}
                                    />

                                    {/* Budget Status Alert */}
                                    {presupuestoInfo && (
                                        <View style={styles.budgetContainer}>
                                            <View style={styles.budgetHeader}>
                                                <Text style={styles.budgetTitle}>
                                                    📊 Presupuesto: {presupuestoInfo.rubroNombre || presupuestoInfo.RubroNombre}
                                                </Text>
                                            </View>
                                            {(() => {
                                                const currentPrice = parseFloat(formData.precio) || 0;
                                                const originalPrice = editItem ? (editItem.precio || 0) : 0;
                                                const adjustedGastadoMes = (presupuestoInfo.gastadoMes || presupuestoInfo.GastadoMes || 0) - originalPrice;
                                                const liveGastado = adjustedGastadoMes + currentPrice;
                                                const mensual = presupuestoInfo.presupuestoMensual || presupuestoInfo.PresupuestoMensual || 0;
                                                const liveRestante = mensual - liveGastado;

                                                return (
                                                    <>
                                                        <View style={styles.budgetInfoRow}>
                                                            <View style={[styles.budgetInfoItem, { backgroundColor: '#E0E7FF' }]}>
                                                                <Text style={styles.budgetInfoLabel}>Presupuesto Anual</Text>
                                                                <Text style={styles.budgetInfoValue}>
                                                                    {formatCurrency(presupuestoInfo.presupuestoAnual || presupuestoInfo.PresupuestoAnual || 0)}
                                                                </Text>
                                                            </View>
                                                            <View style={[styles.budgetInfoItem, { backgroundColor: '#FEF3C7' }]}>
                                                                <Text style={styles.budgetInfoLabel}>Gastado</Text>
                                                                <Text style={[styles.budgetInfoValue, { color: '#D97706' }]}>
                                                                    {formatCurrency(liveGastado)}
                                                                </Text>
                                                            </View>
                                                            <View style={[styles.budgetInfoItem, { backgroundColor: '#E0F2FE' }]}>
                                                                <Text style={styles.budgetInfoLabel}>Presupuesto Mensual</Text>
                                                                <Text style={styles.budgetInfoValue}>
                                                                    {formatCurrency(mensual)}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                                            <Text style={{ fontSize: 12, color: '#4B5563' }}>Restante Mensual:</Text>
                                                            <Text style={{
                                                                fontWeight: 'bold',
                                                                fontSize: 14,
                                                                color: liveRestante >= 0 ? '#059669' : '#DC2626'
                                                            }}>
                                                                {formatCurrency(liveRestante)}
                                                            </Text>
                                                        </View>

                                                        {liveRestante < 0 && (
                                                            <Text style={styles.budgetWarning}>
                                                                ⚠️ Este gasto excederá el presupuesto mensual en {formatCurrency(Math.abs(liveRestante))}
                                                            </Text>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                            {(presupuestoInfo.presupuestoMensual === 0 || presupuestoInfo.PresupuestoMensual === 0) && (
                                                <Text style={styles.budgetNoData}>
                                                    ℹ️ No hay presupuesto mensual asignado
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </>
                            ) : null}

                            <Text style={styles.label}>Observaciones</Text>
                            <TextInput style={[styles.input, styles.textArea]} value={formData.observaciones} onChangeText={(t) => setFormData(p => ({ ...p, observaciones: t }))} multiline placeholder="Opcional..." />

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={saving}>
                                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View >
            </Modal >
        </View >
    );
}

// ===================== GRAFICAS TAB =====================
function GraficasTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
    const [graficasData, setGraficasData] = useState(null);
    const [allGastos, setAllGastos] = useState([]);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            let dataGraf, dataGastos;

            if (mesSeleccionado) {
                [dataGraf, dataGastos] = await Promise.all([
                    talleresApi.getGraficas(anio, mesSeleccionado),
                    talleresApi.getGastos(anio, mesSeleccionado)
                ]);
            } else {
                dataGraf = await talleresApi.getGraficasAnual(anio);
                try {
                    dataGastos = await talleresApi.getGastos(anio, 0);
                } catch (e) {
                    dataGastos = [];
                }
            }

            setGraficasData(dataGraf);
            setAllGastos(Array.isArray(dataGastos) ? dataGastos : (dataGastos?.gastos || []));
        } catch (error) {
            console.error('Error loading data:', error);
            setAllGastos([]);
        } finally {
            setLoading(false);
        }
    }, [anio, mesSeleccionado]);

    useEffect(() => { loadData(); }, [loadData]);

    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [detailTitle, setDetailTitle] = useState('');
    const [detailGastos, setDetailGastos] = useState([]);
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');

    const displayedGastos = useMemo(() => {
        if (!filterStart && !filterEnd) return detailGastos;
        const parseDate = (d) => {
            if (!d || d.length !== 10) return null;
            const p = d.split('/');
            if (p.length < 3) return null;
            return new Date(`${p[2]}-${p[1]}-${p[0]}`);
        };
        const s = parseDate(filterStart);
        const e = parseDate(filterEnd);
        return detailGastos.filter(g => {
            const gd = new Date(g.fecha); gd.setHours(0, 0, 0, 0);
            if (s && gd < s) return false;
            if (e && gd > e) return false;
            return true;
        });
    }, [detailGastos, filterStart, filterEnd]);

    const handleOpenDetail = (type, id, name) => {
        setDetailTitle(name);
        setFilterStart('');
        setFilterEnd('');
        setDetailModalVisible(true);

        try {
            let filtered = [];
            const checkId = (item, propBase, targetId) => {
                const valDirect = item[propBase + 'Id'];
                const valNested = item[propBase]?.id;
                return valDirect == targetId || valNested == targetId;
            };

            const esNomina = (g) => {
                const rName = (g.rubroNombre || g.Rubro?.nombre || '').toLowerCase();
                return g.tipoHoraId || g.tipoRecargoId ||
                    rName.includes('hora') || rName.includes('recargo') || rName.includes('nomina') || rName.includes('salario') || rName.includes('personal');
            };

            if (type === 'rubro') {
                filtered = allGastos.filter(g => {
                    if (id && checkId(g, 'rubro', id)) return true;
                    const gName = (g.rubroNombre || g.Rubro?.nombre || '').toLowerCase();
                    return gName === String(name).toLowerCase();
                });
            } else if (type === 'proveedor') {
                filtered = allGastos.filter(g => checkId(g, 'proveedor', id) && !esNomina(g));
            } else if (type === 'personal') {
                filtered = allGastos.filter(g => checkId(g, 'personal', id));
            }

            if (filtered.length === 0 && name) {
                const targetName = String(name).toLowerCase().trim();
                filtered = allGastos.filter(g => {
                    let gName = '';
                    if (type === 'rubro') gName = g.rubroNombre || g.Rubro?.nombre;
                    else if (type === 'proveedor') gName = g.proveedorNombre || g.Proveedor?.nombre;
                    else if (type === 'personal') gName = g.personalNombre || g.Personal?.nombre;

                    if (!gName) return false;
                    return gName.toLowerCase().trim() === targetName;
                });
            }

            filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setDetailGastos(filtered);
        } catch (err) {
            console.error('Error filtering details:', err);
            setDetailGastos([]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    const data = graficasData || { totalGastado: 0, porRubro: [], porProveedor: [], porUsuario: [], resumenMensual: [] };
    const totalRegistrosReal = allGastos.length;

    const normalizedPorRubro = (data.porRubro || []).map(r => ({
        ...r,
        nombre: r.nombre || r.rubro,
        total: r.total || r.gastado
    }));

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📊 Análisis de Gastos Talleres</Text>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mesSeleccionado} onValueChange={setMesSeleccionado} style={styles.picker}>
                        <Picker.Item label="Todo el Año" value={null} />
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
            </View>

            <ScrollView style={styles.listContainer}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#EFF6FF', minWidth: 150 }]}>
                        <Text style={styles.summaryLabel}>💰 Presupuesto</Text>
                        <Text style={[styles.summaryValue, { color: '#1E40AF' }]}>
                            {formatCurrency(data.totalPresupuesto || 0)}
                        </Text>
                    </View>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#D1FAE5', minWidth: 150 }]}>
                        <Text style={styles.summaryLabel}>📊 Gastado</Text>
                        <Text style={[styles.summaryValue, { color: '#059669' }]}>
                            {formatCurrency(data.totalGastado || 0)}
                        </Text>
                    </View>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#FEF3C7', minWidth: 150 }]}>
                        <Text style={styles.summaryLabel}>✅ Restante</Text>
                        <Text style={[styles.summaryValue, { color: '#D97706' }]}>
                            {formatCurrency((data.totalPresupuesto || 0) - (data.totalGastado || 0))}
                        </Text>
                    </View>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#F3F4F6', minWidth: 150 }]}>
                        <Text style={styles.summaryLabel}>📋 Registros</Text>
                        <Text style={[styles.summaryValue, { color: '#374151' }]}>{totalRegistrosReal}</Text>
                    </View>
                </View>

                <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={styles.modalTitle}>Detalle: {detailTitle}</Text>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ padding: 5 }}>
                                    <Text style={{ fontSize: 20, color: '#666' }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>Desde:</Text>
                                    <TextInput
                                        style={{ backgroundColor: 'white', borderRadius: 4, paddingHorizontal: 5, height: 35, fontSize: 12, borderWidth: 1, borderColor: '#DDD' }}
                                        placeholder="DD/MM/AAAA"
                                        placeholderTextColor="#999"
                                        value={filterStart}
                                        onChangeText={(t) => {
                                            if (t.length === 2 && filterStart.length === 1) t += '/';
                                            if (t.length === 5 && filterStart.length === 4) t += '/';
                                            if (t.length <= 10) setFilterStart(t);
                                        }}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>Hasta:</Text>
                                    <TextInput
                                        style={{ backgroundColor: 'white', borderRadius: 4, paddingHorizontal: 5, height: 35, fontSize: 12, borderWidth: 1, borderColor: '#DDD' }}
                                        placeholder="DD/MM/AAAA"
                                        placeholderTextColor="#999"
                                        value={filterEnd}
                                        onChangeText={(t) => {
                                            if (t.length === 2 && filterEnd.length === 1) t += '/';
                                            if (t.length === 5 && filterEnd.length === 4) t += '/';
                                            if (t.length <= 10) setFilterEnd(t);
                                        }}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {displayedGastos.length === 0 ? (
                                <Text style={styles.emptyText}>No se encontraron registros en el rango.</Text>
                            ) : (
                                <ScrollView style={{ maxHeight: 400 }}>
                                    {displayedGastos.map(g => (
                                        <View key={g.id} style={{
                                            backgroundColor: '#F9FAFB',
                                            padding: 12,
                                            marginBottom: 8,
                                            borderRadius: 8,
                                            borderLeftWidth: 3,
                                            borderLeftColor: '#2563EB'
                                        }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontWeight: 'bold', color: '#374151' }}>{new Date(g.fecha).toLocaleDateString()}</Text>
                                                <Text style={{ fontWeight: 'bold', color: '#059669' }}>{formatCurrency(g.precio)}</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                                                {g.tipoHoraNombre || g.tipoRecargoNombre || g.rubroNombre || g.Rubro?.nombre || 'Gasto General'}
                                            </Text>

                                            {g.personalId && (
                                                <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>👤 {g.personalNombre || g.Personal?.nombre}</Text>
                                            )}
                                            {g.proveedorId && (
                                                <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>🏢 {g.proveedorNombre || g.Proveedor?.nombre}</Text>
                                            )}

                                            {g.observaciones && <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>"{g.observaciones}"</Text>}
                                            {g.facturaPdfUrl && <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 2 }}>📄 Tiene Factura PDF</Text>}
                                            {g.numeroOP && <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>📋 OP: {g.numeroOP}</Text>}
                                        </View>
                                    ))}
                                </ScrollView>
                            )}

                            <TouchableOpacity
                                style={[styles.cancelButton, { marginTop: 15, alignSelf: 'flex-end' }]}
                                onPress={() => setDetailModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <View style={{ marginBottom: 20, backgroundColor: 'white', padding: 15, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#1F2937' }}>{mesSeleccionado ? 'Ejecución Mensual' : 'Ejecución Anual'}</Text>
                    <View style={{ height: 20, backgroundColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                        <View style={{
                            width: `${Math.min(100, ((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}%`,
                            height: '100%',
                            backgroundColor: ((data.totalGastado || 0) > (data.totalPresupuesto || 0)) ? '#DC2626' : '#10B981'
                        }} />
                    </View>
                    <Text style={{ textAlign: 'right', marginTop: 5, fontSize: 12, color: '#666' }}>
                        {Math.round(((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}% ejecutado
                    </Text>
                </View>

                {normalizedPorRubro.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#111827' }}>📁 Desempeño por Rubro</Text>
                        {normalizedPorRubro.map((item, idx) => {
                            const rubroPorcentaje = (item.presupuesto > 0) ? Math.round((item.total / item.presupuesto) * 100) : (item.total > 0 ? 101 : 0);
                            const isExceeded = item.total > item.presupuesto && item.presupuesto > 0;
                            const isZeroBudgetWithGasto = item.presupuesto === 0 && item.total > 0;

                            return (
                                <View key={idx} style={{ marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <TouchableOpacity onPress={() => handleOpenDetail('rubro', item.id, item.nombre)}>
                                            <Text style={{ fontWeight: '600', color: '#1E40AF', textDecorationLine: 'underline' }}>
                                                {item.nombre} 👆
                                            </Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: (isExceeded || isZeroBudgetWithGasto) ? '#DC2626' : '#059669' }}>
                                            {formatCurrency(item.total)} / {formatCurrency(item.presupuesto)}
                                        </Text>
                                    </View>
                                    <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                                        <View style={{
                                            width: `${Math.min(100, rubroPorcentaje)}%`,
                                            height: '100%',
                                            backgroundColor: (isExceeded || isZeroBudgetWithGasto) ? '#DC2626' : '#3B82F6'
                                        }} />
                                    </View>
                                    {(isExceeded || isZeroBudgetWithGasto) && (
                                        <Text style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>⚠️ Superó presupuesto</Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

            </ScrollView>
        </View>
    );
}



// ===================== RUBROS TAB =====================
function RubrosTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => { try { setLoading(true); setItems(await talleresApi.getRubros()); } catch (e) { } finally { setLoading(false); } };
    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim()) { showAlert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            const data = { nombre, activo: true };
            if (editItem) { await talleresApi.updateRubro(editItem.id, data); }
            else { await talleresApi.createRubro(data); }
            showAlert('Éxito', editItem ? 'Rubro actualizado' : 'Rubro creado');
            setShowModal(false); loadData();
        } catch (e) { showAlert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await talleresApi.deleteRubro(id); loadData(); showAlert('Éxito', 'Rubro eliminado'); } catch { showAlert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar rubro?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📁 Rubros</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}><Text style={styles.itemName}>{item.nombre}</Text></View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Rubro</Text>
                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}

// ===================== PROVEEDORES TAB =====================
function ProveedoresTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [nit, setNit] = useState('');
    const [telefono, setTelefono] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => { try { setLoading(true); setItems(await talleresApi.getProveedores()); } catch (e) { } finally { setLoading(false); } };
    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setNit(''); setTelefono(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setNit(item.nitCedula || ''); setTelefono(item.telefono || ''); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim()) { showAlert('Error', 'Nombre obligatorio'); return; }
        if (!nit.trim()) { showAlert('Error', 'NIT/Cédula obligatorio'); return; }
        try {
            setSaving(true);
            const data = { nombre, nitCedula: nit, telefono, activo: true };
            if (editItem) { await talleresApi.updateProveedor(editItem.id, data); }
            else { await talleresApi.createProveedor(data); }
            showAlert('Éxito', editItem ? 'Proveedor actualizado' : 'Proveedor registrado');
            setShowModal(false); loadData();
        } catch (e) { showAlert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await talleresApi.deleteProveedor(id); loadData(); showAlert('Éxito', 'Proveedor eliminado'); } catch { showAlert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar proveedor?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>🏢 Proveedores</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemParent}>NIT/CC: {item.nitCedula}</Text>
                            {item.telefono && <Text style={styles.itemParent}>📞 {item.telefono}</Text>}
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Proveedor</Text>
                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                    <Text style={styles.label}>NIT o Cédula *</Text>
                    <TextInput style={styles.input} value={nit} onChangeText={setNit} placeholder="NIT o CC" />
                    <Text style={styles.label}>Teléfono</Text>
                    <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="Teléfono" />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}

// ===================== COTIZACIONES TAB =====================
function CotizacionesTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [proveedores, setProveedores] = useState([]);

    // Period Filters
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);

    // Form State
    const [selectedRubro, setSelectedRubro] = useState('');
    const [selectedProveedor, setSelectedProveedor] = useState('');
    const [price, setPrice] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [saving, setSaving] = useState(false);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rubrosData, provData, cotizacionesData] = await Promise.all([
                talleresApi.getRubros(),
                talleresApi.getProveedores(),
                talleresApi.getCotizaciones(anio, mes)
            ]);
            setRubros(rubrosData.filter(r => r.activo));
            setProveedores(provData.filter(p => p.activo));
            setItems(cotizacionesData);
        } catch (e) {
            console.error(e);
            showAlert('Error', 'No se pudieron cargar los datos');
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = () => {
        setEditItem(null);
        setSelectedRubro('');
        setSelectedProveedor('');
        setPrice('');
        setDescripcion('');
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setSelectedRubro(item.rubroId.toString());
        setSelectedProveedor(item.proveedorId.toString());
        setPrice(item.precioCotizado?.toString() || '');
        setDescripcion(item.descripcion || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!selectedRubro) { showAlert('Error', 'Seleccione un Rubro'); return; }
        if (!selectedProveedor) { showAlert('Error', 'Seleccione un Proveedor'); return; }
        if (!price || isNaN(parseFloat(price))) { showAlert('Error', 'Precio inválido'); return; }

        try {
            setSaving(true);
            const data = {
                rubroId: parseInt(selectedRubro),
                proveedorId: parseInt(selectedProveedor),
                precioCotizado: parseFloat(price),
                descripcion,
                anio,
                mes,
                activo: true
            };

            if (editItem) {
                // Keep original ID and other fields not in form if needed
                await talleresApi.updateCotizacion(editItem.id, { ...data, id: editItem.id });
                showAlert('Éxito', 'Cotización actualizada');
            } else {
                await talleresApi.createCotizacion(data);
                showAlert('Éxito', 'Cotización creada');
            }
            setShowModal(false);
            loadData();
        } catch (e) {
            showAlert('Error', 'No se pudo guardar la cotización');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        const doDelete = async () => {
            try {
                await talleresApi.deleteCotizacion(id);
                loadData();
                showAlert('Éxito', 'Cotización eliminada');
            } catch (e) {
                showAlert('Error', 'No se pudo eliminar');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar cotización?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar cotización?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📝 Cotizaciones Manuales</Text>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Nueva Cotización</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.listContainer}>
                {items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No hay cotizaciones para este periodo</Text>
                    </View>
                ) : (
                    items.map(item => (
                        <View key={item.id} style={styles.gastoCard}>
                            <View style={styles.gastoHeader}>
                                <Text style={styles.gastoTipo}>{item.proveedorNombre}</Text>
                                <Text style={styles.gastoPrecio}>{formatCurrency(item.precioCotizado)}</Text>
                            </View>
                            <Text style={styles.gastoRubro}>Rubro: {item.rubroNombre}</Text>
                            {item.descripcion && <Text style={styles.gastoNota}>{item.descripcion}</Text>}
                            <Text style={styles.gastoDetail}>{formatDate(item.fechaCotizacion)}</Text>

                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.editCardButton} onPress={() => handleEdit(item)}>
                                    <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                                    <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Nueva'} Cotización</Text>

                        <Text style={styles.label}>Rubro *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={selectedRubro} onValueChange={setSelectedRubro}>
                                <Picker.Item label="Seleccione..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>

                        <Text style={styles.label}>Proveedor *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={selectedProveedor} onValueChange={setSelectedProveedor}>
                                <Picker.Item label="Seleccione..." value="" />
                                {proveedores.map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                            </Picker>
                        </View>

                        <Text style={styles.label}>Precio Cotizado *</Text>
                        <TextInput
                            style={styles.input}
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                            placeholder="$ 0"
                        />

                        <Text style={styles.label}>Descripción</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={descripcion}
                            onChangeText={setDescripcion}
                            placeholder="Detalles de la cotización..."
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ===================== PRESUPUESTOS TAB REMOVED =====================
// User indicated Budgets are managed in the exclusive "Gestión de Presupuestos" screen.


// ===================== STYLES - EXACT COPY FROM PRODUCCION =====================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // TABS - EXACT PRODUCCION STYLE with dark blue background
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#152A45',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    tabIcon: { marginRight: 4, fontSize: 14 },
    tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '500', fontSize: 13 },
    activeTabText: { color: '#FFF' },

    // CONTENT
    contentContainer: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
    filters: { flexDirection: 'row' },
    picker: { width: 110, height: 40 },

    // SUMMARY - EXACT PRODUCCION COLORS
    summaryContainer: { flexDirection: 'row', padding: 16, gap: 12 },
    summaryCard: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    presupuestoCard: { backgroundColor: '#DBEAFE' },
    gastadoCard: { backgroundColor: '#FEE2E2' },
    restanteCard: { backgroundColor: '#D1FAE5' },
    excesoCard: { backgroundColor: '#FEE2E2' },
    summaryLabel: { fontSize: 12, color: '#4B5563' },
    summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 4 },

    // BUTTONS
    addButton: {
        backgroundColor: '#2563EB',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonSmall: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    loading: { marginTop: 40 },

    // LIST
    listContainer: { flex: 1, paddingHorizontal: 16 },
    emptyState: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#9CA3AF', fontSize: 16 },

    // GASTO CARD - EXACT PRODUCCION
    gastoCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2563EB' },
    gastoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    gastoTipo: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', flex: 1 },
    gastoPrecio: { fontSize: 20, fontWeight: 'bold', color: '#059669' },
    gastoRubro: { fontSize: 14, color: '#6B7280', marginBottom: 10 },
    gastoDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    gastoDetail: { fontSize: 14, color: '#4B5563' },
    gastoNota: { fontSize: 14, color: '#6B7280', fontStyle: 'italic', marginTop: 10 },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 12 },
    editCardButton: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EBF5FF', borderRadius: 6 },
    editCardButtonText: { color: '#2563EB', fontSize: 13, fontWeight: '500' },
    historyButton: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 6 },
    historyButtonText: { color: '#4B5563', fontSize: 13, fontWeight: '500' },
    deleteButton: { paddingHorizontal: 14, paddingVertical: 8 },
    deleteButtonText: { color: '#DC2626', fontSize: 13 },

    // ITEM CARD
    itemCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
    itemDetail: { fontSize: 13, color: '#4B5563', marginTop: 1 },
    itemParent: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    itemActions: { flexDirection: 'row', gap: 12 },
    editButton: { fontSize: 18 },
    deleteButtonIcon: { fontSize: 18 },

    // MODAL
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '90%', maxWidth: 500, maxHeight: '90%' },
    modalContentSmall: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '90%', maxWidth: 400 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
    formContainer: { maxHeight: 400 },
    label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4, marginTop: 12 },
    pickerContainer: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: '#F9FAFB' },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#F9FAFB' },
    textArea: { height: 80, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
    cancelButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
    cancelButtonText: { color: '#4B5563' },
    submitButton: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
    submitButtonDisabled: { backgroundColor: '#9CA3AF' },
    submitButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Budget Styles (Copied from Produccion)
    budgetContainer: { marginTop: 16, marginBottom: 16, padding: 12, backgroundColor: '#F0F9FF', borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD' },
    budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    budgetTitle: { fontSize: 14, fontWeight: 'bold', color: '#0369A1' },
    budgetInfoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    budgetInfoItem: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 6 },
    budgetInfoLabel: { fontSize: 10, color: '#6B7280', marginBottom: 2, textAlign: 'center' },
    budgetInfoValue: { fontSize: 13, fontWeight: 'bold', color: '#1F2937' },
    budgetWarning: { marginTop: 12, padding: 8, backgroundColor: '#FEF2F2', borderRadius: 6, color: '#DC2626', fontSize: 12, fontWeight: 'bold', textAlign: 'center', borderWidth: 1, borderColor: '#FECACA' },
    budgetNoData: { marginTop: 12, padding: 8, backgroundColor: '#E0E7FF', borderRadius: 6, color: '#4338CA', fontSize: 12, textAlign: 'center' },
});

// Graficas Styles (Same as Produccion)
const grafStyles = StyleSheet.create({
    chartSection: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    barLabel: { width: 100, fontSize: 12, color: '#4B5563' },
    barContainer: { flex: 1, height: 20, backgroundColor: '#E5E7EB', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: 4 },
    barValue: { width: 80, fontSize: 12, fontWeight: 'bold', color: '#1F2937', textAlign: 'right' },
    dashboardRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
    summaryCardSmall: { flex: 1, minWidth: 150, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    cardLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
    cardValue: { fontSize: 20, fontWeight: 'bold' },
    progressBarContainer: { height: 20, backgroundColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden', marginVertical: 8 },
    progressBar: { height: '100%', borderRadius: 10 },
    progressText: { textAlign: 'center', fontSize: 14, color: '#6B7280' },
    // Table styles for Resumen Mensual
    tableHeader: { flexDirection: 'row', backgroundColor: '#1E3A5F', borderRadius: 4, paddingVertical: 8, marginBottom: 4 },
    tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    tableRowAlt: { backgroundColor: '#F9FAFB' },
    tableCell: { flex: 1, fontSize: 12, textAlign: 'center', color: '#1F2937' },
    tableCellHeader: { color: '#FFFFFF', fontWeight: 'bold' },

    // Detailed Rubro Report Styles
    rubroReportRow: { marginBottom: 16 },
    rubroReportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rubroReportName: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
    rubroReportStatus: { fontSize: 12, fontWeight: '500' },
    rubroProgressBarContainer: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden' },
    rubroProgressBar: { height: '100%', borderRadius: 6 },
    rubroWarningText: { fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '500' },
});

// ===================== PERSONAL TAB =====================
function PersonalTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [cargo, setCargo] = useState('');
    const [salario, setSalario] = useState('');
    const [saving, setSaving] = useState(false);
    const [horaExtras, setHoraExtras] = useState([]);
    const [recargos, setRecargos] = useState([]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [personalData, maestrosData] = await Promise.all([
                talleresApi.getPersonal(),
                talleresApi.getMaestros()
            ]);
            setItems(personalData || []);
            setHoraExtras(maestrosData.tiposHora || []);
            setRecargos(maestrosData.tiposRecargo || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setCargo(''); setSalario(''); setShowModal(true); };
    const handleEdit = (item) => {
        setEditItem(item);
        setNombre(item.nombre);
        setCargo(item.cargo || '');
        setSalario(item.salario?.toString() || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) { showAlert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            const data = {
                nombre,
                cargo,
                salario: parseFloat(salario) || 0,
                activo: true,
                estado: true
            };
            if (editItem) { await talleresApi.updatePersonal(editItem.id, data); }
            else { await talleresApi.createPersonal(data); }
            showAlert('Éxito', editItem ? 'Colaborador actualizado' : 'Colaborador registrado');
            setShowModal(false); loadData();
        } catch (e) { showAlert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await talleresApi.deletePersonal(id); loadData(); showAlert('Éxito', 'Colaborador eliminado'); } catch { showAlert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar colaborador?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>👥 Personal de Talleres</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>

            {/* Surcharge Percentages Dashboard (Read-Only from Production) */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1, minWidth: 250, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }}>
                    <Text style={{ fontWeight: 'bold', color: '#1E40AF', marginBottom: 8 }}>⏱️ Porcentajes Horas Extras</Text>
                    {horaExtras.map(h => (
                        <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13 }}>{h.nombre}</Text>
                            <Text style={{ fontWeight: 'bold' }}>{h.porcentaje}%</Text>
                        </View>
                    ))}
                </View>
                <View style={{ flex: 1, minWidth: 250, backgroundColor: '#FAF5FF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E9D5FF' }}>
                    <Text style={{ fontWeight: 'bold', color: '#6B21A8', marginBottom: 8 }}>🌙 Porcentajes Recargos</Text>
                    {recargos.map(r => (
                        <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13 }}>{r.nombre}</Text>
                            <Text style={{ fontWeight: 'bold' }}>{r.porcentaje}%</Text>
                        </View>
                    ))}
                </View>
            </View>

            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre || item.Nombre}</Text>
                            <Text style={styles.itemDetail}>{item.cargo || item.Cargo || 'Sin cargo'}</Text>
                            <Text style={{ color: '#059669', fontWeight: '600', marginTop: 2 }}>💰 {formatCurrency(item.salario || item.Salario)}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Colaborador</Text>

                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre completo" />

                    <Text style={styles.label}>Cargo</Text>
                    <TextInput style={styles.input} value={cargo} onChangeText={setCargo} placeholder="Ej: Mecánico, Ayudante" />

                    <Text style={styles.label}>Salario Mensual</Text>
                    <TextInput style={styles.input} value={salario} onChangeText={setSalario} keyboardType="numeric" placeholder="$ 0" />

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}
