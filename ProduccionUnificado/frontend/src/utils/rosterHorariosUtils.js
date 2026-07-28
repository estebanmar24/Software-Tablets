import { esProcesoVirtualRoster } from './rosterProcesoUtils';

/** Jornada semanal ordinaria antes de contar horas extra. */
export const JORNADA_SEMANAL_HORAS = 42;

/** Semana roster: lunes a domingo inclusive (7 días). */
export const ROSTER_DIAS_SEMANA = 7;

export const ROSTER_DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function getMondayWeekStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = x.getDay();
    const offset = day === 0 ? 6 : day - 1;
    x.setDate(x.getDate() - offset);
    return x;
}

/** @deprecated Use getMondayWeekStart */
export const getSaturdayWeekStart = getMondayWeekStart;

export function weekDaysFromMonday(lunes) {
    const base = lunes instanceof Date ? lunes : new Date(`${lunes}T12:00:00`);
    return Array.from({ length: ROSTER_DIAS_SEMANA }, (_, i) => {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        return d;
    });
}

/** @deprecated Use weekDaysFromMonday */
export const weekDaysFromSaturday = weekDaysFromMonday;

export function semanaFinDesdeLunes(lunes) {
    const fin = new Date(lunes instanceof Date ? lunes : new Date(`${lunes}T12:00:00`));
    fin.setDate(fin.getDate() + (ROSTER_DIAS_SEMANA - 1));
    return fin;
}

/** @deprecated Use semanaFinDesdeLunes */
export const semanaFinDesdeSabado = semanaFinDesdeLunes;

export function celdaTextoExcel(cell) {
    if (!cell) return '';
    if (cell.tipo === 'incapacidad') return 'Incapacitado';
    if (cell.tipo === 'descanso') return 'DESCANSO';
    if (cell.tipo === 'vacio' || cell.tipo === 'festivo_vacio') return '';
    return cell.texto || '';
}

const MESES_LARGO = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function tituloSemanaRoster(semanaKey, semanaFinKey) {
    const ini = new Date(`${semanaKey}T12:00:00`);
    const fin = new Date(`${semanaFinKey}T12:00:00`);
    return `DEL ${ini.getDate()} AL ${String(fin.getDate()).padStart(2, '0')} DE ${MESES_LARGO[fin.getMonth()]} DE ${fin.getFullYear()}`;
}

export function encabezadoDiaExcel(fechaDia, festivo) {
    const d = new Date(`${fechaDia}T12:00:00`);
    const dow = d.getDay();
    const pref = dow === 6 ? 'SÁB' : dow === 0 ? 'Dom' : ['Dom', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][dow];
    const label = `${pref}. ${d.getDate()}-${MESES_CORTO[d.getMonth()]}`;
    return festivo ? `${label}\nFESTIVO` : label;
}

/** Matriz para hoja Excel tipo "PROGRAMACIÓN DE TURNOS". */
export function buildProgramacionTurnosSheetAoa({ rows, diasKeys, diasFestivos, semanaKey, semanaFinKey }) {
    const festivoSet = new Set((diasFestivos || []).map((f) => f.fechaDia || f.FechaDia));
    const dayHeaders = (diasKeys || []).map((f) => encabezadoDiaExcel(f, festivoSet.has(f)));
    const aoa = [
        ['PROGRAMACIÓN DE TURNOS'],
        ['Semana:', tituloSemanaRoster(semanaKey, semanaFinKey)],
        [],
        ['Proceso', 'Trabajador', ...dayHeaders, 'h', 'HE'],
    ];
    const highlightRows = [];
    for (const row of rows || []) {
        const cells = (diasKeys || []).map((f) => celdaTextoExcel(row.cells?.[f]));
        const hasIncap = (diasKeys || []).some((f) => row.cells?.[f]?.tipo === 'incapacidad');
        aoa.push([
            row.maquinaNombre || '',
            row.usuarioNombre || '',
            ...cells,
            row.totalHoras ?? 0,
            row.horasExtra ?? 0,
        ]);
        if (hasIncap) highlightRows.push(aoa.length - 1);
    }
    return { aoa, highlightRows, totalCols: 2 + (diasKeys?.length || 0) + 2 };
}

