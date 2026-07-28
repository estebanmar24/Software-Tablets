import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    useWindowDimensions,
    ActivityIndicator,
    Modal,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api, ajustarTiempo, repararProcesosAbiertos, API_URL } from '../services/productionApi';
import {
    isRegistroEnProgreso,
    isRegistroPausado,
    getRegistroVivoMasReciente,
} from '../utils/tiempoProceso';
import { useTheme } from '../contexts/ThemeContext';

const SERVER_URL = API_URL.replace(/\/api$/, '');

/** Normaliza un número de OP a solo dígitos sin ceros a la izquierda ("OP-0460" → "460"). */
const normalizarOpKey = (op) => {
    if (op == null) return '';
    const digits = String(op).replace(/\D/g, '');
    return digits.replace(/^0+/, '');
};

/** Construye URL absoluta de una foto de calidad (acepta rutas relativas de planta y externa). */
const buildFotoUrl = (ruta) => {
    if (!ruta) return null;
    const r = String(ruta).trim();
    if (r.startsWith('http') || r.startsWith('data:')) return r;
    if (r.startsWith('/')) return `${SERVER_URL}${r}`;
    return `${SERVER_URL}/${r}`;
};

const toDateStr = (d) => {
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const parseDuration = (str) => {
    if (!str) return 0;
    const parts = String(str).split(':');
    if (parts.length !== 3) return 0;
    return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
};

const formatSeconds = (sec) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

/**

 * Segundos efectivos del registro:
 *  - Si está finalizado: usa la duración guardada.
 *  - Si está pausado: (PausadoEn - HoraInicio) - tiempoPausadoSegundos.
 *  - Si está en progreso: (ahora - HoraInicio) - tiempoPausadoSegundos.
 * `tiempoPausadoSegundos` no incluye la pausa actual mientras está pausado
 * (el backend lo acumula al reanudar/finalizar).
 */
const parseTimeOnDate = (dateStr, timeStr) => {
    if (!timeStr) return NaN;
    const t = String(timeStr).trim().slice(0, 8);
    return new Date(`${dateStr}T${t}`).getTime();
};

const computeRegistroSeconds = (r, nowMs, dateStr) => {
    if (!r) return 0;
    if (!isRegistroEnProgreso(r)) return parseDuration(r.duracion);
    if (!r.horaInicio) return 0;
    try {
        const startMs = parseTimeOnDate(dateStr, r.horaInicio);
        const pausasAcumuladasMs = (Number(r.tiempoPausadoSegundos) || 0) * 1000;

        let refMs;
        if (isRegistroPausado(r) && r.pausadoEn) {
            const pausadoMs = new Date(r.pausadoEn).getTime();
            refMs = isNaN(pausadoMs) ? nowMs : pausadoMs;
        } else {
            refMs = nowMs;
        }

        const diff = Math.floor((refMs - startMs - pausasAcumuladasMs) / 1000);
        return diff > 0 ? diff : 0;
    } catch {
        return 0;
    }
};

/** Intervalo [inicio, fin] de un registro en ms (para unir solapamientos). */
const getRegistroIntervalMs = (r, nowMs, dateStr) => {
    if (!r?.horaInicio) return null;
    const start = parseTimeOnDate(dateStr, r.horaInicio);
    if (isNaN(start)) return null;

    let end;
    if (isRegistroEnProgreso(r)) {
        if (isRegistroPausado(r) && r.pausadoEn) {
            end = new Date(r.pausadoEn).getTime();
            if (isNaN(end)) end = nowMs;
        } else {
            end = nowMs;
        }
    } else if (r.horaFin) {
        end = parseTimeOnDate(dateStr, r.horaFin);
        if (isNaN(end)) {
            end = start + computeRegistroSeconds(r, nowMs, dateStr) * 1000;
        }
    } else {
        end = start + computeRegistroSeconds(r, nowMs, dateStr) * 1000;
    }

    if (!end || end <= start) return null;
    return { start, end };
};

/** Suma de intervalos fusionados (evita doble conteo cuando hay actividades solapadas). */
const mergeIntervalsSeconds = (intervals) => {
    if (!intervals?.length) return 0;
    const sorted = intervals
        .filter(iv => iv && iv.end > iv.start)
        .sort((a, b) => a.start - b.start);
    if (!sorted.length) return 0;

    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const iv = sorted[i];
        const last = merged[merged.length - 1];
        if (iv.start <= last.end) {
            last.end = Math.max(last.end, iv.end);
        } else {
            merged.push({ ...iv });
        }
    }
    return merged.reduce((acc, iv) => acc + Math.floor((iv.end - iv.start) / 1000), 0);
};

const computeUnionSeconds = (registros, nowMs, dateStr, filterFn = null) => {
    const intervals = [];
    for (const r of registros) {
        if (filterFn && !filterFn(r)) continue;
        const iv = getRegistroIntervalMs(r, nowMs, dateStr);
        if (iv) intervals.push(iv);
    }
    return mergeIntervalsSeconds(intervals);
};

/**
 * Códigos habitualmente NO productivos para la meta de rendimiento
 * (reparación, descansos, otros auxiliares, tiempos muertos).
 * Solo se usa como respaldo si el API no envía `actividadEsProductiva`.
 */
const CODIGOS_EXCLUIDOS_META_RENDIMIENTO = new Set([
    '03', '04', '08', '09', '10', '11', '12', '13', '14',
]);

const normalizarCodigoActividad = (codigo) => {
    const n = parseInt(String(codigo || '').replace(/\D/g, ''), 10);
    if (Number.isNaN(n)) return '';
    return String(n).padStart(2, '0');
};

/** Si este registro aporta horas efectivas para calcular la meta diaria (%). */
const cuentaTiempoParaMetaRendimiento = (r) => {
    if (typeof r.actividadEsProductiva === 'boolean') {
        return r.actividadEsProductiva === true;
    }
    const c = normalizarCodigoActividad(r.actividadCodigo);
    if (!c) return true;
    return !CODIGOS_EXCLUIDOS_META_RENDIMIENTO.has(c);
};

