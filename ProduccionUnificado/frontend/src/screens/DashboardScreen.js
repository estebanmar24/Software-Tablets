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

    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    // Data Lists
    const [usuarios, setUsuarios] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [periodosDisponibles, setPeriodosDisponibles] = useState([]);

    // Filtros dinámicos
    const [operariosConDatos, setOperariosConDatos] = useState([]);
    const [filteredUsuarios, setFilteredUsuarios] = useState([]);
    const [filteredMaquinas, setFilteredMaquinas] = useState([]);

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
    useEffect(() => {
        if (operariosConDatos.length > 0) {
            const opIds = operariosConDatos.map(o => o.usuarioId);
            const maqIds = operariosConDatos.map(o => o.maquinaId);

            setFilteredUsuarios(usuarios.filter(u => opIds.includes(u.id)));
            setFilteredMaquinas(maquinas.filter(m => maqIds.includes(m.id)));
        } else {
            setFilteredUsuarios([]);
            setFilteredMaquinas([]);
        }
    }, [operariosConDatos, usuarios, maquinas]);


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
            const [m, u] = await Promise.all([
                api.get('/maquinas'),
                api.get('/usuarios')
            ]);
            setMaquinas(m.data.filter(x => x.activa));
            setUsuarios(u.data.filter(x => x.estado));
        } catch (e) {
            console.error(e);
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

            // Calificacion General
            if (resumen?.resumenMaquinas?.length > 0 && reportType !== 'operario') {
                const totalEff = resumen.resumenMaquinas.reduce((sum, m) => sum + (m.porcentajeRendimiento || 0), 0);
                const avgEff = (totalEff / resumen.resumenMaquinas.length) * 100;

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                // Color based on score
                const color = avgEff >= 75 ? [40, 167, 69] : [220, 53, 69]; // Green/Red
                doc.setTextColor(...color);
                doc.text(`Calificación General: ${avgEff.toFixed(1)}%`, pageWidth / 2, 40, { align: 'center' });
                doc.setTextColor(0, 0, 0); // Reset
            }

            // Prepare Table Data Batches
            let tablesPayload = []; // { title, columns, data, headStyles? }

            const colsOperario = ['Maquina', 'Dias Lab', 'Meta Bonif.', 'Tiros', 'Horas Prod', 'Promedio/H', 'Valor a Pagar', 'Semaforo'];
            const colsMaquina = ['Tiros Totales', 'Rendimiento Esperado', 'Eficiencia (%)', 'Semaforo'];

            if (reportType === 'general') {
                const columns = ['Operario', 'Maquina', 'Dias Lab', 'Meta Bonif.', 'Tiros', 'Horas Prod', 'Promedio/H', 'Semaforo'];
                const data = (resumen?.resumenOperarios || []).map(item => [
                    item.operario,
                    item.maquina,
                    item.diasLaborados?.toString() || '0',
                    item.metaBonificacion?.toFixed(0) || '0',
                    item.totalTiros?.toString() || '0',
                    item.totalHorasProductivas?.toFixed(2) || '0',
                    item.promedioHoraProductiva?.toFixed(2) || '0',
                    item.semaforoColor || '-'
                ]);
                tablesPayload.push({ title: 'Reporte General', columns, data });

                // Summary for general report
                if (resumen?.resumenMaquinas?.length > 0) {
                    const maqColumns = ['Maquina', 'Tiros Totales', 'Rend. Esperado', 'Eficiencia', 'Semaforo'];
                    const maqData = resumen.resumenMaquinas.map(item => [
                        item.maquina,
                        item.tirosTotales?.toString() || '0',
                        item.rendimientoEsperado?.toFixed(0) || '0',
                        `${(item.porcentajeRendimiento * 100)?.toFixed(1) || '0'}%`,
                        item.semaforoColor || '-'
                    ]);
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

                targetIds.sort().forEach(opId => {
                    const operarioData = (resumen?.resumenOperarios || []).filter(item => item.usuarioId == opId);
                    if (operarioData.length === 0) return;

                    const operarioNombre = usuarios.find(u => u.id == opId)?.nombre || operarioData[0].operario || 'Desconocido';
                    const data = operarioData.map(item => [
                        item.maquina,
                        item.diasLaborados?.toString() || '0',
                        item.metaBonificacion?.toFixed(0) || '0',
                        item.totalTiros?.toString() || '0',
                        item.totalHorasProductivas?.toFixed(2) || '0',
                        item.promedioHoraProductiva?.toFixed(2) || '0',
                        `$${item.valorAPagar?.toFixed(0) || '0'}`,
                        item.semaforoColor || '-'
                    ]);
                    tablesPayload.push({ title: `Operario: ${operarioNombre}`, columns: colsOperario, data });
                });

            } else if (reportType === 'maquina') {
                const targetIds = selectedMaquina === 'todos'
                    ? [...new Set((resumen?.resumenMaquinas || []).map(i => i.maquinaId))]
                    : [selectedMaquina];

                targetIds.sort().forEach(maqId => {
                    const maquinaData = (resumen?.resumenMaquinas || []).filter(item => item.maquinaId == maqId);
                    if (maquinaData.length === 0) return;

                    const maquinaNombre = maquinas.find(m => m.id == maqId)?.nombre || maquinaData[0].maquina || 'Desconocida';
                    const data = maquinaData.map(item => [
                        item.tirosTotales?.toString() || '0',
                        item.rendimientoEsperado?.toFixed(0) || '0',
                        `${(item.porcentajeRendimiento * 100)?.toFixed(1) || '0'}%`,
                        item.semaforoColor || '-'
                    ]);
                    tablesPayload.push({ title: `Maquina: ${maquinaNombre}`, columns: colsMaquina, data });
                });
            }

            // Render Logic (Sequential)
            let lastY = 60;

            const setSemaforoColor = (data) => {
                const text = data.cell.raw;
                if (!text) return;
                const lowerText = text.toString().toLowerCase();
                if (lowerText.includes('rojo')) {
                    data.cell.styles.fillColor = [255, 204, 204];
                    data.cell.text = '';
                } else if (lowerText.includes('amarillo')) {
                    data.cell.styles.fillColor = [255, 245, 204]; // Should not happen with binary, but kept for safety
                    data.cell.text = '';
                } else if (lowerText.includes('verde')) {
                    data.cell.styles.fillColor = [204, 255, 204];
                    data.cell.text = '';
                }
            };

            // Helper: Generate Chart Image using Chart.js (HTML5 Canvas)
            // NOTE: Chart.js requires DOM, so charts are only generated on web
            const generateChartImage = async (title, labels, data, type = 'bar', options = {}) => {
                // Skip chart generation on mobile - Chart.js requires DOM
                if (Platform.OS !== 'web') {
                    console.log('Skipping chart generation on mobile (no DOM available)');
                    return null;
                }
                return new Promise((resolve, reject) => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 1400; // Wider for more labels
                        canvas.height = 800; // Taller for better visibility
                        const { backgroundColors, valueSuffix = '', showLegend = false, textColor = '#333' } = options;
                        const ctx = canvas.getContext('2d');

                        new Chart(ctx, {
                            type: type,
                            data: {
                                labels: labels,
                                datasets: [{
                                    label: title,
                                    data: data,
                                    backgroundColor: backgroundColors || '#4169E1',
                                    borderColor: '#333',
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: false,
                                animation: false,
                                layout: { padding: { top: 40, bottom: 20, left: 20, right: 20 } },
                                plugins: {
                                    legend: { display: showLegend },
                                    title: {
                                        display: true,
                                        text: title,
                                        font: { size: 36, weight: 'bold' },
                                        padding: { bottom: 30 }
                                    },
                                    datalabels: {
                                        anchor: 'end',
                                        align: 'top',
                                        formatter: (value) => `${value}${valueSuffix}`,
                                        font: { size: 14, weight: 'bold' },
                                        color: textColor,
                                        rotation: -45 // Rotate labels to avoid overlap
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: { font: { size: 18 } },
                                        grid: { color: '#e0e0e0' }
                                    },
                                    x: {
                                        ticks: {
                                            font: { size: 11, weight: 'bold' },
                                            autoSkip: false,
                                            maxRotation: 45, // Less aggressive rotation
                                            minRotation: 45
                                        },
                                        grid: { display: false }
                                    }
                                }
                            }
                        });

                        // Small timeout to ensure render
                        setTimeout(() => {
                            const imgData = canvas.toDataURL('image/png');
                            resolve(imgData);
                            canvas.remove();
                        }, 100);

                    } catch (error) {
                        console.error("Error creating chart:", error);
                        resolve(null);
                    }
                });
            };

            // ... Existing Table Rendering ...
            tablesPayload.forEach((tbl, idx) => {
                // If not first table, check space or add page break if needed?
                // AutoTable handles page breaks automatically, but we start new table.
                // We want titles.
                if (idx > 0) lastY = doc.lastAutoTable.finalY + 15;

                // If lastY is too low, add page? AutoTable logic usually handles Y, but for the TITLE we need to check.
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
                        if (data.section === 'body' && (data.column.index === tbl.columns.length - 1)) {
                            setSemaforoColor(data);
                        }
                    },
                    margin: { top: 20 }
                });
            });

            // CHARTS GENERATION (IMPROVED WITH Chart.js)
            let chartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : 120;
            const addChartToDoc = async (imgData) => {
                if (!imgData) {
                    // This is expected on mobile since charts are skipped
                    return;
                }
                // Check space (height approx 110 + margin)
                if (chartY + 130 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    chartY = 20;
                }
                try {
                    doc.addImage(imgData, 'PNG', 10, chartY, 190, 110); // Larger image
                    chartY += 120; // Advance Y
                } catch (e) {
                    console.error("Error adding image to PDF:", e);
                }
            };

            if (reportType === 'general') {
                console.log("Generating general report charts...");
                console.log("resumen?.resumenOperarios:", resumen?.resumenOperarios);
                if ((resumen?.resumenOperarios || []).length > 0) {
                    const topOps = [...resumen.resumenOperarios]
                        .sort((a, b) => b.totalTiros - a.totalTiros)
                        .slice(0, 15);
                    console.log("topOps data:", topOps);
                    if (topOps.length > 0) {
                        // Colors based on semaphore
                        const chartColors = topOps.map(o => {
                            if (o.semaforoColor === 'Verde') return '#28a745';
                            if (o.semaforoColor === 'Amarillo') return '#ffc107';
                            return '#dc3545'; // Rojo
                        });

                        // Labels with Machine Name (Multiline array for Chart.js)
                        const chartLabels = topOps.map(o => [o.operario.substring(0, 15), o.maquina]);

                        console.log("Creating Top Production chart...");
                        const img = await generateChartImage(
                            "Top Producción (Tiros)",
                            chartLabels,
                            topOps.map(o => o.totalTiros),
                            'bar',
                            { backgroundColors: chartColors, textColor: '#333' }
                        );
                        console.log("Chart image generated:", img ? "OK" : "FAILED");
                        await addChartToDoc(img);
                    }
                } else {
                    console.log("No resumenOperarios data found!");
                }
            }

            if (reportType === 'general' || reportType === 'maquina') {
                if ((resumen?.resumenMaquinas || []).length > 0) {
                    const chartDataEff = [...resumen.resumenMaquinas].sort((a, b) => b.porcentajeRendimiento - a.porcentajeRendimiento);
                    const imgEff = await generateChartImage("Eficiencia por Máquina (%)", chartDataEff.map(m => m.maquina), chartDataEff.map(m => (m.porcentajeRendimiento * 100).toFixed(1)), 'bar', { valueSuffix: '%', backgroundColors: chartDataEff.map(m => m.porcentajeRendimiento >= 0.75 ? '#28a745' : '#dc3545'), textColor: '#333' });
                    await addChartToDoc(imgEff);

                    if (reportType === 'maquina') {
                        // Chart: Total Tiempos Muertos por Maquina (Bar Chart)
                        // Use the same order (Efficiency) or sort by Downtime? 
                        // User said "also this chart...". 
                        // To match the report order, we use chartDataEff order.
                        const downtimeData = chartDataEff.map(m => ({
                            maquina: m.maquina,
                            total: m.totalTiemposMuertos || 0
                        }));

                        // Filter out machines with 0 downtime? 
                        // User said "salgan todas las maquinas". So we keep them.

                        if (downtimeData.length > 0) {
                            const imgDowntime = await generateChartImage(
                                "Total Tiempos Muertos (Horas)",
                                downtimeData.map(d => d.maquina),
                                downtimeData.map(d => d.total.toFixed(1)),
                                'bar',
                                {
                                    backgroundColors: '#dc3545', // Red for downtime
                                    valueSuffix: ' h',
                                    textColor: '#333'
                                }
                            );
                            await addChartToDoc(imgDowntime);
                        }
                    }
                }
            }

            // 2. Tendencia Diaria (Global - Only for General)
            if (reportType === 'general' && (resumen?.tendenciaDiaria || []).length > 0) {
                const dailyData = [...resumen.tendenciaDiaria].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                const labels = dailyData.map(d => d.fecha.split('T')[0].split('-').slice(1).join('/')); // MM/DD

                // Production Trend
                const imgTrend = await generateChartImage(
                    "Tendencia Producción Diaria (Tiros)",
                    labels,
                    dailyData.map(d => d.tiros),
                    'line',
                    { backgroundColors: '#007bff', textColor: '#333' }
                );
                await addChartToDoc(imgTrend);
            }

            // 3. Velocidad Operarios (Only General)
            if (reportType === 'general') {
                if ((resumen?.resumenOperarios || []).length > 0) {
                    const speedData = [...resumen.resumenOperarios]
                        .sort((a, b) => b.promedioHoraProductiva - a.promedioHoraProductiva)
                        .slice(0, 15);

                    const speedColors = speedData.map(o => {
                        if (o.semaforoColor === 'Verde') return '#28a745';
                        if (o.semaforoColor === 'Amarillo') return '#ffc107';
                        return '#dc3545';
                    });

                    const speedLabels = speedData.map(o => [o.operario.substring(0, 15), o.maquina]);

                    const imgSpeed = await generateChartImage(
                        "Velocidad Promedio (Tiros/Hora)",
                        speedLabels,
                        speedData.map(o => o.promedioHoraProductiva.toFixed(0)),
                        'bar',
                        { backgroundColors: speedColors, textColor: '#333' }
                    );
                    await addChartToDoc(imgSpeed);
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

                            // --- SIMPLE CHART ---
                            const dailyTotals = [];
                            const labels = [];

                            for (let day = dStart; day <= dEnd; day++) {
                                const dayData = sortedHistory.filter(d => {
                                    const dDate = d.fecha.split('T')[0];
                                    const dDay = parseInt(dDate.split('-')[2]);
                                    return dDay === day;
                                });
                                const total = dayData.reduce((sum, d) => sum + (d.tirosDiarios || 0), 0);
                                if (total > 0) {
                                    dailyTotals.push(total);
                                    labels.push(`${mes.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`);
                                }
                            }

                            if (dailyTotals.length > 0) {
                                const imgOperario = await generateChartImage(
                                    `Tendencia Producción Diaria (Tiros)`,
                                    labels,
                                    dailyTotals,
                                    'line',
                                    { backgroundColors: '#007bff', textColor: '#333' }
                                );
                                await addChartToDoc(imgOperario);
                            }
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
            <View style={styles.headerContainer}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                <Text style={[styles.header, { color: colors.text }]}>Tablero Semáforos</Text>
            </View>

            {/* Top Navigation */}
            {/* Top Navigation */}



            {/* Date Selection Row */}
            <View style={styles.controlRow}>
                {periodosDisponibles.length > 0 ? (
                    <>
                        <Text style={[styles.label, { color: colors.text }]}>Año:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 100 }]}>
                            <Picker
                                selectedValue={anio}
                                onValueChange={(itemValue) => setAnio(parseInt(itemValue))}
                                style={[styles.picker, { color: colors.text }]}
                            >
                                {getUniquePeriods().map(a => (
                                    <Picker.Item key={a} label={a.toString()} value={a} />
                                ))}
                            </Picker>
                        </View>

                        <Text style={[styles.label, { marginLeft: 15, color: colors.text }]}>Mes:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 150 }]}>
                            <Picker
                                selectedValue={mes}
                                onValueChange={(itemValue) => setMes(parseInt(itemValue))}
                                style={[styles.picker, { color: colors.text }]}
                            >
                                {/* Show available months for selected year, or all if none found (fallback) */}
                                {(getMesesParaAnio(anio).length > 0 ? getMesesParaAnio(anio) :
                                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ mes: m }))
                                ).map(p => (
                                    <Picker.Item key={p.mes} label={getMesNombre(p.mes)} value={p.mes} />
                                ))}
                            </Picker>
                        </View>
                    </>
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginRight: 5, color: colors.text }]}>Año:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 100 }]}>
                            <Picker selectedValue={anio} onValueChange={(v) => setAnio(parseInt(v))} style={[styles.picker, { color: colors.text }]}>
                                {[2024, 2025, 2026].map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                            </Picker>
                        </View>
                        <Text style={[styles.label, { marginLeft: 15, marginRight: 5, color: colors.text }]}>Mes:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border, minWidth: 150 }]}>
                            <Picker selectedValue={mes} onValueChange={(v) => setMes(parseInt(v))} style={[styles.picker, { color: colors.text }]}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <Picker.Item key={m} label={getMesNombre(m)} value={m} />)}
                            </Picker>
                        </View>
                    </View>
                )}

                <TouchableOpacity style={styles.btnReload} onPress={() => { cargarResumen(); cargarPeriodosDisponibles(); cargarOperariosConDatos(); }}>
                    <Text style={{ color: 'white' }}>🔄 Recargar</Text>
                </TouchableOpacity>
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
                        {(resumen?.resumenOperarios || []).length === 0 ? (
                            <Text style={[styles.noData, { color: colors.subText }]}>No hay datos para el periodo seleccionado</Text>
                        ) : (
                            (resumen?.resumenOperarios || []).map((item, index) => (
                                <View key={index} style={[styles.card, { backgroundColor: getColor(item.semaforoColor), borderColor: 'transparent', borderWidth: 1 }]}>
                                    <Text style={[styles.cardTitle, { color: '#000' }]}>{item.operario} - {item.maquina}</Text>
                                    <Text style={{ color: '#000' }}>Meta Bonif: {item.metaBonificacion?.toFixed(0) || '0'}</Text>
                                    <Text style={{ color: '#000' }}>Tiros: {item.totalTiros}</Text>
                                    <Text style={{ color: '#000' }}>Horas Prod: {item.totalHorasProductivas?.toFixed(2)}</Text>
                                    <Text style={{ color: '#000' }}>Promedio/H: {item.promedioHoraProductiva?.toFixed(2)}</Text>
                                    <Text style={{ color: '#000' }}>💰 A Pagar: ${item.valorAPagar?.toFixed(0) || '0'}</Text>
                                </View>
                            ))
                        )}

                        <Text style={[styles.sectionHeader, { color: colors.text }]}>🏭 Por Maquina</Text>
                        {(resumen?.resumenMaquinas || []).length === 0 ? (
                            <Text style={[styles.noData, { color: colors.subText }]}>No hay datos para el periodo seleccionado</Text>
                        ) : (
                            (resumen?.resumenMaquinas || []).map((item, index) => (
                                <View key={index} style={[styles.card, { backgroundColor: getColor(item.semaforoColor), borderColor: 'black', borderWidth: 2 }]}>
                                    <Text style={[styles.cardTitle, { color: '#000' }]}>{item.maquina}</Text>
                                    <Text style={{ color: '#000' }}>Tiros Totales: {item.tirosTotales}</Text>
                                    <Text style={{ color: '#000' }}>Rendimiento Esp: {item.rendimientoEsperado?.toFixed(0)}</Text>
                                    <Text style={{ color: '#000' }}>Eficiencia: {(item.porcentajeRendimiento * 100)?.toFixed(1)}%</Text>
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
