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

            const colsOperario = ['Maquina', 'Dias Lab', 'Meta 75%', 'Meta 100%', 'Tiros', 'Horas Prod', 'Promedio/H', 'Valor a Pagar', 'Sem 75%', 'Sem 100%'];
            const colsMaquina = ['Tiros Totales', 'Meta 75%', 'Meta 100%', 'Eficiencia (%)', 'Semaforo'];

            if (reportType === 'general') {
                const columns = ['Operario', 'Maquina', 'Dias Lab', 'Meta 75%', 'Meta 100%', 'Tiros', 'Horas Prod', 'Promedio/H', 'Sem 75%', 'Sem 100%'];
                const data = (resumen?.resumenOperarios || []).map(item => [
                    item.operario,
                    item.maquina,
                    item.diasLaborados?.toString() || '0',
                    item.metaBonificacion?.toFixed(0) || '0',
                    item.meta100Porciento?.toFixed(0) || '0',
                    item.totalTiros?.toString() || '0',
                    item.totalHorasProductivas?.toFixed(2) || '0',
                    item.promedioHoraProductiva?.toFixed(2) || '0',
                    `${item.semaforoColor || 'Gris'}|${(item.porcentajeRendimiento75 || 0).toFixed(0)}%`,
                    `${item.semaforoColor100 || 'Gris'}|${(item.porcentajeRendimiento100 || 0).toFixed(0)}%`
                ]);
                tablesPayload.push({ title: 'Reporte General', columns, data });

                // Summary for general report
                if (resumen?.resumenMaquinas?.length > 0) {
                    const maqColumns = ['Maquina', 'Tiros Totales', 'Meta 75%', 'Meta 100%', 'Eficiencia', 'Semaforo'];
                    const maqData = resumen.resumenMaquinas.map(item => [
                        item.maquina,
                        item.tirosTotales?.toString() || '0',
                        item.meta75Porciento?.toFixed(0) || '0',
                        item.meta100Porciento?.toFixed(0) || '0',
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
                        item.meta100Porciento?.toFixed(0) || '0',
                        item.totalTiros?.toString() || '0',
                        item.totalHorasProductivas?.toFixed(2) || '0',
                        item.promedioHoraProductiva?.toFixed(2) || '0',
                        `$${item.valorAPagarBonificable?.toFixed(0) || '0'}`, // Solo tiros dentro del horario laboral
                        `${item.semaforoColor || 'Gris'}|${(item.porcentajeRendimiento75 || 0).toFixed(0)}%`,
                        `${item.semaforoColor100 || 'Gris'}|${(item.porcentajeRendimiento100 || 0).toFixed(0)}%`
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
                        item.meta75Porciento?.toFixed(0) || '0',
                        item.meta100Porciento?.toFixed(0) || '0',
                        `${(item.porcentajeRendimiento * 100)?.toFixed(1) || '0'}%`,
                        item.semaforoColor || '-'
                    ]);
                    tablesPayload.push({ title: `Maquina: ${maquinaNombre}`, columns: colsMaquina, data });
                });
            }

            // Render Logic (Sequential)
            let lastY = 60;

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
                        if (data.section === 'head') return;
                        // Robust check: Apply to any column with header containing "Sem" or "Semaforo"
                        // tbl.columns provides the header strings
                        const header = tbl.columns[data.column.index];
                        if (header && (header.includes('Semaforo') || header.includes('Sem '))) {
                            setSemaforoColor(data);
                        }
                    },
                    margin: { top: 20 }
                });
            });

            // CHARTS GENERATION using jsPDF primitives (works on web and mobile)
            let chartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : 120;

            if (reportType === 'general') {
                console.log("Generating general report charts...");

                // Chart 1: Top Production (Tiros)
                if ((resumen?.resumenOperarios || []).length > 0) {
                    const topOps = [...resumen.resumenOperarios]
                        .sort((a, b) => b.totalTiros - a.totalTiros)
                        .slice(0, 10);

                    if (topOps.length > 0) {
                        const chartColors = topOps.map(o => {
                            if (o.semaforoColor === 'Verde') return '#28a745';
                            if (o.semaforoColor === 'Amarillo') return '#ffc107';
                            return '#dc3545';
                        });
                        const chartLabels = topOps.map(o => o.operario.substring(0, 10));
                        const chartData = topOps.map(o => o.totalTiros);

                        chartY = drawBarChart(doc, "Top Producción (Tiros)", chartLabels, chartData, chartY, { colors: chartColors });
                    }
                }

                // Chart 2: Speed (Promedio/Hora)
                if ((resumen?.resumenOperarios || []).length > 0) {
                    const speedData = [...resumen.resumenOperarios]
                        .sort((a, b) => b.promedioHoraProductiva - a.promedioHoraProductiva)
                        .slice(0, 10);

                    if (speedData.length > 0) {
                        const speedColors = speedData.map(o => {
                            if (o.semaforoColor === 'Verde') return '#28a745';
                            if (o.semaforoColor === 'Amarillo') return '#ffc107';
                            return '#dc3545';
                        });
                        const speedLabels = speedData.map(o => o.operario.substring(0, 10));
                        const speedValues = speedData.map(o => Math.round(o.promedioHoraProductiva));

                        chartY = drawBarChart(doc, "Velocidad Promedio (Tiros/Hora)", speedLabels, speedValues, chartY, { colors: speedColors });
                    }
                }
            }

            // Chart: Efficiency by Machine (for general and machine reports)
            if (reportType === 'general' || reportType === 'maquina') {
                if ((resumen?.resumenMaquinas || []).length > 0) {
                    const chartDataEff = [...resumen.resumenMaquinas]
                        .sort((a, b) => b.porcentajeRendimiento - a.porcentajeRendimiento);

                    const effColors = chartDataEff.map(m => m.porcentajeRendimiento >= 0.75 ? '#28a745' : '#dc3545');
                    const effLabels = chartDataEff.map(m => m.maquina.substring(0, 10));
                    const effValues = chartDataEff.map(m => Math.round(m.porcentajeRendimiento * 100));

                    chartY = drawBarChart(doc, "Eficiencia por Máquina (%)", effLabels, effValues, chartY, { colors: effColors });
                }
            }

            // Chart: Daily Trend (line chart for general report)
            if (reportType === 'general' && (resumen?.tendenciaDiaria || []).length > 0) {
                const dailyData = [...resumen.tendenciaDiaria].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                const dailyLabels = dailyData.map(d => d.fecha.split('T')[0].split('-').slice(1).join('/'));
                const dailyValues = dailyData.map(d => d.tiros);

                chartY = drawLineChart(doc, "Tendencia Producción Diaria", dailyLabels, dailyValues, chartY);
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
                                <View key={index} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.operario} - {item.maquina}</Text>
                                    <Text style={{ color: colors.text }}>Meta 75%: {item.metaBonificacion?.toFixed(0) || '0'} | Meta 100%: {item.meta100Porciento?.toFixed(0) || '0'}</Text>
                                    <Text style={{ color: colors.text }}>Tiros: {item.totalTiros}</Text>
                                    <Text style={{ color: colors.text }}>Horas Prod: {item.totalHorasProductivas?.toFixed(2)}</Text>
                                    <Text style={{ color: colors.text }}>Promedio/H: {item.promedioHoraProductiva?.toFixed(2)}</Text>
                                    <Text style={{ color: colors.text }}>💰 Bonificación: ${item.valorAPagarBonificable?.toFixed(0) || '0'}</Text>

                                    {/* Semáforos con porcentajes */}
                                    <View style={{ flexDirection: 'row', marginTop: 10, gap: 15 }}>
                                        {/* Semáforo 75% */}
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{ fontSize: 10, color: colors.subText, marginBottom: 3 }}>Meta 75%</Text>
                                            <View style={{
                                                width: 60, height: 40, borderRadius: 8,
                                                backgroundColor: getColor(item.semaforoColor),
                                                justifyContent: 'center', alignItems: 'center',
                                                borderWidth: 2, borderColor: '#333'
                                            }}>
                                                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                                                    {(item.porcentajeRendimiento75 || 0).toFixed(0)}%
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Semáforo 100% */}
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{ fontSize: 10, color: colors.subText, marginBottom: 3 }}>Meta 100%</Text>
                                            <View style={{
                                                width: 60, height: 40, borderRadius: 8,
                                                backgroundColor: getColor(item.semaforoColor100),
                                                justifyContent: 'center', alignItems: 'center',
                                                borderWidth: 2, borderColor: '#333'
                                            }}>
                                                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                                                    {(item.porcentajeRendimiento100 || 0).toFixed(0)}%
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
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
