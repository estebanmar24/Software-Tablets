/**
 * GH (Gestión Humana) Gastos Screen
 * HR personnel screen for recording monthly expenses and managing master data
 * Includes Cotizaciones (Quotations) feature for price comparison
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
    Platform,
    Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ghApi from '../services/ghApi';
// jsPDF uses dynamic import to avoid Android TextDecoder crash
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { ExpenseHistoryModal } from '../components/ExpenseHistoryModal';

const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'cotizaciones', label: 'Cotizaciones', icon: '📋' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },
    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'servicios', label: 'Tipos de Servicio', icon: '🔧' },
    { key: 'proveedores', label: 'Proveedores', icon: '🏢' }
];

export default function GHGastosScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('gastos');

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

            {/* Content based on active tab */}
            {activeTab === 'gastos' && <GastosTab />}
            {activeTab === 'cotizaciones' && <CotizacionesTab />}
            {activeTab === 'graficas' && <GraficasTab />}
            {activeTab === 'rubros' && <RubrosTab />}
            {activeTab === 'servicios' && <ServiciosTab />}
            {activeTab === 'proveedores' && <ProveedoresTab />}
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    // Master data
    const [rubros, setRubros] = useState([]);
    const [tiposServicio, setTiposServicio] = useState([]);
    const [proveedores, setProveedores] = useState([]);

    // Filtered data for cascading dropdowns
    const [filteredTipos, setFilteredTipos] = useState([]);
    const [filteredProveedores, setFilteredProveedores] = useState([]);

    // Expense data
    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState(null);

    // Budget info for selected TipoServicio
    const [presupuestoInfo, setPresupuestoInfo] = useState(null);
    const [presupuestos, setPresupuestos] = useState([]);
    const [cotizaciones, setCotizaciones] = useState([]);

    // Form state
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '',
        tipoServicioId: '',
        proveedorId: '',
        numeroFactura: '',
        precio: '',
        precioDisplay: '',
        fechaCompra: new Date().toISOString().split('T')[0],
        nota: '',
        archivoFactura: null,
        archivoNombre: ''
    });
    const [saving, setSaving] = useState(false);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryGasto, setSelectedHistoryGasto] = useState(null);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    // Filters (MATCHING TALLERES/PRODUCCION STYLE)
    const [filterRubro, setFilterRubro] = useState('');
    const [filterFecha, setFilterFecha] = useState('');

    const filteredGastos = useMemo(() => {
        return gastos.filter(g => {
            if (filterRubro && g.rubroId?.toString() !== filterRubro) return false;

            if (filterFecha) {
                let searchDate = '';
                if (filterFecha.includes('-')) {
                    searchDate = filterFecha; // yyyy-mm-dd
                } else if (filterFecha.includes('/')) {
                    const parts = filterFecha.split('/');
                    if (parts.length === 3) searchDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else {
                    // Partial match for typing (dd/mm/yyyy)
                    const formattedDate = formatDate(g.fechaCompra);
                    if (!formattedDate.includes(filterFecha)) return false;
                    return true;
                }
                if (searchDate && g.fechaCompra && !g.fechaCompra.startsWith(searchDate)) return false;
            }
            return true;
        });
    }, [gastos, filterRubro, filterFecha]);

    // FILTER RUBROS DROPDOWN (Only show rubros with expenses in current month)
    const rubrosConGastos = useMemo(() => {
        const idsConGastos = new Set(gastos.map(g => g.rubroId));
        return rubros.filter(r => idsConGastos.has(r.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [gastos, rubros]);



    const loadMasterData = useCallback(async () => {
        try {
            const [rubrosData, tiposData, proveedoresData] = await Promise.all([
                ghApi.getRubros(),
                ghApi.getTiposServicio(),
                ghApi.getProveedores()
            ]);
            setRubros(rubrosData);
            setTiposServicio(tiposData);
            setProveedores(proveedoresData);
        } catch (error) {
            console.error('Error loading master data:', error);
        }
    }, []);

    const loadGastos = useCallback(async () => {
        try {
            setLoading(true);
            const [gastosData, resumenData, presupuestosData, cotizacionesData] = await Promise.all([
                ghApi.getGastos(anio, mes),
                ghApi.getGastosResumen(anio, mes),
                ghApi.getPresupuestos(anio),
                ghApi.getCotizaciones(null, anio, mes)
            ]);
            setGastos(gastosData);
            setResumen(resumenData);
            setPresupuestos(presupuestosData);
            setCotizaciones(cotizacionesData);
        } catch (error) {
            console.error('Error loading gastos:', error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    // Calculate budget info for a specific tipo de servicio
    const getBudgetInfo = (tipoServicioId) => {
        const presupuestoMes = presupuestos.find(
            p => p.tipoServicioId === tipoServicioId && p.mes === mes
        );
        const gastadoTipo = gastos
            .filter(g => g.tipoServicioId === tipoServicioId)
            .reduce((sum, g) => sum + g.precio, 0);
        const presupuestoValor = presupuestoMes?.presupuesto || 0;
        return {
            presupuesto: presupuestoValor,
            gastado: gastadoTipo,
            restante: presupuestoValor - gastadoTipo
        };
    };

    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    useEffect(() => {
        loadGastos();
    }, [loadGastos]);

    // Cascading filter: Rubro -> TipoServicio
    useEffect(() => {
        if (formData.rubroId) {
            const filtered = tiposServicio.filter(t => t.rubroId === parseInt(formData.rubroId));
            setFilteredTipos(filtered);
            if (!filtered.find(t => t.id === parseInt(formData.tipoServicioId))) {
                setFormData(prev => ({ ...prev, tipoServicioId: '', proveedorId: '' }));
            }
        } else {
            setFilteredTipos([]);
        }
    }, [formData.rubroId, tiposServicio]);

    // Cascading filter: TipoServicio -> Proveedor
    useEffect(() => {
        if (formData.tipoServicioId) {
            const filtered = proveedores.filter(p => p.tipoServicioId === parseInt(formData.tipoServicioId));
            setFilteredProveedores(filtered);
            if (!filtered.find(p => p.id === parseInt(formData.proveedorId))) {
                setFormData(prev => ({ ...prev, proveedorId: '' }));
            }
        } else {
            setFilteredProveedores([]);
        }
    }, [formData.tipoServicioId, proveedores]);

    // Autofill Price from Cotizaciones when Proveedor is selected
    useEffect(() => {
        if (formData.proveedorId) {
            const cotizacion = cotizaciones.find(c => c.proveedorId === parseInt(formData.proveedorId));
            if (cotizacion && cotizacion.precioCotizado) {
                const numericValue = cotizacion.precioCotizado.toString();
                const formatted = formatCurrencyInput(numericValue);
                setFormData(prev => ({
                    ...prev,
                    precio: numericValue,
                    precioDisplay: formatted
                }));
            }
        }
    }, [formData.proveedorId, cotizaciones]);

    // Load budget info when TipoServicio is selected
    useEffect(() => {
        const loadPresupuestoInfo = async () => {
            if (formData.tipoServicioId) {
                try {
                    // Get presupuesto for this TipoServicio in current month/year
                    const presupuestos = await ghApi.getPresupuestos(anio);

                    // Annual Budget for this Tipo
                    const presupuestoAnual = presupuestos
                        .filter(p => p.tipoServicioId === parseInt(formData.tipoServicioId))
                        .reduce((sum, p) => sum + p.presupuesto, 0);

                    // Monthly Budget
                    const presupuestoMes = presupuestos.find(
                        p => p.tipoServicioId === parseInt(formData.tipoServicioId) && p.mes === mes
                    );

                    // Calculate how much has been spent for this TipoServicio (Monthly)
                    const gastadoTipoMes = gastos
                        .filter(g => g.tipoServicioId === parseInt(formData.tipoServicioId))
                        .reduce((sum, g) => sum + g.precio, 0);

                    const presupuestoValor = presupuestoMes?.presupuesto || 0;
                    const restante = presupuestoValor - gastadoTipoMes;

                    setPresupuestoInfo({
                        presupuestoAnual: presupuestoAnual,
                        presupuestoMensual: presupuestoValor,
                        gastadoMes: gastadoTipoMes,
                        restanteMes: restante,
                        tipoServicioNombre: tiposServicio.find(t => t.id === parseInt(formData.tipoServicioId))?.nombre || ''
                    });
                } catch (error) {
                    console.error('Error loading presupuesto info:', error);
                    setPresupuestoInfo(null);
                }
            } else {
                setPresupuestoInfo(null);
            }
        };
        loadPresupuestoInfo();
    }, [formData.tipoServicioId, anio, mes, gastos, tiposServicio]);

    const resetForm = () => {
        setEditItem(null);
        setFormData({
            rubroId: '',
            tipoServicioId: '',
            proveedorId: '',
            numeroFactura: '',
            precio: '',
            precioDisplay: '',
            fechaCompra: new Date().toISOString().split('T')[0],
            nota: '',
            archivoFactura: null,
            archivoNombre: ''
        });
    };

    const handleEdit = (gasto) => {
        setEditItem(gasto);
        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            tipoServicioId: gasto.tipoServicioId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            numeroFactura: gasto.numeroFactura || '',
            precio: gasto.precio?.toString() || '',
            precioDisplay: formatCurrencyInput(gasto.precio?.toString() || ''),
            fechaCompra: gasto.fechaCompra?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '',
            archivoFactura: gasto.archivoFactura || null,
            archivoNombre: gasto.archivoFactura ? 'Archivo adjunto' : ''
        });
        setShowModal(true);
    };

    // Format currency with thousands separator
    const formatCurrencyInput = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
    };

    const handlePriceChange = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        const formatted = formatCurrencyInput(value);
        setFormData(prev => ({ ...prev, precio: numericValue, precioDisplay: formatted }));
    };

    // Pick PDF file
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];

            // Check file size (max 5MB for Base64)
            if (file.size && file.size > 5 * 1024 * 1024) {
                Alert.alert('⚠️ Error', 'El archivo es muy grande. Máximo 5MB.');
                return;
            }

            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({
                        ...prev,
                        archivoFactura: reader.result,
                        archivoNombre: file.name
                    }));
                    Alert.alert('✅ Éxito', `Archivo "${file.name}" cargado correctamente. Recuerde guardar el gasto para que se almacene.`);
                };
                reader.onerror = () => {
                    Alert.alert('❌ Error', 'No se pudo leer el archivo');
                };
                reader.readAsDataURL(blob);
            } else {
                setFormData(prev => ({
                    ...prev,
                    archivoFactura: file.uri,
                    archivoNombre: file.name
                }));
                Alert.alert('✅ Éxito', `Archivo "${file.name}" seleccionado. Recuerde guardar el gasto.`);
            }
        } catch (error) {
            console.error('Error picking file:', error);
            Alert.alert('❌ Error', 'No se pudo seleccionar el archivo: ' + error.message);
        }
    };

    // Generate date options for picker
    const generateDateOptions = () => {
        const dates = [];
        const today = new Date();
        for (let i = 30; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push({
                value: date.toISOString().split('T')[0],
                label: date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            });
        }
        return dates.reverse();
    };

    const handleSubmit = async () => {
        if (!formData.rubroId || !formData.tipoServicioId || !formData.proveedorId) {
            Alert.alert('Error', 'Por favor complete todos los campos requeridos');
            return;
        }
        if (!formData.numeroFactura.trim()) {
            Alert.alert('Error', 'El número de factura es obligatorio');
            return;
        }
        if (!formData.precio) {
            Alert.alert('Error', 'El precio es obligatorio');
            return;
        }

        try {
            setSaving(true);
            const gastoData = {
                rubroId: parseInt(formData.rubroId),
                tipoServicioId: parseInt(formData.tipoServicioId),
                proveedorId: parseInt(formData.proveedorId),
                anio,
                mes,
                numeroFactura: formData.numeroFactura,
                precio: parseFloat(formData.precio),
                fechaCompra: formData.fechaCompra,
                nota: formData.nota,
                archivoFactura: formData.archivoFactura,
                archivoFacturaNombre: formData.archivoNombre
            };

            if (editItem) {
                await ghApi.updateGasto(editItem.id, gastoData);
                Alert.alert('Éxito', 'Gasto actualizado correctamente');
            } else {
                await ghApi.createGasto(gastoData);
                Alert.alert('Éxito', 'Gasto registrado correctamente');
            }
            setShowModal(false);
            resetForm();
            loadGastos();
        } catch (error) {
            console.error('Error saving gasto:', error);
            Alert.alert('Error', 'No se pudo guardar el gasto');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro de eliminar este gasto?')) {
                try {
                    await ghApi.deleteGasto(id);
                    loadGastos();
                    Alert.alert('Éxito', 'Gasto eliminado correctamente');
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar el gasto');
                }
            }
        } else {
            Alert.alert(
                'Confirmar',
                '¿Está seguro de eliminar este gasto?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await ghApi.deleteGasto(id);
                                loadGastos();
                            } catch (error) {
                                Alert.alert('Error', 'No se pudo eliminar el gasto');
                            }
                        }
                    }
                ]
            );
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

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-CO');
    };

    // Check if factura is filled to enable precio
    const isPrecioEnabled = formData.numeroFactura.trim().length > 0;

    return (
        <View style={styles.contentContainer}>
            {/* Header with Filters */}
            <View style={styles.header}>
                <View style={styles.filters}>
                    <Picker
                        selectedValue={anio}
                        onValueChange={setAnio}
                        style={styles.picker}
                    >
                        {anios.map(a => (
                            <Picker.Item key={a} label={a.toString()} value={a} />
                        ))}
                    </Picker>
                    <Picker
                        selectedValue={mes}
                        onValueChange={setMes}
                        style={styles.picker}
                    >
                        {ghApi.MESES.map(m => (
                            <Picker.Item key={m.value} label={m.label} value={m.value} />
                        ))}
                    </Picker>
                </View>

                {/* Advanced Filters (Right Aligned) */}
                <View style={styles.advancedFilters}>
                    <Text style={styles.filterLabel}>Filtrar por:</Text>

                    <View style={styles.filterItem}>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={filterFecha}
                                onChange={(e) => setFilterFecha(e.target.value)}
                                style={{
                                    height: 35, border: 'none', borderRadius: 0, padding: '0 8px', fontSize: 13, fontFamily: 'inherit', color: '#374151',
                                    outline: 'none', backgroundColor: 'transparent', minWidth: 130
                                }}
                            />
                        ) : (
                            <TextInput
                                style={styles.filterInput}
                                placeholder="dd/mm/aaaa"
                                placeholderTextColor="#9CA3AF"
                                value={filterFecha}
                                onChangeText={(t) => {
                                    if (t.length === 2 && filterFecha.length === 1) t += '/';
                                    if (t.length === 5 && filterFecha.length === 4) t += '/';
                                    if (t.length <= 10) setFilterFecha(t);
                                }}
                                keyboardType="numeric"
                            />
                        )}
                        {filterFecha ? (
                            <TouchableOpacity onPress={() => setFilterFecha('')} style={styles.clearFilterBtn}>
                                <Text style={styles.clearFilterText}>✕</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={styles.filterItem}>
                        <Picker
                            selectedValue={filterRubro}
                            onValueChange={setFilterRubro}
                            style={Platform.OS === 'web' ? { height: 35, width: 160, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: 13 } : styles.filterPicker}
                        >
                            <Picker.Item label="Todos los Rubros" value="" />
                            {rubrosConGastos.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                        </Picker>
                    </View>
                </View>
            </View>

            {/* Summary Cards */}
            {resumen && (
                <View style={styles.summaryContainer}>
                    <View style={[styles.summaryCard, styles.presupuestoCard]}>
                        <Text style={styles.summaryLabel}>Presupuesto</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(resumen.totalPresupuesto)}</Text>
                    </View>
                    <View style={[styles.summaryCard, styles.gastadoCard]}>
                        <Text style={styles.summaryLabel}>Gastado</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(resumen.totalGastado)}</Text>
                    </View>
                    <View style={[styles.summaryCard, resumen.totalRestante >= 0 ? styles.restanteCard : styles.excesoCard]}>
                        <Text style={styles.summaryLabel}>{resumen.totalRestante >= 0 ? 'Restante' : 'Exceso'}</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(Math.abs(resumen.totalRestante))}</Text>
                    </View>
                </View>
            )}

            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
                <Text style={styles.addButtonText}>+ Agregar Gasto</Text>
            </TouchableOpacity>

            {/* Gastos List */}
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={styles.loading} />
            ) : (
                <ScrollView style={styles.listContainer}>
                    {filteredGastos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No hay gastos registrados (con estos filtros)</Text>
                        </View>
                    ) : (
                        filteredGastos.map(gasto => (
                            <View key={gasto.id} style={styles.gastoCard}>
                                <View style={styles.gastoHeader}>
                                    <Text style={styles.gastoTipo}>{gasto.tipoServicioNombre}</Text>
                                    <Text style={styles.gastoPrecio}>{formatCurrency(gasto.precio)}</Text>
                                </View>
                                <Text style={styles.gastoRubro}>{gasto.rubroNombre}</Text>
                                <View style={styles.gastoDetails}>
                                    <Text style={styles.gastoDetail}>🏢 {gasto.proveedorNombre}</Text>
                                    <Text style={styles.gastoDetail}>📅 {formatDate(gasto.fechaCompra)}</Text>
                                    <Text style={styles.gastoDetail}>📄 Factura: {gasto.numeroFactura}</Text>
                                </View>
                                {gasto.nota && (
                                    <Text style={styles.gastoNota}>💬 {gasto.nota}</Text>
                                )}
                                {/* Budget Info */}
                                {(() => {
                                    const budget = getBudgetInfo(gasto.tipoServicioId);
                                    return (
                                        <View style={styles.budgetInfoRow}>
                                            <Text style={styles.budgetInfoLabel}>
                                                Tipo: Gastado {formatCurrency(budget.gastado)} / Presup. {formatCurrency(budget.presupuesto)}
                                            </Text>
                                            <Text style={[
                                                styles.budgetInfoValue,
                                                { color: budget.restante >= 0 ? '#059669' : '#DC2626' }
                                            ]}>
                                                {budget.restante >= 0 ? 'Disp: ' : 'Exceso: '}{formatCurrency(Math.abs(budget.restante))}
                                            </Text>
                                        </View>
                                    );
                                })()}
                                <View style={styles.cardActions}>
                                    {gasto.archivoFactura && (
                                        <TouchableOpacity
                                            style={styles.downloadButton}
                                            onPress={() => {
                                                if (Platform.OS === 'web') {
                                                    const link = document.createElement('a');
                                                    link.href = gasto.archivoFactura;
                                                    link.download = gasto.archivoFacturaNombre || `factura_${gasto.numeroFactura || gasto.id}.pdf`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                } else {
                                                    Alert.alert('Info', 'Descarga disponible solo en web');
                                                }
                                            }}
                                        >
                                            <Text style={styles.downloadButtonText}>📥 Descargar Factura</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.editCardButton}
                                        onPress={() => handleEdit(gasto)}
                                    >
                                        <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.historyButton}
                                        onPress={() => { setSelectedHistoryGasto(gasto); setShowHistoryModal(true); }}
                                    >
                                        <Text style={styles.historyButtonText}>🕒 Historial</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDelete(gasto.id)}
                                    >
                                        <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar Gasto' : 'Nuevo Gasto'}</Text>

                        <ScrollView style={styles.formContainer}>
                            {/* Rubro */}
                            <Text style={styles.label}>Rubro *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={formData.rubroId}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, rubroId: value }))}
                                >
                                    <Picker.Item label="Seleccione..." value="" />
                                    {rubros.map(r => (
                                        <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Tipo Servicio */}
                            <Text style={styles.label}>Tipo de Servicio *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={formData.tipoServicioId}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, tipoServicioId: value }))}
                                    enabled={filteredTipos.length > 0}
                                >
                                    <Picker.Item label="Seleccione..." value="" />
                                    {filteredTipos.map(t => (
                                        <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Proveedor */}
                            <Text style={styles.label}>
                                Proveedor * {formData.tipoServicioId && filteredProveedores.length === 0 && '(No hay proveedores para este tipo - agrégalos en la pestaña Proveedores)'}
                            </Text>
                            <View style={[styles.pickerContainer, filteredProveedores.length === 0 && styles.pickerDisabled]}>
                                <Picker
                                    selectedValue={formData.proveedorId}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, proveedorId: value }))}
                                    enabled={filteredProveedores.length > 0}
                                >
                                    <Picker.Item label={filteredProveedores.length === 0 ? "Sin proveedores disponibles" : "Seleccione..."} value="" />
                                    {filteredProveedores.map(p => (
                                        <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Número de Factura - Required first */}
                            <Text style={styles.label}>Número de Factura * (ingrese primero)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.numeroFactura}
                                onChangeText={(value) => setFormData(prev => ({ ...prev, numeroFactura: value }))}
                                placeholder="Obligatorio para habilitar precio"
                            />

                            {/* Precio with currency formatting - disabled until factura is filled */}
                            <Text style={styles.label}>Precio * {!isPrecioEnabled && '(ingrese factura primero)'}</Text>
                            <TextInput
                                style={[styles.input, !isPrecioEnabled && styles.inputDisabled]}
                                keyboardType="numeric"
                                value={formData.precioDisplay}
                                onChangeText={handlePriceChange}
                                placeholder="$ 0"
                                editable={isPrecioEnabled}
                            />

                            {/* Budget Info Panel */}
                            {presupuestoInfo && (
                                <View style={styles.budgetInfoPanel}>
                                    <Text style={styles.budgetInfoTitle}>
                                        📊 Presupuesto: {presupuestoInfo.tipoServicioNombre}
                                    </Text>
                                    {(() => {
                                        // Calculate live totals
                                        const currentPrice = parseFloat(formData.precioDisplay.replace(/[^0-9]/g, '')) || 0;

                                        // If editing, subtract the old price of this item from the total spent so far
                                        const originalPrice = editItem ? (editItem.precio || 0) : 0;
                                        const adjustedGastadoMes = (presupuestoInfo.gastadoMes || 0) - originalPrice;

                                        const liveGastado = adjustedGastadoMes + currentPrice;
                                        const liveRestante = (presupuestoInfo.presupuestoMensual || 0) - liveGastado;

                                        return (
                                            <>
                                                <View style={styles.budgetInfoRow}>
                                                    <View style={[styles.budgetInfoItem, { backgroundColor: '#E0E7FF' }]}>
                                                        <Text style={styles.budgetInfoLabel}>Presupuesto Anual</Text>
                                                        <Text style={styles.budgetInfoValue}>
                                                            {formatCurrency(presupuestoInfo.presupuestoAnual || 0)}
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
                                                            {formatCurrency(presupuestoInfo.presupuestoMensual || 0)}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Live Restante Indicator */}
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

                                    {presupuestoInfo.presupuestoMensual === 0 && (
                                        <Text style={styles.budgetNoData}>
                                            ℹ️ No hay presupuesto mensual asignado para este tipo de servicio
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Fecha de Compra - Beautiful Calendar Picker */}
                            <Text style={styles.label}>Fecha de Compra</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={formData.fechaCompra}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fechaCompra: e.target.value }))}
                                    style={{
                                        padding: 12,
                                        fontSize: 16,
                                        borderRadius: 8,
                                        border: '1px solid #D1D5DB',
                                        backgroundColor: '#F9FAFB',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer'
                                    }}
                                />
                            ) : (
                                <TextInput
                                    style={styles.input}
                                    value={formData.fechaCompra}
                                    onChangeText={(value) => setFormData(prev => ({ ...prev, fechaCompra: value }))}
                                    placeholder="YYYY-MM-DD"
                                />
                            )}

                            {/* PDF Attachment */}
                            <Text style={styles.label}>Factura Electrónica (PDF) - Opcional</Text>
                            <TouchableOpacity style={styles.fileButton} onPress={handlePickFile}>
                                <Text style={styles.fileButtonText}>
                                    {formData.archivoNombre || '📎 Seleccionar archivo PDF'}
                                </Text>
                            </TouchableOpacity>
                            {formData.archivoNombre && (
                                <TouchableOpacity
                                    onPress={() => setFormData(prev => ({ ...prev, archivoFactura: null, archivoNombre: '' }))}
                                >
                                    <Text style={styles.removeFile}>❌ Quitar archivo</Text>
                                </TouchableOpacity>
                            )}

                            {/* Nota */}
                            <Text style={styles.label}>Nota</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.nota}
                                onChangeText={(value) => setFormData(prev => ({ ...prev, nota: value }))}
                                placeholder="Observaciones..."
                                multiline
                                numberOfLines={3}
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => { setShowModal(false); resetForm(); }}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                                onPress={handleSubmit}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ExpenseHistoryModal
                visible={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                gasto={selectedHistoryGasto}
            />
        </View >
    );
}