const HistoryScreen = () => {
    const { colors, isDarkMode } = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 1024;

    const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedKey, setSelectedKey] = useState(null); // 'maquinaId__usuarioId'
    const [nowMs, setNowMs] = useState(Date.now());
    const [filtroActividad, setFiltroActividad] = useState('');
    const [filtroOP, setFiltroOP] = useState('');
    // Filtros del panel izquierdo: búsqueda por nombre de máquina/operario
    // y estado (todas | en-vivo | pausadas | finalizadas).
    const [filtroMaquinaTexto, setFiltroMaquinaTexto] = useState('');
    const [filtroEstadoMaquina, setFiltroEstadoMaquina] = useState('todas');
    const [ajusteRegistro, setAjusteRegistro] = useState(null);
    const [ajusteForm, setAjusteForm] = useState({
        horaInicio: '',
        horaFin: '',
        tiros: '',
        desperdicio: '',
        observaciones: '',
        actividadId: '',
        referenciaOP: '',
        finalizar: true,
    });
    const [ajusteGuardando, setAjusteGuardando] = useState(false);
    const [reparando, setReparando] = useState(false);
    const [catalogoActividades, setCatalogoActividades] = useState([]);

    // Índice de encuestas de calidad por OP: { '7818': { planta: [ids], externa: [ids] } }
    const [calidadIndex, setCalidadIndex] = useState({});
    // Modal de calidad: { tipo: 'planta'|'externa', ids: [..], op }
    const [calidadModal, setCalidadModal] = useState(null);
    const [calidadDetalle, setCalidadDetalle] = useState(null);
    const [calidadDetalleLoading, setCalidadDetalleLoading] = useState(false);
    const [calidadImagenAmpliada, setCalidadImagenAmpliada] = useState(null);

    const cargar = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await api.get('tiempoproceso/historial', {
                params: {
                    fechaInicio: selectedDate,
                    fechaFin: selectedDate,
                    usuarioId: null,
                    maquinaId: null,
                },
            });
            setResults(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('History load error:', err?.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        cargar();
        const interval = setInterval(() => cargar(true), 5000);
        return () => clearInterval(interval);
    }, [cargar]);

    useEffect(() => {
        api.get('tiempoproceso/actividades')
            .then((res) => setCatalogoActividades(Array.isArray(res.data) ? res.data : []))
            .catch(() => setCatalogoActividades([]));
    }, []);

    const cargarCalidadIndex = useCallback(async () => {
        try {
            const res = await api.get('calidad/encuestas-por-op');
            const map = {};
            (Array.isArray(res.data) ? res.data : []).forEach((row) => {
                if (row?.op) map[row.op] = { planta: row.planta || [], externa: row.externa || [] };
            });
            setCalidadIndex(map);
        } catch {
            setCalidadIndex({});
        }
    }, []);

    useEffect(() => {
        cargarCalidadIndex();
        const t = setInterval(cargarCalidadIndex, 60000);
        return () => clearInterval(t);
    }, [cargarCalidadIndex]);

    const abrirCalidad = useCallback(async (tipo, ids, op) => {
        setCalidadModal({ tipo, ids, op });
        setCalidadDetalle(null);
        // Si solo hay una encuesta, cargarla directamente
        if (ids.length === 1) {
            setCalidadDetalleLoading(true);
            try {
                const url = tipo === 'planta' ? `calidad/encuestas/${ids[0]}` : `CalidadTalleres/${ids[0]}`;
                const res = await api.get(url);
                setCalidadDetalle(res.data);
            } catch {
                setCalidadDetalle(null);
            } finally {
                setCalidadDetalleLoading(false);
            }
        }
    }, []);

    const cargarDetalleCalidad = useCallback(async (tipo, id) => {
        setCalidadDetalleLoading(true);
        try {
            const url = tipo === 'planta' ? `calidad/encuestas/${id}` : `CalidadTalleres/${id}`;
            const res = await api.get(url);
            setCalidadDetalle(res.data);
        } catch {
            setCalidadDetalle(null);
        } finally {
            setCalidadDetalleLoading(false);
        }
    }, []);

    // Tick por segundo SOLO si hay registros en progreso (evita renders innecesarios).
    const hayEnProgreso = useMemo(
        () => results.some(isRegistroEnProgreso),
        [results]
    );
    useEffect(() => {
        if (!hayEnProgreso) return undefined;
        setNowMs(Date.now());
        const t = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, [hayEnProgreso]);

    // Agrupar por máquina + operario
    const grupos = useMemo(() => {
        const map = new Map();
        for (const r of results) {
            const key = `${r.maquinaId || 0}__${r.usuarioId || 0}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    maquinaId: r.maquinaId,
                    maquinaNombre: r.maquinaNombre || 'Sin máquina',
                    usuarioId: r.usuarioId,
                    usuarioNombre: r.usuarioNombre || 'Sin operario',
                    registros: [],
                    tiros: 0,
                    desperdicio: 0,
                    duracionSeg: 0,
                    ops: new Set(),
                    enProgreso: false,
                    pausado: false,
                });
            }
            const g = map.get(key);
            g.registros.push(r);
            g.tiros += Number(r.tiros) || 0;
            g.desperdicio += Number(r.desperdicio) || 0;
            // duracionSeg del grupo se calcula después con unión de intervalos
            if (r.ordenProduccionNumero) g.ops.add(r.ordenProduccionNumero);
            if (isRegistroEnProgreso(r)) g.enProgreso = true;
            if (isRegistroPausado(r)) g.pausado = true;
        }
        for (const g of map.values()) {
            g.registroVivo = getRegistroVivoMasReciente(g.registros);
            g.duracionSeg = computeUnionSeconds(g.registros, nowMs, selectedDate);
        }
        return Array.from(map.values()).sort((a, b) => {
            if (a.enProgreso && !b.enProgreso) return -1;
            if (!a.enProgreso && b.enProgreso) return 1;
            return (b.tiros + b.desperdicio) - (a.tiros + a.desperdicio);
        });
    }, [results, nowMs, selectedDate]);

    // Grupos visibles tras aplicar los filtros del panel izquierdo.
    const gruposFiltrados = useMemo(() => {
        const texto = (filtroMaquinaTexto || '').trim().toLowerCase();
        return grupos.filter(g => {
            // Filtro por estado.
            if (filtroEstadoMaquina === 'en-vivo' && (!g.enProgreso || g.pausado)) return false;
            if (filtroEstadoMaquina === 'pausadas' && !g.pausado) return false;
            if (filtroEstadoMaquina === 'finalizadas' && g.enProgreso) return false;

            // Filtro por texto: nombre de máquina u operario.
            if (texto) {
                const haystack = `${g.maquinaNombre || ''} ${g.usuarioNombre || ''}`.toLowerCase();
                if (!haystack.includes(texto)) return false;
            }
            return true;
        });
    }, [grupos, filtroMaquinaTexto, filtroEstadoMaquina]);

    // Conteos para los chips de estado (sobre los grupos completos del día).
    const conteosEstado = useMemo(() => {
        let enVivo = 0, pausadas = 0, finalizadas = 0;
        for (const g of grupos) {
            if (g.pausado) pausadas += 1;
            else if (g.enProgreso) enVivo += 1;
            else finalizadas += 1;
        }
        return { total: grupos.length, enVivo, pausadas, finalizadas };
    }, [grupos]);

    useEffect(() => {
        if (gruposFiltrados.length === 0) {
            // Si no hay coincidencias con el filtro, no reseteamos selectedKey
            // (se mantiene la última selección, pero el panel derecho mostrará
            // el estado vacío al no encontrar el grupo entre los filtrados).
            return;
        }
        if (!selectedKey || !gruposFiltrados.find(g => g.key === selectedKey)) {
            setSelectedKey(gruposFiltrados[0].key);
        }
    }, [gruposFiltrados, selectedKey]);

    const grupoActivo = useMemo(
        () => grupos.find(g => g.key === selectedKey) || null,
        [grupos, selectedKey]
    );

    // Reset de filtros al cambiar de máquina/operario.
    useEffect(() => {
        setFiltroActividad('');
        setFiltroOP('');
    }, [selectedKey]);

    // Listas de opciones para los filtros (del grupo activo).
    const actividadesDisponibles = useMemo(() => {
        if (!grupoActivo) return [];
        const set = new Set();
        for (const r of grupoActivo.registros) {
            if (r.actividadNombre) set.add(r.actividadNombre);
        }
        return Array.from(set).sort();
    }, [grupoActivo]);

    const opsDisponibles = useMemo(() => {
        if (!grupoActivo) return [];
        const set = new Set();
        for (const r of grupoActivo.registros) {
            if (r.ordenProduccionNumero) set.add(String(r.ordenProduccionNumero));
        }
        return Array.from(set).sort();
    }, [grupoActivo]);

    // Registros filtrados por actividad / OP (afectan KPIs, resumen y timeline).
    const registrosFiltrados = useMemo(() => {
        if (!grupoActivo) return [];
        return grupoActivo.registros.filter(r => {
            if (filtroActividad && r.actividadNombre !== filtroActividad) return false;
            if (filtroOP && String(r.ordenProduccionNumero || '') !== filtroOP) return false;
            return true;
        });
    }, [grupoActivo, filtroActividad, filtroOP]);

    // Totales recalculados según el filtro actual (con tiempo en vivo).
    const totalesFiltro = useMemo(() => {
        let tiros = 0, desperdicio = 0, duracionSeg = 0;
        const ops = new Set();
        let enProgreso = false;
        let pausado = false;
        for (const r of registrosFiltrados) {
            tiros += Number(r.tiros) || 0;
            desperdicio += Number(r.desperdicio) || 0;
            if (r.ordenProduccionNumero) ops.add(r.ordenProduccionNumero);
            if (isRegistroEnProgreso(r)) enProgreso = true;
            if (isRegistroPausado(r)) pausado = true;
        }
        duracionSeg = computeUnionSeconds(registrosFiltrados, nowMs, selectedDate);
        return { tiros, desperdicio, duracionSeg, ops, enProgreso, pausado };
    }, [registrosFiltrados, nowMs, selectedDate]);

    // Diferencia entre sumar duraciones sueltas vs. unir intervalos (actividades que se cruzan).
    const tiempoSolapadoSeg = useMemo(() => {
        const sumaSueltas = registrosFiltrados.reduce(
            (acc, r) => acc + computeRegistroSeconds(r, nowMs, selectedDate),
            0
        );
        return Math.max(0, sumaSueltas - totalesFiltro.duracionSeg);
    }, [registrosFiltrados, totalesFiltro.duracionSeg, nowMs, selectedDate]);

    /**
     * Rendimiento del día por operario.
     * - Base horaria: solo actividades **productivas** (no descansos ni tiempos
     *   muertos). Usa `actividadEsProductiva` del API; si falta, códigos de respaldo.
     * - Tiros: solo rows que cuentan para meta (los demás suelen tener 0 tiros).
     * - metaDia = (Meta100Porciento/8) * horasProductivas.
     */
    const rendimientoDia = useMemo(() => {
        if (registrosFiltrados.length === 0) return null;
        const meta100 = Number(
            registrosFiltrados.find(r => Number(r.maquinaMeta100Porciento) > 0)?.maquinaMeta100Porciento
            || 0
        );
        if (meta100 <= 0) return null;

        let tirosParaMeta = 0;
        for (const r of registrosFiltrados) {
            if (!cuentaTiempoParaMetaRendimiento(r)) continue;
            tirosParaMeta += Number(r.tiros) || 0;
        }
        const duracionProductivaSeg = computeUnionSeconds(
            registrosFiltrados,
            nowMs,
            selectedDate,
            cuentaTiempoParaMetaRendimiento
        );
        const horasProductivas = duracionProductivaSeg / 3600;
        if (horasProductivas <= 0) return null;
        const metaDia = (meta100 / 8) * horasProductivas;
        if (metaDia <= 0) return null;
        const pct = (tirosParaMeta / metaDia) * 100;
        return {
            pct,
            metaDia: Math.round(metaDia),
            meta100,
            horasProductivas,
            estado: (totalesFiltro.enProgreso || totalesFiltro.pausado) ? 'parcial' : 'final',
        };
    }, [registrosFiltrados, totalesFiltro, nowMs, selectedDate]);

    // Resumen por OP (a partir del filtro)
    const opsResumen = useMemo(() => {
        const m = new Map();
        for (const r of registrosFiltrados) {
            const op = r.ordenProduccionNumero || '(sin OP)';
            if (!m.has(op)) {
                m.set(op, { op, tiros: 0, desperdicio: 0, registros: 0 });
            }
            const a = m.get(op);
            a.tiros += Number(r.tiros) || 0;
            a.desperdicio += Number(r.desperdicio) || 0;
            a.registros += 1;
        }
        return Array.from(m.values()).sort((a, b) => b.tiros - a.tiros);
    }, [registrosFiltrados]);

    const registrosOrdenados = useMemo(() => {
        return [...registrosFiltrados].sort((a, b) => {
            const ai = isRegistroEnProgreso(a) ? 1 : 0;
            const bi = isRegistroEnProgreso(b) ? 1 : 0;
            if (ai !== bi) return bi - ai;
            return String(b.horaInicio || '').localeCompare(String(a.horaInicio || ''));
        });
    }, [registrosFiltrados]);

    const abiertosEnGrupo = useMemo(
        () => registrosFiltrados.filter(isRegistroEnProgreso).length,
        [registrosFiltrados]
    );

    const abrirAjuste = (r) => {
        const enProgreso = isRegistroEnProgreso(r);
        const ahora = new Date();
        const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`;
        setAjusteRegistro(r);
        setAjusteForm({
            horaInicio: (r.horaInicio || '').slice(0, 8),
            horaFin: enProgreso ? horaAhora : (r.horaFin || '').slice(0, 8),
            tiros: String(r.tiros ?? 0),
            desperdicio: String(r.desperdicio ?? 0),
            observaciones: r.observaciones || '',
            actividadId: r.actividadId != null ? String(r.actividadId) : '',
            referenciaOP: r.ordenProduccionNumero ? String(r.ordenProduccionNumero) : '',
            finalizar: enProgreso,
        });
    };

    const guardarAjuste = async () => {
        if (!ajusteRegistro?.id) return;
        try {
            setAjusteGuardando(true);
            if (!ajusteForm.actividadId) {
                if (Platform.OS === 'web') window.alert('Seleccione una actividad');
                return;
            }
            await ajustarTiempo(ajusteRegistro.id, {
                horaInicio: ajusteForm.horaInicio,
                horaFin: ajusteForm.horaFin,
                tiros: parseInt(ajusteForm.tiros, 10) || 0,
                desperdicio: parseInt(ajusteForm.desperdicio, 10) || 0,
                observaciones: ajusteForm.observaciones,
                actividadId: parseInt(ajusteForm.actividadId, 10),
                referenciaOP: ajusteForm.referenciaOP.trim(),
                finalizar: !!ajusteForm.finalizar,
            });
            setAjusteRegistro(null);
            await cargar(true);
        } catch (err) {
            const msg = err?.response?.data?.error || err?.message || 'No se pudo guardar el ajuste';
            if (Platform.OS === 'web') window.alert(msg);
        } finally {
            setAjusteGuardando(false);
        }
    };

    const repararDuplicados = async () => {
        if (!grupoActivo) return;
        const msg = '¿Cerrar los registros duplicados "en curso"? Cada uno terminará cuando empezó el siguiente. El último seguirá activo.';
        if (Platform.OS === 'web' && !window.confirm(msg)) return;
        try {
            setReparando(true);
            const res = await repararProcesosAbiertos(
                selectedDate,
                grupoActivo.maquinaId,
                grupoActivo.usuarioId
            );
            if (Platform.OS === 'web') window.alert(res?.data?.message || 'Reparación completada');
            await cargar(true);
        } catch (err) {
            const errMsg = err?.response?.data?.error || err?.message || 'Error al reparar';
            if (Platform.OS === 'web') window.alert(errMsg);
        } finally {
            setReparando(false);
        }
    };

    const filtrosActivos = !!(filtroActividad || filtroOP);

    // Date helpers
    const changeDay = (offset) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setSelectedDate(toDateStr(d));
    };
    const goToToday = () => setSelectedDate(toDateStr(new Date()));
    const isToday = selectedDate === toDateStr(new Date());
    const displayDate = (() => {
        const d = new Date(selectedDate + 'T12:00:00');
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
    })();

    const s = makeStyles(isDarkMode, colors);

    return (
        <View style={s.container}>
            {/* Top bar */}
            <View style={s.topBar}>
                <View style={s.topLeft}>
                    <MaterialCommunityIcons name="history" size={22} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                    <View>
                        <Text style={s.title}>Explorador de Producción</Text>
                        <Text style={s.subtitle}>
                            {results.length} registros · {grupos.length} máquina(s) en operación
                        </Text>
                    </View>
                </View>

                <View style={s.dateNav}>
                    <TouchableOpacity style={s.dateBtn} onPress={() => changeDay(-1)}>
                        <MaterialCommunityIcons name="chevron-left" size={20} color={isDarkMode ? '#e2e8f0' : '#1a202c'} />
                    </TouchableOpacity>

                    <View style={s.dateCenter}>
                        <Text style={s.dateLabel}>{displayDate}</Text>
                        {Platform.OS === 'web' ? (
                            // @ts-ignore
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    padding: 6,
                                    marginTop: 4,
                                    borderRadius: 6,
                                    border: `1px solid ${isDarkMode ? '#374151' : '#cbd5e0'}`,
                                    backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
                                    color: isDarkMode ? '#e2e8f0' : '#1a202c',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                }}
                            />
                        ) : null}
                    </View>

                    <TouchableOpacity style={s.dateBtn} onPress={() => changeDay(1)}>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? '#e2e8f0' : '#1a202c'} />
                    </TouchableOpacity>

                    {!isToday && (
                        <TouchableOpacity style={s.todayBtn} onPress={goToToday}>
                            <MaterialCommunityIcons name="calendar-today" size={14} color="#fff" />
                            <Text style={s.todayBtnText}>Hoy</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={s.refreshBtn} onPress={() => cargar(false)}>
                        <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
                        <Text style={s.refreshBtnText}>Actualizar</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={s.loadingBox}>
                    <ActivityIndicator size="large" color={isDarkMode ? '#90cdf4' : '#3182ce'} />
                    <Text style={s.loadingText}>Cargando producción del día…</Text>
                </View>
            ) : grupos.length === 0 ? (
                <View style={s.emptyBox}>
                    <MaterialCommunityIcons name="cog-off-outline" size={56} color={colors.subText || '#a0aec0'} />
                    <Text style={s.emptyTitle}>Sin actividad registrada</Text>
                    <Text style={s.emptyDesc}>No se encontraron tiempos de proceso para esta fecha.</Text>
                </View>
            ) : (
                <View style={[s.body, { flexDirection: isWide ? 'row' : 'column' }]}>
                    {/* Panel izquierdo: máquinas */}
                    <View style={[s.leftPanel, !isWide && { width: '100%', maxHeight: 380 }]}>
                        <View style={s.leftHeader}>
                            <MaterialCommunityIcons name="cog" size={16} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                            <Text style={s.leftHeaderText}>Máquinas en operación</Text>
                        </View>

                        {/* Buscador + chips de estado */}
                        <View style={s.machineFiltersBox}>
                            <View style={s.searchBox}>
                                <MaterialCommunityIcons
                                    name="magnify"
                                    size={16}
                                    color={isDarkMode ? '#a0aec0' : '#718096'}
                                />
                                <TextInput
                                    style={s.searchInput}
                                    placeholder="Buscar máquina u operario"
                                    placeholderTextColor={isDarkMode ? '#718096' : '#a0aec0'}
                                    value={filtroMaquinaTexto}
                                    onChangeText={setFiltroMaquinaTexto}
                                />
                                {filtroMaquinaTexto.length > 0 && (
                                    <TouchableOpacity onPress={() => setFiltroMaquinaTexto('')}>
                                        <MaterialCommunityIcons
                                            name="close-circle"
                                            size={16}
                                            color={isDarkMode ? '#a0aec0' : '#718096'}
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={s.estadoChipsRow}>
                                {[
                                    { key: 'todas', label: 'Todas', count: conteosEstado.total },
                                    { key: 'en-vivo', label: 'En vivo', count: conteosEstado.enVivo },
                                    { key: 'pausadas', label: 'Pausadas', count: conteosEstado.pausadas },
                                    { key: 'finalizadas', label: 'Finalizadas', count: conteosEstado.finalizadas },
                                ].map(opt => {
                                    const active = filtroEstadoMaquina === opt.key;
                                    return (
                                        <TouchableOpacity
                                            key={opt.key}
                                            style={[s.estadoChip, active && s.estadoChipActive]}
                                            onPress={() => setFiltroEstadoMaquina(opt.key)}
                                        >
                                            <Text style={[s.estadoChipText, active && s.estadoChipTextActive]}>
                                                {opt.label} · {opt.count}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 8 }}>
                            {gruposFiltrados.length === 0 && (
                                <Text style={s.noMatchText}>
                                    Sin máquinas que coincidan con el filtro.
                                </Text>
                            )}
                            {gruposFiltrados.map(g => {
                                const isSelected = g.key === selectedKey;
                                const wastePct = (g.tiros + g.desperdicio) === 0
                                    ? 0
                                    : (g.desperdicio * 100) / (g.tiros + g.desperdicio);
                                return (
                                    <TouchableOpacity
                                        key={g.key}
                                        style={[s.machineCard, isSelected && s.machineCardSelected]}
                                        onPress={() => setSelectedKey(g.key)}
                                    >
                                        <View style={s.machineCardHeader}>
                                            <Text style={[s.machineName, isSelected && s.machineNameSelected]}>{g.maquinaNombre}</Text>
                                            {g.pausado ? (
                                                <View style={s.pausedBadge}>
                                                    <Text style={s.pausedBadgeText}>PAUSADO</Text>
                                                </View>
                                            ) : g.enProgreso && (
                                                <View style={s.liveBadge}>
                                                    <View style={s.livePulse} />
                                                    <Text style={s.liveBadgeText}>EN VIVO</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={s.operatorName}>
                                            <MaterialCommunityIcons name="account" size={12} color={colors.subText || '#a0aec0'} /> {g.usuarioNombre}
                                        </Text>
                                        {g.registroVivo && (
                                            <Text style={s.actividadVivo} numberOfLines={1}>
                                                Ahora: {g.registroVivo.actividadCodigo ? `${g.registroVivo.actividadCodigo} — ` : ''}
                                                {g.registroVivo.actividadNombre || 'Actividad'}
                                                {g.registroVivo.ordenProduccionNumero ? ` · OP ${g.registroVivo.ordenProduccionNumero}` : ''}
                                            </Text>
                                        )}
                                        <View style={s.machineMetrics}>
                                            <View style={s.metricItem}>
                                                <Text style={s.metricLabel}>TIROS</Text>
                                                <Text style={s.metricValueOk}>{g.tiros.toLocaleString()}</Text>
                                            </View>
                                            <View style={s.metricItem}>
                                                <Text style={s.metricLabel}>DESP</Text>
                                                <Text style={s.metricValueBad}>{g.desperdicio.toLocaleString()}</Text>
                                            </View>
                                            <View style={s.metricItem}>
                                                <Text style={s.metricLabel}>OPs</Text>
                                                <Text style={s.metricValueInfo}>{g.ops.size}</Text>
                                            </View>
                                        </View>
                                        <View style={s.miniBarBg}>
                                            <View style={[s.miniBarFill, { width: `${Math.min(100, 100 - wastePct)}%`, backgroundColor: wastePct > 10 ? '#e53e3e' : '#38a169' }]} />
                                        </View>
                                        <Text style={s.miniBarLabel}>
                                            {wastePct.toFixed(1)}% desperdicio · {formatSeconds(g.duracionSeg)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Panel derecho: detalle */}
                    <ScrollView style={[s.rightPanel]} contentContainerStyle={{ padding: 14 }}>
                        {grupoActivo ? (
                            <>
                                {/* Header de la máquina seleccionada */}
                                <View style={s.detailHeader}>
                                    <View>
                                        <Text style={s.detailMachine}>{grupoActivo.maquinaNombre}</Text>
                                        <Text style={s.detailOperator}>
                                            <MaterialCommunityIcons name="account" size={14} color={colors.subText || '#a0aec0'} /> {grupoActivo.usuarioNombre}
                                        </Text>
                                    </View>
                                    {grupoActivo.pausado ? (
                                        <View style={s.pausedBadgeBig}>
                                            <Text style={s.pausedBadgeText}>PROCESO EN PAUSA</Text>
                                        </View>
                                    ) : grupoActivo.enProgreso && (
                                        <View style={s.liveBadgeBig}>
                                            <View style={s.livePulse} />
                                            <Text style={s.liveBadgeText}>OPERANDO AHORA</Text>
                                        </View>
                                    )}
                                </View>

                                {/* KPIs (se recalculan con el filtro activo) */}
                                <View style={s.kpiRow}>
                                    <KpiCard
                                        icon="clock-outline"
                                        label={filtrosActivos ? 'Tiempo (filtrado)' : 'Tiempo en máquina'}
                                        value={formatSeconds(totalesFiltro.duracionSeg)}
                                        color="#3182ce"
                                        isDarkMode={isDarkMode}
                                        sub={tiempoSolapadoSeg > 60
                                            ? `Sin doble conteo (${formatSeconds(tiempoSolapadoSeg)} de actividades cruzadas)`
                                            : 'Desde 1er inicio hasta último fin'}
                                    />
                                    <KpiCard
                                        icon="target"
                                        label={filtrosActivos ? 'Tiros (filtrado)' : 'Tiros totales'}
                                        value={totalesFiltro.tiros.toLocaleString()}
                                        color="#38a169"
                                        isDarkMode={isDarkMode}
                                    />
                                    <KpiCard
                                        icon="trash-can-outline"
                                        label={filtrosActivos ? 'Desp. (filtrado)' : 'Desperdicio'}
                                        value={totalesFiltro.desperdicio.toLocaleString()}
                                        color="#e53e3e"
                                        isDarkMode={isDarkMode}
                                    />
                                    <KpiCard
                                        icon="package-variant"
                                        label={filtrosActivos ? 'OPs (filtrado)' : 'OPs trabajadas'}
                                        value={String(totalesFiltro.ops.size)}
                                        color="#805ad5"
                                        isDarkMode={isDarkMode}
                                    />
                                    {rendimientoDia && (
                                        <KpiCard
                                            icon="speedometer"
                                            label={
                                                rendimientoDia.estado === 'final'
                                                    ? 'Rendimiento del día'
                                                    : 'Rendimiento (parcial)'
                                            }
                                            value={`${rendimientoDia.pct.toFixed(1)}%`}
                                            color={
                                                rendimientoDia.pct >= 100 ? '#2f855a'
                                                : rendimientoDia.pct >= 75 ? '#b7791f'
                                                : '#c53030'
                                            }
                                            isDarkMode={isDarkMode}
                                            sub={`Meta ${rendimientoDia.metaDia.toLocaleString()} tiros · ${rendimientoDia.horasProductivas.toFixed(2)} h prod.`}
                                        />
                                    )}
                                </View>

                                {/* Filtros por Actividad / OP */}
                                <View style={s.filtersCard}>
                                    <View style={s.filtersHeader}>
                                        <MaterialCommunityIcons name="filter-variant" size={16} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                                        <Text style={s.sectionTitle}>Filtros</Text>
                                        {filtrosActivos && (
                                            <TouchableOpacity
                                                style={s.clearFiltersBtn}
                                                onPress={() => { setFiltroActividad(''); setFiltroOP(''); }}
                                            >
                                                <MaterialCommunityIcons name="close" size={12} color="#fff" />
                                                <Text style={s.clearFiltersText}>Limpiar</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={s.filtersRow}>
                                        <View style={s.filterField}>
                                            <Text style={s.filterLabel}>Actividad</Text>
                                            <HtmlSelect
                                                value={filtroActividad}
                                                onChange={setFiltroActividad}
                                                isDarkMode={isDarkMode}
                                                options={[
                                                    { label: `Todas (${actividadesDisponibles.length})`, value: '' },
                                                    ...actividadesDisponibles.map(a => ({ label: a, value: a })),
                                                ]}
                                            />
                                        </View>
                                        <View style={s.filterField}>
                                            <Text style={s.filterLabel}>OP</Text>
                                            <HtmlSelect
                                                value={filtroOP}
                                                onChange={setFiltroOP}
                                                isDarkMode={isDarkMode}
                                                options={[
                                                    { label: `Todas (${opsDisponibles.length})`, value: '' },
                                                    ...opsDisponibles.map(op => ({ label: `OP ${op}`, value: op })),
                                                ]}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Resumen por OP */}
                                {opsResumen.length > 0 && (
                                    <View style={s.sectionCard}>
                                        <View style={s.sectionTitleRow}>
                                            <MaterialCommunityIcons name="package-variant-closed" size={16} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                                            <Text style={s.sectionTitle}>Resumen por OP</Text>
                                        </View>
                                        <View style={s.opTableHeader}>
                                            <Text style={[s.opCol, { flex: 1.2 }]}>OP</Text>
                                            <Text style={[s.opCol, { flex: 0.6, textAlign: 'right' }]}>Registros</Text>
                                            <Text style={[s.opCol, { flex: 0.7, textAlign: 'right' }]}>Tiros</Text>
                                            <Text style={[s.opCol, { flex: 0.7, textAlign: 'right' }]}>Desperdicio</Text>
                                        </View>
                                        {opsResumen.map((row) => (
                                            <View key={row.op} style={s.opTableRow}>
                                                <Text style={[s.opCell, { flex: 1.2, fontWeight: '700' }]}>{row.op}</Text>
                                                <Text style={[s.opCell, { flex: 0.6, textAlign: 'right' }]}>{row.registros}</Text>
                                                <Text style={[s.opCell, { flex: 0.7, textAlign: 'right', color: '#38a169', fontWeight: '700' }]}>{row.tiros.toLocaleString()}</Text>
                                                <Text style={[s.opCell, { flex: 0.7, textAlign: 'right', color: '#e53e3e', fontWeight: '700' }]}>{row.desperdicio.toLocaleString()}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Timeline de actividades */}
                                <View style={s.sectionCard}>
                                    <View style={s.sectionTitleRow}>
                                        <MaterialCommunityIcons name="timeline-clock-outline" size={16} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                                        <Text style={s.sectionTitle}>Actividades del operario</Text>
                                        <Text style={s.sectionTitleHint}>{registrosOrdenados.length} registros</Text>
                                    </View>
                                    {abiertosEnGrupo > 1 && (
                                        <View style={s.duplicadosBanner}>
                                            <Text style={s.duplicadosBannerText}>
                                                ⚠️ Hay {abiertosEnGrupo} actividades &quot;en curso&quot; al mismo tiempo (no debería ocurrir).
                                            </Text>
                                            <TouchableOpacity
                                                style={s.duplicadosBannerBtn}
                                                onPress={repararDuplicados}
                                                disabled={reparando}
                                            >
                                                <Text style={s.duplicadosBannerBtnText}>
                                                    {reparando ? 'Reparando…' : 'Reparar automáticamente'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {registrosOrdenados.map((r, idx) => (
                                        <ActivityRow
                                            key={r.id || idx}
                                            r={r}
                                            isDarkMode={isDarkMode}
                                            colors={colors}
                                            onAjustar={() => abrirAjuste(r)}
                                            calidadInfo={calidadIndex[normalizarOpKey(r.ordenProduccionNumero)]}
                                            onVerCalidad={abrirCalidad}
                                        />
                                    ))}
                                </View>
                            </>
                        ) : (
                            <Text style={s.emptyDesc}>Selecciona una máquina del panel izquierdo.</Text>
                        )}
                    </ScrollView>
                </View>
            )}
            {ajusteRegistro && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setAjusteRegistro(null)}>
                    <View style={s.modalOverlay}>
                        <View style={[s.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', maxHeight: '90vh' }]}>
                            <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={[s.modalTitle, { color: isDarkMode ? '#e2e8f0' : '#1a202c' }]}>
                                Ajustar registro
                            </Text>
                            <Text style={[s.modalSub, { color: isDarkMode ? '#a0aec0' : '#4a5568' }]}>
                                Corrección administrativa. ID {ajusteRegistro.id}
                                {isRegistroEnProgreso(ajusteRegistro) ? ' · En curso' : ''}
                            </Text>

                            <Text style={s.modalLabel}>Actividad (código)</Text>
                            <HtmlSelect
                                value={ajusteForm.actividadId}
                                onChange={(v) => setAjusteForm(p => ({ ...p, actividadId: v }))}
                                isDarkMode={isDarkMode}
                                options={[
                                    { value: '', label: 'Seleccione actividad…' },
                                    ...catalogoActividades.map((a) => ({
                                        value: String(a.id),
                                        label: `${a.codigo || '??'} — ${a.nombre || 'Sin nombre'}`,
                                    })),
                                ]}
                            />

                            <Text style={[s.modalLabel, { marginTop: 10 }]}>Orden de producción (OP)</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="text"
                                    list="historial-op-suggestions"
                                    value={ajusteForm.referenciaOP}
                                    onChange={(e) => setAjusteForm(p => ({ ...p, referenciaOP: e.target.value }))}
                                    placeholder="Ej: 7669, 460, 7619"
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        marginBottom: 10,
                                        borderRadius: 8,
                                        border: `1px solid ${isDarkMode ? '#374151' : '#cbd5e0'}`,
                                        backgroundColor: isDarkMode ? '#0b1220' : '#ffffff',
                                        color: isDarkMode ? '#e2e8f0' : '#1a202c',
                                    }}
                                />
                            ) : (
                                <TextInput
                                    style={s.modalInput}
                                    value={ajusteForm.referenciaOP}
                                    onChangeText={(t) => setAjusteForm(p => ({ ...p, referenciaOP: t }))}
                                    placeholder="Número de OP"
                                />
                            )}
                            {Platform.OS === 'web' && (
                                <datalist id="historial-op-suggestions">
                                    {opsDisponibles.map((op) => (
                                        <option key={op} value={op} />
                                    ))}
                                </datalist>
                            )}

                            <Text style={s.modalLabel}>Hora inicio</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="time"
                                    step="1"
                                    value={(ajusteForm.horaInicio || '').slice(0, 8)}
                                    onChange={(e) => setAjusteForm(p => ({ ...p, horaInicio: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value }))}
                                    style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 8, border: '1px solid #cbd5e0' }}
                                />
                            ) : (
                                <TextInput style={s.modalInput} value={ajusteForm.horaInicio} onChangeText={(t) => setAjusteForm(p => ({ ...p, horaInicio: t }))} />
                            )}

                            <Text style={s.modalLabel}>Hora fin</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="time"
                                    step="1"
                                    value={(ajusteForm.horaFin || '').slice(0, 8)}
                                    onChange={(e) => setAjusteForm(p => ({ ...p, horaFin: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value }))}
                                    style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 8, border: '1px solid #cbd5e0' }}
                                />
                            ) : (
                                <TextInput style={s.modalInput} value={ajusteForm.horaFin} onChangeText={(t) => setAjusteForm(p => ({ ...p, horaFin: t }))} />
                            )}

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.modalLabel}>Tiros</Text>
                                    <TextInput
                                        style={s.modalInput}
                                        value={ajusteForm.tiros}
                                        onChangeText={(t) => setAjusteForm(p => ({ ...p, tiros: t.replace(/[^0-9]/g, '') }))}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.modalLabel}>Desperdicio</Text>
                                    <TextInput
                                        style={s.modalInput}
                                        value={ajusteForm.desperdicio}
                                        onChangeText={(t) => setAjusteForm(p => ({ ...p, desperdicio: t.replace(/[^0-9]/g, '') }))}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <Text style={s.modalLabel}>Observaciones</Text>
                            <TextInput
                                style={[s.modalInput, { minHeight: 60 }]}
                                value={ajusteForm.observaciones}
                                onChangeText={(t) => setAjusteForm(p => ({ ...p, observaciones: t }))}
                                multiline
                            />

                            {isRegistroEnProgreso(ajusteRegistro) && (
                                <TouchableOpacity
                                    style={s.finalizarCheckRow}
                                    onPress={() => setAjusteForm(p => ({ ...p, finalizar: !p.finalizar }))}
                                >
                                    <MaterialCommunityIcons
                                        name={ajusteForm.finalizar ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                        size={22}
                                        color="#2563eb"
                                    />
                                    <Text style={{ marginLeft: 8, color: isDarkMode ? '#e2e8f0' : '#1a202c' }}>
                                        Finalizar este registro (dejar de contar como en curso)
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <View style={s.modalActions}>
                                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setAjusteRegistro(null)}>
                                    <Text style={s.modalBtnCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.modalBtnSave} onPress={guardarAjuste} disabled={ajusteGuardando}>
                                    {ajusteGuardando ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={s.modalBtnSaveText}>Guardar ajuste</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
            {calidadModal && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setCalidadModal(null)}>
                    <View style={s.modalOverlay}>
                        <View style={[s.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', maxHeight: '90vh', maxWidth: 640 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={[s.modalTitle, { color: isDarkMode ? '#e2e8f0' : '#1a202c', flex: 1, marginBottom: 0 }]}>
                                    {calidadModal.tipo === 'planta' ? 'Calidad de procesos (planta)' : 'Calidad externa (taller)'} · OP {calidadModal.op}
                                </Text>
                                <TouchableOpacity onPress={() => setCalidadModal(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <MaterialCommunityIcons name="close" size={22} color={isDarkMode ? '#a0aec0' : '#4a5568'} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {calidadModal.ids.length > 1 && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                        {calidadModal.ids.map((id, i) => (
                                            <TouchableOpacity
                                                key={id}
                                                style={{
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 5,
                                                    borderRadius: 8,
                                                    backgroundColor: calidadDetalle?.id === id ? '#2563eb' : (isDarkMode ? '#1f2937' : '#e2e8f0'),
                                                }}
                                                onPress={() => cargarDetalleCalidad(calidadModal.tipo, id)}
                                            >
                                                <Text style={{ color: calidadDetalle?.id === id ? '#fff' : (isDarkMode ? '#cbd5e0' : '#334155'), fontSize: 12, fontWeight: '700' }}>
                                                    Revisión {i + 1}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                                {calidadDetalleLoading && <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 30 }} />}
                                {!calidadDetalleLoading && !calidadDetalle && calidadModal.ids.length > 1 && (
                                    <Text style={{ color: isDarkMode ? '#a0aec0' : '#4a5568', marginVertical: 20, textAlign: 'center' }}>
                                        Seleccione una revisión para ver el detalle.
                                    </Text>
                                )}
                                {!calidadDetalleLoading && calidadDetalle && calidadModal.tipo === 'planta' && (
                                    <CalidadPlantaDetalle d={calidadDetalle} isDarkMode={isDarkMode} onFoto={setCalidadImagenAmpliada} />
                                )}
                                {!calidadDetalleLoading && calidadDetalle && calidadModal.tipo === 'externa' && (
                                    <CalidadExternaDetalle d={calidadDetalle} isDarkMode={isDarkMode} onFoto={setCalidadImagenAmpliada} />
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
            {calidadImagenAmpliada && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setCalidadImagenAmpliada(null)}>
                    <TouchableOpacity
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}
                        activeOpacity={1}
                        onPress={() => setCalidadImagenAmpliada(null)}
                    >
                        <Image source={{ uri: calidadImagenAmpliada }} style={{ width: '92%', height: '82%' }} resizeMode="contain" />
                        <TouchableOpacity
                            style={{ marginTop: 12, backgroundColor: '#ffffff22', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 }}
                            onPress={() => setCalidadImagenAmpliada(null)}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700' }}>✕ Cerrar</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
};

/* ==================== Detalle de encuestas de calidad ==================== */

function CalidadDetalleFila({ k, v, isDarkMode, color }) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#1f2937' : '#f1f5f9' }}>
            <Text style={{ color: isDarkMode ? '#a0aec0' : '#64748b', fontSize: 12, fontWeight: '600' }}>{k}</Text>
            <Text style={{ color: color || (isDarkMode ? '#e2e8f0' : '#1a202c'), fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
        </View>
    );
}

function CalidadSeccionTitulo({ children, isDarkMode }) {
    return (
        <Text style={{ color: isDarkMode ? '#93c5fd' : '#2563eb', fontWeight: '800', fontSize: 13, marginTop: 14, marginBottom: 6 }}>
            {children}
        </Text>
    );
}

function CalidadFotos({ rutas, onFoto }) {
    const urls = String(rutas || '').split(/\|\|\||\|\||;/).map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) return null;
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {urls.map((u, i) => {
                const full = buildFotoUrl(u);
                return (
                    <TouchableOpacity key={i} onPress={() => onFoto(full)}>
                        <Image source={{ uri: full }} style={{ width: 110, height: 110, borderRadius: 8, backgroundColor: '#00000022' }} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

function CalidadPlantaDetalle({ d, isDarkMode, onFoto }) {
    const cumple = (b) => (b ? 'SÍ CUMPLE' : 'NO CUMPLE');
    const cumpleColor = (b) => (b ? '#38a169' : '#e53e3e');
    return (
        <View>
            <CalidadSeccionTitulo isDarkMode={isDarkMode}>Información general</CalidadSeccionTitulo>
            <CalidadDetalleFila k="Fecha" v={d.fechaCreacion ? new Date(d.fechaCreacion).toLocaleString() : '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Operario" v={d.operario || '—'} isDarkMode={isDarkMode} />
            {!!d.auxiliar && <CalidadDetalleFila k="Auxiliar" v={d.auxiliar} isDarkMode={isDarkMode} />}
            <CalidadDetalleFila k="Máquina" v={d.maquina || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Proceso" v={d.proceso || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="OP" v={d.ordenProduccion || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Cant. a producir" v={String(d.cantidadProducir ?? '—')} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Cant. evaluada" v={String(d.cantidadEvaluada ?? '—')} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Estado" v={d.estadoProceso || '—'} color={d.estadoProceso === 'Terminado' ? '#38a169' : '#d69e2e'} isDarkMode={isDarkMode} />

            <CalidadSeccionTitulo isDarkMode={isDarkMode}>Verificación</CalidadSeccionTitulo>
            <CalidadDetalleFila k="Ficha técnica" v={cumple(d.tieneFichaTecnica)} color={cumpleColor(d.tieneFichaTecnica)} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Registro de formatos" v={cumple(d.correctoRegistroFormatos)} color={cumpleColor(d.correctoRegistroFormatos)} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Aprobación de arranque" v={cumple(d.aprobacionArranque)} color={cumpleColor(d.aprobacionArranque)} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Muestra física" v={d.contieneMuestraFisica ? 'SÍ' : 'NO'} isDarkMode={isDarkMode} />

            {!!d.observacion && (
                <>
                    <CalidadSeccionTitulo isDarkMode={isDarkMode}>Observaciones</CalidadSeccionTitulo>
                    <Text style={{ color: isDarkMode ? '#e2e8f0' : '#1a202c', fontStyle: 'italic', fontSize: 12 }}>{d.observacion}</Text>
                </>
            )}

            <CalidadSeccionTitulo isDarkMode={isDarkMode}>Novedades y hallazgos</CalidadSeccionTitulo>
            {(d.novedades || []).length === 0 && (
                <Text style={{ color: isDarkMode ? '#a0aec0' : '#64748b', fontSize: 12 }}>Sin novedades registradas.</Text>
            )}
            {(d.novedades || []).map((nov, i) => (
                <View key={nov.id || i} style={{ borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#e2e8f0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#e53e3e', fontWeight: '800', fontSize: 12 }}>{nov.tipoNovedad}</Text>
                        {!!nov.cantidadDefectuosa && (
                            <Text style={{ color: '#be123c', fontSize: 11, fontWeight: '700' }}>Cant: {nov.cantidadDefectuosa}</Text>
                        )}
                    </View>
                    {!!nov.descripcion && (
                        <Text style={{ color: isDarkMode ? '#cbd5e0' : '#334155', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{nov.descripcion}</Text>
                    )}
                    <CalidadFotos rutas={nov.fotoUrl} onFoto={onFoto} />
                </View>
            ))}
        </View>
    );
}

function CalidadExternaDetalle({ d, isDarkMode, onFoto }) {
    const siNo = (b) => (b ? 'SÍ' : 'NO');
    const hallazgos = [
        ['Variación de tono', d.variacionTono, d.fotoVariacionTono],
        ['Quebrado / arrugado', d.quebradoArrugado, d.fotoQuebradoArrugado],
        ['Esquina defectuosa', d.esquinaDefectuosa, d.fotoEsquinaDefectuosa],
        ['Presencia de pestañas', d.presenciaPestanas, d.fotoPresenciaPestanas],
        ['Desgaste de impresión', d.desgasteImpresion, d.fotoDesgasteImpresion],
        ['Manchas', d.manchas, d.fotoManchas],
        ['Reserva de pega', d.reservaPega, d.fotoReservaPega],
        ['Grafado roto', d.grafadoRoto, d.fotoGrafadoRoto],
        ['Novedad BPM', d.novedadBPM, d.fotoNovedadBPM],
        ['Usa cofia', d.usaCofia, d.fotoUsaCofia],
        ['Insumos pendientes', d.insumosPendientes, d.fotoInsumosPendientes],
    ];
    return (
        <View>
            <CalidadSeccionTitulo isDarkMode={isDarkMode}>Información general</CalidadSeccionTitulo>
            <CalidadDetalleFila k="Fecha" v={d.fechaCreacion ? new Date(d.fechaCreacion).toLocaleString() : '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Taller" v={d.tallerNombre || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Inspector" v={d.inspector || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="OP" v={d.ordenProduccion || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Remisión" v={d.numeroRemision || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Cant. a producir" v={String(d.cantidadProducir ?? '—')} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Cant. evaluada" v={String(d.cantidadEvaluada ?? '—')} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Estado" v={d.estadoProceso || '—'} color={d.estadoProceso === 'Terminado' ? '#38a169' : '#d69e2e'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Hora llegada" v={d.horaLlegada || '—'} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Hora salida" v={d.horaSalida || '—'} isDarkMode={isDarkMode} />

            <CalidadSeccionTitulo isDarkMode={isDarkMode}>Documentación y condiciones</CalidadSeccionTitulo>
            <CalidadDetalleFila k="Tiene muestra" v={siNo(d.tieneMuestra)} isDarkMode={isDarkMode} />
            {!!d.tipoProducto && <CalidadDetalleFila k="Tipo de producto" v={d.tipoProducto} isDarkMode={isDarkMode} />}
            <CalidadDetalleFila k="Conoce forma de empaque" v={siNo(d.conoceFormaEmpaque)} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Tiene remisión" v={siNo(d.tieneRemision)} isDarkMode={isDarkMode} />
            <CalidadDetalleFila k="Insumos completos" v={siNo(d.tieneInsumosCompletos)} isDarkMode={isDarkMode} />
            {d.insumosPendientes && (
                <CalidadDetalleFila k="Insumos pendientes" v={d.tipoInsumosPendientes || 'SÍ'} color="#e53e3e" isDarkMode={isDarkMode} />
            )}

            <CalidadSeccionTitulo isDarkMode={isDarkMode}>Hallazgos de inspección</CalidadSeccionTitulo>
            {hallazgos.map(([label, valor, fotos], i) => (
                <View key={i} style={{ marginBottom: 6 }}>
                    <CalidadDetalleFila k={label} v={siNo(valor)} color={valor ? '#e53e3e' : '#38a169'} isDarkMode={isDarkMode} />
                    {valor ? <CalidadFotos rutas={fotos} onFoto={onFoto} /> : null}
                </View>
            ))}

            {!!d.observaciones && (
                <>
                    <CalidadSeccionTitulo isDarkMode={isDarkMode}>Observaciones</CalidadSeccionTitulo>
                    <Text style={{ color: isDarkMode ? '#e2e8f0' : '#1a202c', fontStyle: 'italic', fontSize: 12 }}>{d.observaciones}</Text>
                </>
            )}
        </View>
    );
}

function HtmlSelect({ value, onChange, options, isDarkMode }) {
    if (Platform.OS === 'web') {
        const bg = isDarkMode ? '#0b1220' : '#ffffff';
        const fg = isDarkMode ? '#e2e8f0' : '#1a202c';
        const border = isDarkMode ? '#374151' : '#cbd5e0';
        return (
            // @ts-ignore - select HTML nativo
            <select
                value={String(value ?? '')}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    height: 36,
                    paddingLeft: 8,
                    paddingRight: 8,
                    borderRadius: 6,
                    border: `1px solid ${border}`,
                    backgroundColor: bg,
                    color: fg,
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                }}
            >
                {options.map(o => (
                    // @ts-ignore
                    <option key={String(o.value)} value={String(o.value)} style={{ backgroundColor: bg, color: fg }}>
                        {o.label}
                    </option>
                ))}
            </select>
        );
    }
    return (
        <View style={{ borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#cbd5e0', borderRadius: 6, padding: 8 }}>
            <Text style={{ color: isDarkMode ? '#e2e8f0' : '#1a202c' }}>
                {options.find(o => String(o.value) === String(value))?.label || '—'}
            </Text>
        </View>
    );
}

function KpiCard({ icon, label, value, color, isDarkMode, sub }) {
    return (
        <View style={[kpiStyles.card, { borderColor: isDarkMode ? '#1f2937' : '#e2e8f0', backgroundColor: isDarkMode ? '#111827' : '#ffffff' }]}>
            <View style={[kpiStyles.iconCircle, { backgroundColor: color + '22' }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[kpiStyles.label, { color: isDarkMode ? '#a0aec0' : '#4a5568' }]}>{label}</Text>
                <Text style={[kpiStyles.value, { color: isDarkMode ? '#e2e8f0' : '#1a202c' }]}>{value}</Text>
                {sub ? (
                    <Text style={[kpiStyles.sub, { color: isDarkMode ? '#718096' : '#718096' }]} numberOfLines={2}>{sub}</Text>
                ) : null}
            </View>
        </View>
    );
}

function ActivityRow({ r, isDarkMode, colors, onAjustar, calidadInfo, onVerCalidad }) {
    const enProgreso = isRegistroEnProgreso(r);
    const pausado = isRegistroPausado(r);
    const code = r.actividadCodigo ? `${r.actividadCodigo} · ` : '';
    const subAct = r.subCodigoActividad;
    const subDet = r.subCodigoDetalle;
    const hasObs = r.observaciones && String(r.observaciones).trim().length > 0;

    // Color principal: pausado = naranja, en curso = azul, finalizado = neutro.
    const accentColor = pausado ? '#dd6b20' : (enProgreso ? '#3182ce' : null);

    // Sin contador en vivo en el listado (el usuario solicitó no mostrar el tiempo corriendo).
    const estadoDuracionLabel = pausado ? 'Pausado' : 'En curso';

    const topLabel = pausado ? 'PAUSADO' : (enProgreso ? 'en curso' : r.horaFin);

    return (
        <View style={[
            actStyles.row,
            { borderColor: isDarkMode ? '#1f2937' : '#e2e8f0' },
            enProgreso && { borderLeftWidth: 3, borderLeftColor: accentColor || '#3182ce' },
        ]}>
            <View style={actStyles.timeBox}>
                {/* Hora FIN arriba; flecha hacia ARRIBA; Hora INICIO abajo. */}
                {enProgreso ? (
                    <Text style={[actStyles.timeText, { color: accentColor, fontStyle: 'italic', fontWeight: pausado ? '700' : 'normal' }]}>{topLabel}</Text>
                ) : (
                    <Text style={[actStyles.timeText, { color: isDarkMode ? '#e2e8f0' : '#1a202c' }]}>{r.horaFin}</Text>
                )}
                <MaterialCommunityIcons name="arrow-up" size={12} color={colors?.subText || '#a0aec0'} />
                <Text style={[actStyles.timeText, { color: isDarkMode ? '#e2e8f0' : '#1a202c' }]}>{r.horaInicio}</Text>
                <Text style={[actStyles.duracion, { color: enProgreso ? accentColor : (isDarkMode ? '#a0aec0' : '#4a5568') }]}>
                    {enProgreso ? estadoDuracionLabel : (r.duracion || '—')}
                </Text>
            </View>

            <View style={actStyles.body}>
                <View style={actStyles.headerRow}>
                    <Text style={[actStyles.actividad, { color: '#3182ce', flex: 1 }]}>
                        {code}{r.actividadNombre || 'Actividad'}
                    </Text>
                    {!!r.ordenProduccionNumero && (
                        <View style={actStyles.opChip}>
                            <Text style={actStyles.opChipText}>OP {r.ordenProduccionNumero}</Text>
                        </View>
                    )}
                    {!!(calidadInfo?.planta?.length) && (
                        <TouchableOpacity
                            style={[actStyles.calidadBtn, { backgroundColor: '#7C3AED22', borderColor: '#7C3AED' }]}
                            onPress={() => onVerCalidad?.('planta', calidadInfo.planta, r.ordenProduccionNumero)}
                        >
                            <MaterialCommunityIcons name="clipboard-check-outline" size={13} color="#8B5CF6" />
                            <Text style={[actStyles.calidadBtnText, { color: '#8B5CF6' }]}>
                                Calidad{calidadInfo.planta.length > 1 ? ` (${calidadInfo.planta.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {!!(calidadInfo?.externa?.length) && (
                        <TouchableOpacity
                            style={[actStyles.calidadBtn, { backgroundColor: '#0D948822', borderColor: '#0D9488' }]}
                            onPress={() => onVerCalidad?.('externa', calidadInfo.externa, r.ordenProduccionNumero)}
                        >
                            <MaterialCommunityIcons name="factory" size={13} color="#14B8A6" />
                            <Text style={[actStyles.calidadBtnText, { color: '#14B8A6' }]}>
                                Externa{calidadInfo.externa.length > 1 ? ` (${calidadInfo.externa.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {onAjustar && (
                        <TouchableOpacity onPress={onAjustar} style={actStyles.ajustarBtn}>
                            <MaterialCommunityIcons name="pencil-outline" size={16} color="#2563eb" />
                            <Text style={actStyles.ajustarBtnText}>Ajustar</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {(subAct || subDet) && (
                    <View style={actStyles.subChipsRow}>
                        {subAct ? (
                            <View style={actStyles.subChip}>
                                <Text style={actStyles.subChipLabel}>Subcódigo:</Text>
                                <Text style={actStyles.subChipValue}>{subAct}</Text>
                            </View>
                        ) : null}
                        {subDet ? (
                            <View style={actStyles.subChip}>
                                <Text style={actStyles.subChipLabel}>Detalle:</Text>
                                <Text style={actStyles.subChipValue}>{subDet}</Text>
                            </View>
                        ) : null}
                    </View>
                )}

                <View style={actStyles.metricsRow}>
                    <View style={actStyles.metricBlock}>
                        <Text style={[actStyles.metricLabel, { color: isDarkMode ? '#a0aec0' : '#4a5568' }]}>Tiros</Text>
                        <Text style={[actStyles.metricVal, { color: '#38a169' }]}>{(r.tiros || 0).toLocaleString()}</Text>
                    </View>
                    <View style={actStyles.metricBlock}>
                        <Text style={[actStyles.metricLabel, { color: isDarkMode ? '#a0aec0' : '#4a5568' }]}>Desperdicio</Text>
                        <Text style={[actStyles.metricVal, { color: '#e53e3e' }]}>{(r.desperdicio || 0).toLocaleString()}</Text>
                    </View>
                </View>

                {hasObs && (
                    <View style={[actStyles.obsBox, { backgroundColor: isDarkMode ? '#1c1f2b' : '#fffbea', borderLeftColor: '#d69e2e' }]}>
                        <View style={actStyles.obsHeaderRow}>
                            <MaterialCommunityIcons name="message-text-outline" size={13} color="#b7791f" />
                            <Text style={[actStyles.obsLabel, { color: '#b7791f' }]}>Observación del operario</Text>
                        </View>
                        <Text style={[actStyles.obsText, { color: isDarkMode ? '#e2e8f0' : '#1a202c' }]}>
                            {r.observaciones}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const makeStyles = (isDarkMode, colors) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors?.background || (isDarkMode ? '#0b0f17' : '#f7fafc'),
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#1f2937' : '#e2e8f0',
            gap: 10,
            flexWrap: 'wrap',
        },
        topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        title: {
            fontSize: 18,
            fontWeight: '800',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        subtitle: {
            fontSize: 12,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        dateNav: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
        dateBtn: {
            backgroundColor: isDarkMode ? '#1f2937' : '#edf2f7',
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
        },
        dateCenter: { alignItems: 'center', minWidth: 220 },
        dateLabel: {
            fontSize: 14,
            fontWeight: '700',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        todayBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: '#3182ce',
            paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
        },
        todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
        refreshBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: '#38a169',
            paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
        },
        refreshBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
        loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
        loadingText: { color: isDarkMode ? '#a0aec0' : '#4a5568' },
        emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
        emptyTitle: {
            fontSize: 16, fontWeight: '700', marginTop: 8,
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        emptyDesc: {
            fontSize: 13, marginTop: 4, textAlign: 'center',
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            maxWidth: 360,
        },
        body: { flex: 1 },
        leftPanel: {
            width: 320,
            borderRightWidth: 1,
            borderRightColor: isDarkMode ? '#1f2937' : '#e2e8f0',
            backgroundColor: isDarkMode ? '#0d1219' : '#f9fafb',
        },
        leftHeader: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        leftHeaderText: {
            fontSize: 13, fontWeight: '700',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        machineCard: {
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderRadius: 10,
            padding: 10,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        machineCardSelected: {
            borderColor: '#3182ce',
            backgroundColor: isDarkMode ? '#0f1c33' : '#ebf8ff',
        },
        machineCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        machineName: {
            fontSize: 13, fontWeight: '800',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
            flex: 1,
        },
        machineNameSelected: { color: '#3182ce' },
        operatorName: {
            fontSize: 11, marginTop: 4,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        actividadVivo: {
            fontSize: 11,
            marginTop: 4,
            fontWeight: '600',
            color: isDarkMode ? '#93c5fd' : '#2563eb',
        },
        machineMetrics: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#1f2937' : '#edf2f7',
        },
        metricItem: { alignItems: 'center' },
        metricLabel: {
            fontSize: 9,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#718096'),
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        metricValueOk: { fontSize: 13, fontWeight: '800', color: '#38a169', marginTop: 2 },
        metricValueBad: { fontSize: 13, fontWeight: '800', color: '#e53e3e', marginTop: 2 },
        metricValueInfo: { fontSize: 13, fontWeight: '800', color: '#805ad5', marginTop: 2 },
        miniBarBg: {
            backgroundColor: isDarkMode ? '#1f2937' : '#edf2f7',
            height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8,
        },
        miniBarFill: { height: '100%' },
        miniBarLabel: {
            fontSize: 10, marginTop: 4,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        liveBadge: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: '#fed7d7',
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
        },
        liveBadgeBig: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#fed7d7',
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        },
        livePulse: {
            width: 8, height: 8, borderRadius: 4, backgroundColor: '#e53e3e',
        },
        liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#c53030', letterSpacing: 0.6 },
        pausedBadge: {
            backgroundColor: '#feebc8',
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
        },
        pausedBadgeBig: {
            backgroundColor: '#feebc8',
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        },
        pausedBadgeText: { fontSize: 10, fontWeight: '800', color: '#9c4221', letterSpacing: 0.6 },
        machineFiltersBox: {
            paddingHorizontal: 8, paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#1f2937' : '#e2e8f0',
            gap: 8,
        },
        searchBox: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            borderWidth: 1,
            borderColor: isDarkMode ? '#2d3748' : '#cbd5e0',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: Platform.OS === 'web' ? 6 : 2,
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        },
        searchInput: {
            flex: 1,
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
            fontSize: 13,
            paddingVertical: 4,
            outlineStyle: 'none',
        },
        estadoChipsRow: {
            flexDirection: 'row', flexWrap: 'wrap', gap: 6,
        },
        estadoChip: {
            paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: isDarkMode ? '#2d3748' : '#cbd5e0',
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        },
        estadoChipActive: {
            backgroundColor: isDarkMode ? '#2b6cb0' : '#3182ce',
            borderColor: isDarkMode ? '#2b6cb0' : '#3182ce',
        },
        estadoChipText: {
            fontSize: 11, fontWeight: '600',
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        estadoChipTextActive: {
            color: '#ffffff',
        },
        noMatchText: {
            fontSize: 12,
            textAlign: 'center',
            paddingVertical: 16,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#718096'),
            fontStyle: 'italic',
        },
        rightPanel: { flex: 1 },
        detailHeader: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, flexWrap: 'wrap', gap: 8,
        },
        detailMachine: {
            fontSize: 20, fontWeight: '800',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        detailOperator: {
            fontSize: 13, marginTop: 2,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
        sectionCard: {
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
        sectionTitle: {
            fontSize: 14, fontWeight: '800',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        sectionTitleHint: {
            fontSize: 11, marginLeft: 'auto',
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        opTableHeader: {
            flexDirection: 'row',
            paddingVertical: 6,
            paddingHorizontal: 8,
            backgroundColor: isDarkMode ? '#0b1220' : '#edf2f7',
            borderRadius: 6,
        },
        opCol: {
            fontSize: 11, fontWeight: '800',
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            letterSpacing: 0.4,
        },
        opTableRow: {
            flexDirection: 'row',
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#1f2937' : '#edf2f7',
        },
        opCell: {
            fontSize: 12,
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        filtersCard: {
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        filtersHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
        },
        filtersRow: {
            flexDirection: 'row',
            gap: 12,
            flexWrap: 'wrap',
        },
        filterField: {
            flex: 1,
            minWidth: 200,
        },
        filterLabel: {
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 4,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        clearFiltersBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#e53e3e',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            marginLeft: 'auto',
        },
        clearFiltersText: {
            color: '#fff',
            fontSize: 11,
            fontWeight: '700',
        },
        duplicadosBanner: {
            backgroundColor: isDarkMode ? '#422006' : '#fffbeb',
            borderWidth: 1,
            borderColor: '#f59e0b',
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
            gap: 8,
        },
        duplicadosBannerText: {
            color: isDarkMode ? '#fcd34d' : '#92400e',
            fontSize: 13,
            fontWeight: '600',
        },
        duplicadosBannerBtn: {
            alignSelf: 'flex-start',
            backgroundColor: '#d97706',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 6,
        },
        duplicadosBannerBtnText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: 12,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        modalCard: {
            width: '100%',
            maxWidth: 480,
            borderRadius: 12,
            padding: 18,
            borderWidth: 1,
            borderColor: isDarkMode ? '#374151' : '#e2e8f0',
        },
        modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
        modalSub: { fontSize: 12, marginBottom: 14 },
        modalLabel: {
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            marginBottom: 4,
            color: isDarkMode ? '#a0aec0' : '#4a5568',
        },
        modalInput: {
            borderWidth: 1,
            borderColor: isDarkMode ? '#374151' : '#cbd5e0',
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
            color: isDarkMode ? '#e2e8f0' : '#1a202c',
        },
        finalizarCheckRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        modalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 4,
        },
        modalBtnCancel: {
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isDarkMode ? '#4b5563' : '#cbd5e0',
        },
        modalBtnCancelText: {
            color: isDarkMode ? '#e2e8f0' : '#4a5568',
            fontWeight: '600',
        },
        modalBtnSave: {
            backgroundColor: '#2563eb',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            minWidth: 120,
            alignItems: 'center',
        },
        modalBtnSaveText: { color: '#fff', fontWeight: '700' },
    });

const kpiStyles = StyleSheet.create({
    card: {
        flex: 1,
        minWidth: 170,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    iconCircle: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
    },
    label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    value: { fontSize: 19, fontWeight: '800', marginTop: 2 },
    sub: { fontSize: 11, marginTop: 2, fontWeight: '600' },
});

const actStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        gap: 12,
    },
    timeBox: {
        width: 96,
        alignItems: 'flex-start',
    },
    timeText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
        fontWeight: '700',
    },
    duracion: { fontSize: 11, fontWeight: '700', marginTop: 4 },
    body: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    actividad: { fontSize: 14, fontWeight: '800' },
    opChip: {
        backgroundColor: '#805ad5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    opChipText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
    calidadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        marginLeft: 4,
    },
    calidadBtnText: { fontSize: 10, fontWeight: '800' },
    ajustarBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        backgroundColor: '#eff6ff',
    },
    ajustarBtnText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
    subChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    subChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(49, 130, 206, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
    },
    subChipLabel: { fontSize: 10, fontWeight: '700', color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: 0.4 },
    subChipValue: { fontSize: 11, fontWeight: '700', color: '#2b6cb0' },
    metricsRow: { flexDirection: 'row', marginTop: 8, gap: 18 },
    metricBlock: { },
    metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    metricVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },
    obsBox: {
        marginTop: 10,
        padding: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
    },
    obsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    obsLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
    obsText: { fontSize: 13, lineHeight: 18 },
});

export default HistoryScreen;
