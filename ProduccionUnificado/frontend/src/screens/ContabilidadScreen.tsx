import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Platform, Linking, TextInput, Modal, Alert, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/productionApi';
import { useTheme } from '../contexts/ThemeContext';
import MedioPagoGastoControls, {
    MedioPagoBadge,
    medioPagoToFlags,
    flagsToMedioPago,
    showAlertMedioPagoRequerido,
} from '../components/MedioPagoGastoControls';
import { gastoPermiteEdicionTrasContabilidad } from '../utils/gastoEditPermission';
import { getFileServerUrl } from '../services/apiConfig';
import { GastoListaPrecios, parseMontoInput } from '../utils/gastoPrecioForm';
import {
    getAutorizacionesGastoConsolidado,
    colorEstadoAutorizacion,
    labelEstadoAutorizacion,
    etiquetaModuloGasto,
    moduloContabilidadToKey,
    ESTADOS_AUTORIZACION,
    materializarMovimientosAutorizacion,
} from '../services/gastosAutorizacionApi';
import * as DocumentPicker from 'expo-document-picker';

interface SolicitudAutorizacion {
    id: string;
    modulo: string;
    rubroNombre?: string;
    proveedorNombre?: string;
    fechaAproximada?: string;
    cantidad: number;
    razon: string;
    esSolicitudCredito: boolean;
    esEfectivo: boolean;
    estadoAutorizacion: string;
    solicitadoPorNombre?: string;
    autorizadoPorNombre?: string;
    fechaSolicitud?: string;
    fechaResolucion?: string;
    motivoRechazo?: string;
    gastoId?: string | null;
}

interface GastoConsolidado {
    id: number;
    modulo: string;
    rubro: string;
    proveedor?: string;
    precio: number;
    precioBase?: number | null;
    precioIva?: number | null;
    fecha: string;
    nota?: string;
    numeroFactura?: string;
    numeroOP?: string;
    esPendiente: boolean;
    esSolicitudCredito: boolean;
    esEfectivo?: boolean;
    facturaPdfUrl?: string;
    registradoPor?: string;
    estado: string;
    esLabor: boolean;
    esIngreso?: boolean;
}

interface ResumenGastos {
    totalGeneral: number;
    porModulo: Record<string, number>;
    porRubro: Record<string, number>;
}

