import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, Platform, Alert } from 'react-native';
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

// Register Chart.js components
Chart.register(...registerables, ChartDataLabels);

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
    const [semana, setSemana] = useState(1);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const logoSource = colors.alephLogo;

    // Data Lists
    const [usuarios, setUsuarios] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
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
            const [m, u] = await Promise.all([
                api.get('/maquinas'),
                api.get('/usuarios')
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
        if (reportType === 'maquina' && !selectedMaquina) {
            alert('Por favor selecciona una máquina.');
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

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

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
            doc.text('REPORTE DE PRODUCCION', pageWidth / 2, 20, { align: 'center' });

            // Subtitle
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const periodText = reportPeriod === 'mensual'
                ? `${getMesNombre(mes)} ${anio}`
                : `Semana ${semana} de ${getMesNombre(mes)} ${anio}`;
            doc.text(`Periodo: ${periodText}`, pageWidth / 2, 30, { align: 'center' });

            // Calificación Real de la Planta (Sem100% × Importancia por cada máquina)
            let historialCalificaciones = [];
            if (resumen?.calificacionTotalPlanta !== undefined && reportType !== 'operario') {
                const calificacion = resumen.calificacionTotalPlanta;

                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                // Color based on score (>= 75 verde, else rojo)
                const color = calificacion >= 75 ? [40, 167, 69] : calificacion >= 50 ? [255, 193, 7] : [220, 53, 69];
                doc.setTextColor(...color);
                doc.text(`CALIFICACIÓN PLANTA: ${calificacion.toFixed(1)} pts`, pageWidth / 2, 42, { align: 'center' });
                doc.setTextColor(0, 0, 0); // Reset

                // Guardar calificación automáticamente para el mes actual
                try {
                    await api.post(`/calificacion/calcular-y-guardar?mes=${mes}&anio=${anio}`);
                    console.log('Calificación guardada exitosamente');
                } catch (saveErr) {
                    console.log('Error guardando calificación (puede que la tabla no exista aún):', saveErr);
                }

                // Obtener historial de calificaciones para la gráfica comparativa
                try {
                    const histRes = await api.get('/calificacion/historial?limite=6');
                    historialCalificaciones = histRes.data || [];
                } catch (histErr) {
                    console.log('Error obteniendo historial de calificaciones:', histErr);
                }
                // Nota: La gráfica de tendencia histórica se dibuja al final, después de la tabla de calificaciones
            }

            // Prepare Table Data Batches
            let tablesPayload = []; // { title, columns, data, headStyles? }

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
                    const maqData = [...resumen.resumenMaquinas]
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
                const targetIds = selectedOperario === 'todos'
                    ? [...new Set((resumen?.resumenOperarios || []).map(i => i.usuarioId))]
                    : [selectedOperario];

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

                    // *** NEW: Machine Breakdown Tables for Operator ***
                    // Filter valid machines for this operator
                    const operatorMachineData = (resumen?.resumenOperarios || []).filter(item => item.usuarioId == opId);

                    // Helper function to fetch and add breakdown table (async inside map is tricky, we'll do sequential processing later or promises here)
                    // Since we need to modify 'tablesPayload' or add to a 'breakdownPayloads' list?
                    // PDF generation is linear. We can add a "special" payload type or just fetch data here and store it.

                    // Strategy: Fetch data here, loop over machines, call debug-meta, and push breakdown tables immediately after the summary table.

                    // We need to pause and fetch. This requires the generatePDF function to be async (it is).
                    for (const machineItem of operatorMachineData) {
                        try {
                            const debugRes = await api.get(`/produccion/debug-meta?nombreMaquina=${encodeURIComponent(machineItem.maquina)}&mes=${mes}&anio=${anio}&usuarioId=${opId}`);
                            const breakdownData = debugRes.data.desglose || [];

                            if (breakdownData.length > 0) {
                                const colsBreakdown = ['Fecha', 'Meta Calculada', 'Formula', 'Tiros Reg.', 'Tiros Eq (Cambios)', 'Total Tiros', 'Total Cambios'];
                                const dataBreakdown = breakdownData.map(item => [
                                    item.fecha,
                                    Math.round(item.meta).toLocaleString(),
                                    item.formula,
                                    (item.tirosDiarios || 0).toLocaleString(),
                                    item.tirosCambios.toLocaleString(),
                                    ((item.tirosDiarios || 0) + item.tirosCambios).toLocaleString(),
                                    item.cambios.toString()
                                ]);

                                // Calculate Totals
                                const totalMeta = breakdownData.reduce((acc, curr) => acc + (curr.meta || 0), 0);
                                const totalTirosReg = breakdownData.reduce((acc, curr) => acc + (curr.tirosDiarios || 0), 0);
                                const totalTirosEq = breakdownData.reduce((acc, curr) => acc + (curr.tirosCambios || 0), 0);
                                const totalCambios = breakdownData.reduce((acc, curr) => acc + (curr.cambios || 0), 0);
                                const totalTirosGrand = totalTirosReg + totalTirosEq;

                                const footerRow = [
                                    'TOTALES',
                                    Math.round(totalMeta).toLocaleString(),
                                    '',
                                    totalTirosReg.toLocaleString(),
                                    totalTirosEq.toLocaleString(),
                                    totalTirosGrand.toLocaleString(),
                                    totalCambios.toString()
                                ];

                                // Append totals
                                dataBreakdown.push(footerRow);

                                tablesPayload.push({
                                    title: `Detalle ${machineItem.maquina} - ${operarioNombre}`,
                                    columns: colsBreakdown,
                                    data: dataBreakdown,
                                    headStyles: { fillColor: [70, 130, 180], textColor: 255 },
                                    isBreakdown: true // Flag to identify distinct styling if needed (e.g. bold last row)
                                });
                            }
                        } catch (err) {
                            console.error(`Error fetching breakdown for ${machineItem.maquina}`, err);
                        }
                    }
                }

            } else if (reportType === 'maquina') {
                const targetIds = selectedMaquina === 'todos'
                    ? [...new Set((resumen?.resumenMaquinas || []).map(i => i.maquinaId))]
                    : [selectedMaquina];

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

                sortedMaqIds.forEach(({ id: maqId }) => {
                    const maquinaData = (resumen?.resumenMaquinas || []).filter(item => item.maquinaId == maqId);
                    if (maquinaData.length === 0) return;

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
                });
            } else if (reportType === 'bonificacion') {
                const columns = ['Operario', 'Maquina', 'Rendimiento %', 'Bonif. Potencial', 'Bonif. Real'];
                const allOps = (resumen?.resumenOperarios || []);

                if (allOps.length === 0) {
                    alert('No hay datos disponibles en este periodo.');
                    setGeneratingPdf(false);
                    return;
                }

                const data = allOps.map(item => {
                    const vrPagar = item.valorAPagar || 0;
                    const cumpleMeta = (item.porcentajeRendimiento100 || 0) >= 75;
                    return [
                        item.operario,
                        item.maquina,
                        `${(item.porcentajeRendimiento100 || 0).toFixed(0)}%`,
                        `$${vrPagar.toLocaleString()}`,
                        `$${(cumpleMeta ? vrPagar : 0).toLocaleString()}`
                    ];
                });

                // Total sum
                const totalBonosPotencial = allOps.reduce((sum, item) => sum + (item.valorAPagar || 0), 0);
                const totalBonosReal = allOps.reduce((sum, item) => {
                    const cumple = (item.porcentajeRendimiento100 || 0) >= 75;
                    return sum + (cumple ? (item.valorAPagar || 0) : 0);
                }, 0);

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

            // Render Tables
            tablesPayload.forEach((tbl, idx) => {
                // If not first table, advance Y position
                if (idx > 0) lastY = doc.lastAutoTable.finalY + 15;

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
                    styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5, lineColor: [255, 255, 255] },
                    headStyles: tbl.headStyles || { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                    didParseCell: (data) => {
                        // 1. Semaphore Logic
                        if (data.section === 'body') {
                            const header = tbl.columns[data.column.index];
                            if (header && (header.includes('Semaforo') || header.includes('Sem '))) {
                                setSemaforoColor(data);
                            }
                        }

                        // 2. Breakdown Totals Logic
                        if (tbl.isBreakdown && data.section === 'body' && data.row.index === tbl.data.length - 1) {
                            data.cell.styles.fillColor = [220, 220, 220];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    },
                    margin: { top: 20 }
                });
            });

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

                    const hmData = resumen.resumenMaquinas
                        .filter(m => (m.totalTiemposMuertos || 0) > 0) // Hide if 0 hours
                        .sort((a, b) => (b.totalTiemposMuertos || 0) - (a.totalTiemposMuertos || 0)) // Mayor a menor
                        .map(m => {
                            const tm = m.totalTiemposMuertos || 0;
                            const tFalta = m.totalTiempoFaltaTrabajo || 0;
                            const tRep = m.totalTiempoReparacion || 0;
                            const tOtros = m.totalTiempoOtro || 0;

                            // Use totalHoras (sum of all reported hours for this machine) as denominator
                            // ADAPTATION: Exclude Rest Hours from calculation basis
                            const totalHorasReportadas = m.totalHoras || 0;
                            const totalDescanso = m.totalHorasDescanso || 0;
                            const totalBase = Math.max(totalHorasReportadas - totalDescanso, 1);

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
                        styles: { fontSize: 9, cellPadding: 3, halign: 'center' }, // Slightly smaller font to fit cols
                        headStyles: { fillColor: [178, 34, 34], textColor: 255, fontStyle: 'bold' }, // Firebrick red for alerts/costs
                        columnStyles: {
                            0: { halign: 'left' },
                            7: { fontStyle: 'bold' }
                        },
                        didParseCell: (data) => {
                            // Style Total Row
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
                    const papMachines = resumen.resumenMaquinas
                        .filter(m => (m.totalTiempoPuestaPunto || 0) > 0 || (m.totalCambios || 0) > 0)
                        .sort((a, b) => (b.totalTiempoPuestaPunto || 0) - (a.totalTiempoPuestaPunto || 0));

                    const papData = papMachines.map(m => {
                        const horas = m.totalTiempoPuestaPunto || 0;
                        const cambios = m.totalCambios || 0;
                        const totalHorasReportadas = m.totalHoras || 0;
                        const totalDescanso = m.totalHorasDescanso || 0;
                        const totalBase = Math.max(totalHorasReportadas - totalDescanso, 1);

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
                        const sumTotalReported = papMachines.reduce((acc, m) => acc + (m.totalHoras || 0), 0);
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
                            styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
                            headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold' }, // Dark Orange
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


                // Chart: Daily Trend (line chart for general report) - KEEPING THIS ONE? User said "solo quita esas 3".
                if ((resumen?.tendenciaDiaria || []).length > 0) {
                    const dailyData = [...resumen.tendenciaDiaria].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                    const dailyLabels = dailyData.map(d => d.fecha.split('T')[0].split('-').slice(1).join('/'));
                    const dailyValues = dailyData.map(d => d.tiros);

                    chartY = drawLineChart(doc, "Tendencia Producción Diaria", dailyLabels, dailyValues, chartY);
                }
            }

            // Chart: Efficiency by Machine (ONLY for machine report now, removed from general)
            if (reportType === 'maquina') {
                if ((resumen?.resumenMaquinas || []).length > 0) {
                    const chartDataEff = [...resumen.resumenMaquinas]
                        .sort((a, b) => b.porcentajeRendimiento - a.porcentajeRendimiento);

                    const effColors = chartDataEff.map(m => m.porcentajeRendimiento >= 0.75 ? '#28a745' : '#dc3545');
                    const effLabels = chartDataEff.map(m => m.maquina.substring(0, 10));
                    const effValues = chartDataEff.map(m => Math.round(m.porcentajeRendimiento * 100));

                    chartY = drawBarChart(doc, "Eficiencia por Máquina (%)", effLabels, effValues, chartY, { colors: effColors });
                }
            }
            // *** NEW: Machine Breakdown Table (Desglose Meta/Equivalencias) ***
            if (reportType === 'maquina') {
                // Check if we need a new page
                if (chartY + 100 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    chartY = 30;
                }

                try {
                    // Get Machine Name for API call
                    let machineName = "";
                    if (selectedMaquina === 'todos' || !selectedMaquina) {
                        // Default to first machine if multiple? OR skip if 'todos'
                        // For now, if exact machine is selected, show it.
                    } else {
                        const mObj = maquinas.find(m => m.id == selectedMaquina);
                        if (mObj) machineName = mObj.nombre;
                    }

                    if (machineName) {
                        // Fetch debug data
                        const debugRes = await api.get(`/produccion/debug-meta?nombreMaquina=${encodeURIComponent(machineName)}&mes=${mes}&anio=${anio}`);
                        const breakdownData = debugRes.data.desglose || [];

                        if (breakdownData.length > 0) {
                            const colsBreakdown = ['Fecha', 'Meta Calculada', 'Formula', 'Tiros Reg.', 'Tiros Eq (Cambios)', 'Total Tiros', 'Total Cambios'];
                            const dataBreakdown = breakdownData.map(item => [
                                item.fecha,
                                Math.round(item.meta).toLocaleString(),
                                item.formula,
                                (item.tirosDiarios || 0).toLocaleString(),
                                item.tirosCambios.toLocaleString(),
                                ((item.tirosDiarios || 0) + item.tirosCambios).toLocaleString(),
                                item.cambios.toString()
                            ]);

                            // Calculate Totals
                            const totalMeta = breakdownData.reduce((acc, curr) => acc + (curr.meta || 0), 0);
                            const totalTirosReg = breakdownData.reduce((acc, curr) => acc + (curr.tirosDiarios || 0), 0);
                            const totalTirosEq = breakdownData.reduce((acc, curr) => acc + (curr.tirosCambios || 0), 0);
                            const totalCambios = breakdownData.reduce((acc, curr) => acc + (curr.cambios || 0), 0);
                            // Total Tiros Sum (Reg + Eq)
                            const totalTirosGrand = totalTirosReg + totalTirosEq;

                            const footerRow = [
                                'TOTALES',
                                Math.round(totalMeta).toLocaleString(),
                                '',
                                totalTirosReg.toLocaleString(),
                                totalTirosEq.toLocaleString(),
                                totalTirosGrand.toLocaleString(),
                                totalCambios.toString()
                            ];

                            // Append totals to body for guaranteed rendering
                            dataBreakdown.push(footerRow);

                            doc.setFontSize(14);
                            doc.text(`Desglose Detallado: ${machineName}`, 14, chartY + 10);

                            autoTable(doc, {
                                head: [colsBreakdown],
                                body: dataBreakdown,
                                startY: chartY + 15,
                                styles: { fontSize: 8, cellPadding: 2 },
                                headStyles: { fillColor: [70, 130, 180], textColor: 255 },
                                didParseCell: (data) => {
                                    // Style the last row (Totals)
                                    if (data.row.index === dataBreakdown.length - 1) {
                                        data.cell.styles.fillColor = [220, 220, 220];
                                        data.cell.styles.fontStyle = 'bold';
                                    }
                                }
                            });

                            // Update chartY for next section
                            chartY = doc.lastAutoTable.finalY + 15;
                        }
                    }
                } catch (err) {
                    console.error("Error fetching breakdown for PDF", err);
                }
            }

            // =========== TABLA DE CALIFICACIONES POR MÁQUINA ===========
            if ((reportType === 'general' || reportType === 'maquina') && resumen?.resumenMaquinas?.length > 0) {
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
                const calData = resumen.resumenMaquinas
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
                    (resumen.calificacionTotalPlanta || 0).toFixed(2)
                ]);

                autoTable(doc, {
                    head: [calColumns],
                    body: calData,
                    startY: chartY,
                    styles: { fontSize: 10, cellPadding: 3 },
                    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                    // Estilo especial para fila de total
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

                    // Ordenar por fecha (más antiguo primero)
                    const historialOrdenado = [...historialCalificaciones]
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
                                <Picker.Item label="Gastos por Bonificación" value="bonificacion" />
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
                                    <Picker.Item label="TODOS (Reporte Detallado)" value="todos" />
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

                    {reportType === 'maquina' && (
                        <View style={styles.controlGroup}>
                            <Text style={[styles.label, { color: colors.text }]}>Maquina:</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 200 }]}>
                                <Picker
                                    selectedValue={selectedMaquina}
                                    onValueChange={(itemValue) => setSelectedMaquina(itemValue)}
                                    style={[styles.picker, { color: colors.text }]}
                                >
                                    <Picker.Item label="-- Seleccione Maquina --" value="" />
                                    <Picker.Item label="TODAS (Reporte Detallado)" value="todos" />
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
                            displayedMaquinas.map((item, index) => (
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
                                    <Text style={{ color: '#000' }}>Eficiencia: {(item.porcentajeRendimiento100)?.toFixed(1)}%</Text>
                                </View>
                            ))
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
    }
});
