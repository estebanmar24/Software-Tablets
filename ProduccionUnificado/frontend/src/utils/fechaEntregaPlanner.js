const pad2 = (n) => String(n).padStart(2, '0');

/** Parsea fecha entrega (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD). */
export function parseFechaEntregaValue(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;

    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const lat = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (lat) {
        let y = Number(lat[3]);
        if (y < 100) y += 2000;
        const d = new Date(y, Number(lat[2]) - 1, Number(lat[1]));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function fechaEntregaFromProgramacion(prog) {
    const raw = prog?.fechaEntrega
        || prog?.calculo?.fechaEntrega
        || (typeof prog?.calculoJson === 'string' ? (() => {
            try {
                return JSON.parse(prog.calculoJson)?.fechaEntrega;
            } catch {
                return null;
            }
        })() : prog?.calculoJson?.fechaEntrega);
    return parseFechaEntregaValue(raw);
}

export function formatFechaEntregaDisplay(raw) {
    const d = parseFechaEntregaValue(raw);
    if (!d) return '—';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toDateKeyLocal(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Días hasta entrega (negativo = vencida). */
export function diasHastaEntrega(fechaEntrega, refDate = new Date()) {
    const entrega = fechaEntrega instanceof Date ? fechaEntrega : parseFechaEntregaValue(fechaEntrega);
    if (!entrega) return null;
    const hoy = new Date(refDate);
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(entrega);
    fin.setHours(0, 0, 0, 0);
    return Math.round((fin.getTime() - hoy.getTime()) / 86400000);
}

export function formatEntregaCountdown(dias) {
    if (dias == null) return '';
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return '1 día restante';
    if (dias > 1) return `${dias} días restantes`;
    if (dias === -1) return 'Vencida hace 1 día';
    return `Vencida hace ${Math.abs(dias)} días`;
}

export function entregaBadgeColor(dias) {
    if (dias == null) return '#94A3B8';
    if (dias < 0) return '#EF4444';
    if (dias <= 2) return '#F59E0B';
    if (dias <= 7) return '#3B82F6';
    return '#22C55E';
}

export function entregaEsMismoDia(fechaEntrega, dayDate) {
    const entrega = fechaEntrega instanceof Date ? fechaEntrega : parseFechaEntregaValue(fechaEntrega);
    if (!entrega || !dayDate) return false;
    return toDateKeyLocal(entrega) === toDateKeyLocal(dayDate);
}