export default function ContabilidadScreen() {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [gastos, setGastos] = useState<GastoConsolidado[]>([]);
    const [resumen, setResumen] = useState<ResumenGastos | null>(null);
    const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
    const [filtroModulo, setFiltroModulo] = useState<string>('');
    const [filtroPendiente, setFiltroPendiente] = useState<boolean | null>(null);
    const [filtroCredito, setFiltroCredito] = useState<boolean | null>(null);
    const [filtroEstado, setFiltroEstado] = useState<string>('');
    const [filtroProveedor, setFiltroProveedor] = useState<string>('');
    const [filtroRubro, setFiltroRubro] = useState<string>('');
    const [proveedoresCatalogo, setProveedoresCatalogo] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [fechaFiltro, setFechaFiltro] = useState('');
    const [vistaPrincipal, setVistaPrincipal] = useState<'movimientos' | 'solicitudes'>('movimientos');
    const materializadoMovimientosRef = useRef(false);
    const [solicitudes, setSolicitudes] = useState<SolicitudAutorizacion[]>([]);
    const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
    const [showIngresoModal, setShowIngresoModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [savingIngreso, setSavingIngreso] = useState(false);
    const [editingIngresoId, setEditingIngresoId] = useState<number | null>(null);
    const [exportRange, setExportRange] = useState({
        fechaInicio: '',
        fechaFin: ''
    });
    /** Exportar Excel: si false, esos movimientos no van al archivo */
    const [exportIncluirHorasExtrasRecargos, setExportIncluirHorasExtrasRecargos] = useState(true);
    const [exportIncluirIngresos, setExportIncluirIngresos] = useState(true);
    const [ingresoForm, setIngresoForm] = useState({
        motivoIngreso: '',
        fecha: new Date().toISOString().split('T')[0],
        cantidad: '',
        cantidadDisplay: '',
        pdfUrl: '',
        archivoNombre: ''
    });

    const RUBRO_AGREGAR = '__agregar_rubro__';
    const PROVEEDOR_AGREGAR = '__agregar_prov__';
    const RUBROS_CONTABILIDAD = [
        'Honorarios / asesorías',
        'Software y licencias',
        'Impuestos y tasas',
        'Servicios públicos',
        'Papelería y útiles',
        'Bancarios / comisiones',
        'Capacitación',
        'Otros',
    ];

    const [maestroRubros, setMaestroRubros] = useState<string[]>([]);
    const [maestroProveedores, setMaestroProveedores] = useState<string[]>([]);
    const [proveedoresExtra, setProveedoresExtra] = useState<string[]>([]);
    const [rubrosExtra, setRubrosExtra] = useState<string[]>([]);

    const loadMaestrosGasto = useCallback(async () => {
        try {
            const { data } = await api.get<{ rubros: string[]; proveedores: string[] }>('Contabilidad/gastos/maestros');
            const rubros = Array.isArray(data?.rubros) ? data.rubros : [];
            const proveedores = Array.isArray(data?.proveedores) ? data.proveedores : [];
            setMaestroRubros(rubros);
            setMaestroProveedores(proveedores);
            return { rubros, proveedores };
        } catch (e) {
            console.warn('No se pudieron cargar maestros de contabilidad:', e);
            return { rubros: [] as string[], proveedores: [] as string[] };
        }
    }, []);

    const rubrosListaFormulario = useMemo(() => {
        const custom = [...maestroRubros, ...rubrosExtra].filter((r) => r && !RUBROS_CONTABILIDAD.includes(r));
        const sorted = [...new Set(custom)].sort((a, b) => a.localeCompare(b, 'es'));
        return [...RUBROS_CONTABILIDAD, ...sorted];
    }, [maestroRubros, rubrosExtra]);

    const proveedoresListaFormulario = useMemo(() => {
        const merged = [...new Set([...maestroProveedores, ...proveedoresExtra].filter(Boolean))] as string[];
        merged.sort((a, b) => a.localeCompare(b, 'es'));
        return merged;
    }, [maestroProveedores, proveedoresExtra]);

    const proveedoresDisponibles = useMemo(() => {
        const merged = [...new Set([...proveedoresCatalogo, ...maestroProveedores].filter(Boolean))] as string[];
        merged.sort((a, b) => a.localeCompare(b, 'es'));
        return merged;
    }, [proveedoresCatalogo, maestroProveedores]);

    const [showGastoModal, setShowGastoModal] = useState(false);
    const [savingGasto, setSavingGasto] = useState(false);
    const [editingGastoId, setEditingGastoId] = useState<number | null>(null);
    const [gastoMedioPago, setGastoMedioPago] = useState<'credito' | 'efectivo' | null>(null);
    const [gastoForm, setGastoForm] = useState({
        rubroSel: RUBROS_CONTABILIDAD[0],
        rubroNuevo: '',
        proveedorSel: '',
        proveedorNuevo: '',
        fecha: new Date().toISOString().split('T')[0],
        precioBase: '',
        precioBaseDisplay: '',
        precioIva: '',
        precioIvaDisplay: '',
        numeroFactura: '',
        observaciones: '',
        esPendiente: true,
        facturaPdfUrl: '',
        archivoNombre: '',
    });

    const modulos = [
        { label: 'Todos', value: '', icon: 'all-inclusive' },
        { label: 'Producción', value: 'Producción', icon: 'factory' },
        { label: 'Talleres', value: 'Talleres', icon: 'wrench' },
        { label: 'Mantenimiento', value: 'Mantenimiento', icon: 'tools' },
        { label: 'Gestión Humana', value: 'Gestión Humana', icon: 'account-group' },
        { label: 'SST', value: 'SST', icon: 'shield-check' },
        { label: 'Planeación', value: 'Planeación', icon: 'calendar-check' },
        { label: 'Diseño', value: 'Diseño', icon: 'palette' },
        { label: 'Contabilidad', value: 'Contabilidad', icon: 'cash-plus' },
    ];

    const meses = [
        { label: 'Todo el Año', value: 0 },
        { label: 'Enero', value: 1 },
        { label: 'Febrero', value: 2 },
        { label: 'Marzo', value: 3 },
        { label: 'Abril', value: 4 },
        { label: 'Mayo', value: 5 },
        { label: 'Junio', value: 6 },
        { label: 'Julio', value: 7 },
        { label: 'Agosto', value: 8 },
        { label: 'Septiembre', value: 9 },
        { label: 'Octubre', value: 10 },
        { label: 'Noviembre', value: 11 },
        { label: 'Diciembre', value: 12 },
    ];

    const rubrosDisponibles = useMemo(() => {
        const set = new Set<string>();
        gastos.forEach(g => {
            if (g.rubro) set.add(g.rubro);
        });
        return Array.from(set).sort();
    }, [gastos]);

    const resumenLocal = useMemo<ResumenGastos>(() => {
        const porModulo: Record<string, number> = {};
        const porRubro: Record<string, number> = {};

        for (const item of gastos) {
            porModulo[item.modulo] = (porModulo[item.modulo] || 0) + (item.precio || 0);
            porRubro[item.rubro] = (porRubro[item.rubro] || 0) + (item.precio || 0);
        }

        return {
            totalGeneral: gastos.reduce((acc, item) => acc + (item.precio || 0), 0),
            porModulo,
            porRubro
        };
    }, [gastos]);

    useEffect(() => {
        setFiltroRubro('');
    }, [filtroModulo]);

    useEffect(() => {
        void loadMaestrosGasto();
    }, [loadMaestrosGasto]);

    useEffect(() => {
        if (showGastoModal) void loadMaestrosGasto();
    }, [showGastoModal, loadMaestrosGasto]);

    useEffect(() => {
        const fromGastos = gastos
            .map((g) => (g.proveedor || '').trim())
            .filter(Boolean);
        if (fromGastos.length === 0) return;
        setProveedoresCatalogo((prev) => {
            const next = [...new Set([...prev, ...fromGastos])];
            if (next.length === prev.length && next.every((p, i) => p === prev[i])) return prev;
            return next.sort((a, b) => a.localeCompare(b, 'es'));
        });
    }, [gastos]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (!materializadoMovimientosRef.current) {
                try {
                    await materializarMovimientosAutorizacion();
                } catch (syncErr) {
                    console.warn('Sincronización autorizaciones → movimientos:', syncErr);
                }
                materializadoMovimientosRef.current = true;
            }

            const params: any = { anio: filtroAnio };
            if (filtroMes > 0) params.mes = filtroMes;
            if (filtroModulo) params.modulo = filtroModulo;
            if (filtroPendiente !== null) params.esPendiente = filtroPendiente;
            if (filtroCredito !== null) params.esSolicitudCredito = filtroCredito;
            if (filtroRubro) params.rubro = filtroRubro;
            if (searchQuery) params.search = searchQuery;
            if (fechaFiltro) params.fechaFiltro = fechaFiltro;
            if (filtroEstado) params.estado = filtroEstado;
            if (filtroProveedor) params.proveedor = filtroProveedor;

            const [resGastos, resResumen] = await Promise.all([
                api.get('Contabilidad/gastos-consolidados', { params }),
                api.get('Contabilidad/resumen-financiero', { params })
            ]);
            setGastos(resGastos.data);
            setResumen(resResumen.data);
        } catch (error) {
            console.error('Error fetching accounting data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSolicitudes = async () => {
        setLoadingSolicitudes(true);
        try {
            const moduloKey = filtroModulo && filtroModulo !== 'Contabilidad'
                ? moduloContabilidadToKey(filtroModulo)
                : filtroModulo === 'Contabilidad'
                    ? '__none__'
                    : '';
            if (moduloKey === '__none__') {
                setSolicitudes([]);
                return;
            }
            const data = await getAutorizacionesGastoConsolidado({
                anio: filtroAnio,
                mes: filtroMes > 0 ? filtroMes : undefined,
                modulo: moduloKey || undefined,
                estado: filtroEstado || undefined,
                soloPendientesRevision: !filtroEstado,
                search: searchQuery || undefined,
                proveedor: filtroProveedor || undefined,
                fechaFiltro: fechaFiltro || undefined,
            });
            setSolicitudes(data);
            const fromSolicitudes = data
                .map((s) => (s.proveedorNombre || '').trim())
                .filter(Boolean);
            if (fromSolicitudes.length > 0) {
                setProveedoresCatalogo((prev) => {
                    const next = [...new Set([...prev, ...fromSolicitudes])];
                    return next.sort((a, b) => a.localeCompare(b, 'es'));
                });
            }
        } catch (error) {
            console.error('Error fetching solicitudes autorización:', error);
        } finally {
            setLoadingSolicitudes(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (vistaPrincipal === 'movimientos') {
                fetchData();
            } else {
                fetchSolicitudes();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [vistaPrincipal, filtroAnio, filtroMes, filtroModulo, filtroPendiente, filtroCredito, filtroRubro, searchQuery, fechaFiltro, filtroEstado, filtroProveedor]);

    const resumenSolicitudes = useMemo(() => {
        const pendientes = solicitudes.filter((s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.pendiente).length;
        const autorizadas = solicitudes.filter((s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.autorizada).length;
        const noAutorizadas = solicitudes.filter((s) => s.estadoAutorizacion === ESTADOS_AUTORIZACION.noAutorizada).length;
        const totalMonto = solicitudes.reduce((acc, s) => acc + (s.cantidad || 0), 0);
        return { total: solicitudes.length, pendientes, autorizadas, noAutorizadas, totalMonto };
    }, [solicitudes]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handleUpdateEstado = async (id: number, modulo: string, nuevoEstado: string) => {
        try {
            await api.post('Contabilidad/update-estado', { id, modulo, estado: nuevoEstado });
            setGastos(prev => prev.map(g => (g.id === id && g.modulo === modulo) ? { ...g, estado: nuevoEstado } : g));
        } catch (error) {
            console.error('Error updating status:', error);
            alert('No se pudo actualizar el estado');
        }
    };

    const handlePickIngresoPdf = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];
            const formData = new FormData();

            // En web, el backend espera un File real en multipart.
            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                const webFile = new File([blob], file.name || `ingreso-${Date.now()}.pdf`, { type: 'application/pdf' });
                formData.append('file', webFile);
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name || `ingreso-${Date.now()}.pdf`,
                    type: 'application/pdf'
                } as any);
            }

            const response = await api.post('Contabilidad/upload-ingreso-pdf', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setIngresoForm(prev => ({
                ...prev,
                pdfUrl: response.data?.url || '',
                archivoNombre: file.name || 'PDF cargado'
            }));
        } catch (error) {
            console.error('Error uploading ingreso PDF:', error);
            Alert.alert('Error', 'No se pudo cargar el PDF del ingreso.');
        }
    };

    const handleCrearIngreso = async () => {
        const cantidad = parseFloat((ingresoForm.cantidad || '').replace(',', '.'));

        if (!ingresoForm.motivoIngreso.trim()) {
            Alert.alert('Error', 'Ingrese el motivo del ingreso.');
            return;
        }
        if (!ingresoForm.fecha) {
            Alert.alert('Error', 'Seleccione la fecha del ingreso.');
            return;
        }
        if (!cantidad || cantidad <= 0) {
            Alert.alert('Error', 'La cantidad debe ser mayor a 0.');
            return;
        }

        try {
            setSavingIngreso(true);
            const payload = {
                motivoIngreso: ingresoForm.motivoIngreso.trim(),
                fecha: ingresoForm.fecha,
                cantidad,
                pdfUrl: ingresoForm.pdfUrl || null
            };

            if (editingIngresoId) {
                await api.put(`Contabilidad/ingresos/${editingIngresoId}`, payload);
            } else {
                await api.post('Contabilidad/ingresos', payload);
            }

            setShowIngresoModal(false);
            setEditingIngresoId(null);
            setIngresoForm({
                motivoIngreso: '',
                fecha: new Date().toISOString().split('T')[0],
                cantidad: '',
                cantidadDisplay: '',
                pdfUrl: '',
                archivoNombre: ''
            });
            fetchData();
        } catch (error) {
            console.error('Error creating ingreso:', error);
            Alert.alert('Error', 'No se pudo registrar el ingreso.');
        } finally {
            setSavingIngreso(false);
        }
    };

    const handleEditIngreso = (item: GastoConsolidado) => {
        setEditingIngresoId(item.id);
        const raw = Math.abs(item.precio || 0).toString();
        setIngresoForm({
            motivoIngreso: item.nota || '',
            fecha: (item.fecha || '').split('T')[0] || new Date().toISOString().split('T')[0],
            cantidad: raw,
            cantidadDisplay: formatMiles(raw),
            pdfUrl: item.facturaPdfUrl || '',
            archivoNombre: item.facturaPdfUrl ? 'PDF cargado' : ''
        });
        setShowIngresoModal(true);
    };

    const resetIngresoModal = () => {
        setEditingIngresoId(null);
        setShowGastoModal(false);
        setIngresoForm({
            motivoIngreso: '',
            fecha: new Date().toISOString().split('T')[0],
            cantidad: '',
            cantidadDisplay: '',
            pdfUrl: '',
            archivoNombre: ''
        });
        setShowIngresoModal(false);
    };

    const handleDeleteIngreso = async (item: GastoConsolidado) => {
        const doDelete = async () => {
            try {
                await api.delete(`Contabilidad/ingresos/${item.id}`);
                fetchData();
            } catch (error) {
                console.error('Error deleting ingreso:', error);
                Alert.alert('Error', 'No se pudo borrar el ingreso.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Seguro que desea borrar este ingreso?')) await doDelete();
            return;
        }
        Alert.alert('Confirmar', '¿Seguro que desea borrar este ingreso?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Borrar', style: 'destructive', onPress: doDelete }
        ]);
    };

    const formatMiles = (value: string) => {
        if (!value) return '';
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(numericValue, 10));
    };

    const rubroFinalContabilidad = () => {
        if (gastoForm.rubroSel === RUBRO_AGREGAR) return gastoForm.rubroNuevo.trim();
        return gastoForm.rubroSel.trim();
    };

    const proveedorFinalContabilidad = () => {
        if (gastoForm.proveedorSel === PROVEEDOR_AGREGAR) return gastoForm.proveedorNuevo.trim();
        return gastoForm.proveedorSel.trim();
    };

    const resetGastoModal = () => {
        setEditingGastoId(null);
        setGastoMedioPago(null);
        setGastoForm({
            rubroSel: RUBROS_CONTABILIDAD[0],
            rubroNuevo: '',
            proveedorSel: '',
            proveedorNuevo: '',
            fecha: new Date().toISOString().split('T')[0],
            precioBase: '',
            precioBaseDisplay: '',
            precioIva: '',
            precioIvaDisplay: '',
            numeroFactura: '',
            observaciones: '',
            esPendiente: true,
            facturaPdfUrl: '',
            archivoNombre: '',
        });
        setShowGastoModal(false);
    };

    const handlePickGastoPdf = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            const file = result.assets[0];
            const formData = new FormData();
            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                const webFile = new File([blob], file.name || `gasto-${Date.now()}.pdf`, { type: 'application/pdf' });
                formData.append('file', webFile);
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name || `gasto-${Date.now()}.pdf`,
                    type: 'application/pdf',
                } as any);
            }
            const response = await api.post('Contabilidad/upload-factura-gasto', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setGastoForm((prev) => ({
                ...prev,
                facturaPdfUrl: response.data?.url || '',
                archivoNombre: file.name || 'PDF cargado',
            }));
        } catch (error) {
            console.error('Error uploading gasto PDF:', error);
            Alert.alert('Error', 'No se pudo cargar el PDF de la factura.');
        }
    };

    const handleSaveGastoContabilidad = async () => {
        const rubro = rubroFinalContabilidad();
        if (!rubro) {
            Alert.alert('Error', 'Elija un rubro o use «Agregar rubro», escriba el nombre y añádalo a la lista (o guarde con el nombre escrito).');
            return;
        }
        const proveedor = proveedorFinalContabilidad();
        if (!proveedor) {
            Alert.alert('Error', 'Seleccione un proveedor o use «Agregar proveedor», escriba el nombre y añádalo a la lista.');
            return;
        }
        if (!gastoForm.fecha) {
            Alert.alert('Error', 'Seleccione la fecha del gasto.');
            return;
        }
        if (gastoMedioPago !== 'credito' && gastoMedioPago !== 'efectivo') {
            showAlertMedioPagoRequerido();
            return;
        }
        const pb = parseMontoInput(gastoForm.precioBase);
        const pi = parseMontoInput(gastoForm.precioIva);
        if (pb === null || pi === null) {
            Alert.alert('Error', 'Indique precio base e IVA (el IVA puede ser 0).');
            return;
        }
        const flags = medioPagoToFlags(gastoMedioPago);
        const payload = {
            rubro,
            proveedor,
            numeroFactura: gastoForm.numeroFactura.trim() || null,
            precio: pb + pi,
            precioBase: pb,
            precioIva: pi,
            fecha: gastoForm.fecha,
            observaciones: gastoForm.observaciones.trim() || null,
            facturaPdfUrl: gastoForm.facturaPdfUrl || null,
            esPendiente: gastoForm.esPendiente,
            esSolicitudCredito: flags.esSolicitudCredito,
            esEfectivo: flags.esEfectivo,
        };
        try {
            setSavingGasto(true);
            if (editingGastoId) {
                await api.put(`Contabilidad/gastos/${editingGastoId}`, payload);
            } else {
                await api.post('Contabilidad/gastos', payload);
            }
            resetGastoModal();
            await loadMaestrosGasto();
            fetchData();
        } catch (error) {
            console.error('Error saving contabilidad gasto:', error);
            Alert.alert('Error', 'No se pudo guardar el gasto. Revise los datos o la conexión.');
        } finally {
            setSavingGasto(false);
        }
    };

    const handleEditGastoContabilidad = async (item: GastoConsolidado) => {
        const { rubros: rDb, proveedores: pDb } = await loadMaestrosGasto();
        const customRubros = [...new Set([...rDb, ...rubrosExtra].filter((r) => r && !RUBROS_CONTABILIDAD.includes(r)))].sort((a, b) =>
            a.localeCompare(b, 'es')
        );
        const listaRubros = [...RUBROS_CONTABILIDAD, ...customRubros];
        const rub = (item.rubro || '').trim();
        const rubroSel = rub && listaRubros.includes(rub) ? rub : rub ? RUBRO_AGREGAR : RUBROS_CONTABILIDAD[0];
        const rubroNuevo = rubroSel === RUBRO_AGREGAR ? rub : '';

        const mergedProv = [...new Set([...pDb, ...proveedoresExtra, (item.proveedor || '').trim()].filter(Boolean))] as string[];
        mergedProv.sort((a, b) => a.localeCompare(b, 'es'));
        const prov = (item.proveedor || '').trim();
        const proveedorSel = prov ? (mergedProv.includes(prov) ? prov : PROVEEDOR_AGREGAR) : '';
        const proveedorNuevo = prov && proveedorSel === PROVEEDOR_AGREGAR ? prov : '';

        const pb = item.precioBase != null ? String(Math.round(Number(item.precioBase))) : '';
        const pi = item.precioIva != null ? String(Math.round(Number(item.precioIva))) : '';
        setEditingGastoId(item.id);
        setGastoMedioPago(flagsToMedioPago(!!item.esSolicitudCredito, !!item.esEfectivo));
        setGastoForm({
            rubroSel,
            rubroNuevo,
            proveedorSel,
            proveedorNuevo,
            fecha: (item.fecha || '').split('T')[0] || new Date().toISOString().split('T')[0],
            precioBase: pb,
            precioBaseDisplay: pb ? formatMiles(pb) : '',
            precioIva: pi,
            precioIvaDisplay: pi ? formatMiles(pi) : '',
            numeroFactura: item.numeroFactura || '',
            observaciones: item.nota || '',
            esPendiente: !!item.esPendiente,
            facturaPdfUrl: item.facturaPdfUrl || '',
            archivoNombre: item.facturaPdfUrl ? 'PDF cargado' : '',
        });
        setShowGastoModal(true);
    };

    const handleDeleteGastoContabilidad = async (item: GastoConsolidado) => {
        const doDelete = async () => {
            try {
                await api.delete(`Contabilidad/gastos/${item.id}`);
                fetchData();
            } catch (error) {
                console.error('Error deleting gasto:', error);
                Alert.alert('Error', 'No se pudo borrar el gasto.');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Seguro que desea borrar este gasto de contabilidad?')) await doDelete();
            return;
        }
        Alert.alert('Confirmar', '¿Seguro que desea borrar este gasto?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Borrar', style: 'destructive', onPress: doDelete },
        ]);
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Pagado': return '#10B981';
            case 'Entregado': return '#3B82F6';
            case 'Montado': return '#6B7280';
            default: return '#6B7280';
        }
    };

    const renderResumenCard = (title: string, value: number, icon: string, color: string, asCount = false) => (
        <View style={[styles.resumenCard, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderColor: isDarkMode ? '#1F2937' : '#E2E8F0' }]}>
            <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon as any} size={24} color={color} />
            </View>
            <View style={styles.resumenInfo}>
                <Text style={[styles.resumenLabel, { color: colors.subText }]}>{title}</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                    {asCount ? String(value) : formatCurrency(value)}
                </Text>
            </View>
        </View>
    );

    const handleOpenPdf = async (url: string) => {
        if (!url) return;
        
        try {
            // Check if it's base64
            if (url.startsWith('data:application/pdf;base64,')) {
                Linking.openURL(url).catch(err => console.error("Error opening PDF:", err));
                return;
            }

            // If it's already a full URL
            if (url.startsWith('http')) {
                Linking.openURL(url).catch(err => console.error("Error opening PDF:", err));
                return;
            }

            // Build full URL using apiConfig helper
            const serverUrl = await getFileServerUrl();
            const fullUrl = `${serverUrl}/${url.startsWith('/') ? url.substring(1) : url}`;
            
            console.log("[DEBUG] Opening PDF:", fullUrl);
            Linking.openURL(fullUrl).catch(err => console.error("Error opening PDF:", err));
        } catch (error) {
            console.error("Error building PDF URL:", error);
        }
    };

    const renderExportExcelOpciones = () => (
        <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>Incluir horas extras y recargos</Text>
                <Switch
                    value={exportIncluirHorasExtrasRecargos}
                    onValueChange={setExportIncluirHorasExtrasRecargos}
                    trackColor={{ false: '#767577', true: isDarkMode ? '#4B5563' : '#C4B5FD' }}
                    thumbColor={exportIncluirHorasExtrasRecargos ? (isDarkMode ? '#A78BFA' : '#7C3AED') : '#f4f3f4'}
                />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>Incluir ingresos</Text>
                <Switch
                    value={exportIncluirIngresos}
                    onValueChange={setExportIncluirIngresos}
                    trackColor={{ false: '#767577', true: isDarkMode ? '#4B5563' : '#C4B5FD' }}
                    thumbColor={exportIncluirIngresos ? (isDarkMode ? '#A78BFA' : '#7C3AED') : '#f4f3f4'}
                />
            </View>
            <Text style={{ fontSize: 12, color: colors.subText, lineHeight: 18 }}>
                Si desactiva una opción, esos registros no se incluirán en el Excel (detalle y resúmenes).
            </Text>
        </View>
    );

    const handleExportExcel = async () => {
        try {
            const exportPorRango = !!(exportRange.fechaInicio && exportRange.fechaFin);
            const params: any = { anio: filtroAnio };
            if (filtroMes > 0) params.mes = filtroMes;
            if (filtroModulo) params.modulo = filtroModulo;
            if (filtroPendiente !== null) params.esPendiente = filtroPendiente;
            if (filtroCredito !== null) params.esSolicitudCredito = filtroCredito;
            if (filtroRubro) params.rubro = filtroRubro;
            if (searchQuery) params.search = searchQuery;
            if (fechaFiltro && !exportPorRango) params.fechaFiltro = fechaFiltro;
            if (filtroEstado) params.estado = filtroEstado;
            if (filtroProveedor) params.proveedor = filtroProveedor;
            if (exportRange.fechaInicio) params.fechaInicio = exportRange.fechaInicio;
            if (exportRange.fechaFin) params.fechaFin = exportRange.fechaFin;
            params.incluirHorasExtrasRecargos = exportIncluirHorasExtrasRecargos;
            params.incluirIngresos = exportIncluirIngresos;

            const response = await api.get('Contabilidad/export-excel', {
                params,
                responseType: 'blob'
            });

            if (Platform.OS === 'web') {
                const blob = new Blob([response.data], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = exportPorRango
                    ? `Contabilidad_Gastos_${exportRange.fechaInicio}_a_${exportRange.fechaFin}.xlsx`
                    : `Contabilidad_Gastos_${filtroAnio}_${String(filtroMes || 0).padStart(2, '0')}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
            setShowExportModal(false);
        } catch (error) {
            console.error('Error exporting excel:', error);
            Alert.alert('Error', 'No se pudo exportar el Excel.');
        }
    };

    const renderContabilidadGastoForm = () => {
        const pbPrev = parseMontoInput(gastoForm.precioBase);
        const piPrev = parseMontoInput(gastoForm.precioIva);
        const totalPrev = pbPrev !== null && piPrev !== null ? pbPrev + piPrev : null;

        const webSelectBox: CSSProperties = {
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer',
            colorScheme: isDarkMode ? 'dark' : 'light',
            border: `1px solid ${isDarkMode ? '#4B5563' : '#CBD5E1'}`,
            backgroundColor: isDarkMode ? '#1F2937' : '#F8FAFC',
            color: isDarkMode ? '#F3F4F6' : '#0F172A',
            outline: 'none',
            boxSizing: 'border-box',
        };
        const webOptionStyle: CSSProperties = {
            backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
            color: isDarkMode ? '#F3F4F6' : '#0F172A',
        };

        const incorporarProveedor = () => {
            const t = gastoForm.proveedorNuevo.trim();
            if (!t) {
                if (Platform.OS === 'web') window.alert('Escriba el nombre del proveedor.');
                else Alert.alert('Error', 'Escriba el nombre del proveedor.');
                return;
            }
            setProveedoresExtra((prev) => [...new Set([...prev, t])]);
            setGastoForm((prev) => ({ ...prev, proveedorSel: t, proveedorNuevo: '' }));
        };

        const incorporarRubro = () => {
            const t = gastoForm.rubroNuevo.trim();
            if (!t) {
                if (Platform.OS === 'web') window.alert('Escriba el nombre del rubro.');
                else Alert.alert('Error', 'Escriba el nombre del rubro.');
                return;
            }
            setRubrosExtra((prev) => [...new Set([...prev, t])]);
            setGastoForm((prev) => ({ ...prev, rubroSel: t, rubroNuevo: '' }));
        };

        return (
            <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', maxHeight: Platform.OS === 'web' ? ('85vh' as any) : undefined }]}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                        {editingGastoId ? 'Editar gasto (Contabilidad)' : 'Nuevo gasto (Contabilidad)'}
                    </Text>

                    <Text style={[styles.modalLabel, { color: colors.subText }]}>Rubro *</Text>
                    {Platform.OS === 'web' ? (
                        <select
                            value={gastoForm.rubroSel}
                            onChange={(e) => setGastoForm((prev) => ({ ...prev, rubroSel: e.target.value, rubroNuevo: '' }))}
                            style={webSelectBox}
                        >
                            {rubrosListaFormulario.map((r) => (
                                <option key={r} value={r} style={webOptionStyle}>
                                    {r}
                                </option>
                            ))}
                            <option value={RUBRO_AGREGAR} style={webOptionStyle}>
                                ➕ Agregar rubro
                            </option>
                        </select>
                    ) : (
                        <View style={[styles.modalInput, { borderColor: isDarkMode ? '#374151' : '#D1D5DB', paddingVertical: 4 }]}>
                            <Picker
                                selectedValue={gastoForm.rubroSel}
                                onValueChange={(v) => setGastoForm((prev) => ({ ...prev, rubroSel: v, rubroNuevo: '' }))}
                                dropdownIconColor={isDarkMode ? '#E5E7EB' : '#334155'}
                            >
                                {rubrosListaFormulario.map((r) => (
                                    <Picker.Item key={r} label={r} value={r} color={isDarkMode ? '#F3F4F6' : '#0F172A'} />
                                ))}
                                <Picker.Item label="➕ Agregar rubro" value={RUBRO_AGREGAR} color={isDarkMode ? '#F3F4F6' : '#0F172A'} />
                            </Picker>
                        </View>
                    )}

                    {gastoForm.rubroSel === RUBRO_AGREGAR && (
                        <View style={{ marginTop: 10 }}>
                            <TextInput
                                style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                placeholder="Nombre del rubro"
                                placeholderTextColor={colors.subText}
                                value={gastoForm.rubroNuevo}
                                onChangeText={(v) => setGastoForm((prev) => ({ ...prev, rubroNuevo: v }))}
                            />
                            <TouchableOpacity style={[styles.miniAddBtn, { marginTop: 8 }]} onPress={incorporarRubro}>
                                <Text style={styles.miniAddBtnText}>Añadir rubro a la lista</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text style={[styles.modalLabel, { color: colors.subText, marginTop: 12 }]}>Proveedor *</Text>
                    {Platform.OS === 'web' ? (
                        <select
                            value={gastoForm.proveedorSel}
                            onChange={(e) => setGastoForm((prev) => ({ ...prev, proveedorSel: e.target.value, proveedorNuevo: '' }))}
                            style={webSelectBox}
                        >
                            <option value="" style={webOptionStyle}>
                                — Seleccione —
                            </option>
                            <option value={PROVEEDOR_AGREGAR} style={webOptionStyle}>
                                ➕ Agregar proveedor
                            </option>
                            {proveedoresListaFormulario.map((p) => (
                                <option key={p} value={p} style={webOptionStyle}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <View style={[styles.modalInput, { borderColor: isDarkMode ? '#374151' : '#D1D5DB', paddingVertical: 4 }]}>
                            <Picker
                                selectedValue={gastoForm.proveedorSel || ''}
                                onValueChange={(v) => setGastoForm((prev) => ({ ...prev, proveedorSel: v, proveedorNuevo: '' }))}
                                dropdownIconColor={isDarkMode ? '#E5E7EB' : '#334155'}
                            >
                                <Picker.Item label="— Seleccione —" value="" color={isDarkMode ? '#9CA3AF' : '#64748B'} />
                                <Picker.Item label="➕ Agregar proveedor" value={PROVEEDOR_AGREGAR} color={isDarkMode ? '#F3F4F6' : '#0F172A'} />
                                {proveedoresListaFormulario.map((p) => (
                                    <Picker.Item key={p} label={p} value={p} color={isDarkMode ? '#F3F4F6' : '#0F172A'} />
                                ))}
                            </Picker>
                        </View>
                    )}

                    {gastoForm.proveedorSel === PROVEEDOR_AGREGAR && (
                        <View style={{ marginTop: 10 }}>
                            <TextInput
                                style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                placeholder="Nombre del proveedor"
                                placeholderTextColor={colors.subText}
                                value={gastoForm.proveedorNuevo}
                                onChangeText={(v) => setGastoForm((prev) => ({ ...prev, proveedorNuevo: v }))}
                            />
                            <TouchableOpacity style={[styles.miniAddBtn, { marginTop: 8 }]} onPress={incorporarProveedor}>
                                <Text style={styles.miniAddBtnText}>Añadir proveedor a la lista</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text style={[styles.modalLabel, { color: colors.subText, marginTop: 12 }]}>Fecha *</Text>
                    {Platform.OS === 'web' ? (
                        <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                            <input
                                type="date"
                                value={gastoForm.fecha}
                                onChange={(e) => setGastoForm((prev) => ({ ...prev, fecha: e.target.value }))}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    color: isDarkMode ? '#FFFFFF' : '#111827',
                                    fontSize: 14,
                                }}
                            />
                        </View>
                    ) : (
                        <TextInput
                            style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                            value={gastoForm.fecha}
                            onChangeText={(v) => setGastoForm((prev) => ({ ...prev, fecha: v }))}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.subText}
                        />
                    )}

                    <Text style={[styles.modalLabel, { color: colors.subText }]}>Precio base *</Text>
                    <TextInput
                        style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                        placeholder="Ej: 1000000"
                        placeholderTextColor={colors.subText}
                        value={gastoForm.precioBaseDisplay}
                        keyboardType="numeric"
                        onChangeText={(v) => {
                            const raw = v.replace(/[^0-9]/g, '');
                            setGastoForm((prev) => ({
                                ...prev,
                                precioBase: raw,
                                precioBaseDisplay: formatMiles(raw),
                            }));
                        }}
                    />

                    <Text style={[styles.modalLabel, { color: colors.subText }]}>IVA *</Text>
                    <TextInput
                        style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                        placeholder="Ej: 190000 (0 si no aplica)"
                        placeholderTextColor={colors.subText}
                        value={gastoForm.precioIvaDisplay}
                        keyboardType="numeric"
                        onChangeText={(v) => {
                            const raw = v.replace(/[^0-9]/g, '');
                            setGastoForm((prev) => ({
                                ...prev,
                                precioIva: raw,
                                precioIvaDisplay: formatMiles(raw),
                            }));
                        }}
                    />

                    {totalPrev !== null && (
                        <Text style={{ marginTop: 6, color: colors.subText, fontSize: 13, fontWeight: '600' }}>
                            Total (base + IVA): {formatCurrency(totalPrev)}
                        </Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 }}>
                        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>Legalización pendiente (sin factura / soporte completo)</Text>
                        <Switch
                            value={gastoForm.esPendiente}
                            onValueChange={(v) => setGastoForm((prev) => ({ ...prev, esPendiente: v }))}
                            trackColor={{ false: '#767577', true: isDarkMode ? '#4B5563' : '#C4B5FD' }}
                            thumbColor={gastoForm.esPendiente ? (isDarkMode ? '#A78BFA' : '#7C3AED') : '#f4f3f4'}
                        />
                    </View>

                    <MedioPagoGastoControls
                        value={gastoMedioPago}
                        onChange={setGastoMedioPago}
                        colors={{
                            text: colors.text,
                            subText: colors.subText,
                            primary: colors.primary,
                            border: isDarkMode ? '#374151' : '#D1D5DB',
                            card: isDarkMode ? '#1F2937' : '#FFFFFF',
                        }}
                    />

                    <Text style={[styles.modalLabel, { color: colors.subText }]}>Número de factura</Text>
                    <TextInput
                        style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                        placeholder="Opcional si está pendiente"
                        placeholderTextColor={colors.subText}
                        value={gastoForm.numeroFactura}
                        onChangeText={(v) => setGastoForm((prev) => ({ ...prev, numeroFactura: v }))}
                    />

                    <Text style={[styles.modalLabel, { color: colors.subText }]}>Observaciones</Text>
                    <TextInput
                        style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB', minHeight: 64 }]}
                        placeholder="Detalle del gasto"
                        placeholderTextColor={colors.subText}
                        value={gastoForm.observaciones}
                        onChangeText={(v) => setGastoForm((prev) => ({ ...prev, observaciones: v }))}
                        multiline
                    />

                    <Text style={[styles.modalLabel, { color: colors.subText }]}>PDF factura (opcional)</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={handlePickGastoPdf}>
                        <MaterialCommunityIcons name="file-pdf-box" size={16} color="#FFFFFF" />
                        <Text style={styles.uploadButtonText}>{gastoForm.archivoNombre || 'Subir PDF'}</Text>
                    </TouchableOpacity>
                </ScrollView>

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={resetGastoModal}>
                        <Text style={styles.modalCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveGastoContabilidad} disabled={savingGasto}>
                        <Text style={styles.modalSaveText}>{savingGasto ? 'Guardando...' : editingGastoId ? 'Guardar cambios' : 'Guardar gasto'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderGastoItem = ({ item }: { item: GastoConsolidado }) => {
        const isIngresoRecord = !!item.esIngreso || (item.modulo === 'Contabilidad' && item.rubro === 'Ingreso');
        const isContabilidadGasto = item.modulo === 'Contabilidad' && !isIngresoRecord;
        return (
        <View style={[styles.gastoItem, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', borderBottomColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
            <View style={styles.gastoMain}>
                <View style={styles.gastoHeader}>
                    <View style={[styles.moduloTag, { backgroundColor: getModuloColor(item.modulo) + '20' }]}>
                        <Text style={[styles.moduloTagText, { color: getModuloColor(item.modulo) }]}>{item.modulo.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.gastoFecha, { color: colors.subText }]}>{new Date(item.fecha).toLocaleDateString()}</Text>
                    {item.esPendiente && (
                        <View style={[styles.statusTag, { backgroundColor: '#EF444420' }]}>
                            <Text style={[styles.statusTagText, { color: '#EF4444' }]}>PENDIENTE</Text>
                        </View>
                    )}
                    {!isIngresoRecord && !item.esLabor && (
                        <MedioPagoBadge
                            esSolicitudCredito={!!item.esSolicitudCredito}
                            esEfectivo={!!item.esEfectivo}
                            compact
                        />
                    )}
                    
                    {!isIngresoRecord && !item.esLabor && (
                        <TouchableOpacity 
                            onPress={() => {
                                const states = ['Montado', 'Entregado', 'Pagado'];
                                const currentEstado = item.estado || 'Montado';
                                const nextIndex = (states.indexOf(currentEstado) + 1) % states.length;
                                handleUpdateEstado(item.id, item.modulo, states[nextIndex]);
                            }}
                            style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) + '20', borderColor: getEstadoColor(item.estado) }]}
                        >
                            <Text style={[styles.estadoBadgeText, { color: getEstadoColor(item.estado) }]}>
                                {(item.estado || 'MONTADO').toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={[styles.gastoRubro, { color: colors.text }]}>{item.rubro}</Text>
                <Text style={[styles.gastoProveedor, { color: colors.subText }]}>
                    {item.proveedor || 'Sin Proveedor'} 
                    {item.numeroFactura ? ` • Fact: ${item.numeroFactura}` : ''}
                    {item.numeroOP ? ` • OP: ${item.numeroOP}` : ''}
                </Text>
                {(item.maquina || item.personal) && (
                    <Text style={[styles.gastoDetalle, { color: colors.subText }]}>
                        {item.maquina ? `🚜 ${item.maquina}` : ''}
                        {item.maquina && item.personal ? ' • ' : ''}
                        {item.personal ? `👤 ${item.personal}` : ''}
                    </Text>
                )}
                {item.registradoPor && (
                    <Text style={[styles.gastoAutor, { color: colors.subText }]}>
                        Registrado por: {item.registradoPor}
                    </Text>
                )}
                {item.nota && <Text style={[styles.gastoNota, { color: colors.subText }]} numberOfLines={1}>{item.nota}</Text>}
            </View>
            <View style={styles.gastoPriceContainer}>
                {isIngresoRecord ? (
                    <Text style={[styles.gastoPrice, { color: '#10B981' }]}>
                        {`+ ${formatCurrency(Math.abs(item.precio))}`}
                    </Text>
                ) : (
                    <GastoListaPrecios
                        gasto={item}
                        singlePriceRow={item.esLabor}
                        formatCurrency={formatCurrency}
                        precioStyle={[styles.gastoPrice, { color: colors.text }]}
                        theme={isDarkMode ? 'dark' : 'light'}
                    />
                )}
                {item.facturaPdfUrl && (
                    <TouchableOpacity 
                        style={styles.pdfButton} 
                        onPress={() => handleOpenPdf(item.facturaPdfUrl!)}
                    >
                        <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFFFFF" />
                        <Text style={styles.pdfButtonText}>VER FACTURA</Text>
                    </TouchableOpacity>
                )}
                {isIngresoRecord && (
                    <View style={styles.ingresoActions}>
                        <TouchableOpacity style={[styles.ingresoActionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => handleEditIngreso(item)}>
                            <Text style={styles.ingresoActionText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.ingresoActionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleDeleteIngreso(item)}>
                            <Text style={styles.ingresoActionText}>Borrar</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {isContabilidadGasto && gastoPermiteEdicionTrasContabilidad(item) && (
                    <View style={styles.ingresoActions}>
                        <TouchableOpacity style={[styles.ingresoActionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => handleEditGastoContabilidad(item)}>
                            <Text style={styles.ingresoActionText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.ingresoActionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleDeleteGastoContabilidad(item)}>
                            <Text style={styles.ingresoActionText}>Borrar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
    };

    const renderSolicitudItem = ({ item }: { item: SolicitudAutorizacion }) => {
        const moduloLabel = etiquetaModuloGasto(item.modulo);
        const estadoColor = colorEstadoAutorizacion(item.estadoAutorizacion);
        const fechaSol = item.fechaSolicitud ? new Date(item.fechaSolicitud).toLocaleDateString() : '—';
        return (
            <View style={[styles.gastoItem, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', borderBottomColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                <View style={styles.gastoMain}>
                    <View style={styles.gastoHeader}>
                        <View style={[styles.moduloTag, { backgroundColor: getModuloColor(moduloLabel) + '20' }]}>
                            <Text style={[styles.moduloTagText, { color: getModuloColor(moduloLabel) }]}>{moduloLabel.toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.gastoFecha, { color: colors.subText }]}>{fechaSol}</Text>
                        <View style={[styles.statusTag, { backgroundColor: estadoColor + '20' }]}>
                            <Text style={[styles.statusTagText, { color: estadoColor }]}>
                                {labelEstadoAutorizacion(item.estadoAutorizacion).toUpperCase()}
                            </Text>
                        </View>
                        <MedioPagoBadge
                            esSolicitudCredito={!!item.esSolicitudCredito}
                            esEfectivo={!!item.esEfectivo}
                            compact
                        />
                        {item.gastoId && (
                            <View style={[styles.statusTag, { backgroundColor: '#10B98120' }]}>
                                <Text style={[styles.statusTagText, { color: '#10B981' }]}>GASTO REGISTRADO</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.gastoRubro, { color: colors.text }]}>{item.rubroNombre || 'Sin rubro'}</Text>
                    <Text style={[styles.gastoProveedor, { color: colors.subText }]}>
                        {item.proveedorNombre || 'Sin proveedor'}
                        {item.fechaAproximada ? ` • Fecha aprox.: ${new Date(item.fechaAproximada).toLocaleDateString()}` : ''}
                    </Text>
                    {item.solicitadoPorNombre && (
                        <Text style={[styles.gastoAutor, { color: colors.subText }]}>
                            Solicitado por: {item.solicitadoPorNombre}
                        </Text>
                    )}
                    {item.autorizadoPorNombre && item.estadoAutorizacion !== ESTADOS_AUTORIZACION.pendiente && (
                        <Text style={[styles.gastoAutor, { color: colors.subText }]}>
                            {item.estadoAutorizacion === ESTADOS_AUTORIZACION.autorizada ? 'Autorizado' : 'Revisado'} por: {item.autorizadoPorNombre}
                            {item.fechaResolucion ? ` • ${new Date(item.fechaResolucion).toLocaleDateString()}` : ''}
                        </Text>
                    )}
                    {item.motivoRechazo && item.estadoAutorizacion === ESTADOS_AUTORIZACION.noAutorizada && (
                        <Text style={[styles.gastoNota, { color: '#EF4444' }]} numberOfLines={2}>
                            Motivo: {item.motivoRechazo}
                        </Text>
                    )}
                    {item.razon && (
                        <Text style={[styles.gastoNota, { color: colors.subText }]} numberOfLines={2}>{item.razon}</Text>
                    )}
                </View>
                <View style={styles.gastoPriceContainer}>
                    <Text style={[styles.gastoPrice, { color: colors.text }]}>
                        {formatCurrency(item.cantidad || 0)}
                    </Text>
                </View>
            </View>
        );
    };

    const getModuloColor = (modulo: string) => {
        switch (modulo) {
            case 'Producción': return '#3B82F6';
            case 'Talleres': return '#10B981';
            case 'Mantenimiento': return '#F59E0B';
            case 'Gestión Humana': return '#8B5CF6';
            case 'SST': return '#EF4444';
            case 'Planeación': return '#EC4899';
            case 'Diseño': return '#06B6D4';
            case 'Contabilidad': return '#A855F7';
            default: return '#6B7280';
        }
    };

    if (loading && !resumen && vistaPrincipal === 'movimientos') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.subText }}>Cargando consolidado...</Text>
            </View>
        );
    }

    if (loadingSolicitudes && solicitudes.length === 0 && vistaPrincipal === 'solicitudes') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.subText }}>Cargando solicitudes...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: isDarkMode ? colors.background : '#F8FAFC' }]}>
            {/* Minimalist Interactive Filter Toolbar */}
            <View style={[styles.toolbar, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderBottomColor: isDarkMode ? '#1F2937' : '#E2E8F0' }]}>
                {/* Vista: Movimientos | Solicitudes */}
                <View style={[styles.toolbarRow, { marginBottom: 8 }]}>
                    <TouchableOpacity
                        style={[
                            styles.vistaTab,
                            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', borderColor: isDarkMode ? '#374151' : '#CBD5E1' },
                            vistaPrincipal === 'movimientos' && styles.vistaTabActive,
                        ]}
                        onPress={() => { setVistaPrincipal('movimientos'); setFiltroEstado(''); }}
                    >
                        <MaterialCommunityIcons name="cash-multiple" size={16} color={vistaPrincipal === 'movimientos' ? '#FFF' : colors.subText} />
                        <Text style={[styles.vistaTabText, vistaPrincipal === 'movimientos' && styles.vistaTabTextActive]}>Movimientos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.vistaTab,
                            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', borderColor: isDarkMode ? '#374151' : '#CBD5E1' },
                            vistaPrincipal === 'solicitudes' && styles.vistaTabActive,
                        ]}
                        onPress={() => { setVistaPrincipal('solicitudes'); setFiltroEstado(''); setFiltroRubro(''); setFiltroPendiente(null); setFiltroCredito(null); }}
                    >
                        <MaterialCommunityIcons name="clipboard-text-clock" size={16} color={vistaPrincipal === 'solicitudes' ? '#FFF' : colors.subText} />
                        <Text style={[styles.vistaTabText, vistaPrincipal === 'solicitudes' && styles.vistaTabTextActive]}>Solicitudes</Text>
                    </TouchableOpacity>
                </View>
                {/* Row 1: Period, Search & Date */}
                <View style={styles.toolbarRow}>
                    <View style={styles.periodGroup}>
                        <TouchableOpacity 
                            style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]}
                            onPress={() => setFiltroAnio(filtroAnio === 2026 ? 2025 : 2026)} 
                        >
                            <MaterialCommunityIcons name="calendar" size={16} color={colors.primary} />
                            <Text style={[styles.compactSelectText, { color: colors.text }]}>{filtroAnio}</Text>
                        </TouchableOpacity>
                        
                        <View style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                            <select 
                                value={filtroMes} 
                                onChange={(e) => setFiltroMes(parseInt(e.target.value))}
                                style={{ 
                                    background: isDarkMode ? '#1F2937' : '#F1F5F9', 
                                    color: isDarkMode ? '#FFF' : '#334155', 
                                    border: 'none', 
                                    fontSize: '14px', 
                                    fontWeight: '700',
                                    padding: '0 12px',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '8px',
                                    WebkitAppearance: 'none',
                                    colorScheme: isDarkMode ? 'dark' : 'light'
                                }}
                            >
                                {meses.map(m => (
                                    <option key={m.value} value={m.value} style={{ background: isDarkMode ? '#1F2937' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </View>
                    </View>

                    <View style={[styles.searchBar, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]}>
                        <MaterialCommunityIcons name="magnify" size={18} color={colors.subText} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Buscar..."
                            placeholderTextColor={colors.subText}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <View style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]}>
                        <MaterialCommunityIcons name="calendar-search" size={16} color={colors.primary} />
                        <TextInput
                            type="date"
                            style={[styles.miniDateInput, { color: colors.text }]}
                            value={fechaFiltro}
                            onChangeText={setFechaFiltro}
                        />
                    </View>
                </View>

                {/* Row 2: Area & Rubro Selectors */}
                <View style={styles.toolbarRow}>
                    <View style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', overflow: 'hidden' }]}>
                        <Text style={styles.miniLabel}>ÁREA:</Text>
                        <select 
                            value={filtroModulo} 
                            onChange={(e) => setFiltroModulo(e.target.value)}
                            style={{ 
                                background: 'transparent', 
                                color: isDarkMode ? '#FFF' : '#334155', 
                                border: 'none', 
                                fontSize: '12px', 
                                fontWeight: '700',
                                outline: 'none',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                colorScheme: isDarkMode ? 'dark' : 'light'
                            }}
                        >
                            {modulos.map(m => (
                                <option key={m.value} value={m.value} style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </View>

                    {vistaPrincipal === 'movimientos' && (
                    <View style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', overflow: 'hidden' }]}>
                        <Text style={styles.miniLabel}>TIPO:</Text>
                        <select 
                            value={filtroRubro} 
                            onChange={(e) => setFiltroRubro(e.target.value)}
                            style={{ 
                                background: 'transparent', 
                                color: isDarkMode ? '#FFF' : '#334155', 
                                border: 'none', 
                                fontSize: '12px', 
                                fontWeight: '700',
                                outline: 'none',
                                maxWidth: '150px',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                colorScheme: isDarkMode ? 'dark' : 'light'
                            }}
                        >
                            <option value="" style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Todos</option>
                            {rubrosDisponibles.map(r => (
                                <option key={r} value={r} style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </View>
                    )}
                    
                    <View style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', overflow: 'hidden' }]}>
                        <Text style={styles.miniLabel}>ESTADO:</Text>
                        <select 
                            value={filtroEstado} 
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            style={{ 
                                background: 'transparent', 
                                color: isDarkMode ? '#FFF' : '#334155', 
                                border: 'none', 
                                fontSize: '12px', 
                                fontWeight: '700',
                                outline: 'none',
                                maxWidth: '120px',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                colorScheme: isDarkMode ? 'dark' : 'light'
                            }}
                        >
                            <option value="" style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>
                                {vistaPrincipal === 'solicitudes' ? 'Activas (sin autorizar)' : 'Todos'}
                            </option>
                            {vistaPrincipal === 'movimientos' ? (
                                <>
                                    <option value="Montado" style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Montado</option>
                                    <option value="Entregado" style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Entregado</option>
                                    <option value="Pagado" style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Pagado</option>
                                </>
                            ) : (
                                <>
                                    <option value={ESTADOS_AUTORIZACION.pendiente} style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Pendiente</option>
                                    <option value={ESTADOS_AUTORIZACION.autorizada} style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Autorizada</option>
                                    <option value={ESTADOS_AUTORIZACION.noAutorizada} style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>No autorizada</option>
                                </>
                            )}
                        </select>
                    </View>

                    <View style={[styles.compactSelect, { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', overflow: 'hidden' }]}>
                        <Text style={styles.miniLabel}>PROVEEDOR:</Text>
                        <select 
                            value={filtroProveedor} 
                            onChange={(e) => setFiltroProveedor(e.target.value)}
                            style={{ 
                                background: 'transparent', 
                                color: isDarkMode ? '#FFF' : '#334155', 
                                border: 'none', 
                                fontSize: '12px', 
                                fontWeight: '700',
                                outline: 'none',
                                maxWidth: '160px',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                colorScheme: isDarkMode ? 'dark' : 'light'
                            }}
                        >
                            <option value="" style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>Todos</option>
                            {proveedoresDisponibles.map((p) => (
                                <option key={p} value={p} style={{ background: isDarkMode ? '#111827' : '#FFF', color: isDarkMode ? '#FFF' : '#334155' }}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    </View>

                    {vistaPrincipal === 'movimientos' && (
                    <>
                    <TouchableOpacity 
                        style={[
                            styles.toggleBtn, 
                            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', borderColor: isDarkMode ? '#374151' : '#CBD5E1' },
                            filtroPendiente && styles.toggleBtnActive
                        ]}
                        onPress={() => setFiltroPendiente(filtroPendiente ? null : true)}
                    >
                        <Text style={[styles.toggleBtnText, { color: isDarkMode ? '#E2E8F0' : '#475569' }, filtroPendiente && { color: '#FFF' }]}>Pendientes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.toggleBtn, 
                            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9', borderColor: isDarkMode ? '#374151' : '#CBD5E1' },
                            filtroCredito && styles.toggleBtnActive
                        ]}
                        onPress={() => setFiltroCredito(filtroCredito ? null : true)}
                    >
                        <Text style={[styles.toggleBtnText, { color: isDarkMode ? '#E2E8F0' : '#475569' }, filtroCredito && { color: '#FFF' }]}>Crédito</Text>
                    </TouchableOpacity>
                    </>
                    )}

                    {(filtroModulo || filtroRubro || searchQuery || fechaFiltro || filtroEstado || filtroProveedor || filtroPendiente || filtroCredito) && (
                        <TouchableOpacity 
                            onPress={() => {
                                setFiltroModulo('');
                                setFiltroRubro('');
                                setFiltroEstado('');
                                setFiltroProveedor('');
                                setSearchQuery('');
                                setFechaFiltro('');
                                setFiltroPendiente(null);
                                setFiltroCredito(null);
                            }}
                        >
                            <MaterialCommunityIcons name="filter-off" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Resumen */}
                <View style={styles.headerSection}>
                    {vistaPrincipal === 'movimientos' ? (
                    <View style={styles.resumenGrid}>
                        {renderResumenCard('Total', resumenLocal.totalGeneral || resumen?.totalGeneral || 0, 'cash-multiple', colors.primary)}
                        {modulos.filter(m => m.value !== '').map(m => (
                            renderResumenCard(m.label, resumenLocal.porModulo?.[m.value] || resumen?.porModulo?.[m.value] || 0, m.icon, getModuloColor(m.value))
                        ))}
                    </View>
                    ) : (
                    <View style={styles.resumenGrid}>
                        {renderResumenCard('Total solicitudes', resumenSolicitudes.total, 'clipboard-list', colors.primary, true)}
                        {renderResumenCard('Pendientes', resumenSolicitudes.pendientes, 'clock-outline', '#F59E0B', true)}
                        {renderResumenCard('Autorizadas', resumenSolicitudes.autorizadas, 'check-circle', '#10B981', true)}
                        {renderResumenCard('No autorizadas', resumenSolicitudes.noAutorizadas, 'close-circle', '#EF4444', true)}
                        {renderResumenCard('Monto estimado', resumenSolicitudes.totalMonto, 'cash', '#3B82F6', false)}
                    </View>
                    )}
                </View>

                {/* Listado */}
                <View style={styles.listSection}>
                    <View style={styles.listHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 18 }]}>
                            {vistaPrincipal === 'movimientos' ? 'Últimos Movimientos' : 'Solicitudes de autorización'}
                        </Text>
                        <View style={styles.listHeaderActions}>
                            {vistaPrincipal === 'movimientos' && (
                            <>
                            <TouchableOpacity style={styles.exportButton} onPress={() => setShowExportModal(true)}>
                                <MaterialCommunityIcons name="file-excel" size={16} color="#FFFFFF" />
                                <Text style={styles.exportButtonText}>Exportar Excel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.newGastoButton}
                                onPress={async () => {
                                    setShowIngresoModal(false);
                                    setEditingIngresoId(null);
                                    setEditingGastoId(null);
                                    setGastoMedioPago(null);
                                    await loadMaestrosGasto();
                                    setGastoForm({
                                        rubroSel: RUBROS_CONTABILIDAD[0],
                                        rubroNuevo: '',
                                        proveedorSel: '',
                                        proveedorNuevo: '',
                                        fecha: new Date().toISOString().split('T')[0],
                                        precioBase: '',
                                        precioBaseDisplay: '',
                                        precioIva: '',
                                        precioIvaDisplay: '',
                                        numeroFactura: '',
                                        observaciones: '',
                                        esPendiente: true,
                                        facturaPdfUrl: '',
                                        archivoNombre: '',
                                    });
                                    setShowGastoModal(true);
                                }}
                            >
                                <MaterialCommunityIcons name="cash-minus" size={16} color="#FFFFFF" />
                                <Text style={styles.newGastoButtonText}>Nuevo Gasto</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.newIngresoButton} onPress={() => { setShowGastoModal(false); setShowIngresoModal(true); }}>
                                <MaterialCommunityIcons name="plus-circle" size={16} color="#FFFFFF" />
                                <Text style={styles.newIngresoButtonText}>Nuevo Ingreso</Text>
                            </TouchableOpacity>
                            </>
                            )}
                            <TouchableOpacity onPress={vistaPrincipal === 'movimientos' ? fetchData : fetchSolicitudes}>
                                <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {vistaPrincipal === 'movimientos' ? (
                    <FlatList
                        data={gastos}
                        renderItem={renderGastoItem}
                        keyExtractor={(item) => `${item.modulo}-${item.esIngreso === true ? 'in' : 'out'}-${item.id}`}
                        scrollEnabled={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={{ color: colors.subText }}>No hay gastos registrados en este periodo.</Text>
                            </View>
                        }
                    />
                    ) : (
                    <FlatList
                        data={solicitudes}
                        renderItem={renderSolicitudItem}
                        keyExtractor={(item) => `sol-${item.modulo}-${item.id}`}
                        scrollEnabled={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={{ color: colors.subText }}>
                                    {filtroModulo === 'Contabilidad'
                                        ? 'Las solicitudes de autorización no aplican al área Contabilidad.'
                                        : 'No hay solicitudes de autorización en este periodo.'}
                                </Text>
                            </View>
                        }
                    />
                    )}
                </View>
            </ScrollView>

            {Platform.OS === 'web' ? (
                <>
                {showIngresoModal ? (
                    <View style={styles.modalOverlayWeb}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF' }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingIngresoId ? 'Editar Ingreso' : 'Nuevo Ingreso'}</Text>

                                <Text style={[styles.modalLabel, { color: colors.subText }]}>Motivo del ingreso *</Text>
                                <TextInput
                                    style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                    placeholder="Ej: Abono cliente OP 7565"
                                    placeholderTextColor={colors.subText}
                                    value={ingresoForm.motivoIngreso}
                                    onChangeText={(v) => setIngresoForm(prev => ({ ...prev, motivoIngreso: v }))}
                                />

                                <Text style={[styles.modalLabel, { color: colors.subText }]}>Fecha *</Text>
                                <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                                    <input
                                        type="date"
                                        value={ingresoForm.fecha}
                                        onChange={(e) => setIngresoForm(prev => ({ ...prev, fecha: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: isDarkMode ? '#FFFFFF' : '#111827',
                                            fontSize: 14
                                        }}
                                    />
                                </View>

                                <Text style={[styles.modalLabel, { color: colors.subText }]}>Cantidad *</Text>
                                <TextInput
                                    style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                    placeholder="Ej: 250000"
                                    placeholderTextColor={colors.subText}
                                    value={ingresoForm.cantidadDisplay}
                                    keyboardType="numeric"
                                    onChangeText={(v) => {
                                        const raw = v.replace(/[^0-9]/g, '');
                                        setIngresoForm(prev => ({
                                            ...prev,
                                            cantidad: raw,
                                            cantidadDisplay: formatMiles(raw)
                                        }));
                                    }}
                                />

                                <Text style={[styles.modalLabel, { color: colors.subText }]}>PDF soporte (opcional)</Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={handlePickIngresoPdf}>
                                    <MaterialCommunityIcons name="file-pdf-box" size={16} color="#FFFFFF" />
                                    <Text style={styles.uploadButtonText}>{ingresoForm.archivoNombre || 'Subir PDF'}</Text>
                                </TouchableOpacity>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={styles.modalCancelButton} onPress={resetIngresoModal}>
                                        <Text style={styles.modalCancelText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalSaveButton} onPress={handleCrearIngreso} disabled={savingIngreso}>
                                        <Text style={styles.modalSaveText}>{savingIngreso ? 'Guardando...' : (editingIngresoId ? 'Guardar cambios' : 'Guardar Ingreso')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : null}
                {showGastoModal ? (
                    <View style={styles.modalOverlayWeb}>
                        <View style={styles.modalOverlay}>{renderContabilidadGastoForm()}</View>
                    </View>
                ) : null}
                </>
            ) : (
                <>
                <Modal
                    visible={showIngresoModal}
                    transparent
                    animationType="fade"
                    onRequestClose={resetIngresoModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF' }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingIngresoId ? 'Editar Ingreso' : 'Nuevo Ingreso'}</Text>

                            <Text style={[styles.modalLabel, { color: colors.subText }]}>Motivo del ingreso *</Text>
                            <TextInput
                                style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                placeholder="Ej: Abono cliente OP 7565"
                                placeholderTextColor={colors.subText}
                                value={ingresoForm.motivoIngreso}
                                onChangeText={(v) => setIngresoForm(prev => ({ ...prev, motivoIngreso: v }))}
                            />

                            <Text style={[styles.modalLabel, { color: colors.subText }]}>Fecha *</Text>
                            {Platform.OS === 'web' ? (
                                <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                                    <input
                                        type="date"
                                        value={ingresoForm.fecha}
                                        onChange={(e) => setIngresoForm(prev => ({ ...prev, fecha: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: isDarkMode ? '#FFFFFF' : '#111827',
                                            fontSize: 14
                                        }}
                                    />
                                </View>
                            ) : (
                                <TextInput
                                    style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                    value={ingresoForm.fecha}
                                    onChangeText={(v) => setIngresoForm(prev => ({ ...prev, fecha: v }))}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={colors.subText}
                                />
                            )}

                            <Text style={[styles.modalLabel, { color: colors.subText }]}>Cantidad *</Text>
                            <TextInput
                                style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                placeholder="Ej: 250000"
                                placeholderTextColor={colors.subText}
                                value={ingresoForm.cantidadDisplay}
                                keyboardType="numeric"
                                onChangeText={(v) => {
                                    const raw = v.replace(/[^0-9]/g, '');
                                    setIngresoForm(prev => ({
                                        ...prev,
                                        cantidad: raw,
                                        cantidadDisplay: formatMiles(raw)
                                    }));
                                }}
                            />

                            <Text style={[styles.modalLabel, { color: colors.subText }]}>PDF soporte (opcional)</Text>
                            <TouchableOpacity style={styles.uploadButton} onPress={handlePickIngresoPdf}>
                                <MaterialCommunityIcons name="file-pdf-box" size={16} color="#FFFFFF" />
                                <Text style={styles.uploadButtonText}>{ingresoForm.archivoNombre || 'Subir PDF'}</Text>
                            </TouchableOpacity>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.modalCancelButton} onPress={resetIngresoModal}>
                                    <Text style={styles.modalCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalSaveButton} onPress={handleCrearIngreso} disabled={savingIngreso}>
                                    <Text style={styles.modalSaveText}>{savingIngreso ? 'Guardando...' : (editingIngresoId ? 'Guardar cambios' : 'Guardar Ingreso')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
                <Modal
                    visible={showGastoModal}
                    transparent
                    animationType="fade"
                    onRequestClose={resetGastoModal}
                >
                    <View style={styles.modalOverlay}>{renderContabilidadGastoForm()}</View>
                </Modal>
                </>
            )}

            {Platform.OS === 'web' ? (
                showExportModal ? (
                    <View style={styles.modalOverlayWeb}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF' }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Exportar Excel</Text>
                                <Text style={[styles.gastoNota, { color: colors.subText, marginTop: 0 }]}>
                                    Si indica fecha inicio y fecha fin, el Excel incluirá todos los movimientos en ese rango (independiente del mes seleccionado arriba). Si deja las fechas vacías, se usa el periodo del filtro (año/mes).
                                </Text>

                                <Text style={[styles.modalLabel, { color: colors.subText }]}>Fecha inicio</Text>
                                <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                                    <input
                                        type="date"
                                        value={exportRange.fechaInicio}
                                        onChange={(e) => setExportRange(prev => ({ ...prev, fechaInicio: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: isDarkMode ? '#FFFFFF' : '#111827',
                                            fontSize: 14
                                        }}
                                    />
                                </View>

                                <Text style={[styles.modalLabel, { color: colors.subText }]}>Fecha fin</Text>
                                <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                                    <input
                                        type="date"
                                        value={exportRange.fechaFin}
                                        onChange={(e) => setExportRange(prev => ({ ...prev, fechaFin: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: isDarkMode ? '#FFFFFF' : '#111827',
                                            fontSize: 14
                                        }}
                                    />
                                </View>

                                {renderExportExcelOpciones()}

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowExportModal(false)}>
                                        <Text style={styles.modalCancelText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalSaveButton} onPress={handleExportExcel}>
                                        <Text style={styles.modalSaveText}>Descargar Excel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : null
            ) : (
                <Modal
                    visible={showExportModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowExportModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF' }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Exportar Excel</Text>
                            <Text style={[styles.gastoNota, { color: colors.subText, marginTop: 0 }]}>
                                Si indica fecha inicio y fecha fin, el Excel incluirá todos los movimientos en ese rango (independiente del mes seleccionado arriba). Si deja las fechas vacías, se usa el periodo del filtro (año/mes).
                            </Text>

                            <Text style={[styles.modalLabel, { color: colors.subText }]}>Fecha inicio</Text>
                            {Platform.OS === 'web' ? (
                                <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                                    <input
                                        type="date"
                                        value={exportRange.fechaInicio}
                                        onChange={(e) => setExportRange(prev => ({ ...prev, fechaInicio: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: isDarkMode ? '#FFFFFF' : '#111827',
                                            fontSize: 14
                                        }}
                                    />
                                </View>
                            ) : (
                                <TextInput
                                    style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                    value={exportRange.fechaInicio}
                                    onChangeText={(v) => setExportRange(prev => ({ ...prev, fechaInicio: v }))}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={colors.subText}
                                />
                            )}

                            <Text style={[styles.modalLabel, { color: colors.subText }]}>Fecha fin</Text>
                            {Platform.OS === 'web' ? (
                                <View style={[styles.modalInput, { paddingVertical: 0, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}>
                                    <input
                                        type="date"
                                        value={exportRange.fechaFin}
                                        onChange={(e) => setExportRange(prev => ({ ...prev, fechaFin: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            height: 36,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            color: isDarkMode ? '#FFFFFF' : '#111827',
                                            fontSize: 14
                                        }}
                                    />
                                </View>
                            ) : (
                                <TextInput
                                    style={[styles.modalInput, { color: colors.text, borderColor: isDarkMode ? '#374151' : '#D1D5DB' }]}
                                    value={exportRange.fechaFin}
                                    onChangeText={(v) => setExportRange(prev => ({ ...prev, fechaFin: v }))}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={colors.subText}
                                />
                            )}

                            {renderExportExcelOpciones()}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowExportModal(false)}>
                                    <Text style={styles.modalCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalSaveButton} onPress={handleExportExcel}>
                                    <Text style={styles.modalSaveText}>Descargar Excel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 15,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolbar: {
        paddingTop: 10,
        borderBottomWidth: 1,
    },
    toolbarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 10,
        gap: 12,
    },
    periodGroup: {
        flexDirection: 'row',
        gap: 8,
    },
    compactSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingHorizontal: 10,
        borderRadius: 8,
        gap: 8,
    },
    compactSelectText: {
        fontSize: 14,
        fontWeight: '600',
    },
    compactInput: {
        width: 50,
        fontSize: 14,
        fontWeight: '600',
        padding: 0,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingHorizontal: 10,
        borderRadius: 8,
        gap: 8,
    },
    filterBarContent: {
        gap: 10,
        paddingRight: 15,
    },
    filterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    compactSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    miniLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#60A5FA', // Brighter blue for better visibility
        marginRight: 6,
    },
    filterValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
    },
    miniDateInput: {
        fontSize: 11,
        width: 85,
        padding: 0,
    },
    toggleBtn: {
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#374151',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
        marginRight: 8,
    },
    toggleBtnActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#60A5FA',
    },
    toggleBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#E2E8F0',
    },
    vistaTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1.5,
        marginRight: 8,
    },
    vistaTabActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#60A5FA',
    },
    vistaTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    vistaTabTextActive: {
        color: '#FFFFFF',
    },
    resetBtn: {
        padding: 6,
    },
    scrollContent: {
        padding: 15,
    },
    headerSection: {
        marginBottom: 20,
    },
    resumenGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    resumenCard: {
        flex: 1,
        minWidth: 160,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    resumenInfo: {
        flex: 1,
    },
    resumenLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    resumenValue: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    listSection: {
        backgroundColor: 'transparent',
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    listHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    newIngresoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        gap: 6,
    },
    newGastoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EA580C',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        gap: 6,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16A34A',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        gap: 6,
    },
    exportButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    newIngresoButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    newGastoButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    refreshBtn: {
        padding: 8,
    },
    gastoItem: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        gap: 10,
    },
    gastoMain: {
        flex: 1,
        minWidth: 220,
        maxWidth: '100%',
    },
    gastoHeader: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
        rowGap: 6,
    },
    moduloTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginRight: 4,
        marginBottom: 2,
    },
    moduloTagText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    gastoFecha: {
        fontSize: 12,
    },
    statusTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    statusTagText: {
        fontSize: 9,
        fontWeight: '800',
    },
    gastoRubro: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
        lineHeight: 20,
    },
    gastoProveedor: {
        fontSize: 12,
        marginBottom: 2,
        lineHeight: 17,
    },
    gastoAutor: {
        fontSize: 11,
        fontStyle: 'italic',
        marginBottom: 4,
    },
    gastoNota: {
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 4,
    },
    gastoDetalle: {
        fontSize: 11,
        marginTop: 2,
        fontWeight: '600',
    },
    gastoPriceContainer: {
        minWidth: 150,
        maxWidth: '100%',
        alignItems: 'flex-end',
        alignSelf: 'flex-end',
        flexShrink: 0,
    },
    gastoPrice: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    estadoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        marginLeft: 4,
        marginBottom: 2,
    },
    estadoBadgeText: {
        fontSize: 10,
        fontWeight: '900',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    pdfButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    pdfButtonText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginLeft: 6,
    },
    ingresoActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    ingresoActionBtn: {
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    ingresoActionText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalOverlayWeb: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
    },
    modalCard: {
        width: '100%',
        maxWidth: 520,
        borderRadius: 12,
        padding: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 12,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
        marginTop: 8,
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 9,
        fontSize: 14,
    },
    uploadButton: {
        marginTop: 6,
        backgroundColor: '#EF4444',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    uploadButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    miniAddBtn: {
        alignSelf: 'flex-start',
        backgroundColor: '#6366F1',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
    },
    miniAddBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 18,
    },
    modalCancelButton: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#6B7280',
    },
    modalCancelText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    modalSaveButton: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#10B981',
    },
    modalSaveText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
