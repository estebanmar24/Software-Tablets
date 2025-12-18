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
                    metaBonificacion: op.metaBonificacion,
                    totalTiros: op.totalTiros,
                    totalHorasProductivas: op.totalHorasProductivas,
                    promedioHoraProductiva: op.promedioHoraProductiva,
                    valorAPagar: op.valorAPagar,
                    eficiencia: op.eficiencia,
                    semaforoColor: op.semaforoColor
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
                const totalValorPagar = opData.maquinas.reduce((sum, m) => sum + (m.valorAPagar || 0), 0);

                // Contar máquinas en verde y rojo
                const maquinasVerdes = opData.maquinas.filter(m => (m.semaforoColor || '').toLowerCase().includes('verde'));
                const maquinasRojas = opData.maquinas.filter(m => (m.semaforoColor || '').toLowerCase().includes('rojo'));

                // Carta mixta para TODOS los operarios
                doc.setTextColor(0, 51, 102); // Azul oscuro
                doc.setFont('helvetica', 'bold');
                doc.text('RESUMEN DE DESEMPENO MENSUAL', pageWidth / 2, 68, { align: 'center' });
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);

                // Mensaje personalizado basado en el desempeño
                let mensaje = '';
                if (maquinasVerdes.length === opData.maquinas.length) {
                    // Todas en verde
                    mensaje = 'Felicitaciones! Has alcanzado las metas en todas las maquinas asignadas. Sigue asi!';
                } else if (maquinasRojas.length === opData.maquinas.length) {
                    // Todas en rojo
                    mensaje = 'Te invitamos a revisar tu desempeno para alcanzar las metas establecidas. Contamos con tu esfuerzo.';
                } else {
                    // Mixto
                    mensaje = `Destacamos tu buen desempeno en ${maquinasVerdes.length} maquina(s). Te invitamos a mejorar en las demas para alcanzar todas las metas.`;
                }
                doc.text(mensaje, 20, 78);

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('Resumen de Desempeno por Maquina:', 20, 90);

                const tableData = opData.maquinas.map(m => [
                    m.maquina,
                    m.diasLaborados?.toString() || '0',
                    m.metaBonificacion?.toFixed(0) || '0',
                    m.totalTiros?.toString() || '0',
                    m.totalHorasProductivas?.toFixed(2) || '0',
                    m.promedioHoraProductiva?.toFixed(0) || '0',
                    `$${(m.valorAPagar || 0).toLocaleString()}`,
                    m.semaforoColor || 'Gris'
                ]);

                const setSemaforoColor = (data) => {
                    const text = data.cell.raw;
                    if (!text) return;
                    const lowerText = text.toString().toLowerCase();
                    if (lowerText.includes('rojo')) {
                        data.cell.styles.fillColor = [255, 204, 204];
                        data.cell.text = '';
                    } else if (lowerText.includes('verde')) {
                        data.cell.styles.fillColor = [204, 255, 204];
                        data.cell.text = '';
                    }
                };

                autoTable(doc, {
                    startY: 95,
                    head: [['Maquina', 'Dias', 'Meta', 'Tiros', 'H.Prod', 'Prom/H', 'Valor', 'Sem']],
                    body: tableData,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [66, 139, 202], textColor: 255, fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: 40 },
                        1: { cellWidth: 15, halign: 'center' },
                        2: { cellWidth: 22, halign: 'right' },
                        3: { cellWidth: 22, halign: 'right' },
                        4: { cellWidth: 18, halign: 'right' },
                        5: { cellWidth: 18, halign: 'right' },
                        6: { cellWidth: 25, halign: 'right' },
                        7: { cellWidth: 15, halign: 'center' }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.column.index === 7) {
                            setSemaforoColor(data);
                        }
                    }
                });

                let finalY = doc.lastAutoTable.finalY + 10;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Total Tiros: ${totalTirosGlobal.toLocaleString()}`, 20, finalY);

                if (totalValorPagar > 0) {
                    finalY += 10;
                    doc.setFontSize(14);
                    doc.setTextColor(0, 100, 0);
                    doc.text(`BONIFICACION TOTAL A PAGAR: $${totalValorPagar.toLocaleString()}`, pageWidth / 2, finalY, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
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
