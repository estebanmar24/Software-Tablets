const HOUR_MINUTES = 60;

/** Turnos oficiales con hora de fin fija. Almuerzo solo si lunchStart/lunchEnd están definidos. */
export const SCHEDULED_SHIFT_RULES = [
    { shiftStart: 6 * 60, shiftEnd: 14 * 60, lunchStart: 10 * 60, lunchEnd: 11 * 60 },
    { shiftStart: 13 * 60, shiftEnd: 21 * 60 },
    { shiftStart: 14 * 60, shiftEnd: 22 * 60, lunchStart: 18 * 60, lunchEnd: 19 * 60 },
    { shiftStart: 22 * 60, shiftEnd: 30 * 60, lunchStart: 26 * 60, lunchEnd: 27 * 60 },
];

/** @deprecated Usar SCHEDULED_SHIFT_RULES */
export const SCHEDULED_LUNCH_WINDOWS = SCHEDULED_SHIFT_RULES;

export function findShiftRuleByStart(startFull) {
    return SCHEDULED_SHIFT_RULES.find(rule => rule.shiftStart === startFull) || null;
}

/** Turno legacy cuyo tramo ordinario mejor coincide con el rango capturado (incluye llegada anticipada). */
export function findShiftRuleByBestMatch(startFull, endFull) {
    const exact = findShiftRuleByStart(startFull);
    if (exact) return exact;

    let best = null;
    let bestOverlap = -1;
    let bestEndDist = Infinity;

    for (const rule of SCHEDULED_SHIFT_RULES) {
        const overlapStart = Math.max(startFull, rule.shiftStart);
        const overlapEnd = Math.min(endFull, rule.shiftEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        const endDist = Math.abs(endFull - rule.shiftEnd);

        if (overlap > bestOverlap || (overlap === bestOverlap && endDist < bestEndDist)) {
            bestOverlap = overlap;
            bestEndDist = endDist;
            best = rule;
        }
    }

    if (bestOverlap > 0) return best;

    let earlyBest = null;
    let earlyScore = Infinity;
    for (const rule of SCHEDULED_SHIFT_RULES) {
        if (startFull < rule.shiftStart && endFull >= rule.shiftStart) {
            const score = Math.abs(endFull - rule.shiftEnd);
            if (score < earlyScore) {
                earlyScore = score;
                earlyBest = rule;
            }
        }
    }
    return earlyBest || best;
}

/** Convierte "HH:mm" o "HH:mm:ss" a minutos desde medianoche. */
export function parseHhMmToMinutes(t) {
    if (t == null || t === '') return null;
    const [h, m] = String(t).split(':').map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0);
}

function normalizeScheduleBlock(day) {
    if (!day) return null;
    const horaInicio = day.horaInicio ?? day.HoraInicio;
    const horaFin = day.horaFin ?? day.HoraFin;
    if (!horaInicio || !horaFin) return null;
    return {
        horaInicio,
        horaFin,
        descuentaComida: !!(day.descuentaComida ?? day.DescuentaComida),
        minutosComida: Number(day.minutosComida ?? day.MinutosComida) || 0,
    };
}

/**
 * Todos los bloques de jornada ordinaria de un día (puede haber varios turnos).
 * @returns {Array<{ horaInicio, horaFin, descuentaComida, minutosComida }>}
 */
export function pickDaySchedulesFromVersion(version, dateOrDow) {
    if (!version?.dias?.length) return [];
    const dow = typeof dateOrDow === 'number' ? dateOrDow : dateOrDow.getDay();
    return version.dias
        .filter(d => Number(d.diaSemana ?? d.DiaSemana) === dow)
        .map(normalizeScheduleBlock)
        .filter(Boolean)
        .sort((a, b) => (parseHhMmToMinutes(a.horaInicio) ?? 0) - (parseHhMmToMinutes(b.horaInicio) ?? 0));
}

/**
 * Extrae un bloque del día (compatibilidad). Si hay varios, el primero por hora de inicio.
 * @returns {{ horaInicio, horaFin, descuentaComida, minutosComida } | null}
 */
export function pickDayScheduleFromVersion(version, dateOrDow) {
    const blocks = pickDaySchedulesFromVersion(version, dateOrDow);
    return blocks[0] || null;
}

