const HORAS_MENSUALES = 220;

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
            // Ej: 2.000.095,50
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // Ej: 1,234.56
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
        // Un solo punto con 1-2 decimales → horas (2.40, 0.50). Varios puntos → miles.
        if (!(parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2)) {
            s = s.replace(/\./g, '');
        }
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

export function calcValorHoraLabor(salario) {
    const s = parseNumeroLabor(salario);
    return s > 0 ? s / HORAS_MENSUALES : 0;
}

/** Valor a pagar = (salario / 220) × factor × horas, con el salario actual del trabajador. */
export function calcValorAPagarLabor(item, horasOverride) {
    const salario = parseNumeroLabor(
        item?.salario ?? item?.Salario ?? item?.personalSalario ?? item?.PersonalSalario ?? 0
    );
    const valorHora =
        item?.valorHora != null || item?.ValorHora != null
            ? parseNumeroLabor(item.valorHora ?? item.ValorHora)
            : calcValorHoraLabor(salario);
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
