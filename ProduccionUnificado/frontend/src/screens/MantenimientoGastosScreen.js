/**
 * Mantenimiento Gastos Screen
 * EXACT copy of SST/GH visual styling with Production-specific logic.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { Picker } from '@react-native-picker/picker';
import { mantenimientoApi } from '../services/mantenimientoApi';
import { ExpenseHistoryModal } from '../components/ExpenseHistoryModal';
import { useTheme } from '../contexts/ThemeContext';
import { getFileServerUrl, getApiBaseUrl } from '../services/apiConfig';

// TABS - Same structure as SST
const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },
    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'cotizaciones', label: 'Cotizaciones', icon: '📝' },
    { key: 'proveedores', label: 'Proveedores', icon: '🏢' },
];

const MESES = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$ 0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-CO');
};


const getBase64FromUrl = async (url) => {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
    });
};

// Festivos Colombia 2025-2026 (mismos que Talleres)


export default function MantenimientoGastosScreen() {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('gastos');

    return (
        <View style={styles.container}>
            {/* Tabs - EXACT SST STYLE */}
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
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab() {
    const [loading, setLoading] = useState(true);
    const [serverUrl, setServerUrl] = useState('');
    const [apiBaseUrl, setApiBaseUrl] = useState('');

    useEffect(() => {
        const initUrls = async () => {
            const [sUrl, aUrl] = await Promise.all([getFileServerUrl(), getApiBaseUrl()]);
            setServerUrl(sUrl);
            setApiBaseUrl(aUrl);
        };
        initUrls();
    }, []);

    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    const [rubros, setRubros] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [maquinas, setMaquinas] = useState([]);

    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState(null);

    // FILTROS AVANZADOS
    const [filterFecha, setFilterFecha] = useState('');
    const [filterRubroId, setFilterRubroId] = useState('');

    const [filterMaquinaId, setFilterMaquinaId] = useState(''); // Dinámico para Mantenimiento
    const [filterProveedorId, setFilterProveedorId] = useState('');
    const [filterNumeroFactura, setFilterNumeroFactura] = useState('');
    const [filterPending, setFilterPending] = useState(false);
    const [filterCredit, setFilterCredit] = useState(false);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryGasto, setSelectedHistoryGasto] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [isLegalizing, setIsLegalizing] = useState(false); // State for UI rendering
    const isLegalizingRef = useRef(false); // Ref for robust state tracking
    const [formData, setFormData] = useState({
        rubroId: '', proveedorId: '', maquinaId: '',
        precio: '', fecha: new Date().toISOString().split('T')[0], nota: '',
        numeroFactura: '', facturaPdfUrl: '', numeroOP: '', esPendiente: false, esSolicitudCredito: false
    });
    const [saving, setSaving] = useState(false);

    const [presupuestoInfo, setPresupuestoInfo] = useState(null);
    const [cotizaciones, setCotizaciones] = useState([]); // Added for quote automation
    // Quote Selector State
    const [showQuoteSelector, setShowQuoteSelector] = useState(false);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadMasterData = useCallback(async () => {
        try {
            const data = await mantenimientoApi.getMaestros();
            setRubros(data.rubros || []);
            setProveedores(data.proveedores || []);
            setMaquinas(data.maquinas || []);
        } catch (error) {
            console.error('Error loading master data:', error);
        }
    }, []);

    const loadGastos = useCallback(async () => {
        setLoading(true);
        try {
            const [gastosData, resumenData, cotData] = await Promise.all([
                mantenimientoApi.getGastos(anio, mes),
                mantenimientoApi.getResumen(anio, mes),
                mantenimientoApi.getCotizaciones(anio, mes)
            ]);
            setGastos(gastosData.gastos || []);
            setResumen(resumenData);
            setCotizaciones(cotData);
        } catch (error) {
            console.error('Error loading gastos:', error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadMasterData(); }, [loadMasterData]);
    useEffect(() => { loadGastos(); }, [loadGastos]);





    // Load presupuestoInfo for ANY selected rubro - SST style
    useEffect(() => {
        const loadPresupuestoInfo = async () => {
            const selectedRubro = rubros.find(r => r.id == formData.rubroId);
            if (selectedRubro && resumen?.porRubro) {
                const rubroInfo = resumen.porRubro.find(r => r.rubroNombre === selectedRubro.nombre);

                // Get real annual budget from grid endpoint
                let presupuestoAnualReal = 0;
                try {
                    const gridData = await mantenimientoApi.getPresupuestosGrid(anio);
                    const rubroGrid = gridData.tiposServicio?.find(t => t.tipoServicioNombre === selectedRubro.nombre);
                    if (rubroGrid) {
                        presupuestoAnualReal = rubroGrid.meses.reduce((sum, m) => sum + (m.presupuesto || 0), 0);
                    }
                } catch (e) {
                    console.error('Error loading annual budget:', e);
                }

                if (rubroInfo) {
                    setPresupuestoInfo({
                        rubroNombre: selectedRubro.nombre,
                        presupuestoAnual: presupuestoAnualReal,
                        presupuestoMensual: rubroInfo.presupuesto,
                        gastadoMes: rubroInfo.gastado,
                        restanteMes: rubroInfo.presupuesto - rubroInfo.gastado
                    });
                } else {
                    setPresupuestoInfo({ rubroNombre: selectedRubro.nombre, presupuestoAnual: presupuestoAnualReal, presupuestoMensual: 0, gastadoMes: 0, restanteMes: 0 });
                }
            } else {
                setPresupuestoInfo(null);
            }
        };
        loadPresupuestoInfo();
    }, [formData.rubroId, rubros, resumen, anio]);

    const resetForm = () => {
        setEditItem(null);
        setIsLegalizing(false);
        isLegalizingRef.current = false;
        setFormData({
            rubroId: '', proveedorId: '', maquinaId: '',
            precio: '', fecha: new Date().toISOString().split('T')[0], nota: '',
            numeroFactura: '', facturaPdfUrl: '', numeroOP: '', esPendiente: false, esSolicitudCredito: false
        });
    };



    const handleSelectQuote = (quote) => {
        setFormData(prev => ({
            ...prev,
            rubroId: quote.rubroId.toString(),
            proveedorId: quote.proveedorId.toString(),
            precio: quote.precioCotizado.toString(),
            nota: quote.descripcion || prev.nota
        }));
        setShowQuoteSelector(false);
    };

    const handleAdd = () => {
        resetForm();
        setShowModal(true);
    };

    const handleLegalizar = (gasto) => {
        setEditItem(gasto);
        setIsLegalizing(true);
        isLegalizingRef.current = true;
        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            maquinaId: gasto.maquinaId?.toString() || '',
            precio: gasto.precio?.toString() || '',
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '',
            numeroFactura: gasto.numeroFactura || '',
            facturaPdfUrl: gasto.facturaPdfUrl || '',
            numeroOP: gasto.numeroOP || '',
            esPendiente: false,
            esSolicitudCredito: gasto.esSolicitudCredito || false
        });
        setShowModal(true);
    };

    const handleEdit = (gasto) => {
        setEditItem(gasto);
        setIsLegalizing(false);
        isLegalizingRef.current = false;
        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            maquinaId: gasto.maquinaId?.toString() || '',
            precio: gasto.precio?.toString() || '',
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '',
            numeroFactura: gasto.numeroFactura || '',
            facturaPdfUrl: gasto.facturaPdfUrl || '',
            numeroOP: gasto.numeroOP || '',
            esPendiente: gasto.esPendiente || false,
            esSolicitudCredito: gasto.esSolicitudCredito || false
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.rubroId) { Alert.alert('Error', 'Seleccione un rubro'); return; }
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        const rubroName = selectedRubro?.nombre?.toLowerCase() || '';
        const isInsumos = rubroName.includes('insumo');
        const isMaintenance = rubroName.includes('mantenimiento') || rubroName.includes('repuesto');

        // Validation for OP number (required for Insumos)
        if (isInsumos && !formData.numeroOP.trim()) {
            Alert.alert('Error', 'Para Insumos, el Número de OP es obligatorio'); return;
        }

        // Validation for Maintenance/Spares: Machine is Mandatory
        if (isMaintenance && !formData.maquinaId) {
            Alert.alert('Error', 'Seleccione la Máquina (Obligatorio para Mantenimiento/Repuesto)'); return;
        }

        // Validación de factura y precio (Opcional si es pendiente)
        if (!formData.esPendiente) {
            // Validamos precio (debe ser mayor a 0 y no estar vacío)
            if (!formData.precio || parseFloat(formData.precio) <= 0) {
                Alert.alert('Error', 'Ingrese el precio'); return;
            }
            if (!formData.numeroFactura || !formData.numeroFactura.trim()) {
                Alert.alert('Error', 'Número de Factura es obligatorio'); return;
            }
        }

        try {
            setSaving(true);

            // Lógica estándar de un solo registro
            const gastoData = {
                rubroId: parseInt(formData.rubroId),
                proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null,
                usuarioId: formData.usuarioId ? parseInt(formData.usuarioId) : null,
                maquinaId: formData.maquinaId ? parseInt(formData.maquinaId) : null,
                precio: parseFloat(formData.precio || 0),
                fecha: formData.fecha,
                nota: formData.nota,
                anio: parseInt(formData.fecha.split('-')[0]),
                mes: parseInt(formData.fecha.split('-')[1]),
                numeroFactura: formData.numeroFactura,
                facturaPdfUrl: formData.facturaPdfUrl,
                numeroOP: isInsumos ? formData.numeroOP : null,
                esPendiente: formData.esPendiente || false,
                esSolicitudCredito: formData.esSolicitudCredito || false
            };

            // Quote Update Prompt Logic
            if (gastoData.proveedorId && !gastoData.esPendiente && !isLegalizingRef.current) {
                const quote = cotizaciones.find(c => c.rubroId == gastoData.rubroId && c.proveedorId == gastoData.proveedorId);
                if (quote) {
                    const quotePrice = parseFloat(quote.precioCotizado);
                    const currentPrice = gastoData.precio;
                    if (Math.abs(quotePrice - currentPrice) > 1) {
                        const msg = `El precio ingresado (${formatCurrency(currentPrice)}) es diferente a la cotización (${formatCurrency(quotePrice)}).\n\n¿Desea actualizar el precio en la cotización?`;
                        if (Platform.OS === 'web' && window.confirm(msg)) {
                            try {
                                await mantenimientoApi.updateCotizacion(quote.id, { ...quote, precioCotizado: currentPrice });
                                const updated = await mantenimientoApi.getCotizaciones(anio, mes);
                                setCotizaciones(updated);
                            } catch (e) { console.error('Error auto-updating quote:', e); }
                        }
                    }
                }
            }

            if (editItem) {
                await mantenimientoApi.updateGasto(editItem.id, { ...gastoData, id: editItem.id });
            } else {
                await mantenimientoApi.createGasto(gastoData);
            }

            Alert.alert('Éxito', editItem ? 'Gasto actualizado' : 'Gasto registrado');
            setShowModal(false); resetForm(); loadGastos();
        } catch (error) { Alert.alert('Error', 'No se pudo guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await mantenimientoApi.deleteGasto(id); loadGastos(); } catch { Alert.alert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar gasto?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar este gasto?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: doDelete }]); }
    };

    const selectedRubroName = rubros.find(r => r.id == formData.rubroId)?.nombre?.toLowerCase() || '';
    const isInsumos = selectedRubroName.includes('insumo');
    const isMaintenance = selectedRubroName.includes('mantenimiento') || selectedRubroName.includes('repuesto');

    console.log('DEBUG: rubroId:', formData.rubroId, 'foundRubro:', rubros.find(r => r.id == formData.rubroId));
    console.log('DEBUG: selectedRubroName:', selectedRubroName);
    console.log('DEBUG: isMaintenance:', isMaintenance);

    // Calculate totals for summary cards - SST style
    const totalMes = resumen?.total || 0;
    const porRubro = resumen?.porRubro || {};
    const rubroKeys = Object.keys(porRubro);

    // --- LÓGICA DE FILTRADO DINÁMICO ---

    // 1. Obtener Rubros que TIENEN gastos en el mes actual
    const availableRubros = rubros.filter(r =>
        gastos.some(g => g.rubroId === r.id)
    );

    // 2. Determinar qué filtros secundarios mostrar según el Rubro seleccionado
    const selectedFilterRubro = rubros.find(r => r.id.toString() === filterRubroId);
    const showMachineFilter = selectedFilterRubro && ['mantenimiento', 'repuesto'].includes(selectedFilterRubro.nombre.toLowerCase());

    // 3. Obtener opciones para filtros secundarios (solo los que tienen datos)


    const availableMachines = showMachineFilter ? maquinas.filter(m =>
        gastos.some(g => g.rubroId.toString() === filterRubroId && g.maquinaId === m.id)
    ) : [];

    const availableProviders = [...new Map(gastos
        .filter(g => {
            const matchRubro = !filterRubroId || g.rubroId?.toString() === filterRubroId || g.rubro?.id?.toString() === filterRubroId;
            const matchMachine = !showMachineFilter || !filterMaquinaId || g.maquinaId?.toString() === filterMaquinaId;
            const hasProveedor = (g.proveedorId || g.proveedor?.id) && (g.proveedor?.nombre);
            return matchRubro && matchMachine && hasProveedor;
        })
        .map(g => {
            const id = g.proveedorId || g.proveedor?.id;
            const nombre = g.proveedor?.nombre;
            return [id.toString(), { id, nombre }];
        })).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

    // 4. Aplicar filtros
    const filteredGastos = gastos.filter(g => {
        // Filtro Fecha
        if (filterFecha && !g.fecha.startsWith(filterFecha)) return false;

        // Filtro Rubro
        if (filterRubroId && g.rubroId.toString() !== filterRubroId) return false;



        // Filtro Máquina (Dinámico)
        if (showMachineFilter && filterMaquinaId && g.maquinaId?.toString() !== filterMaquinaId) return false;

        // Filtro Proveedor
        if (filterProveedorId && g.proveedorId?.toString() !== filterProveedorId) return false;

        // Filtro Número de Factura
        if (filterNumeroFactura && !(g.numeroFactura || '').toLowerCase().includes(filterNumeroFactura.toLowerCase())) return false;

        // Filtro Pendientes
        if (filterPending && !g.esPendiente) return false;

        // Filtro Crédito
        if (filterCredit && !g.esSolicitudCredito) return false;

        return true;
    });

    // Limpiar filtros secundarios si cambia el rubro
    useEffect(() => {
        setFilterMaquinaId('');
        setFilterProveedorId('');
    }, [filterRubroId]);

    useEffect(() => {
        setFilterProveedorId('');
    }, [filterMaquinaId]);

    // 5. Calcular totales para tarjetas (DINÁMICO)
    let displayedPresupuesto = resumen?.totalPresupuesto || 0;
    let displayedGastado = resumen?.totalGastado || 0;
    let displayedRestante = resumen?.totalRestante || 0;

    if (filterRubroId) {
        // Buscar el nombre del rubro seleccionado
        const selectedRubroName = rubros.find(r => r.id.toString() === filterRubroId)?.nombre;
        if (selectedRubroName && resumen?.porRubro) {
            const rubroData = resumen.porRubro.find(r => r.rubroNombre === selectedRubroName);
            if (rubroData) {
                // Si hay datos para ese rubro
                displayedPresupuesto = rubroData.presupuesto || 0;
                displayedGastado = rubroData.gastado || 0;
                displayedRestante = (rubroData.presupuesto || 0) - (rubroData.gastado || 0);
            } else {
                // Si filtre por un rubro que NO tiene datos en el resumen (raro si uso availableRubros, pero posible)
                // OJO: Si quiero mostrar el presupuesto aunque no haya gasto, necesitaría traer el presupuesto del grid
                // Por ahora, si no está en porRubro (que viene del backend con lo gastado), asumimos 0 o mantenemos global?
                // Mejor 0 para ser consistente con el filtro.
                displayedPresupuesto = 0;
                displayedGastado = 0;
                displayedRestante = 0;

                // INTENTO DE MEJORA: Buscar el presupuesto real si no hay gasto
                // Esto requeriría una llamada extra o tener los presupuestos cargados.
                // Dado que `presupuestoInfo` ya hace algo similar en el formulario, podríamos reusar esa lógica si fuera global.
                // Por simplicidad y rapidez, mostramos lo que trae el resumen por ahora. 
            }
        }
    }

    return (
        <View style={styles.contentContainer}>
            {/* Header - EXACT SST STYLE */}
            <View style={styles.header}>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>

                {/* FILTROS AVANZADOS */}
                <View style={styles.advancedFilters}>
                    <Text style={styles.filterLabel}>Filtrar por:</Text>

                    {/* Filtro Fecha */}
                    <View style={styles.filterItem}>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={filterFecha}
                                onChange={(e) => setFilterFecha(e.target.value)}
                                style={{
                                    height: 40,
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    padding: '0 10px',
                                    backgroundColor: '#fff',
                                    width: 150
                                }}
                            />
                        ) : (
                            <TextInput
                                style={styles.filterInput}
                                placeholder="YYYY-MM-DD"
                                value={filterFecha}
                                onChangeText={setFilterFecha}
                            />
                        )}
                        {filterFecha ? (
                            <TouchableOpacity onPress={() => setFilterFecha('')} style={styles.clearFilterBtn}>
                                <Text style={styles.clearFilterText}>✕</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Filtro Rubro */}
                    <View style={styles.filterItem}>
                        <Picker
                            selectedValue={filterRubroId}
                            onValueChange={setFilterRubroId}
                            style={styles.filterPicker}
                        >
                            <Picker.Item label="Todos los Rubros" value="" />
                            {availableRubros.map(r => (
                                <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />
                            ))}
                        </Picker>
                    </View>



                    {/* Filtro Dinámico: Máquina */}
                    {showMachineFilter && (
                        <View style={styles.filterItem}>
                            <Picker
                                selectedValue={filterMaquinaId}
                                onValueChange={setFilterMaquinaId}
                                style={styles.filterPicker}
                            >
                                <Picker.Item label="Todas las Máquinas" value="" />
                                {availableMachines.map(m => (
                                    <Picker.Item key={m.id} label={m.nombre} value={m.id.toString()} />
                                ))}
                            </Picker>
                        </View>
                    )}

                    {/* Filtro Proveedor */}
                    <View style={styles.filterItem}>
                        <Picker
                            selectedValue={filterProveedorId}
                            onValueChange={setFilterProveedorId}
                            style={styles.filterPicker}
                        >
                            <Picker.Item label="Todos los Proveedores" value="" />
                            {availableProviders.map(p => (
                                <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro Número de Factura */}
                    <View style={styles.filterItem}>
                        <TextInput
                            style={styles.filterInput}
                            placeholder="Nro. Factura..."
                            placeholderTextColor="#9CA3AF"
                            value={filterNumeroFactura}
                            onChangeText={setFilterNumeroFactura}
                        />
                        {filterNumeroFactura ? (
                            <TouchableOpacity onPress={() => setFilterNumeroFactura('')} style={styles.clearFilterBtn}>
                                <Text style={styles.clearFilterText}>✕</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Filtro Checkbox Pendientes */}
                    <TouchableOpacity
                        style={[styles.filterItem, styles.checkboxFilter, filterPending && styles.checkboxFilterActive]}
                        onPress={() => setFilterPending(!filterPending)}
                    >
                        <Text style={{ color: filterPending ? 'white' : '#374151', fontSize: 12 }}>⏳ Ver solo Pendientes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterItem, styles.checkboxFilter, filterCredit && styles.checkboxFilterActive, { backgroundColor: filterCredit ? '#7C3AED' : 'white' }]}
                        onPress={() => setFilterCredit(!filterCredit)}
                    >
                        <Text style={{ color: filterCredit ? 'white' : '#374151', fontSize: 12 }}>💳 Ver solo Crédito</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Summary Cards - EXACT SST STYLE: 3 colored cards with budget data */}
            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.presupuestoCard]}>
                    <Text style={styles.summaryLabel}>Presupuesto{filterRubroId ? '*' : ''}</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(displayedPresupuesto)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.gastadoCard]}>
                    <Text style={styles.summaryLabel}>Gastado</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(displayedGastado)}</Text>
                </View>
                <View style={[styles.summaryCard, displayedRestante >= 0 ? styles.restanteCard : styles.excesoCard]}>
                    <Text style={styles.summaryLabel}>{displayedRestante >= 0 ? 'Restante' : 'Exceso'}</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(Math.abs(displayedRestante))}</Text>
                </View>
            </View>

            {/* Add Button - EXACT SST STYLE */}
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                <Text style={styles.addButtonText}>+ Agregar Gasto</Text>
            </TouchableOpacity>

            {/* Gastos List */}
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={styles.loading} />
            ) : (
                <ScrollView style={styles.listContainer}>
                    {filteredGastos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                {gastos.length > 0
                                    ? 'No hay gastos que coincidan con los filtros'
                                    : 'No hay gastos registrados para este período'}
                            </Text>
                        </View>
                    ) : (
                        filteredGastos.map(gasto => {
                            const deadline = new Date(gasto.fecha);
                            deadline.setDate(deadline.getDate() + 2);
                            const isOverdue = gasto.esPendiente && new Date() > deadline;

                            return (
                                <View key={gasto.id} style={[styles.gastoCard, isOverdue && styles.gastoCardOverdue]}>
                                    <View style={styles.gastoHeader}>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.gastoTipo}>{gasto.rubro?.nombre || 'Sin Rubro'}</Text>
                                                {gasto.esPendiente && (
                                                    <View style={[styles.pendingBadge, isOverdue && styles.pendingBadgeOverdue]}>
                                                        <Text style={styles.pendingText}>⏳ Pendiente</Text>
                                                    </View>
                                                )}
                                                {gasto.esSolicitudCredito && (
                                                    <View style={[styles.pendingBadge, { backgroundColor: '#7C3AED' }]}>
                                                        <Text style={styles.pendingText}>💳 Crédito</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {gasto.esPendiente && (
                                                <Text style={[styles.deadlineText, isOverdue && styles.deadlineTextOverdue]}>
                                                    Legalizar antes de: {formatDate(deadline.toISOString())}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.gastoPrecio}>{formatCurrency(gasto.precio)}</Text>
                                    </View>
                                    <Text style={styles.gastoRubro}>
                                        {gasto.tipoHora?.nombre || gasto.tipoRecargo?.nombre || 'General'}
                                        {gasto.creadoPor?.nombreMostrar ? ` - Registrado por: ${gasto.creadoPor.nombreMostrar}` : ''}
                                    </Text>
                                    <View style={styles.gastoDetails}>
                                        {gasto.usuario && <Text style={styles.gastoDetail}>🏢 {gasto.usuario.nombre}</Text>}
                                        {gasto.maquina && <Text style={styles.gastoDetail}>⚙️ {gasto.maquina.nombre}</Text>}
                                        {gasto.proveedor && <Text style={styles.gastoDetail}>🏢 {gasto.proveedor.nombre}</Text>}
                                        <Text style={styles.gastoDetail}>📅 {formatDate(gasto.fecha)}</Text>
                                        {gasto.cantidadHoras ? (
                                            <Text style={styles.gastoDetail}>
                                                ⏱️ {(() => {
                                                    const totalMin = Math.round(gasto.cantidadHoras * 60);
                                                    const hh = Math.floor(totalMin / 60);
                                                    const mm = totalMin % 60;
                                                    return `${hh}:${mm.toString().padStart(2, '0')}`;
                                                })()}
                                            </Text>
                                        ) : null}
                                    </View>
                                    {/* Show OP number for Horas Extras/Recargos */}
                                    {!!gasto.numeroOP && (
                                        <Text style={styles.gastoNota}>📋 OP: {gasto.numeroOP}</Text>
                                    )}
                                    {/* Show nota if present (for general notes) */}
                                    {!!gasto.nota && (
                                        <Text style={styles.gastoNota}>💬 {gasto.nota}</Text>
                                    )}
                                    {!!gasto.numeroFactura && <Text style={styles.gastoDetail}>📄 Factura: {gasto.numeroFactura}</Text>}
                                    {!!gasto.facturaPdfUrl && Platform.OS === 'web' && (
                                        <a
                                            href={`${serverUrl}${gasto.facturaPdfUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#2563EB', textDecoration: 'none', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            📥 Descargar PDF Factura
                                        </a>
                                    )}
                                    <View style={styles.cardActions}>
                                        {gasto.esPendiente && (
                                            <TouchableOpacity style={[styles.editCardButton, { backgroundColor: '#10B981', marginRight: 10 }]} onPress={() => handleLegalizar(gasto)}>
                                                <Text style={styles.editCardButtonText}>✅ Legalizar</Text>
                                            </TouchableOpacity>
                                        )}
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
                            );
                        })
                    )}
                </ScrollView>
            )
            }


            {/* Add/Edit Modal - EXACT SST STYLE */}
            <ExpenseHistoryModal
                visible={showHistoryModal}
                gasto={selectedHistoryGasto}
                onClose={() => setShowHistoryModal(false)}
            />

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{isLegalizing ? 'Legalizar Gasto' : (editItem ? 'Editar Gasto' : 'Nuevo Gasto')}</Text>
                        <ScrollView style={styles.formContainer}>
                            {/* Context Info for Legalization */}
                            {isLegalizing && (
                                <View style={{ backgroundColor: '#F0F9FF', padding: 10, borderRadius: 5, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#007bff' }}>
                                    <Text style={{ fontWeight: 'bold', color: '#0056b3' }}>Legalizando:</Text>
                                    <Text style={{ fontSize: 13, marginTop: 2 }}>{rubros.find(r => r.id == formData.rubroId)?.nombre} - {proveedores.find(p => p.id == formData.proveedorId)?.nombre || 'Sin Proveedor'}</Text>
                                    <Text style={{ fontSize: 13, marginTop: 2 }}>Fecha: {formData.fecha}</Text>
                                </View>
                            )}

                            {/* Quote Import Button - Hide when Legalizing */}
                            {!isLegalizing && (
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: '#7C3AED',
                                        padding: 10,
                                        borderRadius: 6,
                                        marginBottom: 15,
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                    onPress={() => setShowQuoteSelector(true)}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>📋 Importar desde Cotización</Text>
                                </TouchableOpacity>
                            )}


                            {!isLegalizing && (
                                <View style={{ marginBottom: 15 }}>
                                    <Text style={styles.label}>Rubro *</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker selectedValue={formData.rubroId} onValueChange={(v) => setFormData(p => ({ ...p, rubroId: v }))}>
                                            <Picker.Item label="Seleccione un rubro..." value="" />
                                            {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                                        </Picker>
                                    </View>
                                </View>
                            )}

                            {formData.rubroId ? (
                                <>
                                    {/* Solicitud de Crédito Checkbox */}
                                    {!isLegalizing && (
                                        <TouchableOpacity
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                marginBottom: 15,
                                                padding: 10,
                                                backgroundColor: '#F5F3FF',
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: '#DDD6FE'
                                            }}
                                            onPress={() => setFormData(p => ({ ...p, esSolicitudCredito: !p.esSolicitudCredito }))}
                                        >
                                            <View style={[styles.checkbox, formData.esSolicitudCredito && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }]}>
                                                {formData.esSolicitudCredito && <Text style={styles.checkboxCheck}>✓</Text>}
                                            </View>
                                            <View>
                                                <Text style={[styles.checkboxLabel, { color: '#5B21B6' }]}>Solicitud de Crédito</Text>
                                                <Text style={{ fontSize: 10, color: '#6D28D9', marginLeft: 10 }}>Marcar para trámite de crédito</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    {isMaintenance && (
                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={styles.label}>Máquina *</Text>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={formData.maquinaId}
                                                    onValueChange={(v) => setFormData(p => ({ ...p, maquinaId: v }))}
                                                >
                                                    <Picker.Item label="Seleccione una máquina..." value="" />
                                                    {maquinas.map(m => (
                                                        <Picker.Item key={m.id} label={m.nombre || m.Nombre} value={m.id?.toString()} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </View>
                                    )}

                                    <View style={{ marginBottom: 15 }}>
                                        <Text style={styles.label}>Proveedor {formData.esPendiente && !isLegalizing ? '(Opcional por ahora)' : ''}</Text>
                                        <View style={styles.pickerContainer}>
                                            <Picker selectedValue={formData.proveedorId} onValueChange={(v) => {
                                                setFormData(p => ({ ...p, proveedorId: v }));
                                            }}>
                                                <Picker.Item label="Seleccione..." value="" />
                                                {proveedores
                                                    .filter(p => !formData.rubroId || p.rubroId?.toString() === formData.rubroId)
                                                    .map(p => <Picker.Item key={p.id} label={`${p.nombre}${p.precioCotizado ? ` - ${formatCurrency(p.precioCotizado)}` : ''}`} value={p.id.toString()} />)
                                                }
                                            </Picker>
                                        </View>
                                    </View>

                                    {/* Checkbox de Pendiente - Hide when Legalizing */}
                                    {!isLegalizing && (
                                        <TouchableOpacity
                                            style={styles.checkboxContainer}
                                            onPress={() => setFormData(p => ({ ...p, esPendiente: !p.esPendiente }))}
                                        >
                                            <View style={[styles.checkbox, formData.esPendiente && styles.checkboxChecked]}>
                                                {formData.esPendiente && <Text style={styles.checkboxCheck}>✓</Text>}
                                            </View>
                                            <View>
                                                <Text style={styles.checkboxLabel}>Marcar como Gasto Pendiente</Text>
                                                <Text style={{ fontSize: 10, color: '#666', marginLeft: 10 }}>Permite guardar sin factura ni precio (2 días plazo)</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    {!isLegalizing && (
                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={styles.label}>Fecha</Text>
                                            {Platform.OS === 'web' ? (
                                                <input type="date" value={formData.fecha} onChange={(e) => setFormData(p => ({ ...p, fecha: e.target.value }))} style={{ padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', width: '100%', boxSizing: 'border-box', marginBottom: 10 }} />
                                            ) : (
                                                <TextInput style={styles.input} value={formData.fecha} onChangeText={(t) => setFormData(p => ({ ...p, fecha: t }))} placeholder="YYYY-MM-DD" />
                                            )}
                                        </View>
                                    )}



                                    {isInsumos && (
                                        <View style={{ marginBottom: 10 }}>
                                            <Text style={styles.label}>Número de OP (Orden de Producción) *</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={formData.numeroOP}
                                                onChangeText={(t) => setFormData(p => ({ ...p, numeroOP: t }))}
                                                placeholder="Ej: OP-12345 o número de orden"
                                            />
                                        </View>
                                    )}

                                    <View style={{ marginBottom: 10 }}>
                                            <Text style={styles.label}>Número de Factura *</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={formData.numeroFactura}
                                                onChangeText={(t) => setFormData(p => ({ ...p, numeroFactura: t }))}
                                                placeholder="Ej: FAC-001234"
                                            />

                                            <Text style={styles.label}>PDF Factura (opcional)</Text>
                                            {Platform.OS === 'web' ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                    <input
                                                        type="file"
                                                        accept=".pdf"
                                                        onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                try {
                                                                    const result = await mantenimientoApi.uploadFactura(file);
                                                                    setFormData(p => ({ ...p, facturaPdfUrl: result.url }));
                                                                    Alert.alert('Éxito', 'PDF subido correctamente');
                                                                } catch (err) {
                                                                    Alert.alert('Error', 'No se pudo subir el PDF');
                                                                }
                                                            }
                                                        }}
                                                        style={{ padding: 8 }}
                                                    />
                                                    {!!formData.facturaPdfUrl && (
                                                        <a href={`${serverUrl}${formData.facturaPdfUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                                                            📄 Ver PDF
                                                        </a>
                                                    )}
                                                </View>
                                            ) : (
                                                <Text style={styles.input}>Función de PDF solo disponible en Web</Text>
                                            )}
                                        </View>
                                    )}

                                    <View style={{ marginBottom: 15 }}>
                                        <Text style={styles.label}>Precio * {(!formData.esPendiente && !formData.numeroFactura.trim()) ? '(ingrese factura primero)' : ''}</Text>
                                        <TextInput
                                            style={[styles.input, (!formData.esPendiente && !formData.numeroFactura.trim()) && styles.inputDisabled]}
                                            value={formData.precio}
                                            onChangeText={(t) => setFormData(p => ({ ...p, precio: t }))}
                                            keyboardType="numeric"
                                            placeholder="$ 0"
                                            editable={(formData.esPendiente || !!formData.numeroFactura.trim())}
                                        />
                                    </View>

                                    {/* Cuadro de presupuesto estilo SST - DEBAJO DEL PRECIO */}
                                    {presupuestoInfo && (
                                        <View style={styles.budgetContainer}>
                                            <View style={styles.budgetHeader}>
                                                <Text style={styles.budgetTitle}>
                                                    📊 Presupuesto: {presupuestoInfo.rubroNombre}
                                                </Text>
                                            </View>
                                            {(() => {
                                                // Live calculation like SST
                                                const currentPrice = parseFloat(formData.precio) || 0;
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
                                                    ℹ️ No hay presupuesto mensual asignado para Horas Extra
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                    <Text style={styles.label}>Nota</Text>
                                    <TextInput style={[styles.input, styles.textArea]} value={formData.nota} onChangeText={(t) => setFormData(p => ({ ...p, nota: t }))} multiline placeholder="Opcional..." />

                                    <View style={styles.modalActions}>
                                        <TouchableOpacity style={styles.cancelButton} onPress={() => { resetForm(); setShowModal(false); }}>
                                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={saving}>
                                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#666', fontStyle: 'italic' }}>Seleccione un rubro para continuar...</Text>
                                    <TouchableOpacity style={[styles.cancelButton, { marginTop: 20, alignSelf: 'stretch' }]} onPress={() => { resetForm(); setShowModal(false); }}>
                                        <Text style={[styles.cancelButtonText, { textAlign: 'center' }]}>Cancelar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>

                        {/* ABSOLUTE OVERLAY: SELECTOR DE COTIZACIONES */}
                        {showQuoteSelector && (
                            <View style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'white',
                                zIndex: 9999,
                                padding: 20,
                                borderRadius: 12,
                                elevation: 5
                            }}>
                                <Text style={styles.modalTitle}>Seleccionar Cotización</Text>
                                <Text style={{ marginBottom: 10, color: '#666' }}>Periodo: {anio}-{mes}</Text>

                                <ScrollView style={{ flex: 1 }}>
                                    {cotizaciones.length === 0 ? (
                                        <Text style={{ padding: 20, textAlign: 'center', color: '#666' }}>No hay cotizaciones disponibles.</Text>
                                    ) : (
                                        cotizaciones.map(c => (
                                            <TouchableOpacity
                                                key={c.id}
                                                style={{
                                                    padding: 12,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: '#eee',
                                                    backgroundColor: '#f9fafb',
                                                    marginBottom: 8,
                                                    borderRadius: 6
                                                }}
                                                onPress={() => handleSelectQuote(c)}
                                            >
                                                <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{c.rubroNombre} - {c.proveedorNombre}</Text>
                                                <Text style={{ color: '#059669', fontWeight: 'bold' }}>{formatCurrency(c.precioCotizado)}</Text>
                                                {c.descripcion && <Text style={{ color: '#666', fontSize: 12 }}>{c.descripcion}</Text>}
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>

                                <TouchableOpacity
                                    style={[styles.cancelButton, { marginTop: 10, alignSelf: 'stretch' }]}
                                    onPress={() => setShowQuoteSelector(false)}
                                >
                                    <Text style={[styles.cancelButtonText, { textAlign: 'center' }]}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View >
            </Modal >


        </View >
    );
}

// ===================== PRESUPUESTO TAB =====================
function GraficasTab() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = useState(''); // '' = anual
    const [graficasData, setGraficasData] = useState(null);
    const [allGastos, setAllGastos] = useState([]); // Almacenar todos los gastos para conteo y detalle

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            // Cargar gráficas y lista plana de gastos en paralelo (para conteo real y detalles)
            const [dataGraf, dataGastos] = await Promise.all([
                mantenimientoApi.getGraficas(anio, mesSeleccionado),
                mantenimientoApi.getGastos(anio, mesSeleccionado)
            ]);

            setGraficasData(dataGraf);
            // Asegurar que allGastos sea un array plano
            setAllGastos(Array.isArray(dataGastos) ? dataGastos : (dataGastos.gastos || []));

        } catch (error) {
            console.error('Error loading data:', error);
            // Fallback parcial
            setAllGastos([]);
        } finally {
            setLoading(false);
        }
    }, [anio, mesSeleccionado]);

    useEffect(() => { loadData(); }, [loadData]);

    // DETALLE INTERACTIVO
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [detailTitle, setDetailTitle] = useState('');
    const [detailGastos, setDetailGastos] = useState([]);

    // Filtros Modal
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

            // Helper robusto para comparar IDs (soporta propiedad plana 'rubroId' o objeto anidado 'rubro.id')
            const checkId = (item, propBase, targetId) => {
                const valDirect = item[propBase + 'Id'];
                const valNested = item[propBase]?.id;
                // Usamos == para permitir coincidencias '15' == 15
                return valDirect == targetId || valNested == targetId;
            };

            // Detectar si es nómina inspeccionando el objeto rubro anidado o propiedades de tipo
            const esNomina = (g) => {
                const rName = (g.rubro?.nombre || '').toLowerCase();
                // Si tiene tipoHora/Recargo definido, o el nombre del rubro sugiere nómina
                return g.tipoHora || g.tipoRecargo ||
                    rName.includes('hora') || rName.includes('recargo') || rName.includes('nomina') || rName.includes('salario');
            };

            if (type === 'rubro') {
                filtered = allGastos.filter(g => checkId(g, 'rubro', id));
            } else if (type === 'proveedor') {
                // Proveedores: Coincidir ID Y asegurar que no parezca nómina
                filtered = allGastos.filter(g => checkId(g, 'proveedor', id) && !esNomina(g));
            } else if (type === 'usuario') {
                // Usuarios (Horas Extras): Coincidir ID Y asegurar que SÍ parezca nómina (o sea hora extra)
                filtered = allGastos.filter(g => checkId(g, 'usuario', id) && esNomina(g));
            }

            // FALLBACK: Si no encontramos nada por ID, intentamos por NOMBRE.
            // Esto cubre casos donde el ID de la gráfica (DTO) no coincida con el ID del gasto, o si venía nulo.
            if (filtered.length === 0 && name) {
                const targetName = String(name).toLowerCase().trim();
                filtered = allGastos.filter(g => {
                    let gName = '';
                    if (type === 'rubro') gName = g.rubro?.nombre;
                    else if (type === 'proveedor') gName = g.proveedor?.nombre;
                    else if (type === 'usuario') gName = g.usuario?.nombre;

                    if (!gName) return false;
                    const match = gName.toLowerCase().trim() === targetName;

                    // Mantener restricciones de nómina incluso en fallback por nombre
                    if (!match) return false;
                    if (type === 'proveedor' && esNomina(g)) return false;
                    if (type === 'usuario' && !esNomina(g)) return false;

                    return true;
                });
            }

            // Ordenar por fecha descendente
            filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setDetailGastos(filtered);
        } catch (err) {
            console.error('Error filtering details:', err);
            setDetailGastos([]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    // Default empty data structure
    const data = graficasData || { totalGastado: 0, porRubro: [], porProveedor: [], porUsuario: [], resumenMensual: [] };

    // Corrección Contador Registros: Usar la longitud real de gastos cargados
    const totalRegistrosReal = allGastos.length;

    const generateReport = async () => {
        if (!allGastos.length) { Alert.alert('Aviso', 'No hay datos para generar reporte'); return; }
        setLoading(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const margin = 15;
            const logoSource = colors.alephLogo;

            // Logo
            // Logo Handling - Web & Native Compatible
            try {
                let logoUri = null;
                if (Platform.OS === 'web') {
                    logoUri = logoSource;
                    if (typeof logoSource === 'object' && logoSource.uri) logoUri = logoSource.uri;
                } else {
                    const asset = Asset.fromModule(logoSource);
                    await asset.downloadAsync();
                    logoUri = asset.localUri || asset.uri;
                }

                if (logoUri) {
                    const base64Logo = await getBase64FromUrl(logoUri);
                    doc.addImage(base64Logo, 'PNG', margin, 10, 30, 15);
                }
            } catch (e) { console.error('Error adding logo:', e); }

            // Title
            doc.setFontSize(16);
            doc.setTextColor(31, 41, 55);
            doc.text(`Informe de Gastos - Mantenimiento Global`, pageWidth / 2, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Periodo: ${mesSeleccionado ? MESES.find(m => m.value === Number(mesSeleccionado))?.label : 'Año Completo'} - ${anio}`, pageWidth / 2, 26, { align: 'center' });
            doc.text(`Fecha GeneraciÃ³n: ${new Date().toLocaleDateString()}`, pageWidth / 2, 31, { align: 'center' });

            // KPIs
            const totalP = data.totalPresupuesto || 0;
            const totalG = data.totalGastado || 0;
            const restante = totalP - totalG;
            const kpiData = [[
                formatCurrency(totalP),
                formatCurrency(totalG),
                formatCurrency(restante),
                `${totalP > 0 ? Math.round((totalG / totalP) * 100) : 0}% Ejecutado`
            ]];

            autoTable(doc, {
                startY: 40,
                head: [['Presupuesto Total', 'Total Ejecutado', 'Disponible', '% Ejecución']],
                body: kpiData,
                theme: 'plain',
                headStyles: { fillColor: [30, 58, 95], textColor: 255, halign: 'center', fontSize: 10, fontStyle: 'bold' },
                bodyStyles: { halign: 'center', fontSize: 10, textColor: 50 },
                columnStyles: {
                    2: { textColor: (totalP - totalG) >= 0 ? [5, 150, 105] : [220, 38, 38], fontStyle: 'bold' }
                }
            });

            // Detailed Data Grouped by Rubro -> Provider/User
            let finalY = doc.lastAutoTable.finalY + 10;
            const tableRows = [];

            // Group expenses by Rubro
            const rubrosMap = {};
            allGastos.forEach(g => {
                const rName = g.rubro?.nombre || 'Sin Rubro';
                if (!rubrosMap[rName]) rubrosMap[rName] = { total: 0, items: [] };
                rubrosMap[rName].items.push(g);
                rubrosMap[rName].total += g.precio;
            });

            // Sort Rubros by total DESC
            const sortedRubros = Object.entries(rubrosMap).sort((a, b) => b[1].total - a[1].total);

            sortedRubros.forEach(([rubroName, { total, items }]) => {
                // Rubro Header
                tableRows.push([
                    { content: `[RUBRO] ${rubroName.toUpperCase()}`, colSpan: 2, styles: { fillColor: [224, 231, 255], fontStyle: 'bold', textColor: [30, 58, 95] } },
                    { content: formatCurrency(total), styles: { fillColor: [224, 231, 255], fontStyle: 'bold', halign: 'right', textColor: [30, 58, 95] } }
                ]);

                // Sort items by Date DESC
                items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

                items.forEach(item => {
                    const fecha = new Date(item.fecha).toLocaleDateString();
                    // Determine "Tercero" (Proveedor or Usuario)
                    const tercero = item.proveedor?.nombre || item.usuario?.nombre || 'General';
                    // Determine Details (Tipo Hora, Recargo, Maquina)
                    let detalles = '';
                    if (item.tipoHora) detalles += item.tipoHora.nombre;
                    if (item.tipoRecargo) detalles += (detalles ? ', ' : '') + item.tipoRecargo.nombre;
                    if (item.maquina) detalles += (detalles ? ', ' : '') + item.maquina.nombre;
                    if (item.numeroFactura) detalles += (detalles ? ', ' : '') + `Fac: ${item.numeroFactura}`;
                    if (item.numeroOP) detalles += (detalles ? ', ' : '') + `OP: ${item.numeroOP}`;

                    const rowDesc = `${fecha} - ${tercero}${detalles ? ` (${detalles})` : ''}`;

                    tableRows.push([
                        { content: '', styles: { cellWidth: 5 } }, // Indent
                        { content: rowDesc, styles: { textColor: [80, 80, 80] } },
                        { content: formatCurrency(item.precio), styles: { halign: 'right', textColor: [80, 80, 80] } }
                    ]);
                });
            });

            autoTable(doc, {
                startY: finalY,
                head: [['', 'Concepto / Proveedor / Fecha', 'Total']],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 5 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 40, halign: 'right' }
                },
                styles: { fontSize: 8, cellPadding: 3 }
            });

            const filename = `Reporte_Produccion_${anio}_${mesSeleccionado || 'Anual'}.pdf`;

            if (Platform.OS === 'web') {
                doc.save(filename);
            } else {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                const fileUri = FileSystem.documentDirectory + filename;

                await FileSystem.writeAsStringAsync(fileUri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri);
                } else {
                    Alert.alert('Éxito', 'Reporte generado (compartir no disponible)');
                }
            }

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo generar el reporte PDF');
        } finally {
            setLoading(false);
        }
    };

    const generateCSV = async () => {
        if (!allGastos.length) return;
        setLoading(true);
        try {
            let csvContent = '\uFEFF'; // BOM
            csvContent += "ID,Fecha,Año,Mes,Rubro,Proveedor/Operario,Maquina,Detalle(Tipo),Factura/OP,Precio,CantidadHrs,Nota,CreadoPor\n";

            allGastos.forEach(g => {
                const escape = (text) => `"${String(text || '').replace(/"/g, '""')}"`;
                const fecha = g.fecha ? g.fecha.split('T')[0] : '';
                const tercero = g.proveedor?.nombre || g.usuario?.nombre || '';

                let detalleTipo = '';
                if (g.tipoHora?.nombre) detalleTipo = g.tipoHora.nombre;
                else if (g.tipoRecargo?.nombre) detalleTipo = g.tipoRecargo.nombre;

                const row = [
                    g.id,
                    fecha,
                    new Date(g.fecha).getFullYear(),
                    new Date(g.fecha).getMonth() + 1,
                    escape(g.rubro?.nombre),
                    escape(tercero),
                    escape(g.maquina?.nombre),
                    escape(detalleTipo),
                    escape(g.numeroFactura || g.numeroOP),
                    g.precio,
                    g.cantidadHoras || '',
                    escape(g.nota),
                    escape(g.creadoPor?.nombreMostrar)
                ];
                csvContent += row.join(",") + "\n";
            });

            const filename = `Reporte_Produccion_${anio}_${mesSeleccionado || 'Anual'}.csv`;

            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const fileUri = FileSystem.documentDirectory + filename;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exportar CSV' });
                }
            }

        } catch (error) {
            Alert.alert('Error', 'Falló exportación CSV');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📊 Análisis de Gastos Producción</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity style={grafStyles.reportButton} onPress={generateReport}>
                        <Text style={grafStyles.reportButtonText}>📄 Generar Informe</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[grafStyles.reportButton, { backgroundColor: '#3B82F6' }]} onPress={generateCSV}>
                        <Text style={grafStyles.reportButtonText}>📊 Exportar CSV</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mesSeleccionado} onValueChange={setMesSeleccionado} style={styles.picker}>
                        <Picker.Item label="Todo el Año" value="" />
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
            </View>

            <ScrollView style={styles.listContainer}>
                {/* Dashboard Summary Cards */}
                <View style={grafStyles.dashboardRow}>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#EFF6FF' }]}>
                        <Text style={grafStyles.cardLabel}>💰 Presupuesto</Text>
                        <Text style={[grafStyles.cardValue, { color: '#1E40AF' }]}>
                            {formatCurrency(data.totalPresupuesto || 0)}
                        </Text>
                    </View>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={grafStyles.cardLabel}>📊 Gastado</Text>
                        <Text style={[grafStyles.cardValue, { color: '#059669' }]}>
                            {formatCurrency(data.totalGastado || 0)}
                        </Text>
                    </View>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={grafStyles.cardLabel}>✅ Restante</Text>
                        <Text style={[grafStyles.cardValue, { color: '#D97706' }]}>
                            {formatCurrency((data.totalPresupuesto || 0) - (data.totalGastado || 0))}
                        </Text>
                    </View>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={grafStyles.cardLabel}>📋 Registros</Text>
                        <Text style={[grafStyles.cardValue, { color: '#374151' }]}>
                            {totalRegistrosReal}
                        </Text>
                    </View>
                </View>

                {/* MODAL DE DETALLE */}
                <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={styles.modalTitle}>Detalle: {detailTitle}</Text>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ padding: 5 }}>
                                    <Text style={{ fontSize: 20, color: '#666' }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            {/* FILTROS DE FECHA */}
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
                                <Text style={styles.emptyText}>No se encontraron registros en el rango seleccionado.</Text>
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
                                                <Text style={{ fontWeight: 'bold', color: '#059669' }}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(g.precio)}</Text>
                                            </View>

                                            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                                                {g.tipoHora?.nombre || g.tipoRecargo?.nombre || g.rubro?.nombre || 'Gasto General'}
                                            </Text>

                                            {/* INFO EXTRA DE USUARIO Y PROVEEDOR */}
                                            {g.usuario?.nombre && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <Text style={{ fontSize: 12 }}>👤 </Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#4B5563' }}>{g.usuario.nombre}</Text>
                                                </View>
                                            )}
                                            {g.proveedor?.nombre && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Text style={{ fontSize: 12 }}>🏢 </Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#4B5563' }}>{g.proveedor.nombre}</Text>
                                                </View>
                                            )}
                                            {g.maquina?.nombre && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Text style={{ fontSize: 12 }}>⚙️ </Text>
                                                    <Text style={{ fontSize: 12, color: '#4B5563' }}>{g.maquina.nombre}</Text>
                                                </View>
                                            )}

                                            {g.nota && <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4, color: '#666' }}>"{g.nota}"</Text>}

                                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                                {g.facturaPdfUrl && <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: 'bold' }}>📄 Factura PDF</Text>}
                                                {g.numeroOP && <Text style={{ fontSize: 11, color: '#6B7280' }}>📋 OP: {g.numeroOP}</Text>}
                                            </View>
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

                {/* Ejecución Anual Completo - Progress Bar */}
                <View style={grafStyles.chartSection}>
                    <Text style={grafStyles.sectionTitle}>{mesSeleccionado ? 'Ejecución del Mes' : 'Ejecución Anual'} Completo</Text>
                    <View style={grafStyles.progressBarContainer}>
                        <View style={[grafStyles.progressBar, {
                            width: `${Math.min(100, ((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}%`,
                            backgroundColor: ((data.totalGastado || 0) > (data.totalPresupuesto || 0)) ? '#DC2626' : '#10B981'
                        }]} />
                    </View>
                    <Text style={grafStyles.progressText}>
                        {Math.round(((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}% ejecutado ({formatCurrency(data.totalGastado)} / {formatCurrency(data.totalPresupuesto)})
                    </Text>
                </View>

                {/* Gastos por Rubro (Mensual/Anual) vs Presupuesto - Progress Bars */}
                {data.desempenoRubro?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>📁 Desempeño por Rubro ({mesSeleccionado ? 'Mensual' : 'Anual'})</Text>
                        {data.desempenoRubro.map((item, idx) => {
                            const rubroPorcentaje = (item.presupuesto > 0) ? Math.round((item.gastado / item.presupuesto) * 100) : (item.gastado > 0 ? 101 : 0);
                            const isExceeded = item.gastado > item.presupuesto && item.presupuesto > 0;
                            const isZeroBudgetWithGasto = item.presupuesto === 0 && item.gastado > 0;

                            return (
                                <View key={idx} style={grafStyles.rubroReportRow}>
                                    <View style={grafStyles.rubroReportHeader}>
                                        <TouchableOpacity onPress={() => handleOpenDetail('rubro', item.id, item.nombre)}>
                                            <Text style={[grafStyles.rubroReportName, { textDecorationLine: 'underline', color: '#1E40AF' }]}>
                                                {item.nombre} 👆
                                            </Text>
                                        </TouchableOpacity>
                                        <Text style={[grafStyles.rubroReportStatus, (isExceeded || isZeroBudgetWithGasto) ? { color: '#DC2626' } : { color: '#059669' }]}>
                                            {formatCurrency(item.gastado)} / {formatCurrency(item.presupuesto)}
                                        </Text>
                                    </View>
                                    <View style={grafStyles.rubroProgressBarContainer}>
                                        <View style={[
                                            grafStyles.rubroProgressBar,
                                            {
                                                width: `${Math.min(100, rubroPorcentaje)}%`,
                                                backgroundColor: (isExceeded || isZeroBudgetWithGasto) ? '#DC2626' : '#3B82F6'
                                            }
                                        ]} />
                                    </View>
                                    {(isExceeded || isZeroBudgetWithGasto) && (
                                        <Text style={grafStyles.rubroWarningText}>⚠️ Superó presupuesto por {formatCurrency(item.gastado - item.presupuesto)}</Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Chart: Gastos por Rubro */}
                {data.porRubro?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>📁 Gastos por Rubro</Text>
                        {data.porRubro.map((item, idx) => {
                            const maxVal = data.porRubro[0]?.total || 1;
                            const width = (item.total / maxVal) * 100;
                            return (
                                <View key={idx} style={grafStyles.barRow}>
                                    <TouchableOpacity onPress={() => handleOpenDetail('rubro', item.id, item.nombre)}>
                                        <Text style={[grafStyles.barLabel, { textDecorationLine: 'underline', color: '#2563EB' }]} numberOfLines={1}>
                                            {item.nombre}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={grafStyles.barContainer}>
                                        <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#3B82F6' }]} />
                                    </View>
                                    <Text style={grafStyles.barValue}>{formatCurrency(item.total)}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Chart: Gastos por Proveedor */}
                {data.porProveedor?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>🏢 Gastos por Proveedor (Top 5)</Text>
                        {data.porProveedor.map((item, idx) => {
                            const maxVal = data.porProveedor[0]?.total || 1;
                            const width = (item.total / maxVal) * 100;
                            return (
                                <View key={idx} style={grafStyles.barRow}>
                                    <TouchableOpacity onPress={() => handleOpenDetail('proveedor', item.id, item.nombre)}>
                                        <Text style={[grafStyles.barLabel, { textDecorationLine: 'underline', color: '#2563EB' }]} numberOfLines={1}>
                                            {item.nombre}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={grafStyles.barContainer}>
                                        <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#10B981' }]} />
                                    </View>
                                    <Text style={grafStyles.barValue}>{formatCurrency(item.total)}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}



                {/* Monthly Summary Table (Always show in Annual view) */}
                {!mesSeleccionado && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>📅 Resumen Mensual</Text>
                        <View style={grafStyles.tableHeader}>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader, { flex: 2 }]}>Mes</Text>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Presupuesto</Text>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Gastado</Text>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Restante</Text>
                        </View>
                        {(data.resumenMensual?.length > 0 ? data.resumenMensual :
                            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ mes: m, totalPresupuesto: 0, totalGastado: 0, restante: 0 }))
                        ).map((mes, idx) => (
                            <View key={idx} style={[grafStyles.tableRow, idx % 2 === 0 && grafStyles.tableRowAlt]}>
                                <Text style={[grafStyles.tableCell, { flex: 2 }]}>{mantenimientoApi.getMesNombre(mes.mes)}</Text>
                                <Text style={grafStyles.tableCell}>{formatCurrency(mes.totalPresupuesto || 0)}</Text>
                                <Text style={[grafStyles.tableCell, { color: '#059669' }]}>{formatCurrency(mes.totalGastado || 0)}</Text>
                                <Text style={[
                                    grafStyles.tableCell,
                                    { color: (mes.restante || 0) >= 0 ? '#059669' : '#DC2626' }
                                ]}>
                                    {formatCurrency(mes.restante || 0)}
                                </Text>
                            </View>
                        ))}
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

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await mantenimientoApi.getMaestros();
            setItems(data.rubros || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim()) { Alert.alert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            if (editItem) {
                await mantenimientoApi.updateRubro(editItem.id, { nombre });
                Alert.alert('Éxito', 'Rubro actualizado');
            } else {
                await mantenimientoApi.createRubro({ nombre });
                Alert.alert('Éxito', 'Rubro creado');
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try {
                await mantenimientoApi.deleteRubro(id);
                Alert.alert('Éxito', 'Rubro eliminado');
                loadData();
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar este rubro?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar este rubro?', [
                { text: 'Cancelar' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
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
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
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
    const [rubros, setRubros] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [nit, setNit] = useState('');
    const [telefono, setTelefono] = useState('');
    const [rubroId, setRubroId] = useState('');
    const [precioCotizado, setPrecioCotizado] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await mantenimientoApi.getMaestros();
            setItems(data.proveedores || []);
            setRubros(data.rubros || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = () => {
        setEditItem(null);
        setNombre('');
        setNit('');
        setTelefono('');
        setRubroId('');
        setPrecioCotizado('');
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setNombre(item.nombre);
        setNit(item.nit || '');
        setTelefono(item.telefono || '');
        setRubroId(item.rubroId?.toString() || '');
        setPrecioCotizado(item.precioCotizado?.toString() || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) { Alert.alert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            const provData = {
                nombre,
                nit,
                telefono,
                rubroId: rubroId ? parseInt(rubroId) : null
            };
            if (editItem) {
                await mantenimientoApi.updateProveedor(editItem.id, provData);
                Alert.alert('Éxito', 'Proveedor actualizado');
            } else {
                await mantenimientoApi.createProveedor(provData);
                Alert.alert('Éxito', 'Proveedor creado');
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try {
                await mantenimientoApi.deleteProveedor(id);
                Alert.alert('Éxito', 'Proveedor eliminado');
                loadData();
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar este proveedor?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar este proveedor?', [
                { text: 'Cancelar' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>🏢 Proveedores</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.gastoCard}>
                        <View style={styles.gastoHeader}>
                            <Text style={styles.gastoTipo}>{item.nombre}</Text>
                        </View>
                        <Text style={styles.gastoRubro}>{item.rubro?.nombre || 'Sin rubro asignado'}</Text>
                        <View style={styles.gastoDetails}>
                            {item.nit && <Text style={styles.gastoDetail}>📄 NIT: {item.nit}</Text>}
                            {item.telefono && <Text style={styles.gastoDetail}>📞 Tel: {item.telefono}</Text>}
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.editCardButton} onPress={() => handleEdit(item)}>
                                <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                                <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Proveedor</Text>
                    <ScrollView>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del proveedor" />

                        <Text style={styles.label}>NIT</Text>
                        <TextInput style={styles.input} value={nit} onChangeText={setNit} placeholder="NIT del proveedor" />

                        <Text style={styles.label}>Teléfono</Text>
                        <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="Teléfono" keyboardType="phone-pad" />

                        <Text style={styles.label}>Rubro</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={rubroId} onValueChange={setRubroId}>
                                <Picker.Item label="Seleccione un rubro..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>
                    </ScrollView>
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







// ===================== STYLES - EXACT COPY FROM SST =====================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // TABS - EXACT SST STYLE with dark blue background
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F', // Dark blue like SST/GH
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
        backgroundColor: 'transparent', // Transparent by default
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.15)', // Slight white overlay when active
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    tabIcon: {
        marginRight: 4,
        fontSize: 14,
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)', // Light text
        fontWeight: '500',
        fontSize: 13,
    },
    activeTabText: {
        color: '#FFF', // Pure white when active
    },
    // CONTENT
    contentContainer: {
        flex: 1,
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
    picker: {
        width: 110,
        height: 40,
    },
    // Nuevos estilos para filtros avanzados
    advancedFilters: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 15,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        alignItems: 'center',
    },
    filterLabel: {
        fontWeight: 'bold',
        color: '#4B5563',
        marginRight: 5,
    },
    filterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        overflow: 'hidden',
    },
    filterPicker: {
        height: 40,
        width: 180,
        borderWidth: 0,
        backgroundColor: 'transparent',
    },
    filterInput: {
        height: 40,
        paddingHorizontal: 10,
        minWidth: 120,
        backgroundColor: '#fff',
    },
    clearFilterBtn: {
        padding: 5,
        marginRight: 5,
    },
    clearFilterText: {
        color: '#9CA3AF',
        fontWeight: 'bold',
    },
    // SUMMARY - EXACT SST COLORS
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
        backgroundColor: '#DBEAFE', // Light blue - same as SST
    },
    gastadoCard: {
        backgroundColor: '#FEE2E2', // Light pink - same as SST
    },
    restanteCard: {
        backgroundColor: '#D1FAE5', // Light green - same as SST
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
    // BUTTONS
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
    // LIST
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
    // GASTO CARD - EXACT SST
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
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 14,
        gap: 12,
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
    // ITEM CARD
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
    // MODAL
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
    // PRESUPUESTO TAB STYLES
    presupuestoNote: {
        backgroundColor: '#EBF5FF',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    noteText: {
        color: '#1E40AF',
        fontSize: 13,
    },
    presupuestoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    presupuestoLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        flex: 1,
    },
    presupuestoInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
    },
    currencyPrefix: {
        fontSize: 14,
        color: '#6B7280',
        marginRight: 4,
    },
    presupuestoInput: {
        width: 120,
        padding: 10,
        fontSize: 14,
        textAlign: 'right',
    },
    // Budget info box styles
    budgetInfoBox: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
    },
    budgetInfoBoxOk: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    budgetInfoBoxWarning: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    budgetInfoBoxNegative: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    budgetInfoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#1F2937',
    },
    budgetInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    budgetInfoTotal: {
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#D1D5DB',
    },
    budgetInfoLabel: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    budgetInfoValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'center',
    },
    budgetInfoLabelBold: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    budgetInfoValueBold: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#10B981',
    },
    budgetInfoNegative: {
        color: '#EF4444',
    },
    // Budget container styles - SST style
    budgetContainer: {
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    budgetHeader: {
        marginBottom: 12,
    },
    budgetTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0369A1',
    },
    budgetInfoItem: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    budgetWarning: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 4,
        color: '#92400E',
        fontSize: 12,
        textAlign: 'center',
    },
    budgetNoData: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#E0E7FF',
        borderRadius: 4,
        color: '#3730A3',
        fontSize: 12,
        textAlign: 'center',
    },
    // New Styles for Pending Expenses
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: '#FFF7ED',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FDBA74'
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#F97316',
        borderRadius: 4,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white'
    },
    checkboxChecked: {
        backgroundColor: '#F97316',
    },
    checkboxCheck: {
        color: 'white',
        fontWeight: 'bold',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#9A3412',
        fontWeight: 'bold',
    },
    pendingBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    pendingBadgeOverdue: {
        backgroundColor: '#FECACA',
        borderColor: '#EF4444',
    },
    pendingText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#D97706',
    },
    gastoCardOverdue: {
        borderColor: '#EF4444',
        borderWidth: 1.5,
        backgroundColor: '#FEF2F2',
    },
    deadlineText: {
        fontSize: 11,
        color: '#D97706',
        marginTop: 2,
    },
    deadlineTextOverdue: {
        color: '#DC2626',
        fontWeight: 'bold',
    },
    checkboxFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E5E7EB',
        paddingHorizontal: 12,
        borderRadius: 6,
        height: 40,
        borderWidth: 1,
        borderColor: '#D1D5DB'
    },
    checkboxFilterActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706'
    }
});

// Graficas Styles (SST style)
const grafStyles = StyleSheet.create({
    summaryCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        alignItems: 'center',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0369A1',
    },
    summarySubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    chartSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 12,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    barLabel: {
        width: 100,
        fontSize: 12,
        color: '#4B5563',
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 4,
    },
    barValue: {
        width: 80,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'right',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        borderRadius: 4,
        paddingVertical: 8,
        marginBottom: 4,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableRowAlt: {
        backgroundColor: '#F9FAFB',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
        color: '#1F2937',
    },
    tableCellHeader: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },

    // Dashboard SST style
    dashboardRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
    },
    summaryCardSmall: {
        flex: 1,
        minWidth: 150,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    progressBarContainer: {
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 10,
        overflow: 'hidden',
        marginVertical: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 10,
    },
    progressText: {
        textAlign: 'center',
        fontSize: 14,
        color: '#6B7280',
    },
    // Detailed Rubro Report Styles
    rubroReportRow: { marginBottom: 16 },
    rubroReportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rubroReportName: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
    rubroReportStatus: { fontSize: 12, fontWeight: '500' },
    rubroProgressBarContainer: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden' },
    rubroProgressBar: { height: '100%', borderRadius: 6 },
    rubroWarningText: { fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '500' },
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
});

// ===================== COTIZACIONES TAB =====================
// Adapted from TalleresGastosScreen
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
    const [formData, setFormData] = useState({ rubroId: '', proveedorId: '', precio: '', descripcion: '' });
    const [saving, setSaving] = useState(false);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
    const MESES = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [itemsData, rubrosData, proveedoresData] = await Promise.all([
                mantenimientoApi.getCotizaciones(anio, mes),
                mantenimientoApi.getMaestros().then(d => d.rubros || []),
                mantenimientoApi.getMaestros().then(d => d.proveedores || [])
            ]);
            setItems(itemsData);
            setRubros(rubrosData);
            setProveedores(proveedoresData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = () => { setEditItem(null); setFormData({ rubroId: '', proveedorId: '', precio: '', descripcion: '' }); setShowModal(true); };
    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            rubroId: item.rubroId?.toString() || '',
            proveedorId: item.proveedorId?.toString() || '',
            precio: item.precioCotizado?.toString() || '',
            descripcion: item.descripcion || ''
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.rubroId || !formData.proveedorId || !formData.precio) { Alert.alert('Error', 'Complete campos obligatorios'); return; }
        try {
            setSaving(true);
            const data = {
                rubroId: parseInt(formData.rubroId),
                proveedorId: parseInt(formData.proveedorId),
                precioCotizado: parseFloat(formData.precio),
                descripcion: formData.descripcion,
                anio, mes
            };
            if (editItem) { await mantenimientoApi.updateCotizacion(editItem.id, { ...data, id: editItem.id }); }
            else { await mantenimientoApi.createCotizacion(data); }
            Alert.alert('Éxito', 'Cotización guardada');
            setShowModal(false); loadData();
        } catch (e) { Alert.alert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await mantenimientoApi.deleteCotizacion(id); loadData(); Alert.alert('Éxito', 'Eliminado'); } catch { Alert.alert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar cotización?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

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
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#2563EB" /> : (
                <ScrollView style={styles.listContainer}>
                    {items.length === 0 ? <Text style={styles.emptyText}>No hay cotizaciones para este periodo. Agregue una.</Text> : items.map(item => (
                        <View key={item.id} style={styles.itemCard}>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{item.rubroNombre} - {item.proveedorNombre}</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#059669' }}>{formatCurrency(item.precioCotizado)}</Text>
                                {item.descripcion && <Text style={{ fontSize: 12, color: '#666' }}>{item.descripcion}</Text>}
                            </View>
                            <View style={styles.itemActions}>
                                <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Nueva'} Cotización</Text>
                    <ScrollView style={styles.formContainer}>
                        <Text style={styles.label}>Rubro *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.rubroId} onValueChange={v => setFormData(p => ({ ...p, rubroId: v }))}>
                                <Picker.Item label="Seleccione..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>
                        <Text style={styles.label}>Proveedor *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.proveedorId} onValueChange={v => setFormData(p => ({ ...p, proveedorId: v }))}>
                                <Picker.Item label="Seleccione..." value="" />
                                {proveedores.map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                            </Picker>
                        </View>
                        <Text style={styles.label}>Precio Cotizado *</Text>
                        <TextInput style={styles.input} value={formData.precio} onChangeText={t => setFormData(p => ({ ...p, precio: t }))} keyboardType="numeric" placeholder="$ 0" />
                        <Text style={styles.label}>Descripción</Text>
                        <TextInput style={styles.input} value={formData.descripcion} onChangeText={t => setFormData(p => ({ ...p, descripcion: t }))} placeholder="Opcional..." />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View></View>
            </Modal>
        </View>
    );
}