function buildOrdinaryWindows(schedules) {
    const windows = [];
    for (const sch of schedules) {
        let start = parseHhMmToMinutes(sch.horaInicio);
        let end = parseHhMmToMinutes(sch.horaFin);
        if (start == null || end == null) continue;
        if (end <= start) end += 24 * HOUR_MINUTES;
        windows.push({
            start,
            end,
            lunchDiscountHours:
                sch.descuentaComida && sch.minutosComida > 0 ? sch.minutosComida / 60 : 0,
        });
    }
    return windows.sort((a, b) => a.start - b.start);
}

/**
 * Elige el bloque de jornada ordinaria que corresponde al rango capturado.
 * Prioriza mayor solape; si llegó antes del turno, infiere por hora de fin esperada.
 */
function matchOrdinaryWindow(windows, startFull, endFull) {
    if (!windows?.length) return null;
    if (windows.length === 1) return windows[0];

    let best = null;
    let bestOverlap = -1;
    let bestEndDist = Infinity;

    for (const w of windows) {
        const overlapStart = Math.max(startFull, w.start);
        const overlapEnd = Math.min(endFull, w.end);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        const endDist = Math.abs(endFull - w.end);

        if (overlap > bestOverlap || (overlap === bestOverlap && endDist < bestEndDist)) {
            bestOverlap = overlap;
            bestEndDist = endDist;
            best = w;
        }
    }

    if (bestOverlap > 0) return best;

    let earlyBest = null;
    let earlyScore = Infinity;
    for (const w of windows) {
        if (startFull < w.start && endFull >= w.start) {
            const score = Math.abs(endFull - w.end);
            if (score < earlyScore) {
                earlyScore = score;
                earlyBest = w;
            }
        }
    }
    return earlyBest || best;
}

function lunchHoursForMatchedBlock(windows, startFull, endFull) {
    const matched = matchOrdinaryWindow(windows, startFull, endFull);
    return matched?.lunchDiscountHours || 0;
}

/**
 * Determina fin de jornada ordinaria y ventana/descuento de almuerzo.
 * daySchedules: varios bloques del mismo día; daySchedule: un solo bloque (legacy).
 */
export function resolveOvertimeShiftContext(
    startFull,
    endFull,
    { isSpecialDay = false, isSaturday = false, daySchedule = null, daySchedules = null } = {}
) {
    const base = {
        shiftStartMin: startFull,
        lunchWindow: null,
        lunchDiscountHours: 0,
        usesScheduledShift: false,
        usesDaySchedule: false,
        ordinaryWindows: [],
    };

    if (isSpecialDay) {
        return { ...base, shiftEndMin: startFull };
    }

    const schedules = Array.isArray(daySchedules) && daySchedules.length
        ? daySchedules
        : (daySchedule ? [daySchedule] : null);

    if (schedules?.length) {
        const allWindows = buildOrdinaryWindows(schedules);
        if (!allWindows.length) {
            return { ...base, shiftEndMin: startFull };
        }
        const matched = matchOrdinaryWindow(allWindows, startFull, endFull) || allWindows[0];
        const ordinaryWindows = [matched];
        return {
            shiftStartMin: matched.start,
            shiftEndMin: matched.end,
            ordinaryWindows,
            lunchWindow: null,
            lunchDiscountHours: lunchHoursForMatchedBlock(allWindows, startFull, endFull),
            usesScheduledShift: true,
            usesDaySchedule: true,
        };
    }

    if (isSaturday) {
        return {
            ...base,
            shiftEndMin: startFull + 4 * HOUR_MINUTES,
        };
    }

    const rule = findShiftRuleByBestMatch(startFull, endFull);
    if (rule) {
        const totalDurationMin = endFull - startFull;
        const lunchWindow =
            rule.lunchStart != null &&
            rule.lunchEnd != null &&
            totalDurationMin >= 6 * HOUR_MINUTES &&
            endFull >= rule.shiftEnd &&
            startFull <= rule.lunchStart &&
            endFull >= rule.lunchEnd
                ? {
                    shiftStart: rule.shiftStart,
                    shiftEnd: rule.shiftEnd,
                    lunchStart: rule.lunchStart,
                    lunchEnd: rule.lunchEnd,
                }
                : null;

        return {
            ...base,
            shiftStartMin: rule.shiftStart,
            shiftEndMin: rule.shiftEnd,
            lunchWindow,
            usesScheduledShift: true,
        };
    }

    const baseShiftMinutes = isSaturday ? 4 * HOUR_MINUTES : 8 * HOUR_MINUTES;
    return {
        ...base,
        shiftEndMin: startFull + baseShiftMinutes,
    };
}