// ===================== RUBROS TAB =====================
function RubrosTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rubrosData, tiposData] = await Promise.all([
                ghApi.getRubros(),
                ghApi.getTiposServicio()
            ]);
            setItems(rubrosData);
            setTipos(tiposData);
        } catch (error) {
            console.error('Error loading rubros:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAdd = () => {
        setEditItem(null);
        setNombre('');
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setNombre(item.nombre);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) {
            Alert.alert('Error', 'El nombre es obligatorio');
            return;
        }

        try {
            setSaving(true);
            if (editItem) {
                await ghApi.updateRubro(editItem.id, { nombre });
            } else {
                await ghApi.createRubro({ nombre });
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error('Error saving:', error);
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro de eliminar este rubro?')) {
                try {
                    await ghApi.deleteRubro(id);
                    loadData();
                    Alert.alert('Éxito', 'Rubro eliminado correctamente');
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar (puede tener datos relacionados)');
                }
            }
        } else {
            Alert.alert('Confirmar', '¿Eliminar este rubro?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive',
                    onPress: async () => {
                        try {
                            await ghApi.deleteRubro(id);
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar (puede tener datos relacionados)');
                        }
                    }
                }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📁 Rubros</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={{ marginBottom: 8 }}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            {/* List types of service */}
                            <View style={{ marginTop: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#E5E7EB' }}>
                                {tipos.filter(t => t.rubroId === item.id).map(t => (
                                    <Text key={t.id} style={{ fontSize: 13, color: '#6B7280', marginVertical: 1 }}>• {t.nombre}</Text>
                                ))}
                                {tipos.filter(t => t.rubroId === item.id).length === 0 && (
                                    <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Sin servicios asignados</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Rubro</Text>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
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

// ===================== SERVICIOS TAB =====================
function ServiciosTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [filterRubroId, setFilterRubroId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [rubroId, setRubroId] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [tiposData, rubrosData] = await Promise.all([
                ghApi.getTiposServicio(),
                ghApi.getRubros()
            ]);
            setItems(tiposData);
            setRubros(rubrosData);
        } catch (error) {
            console.error('Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const filteredItems = filterRubroId
        ? items.filter(i => i.rubroId === parseInt(filterRubroId))
        : items;

    const handleAdd = () => { setEditItem(null); setNombre(''); setRubroId(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setRubroId(item.rubroId?.toString() || ''); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim() || !rubroId) { Alert.alert('Error', 'Complete todos los campos'); return; }
        try {
            setSaving(true);
            if (editItem) {
                await ghApi.updateTipoServicio(editItem.id, { nombre, rubroId: parseInt(rubroId) });
            } else {
                await ghApi.createTipoServicio({ nombre, rubroId: parseInt(rubroId) });
            }
            setShowModal(false);
            loadData();
        } catch (error) { Alert.alert('Error', 'No se pudo guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro de eliminar este tipo de servicio?')) {
                try {
                    await ghApi.deleteTipoServicio(id);
                    loadData();
                    Alert.alert('Éxito', 'Tipo de servicio eliminado correctamente');
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar (puede tener datos relacionados)');
                }
            }
        } else {
            Alert.alert('Confirmar', '¿Eliminar este tipo de servicio?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive', onPress: async () => {
                        try {
                            await ghApi.deleteTipoServicio(id);
                            loadData();
                        } catch {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📋 Tipos de Servicio</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>
            {/* Filter */}
            <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Filtrar por Rubro:</Text>
                <View style={[styles.pickerContainer, { flex: 1 }]}>
                    <Picker selectedValue={filterRubroId} onValueChange={setFilterRubroId}>
                        <Picker.Item label="Todos" value="" />
                        {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                    </Picker>
                </View>
            </View>
            <ScrollView style={styles.listContainer}>
                {filteredItems.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemParent}>Rubro: {item.rubroNombre}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Tipo de Servicio</Text>
                        <Text style={styles.label}>Rubro *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={rubroId} onValueChange={setRubroId}>
                                <Picker.Item label="Seleccione..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
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

// ===================== PROVEEDORES TAB =====================
function ProveedoresTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [tiposServicio, setTiposServicio] = useState([]);
    const [filterRubroId, setFilterRubroId] = useState('');
    const [filterTipoId, setFilterTipoId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [tipoServicioId, setTipoServicioId] = useState('');
    const [rubroIdModal, setRubroIdModal] = useState('');  // For filtering tipos in modal
    const [telefono, setTelefono] = useState('');
    const [correo, setCorreo] = useState('');
    const [direccion, setDireccion] = useState('');
    const [nit, setNit] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [provData, tiposData, rubrosData] = await Promise.all([
                ghApi.getProveedores(),
                ghApi.getTiposServicio(),
                ghApi.getRubros()
            ]);
            setItems(provData);
            setTiposServicio(tiposData);
            setRubros(rubrosData);
        } catch (error) {
            console.error('Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Filter tipos by rubro
    const filteredTipos = filterRubroId
        ? tiposServicio.filter(t => t.rubroId === parseInt(filterRubroId))
        : tiposServicio;

    // Filter items
    let filteredItems = items;
    if (filterTipoId) {
        filteredItems = filteredItems.filter(i => i.tipoServicioId === parseInt(filterTipoId));
    } else if (filterRubroId) {
        const tipoIds = filteredTipos.map(t => t.id);
        filteredItems = filteredItems.filter(i => tipoIds.includes(i.tipoServicioId));
    }

    // Reset tipo filter when rubro changes
    useEffect(() => {
        setFilterTipoId('');
    }, [filterRubroId]);

    const resetForm = () => {
        setNombre('');
        setTipoServicioId('');
        setRubroIdModal('');
        setTelefono('');
        setCorreo('');
        setDireccion('');
        setNit('');
    };

    // Filter tipos in modal by selected rubro
    const tiposInModal = rubroIdModal
        ? tiposServicio.filter(t => t.rubroId === parseInt(rubroIdModal))
        : tiposServicio;

    const handleAdd = () => { setEditItem(null); resetForm(); setShowModal(true); };
    const handleEdit = (item) => {
        setEditItem(item);
        setNombre(item.nombre || '');
        setTipoServicioId(item.tipoServicioId?.toString() || '');
        // Find the rubro for the tipo
        const tipo = tiposServicio.find(t => t.id === item.tipoServicioId);
        setRubroIdModal(tipo?.rubroId?.toString() || '');
        setTelefono(item.telefono || '');
        setCorreo(item.correo || '');
        setDireccion(item.direccion || '');
        setNit(item.nit || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim() || !tipoServicioId) { Alert.alert('Error', 'Nombre y Tipo de Servicio son obligatorios'); return; }
        try {
            setSaving(true);
            const data = {
                nombre: nombre.trim(),
                tipoServicioId: parseInt(tipoServicioId),
                telefono: telefono.trim() || null,
                correo: correo.trim() || null,
                direccion: direccion.trim() || null,
                nit: nit.trim() || null
            };
            if (editItem) {
                await ghApi.updateProveedor(editItem.id, data);
            } else {
                await ghApi.createProveedor(data);
            }
            setShowModal(false);
            loadData();
        } catch (error) { Alert.alert('Error', 'No se pudo guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro de eliminar este proveedor?')) {
                try {
                    await ghApi.deleteProveedor(id);
                    loadData();
                    Alert.alert('Éxito', 'Proveedor eliminado correctamente');
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar el proveedor');
                }
            }
        } else {
            Alert.alert('Confirmar', '¿Eliminar este proveedor?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive', onPress: async () => {
                        try {
                            await ghApi.deleteProveedor(id);
                            loadData();
                        } catch {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>🏢 Proveedores</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>
            {/* Filters */}
            <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Rubro:</Text>
                <View style={[styles.pickerContainer, { flex: 1, marginRight: 8 }]}>
                    <Picker selectedValue={filterRubroId} onValueChange={setFilterRubroId}>
                        <Picker.Item label="Todos" value="" />
                        {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                    </Picker>
                </View>
                <Text style={styles.filterLabel}>Tipo:</Text>
                <View style={[styles.pickerContainer, { flex: 1 }]}>
                    <Picker selectedValue={filterTipoId} onValueChange={setFilterTipoId} enabled={filteredTipos.length > 0}>
                        <Picker.Item label="Todos" value="" />
                        {filteredTipos.map(t => <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />)}
                    </Picker>
                </View>
            </View>
            <ScrollView style={styles.listContainer}>
                {filteredItems.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemParent}>Tipo: {item.tipoServicioNombre}</Text>
                            {item.nit && <Text style={styles.itemDetail}>📋 NIT: {item.nit}</Text>}
                            {item.telefono && <Text style={styles.itemDetail}>📞 {item.telefono}</Text>}
                            {item.correo && <Text style={styles.itemDetail}>✉️ {item.correo}</Text>}
                            {item.direccion && <Text style={styles.itemDetail}>📍 {item.direccion}</Text>}
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Proveedor</Text>
                        <ScrollView style={styles.formContainer}>
                            <Text style={styles.label}>Rubro (para filtrar tipos)</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={rubroIdModal} onValueChange={(val) => { setRubroIdModal(val); setTipoServicioId(''); }}>
                                    <Picker.Item label="Todos los rubros" value="" />
                                    {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                                </Picker>
                            </View>
                            <Text style={styles.label}>Tipo de Servicio *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={tipoServicioId} onValueChange={setTipoServicioId}>
                                    <Picker.Item label="Seleccione..." value="" />
                                    {tiposInModal.map(t => <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />)}
                                </Picker>
                            </View>
                            <Text style={styles.label}>Nombre *</Text>
                            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del proveedor" />
                            <Text style={styles.label}>NIT (opcional)</Text>
                            <TextInput style={styles.input} value={nit} onChangeText={setNit} placeholder="Ej: 900123456-7" />
                            <Text style={styles.label}>Teléfono (opcional)</Text>
                            <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="Ej: 3001234567" keyboardType="phone-pad" />
                            <Text style={styles.label}>Correo (opcional)</Text>
                            <TextInput style={styles.input} value={correo} onChangeText={setCorreo} placeholder="Ej: proveedor@email.com" keyboardType="email-address" autoCapitalize="none" />
                            <Text style={styles.label}>Dirección (opcional)</Text>
                            <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholder="Ej: Calle 123 #45-67" />
                        </ScrollView>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
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

// ===================== GRAFICAS TAB =====================
function GraficasTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = useState(''); // '' = Todos (Anual), 1-12 = Mes

    // Data storage
    const [gastosTotales, setGastosTotales] = useState([]); // Array of 12 months summaries
    const [allGastosRaw, setAllGastosRaw] = useState([]); // Flat list of all expenses

    // View state
    const [resumenVisual, setResumenVisual] = useState(null);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    // INTERACTIVE DETAILS (Ported from Talleres)
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailTitle, setDetailTitle] = useState('');
    const [detailGastos, setDetailGastos] = useState([]);
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');

    const displayedDetailGastos = useMemo(() => {
        if (!filterStart && !filterEnd) return detailGastos;

        const parseDate = (d) => {
            if (!d || d.length !== 10) return null;
            if (d.includes('-')) return new Date(d); // Already YYYY-MM-DD
            const p = d.split('/');
            if (p.length < 3) return null;
            return new Date(`${p[2]}-${p[1]}-${p[0]}`);
        };

        const s = parseDate(filterStart);
        const e = parseDate(filterEnd);

        return detailGastos.filter(g => {
            const gd = new Date(g.fechaCompra); gd.setHours(0, 0, 0, 0); // GH uses fechaCompra
            if (s && gd < s) return false;
            if (e && gd > e) return false;
            return true;
        });
    }, [detailGastos, filterStart, filterEnd]);

    const handleDetailClick = (type, item) => {
        const name = item.nombre || item[0]; // item can be {nombre...} or [nombre, valor]
        const id = item.id; // May be undefined for tuple types

        setDetailTitle(name);
        setFilterStart('');
        setFilterEnd('');
        setShowDetailModal(true);

        console.log('DEBUG Detail Click:', { type, id, name, totalRaw: allGastosRaw.length });

        try {
            let filtered = [];
            // Helper for flexible ID check (from Talleres logic)
            const checkId = (obj, prop, target) => {
                if (!target) return false;
                return obj[prop] == target;
            };

            if (type === 'tipo') { // Tipo de Servicio
                filtered = allGastosRaw.filter(g => {
                    if (id && g.tipoServicioId == id) return true;
                    return g.tipoServicioNombre === name;
                });
            } else if (type === 'rubro') {
                filtered = allGastosRaw.filter(g => {
                    // GH Rubro check. item is usually {id, nombre} or [nombre, val]
                    // If tuple, we only have name.
                    if (id && g.rubroId == id) return true;
                    return g.rubroNombre === name;
                });
            } else if (type === 'proveedor') {
                filtered = allGastosRaw.filter(g => {
                    if (id && g.proveedorId == id) return true;
                    return g.proveedorNombre === name;
                });
            }

            // Fallback filtering if ID failed but name exists
            if (filtered.length === 0 && name) {
                console.log('DEBUG: Fallback filter by name', name);
                const targetName = String(name).toLowerCase().trim();
                filtered = allGastosRaw.filter(g => {
                    let gName = '';
                    if (type === 'tipo') gName = g.tipoServicioNombre;
                    else if (type === 'rubro') gName = g.rubroNombre;
                    else if (type === 'proveedor') gName = g.proveedorNombre;

                    return gName && gName.toLowerCase().trim() === targetName;
                });
            }

            // Month Filter (Global) must apply?
            // User likely expects "Annual Dashboard" -> All year details.
            // "Monthly Dashboard" -> Month details.
            if (mesSeleccionado) {
                filtered = filtered.filter(g => g.mes === parseInt(mesSeleccionado));
            }

            filtered.sort((a, b) => new Date(b.fechaCompra) - new Date(a.fechaCompra));
            console.log('DEBUG Detail Filtered Count:', filtered.length);
            setDetailGastos(filtered);
        } catch (err) {
            console.error('Error filtering details:', err);
            setDetailGastos([]);
        }
    };

    const formatDateLocal = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-CO');
    };


    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            // 1. Load Monthly Summaries (for the bottom table and annual totals)
            const gastosPromises = Array.from({ length: 12 }, (_, i) =>
                ghApi.getGastosResumen(anio, i + 1)
            );
            const resumenMeses = await Promise.all(gastosPromises);
            setGastosTotales(resumenMeses);

            // 2. Load All Raw Expenses (for filtering by month/rubro/tipo)
            const allGastos = [];
            for (let mes = 1; mes <= 12; mes++) {
                try {
                    const gastosMes = await ghApi.getGastos(anio, mes);
                    // Inject 'mes' into each record if not present, though usually it is
                    gastosMes.forEach(g => g.mes = mes);
                    allGastos.push(...gastosMes);
                } catch (e) { /* ignore */ }
            }
            setAllGastosRaw(allGastos);

        } catch (error) {
            console.error('Error loading graficas:', error);
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Recalculate Visual Summary when Data OR Month Filter changes
    useEffect(() => {
        if (loading) return;

        let filteredGastos = [];
        let totalPresupuesto = 0;
        let totalGastado = 0;

        if (mesSeleccionado) {
            // MONTHLY VIEW
            const mesNum = parseInt(mesSeleccionado);
            filteredGastos = allGastosRaw.filter(g => g.mes === mesNum);

            // Get budget/spent totals from the summary array for this specific month
            const resumenMes = gastosTotales[mesNum - 1] || {};
            totalPresupuesto = resumenMes.totalPresupuesto || 0;
            totalGastado = resumenMes.totalGastado || 0;

        } else {
            // ANNUAL VIEW
            filteredGastos = allGastosRaw;
            totalPresupuesto = gastosTotales.reduce((sum, m) => sum + (m.totalPresupuesto || 0), 0);
            totalGastado = gastosTotales.reduce((sum, m) => sum + (m.totalGastado || 0), 0);
        }

        // Calculate Breakdowns
        const porRubro = {};
        const porTipo = {};
        const porProveedor = {};

        filteredGastos.forEach(g => {
            porRubro[g.rubroNombre] = (porRubro[g.rubroNombre] || 0) + g.precio;
            porTipo[g.tipoServicioNombre] = (porTipo[g.tipoServicioNombre] || 0) + g.precio;
            porProveedor[g.proveedorNombre] = (porProveedor[g.proveedorNombre] || 0) + g.precio;
        });

        // For Performance Bars (Detailed Budgets)
        let desempenoDetallado = [];
        if (mesSeleccionado) {
            desempenoDetallado = (gastosTotales[parseInt(mesSeleccionado) - 1]?.resumenPorTipo || []).map(item => ({
                id: item.tipoServicioId,
                nombre: item.tipoServicioNombre,
                gastado: item.gastado,
                presupuesto: item.presupuesto
            }));
        } else {
            // Aggregate annual performance per type
            const annualMap = {};
            gastosTotales.forEach(mes => {
                (mes.resumenPorTipo || []).forEach(item => {
                    const id = item.tipoServicioId;
                    if (!annualMap[id]) {
                        annualMap[id] = { nombre: item.tipoServicioNombre, gastado: 0, presupuesto: 0 };
                    }
                    annualMap[id].gastado += item.gastado;
                    annualMap[id].presupuesto += item.presupuesto;
                });
            });
            desempenoDetallado = Object.values(annualMap).sort((a, b) => b.gastado - a.gastado);
        }

        setResumenVisual({
            titulo: mesSeleccionado ? `Mensual - ${ghApi.getMesNombre(mesSeleccionado)}` : 'Anual Completo',
            totalPresupuesto,
            totalGastado,
            totalRestante: totalPresupuesto - totalGastado,
            porcentajeUsado: totalPresupuesto > 0 ? ((totalGastado / totalPresupuesto) * 100).toFixed(1) : 0,
            porRubro: Object.entries(porRubro).sort((a, b) => b[1] - a[1]),
            porTipo: Object.entries(porTipo).sort((a, b) => b[1] - a[1]),
            porProveedor: Object.entries(porProveedor).sort((a, b) => b[1] - a[1]),
            desempenoDetallado,
            totalGastos: filteredGastos.length
        });

    }, [mesSeleccionado, gastosTotales, allGastosRaw, loading]);


    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const getProgressColor = (percentage) => {
        if (percentage >= 100) return '#DC2626';
        if (percentage >= 80) return '#F59E0B';
        return '#10B981';
    };

    // Logo source for PDF
    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    // Helper: Load Image as Base64 for PDF (matching DashboardScreen pattern)
    const getBase64FromUrl = async (url) => {
        if (Platform.OS !== 'web') {
            try {
                const base64 = await FileSystem.readAsStringAsync(url, {
                    encoding: 'base64',
                });
                const ext = url.split('.').pop().toLowerCase();
                const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
                const mime = mimeTypes[ext] || 'image/jpeg';
                return `data:${mime};base64,${base64}`;
            } catch (err) {
                console.log('Error reading file with expo-file-system, trying fetch:', err);
                const tempPath = FileSystem.cacheDirectory + 'temp_logo.' + (url.split('.').pop() || 'jpg');
                await FileSystem.downloadAsync(url, tempPath);
                const base64 = await FileSystem.readAsStringAsync(tempPath, {
                    encoding: 'base64',
                });
                return `data:image/jpeg;base64,${base64}`;
            }
        }
        // Web fallback using FileReader
        const data = await fetch(url);
        const blob = await data.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                resolve(reader.result);
            };
        });
    };

    const generateReport = async () => {
        if (!resumenVisual) return;
        setLoading(true);

        try {
            // Dynamic import of jsPDF (avoids Android TextDecoder crash)
            let jsPDF, autoTable;
            if (Platform.OS === 'web') {
                try {
                    const jsPDFModule = await import('jspdf');
                    jsPDF = jsPDFModule.jsPDF;
                    const autoTableModule = await import('jspdf-autotable');
                    autoTable = autoTableModule.default;
                } catch (e) {
                    console.error("Error loading PDF libs", e);
                    Alert.alert("Error", "Error cargando librerías de PDF.");
                    setLoading(false);
                    return;
                }
            } else {
                try {
                    const jsPDFModule = await import('jspdf');
                    jsPDF = jsPDFModule.jsPDF;
                    const autoTableModule = await import('jspdf-autotable');
                    autoTable = autoTableModule.default;
                } catch (e) {
                    Alert.alert("Info", "Funcionalidad PDF en mantenimiento para móviles. Por favor use la versión Web.");
                    console.error("PDF mobile load error", e);
                    setLoading(false);
                    return;
                }
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 15;
            let yPos = 20;

            // Load Logo
            try {
                const asset = Asset.fromModule(logoSource);
                await asset.downloadAsync();
                const base64Logo = await getBase64FromUrl(asset.uri);
                doc.addImage(base64Logo, 'JPEG', margin, 10, 30, 30);
            } catch (err) {
                console.log("Error loading logo for PDF", err);
                // Fallback: print text
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 58, 95);
                doc.text('ALEPH', margin, 25);
            }

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 95);
            const title = `INFORME GH - ${resumenVisual.titulo.toUpperCase()}`;
            doc.text(title, pageWidth / 2, 20, { align: 'center' });

            // Subtitle
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, pageWidth / 2, 28, { align: 'center' });

            yPos = 45;

            // KPIs Section
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('RESUMEN PRESUPUESTAL', margin, yPos);
            yPos += 8;

            const kpiColumns = ['Presupuesto', 'Ejecutado', 'Disponible', '% Ejecutado', 'Registros'];
            const disponibleColor = resumenVisual.totalRestante >= 0 ? 'Verde' : 'Rojo';
            const kpiData = [[
                ghApi.formatCurrency(resumenVisual.totalPresupuesto),
                ghApi.formatCurrency(resumenVisual.totalGastado),
                `${disponibleColor}|${ghApi.formatCurrency(Math.abs(resumenVisual.totalRestante))}`,
                `${resumenVisual.porcentajeUsado}%`,
                resumenVisual.totalGastos.toString()
            ]];

            autoTable(doc, {
                head: [kpiColumns],
                body: kpiData,
                startY: yPos,
                styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
                headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
                didParseCell: (data) => {
                    const raw = data.cell.raw?.toString() || '';
                    if (raw.includes('|')) {
                        const [color, value] = raw.split('|');
                        data.cell.text = value;
                        if (color === 'Verde') data.cell.styles.textColor = [40, 167, 69];
                        else if (color === 'Rojo') data.cell.styles.textColor = [220, 53, 69];
                    }
                }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            // Detailed Table
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('DETALLE DE GASTOS POR RUBRO Y SERVICIO', margin, yPos);
            yPos += 5;

            // Fetch Data
            const [allRubros] = await Promise.all([
                ghApi.getRubros()
            ]);

            let periodData = allGastosRaw;
            if (mesSeleccionado) periodData = allGastosRaw.filter(g => g.mes === parseInt(mesSeleccionado));

            // Prepare Table Data
            const tableRows = [];

            const rubrosWithTotal = allRubros.map(r => {
                const total = periodData.filter(g => g.rubroId === r.id).reduce((s, g) => s + g.precio, 0);
                return { ...r, total };
            }).sort((a, b) => b.total - a.total);

            rubrosWithTotal.forEach(rubro => {
                // Rubro Header Row
                tableRows.push([
                    { content: `[RUBRO] ${rubro.nombre.toUpperCase()}`, colSpan: 2, styles: { fillColor: [224, 231, 255], fontStyle: 'bold', textColor: [30, 58, 95] } },
                    { content: ghApi.formatCurrency(rubro.total), styles: { fillColor: [224, 231, 255], fontStyle: 'bold', halign: 'right', textColor: [30, 58, 95] } }
                ]);

                const rubroGastos = periodData.filter(g => g.rubroId === rubro.id);
                const typesMap = {};
                rubroGastos.forEach(g => {
                    const tid = g.tipoServicioId;
                    if (!typesMap[tid]) typesMap[tid] = { name: g.tipoServicioNombre, total: 0, provs: {} };
                    typesMap[tid].total += g.precio;

                    const pid = g.proveedorId;
                    if (!typesMap[tid].provs[pid]) typesMap[tid].provs[pid] = { name: g.proveedorNombre, total: 0 };
                    typesMap[tid].provs[pid].total += g.precio;
                });

                if (Object.keys(typesMap).length === 0) {
                    tableRows.push([{ content: 'Sin movimientos', colSpan: 3, styles: { textColor: [150, 150, 150], fontStyle: 'italic' } }]);
                } else {
                    Object.values(typesMap).forEach(type => {
                        tableRows.push([
                            { content: `   > ${type.name}`, colSpan: 2, styles: { fillColor: [248, 250, 252] } },
                            { content: ghApi.formatCurrency(type.total), styles: { fillColor: [248, 250, 252], halign: 'right' } }
                        ]);

                        Object.values(type.provs).forEach(prov => {
                            tableRows.push([
                                { content: '' },
                                { content: `     - ${prov.name}`, styles: { textColor: [80, 80, 80] } },
                                { content: ghApi.formatCurrency(prov.total), styles: { halign: 'right', textColor: [80, 80, 80] } }
                            ]);
                        });
                    });
                }
            });

            autoTable(doc, {
                startY: yPos,
                head: [['Concepto', 'Proveedor / Detalle', 'Total']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
                headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 40, halign: 'right' }
                }
            });

            // Save
            const filename = `Informe_GH_${anio}_${mesSeleccionado ? ghApi.getMesNombre(parseInt(mesSeleccionado)) : 'Anual'}.pdf`;
            doc.save(filename);

            Alert.alert('✅ Éxito', 'Informe PDF descargado correctamente');

        } catch (error) {
            console.error('Error generating PDF:', error);
            Alert.alert('Error', 'No se pudo generar el PDF: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Cargando gráficas...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>📊 Dashboard {resumenVisual ? resumenVisual.titulo : ''}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity style={grafStyles.reportButton} onPress={generateReport}>
                        <Text style={grafStyles.reportButtonText}>📄 Generar Informe</Text>
                    </TouchableOpacity>

                    <View style={styles.yearSelector}>
                        <Picker selectedValue={mesSeleccionado} onValueChange={setMesSeleccionado} style={{ width: 130, height: 40, marginRight: 8 }}>
                            <Picker.Item label="Todo el Año" value="" />
                            {Array.from({ length: 12 }, (_, i) => <Picker.Item key={i + 1} label={ghApi.getMesNombre(i + 1)} value={(i + 1).toString()} />)}
                        </Picker>
                        <Picker selectedValue={anio} onValueChange={setAnio} style={{ width: 100, height: 40 }}>
                            {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                        </Picker>
                    </View>
                </View>
            </View>

            {resumenVisual && (
                <>
                    {/* KPI Cards */}
                    <View style={grafStyles.kpiContainer}>
                        <View style={grafStyles.kpiCard}>
                            <Text style={grafStyles.kpiLabel}>💰 Presupuesto</Text>
                            <Text style={grafStyles.kpiValue}>{formatCurrency(resumenVisual.totalPresupuesto)}</Text>
                        </View>
                        <View style={[grafStyles.kpiCard, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={grafStyles.kpiLabel}>📊 Gastado</Text>
                            <Text style={[grafStyles.kpiValue, { color: '#047857' }]}>{formatCurrency(resumenVisual.totalGastado)}</Text>
                        </View>
                        <View style={[grafStyles.kpiCard, { backgroundColor: resumenVisual.totalRestante >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                            <Text style={grafStyles.kpiLabel}>{resumenVisual.totalRestante >= 0 ? '✅ Restante' : '⚠️ Exceso'}</Text>
                            <Text style={[grafStyles.kpiValue, { color: resumenVisual.totalRestante >= 0 ? '#059669' : '#DC2626' }]}>
                                {formatCurrency(Math.abs(resumenVisual.totalRestante))}
                            </Text>
                        </View>
                        <View style={grafStyles.kpiCard}>
                            <Text style={grafStyles.kpiLabel}>📋 Registros</Text>
                            <Text style={grafStyles.kpiValue}>{resumenVisual.totalGastos}</Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={grafStyles.progressSection}>
                        <Text style={grafStyles.sectionTitle}>Ejecución {resumenVisual.titulo}</Text>
                        <View style={grafStyles.progressBar}>
                            <View style={[
                                grafStyles.progressFill,
                                {
                                    width: `${Math.min(resumenVisual.porcentajeUsado, 100)}%`,
                                    backgroundColor: getProgressColor(resumenVisual.porcentajeUsado)
                                }
                            ]} />
                        </View>
                        <Text style={grafStyles.progressText}>
                            {resumenVisual.porcentajeUsado}% ejecutado
                        </Text>
                    </View>

                    {/* Performance by Service Type - Progress Bars */}
                    {resumenVisual.desempenoDetallado?.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>⚙️ Desempeño por Tipo de Servicio</Text>
                            {resumenVisual.desempenoDetallado.map((item, idx) => {
                                const percentage = item.presupuesto > 0 ? Math.round((item.gastado / item.presupuesto) * 100) : (item.gastado > 0 ? 101 : 0);
                                const isExceeded = item.gastado > item.presupuesto && item.presupuesto > 0;
                                const isZeroBudgetWithGasto = item.presupuesto === 0 && item.gastado > 0;

                                return (
                                    <TouchableOpacity key={idx} style={grafStyles.rubroReportRow} onPress={() => handleDetailClick('tipo', item)}>
                                        <View style={grafStyles.rubroReportHeader}>
                                            <Text style={grafStyles.rubroReportName}>{item.nombre} 👆</Text>
                                            <Text style={[grafStyles.rubroReportStatus, (isExceeded || isZeroBudgetWithGasto) ? { color: '#DC2626' } : { color: '#059669' }]}>
                                                {formatCurrency(item.gastado)} / {formatCurrency(item.presupuesto)}
                                            </Text>
                                        </View>
                                        <View style={grafStyles.rubroProgressBarContainer}>
                                            <View style={[
                                                grafStyles.rubroProgressBar,
                                                {
                                                    width: `${Math.min(100, percentage)}%`,
                                                    backgroundColor: (isExceeded || isZeroBudgetWithGasto) ? '#DC2626' : '#8B5CF6'
                                                }
                                            ]} />
                                        </View>
                                        {(isExceeded || isZeroBudgetWithGasto) && (
                                            <Text style={grafStyles.rubroWarningText}>⚠️ Superó presupuesto por {formatCurrency(item.gastado - item.presupuesto)}</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Chart: Gastos por Rubro */}
                    {resumenVisual.porRubro.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>📁 Gastos por Rubro</Text>
                            {resumenVisual.porRubro.map(([nombre, valor], idx) => {
                                const maxVal = resumenVisual.porRubro[0][1];
                                const width = (valor / maxVal) * 100;
                                return (
                                    <View key={idx} style={grafStyles.barRow}>
                                        <Text style={grafStyles.barLabel} numberOfLines={1}>{nombre}</Text>
                                        <View style={grafStyles.barContainer}>
                                            <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#3B82F6' }]} />
                                        </View>
                                        <Text style={grafStyles.barValue}>{formatCurrency(valor)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Chart: Gastos por Tipo de Servicio */}
                    {resumenVisual.porTipo.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>📋 Gastos por Servicio (Top 5)</Text>
                            {resumenVisual.porTipo.slice(0, 5).map(([nombre, valor], idx) => {
                                const maxVal = resumenVisual.porTipo[0][1];
                                const width = (valor / maxVal) * 100;
                                return (
                                    <View key={idx} style={grafStyles.barRow}>
                                        <Text style={grafStyles.barLabel} numberOfLines={1}>{nombre}</Text>
                                        <View style={grafStyles.barContainer}>
                                            <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#8B5CF6' }]} />
                                        </View>
                                        <Text style={grafStyles.barValue}>{formatCurrency(valor)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Chart: Gastos por Proveedor */}
                    {resumenVisual.porProveedor.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>🏢 Gastos por Proveedor (Top 5)</Text>
                            {resumenVisual.porProveedor.slice(0, 5).map(([nombre, valor], idx) => {
                                const maxVal = resumenVisual.porProveedor[0][1];
                                const width = (valor / maxVal) * 100;
                                return (
                                    <View key={idx} style={grafStyles.barRow}>
                                        <Text style={grafStyles.barLabel} numberOfLines={1}>{nombre}</Text>
                                        <View style={grafStyles.barContainer}>
                                            <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#10B981' }]} />
                                        </View>
                                        <Text style={grafStyles.barValue}>{formatCurrency(valor)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                </>
            )}

            {/* DETAIL MODAL (Talleres Style) */}
            <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1F2937', flex: 1 }}>Detalle: {detailTitle}</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={{ padding: 5 }}>
                                <Text style={{ fontSize: 20, color: '#6B7280' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Date Filters Row */}
                        <View style={{ flexDirection: 'row', gap: 10, padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>Desde:</Text>
                                {Platform.OS === 'web' ? (
                                    <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} style={{ width: '100%', border: '1px solid #DDD', borderRadius: 4, padding: 4 }} />
                                ) : (
                                    <TextInput
                                        style={{ backgroundColor: 'white', borderRadius: 4, paddingHorizontal: 5, height: 35, fontSize: 12, borderWidth: 1, borderColor: '#DDD' }}
                                        placeholder="DD/MM/AAAA"
                                        value={filterStart}
                                        onChangeText={setFilterStart}
                                    />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>Hasta:</Text>
                                {Platform.OS === 'web' ? (
                                    <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} style={{ width: '100%', border: '1px solid #DDD', borderRadius: 4, padding: 4 }} />
                                ) : (
                                    <TextInput
                                        style={{ backgroundColor: 'white', borderRadius: 4, paddingHorizontal: 5, height: 35, fontSize: 12, borderWidth: 1, borderColor: '#DDD' }}
                                        placeholder="DD/MM/AAAA"
                                        value={filterEnd}
                                        onChangeText={setFilterEnd}
                                    />
                                )}
                            </View>
                        </View>

                        <ScrollView style={{ maxHeight: 400 }}>
                            {displayedDetailGastos.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: '#6B7280', marginVertical: 20 }}>No se encontraron registros.</Text>
                            ) : (
                                displayedDetailGastos.map(g => (
                                    <View key={g.id} style={{
                                        backgroundColor: '#F9FAFB',
                                        padding: 12,
                                        marginBottom: 8,
                                        borderRadius: 8,
                                        borderLeftWidth: 3,
                                        borderLeftColor: '#2563EB'
                                    }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontWeight: 'bold', color: '#374151' }}>{formatDateLocal(g.fechaCompra)}</Text>
                                            <Text style={{ fontWeight: 'bold', color: '#059669' }}>{formatCurrency(g.precio)}</Text>
                                        </View>
                                        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                                            {g.tipoServicioNombre || g.rubroNombre || 'Gasto'}
                                        </Text>

                                        {g.proveedorNombre && (
                                            <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>🏢 {g.proveedorNombre}</Text>
                                        )}
                                        <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>📄 Fac: {g.numeroFactura}</Text>

                                        {g.nota && <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>"{g.nota}"</Text>}
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={{ marginTop: 15, backgroundColor: '#E5E7EB', padding: 12, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => setShowDetailModal(false)}
                        >
                            <Text style={{ fontWeight: 'bold', color: '#374151' }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {mesSeleccionado === '' && (
                <View style={grafStyles.chartSection}>
                    <Text style={grafStyles.sectionTitle}>📅 Resumen Mensual</Text>
                    <View style={grafStyles.tableHeader}>
                        <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader, { flex: 2 }]}>Mes</Text>
                        <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Presupuesto</Text>
                        <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Gastado</Text>
                        <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Restante</Text>
                    </View>
                    {gastosTotales.map((mes, idx) => (
                        <View key={idx} style={[grafStyles.tableRow, idx % 2 === 0 && grafStyles.tableRowAlt]}>
                            <Text style={[grafStyles.tableCell, { flex: 2 }]}>{ghApi.getMesNombre(idx + 1)}</Text>
                            <Text style={grafStyles.tableCell}>{formatCurrency(mes.totalPresupuesto || 0)}</Text>
                            <Text style={grafStyles.tableCell}>{formatCurrency(mes.totalGastado || 0)}</Text>
                            <Text style={[
                                grafStyles.tableCell,
                                { color: (mes.totalPresupuesto - mes.totalGastado) >= 0 ? '#059669' : '#DC2626' }
                            ]}>
                                {formatCurrency((mes.totalPresupuesto || 0) - (mes.totalGastado || 0))}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

        </ScrollView >
    );
}

// Graficas-specific styles
const grafStyles = StyleSheet.create({
    kpiContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    kpiCard: {
        flex: 1,
        minWidth: 180,
        backgroundColor: '#EBF5FF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    kpiLabel: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 8,
    },
    kpiValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E3A5F',
    },
    progressSection: {
        margin: 16,
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 12,
    },
    progressBar: {
        height: 24,
        backgroundColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 12,
    },
    progressText: {
        marginTop: 8,
        textAlign: 'center',
        color: '#6B7280',
        fontWeight: '500',
    },
    chartSection: {
        margin: 16,
        marginTop: 0,
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    barLabel: {
        width: 140,
        fontSize: 12,
        color: '#2563EB', // Blue to indicate clickable
        textDecorationLine: 'underline',
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginHorizontal: 8,
    },
    bar: {
        height: '100%',
        borderRadius: 4,
    },
    barValue: {
        width: 100,
        fontSize: 12,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'right',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        padding: 10,
        borderRadius: 6,
    },
    tableRow: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableRowAlt: {
        backgroundColor: '#F9FAFB',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        color: '#374151',
    },
    tableCellHeader: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    // Detailed Performance Styles
    rubroReportRow: { marginBottom: 16 },
    rubroReportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rubroReportName: { fontSize: 13, fontWeight: 'bold', color: '#2563EB', textDecorationLine: 'underline', flex: 1, marginRight: 8 },
    rubroReportStatus: { fontSize: 11, fontWeight: '600' },
    rubroProgressBarContainer: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' },
    rubroProgressBar: { height: '100%', borderRadius: 5 },
    rubroWarningText: { fontSize: 10, color: '#DC2626', marginTop: 4, fontWeight: '500' },
    reportButton: {
        backgroundColor: '#059669',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    reportButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    reportOption: {
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
});

// ===================== COTIZACIONES TAB =====================
function CotizacionesTab() {
    const [loading, setLoading] = useState(true);
    const [cotizaciones, setCotizaciones] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [tiposServicio, setTiposServicio] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [filteredTipos, setFilteredTipos] = useState([]);
    const [filteredProveedores, setFilteredProveedores] = useState([]);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '',
        tipoServicioId: '',
        proveedorId: '',
        precioCotizado: '',
        precioCotizadoDisplay: '',
        descripcion: ''
    });
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [cotizacionesData, rubrosData, tiposData, proveedoresData] = await Promise.all([
                ghApi.getCotizaciones(null, anio, mes),
                ghApi.getRubros(),
                ghApi.getTiposServicio(),
                ghApi.getProveedores()
            ]);
            setCotizaciones(cotizacionesData);
            setRubros(rubrosData);
            setTiposServicio(tiposData);
            setProveedores(proveedoresData);
        } catch (error) {
            console.error('Error loading cotizaciones:', error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (formData.rubroId) {
            const filtered = tiposServicio.filter(t => t.rubroId === parseInt(formData.rubroId));
            setFilteredTipos(filtered);
            if (!filtered.find(t => t.id === parseInt(formData.tipoServicioId))) {
                setFormData(prev => ({ ...prev, tipoServicioId: '', proveedorId: '' }));
            }
        } else {
            setFilteredTipos([]);
        }
    }, [formData.rubroId, tiposServicio]);

    useEffect(() => {
        if (formData.tipoServicioId) {
            const filtered = proveedores.filter(p => p.tipoServicioId === parseInt(formData.tipoServicioId));
            setFilteredProveedores(filtered);
            if (!filtered.find(p => p.id === parseInt(formData.proveedorId))) {
                setFormData(prev => ({ ...prev, proveedorId: '' }));
            }
        } else {
            setFilteredProveedores([]);
        }
    }, [formData.tipoServicioId, proveedores]);

    const formatCurrencyInput = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
    };

    const handlePriceChange = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        const formatted = formatCurrencyInput(value);
        setFormData(prev => ({ ...prev, precioCotizado: numericValue, precioCotizadoDisplay: formatted }));
    };

    const resetForm = () => {
        setEditItem(null);
        setFormData({
            rubroId: '',
            tipoServicioId: '',
            proveedorId: '',
            precioCotizado: '',
            precioCotizadoDisplay: '',
            descripcion: ''
        });
    };

    const handleSubmit = async () => {
        if (!formData.proveedorId || !formData.precioCotizado) {
            Alert.alert('Error', 'Proveedor y precio son obligatorios');
            return;
        }
        try {
            setSaving(true);
            const data = {
                proveedorId: parseInt(formData.proveedorId),
                anio,
                mes,
                precioCotizado: parseFloat(formData.precioCotizado),
                fechaCotizacion: new Date().toISOString(),
                descripcion: formData.descripcion
            };
            if (editItem) {
                await ghApi.updateCotizacion(editItem.id, data);
            } else {
                await ghApi.createCotizacion(data);
            }
            setShowModal(false);
            resetForm();
            loadData();
            Alert.alert('Éxito', editItem ? 'Cotización actualizada' : 'Cotización creada');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar esta cotización?')) {
                try {
                    await ghApi.deleteCotizacion(id);
                    loadData();
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar');
                }
            }
        } else {
            Alert.alert('Confirmar', '¿Eliminar esta cotización?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive', onPress: async () => {
                        try { await ghApi.deleteCotizacion(id); loadData(); } catch (e) { }
                    }
                }
            ]);
        }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📋 Cotizaciones GH</Text>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>
                        {ghApi.MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
                <Text style={styles.addButtonText}>+ Nueva Cotización</Text>
            </TouchableOpacity>

            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={styles.loading} />
            ) : (
                <ScrollView style={styles.listContainer}>
                    {cotizaciones.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No hay cotizaciones para este período</Text>
                        </View>
                    ) : (
                        cotizaciones.map(cot => (
                            <View key={cot.id} style={styles.gastoCard}>
                                <View style={styles.gastoHeader}>
                                    <Text style={styles.gastoTipo}>{cot.proveedorNombre}</Text>
                                    <Text style={styles.gastoPrecio}>{formatCurrency(cot.precioCotizado)}</Text>
                                </View>
                                <Text style={styles.gastoRubro}>{cot.rubroNombre} → {cot.tipoServicioNombre}</Text>
                                <Text style={styles.gastoDetail}>📅 {new Date(cot.fechaCotizacion).toLocaleDateString('es-CO')}</Text>
                                {cot.descripcion && <Text style={styles.gastoNota}>💬 {cot.descripcion}</Text>}
                                <View style={styles.cardActions}>
                                    <TouchableOpacity style={styles.editCardButton} onPress={() => {
                                        setEditItem(cot);
                                        setFormData({
                                            rubroId: cot.rubroId?.toString() || '',
                                            tipoServicioId: cot.tipoServicioId?.toString() || '',
                                            proveedorId: cot.proveedorId?.toString() || '',
                                            precioCotizado: cot.precioCotizado?.toString() || '',
                                            precioCotizadoDisplay: formatCurrencyInput(cot.precioCotizado?.toString() || ''),
                                            descripcion: cot.descripcion || ''
                                        });
                                        setShowModal(true);
                                    }}>
                                        <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(cot.id)}>
                                        <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            <Modal visible={showModal} animationType="slide" transparent={true} onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar Cotización' : 'Nueva Cotización'}</Text>
                        <ScrollView style={styles.formContainer}>
                            <Text style={styles.label}>Rubro *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.rubroId} onValueChange={(v) => setFormData(p => ({ ...p, rubroId: v }))}>
                                    <Picker.Item label="Seleccione..." value="" />
                                    {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Tipo de Servicio *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.tipoServicioId} onValueChange={(v) => setFormData(p => ({ ...p, tipoServicioId: v }))} enabled={filteredTipos.length > 0}>
                                    <Picker.Item label="Seleccione..." value="" />
                                    {filteredTipos.map(t => <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Proveedor *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.proveedorId} onValueChange={(v) => setFormData(p => ({ ...p, proveedorId: v }))} enabled={filteredProveedores.length > 0}>
                                    <Picker.Item label="Seleccione..." value="" />
                                    {filteredProveedores.map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Precio Cotizado *</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={formData.precioCotizadoDisplay}
                                onChangeText={handlePriceChange}
                                placeholder="$ 0"
                            />

                            <Text style={styles.label}>Descripción</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.descripcion}
                                onChangeText={(v) => setFormData(p => ({ ...p, descripcion: v }))}
                                placeholder="Detalles de la cotización..."
                                multiline
                                numberOfLines={3}
                            />
                        </ScrollView>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowModal(false); resetForm(); }}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    contentContainer: {
        flex: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        paddingHorizontal: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#F59E0B',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
        fontSize: 13,
    },
    activeTabText: {
        color: '#FFF',
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
    // New Styles for Filters
    advancedFilters: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    filterLabel: { fontWeight: 'bold', color: '#4B5563', marginRight: 5, fontSize: 13 },
    filterItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#D1D5DB', overflow: 'hidden' },
    filterInput: { height: 35, paddingHorizontal: 10, minWidth: 100, backgroundColor: '#fff', fontSize: 13 },
    filterPicker: { height: 35, width: 160, borderWidth: 0, backgroundColor: 'transparent' },
    clearFilterBtn: { padding: 5, paddingHorizontal: 8 },
    clearFilterText: { color: '#9CA3AF', fontWeight: 'bold' },

    headerLogo: {
        width: 140,
        height: 70,
        position: 'absolute',
        top: 0,
        right: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    filters: {
        flexDirection: 'row',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterLabel: {
        fontSize: 13,
        color: '#4B5563',
        marginRight: 8,
    },
    picker: {
        width: 110,
        height: 40,
    },
    summaryContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    presupuestoCard: {
        backgroundColor: '#DBEAFE',
    },
    gastadoCard: {
        backgroundColor: '#FEE2E2',
    },
    restanteCard: {
        backgroundColor: '#D1FAE5',
    },
    excesoCard: {
        backgroundColor: '#FEE2E2',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#4B5563',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 4,
    },
    addButton: {
        backgroundColor: '#2563EB',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonSmall: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    loading: {
        marginTop: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
    gastoCard: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#2563EB',
    },
    gastoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    gastoTipo: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        flex: 1,
    },
    gastoPrecio: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#059669',
    },
    gastoRubro: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 10,
    },
    gastoDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    gastoDetail: {
        fontSize: 14,
        color: '#4B5563',
    },
    gastoNota: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
        marginTop: 10,
    },
    budgetInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 8,
        borderRadius: 6,
        marginTop: 10,
    },
    budgetInfoLabel: {
        fontSize: 12,
        color: '#4B5563',
    },
    budgetInfoValue: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 14,
        gap: 12,
        flexWrap: 'wrap',
    },
    downloadButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    downloadButtonText: {
        color: '#047857',
        fontSize: 13,
        fontWeight: '600',
    },
    editCardButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#EBF5FF',
        borderRadius: 6,
    },
    editCardButtonText: {
        color: '#2563EB',
        fontSize: 13,
        fontWeight: '500',
    },
    historyButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    historyButtonText: {
        color: '#4B5563',
        fontSize: 13,
        fontWeight: '500',
    },
    deleteButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    deleteButtonText: {
        color: '#DC2626',
        fontSize: 13,
    },
    itemCard: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
    itemParent: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    itemActions: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        fontSize: 18,
    },
    deleteButtonIcon: {
        fontSize: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 500,
        maxHeight: '90%',
    },
    modalContentSmall: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    formContainer: {
        maxHeight: 400,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 4,
        marginTop: 12,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
    },
    pickerDisabled: {
        backgroundColor: '#E5E7EB',
        opacity: 0.7,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
    },
    inputDisabled: {
        backgroundColor: '#E5E7EB',
        color: '#9CA3AF',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    fileButton: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderStyle: 'dashed',
    },
    fileButtonText: {
        color: '#6B7280',
        textAlign: 'center',
    },
    removeFile: {
        color: '#DC2626',
        fontSize: 12,
        marginTop: 4,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    cancelButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    cancelButtonText: {
        color: '#4B5563',
    },
    submitButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    // Budget Panel Styles
    budgetInfoPanel: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    budgetInfoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    budgetInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    budgetInfoItem: {
        flex: 1,
        alignItems: 'center',
        padding: 4,
        backgroundColor: '#FFF',
        borderRadius: 4,
    },
    budgetInfoLabel: {
        fontSize: 10,
        color: '#6B7280',
        marginBottom: 2,
    },
    budgetInfoValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    budgetWarning: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
        textAlign: 'center',
    },
    budgetNoData: {
        color: '#6B7280',
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 8,
        textAlign: 'center',
    },
});
