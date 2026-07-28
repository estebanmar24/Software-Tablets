/**
 * Planeación Gastos Screen
 * Based on TalleresGastosScreen pattern (2-level: Rubro → Proveedor)
 * WITHOUT overtime/recargo/personal logic
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as planeacionApi from '../services/planeacionApi';
import { ExpenseHistoryModal } from '../components/ExpenseHistoryModal';
import MultiRubroPicker from '../components/MultiRubroPicker';
import { getProveedorRubroIds, proveedorMatchesRubro, getProveedorRubrosLabel } from '../utils/proveedorRubros';
import MedioPagoGastoControls, {
    medioPagoToFlags,
    flagsToMedioPago,
    MedioPagoBadge,
    ALERT_MEDIO_PAGO_TITULO,
    ALERT_MEDIO_PAGO_MENSAJE
} from '../components/MedioPagoGastoControls';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import PlaneacionPersonalScreen from './PlaneacionPersonalScreen';
import PlaneacionAdjuntosTab from '../components/PlaneacionAdjuntosTab';
import { parseMontoInput, GastoListaPrecios } from '../utils/gastoPrecioForm';
import { gastoPermiteEdicionTrasContabilidad } from '../utils/gastoEditPermission';
import { anioMesFromFecha } from '../utils/gastoPeriodo';
import { resolveOvertimeShiftContext, pickDaySchedulesFromVersion, addDayScheduleCutPoints, isWithinOrdinaryShift, resolveLunchDiscountHours, appendLunchInfoLine } from '../utils/overtimeLunch';
import { produccionApi } from '../services/produccionApi';
import { calcValorHoraLabor } from '../utils/laborHorasExtras';
import GastoAutorizacionBloque from '../components/GastoAutorizacionBloque';
import GastosCapturaBodyScroll from '../components/GastosCapturaBodyScroll';
import { debeMostrarCamposMonto } from '../utils/gastoAutorizacionIntegracion';
import { MODULOS_GASTO } from '../services/gastosAutorizacionApi';

const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },

    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'cotizaciones', label: 'Cotizaciones', icon: '📝' },
    { key: 'proveedores', label: 'Proveedores', icon: '🏢' },
    { key: 'personal', label: 'Personal', icon: '👥' },
    { key: 'adjuntos', label: 'Adjuntos', icon: '📎' },
];

const MESES = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

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

// Festivos Colombia 2025-2026
const COLOMBIAN_HOLIDAYS = [
    // 2025
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18', '2025-05-01',
    '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18',
    '2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25',
    // 2026
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01',
    '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-13', '2026-07-20', '2026-08-07',
    '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'
];

const getEstadoColor = (estado) => {
    switch (estado) {
        case 'Pagado': return '#10B981';
        case 'Entregado': return '#3B82F6';
        case 'Montado': return '#6B7280';
        default: return '#6B7280';
    }
};

// ===================== MAIN COMPONENT =====================
export default function PlaneacionGastosScreen({ navigation, displayName }) {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('gastos');

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsContainer}
            >
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

            {activeTab === 'gastos' && <GastosTab displayName={displayName} />}
            {activeTab === 'graficas' && <GraficasTab />}

            {activeTab === 'rubros' && <RubrosTab />}
            {activeTab === 'cotizaciones' && <CotizacionesTab />}
            {activeTab === 'proveedores' && <ProveedoresTab />}
            {activeTab === 'personal' && <PlaneacionPersonalScreen />}
            {activeTab === 'adjuntos' && <PlaneacionAdjuntosTab />}
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab({ displayName }) {
    const { colors: themeColors } = useTheme();
    const autorizacionActivaRef = useRef(null);
    const [authRefreshKey, setAuthRefreshKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [rubros, setRubros] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [tiposHorasRecargos, setTiposHorasRecargos] = useState({ tiposHora: [], tiposRecargo: [] });
    const [gastos, setGastos] = useState([]);
    const [fileServerUrl, setFileServerUrl] = useState('');

    useEffect(() => {
        const init = async () => {
            const url = await planeacionApi.getFileUrl();
            setFileServerUrl(url);
        };
        init();
    }, []);
    const [resumen, setResumen] = useState(null);
    const [resumenAnual, setResumenAnual] = useState(null);
    const [presupuestoInfo, setPresupuestoInfo] = useState(null);
    const [filterRubro, setFilterRubro] = useState('');
    const [filterFecha, setFilterFecha] = useState('');
    const [cotizaciones, setCotizaciones] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryGasto, setSelectedHistoryGasto] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '',
        proveedorId: '',
        numeroFactura: '',
        precio: '',
        precioBase: '',
        precioIva: '',
        fecha: new Date().toISOString().split('T')[0],
        observaciones: '',
        facturaPdfUrl: '',
        numeroOP: '',
        esPendiente: false,
        esSolicitudCredito: false,
        tipoGasto: 'normal',
        personalId: '',
        tipoHoraId: '',
        tipoRecargoId: '',
        cantidadHoras: '',
        horaInicio: '',
        horaFin: '',
        desdeAutorizacion: false
    });
    const [breakdown, setBreakdown] = useState([]);
    const [jornadaOt, setJornadaOt] = useState(null);
    const [filterPending, setFilterPending] = useState(false);
    const [filterProveedor, setFilterProveedor] = useState('');
    const [filterNumeroFactura, setFilterNumeroFactura] = useState('');
    const [isLegalizing, setIsLegalizing] = useState(false);
    const [filterCredit, setFilterCredit] = useState(false);
    const [medioPago, setMedioPago] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploadingFactura, setUploadingFactura] = useState(false);
    const [facturaArchivoNombre, setFacturaArchivoNombre] = useState('');
    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await produccionApi.getParametrosJornadaOt(formData.fecha);
                if (!cancelled) setJornadaOt(data);
            } catch (e) {
                if (!cancelled) setJornadaOt(null);
            }
        };
        if (formData.fecha) load();
        return () => { cancelled = true; };
    }, [formData.fecha]);

    const getFileNameFromUrl = (url) => {
        if (!url) return '';
        try {
            const clean = String(url).split('?')[0];
            const name = clean.split('/').pop();
            return name || '';
        } catch {
            return '';
        }
    };

    const filteredGastos = useMemo(() => {
        return gastos.filter(g => {
            if (filterRubro && g.rubroId?.toString() !== filterRubro) return false;
            if (filterFecha) {
                let searchDate = '';
                if (filterFecha.includes('-')) searchDate = filterFecha;
                else if (filterFecha.includes('/')) {
                    const parts = filterFecha.split('/');
                    if (parts.length === 3) searchDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else {
                    const formattedDate = formatDate(g.fecha);
                    if (!formattedDate.includes(filterFecha)) return false;
                    return true;
                }
                if (searchDate && !g.fecha.startsWith(searchDate)) return false;
            }

            // Filtro Proveedor
            if (filterProveedor && g.proveedorId?.toString() !== filterProveedor) return false;

            // Filtro Número de Factura
            if (filterNumeroFactura && !(g.numeroFactura || '').toLowerCase().includes(filterNumeroFactura.toLowerCase())) return false;

            // Filtro Pendientes
            if (filterPending && !g.esPendiente) return false;

            // Filtro Solicitud de Crédito
            if (filterCredit && !g.esSolicitudCredito) return false;

            return true;
        });
    }, [gastos, filterRubro, filterFecha, filterPending, filterProveedor, filterNumeroFactura, filterCredit]);

    const rubrosConGastos = useMemo(() => {
        const idsConGastos = new Set(gastos.map(g => g.rubroId));
        return rubros.filter(r => idsConGastos.has(r.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [gastos, rubros]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rubrosData, proveedoresData, gastosData, graficasData, cotData, personalData, thrData] = await Promise.all([
                planeacionApi.getRubros(),
                planeacionApi.getProveedores(),
                planeacionApi.getGastos(anio, mes),
                planeacionApi.getGraficas(anio, mes),
                planeacionApi.getCotizaciones(null, anio, mes),
                planeacionApi.getPersonal(),
                planeacionApi.getTiposHorasRecargos()
            ]);
            setRubros(rubrosData);
            setProveedores(proveedoresData);
            setCotizaciones(cotData);
            setPersonal(personalData);
            setTiposHorasRecargos(thrData);
            const sortedGastos = (gastosData || []).sort((a, b) => {
                const dateA = new Date(a.fecha); const dateB = new Date(b.fecha);
                if (dateB - dateA !== 0) return dateB - dateA;
                return b.id - a.id;
            });
            setGastos(sortedGastos);
            setResumen(graficasData);
            try {
                const anualData = await planeacionApi.getGraficasAnual(anio);
                setResumenAnual(anualData);
            } catch (e) { console.error('Error loading annual data:', e); }
        } catch (error) {
            console.error('Error loading data:', error);
            showAlert('Error', `Error cargando datos: ${error.message}`);
        } finally { setLoading(false); }
    }, [anio, mes]);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-fill price from cotización
    useEffect(() => {
        if (!formData.rubroId || !formData.proveedorId) return;
        const quote = cotizaciones.find(c =>
            c.rubroId.toString() === formData.rubroId && c.proveedorId.toString() === formData.proveedorId
        );
        if (quote && !formData.numeroFactura) {
            const q = quote.precioCotizado != null ? String(quote.precioCotizado) : '';
            setFormData(prev => ({ ...prev, precioBase: q, precioIva: '0', precio: q }));
        }
    }, [formData.rubroId, formData.proveedorId, cotizaciones, formData.numeroFactura]);

    // Derived state for conditional fields
    const isInsumos = useMemo(() => {
        const selectedRubro = rubros.find(r => r.id?.toString() === formData.rubroId);
        return selectedRubro && (selectedRubro.nombre.toLowerCase().includes('insumo') || selectedRubro.nombre.toLowerCase().includes('materia prima'));
    }, [formData.rubroId, rubros]);

    const isHorasExtras = useMemo(() => {
        const selectedRubro = rubros.find(r => r.id?.toString() === formData.rubroId);
        if (!selectedRubro) return false;
        const name = selectedRubro.nombre.toLowerCase();
        return name.includes('horas extras') || name.includes('hora extra') || name.includes('horas adiccionales') || name.includes('horas adicionales');
    }, [formData.rubroId, rubros]);

    const isRecargo = useMemo(() => {
        const selectedRubro = rubros.find(r => r.id?.toString() === formData.rubroId);
        if (!selectedRubro) return false;
        const name = selectedRubro.nombre.toLowerCase();
        return name.includes('recargo');
    }, [formData.rubroId, rubros]);

    // Budget info on rubro change
    useEffect(() => {
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        if (selectedRubro) {
            // Si mes es 0 (Todo el año), usamos resumenAnual como fuente principal
            const source = (mes === 0 && resumenAnual) ? resumenAnual : resumen;

            // Buscar info en el source seleccionado
            const info = source?.porRubro?.find(r => r.rubroId == selectedRubro.id || r.rubro === selectedRubro.nombre);
            const infoAnual = resumenAnual?.porRubro?.find(r => r.rubroId == selectedRubro.id || r.rubro === selectedRubro.nombre);

            if (mes == 0) {
                // Vista Anual: Presupuesto es el Anual, Gastado es el Anual
                setPresupuestoInfo({
                    nombre: selectedRubro.nombre,
                    presupuestoAnual: infoAnual?.presupuestoAnual || 0, // Visual reference
                    presupuestoMensual: infoAnual?.presupuestoAnual || 0, // In this context "Mensual" label usually holds the target budget
                    gastadoMes: infoAnual?.gastadoAnual || infoAnual?.gastado || 0, // Prefer GastadoAnual
                    restanteMes: (infoAnual?.presupuestoAnual || 0) - (infoAnual?.gastadoAnual || infoAnual?.gastado || 0)
                });
            } else {
                // Vista Mensual Normal
                setPresupuestoInfo({
                    nombre: selectedRubro.nombre,
                    presupuestoAnual: infoAnual?.presupuestoAnual || 0,
                    presupuestoMensual: info?.presupuesto || 0,
                    gastadoMes: info?.gastado || 0,
                    restanteMes: (info?.presupuesto || 0) - (info?.gastado || 0)
                });
            }
        } else { setPresupuestoInfo(null); }
    }, [formData.rubroId, rubros, resumen, resumenAnual, mes]);

    const resetForm = () => {
        setEditItem(null);
        setFormData({
            rubroId: '', proveedorId: '', numeroFactura: '', precio: '', precioBase: '', precioIva: '',
            fecha: new Date().toISOString().split('T')[0], observaciones: '', facturaPdfUrl: '', numeroOP: '',
            esPendiente: false,
            esSolicitudCredito: false,
            tipoGasto: 'normal', personalId: '', tipoHoraId: '', tipoRecargoId: '', cantidadHoras: '',
            horaInicio: '', horaFin: '', desdeAutorizacion: false
        });
        setBreakdown([]);
        setIsLegalizing(false);
        setFacturaArchivoNombre('');
        setMedioPago(null);
    };

    const handleAdd = () => {
        resetForm();
        autorizacionActivaRef.current = null;
        setShowModal(true);
    };

    const handleRegistrarDirecto = (rubroId) => {
        autorizacionActivaRef.current = null;
        resetForm();
        setFormData((prev) => ({ ...prev, rubroId: String(rubroId) }));
        setShowModal(true);
    };

    const handleRegistrarDesdeAutorizacion = (sol) => {
        autorizacionActivaRef.current = sol;
        setEditItem(null);
        setIsLegalizing(false);
        resetForm();
        const fecha = sol.fechaAproximada?.split('T')[0] || new Date().toISOString().split('T')[0];
        setFormData({
            rubroId: sol.rubroId ? String(sol.rubroId) : '',
            proveedorId: sol.proveedorId ? String(sol.proveedorId) : '',
            numeroFactura: '',
            precio: String(sol.cantidad ?? ''),
            precioBase: String(sol.cantidad ?? ''),
            precioIva: '0',
            fecha,
            observaciones: sol.razon || '',
            facturaPdfUrl: '',
            numeroOP: '',
            esPendiente: false,
            esSolicitudCredito: sol.esSolicitudCredito || false,
            tipoGasto: 'normal',
            personalId: '',
            tipoHoraId: '',
            tipoRecargoId: '',
            cantidadHoras: '',
            horaInicio: '',
            horaFin: '',
            desdeAutorizacion: true,
        });
        setMedioPago(flagsToMedioPago(!!sol.esSolicitudCredito, !!sol.esEfectivo));
        setShowModal(true);
    };

    const handleUpdateEstado = async (gasto) => {
        let nuevoEstado = '';
        if (gasto.estado === 'Montado') nuevoEstado = 'Entregado';
        else if (gasto.estado === 'Entregado') nuevoEstado = 'Pagado';
        else if (gasto.estado === 'Pagado') nuevoEstado = 'Montado';
        else nuevoEstado = 'Montado';

        const confirmMsg = `¿Cambiar estado de "${gasto.estado}" a "${nuevoEstado}"?`;

        const executeUpdate = async () => {
            try {
                setLoading(true);
                // Clonamos el gasto y actualizamos el estado
                const updatedGasto = { ...gasto, estado: nuevoEstado };
                // Limpiamos propiedades de navegación para evitar problemas de serialización
                delete updatedGasto.rubroNombre;
                delete updatedGasto.proveedorNombre;
                delete updatedGasto.proveedorNit;
                delete updatedGasto.personalNombre;
                delete updatedGasto.personalCedula;
                delete updatedGasto.personalSalario;
                delete updatedGasto.tipoHoraNombre;
                delete updatedGasto.tipoHoraFactor;
                delete updatedGasto.tipoRecargoNombre;
                delete updatedGasto.tipoRecargoFactor;
                delete updatedGasto.creadoPorNombre;

                await planeacionApi.updateGasto(gasto.id, updatedGasto);
                await loadData();
                showAlert('Éxito', `Estado actualizado a ${nuevoEstado}`);
            } catch (error) {
                console.error('Error updating estado:', error);
                showAlert('Error', 'No se pudo actualizar el estado');
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) executeUpdate();
        } else {
            Alert.alert('Confirmar Cambio', confirmMsg, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Confirmar', onPress: executeUpdate }
            ]);
        }
    };

    const handleEdit = (gasto) => {
        if (!gastoPermiteEdicionTrasContabilidad(gasto)) {
            showAlert('Acceso Denegado', `No se puede editar un gasto en estado ${gasto.estado} (ya consta como legalizado).`);
            return;
        }
        setEditItem(gasto);
        let tipoGasto = 'normal';
        if (gasto.tipoHoraId) tipoGasto = 'extra';
        else if (gasto.tipoRecargoId) tipoGasto = 'recargo';

        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            numeroFactura: gasto.numeroFactura || '',
            precio: gasto.precio?.toString() || '',
            precioBase: gasto.precioBase != null ? String(gasto.precioBase) : '',
            precioIva: gasto.precioIva != null ? String(gasto.precioIva) : '',
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            observaciones: gasto.observaciones || '',
            facturaPdfUrl: gasto.facturaPdfUrl || '',
            numeroOP: gasto.numeroOP || '',
            esPendiente: gasto.esPendiente || false,
            tipoGasto: tipoGasto,
            personalId: gasto.personalId?.toString() || '',
            tipoHoraId: gasto.tipoHoraId?.toString() || '',
            tipoRecargoId: gasto.tipoRecargoId?.toString() || '',
            cantidadHoras: gasto.cantidadHoras?.toString() || '',
            esSolicitudCredito: gasto.esSolicitudCredito || false,
            horaInicio: gasto.horaInicio || gasto.HoraInicio || '',
            horaFin: gasto.horaFin || gasto.HoraFin || '',
        });
        setMedioPago(tipoGasto === 'normal' ? flagsToMedioPago(!!gasto.esSolicitudCredito, !!gasto.esEfectivo) : null);
        setIsLegalizing(false);
        setFacturaArchivoNombre(getFileNameFromUrl(gasto.facturaPdfUrl));
        setShowModal(true);
    };

    const handleLegalizar = (gasto) => {
        setEditItem(gasto);
        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            numeroFactura: '', // Obligar a ponerla
            precio: '', // Obligar a ponerlo
            precioBase: '',
            precioIva: '',
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            observaciones: gasto.observaciones || '',
            facturaPdfUrl: null,
            numeroOP: gasto.numeroOP || '',
            esPendiente: false, // Al guardar esto ya no será pendiente
            esSolicitudCredito: gasto.esSolicitudCredito || false,
            tipoGasto: 'normal', personalId: '', tipoHoraId: '', tipoRecargoId: '', cantidadHoras: ''
        });
        setMedioPago(flagsToMedioPago(!!gasto.esSolicitudCredito, !!gasto.esEfectivo));
        setIsLegalizing(true);
        setFacturaArchivoNombre('');
        setShowModal(true);
    };

    const handlePickFacturaPdf = async () => {
        try {
            setUploadingFactura(true);
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets?.[0];
            if (!file) return;

            let uploadFile = null;
            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                uploadFile = new File([blob], file.name || `factura-${Date.now()}.pdf`, { type: 'application/pdf' });
            } else {
                uploadFile = {
                    uri: file.uri,
                    name: file.name || `factura-${Date.now()}.pdf`,
                    type: 'application/pdf'
                };
            }

            const uploaded = await planeacionApi.uploadFactura(uploadFile);
            const url = uploaded?.url || '';
            setFormData(prev => ({ ...prev, facturaPdfUrl: url }));
            setFacturaArchivoNombre(file.name || getFileNameFromUrl(url));
        } catch (error) {
            console.error('Error uploading factura PDF:', error);
            showAlert('Error', 'No se pudo subir el documento PDF');
        } finally {
            setUploadingFactura(false);
        }
    };

    // ========== SMART BREAKDOWN (Turno base desde horaInicio) ==========
    // Reglas: L-V = 8h base, Sáb = 4h, Dom/Festivo = 0h (todo es extra)
    // Dentro del turno base + nocturno (19:00-06:00) = Recargo Nocturno
    // Fuera del turno base + diurno = Hora Extra Diurna
    // Fuera del turno base + nocturno = Hora Extra Nocturna
    // Dom/Festivo: todo es Dominical (Diurna o Nocturna)
    const calculateSmartBreakdown = useCallback(() => {
        if (formData.tipoGasto === 'normal') { setBreakdown([]); return; }
        if (!formData.personalId || !formData.horaInicio || !formData.horaFin || !formData.fecha) { setBreakdown([]); return; }
        const worker = personal.find(p => p.id.toString() === formData.personalId);
        if (!worker) { setBreakdown([]); return; }

        const tiposHora = tiposHorasRecargos.tiposHora || [];
        const tiposRecargo = tiposHorasRecargos.tiposRecargo || [];

        const parseDate = (d) => {
            if (!d) return new Date();
            const c = d.trim();
            if (c.includes('/')) { const [day, month, year] = c.split('/'); return new Date(`${year}-${month}-${day}T12:00:00`); }
            return new Date(c + 'T12:00:00');
        };
        const date = parseDate(formData.fecha);
        const formatISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
        const startFull = toMin(formData.horaInicio);
        let endFull = toMin(formData.horaFin);
        if (endFull <= startFull) endFull += 24 * 60;

        const NIGHT_START = 19 * 60, NIGHT_END = 6 * 60;

        // Determinar duración base del turno según el día de INICIO
        const dateISO = formatISO(date);
        const isSunday = date.getDay() === 0;
        const isHoliday = COLOMBIAN_HOLIDAYS.includes(dateISO);
        const isSpecialDayStart = isSunday || isHoliday;
        const isSaturday = date.getDay() === 6;

        const otCtx = resolveOvertimeShiftContext(startFull, endFull, {
            isSpecialDay: isSpecialDayStart,
            isSaturday,
            daySchedules: pickDaySchedulesFromVersion(jornadaOt, date),
        });
        const { lunchWindow: lunchWindowCtx, usesScheduledShift, usesDaySchedule, lunchDiscountHours } = otCtx;

        const breakdownItems = [];

        const addBreakdown = (s, e, typeNameMatch, isHe, isSpecialDay) => {
            if (e <= s) return;
            const duration = (e - s) / 60;
            const list = isHe ? tiposHora : tiposRecargo;
            const search = typeNameMatch.toLowerCase();
            const timeOfDay = search.includes('nocturn') ? 'nocturn' : 'diurn';
            let tipo = list.find(t => { const n = (t.nombre || '').toLowerCase(); const mt = n.includes(timeOfDay); const sp = n.includes('dominical') || n.includes('festivo'); return isSpecialDay ? (sp && mt) : (!sp && mt); });
            if (!tipo && isSpecialDay) tipo = list.find(t => { const n = (t.nombre || '').toLowerCase(); return n.includes('dominical') || n.includes('festivo'); });
            if (!tipo) tipo = list.find(t => (t.nombre || '').toLowerCase().includes(search));
            if (tipo) { const ex = breakdownItems.find(i => i.typeId === tipo.id && i.isHe === isHe); if (ex) ex.hours += duration; else breakdownItems.push({ type: tipo.nombre, typeId: tipo.id, hours: duration, isHe }); }
        };

        // Generar todos los puntos de corte relevantes
        const cutPoints = new Set([startFull, endFull]);
        addDayScheduleCutPoints(cutPoints, otCtx, startFull, endFull);
        [NIGHT_END, NIGHT_START, 1440, NIGHT_END + 1440, NIGHT_START + 1440].forEach(boundary => {
            if (boundary > startFull && boundary < endFull) cutPoints.add(boundary);
        });
        if (lunchWindowCtx) {
            cutPoints.add(lunchWindowCtx.lunchStart);
            cutPoints.add(lunchWindowCtx.lunchEnd);
        }
        const sortedCuts = [...cutPoints].sort((a, b) => a - b);

        // Procesar cada sub-intervalo
        for (let i = 0; i < sortedCuts.length - 1; i++) {
            const s = sortedCuts[i];
            const e = sortedCuts[i + 1];
            if (e <= s) continue;
            if (lunchWindowCtx && s >= lunchWindowCtx.lunchStart && e <= lunchWindowCtx.lunchEnd) continue;

            const mid = (s + e) / 2;
            const actualDate = new Date(date);
            if (mid >= 1440) actualDate.setDate(actualDate.getDate() + 1);
            const actualDateISO = formatISO(actualDate);
            // Para turnos que cruzan medianoche, se respeta la regla del día de inicio del turno.
            const isSpecialDay = isSpecialDayStart;

            const isWithinShift = isWithinOrdinaryShift(mid, otCtx, s);
            const timeInDay = mid % 1440;
            const isNight = timeInDay >= NIGHT_START || timeInDay < NIGHT_END;

            if (isSpecialDay) {
                addBreakdown(s, e, isNight ? 'Dominical Nocturna' : 'Dominical Diurna', true, true);
            } else if (isWithinShift) {
                if (isNight) addBreakdown(s, e, 'Recargo Nocturno', false, false);
            } else {
                addBreakdown(s, e, isNight ? 'Extra Nocturna' : 'Extra Diurna', true, false);
            }
        }

        const formatHours = (h) => {
            const isNegative = h < 0;
            const totalMin = Math.round(Math.abs(h) * 60);
            const hh = Math.floor(totalMin / 60);
            const mm = totalMin % 60;
            return `${isNegative ? '-' : ''}${hh}:${mm.toString().padStart(2, '0')}`;
        };

        // --- COMIDA (solo informativa, no resta de HE) ---
        const totalDurationMin = endFull - startFull;
        const lunchHoursToApply = resolveLunchDiscountHours(
            { lunchWindow: lunchWindowCtx, lunchDiscountHours, usesScheduledShift, usesDaySchedule },
            { totalDurationMin, isSaturday }
        );
        appendLunchInfoLine(breakdownItems, lunchHoursToApply);

        const cleanedBreakdownItems = breakdownItems.filter(item => item.isLunch || item.hours > 0);
        setBreakdown(cleanedBreakdownItems.map(item => ({ ...item, formattedHours: formatHours(item.hours) })));

        // Calcular costo total (EXCLUYE COMIDA informativa)
        let totalCost = 0;
        const salario = parseFloat(worker.salario) || 0;
        const valorHoraBase = calcValorHoraLabor(salario, formData.fecha);
        cleanedBreakdownItems.filter(item => !item.isLunch).forEach(item => {
            const list = item.isHe ? tiposHora : tiposRecargo;
            const tipo = list.find(t => t.id == item.typeId);
            if (tipo) totalCost += valorHoraBase * (parseFloat(tipo.factor) || 1.0) * item.hours;
        });
        const safeTotal = Math.max(0, Math.round(totalCost));
        setFormData(prev => ({ ...prev, precio: safeTotal.toString() }));
    }, [formData.tipoGasto, formData.personalId, formData.horaInicio, formData.horaFin, formData.fecha, personal, tiposHorasRecargos, jornadaOt]);

    useEffect(() => { calculateSmartBreakdown(); }, [calculateSmartBreakdown]);

    const handleSubmit = async () => {
        if (!formData.rubroId) { showAlert('Error', 'Seleccione un Rubro'); return; }
        if (formData.tipoGasto === 'normal' && !medioPago) { showAlert(ALERT_MEDIO_PAGO_TITULO, ALERT_MEDIO_PAGO_MENSAJE); return; }
        if (formData.tipoGasto === 'normal' && !formData.esPendiente && !formData.proveedorId) { showAlert('Error', 'Seleccione un Proveedor (Obligatorio para legalizar)'); return; }

        if (formData.tipoGasto !== 'normal' && (!formData.observaciones || !formData.observaciones.trim())) { showAlert('Error', 'El Detalle es obligatorio para horas extras/recargos'); return; }

        // Validación para Hora Inicio/Fin
        if (formData.tipoGasto !== 'normal') {
            if (!formData.personalId) { showAlert('Error', 'Seleccione un Personal'); return; }
            if (!formData.horaInicio || !formData.horaFin) { showAlert('Error', 'Ingrese Hora Inicio y Hora Fin'); return; }
            if (breakdown.length === 0) { showAlert('Error', 'No se detectaron horas extras/recargos en el intervalo ingresado'); return; }
        }

        if (!formData.esPendiente && formData.tipoGasto === 'normal') {
            if (!formData.numeroFactura || !formData.numeroFactura.trim()) { showAlert('Error', 'El Número de factura es obligatorio'); return; }
            let pb = parseMontoInput(formData.precioBase);
            let pi = parseMontoInput(formData.precioIva);
            if (pb === null || pi === null) { showAlert('Error', 'Ingrese precio base e IVA (el IVA puede ser 0).'); return; }
            if (pb < 0 || pi < 0) { showAlert('Error', 'Precio base e IVA no pueden ser negativos.'); return; }
            if (pb + pi <= 0) { showAlert('Error', 'El total (base + IVA) debe ser mayor a 0.'); return; }
        } else if (formData.tipoGasto !== 'normal') {
            if (!formData.precio || isNaN(parseFloat(formData.precio))) { showAlert('Error', 'El Precio debe ser un número válido'); return; }
        }
        if (formData.esPendiente && formData.tipoGasto === 'normal') {
            let pb = parseMontoInput(formData.precioBase);
            let pi = parseMontoInput(formData.precioIva);
            if (pb === null) pb = 0;
            if (pi === null) pi = 0;
            if (pb < 0 || pi < 0) { showAlert('Error', 'Precio base e IVA no pueden ser negativos.'); return; }
        }

        try {
            setSaving(true);

            // Si hay breakdown (Horas Extras/Recargos con Hora Inicio/Fin), crear múltiples registros
            if (formData.tipoGasto !== 'normal' && breakdown.length > 0 && !editItem) {
                const worker = personal.find(p => p.id.toString() === formData.personalId);
                const salario = parseFloat(worker?.salario) || 0;
                const valorHoraBase = calcValorHoraLabor(salario, formData.fecha);
                const tiposHora = tiposHorasRecargos.tiposHora || [];
                const tiposRecargo = tiposHorasRecargos.tiposRecargo || [];

                const promises = breakdown.filter(item => !item.isLunch).map(item => {
                    const list = item.isHe ? tiposHora : tiposRecargo;
                    const tipo = list.find(t => t.id == item.typeId);
                    const factor = parseFloat(tipo?.factor) || 1.0;
                    const itemPrecio = Math.round(valorHoraBase * factor * item.hours);

                    return planeacionApi.createGasto({
                        rubroId: parseInt(formData.rubroId),
                        proveedorId: null,
                        numeroFactura: '',
                        precio: itemPrecio,
                        fecha: new Date(formData.fecha).toISOString(),
                        observaciones: `Auto-generado (${item.type}): ${formData.observaciones || ''}`,
                        facturaPdfUrl: null,
                        numeroOP: formData.numeroOP || null,
                        ...anioMesFromFecha(formData.fecha),
                        esPendiente: false,
                        personalId: parseInt(formData.personalId),
                        tipoHoraId: item.isHe ? parseInt(item.typeId) : null,
                        tipoRecargoId: !item.isHe ? parseInt(item.typeId) : null,
                        cantidadHoras: parseFloat(item.hours.toFixed(2)),
                        horaInicio: formData.horaInicio || null,
                        horaFin: formData.horaFin || null,
                        esSolicitudCredito: false,
                        esEfectivo: false
                    });
                });
                await Promise.all(promises);
            } else {
                // Lógica estándar de un solo registro
                let pbSave = parseMontoInput(formData.precioBase);
                let piSave = parseMontoInput(formData.precioIva);
                if (formData.tipoGasto === 'normal' && formData.esPendiente) {
                    if (pbSave === null) pbSave = 0;
                    if (piSave === null) piSave = 0;
                }
                const totalNormal = formData.tipoGasto === 'normal' && pbSave !== null && piSave !== null
                    ? pbSave + piSave
                    : (formData.precio ? parseFloat(formData.precio) : 0);
                const gastoData = {
                    rubroId: parseInt(formData.rubroId),
                    proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null,
                    numeroFactura: formData.numeroFactura || '',
                    precio: totalNormal,
                    ...(formData.tipoGasto === 'normal' && pbSave !== null && piSave !== null
                        ? { precioBase: pbSave, precioIva: piSave }
                        : {}),
                    fecha: new Date(formData.fecha).toISOString(),
                    observaciones: formData.observaciones,
                    facturaPdfUrl: formData.facturaPdfUrl,
                    numeroOP: isInsumos ? formData.numeroOP : null,
                    ...anioMesFromFecha(formData.fecha),
                    esPendiente: formData.esPendiente,
                    horaInicio: formData.tipoGasto !== 'normal' ? (formData.horaInicio || null) : null,
                    horaFin: formData.tipoGasto !== 'normal' ? (formData.horaFin || null) : null,
                    ...(formData.tipoGasto === 'normal' ? medioPagoToFlags(medioPago) : { esSolicitudCredito: false, esEfectivo: false }),
                    personalId: formData.personalId ? parseInt(formData.personalId) : null,
                    tipoHoraId: formData.tipoGasto === 'extra' ? parseInt(formData.tipoHoraId) : null,
                    tipoRecargoId: formData.tipoGasto === 'recargo' ? parseInt(formData.tipoRecargoId) : null,
                    cantidadHoras: formData.cantidadHoras ? parseFloat(formData.cantidadHoras) : null
                };

                if (editItem && formData.tipoGasto !== 'normal' && breakdown.length > 0) {
                    const first = breakdown.find(item => !item.isLunch);
                    if (first) {
                        gastoData.tipoHoraId = first.isHe ? parseInt(first.typeId) : null;
                        gastoData.tipoRecargoId = !first.isHe ? parseInt(first.typeId) : null;
                        gastoData.cantidadHoras = parseFloat(first.hours.toFixed(2));
                    }
                }

                // Check quotes
                const quote = cotizaciones.find(c => c.rubroId == gastoData.rubroId && c.proveedorId == gastoData.proveedorId);
                if (quote) {
                    const quotePrice = parseFloat(quote.precioCotizado);
                    if (Math.abs(quotePrice - gastoData.precio) > 1 && Platform.OS === 'web') {
                        if (window.confirm(`Precio diferente a cotización (${formatCurrency(quotePrice)}). ¿Actualizar cotización?`)) {
                            await planeacionApi.updateCotizacion(quote.id, { ...quote, precioCotizado: gastoData.precio });
                        }
                    }
                }

                if (editItem) { await planeacionApi.updateGasto(editItem.id, { ...gastoData, id: editItem.id }); }
                else {
                    const authId = autorizacionActivaRef.current?.id;
                    await planeacionApi.createGasto(gastoData, authId);
                    autorizacionActivaRef.current = null;
                    setAuthRefreshKey((k) => k + 1);
                }
            }

            showAlert('Éxito', editItem ? 'Actualizado' : 'Ingresado', () => { setShowModal(false); resetForm(); loadData(); });
        } catch (error) {
            console.error('Error saving gasto:', error);
            showAlert('Error', 'No se pudo guardar el gasto');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const gasto = gastos.find(g => g.id === id);
        if (gasto && !gastoPermiteEdicionTrasContabilidad(gasto)) {
            showAlert('Acceso Denegado', `No se puede eliminar un gasto en estado ${gasto.estado} (ya consta como legalizado).`);
            return;
        }
        const doDelete = async () => {
            try { await planeacionApi.deleteGasto(id); await loadData(); showAlert('Éxito', 'Gasto eliminado'); }
            catch { showAlert('Error', 'No se pudo eliminar'); }
        };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar gasto?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };

    // Summary cards
    let displayedPresupuesto = (mes == 0 && resumenAnual) ? (resumenAnual.totalPresupuesto || 0) : (resumen?.totalPresupuesto || 0);
    let displayedGastado = (mes == 0 && resumenAnual) ? (resumenAnual.totalGastado || 0) : (resumen?.totalGastado || 0);
    let displayedRestante = (mes == 0 && resumenAnual) ? (resumenAnual.totalRestante || 0) : (resumen?.totalRestante || 0);
    if (filterRubro) {
        const selectedRubroName = rubros.find(r => r.id.toString() === filterRubro)?.nombre;
        if (selectedRubroName && resumen?.porRubro) {
            const rubroData = resumen.porRubro.find(r => r.rubro === selectedRubroName);
            if (rubroData) {
                displayedPresupuesto = rubroData.presupuesto || 0;
                displayedGastado = rubroData.gastado || 0;
                displayedRestante = (rubroData.presupuesto || 0) - (rubroData.gastado || 0);
            } else { displayedPresupuesto = 0; displayedGastado = 0; displayedRestante = 0; }
        }
    }

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>
                        <Picker.Item label="Todo el Año" value={0} />
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
                <View style={styles.advancedFilters}>
                    <Text style={styles.filterLabel}>Filtrar por:</Text>
                    <View style={styles.filterItem}>
                        {Platform.OS === 'web' ? (
                            <input type="date" value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)}
                                style={{ height: 35, border: 'none', borderRadius: 0, padding: '0 8px', fontSize: 13, fontFamily: 'inherit', color: '#374151', outline: 'none', backgroundColor: 'transparent', minWidth: 130 }} />
                        ) : (
                            <TextInput style={styles.filterInput} placeholder="dd/mm/aaaa" placeholderTextColor="#9CA3AF" value={filterFecha}
                                onChangeText={(t) => { if (t.length === 2 && filterFecha.length === 1) t += '/'; if (t.length === 5 && filterFecha.length === 4) t += '/'; if (t.length <= 10) setFilterFecha(t); }} keyboardType="numeric" />
                        )}
                        {filterFecha ? (<TouchableOpacity onPress={() => setFilterFecha('')} style={styles.clearFilterBtn}><Text style={styles.clearFilterText}>✕</Text></TouchableOpacity>) : null}
                    </View>
                    <View style={styles.filterItem}>
                        <Picker selectedValue={filterRubro} onValueChange={(v) => setFilterRubro(v)}
                            style={Platform.OS === 'web' ? { height: 35, width: 160, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: 13 } : styles.filterPicker}>
                            <Picker.Item label="Todos los Rubros" value="" />
                            {rubrosConGastos.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                        </Picker>
                    </View>

                    {/* Filtro Proveedor */}
                    <View style={styles.filterItem}>
                        <Picker selectedValue={filterProveedor} onValueChange={setFilterProveedor}
                            style={Platform.OS === 'web' ? { height: 35, width: 160, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: 13 } : styles.filterPicker}>
                            <Picker.Item label="Todos los Proveedores" value="" />
                            {[...new Map(gastos.filter(g => g.proveedorId && g.proveedorNombre).map(g => [g.proveedorId, { id: g.proveedorId, nombre: g.proveedorNombre }])).values()]
                                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                .map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                        </Picker>
                    </View>

                    {/* Filtro Número de Factura */}
                    <View style={styles.filterItem}>
                        <TextInput
                            style={Platform.OS === 'web'
                                ? { height: 35, border: 'none', borderRadius: 0, padding: '0 8px', fontSize: 13, fontFamily: 'inherit', color: '#374151', outline: 'none', backgroundColor: 'transparent', minWidth: 130 }
                                : styles.filterInput}
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

                    {/* Filter Ver solo Pendientes */}
                    <TouchableOpacity
                        style={[
                            styles.filterItem,
                            {
                                paddingHorizontal: 10,
                                paddingVertical: Platform.OS === 'web' ? 8 : 10,
                                backgroundColor: filterPending ? '#FEF3C7' : '#F3F4F6',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: filterPending ? '#FCD34D' : '#D1D5DB'
                            }
                        ]}
                        onPress={() => setFilterPending(!filterPending)}
                    >
                        <Text style={{ fontSize: 13, color: filterPending ? '#B45309' : '#4B5563', fontWeight: filterPending ? 'bold' : 'normal' }}>
                            ⏳ Ver solo Pendientes
                        </Text>
                    </TouchableOpacity>

                    {/* Filtro Solicitud de Crédito */}
                    <TouchableOpacity
                        style={[
                            styles.filterItem,
                            {
                                paddingHorizontal: 10,
                                paddingVertical: Platform.OS === 'web' ? 8 : 10,
                                backgroundColor: filterCredit ? '#F5F3FF' : '#F3F4F6',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: filterCredit ? '#DDD6FE' : '#D1D5DB'
                            }
                        ]}
                        onPress={() => setFilterCredit(!filterCredit)}
                    >
                        <Text style={{ fontSize: 13, color: filterCredit ? '#7C3AED' : '#4B5563', fontWeight: filterCredit ? 'bold' : 'normal' }}>
                            💳 Ver Créditos
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.presupuestoCard]}><Text style={styles.summaryLabel}>Presupuesto{filterRubro ? '*' : ''}</Text><Text style={styles.summaryValue}>{formatCurrency(displayedPresupuesto)}</Text></View>
                <View style={[styles.summaryCard, styles.gastadoCard]}><Text style={styles.summaryLabel}>Gastado</Text><Text style={styles.summaryValue}>{formatCurrency(displayedGastado)}</Text></View>
                <View style={[styles.summaryCard, displayedRestante >= 0 ? styles.restanteCard : styles.excesoCard]}><Text style={styles.summaryLabel}>{displayedRestante >= 0 ? 'Restante' : 'Exceso'}</Text><Text style={styles.summaryValue}>{formatCurrency(Math.abs(displayedRestante))}</Text></View>
            </View>

            <GastosCapturaBodyScroll>
            <GastoAutorizacionBloque
                modulo={MODULOS_GASTO.planeacion}
                anio={anio}
                mes={mes}
                displayName={displayName}
                proveedores={proveedores}
                rubros={rubros}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onRegistrarGasto={handleRegistrarDesdeAutorizacion}
                onRegistrarDirecto={handleRegistrarDirecto}
                refreshKey={authRefreshKey}
            />

            {loading ? <ActivityIndicator size="large" color="#2563EB" style={styles.loading} /> : (
                <View style={styles.listContainer}>
                    {filteredGastos.length === 0 ? (
                        <View style={styles.emptyState}><Text style={styles.emptyText}>No hay gastos registrados</Text></View>
                    ) : (
                        filteredGastos.map(gasto => {
                            const deadline = new Date(gasto.fecha);
                            deadline.setDate(deadline.getDate() + 2);
                            const isOverdue = gasto.esPendiente && new Date() > deadline;

                            return (
                                <View key={gasto.id} style={[styles.gastoCard, isOverdue && { borderColor: '#DC2626', borderWidth: 2 }]}>
                                    <View style={styles.gastoHeader}>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.gastoTipo}>
                                                    {gasto.rubroNombre || 'Sin Rubro'}
                                                    {gasto.creadoPorNombre ? ` - ${gasto.creadoPorNombre}` : ''}
                                                </Text>
                                                {gasto.esPendiente && (
                                                    <View style={{ backgroundColor: isOverdue ? '#DC2626' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                        <Text style={{ fontSize: 10, color: isOverdue ? '#FFF' : '#B45309', fontWeight: 'bold' }}>⏳ Pendiente</Text>
                                                    </View>
                                                )}
                                                {!gasto.tipoHoraId && !gasto.tipoRecargoId && (
                                                    <MedioPagoBadge
                                                        esSolicitudCredito={!!gasto.esSolicitudCredito}
                                                        esEfectivo={!!gasto.esEfectivo}
                                                        compact
                                                    />
                                                )}
                                                {gasto.estado && (
                                                    <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(gasto.estado) + '20', borderColor: getEstadoColor(gasto.estado) }]}
                                                    >
                                                        <Text style={[styles.estadoBadgeText, { color: getEstadoColor(gasto.estado) }]}>
                                                            {gasto.estado.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            {gasto.esPendiente && (
                                                <Text style={{ fontSize: 11, color: isOverdue ? '#DC2626' : '#6B7280', marginTop: 2, fontWeight: isOverdue ? 'bold' : 'normal' }}>
                                                    Legalizar antes de: {formatDate(deadline.toISOString())}
                                                </Text>
                                            )}
                                        </View>
                                        <GastoListaPrecios
                                            gasto={gasto}
                                            singlePriceRow={!!(gasto.tipoHoraId || gasto.tipoRecargoId)}
                                            formatCurrency={formatCurrency}
                                            precioStyle={styles.gastoPrecio}
                                        />
                                    </View>
                                    <Text style={styles.gastoRubro}>{gasto.proveedorNombre || gasto.personalNombre}</Text>
                                    <View style={styles.gastoDetails}>
                                        {gasto.personalId ? (
                                            <>
                                                <Text style={styles.gastoDetail}>👤 CC: {gasto.personalCedula}</Text>
                                                <Text style={styles.gastoDetail}>⏱️ {gasto.tipoHoraNombre || gasto.tipoRecargoNombre}: {gasto.cantidadHoras} hrs</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Text style={styles.gastoDetail}>🏢 NIT: {gasto.proveedorNit}</Text>
                                                <Text style={styles.gastoDetail}>📄 Factura: {gasto.numeroFactura}</Text>
                                            </>
                                        )}
                                        {gasto.facturaPdfUrl && (
                                            <TouchableOpacity onPress={() => { if (Platform.OS === 'web') window.open(`${fileServerUrl}${gasto.facturaPdfUrl}`, '_blank'); }}>
                                                <Text style={[styles.gastoDetail, { color: '#2563EB', textDecorationLine: 'underline' }]}>📎 Ver PDF Factura</Text>
                                            </TouchableOpacity>
                                        )}
                                        <Text style={styles.gastoDetail}>📅 {formatDate(gasto.fecha)}</Text>
                                    </View>
                                    {gasto.observaciones && <Text style={styles.gastoNota}>💬 {gasto.observaciones}</Text>}
                                    <View style={styles.cardActions}>
                                        {gasto.esPendiente && (
                                            <TouchableOpacity
                                                style={[styles.editCardButton, { backgroundColor: '#10B981', marginRight: 10 }]}
                                                onPress={() => handleLegalizar(gasto)}
                                            >
                                                <Text style={styles.editCardButtonText}>✅ Legalizar</Text>
                                            </TouchableOpacity>
                                        )}
                                        {gastoPermiteEdicionTrasContabilidad(gasto) && (
                                            <>
                                                <TouchableOpacity style={styles.editCardButton} onPress={() => handleEdit(gasto)}>
                                                    <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(gasto.id)}>
                                                    <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        <TouchableOpacity style={styles.historyButton} onPress={() => { setSelectedHistoryGasto(gasto); setShowHistoryModal(true); }}>
                                            <Text style={styles.historyButtonText}>🕒 Historial</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )
                        })
                    )}
                </View>
            )}
            </GastosCapturaBodyScroll>

            <ExpenseHistoryModal visible={showHistoryModal} onClose={() => setShowHistoryModal(false)} gasto={selectedHistoryGasto} />

            <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar Gasto' : 'Nuevo Gasto'}</Text>
                        <ScrollView style={styles.formContainer}>
                            {/* Context Info for Legalization */}
                            {isLegalizing && (
                                <View style={{ backgroundColor: '#F0F9FF', padding: 10, borderRadius: 5, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#007bff' }}>
                                    <Text style={{ fontWeight: 'bold', color: '#0056b3' }}>Legalizando:</Text>
                                    <Text style={{ fontSize: 13, marginTop: 2 }}>
                                        {rubros.find(r => r.id == formData.rubroId)?.nombre}
                                    </Text>
                                    <Text style={{ fontSize: 13, marginTop: 2 }}>
                                        Proveedor: {proveedores.find(p => p.id == formData.proveedorId)?.nombre || 'Sin Proveedor'}
                                    </Text>
                                    <Text style={{ fontSize: 13, marginTop: 2 }}>Fecha: {formData.fecha}</Text>
                                </View>
                            )}

                            {!isLegalizing && (
                                <>
                                    <Text style={styles.label}>Rubro *</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker
                                            selectedValue={formData.rubroId}
                                            onValueChange={(v) => {
                                                const selectedRubro = rubros.find(r => r.id?.toString() === v);
                                                const name = selectedRubro?.nombre?.toLowerCase() || '';
                                                const isHE = name.includes('horas extras') || name.includes('hora extra') || name.includes('horas adiccionales') || name.includes('horas adicionales');
                                                const isRec = name.includes('recargo');
                                                setMedioPago(null);
                                                setFormData(p => ({
                                                    ...p,
                                                    rubroId: v,
                                                    proveedorId: '',
                                                    personalId: '',
                                                    esSolicitudCredito: false, // Reset credit request on rubro change
                                                    tipoGasto: (isHE || isRec) ? 'nomina' : 'normal'
                                                }));
                                            }}
                                            enabled={!isLegalizing}
                                        >
                                            <Picker.Item label="Seleccione..." value="" />
                                            {rubros.map(r => (
                                                <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />
                                            ))}
                                        </Picker>
                                    </View>
                                </>
                            )}

                            {formData.rubroId ? (
                                <>
                                    {!isLegalizing && !isHorasExtras && !isRecargo && (
                                        <TouchableOpacity
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                marginBottom: 12,
                                                padding: 10,
                                                backgroundColor: '#FFF7ED',
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: '#FFEDD5'
                                            }}
                                            onPress={() => setFormData(p => ({ ...p, esPendiente: !p.esPendiente }))}
                                        >
                                            <View style={{
                                                width: 20,
                                                height: 20,
                                                borderWidth: 2,
                                                borderColor: '#F97316',
                                                borderRadius: 4,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                marginRight: 10,
                                                backgroundColor: formData.esPendiente ? '#F97316' : 'white'
                                            }}>
                                                {formData.esPendiente && <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                                            </View>
                                            <View>
                                                <Text style={{ fontWeight: 'bold', color: '#9A3412' }}>Gasto Pendiente</Text>
                                                <Text style={{ fontSize: 10, color: '#C2410C' }}>Sin factura aún</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    {!isHorasExtras && !isRecargo && (
                                        <MedioPagoGastoControls
                                            value={medioPago}
                                            onChange={(v) => {
                                                setMedioPago(v);
                                                const f = medioPagoToFlags(v);
                                                setFormData(p => ({ ...p, esSolicitudCredito: f.esSolicitudCredito }));
                                            }}
                                            colors={{
                                                text: themeColors.text,
                                                subText: themeColors.subText,
                                                primary: themeColors.primary || '#7C3AED',
                                                border: themeColors.border,
                                                card: themeColors.card || themeColors.background
                                            }}
                                        />
                                    )}

                                    {formData.tipoGasto === 'normal' ? (
                                        <>
                                            <Text style={styles.label}>Proveedor *</Text>
                                            <View style={styles.pickerContainer}>
                                                <Picker selectedValue={formData.proveedorId} onValueChange={(v) => setFormData(p => ({ ...p, proveedorId: v }))}>
                                                    <Picker.Item label="Seleccione..." value="" />
                                                    {proveedores.filter(p => proveedorMatchesRubro(p, formData.rubroId)).map(p => (
                                                        <Picker.Item key={p.id} label={`${p.nombre} (${p.nitCedula})`} value={p.id.toString()} />
                                                    ))}
                                                </Picker>
                                            </View>

                                            <Text style={styles.label}>Número de Factura {formData.esPendiente ? '(Opcional por ahora)' : '*'}</Text>
                                            <TextInput style={styles.input} value={formData.numeroFactura} onChangeText={(t) => setFormData(p => ({ ...p, numeroFactura: t }))} placeholder={formData.esPendiente ? "Opcional" : "Obligatorio para habilitar precio"} />

                                            {(debeMostrarCamposMonto(formData, { medioPago })) && (
                                                <>
                                                    <Text style={styles.label}>Precio base *</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        keyboardType="decimal-pad"
                                                        value={formData.precioBase}
                                                        onChangeText={(t) => setFormData(p => ({ ...p, precioBase: t }))}
                                                        placeholder="0"
                                                    />
                                                    <Text style={[styles.label, { marginTop: 10 }]}>IVA * (puede ser 0)</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        keyboardType="decimal-pad"
                                                        value={formData.precioIva}
                                                        onChangeText={(t) => setFormData(p => ({ ...p, precioIva: t }))}
                                                        placeholder="0"
                                                    />
                                                    <Text style={{ marginTop: 8, fontSize: 14, fontWeight: 'bold', color: '#059669' }}>
                                                        Total: {formatCurrency((parseMontoInput(formData.precioBase) ?? 0) + (parseMontoInput(formData.precioIva) ?? 0))}
                                                    </Text>
                                                </>
                                            )}

                                            {!formData.esPendiente && (
                                                <>
                                                    <Text style={styles.label}>Documento soporte (PDF)</Text>
                                                    <TouchableOpacity
                                                        style={[styles.submitButton, { marginBottom: 8, backgroundColor: '#DC2626' }, uploadingFactura && { opacity: 0.7 }]}
                                                        onPress={handlePickFacturaPdf}
                                                        disabled={uploadingFactura}
                                                    >
                                                        <Text style={styles.submitButtonText}>
                                                            {uploadingFactura ? 'Subiendo PDF...' : (facturaArchivoNombre ? 'Cambiar PDF' : 'Subir PDF')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    {facturaArchivoNombre ? (
                                                        <Text style={{ fontSize: 12, color: '#065F46', marginBottom: 6 }}>
                                                            Archivo: {facturaArchivoNombre}
                                                        </Text>
                                                    ) : null}
                                                    {formData.facturaPdfUrl ? (
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                if (Platform.OS === 'web') {
                                                                    const full = `${fileServerUrl}${formData.facturaPdfUrl}`;
                                                                    window.open(full, '_blank');
                                                                }
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 12, color: '#2563EB', textDecorationLine: 'underline', marginBottom: 8 }}>
                                                                Ver PDF cargado
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ) : null}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.label}>Personal de Almacen *</Text>
                                            <View style={[styles.pickerContainer, { marginBottom: 15 }]}>
                                                <Picker
                                                    selectedValue={formData.personalId}
                                                    onValueChange={(v) => setFormData(p => ({ ...p, personalId: v }))}
                                                >
                                                    <Picker.Item label="Seleccione..." value="" />
                                                    {personal.map(p => (
                                                        <Picker.Item key={p.id} label={`${p.nombre} (${p.cedula})`} value={p.id.toString()} />
                                                    ))}
                                                </Picker>
                                            </View>

                                            <Text style={styles.label}>Fecha *</Text>
                                            {Platform.OS === 'web' ? (
                                                <input type="date" value={formData.fecha} onChange={(e) => setFormData(p => ({ ...p, fecha: e.target.value }))} style={{ padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #D1D5DB', marginBottom: 10, width: '100%', boxSizing: 'border-box' }} />
                                            ) : (
                                                <TextInput style={styles.input} value={formData.fecha} onChangeText={(t) => setFormData(p => ({ ...p, fecha: t }))} placeholder="YYYY-MM-DD" />
                                            )}

                                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
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
                                                    <Text style={{ fontWeight: 'bold', marginBottom: 5, fontSize: 13, color: '#1F2937' }}>Desglose de Horas:</Text>
                                                    {breakdown.map((item, idx) => (
                                                        <Text key={idx} style={{ fontSize: 13, color: '#4B5563', fontWeight: 'bold' }}>
                                                            • {item.type}: {item.formattedHours || item.hours.toFixed(2)}
                                                        </Text>
                                                    ))}
                                                </View>
                                            )}

                                            {formData.personalId && (() => {
                                                const worker = personal.find(p => p.id.toString() === formData.personalId);
                                                const hasSalary = (parseFloat(worker?.salario) || 0) > 0;
                                                if (!hasSalary) {
                                                    return (
                                                        <View style={{ backgroundColor: '#FFF7ED', padding: 10, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#F97316' }}>
                                                            <Text style={{ fontWeight: 'bold', color: '#9A3412', marginBottom: 5 }}>⚠️ Falta Salario:</Text>
                                                            <Text style={{ fontSize: 13, color: '#9A3412' }}>Este personal no tiene salario registrado. No se podrá calcular el costo.</Text>
                                                        </View>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </>
                                    )}

                                    {/* Común para ambos tipos si hay rubro seleccionado */}
                                    <Text style={styles.label}>{formData.tipoGasto === 'nomina' ? 'Detalles *' : 'Observaciones'}</Text>
                                    <TextInput
                                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                        value={formData.observaciones}
                                        onChangeText={(t) => setFormData(p => ({ ...p, observaciones: t }))}
                                        multiline
                                        placeholder="Detalles adicionales..."
                                    />

                                    <View style={styles.modalActions}>
                                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.submitButton, saving && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saving}>
                                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#666', fontStyle: 'italic', marginBottom: 20 }}>Seleccione un rubro para continuar...</Text>
                                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                                        <Text style={styles.cancelButtonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// TiposServicioTab removed

// ===================== GRAFICAS TAB =====================
function GraficasTab() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1); // 1-12 o "" para anual
    const [graficasData, setGraficasData] = useState(null);
    const [allGastos, setAllGastos] = useState([]);
    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            let dataGraf, dataGastos;
            if (mesSeleccionado && mesSeleccionado != 0) {
                [dataGraf, dataGastos] = await Promise.all([
                    planeacionApi.getGraficas(anio, mesSeleccionado),
                    planeacionApi.getGastos(anio, mesSeleccionado)
                ]);
            } else {
                dataGraf = await planeacionApi.getGraficasAnual(anio);
                try { dataGastos = await planeacionApi.getGastos(anio, 0); } catch (e) { dataGastos = []; }
            }
            setGraficasData(dataGraf);
            setAllGastos(Array.isArray(dataGastos) ? dataGastos : (dataGastos?.gastos || []));
        } catch (error) { console.error('Error loading data:', error); setAllGastos([]); }
        finally { setLoading(false); }
    }, [anio, mesSeleccionado]);

    useEffect(() => { loadData(); }, [loadData]);

    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [detailTitle, setDetailTitle] = useState('');
    const [detailGastos, setDetailGastos] = useState([]);

    const handleOpenDetail = (type, id, name) => {
        setDetailTitle(name);
        setDetailModalVisible(true);
        try {
            let filtered = [];
            if (type === 'rubro') {
                filtered = allGastos.filter(g => {
                    if (id && (g.rubroId == id)) return true;
                    return (g.rubroNombre || '').toLowerCase() === String(name).toLowerCase();
                });
            } else if (type === 'proveedor') {
                filtered = allGastos.filter(g => g.proveedorId == id);
            }
            filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setDetailGastos(filtered);
        } catch (err) { console.error('Error filtering:', err); setDetailGastos([]); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    const data = graficasData || { totalGastado: 0, porRubro: [] };
    const totalRegistrosReal = allGastos.length;
    const normalizedPorRubro = (data.porRubro || []).map(r => ({ ...r, nombre: r.nombre || r.rubro, total: r.total || r.gastado }));

    const logoSource = colors.alephLogo;

    const getBase64FromUrl = async (url) => {
        if (Platform.OS !== 'web') { try { const base64 = await FileSystem.readAsStringAsync(url, { encoding: 'base64' }); return `data:image/jpeg;base64,${base64}`; } catch (err) { return null; } }
        const d = await fetch(url); const blob = await d.blob();
        return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(blob); reader.onloadend = () => resolve(reader.result); });
    };

    const generateReport = async () => {
        if (!graficasData) return;
        setLoading(true);
        try {
            let jsPDF, autoTable;
            if (Platform.OS === 'web') {
                const jsPDFModule = await import('jspdf'); jsPDF = jsPDFModule.jsPDF;
                const autoTableModule = await import('jspdf-autotable'); autoTable = autoTableModule.default;
            } else { Alert.alert("Info", "PDF disponible solo en Web."); setLoading(false); return; }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 15; let yPos = 20;
            try { const asset = Asset.fromModule(logoSource); await asset.downloadAsync(); const base64Logo = await getBase64FromUrl(asset.uri); if (base64Logo) doc.addImage(base64Logo, 'JPEG', margin, 10, 30, 30); }
            catch (e) { doc.setFontSize(18); doc.text('ALEPH', margin, 25); }

            doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95);
            doc.text(`INFORME PLANEACIÓN - ${mesSeleccionado ? MESES[Number(mesSeleccionado) - 1].label.toUpperCase() : 'ANUAL'} ${anio}`, pageWidth / 2, 20, { align: 'center' });
            yPos = 50;

            const totalP = data.totalPresupuesto || 0; const totalG = data.totalGastado || 0;
            const pct = totalP > 0 ? ((totalG / totalP) * 100).toFixed(1) : '0.0';
            const disponible = totalP - totalG;
            autoTable(doc, {
                head: [['Presupuesto', 'Ejecutado', 'Disponible', '% Ejecutado', 'Registros']],
                body: [[formatCurrency(totalP), formatCurrency(totalG), formatCurrency(Math.abs(disponible)), `${pct}%`, totalRegistrosReal.toString()]],
                startY: yPos, styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
                headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' }
            });
            yPos = doc.lastAutoTable.finalY + 15;
            doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0); doc.text('DETALLE DE GASTOS POR RUBRO', margin, yPos); yPos += 5;

            const [allRubros] = await Promise.all([planeacionApi.getRubros()]);
            const tableRows = [];
            const rubrosWithTotal = allRubros.map(r => {
                const rGastos = allGastos.filter(g => g.rubroId === r.id); const total = rGastos.reduce((s, g) => s + (g.precio || 0), 0);
                return { ...r, total, gastos: rGastos };
            }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
            rubrosWithTotal.forEach(rubro => {
                tableRows.push([{ content: `[RUBRO] ${rubro.nombre.toUpperCase()}`, colSpan: 2, styles: { fillColor: [224, 231, 255], fontStyle: 'bold', textColor: [30, 58, 95] } }, { content: formatCurrency(rubro.total), styles: { fillColor: [224, 231, 255], fontStyle: 'bold', halign: 'right', textColor: [30, 58, 95] } }]);
                rubro.gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(g => {
                    const fecha = g.fecha ? g.fecha.split('T')[0] : '';
                    let detalle = `Prov: ${g.proveedorNombre || 'N/A'}`; if (g.numeroFactura) detalle += ` - Fac: ${g.numeroFactura}`; if (g.observaciones) detalle += `\nNota: ${g.observaciones}`;
                    tableRows.push([{ content: fecha, styles: { fontSize: 8, textColor: 80 } }, { content: detalle, styles: { fontSize: 9, textColor: 50 } }, { content: formatCurrency(g.precio), styles: { halign: 'right', fontSize: 9 } }]);
                });
            });
            autoTable(doc, { head: [['Fecha', 'Detalle / Proveedor', 'Valor']], body: tableRows, startY: yPos, theme: 'grid', styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35, halign: 'right' } } });
            doc.save(`Informe_Planeacion_${anio}_${mesSeleccionado || 'Anual'}.pdf`);
            Alert.alert('Éxito', 'Informe PDF descargado');
        } catch (e) { console.error(e); Alert.alert('Error', 'No se pudo generar PDF'); }
        finally { setLoading(false); }
    };

    const generateCSV = async () => {
        if (!allGastos.length) return; setLoading(true);
        try {
            let csvContent = '\uFEFF'; csvContent += "ID,Fecha,Año,Mes,Rubro,Proveedor,Factura,Valor,Observaciones,Creado Por\n";
            allGastos.forEach(g => {
                const escape = (text) => `"${String(text || '').replace(/"/g, '""')}"`;
                csvContent += [g.id, g.fecha?.split('T')[0] || '', new Date(g.fecha).getFullYear(), new Date(g.fecha).getMonth() + 1, escape(g.rubroNombre), escape(g.proveedorNombre), escape(g.numeroFactura), g.precio, escape(g.observaciones), escape(g.creadoPorNombre)].join(",") + "\n";
            });
            const filename = `Planeacion_Gastos_${anio}_${mesSeleccionado || 'Anual'}.csv`;
            if (Platform.OS === 'web') { const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
            else { const fileUri = FileSystem.documentDirectory + filename; await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 }); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exportar CSV' }); }
        } catch (error) { Alert.alert('Error', 'Falló exportación CSV'); } finally { setLoading(false); }
    };

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📊 Análisis de Gastos Planeación</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity style={grafStyles.reportButton} onPress={generateReport}><Text style={grafStyles.reportButtonText}>📄 Generar Informe</Text></TouchableOpacity>
                    <TouchableOpacity style={[grafStyles.reportButton, { backgroundColor: '#3B82F6' }]} onPress={generateCSV}><Text style={grafStyles.reportButtonText}>📊 Exportar CSV</Text></TouchableOpacity>
                    <View style={styles.yearSelector}>
                        <Picker selectedValue={anio} onValueChange={setAnio} style={{ width: 100, height: 40, marginRight: 8 }}>{anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}</Picker>
                        <Picker selectedValue={mesSeleccionado} onValueChange={setMesSeleccionado} style={{ width: 130, height: 40 }}>
                            <Picker.Item label="Todo el Año" value={0} />
                            {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                        </Picker>
                    </View>
                </View>
            </View>
            <ScrollView style={styles.listContainer}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#EFF6FF', minWidth: 150 }]}><Text style={styles.summaryLabel}>💰 Presupuesto</Text><Text style={[styles.summaryValue, { color: '#1E40AF' }]}>{formatCurrency(data.totalPresupuesto || 0)}</Text></View>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#D1FAE5', minWidth: 150 }]}><Text style={styles.summaryLabel}>📊 Gastado</Text><Text style={[styles.summaryValue, { color: '#059669' }]}>{formatCurrency(data.totalGastado || 0)}</Text></View>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#FEF3C7', minWidth: 150 }]}><Text style={styles.summaryLabel}>✅ Restante</Text><Text style={[styles.summaryValue, { color: '#D97706' }]}>{formatCurrency((data.totalPresupuesto || 0) - (data.totalGastado || 0))}</Text></View>
                    <View style={[styles.summaryCard, { flex: 1, backgroundColor: '#F3F4F6', minWidth: 150 }]}><Text style={styles.summaryLabel}>📋 Registros</Text><Text style={[styles.summaryValue, { color: '#374151' }]}>{totalRegistrosReal}</Text></View>
                </View>

                <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
                    <View style={styles.modalOverlay}><View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={styles.modalTitle}>Detalle: {detailTitle}</Text>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={{ padding: 5 }}><Text style={{ fontSize: 20, color: '#666' }}>✕</Text></TouchableOpacity>
                        </View>
                        {detailGastos.length === 0 ? (<Text style={styles.emptyText}>No se encontraron registros.</Text>) : (
                            <ScrollView style={{ maxHeight: 400 }}>
                                {detailGastos.map(g => (
                                    <View key={g.id} style={{ backgroundColor: '#F9FAFB', padding: 12, marginBottom: 8, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#2563EB' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontWeight: 'bold', color: '#374151' }}>{new Date(g.fecha).toLocaleDateString()}</Text>
                                            <Text style={{ fontWeight: 'bold', color: '#059669' }}>{formatCurrency(g.precio)}</Text>
                                        </View>
                                        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{g.rubroNombre || 'Gasto General'}</Text>
                                        <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>🏢 {g.proveedorNombre}</Text>
                                        {g.observaciones && <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>"{g.observaciones}"</Text>}
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                        <TouchableOpacity style={[styles.cancelButton, { marginTop: 15, alignSelf: 'flex-end' }]} onPress={() => setDetailModalVisible(false)}><Text style={styles.cancelButtonText}>Cerrar</Text></TouchableOpacity>
                    </View></View>
                </Modal>

                <View style={{ marginBottom: 20, backgroundColor: 'white', padding: 15, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#1F2937' }}>{mesSeleccionado ? 'Ejecución del Mes' : 'Ejecución Anual'}</Text>
                    <View style={{ height: 20, backgroundColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                        <View style={{ width: `${Math.min(100, ((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}%`, height: '100%', backgroundColor: ((data.totalGastado || 0) > (data.totalPresupuesto || 0)) ? '#DC2626' : '#10B981' }} />
                    </View>
                    <Text style={{ textAlign: 'right', marginTop: 5, fontSize: 12, color: '#666' }}>{Math.round(((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}% ejecutado</Text>
                </View>

                {normalizedPorRubro.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#111827' }}>📁 Desempeño por Rubro</Text>
                        {normalizedPorRubro.map((item, idx) => {
                            const rubroPorcentaje = (item.presupuesto > 0) ? Math.round((item.total / item.presupuesto) * 100) : (item.total > 0 ? 101 : 0);
                            const isExceeded = item.total > item.presupuesto && item.presupuesto > 0;
                            const isZeroBudget = item.presupuesto === 0 && item.total > 0;
                            return (
                                <View key={idx} style={{ marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <TouchableOpacity onPress={() => handleOpenDetail('rubro', item.id, item.nombre)}>
                                            <Text style={{ fontWeight: '600', color: '#1E40AF', textDecorationLine: 'underline' }}>{item.nombre} 👆</Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: (isExceeded || isZeroBudget) ? '#DC2626' : '#059669' }}>{formatCurrency(item.total)} / {formatCurrency(item.presupuesto)}</Text>
                                    </View>
                                    <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                                        <View style={{ width: `${Math.min(100, rubroPorcentaje)}%`, height: '100%', backgroundColor: (isExceeded || isZeroBudget) ? '#DC2626' : '#3B82F6' }} />
                                    </View>
                                    {(isExceeded || isZeroBudget) && <Text style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>⚠️ Superó presupuesto</Text>}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// ===================== PRESUPUESTOS TAB =====================
function PresupuestosTab() {
    const [loading, setLoading] = useState(true);
    const [rubros, setRubros] = useState([]);
    const [tiposServicio, setTiposServicio] = useState([]);
    const [presupuestos, setPresupuestos] = useState([]);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [saving, setSaving] = useState(false);
    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rubrosData, presupuestosData] = await Promise.all([
                planeacionApi.getRubros(),
                planeacionApi.getPresupuestosGrid(anio)
            ]);
            setRubros(rubrosData);
            setPresupuestos(presupuestosData);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [anio]);

    useEffect(() => { loadData(); }, [loadData]);

    const getPresupuesto = (rubroId, mes) => {
        const p = presupuestos.find(x => (x.rubroId === rubroId || x.tipoServicioId === rubroId) && x.mes === mes);
        return p ? p.presupuesto.toString() : '';
    };

    const handleChange = (rubroId, mes, value) => {
        const val = parseFloat(value) || 0;
        setPresupuestos(prev => {
            const idx = prev.findIndex(x => (x.rubroId === rubroId || x.tipoServicioId === rubroId) && x.mes === mes);
            if (idx >= 0) { const updated = [...prev]; updated[idx] = { ...updated[idx], presupuesto: val }; return updated; }
            return [...prev, { rubroId: rubroId, anio, mes, presupuesto: val }];
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await planeacionApi.setPresupuestosBulk(presupuestos.filter(p => p.presupuesto > 0));
            showAlert('Éxito', 'Presupuestos guardados');
            loadData();
        } catch (e) { showAlert('Error', 'No se pudieron guardar'); } finally { setSaving(false); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📋 Presupuestos Mensuales</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>{anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}</Picker>
                    <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>💾 Guardar Todo</Text>}
                    </TouchableOpacity>
                </View>
            </View>
            <ScrollView style={styles.listContainer} horizontal>
                <View>
                    <View style={{ flexDirection: 'row', backgroundColor: '#1E3A5F', paddingVertical: 8, borderRadius: 4, marginBottom: 4 }}>
                        <Text style={{ width: 180, color: '#FFF', fontWeight: 'bold', paddingHorizontal: 8 }}>Rubro</Text>
                        {MESES.map(m => <Text key={m.value} style={{ width: 100, color: '#FFF', fontWeight: 'bold', textAlign: 'center', fontSize: 11 }}>{m.label.substring(0, 3)}</Text>)}
                        <Text style={{ width: 120, color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>Total Anual</Text>
                    </View>
                    {rubros.map((rubro, idx) => {
                        const total = MESES.reduce((sum, m) => sum + (parseFloat(getPresupuesto(rubro.id, m.value)) || 0), 0);
                        return (
                            <View key={rubro.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: idx % 2 === 0 ? '#F9FAFB' : '#FFF', paddingVertical: 4 }}>
                                <View style={{ width: 180, paddingHorizontal: 8 }}>
                                    <Text style={{ fontWeight: '500', fontSize: 13 }}>{rubro.nombre}</Text>
                                </View>
                                {MESES.map(m => (
                                    <TextInput key={m.value} style={{ width: 96, marginHorizontal: 2, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 4, paddingHorizontal: 4, height: 30, textAlign: 'right', fontSize: 12 }}
                                        value={getPresupuesto(rubro.id, m.value)} onChangeText={(v) => handleChange(rubro.id, m.value, v)} keyboardType="numeric" placeholder="0" />
                                ))}
                                <Text style={{ width: 120, textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{formatCurrency(total)}</Text>
                            </View>
                        );
                    })}
                </View>
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

    const loadData = async () => { try { setLoading(true); setItems(await planeacionApi.getRubros()); } catch (e) { } finally { setLoading(false); } };
    useEffect(() => { loadData(); }, []);
    const handleAdd = () => { setEditItem(null); setNombre(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setShowModal(true); };
    const handleSave = async () => {
        if (!nombre.trim()) { showAlert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true); const data = { nombre, activo: true }; if (editItem) await planeacionApi.updateRubro(editItem.id, data); else await planeacionApi.createRubro(data);
            showAlert('Éxito', editItem ? 'Rubro actualizado' : 'Rubro creado'); setShowModal(false); loadData();
        } catch (e) { showAlert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };
    const handleDelete = async (id) => {
        const doDelete = async () => { try { await planeacionApi.deleteRubro(id); loadData(); showAlert('Éxito', 'Rubro eliminado'); } catch { showAlert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar rubro?')) doDelete(); } else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };
    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;
    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}><Text style={styles.title}>📁 Rubros</Text><TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity></View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (<View key={item.id} style={styles.itemCard}><View style={styles.itemInfo}><Text style={styles.itemName}>{item.nombre}</Text></View><View style={styles.itemActions}><TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity><TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity></View></View>))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Rubro</Text>
                <Text style={styles.label}>Nombre *</Text><TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                <View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}</TouchableOpacity></View>
            </View></View></Modal>
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
    const [formData, setFormData] = useState({
        nombre: '', nitCedula: '', telefono: ''
    });
    const [rubroIds, setRubroIds] = useState([]);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [p, r] = await Promise.all([
                planeacionApi.getProveedores(),
                planeacionApi.getRubros()
            ]);
            setItems(p);
            setRubros(r);
        } catch (e) { } finally { setLoading(false); }
    };
    useEffect(() => { loadData(); }, []);

    const handleAdd = () => {
        setEditItem(null);
        setFormData({ nombre: '', nitCedula: '', telefono: '' });
        setRubroIds([]);
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            nombre: item.nombre,
            nitCedula: item.nitCedula || '',
            telefono: item.telefono || ''
        });
        setRubroIds(getProveedorRubroIds(item).map(String));
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.nombre.trim()) { showAlert('Error', 'Nombre obligatorio'); return; }
        if (!formData.nitCedula.trim()) { showAlert('Error', 'NIT/Cédula obligatorio'); return; }
        if (rubroIds.length === 0) { showAlert('Error', 'Seleccione al menos un rubro'); return; }
        try {
            setSaving(true);
            const ids = rubroIds.map(id => parseInt(id, 10)).filter(id => id > 0);
            const data = {
                nombre: formData.nombre,
                nitCedula: formData.nitCedula,
                telefono: formData.telefono,
                rubroIds: ids,
                rubroId: ids[0],
                activo: true
            };
            if (editItem) await planeacionApi.updateProveedor(editItem.id, data);
            else await planeacionApi.createProveedor(data);
            showAlert('Éxito', editItem ? 'Actualizado' : 'Registrado');
            setShowModal(false);
            loadData();
        } catch (e) { showAlert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };
    const handleDelete = async (id) => {
        const doDelete = async () => { try { await planeacionApi.deleteProveedor(id); loadData(); showAlert('Éxito', 'Proveedor eliminado'); } catch { showAlert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar proveedor?')) doDelete(); } else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };
    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;
    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}><Text style={styles.title}>🏢 Proveedores</Text><TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity></View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemSubtitle}>{getProveedorRubrosLabel(item)}</Text>
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

                    <MultiRubroPicker rubros={rubros} selectedIds={rubroIds} onChange={setRubroIds} required />

                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={formData.nombre} onChangeText={(t) => setFormData(p => ({ ...p, nombre: t }))} placeholder="Nombre" />

                    <Text style={styles.label}>NIT o Cédula *</Text>
                    <TextInput style={styles.input} value={formData.nitCedula} onChangeText={(t) => setFormData(p => ({ ...p, nitCedula: t }))} placeholder="NIT o CC" />

                    <Text style={styles.label}>Teléfono</Text>
                    <TextInput style={styles.input} value={formData.telefono} onChangeText={(t) => setFormData(p => ({ ...p, telefono: t }))} placeholder="Teléfono" />

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
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '', proveedorId: '', precio: '', descripcion: ''
    });
    const [saving, setSaving] = useState(false);
    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rubrosData, provData, cotData] = await Promise.all([
                planeacionApi.getRubros(),
                planeacionApi.getProveedores(),
                planeacionApi.getCotizaciones(null, anio, mes)
            ]);
            setRubros(rubrosData.filter(r => r.activo));
            setProveedores(provData.filter(p => p.activo));
            setItems(cotData);
        } catch (e) { showAlert('Error', 'No se pudieron cargar los datos'); } finally { setLoading(false); }
    }, [anio, mes]);
    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = () => {
        setEditItem(null);
        setFormData({ rubroId: '', proveedorId: '', precio: '', descripcion: '' });
        setShowModal(true);
    };
    const handleEdit = (item) => {
        setEditItem(item);
        setFormData({
            rubroId: item.rubroId.toString(),
            proveedorId: item.proveedorId.toString(),
            precio: item.precioCotizado?.toString() || '',
            descripcion: item.descripcion || ''
        });
        setShowModal(true);
    };
    const handleSave = async () => {
        if (!formData.rubroId) { showAlert('Error', 'Seleccione un Rubro'); return; }
        if (!formData.proveedorId) { showAlert('Error', 'Seleccione un Proveedor'); return; }
        if (!formData.precio || isNaN(parseFloat(formData.precio))) { showAlert('Error', 'Precio inválido'); return; }
        try {
            setSaving(true);
            const data = {
                rubroId: parseInt(formData.rubroId),
                proveedorId: parseInt(formData.proveedorId),
                precioCotizado: parseFloat(formData.precio),
                descripcion: formData.descripcion,
                fechaCotizacion: new Date().toISOString(),
                anio, mes, activo: true
            };
            if (editItem) await planeacionApi.updateCotizacion(editItem.id, { ...data, id: editItem.id });
            else await planeacionApi.createCotizacion(data);
            showAlert('Éxito', editItem ? 'Actualizada' : 'Creada');
            setShowModal(false);
            loadData();
        } catch (e) { showAlert('Error', 'No se pudo guardar'); } finally { setSaving(false); }
    };
    const handleDelete = (id) => {
        const doDelete = async () => { try { await planeacionApi.deleteCotizacion(id); loadData(); showAlert('Éxito', 'Cotización eliminada'); } catch (e) { showAlert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar cotización?')) doDelete(); } else { Alert.alert('Confirmar', '¿Eliminar?', [{ text: 'Cancelar' }, { text: 'Eliminar', onPress: doDelete }]); }
    };
    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;
    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📝 Cotizaciones</Text>
                <View style={styles.filters}><Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>{anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}</Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>{MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}</Picker></View>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Nueva Cotización</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.length === 0 ? (<View style={styles.emptyState}><Text style={styles.emptyText}>No hay cotizaciones para este periodo</Text></View>) : (
                    items.map(item => (<View key={item.id} style={styles.gastoCard}>
                        <View style={styles.gastoHeader}><Text style={styles.gastoTipo}>{item.proveedorNombre}</Text><Text style={styles.gastoPrecio}>{formatCurrency(item.precioCotizado)}</Text></View>
                        <Text style={styles.gastoRubro}>{item.rubroNombre}</Text>
                        {item.descripcion && <Text style={styles.gastoNota}>{item.descripcion}</Text>}
                        <Text style={styles.gastoDetail}>{formatDate(item.fechaCotizacion)}</Text>
                        <View style={styles.cardActions}><TouchableOpacity style={styles.editCardButton} onPress={() => handleEdit(item)}><Text style={styles.editCardButtonText}>✏️ Editar</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonText}>🗑️ Eliminar</Text></TouchableOpacity></View>
                    </View>))
                )}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Nueva'} Cotización</Text>
                <Text style={styles.label}>Rubro *</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={formData.rubroId} onValueChange={(v) => setFormData(p => ({ ...p, rubroId: v, proveedorId: '' }))}>
                        <Picker.Item label="Seleccione..." value="" />
                        {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                    </Picker>
                </View>
                <Text style={styles.label}>Proveedor *</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={formData.proveedorId} onValueChange={(v) => setFormData(p => ({ ...p, proveedorId: v }))}>
                        <Picker.Item label="Seleccione..." value="" />
                        {proveedores.filter(p => proveedorMatchesRubro(p, formData.rubroId)).map(p => (
                            <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />
                        ))}
                    </Picker>
                </View>
                <Text style={styles.label}>Precio Cotizado *</Text>
                <TextInput style={styles.input} value={formData.precio} onChangeText={(v) => setFormData(p => ({ ...p, precio: v }))} keyboardType="numeric" placeholder="$ 0" />
                <Text style={styles.label}>Descripción</Text>
                <TextInput style={[styles.input, styles.textArea]} value={formData.descripcion} onChangeText={(v) => setFormData(p => ({ ...p, descripcion: v }))} placeholder="Detalles..." multiline numberOfLines={3} />
                <View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}</TouchableOpacity></View>
            </View></View></Modal>
        </View>
    );
}

// ===================== STYLES =====================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    estadoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    estadoBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    pendingBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginRight: 5,
    },
    pendingText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFF',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabsScroll: { backgroundColor: '#1E3A5F', borderBottomWidth: 1, borderBottomColor: '#152A45', flexGrow: 0 },
    tabsContainer: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10 },
    advancedFilters: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    filterLabel: { fontWeight: 'bold', color: '#4B5563', marginRight: 5, fontSize: 13 },
    filterItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#D1D5DB', overflow: 'hidden' },
    filterInput: { height: 35, paddingHorizontal: 10, minWidth: 100, backgroundColor: '#fff', fontSize: 13 },
    filterPicker: { height: 35, width: 160, borderWidth: 0, backgroundColor: 'transparent' },
    clearFilterBtn: { padding: 5, paddingHorizontal: 8 },
    clearFilterText: { color: '#9CA3AF', fontWeight: 'bold' },
    tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, borderRadius: 20, backgroundColor: 'transparent' },
    activeTab: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    tabIcon: { marginRight: 4, fontSize: 14 },
    tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '500', fontSize: 13 },
    activeTabText: { color: '#FFF' },
    contentContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
    filters: { flexDirection: 'row' },
    picker: { width: 110, height: 40 },
    yearSelector: { flexDirection: 'row', alignItems: 'center' },
    summaryContainer: { flexDirection: 'row', padding: 16, gap: 12 },
    summaryCard: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    presupuestoCard: { backgroundColor: '#DBEAFE' },
    gastadoCard: { backgroundColor: '#FEE2E2' },
    restanteCard: { backgroundColor: '#D1FAE5' },
    excesoCard: { backgroundColor: '#FEE2E2' },
    summaryLabel: { fontSize: 12, color: '#4B5563' },
    summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 4 },
    addButton: { backgroundColor: '#2563EB', marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 8, alignItems: 'center' },
    addButtonSmall: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    loading: { marginTop: 40 },
    listContainer: { paddingHorizontal: 16 },
    emptyState: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#9CA3AF', fontSize: 16 },
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
    estadoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        marginLeft: 6,
    },
    estadoBadgeText: {
        fontSize: 10,
        fontWeight: '900',
    },
    itemCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
    itemDetail: { fontSize: 13, color: '#4B5563', marginTop: 1 },
    itemParent: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    itemActions: { flexDirection: 'row', gap: 12 },
    editButton: { fontSize: 18 },
    deleteButtonIcon: { fontSize: 18 },
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

const grafStyles = StyleSheet.create({
    reportButton: { backgroundColor: '#059669', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    reportButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});


