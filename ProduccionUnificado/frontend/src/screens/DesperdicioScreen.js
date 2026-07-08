import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, Alert, ScrollView, Platform, ActivityIndicator, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFileServerUrl } from '../services/apiConfig';
import api from '../services/apiClient';

/** Renderiza un gráfico Chart.js en canvas oculto y devuelve base64 PNG (solo web). */
const renderWebChartToBase64 = async (chartConfig, width = 900, height = 400) => {
    if (typeof document === 'undefined') return null;
    const [{ Chart, registerables }, { default: ChartDataLabels }] = await Promise.all([
        import('chart.js'),
        import('chartjs-plugin-datalabels'),
    ]);
    Chart.register(...registerables, ChartDataLabels);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'fixed';
    canvas.style.left = '-9999px';
    document.body.appendChild(canvas);

    const chart = new Chart(canvas.getContext('2d'), {
        ...chartConfig,
        options: {
            ...chartConfig.options,
            responsive: false,
            animation: false,
            maintainAspectRatio: false,
        },
    });

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const base64 = canvas.toDataURL('image/png');
    chart.destroy();
    document.body.removeChild(canvas);
    return base64;
};

export default function DesperdicioScreen({ navigation, registradoPorNombre = '' }) {
    const { colors } = useTheme();
    // Estados principales
    const [maquinas, setMaquinas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [registros, setRegistros] = useState([]);
    const [relaciones, setRelaciones] = useState([]); // [{ maquinaId, usuarioId }]
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [generatingTracePdf, setGeneratingTracePdf] = useState(false);

    const logoSource = colors.alephLogo;

    // Filtros
    const [selectedMaquina, setSelectedMaquina] = useState('');
    const [selectedFecha, setSelectedFecha] = useState(null);
    const [selectedUsuario, setSelectedUsuario] = useState('');
    const [selectedCodigo, setSelectedCodigo] = useState('');
    const [selectedOP, setSelectedOP] = useState('');
    const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1); // 1-12, default current month
    const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());
    const [pdfMode, setPdfMode] = useState('normal'); // normal | detallado
    const [serverUrl, setServerUrl] = useState('');

    useEffect(() => {
        const initUrls = async () => {
            const sUrl = await getFileServerUrl();
            setServerUrl(sUrl);
        };
        initUrls();
    }, []);

    // Modales
    const [modalConfigVisible, setModalConfigVisible] = useState(false);
    const [modalRegistroVisible, setModalRegistroVisible] = useState(false);

    // Estado para nuevo registro (encabezado: máquina, operario, fecha)
    const emptyCodigoItem = { codigoDesperdicioId: '', cantidad: '', ordenProduccion: '', nota: '' };
    const [newRegistro, setNewRegistro] = useState({
        id: null,
        maquinaId: '',
        usuarioId: '',
        esTallerExterno: false,
        fecha: new Date(),
    });
    // Lista de entradas de código (múltiples por guardado)
    const [codigoItems, setCodigoItems] = useState([{ ...emptyCodigoItem }]);

    // Estado para gestión de códigos
    const [newCodigo, setNewCodigo] = useState({ codigo: '', descripcion: '', activo: true });
    const [editingCodigoId, setEditingCodigoId] = useState(null);

    useEffect(() => {
        loadInitialData();
        loadRegistros(); // Cargar registros del día al inicio
    }, []);

    useEffect(() => {
        // Recargar si cambian filtros
        loadRegistros();
    }, [selectedMaquina, selectedFecha, selectedUsuario, selectedOP, selectedCodigo, selectedMes, selectedAnio]);

    const loadInitialData = async () => {
        try {
            // Intentar inicializar DB por si faltan tablas (Hack para error 500)
            await api.get(`desperdicio/init`).catch(e => console.log("Init OK/Skip"));

            const [resMaq, resUsu, resCod, resRel] = await Promise.all([
                api.get(`maquinas`),
                api.get(`usuarios`),
                api.get(`desperdicio/codigos`),
                api.get(`desperdicio/relaciones`)
            ]);

            setMaquinas(resMaq.data);
            setUsuarios(resUsu.data);
            setCodigos(resCod.data);
            setRelaciones(resRel.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error cargando datos iniciales');
        }
    };

    const loadRegistros = async () => {
        // Permitir carga sin máquina (trae todos los del día)
        setLoading(true);
        try {
            let path = `desperdicio?`;

            // If a specific date is selected, use it; otherwise use mes/anio
            if (selectedFecha) {
                const year = selectedFecha.getFullYear();
                const month = String(selectedFecha.getMonth() + 1).padStart(2, '0');
                const day = String(selectedFecha.getDate()).padStart(2, '0');
                path += `fecha=${year}-${month}-${day}&`;
            } else if (selectedMes && selectedAnio) {
                path += `mes=${selectedMes}&anio=${selectedAnio}&`;
            }

            if (selectedMaquina) path += `maquinaId=${selectedMaquina}&`;
            if (selectedUsuario) path += `usuarioId=${selectedUsuario}&`;
            if (selectedCodigo) path += `codigoDesperdicioId=${selectedCodigo}&`;
            if (selectedOP) path += `ordenProduccion=${selectedOP}&`;

            const res = await api.get(path);
            setRegistros(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const nombreQuienRegistra = () => {
        const desdeProp = (registradoPorNombre || '').trim();
        if (desdeProp) return desdeProp;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            const ls = window.localStorage.getItem('adminName');
            if (ls?.trim()) return ls.trim();
        }
        return 'Administración';
    };

    const handleSaveRegistro = async () => {
        if (!newRegistro.esTallerExterno && (!newRegistro.maquinaId || !newRegistro.usuarioId)) {
            Alert.alert('Error', 'Máquina y Operario son obligatorios para uso general');
            return;
        }
        if (isNaN(newRegistro.fecha.getTime())) {
            Alert.alert('Error', 'Fecha inválida');
            return;
        }
        // Validate all code items
        const validItems = codigoItems.filter(item => item.cantidad && !isNaN(parseFloat(item.cantidad)) && parseFloat(item.cantidad) > 0);
        if (validItems.length === 0) {
            Alert.alert('Error', 'Agrega al menos un código con cantidad válida');
            return;
        }

        const registradoPor = nombreQuienRegistra();

        try {
            if (newRegistro.id) {
                // MODO EDICIÓN:
                // 1. Actualizar el registro original con el primer ítem válido
                const firstItem = validItems[0];
                const body = {
                    id: newRegistro.id,
                    maquinaId: newRegistro.esTallerExterno ? null : parseInt(newRegistro.maquinaId),
                    usuarioId: newRegistro.esTallerExterno ? null : parseInt(newRegistro.usuarioId),
                    esTallerExterno: newRegistro.esTallerExterno,
                    ordenProduccion: firstItem.ordenProduccion,
                    codigoDesperdicioId: firstItem.codigoDesperdicioId ? parseInt(firstItem.codigoDesperdicioId) : null,
                    cantidad: parseFloat(firstItem.cantidad),
                    fecha: newRegistro.fecha.toISOString(),
                    nota: firstItem.nota
                };
                await api.put(`desperdicio/${newRegistro.id}`, body);

                // 2. Si hay más ítems, crearlos como registros nuevos
                if (validItems.length > 1) {
                    for (let i = 1; i < validItems.length; i++) {
                        const item = validItems[i];
                        const newBody = {
                            maquinaId: newRegistro.esTallerExterno ? null : parseInt(newRegistro.maquinaId),
                            usuarioId: newRegistro.esTallerExterno ? null : parseInt(newRegistro.usuarioId),
                            esTallerExterno: newRegistro.esTallerExterno,
                            ordenProduccion: item.ordenProduccion,
                            codigoDesperdicioId: item.codigoDesperdicioId ? parseInt(item.codigoDesperdicioId) : null,
                            cantidad: parseFloat(item.cantidad),
                            fecha: newRegistro.fecha.toISOString(),
                            nota: item.nota,
                            registradoPor,
                        };
                        await api.post(`desperdicio`, newBody);
                    }
                }
            } else {
                // CREATE MODE: post each valid item as a separate record
                for (const item of validItems) {
                    const body = {
                        maquinaId: newRegistro.esTallerExterno ? null : parseInt(newRegistro.maquinaId),
                        usuarioId: newRegistro.esTallerExterno ? null : parseInt(newRegistro.usuarioId),
                        esTallerExterno: newRegistro.esTallerExterno,
                        ordenProduccion: item.ordenProduccion,
                        codigoDesperdicioId: item.codigoDesperdicioId ? parseInt(item.codigoDesperdicioId) : null,
                        cantidad: parseFloat(item.cantidad),
                        fecha: newRegistro.fecha.toISOString(),
                        nota: item.nota,
                        registradoPor,
                    };
                    const res = await api.post(`desperdicio`, body);
                    if (res.status !== 200 && res.status !== 201) {
                        Alert.alert('Error', `Error guardando código`);
                        return;
                    }
                }
            }

            Alert.alert('Éxito', newRegistro.id ? 'Desperdicio actualizado' : `${validItems.length} registro(s) guardado(s)`);
            setModalRegistroVisible(false);
            setSelectedFecha(newRegistro.fecha);
            loadRegistros();

            // Reset form
            setNewRegistro({ id: null, maquinaId: '', usuarioId: '', esTallerExterno: false, fecha: new Date() });
            setCodigoItems([{ ...emptyCodigoItem }]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error de conexión');
        }
    };

    const handleEditRegistro = (item) => {
        const date = new Date(item.fecha);
        setNewRegistro({
            id: item.id,
            maquinaId: item.maquinaId || '',
            usuarioId: item.usuarioId || '',
            esTallerExterno: item.esTallerExterno || false,
            fecha: date,
        });
        setCodigoItems([{
            codigoDesperdicioId: item.codigoDesperdicioId || '',
            cantidad: item.cantidad.toString(),
            ordenProduccion: item.ordenProduccion || '',
            nota: item.nota || ''
        }]);
        setModalRegistroVisible(true);
    };

    const handleDeleteRegistro = async (id) => {
        if (Platform.OS === 'web') {
            if (!confirm('¿Eliminar este registro?')) return;
        }
        try {
            const res = await api.delete(`desperdicio/${id}`);
            if (res.status === 200 || res.status === 204) loadRegistros();
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar');
        }
    };

    // Gestión de Códigos
    const handleSaveCodigo = async () => {
        if (!newCodigo.codigo) { // Descripción ahora es opcional
            Alert.alert('Error', 'El Código es obligatorio');
            return;
        }

        try {
            const url = editingCodigoId
                ? `${apiUrl}/desperdicio/codigos/${editingCodigoId}`
                : `${apiUrl}/desperdicio/codigos`;

            const method = editingCodigoId ? 'PUT' : 'POST';

            // Construir body limpio para evitar errores de deserialización (fechas, campos extra)
            const payload = {
                id: editingCodigoId ? parseInt(editingCodigoId) : 0,
                codigo: newCodigo.codigo,
                descripcion: newCodigo.descripcion,
                activo: newCodigo.activo !== undefined ? newCodigo.activo : true
            };

            const res = await api.request({
                url,
                method,
                data: payload
            });

            if (res.status === 200 || res.status === 201) {
                Alert.alert('Éxito', 'Código guardado');
                setNewCodigo({ codigo: '', descripcion: '', activo: true });
                setEditingCodigoId(null);
                // Recargar códigos
                const resCod = await api.get(`/desperdicio/codigos`);
                setCodigos(resCod.data);
            } else {
                Alert.alert('Error al guardar');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error de conexión al guardar el código');
        }
    };

    const handleDeleteCodigo = async (id) => {
        if (Platform.OS === 'web') {
            if (!confirm('¿Eliminar este código?')) return;
        }
        try {
            const res = await api.delete(`desperdicio/codigos/${id}`);
            if (res.status === 200 || res.status === 204) {
                const resCod = await api.get(`desperdicio/codigos`);
                setCodigos(resCod.data);
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar');
        }
    };

    // Helper cascade filter
    const getFilteredMaquinas = () => {
        // Si hay usuario seleccionado, mostrar solo sus máquinas
        if (!selectedUsuario) return maquinas;
        const validIds = relaciones
            .filter(r => r.usuarioId == selectedUsuario)
            .map(r => r.maquinaId);
        // Si no hay historial, no filtramos (o podríamos mostrar vacío)
        if (validIds.length === 0) return maquinas;
        return maquinas.filter(m => validIds.includes(m.id));
    };

    const getFilteredUsuarios = () => {
        // Si hay máquina seleccionada, mostrar solo sus operarios
        if (!selectedMaquina) return usuarios;
        const validIds = relaciones
            .filter(r => r.maquinaId == selectedMaquina)
            .map(r => r.usuarioId);
        if (validIds.length === 0) return usuarios;
        return usuarios.filter(u => validIds.includes(u.id));
    };

    // Render helpers
    const formatDate = (date) => {
        if (!date || isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    };

    const getBase64FromUrl = async (url) => {
        if (Platform.OS !== 'web') {
            try {
                const base64 = await FileSystem.readAsStringAsync(url, { encoding: 'base64' });
                return `data:image/jpeg;base64,${base64}`;
            } catch (err) {
                const tempPath = FileSystem.cacheDirectory + 'temp_logo.jpg';
                await FileSystem.downloadAsync(url, tempPath);
                const base64 = await FileSystem.readAsStringAsync(tempPath, { encoding: 'base64' });
                return `data:image/jpeg;base64,${base64}`;
            }
        }
        const data = await fetch(url);
        const blob = await data.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });
    };

    const generatePDF = async () => {
        setGeneratingPdf(true);
        try {
            let jsPDF, autoTable;
            if (Platform.OS === 'web') {
                const jsPDFModule = await import('jspdf');
                jsPDF = jsPDFModule.jsPDF;
                const autoTableModule = await import('jspdf-autotable');
                autoTable = autoTableModule.default;
            } else {
                alert("PDF disponible solo en Web por ahora.");
                setGeneratingPdf(false);
                return;
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Logo
            try {
                const asset = Asset.fromModule(logoSource);
                await asset.downloadAsync();
                const base64Logo = await getBase64FromUrl(asset.uri);
                doc.addImage(base64Logo, 'JPEG', 10, 10, 30, 30);
            } catch (err) { console.log("Error logo", err); }

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('REPORTE DE DESPERDICIOS', pageWidth / 2, 20, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const mesesNombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const fechaStr = selectedFecha ? formatDate(selectedFecha) : (selectedMes && selectedAnio) ? `${mesesNombres[selectedMes]} ${selectedAnio}` : 'Todo el Historial';
            doc.text(`Fecha: ${fechaStr}`, pageWidth / 2, 30, { align: 'center' });

            if (selectedMaquina) {
                const maquina = maquinas.find(m => m.id == selectedMaquina)?.nombre || 'Desconocida';
                doc.text(`Máquina: ${maquina}`, pageWidth / 2, 36, { align: 'center' });
            }

            // Summary Stats


            // Table
            // Filtrar y Ordenar por Fecha Ascendente (Oldest first)
            const registrosOrdenados = [...registros].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            // Summary Stats
            const totalItems = registrosOrdenados.length;
            const totalCantidad = registrosOrdenados.reduce((sum, r) => sum + r.cantidad, 0);

            doc.setFontSize(10);
            doc.text(`Total Registros: ${totalItems}   |   Total Cantidad: ${totalCantidad.toFixed(2)}`, 14, 50);

            // Table Body
            const columns = ['Fecha', 'Máquina', 'Operario', 'Código', 'OP', 'Cant', 'Nota'];
            const data = registrosOrdenados.map(r => [
                formatDate(new Date(r.fecha)),
                r.maquinaNombre,
                r.usuarioNombre,
                r.descripcion ? `${r.codigo} - ${r.descripcion}` : r.codigo,
                r.ordenProduccion || '-',
                r.cantidad.toString(),
                r.nota || '-'
            ]);

            autoTable(doc, {
                head: [columns],
                body: data,
                startY: 55,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                columnStyles: {
                    0: { cellWidth: 22 },
                    6: { cellWidth: 60 }
                }
            });

            let finalY = doc.lastAutoTable.finalY + 10;

            // --- RESUMENES ---
            // Helper Grouping function
            const getGroupData = (keySelector) => {
                const group = {};
                registrosOrdenados.forEach(r => {
                    const k = keySelector(r) || 'Desconocido';
                    if (!group[k]) group[k] = 0;
                    group[k] += r.cantidad;
                });
                return Object.keys(group).map(k => [k, group[k].toFixed(2)])
                    .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1])); // Mayor a menor
            };

            const summaryCode = getGroupData(r => r.descripcion ? `${r.codigo} - ${r.descripcion}` : r.codigo);
            const summaryOpNum = getGroupData(r => r.ordenProduccion || 'Sin OP');
            const summaryOp = getGroupData(r => r.usuarioNombre);

            // Resumen Máquina Mensual
            // 1. Determinar Mes/Año objetivo para Contexto de Producción
            let targetDate = selectedFecha;
            if (!targetDate && registrosOrdenados.length > 0) {
                // Si no hay fecha seleccionada, usar la del último registro (el más reciente)
                targetDate = new Date(registrosOrdenados[registrosOrdenados.length - 1].fecha);
            }
            targetDate = targetDate || new Date();

            const targetMonth = targetDate.getMonth() + 1;
            const targetYear = targetDate.getFullYear();

            // 2. Calcular Desperdicio por Máquina desde los registros FILTRADOS (Consistencia)
            const wasteByMaq = {};
            registrosOrdenados.forEach(r => {
                const mid = r.maquinaId;
                if (!wasteByMaq[mid]) wasteByMaq[mid] = { nombre: r.maquinaNombre, cantidad: 0 };
                wasteByMaq[mid].cantidad += r.cantidad;
            });

            // 3. Fetch Production Monthly Summary (UNFILTERED by context)
            let prodByMaq = {}; // { id: tiros }
            try {
                // Use same endpoint as Dashboard to ensure consistency
                let urlProd = `produccion/resumen?mes=${targetMonth}&anio=${targetYear}`;

                const resProd = await api.get(urlProd);
                const data = resProd.data;
                const list = data.resumenMaquinas || [];
                console.log("PROD SUMMARY RAW (from Dashboard):", list);
                list.forEach(p => {
                    const mid = p.maquinaId !== undefined ? p.maquinaId : p.MaquinaId;
                    // In GetResumen, the property is tirosTotales
                    const t = p.tirosTotales !== undefined ? p.tirosTotales : p.TirosTotales;
                    if (mid !== undefined) prodByMaq[mid] = t || 0;
                });
            } catch (e) {
                console.log("Error fetching prod summary", e);
            }

            // 4. Merge Data for Table (Monthly View)
            // Iterate over ALL active machines in the system, not just those with waste/prod
            const summaryMaqData = maquinas.map(m => {
                const id = m.id;
                const name = m.nombre;

                const w = wasteByMaq[id] || { nombre: name, cantidad: 0 };
                const prodTiros = prodByMaq[id] || 0;

                const waste = w.cantidad;
                const tiros = prodTiros;

                // FILTER: Hide if both Total Shots and Waste are zero
                if (tiros === 0 && waste === 0) return null;

                // Avoid division by zero
                const pct = tiros > 0 ? (waste / tiros * 100) : 0;

                return [
                    name,
                    tiros.toLocaleString('es-CO', { maximumFractionDigits: 0 }),
                    waste.toLocaleString('es-CO', { maximumFractionDigits: 0 }),
                    `${pct.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                ];
            }).filter(item => item !== null).sort((a, b) => {
                const nA = a[0];
                const nB = b[0];
                const matchA = nA.match(/^\d+/);
                const matchB = nB.match(/^\d+/);
                if (matchA && matchB) {
                    const numA = parseInt(matchA[0], 10);
                    const numB = parseInt(matchB[0], 10);
                    if (numA !== numB) return numA - numB;
                }
                return nA.localeCompare(nB);
            });


            // Mover a nueva pagina si queda poco espacio
            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                finalY = 20;
            }

            // Resumen por Código
            doc.text('Resumen por Código:', 14, finalY);
            autoTable(doc, {
                head: [['Código', 'Total']],
                body: summaryCode,
                startY: finalY + 5,
                theme: 'grid',
                styles: { fontSize: 8 },
                tableWidth: 80,
                margin: { left: 14 }
            });

            finalY = doc.lastAutoTable.finalY + 10;

            // Check page break
            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                finalY = 20;
            }

            doc.text('Resumen por Operario:', 14, finalY);
            autoTable(doc, {
                head: [['Operario', 'Total']],
                body: summaryOp,
                startY: finalY + 5,
                theme: 'grid',
                styles: { fontSize: 8 },
                tableWidth: 80,
                margin: { left: 14 }
            });

            finalY = doc.lastAutoTable.finalY + 10;

            // Check page break
            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                finalY = 20;
            }

            doc.text('Resumen por Orden de Producción:', 14, finalY);
            autoTable(doc, {
                head: [['OP', 'Total']],
                body: summaryOpNum,
                startY: finalY + 5,
                theme: 'grid',
                styles: { fontSize: 8 },
                tableWidth: 80,
                margin: { left: 14 }
            });

            finalY = doc.lastAutoTable.finalY + 10;

            // Check page break
            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                finalY = 20;
            }

            doc.text('Resumen por Máquina:', 14, finalY);
            autoTable(doc, {
                head: [['Máquina', 'Tiros Totales', 'Desperdicio', '% Desp.']],
                body: summaryMaqData,
                startY: finalY + 5,
                theme: 'grid',
                styles: { fontSize: 8 },
                tableWidth: 160,
                margin: { left: 14 },
                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 30, halign: 'right' },
                    2: { cellWidth: 30, halign: 'right' },
                    3: { cellWidth: 30, halign: 'right' }
                }
            });

            finalY = doc.lastAutoTable.finalY + 10;

            // --- NUEVO: TABLAS ADICIONALES (manteniendo el resto del reporte igual) ---
            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                finalY = 20;
            }

            const machineOpCodeGroup = {};
            registrosOrdenados.forEach(r => {
                const maqKey = r.maquinaNombre || 'Desconocida';
                const opKey = (r.ordenProduccion && r.ordenProduccion.trim()) ? r.ordenProduccion.trim() : 'Sin OP';
                const codKey = r.descripcion ? `${r.codigo} - ${r.descripcion}` : (r.codigo || 'S/C');
                if (!machineOpCodeGroup[maqKey]) machineOpCodeGroup[maqKey] = {};
                if (!machineOpCodeGroup[maqKey][opKey]) machineOpCodeGroup[maqKey][opKey] = {};
                if (!machineOpCodeGroup[maqKey][opKey][codKey]) machineOpCodeGroup[maqKey][opKey][codKey] = 0;
                machineOpCodeGroup[maqKey][opKey][codKey] += r.cantidad;
            });

            // Orden de máquinas: por prefijo numérico (si existe), luego alfabético
            const machineSorter = (a, b) => {
                const ma = (a || '').trim();
                const mb = (b || '').trim();
                const na = (ma.match(/^\d+/) || [])[0];
                const nb = (mb.match(/^\d+/) || [])[0];
                if (na && nb) {
                    const da = parseInt(na, 10);
                    const db = parseInt(nb, 10);
                    if (da !== db) return da - db;
                }
                return ma.localeCompare(mb);
            };

            const machinesWithWaste = Object.keys(machineOpCodeGroup).sort(machineSorter);

            // 1) Tabla clásica por Máquina y Código (solo en modo normal)
            if (pdfMode === 'normal') {
                doc.text('Desglose de Desperdicio por Máquina y Código:', 14, finalY);
                finalY += 10;
                machinesWithWaste.forEach((maq) => {
                    if (finalY > doc.internal.pageSize.getHeight() - 35) {
                        doc.addPage();
                        finalY = 20;
                    }

                    const machineCodeTotals = {};
                    Object.values(machineOpCodeGroup[maq]).forEach((codigos) => {
                        Object.keys(codigos).forEach((cod) => {
                            if (!machineCodeTotals[cod]) machineCodeTotals[cod] = 0;
                            machineCodeTotals[cod] += codigos[cod];
                        });
                    });
                    const machineData = Object.keys(machineCodeTotals)
                        .map(cod => [cod, machineCodeTotals[cod]])
                        .sort((a, b) => b[1] - a[1]) // descendente por cantidad
                        .map(([cod, total]) => [
                            cod,
                            total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        ]);

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.text(maq, 14, finalY);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);

                    autoTable(doc, {
                        head: [['Código / Motivo', 'Total']],
                        body: machineData,
                        startY: finalY + 2,
                        theme: 'grid',
                        styles: { fontSize: 8 },
                        tableWidth: 100,
                        margin: { left: 14 },
                        columnStyles: {
                            0: { cellWidth: 70 },
                            1: { cellWidth: 30, halign: 'right' }
                        }
                    });

                    finalY = doc.lastAutoTable.finalY + 8;
                });
            }

            // 2) Tabla detallada nueva por Máquina -> OP -> Código, en descendente
            if (finalY > doc.internal.pageSize.getHeight() - 50) {
                doc.addPage();
                finalY = 20;
            }
            doc.text('Detalle de Desperdicio por Máquina, OP y Código:', 14, finalY);
            finalY += 8;

            machinesWithWaste.forEach((maq) => {
                if (finalY > doc.internal.pageSize.getHeight() - 35) {
                    doc.addPage();
                    finalY = 20;
                }

                const totalMaquina = Object.values(machineOpCodeGroup[maq]).reduce((sumOp, codigos) =>
                    sumOp + Object.values(codigos).reduce((sumCod, v) => sumCod + v, 0), 0);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`${maq} | Total Máquina: ${totalMaquina.toFixed(2)}`, 14, finalY);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                finalY += 3;

                const opOrdenadas = Object.keys(machineOpCodeGroup[maq])
                    .map((op) => {
                        const totalOp = Object.values(machineOpCodeGroup[maq][op]).reduce((s, v) => s + v, 0);
                        return { op, totalOp };
                    })
                    .sort((a, b) => b.totalOp - a.totalOp); // descendente por subtotal OP

                opOrdenadas.forEach(({ op, totalOp }) => {
                    const codigos = machineOpCodeGroup[maq][op];
                    const opData = Object.keys(codigos)
                        .map(cod => [cod, codigos[cod]])
                        .sort((a, b) => b[1] - a[1]) // descendente por cantidad dentro de la tabla
                        .map(([cod, total]) => [
                        op,
                        cod,
                        total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    ]);

                    opData.push(['', 'Subtotal OP', totalOp.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);

                    if (finalY > doc.internal.pageSize.getHeight() - 45) {
                        doc.addPage();
                        finalY = 20;
                    }

                    autoTable(doc, {
                        head: [['OP', 'Código / Motivo', 'Cantidad']],
                        body: opData,
                        startY: finalY,
                        theme: 'grid',
                        styles: { fontSize: 8, cellPadding: 2 },
                        margin: { left: 14 },
                        columnStyles: {
                            0: { cellWidth: 24 },
                            1: { cellWidth: 96 },
                            2: { cellWidth: 30, halign: 'right' }
                        },
                        didParseCell: function (data) {
                            if (data.row.index === opData.length - 1) {
                                data.cell.styles.fontStyle = 'bold';
                                data.cell.styles.fillColor = [240, 248, 255];
                            }
                        }
                    });

                    finalY = doc.lastAutoTable.finalY + 5;
                });
            });

            finalY += 10;

            // --- GENERAR GRÁFICA DE BARRAS CON QUICKCHART ---
            try {
                // Forzar salto de página para las gráficas
                doc.addPage();
                finalY = 20;

                // Filtrar máquinas que tengan desperdicio > 0 para que la gráfica sea legible
                const dataForChart = summaryMaqData
                    .map(item => ({
                        label: item[0],
                        value: parseFloat(item[2].replace(/\./g, '').replace(/,/g, '.'))
                    }))
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor desperdicio

                const dataForPctChart = summaryMaqData
                    .map(item => ({
                        label: item[0],
                        value: parseFloat(item[3].replace(',', '.').replace('%', ''))
                    }))
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value);

                if (dataForChart.length > 0) {
                    // Check page break para la gráfica
                    if (finalY > doc.internal.pageSize.getHeight() - 100) {
                        doc.addPage();
                        finalY = 20;
                    }

                    const chartConfig = {
                        type: 'horizontalBar', // Cambiado a barras horizontales para mejor lectura de nombres
                        data: {
                            labels: dataForChart.map(d => d.label),
                            datasets: [{
                                label: 'Desperdicio por Máquina (Cantidades)',
                                data: dataForChart.map(d => d.value),
                                backgroundColor: 'rgba(41, 128, 185, 0.8)',
                                borderColor: 'rgba(41, 128, 185, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            title: {
                                display: true,
                                text: 'Comparativa de Desperdicio por Máquina (Cantidades)'
                            },
                            legend: { display: false },
                            plugins: {
                                datalabels: {
                                    anchor: 'end',
                                    align: 'right',
                                    color: '#333',
                                    font: { weight: 'bold' }
                                }
                            },
                            scales: {
                                xAxes: [{ ticks: { beginAtZero: true } }],
                                yAxes: [{
                                    ticks: {
                                        fontSize: 10,
                                        autoSkip: false
                                    }
                                }]
                            }
                        }
                    };

                    const qcResponse = await fetch('https://quickchart.io/chart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chart: chartConfig,
                            width: 800, // Más ancho
                            height: 500, // Más alto
                            backgroundColor: 'white',
                            format: 'png'
                        })
                    });

                    if (qcResponse.ok) {
                        const qcBlob = await qcResponse.blob();
                        const base64Chart = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(qcBlob);
                            reader.onloadend = () => resolve(reader.result);
                        });

                        doc.text('Gráfica de Desperdicios (Cantidades):', 14, finalY);
                        doc.addImage(base64Chart, 'PNG', 14, finalY + 5, 180, 110);
                        finalY += 125;
                    }
                }

                // --- SEGUNDA GRÁFICA: % DE DESPERDICIO ---
                if (dataForPctChart.length > 0) {
                    if (finalY > doc.internal.pageSize.getHeight() - 100) {
                        doc.addPage();
                        finalY = 20;
                    }

                    const chartConfigPct = {
                        type: 'horizontalBar',
                        data: {
                            labels: dataForPctChart.map(d => d.label),
                            datasets: [{
                                label: '% Desperdicio',
                                data: dataForPctChart.map(d => d.value),
                                backgroundColor: 'rgba(231, 76, 60, 0.8)',
                                borderColor: 'rgba(231, 76, 60, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            title: {
                                display: true,
                                text: 'Porcentaje de Desperdicio por Máquina (%)'
                            },
                            legend: { display: false },
                            plugins: {
                                datalabels: {
                                    anchor: 'end',
                                    align: 'right',
                                    color: '#333',
                                    font: { weight: 'bold' },
                                    formatter: (v) => v.toFixed(2) + '%'
                                }
                            },
                            scales: {
                                xAxes: [{ 
                                    ticks: { 
                                        beginAtZero: true,
                                        callback: (v) => v + '%'
                                    } 
                                }],
                                yAxes: [{
                                    ticks: {
                                        fontSize: 10,
                                        autoSkip: false
                                    }
                                }]
                            }
                        }
                    };

                    const qcResponsePct = await fetch('https://quickchart.io/chart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chart: chartConfigPct,
                            width: 800,
                            height: 500,
                            backgroundColor: 'white',
                            format: 'png'
                        })
                    });

                    if (qcResponsePct.ok) {
                        const qcBlobPct = await qcResponsePct.blob();
                        const base64ChartPct = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(qcBlobPct);
                            reader.onloadend = () => resolve(reader.result);
                        });

                        doc.text('Gráfica de % de Desperdicio:', 14, finalY);
                        doc.addImage(base64ChartPct, 'PNG', 14, finalY + 5, 180, 110);
                        finalY += 125;
                    }
                }
            } catch (chartErr) {
                console.log("Error generando gráfica:", chartErr);
            }

            doc.save(`reporte_desperdicios_${new Date().getTime()}.pdf`);


        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const generateTrazabilidadPDF = async () => {
        setGeneratingTracePdf(true);
        try {
            let jsPDF, autoTable;
            if (Platform.OS === 'web') {
                const jsPDFModule = await import('jspdf');
                jsPDF = jsPDFModule.jsPDF;
                const autoTableModule = await import('jspdf-autotable');
                autoTable = autoTableModule.default;
            } else {
                alert("PDF disponible solo en Web por ahora.");
                setGeneratingTracePdf(false);
                return;
            }

            const anio = selectedAnio || new Date().getFullYear();
            const mesHasta = selectedMes ? Number(selectedMes) : 12;
            const res = await api.get(`desperdicio/trazabilidad-anual?anio=${anio}&mesHasta=${mesHasta}`);
            const data = res.data || {};

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFontSize(17);
            doc.setFont('helvetica', 'bold');
            doc.text('TRAZABILIDAD ANUAL DE DESPERDICIO', pageWidth / 2, 18, { align: 'center' });
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`Año: ${anio}  |  Corte hasta mes: ${data.mesHasta || mesHasta}`, pageWidth / 2, 26, { align: 'center' });

            const totalAnual = Number(data.totalAnual || 0);
            const mesCritico = data.mesMasCritico?.nombreMes || '-';
            const valorMesCritico = Number(data.mesMasCritico?.total || 0);

            doc.setFontSize(10);
            doc.text(
                `Total acumulado: ${totalAnual.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  |  Mes más crítico: ${mesCritico} (${valorMesCritico.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                14,
                35
            );

            const totalesMesRows = (data.totalPorMes || []).map((m) => [
                m.nombreMes,
                Number(m.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ]);

            autoTable(doc, {
                head: [['Mes', 'Desperdicio Total']],
                body: totalesMesRows,
                startY: 40,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } }
            });

            let finalY = doc.lastAutoTable.finalY + 8;

            // Tendencia mensual en línea
            try {
                const chartLabels = (data.totalPorMes || []).map((m) => m.nombreMes);
                const chartValues = (data.totalPorMes || []).map((m) => Number(m.total || 0));
                if (chartLabels.length > 0) {
                    const chartConfig = {
                        type: 'line',
                        data: {
                            labels: chartLabels,
                            datasets: [{
                                label: 'Desperdicio mensual',
                                data: chartValues,
                                borderColor: 'rgba(13,110,253,1)',
                                backgroundColor: 'rgba(13,110,253,0.2)',
                                fill: true,
                                tension: 0.3
                            }]
                        },
                        options: {
                            title: { display: true, text: 'Tendencia mensual de desperdicio' },
                            legend: { display: false }
                        }
                    };

                    const qcResponse = await fetch('https://quickchart.io/chart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chart: chartConfig, width: 900, height: 360, backgroundColor: 'white', format: 'png' })
                    });
                    if (qcResponse.ok) {
                        const qcBlob = await qcResponse.blob();
                        const base64Chart = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(qcBlob);
                            reader.onloadend = () => resolve(reader.result);
                        });
                        if (finalY > doc.internal.pageSize.getHeight() - 95) {
                            doc.addPage();
                            finalY = 20;
                        }
                        doc.text('Tendencia mensual (línea):', 14, finalY);
                        doc.addImage(base64Chart, 'PNG', 14, finalY + 4, 180, 72);
                        finalY += 82;
                    }
                }
            } catch (chartErr) {
                console.log('Error gráfica tendencia:', chartErr);
            }

            // Análisis estadístico técnico
            try {
                const vals = (data.totalPorMes || []).map((m) => Number(m.total || 0));
                const labels = (data.totalPorMes || []).map((m) => m.nombreMes);
                if (vals.length > 0) {
                    const n = vals.length;
                    const avg = vals.reduce((a, b) => a + b, 0) / n;
                    const maxVal = Math.max(...vals);
                    const minVal = Math.min(...vals);
                    const idxMax = vals.findIndex((v) => v === maxVal);
                    const idxMin = vals.findIndex((v) => v === minVal);

                    const xAvg = (n - 1) / 2;
                    const yAvg = avg;
                    let num = 0;
                    let den = 0;
                    for (let i = 0; i < n; i++) {
                        num += (i - xAvg) * (vals[i] - yAvg);
                        den += (i - xAvg) * (i - xAvg);
                    }
                    const slope = den > 0 ? num / den : 0;

                    const analysisRows = [
                        ['Mes pico', `${labels[idxMax] || '-'} (${maxVal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`],
                        ['Mes mínimo', `${labels[idxMin] || '-'} (${minVal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`],
                        ['Pendiente de tendencia', slope > 0 ? `Al alza (+${slope.toLocaleString('es-CO', { maximumFractionDigits: 2 })} por mes)` : slope < 0 ? `A la baja (${slope.toLocaleString('es-CO', { maximumFractionDigits: 2 })} por mes)` : 'Estable']
                    ];

                    if (finalY > doc.internal.pageSize.getHeight() - 60) {
                        doc.addPage();
                        finalY = 20;
                    }

                    autoTable(doc, {
                        head: [['Indicador técnico', 'Resultado']],
                        body: analysisRows,
                        startY: finalY,
                        theme: 'grid',
                        styles: { fontSize: 9 },
                        headStyles: { fillColor: [33, 37, 41], textColor: 255, fontStyle: 'bold' }
                    });
                    finalY = doc.lastAutoTable.finalY + 8;
                }
            } catch (analysisErr) {
                console.log('Error bloque análisis técnico:', analysisErr);
            }

            // Top máquinas por mes (gráfico de barras agrupadas)
            try {
                const topMaqMes = data.topMaquinasPorMes || [];
                const mesesChart = (data.meses || []).map((m) => m.nombreMes);
                const monthTotals = Object.fromEntries(
                    (data.totalPorMes || []).map((x) => [x.mes, Number(x.total || 0)])
                );
                const maquinasSet = new Set();
                topMaqMes.forEach((m) => (m.topMaquinas || []).forEach((x) => maquinasSet.add(x.maquinaNombre)));
                const maquinasTop = Array.from(maquinasSet)
                    .slice(0, 5);
                if (mesesChart.length > 0 && maquinasTop.length > 0) {
                    const colors = [
                        'rgba(13,110,253,0.75)',
                        'rgba(25,135,84,0.75)',
                        'rgba(255,193,7,0.75)',
                        'rgba(220,53,69,0.75)',
                        'rgba(111,66,193,0.75)'
                    ];
                    const pctLabels = [];
                    const datasets = maquinasTop.map((maq, idx) => {
                        const pctRow = (data.meses || []).map((m) => {
                            const mesData = topMaqMes.find((x) => x.mes === m.mes);
                            const row = (mesData?.topMaquinas || []).find((x) => x.maquinaNombre === maq);
                            if (row?.porcentaje != null) return Number(row.porcentaje);
                            const total = Number(row?.total || 0);
                            const mt = Number(mesData?.totalMes ?? monthTotals[m.mes] ?? 0);
                            return mt > 0 ? Math.round((total / mt) * 1000) / 10 : 0;
                        });
                        pctLabels.push(pctRow);
                        return {
                            label: maq,
                            backgroundColor: colors[idx % colors.length],
                            borderColor: colors[idx % colors.length].replace('0.75', '1'),
                            borderWidth: 1,
                            data: (data.meses || []).map((m) => {
                                const mesData = topMaqMes.find((x) => x.mes === m.mes);
                                const row = (mesData?.topMaquinas || []).find((x) => x.maquinaNombre === maq);
                                return Number(row?.total || 0);
                            }),
                        };
                    });

                    const maqB64 = await renderWebChartToBase64({
                        type: 'bar',
                        data: { labels: mesesChart, datasets },
                        options: {
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Top máquinas por mes (% sobre total del mes en cada barra)',
                                },
                                legend: {
                                    display: true,
                                    position: 'bottom',
                                    labels: { boxWidth: 10, font: { size: 9 } },
                                },
                                datalabels: {
                                    display: true,
                                    anchor: 'end',
                                    align: 'top',
                                    color: '#1f2937',
                                    font: { size: 9, weight: 'bold' },
                                    formatter: (_value, ctx) => {
                                        const p = pctLabels[ctx.datasetIndex]?.[ctx.dataIndex] ?? 0;
                                        return p > 0 ? `${p.toFixed(1)}%` : '';
                                    },
                                },
                            },
                            scales: {
                                y: { beginAtZero: true },
                            },
                        },
                    }, 900, 400);

                    if (maqB64) {
                        if (finalY > doc.internal.pageSize.getHeight() - 95) {
                            doc.addPage();
                            finalY = 20;
                        }
                        doc.text('Top máquinas por mes (gráfico):', 14, finalY);
                        doc.addImage(maqB64, 'PNG', 14, finalY + 4, 180, 72);
                        finalY += 82;
                    }
                }
            } catch (maqErr) {
                console.log('Error gráfico máquinas:', maqErr);
            }

            // Heatmap técnico (tabla con intensidad por código/mes)
            const matrix = data.matrizCodigoMes || [];
            if (matrix.length > 0 && (data.meses || []).length > 0) {
                if (finalY > doc.internal.pageSize.getHeight() - 60) {
                    doc.addPage();
                    finalY = 20;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text('Heatmap técnico Código x Mes (top códigos):', 14, finalY);
                doc.setFont('helvetica', 'normal');
                const maxCell = Math.max(
                    1,
                    ...matrix.flatMap((r) => (r.valores || []).map((v) => Number(v || 0)))
                );
                const monthHeaders = (data.meses || []).map((m) => m.nombreMes.slice(0, 3));
                const heatRows = matrix.map((row) => [
                    `${row.codigo} ${row.descripcion ? '- ' + row.descripcion : ''}`,
                    ...(row.valores || []).map((v) =>
                        Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    )
                ]);

                autoTable(doc, {
                    head: [['Código', ...monthHeaders]],
                    body: heatRows,
                    startY: finalY + 3,
                    theme: 'grid',
                    styles: { fontSize: 7, cellPadding: 1.5 },
                    didParseCell: function (hook) {
                        if (hook.section !== 'body') return;
                        if (hook.column.index < 1) return;
                        const raw = (matrix[hook.row.index]?.valores || [])[hook.column.index - 1] || 0;
                        const ratio = Math.max(0, Math.min(1, Number(raw) / maxCell));
                        const red = 255;
                        const greenBlue = Math.round(245 - ratio * 170);
                        hook.cell.styles.fillColor = [red, greenBlue, greenBlue];
                        hook.cell.styles.halign = 'right';
                    }
                });
                finalY = doc.lastAutoTable.finalY + 8;
            }

            const criticosRows = (data.codigosPorMes || []).map((m) => [
                m.nombreMes,
                m.codigoMasCritico ? `${m.codigoMasCritico.codigo} - ${m.codigoMasCritico.descripcion || ''}` : '-',
                Number(m.codigoMasCritico?.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ]);

            if (finalY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                finalY = 20;
            }

            autoTable(doc, {
                head: [['Mes', 'Código más crítico', 'Total']],
                body: criticosRows,
                startY: finalY,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [192, 57, 43], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 2: { halign: 'right' } }
            });

            finalY = doc.lastAutoTable.finalY + 8;

            // Top máquinas por mes (top 5)
            (data.topMaquinasPorMes || []).forEach((m) => {
                const totalMes = Number(m.totalMes ?? 0);
                const rows = (m.topMaquinas || []).map((x) => {
                    const total = Number(x.total || 0);
                    const pct =
                        x.porcentaje != null
                            ? Number(x.porcentaje)
                            : totalMes > 0
                              ? Math.round((total / totalMes) * 1000) / 10
                              : 0;
                    return [
                        x.maquinaNombre || 'Sin máquina',
                        total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                        `${pct.toFixed(1)}%`,
                    ];
                });
                if (rows.length === 0) return;
                if (finalY > doc.internal.pageSize.getHeight() - 45) {
                    doc.addPage();
                    finalY = 20;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                const totalMesTxt = totalMes.toLocaleString('es-CO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                });
                doc.text(`Top máquinas - ${m.nombreMes} (total mes: ${totalMesTxt})`, 14, finalY);
                doc.setFont('helvetica', 'normal');
                autoTable(doc, {
                    head: [['Máquina', 'Total', '% del mes']],
                    body: rows,
                    startY: finalY + 3,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
                });
                finalY = doc.lastAutoTable.finalY + 6;
            });

            (data.codigosPorMes || []).forEach((m) => {
                const rows = (m.topCodigos || []).map((c) => [
                    c.codigo,
                    c.descripcion || '',
                    Number(c.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                ]);
                if (rows.length === 0) return;

                if (finalY > doc.internal.pageSize.getHeight() - 50) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`Top códigos - ${m.nombreMes}`, 14, finalY);
                doc.setFont('helvetica', 'normal');

                autoTable(doc, {
                    head: [['Código', 'Descripción', 'Total']],
                    body: rows,
                    startY: finalY + 3,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    columnStyles: { 2: { halign: 'right' } }
                });

                finalY = doc.lastAutoTable.finalY + 6;
            });

            doc.save(`trazabilidad_desperdicio_${anio}_${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el documento de trazabilidad.");
        } finally {
            setGeneratingTracePdf(false);
        }
    };


    return (
        <View style={styles.container}>
            {/* Header / Botones Superiores */}
            <View style={styles.header}>
                <View style={[styles.filterRow, { flexWrap: 'wrap', gap: 10 }]}>
                    {/* Filtro Fecha específica */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Fecha:</Text>
                        {selectedFecha ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={selectedFecha && !isNaN(selectedFecha.getTime()) ? selectedFecha.toISOString().split('T')[0] : ''}
                                        onChange={(e) => {
                                            if (!e.target.value) { setSelectedFecha(null); return; }
                                            const d = new Date(e.target.value);
                                            if (isNaN(d.getTime())) return;
                                            const localDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                                            setSelectedFecha(localDate);
                                        }}
                                        style={{ padding: 5, borderRadius: 4, border: '1px solid #ccc', marginRight: 5 }}
                                    />
                                ) : (
                                    <Text style={{ marginRight: 5 }}>{formatDate(selectedFecha)}</Text>
                                )}
                                <TouchableOpacity onPress={() => setSelectedFecha(null)} style={{ backgroundColor: '#dc3545', padding: 5, borderRadius: 4 }}>
                                    <Text style={{ color: 'white', fontSize: 10 }}>X</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => { setSelectedFecha(new Date()); setSelectedMes(''); setSelectedAnio(''); }} style={{ backgroundColor: '#007bff', padding: 5, borderRadius: 4 }}>
                                <Text style={{ color: 'white', fontSize: 12 }}>📅 Hoy</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Filtro Mes / Año */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Mes:</Text>
                        <Picker
                            selectedValue={selectedMes}
                            onValueChange={(v) => { setSelectedMes(v); if (v) setSelectedFecha(null); }}
                            style={{ height: 30, width: 120, padding: 0 }}
                        >
                            <Picker.Item label="Todos" value="" />
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                <Picker.Item key={i + 1} label={m} value={i + 1} />
                            ))}
                        </Picker>
                        <Text style={[styles.label, { marginBottom: 0, marginLeft: 5, marginRight: 5 }]}>Año:</Text>
                        <Picker
                            selectedValue={selectedAnio}
                            onValueChange={(v) => { setSelectedAnio(v); if (v) setSelectedFecha(null); }}
                            style={{ height: 30, width: 90, padding: 0 }}
                        >
                            <Picker.Item label="--" value="" />
                            {[2025, 2026, 2027].map(y => (
                                <Picker.Item key={y} label={y.toString()} value={y} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro Máquina */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Máq:</Text>
                        <Picker
                            selectedValue={selectedMaquina}
                            onValueChange={(v) => setSelectedMaquina(v)}
                            style={{ height: 30, width: 150, padding: 0 }}
                        >
                            <Picker.Item label="Todas" value="" />
                            {getFilteredMaquinas().map(m => (
                                <Picker.Item key={m.id} label={m.nombre} value={m.id} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro Operario */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Op:</Text>
                        <Picker
                            selectedValue={selectedUsuario}
                            onValueChange={(v) => setSelectedUsuario(v)}
                            style={{ height: 30, width: 150, padding: 0 }}
                        >
                            <Picker.Item label="Todos" value="" />
                            {getFilteredUsuarios().map(u => (
                                <Picker.Item key={u.id} label={u.nombre} value={u.id} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro Código */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Cod:</Text>
                        <Picker
                            selectedValue={selectedCodigo}
                            onValueChange={(v) => setSelectedCodigo(v)}
                            style={{ height: 30, width: 120, padding: 0 }}
                        >
                            <Picker.Item label="Todos" value="" />
                            {codigos.map(c => (
                                <Picker.Item key={c.id} label={c.codigo} value={c.id} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro OP */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>OP:</Text>
                        <TextInput
                            style={{
                                height: 30,
                                borderColor: '#ccc',
                                borderWidth: 1,
                                borderRadius: 4,
                                paddingHorizontal: 5,
                                width: 80,
                                backgroundColor: 'white'
                            }}
                            placeholder="Buscar..."
                            value={selectedOP}
                            onChangeText={setSelectedOP}
                        />
                    </View>
                </View>

                <View style={styles.buttonRow}>
                    <View style={{ flexDirection: 'row', backgroundColor: '#e9ecef', borderRadius: 8, padding: 3, marginRight: 6 }}>
                        <TouchableOpacity
                            style={[styles.button, { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: pdfMode === 'normal' ? '#007bff' : 'transparent' }]}
                            onPress={() => setPdfMode('normal')}
                        >
                            <Text style={[styles.buttonText, { color: pdfMode === 'normal' ? '#fff' : '#495057' }]}>PDF Normal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: pdfMode === 'detallado' ? '#007bff' : 'transparent' }]}
                            onPress={() => setPdfMode('detallado')}
                        >
                            <Text style={[styles.buttonText, { color: pdfMode === 'detallado' ? '#fff' : '#495057' }]}>PDF Detallado</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#6c757d', marginRight: 10 }]}
                        onPress={generatePDF}
                        disabled={generatingPdf}
                    >
                        {generatingPdf ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>📄 PDF</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#0d6efd', marginRight: 10 }]}
                        onPress={generateTrazabilidadPDF}
                        disabled={generatingTracePdf}
                    >
                        {generatingTracePdf ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>📘 Trazabilidad Anual</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.configButton]}
                        onPress={() => setModalConfigVisible(true)}
                    >
                        <Text style={styles.buttonText}>⚙️ Configuración</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.addButton]}
                        onPress={() => {
                            setNewRegistro({
                                id: null,
                                maquinaId: '',
                                usuarioId: '',
                                esTallerExterno: false,
                                fecha: selectedFecha || new Date(),
                            });
                            setCodigoItems([{ ...emptyCodigoItem }]);
                            setModalRegistroVisible(true);
                        }}
                    >
                        <Text style={styles.buttonText}>+ Agregar Desperdicio</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Lista de Registros (Mostrar alerta si no hay filtros, o mostrar los de hoy) */}
            <FlatList
                data={registros}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={{ borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8 }}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowCode}>{item.codigo}</Text>
                                <Text style={styles.rowDesc}>{item.descripcion}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text>OP: {item.ordenProduccion || 'N/A'}</Text>
                                <Text>Máq: {item.maquinaNombre}</Text>
                                <Text>Oper: {item.usuarioNombre}</Text>
                                <Text>Registró: {item.registradoPor || '—'}</Text>
                                <Text>Fecha: {formatDate(new Date(item.fecha))}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.rowCant}>{item.cantidad}</Text>
                                <TouchableOpacity onPress={() => handleEditRegistro(item)} style={{ marginBottom: 5 }}>
                                    <Text style={[styles.deleteText, { color: '#007bff' }]}>✏️ Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteRegistro(item.id)}>
                                    <Text style={styles.deleteText}>🗑️ Eliminar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {item.nota ? <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginLeft: 10 }}>Nota: {item.nota}</Text> : null}
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No hay registros recientes.</Text>}
            />

            {/* MODAL CONFIGURACIÓN CÓDIGOS ... (sin cambios) */}
            <Modal visible={modalConfigVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Configuración de Códigos</Text>

                        <TextInput
                            style={[styles.input, { flex: 0.3 }]}
                            placeholder="Código (ej: DP01)"
                            value={newCodigo.codigo}
                            onChangeText={t => setNewCodigo({ ...newCodigo, codigo: t })}
                        />
                        <TextInput
                            style={[styles.input, { flex: 0.7 }]}
                            placeholder="Descripción"
                            value={newCodigo.descripcion}
                            onChangeText={t => setNewCodigo({ ...newCodigo, descripcion: t })}
                        />

                        <TouchableOpacity style={styles.largeSaveButton} onPress={handleSaveCodigo}>
                            <Text style={styles.largeSaveButtonText}>{editingCodigoId ? 'Actualizar Código' : 'Guardar Código'}</Text>
                        </TouchableOpacity>

                        <FlatList
                            data={codigos}
                            keyExtractor={item => item.id.toString()}
                            style={{ maxHeight: 300, marginTop: 10 }}
                            renderItem={({ item }) => (
                                <View style={styles.codeRow}>
                                    <Text style={{ width: 60, fontWeight: 'bold' }}>{item.codigo}</Text>
                                    <Text style={{ flex: 1 }}>{item.descripcion}</Text>
                                    <TouchableOpacity onPress={() => {
                                        setNewCodigo(item);
                                        setEditingCodigoId(item.id);
                                    }}>
                                        <Text style={styles.actionText}>✏️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteCodigo(item.id)} style={{ marginLeft: 10 }}>
                                        <Text style={styles.actionText}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />

                        <TouchableOpacity style={styles.closeButton} onPress={() => setModalConfigVisible(false)}>
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL AGREGAR DESPERDICIO */}
            <Modal visible={modalRegistroVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { padding: 0, maxHeight: '90%' }]}>

                        {/* ── HEADER FIJO ── */}
                        <View style={{ backgroundColor: '#2c3e50', padding: 14, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                            <Text style={[styles.modalTitle, { color: '#fff', marginBottom: 8 }]}>
                                {newRegistro.id ? '✏️ Editar Desperdicio' : '🗑️ Registrar Desperdicio'}
                            </Text>

                            {/* Switch de Taller Externo */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#34495e', padding: 8, borderRadius: 6 }}>
                                <Switch
                                    value={newRegistro.esTallerExterno}
                                    onValueChange={(v) => setNewRegistro({ ...newRegistro, esTallerExterno: v, maquinaId: '', usuarioId: '' })}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                    thumbColor={newRegistro.esTallerExterno ? "#f5dd4b" : "#f4f3f4"}
                                />
                                <Text style={{ marginLeft: 10, color: '#f1c40f', fontWeight: 'bold' }}>¿Es Taller Externo? (No requiere Máquina ni Operario)</Text>
                            </View>

                            {/* Máquina + Operario en fila */}
                            {!newRegistro.esTallerExterno && (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: '#aed6f1', marginBottom: 2 }]}>Máquina</Text>
                                        <View style={{ backgroundColor: '#fff', borderRadius: 6 }}>
                                            <Picker
                                                selectedValue={newRegistro.maquinaId}
                                                onValueChange={(v) => setNewRegistro({ ...newRegistro, maquinaId: v })}
                                                style={{ height: 36 }}
                                            >
                                                <Picker.Item label="Seleccionar..." value="" />
                                                {maquinas.map(m => (
                                                    <Picker.Item key={m.id} label={m.nombre} value={m.id} />
                                                ))}
                                            </Picker>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: '#aed6f1', marginBottom: 2 }]}>Operario</Text>
                                        <View style={{ backgroundColor: '#fff', borderRadius: 6 }}>
                                            <Picker
                                                selectedValue={newRegistro.usuarioId}
                                                onValueChange={(v) => setNewRegistro({ ...newRegistro, usuarioId: v })}
                                                style={{ height: 36 }}
                                            >
                                                <Picker.Item label="Seleccionar..." value="" />
                                                {usuarios.map(u => (
                                                    <Picker.Item key={u.id} label={u.nombre} value={u.id} />
                                                ))}
                                            </Picker>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Fecha */}
                            {Platform.OS === 'web' && (
                                <View style={{ marginTop: 8 }}>
                                    <Text style={[styles.label, { color: '#aed6f1', marginBottom: 2 }]}>Fecha</Text>
                                    <input
                                        type="date"
                                        value={formatDate(newRegistro.fecha)}
                                        onChange={(e) => {
                                            const d = new Date(e.target.value);
                                            if (isNaN(d.getTime())) return;
                                            setNewRegistro({ ...newRegistro, fecha: new Date(d.getTime() + d.getTimezoneOffset() * 60000) });
                                        }}
                                        style={{
                                            padding: 7, borderRadius: 6, border: 'none',
                                            fontSize: 15, width: '100%', backgroundColor: 'white'
                                        }}
                                    />
                                </View>
                            )}
                        </View>

                        {/* ── CUERPO SCROLLEABLE: tarjetas de código ── */}
                        <ScrollView style={{ flex: 1, paddingHorizontal: 14, paddingTop: 10 }} contentContainerStyle={{ paddingBottom: 8 }}>
                            {codigoItems.map((item, idx) => (
                                <View key={idx} style={{
                                    borderWidth: 1, borderColor: '#3498db', borderRadius: 8,
                                    padding: 10, marginBottom: 10, backgroundColor: '#f0f8ff'
                                }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#2980b9', fontSize: 13 }}>Código #{idx + 1}</Text>
                                        {codigoItems.length > 1 && (
                                            <TouchableOpacity
                                                onPress={() => setCodigoItems(prev => prev.filter((_, i) => i !== idx))}
                                                style={{ backgroundColor: '#e74c3c', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✕ Quitar</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <Text style={styles.label}>Código Desperdicio</Text>
                                    <Picker
                                        selectedValue={item.codigoDesperdicioId}
                                        onValueChange={(v) => setCodigoItems(prev => prev.map((it, i) => i === idx ? { ...it, codigoDesperdicioId: v } : it))}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Seleccionar..." value="" />
                                        {codigos.filter(c => c.activo).map(c => (
                                            <Picker.Item key={c.id} label={`${c.codigo} - ${c.descripcion}`} value={c.id} />
                                        ))}
                                    </Picker>

                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>Cantidad</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="0"
                                                keyboardType="numeric"
                                                value={item.cantidad}
                                                onChangeText={t => setCodigoItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: t } : it))}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>OP</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="OP..."
                                                value={item.ordenProduccion}
                                                onChangeText={t => setCodigoItems(prev => prev.map((it, i) => i === idx ? { ...it, ordenProduccion: t } : it))}
                                            />
                                        </View>
                                    </View>

                                    <Text style={styles.label}>Nota (Opcional)</Text>
                                    <TextInput
                                        style={[styles.input, { height: 50 }]}
                                        placeholder="Nota adicional..."
                                        multiline
                                        value={item.nota}
                                        onChangeText={t => setCodigoItems(prev => prev.map((it, i) => i === idx ? { ...it, nota: t } : it))}
                                    />
                                </View>
                            ))}

                            {/* Botón Agregar nuevo código */}
                            <TouchableOpacity
                                style={{
                                    borderWidth: 2, borderColor: '#2ecc71', borderStyle: 'dashed',
                                    borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 4
                                }}
                                onPress={() => setCodigoItems(prev => [...prev, { ...emptyCodigoItem }])}
                            >
                                <Text style={{ color: '#27ae60', fontWeight: 'bold', fontSize: 14 }}>＋ Agregar nuevo código</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* ── FOOTER FIJO ── */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: '#95a5a6' }]} onPress={() => setModalRegistroVisible(false)}>
                                <Text style={styles.buttonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.addButton]} onPress={handleSaveRegistro}>
                                <Text style={styles.buttonText}>💾 Guardar</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
    header: { marginBottom: 16, backgroundColor: 'white', padding: 16, borderRadius: 8, elevation: 2 },
    filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 },
    label: { width: 80, fontWeight: 'bold' },
    pickerContainer: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 4 },
    picker: { height: 40, width: '100%' },
    webInput: { padding: 8, borderRadius: 4, border: '1px solid #ddd', fontSize: 16 },
    button: { padding: 10, borderRadius: 6, alignItems: 'center' },
    addButton: { backgroundColor: '#28a745' },
    configButton: { backgroundColor: '#6c757d' },
    buttonText: { color: 'white', fontWeight: 'bold' },
    row: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 6, marginBottom: 8, elevation: 1 },
    rowCode: { fontWeight: 'bold', fontSize: 16, color: '#007bff' },
    rowDesc: { color: '#555' },
    rowCant: { fontWeight: 'bold', fontSize: 18, color: '#dc3545' },
    deleteText: { color: 'red', fontSize: 12, marginTop: 4 },
    empty: { textAlign: 'center', color: '#888', marginTop: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxWidth: 500, backgroundColor: 'white', borderRadius: 10, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginBottom: 10 },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    saveIconBtn: { backgroundColor: '#007bff', padding: 10, borderRadius: 6, justifyContent: 'center' },
    codeRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
    actionText: { fontSize: 18 },
    closeButton: { marginTop: 20, padding: 12, backgroundColor: '#333', borderRadius: 6, alignItems: 'center' },
    closeButtonText: { color: 'white', fontWeight: 'bold' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    largeSaveButton: { backgroundColor: '#007bff', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 5, marginBottom: 15 },
    largeSaveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    readOnlyField: { padding: 10, backgroundColor: '#e9ecef', borderRadius: 6, marginBottom: 10, flexDirection: 'row' },
    readOnlyLabel: { fontWeight: 'bold', color: '#555' },
    readOnlyValue: { color: '#333' }
});


// export default DesperdicioScreen;
