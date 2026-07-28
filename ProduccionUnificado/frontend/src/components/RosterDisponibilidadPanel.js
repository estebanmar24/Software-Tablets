import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, TextInput, Modal, useWindowDimensions, Platform, Animated,
} from 'react-native';
import * as planeacionApi from '../services/planeacionApi';
import * as api from '../services/api';
import { produccionApi } from '../services/produccionApi';
import { showAppAlert, extractApiErrorMessage } from '../utils/appAlert';
import {
    buildHorariosRows,
    resolveHorarioPersonalizadoId,
    weekDaysFromMonday,
    getMondayWeekStart,
    buildProgramacionTurnosSheetAoa,
    ROSTER_DIAS_SEMANA,
    ROSTER_DAY_LABELS,
} from '../utils/rosterHorariosUtils';
import RosterHorariosGrid from './RosterHorariosGrid';
import {
    esProcesoVirtualRoster,
    virtualMaquinaToFisicasMap,
    maquinaIdsParaAsignacionCobertura,
    GANTT_PROCESOS_CATALOGO,
} from '../utils/rosterProcesoUtils';

const DAY_LABELS = ROSTER_DAY_LABELS;
const NOVEDAD_TIPOS = [
    { value: 'incapacidad', label: 'Incap.' },
    { value: 'falta', label: 'Falta' },
    { value: 'permiso', label: 'Permiso' },
    { value: 'baja', label: 'Baja' },
];
const NOVEDAD_LABEL = {
    incapacidad: 'Incapacidad',
    falta: 'Falta',
    permiso: 'Permiso',
    baja: 'Baja',
};
const ESTADOS_OP = ['Operativa', 'Dañada', 'Mantenimiento'];
const ROSTER_TABS = [
    { id: 'horarios', label: 'Horarios' },
    { id: 'cobertura', label: 'Cobertura' },
    { id: 'config', label: 'Turnos' },
    { id: 'novedades', label: 'Novedades' },
];
const COBERTURA_FILTERS = [
    { id: 'todas', label: 'Todas' },
    { id: 'sin_config', label: 'Sin config' },
    { id: 'sin_op', label: 'Sin op.' },
    { id: 'cubiertas', label: 'Cubiertas' },
    { id: 'con_aux', label: 'Con aux.' },
    { id: 'incapacidad', label: 'Incapacidad' },
];

const toDateKey = (d) => {
    const x = d instanceof Date ? d : new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Inicio de semana roster: lunes (7 días lun → dom inclusive). */
const getMonday = getMondayWeekStart;

const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const shortName = (nombre) => {
    const parts = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 2) return parts.join(' ');
    return `${parts[0]} ${parts[parts.length - 1]}`;
};

const compareMaquinaNombre = (a, b) => {
    const na = String(a || '').trim();
    const nb = String(b || '').trim();
    const parse = (s) => {
        const m = s.match(/^(\d+)\s*([A-Za-zÁÉÍÓÚÑáéíóúñ])?/);
        if (!m) return { num: Number.MAX_SAFE_INTEGER, letter: '', raw: s };
        return { num: parseInt(m[1], 10), letter: (m[2] || '').toUpperCase(), raw: s };
    };
    const pa = parse(na);
    const pb = parse(nb);
    if (pa.num !== pb.num) return pa.num - pb.num;
    if (pa.letter !== pb.letter) return pa.letter.localeCompare(pb.letter, 'es');
    return na.localeCompare(nb, 'es', { numeric: true, sensitivity: 'base' });
};

const maquinaNombreOf = (m) => m?.nombre ?? m?.Nombre ?? '';
const maquinaIdOf = (m) => m?.id ?? m?.Id;
const estadoColor = (est) => {
    if (est === 'Dañada') return '#EF4444';
    if (est === 'Mantenimiento') return '#F59E0B';
    return '#22C55E';
};

const parseHoraMinutos = (raw) => {
    const s = String(raw || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const horarioMidMinutos = (h) => {
    if (!h) return 8 * 60;
    const ini = parseHoraMinutos(h.inicio || h.inicioSemana) ?? 0;
    const fin = parseHoraMinutos(h.fin || h.finSemana) ?? ini + 480;
    return Math.floor((ini + fin) / 2);
};

/** ¿La novedad aplica a este día + turno? (respeta medio día mañana/tarde). */
const novedadAfectaTurno = (nov, fechaDia, horario) => {
    if (!nov || !fechaDia) return false;
    const fi = nov.fechaInicio || nov.FechaInicio;
    const ff = nov.fechaFin || nov.FechaFin;
    if (!fi || !ff) return false;
    if (fechaDia < fi || fechaDia > ff) return false;
    if (!nov.medioDia && !nov.MedioDia) return true;
    const jornada = String(nov.jornada || nov.Jornada || '').toLowerCase();
    const mid = horarioMidMinutos(horario);
    if (jornada === 'manana') return mid < 12 * 60;
    if (jornada === 'tarde') return mid >= 12 * 60;
    return true;
};

const describeNovedad = (nov) => {
    if (!nov) return '';
    const tipo = NOVEDAD_LABEL[nov.tipo || nov.Tipo] || (nov.tipo || nov.Tipo || 'novedad');
    if (!(nov.medioDia || nov.MedioDia)) return tipo;
    const j = String(nov.jornada || nov.Jornada || '').toLowerCase() === 'tarde' ? 'tarde' : 'mañana';
    return `${tipo} · medio día ${j}`;
};

const horarioRangoDia = (h, fechaDia) => {
    if (!h || !fechaDia) return { inicio: '', fin: '' };
    const d = new Date(`${fechaDia}T12:00:00`);
    const sab = d.getDay() === 6;
    const inicio = sab
        ? (h.inicioSabado || h.InicioSabado || h.inicio || h.inicioSemana || h.InicioSemana || '')
        : (h.inicioSemana || h.InicioSemana || h.inicio || h.Inicio || '');
    const fin = sab
        ? (h.finSabado || h.FinSabado || h.fin || h.finSemana || h.FinSemana || '')
        : (h.finSemana || h.FinSemana || h.fin || h.Fin || '');
    return { inicio: String(inicio || ''), fin: String(fin || '') };
};

const horasTurnoDia = (h, fechaDia) => {
    const { inicio, fin } = horarioRangoDia(h, fechaDia);
    const ini = parseHoraMinutos(inicio);
    const end = parseHoraMinutos(fin);
    if (ini == null || end == null) return '';
    let mins = end - ini;
    if (mins <= 0) mins += 24 * 60;
    return Math.round((mins / 60) * 100) / 100;
};

const diaLabelFromDate = (fechaDia) => {
    const d = new Date(`${fechaDia}T12:00:00`);
    return `${DOW_SHORT[d.getDay()]} ${d.getDate()}`;
};

const horaTurnoLabel = (h, fechaDia) => {
    const nom = String(h?.nombre || h?.Nombre || '').trim();
    if (nom) return nom;
    const { inicio, fin } = horarioRangoDia(h, fechaDia);
    if (inicio && fin) return `${inicio} - ${fin}`;
    return inicio || fin || '';
};

/** Fusiona celdas de Proceso en hoja programación turnos. */
const applyProcesoMergesHorarios = (ws, aoa, startRow = 4, colIndex = 0) => {
    const merges = ws['!merges'] ? [...ws['!merges']] : [];
    let start = startRow;
    for (let i = startRow + 1; i <= aoa.length; i += 1) {
        if (i === aoa.length || aoa[i][colIndex] !== aoa[start][colIndex]) {
            const span = i - start;
            if (span > 1 && aoa[start][colIndex]) {
                merges.push({
                    s: { r: start, c: colIndex },
                    e: { r: start + span - 1, c: colIndex },
                });
            }
            start = i;
        }
    }
    if (merges.length) ws['!merges'] = merges;
    return ws;
};

const buildWsProgramacionTurnos = (XLSX, {
    horariosRows,
    diasKeys,
    diasFestivos,
    semanaKey,
    semanaFinKey,
}) => {
    const { aoa, highlightRows, totalCols } = buildProgramacionTurnosSheetAoa({
        rows: horariosRows,
        diasKeys,
        diasFestivos,
        semanaKey,
        semanaFinKey,
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, totalCols - 1) } }];
    ws['!merges'] = merges;
    applyProcesoMergesHorarios(ws, aoa);

    const centerWrap = { alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
    if (ws.A1) ws.A1.s = { font: { bold: true, sz: 14 }, ...centerWrap };
    if (ws.A2) ws.A2.s = { font: { bold: true } };
    for (let c = 0; c < totalCols; c += 1) {
        const ref = XLSX.utils.encode_cell({ r: 3, c });
        if (ws[ref]) {
            ws[ref].s = {
                font: { bold: true },
                ...centerWrap,
                fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
            };
        }
    }
    for (const r of highlightRows) {
        for (let c = 0; c < totalCols; c += 1) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { t: 's', v: '' };
            ws[ref].s = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } } };
        }
    }
    const dayW = Array.from({ length: diasKeys.length }, () => ({ wch: 14 }));
    ws['!cols'] = [{ wch: 20 }, { wch: 28 }, ...dayW, { wch: 6 }, { wch: 6 }];
    return ws;
};

/** Fusiona celdas de la columna Máquina cuando el valor se repite en filas consecutivas. */
const applyMaquinaMerges = (ws, rows, colIndex = 2) => {
    if (!rows.length) return ws;
    const merges = [];
    let start = 0;
    for (let i = 1; i <= rows.length; i += 1) {
        if (i === rows.length || rows[i].Maquina !== rows[start].Maquina) {
            const span = i - start;
            if (span > 1) {
                merges.push({
                    s: { r: start + 1, c: colIndex },
                    e: { r: start + span, c: colIndex },
                });
            }
            start = i;
        }
    }
    if (merges.length) ws['!merges'] = merges;
    return ws;
};

/** Resalta filas completas (p. ej. novedades) con fondo amarillo en Excel. */
const applyRowHighlights = (XLSX, ws, rowCount, colCount, shouldHighlight) => {
    if (!rowCount || !colCount || !shouldHighlight) return ws;
    for (let r = 1; r < rowCount; r += 1) {
        if (!shouldHighlight(r)) continue;
        for (let c = 0; c < colCount; c += 1) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { t: 's', v: '' };
            ws[ref].s = {
                fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
            };
        }
    }
    return ws;
};