/** Compatibilidad con código existente. */
export function getScheduledLunchWindow(startFull, endFull, isSaturday = false) {
    const ctx = resolveOvertimeShiftContext(startFull, endFull, { isSaturday, isSpecialDay: false });
    return ctx.lunchWindow;
}

export function applyLegacyLunchDiscount(breakdownItems, lunchHours = 1) {
    let remainingLunch = lunchHours;

    const extraItem = breakdownItems.find(item => item.isHe && item.hours > 0);
    if (extraItem) {
        const discounted = Math.min(extraItem.hours, remainingLunch);
        extraItem.hours -= discounted;
        remainingLunch -= discounted;
    }

    if (remainingLunch > 0) {
        const recargoItem = breakdownItems.find(item => !item.isHe && !item.isLunch && item.hours > 0);
        if (recargoItem) {
            const discounted = Math.min(recargoItem.hours, remainingLunch);
            recargoItem.hours -= discounted;
            remainingLunch -= discounted;
        }
    }

    return lunchHours - remainingLunch;
}

/**
 * Añade línea informativa de COMIDA sin restar horas del breakdown.
 * Solo visual; no afecta total a pagar ni registros guardados.
 */
export function appendLunchInfoLine(breakdownItems, lunchHours) {
    if (!(lunchHours > 0)) return;
    breakdownItems.push({
        type: 'COMIDA (informativo)',
        typeId: 0,
        hours: lunchHours,
        isHe: false,
        isLunch: true,
    });
}

/**
 * Aplica descuento de comida según contexto OT.
 * Ventana programada (lunchWindow) ya se excluyó en los cortes → 0.
 */
export function resolveLunchDiscountHours(ctx, { totalDurationMin, isSaturday }) {
    if (ctx?.lunchWindow) return 0;
    if (ctx?.lunchDiscountHours > 0) return ctx.lunchDiscountHours;
    if (!ctx?.usesScheduledShift && !ctx?.usesDaySchedule && totalDurationMin >= 6 * 60 && !isSaturday) {
        return 1.0;
    }
    return 0;
}

/** Añade límites de todos los bloques de jornada ordinaria a los puntos de corte. */
export function addDayScheduleCutPoints(cutPoints, ctx, startFull, endFull) {
    if (!ctx) return;
    if (ctx.usesDaySchedule && ctx.ordinaryWindows?.length) {
        for (const w of ctx.ordinaryWindows) {
            if (w.start > startFull && w.start < endFull) cutPoints.add(w.start);
            if (w.end > startFull && w.end < endFull) cutPoints.add(w.end);
        }
        return;
    }
    if (ctx.usesDaySchedule && ctx.shiftStartMin > startFull && ctx.shiftStartMin < endFull) {
        cutPoints.add(ctx.shiftStartMin);
    }
    if (ctx.shiftEndMin > startFull && ctx.shiftEndMin < endFull) {
        cutPoints.add(ctx.shiftEndMin);
    }
}

/** ¿El punto medio del intervalo está dentro de la jornada ordinaria? */
export function isWithinOrdinaryShift(mid, ctx, segmentStart = null) {
    if (!ctx) return false;
    if (ctx.usesDaySchedule && ctx.ordinaryWindows?.length) {
        return ctx.ordinaryWindows.some(w => mid >= w.start && mid < w.end);
    }
    if (ctx.usesDaySchedule) {
        return mid >= ctx.shiftStartMin && mid < ctx.shiftEndMin;
    }
    const s = segmentStart != null ? segmentStart : mid;
    return s >= ctx.shiftStartMin && s < ctx.shiftEndMin;
}
