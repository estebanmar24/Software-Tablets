import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, Platform, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Added Picker import
import api from '../services/productionApi';
// jsPDF moved to dynamic import to avoid Android TextDecoder 'latin1' startup crash
// import { jsPDF } from 'jspdf';
// import autoTable from 'jspdf-autotable';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Asset } from 'expo-asset';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
// CustomNavBar removed - navigation handled by AdminDashboard
import { ThemeToggle } from '../../App';
import { useTheme } from '../contexts/ThemeContext';
import { calcValorAPagarLabor } from '../utils/laborHorasExtras';

// Register Chart.js components
Chart.register(...registerables, ChartDataLabels);

/** Horas base para meta / T.H. neto: total − descanso − tiempos muertos (resumen máquina). */
function horasEfectivasMetaDesdeResumenMaq(m) {
    if (m == null) return 0;
    if (m.totalHorasEfectivasMeta != null && !Number.isNaN(Number(m.totalHorasEfectivasMeta))) {
        return Math.max(0, Number(m.totalHorasEfectivasMeta));
    }
    const th = Number(m.totalHoras || 0);
    const d = Number(m.totalHorasDescanso || 0);
    const tm = Number(m.totalTiemposMuertos || 0);
    return Math.max(0, th - d - tm);
}

/** Misma base por día (detalle ProduccionDiaria). */
function horasEfectivasDiaDesdeDetalle(r) {
    if (r == null) return 0;
    const th = Number(r.totalHoras ?? 0);
    const d = Number(r.horasDescanso ?? 0);
    const tm = Number(r.totalTiemposMuertos ?? 0);
    return Math.max(0, th - d - tm);
}

const CODIGOS_ACTIVIDAD_TIEMPO_MUERTO = new Set(['03', '08', '13']);

function normalizarCodigoActividad(codigo) {
    const digits = String(codigo || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, '0');
}

function esActividadTiempoMuerto(codigoActividad) {
    return CODIGOS_ACTIVIDAD_TIEMPO_MUERTO.has(normalizarCodigoActividad(codigoActividad));
}

function clasificacionTiempoMuerto(codigoActividad, nombreActividad) {
    const c = normalizarCodigoActividad(codigoActividad);
    if (c === '13') return 'Falta de Trabajo';
    if (c === '03') return 'Reparación';
    if (c === '08') return 'Otro Tiempo Muerto';
    return nombreActividad || 'Tiempo muerto';
}

function calcularHorasTurnoCalendario(mesVal, anioVal, diaInicio = null, diaFin = null) {
    const diasEnMes = new Date(anioVal, mesVal, 0).getDate();
    const dStart = diaInicio ?? 1;
    const dEnd = diaFin ?? diasEnMes;

    const calcularPascua = (year) => {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
        const mesP = Math.floor((h + l - 7 * m2 + 114) / 31);
        const diaP = ((h + l - 7 * m2 + 114) % 31) + 1;
        return new Date(year, mesP - 1, diaP);
    };
    const trasladarALunes = (fecha) => {
        const ds = fecha.getDay();
        if (ds === 1) return fecha;
        const diasHastaLunes = (1 - ds + 7) % 7 || 7;
        return new Date(fecha.getTime() + diasHastaLunes * 24 * 60 * 60 * 1000);
    };
    const obtenerFestivosColombia = (year) => {
        const f = [];
        f.push(new Date(year, 0, 1), new Date(year, 4, 1), new Date(year, 6, 20), new Date(year, 7, 7), new Date(year, 11, 8), new Date(year, 11, 25));
        const pascua = calcularPascua(year);
        f.push(new Date(pascua.getTime() - 3 * 86400000), new Date(pascua.getTime() - 2 * 86400000));
        f.push(trasladarALunes(new Date(pascua.getTime() + 39 * 86400000)));
        f.push(trasladarALunes(new Date(pascua.getTime() + 60 * 86400000)));
        f.push(trasladarALunes(new Date(pascua.getTime() + 68 * 86400000)));
        f.push(trasladarALunes(new Date(year, 0, 6)), trasladarALunes(new Date(year, 2, 19)), trasladarALunes(new Date(year, 5, 29)));
        f.push(trasladarALunes(new Date(year, 7, 15)), trasladarALunes(new Date(year, 9, 12)), trasladarALunes(new Date(year, 10, 1)), trasladarALunes(new Date(year, 10, 11)));
        if (year === 2026) f.push(new Date(2026, 6, 13)); // Festivo excepcional
        return f;
    };
    const esFestivo = (fecha, festivos) => festivos.some(f =>
        f.getDate() === fecha.getDate() && f.getMonth() === fecha.getMonth() && f.getFullYear() === fecha.getFullYear()
    );

    const festivosArr = obtenerFestivosColombia(anioVal);
    let horasTurno = 0;
    for (let dia = dStart; dia <= dEnd; dia++) {
        const fecha = new Date(anioVal, mesVal - 1, dia);
        const diaSemana = fecha.getDay();
        if (diaSemana === 0) continue;
        if (esFestivo(fecha, festivosArr)) continue;
        if (diaSemana >= 1 && diaSemana <= 5) horasTurno += 8;
        else if (diaSemana === 6) horasTurno += 4;
    }
    return horasTurno;
}

/** Filas OEE por máquina. OEE = Rendimiento × Disponibilidad (calidad excluida por ahora). */
function construirFilasReporteOee(resumenMaquinas, mes, anio, naturalSort, diaInicio = null, diaFin = null) {
    const horasTurnoMesBase = calcularHorasTurnoCalendario(mes, anio, diaInicio, diaFin);
    let totalPuntajePlanta = 0;

    const filas = (resumenMaquinas || [])
        .filter(m => (m.totalHorasProductivas || 0) > 0 || (m.totalHoras || 0) > 0 || (m.tirosTotales || 0) > 0)
        .sort(naturalSort)
        .map(m => {
            const rendimiento = Number(m.porcentajeRendimiento100 || 0);
            const hrsTurno = Number(m.horasTurnoMes) > 0 ? Number(m.horasTurnoMes) : horasTurnoMesBase;
            const hrsProd = Number(m.totalHorasProductivas || 0);
            const disponibilidad = hrsTurno > 0 ? (hrsProd / hrsTurno) * 100 : 0;
            const calidad = 0;
            const oee = (rendimiento * disponibilidad) / 100;
            const importancia = Number(m.importancia || 0);
            const puntaje = oee * importancia / 100;
            totalPuntajePlanta += puntaje;

            return {
                row: [
                    m.maquina,
                    `${rendimiento.toFixed(1)}%`,
                    `${disponibilidad.toFixed(1)}%`,
                    `${calidad.toFixed(1)}%`,
                    `${oee.toFixed(1)}%`,
                    `${importancia.toFixed(2)}%`,
                    puntaje.toFixed(2)
                ],
                oee,
                puntaje
            };
        });

    return { filas, totalPuntajePlanta, horasTurnoMesBase };
}

/** Nov/Dic 2025 no se capturaron; no deben aparecer ni influir en promedios del historial. */
function esMesExcluidoHistorialRendimiento(mesVal, anioVal) {
    return Number(anioVal) === 2025 && (Number(mesVal) === 11 || Number(mesVal) === 12);
}

/** Últimos N meses válidos terminando en (endMes, endAnio); omite meses excluidos y retrocede más si hace falta. */
function buildRangoMesesHistorial(endMes, endAnio, cantidad = 12) {
    const meses = [];
    let m = Number(endMes);
    let y = Number(endAnio);
    let guard = 0;
    while (meses.length < cantidad && guard < 48) {
        guard += 1;
        if (!esMesExcluidoHistorialRendimiento(m, y)) {
            meses.unshift({ mes: m, anio: y });
        }
        m -= 1;
        if (m < 1) {
            m = 12;
            y -= 1;
        }
    }
    return meses;
}

/**
 * Rendimiento del operario igual que la carta de desempeño:
 * por máquina % = tiros / meta 100%; total = promedio ponderado por horas (prod + aux).
 */
function agregarRendimientoOperariosCartas(resumenOperarios) {
    const agg = (resumenOperarios || []).reduce((acc, item) => {
        const key = String(item.usuarioId ?? item.operario ?? 'sin-id');
        if (!acc[key]) {
            acc[key] = {
                usuarioId: item.usuarioId,
                operario: item.operario || 'N/A',
                pesoHoras: 0,
                rendimientoPonderado: 0,
                tiros: 0,
                meta: 0
            };
        }
        const metaOp = Number(item.meta100Porciento ?? 0);
        const t = Number(item.totalTiros ?? 0);
        const horas =
            Number(item.totalHorasProductivas || 0) + Number(item.totalHorasAuxiliares || 0);
        const pctMaq = metaOp > 0
            ? (100 * t) / metaOp
            : Number(item.porcentajeRendimiento100 ?? 0);

        acc[key].tiros += t;
        acc[key].meta += metaOp;

        if (horas > 0) {
            acc[key].pesoHoras += horas;
            acc[key].rendimientoPonderado += pctMaq * horas;
        }
        return acc;
    }, {});
    return Object.values(agg).map((x) => {
        let pct = 0;
        if (x.pesoHoras > 0) {
            pct = x.rendimientoPonderado / x.pesoHoras;
        } else if (x.meta > 0) {
            pct = (x.tiros / x.meta) * 100;
        }
        let semaforo = 'Rojo';
        if (pct >= 100) semaforo = 'Verde';
        else if (pct >= 75) semaforo = 'Amarillo';
        return { ...x, pct, semaforo };
    });
}