/** Evita duplicados (fecha|máquina|turno|persona) antes de guardar roster. */
const dedupeAsignaciones = (rows) => {
    const seen = new Set();
    const out = [];
    for (const a of rows || []) {
        const key = `${a.fechaDia}|${a.maquinaId}|${a.horarioId}|${a.usuarioId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(a);
    }
    return out;
};

const sameAsignacion = (a, b) =>
    String(a.fechaDia) === String(b.fechaDia)
    && String(a.maquinaId) === String(b.maquinaId)
    && String(a.horarioId) === String(b.horarioId)
    && String(a.usuarioId) === String(b.usuarioId);

/** Normaliza filas de config turnos (API camel/Pascal) y deja solo las activas. */
const normalizeConfigRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
        .map((r) => ({
            id: r.id ?? r.Id,
            maquinaId: r.maquinaId ?? r.MaquinaId,
            horarioId: Number(r.horarioId ?? r.HorarioId) || 0,
            activo: r.activo !== false && r.Activo !== false,
            requiereOperario: r.requiereOperario !== false && r.RequiereOperario !== false,
            auxiliaresRequeridos: Number(r.auxiliaresRequeridos ?? r.AuxiliaresRequeridos) || 0,
            horarioCodigo: r.horarioCodigo ?? r.HorarioCodigo,
            horarioNombre: r.horarioNombre ?? r.HorarioNombre,
        }))
        .filter((r) => r.horarioId > 0 && r.activo);

export default function RosterDisponibilidadPanel({ maquinas = [], colors, isDarkMode }) {
    const { width: winW, height: winH } = useWindowDimensions();
    const [tab, setTab] = useState('horarios');
    const [semanaInicio, setSemanaInicio] = useState(() => getMonday(new Date()));
    const [horarios, setHorarios] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [turnosDia, setTurnosDia] = useState([]); // excepciones por día
    const [diasFestivos, setDiasFestivos] = useState([]);
    const [novedades, setNovedades] = useState([]);
    const [jornadaDias, setJornadaDias] = useState([]);
    const [procesosGantt, setProcesosGantt] = useState([]);
    const [configsByMaquina, setConfigsByMaquina] = useState({});
    const [addTurnoDiaDraft, setAddTurnoDiaDraft] = useState(null); // { maquinaId, fechaDia }
    const [estadosByMaquina, setEstadosByMaquina] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportToast, setExportToast] = useState(null);
    const exportToastOpacity = useRef(new Animated.Value(0)).current;
    const exportToastTimerRef = useRef(null);
    const [configMaquinaId, setConfigMaquinaId] = useState(null);
    const [configTurnos, setConfigTurnos] = useState([]);
    const [configSaveHint, setConfigSaveHint] = useState('');
    const configSaveSeqRef = useRef(0);
    const configAuxTimerRef = useRef(null);
    const [draftAssign, setDraftAssign] = useState(null);
    const [userFilter, setUserFilter] = useState('');
    const [novFilter, setNovFilter] = useState('');
    const [maqSearch, setMaqSearch] = useState('');
    const [coberturaFilter, setCoberturaFilter] = useState('todas');
    const [coberturaPersonQ, setCoberturaPersonQ] = useState('');
    const [coberturaRolFilter, setCoberturaRolFilter] = useState('todos');
    const [diaFilter, setDiaFilter] = useState('todos');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [horarioEdit, setHorarioEdit] = useState(null); // null | { mode:'create' } | horario
    const [horarioForm, setHorarioForm] = useState({
        codigo: '',
        nombre: '',
        inicio: '06:00',
        fin: '14:00',
    });
    const [novForm, setNovForm] = useState({
        usuarioId: '',
        tipo: 'falta',
        fechaInicio: toDateKey(new Date()),
        fechaFin: toDateKey(new Date()),
        medioDia: false,
        jornada: 'manana',
        observacion: '',
    });

    const textColor = colors?.text || '#E2E8F0';
    const subColor = colors?.subText || '#94A3B8';
    const cardBg = isDarkMode ? '#1E293B' : '#FFFFFF';
    const pageBg = isDarkMode ? '#0B1220' : '#F1F5F9';
    const border = isDarkMode ? '#334155' : '#CBD5E1';

    const maquinasActivas = useMemo(() => {
        const list = (maquinas || []).filter((m) => m.activo !== false && m.Activo !== false);
        return [...list].sort((a, b) => compareMaquinaNombre(maquinaNombreOf(a), maquinaNombreOf(b)));
    }, [maquinas]);

    useEffect(() => {
        const map = {};
        for (const m of maquinasActivas) {
            const id = maquinaIdOf(m);
            map[id] = m.estadoOperativo || m.EstadoOperativo || 'Operativa';
        }
        setEstadosByMaquina((prev) => ({ ...map, ...prev }));
    }, [maquinasActivas]);

    const semanaKey = toDateKey(semanaInicio);
    const dias = useMemo(() => weekDaysFromMonday(semanaInicio), [semanaInicio]);
    const semanaFinKey = useMemo(() => {
        const fin = new Date(semanaInicio);
        fin.setDate(fin.getDate() + (ROSTER_DIAS_SEMANA - 1));
        return toDateKey(fin);
    }, [semanaInicio]);
    const diasVisibles = useMemo(() => {
        if (diaFilter === 'todos') return dias.map((d, i) => ({ d, i }));
        const idx = parseInt(diaFilter, 10);
        if (Number.isNaN(idx) || idx < 0 || idx > 6) return dias.map((d, i) => ({ d, i }));
        return [{ d: dias[idx], i: idx }];
    }, [dias, diaFilter]);

    const MAQ_COL_W = 128;
    const contentPad = 16;
    const dayColW = useMemo(() => {
        const cols = Math.max(1, diasVisibles.length);
        const avail = Math.max(640, winW - contentPad * 2 - 8);
        return Math.max(96, Math.floor((avail - MAQ_COL_W) / cols));
    }, [winW, diasVisibles.length]);

    const gridTotalW = MAQ_COL_W + dayColW * diasVisibles.length;

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [h, u, roster, novs, jornada, procGantt] = await Promise.all([
                planeacionApi.getHorariosDisponibilidad().catch(() => []),
                api.getUsuarios().catch(() => []),
                planeacionApi.getRosterSemana(semanaKey).catch(() => ({ asignaciones: [] })),
                planeacionApi.getPersonalNovedades(semanaKey, semanaFinKey).catch(() => []),
                produccionApi.getParametrosJornadaOt(semanaKey).catch(() => ({ dias: [] })),
                planeacionApi.getProcesosGantt().catch(() => []),
            ]);
            setHorarios(
                (Array.isArray(h) ? h : []).slice().sort((a, b) =>
                    compareMaquinaNombre(String(a.codigo || a.Codigo || ''), String(b.codigo || b.Codigo || ''))
                )
            );
            setUsuarios(Array.isArray(u) ? u : []);
            setAsignaciones(roster?.asignaciones || []);
            setTurnosDia(roster?.turnosDia || []);
            setDiasFestivos(roster?.diasFestivos || []);
            setNovedades(Array.isArray(novs) ? novs : []);
            setJornadaDias(Array.isArray(jornada?.dias) ? jornada.dias : []);
            setProcesosGantt(Array.isArray(procGantt) ? procGantt : []);

            const firstId = maquinaIdOf(maquinasActivas[0]);
            if (!configMaquinaId && firstId) setConfigMaquinaId(firstId);

            const ids = maquinasActivas.map(maquinaIdOf).filter(Boolean);
            const entries = await Promise.all(
                ids.map(async (id) => {
                    try {
                        const rows = await planeacionApi.getTurnosConfigMaquina(id);
                        return [String(id), normalizeConfigRows(rows)];
                    } catch {
                        return [String(id), []];
                    }
                })
            );
            const map = {};
            entries.forEach(([id, rows]) => { map[id] = rows; });
            setConfigsByMaquina(map);
        } catch (e) {
            showAppAlert('Roster', extractApiErrorMessage(e) || 'No se pudo cargar el roster.');
        } finally {
            setLoading(false);
        }
    }, [semanaKey, dias, configMaquinaId, maquinasActivas]);

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [semanaKey]);

    useEffect(() => () => {
        if (exportToastTimerRef.current) clearTimeout(exportToastTimerRef.current);
    }, []);

    const showExportToast = (message) => {
        if (exportToastTimerRef.current) clearTimeout(exportToastTimerRef.current);
        setExportToast(message);
        exportToastOpacity.setValue(0);
        Animated.timing(exportToastOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
        exportToastTimerRef.current = setTimeout(() => {
            Animated.timing(exportToastOpacity, {
                toValue: 0,
                duration: 350,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setExportToast(null);
            });
        }, 3200);
    };

    useEffect(() => {
        if (!configMaquinaId) return;
        let cancelled = false;
        (async () => {
            try {
                const rows = await planeacionApi.getTurnosConfigMaquina(configMaquinaId);
                if (!cancelled) setConfigTurnos(normalizeConfigRows(rows));
            } catch {
                if (!cancelled) setConfigTurnos([]);
            }
        })();
        return () => { cancelled = true; };
    }, [configMaquinaId]);

    const procesoListGantt = useMemo(() => {
        const fromApi = (procesosGantt || [])
            .map((p) => (typeof p === 'string' ? p : (p.nombre ?? p.Nombre ?? '')))
            .filter(Boolean);
        return fromApi.length ? fromApi : GANTT_PROCESOS_CATALOGO;
    }, [procesosGantt]);

    const virtualToFisicas = useMemo(
        () => virtualMaquinaToFisicasMap(maquinasActivas, procesoListGantt),
        [maquinasActivas, procesoListGantt],
    );

    const asignacionesByCell = useMemo(() => {
        const map = {};
        const push = (key, a) => {
            if (!map[key]) map[key] = [];
            const uid = a.usuarioId ?? a.UsuarioId;
            if (!map[key].some(
                (x) => String(x.usuarioId ?? x.UsuarioId) === String(uid)
                    && !!x.esAuxiliar === !!a.esAuxiliar,
            )) {
                map[key].push(a);
            }
        };
        for (const a of asignaciones) {
            const targets = maquinaIdsParaAsignacionCobertura(a.maquinaId, virtualToFisicas);
            for (const mid of targets) {
                push(`${a.fechaDia}|${mid}|${a.horarioId}`, a);
            }
        }
        return map;
    }, [asignaciones, virtualToFisicas]);

    const horariosForMaquina = useCallback((maquinaId) => {
        const cfgs = configsByMaquina[String(maquinaId)] || [];
        if (cfgs.length > 0) {
            const ids = new Set(cfgs.map((c) => c.horarioId));
            return horarios.filter((h) => ids.has(h.id ?? h.Id));
        }
        // Sin config: no inventar turnos (evita T1/T2 fantasma)
        return [];
    }, [configsByMaquina, horarios]);

    /** Turnos efectivos ese día = config máquina ± excepciones del día. */
    const horariosForMaquinaDia = useCallback((maquinaId, fechaDia) => {
        const base = horariosForMaquina(maquinaId);
        const baseIds = new Set(base.map((h) => h.id ?? h.Id));
        const overs = turnosDia.filter(
            (t) => String(t.maquinaId) === String(maquinaId) && t.fechaDia === fechaDia
        );
        const excl = new Set(overs.filter((t) => !t.incluir).map((t) => t.horarioId));
        const addIds = overs.filter((t) => t.incluir).map((t) => t.horarioId);

        const kept = base.filter((h) => !excl.has(h.id ?? h.Id));
        const extras = horarios.filter((h) => {
            const id = h.id ?? h.Id;
            return addIds.includes(id) && !baseIds.has(id);
        });
        return [...kept, ...extras].sort((a, b) =>
            compareMaquinaNombre(String(a.codigo || a.Codigo || ''), String(b.codigo || b.Codigo || ''))
        );
    }, [horariosForMaquina, turnosDia, horarios]);

    const horarioHorasLabel = (h) => {
        if (!h) return '—';
        const ini = h.inicio || h.inicioSemana || '?';
        const fin = h.fin || h.finSemana || '?';
        return `${ini}–${fin}`;
    };

    const turnoTooltip = (h) => {
        if (!h) return '';
        const cod = h.codigo || h.Codigo || '';
        const nom = h.nombre || h.Nombre || '';
        return `T${cod} · ${nom}\n${horarioHorasLabel(h)}`;
    };

    const isTurnoAgregadoDia = (maquinaId, fechaDia, horarioId) =>
        turnosDia.some(
            (t) =>
                String(t.maquinaId) === String(maquinaId)
                && t.fechaDia === fechaDia
                && t.horarioId === horarioId
                && t.incluir
        );

    const quitarTurnoDelDia = async (maquinaId, fechaDia, horarioId) => {
        const base = horariosForMaquina(maquinaId);
        const inBase = base.some((h) => (h.id ?? h.Id) === horarioId);
        setSaving(true);
        try {
            if (inBase) {
                // Excluir ese día aunque esté en config de máquina
                await planeacionApi.upsertTurnoDia({
                    fechaDia, maquinaId, horarioId, incluir: false,
                });
            } else {
                // Era agregado solo ese día → quitar excepción
                await planeacionApi.deleteTurnoDia(fechaDia, maquinaId, horarioId);
            }
            const roster = await planeacionApi.getRosterSemana(semanaKey);
            setTurnosDia(roster?.turnosDia || []);
            setAsignaciones(roster?.asignaciones || []);
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo quitar el turno del día.');
        } finally {
            setSaving(false);
        }
    };

    const agregarTurnoAlDia = async (maquinaId, fechaDia, horarioId) => {
        setSaving(true);
        try {
            // Si había exclusión, borrarla; si no está en base, incluir
            const excl = turnosDia.find(
                (t) =>
                    String(t.maquinaId) === String(maquinaId)
                    && t.fechaDia === fechaDia
                    && t.horarioId === horarioId
                    && !t.incluir
            );
            if (excl) {
                await planeacionApi.deleteTurnoDia(fechaDia, maquinaId, horarioId);
            } else {
                await planeacionApi.upsertTurnoDia({
                    fechaDia, maquinaId, horarioId, incluir: true,
                });
            }
            const roster = await planeacionApi.getRosterSemana(semanaKey);
            setTurnosDia(roster?.turnosDia || []);
            setAddTurnoDiaDraft(null);
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo agregar el turno del día.');
        } finally {
            setSaving(false);
        }
    };

    const maquinaTieneOperarioEnSemana = useCallback((maquinaId) => {
        const turns = horariosForMaquina(maquinaId);
        for (const d of dias) {
            const fecha = toDateKey(d);
            for (const h of turns) {
                const cell = asignacionesByCell[`${fecha}|${maquinaId}|${h.id ?? h.Id}`] || [];
                if (cell.some((a) => !a.esAuxiliar)) return true;
            }
        }
        return false;
    }, [horariosForMaquina, dias, asignacionesByCell]);

    const maquinaTieneAuxEnSemana = useCallback((maquinaId) => {
        const turns = horariosForMaquina(maquinaId);
        for (const d of dias) {
            const fecha = toDateKey(d);
            for (const h of turns) {
                const cell = asignacionesByCell[`${fecha}|${maquinaId}|${h.id ?? h.Id}`] || [];
                if (cell.some((a) => a.esAuxiliar)) return true;
            }
        }
        return false;
    }, [horariosForMaquina, dias, asignacionesByCell]);

    const maquinaTieneIncapacidadSemana = useCallback((maquinaId) => {
        const turns = horariosForMaquina(maquinaId);
        for (const d of dias) {
            const fecha = toDateKey(d);
            for (const h of turns) {
                const cell = asignacionesByCell[`${fecha}|${maquinaId}|${h.id ?? h.Id}`] || [];
                for (const a of cell) {
                    const uid = a.usuarioId ?? a.UsuarioId;
                    const nov = (novedades || []).find(
                        (n) => String(n.usuarioId ?? n.UsuarioId) === String(uid)
                            && fecha >= (n.fechaInicio || n.FechaInicio)
                            && fecha <= (n.fechaFin || n.FechaFin)
                            && String(n.tipo || n.Tipo || '').toLowerCase() === 'incapacidad',
                    );
                    if (nov) return true;
                }
            }
        }
        return false;
    }, [horariosForMaquina, dias, asignacionesByCell, novedades]);

    const maquinaCoincidePersona = useCallback((maquinaId, q, rol) => {
        if (!q && rol === 'todos') return true;
        const ql = q.trim().toLowerCase();
        const turns = horariosForMaquina(maquinaId);
        for (const d of dias) {
            const fecha = toDateKey(d);
            for (const h of turns) {
                const cell = asignacionesByCell[`${fecha}|${maquinaId}|${h.id ?? h.Id}`] || [];
                for (const a of cell) {
                    const nombre = String(a.usuarioNombre || '').toLowerCase();
                    if (ql && !nombre.includes(ql)) continue;
                    if (rol === 'operarios' && a.esAuxiliar) continue;
                    if (rol === 'auxiliares' && !a.esAuxiliar) continue;
                    return true;
                }
            }
        }
        return !ql && rol === 'todos';
    }, [horariosForMaquina, dias, asignacionesByCell]);

    const maquinasFiltradas = useMemo(() => {
        const q = maqSearch.trim().toLowerCase();
        const pq = coberturaPersonQ.trim().toLowerCase();
        return maquinasActivas.filter((m) => {
            const mid = maquinaIdOf(m);
            const nombre = maquinaNombreOf(m);
            if (esProcesoVirtualRoster(nombre, procesoListGantt)) return false;
            if (q && !nombre.toLowerCase().includes(q)) return false;
            const sinConfig = !(configsByMaquina[String(mid)]?.length);
            const tieneOp = maquinaTieneOperarioEnSemana(mid);
            const tieneAux = maquinaTieneAuxEnSemana(mid);
            if (coberturaFilter === 'sin_config' && !sinConfig) return false;
            if (coberturaFilter === 'sin_op' && tieneOp) return false;
            if (coberturaFilter === 'cubiertas' && !tieneOp) return false;
            if (coberturaFilter === 'con_aux' && !tieneAux) return false;
            if (coberturaFilter === 'incapacidad' && !maquinaTieneIncapacidadSemana(mid)) return false;
            if (pq || coberturaRolFilter !== 'todos') {
                if (!maquinaCoincidePersona(mid, pq, coberturaRolFilter)) return false;
            }
            return true;
        });
    }, [
        maquinasActivas,
        maqSearch,
        coberturaFilter,
        coberturaPersonQ,
        coberturaRolFilter,
        configsByMaquina,
        maquinaTieneOperarioEnSemana,
        maquinaTieneAuxEnSemana,
        maquinaTieneIncapacidadSemana,
        maquinaCoincidePersona,
        procesoListGantt,
    ]);

    useEffect(() => {
        if (!maquinasFiltradas.length) return;
        const ok = maquinasFiltradas.some((m) => maquinaIdOf(m) === configMaquinaId);
        if (!ok) setConfigMaquinaId(maquinaIdOf(maquinasFiltradas[0]));
    }, [maquinasFiltradas, configMaquinaId]);

    const usuariosActivos = useMemo(
        () => usuarios.filter((u) => u.activo !== false && u.Activo !== false),
        [usuarios]
    );

    const usuariosFiltrados = useMemo(() => {
        const q = userFilter.trim().toLowerCase();
        if (!q) return usuariosActivos;
        return usuariosActivos.filter((u) => (u.nombre || u.Nombre || '').toLowerCase().includes(q));
    }, [usuariosActivos, userFilter]);

    const usuariosNovFiltrados = useMemo(() => {
        const q = novFilter.trim().toLowerCase();
        const list = !q
            ? usuariosActivos
            : usuariosActivos.filter((u) => (u.nombre || u.Nombre || '').toLowerCase().includes(q));
        return list.slice(0, 40);
    }, [usuariosActivos, novFilter]);

    const reloadConfigsByMaquina = useCallback(async () => {
        const ids = maquinasActivas.map(maquinaIdOf).filter(Boolean);
        const entries = await Promise.all(
            ids.map(async (id) => {
                try {
                    const rows = await planeacionApi.getTurnosConfigMaquina(id);
                    return [String(id), normalizeConfigRows(rows)];
                } catch {
                    return [String(id), []];
                }
            }),
        );
        const map = {};
        entries.forEach(([id, rows]) => { map[id] = rows; });
        setConfigsByMaquina(map);
        if (configMaquinaId) {
            const rows = map[String(configMaquinaId)] || [];
            setConfigTurnos(rows);
        }
        return map;
    }, [maquinasActivas, configMaquinaId]);

    const persistAsignaciones = async (next) => {
        const payload = dedupeAsignaciones(next);
        setSaving(true);
        try {
            const res = await planeacionApi.putRosterSemana(
                semanaKey,
                payload.map((a) => ({
                    fechaDia: a.fechaDia,
                    maquinaId: Number(a.maquinaId),
                    horarioId: Number(a.horarioId),
                    usuarioId: Number(a.usuarioId),
                    esAuxiliar: !!a.esAuxiliar,
                    horaInicio: a.horaInicio ?? null,
                    horaFin: a.horaFin ?? null,
                    esDescanso: !!(a.esDescanso || a.EsDescanso),
                    descuentaComida: !!(a.descuentaComida || a.DescuentaComida),
                    minutosComida: Math.max(0, Number(a.minutosComida ?? a.MinutosComida) || 0),
                }))
            );
            setAsignaciones(res?.asignaciones || []);
            await reloadConfigsByMaquina();
            return true;
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo guardar el roster.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const findNovedadUsuario = (usuarioId, fechaDia, horario) =>
        (novedades || []).find(
            (n) => String(n.usuarioId ?? n.UsuarioId) === String(usuarioId) && novedadAfectaTurno(n, fechaDia, horario)
        );

    const festivoInfo = (fechaDia) => (diasFestivos || []).find((f) => f.fechaDia === fechaDia);
    const isDiaFestivo = (fechaDia) => !!festivoInfo(fechaDia);

    const toggleDiaFestivo = async (fechaDia) => {
        const actual = isDiaFestivo(fechaDia);
        const ok = typeof window !== 'undefined'
            ? window.confirm(actual
                ? `¿Quitar festivo del ${fechaDia}?`
                : `¿Marcar ${fechaDia} como festivo?`)
            : true;
        if (!ok) return;
        setSaving(true);
        try {
            await planeacionApi.putDiaFestivo({ fechaDia, festivo: !actual });
            const roster = await planeacionApi.getRosterSemana(semanaKey);
            setDiasFestivos(roster?.diasFestivos || []);
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo actualizar el festivo.');
        } finally {
            setSaving(false);
        }
    };

    const quitarTurnoDeMaquina = (horarioId, h) => {
        if (!configMaquinaId) return;
        const label = `T${h.codigo || h.Codigo} · ${h.nombre || h.Nombre}`;
        const ok = typeof window !== 'undefined'
            ? window.confirm(`¿Quitar ${label} de ${maquinaNombre(configMaquinaId)}?`)
            : true;
        if (!ok) return;
        toggleHorarioConfig(horarioId);
    };

    const renderPersonChip = (a, h, fecha, { aux = false } = {}) => {
        const nov = findNovedadUsuario(a.usuarioId, fecha, h);
        const prefix = aux ? 'Ax ' : '';
        const novLabel = nov
            ? ` · ${NOVEDAD_TIPOS.find((t) => t.value === nov.tipo)?.label || nov.tipo}`
            : '';
        return (
            <View
                key={`${aux ? 'ax' : 'op'}-${a.usuarioId}`}
                style={[aux ? styles.chipAux : styles.chipOp, nov && styles.chipNov, styles.chipRowInner]}
            >
                <TouchableOpacity
                    style={styles.chipMain}
                    onPress={() => {
                        if (nov) {
                            showAppAlert('Novedad registrada', `${a.usuarioNombre || a.usuarioId}\n${describeNovedad(nov)}`);
                        }
                    }}
                    title={nov ? describeNovedad(nov) : undefined}
                >
                    <Text style={styles.chipTxt} numberOfLines={1}>
                        {nov ? '⚠ ' : ''}{prefix}{shortName(a.usuarioNombre) || a.usuarioId}{novLabel}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.chipDel}
                    onPress={() => removeAsignacion(a)}
                    disabled={saving}
                    title="Quitar asignación"
                >
                    <Text style={styles.chipDelTxt}>✕</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const addAsignacion = async (usuarioId) => {
        if (!draftAssign || !usuarioId) return;
        const horario = horarios.find((h) => (h.id ?? h.Id) === draftAssign.horarioId);
        const nov = findNovedadUsuario(usuarioId, draftAssign.fechaDia, horario);
        if (nov) {
            const label = describeNovedad(nov);
            const bloqueante = ['incapacidad', 'falta', 'baja'].includes(String(nov.tipo || '').toLowerCase());
            if (bloqueante) {
                showAppAlert(
                    'Novedad',
                    `No se puede asignar: tiene ${label} el ${draftAssign.fechaDia}.`
                );
                return;
            }
            const ok = typeof window !== 'undefined'
                ? window.confirm(`Esta persona tiene ${label} el ${draftAssign.fechaDia}. ¿Asignar de todos modos?`)
                : true;
            if (!ok) return;
        }
        const exists = asignaciones.some(
            (a) =>
                a.fechaDia === draftAssign.fechaDia
                && a.maquinaId === draftAssign.maquinaId
                && a.horarioId === draftAssign.horarioId
                && a.usuarioId === usuarioId
        );
        if (exists) {
            setDraftAssign(null);
            setUserFilter('');
            return;
        }
        let next = [...asignaciones];
        if (!draftAssign.esAuxiliar) {
            next = next.filter(
                (a) => !(
                    a.fechaDia === draftAssign.fechaDia
                    && a.maquinaId === draftAssign.maquinaId
                    && a.horarioId === draftAssign.horarioId
                    && !a.esAuxiliar
                )
            );
        }
        next.push({ ...draftAssign, usuarioId });
        setDraftAssign(null);
        setUserFilter('');
        await persistAsignaciones(dedupeAsignaciones(next));
    };

    const removeAsignacion = async (asig) => {
        const next = asignaciones.filter((a) => {
            if (sameAsignacion(a, asig)) return false;
            // Mismo día + máquina + persona: quitar también el horario manual de la grilla
            if (
                String(a.fechaDia) === String(asig.fechaDia)
                && String(a.maquinaId) === String(asig.maquinaId)
                && String(a.usuarioId) === String(asig.usuarioId)
            ) return false;
            return true;
        });
        await persistAsignaciones(next);
    };

    const copiarAnterior = async () => {
        setSaving(true);
        try {
            const res = await planeacionApi.copiarRosterSemanaAnterior(semanaKey);
            setAsignaciones(res?.asignaciones || []);
            showAppAlert('Roster', res?.mensaje || 'Semana anterior copiada.');
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo copiar.');
        } finally {
            setSaving(false);
        }
    };

    const persistConfigTurnos = async (maquinaId, rows, { silent = false } = {}) => {
        if (!maquinaId) return false;
        const seq = ++configSaveSeqRef.current;
        setSaving(true);
        setConfigSaveHint('Guardando…');
        try {
            const payload = (rows || [])
                .filter((c) => {
                    const hid = Number(c.horarioId ?? c.HorarioId) || 0;
                    return hid > 0 && c.activo !== false;
                })
                .map((c) => ({
                    horarioId: Number(c.horarioId ?? c.HorarioId),
                    activo: true,
                    requiereOperario: c.requiereOperario !== false,
                    auxiliaresRequeridos: Number(c.auxiliaresRequeridos) || 0,
                }));
            const saved = await planeacionApi.putTurnosConfigMaquina(maquinaId, payload);
            if (seq !== configSaveSeqRef.current) return false;
            const list = normalizeConfigRows(saved);
            setConfigTurnos(list);
            setConfigsByMaquina((prev) => ({
                ...prev,
                [String(maquinaId)]: list,
            }));
            setConfigSaveHint(`Guardado · ${list.length} turno(s)`);
            if (!silent) {
                showAppAlert('Config', 'Turnos de la máquina guardados. Se ven en Cobertura.');
            }
            return true;
        } catch (e) {
            if (seq !== configSaveSeqRef.current) return false;
            setConfigSaveHint('Error al guardar');
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo guardar la config de turnos.');
            return false;
        } finally {
            if (seq === configSaveSeqRef.current) setSaving(false);
        }
    };

    const toggleHorarioConfig = (horarioId) => {
        if (!configMaquinaId) return;
        const hid = Number(horarioId);
        if (!hid) return;
        setConfigTurnos((prev) => {
            const exists = prev.some((c) => Number(c.horarioId) === hid);
            const next = exists
                ? prev.filter((c) => Number(c.horarioId) !== hid)
                : [...prev, {
                    horarioId: hid,
                    activo: true,
                    requiereOperario: true,
                    auxiliaresRequeridos: 0,
                }];
            persistConfigTurnos(configMaquinaId, next, { silent: true });
            return next;
        });
    };

    const updateConfigField = (horarioId, field, value) => {
        if (!configMaquinaId) return;
        const hid = Number(horarioId);
        setConfigTurnos((prev) => {
            const next = prev.map((c) => (Number(c.horarioId) === hid ? { ...c, [field]: value } : c));
            if (configAuxTimerRef.current) clearTimeout(configAuxTimerRef.current);
            configAuxTimerRef.current = setTimeout(() => {
                persistConfigTurnos(configMaquinaId, next, { silent: true });
            }, field === 'auxiliaresRequeridos' ? 450 : 0);
            return next;
        });
    };

    const saveConfigTurnos = async () => {
        await persistConfigTurnos(configMaquinaId, configTurnos, { silent: false });
    };

    const setEstadoMaquina = async (estado) => {
        if (!configMaquinaId) return;
        try {
            await planeacionApi.putEstadoOperativoMaquina(configMaquinaId, estado);
            setEstadosByMaquina((prev) => ({ ...prev, [configMaquinaId]: estado }));
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo actualizar estado.');
        }
    };

    const reloadHorarios = async () => {
        const h = await planeacionApi.getHorariosDisponibilidad().catch(() => []);
        const list = Array.isArray(h) ? h : [];
        list.sort((a, b) => compareMaquinaNombre(String(a.codigo || a.Codigo || ''), String(b.codigo || b.Codigo || '')));
        setHorarios(list);
        return list;
    };

    const openCreateHorario = () => {
        const nextCode = String(
            Math.max(0, ...horarios.map((x) => parseInt(x.codigo || x.Codigo || '0', 10) || 0)) + 1
        );
        setHorarioForm({
            codigo: nextCode,
            nombre: `Turno ${nextCode}`,
            inicio: '06:00',
            fin: '14:00',
        });
        setHorarioEdit({ mode: 'create' });
    };

    const openEditHorario = (h) => {
        setHorarioForm({
            codigo: String(h.codigo ?? h.Codigo ?? ''),
            nombre: String(h.nombre ?? h.Nombre ?? ''),
            inicio: h.inicio || h.inicioSemana || '06:00',
            fin: h.fin || h.finSemana || '14:00',
        });
        setHorarioEdit(h);
    };

    const saveHorarioCatalog = async () => {
        const payload = {
            codigo: horarioForm.codigo.trim(),
            nombre: horarioForm.nombre.trim(),
            inicio: horarioForm.inicio.trim(),
            fin: horarioForm.fin.trim(),
            activo: true,
        };
        if (!payload.codigo || !payload.nombre) {
            showAppAlert('Turno', 'Código y nombre son obligatorios.');
            return;
        }
        if (!payload.inicio || !payload.fin) {
            showAppAlert('Turno', 'Hora inicio y fin son obligatorias.');
            return;
        }
        setSaving(true);
        try {
            if (horarioEdit?.mode === 'create') {
                await planeacionApi.crearHorario(payload);
            } else {
                const id = horarioEdit?.id ?? horarioEdit?.Id;
                await planeacionApi.actualizarHorario(id, payload);
            }
            setHorarioEdit(null);
            await reloadHorarios();
            showAppAlert('Turno', 'Turno guardado. Se refleja en captura de operarios.');
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo guardar el turno.');
        } finally {
            setSaving(false);
        }
    };

    const deleteHorarioCatalog = async (h) => {
        const id = h.id ?? h.Id;
        const label = `T${h.codigo || h.Codigo} · ${h.nombre || h.Nombre}`;
        const ok = typeof window !== 'undefined'
            ? window.confirm(`¿Desactivar ${label}?\nDejará de verse en captura de operarios y en el roster.`)
            : true;
        if (!ok) return;
        setSaving(true);
        try {
            await planeacionApi.eliminarHorario(id);
            setConfigTurnos((prev) => prev.filter((c) => c.horarioId !== id));
            setConfigsByMaquina((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((mid) => {
                    next[mid] = (next[mid] || []).filter((c) => c.horarioId !== id);
                });
                return next;
            });
            await reloadHorarios();
            showAppAlert('Turno', `${label} desactivado. Ya no aparece para operarios.`);
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo eliminar el turno.');
        } finally {
            setSaving(false);
        }
    };

    const crearNovedad = async () => {
        const usuarioId = parseInt(novForm.usuarioId, 10);
        if (!usuarioId) {
            showAppAlert('Novedad', 'Seleccione un operario.');
            return;
        }
        if (novForm.medioDia && novForm.jornada !== 'manana' && novForm.jornada !== 'tarde') {
            showAppAlert('Novedad', 'Seleccione jornada mañana o tarde.');
            return;
        }
        setSaving(true);
        try {
            await planeacionApi.crearPersonalNovedad({
                usuarioId,
                tipo: novForm.tipo,
                fechaInicio: novForm.fechaInicio,
                fechaFin: novForm.fechaFin,
                medioDia: !!novForm.medioDia,
                jornada: novForm.medioDia ? novForm.jornada : null,
                observacion: novForm.observacion || null,
            });
            const novs = await planeacionApi.getPersonalNovedades(semanaKey, semanaFinKey);
            setNovedades(Array.isArray(novs) ? novs : []);
            setNovForm((f) => ({
                ...f,
                observacion: '',
                usuarioId: '',
                medioDia: false,
                jornada: 'manana',
            }));
            setNovFilter('');
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo crear la novedad.');
        } finally {
            setSaving(false);
        }
    };

    const borrarNovedad = async (id) => {
        try {
            await planeacionApi.eliminarPersonalNovedad(id);
            setNovedades((prev) => prev.filter((n) => n.id !== id));
        } catch (e) {
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo eliminar.');
        }
    };

    const evalCoberturaTurno = (maquinaId, horarioId, cell) => {
        const cfg = (configsByMaquina[String(maquinaId)] || []).find((c) => c.horarioId === horarioId);
        const ops = cell.filter((a) => !a.esAuxiliar);
        const auxs = cell.filter((a) => a.esAuxiliar);
        if (!cfg) return 'Sin config turno';
        const reqOp = cfg.requiereOperario !== false;
        const reqAux = Number(cfg.auxiliaresRequeridos) || 0;
        if (reqOp && ops.length === 0) return 'Falta operario';
        if (auxs.length < reqAux) return `Faltan ${reqAux - auxs.length} auxiliar(es)`;
        return 'Cubierto';
    };

    const exportRosterExcel = async () => {
        setExporting(true);
        try {
            const XLSX = await import('xlsx-js-style');
            const asignRows = [];
            const turnosRows = [];

            for (const m of maquinasActivas) {
                const mid = maquinaIdOf(m);
                const mNombre = maquinaNombreOf(m) || `#${mid}`;
                for (const d of dias) {
                    const fecha = toDateKey(d);
                    const festivo = isDiaFestivo(fecha) ? 'Si' : 'No';
                    const turns = horariosForMaquinaDia(mid, fecha);
                    for (const h of turns) {
                        const hid = h.id ?? h.Id;
                        const cell = asignacionesByCell[`${fecha}|${mid}|${hid}`] || [];
                        const { inicio, fin } = horarioRangoDia(h, fecha);
                        const horas = horasTurnoDia(h, fecha);
                        const horaTurno = horaTurnoLabel(h, fecha);
                        const ops = cell.filter((a) => !a.esAuxiliar).map((a) => a.usuarioNombre).filter(Boolean);
                        const auxs = cell.filter((a) => a.esAuxiliar).map((a) => a.usuarioNombre).filter(Boolean);

                        turnosRows.push({
                            Fecha: fecha,
                            Dia: diaLabelFromDate(fecha),
                            Festivo: festivo,
                            Maquina: mNombre,
                            'Hora turno': horaTurno,
                            'Hora inicio': inicio,
                            'Hora fin': fin,
                            'Horas turno': horas,
                            Operarios: ops.join(', ') || '—',
                            Auxiliares: auxs.join(', ') || '—',
                        });

                        const baseHoras = {
                            'Hora turno': horaTurno,
                            'Hora inicio': inicio,
                            'Hora fin': fin,
                            'Horas turno': horas,
                        };

                        if (cell.length === 0) {
                            asignRows.push({
                                Fecha: fecha,
                                Dia: diaLabelFromDate(fecha),
                                Festivo: festivo,
                                Maquina: mNombre,
                                Empleado: '',
                                ...baseHoras,
                                Novedad: '',
                            });
                            continue;
                        }

                        for (const a of cell) {
                            const nov = (novedades || []).find(
                                (n) =>
                                    String(n.usuarioId ?? n.UsuarioId) === String(a.usuarioId)
                                    && novedadAfectaTurno(n, fecha, h)
                            );
                            asignRows.push({
                                Fecha: fecha,
                                Dia: diaLabelFromDate(fecha),
                                Festivo: festivo,
                                Maquina: mNombre,
                                Empleado: a.usuarioNombre || '',
                                ...baseHoras,
                                Novedad: nov ? describeNovedad(nov) : '',
                            });
                        }
                    }
                }
            }

            const configRows = maquinasActivas.flatMap((m) => {
                const mid = maquinaIdOf(m);
                const mNombre = maquinaNombreOf(m) || `#${mid}`;
                const rows = configsByMaquina[String(mid)] || [];
                if (rows.length === 0) {
                    return [{
                        Maquina: mNombre,
                        'Hora turno': '—',
                        Activo: 'No',
                        'Req. operario': '—',
                        'Aux. requeridos': 0,
                    }];
                }
                return rows.map((cfg) => ({
                    Maquina: mNombre,
                    'Hora turno': cfg.horarioNombre || (cfg.horarioCodigo ? `T${cfg.horarioCodigo}` : String(cfg.horarioId)),
                    Activo: 'Si',
                    'Req. operario': cfg.requiereOperario !== false ? 'Si' : 'No',
                    'Aux. requeridos': cfg.auxiliaresRequeridos ?? 0,
                }));
            });

            const catalogRows = horarios.map((h) => ({
                Codigo: h.codigo || h.Codigo || '',
                Nombre: h.nombre || h.Nombre || '',
                'Inicio semana': h.inicioSemana || h.InicioSemana || h.inicio || h.Inicio || '',
                'Fin semana': h.finSemana || h.FinSemana || h.fin || h.Fin || '',
                'Inicio sabado': h.inicioSabado || h.InicioSabado || '',
                'Fin sabado': h.finSabado || h.FinSabado || '',
                Activo: h.activo !== false && h.Activo !== false ? 'Si' : 'No',
            }));

            const novedadRows = (novedades || []).map((n) => ({
                Empleado: n.usuarioNombre || n.UsuarioNombre || '',
                Tipo: NOVEDAD_LABEL[n.tipo || n.Tipo] || (n.tipo || n.Tipo || ''),
                'Fecha inicio': n.fechaInicio || n.FechaInicio || '',
                'Fecha fin': n.fechaFin || n.FechaFin || '',
                'Medio dia': n.medioDia || n.MedioDia ? 'Si' : 'No',
                Jornada: n.jornada || n.Jornada || '',
                Observacion: n.observacion || n.Observacion || '',
            }));

            const resumenRows = [
                { Campo: 'Semana inicio', Valor: semanaKey },
                { Campo: 'Semana fin', Valor: semanaFinKey },
                { Campo: 'Dias festivos', Valor: (diasFestivos || []).length },
                { Campo: 'Maquinas activas', Valor: maquinasActivas.length },
                { Campo: 'Turnos planeados', Valor: turnosRows.length },
                { Campo: 'Asignaciones', Valor: asignaciones.length },
                { Campo: 'Novedades en rango', Valor: novedadRows.length },
                { Campo: 'Exportado', Valor: new Date().toLocaleString('es-CO') },
            ];

            const wb = XLSX.utils.book_new();
            const diasKeys = dias.map((d) => toDateKey(d));
            const horarioPersonalizadoId = resolveHorarioPersonalizadoId(horarios);
            const horariosRows = buildHorariosRows({
                asignaciones,
                maquinas: maquinasActivas,
                diasKeys,
                horarios,
                novedades,
                diasFestivos,
                horarioPersonalizadoId,
                jornadaDias,
            });
            const wsProg = buildWsProgramacionTurnos(XLSX, {
                horariosRows,
                diasKeys,
                diasFestivos,
                semanaKey,
                semanaFinKey,
            });
            XLSX.utils.book_append_sheet(wb, wsProg, 'Programación turnos');

            const ASIGN_COLS = 10;
            const TURNOS_COLS = 10;

            const wsAsign = applyMaquinaMerges(
                XLSX.utils.json_to_sheet(asignRows),
                asignRows,
                3
            );
            applyRowHighlights(
                XLSX,
                wsAsign,
                asignRows.length + 1,
                ASIGN_COLS,
                (r) => !!asignRows[r - 1]?.Novedad
            );
            wsAsign['!cols'] = [
                { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 24 }, { wch: 16 },
                { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 28 },
            ];
            XLSX.utils.book_append_sheet(wb, wsAsign, 'Asignaciones');

            const wsTurnos = applyMaquinaMerges(
                XLSX.utils.json_to_sheet(turnosRows),
                turnosRows,
                3
            );
            wsTurnos['!cols'] = [
                { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 16 },
                { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 24 },
            ];
            XLSX.utils.book_append_sheet(wb, wsTurnos, 'Turnos planeados');

            const appendSheet = (name, rows, widths) => {
                const ws = XLSX.utils.json_to_sheet(rows);
                if (widths?.length) ws['!cols'] = widths;
                XLSX.utils.book_append_sheet(wb, ws, name);
            };

            appendSheet('Config turnos', configRows, [
                { wch: 22 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
            ]);
            appendSheet('Catalogo turnos', catalogRows, [
                { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
            ]);
            appendSheet('Novedades', novedadRows, [
                { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 30 },
            ]);
            appendSheet('Resumen', resumenRows, [{ wch: 22 }, { wch: 28 }]);

            const fileName = `Roster_Planeacion_${semanaKey}_${semanaFinKey}.xlsx`;

            if (Platform.OS === 'web') {
                XLSX.writeFile(wb, fileName);
                showExportToast(`Excel descargado · ${fileName}`);
            } else {
                const FileSystem = await import('expo-file-system');
                const Sharing = await import('expo-sharing');
                const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
                const uri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(uri, wbout, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        dialogTitle: 'Exportar roster',
                    });
                }
                showExportToast('Excel generado correctamente');
            }
        } catch (e) {
            console.error(e);
            showAppAlert('Error', extractApiErrorMessage(e) || 'No se pudo exportar el Excel.');
        } finally {
            setExporting(false);
        }
    };

    const maquinaNombre = (id) => maquinaNombreOf(maquinasActivas.find((x) => maquinaIdOf(x) === id)) || `#${id}`;
    const horarioLabel = (id) => {
        const h = horarios.find((x) => (x.id ?? x.Id) === id);
        return h ? `${h.codigo || h.Codigo || id}` : String(id);
    };

    const clearFilters = () => {
        setMaqSearch('');
        setCoberturaFilter('todas');
        setCoberturaPersonQ('');
        setCoberturaRolFilter('todos');
        setDiaFilter('todos');
    };

    const hasActiveFilters = !!maqSearch || !!coberturaPersonQ || coberturaFilter !== 'todas'
        || coberturaRolFilter !== 'todos' || diaFilter !== 'todos';
    const selectedNovUser = usuariosActivos.find((u) => String(u.id ?? u.Id) === String(novForm.usuarioId));
    const estadoActual = estadosByMaquina[configMaquinaId] || 'Operativa';

    if (loading) {
        return (
            <View style={[styles.loadingWrap, { backgroundColor: pageBg }]}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={{ color: subColor, marginTop: 8 }}>Cargando roster…</Text>
            </View>
        );
    }

    const renderTopBar = () => (
        <View style={[styles.topBar, { backgroundColor: cardBg, borderColor: border }]}>
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSemanaInicio((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
            >
                <Text style={styles.iconBtnTxt}>◀</Text>
            </TouchableOpacity>
            <Text style={[styles.weekLbl, { color: textColor }]} numberOfLines={1}>
                {semanaKey} → {semanaFinKey}
            </Text>
            <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSemanaInicio((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
            >
                <Text style={styles.iconBtnTxt}>▶</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.copyBtn} onPress={copiarAnterior} disabled={saving || exporting}>
                <Text style={styles.copyBtnTxt}>Copiar ant.</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.exportBtn, (exporting || loading) && { opacity: 0.6 }]}
                onPress={() => void exportRosterExcel()}
                disabled={exporting || loading}
            >
                <Text style={styles.exportBtnTxt}>{exporting ? 'Exportando…' : 'Excel'}</Text>
            </TouchableOpacity>
            <View style={styles.tabsInline}>
                {ROSTER_TABS.map((t) => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tabMini, tab === t.id && styles.tabMiniOn]}
                        onPress={() => setTab(t.id)}
                    >
                        <Text style={[styles.tabMiniTxt, { color: tab === t.id ? '#FFF' : subColor }]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {saving || exporting ? <ActivityIndicator color="#F59E0B" size="small" /> : null}
        </View>
    );

    const renderFiltersCompact = () => (
        <View style={[styles.filterCompact, { backgroundColor: cardBg, borderColor: border }]}>
            <TextInput
                style={[styles.searchMini, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                placeholder="Buscar máquina…"
                placeholderTextColor={subColor}
                value={maqSearch}
                onChangeText={setMaqSearch}
            />
            <TextInput
                style={[styles.searchMini, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                placeholder="Buscar operario/aux…"
                placeholderTextColor={subColor}
                value={coberturaPersonQ}
                onChangeText={setCoberturaPersonQ}
            />
            <TouchableOpacity
                style={[styles.filterToggle, filtersOpen && styles.filterToggleOn]}
                onPress={() => setFiltersOpen((v) => !v)}
            >
                <Text style={styles.filterToggleTxt}>
                    Filtros{hasActiveFilters ? ' ●' : ''} {filtersOpen ? '▴' : '▾'}
                </Text>
            </TouchableOpacity>
            <Text style={{ color: subColor, fontSize: 11 }}>
                {maquinasFiltradas.length}/{maquinasActivas.length}
            </Text>
            {hasActiveFilters ? (
                <TouchableOpacity onPress={clearFilters}>
                    <Text style={{ color: '#FBBF24', fontSize: 11 }}>Limpiar</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );

    const renderFiltersExpanded = () => {
        if (!filtersOpen) return null;
        return (
            <View style={[styles.filterExpanded, { borderColor: border, backgroundColor: cardBg }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                        {COBERTURA_FILTERS.map((f) => (
                            <TouchableOpacity
                                key={f.id}
                                style={[styles.chipMini, coberturaFilter === f.id && styles.chipMiniOn]}
                                onPress={() => setCoberturaFilter(f.id)}
                            >
                                <Text style={[styles.chipMiniTxt, { color: coberturaFilter === f.id ? '#FFF' : textColor }]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <View style={styles.chipSep} />
                        {[
                            { id: 'todos', label: 'Op+Ax' },
                            { id: 'operarios', label: 'Operarios' },
                            { id: 'auxiliares', label: 'Auxiliares' },
                        ].map((f) => (
                            <TouchableOpacity
                                key={`rol-${f.id}`}
                                style={[styles.chipMini, coberturaRolFilter === f.id && styles.chipMiniOn]}
                                onPress={() => setCoberturaRolFilter(f.id)}
                            >
                                <Text style={[styles.chipMiniTxt, { color: coberturaRolFilter === f.id ? '#FFF' : textColor }]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <View style={styles.chipSep} />
                        <TouchableOpacity
                            style={[styles.chipMini, diaFilter === 'todos' && styles.chipMiniOn]}
                            onPress={() => setDiaFilter('todos')}
                        >
                            <Text style={[styles.chipMiniTxt, { color: diaFilter === 'todos' ? '#FFF' : textColor }]}>Semana</Text>
                        </TouchableOpacity>
                        {dias.map((d, i) => (
                            <TouchableOpacity
                                key={toDateKey(d)}
                                style={[styles.chipMini, diaFilter === String(i) && styles.chipMiniOn]}
                                onPress={() => setDiaFilter(String(i))}
                            >
                                <Text style={[styles.chipMiniTxt, { color: diaFilter === String(i) ? '#FFF' : textColor }]}>
                                    {DAY_LABELS[i]} {d.getDate()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    };

    const renderHorarios = () => (
        <View style={styles.fill}>
        <RosterHorariosGrid
            maquinas={maquinasActivas}
            dias={dias}
            diasFestivos={diasFestivos}
            asignaciones={asignaciones}
            horarios={horarios}
            usuarios={usuariosActivos}
            novedades={novedades}
            colors={{ text: textColor, subText: subColor, border, primary: '#2563EB' }}
            isDarkMode={isDarkMode}
            saving={saving}
            onSaveAsignaciones={persistAsignaciones}
            configsByMaquina={configsByMaquina}
            jornadaDias={jornadaDias}
            procesosGantt={procesosGantt}
            semanaKey={semanaKey}
            winH={winH}
            winW={winW}
        />
        </View>
    );

    const renderCobertura = () => (
        <View style={styles.fill}>
            {renderFiltersCompact()}
            {renderFiltersExpanded()}
            {maquinasFiltradas.length === 0 ? (
                <View style={[styles.emptyState, { borderColor: border }]}>
                    <Text style={{ color: textColor }}>Sin máquinas con esos filtros</Text>
                    <TouchableOpacity onPress={clearFilters} style={{ marginTop: 8 }}>
                        <Text style={{ color: '#FBBF24' }}>Limpiar filtros</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={[styles.gridFill, Platform.OS === 'web' ? { maxHeight: Math.max(240, winH - 260) } : null]}>
                    <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ minWidth: '100%' }}>
                        <View style={{ width: Math.max(gridTotalW, winW - 24), flex: 1, minHeight: 0 }}>
                            <View style={styles.gridHeader}>
                                <View style={[styles.maqCol, { width: MAQ_COL_W, borderColor: border, backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0' }]}>
                                    <Text style={[styles.headerTxt, { color: subColor }]}>Máquina</Text>
                                </View>
                                {diasVisibles.map(({ d, i }) => {
                                    const fecha = toDateKey(d);
                                    const festivo = isDiaFestivo(fecha);
                                    return (
                                    <TouchableOpacity
                                        key={fecha}
                                        style={[
                                            styles.dayCol,
                                            {
                                                width: dayColW,
                                                flexGrow: 1,
                                                borderColor: border,
                                                backgroundColor: festivo
                                                    ? (isDarkMode ? '#78350F' : '#FEF3C7')
                                                    : (isDarkMode ? '#0F172A' : '#E2E8F0'),
                                            },
                                        ]}
                                        onPress={() => toggleDiaFestivo(fecha)}
                                        title={festivo ? 'Festivo · pulse para quitar' : 'Pulse para marcar festivo'}
                                    >
                                        <Text style={[styles.headerTxt, { color: textColor }]}>{DAY_LABELS[i]} {d.getDate()}</Text>
                                        {festivo ? (
                                            <Text style={styles.festivoBadge}>Festivo</Text>
                                        ) : (
                                            <Text style={[styles.festivoHint, { color: subColor }]}>☆</Text>
                                        )}
                                    </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <ScrollView
                                style={[
                                    styles.gridBody,
                                    Platform.OS === 'web'
                                        ? { maxHeight: Math.max(200, winH - 310), overflowY: 'auto' }
                                        : { maxHeight: Math.max(200, winH - 310) },
                                ]}
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                            >
                                {maquinasFiltradas.map((m) => {
                                    const mid = maquinaIdOf(m);
                                    const nombre = maquinaNombreOf(m) || `#${mid}`;
                                    const hasCfg = !!(configsByMaquina[String(mid)]?.length);
                                    const est = estadosByMaquina[mid] || 'Operativa';
                                    return (
                                        <View key={mid} style={styles.gridRow}>
                                            <View style={[styles.maqCol, { width: MAQ_COL_W, borderColor: border, backgroundColor: cardBg }]}>
                                                <Text style={[styles.maqName, { color: textColor }]} numberOfLines={2}>{nombre}</Text>
                                                <View style={styles.maqMeta}>
                                                    <View style={[styles.estadoDot, { backgroundColor: estadoColor(est) }]} />
                                                    <Text style={[styles.maqHint, { color: subColor }]} numberOfLines={1}>
                                                        {est !== 'Operativa' ? est : (hasCfg ? `${configsByMaquina[String(mid)].length} turnos` : 'sin config')}
                                                    </Text>
                                                </View>
                                            </View>
                                            {diasVisibles.map(({ d }) => {
                                                const fecha = toDateKey(d);
                                                const festivo = isDiaFestivo(fecha);
                                                const turns = horariosForMaquinaDia(mid, fecha);
                                                return (
                                                    <View
                                                        key={fecha}
                                                        style={[
                                                            styles.dayCol,
                                                            {
                                                                width: dayColW,
                                                                flexGrow: 1,
                                                                borderColor: border,
                                                                backgroundColor: festivo
                                                                    ? (isDarkMode ? '#422006' : '#FFFBEB')
                                                                    : cardBg,
                                                            },
                                                        ]}
                                                    >
                                                        {!hasCfg && turns.length === 0 ? (
                                                            <Text style={[styles.emptyTurn, { color: subColor }]}>Configure turnos</Text>
                                                        ) : null}
                                                        {turns.map((h) => {
                                                            const hid = h.id ?? h.Id;
                                                            const cell = asignacionesByCell[`${fecha}|${mid}|${hid}`] || [];
                                                            const ops = cell.filter((a) => !a.esAuxiliar);
                                                            const auxs = cell.filter((a) => a.esAuxiliar);
                                                            const label = h.codigo || h.Codigo || hid;
                                                            const agregado = isTurnoAgregadoDia(mid, fecha, hid);
                                                            return (
                                                                <View
                                                                    key={hid}
                                                                    style={[
                                                                        styles.turnoCard,
                                                                        { borderColor: border },
                                                                        agregado && styles.turnoCardExtra,
                                                                    ]}
                                                                >
                                                                    <View style={styles.turnoHead}>
                                                                        <Text
                                                                            style={[styles.turnoLbl, { color: subColor }]}
                                                                            title={turnoTooltip(h)}
                                                                            accessibilityLabel={turnoTooltip(h)}
                                                                        >
                                                                            T{label}{agregado ? '*' : ''}
                                                                        </Text>
                                                                        <View style={styles.addRow}>
                                                                            <TouchableOpacity
                                                                                style={styles.addBtn}
                                                                                onPress={() => setDraftAssign({
                                                                                    maquinaId: mid, fechaDia: fecha, horarioId: hid, esAuxiliar: false,
                                                                                })}
                                                                            >
                                                                                <Text style={styles.addBtnTxt}>+Op</Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                style={styles.addBtn}
                                                                                onPress={() => setDraftAssign({
                                                                                    maquinaId: mid, fechaDia: fecha, horarioId: hid, esAuxiliar: true,
                                                                                })}
                                                                            >
                                                                                <Text style={styles.addBtnTxt}>+Ax</Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                style={styles.delDayBtn}
                                                                                onPress={() => quitarTurnoDelDia(mid, fecha, hid)}
                                                                                title="Quitar turno solo este día"
                                                                            >
                                                                                <Text style={styles.delDayBtnTxt}>✕</Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    </View>
                                                                    {ops.map((a) => renderPersonChip(a, h, fecha))}
                                                                    {auxs.map((a) => renderPersonChip(a, h, fecha, { aux: true }))}
                                                                </View>
                                                            );
                                                        })}
                                                        <TouchableOpacity
                                                            style={styles.addTurnoDiaBtn}
                                                            onPress={() => setAddTurnoDiaDraft({ maquinaId: mid, fechaDia: fecha })}
                                                        >
                                                            <Text style={styles.addTurnoDiaTxt}>+ Turno día</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>
            )}
        </View>
    );

    const renderConfig = () => (
        <View style={styles.fill}>
            {renderFiltersCompact()}
            <View style={styles.split}>
                <ScrollView
                    style={[
                        styles.sideList,
                        { borderColor: border, backgroundColor: cardBg },
                        Platform.OS === 'web' ? { maxHeight: Math.max(240, winH - 260), overflowY: 'auto' } : null,
                    ]}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                >
                    {maquinasFiltradas.map((m) => {
                        const mid = maquinaIdOf(m);
                        const active = configMaquinaId === mid;
                        const est = estadosByMaquina[mid] || 'Operativa';
                        return (
                            <TouchableOpacity
                                key={mid}
                                style={[styles.sideItem, active && styles.sideItemOn, { borderBottomColor: border }]}
                                onPress={() => setConfigMaquinaId(mid)}
                            >
                                <View style={[styles.estadoDot, { backgroundColor: estadoColor(est) }]} />
                                <Text style={[styles.sideItemTxt, { color: active ? '#FFF' : textColor }]} numberOfLines={2}>
                                    {maquinaNombreOf(m)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View
                    style={[
                        styles.mainPaneCol,
                        Platform.OS === 'web' ? { maxHeight: Math.max(240, winH - 260) } : null,
                    ]}
                >
                    <View style={[styles.saveFooter, { borderColor: border, backgroundColor: cardBg, marginBottom: 6 }]}>
                        <Text style={{ color: subColor, fontSize: 11, flex: 1 }} numberOfLines={2}>
                            {configMaquinaId ? maquinaNombre(configMaquinaId) : 'Sin máquina'}
                            {' · '}
                            {configTurnos.length} turno(s) ON
                            {configSaveHint ? ` · ${configSaveHint}` : ''}
                            {'\n'}Se guarda al activar/desactivar (ON/OFF)
                        </Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={saveConfigTurnos} disabled={saving || !configMaquinaId}>
                            <Text style={styles.primaryBtnTxt}>{saving ? 'Guardando…' : 'Guardar'}</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        style={styles.mainPaneScroll}
                        contentContainerStyle={styles.mainPaneContent}
                        nestedScrollEnabled
                    >
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginBottom: 10 }]}>
                            <View style={styles.cardHeadRow}>
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                                    onPress={() => setCatalogOpen((v) => !v)}
                                >
                                    <Text style={[styles.cardTitle, { color: textColor, marginBottom: 0 }]}>
                                        Catálogo de turnos {catalogOpen ? '▴' : '▾'}
                                    </Text>
                                    <Text style={{ color: subColor, fontSize: 11 }}>({horarios.length})</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.primaryBtn} onPress={openCreateHorario}>
                                    <Text style={styles.primaryBtnTxt}>+ Nuevo</Text>
                                </TouchableOpacity>
                            </View>
                            {catalogOpen ? (
                                <>
                                    <Text style={[styles.hintInline, { color: subColor }]}>
                                        Crear/editar/borrar afecta a operarios (captura) y a la cobertura.
                                    </Text>
                                    {horarios.map((h) => {
                                        const hid = h.id ?? h.Id;
                                        return (
                                            <View key={hid} style={[styles.catalogRow, { borderBottomColor: border }]}>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <Text style={{ color: textColor, fontWeight: '700', fontSize: 12 }}>
                                                        T{h.codigo || h.Codigo} · {h.nombre || h.Nombre}
                                                    </Text>
                                                    <Text style={{ color: subColor, fontSize: 10 }}>
                                                        {horarioHorasLabel(h)}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity style={styles.linkBtn} onPress={() => openEditHorario(h)}>
                                                    <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '600' }}>Editar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.linkBtn} onPress={() => deleteHorarioCatalog(h)}>
                                                    <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '600' }}>Borrar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                    {horarios.length === 0 ? (
                                        <Text style={{ color: subColor, fontSize: 12 }}>No hay turnos activos.</Text>
                                    ) : null}
                                </>
                            ) : (
                                <Text style={[styles.hintInline, { color: subColor, marginBottom: 0 }]}>
                                    Pulse para expandir el catálogo (crear/editar/borrar turnos globales).
                                </Text>
                            )}
                        </View>

                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <Text style={[styles.cardTitle, { color: textColor }]}>
                                {configMaquinaId ? maquinaNombre(configMaquinaId) : 'Seleccione máquina'}
                            </Text>

                            <Text style={[styles.fieldLbl, { color: subColor }]}>Estado operativo</Text>
                            <View style={styles.chipRow}>
                                {ESTADOS_OP.map((est) => (
                                    <TouchableOpacity
                                        key={est}
                                        style={[
                                            styles.chipMini,
                                            estadoActual === est && { backgroundColor: estadoColor(est), borderColor: estadoColor(est) },
                                        ]}
                                        onPress={() => setEstadoMaquina(est)}
                                    >
                                        <Text style={[styles.chipMiniTxt, { color: estadoActual === est ? '#FFF' : textColor }]}>{est}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.fieldLbl, { color: subColor, marginTop: 12 }]}>Turnos habilitados en esta máquina</Text>
                            <Text style={[styles.hintInline, { color: subColor }]}>
                                ON/OFF activa el turno en esta máquina. Quitar = solo esta máquina. Borrar = desactiva el turno en todo el roster.
                            </Text>
                            {horarios.map((h) => {
                                const hid = Number(h.id ?? h.Id);
                                const cfg = configTurnos.find((c) => Number(c.horarioId) === hid);
                                const on = !!cfg;
                                return (
                                    <View key={hid} style={[styles.cfgRow, { borderBottomColor: border }]}>
                                        <TouchableOpacity
                                            style={[styles.cfgToggle, on ? styles.cfgToggleOn : { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
                                            onPress={() => toggleHorarioConfig(hid)}
                                            disabled={saving}
                                        >
                                            <Text style={{ color: on ? '#FFF' : textColor, fontWeight: '700', fontSize: 11 }}>
                                                {on ? 'ON' : 'OFF'}
                                            </Text>
                                        </TouchableOpacity>
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text
                                                style={{ color: textColor, fontSize: 13, fontWeight: '600' }}
                                                title={turnoTooltip(h)}
                                            >
                                                T{h.codigo || h.Codigo} · {h.nombre || h.Nombre}
                                            </Text>
                                            <Text style={{ color: subColor, fontSize: 11 }}>
                                                {horarioHorasLabel(h)}
                                            </Text>
                                            {on && (
                                                <View style={styles.cfgFields}>
                                                    <TouchableOpacity
                                                        style={[styles.miniToggle, { borderColor: border }]}
                                                        onPress={() => updateConfigField(hid, 'requiereOperario', !(cfg.requiereOperario !== false))}
                                                    >
                                                        <Text style={{ color: subColor, fontSize: 11 }}>
                                                            Op: {cfg.requiereOperario !== false ? 'sí' : 'no'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <Text style={{ color: subColor, fontSize: 11 }}>Aux</Text>
                                                    <TextInput
                                                        style={[styles.auxInput, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                                        keyboardType="numeric"
                                                        value={String(cfg.auxiliaresRequeridos ?? 0)}
                                                        onChangeText={(t) => updateConfigField(hid, 'auxiliaresRequeridos', parseInt(t, 10) || 0)}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.cfgActions}>
                                            <TouchableOpacity style={styles.linkBtn} onPress={() => openEditHorario(h)}>
                                                <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '600' }}>Editar</Text>
                                            </TouchableOpacity>
                                            {on ? (
                                                <TouchableOpacity style={styles.linkBtn} onPress={() => quitarTurnoDeMaquina(hid, h)}>
                                                    <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '600' }}>Quitar</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                            <TouchableOpacity style={styles.linkBtn} onPress={() => deleteHorarioCatalog(h)} disabled={saving}>
                                                <Text style={{ color: '#FCA5A5', fontSize: 11, fontWeight: '600' }}>Borrar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </View>
    );

    const renderNovedades = () => (
        <View style={[styles.split, { paddingHorizontal: 8, paddingTop: 4 }]}>
            <ScrollView style={styles.novFormPane} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                    <Text style={[styles.cardTitle, { color: textColor }]}>Alta novedad</Text>
                    <Text style={[styles.fieldLbl, { color: subColor }]}>Persona</Text>
                    <TextInput
                        style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                        placeholder="Buscar por nombre…"
                        placeholderTextColor={subColor}
                        value={novFilter}
                        onChangeText={setNovFilter}
                    />
                    {selectedNovUser ? (
                        <View style={[styles.selectedUser, { borderColor: border, backgroundColor: pageBg }]}>
                            <Text style={{ color: textColor, flex: 1, fontSize: 12 }} numberOfLines={1}>
                                {selectedNovUser.nombre ?? selectedNovUser.Nombre}
                            </Text>
                            <TouchableOpacity onPress={() => { setNovForm((f) => ({ ...f, usuarioId: '' })); setNovFilter(''); }}>
                                <Text style={{ color: '#F87171', fontSize: 12 }}>Quitar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView style={styles.userPickList} nestedScrollEnabled>
                            {usuariosNovFiltrados.map((u) => {
                                const uid = u.id ?? u.Id;
                                return (
                                    <TouchableOpacity
                                        key={uid}
                                        style={[styles.userPickRow, { borderBottomColor: border }]}
                                        onPress={() => {
                                            setNovForm((f) => ({ ...f, usuarioId: String(uid) }));
                                            setNovFilter(u.nombre ?? u.Nombre ?? '');
                                        }}
                                    >
                                        <Text style={{ color: textColor, fontSize: 12 }} numberOfLines={1}>{u.nombre ?? u.Nombre}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}

                    <Text style={[styles.fieldLbl, { color: subColor }]}>Tipo</Text>
                    <View style={styles.chipRow}>
                        {NOVEDAD_TIPOS.map((t) => (
                            <TouchableOpacity
                                key={t.value}
                                style={[styles.chipMini, novForm.tipo === t.value && styles.chipMiniOn]}
                                onPress={() => setNovForm((f) => ({ ...f, tipo: t.value }))}
                            >
                                <Text style={[styles.chipMiniTxt, { color: novForm.tipo === t.value ? '#FFF' : textColor }]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.dateRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLbl, { color: subColor }]}>Desde</Text>
                            <TextInput
                                style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                value={novForm.fechaInicio}
                                onChangeText={(t) => setNovForm((f) => ({ ...f, fechaInicio: t }))}
                            />
                        </View>
                        <View style={{ width: 8 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLbl, { color: subColor }]}>Hasta</Text>
                            <TextInput
                                style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                value={novForm.fechaFin}
                                onChangeText={(t) => setNovForm((f) => ({ ...f, fechaFin: t }))}
                            />
                        </View>
                    </View>

                    <Text style={[styles.fieldLbl, { color: subColor }]}>Duración</Text>
                    <View style={styles.chipRow}>
                        <TouchableOpacity
                            style={[styles.chipMini, !novForm.medioDia && styles.chipMiniOn]}
                            onPress={() => setNovForm((f) => ({ ...f, medioDia: false }))}
                        >
                            <Text style={[styles.chipMiniTxt, { color: !novForm.medioDia ? '#FFF' : textColor }]}>Día completo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.chipMini, novForm.medioDia && styles.chipMiniOn]}
                            onPress={() => setNovForm((f) => ({ ...f, medioDia: true, jornada: f.jornada || 'manana' }))}
                        >
                            <Text style={[styles.chipMiniTxt, { color: novForm.medioDia ? '#FFF' : textColor }]}>Medio día</Text>
                        </TouchableOpacity>
                    </View>
                    {novForm.medioDia ? (
                        <>
                            <Text style={[styles.fieldLbl, { color: subColor }]}>Jornada</Text>
                            <View style={styles.chipRow}>
                                <TouchableOpacity
                                    style={[styles.chipMini, novForm.jornada === 'manana' && styles.chipMiniOn]}
                                    onPress={() => setNovForm((f) => ({ ...f, jornada: 'manana' }))}
                                >
                                    <Text style={[styles.chipMiniTxt, { color: novForm.jornada === 'manana' ? '#FFF' : textColor }]}>Mañana</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.chipMini, novForm.jornada === 'tarde' && styles.chipMiniOn]}
                                    onPress={() => setNovForm((f) => ({ ...f, jornada: 'tarde' }))}
                                >
                                    <Text style={[styles.chipMiniTxt, { color: novForm.jornada === 'tarde' ? '#FFF' : textColor }]}>Tarde</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : null}

                    <Text style={[styles.fieldLbl, { color: subColor }]}>Observación</Text>
                    <TextInput
                        style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                        value={novForm.observacion}
                        onChangeText={(t) => setNovForm((f) => ({ ...f, observacion: t }))}
                        placeholder="Opcional"
                        placeholderTextColor={subColor}
                    />
                    <TouchableOpacity style={[styles.primaryBtn, { alignSelf: 'flex-start' }]} onPress={crearNovedad} disabled={saving}>
                        <Text style={styles.primaryBtnTxt}>Registrar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <ScrollView style={[styles.novListPane, { borderColor: border, backgroundColor: cardBg }]} contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
                <Text style={[styles.cardTitle, { color: textColor }]}>Semana ({novedades.length})</Text>
                {novedades.length === 0 ? (
                    <Text style={{ color: subColor, fontSize: 13 }}>Sin novedades.</Text>
                ) : (
                    novedades.map((n) => (
                        <View key={n.id} style={[styles.novItem, { borderTopColor: border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>{n.usuarioNombre} · {n.tipo}</Text>
                                <Text style={{ color: subColor, fontSize: 11 }}>
                                    {n.fechaInicio} → {n.fechaFin}
                                    {n.medioDia
                                        ? ` · Medio día (${n.jornada === 'tarde' ? 'tarde' : 'mañana'})`
                                        : ' · Día completo'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => borrarNovedad(n.id)}>
                                <Text style={{ color: '#FCA5A5', fontSize: 11 }}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );

    return (
        <View style={[styles.root, { backgroundColor: pageBg }]}>
            {renderTopBar()}
            <View style={styles.body}>
                {tab === 'horarios' && renderHorarios()}
                {tab === 'cobertura' && renderCobertura()}
                {tab === 'config' && renderConfig()}
                {tab === 'novedades' && renderNovedades()}
            </View>

            <Modal visible={!!draftAssign} transparent animationType="fade" onRequestClose={() => { setDraftAssign(null); setUserFilter(''); }}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: border }]}>
                        <Text style={[styles.cardTitle, { color: textColor }]}>
                            Asignar {draftAssign?.esAuxiliar ? 'auxiliar' : 'operario'}
                        </Text>
                        {draftAssign ? (
                            <Text style={{ color: subColor, fontSize: 12, marginBottom: 8 }}>
                                {maquinaNombre(draftAssign.maquinaId)} · {draftAssign.fechaDia} · T{horarioLabel(draftAssign.horarioId)}
                            </Text>
                        ) : null}
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                            placeholder="Buscar persona…"
                            placeholderTextColor={subColor}
                            value={userFilter}
                            onChangeText={setUserFilter}
                            autoFocus
                        />
                        <ScrollView style={styles.modalList}>
                            {usuariosFiltrados.map((u) => {
                                const uid = u.id ?? u.Id;
                                const horario = draftAssign
                                    ? horarios.find((h) => (h.id ?? h.Id) === draftAssign.horarioId)
                                    : null;
                                const nov = draftAssign
                                    ? findNovedadUsuario(uid, draftAssign.fechaDia, horario)
                                    : null;
                                const bloqueante = nov && ['incapacidad', 'falta', 'baja'].includes(String(nov.tipo || '').toLowerCase());
                                return (
                                    <TouchableOpacity
                                        key={uid}
                                        style={[
                                            styles.userPickRow,
                                            { borderBottomColor: border },
                                            bloqueante && { opacity: 0.55 },
                                        ]}
                                        onPress={() => addAsignacion(uid)}
                                        disabled={!!bloqueante}
                                    >
                                        <Text style={{ color: textColor, fontSize: 13 }}>{u.nombre ?? u.Nombre}</Text>
                                        {nov ? (
                                            <Text style={{ color: '#FBBF24', fontSize: 11, marginTop: 2 }}>
                                                {describeNovedad(nov)}{bloqueante ? ' — no disponible' : ''}
                                            </Text>
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setDraftAssign(null); setUserFilter(''); }}>
                            <Text style={{ color: '#FCA5A5', fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!horarioEdit} transparent animationType="fade" onRequestClose={() => setHorarioEdit(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: border }]}>
                        <Text style={[styles.cardTitle, { color: textColor }]}>
                            {horarioEdit?.mode === 'create' ? 'Nuevo turno' : 'Editar turno'}
                        </Text>
                        <Text style={[styles.fieldLbl, { color: subColor }]}>Código</Text>
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                            value={horarioForm.codigo}
                            onChangeText={(t) => setHorarioForm((f) => ({ ...f, codigo: t }))}
                            placeholder="7"
                            placeholderTextColor={subColor}
                        />
                        <Text style={[styles.fieldLbl, { color: subColor }]}>Nombre</Text>
                        <TextInput
                            style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                            value={horarioForm.nombre}
                            onChangeText={(t) => setHorarioForm((f) => ({ ...f, nombre: t }))}
                            placeholder="Turno noche"
                            placeholderTextColor={subColor}
                        />
                        <View style={styles.dateRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fieldLbl, { color: subColor }]}>Hora inicio</Text>
                                <TextInput
                                    style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                    value={horarioForm.inicio}
                                    onChangeText={(t) => setHorarioForm((f) => ({ ...f, inicio: t }))}
                                    placeholder="06:00"
                                    placeholderTextColor={subColor}
                                />
                            </View>
                            <View style={{ width: 8 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fieldLbl, { color: subColor }]}>Hora fin</Text>
                                <TextInput
                                    style={[styles.input, { color: textColor, borderColor: border, backgroundColor: pageBg }]}
                                    value={horarioForm.fin}
                                    onChangeText={(t) => setHorarioForm((f) => ({ ...f, fin: t }))}
                                    placeholder="14:00"
                                    placeholderTextColor={subColor}
                                />
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity style={styles.primaryBtn} onPress={saveHorarioCatalog} disabled={saving}>
                                <Text style={styles.primaryBtnTxt}>Guardar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setHorarioEdit(null)}>
                                <Text style={{ color: '#FCA5A5', fontWeight: '600' }}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal visible={!!addTurnoDiaDraft} transparent animationType="fade" onRequestClose={() => setAddTurnoDiaDraft(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: border }]}>
                        <Text style={[styles.cardTitle, { color: textColor }]}>Agregar turno solo este día</Text>
                        {addTurnoDiaDraft ? (
                            <Text style={{ color: subColor, fontSize: 12, marginBottom: 8 }}>
                                {maquinaNombre(addTurnoDiaDraft.maquinaId)} · {addTurnoDiaDraft.fechaDia}
                            </Text>
                        ) : null}
                        <ScrollView style={styles.modalList}>
                            {(addTurnoDiaDraft
                                ? horariosForMaquina(addTurnoDiaDraft.maquinaId).filter((h) => {
                                    const already = horariosForMaquinaDia(
                                        addTurnoDiaDraft.maquinaId,
                                        addTurnoDiaDraft.fechaDia
                                    ).some((x) => (x.id ?? x.Id) === (h.id ?? h.Id));
                                    return !already;
                                })
                                : []
                            ).map((h) => {
                                    const hid = h.id ?? h.Id;
                                    return (
                                        <TouchableOpacity
                                            key={hid}
                                            style={[styles.userPickRow, { borderBottomColor: border }]}
                                            onPress={() => agregarTurnoAlDia(
                                                addTurnoDiaDraft.maquinaId,
                                                addTurnoDiaDraft.fechaDia,
                                                hid
                                            )}
                                        >
                                            <View>
                                                <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>
                                                    T{h.codigo || h.Codigo} · {h.nombre || h.Nombre}
                                                </Text>
                                                <Text style={{ color: subColor, fontSize: 11 }}>
                                                    {horarioHorasLabel(h)}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddTurnoDiaDraft(null)}>
                            <Text style={{ color: '#FCA5A5', fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {exportToast ? (
                <Animated.View
                    style={[styles.exportToast, { opacity: exportToastOpacity }]}
                    pointerEvents="none"
                >
                    <Text style={styles.exportToastIcon}>✓</Text>
                    <Text style={styles.exportToastTxt} numberOfLines={2}>
                        {exportToast}
                    </Text>
                </Animated.View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' } : null),
    },
    body: { flex: 1, minHeight: 0, width: '100%' },
    fill: { flex: 1, minHeight: 0, width: '100%', paddingHorizontal: 8 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginHorizontal: 8,
        marginTop: 6,
        marginBottom: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    iconBtn: {
        backgroundColor: '#334155',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    iconBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    weekLbl: { fontSize: 12, fontWeight: '700', flexGrow: 1, minWidth: 140 },
    copyBtn: { backgroundColor: '#B45309', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
    copyBtnTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    exportBtn: { backgroundColor: '#059669', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
    exportBtnTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    exportToast: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#065F46',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '92%',
        zIndex: 9999,
        ...(Platform.OS === 'web'
            ? { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }
            : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
              }),
    },
    exportToastIcon: { color: '#6EE7B7', fontSize: 18, fontWeight: '800' },
    exportToastTxt: { color: '#ECFDF5', fontSize: 13, fontWeight: '600', flexShrink: 1 },
    tabsInline: { flexDirection: 'row', gap: 4 },
    tabMini: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#0F172A' },
    tabMiniOn: { backgroundColor: '#4F46E5' },
    tabMiniTxt: { fontSize: 11, fontWeight: '700' },
    filterCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginBottom: 4,
    },
    searchMini: {
        flex: 1,
        minWidth: 120,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: Platform.OS === 'web' ? 5 : 4,
        fontSize: 12,
    },
    filterToggle: { backgroundColor: '#334155', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
    filterToggleOn: { backgroundColor: '#4F46E5' },
    filterToggleTxt: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    filterExpanded: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginBottom: 6,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
    chipMini: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#475569',
    },
    chipMiniOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    chipMiniTxt: { fontSize: 11, fontWeight: '600' },
    chipSep: { width: 1, height: 16, backgroundColor: '#475569', marginHorizontal: 4 },
    emptyState: { borderWidth: 1, borderRadius: 8, padding: 20, alignItems: 'center', marginTop: 12 },
    gridFill: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column' } : null),
    },
    gridHeader: { flexDirection: 'row', flexShrink: 0 },
    gridRow: { flexDirection: 'row' },
    gridBody: {
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
        ...(Platform.OS === 'web' ? { overflowY: 'auto' } : null),
    },
    maqCol: { paddingHorizontal: 6, paddingVertical: 6, borderWidth: 1, justifyContent: 'center' },
    dayCol: { padding: 4, borderWidth: 1, minHeight: 52 },
    headerTxt: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
    maqName: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
    maqMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    maqHint: { fontSize: 9 },
    estadoDot: { width: 7, height: 7, borderRadius: 4 },
    turnoCard: { borderWidth: 1, borderRadius: 6, padding: 4, marginBottom: 4 },
    turnoCardExtra: { borderColor: '#D97706', borderStyle: 'dashed' },
    turnoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    turnoLbl: { fontSize: 10, fontWeight: '700', cursor: 'help' },
    chipOp: { backgroundColor: '#1D4ED8', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2 },
    chipAux: { backgroundColor: '#0F766E', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2 },
    chipNov: { backgroundColor: '#B45309', borderColor: '#F59E0B', borderWidth: 1 },
    chipRowInner: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    chipMain: { flex: 1, minWidth: 0 },
    chipDel: { paddingHorizontal: 4, paddingVertical: 1 },
    chipDelTxt: { color: '#FECACA', fontSize: 10, fontWeight: '700' },
    festivoBadge: { color: '#FBBF24', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 2 },
    festivoHint: { fontSize: 9, textAlign: 'center', marginTop: 2, opacity: 0.7 },
    chipTxt: { color: '#FFF', fontSize: 10 },
    addRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
    addBtn: { backgroundColor: '#475569', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
    addBtnTxt: { color: '#E2E8F0', fontSize: 9, fontWeight: '700' },
    delDayBtn: { backgroundColor: '#7F1D1D', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
    delDayBtnTxt: { color: '#FECACA', fontSize: 9, fontWeight: '700' },
    addTurnoDiaBtn: {
        marginTop: 2,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#475569',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    addTurnoDiaTxt: { color: '#94A3B8', fontSize: 9, fontWeight: '600' },
    split: { flex: 1, flexDirection: 'row', minHeight: 0, gap: 8 },
    sideList: {
        width: 168,
        borderWidth: 1,
        borderRadius: 8,
        flexShrink: 0,
        minHeight: 0,
        ...(Platform.OS === 'web' ? { overflowY: 'auto' } : null),
    },
    sideItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sideItemOn: { backgroundColor: '#4F46E5' },
    sideItemTxt: { flex: 1, fontSize: 11, fontWeight: '600' },
    mainPaneCol: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        ...(Platform.OS === 'web' ? { height: '100%', display: 'flex', flexDirection: 'column' } : null),
    },
    mainPaneScroll: {
        flex: 1,
        minHeight: 0,
        ...(Platform.OS === 'web' ? { overflowY: 'auto' } : null),
    },
    mainPaneContent: { paddingBottom: 16, flexGrow: 0 },
    saveFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 6,
        flexShrink: 0,
    },
    mainPane: { flex: 1, minWidth: 0 },
    card: { borderWidth: 1, borderRadius: 10, padding: 12 },
    cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    cardHeadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
        flexWrap: 'wrap',
    },
    hintInline: { fontSize: 11, marginBottom: 8, lineHeight: 15 },
    catalogRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    linkBtn: { paddingHorizontal: 4, paddingVertical: 4 },
    fieldLbl: { fontSize: 10, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
    input: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginBottom: 6,
        fontSize: 12,
    },
    cfgRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
    cfgActions: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginLeft: 6 },
    cfgToggle: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, minWidth: 42, alignItems: 'center' },
    cfgToggleOn: { backgroundColor: '#15803D' },
    cfgFields: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    miniToggle: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
    auxInput: { width: 40, borderWidth: 1, borderRadius: 4, paddingVertical: 3, textAlign: 'center', fontSize: 12 },
    primaryBtn: { backgroundColor: '#D97706', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
    primaryBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    dateRow: { flexDirection: 'row' },
    selectedUser: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginBottom: 6,
    },
    userPickList: { maxHeight: 120, borderWidth: 1, borderColor: '#334155', borderRadius: 6, marginBottom: 6 },
    userPickRow: {
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 32,
    },
    novFormPane: { flex: 1, minWidth: 0, maxWidth: 420 },
    novListPane: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10 },
    novItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: { width: '100%', maxWidth: 420, maxHeight: '80%', borderRadius: 12, borderWidth: 1, padding: 14 },
    modalList: { maxHeight: 280, marginBottom: 6 },
    cancelBtn: { alignSelf: 'flex-end', paddingVertical: 6 },
});
