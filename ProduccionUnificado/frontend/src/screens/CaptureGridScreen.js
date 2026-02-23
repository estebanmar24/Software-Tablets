import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, FlatList, Platform, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { api, getMaquinasActivas, getUsuarios, saveProduccion, getProduccionDetalles, getOperariosConDatos, getMaquinasConDatos, getProduccionPorMaquina, API_URL } from '../services/productionApi';
import { useTheme } from '../contexts/ThemeContext';
import DayDetailModal from '../components/DayDetailModal';
import * as DocumentPicker from 'expo-document-picker';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
let rowIdCounter = 100;

export default function CaptureGridScreen({ navigation }) {
    const { colors } = useTheme();
    // Selectors
    const [selectedOperario, setSelectedOperario] = useState(null);
    const [selectedMaquina, setSelectedMaquina] = useState(null);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());

    const logoSource = colors.alephLogo;

    // Lists
    const [maquinas, setMaquinas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [horarios, setHorarios] = useState([]);

    // Grid Data
    const [gridData, setGridData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [operariosConDatos, setOperariosConDatos] = useState([]);
    const [maquinasConDatos, setMaquinasConDatos] = useState([]);
    const [modalTab, setModalTab] = useState('operario');

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null });

    // Selected Row State
    const [selectedRowIndex, setSelectedRowIndex] = useState(null);

    // Export Modal State
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [periodosDisponibles, setPeriodosDisponibles] = useState([]);
    const [exportMes, setExportMes] = useState(new Date().getMonth() + 1);
    const [exportAnio, setExportAnio] = useState(new Date().getFullYear());
    const [exportFormat, setExportFormat] = useState('csv');

    // Delete Modal State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleteOption, setDeleteOption] = useState('maquina');
    const [isDeleting, setIsDeleting] = useState(false);

    // Clean Confirmation Modal
    const [cleanConfirmVisible, setCleanConfirmVisible] = useState(false);

    // OP Search State
    const [opSearchModalVisible, setOpSearchModalVisible] = useState(false);
    const [opResultsModalVisible, setOpResultsModalVisible] = useState(false);
    const [loadingOPs, setLoadingOPs] = useState(false);
    const [opFilterText, setOpFilterText] = useState('');
    const [opList, setOpList] = useState([]);
    const [opResults, setOpResults] = useState([]);
    const [selectedOP, setSelectedOP] = useState('');

    // Day Detail State
    const [dayDetailModalVisible, setDayDetailModalVisible] = useState(false);
    const [dayDetailInfo, setDayDetailInfo] = useState(null);
    const [actividades, setActividades] = useState([]);

    // Excel Import Preview State
    const [importPreviewVisible, setImportPreviewVisible] = useState(false);
    const [importPreviewData, setImportPreviewData] = useState([]);
    const [detailedPreviewVisible, setDetailedPreviewVisible] = useState(false);
    const [detailedPreviewData, setDetailedPreviewData] = useState(null);

    useEffect(() => {
        loadLists();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            console.log('CaptureGridScreen focused - reloading machine data...');
            reloadMachines();
        });
        return unsubscribe;
    }, [navigation]);

    const reloadMachines = async () => {
        try {
            const res = await getMaquinasActivas();
            setMaquinas(res.data);
            console.log('Máquinas activas actualizadas:', res.data.length);
        } catch (e) {
            console.error('Error recargando máquinas:', e);
        }
    };

    useEffect(() => {
        if (maquinas.length > 0 && gridData.length === 0) {
            resetGrid();
        }
    }, [maquinas]);

    const loadLists = async () => {
        try {
            const [m, u, h, tact] = await Promise.all([
                getMaquinasActivas(),
                getUsuarios(),
                api.get(`tiempoproceso/horarios`),
                api.get('tiempoproceso/actividades')
            ]);
            setMaquinas(m.data);
            setUsuarios(u.data);
            setHorarios(h.data || []);
            setActividades(tact.data || []);
            setSelectedMaquina(null);
            if (u.data.length > 0) setSelectedOperario(u.data[0].id);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "No se pudieron cargar las listas");
        }
    };

    const resetGrid = () => {
        const initial = DAYS.map((d, idx) => ({
            rowId: idx + 1,
            day: d,
            maquinaId: null,
            operarioId: null,
            horarioId: null,
            horaInicio: '',
            horaFin: '',
            rFinal: '',
            horasOp: '',
            cambios: '',
            puestaPunto: '',
            mantenimiento: '',
            aseo: '',
            descansos: '',
            otrosAux: '',
            faltaTrabajo: '',
            reparacion: '',
            otroMuerto: '',
            desperdicio: '',
            referenciaOP: '',
            novedades: '',
            id: null
        }));
        rowIdCounter = 100;
        setGridData(initial);
    };

    const handleLoadData = async (maquinaIdToLoad = null, operarioOverride = null) => {
        const opToLoad = operarioOverride || selectedOperario;

        if (!maquinaIdToLoad) {
            console.log("No machine specified for loading");
            return;
        }

        setSelectedMaquina(maquinaIdToLoad);

        try {
            console.log(`Cargando datos Maq:${maquinaIdToLoad} Op:${opToLoad}`);
            const [res, resDesp] = await Promise.all([
                getProduccionDetalles(mes, anio, maquinaIdToLoad, opToLoad),
                axios.get(`${API_URL}/desperdicio/reporte?maquinaId=${maquinaIdToLoad}&mes=${mes}&anio=${anio}`).catch(e => ({ data: {} }))
            ]);

            let dbData = res.data || [];
            const desperdicios = resDesp.data || {};

            let tempRowId = 1;
            const newGrid = DAYS.flatMap((d) => {
                const records = dbData.filter(item => {
                    const fechaStr = item.fecha.split('T')[0];
                    const dayFromDb = parseInt(fechaStr.split('-')[2], 10);
                    return dayFromDb === d;
                });

                if (records.length > 0) {
                    // Ordenar por hora de inicio cronológicamente
                    records.sort((a, b) => {
                        const hA = (a.horaInicio || a.HoraInicio || "00:00").substring(0, 5);
                        const hB = (b.horaInicio || b.HoraInicio || "00:00").substring(0, 5);
                        return hA.localeCompare(hB);
                    });

                    return records.map(record => {
                        const recordId = record.id || record.Id;
                        const despKey = `${d}_${record.usuarioId}`;
                        const despValor = desperdicios[despKey] !== undefined
                            ? formatForDisplay(desperdicios[despKey])
                            : (record ? formatForDisplay(record.desperdicio) : '');

                        return {
                            rowId: tempRowId++,
                            day: d,
                            id: recordId,
                            operarioId: record.usuarioId,
                            horarioId: record.horarioId || record.HorarioId || null,
                            horaInicio: (record.horaInicio || record.HoraInicio)?.substring(0, 5) || '',
                            horaFin: (record.horaFin || record.HoraFin)?.substring(0, 5) || '',
                            rFinal: formatForDisplay(record.rendimientoFinal || record.RendimientoFinal),
                            horasOp: formatForDisplay(record.horasOperativas || record.HorasOperativas),
                            cambios: (record.cambios || record.Cambios)?.toString() || '',
                            puestaPunto: formatForDisplay(record.tiempoPuestaPunto || record.TiempoPuestaPunto),
                            mantenimiento: formatForDisplay(record.horasMantenimiento || record.HorasMantenimiento),
                            descansos: formatForDisplay(record.horasDescanso || record.HorasDescanso),
                            otrosAux: formatForDisplay(record.horasOtrosAux || record.HorasOtrosAux),
                            faltaTrabajo: formatForDisplay(record.tiempoFaltaTrabajo || record.TiempoFaltaTrabajo),
                            reparacion: formatForDisplay(record.tiempoReparacion || record.TiempoReparacion),
                            otroMuerto: formatForDisplay(record.tiempoOtroMuerto || record.TiempoOtroMuerto),
                            desperdicio: despValor,
                            referenciaOP: record.referenciaOP || record.ReferenciaOP || '',
                            novedades: record.novedades || record.Novedades || ''
                        };
                    });
                } else {
                    return [{
                        rowId: tempRowId++,
                        day: d,
                        id: null,
                        maquinaId: maquinaIdToLoad,
                        operarioId: null,
                        horarioId: null,
                        horaInicio: '', horaFin: '', rFinal: '', horasOp: '', cambios: '', puestaPunto: '',
                        mantenimiento: '', descansos: '', otrosAux: '', faltaTrabajo: '', reparacion: '',
                        otroMuerto: '', desperdicio: '', referenciaOP: '', novedades: '',
                    }];
                }
            });

            rowIdCounter = tempRowId + 100;
            setGridData(autoAssignHorario(fillEmptyWithZeros(newGrid)));
            Alert.alert("Datos cargados", `Datos cargados para la máquina seleccionada (${dbData.length} registros)`);

        } catch (e) {
            console.error("Error loading data", e);
            Alert.alert("Error", "Error al cargar datos");
        }
    };



    const handleOpenLoadModal = async () => {
        try {
            const [opRes, maqRes] = await Promise.all([
                getOperariosConDatos(mes, anio),
                getMaquinasConDatos(mes, anio)
            ]);
            setOperariosConDatos(opRes.data || []);
            setMaquinasConDatos(maqRes.data || []);
            setModalVisible(true);
        } catch (e) {
            console.error("Error cargando datos para modal", e);
            Alert.alert("Error", "Error al consultar datos. Verifica que el backend esté corriendo.");
        }
    };

    const handleImportExcel = async () => {
        if (!selectedMaquina) {
            Alert.alert("Aviso", "Por favor, selecciona una máquina antes de importar el Excel.");
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            const formData = new FormData();

            // Enviar la máquina seleccionada como fallback si el Excel no tiene columna de máquina
            if (selectedMaquina) {
                formData.append('maquinaId', selectedMaquina);
            }

            // En web, file.file es el objeto File real. En móvil, usamos uri/name/type.
            if (Platform.OS === 'web') {
                // @ts-ignore - Assuming file is the real file object in web
                formData.append('file', file.file || file);
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name,
                    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
            }

            setLoading(true);
            const response = await api.post('produccion/importar-excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data?.preview) {
                setImportPreviewData(response.data.preview);
                setImportPreviewVisible(true);
            } else {
                Alert.alert("Éxito", response.data?.message || "Datos importados correctamente.");
                loadLists();
            }
        } catch (e) {
            console.error("Error importing excel:", e);
            const errorMsg = e.response?.data?.error || e.message || "Error desconocido";
            Alert.alert("Error", `No se pudo importar el archivo: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOperatorInPreview = (index, usuarioId) => {
        if (!usuarioId) return;
        const selectedUser = usuarios.find(u => u.id === parseInt(usuarioId));
        if (!selectedUser) return;

        const newData = [...importPreviewData];
        newData[index] = {
            ...newData[index],
            usuarioId: selectedUser.id,
            usuarioNombre: selectedUser.nombre,
            data: {
                ...newData[index].data,
                usuarioId: selectedUser.id
            }
        };
        setImportPreviewData(newData);
    };

    const handleConfirmImport = async () => {
        try {
            setLoading(true);
            const dataToSave = importPreviewData.map(item => item.data);

            // Usamos el endpoint mensual que ahora soporta detalles
            await api.post('produccion/mensual?isPartial=true', dataToSave);

            setImportPreviewVisible(false);
            setImportPreviewData([]);
            Alert.alert("Éxito", "Los datos se han guardado correctamente.");
            loadLists();
        } catch (e) {
            console.error("Error confirming import:", e);
            Alert.alert("Error", "No se pudieron guardar los datos importados.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFromModal = (item) => {
        setModalVisible(false);
        if (modalTab === 'maquina') {
            handleLoadByMachine(item.maquinaId);
        } else {
            if (item.usuarioId) setSelectedOperario(item.usuarioId);
            handleLoadData(item.maquinaId, item.usuarioId);
        }
    };

    const handleLoadByMachine = async (maquinaId) => {
        setModalVisible(false);
        setSelectedMaquina(maquinaId);

        try {
            const [res, resDesp] = await Promise.all([
                getProduccionPorMaquina(mes, anio, maquinaId),
                axios.get(`${API_URL}/desperdicio/reporte?maquinaId=${maquinaId}&mes=${mes}&anio=${anio}`).catch(e => ({ data: {} }))
            ]);
            const dbData = res.data;
            const desperdicios = resDesp.data || {};

            if ((!dbData || dbData.length === 0) && Object.keys(desperdicios).length === 0) {
                Alert.alert("No hay datos guardados para esta máquina");
                // Resetear grid pero con la máquina seleccionada
                const emptyGrid = DAYS.map((d, idx) => ({
                    rowId: idx + 1,
                    day: d,
                    maquinaId: maquinaId,
                    operarioId: null,
                    horaInicio: '', horaFin: '', rFinal: '', horasOp: '', cambios: '', puestaPunto: '',
                    mantenimiento: '', descansos: '', otrosAux: '', faltaTrabajo: '', reparacion: '',
                    otroMuerto: '', desperdicio: '', referenciaOP: '', novedades: '', id: null
                }));
                // Si hay desperdicios pero no producción, llenarlos
                if (Object.keys(desperdicios).length > 0) {
                    DAYS.forEach(d => {
                        if (desperdicios[d]) emptyGrid[d - 1].desperdicio = formatForDisplay(desperdicios[d]);
                    });
                }
                setGridData(emptyGrid);
                return;
            }

            let tempRowId = 1;
            const newGrid = DAYS.flatMap(d => {
                const dayRecords = dbData ? dbData.filter(r => {
                    const fechaStr = r.fecha.split('T')[0];
                    const dayFromDb = parseInt(fechaStr.split('-')[2], 10);
                    return dayFromDb === d;
                }) : [];

                if (dayRecords.length > 0) {
                    dayRecords.sort((a, b) => {
                        const hA = (a.horaInicio || a.HoraInicio || "00:00").substring(0, 5);
                        const hB = (b.horaInicio || b.HoraInicio || "00:00").substring(0, 5);
                        if (hA !== hB) return hA.localeCompare(hB);

                        const nameA = usuarios.find(u => u.id === (a.usuarioId || a.UsuarioId))?.nombre || "";
                        const nameB = usuarios.find(u => u.id === (b.usuarioId || b.UsuarioId))?.nombre || "";
                        return nameA.localeCompare(nameB);
                    });
                }

                // Desperdicio ahora viene agrupado por "day_operatorId" desde el backend
                const despValor = desperdicios[d] !== undefined ? formatForDisplay(desperdicios[d]) : '';

                if (dayRecords.length > 0) {
                    return dayRecords.map((record, rIdx) => {
                        // Buscar desperdicio por clave compuesta day_operatorId
                        const despKey = `${d}_${record.usuarioId}`;
                        const despOperador = desperdicios[despKey] !== undefined
                            ? formatForDisplay(desperdicios[despKey])
                            : (record.desperdicio ? formatForDisplay(record.desperdicio) : '');

                        return {
                            rowId: tempRowId++,
                            day: d,
                            id: record.id || record.Id,
                            maquinaId: maquinaId,
                            operarioId: record.usuarioId || record.UsuarioId,
                            horarioId: record.horarioId || record.HorarioId || null,
                            horaInicio: (record.horaInicio || record.HoraInicio)?.substring(0, 5) || '',
                            horaFin: (record.horaFin || record.HoraFin)?.substring(0, 5) || '',
                            rFinal: formatForDisplay(record.rendimientoFinal || record.RendimientoFinal),
                            horasOp: formatForDisplay(record.horasOperativas || record.HorasOperativas),
                            cambios: (record.cambios || record.Cambios)?.toString() || '',
                            puestaPunto: formatForDisplay(record.tiempoPuestaPunto || record.TiempoPuestaPunto),
                            mantenimiento: formatForDisplay(record.horasMantenimiento || record.HorasMantenimiento),
                            descansos: formatForDisplay(record.horasDescanso || record.HorasDescanso),
                            otrosAux: formatForDisplay(record.horasOtrosAux || record.HorasOtrosAux),
                            faltaTrabajo: formatForDisplay(record.tiempoFaltaTrabajo || record.TiempoFaltaTrabajo),
                            reparacion: formatForDisplay(record.tiempoReparacion || record.TiempoReparacion),
                            otroMuerto: formatForDisplay(record.tiempoOtroMuerto || record.TiempoOtroMuerto),
                            // Desperdicio por operario individual
                            desperdicio: despOperador,
                            referenciaOP: record.referenciaOP || record.ReferenciaOP || '',
                            novedades: record.novedades || record.Novedades || ''
                        };
                    });
                } else {
                    return [{
                        rowId: tempRowId++,
                        day: d,
                        id: null,
                        maquinaId: maquinaId,
                        operarioId: null,
                        horaInicio: '', horaFin: '', rFinal: '', horasOp: '', cambios: '', puestaPunto: '',
                        mantenimiento: '', descansos: '', otrosAux: '', faltaTrabajo: '', reparacion: '',
                        otroMuerto: '', desperdicio: despValor, referenciaOP: '', novedades: '', id: null
                    }];
                }
            });

            rowIdCounter = tempRowId + 100;
            setGridData(autoAssignHorario(fillEmptyWithZeros(newGrid)));
            Alert.alert("Datos cargados", `Datos cargados: ${dbData.length} registros (mostrando ${newGrid.length} filas)`);

        } catch (e) {
            console.error("Error cargando por máquina", e);
            Alert.alert("Error", "Error al cargar datos de la máquina");
        }
    };

    const updateDay = (dayIndex, field, value) => {
        setGridData(prevData => {
            const newData = [...prevData];
            if (newData[dayIndex]) {
                newData[dayIndex] = { ...newData[dayIndex], [field]: value };
            }
            return newData;
        });
    };

    const getMaquinaById = (id) => maquinas.find(m => m.id == id) || null;
    const getUsuarioById = (id) => usuarios.find(u => u.id == id) || null;

    const handleContextMenu = (e, rowIndex) => {
        if (Platform.OS === 'web') e.preventDefault();
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const menuWidth = 180;
        const menuHeight = 180;
        let x = e.nativeEvent?.pageX || 100;
        let y = e.nativeEvent?.pageY || 100;
        // Clamp so menu doesn't go off-screen
        if (x + menuWidth > screenWidth) x = screenWidth - menuWidth - 10;
        if (y + menuHeight > screenHeight) y = y - menuHeight;
        if (y < 10) y = 10;
        if (x < 10) x = 10;
        setContextMenu({
            visible: true,
            x: x,
            y: y,
            rowIndex: rowIndex
        });
    };

    const handleDuplicateRow = () => {
        if (contextMenu.rowIndex === null) return;
        const originalRow = gridData[contextMenu.rowIndex];
        const newRow = {
            ...originalRow,
            rowId: ++rowIdCounter,
            maquinaId: selectedMaquina || originalRow.maquinaId,
            operarioId: null,
            isDuplicate: true
        };
        const newData = [...gridData];
        newData.splice(contextMenu.rowIndex + 1, 0, newRow);
        setGridData(newData);
        setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
    };

    const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });

    const handleDeleteRow = () => {
        if (contextMenu.rowIndex === null) return;
        const row = gridData[contextMenu.rowIndex];
        if (!row.isDuplicate) {
            Alert.alert('Error', 'Solo se pueden eliminar filas duplicadas');
            closeContextMenu();
            return;
        }
        const newData = [...gridData];
        newData.splice(contextMenu.rowIndex, 1);
        setGridData(newData);
        setSelectedRowIndex(null);
        closeContextMenu();
    };

    const handleRowClick = (index) => setSelectedRowIndex(index);

    const formatNumber = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
        if (isNaN(num)) return value;
        return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
    };

    const formatForDisplay = (val) => formatNumber(val);

    // Fill empty numeric fields with '0' for rows that have data
    const fillEmptyWithZeros = (grid) => {
        const numericFields = ['rFinal', 'horasOp', 'cambios', 'puestaPunto', 'mantenimiento', 'descansos', 'otrosAux', 'faltaTrabajo', 'reparacion', 'otroMuerto', 'desperdicio'];
        return grid.map(row => {
            if (!row.operarioId) return row; // Day with no data - leave blank
            const filled = { ...row };
            numericFields.forEach(f => {
                if (filled[f] === '' || filled[f] === null || filled[f] === undefined) filled[f] = '0';
            });
            return filled;
        });
    };

    // Auto-assign horarioId based on horaInicio/horaFin for rows that have data but no horario
    const autoAssignHorario = (grid) => {
        if (!horarios || horarios.length === 0) return grid;
        // Pre-parse all horario start/end times
        const parsedHorarios = horarios.map(h => {
            const match = h.nombre.match(/(\d{1,2})(am|pm)\s*-\s*(\d{1,2})(am|pm)/i);
            if (!match) return null;
            let start = parseInt(match[1]);
            const sp = match[2].toLowerCase();
            let end = parseInt(match[3]);
            const ep = match[4].toLowerCase();
            if (sp === 'pm' && start !== 12) start += 12;
            if (sp === 'am' && start === 12) start = 0;
            if (ep === 'pm' && end !== 12) end += 12;
            if (ep === 'am' && end === 12) end = 0;
            // Handle cross-midnight shift (e.g. 10pm - 6am)
            if (end < start) end += 24;

            return { id: h.id, start, end, range: end - start };
        }).filter(h => h !== null);

        return grid.map(row => {
            // Skip if no data, or already has horario assigned
            if (!row.operarioId || row.horarioId) return row;
            if (!row.horaInicio || !row.horaFin || row.horaInicio.length < 4 || row.horaFin.length < 4) return row;

            // Parse row hours
            const [hI, mI] = row.horaInicio.split(':').map(Number);
            const [hF, mF] = row.horaFin.split(':').map(Number);

            if (isNaN(hI) || isNaN(hF)) return row;

            let rowStart = hI + (mI || 0) / 60;
            let rowEnd = hF + (mF || 0) / 60;

            // Handle tasks crossing midnight
            if (rowEnd < rowStart) rowEnd += 24;

            // Find horarios that CONTAIN both horaInicio and horaFin
            // Condition: horarioStart <= rowStart AND rowEnd <= horarioEnd
            const matches = parsedHorarios.filter(h => rowStart >= h.start && rowEnd <= h.end);

            if (matches.length > 0) {
                // Pick the most specific (smallest range)
                matches.sort((a, b) => a.range - b.range);
                return { ...row, horarioId: matches[0].id };
            }

            // Fallback: find horario whose END time contains rowEnd (if it ends within the shift)
            const endMatches = parsedHorarios.filter(h => rowEnd <= h.end && rowEnd > h.start);
            if (endMatches.length > 0) {
                endMatches.sort((a, b) => a.range - b.range);
                return { ...row, horarioId: endMatches[0].id };
            }

            return row;
        });
    };

    const parseNumberInput = (v) => {
        if (v === undefined || v === null || v === '') return 0;
        if (typeof v === 'number') return v;
        let s = v.toString().replace(/\./g, '').replace(',', '.');
        let n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    };

    const calculateDurationHours = (start, end) => {
        if (!start || !end) return 0;
        try {
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;
            let diff = endMins - startMins;
            if (diff < 0) diff += 1440; // Over midnight
            return diff / 60;
        } catch { return 0; }
    };

    const mapActivityToField = (actName) => {
        const name = actName.toLowerCase();
        if (name.includes('producc')) return 'horasOp';
        if (name.includes('puesta a punto')) return 'puestaPunto';
        if (name.includes('mantenimiento')) return 'mantenimiento';
        if (name.includes('descanso') || name.includes('alimento')) return 'descansos';
        if (name.includes('falta de trabajo')) return 'faltaTrabajo';
        if (name.includes('reparaci')) return 'reparacion';
        if (name.includes('tiempo muerto')) return 'otroMuerto';
        if (name.includes('otros tiempo') || name.includes('otros auxiliar')) return 'otrosAux';
        if (name.includes('desperdicio')) return 'desperdicio';
        return null;
    };

    const parseNumber = (value) => {
        if (!value) return '';
        return value.replace(/\./g, '').replace(',', '.');
    };

    const handleNumericInput = (index, field, value) => {
        // Remove all dots (thousand separators) and non-numeric chars except comma for decimals
        let cleaned = value.replace(/\./g, '').replace(/[^0-9,]/g, '');

        // Split by comma to handle decimal part separately
        const parts = cleaned.split(',');
        let integerPart = parts[0] || '';
        const decimalPart = parts[1];

        // Add thousand separators to integer part
        if (integerPart.length > 3) {
            integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }

        // Reconstruct the value
        const formatted = decimalPart !== undefined
            ? `${integerPart},${decimalPart}`
            : integerPart;

        updateDay(index, field, formatted);
    };

    const getDisplayTime = (time24) => {
        if (!time24) return '';
        // Simplemente devolver lo que hay, o formatear si es necesario.
        return time24;
    };

    const handleTimeInput = (dayIndex, field, text) => {
        setGridData(prevData => {
            const newData = [...prevData];
            if (newData[dayIndex]) {
                const updatedRow = { ...newData[dayIndex], [field]: text };
                // Hora inicio y hora fin son solo informativos, NO calculan horasOp automáticamente
                // Las horas operativas deben ingresarse manualmente por el usuario
                newData[dayIndex] = updatedRow;
            }
            return newData;
        });
    };



    // ========== FESTIVOS COLOMBIA ==========

    // Calcular Pascua usando algoritmo de Gauss
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
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mes = Math.floor((h + l - 7 * m + 114) / 31);
        const dia = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, mes - 1, dia);
    };

    // Trasladar al lunes siguiente (Ley Emiliani)
    const trasladarALunes = (fecha) => {
        const diaSemana = fecha.getDay();
        if (diaSemana === 1) return fecha; // Ya es lunes
        const diasHastaLunes = (1 - diaSemana + 7) % 7 || 7;
        return new Date(fecha.getTime() + diasHastaLunes * 24 * 60 * 60 * 1000);
    };

    // Obtener festivos de Colombia para un año
    const obtenerFestivosColombia = (year) => {
        const festivos = [];

        // Festivos fijos
        festivos.push(new Date(year, 0, 1));   // Año Nuevo
        festivos.push(new Date(year, 4, 1));   // Día del Trabajo
        festivos.push(new Date(year, 6, 20));  // Grito de Independencia
        festivos.push(new Date(year, 7, 7));   // Batalla de Boyacá
        festivos.push(new Date(year, 11, 8));  // Inmaculada Concepción
        festivos.push(new Date(year, 11, 25)); // Navidad

        // Pascua y festivos basados en Pascua
        const pascua = calcularPascua(year);
        festivos.push(new Date(pascua.getTime() - 3 * 24 * 60 * 60 * 1000)); // Jueves Santo
        festivos.push(new Date(pascua.getTime() - 2 * 24 * 60 * 60 * 1000)); // Viernes Santo
        festivos.push(trasladarALunes(new Date(pascua.getTime() + 39 * 24 * 60 * 60 * 1000))); // Ascensión
        festivos.push(trasladarALunes(new Date(pascua.getTime() + 60 * 24 * 60 * 60 * 1000))); // Corpus Christi
        festivos.push(trasladarALunes(new Date(pascua.getTime() + 68 * 24 * 60 * 60 * 1000))); // Sagrado Corazón

        // Festivos con Ley Emiliani
        festivos.push(trasladarALunes(new Date(year, 0, 6)));   // Reyes Magos
        festivos.push(trasladarALunes(new Date(year, 2, 19)));  // San José
        festivos.push(trasladarALunes(new Date(year, 5, 29)));  // San Pedro y San Pablo
        festivos.push(trasladarALunes(new Date(year, 7, 15)));  // Asunción de la Virgen
        festivos.push(trasladarALunes(new Date(year, 9, 12)));  // Día de la Raza
        festivos.push(trasladarALunes(new Date(year, 10, 1)));  // Todos los Santos
        festivos.push(trasladarALunes(new Date(year, 10, 11))); // Independencia de Cartagena

        return festivos;
    };

    // Verificar si una fecha es festivo
    const esFestivoColombia = (fecha) => {
        const festivos = obtenerFestivosColombia(fecha.getFullYear());
        return festivos.some(f =>
            f.getDate() === fecha.getDate() &&
            f.getMonth() === fecha.getMonth() &&
            f.getFullYear() === fecha.getFullYear()
        );
    };

    // ========== FIN FESTIVOS COLOMBIA ==========

    // ========== OP SEARCH & DAY DETAIL HANDLERS ==========

    const handleOpenOPSearch = async () => {
        setLoadingOPs(true);
        setOpSearchModalVisible(true);
        try {
            const res = await api.get('produccion/ops-unicos'); // This endpoint returns distinct OPs
            setOpList(res.data || []);
        } catch (e) {
            console.error('Error fetching OP list:', e);
        } finally {
            setLoadingOPs(false);
        }
    };

    const handleSelectOP = async (op) => {
        setOpSearchModalVisible(false);
        setSelectedOP(op);
        setLoadingOPs(true);
        try {
            const res = await api.get(`produccion/buscar-op/${encodeURIComponent(op)}`);
            console.log("[DEBUG] OP Search results:", res.data);
            setOpResults(res.data || []);
            setOpResultsModalVisible(true);
        } catch (e) {
            console.error('Error searching OP:', e);
            Alert.alert('Error', 'No se pudo buscar la OP');
        } finally {
            setLoadingOPs(false);
        }
    };

    const formatDateOP = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const handleOpenDayDetail = async (index) => {
        const row = gridData[index];
        if (!selectedMaquina) {
            Alert.alert("Error", "Seleccione una máquina primero");
            return;
        }
        const maquina = getMaquinaById(selectedMaquina);
        const operario = getUsuarioById(row.operarioId);
        const mesNombre = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][mes - 1];
        const fechaStr = `${row.day} de ${mesNombre} de ${anio}`;

        setDayDetailInfo({
            rowIndex: index,
            day: row.day,
            produccionDiariaId: row.id,
            maquinaId: selectedMaquina,
            usuarioId: row.operarioId,
            maquina: maquina ? maquina.nombre : 'N/A',
            operario: operario ? operario.nombre : (row.operarioId ? `ID: ${row.operarioId}` : 'N/A'),
            fecha: fechaStr,
            fechaISO: `${anio}-${mes.toString().padStart(2, '0')}-${row.day.toString().padStart(2, '0')}`
        });
        setDayDetailModalVisible(true);
    };

    const handleDayDetailSaved = async (details, newId) => {
        if (!dayDetailInfo) return;
        const rowIndex = dayDetailInfo.rowIndex;
        const currentRow = gridData[rowIndex];

        // Sort details by start time
        const sortedDetails = [...details].sort((a, b) => {
            const timeA = a.horaInicio || "00:00";
            const timeB = b.horaInicio || "00:00";
            return timeA.localeCompare(timeB);
        });

        const sums = {
            tiros: 0,
            horasOp: 0,
            puestaPunto: 0,
            mantenimiento: 0,
            descansos: 0,
            otrosAux: 0,
            faltaTrabajo: 0,
            reparacion: 0,
            otroMuerto: 0,
            desperdicio: 0,
            totalPuestaPunto: 0
        };

        const opsList = [];
        let lastOP_conc = null;

        // Initialize lastOP context from previous grid rows
        let lastOP = null;
        for (let i = rowIndex - 1; i >= 0; i--) {
            if (gridData[i].referenciaOP) {
                const parts = gridData[i].referenciaOP.toString().split('-');
                lastOP = parts[parts.length - 1].trim();
                break;
            }
        }

        let totalCambios = 0;

        sortedDetails.forEach(d => {
            const h = calculateDurationHours(d.horaInicio, d.horaFin);
            const actId = d.actividadId;
            const activity = actividades.find(a => a.id === Number(actId));
            const actName = activity ? activity.nombre.toLowerCase() : '';
            const field = mapActivityToField(actName);

            if (field) {
                if (field === 'desperdicio') sums[field] += parseNumberInput(d.tiros);
                else if (field === 'horasOp') {
                    sums[field] += h;
                    sums.tiros += parseNumberInput(d.tiros);
                }
                else sums[field] += h;
            }

            const currentOP = (d.referenciaOP || "").toString().trim();

            if (actName.includes('puesta a punto')) {
                if (currentOP !== lastOP && currentOP !== "460" && currentOP !== "") {
                    totalCambios++;
                }
                lastOP = currentOP;
            } else if (actName.includes('producc')) {
                lastOP = currentOP;
            }

            // Concatenation logic: sequential only
            if (currentOP && currentOP !== lastOP_conc) {
                opsList.push(currentOP);
                lastOP_conc = currentOP;
            }
        });

        // Auto-fill horaInicio and horaFin from first/last activity
        let horaInicioDetalle = currentRow.horaInicio || '';
        let horaFinDetalle = currentRow.horaFin || '';
        if (sortedDetails.length > 0) {
            const firstActivity = sortedDetails[0];
            const lastActivity = sortedDetails[sortedDetails.length - 1];
            if (firstActivity.horaInicio) horaInicioDetalle = firstActivity.horaInicio.substring(0, 5);
            if (lastActivity.horaFin) horaFinDetalle = lastActivity.horaFin.substring(0, 5);
        }

        const updatedRow = {
            ...currentRow,
            id: newId || currentRow.id,
            horaInicio: horaInicioDetalle,
            horaFin: horaFinDetalle,
            rFinal: sums.tiros.toString(),
            horasOp: formatForDisplay(sums.horasOp),
            cambios: totalCambios.toString(),
            puestaPunto: formatForDisplay(sums.puestaPunto),
            mantenimiento: formatForDisplay(sums.mantenimiento),
            descansos: formatForDisplay(sums.descansos),
            otrosAux: formatForDisplay(sums.otrosAux),
            faltaTrabajo: formatForDisplay(sums.faltaTrabajo),
            reparacion: formatForDisplay(sums.reparacion),
            otroMuerto: formatForDisplay(sums.otroMuerto),
            desperdicio: formatForDisplay(sums.desperdicio),
            referenciaOP: opsList.join('-'),
            novedades: sortedDetails.map(d => d.observaciones).filter(o => o && o.trim()).join(' | ')
        };

        const newData = [...gridData];
        newData[rowIndex] = updatedRow;
        setGridData(newData);
    };

    // ========== FIN HANDLERS ==========

    // Parse horario name like '7am - 4pm' into { start: 7, end: 16 }
    const parseHorarioName = (nombre) => {
        if (!nombre) return null;
        const match = nombre.match(/(\d{1,2})(am|pm)\s*-\s*(\d{1,2})(am|pm)/i);
        if (!match) return null;
        let start = parseInt(match[1]);
        const startPeriod = match[2].toLowerCase();
        let end = parseInt(match[3]);
        const endPeriod = match[4].toLowerCase();
        if (startPeriod === 'pm' && start !== 12) start += 12;
        if (startPeriod === 'am' && start === 12) start = 0;
        if (endPeriod === 'pm' && end !== 12) end += 12;
        if (endPeriod === 'am' && end === 12) end = 0;
        return { start, end };
    };

    // Función para calcular el porcentaje de tiempo dentro del horario laboral
    const calcularPorcentajeBonificable = (day) => {
        if (!day.horaInicio || !day.horaFin || day.horaInicio.length < 5 || day.horaFin.length < 5) {
            return 1; // Sin horas = asumimos 100% bonificable
        }

        // Calcular día de la semana para el día dado
        const fecha = new Date(anio, mes - 1, day.day);
        const diaSemana = fecha.getDay();

        // Domingo o Festivo -> No bonificable
        if (diaSemana === 0 || esFestivoColombia(fecha)) return 0;

        // Usar el horario seleccionado en el picker si existe
        let horaInicioLaboral, horaFinLaboral;
        if (day.horarioId) {
            const horarioObj = horarios.find(h => h.id === day.horarioId || String(h.id) === String(day.horarioId));
            const parsed = horarioObj ? parseHorarioName(horarioObj.nombre) : null;
            if (parsed) {
                horaInicioLaboral = parsed.start;
                horaFinLaboral = parsed.end;
            } else {
                // Fallback: hardcoded
                horaInicioLaboral = diaSemana === 6 ? 8 : 7;
                horaFinLaboral = diaSemana === 6 ? 12 : 16;
            }
        } else {
            // Sin horario seleccionado: usar defaults
            horaInicioLaboral = diaSemana === 6 ? 8 : 7;
            horaFinLaboral = diaSemana === 6 ? 12 : 16;
        }

        // Parsear horas del registro
        const [hI, mI] = day.horaInicio.split(':').map(Number);
        const [hF, mF] = day.horaFin.split(':').map(Number);
        const horaInicioReg = hI + (mI / 60);
        const horaFinReg = hF + (mF / 60);

        // Si las horas son exactamente 00:00 - 00:00 -> Tratar como "horas no registradas" -> 100% bonificable
        if (horaInicioReg === 0 && horaFinReg === 0) {
            return 1;
        }

        // Si termina antes del inicio laboral o empieza después del fin laboral -> 0%
        if (horaFinReg <= horaInicioLaboral || horaInicioReg >= horaFinLaboral) {
            return 0;
        }

        // Calcular horas totales trabajadas
        const horasTotales = horaFinReg - horaInicioReg;
        if (horasTotales <= 0) return 0;

        // Calcular horas dentro del horario laboral
        const inicioEfectivo = Math.max(horaInicioReg, horaInicioLaboral);
        const finEfectivo = Math.min(horaFinReg, horaFinLaboral);
        const horasBonificables = Math.max(0, finEfectivo - inicioEfectivo);

        // Retornar porcentaje
        return horasBonificables / horasTotales;
    };

    const calculateRow = (day) => {
        const maquinaId = day.maquinaId || selectedMaquina;
        const rowMaquina = getMaquinaById(maquinaId);
        if (!rowMaquina) return {};

        const R_Final = parseNumberInput(day.rFinal);
        const Cambios = parseNumberInput(day.cambios);
        const HorasOp = parseNumberInput(day.horasOp);
        const PuestaPunto = parseNumberInput(day.puestaPunto);
        const MantAseo = parseNumberInput(day.mantenimiento);
        const Descansos = parseNumberInput(day.descansos);
        const OtrosAux = parseNumberInput(day.otrosAux);
        const FaltaTrabajo = parseNumberInput(day.faltaTrabajo);
        const Reparacion = parseNumberInput(day.reparacion);
        const OtroMuerto = parseNumberInput(day.otroMuerto);
        const Desperdicio = parseNumberInput(day.desperdicio);

        // Inicializar fecha para validaciones laborales (necesario para esFestivo y bonificación)
        const fecha = new Date(anio, mes - 1, day.day);
        const diaSemana = fecha.getDay(); // 0 = Domingo, 6 = Sábado

        // Calcular Meta Rendimiento (Por Hora)

        // Obtener Meta Base (preferir Meta100Porciento si está disponible, sino MetaRendimiento, sino default)
        // Nota: en getMaquinas, la propiedad suele ser metaRendimiento. Si existe meta100Porciento, usarla.
        let MetaBase = rowMaquina.meta100Porciento || rowMaquina.metaRendimiento || 0;

        // Calcular Total Horas (Productivas + Aux + Muertos) - Consolidados para uso global
        const TotalHorasProd = HorasOp + PuestaPunto;
        const TotalAux = MantAseo + Descansos + OtrosAux;
        const TotalMuertos = FaltaTrabajo + Reparacion + OtroMuerto;
        const TotalHoras = TotalHorasProd + TotalAux + TotalMuertos;

        // NUEVA LÓGICA: Meta = (MetaBase / 8) * TotalHorasTrabajadas
        // Esto maneja automáticamente días parciales, sábados, etc.
        let MetaPorHora = MetaBase > 0 ? (MetaBase / 8) : 0;
        let MetaRendimiento = MetaPorHora * TotalHoras;

        // Si Horas son 0, Meta es 0 (correcto)

        const TirosRef = rowMaquina.tirosReferencia || 0;
        const TirosEquivalentes = (TirosRef * Cambios) + R_Final;

        // Promedio Productivo (Tiros / Horas PRODUCTIVAS)
        const Promedio = TotalHorasProd > 0 ? (TirosEquivalentes / TotalHorasProd) : 0;

        // Calcular diferencia de meta (Meta del 75% es MetaRendimiento aqui?? No, MetaRendimiento es el 100%)
        // El grid mostraba "75% Meta".
        // Si MetaRendimiento es el 100%, entonces Meta75 = MetaRendimiento * 0.75

        // En la lógica anterior:
        // const Meta75Diff = TirosEquivalentes - MetaRendimiento;
        // Si MetaRendimiento era la meta "esperada" para bonificar (que suele ser el 75% del 100%?),
        // El usuario dijo "dividieindo la meta 100% entre 8... para sacar rendimiento general".
        // Asumimos que MetaRendimiento calculado arriba es el 100%.

        const Meta75 = MetaRendimiento * 0.75;
        const Meta75Diff = TirosEquivalentes - Meta75; // Excedente sobre el 75%

        // *** NUEVO: Verificar si es festivo o domingo ***
        // fecha and diaSemana already declared above for Saturday logic
        const esFestivo = esFestivoColombia(fecha);
        const esDomingo = diaSemana === 0;
        const esNoLaborable = esFestivo || esDomingo;

        // VrPagar = 0 si es festivo o domingo
        let VrPagar;
        if (esNoLaborable) {
            VrPagar = 0;
        } else {
            const VrTiro = Math.max(0, Meta75Diff * (rowMaquina.valorPorTiro || 0));
            VrPagar = VrTiro;
        }

        // (Variables TotalAux, TotalMuertos, TotalHoras calculated at top)

        // Calcular valores bonificables (proporcional al tiempo en horario laboral)
        const porcentajeBonif = calcularPorcentajeBonificable(day);

        // TIROS BONIFICABLES: Tiros Totales * %TiempoEnHorario (OK)
        const TirosBonificables = Math.round(TirosEquivalentes * porcentajeBonif);
        const DesperdicioBonif = Desperdicio * porcentajeBonif;

        // META BONIFICABLE: Usar Meta75 como base para el cálculo de bonificación
        // El usuario mencionó "75% Bonificable".
        // Meta75DiffBonif = TirosBonificables - Meta75
        const Meta75DiffBonif = TirosBonificables - Meta75;

        // VrPagarBonif = 0 si es festivo o domingo
        const VrPagarBonif = esNoLaborable ? 0 : Math.max(0, Meta75DiffBonif * (rowMaquina.valorPorTiro || 0));

        return {
            TirosEquivalentes, TotalHorasProd, Promedio, Meta75Diff, VrPagar,
            TotalAux, TotalMuertos, TotalHoras,
            // Nuevos campos bonificables
            PorcentajeBonif: porcentajeBonif,
            TirosBonificables,
            Meta75DiffBonif,
            VrPagarBonif,
            MetaRendimiento: Meta75, // Retornar Meta75 para que la columna "75% Meta" muestre el valor correcto
            // Flag para indicar día no laborable
            esNoLaborable
        };
    };

    const handleSaveMonth = async () => {
        const dataToSave = [];
        const missingHours = [];
        const missingOperario = [];

        console.log("[DEBUG] Starting handleSaveMonth");
        console.log("[DEBUG] gridData sample:", gridData[0]);

        gridData.forEach((day, idx) => {
            const calcs = calculateRow(day);
            // Determine if row has ANY content worth saving
            const hasData = calcs.TotalHoras > 0 ||
                (day.operarioId !== null && day.operarioId !== undefined) ||
                (day.rFinal && parseFloat(day.rFinal) > 0) ||
                (day.desperdicio && parseFloat(day.desperdicio) > 0) ||
                (day.novedades && day.novedades.trim().length > 0) ||
                (day.referenciaOP && day.referenciaOP.trim().length > 0);

            if (hasData) {
                if (!day.operarioId) {
                    missingOperario.push(`Día ${day.day}: Falta Operario`);
                    return;
                }
                const dateStr = `${anio}-${mes.toString().padStart(2, '0')}-${day.day.toString().padStart(2, '0')}`;

                const fmtTime = (t) => t && t.length ? (t.length === 5 ? t + ":00" : "00:00:00") : "00:00:00";
                const rowMaq = getMaquinaById(selectedMaquina);

                dataToSave.push({
                    Fecha: dateStr,
                    UsuarioId: day.operarioId,
                    MaquinaId: parseInt(selectedMaquina),
                    HorarioId: day.horarioId || null,
                    HoraInicio: fmtTime(day.horaInicio),
                    HoraFin: fmtTime(day.horaFin),
                    HorasOperativas: parseNumberInput(day.horasOp),
                    RendimientoFinal: parseNumberInput(day.rFinal),
                    Cambios: parseInt(day.cambios) || 0,
                    TiempoPuestaPunto: parseNumberInput(day.puestaPunto),
                    TirosDiarios: parseNumberInput(day.rFinal),  // R.Final raw input, NOT TirosEquivalentes
                    TotalHorasProductivas: calcs.TotalHorasProd,
                    PromedioHoraProductiva: calcs.Promedio,
                    ValorTiroSnapshot: rowMaq?.valorPorTiro || 0,
                    ValorAPagar: calcs.VrPagar,
                    HorasMantenimiento: parseNumberInput(day.mantenimiento),
                    HorasDescanso: parseNumberInput(day.descansos),
                    HorasOtrosAux: parseNumberInput(day.otrosAux),
                    TiempoFaltaTrabajo: parseNumberInput(day.faltaTrabajo),
                    TiempoReparacion: parseNumberInput(day.reparacion),
                    TiempoOtroMuerto: parseNumberInput(day.otroMuerto),
                    ReferenciaOP: day.referenciaOP || "",
                    Novedades: day.novedades || "",
                    Desperdicio: parseNumberInput(day.desperdicio),
                    TirosBonificables: calcs.TirosBonificables || 0,
                    DesperdicioBonificable: (calcs.DesperdicioBonif || 0),
                    ValorAPagarBonificable: calcs.VrPagarBonif || 0,
                    DiaLaborado: 1
                });
            }
        });

        if (missingOperario.length > 0) {
            Alert.alert("Falta operario", missingOperario.join("\n"));
        }

        if (dataToSave.length === 0) {
            // Si no hay datos, significa que el usuario quiere borrar todo lo de este mes/máquina
            Alert.alert(
                "Borrar todo",
                "No hay datos en la tabla. ¿Desea eliminar toda la información de este mes para la máquina seleccionada?",
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Eliminar Todo",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                setLoading(true);
                                await axios.delete(`${API_URL}/produccion/borrar?mes=${mes}&anio=${anio}&maquinaId=${selectedMaquina}`);
                                setLoading(false);
                                Alert.alert("Éxito", "Se han eliminado todos los registros del mes.");
                                resetGrid();
                            } catch (error) {
                                setLoading(false);
                                console.error(error);
                                Alert.alert("Error", "Error al borrar registros.");
                            }
                        }
                    }
                ]
            );
            return;
        }

        try {
            setLoading(true);

            // Enviar todos los datos juntos para reemplazo total (sincronización)
            // Esto asegura que si se borraron días en el grid, se borren en BD
            console.log("[DEBUG] Sending payload to /produccion/mensual:", JSON.stringify(dataToSave, null, 2));
            await axios.post(`${API_URL}/produccion/mensual`, dataToSave);
            console.log("[DEBUG] Save successful");

            setLoading(false);
            Alert.alert("Éxito", "Toda la información ha sido guardada y sincronizada.");

            // Opcional: Recargar datos para verificar (pero resetGrid limpia todo)
            resetGrid();

        } catch (error) {
            setLoading(false);
            console.error("[DEBUG] Save error:", error);
            if (error.response) {
                console.error("[DEBUG] Response data:", error.response.data);
                console.error("[DEBUG] Response status:", error.response.status);
            }
            const msg = error.response?.data?.message || error.message || "Error desconocido";
            Alert.alert("Error", `Fallo al guardar mes: ${msg}`);
        }
    };


    const handleOpenExportModal = async () => {
        try {
            const response = await api.get(`produccion/periodos-disponibles`);
            const data = response.data;
            setPeriodosDisponibles(data);
            if (data.length > 0) {
                setExportMes(data[0].mes);
                setExportAnio(data[0].anio);
            }
            setExportModalVisible(true);
        } catch (e) {
            console.error("Error cargando periodos", e);
            Alert.alert("Error", "Error al cargar periodos disponibles");
        }
    };
    const getMesNombre = (m) => ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][m] || '';

    const handleExport = async () => {
        try {
            const response = await api.get(`produccion/historial`, {
                params: {
                    fechaInicio: `${exportAnio}-${String(exportMes).padStart(2, '0')}-01`,
                    fechaFin: `${exportAnio}-${String(exportMes).padStart(2, '0')}-31`
                }
            });
            const data = response.data;
            if (!data || data.length === 0) {
                Alert.alert("Aviso", "No hay datos para exportar");
                return;
            }
            // Add platform specific download logic if needed. keeping it simple for now.
            Alert.alert("Info", "Funcionalidad de exportación limitada en móvil. Verifica en web si no descarga.");
            setExportModalVisible(false);
        } catch (e) {
            console.error("Error exportando", e);
            Alert.alert("Error", "Error al exportar datos");
        }
    };

    const handleOpenDeleteModal = async () => {
        try {
            setDeleteModalVisible(true);
            const [opRes, maqRes] = await Promise.all([
                getOperariosConDatos(mes, anio),
                getMaquinasConDatos(mes, anio)
            ]);
            setOperariosConDatos(opRes.data || []);
            setMaquinasConDatos(maqRes.data || []);
        } catch (e) {
            Alert.alert("Error", "Error al cargar lista de datos");
        }
    };

    const confirmDelete = async (id, type) => {
        const confirmMsg = "Confirmar eliminación?";
        if (Platform.OS === 'web') {
            if (!window.confirm(confirmMsg)) return;
        } else {
            // Mobile alert logic would go here, skipping for brevity in reconstruction
        }

        setIsDeleting(true);
        try {
            const params = { mes, anio };
            if (type === 'maquina') params.maquinaId = id;
            else params.usuarioId = id;

            const response = await api.delete(`produccion/borrar`, {
                params: { mes, anio, ... (type === 'maquina' ? { maquinaId: id } : { usuarioId: id }) }
            });

            if (response.status === 200 || response.status === 204) {
                Alert.alert("Éxito", "Datos eliminados");
                handleOpenDeleteModal();
                if ((type === 'maquina' && selectedMaquina === id) || (type === 'operario' && selectedOperario === id)) {
                    resetGrid();
                }
            } else {
                Alert.alert("Error", "No se pudo borrar");
            }
        } catch (e) {
            Alert.alert("Error", "Error de conexión");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCleanFields = () => {
        setCleanConfirmVisible(true);
    };

    const confirmClean = () => {
        const cleanedGrid = gridData.map(row => ({
            ...row,
            horaInicio: '', horaFin: '', rFinal: '', horasOp: '', cambios: '', puestaPunto: '',
            mantenimiento: '', descansos: '', otrosAux: '', faltaTrabajo: '', reparacion: '',
            otroMuerto: '', desperdicio: '', referenciaOP: '', novedades: '', operarioId: null
        }));
        setGridData(cleanedGrid);
        setCleanConfirmVisible(false);
    };

    return (
        <View style={styles.container} onTouchEnd={closeContextMenu}>
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                </View>
                <View style={{ flexDirection: 'column', gap: 10 }}>
                    <View style={styles.row}>
                        <Text style={{ marginRight: 5 }}>Mes:</Text>
                        <View style={[styles.pickerContainerSmall, { flex: 1 }]}>
                            <Picker selectedValue={mes} onValueChange={(v) => setMes(parseInt(v))} style={styles.picker} mode="dropdown">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <Picker.Item key={m} label={getMesNombre(m)} value={m} style={{ fontSize: 12 }} />)}
                            </Picker>
                        </View>
                        <Text style={{ marginHorizontal: 5 }}>Año:</Text>
                        <View style={[styles.pickerContainerSmall, { width: 100 }]}>
                            <Picker selectedValue={anio} onValueChange={(v) => setAnio(parseInt(v))} style={styles.picker} mode="dropdown">
                                {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <Picker.Item key={y} label={y.toString()} value={y} style={{ fontSize: 12 }} />)}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.row}>
                        <Text style={{ marginRight: 5 }}>Máquina:</Text>
                        <View style={[styles.pickerContainerLarge, { flex: 1, width: undefined }]}>
                            <Picker selectedValue={selectedMaquina || ''} onValueChange={(v) => { if (v) { setSelectedMaquina(v); handleLoadData(v); } }} style={styles.picker} mode="dropdown">
                                <Picker.Item label="-- Seleccionar Máquina --" value="" style={{ fontSize: 12 }} />
                                {maquinas.map(m => <Picker.Item key={m.id} label={m.nombre} value={m.id} style={{ fontSize: 12 }} />)}
                            </Picker>
                        </View>
                    </View>

                    <View style={[styles.row, { justifyContent: 'space-between' }]}>
                        <TouchableOpacity style={[styles.btnLoad, { flex: 1, marginRight: 5 }]} onPress={handleOpenLoadModal}>
                            <Text style={styles.btnText}>CARGAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnLoad, { backgroundColor: '#28a745', flex: 1, marginRight: 5 }]} onPress={handleOpenExportModal}>
                            <Text style={styles.btnText}>Exp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnLoad, { marginRight: 10, backgroundColor: '#3498db' }]} onPress={handleImportExcel}>
                            <Text style={styles.btnText}>Importar Excel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnLoad, { marginRight: 10, backgroundColor: '#8e44ad' }]} onPress={handleOpenOPSearch}>
                            <Text style={styles.btnText}>Buscar OP</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnLoad, { backgroundColor: '#e74c3c', marginRight: 10 }]} onPress={handleOpenDeleteModal}>
                            <Text style={styles.btnText}>Borrar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnLoad, { backgroundColor: '#f1c40f', flex: 1 }]} onPress={handleCleanFields}>
                            <Text style={styles.btnText}>Limp</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Leyenda de colores */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 8, backgroundColor: colors.background, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                    <View style={{ width: 16, height: 16, backgroundColor: '#FFE0B2', marginRight: 5, borderRadius: 3, borderWidth: 1, borderColor: '#FFB74D' }} />
                    <Text style={{ fontSize: 11, color: colors.text }}>Festivo</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                    <View style={{ width: 16, height: 16, backgroundColor: '#CFD8DC', marginRight: 5, borderRadius: 3, borderWidth: 1, borderColor: '#B0BEC5' }} />
                    <Text style={{ fontSize: 11, color: colors.text }}>Domingo</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                    <View style={{ width: 16, height: 16, backgroundColor: '#C8E6C9', marginRight: 5, borderRadius: 3, borderWidth: 1, borderColor: '#A5D6A7' }} />
                    <Text style={{ fontSize: 11, color: colors.text }}>Sábado</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 16, height: 16, backgroundColor: colors.rowEven, marginRight: 5, borderRadius: 3, borderWidth: 1, borderColor: '#ddd' }} />
                    <Text style={{ fontSize: 11, color: colors.text }}>L-V Normal</Text>
                </View>
            </View>

            <ScrollView horizontal style={{ backgroundColor: colors.background }}>
                <View>
                    {/* HEADER ROW */}
                    <View style={[styles.row, styles.headerRow, { backgroundColor: colors.headerBackground }]}>
                        <Text style={[styles.cell, { width: 30 }]}>D</Text>
                        <Text style={[styles.cell, { width: 150 }]}>Operario</Text>
                        <Text style={[styles.cell, { width: 100 }]}>Horario</Text>
                        <Text style={[styles.cell, styles.timeCell]}>Inicio</Text>
                        <Text style={[styles.cell, styles.timeCell]}>Fin</Text>
                        <Text style={[styles.cell]}>R. Final</Text>
                        <Text style={[styles.cell]}>H. Oper</Text>
                        <Text style={[styles.cell]}>Cambios</Text>
                        <Text style={[styles.cell]}>P. Punto</Text>
                        <Text style={[styles.cell, styles.calc]}>Tiros Eq</Text>
                        <Text style={[styles.cell, styles.calc]}>T.H.Prod</Text>
                        <Text style={[styles.cell, styles.calc]}>Promedio</Text>
                        {/* Columnas Bonificables */}
                        <Text style={[styles.cell, styles.bonif]}>T.Bonif</Text>
                        <Text style={[styles.cell, styles.bonif]}>75%Bonif</Text>
                        <Text style={[styles.cell, styles.bonif]}>VrBonif</Text>
                        {/* Columnas Totales */}
                        <Text style={[styles.cell, styles.calc]}>75% Meta</Text>
                        <Text style={[styles.cell, styles.calc]}>Vr Pagar</Text>
                        <Text style={[styles.cell]}>Mant/Aseo</Text>
                        <Text style={[styles.cell]}>Descanso</Text>
                        <Text style={[styles.cell]}>Otros</Text>
                        <Text style={[styles.cell, styles.calc]}>T.H.Aux</Text>
                        <Text style={[styles.cell]}>F. Trab</Text>
                        <Text style={[styles.cell]}>Repar</Text>
                        <Text style={[styles.cell]}>Otros M.</Text>
                        <Text style={[styles.cell, styles.calc]}>T.Muer</Text>
                        <Text style={[styles.cell, styles.total]}>T. Horas</Text>
                        <Text style={[styles.cell]}>Desperdicio</Text>
                        <Text style={[styles.cell, { width: 100 }]}>OP / Ref</Text>
                        <Text style={[styles.cell, { width: 100 }]}>Novedades</Text>
                    </View>

                    <FlatList
                        data={gridData}
                        keyExtractor={(item) => item.rowId.toString()}
                        initialNumToRender={8}
                        maxToRenderPerBatch={5}
                        windowSize={5}
                        removeClippedSubviews={false}
                        renderItem={({ item: day, index }) => {
                            const calcs = calculateRow(day);
                            const isSelected = selectedRowIndex === index;

                            // Determinar color de fila según tipo de día
                            const fecha = new Date(anio, mes - 1, day.day);
                            const diaSemana = fecha.getDay();
                            const esFestivo = esFestivoColombia(fecha);

                            let rowColor;
                            if (isSelected) {
                                rowColor = colors.rowHover;
                            } else if (esFestivo) {
                                rowColor = '#FFE0B2'; // Naranja suave - Festivo
                            } else if (diaSemana === 0) {
                                rowColor = '#CFD8DC'; // Gris azulado - Domingo
                            } else if (diaSemana === 6) {
                                rowColor = '#C8E6C9'; // Verde menta - Sábado
                            } else {
                                rowColor = index % 2 === 0 ? colors.rowEven : colors.rowOdd;
                            }

                            return (
                                <View style={[styles.row, { backgroundColor: rowColor }]}>
                                    <TouchableOpacity onPress={() => handleRowClick(index)} onLongPress={(e) => handleContextMenu(e, index)}>
                                        <Text style={[styles.cell, { width: 30 }]}>{day.day}</Text>
                                    </TouchableOpacity>
                                    <View style={[styles.pickerCell]}>
                                        <Picker selectedValue={day.operarioId || ''} enabled={!!selectedMaquina} onValueChange={(v) => updateDay(index, 'operarioId', v ? parseInt(v) : null)} style={styles.pickerSmall}>
                                            <Picker.Item label="--" value="" />
                                            {usuarios.map(u => <Picker.Item key={u.id} label={u.nombre} value={u.id} />)}
                                        </Picker>
                                    </View>
                                    <View style={[styles.pickerCell, { width: 100 }]}>
                                        <Picker
                                            selectedValue={day.horarioId !== null && day.horarioId !== undefined ? String(day.horarioId) : ""}
                                            enabled={!!selectedMaquina}
                                            onValueChange={(v) => updateDay(index, 'horarioId', v ? parseInt(v) : null)}
                                            style={styles.pickerSmall}
                                        >
                                            <Picker.Item label="--" value="" />
                                            {horarios.map(h => <Picker.Item key={h.id} label={h.nombre} value={String(h.id)} />)}
                                        </Picker>
                                        {(day.horarioId !== null && day.horarioId !== undefined) && (
                                            <Text style={{ fontSize: 8, color: 'blue', position: 'absolute', bottom: 0, right: 0 }}>
                                                ID:{day.horarioId}
                                            </Text>
                                        )}
                                    </View>
                                    <TextInput style={[styles.cell, styles.timeCell]} value={day.horaInicio} onChangeText={t => handleTimeInput(index, 'horaInicio', t)} editable={!!selectedMaquina} />
                                    <TextInput style={[styles.cell, styles.timeCell]} value={day.horaFin} onChangeText={t => handleTimeInput(index, 'horaFin', t)} editable={!!selectedMaquina} />

                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.rFinal} onChangeText={t => handleNumericInput(index, 'rFinal', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.horasOp} onChangeText={t => handleNumericInput(index, 'horasOp', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.cambios} onChangeText={t => handleNumericInput(index, 'cambios', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.puestaPunto} onChangeText={t => handleNumericInput(index, 'puestaPunto', t)} editable={!!selectedMaquina} />

                                    <Text style={[styles.cell, styles.calc]}>{formatNumber(calcs.TirosEquivalentes?.toFixed(0))}</Text>
                                    <Text style={[styles.cell, styles.calc]}>{calcs.TotalHorasProd?.toFixed(2)}</Text>
                                    <Text style={[styles.cell, styles.calc]}>{calcs.Promedio?.toFixed(1)}</Text>
                                    {/* Columnas Bonificables */}
                                    <Text style={[styles.cell, styles.bonif, { color: calcs.PorcentajeBonif === 1 ? '#2196F3' : calcs.PorcentajeBonif > 0 ? '#FF9800' : '#999' }]}>{formatNumber(calcs.TirosBonificables?.toFixed(0))}</Text>
                                    <Text style={[styles.cell, styles.bonif, { color: '#2196F3' }]}>{formatNumber((calcs.MetaRendimiento || 0).toFixed(0))}</Text>
                                    <Text style={[styles.cell, styles.bonif, { color: calcs.PorcentajeBonif === 1 ? '#2196F3' : calcs.PorcentajeBonif > 0 ? '#FF9800' : '#999' }]}>{formatNumber(calcs.VrPagarBonif?.toFixed(0))}</Text>
                                    {/* Columnas Totales */}
                                    <Text style={[styles.cell, styles.calc]}>{formatNumber(calcs.Meta75Diff?.toFixed(0))}</Text>
                                    <Text style={[styles.cell, styles.calc, { color: 'green' }]}>{formatNumber(calcs.VrPagar?.toFixed(0))}</Text>

                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.mantenimiento} onChangeText={t => handleNumericInput(index, 'mantenimiento', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.descansos} onChangeText={t => handleNumericInput(index, 'descansos', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.otrosAux} onChangeText={t => handleNumericInput(index, 'otrosAux', t)} editable={!!selectedMaquina} />
                                    <Text style={[styles.cell, styles.calc]}>{calcs.TotalAux?.toFixed(2)}</Text>

                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.faltaTrabajo} onChangeText={t => handleNumericInput(index, 'faltaTrabajo', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.reparacion} onChangeText={t => handleNumericInput(index, 'reparacion', t)} editable={!!selectedMaquina} />
                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.otroMuerto} onChangeText={t => handleNumericInput(index, 'otroMuerto', t)} editable={!!selectedMaquina} />
                                    <Text style={[styles.cell, styles.calc]}>{calcs.TotalMuertos?.toFixed(2)}</Text>

                                    <Text style={[styles.cell, styles.total]}>{calcs.TotalHoras?.toFixed(2)}</Text>

                                    <TextInput style={styles.cell} keyboardType="numeric" value={day.desperdicio} onChangeText={t => handleNumericInput(index, 'desperdicio', t)} editable={!!selectedMaquina} />
                                    <TextInput style={[styles.cell, { width: 100 }]} value={day.referenciaOP} onChangeText={t => updateDay(index, 'referenciaOP', t)} editable={!!selectedMaquina} />
                                    <TextInput style={[styles.cell, { width: 100 }]} value={day.novedades} onChangeText={t => updateDay(index, 'novedades', t)} editable={!!selectedMaquina} />
                                </View>
                            );
                        }}
                        ListFooterComponent={() => {
                            // Obtener datos de la máquina seleccionada
                            const rowMaquina = getMaquinaById(selectedMaquina);
                            const metaPorDia = rowMaquina?.metaRendimiento || 0;
                            const valorPorTiro = rowMaquina?.valorPorTiro || 0;

                            // Calcular totales de todas las filas
                            const totals = gridData.reduce((acc, day) => {
                                const calcs = calculateRow(day);
                                // Contar día si tiene producción O si fue cargado de BD (tiene operarioId)
                                const tieneDatos = day.operarioId || parseNumberInput(day.rFinal) > 0 || parseNumberInput(day.horasOp) > 0;
                                return {
                                    rFinal: acc.rFinal + parseNumberInput(day.rFinal),
                                    horasOp: acc.horasOp + parseNumberInput(day.horasOp),
                                    cambios: acc.cambios + parseNumberInput(day.cambios),
                                    puestaPunto: acc.puestaPunto + parseNumberInput(day.puestaPunto),
                                    TirosEquivalentes: acc.TirosEquivalentes + (calcs.TirosEquivalentes || 0),
                                    TotalHorasProd: acc.TotalHorasProd + (calcs.TotalHorasProd || 0),
                                    TirosBonificables: acc.TirosBonificables + (calcs.TirosBonificables || 0),
                                    VrPagar: acc.VrPagar + (calcs.VrPagar || 0),
                                    VrPagarBonif: acc.VrPagarBonif + (calcs.VrPagarBonif || 0),
                                    Meta75DiffBonif: acc.Meta75DiffBonif + (calcs.Meta75DiffBonif > 0 ? calcs.Meta75DiffBonif : 0), // Sumar solo positivos para mostrar bonificación real? O sumar diferencias? Mejor sumar lo que se pagó.
                                    Meta75Diff: acc.Meta75Diff + (calcs.Meta75Diff > 0 ? calcs.Meta75Diff : 0),
                                    diasConDatos: acc.diasConDatos + (tieneDatos && !day.isDuplicate ? 1 : 0),
                                    mantenimiento: acc.mantenimiento + parseNumberInput(day.mantenimiento),
                                    descansos: acc.descansos + parseNumberInput(day.descansos),
                                    otrosAux: acc.otrosAux + parseNumberInput(day.otrosAux),
                                    TotalAux: acc.TotalAux + (calcs.TotalAux || 0),
                                    faltaTrabajo: acc.faltaTrabajo + parseNumberInput(day.faltaTrabajo),
                                    reparacion: acc.reparacion + parseNumberInput(day.reparacion),
                                    otroMuerto: acc.otroMuerto + parseNumberInput(day.otroMuerto),
                                    TotalMuertos: acc.TotalMuertos + (calcs.TotalMuertos || 0),
                                    TotalHoras: acc.TotalHoras + (calcs.TotalHoras || 0),
                                    desperdicio: acc.desperdicio + parseNumberInput(day.desperdicio),
                                    MetaRendimiento: acc.MetaRendimiento + (calcs.MetaRendimiento || 0), // Sumar Metas
                                };
                            }, {
                                rFinal: 0, horasOp: 0, cambios: 0, puestaPunto: 0,
                                TirosEquivalentes: 0, TotalHorasProd: 0, TirosBonificables: 0,
                                VrPagar: 0, VrPagarBonif: 0, Meta75DiffBonif: 0, Meta75Diff: 0,
                                diasConDatos: 0,
                                mantenimiento: 0, descansos: 0, otrosAux: 0, TotalAux: 0,
                                faltaTrabajo: 0, reparacion: 0, otroMuerto: 0, TotalMuertos: 0,
                                TotalHoras: 0, desperdicio: 0,
                                MetaRendimiento: 0 // Init MetaRendimiento
                            });

                            // Mostrar sumas directas de las columnas
                            const vrPagarTotal = totals.VrPagar;
                            const vrPagarBonif = totals.VrPagarBonif;
                            // Para mostrar "tiros equivalentes" pagados, podemos revertir el cálculo: valor / valorPorTiro
                            const tirosExtraTotal = valorPorTiro > 0 ? vrPagarTotal / valorPorTiro : 0;
                            const tirosExtraBonif = valorPorTiro > 0 ? vrPagarBonif / valorPorTiro : 0;

                            return (
                                <View>
                                    {/* Fila de TOTALES */}
                                    <View style={[styles.row, { backgroundColor: '#E0E0E0' }]}>
                                        <Text style={[styles.cell, { width: 30, color: 'black', fontWeight: 'bold' }]}>TOT</Text>
                                        <Text style={[styles.pickerCell, { color: 'black', fontWeight: 'bold', textAlign: 'center' }]}>TOTALES</Text>
                                        <Text style={[styles.cell, { width: 100, color: 'black' }]}>--</Text>
                                        <Text style={[styles.cell, styles.timeCell, { color: 'black' }]}>--</Text>
                                        <Text style={[styles.cell, styles.timeCell, { color: 'black' }]}>--</Text>
                                        <Text style={[styles.cell, { color: 'black', fontWeight: 'bold' }]}>{formatNumber(totals.rFinal.toFixed(0))}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.horasOp.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.cambios}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.puestaPunto.toFixed(2)}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black', fontWeight: 'bold' }]}>{formatNumber(totals.TirosEquivalentes.toFixed(0))}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black' }]}>{totals.TotalHorasProd.toFixed(2)}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black' }]}>--</Text>
                                        <Text style={[styles.cell, styles.bonif, { color: 'black', fontWeight: 'bold' }]}>{formatNumber(totals.TirosBonificables.toFixed(0))}</Text>
                                        <Text style={[styles.cell, styles.bonif, { color: 'black' }]}>{formatNumber(totals.MetaRendimiento.toFixed(0))}</Text>
                                        <Text style={[styles.cell, styles.bonif, { color: 'black', fontWeight: 'bold' }]}>{formatNumber(vrPagarBonif.toFixed(0))}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black' }]}>{formatNumber(tirosExtraTotal.toFixed(0))}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black', fontWeight: 'bold' }]}>{formatNumber(vrPagarTotal.toFixed(0))}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.mantenimiento.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.descansos.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.otrosAux.toFixed(2)}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black' }]}>{totals.TotalAux.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.faltaTrabajo.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.reparacion.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{totals.otroMuerto.toFixed(2)}</Text>
                                        <Text style={[styles.cell, styles.calc, { color: 'black' }]}>{totals.TotalMuertos.toFixed(2)}</Text>
                                        <Text style={[styles.cell, styles.total, { color: 'black', fontWeight: 'bold' }]}>{totals.TotalHoras.toFixed(2)}</Text>
                                        <Text style={[styles.cell, { color: 'black' }]}>{formatNumber(totals.desperdicio.toFixed(0))}</Text>
                                        <Text style={[styles.cell, { width: 100, color: 'black' }]}>--</Text>
                                        <Text style={[styles.cell, { width: 100, color: 'black' }]}>--</Text>
                                    </View>
                                    <View style={{ height: 100 }} />
                                </View>
                            );
                        }}
                    />
                </View>
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={handleSaveMonth} disabled={loading}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Guardar</Text>
            </TouchableOpacity>

            {/* Modals */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cargar Datos</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity onPress={() => setModalTab('operario')} style={[styles.modalTab, modalTab === 'operario' && styles.modalTabActive]}><Text>Operario</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setModalTab('maquina')} style={[styles.modalTab, modalTab === 'maquina' && styles.modalTabActive]}><Text>Máquina</Text></TouchableOpacity>
                        </View>
                        <FlatList
                            data={modalTab === 'operario' ? operariosConDatos : maquinasConDatos}
                            keyExtractor={(item, i) => i.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectFromModal(item)}>
                                    <Text>{modalTab === 'operario' ? `${item.usuarioNombre} - ${item.maquinaNombre}` : item.maquinaNombre}</Text>
                                    <Text style={styles.modalItemSub}>{item.diasRegistrados} días</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}><Text style={{ color: 'white' }}>Cerrar</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={exportModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Exportar</Text>
                        <Picker selectedValue={`${exportMes}-${exportAnio}`} onValueChange={(v) => { const [m, a] = v.split('-'); setExportMes(parseInt(m)); setExportAnio(parseInt(a)); }}>
                            {periodosDisponibles.map(p => <Picker.Item key={`${p.mes}-${p.anio}`} label={`${getMesNombre(p.mes)} ${p.anio}`} value={`${p.mes}-${p.anio}`} />)}
                        </Picker>
                        <TouchableOpacity style={[styles.btnLoad, { backgroundColor: 'green', marginTop: 10 }]} onPress={handleExport}><Text style={{ color: 'white' }}>Descargar</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setExportModalVisible(false)}><Text style={{ color: 'white' }}>Cerrar</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={deleteModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Borrar Datos</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity onPress={() => setDeleteOption('operario')} style={[styles.modalTab, deleteOption === 'operario' && styles.modalTabActive]}><Text>Operario</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setDeleteOption('maquina')} style={[styles.modalTab, deleteOption === 'maquina' && styles.modalTabActive]}><Text>Máquina</Text></TouchableOpacity>
                        </View>
                        <FlatList
                            data={deleteOption === 'operario' ? operariosConDatos : maquinasConDatos}
                            keyExtractor={(item, i) => i.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.modalItem, { backgroundColor: '#ffe6e6' }]} onPress={() => confirmDelete(deleteOption === 'operario' ? item.usuarioId : item.maquinaId, deleteOption)}>
                                    <Text style={{ color: 'red' }}>
                                        {deleteOption === 'operario'
                                            ? `${item.usuarioNombre} - ${item.maquinaNombre}`
                                            : item.maquinaNombre}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDeleteModalVisible(false)}><Text style={{ color: 'white' }}>Cerrar</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Custom Clean Confirmation Modal */}
            <Modal visible={cleanConfirmVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 300 }]}>
                        <Text style={styles.modalTitle}>Confirmar Limpieza</Text>
                        <Text style={{ textAlign: 'center', marginBottom: 20 }}>¿Estás seguro de que deseas limpiar todos los campos visibles?</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <TouchableOpacity style={[styles.btnLoad, { backgroundColor: '#ccc', flex: 1, marginRight: 10 }]} onPress={() => setCleanConfirmVisible(false)}>
                                <Text style={styles.btnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnLoad, { backgroundColor: '#f1c40f', flex: 1 }]} onPress={confirmClean}>
                                <Text style={[styles.btnText, { color: 'black' }]}>Limpiar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* OP Search Modal */}
            <Modal visible={opSearchModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 400 }]}>
                        <Text style={styles.modalTitle}>Buscar por OP / Referencia</Text>
                        <TextInput
                            style={[styles.input, { borderBottomWidth: 1, marginBottom: 15, padding: 8 }]}
                            placeholder="Ej: 1000, 999..."
                            value={opFilterText}
                            onChangeText={setOpFilterText}
                            autoFocus
                        />
                        {loadingOPs ? (
                            <ActivityIndicator size="small" color="#8e44ad" />
                        ) : (
                            <FlatList
                                data={opList.filter(o => o.toLowerCase().includes(opFilterText.toLowerCase()))}
                                keyExtractor={(item, i) => i.toString()}
                                style={{ maxHeight: 300 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }} onPress={() => handleSelectOP(item)}>
                                        <Text style={{ fontWeight: '500' }}>{item}</Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20 }}>No hay OPs registradas</Text>}
                            />
                        )}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setOpSearchModalVisible(false)}>
                            <Text style={{ color: 'white' }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* OP Results Modal */}
            <Modal visible={opResultsModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 600, maxHeight: '80%' }]}>
                        <Text style={styles.modalTitle}>Resultados para OP: {selectedOP}</Text>
                        {loadingOPs ? (
                            <ActivityIndicator size="large" color="#8e44ad" />
                        ) : opResults.length === 0 ? (
                            <Text style={{ textAlign: 'center', padding: 20 }}>No se encontraron registros para esta OP</Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 400 }}>
                                { /* Header */}
                                <View style={{ flexDirection: 'row', backgroundColor: '#8e44ad', padding: 8, borderRadius: 4 }}>
                                    <Text style={{ flex: 1.3, color: 'white', fontWeight: 'bold' }}>Máquina</Text>
                                    <Text style={{ flex: 0.9, color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Fecha</Text>
                                    <Text style={{ flex: 1.0, color: 'white', fontWeight: 'bold' }}>Proceso</Text>
                                    <Text style={{ flex: 0.7, color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Tiros</Text>
                                    {/* <Text style={{ flex: 0.7, color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Desp.</Text> */}
                                    <Text style={{ flex: 1.4, color: 'white', fontWeight: 'bold' }}>OP Completa</Text>
                                </View>
                                { /* Rows */}
                                {opResults.map((r, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', padding: 8, backgroundColor: idx % 2 === 0 ? '#faf5ff' : 'white', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' }}>
                                        <Text style={{ flex: 1.3, fontSize: 11 }}>{r.maquinaNombre || r.MaquinaNombre}</Text>
                                        <Text style={{ flex: 0.9, textAlign: 'center', fontSize: 11 }}>{formatDateOP(r.fecha || r.Fecha)}</Text>
                                        <Text style={{ flex: 1.0, fontSize: 11 }}>{r.actividadNombre || r.ActividadNombre}</Text>
                                        <Text style={{ flex: 0.7, textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>{formatForDisplay(r.tiros ?? r.Tiros)}</Text>
                                        {/* <Text style={{ flex: 0.7, textAlign: 'center', fontSize: 11, color: '#e74c3c' }}>{formatForDisplay(r.desperdicio ?? r.Desperdicio ?? 0)}</Text> */}
                                        <Text style={{ flex: 1.4, fontSize: 11 }}>{r.referenciaOP || r.ReferenciaOP}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setOpResultsModalVisible(false)}>
                            <Text style={{ color: 'white' }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {contextMenu.visible && (
                <>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={closeContextMenu}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                    />
                    <View style={[styles.contextMenu, { top: contextMenu.y, left: contextMenu.x }]}>
                        <TouchableOpacity onPress={() => { closeContextMenu(); handleOpenDayDetail(contextMenu.rowIndex); }} style={[styles.contextMenuItem, { backgroundColor: '#e8f4fd' }]}>
                            <Text style={{ color: '#2980b9', fontWeight: 'bold' }}>📋 Día Detallado</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDuplicateRow} style={styles.contextMenuItem}><Text>Duplicar Fila</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleDeleteRow} style={styles.contextMenuItem}><Text style={{ color: 'red' }}>Eliminar Fila</Text></TouchableOpacity>
                        <TouchableOpacity onPress={closeContextMenu} style={styles.contextMenuItem}><Text>Cancelar</Text></TouchableOpacity>
                    </View>
                </>
            )}

            {/* Excel Import Preview Modal */}
            <Modal visible={importPreviewVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 700, maxHeight: '85%' }]}>
                        <Text style={styles.modalTitle}>Previsualizar Importación</Text>
                        <Text style={{ marginBottom: 15, color: '#666', textAlign: 'center' }}>
                            Se han agrupado los datos del Excel. Verifique que los operarios y máquinas sean correctos.
                        </Text>

                        <View style={styles.previewHeader}>
                            <Text style={[styles.previewHeaderText, { flex: 1 }]}>Fecha</Text>
                            <Text style={[styles.previewHeaderText, { flex: 2 }]}>Operario</Text>
                            <Text style={[styles.previewHeaderText, { flex: 2 }]}>Máquina</Text>
                            <Text style={[styles.previewHeaderText, { flex: 1, textAlign: 'center' }]}>Filas</Text>
                        </View>

                        <FlatList
                            data={importPreviewData}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item, index }) => (
                                <View
                                    style={styles.previewRow}
                                >
                                    <TouchableOpacity
                                        style={{ flex: 1 }}
                                        onPress={() => {
                                            setDetailedPreviewData(item);
                                            setDetailedPreviewVisible(true);
                                        }}
                                    >
                                        <Text style={styles.previewCell}>{item.fecha}</Text>
                                    </TouchableOpacity>

                                    <View style={{ flex: 2, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                        <Picker
                                            selectedValue={item.usuarioId || ''}
                                            onValueChange={(v) => handleUpdateOperatorInPreview(index, v)}
                                            style={{ height: 40, width: '100%' }}
                                        >
                                            <Picker.Item label="-- Seleccionar --" value="" style={{ fontSize: 12 }} />
                                            {usuarios.map(u => (
                                                <Picker.Item key={u.id} label={u.nombre} value={u.id} style={{ fontSize: 12 }} />
                                            ))}
                                        </Picker>
                                    </View>

                                    <TouchableOpacity
                                        style={{ flex: 2, paddingLeft: 10 }}
                                        onPress={() => {
                                            setDetailedPreviewData(item);
                                            setDetailedPreviewVisible(true);
                                        }}
                                    >
                                        <Text style={styles.previewCell}>{item.maquinaNombre}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={{ flex: 1 }}
                                        onPress={() => {
                                            setDetailedPreviewData(item);
                                            setDetailedPreviewVisible(true);
                                        }}
                                    >
                                        <Text style={[styles.previewCell, { textAlign: 'center' }]}>{item.filasDetalle}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            style={{ marginBottom: 20 }}
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <TouchableOpacity
                                style={[styles.btnLoad, { backgroundColor: '#ccc', flex: 1, marginRight: 10, height: 45 }]}
                                onPress={() => { setImportPreviewVisible(false); setImportPreviewData([]); }}
                            >
                                <Text style={styles.btnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnLoad, { backgroundColor: '#28a745', flex: 1, height: 45 }]}
                                onPress={handleConfirmImport}
                            >
                                <Text style={styles.btnText}>Confirmar y Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Detailed Row Preview Modal */}
            <Modal visible={detailedPreviewVisible} transparent animationType="slide">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalContent, { maxWidth: 850, width: '90%', height: '80%' }]}>
                        <Text style={styles.modalTitle}>Detalle de Registros</Text>
                        <Text style={{ marginBottom: 15, color: '#666', fontSize: 13 }}>
                            {detailedPreviewData?.usuarioNombre} - {detailedPreviewData?.maquinaNombre} ({detailedPreviewData?.fecha})
                        </Text>

                        <View style={[styles.previewHeader, { backgroundColor: '#e9ecef' }]}>
                            <Text style={[styles.previewHeaderText, { flex: 1 }]}>Inicio</Text>
                            <Text style={[styles.previewHeaderText, { flex: 1 }]}>Fin</Text>
                            <Text style={[styles.previewHeaderText, { flex: 1.5 }]}>Actividad</Text>
                            <Text style={[styles.previewHeaderText, { flex: 1.5 }]}>OP</Text>
                            <Text style={[styles.previewHeaderText, { flex: 1, textAlign: 'right' }]}>Tiros</Text>
                        </View>

                        <FlatList
                            data={detailedPreviewData?.data?.detalles || []}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item }) => (
                                <View style={[styles.previewRow, { paddingVertical: 8 }]}>
                                    <Text style={[styles.previewCell, { flex: 1 }]}>{item.horaInicio}</Text>
                                    <Text style={[styles.previewCell, { flex: 1 }]}>{item.horaFin}</Text>
                                    <Text style={[styles.previewCell, { flex: 1.5 }]}>{actividades.find(a => a.id === item.actividadId)?.nombre || 'Producción'}</Text>
                                    <Text style={[styles.previewCell, { flex: 1.5 }]}>{item.referenciaOP || '-'}</Text>
                                    <Text style={[styles.previewCell, { flex: 1, textAlign: 'right' }]}>{item.tiros || 0}</Text>
                                </View>
                            )}
                        />

                        {detailedPreviewData?.data?.novedades ? (
                            <View style={{ marginTop: 10, padding: 10, backgroundColor: '#fff3cd', borderRadius: 5 }}>
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#856404' }}>Observaciones/Novedades:</Text>
                                <Text style={{ fontSize: 12, color: '#856404' }}>{detailedPreviewData.data.novedades}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.modalCloseBtn, { backgroundColor: '#6c757d', marginTop: 20 }]}
                            onPress={() => setDetailedPreviewVisible(false)}
                        >
                            <Text style={styles.btnText}>Cerrar Detalle</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Day Detail Modal */}
            <DayDetailModal
                visible={dayDetailModalVisible}
                onClose={() => setDayDetailModalVisible(false)}
                onSaveSuccess={handleDayDetailSaved}
                dayInfo={dayDetailInfo}
                actividades={actividades}
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: { padding: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderColor: '#ddd' },
    row: { flexDirection: 'row', alignItems: 'center' },
    headerRow: { height: 40, borderBottomWidth: 1, borderColor: '#bbb' },
    logoContainer: { marginBottom: 10 },
    logo: { width: 100, height: 40 },
    pickerContainerSmall: { width: 120, height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, justifyContent: 'center', backgroundColor: 'white' },
    pickerContainerLarge: { width: 180, height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, justifyContent: 'center', backgroundColor: 'white' },
    picker: { height: 50, width: '100%', color: 'black' },
    btnLoad: { padding: 6, backgroundColor: '#007bff', borderRadius: 5, minWidth: 50, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 10 },
    cell: { width: 60, height: 40, borderWidth: 0.5, borderColor: '#ccc', textAlign: 'center', padding: 2, backgroundColor: 'white', fontSize: 10 },
    timeCell: { width: 50, backgroundColor: '#f0f8ff' },
    calc: { backgroundColor: '#e6f7ff', fontWeight: 'bold', color: '#0056b3', fontSize: 10 },
    bonif: { backgroundColor: '#e3f2fd', fontWeight: 'bold', color: '#1976D2', fontSize: 10 },
    total: { backgroundColor: '#d4edda', fontWeight: 'bold', color: '#155724', fontSize: 10 },
    pickerCell: { width: 150, height: 50, borderWidth: 0.5, borderColor: '#ccc', justifyContent: 'center' },
    pickerSmall: { height: 50, width: '100%', color: 'black' },
    fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#28a745', padding: 15, borderRadius: 30, elevation: 5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', backgroundColor: 'white', padding: 20, borderRadius: 10, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    modalTab: { flex: 1, padding: 10, borderBottomWidth: 2, borderColor: 'transparent', alignItems: 'center' },
    modalTabActive: { borderColor: '#007bff' },
    modalItem: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
    modalItemSub: { fontSize: 12, color: '#666' },
    modalCloseBtn: { marginTop: 15, padding: 10, backgroundColor: '#dc3545', borderRadius: 5, alignItems: 'center' },
    contextMenu: { position: 'absolute', backgroundColor: 'white', elevation: 5, borderRadius: 5, padding: 5, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    contextMenuItem: { padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
    previewHeader: { flexDirection: 'row', backgroundColor: '#f8f9fa', padding: 10, borderBottomWidth: 1, borderColor: '#dee2e6', borderTopLeftRadius: 5, borderTopRightRadius: 5 },
    previewHeaderText: { fontWeight: 'bold', fontSize: 12, color: '#495057' },
    previewRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
    previewCell: { fontSize: 12, color: '#212529' }
});
