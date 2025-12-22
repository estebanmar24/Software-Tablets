import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Added Picker
import api from '../services/productionApi';
// jsPDF moved to dynamic import to avoid Android TextDecoder 'latin1' startup crash
// import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
// CustomNavBar removed - navigation handled by AdminDashboard

export default function CartasScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [periodosDisponibles, setPeriodosDisponibles] = useState([]);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [statusText, setStatusText] = useState('');

    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    useEffect(() => {
        cargarPeriodos();
    }, []);

    const cargarPeriodos = async () => {
        try {
            const response = await api.get('/produccion/periodos-disponibles');
            setPeriodosDisponibles(response.data);
            if (response.data.length > 0) {
                setMes(response.data[0].mes);
                setAnio(response.data[0].anio);
            }
        } catch (e) {
            console.error('Error cargando periodos:', e);
            Alert.alert('Error', 'No se pudieron cargar los periodos disponibles.');
        }
    };

    const getMesNombre = (m) => {
        const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[m] || '';
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

    const generarCartas = async () => {
        // Verificar si está en móvil
        if (Platform.OS !== 'web') {
            Alert.alert(
                'Solo disponible en escritorio',
                'La generación de cartas solo está disponible en la versión de escritorio (navegador web) debido al manejo de archivos PDF y ZIP.',
                [{ text: 'Entendido', style: 'default' }]
            );
            return;
        }

        setLoading(true);
        setStatusText('Obteniendo datos...');
        try {
            // 1. Fetch Data
            const response = await api.get(`/produccion/resumen?mes=${mes}&anio=${anio}`);
            const data = response.data;

            if (!data || !data.resumenOperarios || data.resumenOperarios.length === 0) {
                Alert.alert('Aviso', 'No hay datos de operarios para el periodo seleccionado.');
                setLoading(false);
                return;
            }

            // 2. Load Logo
            let base64Logo = null;
            try {
                const asset = Asset.fromModule(logoSource);
                await asset.downloadAsync();
                base64Logo = await getBase64FromUrl(asset.uri);
            } catch (err) {
                console.log("Error loading logo", err);
            }

            const zip = new JSZip();
            const folder = zip.folder(`Cartas_${getMesNombre(mes)}_${anio}`);

            // 3. Agrupar datos por operario (usuarioId)
            const operarioMap = new Map();
            for (const op of data.resumenOperarios) {
                const key = op.usuarioId;
                if (!operarioMap.has(key)) {
                    operarioMap.set(key, {
                        usuarioId: op.usuarioId,
                        operario: op.operario,
                        maquinas: []
                    });
                }
                operarioMap.get(key).maquinas.push({
                    maquina: op.maquina,
                    diasLaborados: op.diasLaborados,
                    meta100Porciento: op.meta100Porciento,
                    totalTiros: op.totalTiros,
                    totalHorasProductivas: op.totalHorasProductivas,
                    promedioHoraProductiva: op.promedioHoraProductiva,
                    valorAPagarBonificable: op.valorAPagarBonificable,
                    porcentajeRendimiento100: op.porcentajeRendimiento100,
                    semaforoColor100: op.semaforoColor100
                });
            }

            const operariosUnicos = Array.from(operarioMap.values());
            let count = 0;

            let jsPDFClass, autoTable;
            try {
                if (Platform.OS === 'web') {
                    const jsPDFModule = await import('jspdf');
                    jsPDFClass = jsPDFModule.jsPDF;
                    const autoTableModule = await import('jspdf-autotable');
                    autoTable = autoTableModule.default;
                } else {
                    const jsPDFModule = await import('jspdf');
                    jsPDFClass = jsPDFModule.jsPDF;
                    const autoTableModule = await import('jspdf-autotable');
                    autoTable = autoTableModule.default;
                }
            } catch (e) {
                alert("Error cargando librerías PDF. Intente en Web si falla en móvil.");
                console.error(e);
                setLoading(false);
                return;
            }

            for (const opData of operariosUnicos) {
                setStatusText(`Generando carta ${count + 1}/${operariosUnicos.length}...`);

                const doc = new jsPDFClass();
                const pageWidth = doc.internal.pageSize.getWidth();

                // Importar autoTable ya está hecho arriba
                // const autoTable = (await import('jspdf-autotable')).default;

                // Header
                if (base64Logo) {
                    doc.addImage(base64Logo, 'JPEG', 10, 10, 30, 30);
                }

                doc.setFontSize(10);
                doc.text(`${new Date().toLocaleDateString()}`, pageWidth - 20, 20, { align: 'right' });

                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('CARTA DE DESEMPENO MENSUAL', pageWidth / 2, 30, { align: 'center' });

                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.text(`Periodo: ${getMesNombre(mes)} ${anio}`, pageWidth / 2, 40, { align: 'center' });

                doc.text(`Estimado(a): ${opData.operario}`, 20, 55);

                // Calcular totales
                const totalTirosGlobal = opData.maquinas.reduce((sum, m) => sum + m.totalTiros, 0);
                const totalValorPagar = opData.maquinas.reduce((sum, m) => sum + (m.valorAPagarBonificable || 0), 0);

                // Contar máquinas según el rendimiento (calculado directamente)
                const maquinasVerdes = opData.maquinas.filter(m => (m.porcentajeRendimiento100 || 0) >= 100);
                const maquinasAmarillas = opData.maquinas.filter(m => {
                    const pct = m.porcentajeRendimiento100 || 0;
                    return pct >= 75 && pct < 100;
                });
                const maquinasRojas = opData.maquinas.filter(m => (m.porcentajeRendimiento100 || 0) < 75);

                // Carta mixta para TODOS los operarios
                doc.setTextColor(0, 51, 102); // Azul oscuro
                doc.setFont('helvetica', 'bold');
                doc.text('RESUMEN DE DESEMPENO MENSUAL', pageWidth / 2, 68, { align: 'center' });
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);

                // Mensaje personalizado basado en el desempeño
                let mensaje = '';
                const totalMaq = opData.maquinas.length;

                if (maquinasVerdes.length === totalMaq) {
                    // Todas en verde (>=100%)
                    mensaje = 'Felicitaciones! Has alcanzado las metas en todas las maquinas asignadas. Sigue asi!';
                } else if (maquinasRojas.length === totalMaq) {
                    // Todas en rojo (<75%)
                    mensaje = 'Te invitamos a revisar tu desempeno para alcanzar las metas establecidas. Contamos con tu esfuerzo.';
                } else if (maquinasVerdes.length > 0 && maquinasAmarillas.length > 0) {
                    // Tiene verdes y amarillas (y posiblemente rojas)
                    mensaje = `Excelente! Alcanzaste la meta en ${maquinasVerdes.length} maquina(s) y estas cerca en ${maquinasAmarillas.length}. Sigue esforzandote!`;
                } else if (maquinasVerdes.length > 0) {
                    // Tiene algunas en verde (y posiblemente rojas, sin amarillas)
                    mensaje = `Felicitaciones! Alcanzaste la meta en ${maquinasVerdes.length} de ${totalMaq} maquina(s). Te invitamos a mejorar en las demas.`;
                } else if (maquinasAmarillas.length > 0) {
                    // Solo amarillas (y posiblemente rojas), sin verdes
                    mensaje = `Estas cerca de alcanzar las metas en ${maquinasAmarillas.length} maquina(s). Un poco mas de esfuerzo para llegar al 100%!`;
                } else {
                    mensaje = 'Te invitamos a mejorar tu desempeno para alcanzar las metas establecidas.';
                }
                doc.text(mensaje, 20, 78);

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('Resumen de Desempeno por Maquina:', 20, 90);

                // Ordenar máquinas naturalmente antes de mapear
                const sortedMaquinas = [...opData.maquinas].sort((a, b) => {
                    const getNum = (str) => { const m = str.match(/^(\d+)/); return m ? parseInt(m[1]) : 999; };
                    const numA = getNum(a.maquina || '');
                    const numB = getNum(b.maquina || '');
                    if (numA !== numB) return numA - numB;
                    return (a.maquina || '').localeCompare(b.maquina || '');
                });

                const tableData = sortedMaquinas.map(m => {
                    const pct100 = m.porcentajeRendimiento100 || 0;
                    let colorSem = 'Rojo';
                    if (pct100 >= 100) colorSem = 'Verde';
                    else if (pct100 >= 75) colorSem = 'Amarillo';

                    return [
                        m.maquina,
                        m.diasLaborados?.toString() || '0',
                        m.meta100Porciento?.toFixed(0) || '0',
                        m.totalTiros?.toString() || '0',
                        m.totalHorasProductivas?.toFixed(2) || '0',
                        m.promedioHoraProductiva?.toFixed(0) || '0',
                        `$${(m.valorAPagarBonificable || 0).toLocaleString()}`,
                        `${colorSem}|${pct100.toFixed(0)}%`
                    ];
                });

                const setSemaforoColor = (data) => {
                    const text = data.cell.raw;
                    if (!text) return;
                    const textStr = text.toString();

                    // Separar color y porcentaje
                    if (textStr.includes('|')) {
                        const [colorKey, pctText] = textStr.split('|');
                        data.cell.text = [pctText]; // Mostrar solo el porcentaje

                        if (colorKey.toLowerCase().includes('rojo')) {
                            data.cell.styles.fillColor = [255, 102, 102];
                            data.cell.styles.textColor = 255;
                        } else if (colorKey.toLowerCase().includes('amarillo')) {
                            data.cell.styles.fillColor = [255, 193, 7];
                            data.cell.styles.textColor = 0;
                        } else if (colorKey.toLowerCase().includes('verde')) {
                            data.cell.styles.fillColor = [40, 167, 69];
                            data.cell.styles.textColor = 255;
                        }
                    }
                };

                autoTable(doc, {
                    startY: 95,
                    head: [['Máquina', 'Días', 'Tiros 100%', 'Tiros', 'H.Prod', 'Prom/H', 'Valor', 'Sem 100%']],
                    body: tableData,
                    styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
                    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontSize: 8, halign: 'center' },
                    columnStyles: {
                        0: { cellWidth: 40, halign: 'left' },
                        1: { cellWidth: 15, halign: 'center' },
                        2: { cellWidth: 22, halign: 'center' },
                        3: { cellWidth: 22, halign: 'center' },
                        4: { cellWidth: 18, halign: 'center' },
                        5: { cellWidth: 18, halign: 'center' },
                        6: { cellWidth: 25, halign: 'center' },
                        7: { cellWidth: 20, halign: 'center' }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.column.index === 7) {
                            setSemaforoColor(data);
                        }
                    }
                });

                let finalY = doc.lastAutoTable.finalY + 10;

                // Calcular rendimiento promedio general del mes
                const rendimientoPromedio = sortedMaquinas.length > 0
                    ? sortedMaquinas.reduce((sum, m) => sum + (m.porcentajeRendimiento100 || 0), 0) / sortedMaquinas.length
                    : 0;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Total Tiros: ${totalTirosGlobal.toLocaleString()}`, 20, finalY);

                // Rendimiento promedio general
                finalY += 7;
                const colorRendimiento = rendimientoPromedio >= 100 ? [40, 167, 69] : rendimientoPromedio >= 75 ? [255, 193, 7] : [220, 53, 69];
                doc.setTextColor(...colorRendimiento);
                doc.text(`Rendimiento Promedio del Mes: ${rendimientoPromedio.toFixed(1)}%`, 20, finalY);
                doc.setTextColor(0, 0, 0);

                if (totalValorPagar > 0) {
                    finalY += 12;
                    doc.setFontSize(14);
                    doc.setTextColor(0, 100, 0);
                    doc.text(`BONIFICACION TOTAL A PAGAR: $${totalValorPagar.toLocaleString()}`, pageWidth / 2, finalY, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
                }

                // ========== GRÁFICA DE RENDIMIENTO POR MÁQUINA ==========
                if (sortedMaquinas.length > 0) {
                    finalY += 20;

                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 51, 102);
                    doc.text('Rendimiento por Máquina', pageWidth / 2, finalY, { align: 'center' });
                    doc.setTextColor(0, 0, 0);

                    finalY += 5;

                    // Configuración de la gráfica
                    const chartHeight = 40;
                    const chartWidth = pageWidth - 40;
                    const chartStartX = 20;
                    const chartStartY = finalY;
                    const barWidth = Math.min(25, (chartWidth - 10) / sortedMaquinas.length);
                    const maxValue = 120; // Máximo 120% para la escala

                    // Dibujar línea base y línea meta 100%
                    doc.setDrawColor(200, 200, 200);
                    doc.line(chartStartX, chartStartY + chartHeight, chartStartX + chartWidth, chartStartY + chartHeight);

                    // Línea de referencia 100%
                    const y100 = chartStartY + chartHeight - (100 / maxValue) * chartHeight;
                    doc.setDrawColor(0, 150, 0);
                    doc.setLineDash([2, 2]);
                    doc.line(chartStartX, y100, chartStartX + chartWidth, y100);
                    doc.setLineDash([]);
                    doc.setFontSize(6);
                    doc.setTextColor(0, 150, 0);
                    doc.text('100%', chartStartX - 2, y100 + 1, { align: 'right' });

                    // Línea de referencia del promedio general
                    const yPromedio = chartStartY + chartHeight - (Math.min(rendimientoPromedio, maxValue) / maxValue) * chartHeight;
                    doc.setDrawColor(0, 51, 102); // Azul oscuro
                    doc.setLineDash([4, 2]);
                    doc.line(chartStartX, yPromedio, chartStartX + chartWidth, yPromedio);
                    doc.setLineDash([]);
                    doc.setFontSize(6);
                    doc.setTextColor(0, 51, 102);
                    doc.text(`Prom: ${rendimientoPromedio.toFixed(0)}%`, chartStartX + chartWidth + 2, yPromedio + 1, { align: 'left' });

                    // Dibujar barras
                    sortedMaquinas.forEach((maq, index) => {
                        const pct = Math.min(maq.porcentajeRendimiento100 || 0, maxValue);
                        const barHeight = (pct / maxValue) * chartHeight;
                        const x = chartStartX + 5 + (index * (barWidth + 3));
                        const y = chartStartY + chartHeight - barHeight;

                        // Color de la barra según el rendimiento
                        if (pct >= 100) {
                            doc.setFillColor(40, 167, 69); // Verde
                        } else if (pct >= 75) {
                            doc.setFillColor(255, 193, 7); // Amarillo
                        } else {
                            doc.setFillColor(220, 53, 69); // Rojo
                        }

                        doc.rect(x, y, barWidth - 2, barHeight, 'F');

                        // Valor encima de la barra
                        doc.setFontSize(6);
                        doc.setTextColor(0, 0, 0);
                        doc.text(`${(maq.porcentajeRendimiento100 || 0).toFixed(0)}%`, x + (barWidth - 2) / 2, y - 2, { align: 'center' });

                        // Nombre de la máquina debajo (abreviado)
                        doc.setFontSize(5);
                        const nombreCorto = (maq.maquina || '').substring(0, 8);
                        doc.text(nombreCorto, x + (barWidth - 2) / 2, chartStartY + chartHeight + 5, { align: 'center' });
                    });

                    finalY = chartStartY + chartHeight + 15;
                }

                // ========== GRÁFICA DE TENDENCIA HISTÓRICA DEL OPERARIO ==========
                try {
                    // Primero guardar el rendimiento del mes actual (pasamos el valor ya calculado)
                    await api.post(`/rendimientooperario/guardar-directo?usuarioId=${opData.usuarioId}&mes=${mes}&anio=${anio}&rendimiento=${rendimientoPromedio.toFixed(2)}&totalTiros=${totalTirosGlobal}&totalMaquinas=${sortedMaquinas.length}`);

                    // Obtener historial del operario
                    const historialRes = await api.get(`/rendimientooperario/historial/${opData.usuarioId}?limit=6`);
                    const historial = historialRes?.data || [];

                    if (historial.length > 0) {
                        // Ordenar de más antiguo a más reciente
                        const historialOrdenado = [...historial].sort((a, b) => {
                            if (a.anio !== b.anio) return a.anio - b.anio;
                            return a.mes - b.mes;
                        });

                        // Verificar si hay espacio en la página, si no, agregar nueva página
                        if (finalY > 240) {
                            doc.addPage();
                            finalY = 20;
                        }

                        finalY += 10;
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text('Tendencia Histórica de Rendimiento', pageWidth / 2, finalY, { align: 'center' });
                        doc.setTextColor(0, 0, 0);

                        finalY += 5;

                        // Configuración de la gráfica
                        const trendChartHeight = 35;
                        const trendChartWidth = pageWidth - 60;
                        const trendChartStartX = 30;
                        const trendChartStartY = finalY;
                        const trendBarWidth = Math.min(25, (trendChartWidth - 10) / historialOrdenado.length);
                        const maxTrendValue = 120;

                        // Línea base
                        doc.setDrawColor(200, 200, 200);
                        doc.line(trendChartStartX, trendChartStartY + trendChartHeight, trendChartStartX + trendChartWidth, trendChartStartY + trendChartHeight);

                        // Línea 100%
                        const yTrend100 = trendChartStartY + trendChartHeight - (100 / maxTrendValue) * trendChartHeight;
                        doc.setDrawColor(0, 150, 0);
                        doc.setLineDash([2, 2]);
                        doc.line(trendChartStartX, yTrend100, trendChartStartX + trendChartWidth, yTrend100);
                        doc.setLineDash([]);
                        doc.setFontSize(6);
                        doc.setTextColor(0, 150, 0);
                        doc.text('Meta', trendChartStartX - 2, yTrend100 + 1, { align: 'right' });

                        // Dibujar barras
                        const mesesNombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                        const totalBarsWidth = historialOrdenado.length * (trendBarWidth + 5);
                        const offsetX = (trendChartWidth - totalBarsWidth) / 2;

                        historialOrdenado.forEach((reg, index) => {
                            const pct = Math.min(reg.rendimientoPromedio || 0, maxTrendValue);
                            const barHeight = (pct / maxTrendValue) * trendChartHeight;
                            const x = trendChartStartX + offsetX + (index * (trendBarWidth + 5));
                            const y = trendChartStartY + trendChartHeight - barHeight;

                            // Color de la barra
                            if (pct >= 100) {
                                doc.setFillColor(0, 51, 102); // Azul oscuro (meta cumplida)
                            } else if (pct >= 75) {
                                doc.setFillColor(66, 139, 202); // Azul medio
                            } else {
                                doc.setFillColor(135, 206, 250); // Azul claro
                            }

                            doc.rect(x, y, trendBarWidth, barHeight, 'F');

                            // Valor encima
                            doc.setFontSize(7);
                            doc.setTextColor(0, 0, 0);
                            doc.text(`${(reg.rendimientoPromedio || 0).toFixed(0)}%`, x + trendBarWidth / 2, y - 2, { align: 'center' });

                            // Etiqueta del mes
                            doc.setFontSize(6);
                            const mesLabel = `${mesesNombres[reg.mes]} ${reg.anio.toString().slice(-2)}`;
                            doc.text(mesLabel, x + trendBarWidth / 2, trendChartStartY + trendChartHeight + 5, { align: 'center' });
                        });

                        finalY = trendChartStartY + trendChartHeight + 15;
                    }
                } catch (histErr) {
                    console.log("No se pudo obtener historial del operario", histErr);
                }

                finalY += 25;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Atentamente,', 20, finalY);
                doc.setFont('helvetica', 'bold');
                doc.text('Jefatura de Produccion', 20, finalY + 7);
                doc.text('Aleph Impresores S.A.S', 20, finalY + 14);

                const pdfBase64 = doc.output('datauristring').split(',')[1];
                const cleanName = opData.operario.replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `Carta_${cleanName}.pdf`;
                folder.file(filename, pdfBase64, { base64: true });

                count++;
            }

            setStatusText('Comprimiendo archivos...');
            const zipBase64 = await zip.generateAsync({ type: 'base64' });

            setStatusText('Guardando ZIP...');
            const filename = `Cartas_${getMesNombre(mes)}_${anio}.zip`;

            if (Platform.OS === 'web') {
                const uri = `data:application/zip;base64,${zipBase64}`;
                const link = document.createElement('a');
                link.href = uri;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setLoading(false);
            } else {
                const fileUri = FileSystem.documentDirectory + filename;
                await FileSystem.writeAsStringAsync(fileUri, zipBase64, { encoding: 'base64' });

                setLoading(false);

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri);
                } else {
                    Alert.alert('Exito', `Cartas generadas guardadas en: ${fileUri}`);
                }
            }

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Hubo un error al generar las cartas: ' + error.message);
            setLoading(false);
        }
    };

    // Helpers for selectors
    const getUniquePeriods = () => [...new Set(periodosDisponibles.map(p => p.anio))].sort((a, b) => b - a);
    const getMesesParaAnio = (anioSeleccionado) => periodosDisponibles.filter(p => p.anio === anioSeleccionado).sort((a, b) => b.mes - a.mes);


    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Generación de Cartas</Text>
                <Text style={styles.subHeader}>Avisos y Felicitaciones (ZIP)</Text>
            </View>

            {/* Top Navigation */}


            <View style={styles.card}>
                <Text style={styles.label}>Seleccione Período:</Text>

                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={styles.labelSm}>Año</Text>
                        {periodosDisponibles.length > 0 ? (
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={anio}
                                    onValueChange={(itemValue) => setAnio(parseInt(itemValue))}
                                    style={styles.picker}
                                >
                                    {getUniquePeriods().map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                                </Picker>
                            </View>
                        ) : <Text>Cargando...</Text>}
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.labelSm}>Mes</Text>
                        {periodosDisponibles.length > 0 ? (
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={mes}
                                    onValueChange={(itemValue) => setMes(parseInt(itemValue))}
                                    style={styles.picker}
                                >
                                    {(getMesesParaAnio(anio)).map(p => (
                                        <Picker.Item key={p.mes} label={getMesNombre(p.mes)} value={p.mes} />
                                    ))}
                                </Picker>
                            </View>
                        ) : <Text>...</Text>}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled]}
                    onPress={generarCartas}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>💾 Generar y Descargar ZIP</Text>}
                </TouchableOpacity>

                {loading && <Text style={styles.status}>{statusText}</Text>}
            </View>

            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>¿Qué genera esto?</Text>
                <Text style={styles.infoText}>• Un archivo comprimido (.ZIP) con todas las cartas individuales.</Text>
                <Text style={styles.infoText}>• Cartas en <Text style={{ color: 'green', fontWeight: 'bold' }}>VERDE</Text>: Felicitación + Bono.</Text>
                <Text style={styles.infoText}>• Cartas en <Text style={{ color: 'red', fontWeight: 'bold' }}>ROJO</Text>: Invitación a mejorar.</Text>
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
    headerContainer: { marginBottom: 30, alignItems: 'center' },
    header: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    subHeader: { fontSize: 16, color: '#666' },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    label: { fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
    labelSm: { fontSize: 14, color: '#666', marginBottom: 5 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    col: { flex: 0.48 },
    select: { width: '100%', padding: 10, fontSize: 16, borderColor: '#ccc', borderWidth: 1, borderRadius: 5 },
    btn: { backgroundColor: '#007bff', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    btnDisabled: { backgroundColor: '#ccc' },
    btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    status: { textAlign: 'center', marginTop: 15, color: '#007bff' },
    infoBox: { marginTop: 30, padding: 15, backgroundColor: '#e9ecef', borderRadius: 8 },
    infoTitle: { fontWeight: 'bold', marginBottom: 10 },
    infoText: { marginBottom: 5, fontSize: 14 },
    // Nav Bar Styles
    navBar: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
    navButton: { padding: 8, marginHorizontal: 2, borderRadius: 5, backgroundColor: '#e0e0e0', marginBottom: 5 },
    navActive: { backgroundColor: '#007bff' },
    navText: { fontSize: 13, color: '#333' },
    navTextActive: { color: 'white', fontWeight: 'bold' },
    pickerContainer: {
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        backgroundColor: 'white',
        height: 50,
        justifyContent: 'center' // Center content vertically
    },
    picker: {
        width: '100%',
        height: 50
    }
});
