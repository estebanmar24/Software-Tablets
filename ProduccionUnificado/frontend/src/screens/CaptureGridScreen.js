import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Image, FlatList, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { getMaquinasActivas, getUsuarios, saveProduccion, getProduccionDetalles, getOperariosConDatos, getMaquinasConDatos, getProduccionPorMaquina, API_URL } from '../services/productionApi';
import { useTheme } from '../contexts/ThemeContext';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
let rowIdCounter = 100;

export default function CaptureGridScreen({ navigation }) {
    const { colors } = useTheme();
    // Selectors
    const [selectedOperario, setSelectedOperario] = useState(null);
    const [selectedMaquina, setSelectedMaquina] = useState(null);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());

    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    // Lists
    const [maquinas, setMaquinas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);

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
            const [m, u] = await Promise.all([getMaquinasActivas(), getUsuarios()]);
            setMaquinas(m.data);
            setUsuarios(u.data);
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
            novedades: ''
        }));
        rowIdCounter = 100;
        setGridData(initial);
    };

    const formatForDisplay = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
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
            const res = await getProduccionDetalles(mes, anio, maquinaIdToLoad, opToLoad);

            let dbData = res.data || [];

            const newGrid = DAYS.map((d, idx) => {
                const record = dbData.find(item => {
                    const fechaStr = item.fecha.split('T')[0];
                    const dayFromDb = parseInt(fechaStr.split('-')[2], 10);
                    return dayFromDb === d;
                });

                if (record) {
                    return {
                        rowId: idx + 1,
                        day: d,
                        maquinaId: maquinaIdToLoad,
                        operarioId: record.usuarioId,
                        horaInicio: record.horaInicio?.substring(0, 5) || '',
                        horaFin: record.horaFin?.substring(0, 5) || '',
                        rFinal: formatForDisplay(record.rendimientoFinal),
                        horasOp: formatForDisplay(record.horasOperativas),
                        cambios: record.cambios?.toString() || '',
                        puestaPunto: formatForDisplay(record.tiempoPuestaPunto),
                        mantenimiento: formatForDisplay(record.horasMantenimiento),
                        descansos: formatForDisplay(record.horasDescanso),
                        otrosAux: formatForDisplay(record.horasOtrosAux),
                        faltaTrabajo: formatForDisplay(record.tiempoFaltaTrabajo),
                        reparacion: formatForDisplay(record.tiempoReparacion),
                        otroMuerto: formatForDisplay(record.tiempoOtroMuerto),
                        desperdicio: formatForDisplay(record.desperdicio),
                        referenciaOP: record.referenciaOP || '',
                        novedades: record.novedades || ''
                    };
                } else {
                    return {
                        rowId: idx + 1,
                        day: d,
                        maquinaId: maquinaIdToLoad,
                        operarioId: null,
                        horaInicio: '', horaFin: '', rFinal: '', horasOp: '', cambios: '', puestaPunto: '',
                        mantenimiento: '', descansos: '', otrosAux: '', faltaTrabajo: '', reparacion: '',
                        otroMuerto: '', desperdicio: '', referenciaOP: '', novedades: ''
                    };
                }
            });

            rowIdCounter = 100;
            setGridData(newGrid);
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
            const res = await getProduccionPorMaquina(mes, anio, maquinaId);
            const dbData = res.data;

            if (!dbData || dbData.length === 0) {
                Alert.alert("No hay datos guardados para esta máquina");
                return;
            }

            let tempRowId = 1;
            const newGrid = DAYS.flatMap(d => {
                const dayRecords = dbData.filter(r => {
                    const fechaStr = r.fecha.split('T')[0];
                    const dayFromDb = parseInt(fechaStr.split('-')[2], 10);
                    return dayFromDb === d;
                });

                if (dayRecords.length > 0) {
                    return dayRecords.map(record => ({
                        rowId: tempRowId++,
                        day: d,
                        maquinaId: maquinaId,
                        operarioId: record.usuarioId,
                        horaInicio: record.horaInicio?.substring(0, 5) || '',
                        horaFin: record.horaFin?.substring(0, 5) || '',
                        rFinal: formatForDisplay(record.rendimientoFinal),
                        horasOp: formatForDisplay(record.horasOperativas),
                        cambios: record.cambios?.toString() || '',
                        puestaPunto: formatForDisplay(record.tiempoPuestaPunto),
                        mantenimiento: formatForDisplay(record.horasMantenimiento),
                        descansos: formatForDisplay(record.horasDescanso),
                        otrosAux: formatForDisplay(record.horasOtrosAux),
                        faltaTrabajo: formatForDisplay(record.tiempoFaltaTrabajo),
                        reparacion: formatForDisplay(record.tiempoReparacion),
                        otroMuerto: formatForDisplay(record.tiempoOtroMuerto),
                        desperdicio: formatForDisplay(record.desperdicio),
                        referenciaOP: record.referenciaOP || '',
                        novedades: record.novedades || ''
                    }));
                } else {
                    return [{
                        rowId: tempRowId++,
                        day: d,
                        maquinaId: maquinaId,
                        operarioId: null,
                        horaInicio: '', horaFin: '', rFinal: '', horasOp: '', cambios: '', puestaPunto: '',
                        mantenimiento: '', descansos: '', otrosAux: '', faltaTrabajo: '', reparacion: '',
                        otroMuerto: '', desperdicio: '', referenciaOP: '', novedades: ''
                    }];
                }
            });

            rowIdCounter = tempRowId + 100;
            setGridData(newGrid);
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

    const handleContextMenu = (e, rowIndex) => {
        if (Platform.OS === 'web') e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.nativeEvent?.pageX || 100,
            y: e.nativeEvent?.pageY || 100,
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
        if (!value && value !== 0) return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
        if (isNaN(num)) return value;
        return num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

    const parseNumberInput = (v) => {
        if (!v && v !== 0) return 0;
        const str = String(v);
        let cleaned = str.replace(/\./g, '');
        cleaned = cleaned.replace(',', '.');
        return parseFloat(cleaned) || 0;
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

        // Definir límites del horario laboral
        let horaInicioLaboral, horaFinLaboral;
        if (diaSemana === 6) { // Sábado: 8am - 12pm
            horaInicioLaboral = 8;
            horaFinLaboral = 12;
        } else { // Lunes a Viernes: 7am - 4pm
            horaInicioLaboral = 7;
            horaFinLaboral = 16;
        }

        // Parsear horas del registro
        const [hI, mI] = day.horaInicio.split(':').map(Number);
        const [hF, mF] = day.horaFin.split(':').map(Number);
        const horaInicioReg = hI + (mI / 60);
        const horaFinReg = hF + (mF / 60);

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

        const TirosRef = rowMaquina.tirosReferencia || 0;
        const TirosEquivalentes = (TirosRef * Cambios) + R_Final;
        const TotalHorasProd = HorasOp + PuestaPunto;
        const Promedio = TotalHorasProd > 0 ? (TirosEquivalentes / TotalHorasProd) : 0;
        const MetaRendimiento = rowMaquina.metaRendimiento || 0;

        // Calcular diferencia de meta
        const Meta75Diff = TirosEquivalentes - MetaRendimiento;

        // *** NUEVO: Verificar si es festivo o domingo ***
        const fecha = new Date(anio, mes - 1, day.day);
        const diaSemana = fecha.getDay();
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

        const TotalAux = MantAseo + Descansos + OtrosAux;
        const TotalMuertos = FaltaTrabajo + Reparacion + OtroMuerto;
        const TotalHoras = TotalHorasProd + TotalAux + TotalMuertos;

        // Calcular valores bonificables (proporcional al tiempo en horario laboral)
        const porcentajeBonif = calcularPorcentajeBonificable(day);
        const TirosBonificables = Math.round(TirosEquivalentes * porcentajeBonif);
        const DesperdicioBonif = Desperdicio * porcentajeBonif;
        const Meta75DiffBonif = TirosBonificables - MetaRendimiento;
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
            MetaRendimiento, // Meta fija del 75% para mostrar en columna
            // Flag para indicar día no laborable
            esNoLaborable
        };
    };

    const handleSaveMonth = async () => {
        const dataToSave = [];
        const missingHours = [];
        const missingOperario = [];

        gridData.forEach((day, idx) => {
            const calcs = calculateRow(day);
            if (calcs.TotalHoras > 0) {
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
            await axios.post(`${API_URL}/produccion/mensual`, dataToSave);

            setLoading(false);
            Alert.alert("Éxito", "Toda la información ha sido guardada y sincronizada.");

            // Opcional: Recargar datos para verificar (pero resetGrid limpia todo)
            resetGrid();

        } catch (error) {
            setLoading(false);
            console.error(error);
            const msg = error.response?.data?.message || error.message || "Error desconocido";
            Alert.alert("Error", `Fallo al guardar mes: ${msg}`);
        }
    };

    const handleOpenExportModal = async () => {
        try {
            const res = await fetch(`${API_URL}/produccion/periodos-disponibles`);
            const data = await res.json();
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
            const res = await fetch(`${API_URL}/produccion/historial?fechaInicio=${exportAnio}-${String(exportMes).padStart(2, '0')}-01&fechaFin=${exportAnio}-${String(exportMes).padStart(2, '0')}-31`);
            const data = await res.json();
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

            const query = new URLSearchParams(params).toString();
            // Assuming string keys for params
            const res = await fetch(`${API_URL}/Produccion/borrar?${query}`, { method: 'DELETE' });

            if (res.ok) {
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
                        <TouchableOpacity style={[styles.btnLoad, { backgroundColor: '#c0392b', flex: 1, marginRight: 5 }]} onPress={handleOpenDeleteModal}>
                            <Text style={styles.btnText}>Del</Text>
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
                                };
                            }, {
                                rFinal: 0, horasOp: 0, cambios: 0, puestaPunto: 0,
                                TirosEquivalentes: 0, TotalHorasProd: 0, TirosBonificables: 0,
                                VrPagar: 0, VrPagarBonif: 0, Meta75DiffBonif: 0, Meta75Diff: 0,
                                diasConDatos: 0,
                                mantenimiento: 0, descansos: 0, otrosAux: 0, TotalAux: 0,
                                faltaTrabajo: 0, reparacion: 0, otroMuerto: 0, TotalMuertos: 0,
                                TotalHoras: 0, desperdicio: 0
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
                                        <Text style={[styles.cell, styles.bonif, { color: 'black' }]}>{formatNumber(tirosExtraBonif.toFixed(0))}</Text>
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

            {contextMenu.visible && (
                <View style={[styles.contextMenu, { top: contextMenu.y, left: contextMenu.x }]}>
                    <TouchableOpacity onPress={handleDuplicateRow} style={styles.contextMenuItem}><Text>Duplicar Fila</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handleDeleteRow} style={styles.contextMenuItem}><Text style={{ color: 'red' }}>Eliminar Fila</Text></TouchableOpacity>
                    <TouchableOpacity onPress={closeContextMenu} style={styles.contextMenuItem}><Text>Cancelar</Text></TouchableOpacity>
                </View>
            )}

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
    contextMenuItem: { padding: 10, borderBottomWidth: 1, borderColor: '#eee' }
});
