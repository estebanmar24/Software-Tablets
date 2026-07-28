/** Divisor mensual legal: 220 hasta 14/07/2026; 210 desde 15/07/2026 inclusive. */
export const HORAS_MENSUALES_ANTES = 220;
export const HORAS_MENSUALES_DESDE_JUL_2026 = 210;
export const FECHA_CAMBIO_DIVISOR_HORAS = '2026-07-15';

/** @deprecated Usar getHorasMensualesLabor(fecha). */
export const HORAS_MENSUALES = HORAS_MENSUALES_ANTES;

function toDateOnly(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const s = String(value).trim();
    // YYYY-MM-DD o ISO
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Horas mensuales según fecha del gasto/registro.
 * Sin fecha → se asume hoy (comportamiento al capturar).
 */
export function getHorasMensualesLabor(fechaReferencia) {
    const fecha = toDateOnly(fechaReferencia) || toDateOnly(new Date());
    const corte = toDateOnly(FECHA_CAMBIO_DIVISOR_HORAS);
    if (!fecha || !corte) return HORAS_MENSUALES_ANTES;
    return fecha.getTime() >= corte.getTime()
        ? HORAS_MENSUALES_DESDE_JUL_2026
        : HORAS_MENSUALES_ANTES;
}

/**
 * Interpreta montos colombianos (1.234.567,89) y decimales con punto (2.40 horas).
 */
export function parseNumeroLabor(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    let s = String(value).trim().replace(/\s/g, '').replace(/[$]/g, '');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (hasComma) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 3) {
            s = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (hasDot) {
        const parts = s.split('.');
        if (!(parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2)) {
            s = s.replace(/\./g, '');
        }
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

export function calcValorHoraLabor(salario, fechaReferencia) {
    const s = parseNumeroLabor(salario);
    const divisor = getHorasMensualesLabor(fechaReferencia);
    return s > 0 ? s / divisor : 0;
}

/**
 * Valor a pagar = (salario / divisor) × factor × horas.
 * divisor = 220 si fecha &lt; 15/07/2026; 210 si fecha ≥ 15/07/2026.
 * La fecha se toma de item.fecha / item.Fecha si no se pasa por separado.
 */
export function calcValorAPagarLabor(item, horasOverride, fechaOverride) {
    const salario = parseNumeroLabor(
        item?.salario ?? item?.Salario ?? item?.personalSalario ?? item?.PersonalSalario ?? 0
    );
    const fecha =
        fechaOverride ??
        item?.fecha ??
        item?.Fecha ??
        null;
    let valorHora = calcValorHoraLabor(salario, fecha);
    if (valorHora <= 0 && (item?.valorHora != null || item?.ValorHora != null)) {
        valorHora = parseNumeroLabor(item.valorHora ?? item.ValorHora);
    }
    const factor = parseNumeroLabor(
        item?.factor ?? item?.Factor ?? item?.tipoHoraFactor ?? item?.tipoRecargoFactor ?? 0
    );
    const horas =
        horasOverride !== undefined && horasOverride !== null
            ? parseNumeroLabor(horasOverride)
            : parseNumeroLabor(item?.cantidadHoras ?? item?.CantidadHoras ?? 0);

    if (valorHora <= 0 || factor <= 0 || horas <= 0) return 0;
    return Math.round(valorHora * factor * horas);
}
