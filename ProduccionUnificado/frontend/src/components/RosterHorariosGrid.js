import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Platform,
} from 'react-native';
import {
    JORNADA_SEMANAL_HORAS,
    buildHorariosRows,
    rowsToAsignacionesHorarios,
    resolveHorarioPersonalizadoId,
    parseHoraMinutos,
    minutosToHoraInput,
    minutosEntre,
    horasFromMinutos,
    formatRangoHorario,
    horasEfectivasTurno,
    minutosDescuentoComida,
    presetsJornadaParaDia,
} from '../utils/rosterHorariosUtils';
import {
    buildProcesosOpcionesRoster,
    splitMaquinasRoster,
    esProcesoVirtualRoster,
    labelProcesoFila,
    toggleSeleccionMaquina,
    GANTT_PROCESOS_CATALOGO,
} from '../utils/rosterProcesoUtils';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PRESETS = [
    { label: '7 am - 4:30 pm', inicio: '07:00', fin: '16:30' },
    { label: '7 am - 6 pm', inicio: '07:00', fin: '18:00' },
    { label: '7 am - 1 pm', inicio: '07:00', fin: '13:00' },
    { label: '2 pm - 10 pm', inicio: '14:00', fin: '22:00' },
    { label: '6 am - 12 m', inicio: '06:00', fin: '12:00' },
    { label: '12 m - 6 pm', inicio: '12:00', fin: '18:00' },
];

const cellBg = (cell, isDarkMode) => {
    const tipo = cell?.tipo;
    if (tipo === 'incapacidad') return isDarkMode ? '#713F12' : '#FEF08A';
    if (tipo === 'festivo_vacio' || tipo === 'turno_festivo' || cell?.esFestivo) {
        return isDarkMode ? '#422006' : '#FFFBEB';
    }
    if (tipo === 'descanso') return isDarkMode ? '#1E3A5F' : '#DBEAFE';
    if (tipo === 'novedad') return isDarkMode ? '#374151' : '#F3F4F6';
    return 'transparent';
};

const rowsSignature = (rows, diasKeys) => JSON.stringify(
    (rows || []).map((r) => ({
        k: r.rowKey,
        ax: r.esAuxiliar ? 1 : 0,
        c: (diasKeys || []).map((f) => {
            const cell = r.cells?.[f];
            if (!cell) return '';
            return `${cell.tipo}|${cell.horaInicio || ''}|${cell.horaFin || ''}|${cell.descuentaComida ? 1 : 0}|${cell.minutosComida || 0}`;
        }),
    })),
);

