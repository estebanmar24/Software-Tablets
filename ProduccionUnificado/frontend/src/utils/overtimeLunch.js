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

/**
 * Determina fin de jornada ordinaria y ventana de almuerzo.
 * L-V: turnos oficiales (6am→2pm, 1pm→9pm, 2pm→10pm, 10pm→6am) con almuerzo si aplica.
 * Sábado: siempre 4 h ordinarias desde la hora de inicio (sin turno fijo de 8 h).
 */
export function resolveOvertimeShiftContext(startFull, endFull, { isSpecialDay = false, isSaturday = false } = {}) {
    if (isSpecialDay) {
        return { shiftEndMin: startFull, lunchWindow: null, usesScheduledShift: false };
    }

    if (isSaturday) {
        return {
            shiftEndMin: startFull + 4 * HOUR_MINUTES,
            lunchWindow: null,
            usesScheduledShift: false,
        };
    }

    const rule = findShiftRuleByStart(startFull);
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

        return { shiftEndMin: rule.shiftEnd, lunchWindow, usesScheduledShift: true };
    }

    const baseShiftMinutes = isSaturday ? 4 * HOUR_MINUTES : 8 * HOUR_MINUTES;
    return {
        shiftEndMin: startFull + baseShiftMinutes,
        lunchWindow: null,
        usesScheduledShift: false,
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
