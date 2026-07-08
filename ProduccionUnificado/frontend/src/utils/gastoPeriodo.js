/** Anio/mes desde "YYYY-MM-DD" sin desfase UTC (evita que 2026-06-01 quede en mayo). */
export function anioMesFromFecha(fecha) {
    const part = String(fecha || '').split('T')[0];
    const [y, m] = part.split('-').map((n) => parseInt(n, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
        const d = new Date();
        return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    }
    return { anio: y, mes: m };
}