export default function RosterHorariosGrid({
    maquinas = [],
    dias = [],
    diasFestivos = [],
    asignaciones = [],
    horarios = [],
    usuarios = [],
    novedades = [],
    colors,
    isDarkMode,
    saving,
    onSaveAsignaciones,
    configsByMaquina = {},
    jornadaDias = [],
    semanaKey = '',
    winH = 600,
    winW = 1200,
    procesosGantt = [],
}) {
    const textColor = colors?.text || '#E2E8F0';
    const subColor = colors?.subText || '#94A3B8';
    const cardBg = isDarkMode ? '#1E293B' : '#FFFFFF';
    const border = isDarkMode ? '#334155' : '#CBD5E1';
    const pageBg = isDarkMode ? '#0B1220' : '#F1F5F9';

    const diasKeys = useMemo(() => dias.map((d) => {
        const x = d instanceof Date ? d : new Date(d);
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    }), [dias]);

    const festivoSet = useMemo(
        () => new Set((diasFestivos || []).map((f) => f.fechaDia || f.FechaDia)),
        [diasFestivos]
    );

    const horarioPersonalizadoId = useMemo(() => resolveHorarioPersonalizadoId(horarios), [horarios]);

    const initialRows = useMemo(
        () => buildHorariosRows({
            asignaciones,
            maquinas,
            diasKeys,
            horarios,
            novedades,
            diasFestivos,
            horarioPersonalizadoId,
            jornadaDias,
        }),
        [asignaciones, maquinas, diasKeys, horarios, novedades, diasFestivos, horarioPersonalizadoId, jornadaDias]
    );

    const [rows, setRows] = useState(initialRows);
    const [editCell, setEditCell] = useState(null);
    const [form, setForm] = useState({
        inicio: '07:00', fin: '18:00', modo: 'turno', descuentaComida: false, minutosComida: 30,
    });
    const [addMaqId, setAddMaqId] = useState('');
    const [addUserId, setAddUserId] = useState('');
    const [maqQ, setMaqQ] = useState('');
    const [userQ, setUserQ] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [addDestTab, setAddDestTab] = useState('proceso'); // proceso | maquina
    const [addEsAuxiliar, setAddEsAuxiliar] = useState(false);
    const [filterMaq, setFilterMaq] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [filterRol, setFilterRol] = useState('todos');
    const [filterNovedad, setFilterNovedad] = useState('todos');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // saved | pending | saving | error

    const hydratingRef = useRef(true);
    const lastSavedSigRef = useRef('');
    const saveTimerRef = useRef(null);
    const saveInFlightRef = useRef(false);
    const pendingRowsRef = useRef(null);
    const removedPairsRef = useRef(new Set());
    const rowsRef = useRef([]);

    rowsRef.current = rows;

    const flushSave = useCallback(async (rowsToSave) => {
        if (!horarioPersonalizadoId) return;
        if (saveInFlightRef.current) {
            pendingRowsRef.current = rowsToSave;
            return;
        }
        saveInFlightRef.current = true;
        setAutoSaveStatus('saving');
        try {
            const payload = rowsToAsignacionesHorarios(
                rowsToSave,
                diasKeys,
                horarioPersonalizadoId,
                asignaciones,
                configsByMaquina,
                horarios,
                removedPairsRef.current,
            );
            const ok = await onSaveAsignaciones(payload);
            if (ok === false) {
                setAutoSaveStatus('error');
                return;
            }
            lastSavedSigRef.current = rowsSignature(rowsToSave, diasKeys);
            setAutoSaveStatus('saved');
        } catch {
            setAutoSaveStatus('error');
        } finally {
            saveInFlightRef.current = false;
            const pending = pendingRowsRef.current;
            pendingRowsRef.current = null;
            if (pending && rowsSignature(pending, diasKeys) !== lastSavedSigRef.current) {
                flushSave(pending);
            }
        }
    }, [
        horarioPersonalizadoId,
        diasKeys,
        asignaciones,
        configsByMaquina,
        horarios,
        onSaveAsignaciones,
    ]);

    useEffect(() => {
        hydratingRef.current = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        removedPairsRef.current = new Set();
        setRows(initialRows);
        setEditCell(null);
        setAddMaqId('');
        setAddUserId('');
        setMaqQ('');
        setUserQ('');
        lastSavedSigRef.current = rowsSignature(initialRows, diasKeys);
        setAutoSaveStatus('saved');
        const t = setTimeout(() => { hydratingRef.current = false; }, 80);
        return () => clearTimeout(t);
    }, [initialRows, semanaKey, diasKeys]);

    useEffect(() => {
        if (hydratingRef.current || !horarioPersonalizadoId) return;
        const sig = rowsSignature(rows, diasKeys);
        if (sig === lastSavedSigRef.current) return;
        setAutoSaveStatus('pending');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            flushSave(rowsRef.current);
        }, 500);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [rows, diasKeys, horarioPersonalizadoId, flushSave]);

    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    const PROC_COL = 108;
    const TRAB_COL = 132;
    const TOTAL_COL = 40;
    const HE_COL = 36;
    const dayColW = Math.max(76, Math.floor((Math.max(900, winW) - PROC_COL - TRAB_COL - TOTAL_COL - HE_COL - 24) / Math.max(1, dias.length)));

    /** Altura de reserva hasta medir el contenedor real (toolbars planeador + roster + horarios). */
    const gridScrollFallbackH = useMemo(() => {
        let top = 332;
        if (filtersOpen) top += 56;
        if (addOpen) top += 218;
        return Math.max(140, winH - top);
    }, [winH, filtersOpen, addOpen]);

    const gridMinWidth = PROC_COL + TRAB_COL + dayColW * dias.length + TOTAL_COL + HE_COL;

    const GRID_HEADER_H = 44;
    const [shellH, setShellH] = useState(0);
    const onGridShellLayout = useCallback((e) => {
        const h = Math.floor(e.nativeEvent.layout.height);
        if (h > 0) setShellH((prev) => (prev !== h ? h : prev));
    }, []);

    const bodyScrollH = shellH > 0
        ? Math.max(100, shellH - GRID_HEADER_H)
        : gridScrollFallbackH;

    const bodyScrollStyle = useMemo(() => [
        styles.gridBody,
        { height: bodyScrollH, maxHeight: bodyScrollH },
        Platform.OS === 'web'
            ? { overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }
            : null,
    ], [bodyScrollH]);

    const procesoList = useMemo(() => {
        const fromApi = (procesosGantt || [])
            .map((p) => (typeof p === 'string' ? p : (p.nombre ?? p.Nombre ?? '')))
            .filter(Boolean);
        return fromApi.length ? fromApi : GANTT_PROCESOS_CATALOGO;
    }, [procesosGantt]);

    const { fisicas } = useMemo(
        () => splitMaquinasRoster(maquinas, procesoList),
        [maquinas, procesoList],
    );

    const procesosOpciones = useMemo(
        () => buildProcesosOpcionesRoster(procesoList, maquinas),
        [procesoList, maquinas],
    );

    const procesosFiltrados = useMemo(() => {
        const q = maqQ.trim().toLowerCase();
        const list = procesosOpciones.filter((p) => !q || p.nombre.toLowerCase().includes(q));
        return list;
    }, [procesosOpciones, maqQ]);

    const maquinasFiltradas = useMemo(() => {
        const q = maqQ.trim().toLowerCase();
        const list = fisicas || [];
        if (!q) return list.slice(0, 24);
        return list.filter((m) => (m.nombre ?? m.Nombre ?? '').toLowerCase().includes(q)).slice(0, 24);
    }, [fisicas, maqQ]);

    const destinoOpciones = useMemo(() => {
        if (addDestTab === 'maquina') {
            return maquinasFiltradas.map((m) => ({
                id: m.id ?? m.Id,
                label: m.nombre ?? m.Nombre ?? '',
                tipo: 'maquina',
            }));
        }
        return procesosFiltrados
            .filter((p) => p.maquina)
            .map((p) => ({
                id: p.maquina.id ?? p.maquina.Id,
                label: p.nombre,
                tipo: 'proceso',
            }));
    }, [addDestTab, maquinasFiltradas, procesosFiltrados]);

    const usuariosFiltrados = useMemo(() => {
        const q = userQ.trim().toLowerCase();
        const list = (usuarios || []).filter((u) => u.activo !== false && u.Activo !== false);
        if (!q) return list.slice(0, 16);
        return list.filter((u) => (u.nombre || u.Nombre || '').toLowerCase().includes(q)).slice(0, 16);
    }, [usuarios, userQ]);

    const selectedMaq = maquinas.find((m) => String(m.id ?? m.Id) === String(addMaqId));
    const selectedUser = usuarios.find((u) => String(u.id ?? u.Id) === String(addUserId));
    const duplicateRow = addMaqId && addUserId && rows.some((r) => r.rowKey === `${addMaqId}|${addUserId}`);

    const rowsFiltered = useMemo(() => {
        let list = rows;
        const mq = filterMaq.trim().toLowerCase();
        const uq = filterUser.trim().toLowerCase();
        if (mq) {
            list = list.filter((r) => String(r.maquinaNombre || '').toLowerCase().includes(mq));
        }
        if (uq) {
            list = list.filter((r) => String(r.usuarioNombre || '').toLowerCase().includes(uq));
        }
        if (filterRol === 'operarios') list = list.filter((r) => !r.esAuxiliar);
        if (filterRol === 'auxiliares') list = list.filter((r) => !!r.esAuxiliar);
        if (filterNovedad === 'incapacidad') {
            list = list.filter((r) => diasKeys.some((f) => r.cells?.[f]?.tipo === 'incapacidad'));
        } else if (filterNovedad === 'novedad') {
            list = list.filter((r) => diasKeys.some((f) => r.cells?.[f]?.tipo === 'novedad'));
        } else if (filterNovedad === 'con_horario') {
            list = list.filter((r) => diasKeys.some((f) => {
                const t = r.cells?.[f]?.tipo;
                return t === 'turno' || t === 'turno_festivo' || t === 'descanso';
            }));
        } else if (filterNovedad === 'sin_horario') {
            list = list.filter((r) => diasKeys.every((f) => {
                const t = r.cells?.[f]?.tipo;
                return !t || t === 'vacio' || t === 'festivo_vacio';
            }));
        }
        return list;
    }, [rows, filterMaq, filterUser, filterRol, filterNovedad, diasKeys]);

    const hasActiveFilters = !!(filterMaq.trim() || filterUser.trim() || filterRol !== 'todos' || filterNovedad !== 'todos');

    const clearFilters = () => {
        setFilterMaq('');
        setFilterUser('');
        setFilterRol('todos');
        setFilterNovedad('todos');
    };
    const pickMaquina = (id, label) => {
        const next = toggleSeleccionMaquina(addMaqId, id);
        setAddMaqId(next);
        setMaqQ(next ? label : '');
    };

    const clearSeleccion = () => {
        setAddMaqId('');
        setMaqQ('');
    };

    const pickUser = (id, label) => {
        const next = toggleSeleccionMaquina(addUserId, id);
        setAddUserId(next);
        setUserQ(next ? label : '');
    };

    const closeAddPanel = () => {
        setAddOpen(false);
        setMaqQ('');
        setUserQ('');
    };

    const recalcRow = (row, nextCells) => {
        let totalHoras = 0;
        for (const f of diasKeys) totalHoras += nextCells[f]?.horas || 0;
        const horasExtra = Math.max(0, Math.round((totalHoras - JORNADA_SEMANAL_HORAS) * 100) / 100);
        return {
            ...row,
            cells: nextCells,
            totalHoras: Math.round(totalHoras * 100) / 100,
            horasExtra,
        };
    };

    const openEdit = (rowKey, fecha) => {
        const row = rows.find((r) => r.rowKey === rowKey);
        const cell = row?.cells?.[fecha];
        if (!cell || cell.tipo === 'incapacidad') return;
        setEditCell({ rowKey, fecha, esFestivo: festivoSet.has(fecha) });
        if (cell.tipo === 'descanso') {
            setForm({
                inicio: '07:00', fin: '18:00', modo: 'descanso', descuentaComida: false, minutosComida: 30,
            });
        } else if (cell.horaInicio && cell.horaFin) {
            setForm({
                inicio: cell.horaInicio,
                fin: cell.horaFin,
                modo: 'turno',
                descuentaComida: !!cell.descuentaComida,
                minutosComida: cell.descuentaComida ? (Number(cell.minutosComida) || 30) : 30,
            });
        } else {
            setForm({
                inicio: '07:00', fin: '18:00', modo: 'turno', descuentaComida: false, minutosComida: 30,
            });
        }
    };

    const applyCellEdit = () => {
        if (!editCell) return;
        const { rowKey, fecha, esFestivo } = editCell;
        setRows((prev) => prev.map((row) => {
            if (row.rowKey !== rowKey) return row;
            const nextCells = { ...row.cells };
            if (form.modo === 'descanso') {
                nextCells[fecha] = { texto: 'DESCANSO', tipo: 'descanso', horas: 0, esFestivo: !!esFestivo };
            } else if (form.modo === 'vacio') {
                nextCells[fecha] = esFestivo
                    ? { texto: '', tipo: 'festivo_vacio', horas: 0, esFestivo: true }
                    : { texto: '', tipo: 'vacio', horas: 0, esFestivo: false };
            } else {
                const ini = parseHoraMinutos(form.inicio);
                const fin = parseHoraMinutos(form.fin);
                if (ini == null || fin == null) return row;
                const comidaOpts = {
                    descuentaComida: !!form.descuentaComida,
                    minutosComida: form.descuentaComida ? Math.max(0, Number(form.minutosComida) || 0) : 0,
                };
                const horas = horasEfectivasTurno(ini, fin, fecha, jornadaDias, comidaOpts);
                nextCells[fecha] = {
                    texto: formatRangoHorario(ini, fin),
                    tipo: esFestivo ? 'turno_festivo' : 'turno',
                    horas,
                    inicioMin: ini,
                    finMin: fin,
                    horaInicio: minutosToHoraInput(ini),
                    horaFin: minutosToHoraInput(fin),
                    esFestivo: !!esFestivo,
                    descuentaComida: comidaOpts.descuentaComida,
                    minutosComida: comidaOpts.minutosComida,
                };
            }
            return recalcRow(row, nextCells);
        }));
        setEditCell(null);
    };

    const vaciarSemana = async () => {
        if (!horarioPersonalizadoId || saving || saveInFlightRef.current) return;
        const ok = Platform.OS === 'web'
            ? window.confirm('¿Vaciar todos los operarios y horarios de esta semana?')
            : true;
        if (!ok) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        hydratingRef.current = true;
        for (const r of rowsRef.current) {
            removedPairsRef.current.add(r.rowKey);
        }
        setRows([]);
        lastSavedSigRef.current = rowsSignature([], diasKeys);
        try {
            const payload = rowsToAsignacionesHorarios(
                [],
                diasKeys,
                horarioPersonalizadoId,
                asignaciones,
                configsByMaquina,
                horarios,
                removedPairsRef.current,
            );
            await onSaveAsignaciones(payload);
            setAutoSaveStatus('saved');
        } catch {
            setAutoSaveStatus('error');
        } finally {
            hydratingRef.current = false;
        }
    };

    const agregarFila = () => {
        const maquinaId = parseInt(addMaqId, 10);
        const usuarioId = parseInt(addUserId, 10);
        if (!maquinaId || !usuarioId || duplicateRow) return;
        const key = `${maquinaId}|${usuarioId}`;
        removedPairsRef.current.delete(key);
        const m = selectedMaq;
        const u = selectedUser;
        const cells = {};
        for (const f of diasKeys) {
            cells[f] = festivoSet.has(f)
                ? { texto: '', tipo: 'festivo_vacio', horas: 0, esFestivo: true }
                : { texto: '', tipo: 'vacio', horas: 0, esFestivo: false };
        }
        setRows((prev) => [...prev, {
            rowKey: key,
            maquinaId,
            usuarioId,
            maquinaNombre: m?.nombre ?? m?.Nombre ?? `#${maquinaId}`,
            esProcesoVirtual: esProcesoVirtualRoster(m?.nombre ?? m?.Nombre, procesoList),
            usuarioNombre: u?.nombre ?? u?.Nombre ?? `#${usuarioId}`,
            esAuxiliar: !!addEsAuxiliar,
            cells,
            totalHoras: 0,
            horasExtra: 0,
        }].sort((a, b) => {
            const cmpM = String(a.maquinaNombre).localeCompare(String(b.maquinaNombre), 'es', { numeric: true });
            if (cmpM !== 0) return cmpM;
            return String(a.usuarioNombre).localeCompare(String(b.usuarioNombre), 'es');
        }));
        setAddMaqId('');
        setAddUserId('');
        setAddEsAuxiliar(false);
        setMaqQ('');
        setUserQ('');
        setAddOpen(false);
    };

    const quitarFila = (rowKey) => {
        removedPairsRef.current.add(rowKey);
        setRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
    };

    const toggleRolFila = (rowKey) => {
        setRows((prev) => prev.map((r) => (
            r.rowKey === rowKey ? { ...r, esAuxiliar: !r.esAuxiliar } : r
        )));
    };

    const renderCellContent = (cell) => {
        if (cell.tipo === 'festivo_vacio') {
            return <Text style={[styles.cellTxt, { color: subColor, fontSize: 9 }]}>+</Text>;
        }
        if (cell.tipo === 'descanso') {
            return <Text style={[styles.cellDescanso, { color: '#60A5FA' }]}>OFF</Text>;
        }
        if (!cell.texto) {
            return <Text style={[styles.cellTxt, { color: subColor }]}>—</Text>;
        }
        return (
            <View style={styles.cellInner}>
                <Text
                    style={[
                        styles.cellTxt,
                        { color: cell.tipo === 'incapacidad' ? '#854D0E' : textColor },
                    ]}
                    numberOfLines={2}
                >
                    {cell.texto}
                </Text>
                {cell.horas > 0 ? (
                    <Text style={[styles.cellHrs, { color: subColor }]}>
                        {cell.horas}h
                    </Text>
                ) : null}
            </View>
        );
    };

    const presetsDia = useMemo(() => {
        if (!editCell?.fecha) return PRESETS;
        const fromJornada = presetsJornadaParaDia(editCell.fecha, jornadaDias);
        return fromJornada.length ? fromJornada : PRESETS;
    }, [editCell, jornadaDias]);

    const gridRowsContent = rowsFiltered.length === 0 ? (
        <Text style={{ color: subColor, padding: 12, fontSize: 11 }}>
            {rows.length === 0
                ? 'Pulse «+ Agregar fila» para registrar personal, luego clic en cada día.'
                : 'Sin filas con esos filtros.'}
        </Text>
    ) : rowsFiltered.map((row, rowIdx) => {
        const showMaq = rowIdx === 0 || rowsFiltered[rowIdx - 1].maquinaId !== row.maquinaId;
        return (
            <View key={row.rowKey} style={styles.bodyRow}>
                <View style={[styles.procCol, { width: PROC_COL, borderColor: border, backgroundColor: cardBg }]}>
                    {showMaq ? (
                        <Text
                            style={[
                                styles.procTxt,
                                { color: row.esProcesoVirtual ? '#A78BFA' : textColor },
                            ]}
                            numberOfLines={3}
                        >
                            {labelProcesoFila(row.maquinaNombre, procesoList)}
                        </Text>
                    ) : (
                        <Text style={[styles.procTxt, { color: subColor, opacity: 0.4 }]}>↳</Text>
                    )}
                </View>
                <View style={[styles.trabCol, { width: TRAB_COL, borderColor: border, backgroundColor: cardBg }]}>
                    <View style={styles.trabHead}>
                        <TouchableOpacity
                            onPress={() => toggleRolFila(row.rowKey)}
                            accessibilityLabel={row.esAuxiliar ? 'Cambiar a operario' : 'Cambiar a auxiliar'}
                        >
                            <Text style={[
                                styles.rolBadge,
                                { backgroundColor: row.esAuxiliar ? '#0D9488' : '#2563EB' },
                            ]}>
                                {row.esAuxiliar ? 'Ax' : 'Op'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={[styles.trabTxt, { color: textColor, flex: 1 }]} numberOfLines={2}>
                            {row.usuarioNombre}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => quitarFila(row.rowKey)}>
                        <Text style={styles.quitarTxt}>✕ quitar</Text>
                    </TouchableOpacity>
                </View>
                {diasKeys.map((fecha) => {
                    const cell = row.cells[fecha] || { texto: '', tipo: 'vacio', horas: 0 };
                    const bg = cellBg(cell, isDarkMode) || cardBg;
                    return (
                        <TouchableOpacity
                            key={fecha}
                            style={[styles.dayCol, { width: dayColW, borderColor: border, backgroundColor: bg }]}
                            onPress={() => openEdit(row.rowKey, fecha)}
                        >
                            {renderCellContent(cell)}
                        </TouchableOpacity>
                    );
                })}
                <View style={[styles.totalCol, { width: TOTAL_COL, borderColor: border, backgroundColor: cardBg }]}>
                    <Text style={[styles.totalTxt, { color: row.horasExtra > 0 ? '#EF4444' : textColor }]}>
                        {row.totalHoras}
                    </Text>
                </View>
                <View style={[styles.heCol, { width: HE_COL, borderColor: border, backgroundColor: cardBg }]}>
                    <Text style={[styles.heTxt, { color: row.horasExtra > 0 ? '#EF4444' : subColor }]}>
                        {row.horasExtra > 0 ? row.horasExtra : '—'}
                    </Text>
                </View>
            </View>
        );
    });

    return (
        <View style={[styles.fill, { minHeight: 0 }]}>
            {/* Barra superior compacta */}
            <View style={[styles.topBar, { borderColor: border, backgroundColor: cardBg }]}>
                <TouchableOpacity
                    style={[styles.topBtn, addOpen && styles.topBtnOn]}
                    onPress={() => setAddOpen((o) => !o)}
                >
                    <Text style={[styles.topBtnTxt, { color: addOpen ? '#FFF' : textColor }]}>
                        {addOpen ? '▾ Agregar' : '+ Agregar fila'}
                    </Text>
                </TouchableOpacity>
                <Text style={[styles.topMeta, { color: subColor }]} numberOfLines={1}>
                    {rowsFiltered.length}/{rows.length} fila{rows.length !== 1 ? 's' : ''} · clic en día · &gt;{JORNADA_SEMANAL_HORAS}h = HE
                </Text>
                <View style={styles.topActions}>
                    <TouchableOpacity
                        style={[styles.topBtnGhost, { borderColor: border }]}
                        onPress={vaciarSemana}
                        disabled={saving || saveInFlightRef.current || !horarioPersonalizadoId || rows.length === 0}
                    >
                        <Text style={[styles.topBtnGhostTxt, { color: subColor }]}>Vaciar</Text>
                    </TouchableOpacity>
                    <View style={[
                        styles.saveDot,
                        {
                            backgroundColor: autoSaveStatus === 'error' ? '#F87171'
                                : autoSaveStatus === 'saved' ? '#34D399'
                                : '#94A3B8',
                        },
                    ]} />
                    <Text style={[
                        styles.saveLbl,
                        {
                            color: autoSaveStatus === 'error' ? '#F87171'
                                : autoSaveStatus === 'saved' ? '#34D399'
                                : subColor,
                        },
                    ]}>
                        {autoSaveStatus === 'saving' || saving ? 'Guardando'
                            : autoSaveStatus === 'pending' ? 'Pendiente'
                            : autoSaveStatus === 'error' ? 'Error'
                            : 'Guardado'}
                    </Text>
                </View>
            </View>

            {/* Filtros */}
            <View style={[styles.filterBar, { borderColor: border, backgroundColor: cardBg }]}>
                <TextInput
                    style={[styles.filterInput, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                    placeholder="Filtrar máquina/proceso…"
                    placeholderTextColor={subColor}
                    value={filterMaq}
                    onChangeText={setFilterMaq}
                />
                <TextInput
                    style={[styles.filterInput, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                    placeholder="Filtrar persona…"
                    placeholderTextColor={subColor}
                    value={filterUser}
                    onChangeText={setFilterUser}
                />
                <TouchableOpacity
                    style={[styles.filterToggle, filtersOpen && styles.filterToggleOn]}
                    onPress={() => setFiltersOpen((v) => !v)}
                >
                    <Text style={styles.filterToggleTxt}>
                        Más{hasActiveFilters ? ' ●' : ''} {filtersOpen ? '▴' : '▾'}
                    </Text>
                </TouchableOpacity>
                {hasActiveFilters ? (
                    <TouchableOpacity onPress={clearFilters}>
                        <Text style={{ color: '#FBBF24', fontSize: 11 }}>Limpiar</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            {filtersOpen ? (
                <View style={[styles.filterExpanded, { borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipRow}>
                            {[
                                { id: 'todos', label: 'Todos' },
                                { id: 'operarios', label: 'Operarios' },
                                { id: 'auxiliares', label: 'Auxiliares' },
                            ].map((f) => (
                                <TouchableOpacity
                                    key={f.id}
                                    style={[styles.chipMini, filterRol === f.id && styles.chipMiniOn]}
                                    onPress={() => setFilterRol(f.id)}
                                >
                                    <Text style={[styles.chipMiniTxt, { color: filterRol === f.id ? '#FFF' : textColor }]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <View style={styles.chipSep} />
                            {[
                                { id: 'todos', label: 'Cualquier estado' },
                                { id: 'incapacidad', label: 'Incapacidad' },
                                { id: 'novedad', label: 'Novedades' },
                                { id: 'con_horario', label: 'Con horario' },
                                { id: 'sin_horario', label: 'Sin horario' },
                            ].map((f) => (
                                <TouchableOpacity
                                    key={`nov-${f.id}`}
                                    style={[styles.chipMini, filterNovedad === f.id && styles.chipMiniOn]}
                                    onPress={() => setFilterNovedad(f.id)}
                                >
                                    <Text style={[styles.chipMiniTxt, { color: filterNovedad === f.id ? '#FFF' : textColor }]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            ) : null}

            {/* Panel agregar (colapsable) */}
            {addOpen ? (
                <View style={[styles.addPanel, { borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                    <View style={styles.addRow}>
                        <View style={styles.addTabs}>
                            {[
                                { id: 'proceso', label: 'Proceso' },
                                { id: 'maquina', label: 'Máquina' },
                            ].map((t) => (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[styles.addTab, addDestTab === t.id && styles.addTabOn]}
                                    onPress={() => { setAddDestTab(t.id); setMaqQ(''); clearSeleccion(); }}
                                >
                                    <Text style={{ color: addDestTab === t.id ? '#FFF' : subColor, fontSize: 11, fontWeight: '700' }}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={[styles.addSearch, { flex: 1, color: textColor, borderColor: border, backgroundColor: pageBg }]}
                            placeholder={addDestTab === 'proceso' ? 'Buscar proceso Gantt…' : 'Buscar máquina…'}
                            placeholderTextColor={subColor}
                            value={maqQ}
                            onChangeText={setMaqQ}
                        />
                        {addMaqId ? (
                            <TouchableOpacity onPress={clearSeleccion} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={{ color: subColor, fontSize: 11 }}>✕</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <ScrollView style={styles.addList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {destinoOpciones.length === 0 ? (
                            <Text style={{ color: subColor, fontSize: 11, padding: 6 }}>Sin resultados</Text>
                        ) : destinoOpciones.map((opt) => {
                            const active = String(addMaqId) === String(opt.id);
                            return (
                                <TouchableOpacity
                                    key={`${opt.tipo}-${opt.id}`}
                                    style={[styles.addListItem, active && styles.addListItemOn]}
                                    onPress={() => pickMaquina(opt.id, opt.label)}
                                >
                                    <Text style={{ color: active ? '#FFF' : textColor, fontSize: 11 }} numberOfLines={1}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <View style={styles.addRow}>
                        <View style={styles.addTabs}>
                            {[
                                { id: false, label: 'Operario' },
                                { id: true, label: 'Auxiliar' },
                            ].map((t) => (
                                <TouchableOpacity
                                    key={t.label}
                                    style={[styles.addTab, addEsAuxiliar === t.id && styles.addTabOn]}
                                    onPress={() => setAddEsAuxiliar(t.id)}
                                >
                                    <Text style={{ color: addEsAuxiliar === t.id ? '#FFF' : subColor, fontSize: 11, fontWeight: '700' }}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={[styles.addSearch, { flex: 1, color: textColor, borderColor: border, backgroundColor: pageBg }]}
                            placeholder="Buscar operario…"
                            placeholderTextColor={subColor}
                            value={userQ}
                            onChangeText={setUserQ}
                        />
                        <TouchableOpacity
                            style={[styles.btnAdd, (!addMaqId || !addUserId || duplicateRow) && { opacity: 0.4 }]}
                            onPress={agregarFila}
                            disabled={!addMaqId || !addUserId || duplicateRow}
                        >
                            <Text style={styles.btnAddTxt}>Agregar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.topBtnGhost, { borderColor: border }]} onPress={closeAddPanel}>
                            <Text style={{ color: subColor, fontSize: 11 }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.addListSm} nestedScrollEnabled keyboardShouldPersistTaps="handled" horizontal={false}>
                        {usuariosFiltrados.map((u) => {
                            const id = u.id ?? u.Id;
                            const active = String(addUserId) === String(id);
                            const nombre = u.nombre ?? u.Nombre ?? '';
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[styles.addListItem, active && styles.addListItemOn]}
                                    onPress={() => pickUser(id, nombre)}
                                >
                                    <Text style={{ color: active ? '#FFF' : textColor, fontSize: 11 }} numberOfLines={1}>
                                        {nombre}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    {duplicateRow ? (
                        <Text style={styles.dupHint}>Esa combinación ya existe en la grilla.</Text>
                    ) : selectedMaq && selectedUser ? (
                        <Text style={[styles.selPreview, { color: subColor }]} numberOfLines={1}>
                            {addEsAuxiliar ? 'Aux' : 'Op'} · {selectedMaq.nombre ?? selectedMaq.Nombre} · {selectedUser.nombre ?? selectedUser.Nombre}
                        </Text>
                    ) : null}
                </View>
            ) : null}

            {!horarioPersonalizadoId ? (
                <Text style={{ color: '#F87171', padding: 6, fontSize: 11 }}>
                    Configure turnos en pestaña Turnos para guardar.
                </Text>
            ) : null}

            <View
                style={[styles.gridShell, { flex: 1, minHeight: 0 }]}
                onLayout={onGridShellLayout}
            >
                <ScrollView
                    horizontal
                    style={[styles.gridHScroll, shellH > 0 ? { height: shellH } : null]}
                    showsHorizontalScrollIndicator
                >
                    <View style={[
                        styles.gridInner,
                        { minWidth: gridMinWidth },
                        shellH > 0 ? { height: shellH } : null,
                    ]}>
                        <View style={styles.headerRow}>
                            <View style={[styles.procCol, { width: PROC_COL, borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0' }]}>
                                <Text style={[styles.hdr, { color: subColor }]}>Proceso</Text>
                            </View>
                            <View style={[styles.trabCol, { width: TRAB_COL, borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0' }]}>
                                <Text style={[styles.hdr, { color: subColor }]}>Trabajador</Text>
                            </View>
                            {dias.map((d, i) => {
                                const esFestivo = festivoSet.has(diasKeys[i]);
                                return (
                                    <View
                                        key={diasKeys[i]}
                                        style={[
                                            styles.dayCol,
                                            {
                                                width: dayColW,
                                                borderColor: border,
                                                backgroundColor: esFestivo
                                                    ? (isDarkMode ? '#78350F' : '#FEF3C7')
                                                    : (isDarkMode ? '#0F172A' : '#E2E8F0'),
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.hdr, { color: textColor }]}>{DAY_LABELS[i]}</Text>
                                        <Text style={[styles.hdrSub, { color: subColor }]}>{d.getDate()}</Text>
                                        {esFestivo ? <Text style={styles.hdrFestivo}>F</Text> : null}
                                    </View>
                                );
                            })}
                            <View style={[styles.totalCol, { width: TOTAL_COL, borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0' }]}>
                                <Text style={[styles.hdr, { color: subColor }]}>h</Text>
                            </View>
                            <View style={[styles.heCol, { width: HE_COL, borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0' }]}>
                                <Text style={[styles.hdr, { color: subColor }]}>HE</Text>
                            </View>
                        </View>

                        {Platform.OS === 'web' ? (
                            <View style={bodyScrollStyle}>
                                {gridRowsContent}
                            </View>
                        ) : (
                            <ScrollView
                                style={bodyScrollStyle}
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                            >
                                {gridRowsContent}
                            </ScrollView>
                        )}
                    </View>
                </ScrollView>
            </View>

            <Modal visible={!!editCell} transparent animationType="fade" onRequestClose={() => setEditCell(null)}>
                <View style={styles.modalBg}>
                    <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: border }]}>
                        <Text style={[styles.modalTitle, { color: textColor }]}>
                            Horario del día{editCell?.esFestivo ? ' (festivo)' : ''}
                        </Text>
                        {editCell?.esFestivo ? (
                            <Text style={{ color: '#B45309', fontSize: 12, marginBottom: 10 }}>
                                Día festivo: puede asignar turno si el operario trabaja ese día.
                            </Text>
                        ) : null}
                        <View style={styles.modeRow}>
                            {[
                                { id: 'turno', label: 'Turno' },
                                { id: 'descanso', label: 'Descanso (día libre)' },
                                { id: 'vacio', label: 'Vacío' },
                            ].map((m) => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.modeChip, form.modo === m.id && styles.modeChipOn]}
                                    onPress={() => setForm((f) => ({ ...f, modo: m.id }))}
                                >
                                    <Text style={[styles.modeChipTxt, { color: form.modo === m.id ? '#FFF' : textColor }]}>{m.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {form.modo === 'turno' ? (
                            <>
                                <Text style={[styles.lbl, { color: subColor }]}>Inicio / Fin (24h)</Text>
                                <View style={styles.timeRow}>
                                    <TextInput
                                        style={[styles.timeInput, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                        value={form.inicio}
                                        onChangeText={(t) => setForm((f) => ({ ...f, inicio: t }))}
                                        placeholder="07:00"
                                        placeholderTextColor={subColor}
                                    />
                                    <Text style={{ color: subColor }}>—</Text>
                                    <TextInput
                                        style={[styles.timeInput, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                        value={form.fin}
                                        onChangeText={(t) => setForm((f) => ({ ...f, fin: t }))}
                                        placeholder="18:00"
                                        placeholderTextColor={subColor}
                                    />
                                </View>
                                <Text style={[styles.lbl, { color: subColor, marginTop: 8 }]}>
                                    {jornadaDias.length && presetsJornadaParaDia(editCell?.fecha, jornadaDias).length
                                        ? 'Turnos jornada (Producción → Horarios)'
                                        : 'Plantillas'}
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                                    {presetsDia.map((p) => (
                                        <TouchableOpacity
                                            key={`${p.inicio}-${p.fin}-${p.label}`}
                                            style={[styles.presetBtn, { borderColor: border }]}
                                            onPress={() => setForm({
                                                inicio: p.inicio,
                                                fin: p.fin,
                                                modo: 'turno',
                                                descuentaComida: !!p.descuentaComida,
                                                minutosComida: p.descuentaComida
                                                    ? (Number(p.minutosComida) || 30)
                                                    : 30,
                                            })}
                                        >
                                            <Text style={{ color: textColor, fontSize: 11 }}>{p.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity
                                    style={styles.comidaRow}
                                    onPress={() => setForm((f) => ({
                                        ...f,
                                        descuentaComida: !f.descuentaComida,
                                        minutosComida: !f.descuentaComida && !f.minutosComida ? 30 : f.minutosComida,
                                    }))}
                                >
                                    <View style={[
                                        styles.comidaCheck,
                                        {
                                            borderColor: form.descuentaComida ? '#2563EB' : border,
                                            backgroundColor: form.descuentaComida ? '#2563EB' : pageBg,
                                        },
                                    ]}
                                    >
                                        {form.descuentaComida ? (
                                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                                        ) : null}
                                    </View>
                                    <Text style={{ color: textColor, fontSize: 13, flex: 1 }}>
                                        Descuenta comida (alimentación)
                                    </Text>
                                </TouchableOpacity>
                                {form.descuentaComida ? (
                                    <View style={[styles.comidaMinRow, { marginTop: 8 }]}>
                                        <Text style={[styles.lbl, { color: subColor, marginBottom: 0 }]}>Minutos a descontar</Text>
                                        <TextInput
                                            style={[styles.comidaMinInput, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                            value={String(form.minutosComida ?? 0)}
                                            onChangeText={(t) => setForm((f) => ({
                                                ...f,
                                                minutosComida: Math.max(0, parseInt(t.replace(/\D/g, ''), 10) || 0),
                                            }))}
                                            keyboardType="numeric"
                                            placeholder="30"
                                            placeholderTextColor={subColor}
                                        />
                                    </View>
                                ) : null}
                                {(() => {
                                    const ini = parseHoraMinutos(form.inicio);
                                    const fin = parseHoraMinutos(form.fin);
                                    if (ini == null || fin == null || !editCell?.fecha) return null;
                                    const bruto = horasFromMinutos(minutosEntre(ini, fin));
                                    const comidaOpts = {
                                        descuentaComida: !!form.descuentaComida,
                                        minutosComida: form.descuentaComida ? (Number(form.minutosComida) || 0) : 0,
                                    };
                                    const descMin = minutosDescuentoComida({
                                        ...comidaOpts,
                                        fechaDia: editCell.fecha,
                                        horaInicio: form.inicio,
                                        horaFin: form.fin,
                                        jornadaDias,
                                    });
                                    const h = horasEfectivasTurno(ini, fin, editCell.fecha, jornadaDias, comidaOpts);
                                    if (!descMin) {
                                        return (
                                            <Text style={{ color: subColor, fontSize: 12, marginTop: 10 }}>
                                                {`Horas trabajadas: ${h} h`}
                                            </Text>
                                        );
                                    }
                                    return (
                                        <Text style={{ color: subColor, fontSize: 12, marginTop: 10 }}>
                                            {`Horas trabajadas: ${h} h (turno ${bruto} h − ${descMin} min comida)`}
                                        </Text>
                                    );
                                })()}
                            </>
                        ) : null}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { borderColor: border }]} onPress={() => setEditCell(null)}>
                                <Text style={{ color: subColor }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnOk} onPress={applyCellEdit}>
                                <Text style={{ color: '#FFF', fontWeight: '700' }}>Aplicar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1, minHeight: 0 },
    gridShell: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
        ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column', height: 0 } : null),
    },
    gridHScroll: {
        flex: 1,
        minHeight: 0,
        width: '100%',
    },
    gridInner: {
        flexDirection: 'column',
        ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column' } : null),
    },
    gridBody: {
        flexShrink: 0,
        minHeight: 0,
        width: '100%',
    },
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginBottom: 6,
    },
    filterInput: {
        flex: 1,
        minWidth: 90,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: Platform.OS === 'web' ? 5 : 4,
        fontSize: 11,
    },
    filterToggle: { backgroundColor: '#334155', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
    filterToggleOn: { backgroundColor: '#4F46E5' },
    filterToggleTxt: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    filterExpanded: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 6 },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    chipMini: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#334155' },
    chipMiniOn: { backgroundColor: '#2563EB' },
    chipMiniTxt: { fontSize: 11, fontWeight: '600' },
    chipSep: { width: 1, height: 16, backgroundColor: '#475569', marginHorizontal: 2 },
    topBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6,
    },
    topBtn: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    topBtnOn: { backgroundColor: '#2563EB' },
    topBtnTxt: { fontSize: 11, fontWeight: '700' },
    topMeta: { flex: 1, fontSize: 10, minWidth: 80 },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    topBtnGhost: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
    topBtnGhostTxt: { fontSize: 10, fontWeight: '700' },
    saveDot: { width: 8, height: 8, borderRadius: 4 },
    saveLbl: { fontSize: 10, fontWeight: '700', minWidth: 56 },
    addPanel: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 6, gap: 6 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    addTabs: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#475569' },
    addTab: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'transparent' },
    addTabOn: { backgroundColor: '#7C3AED' },
    addSearch: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, minWidth: 100 },
    addList: { maxHeight: 88, borderRadius: 6 },
    addListSm: { maxHeight: 72, borderRadius: 6 },
    addListItem: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4, marginBottom: 2 },
    addListItemOn: { backgroundColor: '#2563EB' },
    selPreview: { fontSize: 10, marginTop: 2 },
    dupHint: { color: '#F87171', fontSize: 10 },
    btnAdd: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
    btnAddTxt: { color: '#FFF', fontWeight: '700', fontSize: 11 },
    headerRow: { flexDirection: 'row' },
    bodyRow: { flexDirection: 'row', minHeight: 44 },
    procCol: { borderWidth: 1, padding: 4, justifyContent: 'center' },
    trabCol: { borderWidth: 1, padding: 4, justifyContent: 'center' },
    dayCol: { borderWidth: 1, padding: 2, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
    totalCol: { borderWidth: 1, padding: 2, alignItems: 'center', justifyContent: 'center' },
    heCol: { borderWidth: 1, padding: 2, alignItems: 'center', justifyContent: 'center' },
    hdr: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
    hdrSub: { fontSize: 9, textAlign: 'center' },
    hdrFestivo: { fontSize: 8, fontWeight: '800', color: '#B45309', textAlign: 'center' },
    procTxt: { fontSize: 10, fontWeight: '700', lineHeight: 13 },
    trabHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
    rolBadge: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: '800',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        overflow: 'hidden',
    },
    trabTxt: { fontSize: 10, fontWeight: '600', lineHeight: 13 },
    quitarTxt: { color: '#F87171', fontSize: 9, marginTop: 1 },
    cellInner: { alignItems: 'center', justifyContent: 'center' },
    cellTxt: { fontSize: 9, textAlign: 'center', lineHeight: 12 },
    cellHrs: { fontSize: 8, textAlign: 'center', fontWeight: '700', marginTop: 1 },
    cellDescanso: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
    totalTxt: { fontSize: 11, fontWeight: '800' },
    heTxt: { fontSize: 10, fontWeight: '700' },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalCard: { width: '100%', maxWidth: 400, borderRadius: 12, borderWidth: 1, padding: 16 },
    modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
    lbl: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    modeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#64748B' },
    modeChipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    modeChipTxt: { fontSize: 12, fontWeight: '700' },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
    presetBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginRight: 6 },
    comidaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    comidaCheck: {
        width: 22, height: 22, borderWidth: 2, borderRadius: 4,
        alignItems: 'center', justifyContent: 'center',
    },
    comidaMinRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    comidaMinInput: {
        borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
        width: 72, textAlign: 'center', fontSize: 14,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    modalBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    modalBtnOk: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
