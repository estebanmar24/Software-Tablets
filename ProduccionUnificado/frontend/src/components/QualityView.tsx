import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Modal, Image, Alert, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { API_URL } from '../services/productionApi';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

const SERVER_URL = API_URL.replace('/api', '');

interface Novedad {
    id: number;
    tipoNovedad: string;
    observacion?: string;
    fotoUrl?: string;
    descripcion?: string;
    cantidadDefectuosa?: number;
}

interface EncuestaDetalle {
    id: number;
    fechaCreacion: string;
    operario: string; // Changed: backend sends string name
    auxiliar?: string; // Changed: backend sends string name
    maquina: string; // Changed: backend sends string name
    ordenProduccion: string;
    cantidadProducir: number;
    proceso: string;
    cantidadEvaluada: number;
    estadoProceso: string;
    tieneFichaTecnica: boolean;
    correctoRegistroFormatos: boolean;
    aprobacionArranque: boolean;
    observacion?: string;
    novedades: Novedad[];
}

interface EncuestaResumen {
    id: number;
    fechaCreacion: string;
    operario: string;
    maquina: string;
    ordenProduccion: string;
    proceso: string;
    estadoProceso: string;
    totalNovedades: number;
    totalFotos: number;
    tiposNovedad: string[];
}

export default function QualityView() {
    const [loading, setLoading] = useState(false);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([]);
    const [selectedEncuesta, setSelectedEncuesta] = useState<EncuestaDetalle | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Estado para modal de imagen grande
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [enlargedImageUri, setEnlargedImageUri] = useState<string | null>(null);

    // Filter States
    const [filterDia, setFilterDia] = useState<number | null>(null);
    const [filterMaquina, setFilterMaquina] = useState<string | null>(null);
    const [filterDefecto, setFilterDefecto] = useState<string | null>(null);
    const [filterProceso, setFilterProceso] = useState<string | null>(null);
    const [filterEstado, setFilterEstado] = useState<string | null>(null);
    const [filterConNovedad, setFilterConNovedad] = useState<string | null>(null); // 'SI' | 'NO'


    const [generatingPdf, setGeneratingPdf] = useState(false);

    const openImageModal = (uri: string) => {
        setEnlargedImageUri(uri);
        setImageModalVisible(true);
    };

    const meses = [
        { id: 1, nombre: 'Enero' }, { id: 2, nombre: 'Febrero' }, { id: 3, nombre: 'Marzo' },
        { id: 4, nombre: 'Abril' }, { id: 5, nombre: 'Mayo' }, { id: 6, nombre: 'Junio' },
        { id: 7, nombre: 'Julio' }, { id: 8, nombre: 'Agosto' }, { id: 9, nombre: 'Septiembre' },
        { id: 10, nombre: 'Octubre' }, { id: 11, nombre: 'Noviembre' }, { id: 12, nombre: 'Diciembre' }
    ];

    const anios = [2024, 2025, 2026];

    useEffect(() => {
        loadEncuestas();
    }, [mes, anio]);

    const loadEncuestas = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/calidad/encuestas?mes=${mes}&anio=${anio}`);
            setEncuestas(response.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar las encuestas de calidad');
        } finally {
            setLoading(false);
        }
    };

    const openDetalle = async (id: number) => {
        setLoadingDetail(true);
        setSelectedEncuesta(null);
        setModalVisible(true);
        try {
            const response = await axios.get(`${API_URL}/calidad/encuestas/${id}`);
            setSelectedEncuesta(response.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo cargar el detalle de la encuesta');
            setModalVisible(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    // --- FILTER & CALCULATIONS ---
    const filteredData = useMemo(() => {
        let data = encuestas;

        if (filterDia) {
            data = data.filter(e => {
                const day = new Date(e.fechaCreacion).getDate();
                return day === filterDia;
            });
        }

        if (filterMaquina) {
            data = data.filter(e => e.maquina === filterMaquina);
        }

        if (filterDefecto) {
            data = data.filter(e => e.tiposNovedad && e.tiposNovedad.includes(filterDefecto));
        }

        if (filterProceso) {
            data = data.filter(e => e.proceso === filterProceso);
        }

        if (filterEstado) {
            data = data.filter(e => e.estadoProceso === filterEstado);
        }

        if (filterConNovedad) {
            if (filterConNovedad === 'SI') {
                data = data.filter(e => e.totalNovedades > 0);
            } else {
                data = data.filter(e => e.totalNovedades === 0);
            }
        }

        return data;
    }, [encuestas, filterDia, filterMaquina, filterDefecto, filterProceso, filterEstado, filterConNovedad]);

    // Unique Options for Filters (Cascading/Interdependent)
    const uniqueOptions = useMemo(() => {
        const matchesDefect = (e: EncuestaResumen, def: string | null) => !def || (e.tiposNovedad && e.tiposNovedad.includes(def));
        const matchesDia = (e: EncuestaResumen, d: number | null) => !d || new Date(e.fechaCreacion).getDate() === d;
        const matchesMaquina = (e: EncuestaResumen, m: string | null) => !m || e.maquina === m;
        const matchesProceso = (e: EncuestaResumen, p: string | null) => !p || e.proceso === p;
        const matchesEstado = (e: EncuestaResumen, st: string | null) => !st || e.estadoProceso === st;
        const matchesNovedad = (e: EncuestaResumen, nov: string | null) => {
            if (!nov) return true;
            return nov === 'SI' ? e.totalNovedades > 0 : e.totalNovedades === 0;
        };

        const filterBase = (exclude: 'dia' | 'maquina' | 'defecto' | 'proceso' | 'estado' | 'conNovedad') => {
            return encuestas.filter(e =>
                (exclude === 'dia' || matchesDia(e, filterDia)) &&
                (exclude === 'maquina' || matchesMaquina(e, filterMaquina)) &&
                (exclude === 'defecto' || matchesDefect(e, filterDefecto)) &&
                (exclude === 'proceso' || matchesProceso(e, filterProceso)) &&
                (exclude === 'estado' || matchesEstado(e, filterEstado)) &&
                (exclude === 'conNovedad' || matchesNovedad(e, filterConNovedad))
            );
        };

        const dias = [...new Set(filterBase('dia').map(e => new Date(e.fechaCreacion).getDate()))].sort((a, b) => a - b);
        const maquinas = [...new Set(filterBase('maquina').map(e => e.maquina))].sort();
        const defectos = [...new Set(filterBase('defecto').flatMap(e => e.tiposNovedad || []))].sort();
        const procesos = [...new Set(filterBase('proceso').map(e => e.proceso))].sort();
        const estados = [...new Set(filterBase('estado').map(e => e.estadoProceso))].sort();

        return { dias, maquinas, defectos, procesos, estados };
    }, [encuestas, filterDia, filterMaquina, filterDefecto, filterProceso, filterEstado, filterConNovedad]);

    // --- DASHBOARD CALCULATIONS (Based on Filtered Data) ---
    const stats = useMemo(() => {
        const total = filteredData.length;
        if (total === 0) return null;

        const withDefects = filteredData.filter(e => e.totalNovedades > 0).length;
        const clean = total - withDefects;
        const defectRate = ((withDefects / total) * 100).toFixed(1);
        const cleanRate = ((clean / total) * 100).toFixed(1);

        // Top Defects
        const defectCounts: Record<string, number> = {};
        filteredData.forEach(e => {
            if (e.tiposNovedad && e.tiposNovedad.length > 0) {
                e.tiposNovedad.forEach(type => {
                    defectCounts[type] = (defectCounts[type] || 0) + 1;
                });
            }
        });

        const topDefects = Object.entries(defectCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Machine Breakdown
        const machineStats: Record<string, { total: number, defects: number }> = {};
        filteredData.forEach(e => {
            if (!machineStats[e.maquina]) {
                machineStats[e.maquina] = { total: 0, defects: 0 };
            }
            machineStats[e.maquina].total++;
            if (e.totalNovedades > 0) {
                machineStats[e.maquina].defects++;
            }
        });

        const machineList = Object.entries(machineStats)
            .map(([name, stat]) => ({
                name,
                total: stat.total,
                defects: stat.defects,
                rate: ((stat.defects / stat.total) * 100).toFixed(0)
            }))
            .sort((a, b) => parseInt(b.rate) - parseInt(a.rate));

        return {
            total,
            withDefects,
            clean,
            defectRate,
            cleanRate,
            topDefects,
            machineList
        };
    }, [filteredData]);

    // --- PDF GENERATION ---
    const getBase64FromUrl = async (url: string) => {
        if (!url) return null;
        try {
            if (Platform.OS === 'web') {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } else {
                // Mobile
                const cachedFile = (FileSystem as any).cacheDirectory + 'photo_' + url.split('/').pop();
                await FileSystem.downloadAsync(url, cachedFile);
                const base64 = await FileSystem.readAsStringAsync(cachedFile, { encoding: 'base64' });
                return `data:image/jpeg;base64,${base64}`;
            }
        } catch (error: any) {
            console.warn('Error loading image', url, error);
            return null;
        }
    };

    const generatePDF = async () => {
        if (filteredData.length === 0) {
            Alert.alert('Sin datos', 'No hay datos para generar el reporte con los filtros actuales.');
            return;
        }

        setGeneratingPdf(true);
        try {
            // Dynamic import for jsPDF
            const { jsPDF } = require('jspdf');
            // const autoTable = require('jspdf-autotable').default; // Not used in detailed view anymore, or maybe for summary?

            // Fetch Details for ALL filtered items
            const detailsPromises = filteredData.map(async (item) => {
                try {
                    const response = await axios.get(`${API_URL}/calidad/encuestas/${item.id}`);
                    return response.data;
                } catch (e: any) {
                    console.error("Error fetching detail for ID", item.id, e);
                    return null;
                }
            });

            // Wait for all details
            const fullDetails = (await Promise.all(detailsPromises)).filter(d => d !== null);

            const doc = new jsPDF();
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();
            let y = 15; // Start Y

            // Helper: Header
            const drawHeader = async () => {
                // Logo
                try {
                    const asset = Asset.fromModule(require('../../assets/LOGO_ALEPH_IMPRESORES.jpg'));
                    await asset.downloadAsync();
                    let logoData = null;
                    if (Platform.OS === 'web') {
                        logoData = asset.uri;
                    } else {
                        const base64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, { encoding: 'base64' });
                        logoData = `data:image/jpeg;base64,${base64}`;
                    }
                    doc.addImage(logoData, 'JPEG', 15, 10, 50, 20);
                } catch (e: any) { console.warn("Logo error", e); }

                doc.setFontSize(16);
                doc.setTextColor(0, 51, 102);
                doc.text('ALEPH IMPRESORES S.A.S.', width - 15, 20, { align: 'right' });
                doc.setFontSize(14);
                doc.setTextColor(51, 51, 51);
                doc.text('REPORTE DETALLADO DE CALIDAD', width - 15, 28, { align: 'right' });
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Generado: ${new Date().toLocaleString()}`, width - 15, 34, { align: 'right' });

                // Filters
                doc.setFontSize(10);
                doc.setTextColor(0);
                let filterText = `Periodo: ${meses.find(m => m.id === Number(mes))?.nombre || mes}/${anio}`;
                if (filterDia) filterText += ` | Día: ${filterDia}`;
                if (filterMaquina) filterText += ` | Máq: ${filterMaquina}`;
                if (filterProceso) filterText += ` | Proc: ${filterProceso}`;
                if (filterEstado) filterText += ` | Est: ${filterEstado}`;
                if (filterConNovedad) filterText += ` | ${filterConNovedad === 'SI' ? 'Con Defectos' : 'Sin Defectos'}`;
                if (filterDefecto) filterText += ` | Def: ${filterDefecto}`;

                doc.text(filterText, 15, 45);

                return 55; // Next Y
            };

            y = await drawHeader();

            // Summary Stats Boxes
            if (stats) {
                const boxWidth = (width - 40) / 3;
                const boxHeight = 20;

                // Box 1
                doc.setDrawColor(33, 150, 243); doc.setLineWidth(0.5); doc.rect(15, y, boxWidth, boxHeight);
                doc.setFontSize(10); doc.text('Total', 15 + boxWidth / 2, y + 6, { align: 'center' });
                doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text(stats.total.toString(), 15 + boxWidth / 2, y + 16, { align: 'center' });

                // Box 2
                doc.setDrawColor(76, 175, 80); doc.rect(15 + boxWidth + 5, y, boxWidth, boxHeight);
                doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text('OK', 15 + boxWidth + 5 + boxWidth / 2, y + 6, { align: 'center' });
                doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text(`${stats.clean}`, 15 + boxWidth + 5 + boxWidth / 2, y + 16, { align: 'center' });

                // Box 3
                doc.setDrawColor(244, 67, 54); doc.rect(15 + (boxWidth + 5) * 2, y, boxWidth, boxHeight);
                doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text('Defectos', 15 + (boxWidth + 5) * 2 + boxWidth / 2, y + 6, { align: 'center' });
                doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text(`${stats.withDefects}`, 15 + (boxWidth + 5) * 2 + boxWidth / 2, y + 16, { align: 'center' });

                y += 30;
            }

            doc.setDrawColor(200);
            doc.line(15, y, width - 15, y); // Separator
            y += 10;

            // Iterate Items
            for (let i = 0; i < fullDetails.length; i++) {
                const item = fullDetails[i];

                // Check Page Break approximation (Header + Obs ~ 40pts + Photos?)
                // Conservative check: if Y > height - 60, break
                if (y > height - 60) {
                    doc.addPage();
                    y = 20;
                }

                // Item Header Background
                doc.setFillColor(245, 247, 250);
                doc.rect(15, y - 5, width - 30, 20, 'F');

                // Line 1: Date | Machine
                doc.setFontSize(11);
                doc.setTextColor(0, 51, 102); // Primary Color
                doc.setFont(undefined, 'bold');
                doc.text(`${new Date(item.fechaCreacion).toLocaleString()} - ${item.maquina}`, 20, y);

                // Line 2: Operator | OP | Process
                y += 6;
                doc.setFontSize(9);
                doc.setTextColor(50);
                doc.setFont(undefined, 'normal');
                doc.text(`Operario: ${item.operario} | OP: ${item.ordenProduccion} | Proc: ${item.proceso}`, 20, y);

                // Status Badge logic (Text)
                const isOK = item.totalNovedades === 0 || (item.novedades && item.novedades.length === 0);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(isOK ? 40 : 220, isOK ? 167 : 53, isOK ? 69 : 69); // Green or Red
                doc.text(isOK ? 'CALIDAD OK' : `CON DEFECTOS (${item.novedades.length})`, width - 20, y - 6, { align: 'right' }); // Top right of box

                y += 12;

                // OBSERVACIONES
                if (item.observacion) {
                    doc.setFontSize(9);
                    doc.setTextColor(0);
                    doc.setFont(undefined, 'bold');
                    doc.text('Observaciones:', 20, y);
                    doc.setFont(undefined, 'normal');
                    const splitObs = doc.splitTextToSize(item.observacion, width - 40);
                    doc.text(splitObs, 45, y);
                    y += (splitObs.length * 4) + 4;
                }

                // NOVEDADES (Defects)
                if (item.novedades && item.novedades.length > 0) {
                    doc.setFontSize(9);
                    doc.setTextColor(200, 0, 0); // Red title
                    doc.setFont(undefined, 'bold');
                    doc.text('Hallazgos:', 20, y);
                    y += 5;

                    for (const nov of item.novedades) {
                        if (y > height - 60) { doc.addPage(); y = 20; }

                        doc.setTextColor(0);
                        doc.setFont(undefined, 'bold');
                        doc.text(`• ${nov.tipoNovedad}`, 25, y);

                        // Desc with wrap
                        let descHeight = 0;
                        if (nov.descripcion) {
                            doc.setFont(undefined, 'normal');
                            const splitDesc = doc.splitTextToSize(`: ${nov.descripcion}`, width - 70);
                            doc.text(splitDesc, 60, y);
                            descHeight = splitDesc.length * 4;
                        }
                        y += Math.max(5, descHeight + 2);

                        // PHOTO
                        if (nov.fotoUrl) {
                            const imgUrl = nov.fotoUrl.startsWith('http') ? nov.fotoUrl : `${SERVER_URL}/${nov.fotoUrl}`;
                            const base64Img = await getBase64FromUrl(imgUrl);
                            if (base64Img) {
                                // Check space for image
                                if (y + 50 > height - 20) { doc.addPage(); y = 20; }

                                doc.addImage(base64Img, 'JPEG', 30, y, 60, 45); // Fixed size thumbnail
                                y += 50;
                            }
                        }
                    }
                } else {
                    // No detailed defects, but verified items
                    // Optional: List checks (Ficha tecnica, format, etc)
                    // For brevity, we skip unless requested.
                }

                y += 5;
                doc.setDrawColor(230);
                doc.line(15, y, width - 15, y); // Separator
                y += 10;
            }

            // 5. Save/Share
            const fileName = `Reporte_Calidad_${anio}_${mes}.pdf`;

            if (Platform.OS === 'web') {
                doc.save(fileName);
            } else {
                const fileUri = (FileSystem as any).documentDirectory + fileName;
                const pdfBase64 = doc.output('datauristring').split(',')[1];

                await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
                    encoding: 'base64',
                });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Reporte Calidad',
                        UTI: 'com.adobe.pdf'
                    });
                } else {
                    Alert.alert('Guardado', `PDF guardado en: ${fileUri}`);
                }
            }

        } catch (error: any) {
            console.error(error);
            Alert.alert('Error PDF', 'No se pudo generar el PDF: ' + error.message);
        } finally {
            setGeneratingPdf(false);
        }
    };


    const renderItem = ({ item }: { item: EncuestaResumen }) => (
        <TouchableOpacity style={styles.row} onPress={() => openDetalle(item.id)}>
            <Text style={[styles.cell, { flex: 1 }]}>{new Date(item.fechaCreacion).toLocaleDateString()} {new Date(item.fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={[styles.cell, { flex: 1.5 }]}>{item.operario}</Text>
            <Text style={[styles.cell, { flex: 1.5 }]}>{item.maquina}</Text>
            <Text style={[styles.cell, { flex: 0.8 }]}>{item.ordenProduccion}</Text>
            <Text style={[styles.cell, { flex: 1 }]}>{item.proceso}</Text>
            <Text style={[styles.cell, { flex: 0.8, color: item.estadoProceso === 'Terminado' ? 'green' : 'orange' }]}>{item.estadoProceso}</Text>
            <Text style={[styles.cell, { flex: 0.6, textAlign: 'center' }]}>
                {item.totalNovedades > 0 ? (
                    <Text style={{ color: 'red', fontWeight: 'bold' }}>{item.totalNovedades}</Text>
                ) : (
                    <Text style={{ color: 'green' }}>✓</Text>
                )}
            </Text>
            <Text style={[styles.cell, { flex: 0.5, textAlign: 'center' }]}>
                {item.totalFotos > 0 ? `📷 (${item.totalFotos})` : ''}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header Filters */}
            <View style={styles.header}>
                <View style={styles.filterGroup}>
                    <Text style={styles.label}>Mes:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={mes}
                            onValueChange={(itemValue) => setMes(itemValue)}
                            style={styles.picker}
                        >
                            {meses.map((m) => <Picker.Item key={m.id} label={m.nombre} value={m.id} />)}
                        </Picker>
                    </View>
                </View>
                <View style={styles.filterGroup}>
                    <Text style={styles.label}>Año:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={anio}
                            onValueChange={(itemValue) => setAnio(itemValue)}
                            style={styles.picker}
                        >
                            {anios.map((a) => <Picker.Item key={a} label={a.toString()} value={a} />)}
                        </Picker>
                    </View>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadEncuestas}>
                    <Text style={styles.refreshBtnText}>Actualizar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.refreshBtn, { backgroundColor: '#4CAF50', marginLeft: 10, opacity: generatingPdf ? 0.7 : 1 }]}
                    onPress={generatePDF}
                    disabled={generatingPdf}
                >
                    {generatingPdf ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.refreshBtnText}>📄 PDF</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* SECOND ROW FILTERS - GRID LAYOUT */}
            <View style={[styles.header, { marginTop: -5, flexWrap: 'wrap', flexDirection: 'row', gap: 10, paddingVertical: 10, alignItems: 'flex-end' }]}>

                {/* 1. DIA */}
                <View style={[styles.filterGroup, { flexGrow: 1, minWidth: 100 }]}>
                    <Text style={[styles.label, { fontSize: 11 }]}>Día:</Text>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                            selectedValue={filterDia}
                            onValueChange={(v) => setFilterDia(v ? Number(v) : null)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Todos" value="" />
                            {uniqueOptions.dias.map(d => (
                                <Picker.Item key={d} label={d.toString()} value={d} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* 2. MAQUINA */}
                <View style={[styles.filterGroup, { flexGrow: 1, minWidth: 160 }]}>
                    <Text style={[styles.label, { fontSize: 11 }]}>Máquina:</Text>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                            selectedValue={filterMaquina}
                            onValueChange={(v) => setFilterMaquina(v || null)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Todas" value="" />
                            {uniqueOptions.maquinas.map(m => (
                                <Picker.Item key={m} label={m} value={m} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* 3. PROCESO */}
                <View style={[styles.filterGroup, { flexGrow: 1, minWidth: 130 }]}>
                    <Text style={[styles.label, { fontSize: 11 }]}>Proceso:</Text>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                            selectedValue={filterProceso}
                            onValueChange={(v) => setFilterProceso(v || null)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Todos" value="" />
                            {uniqueOptions.procesos.map(p => (
                                <Picker.Item key={p} label={p} value={p} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* 4. ESTADO */}
                <View style={[styles.filterGroup, { flexGrow: 1, minWidth: 130 }]}>
                    <Text style={[styles.label, { fontSize: 11 }]}>Estado:</Text>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                            selectedValue={filterEstado}
                            onValueChange={(v) => setFilterEstado(v || null)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Todos" value="" />
                            {uniqueOptions.estados.map(s => (
                                <Picker.Item key={s} label={s} value={s} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* 5. TIPO HALLAZGO (Con/Sin) */}
                <View style={[styles.filterGroup, { flexGrow: 1, minWidth: 130 }]}>
                    <Text style={[styles.label, { fontSize: 11 }]}>Estatus:</Text>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                            selectedValue={filterConNovedad}
                            onValueChange={(v) => setFilterConNovedad(v || null)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Todos" value="" />
                            <Picker.Item label="Con Defectos" value="SI" />
                            <Picker.Item label="Calidad OK" value="NO" />
                        </Picker>
                    </View>
                </View>

                {/* 6. DEFECTO ESPECIFICO */}
                <View style={[styles.filterGroup, { flexGrow: 1, minWidth: 160 }]}>
                    <Text style={[styles.label, { fontSize: 11 }]}>Defecto:</Text>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                            selectedValue={filterDefecto}
                            onValueChange={(v) => setFilterDefecto(v || null)}
                            style={styles.picker}
                            enabled={filterConNovedad !== 'NO'} // Disable if filtering for Clean
                        >
                            <Picker.Item label="Cualquiera" value="" />
                            {uniqueOptions.defectos.map(d => (
                                <Picker.Item key={d} label={d.slice(0, 20)} value={d} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* RESET BUTTON */}
                {(filterDia || filterMaquina || filterProceso || filterEstado || filterDefecto || filterConNovedad) && (
                    <TouchableOpacity
                        style={[styles.refreshBtn, { backgroundColor: '#F44336', minWidth: 40, justifyContent: 'center', alignItems: 'center' }]}
                        onPress={() => {
                            setFilterDia(null);
                            setFilterMaquina(null);
                            setFilterDefecto(null);
                            setFilterProceso(null);
                            setFilterEstado(null);
                            setFilterConNovedad(null);
                        }}
                    >
                        <Text style={styles.refreshBtnText}>X</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />}

            {!loading && (
                <View style={{ flex: 1 }}>
                    {/* Dashboard Section */}
                    <View style={{ height: 250 }}>
                        <ScrollView style={styles.dashboardContainer} contentContainerStyle={{ paddingBottom: 20 }}>
                            {stats ? (
                                <>
                                    {/* Main Cards */}
                                    <View style={styles.cardsRow}>
                                        <View style={[styles.card, { borderLeftColor: '#2196F3' }]}>
                                            <Text style={styles.cardUnic}>Total</Text>
                                            <Text style={styles.cardValue}>{stats.total}</Text>
                                        </View>
                                        <View style={[styles.card, { borderLeftColor: '#4CAF50' }]}>
                                            <Text style={styles.cardUnic}>Calidad OK</Text>
                                            <Text style={styles.cardValue}>{stats.clean}</Text>
                                            <Text style={styles.cardSub}>{stats.cleanRate}%</Text>
                                        </View>
                                        <View style={[styles.card, { borderLeftColor: '#F44336' }]}>
                                            <Text style={styles.cardUnic}>Con Defectos</Text>
                                            <Text style={styles.cardValue}>{stats.withDefects}</Text>
                                            <Text style={styles.cardSub}>{stats.defectRate}%</Text>
                                        </View>
                                    </View>

                                    <View style={styles.chartsRow}>
                                        {/* Top Defects */}
                                        <View style={styles.chartCard}>
                                            <Text style={styles.chartTitle}>Top 5 Defectos Recurrentes</Text>
                                            {stats.topDefects.length > 0 ? (
                                                stats.topDefects.map((d, i) => (
                                                    <View key={i} style={styles.chartItem}>
                                                        <Text style={styles.chartLabel}>{i + 1}. {d.name}</Text>
                                                        <View style={styles.barContainer}>
                                                            <View style={[styles.barFill, { width: `${Math.min((d.count / stats.withDefects) * 100, 100)}%` }]} />
                                                        </View>
                                                        <Text style={styles.chartCount}>{d.count}</Text>
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.noDataText}>No hay defectos reportados</Text>
                                            )}
                                        </View>

                                        {/* Machine Breakdown */}
                                        <View style={styles.chartCard}>
                                            <Text style={styles.chartTitle}>Calidad por Máquina</Text>
                                            <View style={styles.tableHeader}>
                                                <Text style={[styles.th, { flex: 2 }]}>Máquina</Text>
                                                <Text style={styles.th}>Total</Text>
                                                <Text style={styles.th}>Fallos</Text>
                                            </View>
                                            {stats.machineList.slice(0, 5).map((m, i) => (
                                                <View key={i} style={styles.tableRow}>
                                                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{m.name}</Text>
                                                    <Text style={styles.td}>{m.total}</Text>
                                                    <View style={[styles.badge, { backgroundColor: parseInt(m.rate) > 20 ? '#ffebee' : '#e8f5e9' }]}>
                                                        <Text style={{ color: parseInt(m.rate) > 20 ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
                                                            {m.defects > 0 ? `${m.defects}` : '-'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <Text style={styles.emptyText}>Selecciona fechas para ver el dashboard.</Text>
                            )}
                        </ScrollView>
                    </View>

                    {/* Detailed List Header - Sticky */}
                    <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cellHeader, { flex: 1 }]}>Fecha</Text>
                        <Text style={[styles.cellHeader, { flex: 1.5 }]}>Operario</Text>
                        <Text style={[styles.cellHeader, { flex: 1.5 }]}>Máquina</Text>
                        <Text style={[styles.cellHeader, { flex: 0.8 }]}>OP</Text>
                        <Text style={[styles.cellHeader, { flex: 1 }]}>Proceso</Text>
                        <Text style={[styles.cellHeader, { flex: 0.8 }]}>Estado</Text>
                        <Text style={[styles.cellHeader, { flex: 0.6 }]}>Nov.</Text>
                        <Text style={[styles.cellHeader, { flex: 0.5 }]}>Foto</Text>
                    </View>


                    <FlatList
                        data={filteredData}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron datos con estos filtros.</Text>}
                    />
                </View>
            )}

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detalle de Encuesta</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>X</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingDetail || !selectedEncuesta ? (
                            <ActivityIndicator size="large" color="#0000ff" style={{ margin: 20 }} />
                        ) : (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailLabel}>Información General:</Text>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Fecha:</Text>
                                        <Text style={styles.detailValue}>{new Date(selectedEncuesta.fechaCreacion).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Operario:</Text>
                                        <Text style={styles.detailValue}>{selectedEncuesta.operario}</Text>
                                    </View>
                                    {selectedEncuesta.auxiliar && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailKey}>Auxiliar:</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.auxiliar}</Text>
                                        </View>
                                    )}
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Máquina:</Text>
                                        <Text style={styles.detailValue}>{selectedEncuesta.maquina}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Orden Producción:</Text>
                                        <Text style={styles.detailValue}>{selectedEncuesta.ordenProduccion}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Cantidad a Producir:</Text>
                                        <Text style={styles.detailValue}>{selectedEncuesta.cantidadProducir}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Proceso:</Text>
                                        <Text style={styles.detailValue}>{selectedEncuesta.proceso}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Cantidad Evaluada:</Text>
                                        <Text style={styles.detailValue}>{selectedEncuesta.cantidadEvaluada}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Estado:</Text>
                                        <Text style={[styles.detailValue, { fontWeight: 'bold', color: selectedEncuesta.estadoProceso === 'Terminado' ? 'green' : '#F59E0B' }]}>
                                            {selectedEncuesta.estadoProceso}
                                        </Text>
                                    </View>

                                    <Text style={[styles.detailLabel, { marginTop: 15 }]}>Verificación:</Text>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Ficha Técnica:</Text>
                                        <Text style={[styles.detailValue, { color: selectedEncuesta.tieneFichaTecnica ? 'green' : 'red', fontWeight: 'bold' }]}>
                                            {selectedEncuesta.tieneFichaTecnica ? 'SÍ CUMPLE' : 'NO CUMPLE'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Formatos:</Text>
                                        <Text style={[styles.detailValue, { color: selectedEncuesta.correctoRegistroFormatos ? 'green' : 'red', fontWeight: 'bold' }]}>
                                            {selectedEncuesta.correctoRegistroFormatos ? 'SÍ CUMPLE' : 'NO CUMPLE'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailKey}>Aprobación:</Text>
                                        <Text style={[styles.detailValue, { color: selectedEncuesta.aprobacionArranque ? 'green' : 'red', fontWeight: 'bold' }]}>
                                            {selectedEncuesta.aprobacionArranque ? 'SÍ CUMPLE' : 'NO CUMPLE'}
                                        </Text>
                                    </View>

                                    {selectedEncuesta.observacion ? (
                                        <View style={{ marginTop: 10, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 4, width: '100%' }}>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 4, color: '#92400E' }}>Observaciones:</Text>
                                            <Text style={{ fontStyle: 'italic', color: '#B45309' }}>{selectedEncuesta.observacion}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                <Text style={[styles.detailLabel, { marginTop: 15 }]}>Novedades y Hallazgos:</Text>
                                {selectedEncuesta.novedades && selectedEncuesta.novedades.length > 0 ? (
                                    selectedEncuesta.novedades.map((nov, index) => (
                                        <View key={index} style={styles.noveltyCard}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={styles.noveltyTitle}>{nov.tipoNovedad}</Text>
                                                {nov.cantidadDefectuosa ? (
                                                    <View style={{ backgroundColor: '#FFE4E6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                        <Text style={{ color: '#BE123C', fontSize: 12, fontWeight: 'bold' }}>Cant: {nov.cantidadDefectuosa}</Text>
                                                    </View>
                                                ) : null}
                                            </View>

                                            {nov.descripcion ? <Text style={styles.noveltyText}>{nov.descripcion}</Text> : null}

                                            {nov.fotoUrl ? (
                                                <TouchableOpacity
                                                    onPress={() => openImageModal(nov.fotoUrl!.startsWith('http') ? nov.fotoUrl! : `${SERVER_URL}/${nov.fotoUrl}`)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Image
                                                        source={{ uri: nov.fotoUrl.startsWith('http') ? nov.fotoUrl : `${SERVER_URL}/${nov.fotoUrl}` }}
                                                        style={styles.noveltyImage}
                                                        resizeMode="contain"
                                                    />
                                                    <Text style={styles.clickToEnlarge}>🔍 Click para ampliar</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.noNoveltyText}>Sin novedades registradas.</Text>
                                )}
                            </ScrollView>
                        )}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeModalBtnText}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal para imagen ampliada */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={imageModalVisible}
                onRequestClose={() => setImageModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.imageModalOverlay}
                    activeOpacity={1}
                    onPress={() => setImageModalVisible(false)}
                >
                    <View style={styles.imageModalContent}>
                        {enlargedImageUri && (
                            <Image
                                source={{ uri: enlargedImageUri }}
                                style={styles.enlargedImage}
                                resizeMode="contain"
                            />
                        )}
                        <TouchableOpacity
                            style={styles.closeImageBtn}
                            onPress={() => setImageModalVisible(false)}
                        >
                            <Text style={styles.closeImageBtnText}>✕ Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        elevation: 2,
    },
    headerLogo: {
        width: 140,
        height: 70,
        position: 'absolute',
        top: -10,
        right: 15,
    },
    filterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    label: {
        fontWeight: 'bold',
        marginRight: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        width: 150,
        backgroundColor: '#fff',
    },
    picker: {
        height: 40,
        width: '100%',
    },
    refreshBtn: {
        backgroundColor: '#2196F3',
        padding: 10,
        borderRadius: 4,
        marginLeft: 'auto',
    },
    refreshBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    // Dashboard Styles
    dashboardContainer: {
        marginBottom: 10,
    },
    cardsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 5,
        elevation: 2,
        borderLeftWidth: 5,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardUnic: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginBottom: 5,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    cardSub: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    chartsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    chartCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 5,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
        textAlign: 'center'
    },
    chartItem: {
        marginBottom: 10,
    },
    chartLabel: {
        fontSize: 13,
        color: '#555',
        marginBottom: 2,
    },
    barContainer: {
        height: 8,
        backgroundColor: '#eee',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#FF7043',
    },
    chartCount: {
        position: 'absolute',
        right: 0,
        top: 0,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    noDataText: {
        textAlign: 'center',
        padding: 20,
        color: '#aaa',
        fontStyle: 'italic',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 5,
        marginBottom: 5,
    },
    th: {
        flex: 1,
        fontWeight: 'bold',
        fontSize: 12,
        color: '#666',
        textAlign: 'center'
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        alignItems: 'center'
    },
    td: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
        color: '#333'
    },
    badge: {
        flex: 1,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 50,
        alignSelf: 'center'
    },
    // List Styles
    row: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    headerRow: {
        backgroundColor: '#e0e0e0',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    cell: {
        fontSize: 14,
        paddingHorizontal: 5,
    },
    cellHeader: {
        fontWeight: 'bold',
        fontSize: 14,
        paddingHorizontal: 5,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
        color: '#666',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        height: '80%',
        backgroundColor: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: '#f0f0f0',
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
    },
    modalBody: {
        padding: 20,
    },
    detailSection: {
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#f9f9f9',
        borderRadius: 5,
    },
    detailLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 2,
    },
    detailKey: {
        fontWeight: 'bold',
        width: 150,
        color: '#555',
    },
    detailValue: {
        flex: 1,
        color: '#333',
    },
    noveltyCard: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    noveltyTitle: {
        fontWeight: 'bold',
        fontSize: 15,
        color: '#333',
    },
    noveltyText: {
        fontStyle: 'italic',
        color: '#555',
        marginVertical: 5,
    },
    noveltyImage: {
        width: '100%',
        height: 200,
        marginTop: 10,
        borderRadius: 5,
        backgroundColor: '#eee'
    },
    noNoveltyText: {
        fontStyle: 'italic',
        color: '#888',
        textAlign: 'center',
        marginTop: 10,
    },
    modalFooter: {
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        alignItems: 'flex-end',
    },
    closeModalBtn: {
        backgroundColor: '#666',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    closeModalBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    clickToEnlarge: {
        textAlign: 'center',
        fontSize: 12,
        color: '#2196F3',
        marginTop: 5,
        fontStyle: 'italic',
    },
    imageModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageModalContent: {
        width: '95%',
        height: '90%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    enlargedImage: {
        width: '100%',
        height: '85%',
    },
    closeImageBtn: {
        marginTop: 20,
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
    },
    closeImageBtnText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