export function parseHoraMinutos(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;

    let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

    m = s.match(/^(\d{1,2})\s*(am|pm)$/);
    if (m) {
        let h = parseInt(m[1], 10);
        if (m[2] === 'pm' && h < 12) h += 12;
        if (m[2] === 'am' && h === 12) h = 0;
        return h * 60;
    }

    m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
    if (m) {
        let h = parseInt(m[1], 10);
        const mins = parseInt(m[2], 10);
        if (m[3] === 'pm' && h < 12) h += 12;
        if (m[3] === 'am' && h === 12) h = 0;
        return h * 60 + mins;
    }

    return null;
}

export function minutosToHoraInput(min) {
    if (min == null || Number.isNaN(min)) return '';
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatHoraAmPm(minutes) {
    if (minutes == null || Number.isNaN(minutes)) return '';
    const h24 = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    const ampm = h24 >= 12 ? 'pm' : 'am';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    if (m === 0) return `${h12} ${ampm}`;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatRangoHorario(inicioMin, finMin) {
    if (inicioMin == null || finMin == null) return '';
    return `${formatHoraAmPm(inicioMin)} - ${formatHoraAmPm(finMin)}`;
}

export function minutosEntre(inicioMin, finMin) {
    if (inicioMin == null || finMin == null) return 0;
    let diff = finMin - inicioMin;
    if (diff <= 0) diff += 24 * 60;
    return diff;
}

export function horasFromMinutos(mins) {
    return Math.round((mins / 60) * 100) / 100;
}

export function diaSemanaFromFecha(fechaDia) {
    if (!fechaDia) return 0;
    return new Date(`${fechaDia}T12:00:00`).getDay();
}

/** Bloque de jornada OT (Producción → Horarios) que coincide con inicio/fin del día. */
export function matchBloqueJornada(fechaDia, horaInicio, horaFin, jornadaDias) {
    if (!fechaDia || !jornadaDias?.length) return null;
    const dow = diaSemanaFromFecha(fechaDia);
    const ini = parseHoraMinutos(horaInicio);
    const fin = parseHoraMinutos(horaFin);
    if (ini == null || fin == null) return null;

    const bloques = jornadaDias.filter(
        (b) => Number(b.diaSemana ?? b.DiaSemana) === dow
            && (b.horaInicio || b.HoraInicio)
            && (b.horaFin || b.HoraFin),
    );

    for (const b of bloques) {
        const bIni = parseHoraMinutos(b.horaInicio ?? b.HoraInicio);
        const bFin = parseHoraMinutos(b.horaFin ?? b.HoraFin);
        if (bIni === ini && bFin === fin) return b;
    }
    return null;
}

export function minutosTrabajoEfectivos(inicioMin, finMin, bloqueJornada) {
    let mins = minutosEntre(inicioMin, finMin);
    if (bloqueJornada && (bloqueJornada.descuentaComida || bloqueJornada.DescuentaComida)) {
        const desc = Number(bloqueJornada.minutosComida ?? bloqueJornada.MinutosComida) || 0;
        mins = Math.max(0, mins - desc);
    }
    return mins;
}

export function minutosDescuentoComida({
    descuentaComida,
    minutosComida,
    fechaDia,
    horaInicio,
    horaFin,
    jornadaDias,
}) {
    if (descuentaComida) return Math.max(0, Number(minutosComida) || 0);
    const bloque = matchBloqueJornada(fechaDia, horaInicio, horaFin, jornadaDias);
    if (bloque && (bloque.descuentaComida || bloque.DescuentaComida)) {
        return Math.max(0, Number(bloque.minutosComida ?? bloque.MinutosComida) || 0);
    }
    return 0;
}

/** Horas trabajadas descontando comida (manual o jornada OT). */
export function horasEfectivasTurno(inicioMin, finMin, fechaDia, jornadaDias, comidaOpts = {}) {
    if (inicioMin == null || finMin == null) return 0;
    const desc = minutosDescuentoComida({
        descuentaComida: comidaOpts.descuentaComida,
        minutosComida: comidaOpts.minutosComida,
        fechaDia,
        horaInicio: minutosToHoraInput(inicioMin),
        horaFin: minutosToHoraInput(finMin),
        jornadaDias,
    });
    return horasFromMinutos(Math.max(0, minutosEntre(inicioMin, finMin) - desc));
}

export function comidaOptsFromAsig(asig) {
    if (!asig) return {};
    return {
        descuentaComida: !!(asig.descuentaComida || asig.DescuentaComida),
        minutosComida: Number(asig.minutosComida ?? asig.MinutosComida) || 0,
    };
}

export function comidaOptsFromCell(cell) {
    if (!cell) return {};
    return {
        descuentaComida: !!cell.descuentaComida,
        minutosComida: Number(cell.minutosComida) || 0,
    };
}

export function inferComidaDesdeJornada(fechaDia, horaInicio, horaFin, jornadaDias) {
    const bloque = matchBloqueJornada(fechaDia, horaInicio, horaFin, jornadaDias);
    if (!bloque) return { descuentaComida: false, minutosComida: 0 };
    return {
        descuentaComida: !!(bloque.descuentaComida || bloque.DescuentaComida),
        minutosComida: Number(bloque.minutosComida ?? bloque.MinutosComida) || 0,
    };
}

export function presetsJornadaParaDia(fechaDia, jornadaDias) {
    if (!fechaDia || !jornadaDias?.length) return [];
    const dow = diaSemanaFromFecha(fechaDia);
    return jornadaDias
        .filter((b) => Number(b.diaSemana ?? b.DiaSemana) === dow && (b.horaInicio || b.HoraInicio))
        .map((b) => {
            const inicio = String(b.horaInicio ?? b.HoraInicio).slice(0, 5);
            const fin = String(b.horaFin ?? b.HoraFin).slice(0, 5);
            const iniM = parseHoraMinutos(inicio);
            const finM = parseHoraMinutos(fin);
            const h = horasEfectivasTurno(iniM, finM, fechaDia, jornadaDias);
            const desc = b.descuentaComida || b.DescuentaComida
                ? ` · ${h}h (−${Number(b.minutosComida ?? b.MinutosComida) || 0}m comida)`
                : ` · ${h}h`;
            return {
                label: `${formatRangoHorario(iniM, finM)}${desc}`,
                inicio,
                fin,
                descuentaComida: !!(b.descuentaComida || b.DescuentaComida),
                minutosComida: Number(b.minutosComida ?? b.MinutosComida) || 0,
            };
        });
}

export function resolveHorarioPersonalizadoId(horarios) {
    const list = Array.isArray(horarios) ? horarios : [];
    const pers = list.find((h) => String(h.codigo || h.Codigo || '').toUpperCase() === 'PERS');
    if (pers) return Number(pers.id ?? pers.Id) || null;
    const first = list.find((h) => h.activo !== false && h.Activo !== false) || list[0];
    return first ? Number(first.id ?? first.Id) || null : null;
}

/** Mejor turno del catálogo configurado en la máquina según solapamiento horario. */
export function resolveHorarioIdParaCelda(maquinaId, horaInicio, horaFin, configsByMaquina, horarios, fechaDia, fallbackId) {
    const configs = configsByMaquina?.[String(maquinaId)] || [];
    const ini = parseHoraMinutos(horaInicio);
    const fin = parseHoraMinutos(horaFin);
    if (ini == null || fin == null) return fallbackId;

    let bestId = null;
    let bestOverlap = -1;
    for (const cfg of configs) {
        if (cfg.activo === false || cfg.Activo === false) continue;
        const hid = Number(cfg.horarioId ?? cfg.HorarioId) || 0;
        if (!hid) continue;
        const h = (horarios || []).find((x) => (x.id ?? x.Id) === hid);
        if (!h) continue;
        const rango = horarioRangoDia(h, fechaDia);
        const hIni = parseHoraMinutos(rango.inicio);
        const hFin = parseHoraMinutos(rango.fin);
        if (hIni == null || hFin == null) continue;
        const overlap = Math.min(fin, hFin) - Math.max(ini, hIni);
        if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestId = hid;
        }
    }
    if (bestId) return bestId;
    const firstCfg = configs.find((c) => c.activo !== false && c.Activo !== false) || configs[0];
    return Number(firstCfg?.horarioId ?? firstCfg?.HorarioId) || fallbackId;
}

export function horarioRangoDia(h, fechaDia) {
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
}

/** Horas efectivas de una asignación (override > catálogo, con descuento comida jornada OT). */
export function horasAsignacion(asig, horariosCatalog, fechaDia, jornadaDias = []) {
    if (!asig || asig.esDescanso || asig.EsDescanso) return 0;
    const iniRaw = asig.horaInicio ?? asig.HoraInicio;
    const finRaw = asig.horaFin ?? asig.HoraFin;
    let ini = parseHoraMinutos(iniRaw);
    let fin = parseHoraMinutos(finRaw);
    if (ini == null || fin == null) {
        const hid = asig.horarioId ?? asig.HorarioId;
        const h = (horariosCatalog || []).find((x) => (x.id ?? x.Id) === hid);
        const rango = horarioRangoDia(h, fechaDia);
        ini = parseHoraMinutos(rango.inicio);
        fin = parseHoraMinutos(rango.fin);
    }
    return horasEfectivasTurno(ini, fin, fechaDia, jornadaDias, comidaOptsFromAsig(asig));
}

export function textoCeldaHorario({
    asig,
    horariosCatalog,
    fechaDia,
    festivo,
    novedad,
    jornadaDias = [],
}) {
    const esFestivo = !!festivo;

    if (novedad && !asig) {
        const tipo = String(novedad.tipo || novedad.Tipo || '').toLowerCase();
        if (tipo === 'incapacidad') return { texto: 'Incapacitado', tipo: 'incapacidad', horas: 0, esFestivo };
        if (tipo === 'baja') return { texto: 'Baja', tipo: 'novedad', horas: 0, esFestivo };
        if (tipo === 'falta') return { texto: 'Falta', tipo: 'novedad', horas: 0, esFestivo };
        if (tipo === 'permiso') return { texto: 'Permiso', tipo: 'novedad', horas: 0, esFestivo };
    }

    if (!asig) {
        if (esFestivo) {
            return { texto: '', tipo: 'festivo_vacio', horas: 0, esFestivo: true };
        }
        return { texto: '', tipo: 'vacio', horas: 0, esFestivo: false };
    }

    if (asig.esDescanso || asig.EsDescanso) {
        return { texto: 'DESCANSO', tipo: 'descanso', horas: 0, esFestivo };
    }

    const iniRaw = asig.horaInicio ?? asig.HoraInicio;
    const finRaw = asig.horaFin ?? asig.HoraFin;
    let ini = parseHoraMinutos(iniRaw);
    let fin = parseHoraMinutos(finRaw);
    if (ini == null || fin == null) {
        const hid = asig.horarioId ?? asig.HorarioId;
        const h = (horariosCatalog || []).find((x) => (x.id ?? x.Id) === hid);
        const rango = horarioRangoDia(h, fechaDia);
        ini = parseHoraMinutos(rango.inicio);
        fin = parseHoraMinutos(rango.fin);
    }
    if (ini == null || fin == null) {
        if (esFestivo) return { texto: '', tipo: 'festivo_vacio', horas: 0, esFestivo: true };
        return { texto: '', tipo: 'vacio', horas: 0, esFestivo: false };
    }

    const horas = horasEfectivasTurno(ini, fin, fechaDia, jornadaDias, comidaOptsFromAsig(asig));
    const rango = formatRangoHorario(ini, fin);
    const comida = comidaOptsFromAsig(asig);
    const bloque = matchBloqueJornada(fechaDia, minutosToHoraInput(ini), minutosToHoraInput(fin), jornadaDias);
    return {
        texto: esFestivo ? rango : rango,
        tipo: esFestivo ? 'turno_festivo' : 'turno',
        horas,
        inicioMin: ini,
        finMin: fin,
        horaInicio: minutosToHoraInput(ini),
        horaFin: minutosToHoraInput(fin),
        esFestivo,
        descuentaComida: comida.descuentaComida,
        minutosComida: comida.minutosComida,
        descuentaComidaAuto: !comida.descuentaComida && !!(bloque?.descuentaComida || bloque?.DescuentaComida),
    };
}

export function asignacionEsDeHorarios(a, horarioPersonalizadoId) {
    if (!a) return false;
    if (a.esDescanso || a.EsDescanso) return true;
    if (a.horaInicio || a.HoraInicio || a.horaFin || a.HoraFin) return true;
    if (horarioPersonalizadoId && Number(a.horarioId ?? a.HorarioId) === horarioPersonalizadoId) return true;
    return false;
}

/** Asignación hecha solo desde Cobertura (+Op/+Ax en turno), sin horario manual en grilla. */
export function asignacionEsSoloCobertura(a, horarioPersonalizadoId) {
    if (!a) return false;
    if (a.esDescanso || a.EsDescanso) return false;
    if (a.horaInicio || a.HoraInicio || a.horaFin || a.HoraFin) return false;
    if (horarioPersonalizadoId && Number(a.horarioId ?? a.HorarioId) === horarioPersonalizadoId) return false;
    return true;
}

export function buildHorariosRows({
    asignaciones,
    maquinas,
    diasKeys,
    horarios,
    novedades,
    diasFestivos,
    horarioPersonalizadoId,
    jornadaDias = [],
}) {
    const festivoSet = new Set((diasFestivos || []).map((f) => f.fechaDia || f.FechaDia));
    const maqMap = {};
    for (const m of maquinas || []) {
        maqMap[String(m.id ?? m.Id)] = m.nombre ?? m.Nombre ?? '';
    }

    const pairKeys = new Set();
    for (const a of asignaciones || []) {
        if (!asignacionEsDeHorarios(a, horarioPersonalizadoId)) continue;
        pairKeys.add(`${a.maquinaId}|${a.usuarioId}`);
    }

    const rows = [];
    for (const key of pairKeys) {
        const [maqStr, usrStr] = key.split('|');
        const sample = (asignaciones || []).find(
            (a) => String(a.maquinaId) === maqStr && String(a.usuarioId) === usrStr,
        );
        rows.push({
            rowKey: key,
            maquinaId: Number(maqStr),
            usuarioId: Number(usrStr),
            usuarioNombre: sample?.usuarioNombre || usrStr,
            maquinaNombre: maqMap[String(maqStr)] || `#${maqStr}`,
            esProcesoVirtual: esProcesoVirtualRoster(maqMap[String(maqStr)]),
            esAuxiliar: !!(sample?.esAuxiliar || sample?.EsAuxiliar),
        });
    }

    rows.sort((a, b) => {
        const cmpM = String(a.maquinaNombre).localeCompare(String(b.maquinaNombre), 'es', { numeric: true });
        if (cmpM !== 0) return cmpM;
        return String(a.usuarioNombre).localeCompare(String(b.usuarioNombre), 'es');
    });

    return rows.map((row) => {
        const cells = {};
        let totalHoras = 0;
        for (const fecha of diasKeys) {
            const festivo = festivoSet.has(fecha);
            const nov = (novedades || []).find(
                (n) =>
                    String(n.usuarioId ?? n.UsuarioId) === String(row.usuarioId)
                    && fecha >= (n.fechaInicio || n.FechaInicio)
                    && fecha <= (n.fechaFin || n.FechaFin)
                    && !(n.medioDia || n.MedioDia)
            );
            const matches = (asignaciones || []).filter(
                (a) =>
                    asignacionEsDeHorarios(a, horarioPersonalizadoId)
                    && String(a.fechaDia) === fecha
                    && Number(a.maquinaId) === row.maquinaId
                    && Number(a.usuarioId) === row.usuarioId
            );
            let asig = matches.find(
                (a) =>
                    horarioPersonalizadoId
                    && Number(a.horarioId) === horarioPersonalizadoId
            );
            if (!asig) {
                asig = matches.find((a) => a.horaInicio || a.HoraInicio || a.horaFin || a.HoraFin) || null;
            }
            const cell = textoCeldaHorario({
                asig,
                horariosCatalog: horarios,
                fechaDia: fecha,
                festivo,
                novedad: nov,
                jornadaDias,
            });
            cells[fecha] = { ...cell, asig: asig || null };
            totalHoras += cell.horas || 0;
        }
        const horasExtra = Math.max(0, Math.round((totalHoras - JORNADA_SEMANAL_HORAS) * 100) / 100);
        return { ...row, cells, totalHoras: Math.round(totalHoras * 100) / 100, horasExtra };
    });
}

/** Convierte filas del grid a asignaciones API (operarios y auxiliares). */
export function rowsToAsignacionesHorarios(
    rows,
    diasKeys,
    horarioPersonalizadoId,
    asignacionesActuales,
    configsByMaquina = {},
    horarios = [],
    removedPairs = null,
) {
    const nuevas = [];
    for (const row of rows) {
        for (const fecha of diasKeys) {
            const cell = row.cells?.[fecha];
            if (!cell || cell.tipo === 'vacio' || cell.tipo === 'festivo_vacio') continue;
            if (cell.tipo === 'incapacidad' || cell.tipo === 'novedad') continue;

            const esDescanso = cell.tipo === 'descanso';
            const horaInicio = esDescanso ? null : (cell.horaInicio || null);
            const horaFin = esDescanso ? null : (cell.horaFin || null);
            const horarioId = esDescanso
                ? horarioPersonalizadoId
                : resolveHorarioIdParaCelda(
                    row.maquinaId,
                    horaInicio,
                    horaFin,
                    configsByMaquina,
                    horarios,
                    fecha,
                    horarioPersonalizadoId,
                );

            const payload = {
                fechaDia: fecha,
                maquinaId: row.maquinaId,
                usuarioId: row.usuarioId,
                horarioId,
                esAuxiliar: !!row.esAuxiliar,
                esDescanso,
                horaInicio,
                horaFin,
                descuentaComida: esDescanso ? false : !!cell.descuentaComida,
                minutosComida: esDescanso ? 0 : Math.max(0, Number(cell.minutosComida) || 0),
            };
            if (!payload.esDescanso && (!payload.horaInicio || !payload.horaFin)) continue;
            nuevas.push(payload);
        }
    }

    // Mantener fila operario-máquina aunque aún no tenga horarios en celdas.
    for (const row of rows) {
        const tieneHorario = nuevas.some(
            (n) => n.maquinaId === row.maquinaId && n.usuarioId === row.usuarioId,
        );
        if (tieneHorario) continue;
        const fechaStub = diasKeys.find((f) => {
            const c = row.cells?.[f];
            return c && c.tipo !== 'incapacidad' && c.tipo !== 'novedad';
        }) || diasKeys[0];
        if (!fechaStub) continue;
        nuevas.push({
            fechaDia: fechaStub,
            maquinaId: row.maquinaId,
            usuarioId: row.usuarioId,
            horarioId: horarioPersonalizadoId,
            esAuxiliar: !!row.esAuxiliar,
            esDescanso: false,
            horaInicio: null,
            horaFin: null,
        });
    }

    const mapAsig = (a) => ({
        fechaDia: a.fechaDia,
        maquinaId: Number(a.maquinaId),
        horarioId: Number(a.horarioId),
        usuarioId: Number(a.usuarioId),
        esAuxiliar: !!(a.esAuxiliar || a.EsAuxiliar),
        horaInicio: a.horaInicio ?? a.HoraInicio ?? null,
        horaFin: a.horaFin ?? a.HoraFin ?? null,
        esDescanso: !!(a.esDescanso || a.EsDescanso),
        descuentaComida: !!(a.descuentaComida || a.DescuentaComida),
        minutosComida: Math.max(0, Number(a.minutosComida ?? a.MinutosComida) || 0),
    });

    // Filas del grid controlan su par máquina+persona. Cobertura manual solo si no está en la grilla.
    // Pares eliminados explícitamente (✕) no se conservan aunque sigan en Cobertura.
    const rowPairs = new Set(rows.map((r) => `${r.maquinaId}|${r.usuarioId}`));
    const removed = removedPairs instanceof Set ? removedPairs : new Set();
    const preserved = (asignacionesActuales || []).filter((a) => {
        const key = `${a.maquinaId}|${a.usuarioId}`;
        if (rowPairs.has(key)) return false;
        if (removed.has(key)) return false;
        return asignacionEsSoloCobertura(a, horarioPersonalizadoId);
    });

    return [...preserved.map(mapAsig), ...nuevas];
}