function etiquetaMesCortoHistorial(mesVal, anioVal) {
    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[mesVal] || ''} ${String(anioVal).slice(-2)}`;
}

export default function DashboardScreen({ navigation }) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const [resumen, setResumen] = useState(null);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());

    // Report states
    const [reportType, setReportType] = useState('general');
    const [reportPeriod, setReportPeriod] = useState('mensual');
    const [selectedOperario, setSelectedOperario] = useState('');
    const [selectedMaquina, setSelectedMaquina] = useState('');
    const [selectedOPReport, setSelectedOPReport] = useState('');
    const [semana, setSemana] = useState(1);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const logoSource = colors.alephLogo;

    // Data Lists
    const [usuarios, setUsuarios] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [opsDisponibles, setOpsDisponibles] = useState([]);
    const [periodosDisponibles, setPeriodosDisponibles] = useState([]);

    // Filtros dinámicos
    const [operariosConDatos, setOperariosConDatos] = useState([]);
    const [filteredUsuarios, setFilteredUsuarios] = useState([]);
    const [filteredMaquinas, setFilteredMaquinas] = useState([]);

    // VIEW FILTERS (For Dashboard Cards)
    const [viewFilterMaquina, setViewFilterMaquina] = useState('');
    const [viewFilterOperario, setViewFilterOperario] = useState('');

    // Derived Data for View Filters
    const [viewAvailableMaquinas, setViewAvailableMaquinas] = useState([]);
    const [viewAvailableOperarios, setViewAvailableOperarios] = useState([]);
    const [displayedOperarios, setDisplayedOperarios] = useState([]);
    const [displayedMaquinas, setDisplayedMaquinas] = useState([]);
    const reportUsesAllMachinesOption = reportType === 'alistamiento' || reportType === 'tiemposMuertos';

    useEffect(() => {
        cargarListas();
        cargarPeriodosDisponibles();
    }, []);

    useEffect(() => {
        if (mes && anio) {
            cargarResumen();
            cargarOperariosConDatos();
        }
    }, [mes, anio, reportPeriod, semana]);

    useEffect(() => {
        // En estos reportes permitimos vista general sin detalle por máquina.
        if (reportUsesAllMachinesOption && !selectedMaquina) {
            setSelectedMaquina('todos');
            return;
        }

        // En "Por Máquina" no existe opción global.
        if (reportType === 'maquina' && selectedMaquina === 'todos') {
            setSelectedMaquina('');
        }
    }, [reportType, reportUsesAllMachinesOption, selectedMaquina]);

    // Actualizar listas filtradas cuando cambian los datos o las listas base
    // Filtrar para mostrar solo usuarios/máquinas con datos en el período
    useEffect(() => {
        // Fuente principal: Resumen cargado (consistencia con tarjetas). Fallback: operariosConDatos
        const sourceData = (resumen?.resumenOperarios && resumen.resumenOperarios.length > 0) ? resumen.resumenOperarios : operariosConDatos;
        // Para máquinas usamos resumenMaquinas si existe, sino fallback a sourceData (que tiene maquinaId)
        const sourceMaquinas = (resumen?.resumenMaquinas && resumen.resumenMaquinas.length > 0) ? resumen.resumenMaquinas : operariosConDatos;

        if (sourceData.length > 0 && usuarios.length > 0) {
            // Filtrar solo usuarios que tienen datos en el período
            const opIds = [...new Set(sourceData.map(o => Number(o.usuarioId)))];
            const maqIds = [...new Set(sourceMaquinas.map(m => Number(m.maquinaId)))];

            const usuariosConDatos = usuarios.filter(u => opIds.includes(Number(u.id)));
            const maquinasConDatos = maquinas.filter(m => maqIds.includes(Number(m.id)));

            // Strict filtering: Only show if data exists
            setFilteredUsuarios(usuariosConDatos);
            setFilteredMaquinas(maquinasConDatos);
        } else {
            // Si no hay datos, no mostrar opciones (lista vacía)
            setFilteredUsuarios([]);
            setFilteredMaquinas([]);
        }
    }, [resumen, operariosConDatos, usuarios, maquinas]);


    // EFECTO PARA FILTROS DE VISTA (Tablero Semáforos)
    useEffect(() => {
        const dataOps = resumen?.resumenOperarios || [];
        const dataMaqs = resumen?.resumenMaquinas || [];

        // 1. Filtrar Data Principal
        let filteredOps = dataOps;
        let filteredMaqs = dataMaqs;

        if (viewFilterMaquina) {
            filteredOps = filteredOps.filter(o => o.maquinaId == viewFilterMaquina);
            filteredMaqs = filteredMaqs.filter(m => m.maquinaId == viewFilterMaquina);
        }

        if (viewFilterOperario) {
            filteredOps = filteredOps.filter(o => o.usuarioId == viewFilterOperario);
            // Nota: resumenMaquinas no tiene usuarioId directo típicamente, 
            // pero si queremos filtrar máquinas por operario, usamos las máquinas donde ese operario trabajó.
            // Obtenemos los MaquinaIDs donde el operario tiene registros en filteredOps (que ya está filtrado por operario)
            const validMaqIds = [...new Set(dataOps.filter(o => o.usuarioId == viewFilterOperario).map(o => o.maquinaId))];
            filteredMaqs = filteredMaqs.filter(m => validMaqIds.includes(m.maquinaId));
        }

        setDisplayedOperarios(filteredOps);
        setDisplayedMaquinas(filteredMaqs);

        // 2. Calcular Opciones Disponibles (Linked Filtering)

        // Máquinas Disponibles:
        // Si hay Operario seleccionado: solo máquinas donde trabajó ese operario (en el resumen actual)
        // Si NO hay Operario: todas las máquinas presentes en el resumen actual
        let availableMaqsSource = dataOps;
        if (viewFilterOperario) {
            availableMaqsSource = availableMaqsSource.filter(o => o.usuarioId == viewFilterOperario);
        }
        const availableMaqIds = [...new Set(availableMaqsSource.map(o => o.maquinaId))];
        const availableMaqsObjs = maquinas.filter(m => availableMaqIds.includes(m.id));
        setViewAvailableMaquinas(availableMaqsObjs);

        // Operarios Disponibles:
        // Si hay Máquina seleccionada: solo operarios que trabajaron en esa máquina
        // Si NO hay Máquina: todos los operarios presentes en el resumen actual
        let availableOpsSource = dataOps;
        if (viewFilterMaquina) {
            availableOpsSource = availableOpsSource.filter(o => o.maquinaId == viewFilterMaquina);
        }
        const availableOpIds = [...new Set(availableOpsSource.map(o => o.usuarioId))];
        const availableOpsObjs = usuarios.filter(u => availableOpIds.includes(u.id));
        setViewAvailableOperarios(availableOpsObjs);

    }, [resumen, viewFilterMaquina, viewFilterOperario, usuarios, maquinas]);


    const getBase64FromUrl = async (url) => {
        // Use expo-file-system for mobile, FileReader for web
        if (Platform.OS !== 'web') {
            try {
                const base64 = await FileSystem.readAsStringAsync(url, {
                    encoding: 'base64',
                });
                // Determine MIME type from URL
                const ext = url.split('.').pop().toLowerCase();
                const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
                const mime = mimeTypes[ext] || 'image/jpeg';
                return `data:${mime};base64,${base64}`;
            } catch (err) {
                console.log('Error reading file with expo-file-system, trying fetch:', err);
                // Fallback: try downloading and reading
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
                const base64data = reader.result;
                resolve(base64data);
            }
        });
    }

    const cargarPeriodosDisponibles = async () => {
        try {
            const response = await api.get('/produccion/periodos-disponibles');
            setPeriodosDisponibles(response.data);
            if (response.data.length > 0) {
                // Auto seleccionar el más reciente
                if (!mes || !anio) { // Only if not set, or force it?
                    // Better to force it to valid data if the current selection is invalid?
                    // For now, let's just set it to the first one (most recent) to ensure valid data is shown initially.
                    setMes(response.data[0].mes);
                    setAnio(response.data[0].anio);
                } else {
                    // Check if current mes/anio is in the list? 
                    // Let's just default to the most recent one for better UX, as user probably wants to see latest data.
                    setMes(response.data[0].mes);
                    setAnio(response.data[0].anio);
                }
            }
        } catch (e) {
            console.error('Error cargando periodos:', e);
        }
    };

    const cargarListas = async () => {
        try {
            console.log('DEBUG: Iniciando cargarListas...');
            const [m, u, ops] = await Promise.all([
                api.get('/maquinas'),
                api.get('/usuarios'),
                api.get('/produccion/ops-unicos')
            ]);
            console.log('DEBUG: Respuesta maquinas:', m);
            console.log('DEBUG: Respuesta usuarios:', u);
            // Usar todos los usuarios y máquinas sin filtrar
            const maqActivas = m.data || [];
            const usrActivos = u.data || [];
            console.log('DEBUG: maqActivas:', maqActivas);
            console.log('DEBUG: usrActivos:', usrActivos);
            setMaquinas(maqActivas);
            setUsuarios(usrActivos);
            setOpsDisponibles(Array.isArray(ops.data) ? ops.data : []);
            // Inicializar con todos los usuarios/máquinas disponibles
            setFilteredUsuarios(usrActivos);
            setFilteredMaquinas(maqActivas);
        } catch (e) {
            console.error('DEBUG ERROR en cargarListas:', e);
        }
    };

    const cargarOperariosConDatos = async () => {
        try {
            const res = await api.get(`/produccion/operarios-con-datos?mes=${mes}&anio=${anio}`);
            setOperariosConDatos(res.data);
        } catch (error) {
            console.error("Error cargando operarios con datos", error);
        }
    };

    const cargarResumen = async () => {
        setLoading(true);
        try {
            let url = `/produccion/resumen?mes=${mes}&anio=${anio}`;

            if (reportPeriod === 'semanal') {
                let dInicio = 1, dFin = 7;
                if (semana === 2) { dInicio = 8; dFin = 14; }
                else if (semana === 3) { dInicio = 15; dFin = 21; }
                else if (semana === 4) { dInicio = 22; dFin = 31; }

                url += `&diaInicio=${dInicio}&diaFin=${dFin}`;
            }

            if (typeof window !== 'undefined') {
                url += `&_=${Date.now()}`;
            }

            const response = await api.get(url);
            setResumen(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getColor = (colorName) => {
        switch (colorName?.toLowerCase()) {
            case 'rojo': return '#ffcccc';
            case 'amarillo': return '#fff5cc';
            case 'verde': return '#ccffcc';
            default: return '#f0f0f0';
        }
    };

    const getMesNombre = (m) => {
        const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[m] || '';
    };

    const generatePDF = async () => {
        if (reportType === 'operario' && !selectedOperario) {
            alert('Por favor selecciona un operario.');
            return;
        }
        if ((reportType === 'maquina' || reportType === 'alistamiento' || reportType === 'tiemposMuertos') && !selectedMaquina) {
            alert('Por favor selecciona una máquina.');
            return;
        }
        if (reportType === 'op' && !selectedOPReport?.trim()) {
            alert('Por favor ingresa o selecciona una OP.');
            return;
        }
        if (reportType === 'historialRendimiento' && reportPeriod !== 'mensual') {
            alert('El historial de rendimiento solo está disponible en periodo mensual.');
            return;
        }

        setGeneratingPdf(true);
        try {
            // Dynamically load jsPDF only when requested
            let jsPDF, autoTable;
            if (Platform.OS === 'web') {
                try {
                    const jsPDFModule = await import('jspdf');
                    jsPDF = jsPDFModule.jsPDF;
                    const autoTableModule = await import('jspdf-autotable');
                    autoTable = autoTableModule.default;
                } catch (e) {
                    console.error("Error loading PDF libs", e);
                    alert("Error cargando librerías de PDF.");
                    setGeneratingPdf(false);
                    return;
                }
            } else {
                // For mobile, we might need a different approach or verify if polyfill works with dynamic import
                // Try dynamic import anyway, protected by try-catch
                try {
                    const jsPDFModule = await import('jspdf');
                    jsPDF = jsPDFModule.jsPDF;
                    const autoTableModule = await import('jspdf-autotable');
                    autoTable = autoTableModule.default;
                } catch (e) {
                    alert("Funcionalidad PDF en mantenimiento para móviles. Por favor use la versión Web.");
                    console.error("PDF mobile load error", e);
                    setGeneratingPdf(false);
                    return;
                }
            }

            const doc = new jsPDF(
                reportType === 'historialRendimiento'
                    ? { orientation: 'landscape', unit: 'mm', format: 'a4' }
                    : undefined
            );
            const pageWidth = doc.internal.pageSize.getWidth();
            let opData = null;

            if (reportType === 'op') {
                try {
                    const opCode = selectedOPReport.trim();
                    const response = await api.get(`/produccion/reporte-op/${encodeURIComponent(opCode)}?mes=${mes}&anio=${anio}`);
                    opData = response.data;
                } catch (error) {
                    const message = error?.response?.data || 'No se encontró información para esa OP en el período seleccionado.';
                    alert(typeof message === 'string' ? message : 'No se encontró información para esa OP en el período seleccionado.');
                    setGeneratingPdf(false);
                    return;
                }
            }

            // Función de ordenamiento natural (para ordenar 1, 2, 3... 10, 11 en vez de 1, 10, 11, 2, 3)
            const naturalSort = (a, b) => {
                // Extraer número del inicio del nombre de la máquina
                const getNumber = (str) => {
                    const match = str.match(/^(\d+)/);
                    return match ? parseInt(match[1]) : 999;
                };
                const numA = getNumber(a.maquina);
                const numB = getNumber(b.maquina);
                if (numA !== numB) return numA - numB;
                // Si tienen el mismo número, ordenar por nombre completo
                return a.maquina.localeCompare(b.maquina);
            };

            // Load Logo
            try {
                const asset = Asset.fromModule(logoSource);
                await asset.downloadAsync();
                const base64Logo = await getBase64FromUrl(asset.uri);
                doc.addImage(base64Logo, 'JPEG', 10, 10, 30, 30);
            } catch (err) {
                console.log("Error loading logo for PDF", err);
            }

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(
                reportType === 'oee'
                    ? 'REPORTE OEE'
                    : reportType === 'historialRendimiento'
                        ? 'HISTORIAL DE RENDIMIENTO'
                        : 'REPORTE DE PRODUCCION',
                pageWidth / 2,
                20,
                { align: 'center' }
            );

            // Subtitle
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const periodText = reportPeriod === 'mensual'
                ? `${getMesNombre(mes)} ${anio}`
                : `Semana ${semana} de ${getMesNombre(mes)} ${anio}`;
            if (reportType !== 'historialRendimiento') {
                doc.text(`Periodo: ${periodText}`, pageWidth / 2, 30, { align: 'center' });
            }

            // Calificación (planta o máquina, según tipo de reporte). OEE usa puntaje propio.
            let historialCalificaciones = [];
            let oeeResumen = null;
            if (reportType === 'oee') {
                oeeResumen = construirFilasReporteOee(
                    resumen?.resumenMaquinas,
                    mes,
                    anio,
                    naturalSort,
                    reportPeriod === 'semanal' ? (semana - 1) * 7 + 1 : null,
                    reportPeriod === 'semanal' ? Math.min(semana * 7, new Date(anio, mes, 0).getDate()) : null
                );
                doc.setFontSize(11);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(80, 80, 80);
                doc.text('OEE = Rendimiento × Disponibilidad. Calidad en 0% — excluida del cálculo por ahora.', pageWidth / 2, 38, { align: 'center' });
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                const colorOee = oeeResumen.totalPuntajePlanta >= 75 ? [40, 167, 69] : oeeResumen.totalPuntajePlanta >= 50 ? [255, 193, 7] : [220, 53, 69];
                doc.setTextColor(...colorOee);
                doc.text(`PUNTAJE OEE PLANTA: ${oeeResumen.totalPuntajePlanta.toFixed(2)} pts`, pageWidth / 2, 48, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            } else if (!['operario', 'alistamiento', 'tiemposMuertos', 'op', 'historialRendimiento'].includes(reportType)) {
                let calificacion = 0;
                let calificacionLabel = 'CALIFICACIÓN PLANTA';

                if (reportType === 'maquina') {
                    const selectedItems = selectedMaquina === 'todos'
                        ? (resumen?.resumenMaquinas || [])
                        : (resumen?.resumenMaquinas || []).filter(m => String(m.maquinaId) === String(selectedMaquina));

                    if (selectedItems.length > 0) {
                        calificacion = selectedItems.reduce((acc, cur) => acc + Number(cur.porcentajeRendimiento100 || 0), 0) / selectedItems.length;
                        calificacionLabel = selectedItems.length === 1 ? 'CALIFICACIÓN MÁQUINA' : 'CALIFICACIÓN PROMEDIO MÁQUINAS';
                    }
                } else {
                    calificacion = resumen?.calificacionTotalPlanta || 0;
                }

                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                const color = calificacion >= 75 ? [40, 167, 69] : calificacion >= 50 ? [255, 193, 7] : [220, 53, 69];
                doc.setTextColor(...color);
                doc.text(`${calificacionLabel}: ${calificacion.toFixed(1)} pts`, pageWidth / 2, 42, { align: 'center' });
                doc.setTextColor(0, 0, 0);

                if (reportType === 'general') {
                    try {
                        await api.post(`/calificacion/calcular-y-guardar?mes=${mes}&anio=${anio}`);
                        console.log('Calificación guardada exitosamente');
                    } catch (saveErr) {
                        console.log('Error guardando calificación (puede que la tabla no exista aún):', saveErr);
                    }

                    try {
                        const histRes = await api.get('/calificacion/historial?limite=6');
                        historialCalificaciones = histRes.data || [];
                    } catch (histErr) {
                        console.log('Error obteniendo historial de calificaciones:', histErr);
                    }
                }
            }

            // Prepare Table Data Batches
            let tablesPayload = []; // { title, columns, data, headStyles? }
            let tiemposMuertosPieCharts = []; // { maquina, slices: [{ label, horas }] }

            // Columnas sin 75% - Solo mostramos Meta 100% y Sem 100%
            const colsOperario = ['Maquina', 'Dias Lab', 'Meta 100%', 'Tiros', 'Horas Prod', 'Promedio/H', 'Valor a Pagar', 'Sem 100%'];
            const colsMaquina = ['Tiros Totales', 'Meta 100%', 'Sem 100%'];

            if (reportType === 'general') {
                const columns = ['Operario', 'Maquina', 'Dias Lab', 'Meta 100%', 'Tiros', 'Horas Prod', 'Promedio/H', 'Sem 100%'];
                const data = (resumen?.resumenOperarios || []).map(item => [
                    item.operario,
                    item.maquina,
                    item.diasLaborados?.toString() || '0',
                    item.meta100Porciento?.toFixed(0) || '0',
                    item.totalTiros?.toString() || '0',
                    item.totalHorasProductivas?.toFixed(2) || '0',
                    item.promedioHoraProductiva?.toFixed(2) || '0',
                    `${item.semaforoColor100 || 'Gris'}|${(item.porcentajeRendimiento100 || 0).toFixed(0)}%`
                ]);
                tablesPayload.push({ title: 'Reporte General', columns, data });

                // Summary for general report - ordenada por número natural
                if (resumen?.resumenMaquinas?.length > 0) {
                    const maqColumns = ['Maquina', 'Tiros Totales', 'Meta 100%', 'Sem 100%'];
                    const maqData = [...(resumen?.resumenMaquinas || [])]
                        .sort(naturalSort) // Orden natural (1, 2, 3... 10, 11)
                        .map(item => {
                            // Calcular color del semáforo basado en porcentajeRendimiento100
                            const pct100 = item.porcentajeRendimiento100 || 0;
                            let colorMaq = 'Rojo';
                            if (pct100 >= 100) colorMaq = 'Verde';
                            else if (pct100 >= 75) colorMaq = 'Amarillo';

                            return [
                                item.maquina,
                                item.tirosTotales?.toString() || '0',
                                item.meta100Porciento?.toFixed(0) || '0',
                                `${colorMaq}|${pct100.toFixed(0)}%`
                            ];
                        });
                    tablesPayload.push({
                        title: 'Resumen por Maquina',
                        columns: maqColumns,
                        data: maqData,
                        headStyles: { fillColor: [46, 139, 87], textColor: 255, fontStyle: 'bold' }
                    });
                }

            } else if (reportType === 'operario') {
                const targetIds = [selectedOperario];
                const sortedTargetIds = targetIds.sort();

                for (const opId of sortedTargetIds) {
                    const operarioData = (resumen?.resumenOperarios || []).filter(item => item.usuarioId == opId);
                    if (operarioData.length === 0) continue;

                    const operarioNombre = usuarios.find(u => u.id == opId)?.nombre || operarioData[0].operario || 'Desconocido';
                    // Ordenar máquinas naturalmente dentro del operario
                    const sortedData = [...operarioData].sort((a, b) => {
                        const getNum = (str) => { const m = str.match(/^(\d+)/); return m ? parseInt(m[1]) : 999; };
                        const numA = getNum(a.maquina || '');
                        const numB = getNum(b.maquina || '');
                        if (numA !== numB) return numA - numB;
                        return (a.maquina || '').localeCompare(b.maquina || '');
                    });
                    const data = sortedData.map(item => [
                        item.maquina,
                        item.diasLaborados?.toString() || '0',
                        item.meta100Porciento?.toFixed(0) || '0',
                        item.totalTiros?.toString() || '0',
                        item.totalHorasProductivas?.toFixed(2) || '0',
                        item.promedioHoraProductiva?.toFixed(2) || '0',
                        `$${item.valorAPagarBonificable?.toFixed(0) || '0'}`, // Solo tiros dentro del horario laboral
                        `${item.semaforoColor100 || 'Gris'}|${(item.porcentajeRendimiento100 || 0).toFixed(0)}%`
                    ]);
                    tablesPayload.push({ title: `Operario: ${operarioNombre}`, columns: colsOperario, data });

                    // Detalle rico por operario: OP cuándo/dónde/cuánto + uso de máquinas
                    let detalleOperario = [];
                    try {
                        const resDet = await api.get(`/produccion/detalles-operario?mes=${mes}&anio=${anio}&usuarioId=${opId}`);
                        detalleOperario = Array.isArray(resDet.data) ? resDet.data : [];
                    } catch (err) {
                        console.error(`Error cargando detalle operario ${operarioNombre}`, err);
                    }

                    if (detalleOperario.length > 0) {
                        const splitOps = (raw) => String(raw || '')
                            .split(/[-/, ]+/)
                            .map(x => x.trim())
                            .filter(Boolean);

                        const trazabilidad = [];
                        detalleOperario.forEach((r) => {
                            const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
                            const maq = r.maquinaNombre || maquinas.find(m => m.id == r.maquinaId)?.nombre || `ID ${r.maquinaId}`;
                            const tiros = Number(r.tirosConEquivalencia || 0);
                            const horas = Number(r.totalHorasProductivas || 0);
                            const ops = splitOps(r.referenciaOP);
                            if (ops.length === 0) {
                                trazabilidad.push([fechaTxt, maq, '-', tiros.toLocaleString(), horas.toFixed(2)]);
                            } else {
                                ops.forEach(opCode => trazabilidad.push([fechaTxt, maq, opCode, tiros.toLocaleString(), horas.toFixed(2)]));
                            }
                        });

                        const trazabilidadUnique = trazabilidad.filter((row, idx, arr) =>
                            idx === arr.findIndex(r => r[0] === row[0] && r[1] === row[1] && r[2] === row[2] && r[3] === row[3] && r[4] === row[4])
                        );

                        tablesPayload.push({
                            title: `Trazabilidad OP (Cuándo, Dónde, Cuánto): ${operarioNombre}`,
                            columns: ['Fecha', 'Máquina', 'OP', 'Total Tiros', 'Hrs Prod'],
                            data: trazabilidadUnique,
                            isBreakdown: true,
                            headStyles: { fillColor: [88, 86, 214], textColor: 255, fontStyle: 'bold' },
                            styles: { fontSize: 8, cellPadding: 2.5 }
                        });

                        const usageMap = new Map();
                        detalleOperario.forEach((r) => {
                            const key = String(r.maquinaId);
                            const maq = r.maquinaNombre || maquinas.find(m => m.id == r.maquinaId)?.nombre || `ID ${r.maquinaId}`;
                            if (!usageMap.has(key)) {
                                usageMap.set(key, {
                                    maquina: maq,
                                    fechas: new Set(),
                                    horasOp: 0, horasProd: 0, alist: 0, muerto: 0, totalHoras: 0
                                });
                            }
                            const row = usageMap.get(key);
                            const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
                            row.fechas.add(fechaTxt);
                            row.horasOp += Number(r.horasOperativas || 0);
                            row.horasProd += Number(r.totalHorasProductivas || 0);
                            row.alist += Number(r.tiempoPuestaPunto || 0);
                            row.muerto += Number(r.totalTiemposMuertos || 0);
                            row.totalHoras += Number(r.totalHoras || 0);
                        });

                        const usageData = [...usageMap.values()]
                            .sort((a, b) => b.horasProd - a.horasProd)
                            .map((u) => {
                                const util = u.totalHoras > 0 ? (u.horasProd / u.totalHoras) * 100 : 0;
                                return [
                                    u.maquina,
                                    String(u.fechas.size),
                                    u.horasOp.toFixed(2),
                                    u.horasProd.toFixed(2),
                                    u.alist.toFixed(2),
                                    u.muerto.toFixed(2),
                                    u.totalHoras.toFixed(2),
                                    `${util.toFixed(1)}%`
                                ];
                            });

                        tablesPayload.push({
                            title: `Uso de Máquinas por Operario: ${operarioNombre}`,
                            columns: ['Máquina', 'Días', 'Hrs Op', 'Hrs Prod', 'Alist.', 'T.Muerto', 'Total Hrs', 'Utilización'],
                            data: usageData,
                            headStyles: { fillColor: [52, 107, 149], textColor: 255, fontStyle: 'bold' }
                        });

                        const opMap = new Map();
                        detalleOperario.forEach((r) => {
                            const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
                            const tiros = Number(r.tirosConEquivalencia || 0);
                            const prod = Number(r.totalHorasProductivas || 0);
                            const alist = Number(r.tiempoPuestaPunto || 0);
                            const muerto = Number(r.totalTiemposMuertos || 0);
                            const maq = r.maquinaNombre || maquinas.find(m => m.id == r.maquinaId)?.nombre || `ID ${r.maquinaId}`;
                            const ops = splitOps(r.referenciaOP);
                            ops.forEach((opCode) => {
                                if (!opMap.has(opCode)) opMap.set(opCode, { fechas: new Set(), maquinas: new Set(), tiros: 0, prod: 0, alist: 0, muerto: 0 });
                                const acc = opMap.get(opCode);
                                acc.fechas.add(fechaTxt);
                                acc.maquinas.add(maq);
                                acc.tiros += tiros;
                                acc.prod += prod;
                                acc.alist += alist;
                                acc.muerto += muerto;
                            });
                        });

                        const opData = [...opMap.entries()]
                            .sort((a, b) => b[1].tiros - a[1].tiros)
                            .map(([opCode, val]) => [
                                opCode,
                                String(val.fechas.size),
                                String(val.maquinas.size),
                                val.tiros.toLocaleString(),
                                val.prod.toFixed(2),
                                val.alist.toFixed(2),
                                val.muerto.toFixed(2)
                            ]);

                        if (opData.length > 0) {
                            tablesPayload.push({
                                title: `Resumen por OP: ${operarioNombre}`,
                                columns: ['OP', 'Días', 'Máquinas', 'Tiros', 'Hrs Prod', 'Alist.', 'T.Muerto'],
                                data: opData,
                                headStyles: { fillColor: [46, 139, 87], textColor: 255, fontStyle: 'bold' }
                            });
                        }
                    }

                    // Comparación de rendimiento (como cartas): Operario seleccionado vs resto
                    const allOperariosAgg = (resumen?.resumenOperarios || [])
                        .reduce((acc, item) => {
                            const key = String(item.usuarioId);
                            if (!acc[key]) {
                                acc[key] = {
                                    usuarioId: item.usuarioId,
                                    operario: item.operario || 'N/A',
                                    tiros: 0,
                                    meta: 0
                                };
                            }
                            acc[key].tiros += Number(item.totalTiros || 0);
                            acc[key].meta += Number(item.meta100Porciento || 0);
                            return acc;
                        }, {});

                    const compRows = Object.values(allOperariosAgg)
                        .map((x) => {
                            const pct = x.meta > 0 ? (x.tiros / x.meta) * 100 : 0;
                            return {
                                operario: x.operario,
                                tiros: x.tiros,
                                meta: x.meta,
                                pct
                            };
                        })
                        .sort((a, b) => b.pct - a.pct);

                    tablesPayload.push({
                        title: `Comparación Rendimiento Operario (Cartas): ${operarioNombre}`,
                        columns: ['Operario', 'Tiros', 'Meta 100%', 'Rendimiento %'],
                        data: compRows.map((r) => [
                            r.operario,
                            Math.round(r.tiros).toLocaleString(),
                            Math.round(r.meta).toLocaleString(),
                            `${r.pct.toFixed(1)}%`
                        ]),
                        headStyles: { fillColor: [123, 104, 238], textColor: 255, fontStyle: 'bold' }
                    });

                    const compOperarioMaquinas = sortedData
                        .map((item) => ({
                            maquina: item.maquina || 'N/A',
                            tiros: Number(item.totalTiros || 0),
                            meta: Number(item.meta100Porciento || 0),
                            pct: Number(item.porcentajeRendimiento100 || 0)
                        }))
                        .sort((a, b) => b.pct - a.pct);

                    tablesPayload.push({
                        title: `Comparación Rendimiento por Máquina del Operario: ${operarioNombre}`,
                        columns: ['Máquina', 'Tiros', 'Meta 100%', 'Rendimiento %'],
                        data: compOperarioMaquinas.map((r) => [
                            r.maquina,
                            Math.round(r.tiros).toLocaleString(),
                            Math.round(r.meta).toLocaleString(),
                            `${r.pct.toFixed(1)}%`
                        ]),
                        headStyles: { fillColor: [72, 149, 239], textColor: 255, fontStyle: 'bold' }
                    });
                }

            } else if (reportType === 'maquina') {
                const targetIds = [selectedMaquina];

                // Ordenar IDs de máquina naturalmente antes de iterar
                const sortedMaqIds = targetIds.map(id => {
                    const maq = maquinas.find(m => m.id == id);
                    return { id, nombre: maq?.nombre || '' };
                }).sort((a, b) => {
                    const getNum = (str) => { const m = str.match(/^(\d+)/); return m ? parseInt(m[1]) : 999; };
                    const numA = getNum(a.nombre);
                    const numB = getNum(b.nombre);
                    if (numA !== numB) return numA - numB;
                    return a.nombre.localeCompare(b.nombre);
                });

                for (const { id: maqId } of sortedMaqIds) {
                    const maquinaData = (resumen?.resumenMaquinas || []).filter(item => item.maquinaId == maqId);
                    if (maquinaData.length === 0) continue;

                    const maquinaNombre = maquinas.find(m => m.id == maqId)?.nombre || maquinaData[0].maquina || 'Desconocida';
                    const data = maquinaData.map(item => {
                        // Calcular color del semáforo basado en porcentajeRendimiento100
                        const pct100 = item.porcentajeRendimiento100 || 0;
                        let colorMaq = 'Rojo';
                        if (pct100 >= 100) colorMaq = 'Verde';
                        else if (pct100 >= 75) colorMaq = 'Amarillo';

                        return [
                            item.tirosTotales?.toString() || '0',
                            item.meta100Porciento?.toFixed(0) || '0',
                            `${colorMaq}|${pct100.toFixed(0)}%`
                        ];
                    });
                    tablesPayload.push({ title: `Maquina: ${maquinaNombre}`, columns: colsMaquina, data });

                    // Comparación de rendimiento por máquina (como cartas)
                    const compMaquinas = [...(resumen?.resumenMaquinas || [])]
                        .map((m) => ({
                            maquina: m.maquina || 'N/A',
                            tiros: Number(m.tirosTotales || 0),
                            meta: Number(m.meta100Porciento || 0),
                            pct: Number(m.porcentajeRendimiento100 || 0)
                        }))
                        .sort((a, b) => b.pct - a.pct);

                    tablesPayload.push({
                        title: `Comparación Rendimiento Máquinas (Cartas)`,
                        columns: ['Máquina', 'Tiros', 'Meta 100%', 'Rendimiento %'],
                        data: compMaquinas.map((r) => [
                            r.maquina,
                            Math.round(r.tiros).toLocaleString(),
                            Math.round(r.meta).toLocaleString(),
                            `${r.pct.toFixed(1)}%`
                        ]),
                        headStyles: { fillColor: [95, 158, 160], textColor: 255, fontStyle: 'bold' }
                    });

                    // Desglose detallado completo por máquina (todos los campos operativos)
                    let detalleRows = [];
                    try {
                        const resDet = await api.get(`/produccion/detalles-maquina?mes=${mes}&anio=${anio}&maquinaId=${maqId}`);
                        detalleRows = Array.isArray(resDet.data) ? resDet.data : [];
                    } catch (err) {
                        console.error(`Error cargando detalle de máquina ${maquinaNombre}`, err);
                    }

                    if (detalleRows.length > 0) {
                        const colsDetalleProd = [
                            'Fecha', 'Operario', 'OP', 'H.Ini', 'H.Fin',
                            'Hrs Op', 'Tiros Diar.', 'Cambios', 'Tiros Eq', 'Total Tiros'
                        ];
                        const colsDetalleTiempos = [
                            'Fecha', 'Operario', 'Alist.', 'Hrs Prod', 'Mto', 'Desc', 'Otros Aux', 'T.Muerto', 'Total Hrs'
                        ];
                        const colsOpFecha = ['Fecha', 'OP', 'Operario'];

                        let totalTirosD = 0;
                        let totalCambios = 0;
                        let totalTirosEq = 0;
                        let totalAlist = 0;
                        let totalProd = 0;
                        let totalMto = 0;
                        let totalDesc = 0;
                        let totalOtrosAux = 0;
                        let totalTMuerto = 0;
                        let totalHoras = 0;

                        const rowsSorted = [...detalleRows].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
                        const detailProd = [];
                        const detailTiempos = [];
                        const detailOpFecha = [];

                        rowsSorted.forEach((r) => {
                            const tirosD = Number(r.tirosDiarios || 0);
                            const cambios = Number(r.cambios || 0);
                            const tirosEq = Number(r.tirosConEquivalencia || 0) - tirosD;
                            const totalTiros = Number(r.tirosConEquivalencia || 0);
                            const alist = Number(r.tiempoPuestaPunto || 0);
                            const prod = Number(r.totalHorasProductivas || 0);
                            const mto = Number(r.horasMantenimiento || 0);
                            const desc = Number(r.horasDescanso || 0);
                            const otrosAux = Number(r.horasOtrosAux || 0);
                            const tmuerto = Number(r.totalTiemposMuertos || 0);
                            const hrs = Number(r.totalHoras || 0);
                            const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
                            const opNombre = usuarios.find(u => u.id == r.usuarioId)?.nombre || `ID ${r.usuarioId || '-'}`;
                            const opTxt = r.referenciaOP || '-';

                            totalTirosD += tirosD;
                            totalCambios += cambios;
                            totalTirosEq += tirosEq;
                            totalAlist += alist;
                            totalProd += prod;
                            totalMto += mto;
                            totalDesc += desc;
                            totalOtrosAux += otrosAux;
                            totalTMuerto += tmuerto;
                            totalHoras += hrs;

                            detailProd.push([
                                fechaTxt,
                                opNombre,
                                opTxt,
                                r.horaInicio ? String(r.horaInicio).slice(0, 5) : '-',
                                r.horaFin ? String(r.horaFin).slice(0, 5) : '-',
                                Number(r.horasOperativas || 0).toFixed(2),
                                tirosD.toLocaleString(),
                                cambios.toString(),
                                tirosEq.toLocaleString(),
                                totalTiros.toLocaleString()
                            ]);

                            detailTiempos.push([
                                fechaTxt,
                                opNombre,
                                alist.toFixed(2),
                                prod.toFixed(2),
                                mto.toFixed(2),
                                desc.toFixed(2),
                                otrosAux.toFixed(2),
                                tmuerto.toFixed(2),
                                hrs.toFixed(2)
                            ]);

                            const ops = String(opTxt)
                                .split(/[-/, ]+/)
                                .map(x => x.trim())
                                .filter(Boolean);

                            if (ops.length === 0) {
                                detailOpFecha.push([fechaTxt, '-', opNombre]);
                            } else {
                                ops.forEach((opVal) => {
                                    detailOpFecha.push([fechaTxt, opVal, opNombre]);
                                });
                            }
                        });

                        detailProd.push([
                            'TOTALES', '-', '-', '-', '-',
                            '-',
                            totalTirosD.toLocaleString(),
                            totalCambios.toString(),
                            totalTirosEq.toLocaleString(),
                            (totalTirosD + totalTirosEq).toLocaleString()
                        ]);

                        detailTiempos.push([
                            'TOTALES', '-',
                            totalAlist.toFixed(2),
                            totalProd.toFixed(2),
                            totalMto.toFixed(2),
                            totalDesc.toFixed(2),
                            totalOtrosAux.toFixed(2),
                            totalTMuerto.toFixed(2),
                            totalHoras.toFixed(2)
                        ]);

                        tablesPayload.push({
                            title: `Desglose Producción: ${maquinaNombre}`,
                            columns: colsDetalleProd,
                            data: detailProd,
                            isBreakdown: true,
                            headStyles: { fillColor: [70, 130, 180], textColor: 255, fontStyle: 'bold' },
                            styles: { fontSize: 7, cellPadding: 2 }
                        });

                        tablesPayload.push({
                            title: `Desglose Tiempos: ${maquinaNombre}`,
                            columns: colsDetalleTiempos,
                            data: detailTiempos,
                            isBreakdown: true,
                            headStyles: { fillColor: [52, 107, 149], textColor: 255, fontStyle: 'bold' },
                            styles: { fontSize: 7, cellPadding: 2 }
                        });

                        const detailOpFechaUnique = detailOpFecha.filter((row, index, arr) =>
                            index === arr.findIndex(r => r[0] === row[0] && r[1] === row[1] && r[2] === row[2])
                        );
                        tablesPayload.push({
                            title: `OP Trabajada por Fecha: ${maquinaNombre}`,
                            columns: colsOpFecha,
                            data: detailOpFechaUnique,
                            headStyles: { fillColor: [88, 86, 214], textColor: 255, fontStyle: 'bold' },
                            styles: { fontSize: 8, cellPadding: 2.5 }
                        });
                    }
                }
            } else if (reportType === 'bonificacion') {
                const columns = ['Operario', 'Maquina', 'Rendimiento %', 'Bonif. Potencial', 'Bonif. Real'];

                // 1) Fuente de rendimiento (tablero)
                const resumenOps = [...(resumen?.resumenOperarios || [])];
                const rendimientoMap = resumenOps.reduce((acc, item) => {
                    const key = `${Number(item.usuarioId)}-${Number(item.maquinaId)}`;
                    acc[key] = Number(item.porcentajeRendimiento100 || 0);
                    return acc;
                }, {});

                // 2) Fuente oficial de Vr Pagar = mismas filas diarias que usa la grilla/export mensual.
                let allOps = [];
                try {
                    const resExport = await api.get(`/produccion/export-mensual?mes=${mes}&anio=${anio}`);
                    const rows = Array.isArray(resExport?.data?.resumen) ? resExport.data.resumen : [];

                    const grouped = rows.reduce((acc, r) => {
                        const key = `${Number(r.usuarioId)}-${Number(r.maquinaId)}`;
                        if (!acc[key]) {
                            acc[key] = {
                                usuarioId: Number(r.usuarioId),
                                maquinaId: Number(r.maquinaId),
                                operario: r.operario || 'N/A',
                                maquina: r.maquina || 'N/A',
                                valorAPagar: 0
                            };
                        }
                        acc[key].valorAPagar += Number(r.valorAPagar || 0);
                        return acc;
                    }, {});

                    allOps = Object.values(grouped).map(item => ({
                        ...item,
                        porcentajeRendimiento100: Number(rendimientoMap[`${item.usuarioId}-${item.maquinaId}`] || 0)
                    }));
                } catch (e) {
                    // fallback de seguridad
                    allOps = resumenOps.map(item => ({
                        usuarioId: Number(item.usuarioId),
                        maquinaId: Number(item.maquinaId),
                        operario: item.operario,
                        maquina: item.maquina,
                        porcentajeRendimiento100: Number(item.porcentajeRendimiento100 || 0),
                        valorAPagar: Number(item.valorAPagar ?? item.valorBonifPotencial ?? 0)
                    }));
                }

                // Aplicar filtros activos para cuadrar con vista
                if (viewFilterMaquina) allOps = allOps.filter(item => item.maquinaId == viewFilterMaquina);
                if (viewFilterOperario) allOps = allOps.filter(item => item.usuarioId == viewFilterOperario);

                if (allOps.length === 0) {
                    alert('No hay datos disponibles en este periodo.');
                    setGeneratingPdf(false);
                    return;
                }

                const data = allOps.map(item => {
                    const bonifPotencial = Number(item.valorAPagar || 0);
                    const bonifReal = Number(item.valorAPagar || 0);
                    return [
                        item.operario,
                        item.maquina,
                        `${Number(item.porcentajeRendimiento100 || 0).toFixed(0)}%`,
                        `$${bonifPotencial.toLocaleString()}`,
                        `$${bonifReal.toLocaleString()}`
                    ];
                });

                const totalBonosPotencial = allOps.reduce((sum, item) => sum + Number(item.valorAPagar || 0), 0);
                const totalBonosReal = totalBonosPotencial;

                data.push([
                    { content: 'TOTALES', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: `$${totalBonosPotencial.toLocaleString()}`, styles: { fontStyle: 'bold' } },
                    { content: `$${totalBonosReal.toLocaleString()}`, styles: { fontStyle: 'bold' } }
                ]);

                tablesPayload.push({
                    title: 'Reporte de Gastos y Bonificaciones (Todos los Operarios)',
                    columns,
                    data,
                    headStyles: { fillColor: [40, 167, 69], textColor: 255, fontStyle: 'bold' }
                });
            } else if (reportType === 'historialRendimiento') {
                if (esMesExcluidoHistorialRendimiento(mes, anio)) {
                    alert('Noviembre y diciembre de 2025 no se tienen en cuenta. Elija otro mes final.');
                    setGeneratingPdf(false);
                    return;
                }

                const numMeses = 12;
                const rango = buildRangoMesesHistorial(mes, anio, numMeses);
                const mesKey = (m, a) => `${a}-${m}`;

                const resumenesMes = await Promise.all(
                    rango.map(async ({ mes: m, anio: a }) => {
                        try {
                            const r = await api.get(`/produccion/resumen?mes=${m}&anio=${a}`);
                            return { mes: m, anio: a, resumenOperarios: r.data?.resumenOperarios || [] };
                        } catch (_) {
                            return { mes: m, anio: a, resumenOperarios: [] };
                        }
                    })
                );

                const porOperario = new Map();
                resumenesMes.forEach(({ mes: m, anio: a, resumenOperarios }) => {
                    if (esMesExcluidoHistorialRendimiento(m, a)) return;
                    agregarRendimientoOperariosCartas(resumenOperarios).forEach((op) => {
                        const uid = String(op.usuarioId ?? op.operario);
                        if (!porOperario.has(uid)) {
                            porOperario.set(uid, { operario: op.operario, meses: {} });
                        }
                        const entry = porOperario.get(uid);
                        if (op.operario && op.operario !== 'N/A') entry.operario = op.operario;
                        entry.meses[mesKey(m, a)] = op;
                    });
                });

                if (porOperario.size === 0) {
                    alert('No hay datos de rendimiento en el rango seleccionado.');
                    setGeneratingPdf(false);
                    return;
                }

                const mesTieneDatosPlanta = (resumenOperarios) =>
                    agregarRendimientoOperariosCartas(resumenOperarios).some(
                        (op) => op.pesoHoras > 0 || op.meta > 0
                    );

                const rangoVisible = resumenesMes
                    .filter(({ mes: m, anio: a, resumenOperarios }) =>
                        !esMesExcluidoHistorialRendimiento(m, a) && mesTieneDatosPlanta(resumenOperarios))
                    .map(({ mes: m, anio: a }) => ({ mes: m, anio: a }));

                if (rangoVisible.length === 0) {
                    alert('No hay datos de rendimiento en el rango seleccionado.');
                    setGeneratingPdf(false);
                    return;
                }

                const desde = rangoVisible[0];
                const hasta = rangoVisible[rangoVisible.length - 1];
                const periodoHist = rangoVisible.length === 1
                    ? `${getMesNombre(hasta.mes)} ${hasta.anio}`
                    : `${getMesNombre(desde.mes)} ${desde.anio} a ${getMesNombre(hasta.mes)} ${hasta.anio}`;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.text(`Periodo: ${periodoHist}`, pageWidth / 2, 30, { align: 'center' });

                const columnasMes = rangoVisible.map(({ mes: m, anio: a }) => etiquetaMesCortoHistorial(m, a));
                const ultimoKey = mesKey(mes, anio);
                const semaforoColumnIndexes = rangoVisible.map((_, idx) => idx + 1);

                const operarioActivoEnMesFinal = (entry) => {
                    const info = entry.meses[ultimoKey];
                    return info && (info.pesoHoras > 0 || info.meta > 0);
                };

                const filasOrdenadas = [...porOperario.values()]
                    .filter(operarioActivoEnMesFinal)
                    .map((entry) => {
                        const ultimoInfo = entry.meses[ultimoKey];
                        const celdasMes = rangoVisible.map(({ mes: m, anio: a }) => {
                            const info = entry.meses[mesKey(m, a)];
                            if (!info || (info.pesoHoras <= 0 && info.meta <= 0)) return '-';
                            return `${info.semaforo}|${info.pct.toFixed(0)}%`;
                        });
                        return {
                            operario: entry.operario,
                            ultimoPct: Number(ultimoInfo.pct),
                            row: [entry.operario, ...celdasMes]
                        };
                    })
                    .sort((a, b) => {
                        if (b.ultimoPct !== a.ultimoPct) return b.ultimoPct - a.ultimoPct;
                        return (a.operario || '').localeCompare(b.operario || '', 'es');
                    });

                if (filasOrdenadas.length === 0) {
                    alert(`No hay operarios con rendimiento en ${getMesNombre(mes)} ${anio}.`);
                    setGeneratingPdf(false);
                    return;
                }

                const filas = filasOrdenadas.map((x) => x.row);

                tablesPayload.push({
                    title: 'Evolución mensual por operario',
                    columns: ['Operario', ...columnasMes],
                    data: filas,
                    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' },
                    styles: { fontSize: 7, cellPadding: 2 },
                    semaforoColumnIndexes
                });
            } else if (reportType === 'cierreMensual') {
                const resumenOps = resumen?.resumenOperarios || [];
                const resumenMaq = resumen?.resumenMaquinas || [];
                const money = (v) => `$${Math.round(Number(v || 0)).toLocaleString('es-CO')}`;

                const umbralMeta = 75;

                // Mismo criterio de Cartas: rendimiento real ponderado por horas (productivas + auxiliares).
                const operariosConRendimientoReal = Object.values(
                    resumenOps.reduce((acc, item) => {
                        const key = String(item.usuarioId ?? item.operario ?? 'sin-id');
                        const pesoHoras = Number(item.totalHorasProductivas || 0) + Number(item.totalHorasAuxiliares || 0);
                        const rendimiento = Number(item.porcentajeRendimiento100 || 0);
                        if (!acc[key]) {
                            acc[key] = {
                                usuarioId: item.usuarioId,
                                operario: item.operario || 'Operario',
                                pesoTotal: 0,
                                rendimientoPonderado: 0,
                                maquinas: 0
                            };
                        }
                        acc[key].pesoTotal += pesoHoras;
                        acc[key].rendimientoPonderado += (rendimiento * pesoHoras);
                        acc[key].maquinas += 1;
                        return acc;
                    }, {})
                ).map(op => ({
                    ...op,
                    rendimientoReal: op.pesoTotal > 0 ? (op.rendimientoPonderado / op.pesoTotal) : 0
                }));

                const opsBajoMeta = operariosConRendimientoReal
                    .filter(o => Number(o.rendimientoReal || 0) < umbralMeta)
                    .sort((a, b) => Number(a.rendimientoReal || 0) - Number(b.rendimientoReal || 0));

                const maqsBajoMeta = resumenMaq
                    .filter(m => Number(m.porcentajeRendimiento100 || 0) < umbralMeta)
                    .sort((a, b) => Number(a.porcentajeRendimiento100 || 0) - Number(b.porcentajeRendimiento100 || 0));

                const top3Operarios = [...operariosConRendimientoReal]
                    .sort((a, b) => Number(b.rendimientoReal || 0) - Number(a.rendimientoReal || 0))
                    .slice(0, 3);

                const fetchSafe = async (url) => {
                    try {
                        const r = await api.get(url);
                        if (Array.isArray(r.data)) return r.data;
                        if (Array.isArray(r.data?.gastos)) return r.data.gastos;
                        return r.data ?? [];
                    } catch (_) {
                        return [];
                    }
                };
                const diasMes = new Date(Number(anio), Number(mes), 0).getDate();
                const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
                const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;

                // Usar endpoints dedicados de horas extras para no perder nombre/cantidad/valor.
                const [heProduccion, heTalleres] = await Promise.all([
                    fetchSafe(`/produccion/gastos/horas-extras-report?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`),
                    fetchSafe(`/talleres/gastos/horas-extras-report?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
                ]);

                const horasExtrasOps = [...heProduccion, ...heTalleres]
                    .reduce((acc, row) => {
                        const nombre = row.usuarioNombre || row.UsuarioNombre || row.personalNombre || row.PersonalNombre || 'Sin Operario';
                        const horas = Number(row.cantidadHoras ?? row.CantidadHoras ?? 0);
                        const monto = calcValorAPagarLabor(row);
                        if (!acc[nombre]) acc[nombre] = { horas: 0, monto: 0 };
                        acc[nombre].horas += Number.isFinite(horas) ? horas : 0;
                        acc[nombre].monto += Number.isFinite(monto) ? monto : 0;
                        return acc;
                    }, {});
                const sumByKeys = (rows, keys) => rows.reduce((s, row) => {
                    const key = keys.find(k => row?.[k] !== undefined && row?.[k] !== null);
                    return s + Number(key ? row[key] : 0);
                }, 0);

                const [gProd, pProd, gMant, pMantGrid, gPlan, pPlan, gDis, pDis, gSst, pSst, gGh, pGhGrid, gTall, pTall] = await Promise.all([
                    fetchSafe(`/produccion/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/produccion/presupuestos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/mantenimiento/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/mantenimiento/presupuestos-grid?anio=${anio}`),
                    fetchSafe(`/planeacion/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/planeacion/presupuestos?anio=${anio}`),
                    fetchSafe(`/diseno/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/diseno/presupuestos?anio=${anio}`),
                    fetchSafe(`/sst/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/sst/presupuestos?anio=${anio}`),
                    fetchSafe(`/gh/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/gh/presupuestos?anio=${anio}`),
                    fetchSafe(`/talleres/gastos?anio=${anio}&mes=${mes}`),
                    fetchSafe(`/talleres/presupuestos?anio=${anio}`)
                ]);
                const toRows = (value) => Array.isArray(value) ? value : [];
                const getGastoRows = (rows) => toRows(rows).map(r => ({
                    rubro: r.rubroNombre || r.RubroNombre || r.rubro?.nombre || r.Rubro?.Nombre || r.tipoServicioNombre || r.TipoServicioNombre || 'Sin Rubro',
                    gasto: Math.abs(Number(r.precio ?? r.Precio ?? 0))
                }));
                const mergeByRubro = (rows) => rows.reduce((acc, row) => {
                    const rubro = String(row.rubro || 'Sin Rubro');
                    acc[rubro] = (acc[rubro] || 0) + Number(row.gasto || 0);
                    return acc;
                }, {});
                const budgetMapSimple = (rows) => toRows(rows)
                    .filter(r => Number(r.mes ?? r.Mes ?? 0) === Number(mes))
                    .reduce((acc, r) => {
                        const rubro = r.rubroNombre
                            || r.RubroNombre
                            || r.rubro?.nombre
                            || r.Rubro?.Nombre
                            || r.tipoServicioNombre
                            || r.TipoServicioNombre
                            || 'Sin Rubro';
                        const presupuesto = Number(r.presupuesto ?? r.Presupuesto ?? 0);
                        acc[rubro] = (acc[rubro] || 0) + presupuesto;
                        return acc;
                    }, {});
                const budgetMapGrid = (grid) => {
                    const src = grid?.tiposServicio || grid?.TiposServicio || [];
                    return toRows(src).reduce((acc, item) => {
                        const rubro = item.tipoServicioNombre || item.TipoServicioNombre || item.rubroNombre || item.RubroNombre || 'Sin Rubro';
                        const meses = item.meses || item.Meses || [];
                        const match = toRows(meses).find(mr => Number(mr.mes ?? mr.Mes ?? 0) === Number(mes));
                        const presupuesto = Number(match?.presupuesto ?? match?.Presupuesto ?? 0);
                        acc[rubro] = (acc[rubro] || 0) + presupuesto;
                        return acc;
                    }, {});
                };

                const prodGastos = getGastoRows(gProd);
                const mantGastos = getGastoRows(gMant);
                const planGastos = getGastoRows(gPlan);
                const disGastos = getGastoRows(gDis);
                const sstGastos = getGastoRows(gSst);
                const ghGastos = getGastoRows(gGh);
                const tallGastos = getGastoRows(gTall);

                const prodBudget = budgetMapSimple(pProd);
                const mantBudget = budgetMapGrid(pMantGrid);
                const planBudget = budgetMapSimple(pPlan);
                const disBudget = budgetMapSimple(pDis);
                const sstBudget = budgetMapSimple(pSst);
                const ghBudget = budgetMapGrid(pGhGrid);
                const tallBudget = budgetMapSimple(pTall);

                const areaBreakdown = [
                    { area: 'Producción', gastos: mergeByRubro(prodGastos), presupuestos: prodBudget },
                    { area: 'Mantenimiento', gastos: mergeByRubro(mantGastos), presupuestos: mantBudget },
                    { area: 'Planeación', gastos: mergeByRubro(planGastos), presupuestos: planBudget },
                    { area: 'Diseño', gastos: mergeByRubro(disGastos), presupuestos: disBudget },
                    { area: 'SST', gastos: mergeByRubro(sstGastos), presupuestos: sstBudget },
                    { area: 'Gestión Humana', gastos: mergeByRubro(ghGastos), presupuestos: ghBudget },
                    { area: 'Talleres', gastos: mergeByRubro(tallGastos), presupuestos: tallBudget }
                ];

                const budgetFinal = areaBreakdown.map(x => {
                    const gasto = Object.values(x.gastos).reduce((s, v) => s + Number(v || 0), 0);
                    const presupuesto = Object.values(x.presupuestos).reduce((s, v) => s + Number(v || 0), 0);
                    const excedente = gasto - presupuesto;
                    const excesoPct = presupuesto > 0 ? (excedente / presupuesto) * 100 : 0;
                    return { area: x.area, gasto, presupuesto, excedente, excesoPct };
                });

                const areaMayorGasto = [...budgetFinal].sort((a, b) => b.gasto - a.gasto)[0] || { area: 'N/D', gasto: 0 };

                tablesPayload.push({
                    title: `Cierre Mensual - ${getMesNombre(mes)} ${anio}`,
                    columns: ['Indicador', 'Valor'],
                    data: [
                        ['Operarios bajo meta (<75%)', `${opsBajoMeta.length} de ${operariosConRendimientoReal.length}`],
                        ['Máquinas bajo meta (<75%)', `${maqsBajoMeta.length} de ${resumenMaq.length}`],
                        ['Área con mayor gasto', `${areaMayorGasto.area} (${money(areaMayorGasto.gasto)})`]
                    ],
                    headStyles: { fillColor: [33, 37, 41], textColor: 255, fontStyle: 'bold' }
                });

                if (opsBajoMeta.length > 0) {
                    tablesPayload.push({
                        title: 'Operarios bajo meta (rendimiento real < 75%)',
                        columns: ['Operario', 'Rendimiento Real %', 'Máquinas evaluadas'],
                        data: opsBajoMeta.map(o => [o.operario, `${Number(o.rendimientoReal || 0).toFixed(1)}%`, String(o.maquinas || 0)]),
                        headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' }
                    });
                }

                if (maqsBajoMeta.length > 0) {
                    tablesPayload.push({
                        title: 'Máquinas bajo meta (rendimiento < 75%)',
                        columns: ['Máquina', 'Rendimiento %'],
                        data: maqsBajoMeta.map(m => [m.maquina, `${Number(m.porcentajeRendimiento100 || 0).toFixed(1)}%`]),
                        headStyles: { fillColor: [253, 126, 20], textColor: 255, fontStyle: 'bold' }
                    });
                }

                tablesPayload.push({
                    title: 'Top 3 Operarios con mejor rendimiento real',
                    columns: ['Operario', 'Rendimiento Real %'],
                    data: top3Operarios.map(t => [t.operario, `${Number(t.rendimientoReal || 0).toFixed(1)}%`]),
                    headStyles: { fillColor: [25, 135, 84], textColor: 255, fontStyle: 'bold' }
                });

                const horasExtrasRows = Object.entries(horasExtrasOps)
                    .sort((a, b) => b[1].monto - a[1].monto)
                    .map(([op, valores]) => [op, Number(valores.horas || 0).toFixed(2), money(valores.monto || 0)]);
                let horasExtrasData = horasExtrasRows.length ? [...horasExtrasRows] : [['Sin datos', '0.00', '$0']];
                let horasExtrasHighlightLast = false;
                if (horasExtrasRows.length > 0) {
                    const totalHeHoras = Object.values(horasExtrasOps).reduce((s, v) => s + Number(v.horas || 0), 0);
                    const totalHeMonto = Object.values(horasExtrasOps).reduce((s, v) => s + Number(v.monto || 0), 0);
                    horasExtrasData.push(['Total', totalHeHoras.toFixed(2), money(totalHeMonto)]);
                    horasExtrasHighlightLast = true;
                }
                tablesPayload.push({
                    title: 'Horas extra por operario',
                    columns: ['Operario', 'Horas Totales', 'Gasto Horas Extra'],
                    data: horasExtrasData,
                    headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
                    highlightLastBodyRow: horasExtrasHighlightLast
                });

                const totalGastadoAreas = budgetFinal.reduce((s, r) => s + Number(r.gasto || 0), 0);
                const presupuestoVsGastoData = [
                    ...budgetFinal.map(r => [
                        r.area,
                        money(r.presupuesto),
                        money(r.gasto),
                        money(r.excedente),
                        `${r.excesoPct.toFixed(1)}%`
                    ]),
                    ['Total', '', money(totalGastadoAreas), '', '']
                ];
                tablesPayload.push({
                    title: 'Presupuesto vs Gasto por área',
                    columns: ['Área', 'Presupuesto', 'Gastado', 'Excedente', 'Exceso %'],
                    data: presupuestoVsGastoData,
                    headStyles: { fillColor: [111, 66, 193], textColor: 255, fontStyle: 'bold' },
                    highlightLastBodyRow: true
                });

                areaBreakdown.forEach((areaItem) => {
                    const rubros = [...new Set([
                        ...Object.keys(areaItem.gastos || {}),
                        ...Object.keys(areaItem.presupuestos || {})
                    ])];
                    if (rubros.length === 0) return;

                    const rows = rubros
                        .sort((a, b) => a.localeCompare(b, 'es'))
                        .map((rubro) => {
                            const gastado = Number(areaItem.gastos?.[rubro] || 0);
                            const tienePresupuesto = Object.prototype.hasOwnProperty.call(areaItem.presupuestos || {}, rubro);
                            const presupuesto = Number(areaItem.presupuestos?.[rubro] || 0);
                            const diferencia = gastado - presupuesto;
                            const estado = !tienePresupuesto
                                ? 'Sin presupuesto'
                                : diferencia > 0
                                    ? `Se pasó ${money(diferencia)}`
                                    : `Bajo ${money(Math.abs(diferencia))}`;

                            return [
                                rubro,
                                money(gastado),
                                tienePresupuesto ? money(presupuesto) : '$0 (Sin presupuesto)',
                                `${diferencia >= 0 ? '+' : '-'}${money(Math.abs(diferencia))}`,
                                estado
                            ];
                        });

                    const totalGastadoRubros = rubros.reduce((s, rubro) => s + Number(areaItem.gastos?.[rubro] || 0), 0);
                    const rowsConTotal = [...rows, ['Total', money(totalGastadoRubros), '', '', '']];

                    tablesPayload.push({
                        title: `Detalle Presupuesto por Rubro - ${areaItem.area}`,
                        columns: ['Rubro', 'Gastado', 'Presupuesto', 'Diferencia', 'Estado'],
                        data: rowsConTotal,
                        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
                        highlightLastBodyRow: true
                    });
                });
            } else if (reportType === 'alistamiento') {
                // Si se elige una sola máquina, sacar detalle registro a registro del mes.
                if (selectedMaquina !== 'todos') {
                    const maqId = Number(selectedMaquina);
                    const maquinaNombre = maquinas.find(m => m.id == maqId)?.nombre || `Máquina ${maqId}`;

                    let detalleRows = [];
                    try {
                        const resDet = await api.get(`/produccion/detalles-maquina?mes=${mes}&anio=${anio}&maquinaId=${maqId}`);
                        detalleRows = Array.isArray(resDet.data) ? resDet.data : [];
                    } catch (err) {
                        console.error('Error cargando detalle de máquina para alistamiento:', err);
                        alert('No se pudo cargar el detalle de alistamiento para esta máquina.');
                        setGeneratingPdf(false);
                        return;
                    }

                    const columns = ['Fecha', 'Operario', 'Hrs Alistamiento', 'Cambios', 'Prom/Cambio', 'Hrs efectivas (meta)', '% Alistamiento'];
                    let totalAlist = 0;
                    let totalCambios = 0;
                    let totalReportadas = 0;

                    const data = detalleRows
                        // Solo filas con tiempo de alistamiento real (> 0)
                        .filter((r) => Number(r.tiempoPuestaPunto || 0) > 0)
                        .sort((a, b) => {
                            const hA = Number(a.tiempoPuestaPunto || 0);
                            const hB = Number(b.tiempoPuestaPunto || 0);
                            if (hB !== hA) return hB - hA;
                            return String(a.fecha || '').localeCompare(String(b.fecha || ''));
                        })
                        .map((r) => {
                            const alist = Number(r.tiempoPuestaPunto || 0);
                            const cambios = Number(r.cambios || 0);
                            const reportadas = horasEfectivasDiaDesdeDetalle(r);
                            const prom = cambios > 0 ? alist / cambios : 0;
                            const pct = reportadas > 0 ? (alist / reportadas) * 100 : 0;
                            const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
                            const opNombre = usuarios.find(u => u.id == r.usuarioId)?.nombre || `ID ${r.usuarioId || '-'}`;

                            totalAlist += alist;
                            totalCambios += cambios;
                            totalReportadas += reportadas;

                            return [
                                fechaTxt,
                                opNombre,
                                alist.toFixed(2),
                                cambios.toString(),
                                prom.toFixed(2),
                                reportadas.toFixed(2),
                                `${pct.toFixed(2)}%`
                            ];
                        });

                    if (data.length === 0) {
                        alert('No hay registros mensuales para esta máquina en el periodo.');
                        setGeneratingPdf(false);
                        return;
                    }

                    const totalProm = totalCambios > 0 ? (totalAlist / totalCambios) : 0;
                    const totalPct = totalReportadas > 0 ? (totalAlist / totalReportadas) * 100 : 0;
                    data.push([
                        'TOTALES',
                        '-',
                        totalAlist.toFixed(2),
                        totalCambios.toString(),
                        totalProm.toFixed(2),
                        totalReportadas.toFixed(2),
                        `${totalPct.toFixed(2)}%`
                    ]);

                    tablesPayload.push({
                        title: `Reporte de Tiempos de Alistamiento - ${maquinaNombre}`,
                        columns,
                        data,
                        isBreakdown: true,
                        headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' }
                    });
                } else {
                const targetIds = selectedMaquina === 'todos'
                    ? [...new Set((resumen?.resumenMaquinas || []).map(i => i.maquinaId))]
                    : [selectedMaquina];

                const columns = ['Máquina', 'Hrs Alistamiento', 'Cambios', 'Prom/Cambio', 'Hrs efectivas (meta)', '% Alistamiento'];
                let totalAlist = 0;
                let totalCambios = 0;
                let totalReportadas = 0;

                const data = targetIds
                    .map((maqId) => (resumen?.resumenMaquinas || []).find(item => item.maquinaId == maqId))
                    .filter(Boolean)
                    // Orden principal: mayor a menor tiempo de alistamiento
                    .sort((a, b) => Number(b.totalTiempoPuestaPunto || 0) - Number(a.totalTiempoPuestaPunto || 0))
                    .map((m) => {
                        const horasAlist = Number(m.totalTiempoPuestaPunto || 0);
                        const cambios = Number(m.totalCambios || 0);
                        const reportadas = horasEfectivasMetaDesdeResumenMaq(m);
                        const promCambio = cambios > 0 ? horasAlist / cambios : 0;
                        const pctAlist = reportadas > 0 ? (horasAlist / reportadas) * 100 : 0;

                        totalAlist += horasAlist;
                        totalCambios += cambios;
                        totalReportadas += reportadas;

                        return [
                            m.maquina,
                            horasAlist.toFixed(2),
                            cambios.toString(),
                            promCambio.toFixed(2),
                            reportadas.toFixed(2),
                            `${pctAlist.toFixed(2)}%`
                        ];
                    });

                if (data.length === 0) {
                    alert('No hay datos de alistamiento para el filtro seleccionado.');
                    setGeneratingPdf(false);
                    return;
                }

                const totalProm = totalCambios > 0 ? (totalAlist / totalCambios) : 0;
                const totalPct = totalReportadas > 0 ? (totalAlist / totalReportadas) * 100 : 0;
                data.push([
                    'TOTALES',
                    totalAlist.toFixed(2),
                    totalCambios.toString(),
                    totalProm.toFixed(2),
                    totalReportadas.toFixed(2),
                    `${totalPct.toFixed(2)}%`
                ]);

                tablesPayload.push({
                    title: 'Reporte de Tiempos de Alistamiento',
                    columns,
                    data,
                    isBreakdown: true,
                    headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' }
                });
                }
            } else if (reportType === 'tiemposMuertos') {
                // Detalle granular con clasificación y subcódigos (historial / TiemposProceso)
                let registrosMuertos = [];
                try {
                    const resExp = await api.get(`produccion/export-mensual?mes=${mes}&anio=${anio}`);
                    const detalle = Array.isArray(resExp.data?.detalleTiempos) ? resExp.data.detalleTiempos : [];
                    registrosMuertos = detalle.filter((t) => esActividadTiempoMuerto(t.actividadCodigo));
                    if (selectedMaquina !== 'todos') {
                        const maqId = Number(selectedMaquina);
                        registrosMuertos = registrosMuertos.filter((t) => Number(t.maquinaId) === maqId);
                    }
                } catch (err) {
                    console.error('Error cargando detalle de tiempos muertos con subcódigos:', err);
                    alert('No se pudo cargar el detalle de clasificación y subcódigos.');
                    setGeneratingPdf(false);
                    return;
                }

                const incluirColumnaMaquina = selectedMaquina === 'todos';

                // --- Tabla resumen (ProduccionDiaria) ---
                if (selectedMaquina !== 'todos') {
                    const maqId = Number(selectedMaquina);
                    const maquinaNombre = maquinas.find(m => m.id == maqId)?.nombre || `Máquina ${maqId}`;

                    let detalleRows = [];
                    try {
                        const resDet = await api.get(`/produccion/detalles-maquina?mes=${mes}&anio=${anio}&maquinaId=${maqId}`);
                        detalleRows = Array.isArray(resDet.data) ? resDet.data : [];
                    } catch (err) {
                        console.error('Error cargando detalle de máquina para tiempos muertos:', err);
                        alert('No se pudo cargar el detalle de tiempos muertos para esta máquina.');
                        setGeneratingPdf(false);
                        return;
                    }

                    const columns = ['Fecha', 'Operario', 'Falta Trabajo', 'Reparación', 'Otros', 'T.Muerto', '% Muerto', 'Tarifa/H', 'Costo'];
                    let totalFalta = 0;
                    let totalReparacion = 0;
                    let totalOtros = 0;
                    let totalMuerto = 0;
                    let totalCosto = 0;
                    const tarifaMaq = Number((resumen?.resumenMaquinas || []).find(m => m.maquinaId == maqId)?.tarifa || 0);

                    const data = detalleRows
                        .filter((r) =>
                            Number(r.totalTiemposMuertos || 0) > 0 ||
                            Number(r.tiempoFaltaTrabajo || 0) > 0 ||
                            Number(r.tiempoReparacion || 0) > 0 ||
                            Number(r.tiempoOtroMuerto || 0) > 0
                        )
                        .sort((a, b) => {
                            const costoA = Number(a.totalTiemposMuertos || 0) * tarifaMaq;
                            const costoB = Number(b.totalTiemposMuertos || 0) * tarifaMaq;
                            if (costoB !== costoA) return costoB - costoA;
                            return Number(b.totalTiemposMuertos || 0) - Number(a.totalTiemposMuertos || 0);
                        })
                        .map((r) => {
                            const falta = Number(r.tiempoFaltaTrabajo || 0);
                            const reparacion = Number(r.tiempoReparacion || 0);
                            const otros = Number(r.tiempoOtroMuerto || 0);
                            const muerto = Number(r.totalTiemposMuertos || 0);
                            const reportadas = horasEfectivasDiaDesdeDetalle(r);
                            const pct = reportadas > 0 ? (muerto / reportadas) * 100 : 0;
                            const costo = muerto * tarifaMaq;
                            const fechaTxt = r.fecha ? String(r.fecha).split('T')[0] : '';
                            const opNombre = usuarios.find(u => u.id == r.usuarioId)?.nombre || `ID ${r.usuarioId || '-'}`;

                            totalFalta += falta;
                            totalReparacion += reparacion;
                            totalOtros += otros;
                            totalMuerto += muerto;
                            totalCosto += costo;

                            return [
                                fechaTxt,
                                opNombre,
                                falta.toFixed(2),
                                reparacion.toFixed(2),
                                otros.toFixed(2),
                                muerto.toFixed(2),
                                `${pct.toFixed(2)}%`,
                                `$${tarifaMaq.toLocaleString()}`,
                                `$${Math.round(costo).toLocaleString()}`
                            ];
                        });

                    if (data.length === 0 && registrosMuertos.length === 0) {
                        alert('No hay registros mensuales para esta máquina en el periodo.');
                        setGeneratingPdf(false);
                        return;
                    }

                    if (data.length > 0) {
                        data.push([
                            'TOTALES',
                            '-',
                            totalFalta.toFixed(2),
                            totalReparacion.toFixed(2),
                            totalOtros.toFixed(2),
                            totalMuerto.toFixed(2),
                            '-',
                            '-',
                            `$${Math.round(totalCosto).toLocaleString()}`
                        ]);

                        tablesPayload.push({
                            title: `Resumen Tiempos Muertos - ${maquinaNombre}`,
                            columns,
                            data,
                            isBreakdown: true,
                            headStyles: { fillColor: [178, 34, 34], textColor: 255, fontStyle: 'bold' }
                        });
                    }
                } else {
                    const targetIds = [...new Set((resumen?.resumenMaquinas || []).map(i => i.maquinaId))];
                    const columns = ['Máquina', 'Falta Trabajo', 'Reparación', 'Otros', 'T.Muerto', '% Muerto', 'Tarifa/H', 'Costo'];
                    let totalFalta = 0;
                    let totalReparacion = 0;
                    let totalOtros = 0;
                    let totalMuerto = 0;
                    let totalCosto = 0;

                    const data = targetIds
                        .map((maqId) => (resumen?.resumenMaquinas || []).find(item => item.maquinaId == maqId))
                        .filter(Boolean)
                        .sort((a, b) => {
                            const costoA = Number(a.totalTiemposMuertos || 0) * Number(a.tarifa || 0);
                            const costoB = Number(b.totalTiemposMuertos || 0) * Number(b.tarifa || 0);
                            if (costoB !== costoA) return costoB - costoA;
                            return Number(b.totalTiemposMuertos || 0) - Number(a.totalTiemposMuertos || 0);
                        })
                        .map((m) => {
                            const falta = Number(m.totalTiempoFaltaTrabajo || 0);
                            const reparacion = Number(m.totalTiempoReparacion || 0);
                            const otros = Number(m.totalTiempoOtro || 0);
                            const tm = Number(m.totalTiemposMuertos || 0);
                            const reportadas = horasEfectivasMetaDesdeResumenMaq(m);
                            const pct = reportadas > 0 ? (tm / reportadas) * 100 : 0;
                            const tarifa = Number(m.tarifa || 0);
                            const costo = tm * tarifa;

                            totalFalta += falta;
                            totalReparacion += reparacion;
                            totalOtros += otros;
                            totalMuerto += tm;
                            totalCosto += costo;

                            return [
                                m.maquina,
                                falta.toFixed(2),
                                reparacion.toFixed(2),
                                otros.toFixed(2),
                                tm.toFixed(2),
                                `${pct.toFixed(2)}%`,
                                `$${tarifa.toLocaleString()}`,
                                `$${Math.round(costo).toLocaleString()}`
                            ];
                        });

                    if (data.length === 0 && registrosMuertos.length === 0) {
                        alert('No hay datos de tiempos muertos para el filtro seleccionado.');
                        setGeneratingPdf(false);
                        return;
                    }

                    if (data.length > 0) {
                        data.push([
                            'TOTALES',
                            totalFalta.toFixed(2),
                            totalReparacion.toFixed(2),
                            totalOtros.toFixed(2),
                            totalMuerto.toFixed(2),
                            '-',
                            '-',
                            `$${Math.round(totalCosto).toLocaleString()}`
                        ]);

                        tablesPayload.push({
                            title: 'Resumen Tiempos Muertos por Máquina',
                            columns,
                            data,
                            isBreakdown: true,
                            headStyles: { fillColor: [178, 34, 34], textColor: 255, fontStyle: 'bold' }
                        });
                    }
                }

                // Gráficos de pastel por máquina (clasificación: falta / reparación / otro)
                if (registrosMuertos.length > 0) {
                    const porMaquinaClasif = new Map();
                    registrosMuertos.forEach((t) => {
                        const maqNombre = t.maquina || 'Sin máquina';
                        const clasif = clasificacionTiempoMuerto(t.actividadCodigo, t.actividad);
                        const horas = Number(t.duracionHoras || 0);
                        if (horas <= 0) return;
                        if (!porMaquinaClasif.has(maqNombre)) porMaquinaClasif.set(maqNombre, new Map());
                        const clasifMap = porMaquinaClasif.get(maqNombre);
                        clasifMap.set(clasif, (clasifMap.get(clasif) || 0) + horas);
                    });
                    tiemposMuertosPieCharts = [...porMaquinaClasif.entries()]
                        .map(([maquina, clasifMap]) => ({
                            maquina,
                            slices: [...clasifMap.entries()]
                                .map(([label, horas]) => ({ label, horas }))
                                .sort((a, b) => b.horas - a.horas)
                        }))
                        .filter((c) => c.slices.length > 0)
                        .sort((a, b) => {
                            const totalA = a.slices.reduce((s, x) => s + x.horas, 0);
                            const totalB = b.slices.reduce((s, x) => s + x.horas, 0);
                            return totalB - totalA;
                        });

                    // --- Detalle registro a registro con subcódigos ---
                    const colsDetalle = incluirColumnaMaquina
                        ? ['Fecha', 'Máquina', 'Operario', 'Clasificación', 'Cód.', 'Subcódigo', 'Detalle', 'Inicio', 'Fin', 'Horas', 'OP', 'Obs.']
                        : ['Fecha', 'Operario', 'Clasificación', 'Cód.', 'Subcódigo', 'Detalle', 'Inicio', 'Fin', 'Horas', 'OP', 'Obs.'];
                    let totalHorasDet = 0;
                    const dataDetalle = registrosMuertos
                        .slice()
                        .sort((a, b) => {
                            const fa = String(a.fecha || '');
                            const fb = String(b.fecha || '');
                            if (fa !== fb) return fa.localeCompare(fb);
                            const ma = String(a.maquina || '');
                            const mb = String(b.maquina || '');
                            if (ma !== mb) return ma.localeCompare(mb);
                            return String(a.horaInicio || '').localeCompare(String(b.horaInicio || ''));
                        })
                        .map((t) => {
                            const horas = Number(t.duracionHoras || 0);
                            totalHorasDet += horas;
                            const clasif = clasificacionTiempoMuerto(t.actividadCodigo, t.actividad);
                            const codAct = normalizarCodigoActividad(t.actividadCodigo) || '-';
                            const subCod = String(t.subCodigoActividad || '').trim() || '-';
                            const subDet = String(t.subCodigoDetalle || '').trim() || '-';
                            const fechaTxt = t.fecha ? String(t.fecha).split('T')[0] : '';
                            const opNombre = t.operario || usuarios.find(u => u.id == t.usuarioId)?.nombre || '-';
                            const horaIni = t.horaInicio ? String(t.horaInicio).substring(0, 5) : '';
                            const horaFin = t.horaFin ? String(t.horaFin).substring(0, 5) : '';
                            const obs = String(t.observaciones || '').trim();
                            const obsCorta = obs.length > 40 ? `${obs.slice(0, 37)}...` : (obs || '-');

                            const fila = [
                                fechaTxt,
                                opNombre,
                                clasif,
                                codAct,
                                subCod,
                                subDet,
                                horaIni,
                                horaFin,
                                horas.toFixed(2),
                                t.referenciaOP || '-',
                                obsCorta,
                            ];
                            if (incluirColumnaMaquina) {
                                return [fechaTxt, t.maquina || '-', ...fila.slice(1)];
                            }
                            return fila;
                        });

                    dataDetalle.push(
                        incluirColumnaMaquina
                            ? ['TOTALES', '-', '-', '-', '-', '-', '-', '-', '-', totalHorasDet.toFixed(2), '-', '-']
                            : ['TOTALES', '-', '-', '-', '-', '-', '-', '-', totalHorasDet.toFixed(2), '-', '-']
                    );

                    const tituloDetalle = selectedMaquina !== 'todos'
                        ? `Detalle Clasificación y Subcódigos - ${maquinas.find(m => m.id == selectedMaquina)?.nombre || 'Máquina'}`
                        : 'Detalle Clasificación y Subcódigos (Tiempos Muertos)';

                    tablesPayload.push({
                        title: tituloDetalle,
                        columns: colsDetalle,
                        data: dataDetalle,
                        isBreakdown: true,
                        headStyles: { fillColor: [120, 0, 0], textColor: 255, fontStyle: 'bold' },
                        styles: { fontSize: 7, cellPadding: 1.5 }
                    });
                }

                if (tiemposMuertosPieCharts.length > 0) {
                    const pieIdx = tablesPayload.findIndex((t) =>
                        t.title && String(t.title).includes('Detalle Clasificación')
                    );
                    const marker = { isTiemposMuertosPies: true };
                    if (pieIdx >= 0) tablesPayload.splice(pieIdx, 0, marker);
                    else tablesPayload.push(marker);
                }
            } else if (reportType === 'op') {
                const resumenMaquinas = Array.isArray(opData?.resumenMaquinas) ? opData.resumenMaquinas : [];
                const detalleDiario = Array.isArray(opData?.detalleDiario) ? opData.detalleDiario : [];
                const gastosPorModulo = Array.isArray(opData?.gastosPorModulo) ? opData.gastosPorModulo : [];
                const gastosDetalle = Array.isArray(opData?.gastosDetalle) ? opData.gastosDetalle : [];
                const opCode = opData?.op || selectedOPReport.trim();

                tablesPayload.push({
                    title: `Reporte Integral OP ${opCode} - Resumen por Máquina`,
                    columns: ['Máquina', 'Días', 'Registros', 'Tiros Totales', 'Desperdicio'],
                    data: resumenMaquinas.map((r) => [
                        r.maquina || '-',
                        String(r.dias ?? 0),
                        String(r.registros ?? 0),
                        Number(r.tirosTotales || 0).toLocaleString(),
                        Number(r.desperdicioTotal || 0).toFixed(2)
                    ]),
                    headStyles: { fillColor: [46, 139, 87], textColor: 255, fontStyle: 'bold' }
                });

                tablesPayload.push({
                    title: `OP ${opCode} - Detalle Diario`,
                    columns: ['Fecha', 'Máquina', 'Registros', 'Operarios', 'Tiros', 'Desperdicio'],
                    data: detalleDiario.map((r) => [
                        r.fecha || '-',
                        r.maquina || '-',
                        String(r.registros ?? 0),
                        String(r.operarios ?? 0),
                        Number(r.tirosTotales || 0).toLocaleString(),
                        Number(r.desperdicioTotal || 0).toFixed(2)
                    ]),
                    isBreakdown: true,
                    headStyles: { fillColor: [70, 130, 180], textColor: 255, fontStyle: 'bold' }
                });

                tablesPayload.push({
                    title: `OP ${opCode} - Gastos por Módulo`,
                    columns: ['Módulo', 'Registros', 'Total'],
                    data: gastosPorModulo.map((g) => [
                        g.modulo || '-',
                        String(g.registros ?? 0),
                        `$${Math.round(Number(g.total || 0)).toLocaleString()}`
                    ]),
                    headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' }
                });

                if (gastosDetalle.length > 0) {
                    tablesPayload.push({
                        title: `OP ${opCode} - Gastos Detallados`,
                        columns: ['Fecha', 'Módulo', 'Rubro', 'Valor', 'Nota'],
                        data: gastosDetalle.map((g) => [
                            g.fecha || '-',
                            g.modulo || '-',
                            g.rubro || '-',
                            `$${Math.round(Number(g.valor || 0)).toLocaleString()}`,
                            g.nota || ''
                        ]),
                        isBreakdown: true,
                        headStyles: { fillColor: [120, 120, 120], textColor: 255, fontStyle: 'bold' }
                    });
                }
            } else if (reportType === 'oee') {
                if (!oeeResumen) {
                    oeeResumen = construirFilasReporteOee(
                        resumen?.resumenMaquinas,
                        mes,
                        anio,
                        naturalSort,
                        reportPeriod === 'semanal' ? (semana - 1) * 7 + 1 : null,
                        reportPeriod === 'semanal' ? Math.min(semana * 7, new Date(anio, mes, 0).getDate()) : null
                    );
                }

                if (!oeeResumen.filas.length) {
                    alert('No hay datos de máquinas para generar el reporte OEE en este período.');
                    setGeneratingPdf(false);
                    return;
                }

                const oeeData = oeeResumen.filas.map(f => f.row);
                oeeData.push([
                    'TOTAL PLANTA',
                    '',
                    '',
                    '',
                    '',
                    '',
                    oeeResumen.totalPuntajePlanta.toFixed(2)
                ]);

                tablesPayload.push({
                    title: 'OEE por Máquina',
                    columns: ['Máquina', 'Rendimiento (%)', 'Disponibilidad (%)', 'Calidad (%)', 'OEE (%)', 'Importancia (%)', 'Puntaje Final'],
                    data: oeeData,
                    isOeeTable: true,
                    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' }
                });
            }

            // Render Logic (Sequential)
            let lastY = 60; // Después del título y calificación

            const setSemaforoColor = (data) => {
                const raw = data.cell.raw;
                if (!raw) return;
                const text = raw.toString();

                let colorKey = text;
                let displayText = '';

                if (text.includes('|')) {
                    const parts = text.split('|');
                    colorKey = parts[0];
                    displayText = parts[1];
                } else if (text === '-') {
                    return; // No styling
                }

                const lowerText = colorKey.toLowerCase();

                // Set percentage text if available, otherwise clear simple color text
                data.cell.text = displayText;

                if (lowerText.includes('rojo')) {
                    data.cell.styles.fillColor = [255, 204, 204]; // Light Red
                } else if (lowerText.includes('amarillo')) {
                    data.cell.styles.fillColor = [255, 245, 204];
                } else if (lowerText.includes('verde')) {
                    data.cell.styles.fillColor = [204, 255, 204]; // Light Green
                }
            };

            // Helper: Draw a bar chart directly in the PDF using jsPDF primitives
            // This works on both web and mobile without requiring DOM
            const drawBarChart = (doc, title, labels, data, startY, options = {}) => {
                const { colors = null, width = 180, height = 80 } = options;
                const pageWidth = doc.internal.pageSize.getWidth();
                const startX = (pageWidth - width) / 2;

                // Check if we need a new page
                if (startY + height + 30 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    startY = 30;
                }

                // Title
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(title, pageWidth / 2, startY, { align: 'center' });

                const chartStartY = startY + 10;
                const chartHeight = height - 20;
                const barWidth = (width - 20) / Math.max(data.length, 1);
                const maxValue = Math.max(...data.map(d => typeof d === 'number' ? d : parseFloat(d) || 0), 1);

                // Draw bars
                data.forEach((value, index) => {
                    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                    const barHeight = (numValue / maxValue) * chartHeight;
                    const x = startX + 10 + (index * barWidth);
                    const y = chartStartY + chartHeight - barHeight;

                    // Bar color
                    let color = [65, 105, 225]; // Default royal blue
                    if (colors && colors[index]) {
                        const hex = colors[index].replace('#', '');
                        color = [
                            parseInt(hex.substring(0, 2), 16),
                            parseInt(hex.substring(2, 4), 16),
                            parseInt(hex.substring(4, 6), 16)
                        ];
                    }

                    doc.setFillColor(...color);
                    doc.rect(x + 1, y, barWidth - 2, barHeight, 'F');

                    // Value on top
                    doc.setFontSize(7);
                    doc.setTextColor(0, 0, 0);
                    const valueText = numValue >= 1000 ? (numValue / 1000).toFixed(1) + 'k' : numValue.toString();
                    doc.text(valueText, x + barWidth / 2, y - 2, { align: 'center' });

                    // Label at bottom (truncated)
                    const label = typeof labels[index] === 'string'
                        ? labels[index].substring(0, 8)
                        : Array.isArray(labels[index])
                            ? labels[index][0].substring(0, 8)
                            : '';
                    doc.setFontSize(6);
                    doc.text(label, x + barWidth / 2, chartStartY + chartHeight + 8, { align: 'center' });
                });

                // Draw axis line
                doc.setDrawColor(200, 200, 200);
                doc.line(startX + 10, chartStartY + chartHeight, startX + width - 10, chartStartY + chartHeight);

                return startY + height + 15;
            };

            // Helper: Draw a line chart directly in the PDF
            const drawLineChart = (doc, title, labels, data, startY, options = {}) => {
                const { width = 180, height = 80 } = options;
                const pageWidth = doc.internal.pageSize.getWidth();
                const startX = (pageWidth - width) / 2;

                // Check if we need a new page
                if (startY + height + 30 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    startY = 30;
                }

                // Title
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(title, pageWidth / 2, startY, { align: 'center' });

                const chartStartY = startY + 10;
                const chartHeight = height - 20;
                const pointSpacing = (width - 30) / Math.max(data.length - 1, 1);
                const maxValue = Math.max(...data.map(d => typeof d === 'number' ? d : parseFloat(d) || 0), 1);

                // Draw grid lines
                doc.setDrawColor(230, 230, 230);
                for (let i = 0; i <= 4; i++) {
                    const y = chartStartY + (chartHeight * i / 4);
                    doc.line(startX + 15, y, startX + width - 15, y);
                }

                // Draw line
                doc.setDrawColor(0, 123, 255);
                doc.setLineWidth(0.5);

                const points = data.map((value, index) => {
                    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                    return {
                        x: startX + 15 + (index * pointSpacing),
                        y: chartStartY + chartHeight - (numValue / maxValue) * chartHeight
                    };
                });

                for (let i = 0; i < points.length - 1; i++) {
                    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
                }

                // Draw points and values
                doc.setFillColor(0, 123, 255);
                points.forEach((point, index) => {
                    doc.circle(point.x, point.y, 1.5, 'F');

                    // Value on top
                    const numValue = typeof data[index] === 'number' ? data[index] : parseFloat(data[index]) || 0;
                    doc.setFontSize(6);
                    doc.setTextColor(0, 0, 0);
                    const valueText = numValue >= 1000 ? (numValue / 1000).toFixed(1) + 'k' : numValue.toString();
                    doc.text(valueText, point.x, point.y - 4, { align: 'center' });

                    // Label at bottom (every few points to avoid clutter)
                    if (index % Math.ceil(data.length / 10) === 0 || index === data.length - 1) {
                        const label = typeof labels[index] === 'string' ? labels[index].substring(0, 6) : '';
                        doc.text(label, point.x, chartStartY + chartHeight + 8, { align: 'center' });
                    }
                });

                // Draw axis line
                doc.setDrawColor(200, 200, 200);
                doc.line(startX + 15, chartStartY + chartHeight, startX + width - 15, chartStartY + chartHeight);

                return startY + height + 15;
            };

            const renderTiemposMuertosPies = async (startY) => {
                if (!tiemposMuertosPieCharts.length) return startY;
                const COLOR_CLASIF_TM = {
                    'Falta de Trabajo': 'rgba(255,193,7,0.9)',
                    'Reparación': 'rgba(220,53,69,0.9)',
                    'Otro Tiempo Muerto': 'rgba(13,110,253,0.9)',
                };
                const COLORES_EXTRA = [
                    'rgba(25,135,84,0.9)',
                    'rgba(111,66,193,0.9)',
                    'rgba(253,126,20,0.9)',
                    'rgba(32,201,151,0.9)',
                ];
                let pieY = startY;
                if (pieY + 30 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    pieY = 25;
                }
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(139, 0, 0);
                doc.text('Distribución de tiempos muertos por máquina', pageWidth / 2, pieY, { align: 'center' });
                doc.setTextColor(0, 0, 0);
                pieY += 12;

                const pieW = 88;
                const pieH = 68;
                const pieGapX = 8;
                const pieRowH = pieH + 18;
                let pieCol = 0;
                let pieRowY = pieY;

                const fetchPieBase64 = async (chartConfig) => {
                    const resp = await fetch('https://quickchart.io/chart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chart: chartConfig,
                            width: 520,
                            height: 400,
                            backgroundColor: 'white',
                            format: 'png',
                        }),
                    });
                    if (!resp.ok) return null;
                    const blob = await resp.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = () => resolve(reader.result);
                    });
                };

                for (let i = 0; i < tiemposMuertosPieCharts.length; i++) {
                    const { maquina, slices } = tiemposMuertosPieCharts[i];
                    const totalHoras = slices.reduce((s, x) => s + x.horas, 0);
                    if (totalHoras <= 0) continue;

                    if (pieCol === 0 && pieRowY + pieRowH > doc.internal.pageSize.getHeight() - 15) {
                        doc.addPage();
                        pieRowY = 25;
                    }

                    const labels = slices.map((s) => {
                        const pct = ((s.horas / totalHoras) * 100).toFixed(1);
                        return `${s.label} (${s.horas.toFixed(1)}h · ${pct}%)`;
                    });
                    const dataVals = slices.map((s) => Number(s.horas.toFixed(2)));
                    const bgColors = slices.map((s, idx) =>
                        COLOR_CLASIF_TM[s.label] || COLORES_EXTRA[idx % COLORES_EXTRA.length]
                    );

                    try {
                        const b64 = await fetchPieBase64({
                            type: 'pie',
                            data: {
                                labels,
                                datasets: [{
                                    data: dataVals,
                                    backgroundColor: bgColors,
                                    borderColor: '#ffffff',
                                    borderWidth: 2,
                                }],
                            },
                            options: {
                                title: {
                                    display: true,
                                    text: maquina,
                                    fontSize: 14,
                                },
                                legend: { position: 'bottom', labels: { fontSize: 9 } },
                                plugins: {
                                    datalabels: {
                                        color: '#fff',
                                        font: { weight: 'bold', size: 11 },
                                        textAlign: 'center',
                                        formatter:
                                            'function(value, ctx) { var d = ctx.chart.data.datasets[0].data; var t = d.reduce(function(a, b) { return a + b; }, 0); var pct = t > 0 ? (value / t * 100).toFixed(1) : "0"; return value.toFixed(1) + "h\\n" + pct + "%"; }',
                                    },
                                },
                            },
                            plugins: ['chartjs-plugin-datalabels'],
                        });

                        if (b64) {
                            const x = pieCol === 0
                                ? (pageWidth - pieW * 2 - pieGapX) / 2
                                : (pageWidth - pieW * 2 - pieGapX) / 2 + pieW + pieGapX;
                            doc.addImage(b64, 'PNG', x, pieRowY, pieW, pieH);
                        }
                    } catch (pieErr) {
                        console.log('Error gráfico pastel tiempos muertos:', pieErr);
                    }

                    pieCol += 1;
                    if (pieCol >= 2) {
                        pieCol = 0;
                        pieRowY += pieRowH;
                    }
                }
                return pieCol === 1 ? pieRowY + pieRowH + 10 : pieRowY + (pieCol > 0 ? pieRowH + 10 : 10);
            };

            // Render Tables
            for (let idx = 0; idx < tablesPayload.length; idx++) {
                const tbl = tablesPayload[idx];
                if (tbl.isTiemposMuertosPies) {
                    if (idx > 0) lastY = doc.lastAutoTable.finalY + 15;
                    lastY = await renderTiemposMuertosPies(lastY);
                    continue;
                }

                // If not first table, advance Y position (respetar Y tras bloque de pasteles)
                if (idx > 0) {
                    const prev = tablesPayload[idx - 1];
                    if (!prev.isTiemposMuertosPies && doc.lastAutoTable?.finalY != null) {
                        lastY = doc.lastAutoTable.finalY + 15;
                    }
                }

                // If lastY is too low, add page
                if (lastY > doc.internal.pageSize.getHeight() - 30) {
                    doc.addPage();
                    lastY = 20;
                }

                doc.setFontSize(14);
                doc.text(tbl.title, 14, lastY - 5);

                autoTable(doc, {
                    head: [tbl.columns],
                    body: tbl.data,
                    startY: lastY,
                    styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5, lineColor: [255, 255, 255], ...(tbl.styles || {}) },
                    headStyles: tbl.headStyles || { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                    didParseCell: (data) => {
                        // 1. Semaphore Logic
                        if (data.section === 'body') {
                            const header = tbl.columns[data.column.index];
                            if (header && (header.includes('Semaforo') || header.includes('Sem '))) {
                                setSemaforoColor(data);
                            }
                            if (tbl.semaforoColumnIndexes?.includes(data.column.index)) {
                                setSemaforoColor(data);
                            }

                        }

                        // 2. Breakdown Totals Logic
                        if (tbl.isBreakdown && data.section === 'body' && data.row.index === tbl.data.length - 1) {
                            data.cell.styles.fillColor = [220, 220, 220];
                            data.cell.styles.fontStyle = 'bold';
                        }

                        if (tbl.highlightLastBodyRow && data.section === 'body' && data.row.index === tbl.data.length - 1) {
                            data.cell.styles.fillColor = [220, 220, 220];
                            data.cell.styles.fontStyle = 'bold';
                        }

                        if (tbl.isOeeTable && data.section === 'body' && data.row.index < tbl.data.length - 1) {
                            if (data.column.index === 4) {
                                const val = parseFloat(data.cell.raw);
                                if (val >= 90) data.cell.styles.textColor = [0, 128, 0];
                                else if (val >= 75) data.cell.styles.textColor = [200, 150, 0];
                                else data.cell.styles.textColor = [200, 0, 0];
                                data.cell.styles.fontStyle = 'bold';
                            }
                            if (data.column.index === 0) {
                                data.cell.styles.halign = 'left';
                            }
                        }
                        if (tbl.isOeeTable && data.section === 'body' && data.row.index === tbl.data.length - 1) {
                            data.cell.styles.fillColor = [0, 51, 102];
                            data.cell.styles.textColor = 255;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    },
                    margin: { top: 20 }
                });
            }

            // CHARTS GENERATION using jsPDF primitives (works on web and mobile)
            let chartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : 120;

            if (reportType === 'general') {
                console.log("Generating general report charts...");

                // --- REMOVED CHARTS AS PER USER REQUEST (Top Prod, Speed, Efficiency) ---
                /*
                // Chart 1: Top Production (Tiros)
                if ((resumen?.resumenOperarios || []).length > 0) { ... }
                // Chart 2: Speed (Promedio/Hora)
                if ((resumen?.resumenOperarios || []).length > 0) { ... }
                */

                // *** NEW: TABLA DE HORAS MUERTAS Y COSTOS ***
                if ((resumen?.resumenMaquinas || []).length > 0) {
                    const hmColumns = ['Máquina', 'Falta Trabajo', 'Reparación', 'Otros Tiempos', 'T. Muer (Hrs)', '% Muer', 'Tarifa/H', 'Costo T.M.'];

                    let totalHorasMuertas = 0;
                    let totalCosto = 0;
                    let totalFalta = 0;
                    let totalReparacion = 0;
                    let totalOtros = 0;

                    const hmData = (resumen?.resumenMaquinas || [])
                        .filter(m => (m.totalTiemposMuertos || 0) > 0) // Hide if 0 hours
                        .sort((a, b) => (b.totalTiemposMuertos || 0) - (a.totalTiemposMuertos || 0)) // Mayor a menor
                        .map(m => {
                            const tm = m.totalTiemposMuertos || 0;
                            const tFalta = m.totalTiempoFaltaTrabajo || 0;
                            const tRep = m.totalTiempoReparacion || 0;
                            const tOtros = m.totalTiempoOtro || 0;

                            const totalBase = Math.max(horasEfectivasMetaDesdeResumenMaq(m), 1);

                            const pct = (tm / totalBase) * 100;
                            const costo = tm * (m.tarifa || 0);

                            totalHorasMuertas += tm;
                            totalCosto += costo;
                            totalFalta += tFalta;
                            totalReparacion += tRep;
                            totalOtros += tOtros;

                            return [
                                m.maquina,
                                tFalta.toFixed(2),
                                tRep.toFixed(2),
                                tOtros.toFixed(2),
                                tm.toFixed(2),
                                `${pct.toFixed(2)}%`,
                                `$${(m.tarifa || 0).toLocaleString()}`,
                                `$${costo.toLocaleString()}`
                            ];
                        });

                    // Add Total Row
                    hmData.push([
                        'TOTALES',
                        totalFalta.toFixed(2),
                        totalReparacion.toFixed(2),
                        totalOtros.toFixed(2),
                        totalHorasMuertas.toFixed(2),
                        '-',
                        '-',
                        `$${totalCosto.toLocaleString()}`
                    ]);

                    // Check if we need a new page for Title + Header + at least one row (~60 units)
                    if (chartY + 60 > doc.internal.pageSize.getHeight() - 20) {
                        doc.addPage();
                        chartY = 30;
                    }

                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 51, 102);
                    doc.text('ANÁLISIS DE TIEMPOS MUERTOS Y COSTOS', pageWidth / 2, chartY, { align: 'center' });
                    doc.setTextColor(0, 0, 0);

                    autoTable(doc, {
                        head: [hmColumns],
                        body: hmData,
                        startY: chartY + 5,
                        pageBreak: 'avoid',
                        styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
                        headStyles: { fillColor: [178, 34, 34], textColor: 255, fontStyle: 'bold' },
                        columnStyles: {
                            0: { halign: 'left' },
                            7: { fontStyle: 'bold' }
                        },
                        didParseCell: (data) => {
                            if (data.section === 'body' && data.row.index === hmData.length - 1) {
                                data.cell.styles.fontStyle = 'bold';
                                data.cell.styles.fillColor = [220, 220, 220];
                            }
                        }
                    });

                    chartY = doc.lastAutoTable.finalY + 20;
                }

                // *** NEW: TABLA DE PUESTA A PUNTO ***
                if ((resumen?.resumenMaquinas || []).length > 0) {
                    const papColumns = ['Máquina', 'Total Horas', 'Promedio/Cambio', '% Tiempo', 'Cambios'];
                    let totalPapHoras = 0;
                    let totalPapCambios = 0;

                    // Calculate total reported hours for the filtered group to perform correct % calc on Total Row
                    // Filter machines with setup activity or changes
                    const papMachines = (resumen?.resumenMaquinas || [])
                        .filter(m => (m.totalTiempoPuestaPunto || 0) > 0 || (m.totalCambios || 0) > 0)
                        .sort((a, b) => (b.totalTiempoPuestaPunto || 0) - (a.totalTiempoPuestaPunto || 0));

                    const papData = papMachines.map(m => {
                        const horas = m.totalTiempoPuestaPunto || 0;
                        const cambios = m.totalCambios || 0;
                        const totalBase = Math.max(horasEfectivasMetaDesdeResumenMaq(m), 1);

                        const promedio = cambios > 0 ? (horas / cambios) : 0;
                        const pct = (horas / totalBase) * 100;

                        totalPapHoras += horas;
                        totalPapCambios += cambios;

                        return [
                            m.maquina,
                            horas.toFixed(2),
                            promedio.toFixed(2),
                            `${pct.toFixed(2)}%`,
                            cambios.toString()
                        ];
                    });

                    if (papData.length > 0) {
                        // Total Row Calculations
                        const totalPromedio = totalPapCambios > 0 ? (totalPapHoras / totalPapCambios) : 0;
                        // Sum total hours only for the machines displayed to keep consistency in the table context
                        const sumTotalReported = papMachines.reduce((acc, m) => acc + horasEfectivasMetaDesdeResumenMaq(m), 0);
                        const totalPct = sumTotalReported > 0 ? (totalPapHoras / sumTotalReported) * 100 : 0;

                        papData.push([
                            'TOTALES',
                            totalPapHoras.toFixed(2),
                            totalPromedio.toFixed(2),
                            `${totalPct.toFixed(2)}%`,
                            totalPapCambios.toString()
                        ]);

                        // Check page break
                        if (chartY + 60 > doc.internal.pageSize.getHeight() - 20) {
                            doc.addPage();
                            chartY = 30;
                        }

                        doc.setFontSize(14);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text('ANÁLISIS DE PUESTA A PUNTO', pageWidth / 2, chartY, { align: 'center' });
                        doc.setTextColor(0, 0, 0);

                        autoTable(doc, {
                            head: [papColumns],
                            body: papData,
                            startY: chartY + 5,
                            pageBreak: 'avoid',
                            styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
                            headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' },
                            columnStyles: {
                                0: { halign: 'left' },
                                4: { fontStyle: 'bold' }
                            },
                            didParseCell: (data) => {
                                if (data.section === 'body' && data.row.index === papData.length - 1) {
                                    data.cell.styles.fontStyle = 'bold';
                                    data.cell.styles.fillColor = [220, 220, 220];
                                }
                            }
                        });

                        chartY = doc.lastAutoTable.finalY + 20;
                    }
                }

                // --- Festivos Colombia (usado por ambas tablas de Disponibilidad) ---
                const calcularPascua = (year) => {
                    const a = year % 19;
                    const b = Math.floor(year / 100);
                    const c = year % 100;
                    const d = Math.floor(b / 4);
                    const e = b % 4;
                    const f = Math.floor((b + 8) / 25);
                    const g = Math.floor((b - f + 1) / 3);
                    const h = (19 * a + b - d - g + 15) % 30;
                    const i = Math.floor(c / 4);
                    const k = c % 4;
                    const l = (32 + 2 * e + 2 * i - h - k) % 7;
                    const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
                    const mesP = Math.floor((h + l - 7 * m2 + 114) / 31);
                    const diaP = ((h + l - 7 * m2 + 114) % 31) + 1;
                    return new Date(year, mesP - 1, diaP);
                };
                const trasladarALunes = (fecha) => {
                    const ds = fecha.getDay();
                    if (ds === 1) return fecha;
                    const diasHastaLunes = (1 - ds + 7) % 7 || 7;
                    return new Date(fecha.getTime() + diasHastaLunes * 24 * 60 * 60 * 1000);
                };
                const obtenerFestivosColombia = (year) => {
                    const f = [];
                    f.push(new Date(year, 0, 1));   // Año Nuevo
                    f.push(new Date(year, 4, 1));   // Día del Trabajo
                    f.push(new Date(year, 6, 20));  // Independencia
                    f.push(new Date(year, 7, 7));   // Boyacá
                    f.push(new Date(year, 11, 8));  // Inmaculada
                    f.push(new Date(year, 11, 25)); // Navidad
                    const pascua = calcularPascua(year);
                    f.push(new Date(pascua.getTime() - 3 * 24 * 60 * 60 * 1000)); // Jueves Santo
                    f.push(new Date(pascua.getTime() - 2 * 24 * 60 * 60 * 1000)); // Viernes Santo
                    f.push(trasladarALunes(new Date(pascua.getTime() + 39 * 24 * 60 * 60 * 1000))); // Ascensión
                    f.push(trasladarALunes(new Date(pascua.getTime() + 60 * 24 * 60 * 60 * 1000))); // Corpus Christi
                    f.push(trasladarALunes(new Date(pascua.getTime() + 68 * 24 * 60 * 60 * 1000))); // Sagrado Corazón
                    f.push(trasladarALunes(new Date(year, 0, 6)));   // Reyes Magos
                    f.push(trasladarALunes(new Date(year, 2, 19)));  // San José
                    f.push(trasladarALunes(new Date(year, 5, 29)));  // San Pedro y San Pablo
                    f.push(trasladarALunes(new Date(year, 7, 15)));  // Asunción
                    f.push(trasladarALunes(new Date(year, 9, 12)));  // Día de la Raza
                    f.push(trasladarALunes(new Date(year, 10, 1)));  // Todos los Santos
                    f.push(trasladarALunes(new Date(year, 10, 11))); // Independencia Cartagena
                    if (year === 2026) f.push(new Date(2026, 6, 13)); // Festivo excepcional
                    return f;
                };
                const esFestivo = (fecha, festivos) => festivos.some(f =>
                    f.getDate() === fecha.getDate() && f.getMonth() === fecha.getMonth() && f.getFullYear() === fecha.getFullYear()
                );

                // Calcular Horas Turno del mes (Lun-Vie: 8h, Sáb: 4h, Dom/Festivo: 0h)
                const calcularHorasTurno = (mesVal, anioVal) => {
                    const diasEnMes = new Date(anioVal, mesVal, 0).getDate();
                    const festivosArr = obtenerFestivosColombia(anioVal);
                    let horasTurno = 0;
                    for (let dia = 1; dia <= diasEnMes; dia++) {
                        const fecha = new Date(anioVal, mesVal - 1, dia);
                        const diaSemana = fecha.getDay();
                        if (diaSemana === 0) continue;
                        if (esFestivo(fecha, festivosArr)) continue;
                        if (diaSemana >= 1 && diaSemana <= 5) horasTurno += 8;
                        else if (diaSemana === 6) horasTurno += 4;
                    }
                    return horasTurno;
                };
                const horasTurnoMes = calcularHorasTurno(mes, anio);

                // *** ANÁLISIS DE DISPONIBILIDAD POR TIEMPO ***
                if ((resumen?.resumenMaquinas || []).length > 0) {

                    const dispColumns = ['Máquina', 'Hrs Productivas', 'Hrs Turno', 'Disponibilidad (%)'];

                    let totalProd = 0;

                    const dispData = (resumen?.resumenMaquinas || [])
                        .filter(m => (m.totalHorasProductivas || 0) > 0 || (m.totalHoras || 0) > 0)
                        .sort(naturalSort)
                        .map(m => {
                            const hrsProductivas = m.totalHorasProductivas || 0;
                            const hrsTurnoMaq = Number(m.horasTurnoMes) > 0 ? Number(m.horasTurnoMes) : horasTurnoMes;
                            const disponibilidad = hrsTurnoMaq > 0
                                ? (hrsProductivas / hrsTurnoMaq) * 100
                                : 0;

                            totalProd += hrsProductivas;

                            return [
                                m.maquina,
                                hrsProductivas.toFixed(2),
                                hrsTurnoMaq.toFixed(2),
                                `${disponibilidad.toFixed(1)}%`
                            ];
                        });

                    if (dispData.length > 0) {
                        // Total row
                        dispData.push([
                            'TOTALES',
                            totalProd.toFixed(2),
                            '-',
                            '-'
                        ]);

                        if (chartY + 60 > doc.internal.pageSize.getHeight() - 20) {
                            doc.addPage();
                            chartY = 30;
                        }

                        doc.setFontSize(14);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text('ANÁLISIS DE DISPONIBILIDAD POR TIEMPO', pageWidth / 2, chartY, { align: 'center' });
                        doc.setTextColor(0, 0, 0);

                        autoTable(doc, {
                            head: [dispColumns],
                            body: dispData,
                            startY: chartY + 5,
                            pageBreak: 'avoid',
                            styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
                            headStyles: { fillColor: [0, 102, 153], textColor: 255, fontStyle: 'bold' },
                            columnStyles: {
                                0: { halign: 'left' }
                            },
                            didParseCell: function (data) {
                                // Total row style
                                if (data.section === 'body' && data.row.index === dispData.length - 1) {
                                    data.cell.styles.fontStyle = 'bold';
                                    data.cell.styles.fillColor = [220, 220, 220];
                                    data.cell.styles.textColor = [0, 0, 0];
                                }
                                // Color conditional for Disponibilidad column (index 3)
                                if (data.section === 'body' && data.column.index === 3 && data.row.index < dispData.length - 1) {
                                    const val = parseFloat(data.cell.raw);
                                    if (val >= 90) data.cell.styles.textColor = [0, 128, 0];
                                    else if (val >= 75) data.cell.styles.textColor = [200, 150, 0];
                                    else data.cell.styles.textColor = [200, 0, 0];
                                    data.cell.styles.fontStyle = 'bold';
                                }
                            }
                        });

                        chartY = doc.lastAutoTable.finalY + 20;
                    }
                }

                // *** ANÁLISIS DE DISPONIBILIDAD POR TIROS ***
                if ((resumen?.resumenMaquinas || []).length > 0) {
                    // Reusar horasTurnoMes calculado arriba (si no existe, recalcular con festivos)
                    const calcHorasTurno = (mesVal, anioVal) => {
                        const diasEnMes = new Date(anioVal, mesVal, 0).getDate();
                        const festivosLocal = obtenerFestivosColombia(anioVal);
                        let ht = 0;
                        for (let dia = 1; dia <= diasEnMes; dia++) {
                            const fecha = new Date(anioVal, mesVal - 1, dia);
                            const dow = fecha.getDay();
                            if (dow === 0) continue; // Domingo
                            if (esFestivo(fecha, festivosLocal)) continue; // Festivo
                            if (dow >= 1 && dow <= 5) ht += 8;
                            else if (dow === 6) ht += 4;
                        }
                        return ht;
                    };
                    const htMes = typeof horasTurnoMes !== 'undefined' ? horasTurnoMes : calcHorasTurno(mes, anio);

                    const tirosColumns = ['Máquina', 'Meta Diaria', 'Meta Mes', 'Tiros Reales', 'Disponibilidad (%)'];

                    const tirosData = (resumen?.resumenMaquinas || [])
                        .filter(m => (m.metaDiariaBase || 0) > 0)
                        .sort(naturalSort)
                        .map(m => {
                            const metaDiaria = m.metaDiariaBase || 0;
                            const metaPorHora = metaDiaria / 8;
                            const htMaq = Number(m.horasTurnoMes) > 0 ? Number(m.horasTurnoMes) : htMes;
                            const metaMes = metaPorHora * htMaq;
                            const tirosReales = m.tirosTotales || 0;
                            const disponibilidad = metaMes > 0
                                ? (tirosReales / metaMes) * 100
                                : 0;

                            return [
                                m.maquina,
                                Math.round(metaDiaria).toLocaleString(),
                                Math.round(metaMes).toLocaleString(),
                                tirosReales.toLocaleString(),
                                `${disponibilidad.toFixed(1)}%`
                            ];
                        });

                    if (tirosData.length > 0) {
                        if (chartY + 60 > doc.internal.pageSize.getHeight() - 20) {
                            doc.addPage();
                            chartY = 30;
                        }

                        doc.setFontSize(14);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text('ANÁLISIS DE DISPONIBILIDAD POR TIROS', pageWidth / 2, chartY, { align: 'center' });
                        doc.setTextColor(0, 0, 0);

                        autoTable(doc, {
                            head: [tirosColumns],
                            body: tirosData,
                            startY: chartY + 5,
                            pageBreak: 'avoid',
                            styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
                            headStyles: { fillColor: [102, 51, 0], textColor: 255, fontStyle: 'bold' },
                            columnStyles: {
                                0: { halign: 'left' }
                            },
                            didParseCell: function (data) {
                                if (data.section === 'body' && data.column.index === 4) {
                                    const val = parseFloat(data.cell.raw);
                                    if (val >= 90) data.cell.styles.textColor = [0, 128, 0];
                                    else if (val >= 75) data.cell.styles.textColor = [200, 150, 0];
                                    else data.cell.styles.textColor = [200, 0, 0];
                                    data.cell.styles.fontStyle = 'bold';
                                }
                            }
                        });

                        chartY = doc.lastAutoTable.finalY + 20;
                    }
                }
                // Chart: Daily Trend (line chart for general report) - KEEPING THIS ONE? User said "solo quita esas 3".
                if ((resumen?.tendenciaDiaria || []).length > 0) {
                    const dailyData = [...(resumen?.tendenciaDiaria || [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                    const dailyLabels = dailyData.map(d => d.fecha.split('T')[0].split('-').slice(1).join('/'));
                    const dailyValues = dailyData.map(d => d.tiros);

                    chartY = drawLineChart(doc, "Tendencia Producción Diaria", dailyLabels, dailyValues, chartY);
                }
            }

            // Para reporte por máquina se elimina la eficiencia global de todas las máquinas
            // y se usa únicamente el desglose detallado completo ya incluido en tablesPayload.

            // =========== TABLA DE CALIFICACIONES POR MÁQUINA ===========
            if (reportType === 'general' && resumen?.resumenMaquinas?.length > 0) {
                // Check if we need a new page
                if (chartY + 60 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    chartY = 30;
                }

                // Title
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 51, 102);
                doc.text('CALIFICACIÓN POR MÁQUINA', pageWidth / 2, chartY, { align: 'center' });
                doc.setTextColor(0, 0, 0);
                chartY += 5;

                // Tabla de calificaciones - ordenada por nombre descendente
                const calColumns = ['Máquina', 'Sem 100%', 'Importancia', 'Puntos'];
                const calData = (resumen?.resumenMaquinas || [])
                    //.filter(m => m.importancia > 0) // REMOVED FILTER to show all machines (even with 0 perf/importance)
                    .sort(naturalSort) // Orden natural (1, 2, 3... 10, 11)
                    .map(m => [
                        m.maquina,
                        `${(m.porcentajeRendimiento100 || 0).toFixed(1)}%`,
                        `${(m.importancia || 0).toFixed(2)}%`, // Mostrar con 2 decimales
                        (m.calificacion || 0).toFixed(2) // 2 decimales para puntos
                    ]);

                // Agregar fila de total
                calData.push([
                    'TOTAL PLANTA',
                    '',
                    '100%',
                    (resumen?.calificacionTotalPlanta || 0).toFixed(2)
                ]);

                autoTable(doc, {
                    head: [calColumns],
                    body: calData,
                    startY: chartY,
                    pageBreak: 'avoid',
                    styles: { fontSize: 10, cellPadding: 3 },
                    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.row.index === calData.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [0, 51, 102];
                            data.cell.styles.textColor = 255;
                        }
                        // Color de Sem 100% según rendimiento
                        if (data.section === 'body' && data.column.index === 1 && data.row.index < calData.length - 1) {
                            const pctText = data.cell.raw?.toString() || '0';
                            const pct = parseFloat(pctText);
                            if (pct >= 100) {
                                data.cell.styles.textColor = [40, 167, 69]; // Verde
                            } else if (pct >= 75) {
                                data.cell.styles.textColor = [255, 193, 7]; // Amarillo
                            } else {
                                data.cell.styles.textColor = [220, 53, 69]; // Rojo
                            }
                        }
                    },
                    margin: { top: 10 }
                });

                chartY = doc.lastAutoTable.finalY + 15;

                // =========== GRÁFICA DE TENDENCIA HISTÓRICA DE CALIFICACIONES ===========
                // Dibujar gráfica de barras con el historial de calificaciones (si hay datos)
                if (historialCalificaciones.length >= 1) {
                    const mesesNombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

                    // Ordenar por fecha (más antiguo primero) y filtrar
                    const historialOrdenado = [...historialCalificaciones]
                        .filter(h => {
                            // Excluir Noviembre (11) y Diciembre (12)
                            if (h.mes === 11 || h.mes === 12) return false;
                            
                            // No dejar que se pongan datos de meses después del mes generado
                            if (h.anio > anio) return false;
                            if (h.anio === anio && h.mes > mes) return false;
                            
                            return true;
                        })
                        .sort((a, b) => {
                            if (a.anio !== b.anio) return a.anio - b.anio;
                            return a.mes - b.mes;
                        });

                    const histLabels = historialOrdenado.map(h => `${mesesNombres[h.mes]} ${h.anio}`);
                    // Valores con 1 decimal (sin redondear a entero)
                    const histValues = historialOrdenado.map(h => parseFloat(h.calificacionTotal.toFixed(1)));
                    // Usar color azul oscuro del tema (consistente con el resto del app)
                    const histColors = historialOrdenado.map(() => '#003366'); // Azul oscuro uniforme

                    // Usar la función drawBarChart existente
                    chartY = drawBarChart(doc, "Tendencia Histórica de Calificación", histLabels, histValues, chartY, { colors: histColors });
                }
            }

            // 4. Specific Charts and Detailed Table for Operator Report (ONLY when specific operator selected)
            if (reportType === 'operario' && selectedOperario !== 'todos') {
                const targetIds = [selectedOperario];

                for (const opId of targetIds) {
                    // Find Operator Name
                    const opName = usuarios.find(u => u.id == opId)?.nombre || 'Operario';

                    // Fetch Detailed History for this operator
                    try {
                        // Calculate date range based on period selection
                        let dStart = 1;
                        let dEnd = new Date(anio, mes, 0).getDate();

                        if (reportPeriod === 'semanal') {
                            if (semana === 1) { dStart = 1; dEnd = 7; }
                            else if (semana === 2) { dStart = 8; dEnd = 14; }
                            else if (semana === 3) { dStart = 15; dEnd = 21; }
                            else if (semana === 4) { dStart = 22; dEnd = new Date(anio, mes, 0).getDate(); }
                        }

                        const fechaInicio = new Date(anio, mes - 1, dStart).toISOString();
                        const fechaFin = new Date(anio, mes - 1, dEnd).toISOString();

                        const histRes = await api.get(`/produccion/historial`, {
                            params: {
                                fechaInicio,
                                fechaFin,
                                usuarioId: opId
                            }
                        });

                        const historyData = histRes.data || [];

                        if (historyData.length > 0) {
                            // Sort by Date
                            const sortedHistory = [...historyData].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

                            // --- DETAILED DAILY TABLE ---
                            const detailCols = ['Fecha', 'Máquina', 'Tiros', 'Horas Prod', 'Promedio/H', 'Valor a Pagar'];
                            const detailRows = sortedHistory.map(item => [
                                item.fecha.split('T')[0].split('-').reverse().join('/'), // DD/MM/YYYY
                                item.maquina?.nombre || 'Desc.',
                                item.tirosDiarios?.toString() || '0',
                                item.totalHorasProductivas?.toFixed(2) || '0',
                                item.promedioHoraProductiva?.toFixed(2) || '0',
                                `$${(item.valorAPagar || 0).toFixed(0)}`
                            ]);

                            // Add page break if needed
                            if (chartY + 50 > doc.internal.pageSize.getHeight() - 20) {
                                doc.addPage();
                                chartY = 20;
                            }

                            doc.setFontSize(14);
                            doc.setFont('helvetica', 'bold');
                            doc.text(`Detalle Diario: ${opName}`, 14, chartY);

                            autoTable(doc, {
                                head: [detailCols],
                                body: detailRows,
                                startY: chartY + 5,
                                styles: { fontSize: 9, cellPadding: 2 },
                                headStyles: { fillColor: [70, 130, 180], textColor: 255, fontStyle: 'bold' },
                                alternateRowStyles: { fillColor: [245, 245, 245] },
                                margin: { top: 10 }
                            });

                            chartY = doc.lastAutoTable.finalY + 15;

                            // --- TRAZABILIDAD RENDIMIENTO (META 100%) ---
                            const dailyPcts = [];
                            const labels = [];

                            for (let day = dStart; day <= dEnd; day++) {
                                const dayData = sortedHistory.filter(d => {
                                    const dDate = d.fecha.split('T')[0];
                                    const dDay = parseInt(dDate.split('-')[2]);
                                    return dDay === day;
                                });

                                // Calcular totales del día
                                // Usamos tirosConEquivalencia si existe (backend computed), sino tirosDiarios
                                const totalTiros = dayData.reduce((sum, d) => sum + (d.tirosConEquivalencia || d.tirosDiarios || 0), 0);

                                // Meta 100% del día (suma de metas de las máquinas usadas en cada registro)
                                // Cada registro cuenta como un turno/jornada, así que sumamos la meta de la máquina asociada
                                const totalMeta100 = dayData.reduce((sum, d) => sum + (d.maquina?.meta100Porciento || 0), 0);

                                if (dayData.length > 0) {
                                    let pct = 0;
                                    if (totalMeta100 > 0) {
                                        pct = (totalTiros / totalMeta100) * 100;
                                    }
                                    // Cap reasonable max for visual clarity chart if needed, but showing real data is better
                                    dailyPcts.push(pct);
                                    labels.push(`${mes.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`);
                                }
                            }

                            if (dailyPcts.length > 0) {
                                // Assign colors based on threshold
                                const barColors = dailyPcts.map(pct => {
                                    if (pct >= 100) return '#28a745'; // Green
                                    if (pct >= 75) return '#ffc107';  // Yellow
                                    return '#dc3545';                 // Red
                                });

                                chartY = drawBarChart(
                                    doc,
                                    `Trazabilidad Rendimiento Mensual (% vs Meta 100%)`,
                                    labels,
                                    dailyPcts.map(p => p.toFixed(1) + '%'), // Format values as percentage string 
                                    chartY,
                                    { colors: barColors }
                                );
                            }

                            // --- GRÁFICAS POR MÁQUINA (DESGLOSE) ---
                            const uniqueMaqIds = [...new Set(sortedHistory.map(d => d.maquinaId))];

                            uniqueMaqIds.forEach(mId => {
                                const maqDataTotal = sortedHistory.filter(d => d.maquinaId === mId);
                                const maqName = maqDataTotal[0]?.maquina?.nombre || 'Máquina Desconocida';

                                const dailyPctsMaq = [];
                                const labelsMaq = [];

                                for (let day = dStart; day <= dEnd; day++) {
                                    const dayRecords = maqDataTotal.filter(d => {
                                        const dDate = d.fecha.split('T')[0];
                                        const dDay = parseInt(dDate.split('-')[2]);
                                        return dDay === day;
                                    });

                                    if (dayRecords.length > 0) {
                                        const totalTiros = dayRecords.reduce((sum, d) => sum + (d.tirosConEquivalencia || d.tirosDiarios || 0), 0);
                                        const totalMeta100 = dayRecords.reduce((sum, d) => sum + (d.maquina?.meta100Porciento || 0), 0);

                                        let pct = 0;
                                        if (totalMeta100 > 0) {
                                            pct = (totalTiros / totalMeta100) * 100;
                                        }

                                        dailyPctsMaq.push(pct);
                                        labelsMaq.push(`${mes.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`);
                                    }
                                }

                                if (dailyPctsMaq.length > 0) {
                                    if (chartY + 100 > doc.internal.pageSize.getHeight() - 20) {
                                        doc.addPage();
                                        chartY = 20;
                                    } else {
                                        chartY += 10;
                                    }

                                    const barColorsMaq = dailyPctsMaq.map(pct => {
                                        if (pct >= 100) return '#28a745';
                                        if (pct >= 75) return '#ffc107';
                                        return '#dc3545';
                                    });

                                    chartY = drawBarChart(
                                        doc,
                                        `Rendimiento: ${maqName} (% vs Meta 100%)`,
                                        labelsMaq,
                                        dailyPctsMaq.map(p => p.toFixed(1) + '%'),
                                        chartY,
                                        { colors: barColorsMaq }
                                    );
                                }
                            });
                        }

                    } catch (err) {
                        console.error("Error fetching history for report", err);
                    }
                }
            }

            // Timestamp Logic (Fixed)
            let footerY = chartY + 10;
            if (footerY > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                footerY = 20;
            }
            doc.setFontSize(10);
            doc.text(`Generado: ${new Date().toLocaleString()}`, 14, footerY);

            // Generate filename based on report type
            let fileName;
            if (reportType === 'general') {
                fileName = `Reporte_General_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'operario') {
                const opName = usuarios.find(u => u.id == selectedOperario)?.nombre || 'Operario';
                const cleanName = opName.replace(/\s+/g, '_');
                fileName = `${cleanName}_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'maquina') {
                const maqName = maquinas.find(m => m.id == selectedMaquina)?.nombre || 'Maquina';
                const cleanName = maqName.replace(/\s+/g, '_');
                fileName = `Reporte_Maquina_${cleanName}_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'alistamiento') {
                fileName = `Reporte_Alistamiento_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'tiemposMuertos') {
                fileName = `Reporte_Tiempos_Muertos_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'cierreMensual') {
                fileName = `Cierre_Mensual_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'oee') {
                fileName = `Reporte_OEE_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'historialRendimiento') {
                fileName = `Historial_Rendimiento_${getMesNombre(mes)}_${anio}.pdf`;
            } else if (reportType === 'op') {
                const cleanOP = (selectedOPReport || 'OP').replace(/\s+/g, '_');
                fileName = `Reporte_Integral_OP_${cleanOP}_${getMesNombre(mes)}_${anio}.pdf`;
            } else {
                fileName = `Reporte_${getMesNombre(mes)}_${anio}.pdf`;
            }

            // Platform-specific save logic
            if (Platform.OS === 'web') {
                doc.save(fileName);
            } else {
                // Mobile: Use expo-file-system and expo-sharing
                try {
                    const pdfBase64 = doc.output('datauristring').split(',')[1];
                    const fileUri = FileSystem.documentDirectory + fileName;

                    console.log('Saving PDF to:', fileUri);
                    await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
                        encoding: 'base64',
                    });

                    // Verify file was written
                    const fileInfo = await FileSystem.getInfoAsync(fileUri);
                    console.log('File info:', fileInfo);

                    if (!fileInfo.exists) {
                        throw new Error('El archivo no se pudo guardar');
                    }

                    // Try to open PDF directly on Android using Intent
                    if (Platform.OS === 'android') {
                        try {
                            // Get content URI for the file
                            const contentUri = await FileSystem.getContentUriAsync(fileUri);
                            console.log('Content URI:', contentUri);

                            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                                data: contentUri,
                                flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                                type: 'application/pdf',
                            });
                        } catch (intentError) {
                            console.log('Intent failed, trying sharing:', intentError);
                            // Fallback to sharing if intent fails
                            const sharingAvailable = await Sharing.isAvailableAsync();
                            if (sharingAvailable) {
                                await Sharing.shareAsync(fileUri, {
                                    mimeType: 'application/pdf',
                                    dialogTitle: 'Abrir o Compartir PDF',
                                });
                            } else {
                                Alert.alert('Éxito', `PDF generado correctamente.\n\nGuardado en: ${fileUri}`);
                            }
                        }
                    } else {
                        // iOS - use sharing
                        const sharingAvailable = await Sharing.isAvailableAsync();
                        if (sharingAvailable) {
                            await Sharing.shareAsync(fileUri, {
                                mimeType: 'application/pdf',
                                dialogTitle: 'Abrir o Compartir PDF',
                                UTI: 'com.adobe.pdf',
                            });
                        } else {
                            Alert.alert('Éxito', `PDF generado correctamente.\n\nGuardado en: ${fileUri}`);
                        }
                    }
                } catch (saveError) {
                    console.error('Error saving/sharing PDF:', saveError);
                    Alert.alert('Error', 'No se pudo guardar o compartir el PDF: ' + saveError.message);
                }
            }

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar PDF: ' + error.message);
        } finally {
            setGeneratingPdf(false);
        }
    };



    // Helpers for periods
    const getUniquePeriods = () => [...new Set(periodosDisponibles.map(p => p.anio))].sort((a, b) => b - a);
    const getMesesParaAnio = (anioSeleccionado) => periodosDisponibles.filter(p => p.anio === anioSeleccionado).sort((a, b) => b.mes - a.mes);

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Logo */}
            <View style={[styles.headerContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                    <ThemeToggle />
                </View>
                <Text style={[styles.header, { color: colors.text }]}>Tablero Semáforos</Text>
            </View>

            {/* Combined Control Bar */}
            <View style={[styles.controlRow, { backgroundColor: colors.card, padding: 10, borderRadius: 8, justifyContent: 'space-between', alignItems: 'flex-start' }]}>

                {/* Left: Date Controls */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                    {periodosDisponibles.length > 0 ? (
                        <>
                            <View>
                                <Text style={[styles.label, { color: colors.text, fontSize: 10, marginBottom: 2 }]}>Año</Text>
                                <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 90, height: 40 }]}>
                                    <Picker
                                        selectedValue={anio}
                                        onValueChange={(v) => setAnio(parseInt(v))}
                                        style={[styles.picker, { color: colors.text, height: 40 }]}
                                    >
                                        {getUniquePeriods().map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                                    </Picker>
                                </View>
                            </View>

                            <View>
                                <Text style={[styles.label, { color: colors.text, fontSize: 10, marginBottom: 2 }]}>Mes</Text>
                                <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 120, height: 40 }]}>
                                    <Picker
                                        selectedValue={mes}
                                        onValueChange={(v) => setMes(parseInt(v))}
                                        style={[styles.picker, { color: colors.text, height: 40 }]}
                                    >
                                        {(getMesesParaAnio(anio).length > 0 ? getMesesParaAnio(anio) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ mes: m }))).map(p => (
                                            <Picker.Item key={p.mes} label={getMesNombre(p.mes)} value={p.mes} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        </>
                    ) : (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={[styles.pickerContainer, { width: 90 }]}><Picker selectedValue={anio} onValueChange={v => setAnio(v)}><Picker.Item label="2026" value={2026} /></Picker></View>
                            <View style={[styles.pickerContainer, { width: 120 }]}><Picker selectedValue={mes} onValueChange={v => setMes(v)}><Picker.Item label="Enero" value={1} /></Picker></View>
                        </View>
                    )}

                    <TouchableOpacity style={[styles.btnReload, { height: 40, justifyContent: 'center', marginTop: 15 }]} onPress={() => { cargarResumen(); cargarPeriodosDisponibles(); cargarOperariosConDatos(); }}>
                        <Text style={{ color: 'white' }}>🔄</Text>
                    </TouchableOpacity>
                </View>

                {/* Right: View Filters */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>

                    <View>
                        <Text style={[styles.label, { color: colors.text, fontSize: 10, marginBottom: 2 }]}>Filtro Máquina</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 140, height: 40 }]}>
                            <Picker
                                selectedValue={viewFilterMaquina}
                                onValueChange={(v) => setViewFilterMaquina(v)}
                                style={[styles.picker, { color: colors.text, height: 40 }]}
                            >
                                <Picker.Item label="Todas" value="" />
                                {viewAvailableMaquinas.map(m => (
                                    <Picker.Item key={m.id} label={m.nombre} value={m.id} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View>
                        <Text style={[styles.label, { color: colors.text, fontSize: 10, marginBottom: 2 }]}>Filtro Operario</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 140, height: 40 }]}>
                            <Picker
                                selectedValue={viewFilterOperario}
                                onValueChange={(v) => setViewFilterOperario(v)}
                                style={[styles.picker, { color: colors.text, height: 40 }]}
                            >
                                <Picker.Item label="Todos" value="" />
                                {viewAvailableOperarios.map(u => (
                                    <Picker.Item key={u.id} label={u.nombre} value={u.id} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    {(viewFilterMaquina || viewFilterOperario) && (
                        <TouchableOpacity
                            style={[styles.btnReload, { backgroundColor: '#e74c3c', height: 40, justifyContent: 'center', marginTop: 15 }]}
                            onPress={() => { setViewFilterMaquina(''); setViewFilterOperario(''); }}
                        >
                            <Text style={{ color: 'white' }}>🧹</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Reports Section */}
            <View style={[styles.reportSection, { backgroundColor: colors.card, shadowColor: '#ccc' }]}>
                <Text style={[styles.sectionHeader, { color: colors.text }]}>📊 Generar Reportes PDF</Text>

                <View style={styles.reportControls}>
                    <View style={styles.controlGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Tipo de Reporte:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 200 }]}>
                            <Picker
                                selectedValue={reportType}
                                onValueChange={(itemValue) => setReportType(itemValue)}
                                style={[styles.picker, { color: colors.text }]}
                            >
                                <Picker.Item label="General (Todos)" value="general" />
                                <Picker.Item label="Por Operario" value="operario" />
                                <Picker.Item label="Por Maquina" value="maquina" />
                                <Picker.Item label="Integral por OP" value="op" />
                                <Picker.Item label="Tiempos de Alistamiento" value="alistamiento" />
                                <Picker.Item label="Tiempos Muertos" value="tiemposMuertos" />
                                <Picker.Item label="Gastos por Bonificación" value="bonificacion" />
                                <Picker.Item label="Cierre Mensual" value="cierreMensual" />
                                <Picker.Item label="Historial rendimiento" value="historialRendimiento" />
                                <Picker.Item label="OEE" value="oee" />
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.controlGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Periodo:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 200 }]}>
                            <Picker
                                selectedValue={reportPeriod}
                                onValueChange={(itemValue) => setReportPeriod(itemValue)}
                                style={[styles.picker, { color: colors.text }]}
                            >
                                <Picker.Item label="Mensual" value="mensual" />
                                <Picker.Item label="Semanal" value="semanal" />
                            </Picker>
                        </View>
                    </View>

                    {reportPeriod === 'semanal' && (
                        <View style={styles.controlGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>Semana:</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 200 }]}>
                                <Picker
                                    selectedValue={semana}
                                    onValueChange={(itemValue) => setSemana(parseInt(itemValue))}
                                    style={[styles.picker, { color: colors.text }]}
                                >
                                    <Picker.Item label="Semana 1 (1-7)" value={1} />
                                    <Picker.Item label="Semana 2 (8-14)" value={2} />
                                    <Picker.Item label="Semana 3 (15-21)" value={3} />
                                    <Picker.Item label="Semana 4 (22-31)" value={4} />
                                </Picker>
                            </View>
                        </View>
                    )}

                    {reportType === 'operario' && (
                        <View style={styles.controlGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>Operario:</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 200 }]}>
                                <Picker
                                    selectedValue={selectedOperario}
                                    onValueChange={(itemValue) => setSelectedOperario(itemValue)}
                                    style={[styles.picker, { color: colors.text }]}
                                >
                                    <Picker.Item label="-- Seleccione Operario --" value="" />
                                    {filteredUsuarios.length > 0 ? (
                                        filteredUsuarios.map(u => (
                                            <Picker.Item key={u.id} label={u.nombre} value={u.id} />
                                        ))
                                    ) : (
                                        <Picker.Item label="No hay operarios con datos" value="" enabled={false} />
                                    )}
                                </Picker>
                            </View>
                        </View>
                    )}

                    {(reportType === 'maquina' || reportType === 'alistamiento' || reportType === 'tiemposMuertos') && (
                        <View style={styles.controlGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>Maquina:</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 200 }]}>
                                <Picker
                                    selectedValue={selectedMaquina}
                                    onValueChange={(itemValue) => setSelectedMaquina(itemValue)}
                                    style={[styles.picker, { color: colors.text }]}
                                >
                                    <Picker.Item label="-- Seleccione Maquina --" value="" />
                                    {reportUsesAllMachinesOption && (
                                        <Picker.Item label="Todas las máquinas (tabla general)" value="todos" />
                                    )}
                                    {filteredMaquinas.length > 0 ? (
                                        filteredMaquinas.map(m => (
                                            <Picker.Item key={m.id} label={m.nombre} value={m.id} />
                                        ))
                                    ) : (
                                        <Picker.Item label="No hay máquinas con datos" value="" enabled={false} />
                                    )}
                                </Picker>
                            </View>
                        </View>
                    )}

                    {reportType === 'op' && (
                        <View style={styles.controlGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>OP:</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 240 }]}>
                                <Picker
                                    selectedValue={selectedOPReport}
                                    onValueChange={(itemValue) => setSelectedOPReport(itemValue)}
                                    style={[styles.picker, { color: colors.text }]}
                                >
                                    <Picker.Item label="-- Seleccione OP --" value="" />
                                    {opsDisponibles.length > 0 ? (
                                        opsDisponibles.map(op => (
                                            <Picker.Item key={op} label={op} value={op} />
                                        ))
                                    ) : (
                                        <Picker.Item label="No hay OPs disponibles" value="" enabled={false} />
                                    )}
                                </Picker>
                            </View>
                            <TextInput
                                value={selectedOPReport}
                                onChangeText={(txt) => setSelectedOPReport(txt)}
                                placeholder="O escribe la OP manualmente"
                                placeholderTextColor={colors.textSecondary}
                                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 240 }]}
                            />
                        </View>
                    )}

                    <TouchableOpacity onPress={cargarResumen} style={styles.btnReload}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>🔄</Text>
                    </TouchableOpacity>
                </View>

                {/* Legend / Info */}
                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                    <TouchableOpacity
                        style={[styles.btnGenerate, generatingPdf && styles.btnDisabled]}
                        onPress={generatePDF}
                        disabled={generatingPdf}>
                        {generatingPdf ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.btnGenerateText}>📄 Exportar PDF</Text>
                        )}
                    </TouchableOpacity>


                </View>
            </View >

            {/* Dashboard Data */}
            {
                loading ? <ActivityIndicator size="large" style={{ marginTop: 20 }} /> : (
                    <View>
                        <Text style={[styles.sectionHeader, { color: colors.text }]}>👷 Por Operario</Text>
                        {displayedOperarios.length === 0 ? (
                            <Text style={[styles.noData, { color: colors.subText }]}>No hay datos para el periodo seleccionado</Text>
                        ) : (
                            displayedOperarios.map((item, index) => (
                                <View key={index} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.operario} — {item.maquina}</Text>
                                    <Text style={{ color: colors.text }}>Meta 100%: {item.meta100Porciento?.toFixed(0) || '0'}</Text>
                                    <Text style={{ color: colors.text }}>Tiros Reportados: {item.tirosReportados?.toLocaleString() || '0'}</Text>
                                    <Text style={{ color: colors.text }}>Tiros Equivalentes: {item.tirosEquivalentes?.toLocaleString() || '0'}</Text>
                                    <Text style={{ color: colors.text }}>Cambios Totales: {item.totalCambios || '0'}</Text>
                                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>Tiros Totales: {item.totalTiros?.toLocaleString() || '0'}</Text>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingRight: 10 }}>
                                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: 'bold' }}>📅 Último: {item.ultimaFecha}</Text>
                                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: 'bold' }}>#️⃣ Días: {item.diasLaborados}</Text>
                                    </View>
                                    <Text style={{ color: colors.text }}>Horas Prod: {item.totalHorasProductivas?.toFixed(2)}</Text>
                                    <Text style={{ color: colors.text }}>
                                        Horas efectivas (meta):{' '}
                                        {(() => {
                                            const hef =
                                                item.totalHorasEfectivasMeta ?? item.TotalHorasEfectivasMeta;
                                            return hef != null && hef !== '' && !Number.isNaN(Number(hef))
                                                ? Number(hef).toFixed(2)
                                                : '—';
                                        })()}
                                    </Text>
                                    <Text style={{ color: colors.text }}>Promedio/H: {item.promedioHoraProductiva?.toFixed(2)}</Text>
                                    {/* <Text style={{ color: colors.text }}>💰 Bonificación: ${item.valorAPagarBonificable?.toFixed(0) || '0'}</Text> */}

                                    {/* Semáforos con porcentajes */}
                                    <View style={{ flexDirection: 'row', marginTop: 10, gap: 15 }}>


                                        {/* Semáforo 100% */}
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{ fontSize: 10, color: colors.subText, marginBottom: 3 }}>Meta 100%</Text>
                                            <View style={{
                                                width: 60, height: 40, borderRadius: 8,
                                                backgroundColor: getColor((item.porcentajeRendimiento100 || 0) >= 100 ? 'Verde' : (item.porcentajeRendimiento100 || 0) >= 75 ? 'Amarillo' : 'Rojo'),
                                                justifyContent: 'center', alignItems: 'center',
                                                borderWidth: 2, borderColor: '#333'
                                            }}>
                                                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                                                    {Math.round(item.porcentajeRendimiento100 || 0)}%
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}

                        <Text style={[styles.sectionHeader, { color: colors.text }]}>🏭 Por Maquina</Text>
                        {displayedMaquinas.length === 0 ? (
                            <Text style={[styles.noData, { color: colors.subText }]}>No hay datos para el periodo seleccionado</Text>
                        ) : (
                            displayedMaquinas.map((item, index) => {
                                const horasEfectivasMeta = horasEfectivasMetaDesdeResumenMaq(item);
                                const totalBase = Math.max(horasEfectivasMeta, 1);

                                const hrsProductivas = item.totalHorasProductivas || 0;
                                const hrsAuxiliares = item.totalTiempoPuestaPunto || item.totalHorasAuxiliares || 0; // Use totalTiempoPuestaPunto as it is used in the PDF report, fallback to totalHorasAuxiliares
                                const hrsMuertas = item.totalTiemposMuertos || 0;

                                const ocupacionBruta = ((hrsProductivas + hrsAuxiliares) / totalBase) * 100;
                                const efiSetup = hrsProductivas > 0 || hrsAuxiliares > 0
                                    ? (hrsProductivas / (hrsProductivas + hrsAuxiliares)) * 100
                                    : 0;

                                return (
                                    <View key={index} style={[styles.card, { backgroundColor: getColor(item.semaforoColor), borderColor: 'black', borderWidth: 2 }]}>
                                        <Text style={[styles.cardTitle, { color: '#000' }]}>{item.maquina}</Text>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                            <Text style={{ color: '#000', fontSize: 11, fontWeight: 'bold' }}>📅 {item.ultimaFecha}</Text>
                                            <Text style={{ color: '#000', fontSize: 11, fontWeight: 'bold' }}>#️⃣ {item.diasLaborados} días</Text>
                                        </View>
                                        <Text style={{ color: '#000' }}>Tiros Reportados: {item.tirosReportados?.toLocaleString() || '0'}</Text>
                                        <Text style={{ color: '#000' }}>Tiros Equivalentes: {item.tirosEquivalentes?.toLocaleString() || '0'}</Text>
                                        <Text style={{ color: '#000' }}>Cambios Totales: {item.totalCambios || '0'}</Text>
                                        <Text style={{ color: '#000', fontWeight: 'bold' }}>Tiros Totales: {item.tirosTotales?.toLocaleString() || '0'}</Text>
                                        <Text style={{ color: '#000' }}>Rendimiento Esp: {item.meta100Porciento?.toFixed(0)}</Text>
                                        <Text style={{ color: '#000', fontWeight: 'bold' }}>Eficiencia: {(item.porcentajeRendimiento100)?.toFixed(1)}%</Text>

                                        {/* NUEVO: Suma de todos los tiempos */}
                                        <View style={{ marginTop: 5, paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#ccc' }}>
                                            <Text style={{ color: '#000', fontWeight: 'bold' }}>Análisis de Tiempos:</Text>
                                            <Text style={{ color: '#000' }}>• Hrs Productivas: {hrsProductivas.toFixed(2)}</Text>
                                            <Text style={{ color: '#000' }}>• Hrs Auxiliar: {hrsAuxiliares.toFixed(2)}</Text>
                                            <Text style={{ color: '#000' }}>• Hrs Muertas: {hrsMuertas.toFixed(2)}</Text>
                                            <Text style={{ color: '#000', fontWeight: 'bold' }}>
                                                • Horas efectivas (meta / T.H. neto): {horasEfectivasMeta.toFixed(2)}
                                            </Text>
                                        </View>

                                        <Text style={{ color: '#000', marginTop: 5 }}>Disponibilidad (Ocupación): <Text style={{ fontWeight: 'bold' }}>{ocupacionBruta.toFixed(1)}%</Text></Text>
                                        <Text style={{ color: '#000' }}>Eficiencia Setup (Tasa Uso): <Text style={{ fontWeight: 'bold' }}>{efiSetup.toFixed(1)}%</Text></Text>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )
            }

            <View style={{ height: 50 }} />
        </ScrollView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10, backgroundColor: '#f5f5f5' },
    headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    logo: { width: 60, height: 60, marginRight: 15 },
    header: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    sectionHeader: { fontSize: 20, marginTop: 15, marginBottom: 10, fontWeight: 'bold', color: '#444' },
    card: { padding: 12, marginBottom: 10, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
    controlRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 },
    selectLarge: { padding: 8, borderRadius: 4, minWidth: 200, marginLeft: 10 },
    btnReload: { backgroundColor: '#3498db', padding: 10, borderRadius: 5, marginLeft: 10 },
    reportSection: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    reportControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 15 },
    controlGroup: { minWidth: 150 },
    label: { fontWeight: 'bold', marginBottom: 5, color: '#555' },
    btnGenerate: { backgroundColor: '#27ae60', padding: 15, borderRadius: 8, alignItems: 'center' },
    btnGenerateText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    btnDisabled: { backgroundColor: '#95a5a6' },
    noData: { color: '#999', fontStyle: 'italic', textAlign: 'center', padding: 20 },
    select: { padding: 5, borderRadius: 4, minWidth: 80, marginLeft: 5 },

    // Nav Bar Styles (from HistoryScreen for consistency)
    navBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 10,
        marginBottom: 15,
        backgroundColor: '#f5f5f5',
        borderBottomWidth: 1,
        borderColor: '#ddd'
    },
    navButton: {
        padding: 8,
        backgroundColor: 'white',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ccc'
    },
    navActive: {
        backgroundColor: '#e8f0fe',
        borderColor: '#2196f3'
    },
    navText: {
        color: '#333'
    },
    navTextActive: {
        fontWeight: 'bold',
        color: '#1565c0'
    },
    pickerContainer: {
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        backgroundColor: 'white',
        height: 50,
        justifyContent: 'center'
    },
    picker: {
        width: '100%',
        height: 50
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        height: 44,
        paddingHorizontal: 10,
        marginTop: 8
    }
});
