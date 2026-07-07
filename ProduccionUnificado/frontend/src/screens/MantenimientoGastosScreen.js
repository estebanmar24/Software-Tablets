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
import * as DocumentPicker from 'expo-document-picker';
import { mantenimientoApi } from '../services/mantenimientoApi';
import { ExpenseHistoryModal } from '../components/ExpenseHistoryModal';
import { useTheme, lightColors } from '../contexts/ThemeContext';
import { getFileServerUrl, getApiBaseUrl } from '../services/apiConfig';

// TABS - Same structure as SST
const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },
    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'productos', label: 'Productos', icon: '📦' },
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
const COLOMBIAN_HOLIDAYS = [
    // 2025
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18', '2025-05-01',
    '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18',
    '2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25',
    // 2026
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01',
    '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07',
    '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'
];


export default function MantenimientoGastosScreen({ initialTab = 'gastos' }) {
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        console.log('MANTENIMIENTO GASTOS SCREEN: activeTab is', activeTab);
    }, [activeTab]);

    return (
        <View style={styles.container}>
            {/* Tabs - EXACT SST STYLE */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 10 }}>
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
                </ScrollView>
            </View>

            {/* Content based on active tab */}
            {activeTab === 'gastos' && <GastosTab />}
            {activeTab === 'graficas' && <GraficasTab />}
            {activeTab === 'rubros' && <RubrosTab />}
            {activeTab === 'productos' && <ProductosTab />}
            {activeTab === 'cotizaciones' && <CotizacionesTab />}
            { activeTab === 'proveedores' && <ProveedoresTab />}
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab() {
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
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
    const [usuarios, setUsuarios] = useState([]);
    const [productos, setProductos] = useState([]);
    const [tiposHora, setTiposHora] = useState([]);
    const [tiposRecargo, setTiposRecargo] = useState([]);

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
    const [filterUsuarioId, setFilterUsuarioId] = useState('');

    // Filtered data for cascading dropdowns
    const [filteredProveedores, setFilteredProveedores] = useState([]);

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryGasto, setSelectedHistoryGasto] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [isLegalizing, setIsLegalizing] = useState(false); // State for UI rendering
    const isLegalizingRef = useRef(false); // Ref for robust state tracking
    const [formData, setFormData] = useState({
        rubroId: '', proveedorId: '', maquinaId: '', productoId: '',
        usuarioId: '', tipoHoraId: '', tipoRecargoId: '',
        horaInicio: '', horaFin: '', cantidadHoras: '', cantidad: '',
        precio: '', precioDisplay: '', fecha: new Date().toISOString().split('T')[0], nota: '',
        numeroFactura: '', facturaPdfUrl: '', archivoFactura: null, archivoNombre: '', numeroOP: '', esPendiente: false, esSolicitudCredito: false
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
            setUsuarios(data.usuarios || []);
            setProductos(data.productos || []);
            setTiposHora(data.tiposHora || []);
            setTiposRecargo(data.tiposRecargo || []);
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





    // Format currency with thousands separator
    const formatCurrencyInput = (value) => {
        if (!value) return '';
        const numericValue = value.toString().replace(/[^0-9]/g, '');
        if (!numericValue) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
    };

    const handlePriceChange = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        const formatted = formatCurrencyInput(value);
        setFormData(prev => ({ ...prev, precio: numericValue, precioDisplay: formatted }));
    };

    // ========== SMART BREAKDOWN (Turno base desde horaInicio) ==========
    const [breakdown, setBreakdown] = useState([]);

    const calculateSmartBreakdown = useCallback(() => {
        if (!formData.usuarioId || !formData.horaInicio || !formData.horaFin || !formData.fecha) {
            setBreakdown([]);
            return;
        }
        const worker = usuarios.find(u => u.id == formData.usuarioId);
        if (!worker) { setBreakdown([]); return; }

        const parseDate = (d) => {
            if (!d) return new Date();
            const cleanDate = d.trim();
            if (cleanDate.includes('/')) {
                const [day, month, year] = cleanDate.split('/');
                return new Date(`${year}-${month}-${day}T12:00:00`);
            }
            return new Date(cleanDate + 'T12:00:00');
        };

        const formatISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

        const startFull = toMin(formData.horaInicio);
        let endFull = toMin(formData.horaFin);
        if (endFull <= startFull) endFull += 24 * 60;

        const startDate = parseDate(formData.fecha);
        const breakdownItems = [];
        const NIGHT_START = 19 * 60, NIGHT_END = 6 * 60;

        const isSundayStart = startDate.getDay() === 0;
        const isHolidayStart = COLOMBIAN_HOLIDAYS.includes(formatISO(startDate));
        const isSpecialDayStart = isSundayStart || isHolidayStart;
        const isSaturdayStart = startDate.getDay() === 6;

        const baseShiftMinutes = isSpecialDayStart ? 0 : (isSaturdayStart ? 4 * 60 : 8 * 60);
        const shiftEndMin = startFull + baseShiftMinutes;

        const addBreakdown = (s, e, typeNameMatch, isHe, isSpecialDay) => {
            if (e <= s) return;
            const duration = (e - s) / 60;
            const list = isHe ? tiposHora : tiposRecargo;
            const search = typeNameMatch.toLowerCase();
            const timeOfDay = search.includes('nocturn') ? 'nocturn' : 'diurn';
            let tipo = list.find(t => {
                const name = (t.nombre || '').toLowerCase();
                const isSpecialType = name.includes('dominical') || name.includes('festivo');
                return isSpecialDay ? (isSpecialType && name.includes(timeOfDay)) : (!isSpecialType && name.includes(timeOfDay));
            });
            if (!tipo && isSpecialDay) tipo = list.find(t => { const n = (t.nombre || '').toLowerCase(); return n.includes('dominical') || n.includes('festivo'); });
            if (!tipo) tipo = list.find(t => (t.nombre || '').toLowerCase().includes(search));
            if (tipo) {
                const existing = breakdownItems.find(item => item.typeId === tipo.id && item.isHe === isHe);
                if (existing) existing.hours += duration;
                else breakdownItems.push({ type: tipo.nombre, typeId: tipo.id, hours: duration, isHe });
            }
        };

        const cutPoints = new Set([startFull, endFull]);
        if (shiftEndMin > startFull && shiftEndMin < endFull) cutPoints.add(shiftEndMin);
        [NIGHT_END, NIGHT_START, 1440, NIGHT_END + 1440, NIGHT_START + 1440].forEach(boundary => {
            if (boundary > startFull && boundary < endFull) cutPoints.add(boundary);
        });
        const sortedCuts = [...cutPoints].sort((a, b) => a - b);

        for (let i = 0; i < sortedCuts.length - 1; i++) {
            const s = sortedCuts[i];
            const e = sortedCuts[i + 1];
            const mid = (s + e) / 2;
            const actualDate = new Date(startDate);
            if (mid >= 1440) actualDate.setDate(actualDate.getDate() + 1);
            const actualDateISO = formatISO(actualDate);
            const isSpecialDay = actualDate.getDay() === 0 || COLOMBIAN_HOLIDAYS.includes(actualDateISO);
            const isWithinShift = s < shiftEndMin;
            const timeInDay = mid % 1440;
            const isNight = timeInDay >= NIGHT_START || timeInDay < NIGHT_END;

            if (isSpecialDay) {
                addBreakdown(s, e, isNight ? 'Dominical Nocturna' : 'Dominical Diurna', true, true);
            } else if (isWithinShift) {
                if (isNight) addBreakdown(s, e, 'Recargo Nocturno', false, false);
            } else {
                if (isNight) addBreakdown(s, e, 'Extra Nocturna', true, false);
                else addBreakdown(s, e, 'Extra Diurna', true, false);
            }
        }

        const formatHours = (h) => {
            const totalMin = Math.round(Math.abs(h) * 60);
            const hh = Math.floor(totalMin / 60);
            const mm = totalMin % 60;
            return `${h < 0 ? '-' : ''}${hh}:${mm.toString().padStart(2, '0')}`;
        };

        const totalDurationMin = endFull - startFull;
        if (totalDurationMin >= 6 * 60) {
            const extraItem = breakdownItems.find(item => item.isHe);
            if (extraItem && extraItem.hours > 1) extraItem.hours -= 1.0;
            else {
                const recargoItem = breakdownItems.find(item => !item.isHe);
                if (recargoItem) recargoItem.hours = Math.max(0, recargoItem.hours - 1.0);
            }
            breakdownItems.push({ type: '- COMIDA (Descuento)', typeId: 0, hours: -1.0, isHe: false, isLunch: true });
        }

        setBreakdown(breakdownItems.map(item => ({ ...item, formattedHours: formatHours(item.hours) })));

        let totalCost = 0;
        const valorHoraBase = (parseFloat(worker.salario) || 0) / 220;
        breakdownItems.filter(item => !item.isLunch).forEach(item => {
            const tipo = (item.isHe ? tiposHora : tiposRecargo).find(t => t.id == item.typeId);
            if (tipo) totalCost += valorHoraBase * (parseFloat(tipo.factor) || 1.0) * item.hours;
        });
        setFormData(prev => ({ ...prev, precio: Math.round(totalCost).toString() }));

    }, [formData.usuarioId, formData.horaInicio, formData.horaFin, formData.fecha, usuarios, tiposHora, tiposRecargo]);

    useEffect(() => {
        calculateSmartBreakdown();
    }, [formData.horaInicio, formData.horaFin, formData.usuarioId, formData.fecha]);
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];

            if (file.size && file.size > 5 * 1024 * 1024) {
                Alert.alert('⚠️ Error', 'El archivo es muy grande. Máximo 5MB.');
                return;
            }

            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                try {
                    const webFile = new File([blob], file.name, { type: 'application/pdf' });
                    const uploadResult = await mantenimientoApi.uploadFactura(webFile);
                    setFormData(p => ({ ...p, facturaPdfUrl: uploadResult.url, archivoNombre: file.name }));
                    Alert.alert('✅ Éxito', `Archivo "${file.name}" cargado correctamente.`);
                } catch (err) {
                    Alert.alert('❌ Error', 'No se pudo subir el PDF al servidor.');
                }
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

    useEffect(() => {
        if (formData.rubroId) {
            let filtered = proveedores.filter(p => !p.rubroId || p.rubroId.toString() === formData.rubroId.toString());
            // Si estamos editando, asegurarnos de que el proveedor actual esté en la lista para que no se borre
            if (editItem && editItem.proveedorId) {
                const currentP = proveedores.find(p => p.id === editItem.proveedorId);
                if (currentP && !filtered.find(p => p.id === currentP.id)) {
                    filtered = [currentP, ...filtered];
                }
            }
            setFilteredProveedores(filtered);
        } else {
            setFilteredProveedores(proveedores);
        }
    }, [formData.rubroId, proveedores, editItem]);

    // Autofill Price from Cotizaciones when Proveedor is selected
    useEffect(() => {
        if (formData.proveedorId && !isLegalizingRef.current && !editItem) {
            const cotizacion = cotizaciones.find(c => c.proveedorId.toString() === formData.proveedorId.toString() && (!formData.rubroId || c.rubroId.toString() === formData.rubroId.toString()));
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
    }, [formData.proveedorId, cotizaciones, formData.rubroId, editItem]);

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
            rubroId: '', proveedorId: '', maquinaId: '', productoId: '',
            precio: '', precioDisplay: '', fecha: new Date().toISOString().split('T')[0], nota: '',
            numeroFactura: '', facturaPdfUrl: '', archivoFactura: null, archivoNombre: '', numeroOP: '', esPendiente: false, esSolicitudCredito: false,
            esOtraMaquina: false, otraMaquinaNombre: '', cantidad: ''
        });
    };



    const handleSelectQuote = (quote) => {
        const numericValue = quote.precioCotizado.toString();
        const formatted = formatCurrencyInput(numericValue);
        setFormData(prev => ({
            ...prev,
            rubroId: quote.rubroId.toString(),
            proveedorId: quote.proveedorId.toString(),
            precio: numericValue,
            precioDisplay: formatted,
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
            precioDisplay: formatCurrencyInput(gasto.precio?.toString() || ''),
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '',
            numeroFactura: gasto.numeroFactura || '',
            facturaPdfUrl: gasto.facturaPdfUrl || '',
            archivoFactura: gasto.archivoFactura || null,
            archivoNombre: gasto.facturaPdfUrl ? 'Archivo adjunto' : '',
            numeroOP: gasto.numeroOP || '',
            usuarioId: gasto.usuarioId?.toString() || '',
            horaInicio: gasto.horaInicio || '',
            horaFin: gasto.horaFin || '',
            cantidadHoras: gasto.cantidadHoras?.toString() || '',
            esPendiente: false,
            esSolicitudCredito: gasto.esSolicitudCredito || false,
            esOtraMaquina: !!gasto.otraMaquinaNombre,
            otraMaquinaNombre: gasto.otraMaquinaNombre || '',
            productoId: gasto.productoId?.toString() || '',
            cantidad: gasto.cantidad?.toString() || ''
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
            precioDisplay: formatCurrencyInput(gasto.precio?.toString() || ''),
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '',
            numeroFactura: gasto.numeroFactura || '',
            facturaPdfUrl: gasto.facturaPdfUrl || '',
            archivoFactura: gasto.archivoFactura || null,
            archivoNombre: gasto.facturaPdfUrl ? 'Archivo adjunto' : '',
            numeroOP: gasto.numeroOP || '',
            usuarioId: gasto.usuarioId?.toString() || '',
            horaInicio: gasto.horaInicio || '',
            horaFin: gasto.horaFin || '',
            cantidadHoras: gasto.cantidadHoras?.toString() || '',
            esPendiente: gasto.esPendiente || false,
            esSolicitudCredito: gasto.esSolicitudCredito || false,
            esOtraMaquina: !!gasto.otraMaquinaNombre,
            otraMaquinaNombre: gasto.otraMaquinaNombre || '',
            productoId: gasto.productoId?.toString() || '',
            cantidad: gasto.cantidad?.toString() || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.rubroId) { Alert.alert('Error', 'Seleccione un rubro'); return; }
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        const rubroName = selectedRubro?.nombre?.toLowerCase() || '';
        const isInsumos = rubroName.includes('insumo');
        const isHorasExtras = rubroName.includes('horas extras') || rubroName.includes('hora extra');
        const isRecargo = rubroName.includes('recargo');
        const isMaintenance = rubroName.includes('mantenimiento') || rubroName.includes('repuesto');

        // Validation for Horas Extras / Recargos
        if ((isHorasExtras || isRecargo) && !formData.usuarioId) {
            Alert.alert('Error', 'Seleccione un Operario'); return;
        }
        if ((isHorasExtras || isRecargo) && (!formData.horaInicio || !formData.horaFin)) {
            Alert.alert('Error', 'Ingrese Hora Inicio y Hora Fin'); return;
        }
        if ((isHorasExtras || isRecargo) && breakdown.length === 0) {
            Alert.alert('Error', 'No se detectaron horas extras/recargos en el intervalo ingresado'); return;
        }

        // Validation for OP number (required for Horas Extras, Recargos, and Insumos)
        if ((isHorasExtras || isRecargo || isInsumos) && !formData.numeroOP.trim()) {
            Alert.alert('Error', isHorasExtras || isRecargo ? 'Ingrese el Número de OP (Orden de Producción)' : 'Para Insumos, el Número de OP es obligatorio'); return;
        }

        // Validation for Maintenance/Spares: Machine is Mandatory (either from list or 'Other')
        if (isMaintenance) {
            if (formData.esOtraMaquina && !formData.otraMaquinaNombre?.trim()) {
                Alert.alert('Error', 'Ingrese el nombre de la otra máquina'); return;
            }
            if (!formData.esOtraMaquina && !formData.maquinaId) {
                Alert.alert('Error', 'Seleccione la Máquina (Obligatorio para Mantenimiento/Repuesto)'); return;
            }
        }

        // Validación de factura y precio (Opcional si es pendiente) para NO Horas extras
        if (!isHorasExtras && !isRecargo) {
            if (!formData.esPendiente) {
                if (!formData.precio || parseFloat(formData.precio) <= 0) {
                    Alert.alert('Error', 'Ingrese el precio'); return;
                }
                if (!formData.numeroFactura || !formData.numeroFactura.trim()) {
                    Alert.alert('Error', 'Número de Factura es obligatorio'); return;
                }
            }
        }

        try {
            setSaving(true);

            // Si hay un archivoFactura (móvil) que no se ha subido aún
            let finalFacturaPdfUrl = formData.facturaPdfUrl;
            if (Platform.OS !== 'web' && formData.archivoFactura && !formData.facturaPdfUrl) {
                try {
                    const uploadResult = await mantenimientoApi.uploadFactura({
                        uri: formData.archivoFactura,
                        name: formData.archivoNombre || 'factura.pdf',
                        type: 'application/pdf'
                    });
                    finalFacturaPdfUrl = uploadResult.url;
                } catch (err) {
                    Alert.alert('Error', 'No se pudo subir el PDF desde móvil.');
                    setSaving(false);
                    return;
                }
            }

            // Construcción limpia y segura del objeto para el backend
            const safeParseInt = (val) => {
                const parsed = parseInt(val);
                return isNaN(parsed) ? null : parsed;
            };

            const gastoData = {
                id: editItem ? editItem.id : 0,
                rubroId: safeParseInt(formData.rubroId) || 0,
                proveedorId: safeParseInt(formData.proveedorId),
                maquinaId: (!formData.esOtraMaquina && formData.maquinaId) ? safeParseInt(formData.maquinaId) : null,
                otraMaquinaNombre: formData.esOtraMaquina ? formData.otraMaquinaNombre : null,
                precio: parseFloat(formData.precio || 0) || 0,
                fecha: formData.fecha,
                nota: formData.nota || '',
                numeroFactura: formData.numeroFactura || '',
                facturaPdfUrl: finalFacturaPdfUrl,
                esPendiente: !!formData.esPendiente,
                esSolicitudCredito: !!formData.esSolicitudCredito,
                numeroOP: formData.numeroOP || '',
                usuarioId: safeParseInt(formData.usuarioId),
                productoId: safeParseInt(formData.productoId),
                cantidad: parseFloat(formData.cantidad) || null,
                tipoHoraId: safeParseInt(formData.tipoHoraId),
                tipoRecargoId: safeParseInt(formData.tipoRecargoId),
                cantidadHoras: parseFloat(formData.cantidadHoras) || null,
                horaInicio: formData.horaInicio || null,
                horaFin: formData.horaFin || null,
                activo: true,
                anio: parseInt(formData.fecha.split('-')[0]),
                mes: parseInt(formData.fecha.split('-')[1])
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

            // Si hay breakdown (Horas Extras/Recargos con Hora Inicio/Fin), crear múltiples registros
            if ((isHorasExtras || isRecargo) && breakdown.length > 0 && !editItem) {
                const worker = usuarios.find(u => u.id == formData.usuarioId);
                const valorHoraBase = (parseFloat(worker?.salario) || 0) / 220;

                const rubroHE = rubros.find(r => r.nombre.toLowerCase().includes('horas extras') || r.nombre.toLowerCase().includes('hora extra'))?.id;
                const rubroRecargo = rubros.find(r => r.nombre.toLowerCase().includes('recargo'))?.id;

                const promises = breakdown.filter(item => !item.isLunch).map(item => {
                    const list = item.isHe ? tiposHora : tiposRecargo;
                    const tipo = list.find(t => t.id == item.typeId);
                    const factor = parseFloat(tipo?.factor) || 1.0;
                    const itemPrecio = Math.round(valorHoraBase * factor * item.hours);

                    const record = {
                        rubroId: item.isHe ? (rubroHE || parseInt(formData.rubroId)) : (rubroRecargo || parseInt(formData.rubroId)),
                        proveedorId: null,
                        usuarioId: parseInt(formData.usuarioId),
                        maquinaId: formData.maquinaId ? parseInt(formData.maquinaId) : null,
                        tipoHoraId: item.isHe ? parseInt(item.typeId) : null,
                        tipoRecargoId: !item.isHe ? parseInt(item.typeId) : null,
                        precio: itemPrecio,
                        fecha: formData.fecha,
                        nota: `Auto-generado (${item.type}): ${formData.nota || ''}`,
                        cantidadHoras: parseFloat(item.hours.toFixed(2)),
                        anio: parseInt(formData.fecha.split('-')[0]),
                        mes: parseInt(formData.fecha.split('-')[1]),
                        numeroFactura: null,
                        facturaPdfUrl: null,
                        numeroOP: formData.numeroOP || null,
                        esPendiente: false
                    };
                    return mantenimientoApi.createGasto(record);
                });
                await Promise.all(promises);
            } else {
                if (editItem) await mantenimientoApi.updateGasto(editItem.id, { ...gastoData, id: editItem.id });
                else await mantenimientoApi.createGasto(gastoData);
            }

            Alert.alert('Éxito', editItem ? 'Gasto actualizado' : 'Gasto registrado');
            setShowModal(false); resetForm(); loadGastos();
        } catch (error) { 
            console.error('Error saving gasto:', error);
            Alert.alert('Error', 'No se pudo guardar'); 
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await mantenimientoApi.deleteGasto(id); loadGastos(); } catch { Alert.alert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar gasto?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar este gasto?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: doDelete }]); }
    };

    const selectedRubro = rubros.find(r => r.id == formData.rubroId);
    const selectedRubroName = (selectedRubro?.nombre || '').toLowerCase().trim();
    const isInsumos = selectedRubroName.includes('insumo');
    const isHorasExtras = selectedRubroName.includes('horas extras') || selectedRubroName.includes('hora extra');
    const isRecargo = selectedRubroName.includes('recargo');
    const isMaintenance = selectedRubroName.includes('mantenimiento') || selectedRubroName.includes('repuesto');
    const isInventoryRubro = ['ferreteria', 'ferretería', 'lubricacion', 'lubricación', 'repuestos', 'rodamientos', 'sistema aire'].includes(selectedRubroName);
    
    const filteredProductos = productos.filter(p => p.rubroId == formData.rubroId);

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
    const filterRubroName = (selectedFilterRubro?.nombre || '').toLowerCase().trim();
    const showMachineFilter = filterRubroName.includes('mantenimiento') || filterRubroName.includes('repuesto');

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
                                        {gasto.otraMaquinaNombre && <Text style={styles.gastoDetail}>⚙️ {gasto.otraMaquinaNombre} (Otra)</Text>}
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
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                                <Text style={styles.label}>{formData.esOtraMaquina ? 'Nombre de la Máquina *' : 'Máquina *'}</Text>
                                                
                                                <TouchableOpacity 
                                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                                    onPress={() => setFormData(p => ({ ...p, esOtraMaquina: !p.esOtraMaquina, maquinaId: !p.esOtraMaquina ? '' : p.maquinaId }))}
                                                >
                                                    <View style={[styles.checkbox, { width: 16, height: 16, marginRight: 5 }, formData.esOtraMaquina && { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}>
                                                        {formData.esOtraMaquina && <Text style={[styles.checkboxCheck, { fontSize: 10 }]}>✓</Text>}
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: '#4B5563' }}>¿Otra máquina?</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {formData.esOtraMaquina ? (
                                                <TextInput
                                                    style={styles.input}
                                                    value={formData.otraMaquinaNombre}
                                                    onChangeText={(t) => setFormData(p => ({ ...p, otraMaquinaNombre: t }))}
                                                    placeholder="Escriba el nombre de la máquina..."
                                                />
                                            ) : (
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
                                            )}
                                        </View>
                                    )}

                                    {isInventoryRubro && (
                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={styles.label}>Producto de Inventario *</Text>
                                            <View style={styles.pickerContainer}>
                                                <Picker
                                                    selectedValue={formData.productoId}
                                                    onValueChange={(v) => {
                                                        const prod = productos.find(p => p.id.toString() === v);
                                                        setFormData(p => ({ ...p, productoId: v, nota: prod ? `${prod.nombre} ${prod.referencia || ''}` : p.nota }));
                                                    }}
                                                >
                                                    <Picker.Item label="Seleccione Producto..." value="" />
                                                    {filteredProductos.map(p => (
                                                        <Picker.Item key={p.id} label={`${p.nombre} ${p.referencia ? `(${p.referencia})` : ''}`} value={p.id.toString()} />
                                                    ))}
                                                </Picker>
                                            </View>
                                            {formData.productoId && (
                                                <View style={{ flexFull: 1, marginTop: 10 }}>
                                                    <Text style={styles.label}>Cantidad a Ingresar *</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={formData.cantidad}
                                                        onChangeText={(t) => setFormData(p => ({ ...p, cantidad: t }))}
                                                        placeholder="Cantidad"
                                                        keyboardType="numeric"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {(isHorasExtras || isRecargo) ? (
                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={styles.label}>Personal de Planta *</Text>
                                            <View style={styles.pickerContainer}>
                                                <Picker selectedValue={formData.usuarioId} onValueChange={(v) => {
                                                    setFormData(p => ({ ...p, usuarioId: v }));
                                                }}>
                                                    <Picker.Item label="Seleccione..." value="" />
                                                    {usuarios.map(u => <Picker.Item key={u.id} label={`${u.nombre} (${u.documento || u.cedula || 'S/D'})`} value={u.id.toString()} />)}
                                                </Picker>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={{ marginBottom: 15 }}>
                                            <Text style={styles.label}>Proveedor {formData.esPendiente && !isLegalizing ? '(Opcional por ahora)' : ''}</Text>
                                            <View style={[styles.pickerContainer, (!formData.rubroId || filteredProveedores.length === 0) && { backgroundColor: '#F3F4F6' }]}>
                                                <Picker
                                                    selectedValue={formData.proveedorId}
                                                    onValueChange={(v) => setFormData(p => ({ ...p, proveedorId: v }))}
                                                    enabled={!!formData.rubroId && filteredProveedores.length > 0}
                                                >
                                                    {!formData.rubroId ? (
                                                        <Picker.Item label="Seleccione un rubro primero..." value="" />
                                                    ) : filteredProveedores.length === 0 ? (
                                                        <Picker.Item label="(No hay proveedores para este rubro)" value="" />
                                                    ) : (
                                                        <Picker.Item label="Seleccione..." value="" />
                                                    )}
                                                    {filteredProveedores.map(p => (
                                                        <Picker.Item key={p.id} label={`${p.nombre}${p.precioCotizado ? ` - ${formatCurrency(p.precioCotizado)}` : ''}`} value={p.id.toString()} />
                                                    ))}
                                                </Picker>
                                            </View>
                                        </View>
                                    )}

                                    {/* Overtime Time Selection UI */}
                                    {(isHorasExtras || isRecargo) && (
                                        <>
                                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.label}>Hora Inicio *</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={formData.horaInicio}
                                                        onChangeText={(t) => setFormData(p => ({ ...p, horaInicio: t }))}
                                                        placeholder="HH:MM"
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.label}>Hora Fin *</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={formData.horaFin}
                                                        onChangeText={(t) => setFormData(p => ({ ...p, horaFin: t }))}
                                                        placeholder="HH:MM"
                                                    />
                                                </View>
                                            </View>

                                            {breakdown.length > 0 && (
                                                <View style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, marginBottom: 15 }}>
                                                    <Text style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 13 }}>Desglose de Horas:</Text>
                                                    {breakdown.map((item, idx) => (
                                                        <Text key={idx} style={{ fontSize: 13, color: '#4B5563', fontWeight: 'bold' }}>
                                                            • {item.type}: {item.formattedHours || item.hours.toFixed(2)}
                                                        </Text>
                                                    ))}
                                                </View>
                                            )}
                                        </>
                                    )}

                                    {/* Checkbox de Pendiente - Hide when Legalizing */}
                                    {!isLegalizing && !isHorasExtras && !isRecargo && (
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

                                    {(isHorasExtras || isRecargo || isInsumos) && (
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

                                    {!isHorasExtras && !isRecargo && (
                                        <View style={{ marginBottom: 10 }}>
                                            <Text style={styles.label}>Número de Factura *</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={formData.numeroFactura}
                                                onChangeText={(t) => setFormData(p => ({ ...p, numeroFactura: t }))}
                                                placeholder="Ej: FAC-001234"
                                            />

                                            <Text style={styles.label}>PDF Factura (opcional)</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#E5E7EB', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' }}
                                                    onPress={handlePickFile}
                                                >
                                                    <Text style={{ color: '#374151', fontWeight: 'bold' }}>
                                                        {formData.archivoNombre ? `📎 ${formData.archivoNombre}` : '📎 Adjuntar PDF'}
                                                    </Text>
                                                </TouchableOpacity>

                                                {!!formData.facturaPdfUrl && (
                                                    <a href={`${serverUrl}${formData.facturaPdfUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', padding: 10 }}>
                                                        📄 Ver PDF
                                                    </a>
                                                )}
                                            </View>
                                        </View>
                                    )}

                                    <View style={{ marginBottom: 15 }}>
                                        <Text style={styles.label}>Precio * {(!formData.esPendiente && !formData.numeroFactura.trim()) ? '(ingrese factura primero)' : ''}</Text>
                                        <View style={[styles.input, (!formData.esPendiente && !formData.numeroFactura.trim()) && styles.inputDisabled, { flexDirection: 'row', alignItems: 'center', padding: 0 }]}>
                                            <Text style={{ paddingLeft: 12, color: '#6B7280', fontSize: 16 }}>$ </Text>
                                            <TextInput
                                                style={{ flex: 1, padding: 12, fontSize: 16 }}
                                                value={formData.precioDisplay}
                                                onChangeText={handlePriceChange}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                editable={(formData.esPendiente || !!formData.numeroFactura.trim() || !!editItem)}
                                            />
                                        </View>
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
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
    const grafStyles = getGrafStyles(isDarkMode, colors);
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
                            <View style={{ flexDirection: 'row', gap: 10, padding: 8, backgroundColor: isDarkMode ? '#1e293b' : '#F3F4F6', borderRadius: 8, marginBottom: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDarkMode ? '#94a3b8' : '#666' }}>Desde:</Text>
                                    <TextInput
                                        style={{ backgroundColor: isDarkMode ? '#334155' : 'white', color: isDarkMode ? '#e2e8f0' : 'black', borderRadius: 4, paddingHorizontal: 5, height: 35, fontSize: 12, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#DDD' }}
                                        placeholder="DD/MM/AAAA"
                                        placeholderTextColor={isDarkMode ? '#94a3b8' : '#999'}
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
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDarkMode ? '#94a3b8' : '#666' }}>Hasta:</Text>
                                    <TextInput
                                        style={{ backgroundColor: isDarkMode ? '#334155' : 'white', color: isDarkMode ? '#e2e8f0' : 'black', borderRadius: 4, paddingHorizontal: 5, height: 35, fontSize: 12, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#DDD' }}
                                        placeholder="DD/MM/AAAA"
                                        placeholderTextColor={isDarkMode ? '#94a3b8' : '#999'}
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
                                            backgroundColor: isDarkMode ? '#1e293b' : '#F9FAFB',
                                            padding: 12,
                                            marginBottom: 8,
                                            borderRadius: 8,
                                            borderLeftWidth: 3,
                                            borderLeftColor: '#2563EB'
                                        }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#e2e8f0' : '#374151' }}>{new Date(g.fecha).toLocaleDateString()}</Text>
                                                <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669' }}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(g.precio)}</Text>
                                            </View>

                                            <Text style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#6B7280', marginTop: 4 }}>
                                                {g.tipoHora?.nombre || g.tipoRecargo?.nombre || g.rubro?.nombre || 'Gasto General'}
                                            </Text>

                                            {/* INFO EXTRA DE USUARIO Y PROVEEDOR */}
                                            {g.usuario?.nombre && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <Text style={{ fontSize: 12 }}>👤 </Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#4B5563' }}>{g.usuario.nombre}</Text>
                                                </View>
                                            )}
                                            {g.proveedor?.nombre && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Text style={{ fontSize: 12 }}>🏢 </Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#4B5563' }}>{g.proveedor.nombre}</Text>
                                                </View>
                                            )}
                                            {g.maquina?.nombre && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Text style={{ fontSize: 12 }}>⚙️ </Text>
                                                    <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#4B5563' }}>{g.maquina.nombre}</Text>
                                                </View>
                                            )}

                                            {g.nota && <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4, color: isDarkMode ? '#64748b' : '#666' }}>"{g.nota}"</Text>}

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
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
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
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
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
const getStyles = (isDarkMode, colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: isDarkMode ? '#0f172a' : '#1E3A5F', 
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: isDarkMode ? '#1e293b' : '#152A45',
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
    tabIcon: {
        marginRight: 4,
        fontSize: 14,
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
        fontSize: 13,
    },
    activeTabText: {
        color: '#FFF',
    },
    contentContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    filters: {
        flexDirection: 'row',
    },
    picker: {
        width: 110,
        height: 40,
        color: colors.text,
        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
    },
    advancedFilters: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 15,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'center',
    },
    filterLabel: {
        fontWeight: 'bold',
        color: colors.subText,
        marginRight: 5,
    },
    filterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    filterPicker: {
        height: 40,
        width: 180,
        borderWidth: 0,
        backgroundColor: isDarkMode ? '#1e293b' : 'transparent',
        color: colors.text,
    },
    filterInput: {
        height: 40,
        paddingHorizontal: 10,
        minWidth: 120,
        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
        color: colors.text,
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
        backgroundColor: isDarkMode ? '#1e3a8a' : '#DBEAFE',
    },
    gastadoCard: {
        backgroundColor: isDarkMode ? '#7f1d1d' : '#FEE2E2',
    },
    restanteCard: {
        backgroundColor: isDarkMode ? '#064e3b' : '#D1FAE5',
    },
    summaryLabel: {
        fontSize: 12,
        color: isDarkMode ? '#cbd5e1' : '#4B5563',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDarkMode ? '#f8fafc' : '#1F2937',
        marginTop: 4,
    },
    addButton: {
        backgroundColor: colors.primary,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonSmall: {
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    emptyText: {
        color: colors.subText,
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
    },
    gastoCard: {
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        elevation: 2,
    },
    gastoTipo: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        flex: 1,
    },
    gastoPrecio: {
        fontSize: 20,
        fontWeight: 'bold',
        color: isDarkMode ? '#10b981' : '#059669',
    },
    gastoRubro: {
        fontSize: 14,
        color: colors.subText,
        marginBottom: 10,
    },
    gastoDetail: {
        fontSize: 14,
        color: colors.text,
    },
    gastoNota: {
        fontSize: 14,
        color: colors.subText,
        fontStyle: 'italic',
        marginTop: 10,
    },
    editCardButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: isDarkMode ? '#1e293b' : '#EBF5FF',
        borderRadius: 6,
    },
    editCardButtonText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '500',
    },
    itemCard: {
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 20,
        width: '95%',
        maxWidth: 600,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalContentSmall: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 4,
        marginTop: 12,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        backgroundColor: isDarkMode ? '#1e293b' : '#F9FAFB',
        overflow: 'hidden',
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: isDarkMode ? '#1e293b' : '#F9FAFB',
        color: colors.text,
    },
    inputDisabled: {
        backgroundColor: isDarkMode ? '#0f172a' : '#E5E7EB',
        color: colors.subText,
    },
    cancelButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        color: colors.subText,
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    budgetContainer: {
        backgroundColor: isDarkMode ? '#1e293b' : '#F0F9FF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDarkMode ? '#334155' : '#BAE6FD',
    },
    budgetTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: isDarkMode ? '#38bdf8' : '#0369A1',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: isDarkMode ? '#332101' : '#FFF7ED',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isDarkMode ? '#92400e' : '#FDBA74'
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
        backgroundColor: isDarkMode ? '#1e293b' : 'white'
    },
    checkboxLabel: {
        fontSize: 14,
        color: isDarkMode ? '#fdba74' : '#9A3412',
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
        backgroundColor: isDarkMode ? '#451a1a' : '#FEF2F2',
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
        backgroundColor: isDarkMode ? '#1e293b' : '#E5E7EB',
        paddingHorizontal: 12,
        borderRadius: 6,
        height: 40,
        borderWidth: 1,
        borderColor: isDarkMode ? '#334155' : '#D1D5DB'
    },
    checkboxFilterActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706'
    },
    excesoCard: {
        backgroundColor: isDarkMode ? '#7f1d1d' : '#FEE2E2',
    },
    clearFilterBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    clearFilterText: {
        color: isDarkMode ? '#94a3b8' : '#6B7280',
        fontSize: 16,
        fontWeight: 'bold',
    },
    gastoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    gastoDetails: {
        marginTop: 4,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: isDarkMode ? '#334155' : '#E5E7EB',
        paddingTop: 10,
    },
    deleteButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: isDarkMode ? '#3b1111' : '#FEF2F2',
        borderRadius: 6,
    },
    deleteButtonText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '500',
    },
    itemInfo: {
        flex: 1,
    },
    itemSubDetail: {
        fontSize: 12,
        color: colors.subText,
        marginTop: 2,
    },
    itemActions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    editButton: {
        fontSize: 18,
    },
    deleteButtonIcon: {
        fontSize: 18,
    },
    checkboxChecked: {
        backgroundColor: '#F97316',
        borderColor: '#F97316',
    },
    checkboxCheck: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 20,
    },
});

const getGrafStyles = (isDarkMode, colors) => StyleSheet.create({
    summaryCard: {
        backgroundColor: isDarkMode ? '#1e293b' : '#F0F9FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDarkMode ? '#334155' : '#BAE6FD',
        alignItems: 'center',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: isDarkMode ? '#38bdf8' : '#0369A1',
    },
    summarySubtitle: {
        fontSize: 14,
        color: colors.subText,
        marginTop: 4,
    },
    chartSection: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
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
        color: isDarkMode ? '#94a3b8' : '#4B5563',
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: isDarkMode ? '#334155' : '#E5E7EB',
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
        color: isDarkMode ? '#e2e8f0' : '#1F2937',
        textAlign: 'right',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: isDarkMode ? '#1e3a5f' : '#1E3A5F',
        borderRadius: 4,
        paddingVertical: 8,
        marginBottom: 4,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: isDarkMode ? '#334155' : '#E5E7EB',
    },
    tableRowAlt: {
        backgroundColor: isDarkMode ? '#1e293b' : '#F9FAFB',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
        color: isDarkMode ? '#cbd5e1' : '#1F2937',
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
        borderColor: isDarkMode ? '#334155' : '#E5E7EB',
    },
    cardLabel: {
        fontSize: 12,
        color: isDarkMode ? '#94a3b8' : '#6B7280',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    progressBarContainer: {
        height: 20,
        backgroundColor: isDarkMode ? '#334155' : '#E5E7EB',
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
        color: isDarkMode ? '#94a3b8' : '#6B7280',
    },
    // Detailed Rubro Report Styles
    rubroReportRow: { marginBottom: 16 },
    rubroReportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rubroReportName: { fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#e2e8f0' : '#374151' },
    rubroReportStatus: { fontSize: 12, fontWeight: '500' },
    rubroProgressBarContainer: { height: 12, backgroundColor: isDarkMode ? '#334155' : '#E5E7EB', borderRadius: 6, overflow: 'hidden' },
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
// ===================== PRODUCTOS TAB =====================
function ProductosTab() {
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [referencia, setReferencia] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [medida, setMedida] = useState('');
    const [rubroId, setRubroId] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await mantenimientoApi.getMaestros();
            setItems(data.productos || []);
            setRubros(data.rubros || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setReferencia(''); setDescripcion(''); setMedida(''); setRubroId(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setReferencia(item.referencia || ''); setDescripcion(item.descripcion || ''); setMedida(item.medida || ''); setRubroId(item.rubroId?.toString() || ''); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim() || !rubroId) { Alert.alert('Error', 'Complete campos obligatorios'); return; }
        try {
            setSaving(true);
            const prodData = { nombre, referencia, descripcion, medida, rubroId: parseInt(rubroId), activo: true };
            if (editItem) {
                await mantenimientoApi.updateProducto(editItem.id, { ...prodData, id: editItem.id });
                Alert.alert('Éxito', 'Producto actualizado');
            } else {
                await mantenimientoApi.createProducto(prodData);
                Alert.alert('Éxito', 'Producto creado');
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
                await mantenimientoApi.deleteProducto(id);
                Alert.alert('Éxito', 'Producto eliminado');
                loadData();
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar este producto?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar este producto?', [
                { text: 'Cancelar' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📦 Productos</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.length === 0 ? <Text style={styles.emptyText}>No hay productos registrados.</Text> : items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre} {item.referencia ? `(${item.referencia})` : ''}</Text>
                            <Text style={styles.itemSubDetail}>Rubro: {item.rubroNombre || rubros.find(r => r.id === item.rubroId)?.nombre || 'Desconocido'}</Text>
                            <Text style={styles.itemSubDetail}>Medida: {item.medida || 'N/A'}</Text>
                            {item.descripcion ? <Text style={{fontSize: 12, color: isDarkMode ? '#94a3b8' : '#666', fontStyle: 'italic'}}>{item.descripcion}</Text> : null}
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
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Producto</Text>
                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del producto" />
                    <Text style={styles.label}>Referencia</Text>
                    <TextInput style={styles.input} value={referencia} onChangeText={setReferencia} placeholder="Ref. única (opcional)" />
                    <Text style={styles.label}>Descripción</Text>
                    <TextInput style={[styles.input, styles.textArea]} value={descripcion} onChangeText={setDescripcion} placeholder="Detalles del producto..." multiline numberOfLines={3} />
                    <Text style={styles.label}>Medida *</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={medida} onValueChange={setMedida}>
                            <Picker.Item label="Seleccione..." value="" />
                            {['Cc', 'Grs', 'Gal', 'Uni', 'Kg', 'Mts', 'ml'].map(m => <Picker.Item key={m} label={m} value={m} />)}
                        </Picker>
                    </View>
                    <Text style={styles.label}>Rubro *</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={rubroId} onValueChange={setRubroId}>
                            <Picker.Item label="Seleccione Rubro..." value="" />
                            {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                        </Picker>
                    </View>
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
    const { colors: _c, isDarkMode: _d } = useTheme(); const colors = lightColors; const isDarkMode = false;
    const styles = getStyles(isDarkMode, colors);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);

    // Period Filters
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '',
        productoId: '',
        proveedorId: '',
        cantidad: '',
        valorUnitario: '',
        precio: '',
        descripcion: ''
    });
    const [saving, setSaving] = useState(false);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
    const MESES = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    const MEDIDAS = ['Cc', 'Grs', 'Gal', 'Uni', 'Kg', 'Mts', 'ml'];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [itemsData, maestros] = await Promise.all([
                mantenimientoApi.getCotizaciones(anio, mes),
                mantenimientoApi.getMaestros()
            ]);
            setItems(itemsData);
            setRubros(maestros.rubros || []);
            setProveedores(maestros.proveedores || []);
            setProductos(maestros.productos || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = () => {
        setEditItem(null);
        setFormData({
            rubroId: '',
            productoId: '',
            proveedorId: '',
            cantidad: '',
            valorUnitario: '',
            precio: '',
            descripcion: ''
        });
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            rubroId: item.rubroId?.toString() || '',
            productoId: item.productoId?.toString() || '',
            proveedorId: item.proveedorId?.toString() || '',
            cantidad: item.cantidad?.toString() || '',
            valorUnitario: item.valorUnitario?.toString() || '',
            precio: item.precioCotizado?.toString() || '',
            descripcion: item.descripcion || ''
        });
        setShowModal(true);
    };

    // Auto-calculate total
    useEffect(() => {
        const cant = parseFloat(formData.cantidad) || 0;
        const valU = parseFloat(formData.valorUnitario) || 0;
        if (cant && valU) {
            const total = cant * valU;
            setFormData(prev => ({ ...prev, precio: total.toString() }));
        }
    }, [formData.cantidad, formData.valorUnitario]);

    const handleSave = async () => {
        if (!formData.rubroId || !formData.proveedorId || !formData.precio) { Alert.alert('Error', 'Complete campos obligatorios'); return; }
        try {
            setSaving(true);
            const data = {
                rubroId: parseInt(formData.rubroId),
                productoId: formData.productoId ? parseInt(formData.productoId) : null,
                proveedorId: parseInt(formData.proveedorId),
                cantidad: formData.cantidad ? parseFloat(formData.cantidad) : null,
                valorUnitario: formData.valorUnitario ? parseFloat(formData.valorUnitario) : null,
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

    const filteredProductos = productos.filter(p => p.rubroId.toString() === formData.rubroId);

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
                                <Text style={styles.itemName}>{item.rubroNombre} {item.productoNombre ? `> ${item.productoNombre}` : ''}</Text>
                                <Text style={styles.itemSubDetail}>{item.proveedorNombre}</Text>
                                {item.cantidad && item.valorUnitario && (
                                    <Text style={styles.itemSubDetail}>{item.cantidad} {item.productoMedida || item.medida} x {formatCurrency(item.valorUnitario)}</Text>
                                )}
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669' }}>{formatCurrency(item.precioCotizado)}</Text>
                                {item.descripcion && <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#666' }}>{item.descripcion}</Text>}
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
                            <Picker selectedValue={formData.rubroId} onValueChange={v => setFormData(p => ({ ...p, rubroId: v, productoId: '' }))}>
                                <Picker.Item label="Seleccione Rubro..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>

                        <Text style={styles.label}>Producto</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.productoId} onValueChange={v => setFormData(p => ({ ...p, productoId: v }))}>
                                <Picker.Item label="Seleccione Producto..." value="" />
                                {filteredProductos.map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                            </Picker>
                        </View>

                        {formData.productoId ? (
                            <View style={{ backgroundColor: isDarkMode ? '#111827' : '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                                <Text style={{ fontSize: 13, color: isDarkMode ? '#9ca3af' : '#6b7280', fontWeight: 'bold' }}>Detalles del Producto:</Text>
                                <Text style={{ fontSize: 14, color: isDarkMode ? '#e5e7eb' : '#374151' }}>
                                    <Text style={{ fontWeight: 'bold' }}>Ref:</Text> {productos.find(p => p.id.toString() === formData.productoId)?.referencia || 'N/A'}
                                </Text>
                                <Text style={{ fontSize: 14, color: isDarkMode ? '#e5e7eb' : '#374151', marginTop: 4 }}>
                                    <Text style={{ fontWeight: 'bold' }}>Desc:</Text> {productos.find(p => p.id.toString() === formData.productoId)?.descripcion || 'Sin descripción'}
                                </Text>
                            </View>
                        ) : null}

                        <Text style={styles.label}>Proveedor *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.proveedorId} onValueChange={v => setFormData(p => ({ ...p, proveedorId: v }))}>
                                <Picker.Item label="Seleccione Proveedor..." value="" />
                                {proveedores.map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                            </Picker>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Medida</Text>
                                <TextInput style={[styles.input, styles.inputDisabled]} value={productos.find(p => p.id.toString() === formData.productoId)?.medida || 'N/A'} editable={false} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Cantidad</Text>
                                <TextInput style={styles.input} value={formData.cantidad} onChangeText={t => setFormData(p => ({ ...p, cantidad: t }))} keyboardType="numeric" placeholder="0" />
                            </View>
                        </View>

                        <Text style={styles.label}>Valor Unitario</Text>
                        <TextInput style={styles.input} value={formData.valorUnitario} onChangeText={t => setFormData(p => ({ ...p, valorUnitario: t }))} keyboardType="numeric" placeholder="$ 0" />

                        <Text style={styles.label}>Precio Total (Auto) *</Text>
                        <TextInput style={[styles.input, styles.inputDisabled]} value={formData.precio} editable={false} placeholder="$ 0" />

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
