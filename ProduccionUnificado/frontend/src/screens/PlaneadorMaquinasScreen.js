import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Modal, TextInput, Platform
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as planeacionApi from '../services/planeacionApi';
import * as api from '../services/api';

const PROCESOS = [
    'Preprensa', 'Conversion', 'Corte', 'Impresion', 'Recubrimiento',
    'Colaminado', 'Estampado', 'Troquelado', 'Terminado'
];

const DAY_WIDTH = 56;
const BASE_ROW_HEIGHT = 52;
const CHIP_HEIGHT = 18;
const PROCESS_COL_WIDTH = 155;
const WEEKS_TO_SHOW = 4;
const DAYS_PER_WEEK = 7;
const RANGE_DAYS = WEEKS_TO_SHOW * DAYS_PER_WEEK;
const MAX_VISIBLE_CHIPS = 3;

const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => {
    const h = i + 6;
    return { value: h, label: `${String(h).padStart(2, '0')}:00` };
});

const WEEK_PALETTE = [
    { header: '#1D4ED8', bg: '#1E40AF18', border: '#3B82F6', label: 'Semana 1' },
    { header: '#7C3AED', bg: '#6D28D918', border: '#8B5CF6', label: 'Semana 2' },
    { header: '#0D9488', bg: '#0F766E18', border: '#14B8A6', label: 'Semana 3' },
    { header: '#C2410C', bg: '#EA580C18', border: '#F97316', label: 'Semana 4' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ESTADO_CONFIG = {
    pendiente: { label: 'Pendiente', color: '#94A3B8', bg: '#94A3B822' },
    en_proceso: { label: 'En proceso', color: '#3B82F6', bg: '#3B82F622' },
    completado: { label: 'Completado', color: '#22C55E', bg: '#22C55E22' },
    atrasado: { label: 'Atrasado', color: '#EF4444', bg: '#EF444422' },
};

const formatDateKey = (d) => {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getRangeDates = (baseDate) => {
    const start = getMonday(baseDate);
    return Array.from({ length: RANGE_DAYS }, (_, i) => {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        return date;
    });
};

const buildDefaultProcesosForm = (startDate) => {
    const base = formatDateKey(startDate);
    const result = {};
    PROCESOS.forEach((p, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const fin = new Date(d);
        fin.setDate(fin.getDate() + 1);
        result[p] = {
            activo: false,
            fechaInicio: formatDateKey(d),
            horaInicio: 8,
            fechaFin: formatDateKey(fin),
            horaFin: 18,
            horasEstimadas: '8',
            tiemposAuxiliares: [],
        };
    });
    result[PROCESOS[0]].fechaInicio = base;
    return result;
};

const buildDateTime = (dateStr, hour) => {
    const h = String(hour ?? 8).padStart(2, '0');
    return `${dateStr}T${h}:00:00`;
};

const parseHour = (dateStr) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 8 : d.getHours();
};

const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2, '0')}:00`;
};

const getErrorMessage = (error) => {
    const data = error?.response?.data;
    if (typeof data === 'string') return data;
    if (data?.title) return data.title;
    if (data?.message) return data.message;
    return error?.message || 'Error desconocido';
};

const groupDatesByMonth = (dates) => {
    const groups = [];
    dates.forEach((date, idx) => {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
            last.count += 1;
            last.endIdx = idx;
        } else {
            groups.push({
                key,
                label: MESES[date.getMonth()],
                year: date.getFullYear(),
                count: 1,
                startIdx: idx,
                endIdx: idx,
            });
        }
    });
    return groups;
};

const groupDatesByWeek = (dates) => {
    const groups = [];
    dates.forEach((date, idx) => {
        const weekIdx = Math.floor(idx / DAYS_PER_WEEK);
        const palette = WEEK_PALETTE[weekIdx % WEEK_PALETTE.length];
        const weekStart = dates[weekIdx * DAYS_PER_WEEK];
        const weekEnd = dates[Math.min(weekIdx * DAYS_PER_WEEK + 6, dates.length - 1)];
        const label = `${weekStart.getDate()}–${weekEnd.getDate()} ${MESES[weekStart.getMonth()].slice(0, 3)}`;

        if (groups.length && groups[groups.length - 1].weekIdx === weekIdx) {
            groups[groups.length - 1].count += 1;
            groups[groups.length - 1].endIdx = idx;
        } else {
            groups.push({
                weekIdx,
                key: `week-${weekIdx}`,
                label,
                palette,
                count: 1,
                startIdx: idx,
                endIdx: idx,
            });
        }
    });
    return groups;
};

const overlapsDay = (fechaInicio, fechaFin, dayDate) => {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    return start <= dayEnd && end >= dayStart;
};

export default function PlaneadorMaquinasScreen() {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [pivotDate, setPivotDate] = useState(new Date());
    const [rangeDates, setRangeDates] = useState(getRangeDates(new Date()));
    const [programaciones, setProgramaciones] = useState([]);
    const [ordenes, setOrdenes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [backendUnavailable, setBackendUnavailable] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [showDayDetail, setShowDayDetail] = useState(false);
    const [dayDetailData, setDayDetailData] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        numeroOP: '',
        cliente: '',
        metaTiros: '',
        procesosSeleccionados: buildDefaultProcesosForm(new Date()),
    });

    const monthGroups = useMemo(() => groupDatesByMonth(rangeDates), [rangeDates]);
    const weekGroups = useMemo(() => groupDatesByWeek(rangeDates), [rangeDates]);

    const selectedProgramacion = useMemo(
        () => programaciones.find((p) => p.id === selectedId) || programaciones[0] || null,
        [programaciones, selectedId]
    );

    const getDayItems = useCallback((procesoNombre, dayIdx) => {
        const dayDate = rangeDates[dayIdx];
        const items = [];
        programaciones.forEach((prog) => {
            prog.procesos
                .filter((p) => p.proceso === procesoNombre && overlapsDay(p.fechaInicio, p.fechaFin, dayDate))
                .forEach((p) => items.push({ prog, proceso: p }));
        });
        return items;
    }, [programaciones, rangeDates]);

    const rowHeights = useMemo(() => {
        const heights = {};
        PROCESOS.forEach((proceso) => {
            let maxItems = 0;
            rangeDates.forEach((_, i) => {
                maxItems = Math.max(maxItems, getDayItems(proceso, i).length);
            });
            const visible = Math.min(maxItems, MAX_VISIBLE_CHIPS);
            const extra = maxItems > MAX_VISIBLE_CHIPS ? 1 : 0;
            heights[proceso] = Math.max(BASE_ROW_HEIGHT, 10 + visible * (CHIP_HEIGHT + 2) + extra * 14);
        });
        return heights;
    }, [getDayItems, rangeDates]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const start = formatDateKey(rangeDates[0]);
            const end = `${formatDateKey(rangeDates[rangeDates.length - 1])}T23:59:59`;
            const [progs, ords] = await Promise.all([
                planeacionApi.getProgramacionesRango(start, end),
                api.getOrdenes(),
            ]);
            setProgramaciones(Array.isArray(progs) ? progs : []);
            setOrdenes(ords);
            setBackendUnavailable(false);
            setSelectedId((prev) => prev ?? (progs.length > 0 ? progs[0].id : null));
        } catch (error) {
            console.error('Error cargando programaciones:', error);
            if (error?.response?.status === 404) {
                setProgramaciones([]);
                setBackendUnavailable(true);
            } else {
                Alert.alert('Error', getErrorMessage(error));
            }
        } finally {
            setLoading(false);
        }
    }, [rangeDates]);

    useEffect(() => {
        setRangeDates(getRangeDates(pivotDate));
    }, [pivotDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const shiftRange = (direction) => {
        const next = new Date(pivotDate);
        next.setDate(next.getDate() + direction * RANGE_DAYS);
        setPivotDate(next);
    };

    const openDayDetailModal = (proceso, dayDate, items) => {
        setDayDetailData({ proceso, dayDate, items });
        setShowDayDetail(true);
    };

    const openCreateModal = () => {
        setEditingId(null);
        setForm({
            numeroOP: '',
            cliente: '',
            metaTiros: '',
            procesosSeleccionados: buildDefaultProcesosForm(rangeDates[0]),
        });
        setShowModal(true);
    };

    const openEditModal = (prog) => {
        setEditingId(prog.id);
        const procesosMap = buildDefaultProcesosForm(rangeDates[0]);
        prog.procesos.forEach((p) => {
            procesosMap[p.proceso] = {
                activo: true,
                fechaInicio: formatDateKey(new Date(p.fechaInicio)),
                horaInicio: parseHour(p.fechaInicio),
                fechaFin: formatDateKey(new Date(p.fechaFin)),
                horaFin: parseHour(p.fechaFin),
                horasEstimadas: String(p.horasEstimadas ?? ''),
                tiemposAuxiliares: (p.tiemposAuxiliares || []).map((t, i) => ({
                    id: `${i}-${t.descripcion}`,
                    descripcion: t.descripcion,
                    horas: String(t.horas ?? ''),
                })),
            };
        });
        setForm({
            numeroOP: prog.numeroOP,
            cliente: prog.cliente || '',
            metaTiros: String(prog.metaTiros || ''),
            procesosSeleccionados: procesosMap,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.numeroOP.trim()) {
            Alert.alert('Campos incompletos', 'Ingrese el número de OP.');
            return;
        }
        if (!form.metaTiros || isNaN(parseInt(form.metaTiros, 10))) {
            Alert.alert('Campos incompletos', 'Ingrese la meta de tiros (número válido).');
            return;
        }

        const procesosActivos = Object.entries(form.procesosSeleccionados)
            .filter(([, v]) => v.activo)
            .map(([proceso, v]) => {
                const inicio = buildDateTime(v.fechaInicio, v.horaInicio);
                const fin = buildDateTime(v.fechaFin, v.horaFin);
                if (new Date(inicio) >= new Date(fin)) {
                    throw new Error(`El proceso "${proceso}" tiene fecha/hora de fin anterior al inicio.`);
                }
                return {
                    proceso,
                    fechaInicio: inicio,
                    fechaFin: fin,
                    horasEstimadas: v.horasEstimadas ? parseFloat(v.horasEstimadas) : null,
                    tiemposAuxiliares: (v.tiemposAuxiliares || [])
                        .filter((t) => t.descripcion?.trim())
                        .map((t) => ({
                            descripcion: t.descripcion.trim(),
                            horas: parseFloat(t.horas) || 0,
                        })),
                };
            });

        if (procesosActivos.length === 0) {
            Alert.alert('Procesos', 'Seleccione al menos un proceso para la OP.');
            return;
        }

        const ordenMatch = ordenes.find((o) => o.numero === form.numeroOP.trim());
        const payload = {
            numeroOP: form.numeroOP.trim(),
            ordenProduccionId: ordenMatch?.id || null,
            cliente: form.cliente.trim(),
            metaTiros: parseInt(form.metaTiros, 10),
            procesos: procesosActivos,
        };

        setSaving(true);
        try {
            if (editingId) {
                await planeacionApi.actualizarProgramacionOP(editingId, payload);
            } else {
                await planeacionApi.crearProgramacionOP(payload);
            }
            setShowModal(false);
            await loadData();
            Alert.alert('Éxito', editingId ? 'Programación actualizada.' : 'Programación guardada correctamente.');
        } catch (error) {
            if (error?.response?.status === 404) {
                setBackendUnavailable(true);
                Alert.alert('Backend desactualizado', 'Reinicie el backend (dotnet run) para habilitar guardar programaciones OP.');
            } else if (error.message && !error.response) {
                Alert.alert('Validación', error.message);
            } else {
                Alert.alert('Error', getErrorMessage(error));
            }
        } finally {
            setSaving(false);
        }
    };

    const updateProcesoField = (proceso, field, value) => {
        setForm((f) => ({
            ...f,
            procesosSeleccionados: {
                ...f.procesosSeleccionados,
                [proceso]: { ...f.procesosSeleccionados[proceso], [field]: value },
            },
        }));
    };

    const addTiempoAuxiliar = (proceso) => {
        const proc = form.procesosSeleccionados[proceso];
        updateProcesoField(proceso, 'tiemposAuxiliares', [
            ...(proc.tiemposAuxiliares || []),
            { id: `${Date.now()}`, descripcion: '', horas: '' },
        ]);
    };

    const updateTiempoAuxiliar = (proceso, auxId, field, value) => {
        const proc = form.procesosSeleccionados[proceso];
        updateProcesoField(proceso, 'tiemposAuxiliares', proc.tiemposAuxiliares.map((t) =>
            t.id === auxId ? { ...t, [field]: value } : t
        ));
    };

    const removeTiempoAuxiliar = (proceso, auxId) => {
        const proc = form.procesosSeleccionados[proceso];
        updateProcesoField(proceso, 'tiemposAuxiliares', proc.tiemposAuxiliares.filter((t) => t.id !== auxId));
    };

    const handleDelete = (id) => {
        const performDelete = async () => {
            try {
                await planeacionApi.eliminarProgramacionOP(id);
                if (selectedId === id) setSelectedId(null);
                setShowModal(false);
                setShowDayDetail(false);
                await loadData();
            } catch (e) {
                Alert.alert('Error', 'No se pudo eliminar la programación.');
            }
        };

        if (Platform.OS === 'web' && window.confirm) {
            if (window.confirm('¿Eliminar esta programación de OP?')) performDelete();
        } else {
            Alert.alert('Eliminar', '¿Eliminar esta programación de OP?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: performDelete },
            ]);
        }
    };

    const getWeekForDay = (dayIdx) => weekGroups.find((w) => dayIdx >= w.startIdx && dayIdx <= w.endIdx);

    const renderDayCell = (proceso, dayIdx) => {
        const dayDate = rangeDates[dayIdx];
        const items = getDayItems(proceso, dayIdx);
        const week = getWeekForDay(dayIdx);
        const palette = week?.palette || WEEK_PALETTE[0];
        const isToday = dayDate.toDateString() === new Date().toDateString();
        const visibleItems = items.slice(0, MAX_VISIBLE_CHIPS);
        const hiddenCount = items.length - MAX_VISIBLE_CHIPS;

        return (
            <TouchableOpacity
                key={dayIdx}
                style={[
                    styles.daySlot,
                    {
                        width: DAY_WIDTH,
                        height: rowHeights[proceso],
                        backgroundColor: isToday ? palette.header + '33' : palette.bg,
                        borderRightColor: palette.border + '55',
                    },
                ]}
                onPress={() => {
                    if (items.length > 1) {
                        openDayDetailModal(proceso, dayDate, items);
                    } else if (items.length === 1) {
                        setSelectedId(items[0].prog.id);
                    }
                }}
                onLongPress={() => {
                    if (items.length > 0) openDayDetailModal(proceso, dayDate, items);
                }}
            >
                {visibleItems.map(({ prog, proceso: p }, i) => {
                    const estado = p.estado || 'pendiente';
                    const isSelected = selectedProgramacion?.id === prog.id;
                    return (
                        <TouchableOpacity
                            key={`${prog.id}-${p.id}`}
                            style={[
                                styles.opChip,
                                {
                                    backgroundColor: (prog.color || '#3B82F6') + (isSelected ? 'FF' : 'DD'),
                                    borderColor: isSelected ? '#FACC15' : (prog.color || '#3B82F6'),
                                    top: 4 + i * (CHIP_HEIGHT + 2),
                                },
                            ]}
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                setSelectedId(prog.id);
                            }}
                        >
                            <Text style={styles.opChipText} numberOfLines={1}>{prog.numeroOP}</Text>
                            {estado === 'en_proceso' && <View style={styles.chipPulse} />}
                        </TouchableOpacity>
                    );
                })}
                {hiddenCount > 0 && (
                    <View style={[styles.moreChip, { top: 4 + MAX_VISIBLE_CHIPS * (CHIP_HEIGHT + 2) }]}>
                        <Text style={styles.moreChipText}>+{hiddenCount} más</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderGantt = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.ganttScroll}>
            <View>
                <View style={styles.ganttHeaderRow}>
                    <View style={[styles.processHeaderCell, { backgroundColor: '#1E293B', height: 88 }]}>
                        <Text style={styles.processHeaderText}>ACTIVIDADES</Text>
                    </View>
                    <View>
                        <View style={styles.monthRow}>
                            {monthGroups.map((g) => (
                                <View
                                    key={g.key}
                                    style={[styles.monthCell, { width: g.count * DAY_WIDTH, backgroundColor: '#1E293B' }]}
                                >
                                    <Text style={styles.monthText}>{g.label} {g.year}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={styles.weekRow}>
                            {weekGroups.map((w) => (
                                <View
                                    key={w.key}
                                    style={[styles.weekCell, { width: w.count * DAY_WIDTH, backgroundColor: w.palette.header }]}
                                >
                                    <Text style={styles.weekText}>{w.palette.label}</Text>
                                    <Text style={styles.weekSubText}>{w.label}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={styles.dayRow}>
                            {rangeDates.map((d, i) => {
                                const week = getWeekForDay(i);
                                const palette = week?.palette || WEEK_PALETTE[0];
                                const isToday = d.toDateString() === new Date().toDateString();
                                const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.dayCell,
                                            {
                                                width: DAY_WIDTH,
                                                backgroundColor: isToday ? '#FACC15' : palette.header,
                                                borderRightColor: palette.border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.dayNameText, isToday && { color: '#1E293B' }]}>
                                            {dayNames[d.getDay()]}
                                        </Text>
                                        <Text style={[styles.dayText, isToday && { color: '#1E293B' }]}>{d.getDate()}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>

                <ScrollView style={styles.ganttBody} nestedScrollEnabled>
                    {PROCESOS.map((proceso, rowIdx) => (
                        <View
                            key={proceso}
                            style={[
                                styles.processRow,
                                {
                                    height: rowHeights[proceso],
                                    backgroundColor: rowIdx % 2 === 0
                                        ? (isDarkMode ? '#111827' : '#F8FAFC')
                                        : (isDarkMode ? '#0F172A' : '#FFFFFF'),
                                },
                            ]}
                        >
                            <View style={[styles.processLabelCell, { borderColor: colors.border, height: rowHeights[proceso] }]}>
                                <Text style={[styles.processLabel, { color: colors.text }]}>{proceso}</Text>
                            </View>
                            <View style={[styles.processTrack, { width: rangeDates.length * DAY_WIDTH, height: rowHeights[proceso] }]}>
                                {rangeDates.map((_, i) => renderDayCell(proceso, i))}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </ScrollView>
    );

    const renderDayDetailModal = () => {
        if (!dayDetailData) return null;
        const { proceso, dayDate, items } = dayDetailData;

        return (
            <Modal visible={showDayDetail} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.dayDetailContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFFFFF' }]}>
                        <View style={styles.dayDetailHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.dayDetailTitle, { color: colors.text }]}>{proceso}</Text>
                                <Text style={{ color: colors.subText, fontSize: 13 }}>
                                    {dayDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDayDetail(false)}>
                                <Text style={{ color: colors.subText, fontSize: 22, fontWeight: '700' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: colors.subText, marginBottom: 12 }}>
                            {items.length} OP{items.length !== 1 ? 's' : ''} programada{items.length !== 1 ? 's' : ''} en este día
                        </Text>

                        <ScrollView style={{ maxHeight: 360 }}>
                            {items.map(({ prog, proceso: p }) => {
                                const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
                                return (
                                    <TouchableOpacity
                                        key={`${prog.id}-${p.id}`}
                                        style={[styles.dayDetailCard, { borderLeftColor: prog.color || '#3B82F6' }]}
                                        onPress={() => {
                                            setSelectedId(prog.id);
                                            setShowDayDetail(false);
                                        }}
                                    >
                                        <View style={styles.dayDetailCardHeader}>
                                            <View style={[styles.colorDot, { backgroundColor: prog.color || '#3B82F6' }]} />
                                            <Text style={[styles.dayDetailOp, { color: colors.text }]}>{prog.numeroOP}</Text>
                                            <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                                                <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 6 }}>
                                            Cliente: {prog.cliente || '—'} · {prog.metaTiros?.toLocaleString()} tiros
                                        </Text>
                                        <Text style={{ color: colors.subText, fontSize: 11, marginTop: 4 }}>
                                            {formatDateTime(p.fechaInicio)} → {formatDateTime(p.fechaFin)}
                                        </Text>
                                        {p.horasEstimadas > 0 && (
                                            <Text style={{ color: '#60A5FA', fontSize: 11, marginTop: 4 }}>
                                                Horas trabajo: {p.horasEstimadas}h
                                            </Text>
                                        )}
                                        {(p.tiemposAuxiliares || []).length > 0 && (
                                            <Text style={{ color: '#A78BFA', fontSize: 10, marginTop: 4 }}>
                                                +{(p.tiemposAuxiliares || []).length} tiempo(s) auxiliar(es)
                                            </Text>
                                        )}
                                        {p.cantidadProducida > 0 && (
                                            <Text style={{ color: '#22C55E', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                                                Producido: {p.cantidadProducida}
                                            </Text>
                                        )}
                                        <View style={styles.dayDetailActions}>
                                            <TouchableOpacity
                                                style={styles.dayDetailBtn}
                                                onPress={() => { setSelectedId(prog.id); setShowDayDetail(false); }}
                                            >
                                                <Text style={styles.dayDetailBtnText}>Ver seguimiento</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.dayDetailBtn, { backgroundColor: '#334155' }]}
                                                onPress={() => { setShowDayDetail(false); openEditModal(prog); }}
                                            >
                                                <Text style={styles.dayDetailBtnText}>Editar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderProgressPanel = () => {
        if (!selectedProgramacion) {
            return (
                <View style={[styles.progressPanel, { backgroundColor: isDarkMode ? '#111827' : '#F1F5F9', borderColor: colors.border }]}>
                    <Text style={{ color: colors.subText, textAlign: 'center' }}>
                        Seleccione una OP en el diagrama o cree una nueva programación
                    </Text>
                </View>
            );
        }

        const prog = selectedProgramacion;
        return (
            <View style={[styles.progressPanel, { backgroundColor: isDarkMode ? '#111827' : '#F1F5F9', borderColor: colors.border }]}>
                <View style={styles.progressHeader}>
                    <View style={[styles.colorDot, { backgroundColor: prog.color || '#3B82F6', width: 12, height: 12 }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.progressTitle, { color: colors.text }]}>
                            Seguimiento OP: {prog.numeroOP}
                        </Text>
                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                            Cliente: {prog.cliente || '—'} · Meta: {prog.metaTiros?.toLocaleString()} tiros
                        </Text>
                    </View>
                    <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>{prog.progresoGeneral || 0}%</Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(prog)}>
                        <Text style={styles.editBtnText}>Editar</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${prog.progresoGeneral || 0}%` }]} />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    {prog.procesos.map((p) => {
                        const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
                        return (
                            <View key={p.id} style={[styles.processStatusCard, { borderColor: cfg.color, backgroundColor: cfg.bg }]}>
                                <Text style={[styles.processStatusName, { color: colors.text }]}>{p.proceso}</Text>
                                <Text style={[styles.processStatusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                <Text style={{ color: colors.subText, fontSize: 10, marginTop: 4 }}>
                                    {formatDateTime(p.fechaInicio)} – {formatDateTime(p.fechaFin)}
                                </Text>
                                {p.horasEstimadas > 0 && (
                                    <Text style={{ color: '#60A5FA', fontSize: 10, marginTop: 2 }}>
                                        {p.horasEstimadas}h estimadas
                                    </Text>
                                )}
                                {p.cantidadProducida > 0 && (
                                    <Text style={{ color: '#22C55E', fontSize: 10, marginTop: 2, fontWeight: '700' }}>
                                        Prod: {p.cantidadProducida}
                                    </Text>
                                )}
                                <View style={styles.miniProgressTrack}>
                                    <View style={[styles.miniProgressFill, { width: `${p.porcentajeTiempo || 0}%`, backgroundColor: cfg.color }]} />
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        );
    };

    const renderModal = () => (
        <Modal visible={showModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <ScrollView contentContainerStyle={styles.modalScrollContent}>
                    <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFFFFF' }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {editingId ? 'Editar Programación' : 'Nueva Programación de OP'}
                        </Text>

                        <Text style={styles.fieldLabel}>Número de OP *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: OP-2024-001"
                            placeholderTextColor="#718096"
                            value={form.numeroOP || ''}
                            onChangeText={(v) => setForm((f) => ({ ...f, numeroOP: v }))}
                        />

                        <Text style={styles.fieldLabel}>Cliente</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre del cliente"
                            placeholderTextColor="#718096"
                            value={form.cliente || ''}
                            onChangeText={(v) => setForm((f) => ({ ...f, cliente: v }))}
                        />

                        <Text style={styles.fieldLabel}>Meta de Tiros *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 50000"
                            placeholderTextColor="#718096"
                            keyboardType="numeric"
                            value={form.metaTiros || ''}
                            onChangeText={(v) => setForm((f) => ({ ...f, metaTiros: v }))}
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Procesos, fechas y horas</Text>
                        <Text style={{ color: '#718096', fontSize: 12, marginBottom: 10 }}>
                            Marque los procesos, indique inicio/fin con hora, horas de trabajo y tiempos auxiliares.
                        </Text>

                        {PROCESOS.map((proceso) => {
                            const proc = form.procesosSeleccionados[proceso];
                            return (
                                <View key={proceso} style={[styles.procesoBlock, proc.activo && styles.procesoBlockActive]}>
                                    <View style={styles.procesoFormRow}>
                                        <TouchableOpacity
                                            style={[styles.checkBox, proc.activo && styles.checkBoxActive]}
                                            onPress={() => updateProcesoField(proceso, 'activo', !proc.activo)}
                                        >
                                            <Text style={{ color: proc.activo ? '#FFF' : '#718096', fontSize: 12 }}>
                                                {proc.activo ? '✓' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                        <Text style={[styles.procesoFormName, { color: colors.text, opacity: proc.activo ? 1 : 0.5 }]}>
                                            {proceso}
                                        </Text>
                                    </View>

                                    {proc.activo && (
                                        <View style={styles.procesoFields}>
                                            <View style={styles.timeRow}>
                                                <View style={styles.timeGroup}>
                                                    <Text style={styles.timeLabel}>Inicio</Text>
                                                    <TextInput
                                                        style={styles.dateInput}
                                                        value={proc.fechaInicio || ''}
                                                        onChangeText={(v) => updateProcesoField(proceso, 'fechaInicio', v)}
                                                        placeholder="YYYY-MM-DD"
                                                        placeholderTextColor="#718096"
                                                    />
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                                                        <View style={styles.hourPickerRow}>
                                                            {HOUR_OPTIONS.map((h) => (
                                                                <TouchableOpacity
                                                                    key={`si-${h.value}`}
                                                                    style={[styles.hourChip, proc.horaInicio === h.value && styles.hourChipActive]}
                                                                    onPress={() => updateProcesoField(proceso, 'horaInicio', h.value)}
                                                                >
                                                                    <Text style={[styles.hourChipText, proc.horaInicio === h.value && { color: '#FFF' }]}>
                                                                        {h.label}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </ScrollView>
                                                </View>

                                                <Text style={{ color: '#718096', marginTop: 20 }}>→</Text>

                                                <View style={styles.timeGroup}>
                                                    <Text style={styles.timeLabel}>Fin</Text>
                                                    <TextInput
                                                        style={styles.dateInput}
                                                        value={proc.fechaFin || ''}
                                                        onChangeText={(v) => updateProcesoField(proceso, 'fechaFin', v)}
                                                        placeholder="YYYY-MM-DD"
                                                        placeholderTextColor="#718096"
                                                    />
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                                                        <View style={styles.hourPickerRow}>
                                                            {HOUR_OPTIONS.map((h) => (
                                                                <TouchableOpacity
                                                                    key={`sf-${h.value}`}
                                                                    style={[styles.hourChip, proc.horaFin === h.value && styles.hourChipActive]}
                                                                    onPress={() => updateProcesoField(proceso, 'horaFin', h.value)}
                                                                >
                                                                    <Text style={[styles.hourChipText, proc.horaFin === h.value && { color: '#FFF' }]}>
                                                                        {h.label}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </ScrollView>
                                                </View>
                                            </View>

                                            <View style={styles.horasEstimadasRow}>
                                                <Text style={styles.timeLabel}>Horas de trabajo *</Text>
                                                <TextInput
                                                    style={[styles.dateInput, { width: 100 }]}
                                                    value={proc.horasEstimadas || ''}
                                                    onChangeText={(v) => updateProcesoField(proceso, 'horasEstimadas', v)}
                                                    placeholder="Ej: 8"
                                                    placeholderTextColor="#718096"
                                                    keyboardType="decimal-pad"
                                                />
                                            </View>

                                            <View style={styles.auxSection}>
                                                <View style={styles.auxHeader}>
                                                    <Text style={styles.timeLabel}>Tiempos auxiliares</Text>
                                                    <TouchableOpacity style={styles.addAuxBtn} onPress={() => addTiempoAuxiliar(proceso)}>
                                                        <Text style={styles.addAuxBtnText}>+ Añadir</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {(proc.tiemposAuxiliares || []).length === 0 ? (
                                                    <Text style={{ color: '#718096', fontSize: 11, fontStyle: 'italic' }}>
                                                        Ej: montaje, limpieza, puesta a punto...
                                                    </Text>
                                                ) : (
                                                    proc.tiemposAuxiliares.map((aux) => (
                                                        <View key={aux.id} style={styles.auxRow}>
                                                            <TextInput
                                                                style={[styles.dateInput, { flex: 2 }]}
                                                                value={aux.descripcion || ''}
                                                                onChangeText={(v) => updateTiempoAuxiliar(proceso, aux.id, 'descripcion', v)}
                                                                placeholder="Descripción"
                                                                placeholderTextColor="#718096"
                                                            />
                                                            <TextInput
                                                                style={[styles.dateInput, { width: 70 }]}
                                                                value={aux.horas || ''}
                                                                onChangeText={(v) => updateTiempoAuxiliar(proceso, aux.id, 'horas', v)}
                                                                placeholder="Hrs"
                                                                placeholderTextColor="#718096"
                                                                keyboardType="decimal-pad"
                                                            />
                                                            <TouchableOpacity onPress={() => removeTiempoAuxiliar(proceso, aux.id)}>
                                                                <Text style={{ color: '#EF4444', fontSize: 18, padding: 4 }}>✕</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))
                                                )}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4F46E5' }]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>Guardar</Text>}
                            </TouchableOpacity>
                            {editingId && (
                                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#DC2626' }]} onPress={() => handleDelete(editingId)}>
                                    <Text style={styles.modalBtnText}>Eliminar</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4A5568' }]}
                                onPress={() => setShowModal(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );

    if (loading && programaciones.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const rangeLabel = `${rangeDates[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${rangeDates[rangeDates.length - 1].toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.ganttTitle, { color: colors.text }]}>Diagrama de Gantt</Text>
                    <Text style={{ color: colors.subText, fontSize: 12 }}>
                        {WEEKS_TO_SHOW} semanas · {rangeLabel}
                    </Text>
                </View>
                <View style={styles.topBarActions}>
                    <TouchableOpacity style={styles.navBtn} onPress={() => shiftRange(-1)}>
                        <Text style={styles.navBtnText}>◀ 4 sem</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navBtn} onPress={() => setPivotDate(new Date())}>
                        <Text style={styles.navBtnText}>Hoy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navBtn} onPress={() => shiftRange(1)}>
                        <Text style={styles.navBtnText}>4 sem ▶</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
                        <Text style={styles.createBtnText}>+ Programar OP</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.weekLegend}>
                {WEEK_PALETTE.map((w, i) => (
                    <View key={i} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: w.header }]} />
                        <Text style={{ color: colors.subText, fontSize: 11 }}>{w.label}</Text>
                    </View>
                ))}
            </View>

            {backendUnavailable && (
                <View style={styles.backendBanner}>
                    <Text style={styles.backendBannerText}>
                        El backend en el puerto 5144 no tiene la API de programación OP. Detenga el proceso dotnet actual y reinicie con: dotnet run (carpeta backend).
                    </Text>
                </View>
            )}

            <View style={styles.ganttWrapper}>
                {renderGantt()}
            </View>

            {renderProgressPanel()}
            {renderModal()}
            {renderDayDetailModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    ganttTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navBtn: {
        backgroundColor: '#1E40AF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    navBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    createBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        marginLeft: 8,
        elevation: 3,
    },
    createBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    weekLegend: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 16,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    backendBanner: {
        marginHorizontal: 20,
        marginBottom: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#7F1D1D',
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    backendBannerText: { color: '#FEE2E2', fontSize: 12, fontWeight: '600' },
    ganttWrapper: { flex: 1 },
    ganttScroll: { flex: 1 },
    ganttHeaderRow: { flexDirection: 'row' },
    processHeaderCell: {
        width: PROCESS_COL_WIDTH,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderColor: '#334155',
    },
    processHeaderText: { color: '#FFF', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
    monthRow: { flexDirection: 'row', height: 26 },
    monthCell: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#334155' },
    monthText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
    weekRow: { flexDirection: 'row', height: 34 },
    weekCell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 2,
        borderRightColor: '#FFFFFF33',
    },
    weekText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
    weekSubText: { color: '#FFFFFFCC', fontSize: 9, marginTop: 1 },
    dayRow: { flexDirection: 'row', height: 38 },
    dayCell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
    },
    dayNameText: { color: '#FFFFFFAA', fontSize: 9, fontWeight: '600' },
    dayText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    ganttBody: { maxHeight: 480 },
    processRow: { flexDirection: 'row' },
    processLabelCell: {
        width: PROCESS_COL_WIDTH,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRightWidth: 1,
        borderBottomWidth: 1,
    },
    processLabel: { fontSize: 12, fontWeight: '600' },
    processTrack: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#334155' },
    daySlot: {
        borderRightWidth: 1,
        position: 'relative',
        paddingHorizontal: 2,
    },
    opChip: {
        position: 'absolute',
        left: 3,
        right: 3,
        height: CHIP_HEIGHT,
        borderRadius: 4,
        borderWidth: 1,
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    opChipText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
    chipPulse: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#FACC15',
    },
    moreChip: {
        position: 'absolute',
        left: 3,
        right: 3,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreChipText: { color: '#94A3B8', fontSize: 8, fontWeight: '700' },
    colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    dayDetailContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 520,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    dayDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    dayDetailTitle: { fontSize: 18, fontWeight: '800' },
    dayDetailCard: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderLeftWidth: 4,
    },
    dayDetailCardHeader: { flexDirection: 'row', alignItems: 'center' },
    dayDetailOp: { fontSize: 15, fontWeight: '800', flex: 1 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusPillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
    dayDetailActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    dayDetailBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    dayDetailBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    progressPanel: {
        borderTopWidth: 1,
        padding: 16,
        maxHeight: 200,
    },
    progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    progressTitle: { fontSize: 15, fontWeight: '800' },
    progressBadge: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    progressBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    editBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    editBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    progressBarTrack: {
        height: 8,
        backgroundColor: '#334155',
        borderRadius: 4,
        marginTop: 10,
        overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
    processStatusCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginRight: 10,
        minWidth: 130,
    },
    processStatusName: { fontSize: 12, fontWeight: '700' },
    processStatusLabel: { fontSize: 10, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
    miniProgressTrack: {
        height: 4,
        backgroundColor: '#33415544',
        borderRadius: 2,
        marginTop: 6,
        overflow: 'hidden',
    },
    miniProgressFill: { height: '100%', borderRadius: 2 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        padding: 20,
    },
    modalScrollContent: { flexGrow: 1, justifyContent: 'center' },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#CBD5E0', marginBottom: 6, marginTop: 10 },
    input: {
        height: 46,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
        borderRadius: 10,
        paddingHorizontal: 14,
        fontSize: 15,
        color: '#FFF',
    },
    procesoFormRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    procesoBlock: {
        marginBottom: 10,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#11182744',
    },
    procesoBlockActive: {
        borderColor: '#4F46E5',
        backgroundColor: '#4F46E511',
    },
    procesoFields: { marginTop: 8, marginLeft: 30 },
    timeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' },
    timeGroup: { flex: 1, minWidth: 200 },
    timeLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
    hourPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    hourChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
    },
    hourChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    hourChipText: { color: '#CBD5E0', fontSize: 10, fontWeight: '600' },
    horasEstimadasRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    auxSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
    auxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    addAuxBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    addAuxBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    auxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    checkBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#4A5568',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2D3748',
    },
    checkBoxActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    procesoFormName: { width: 100, fontSize: 13, fontWeight: '600' },
    dateInputs: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    dateInput: {
        flex: 1,
        height: 36,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
        borderRadius: 8,
        paddingHorizontal: 8,
        fontSize: 12,
        color: '#FFF',
        minWidth: 110,
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, gap: 10, flexWrap: 'wrap' },
    modalBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        minWidth: 100,
        alignItems: 'center',
    },
    modalBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
