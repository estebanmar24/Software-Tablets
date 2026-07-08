/** Normaliza nombre de rubro para comparaciones. */
export function normalizarRubroNombre(nombre) {
    return (nombre || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export function esRubroHerramientas(nombreRubro) {
    return normalizarRubroNombre(nombreRubro).includes('herramienta');
}

export function esRubroRepuestoOMantenimiento(nombreRubro) {
    const n = normalizarRubroNombre(nombreRubro);
    return n.includes('mantenimiento') || n.includes('repuesto') || n.includes('rodamiento');
}

/** Rubros que muestran selector de producto + cantidad (inventario). */
export function esRubroConProductoInventario(nombreRubro) {
    return esRubroRepuestoOMantenimiento(nombreRubro) || esRubroHerramientas(nombreRubro);
}

/** Solo repuestos/mantenimiento exigen máquina. */
export function esRubroConMaquinaObligatoria(nombreRubro) {
    return esRubroRepuestoOMantenimiento(nombreRubro);
}

export const MEDIDAS_INSUMO = ['Cc', 'Grs', 'Gal', 'Uni', 'Kg', 'Mts', 'ml'];
export const MEDIDAS_HERRAMIENTA = ['Und', 'Pieza', 'Set', 'Par', 'Kit'];

export function medidasParaTipoProducto(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t === 'herramienta') return MEDIDAS_HERRAMIENTA;
    if (t === 'insumo') return MEDIDAS_INSUMO;
    return [...MEDIDAS_HERRAMIENTA, ...MEDIDAS_INSUMO.filter(m => !MEDIDAS_HERRAMIENTA.includes(m))];
}

export function esTipoProductoHerramienta(tipo) {
    return (tipo || '').toLowerCase() === 'herramienta';
}

/** Productos visibles en gasto según rubro seleccionado. */
export function filtrarProductosParaRubro(productos, rubroId, nombreRubro) {
    const rid = rubroId?.toString();
    if (!rid) return [];

    if (esRubroHerramientas(nombreRubro)) {
        return (productos || []).filter((p) => {
            const mismoRubro = p.rubroId?.toString() === rid;
            const esHerramienta = esTipoProductoHerramienta(p.tipoProducto);
            return mismoRubro || esHerramienta;
        });
    }

    return (productos || []).filter((p) => p.rubroId?.toString() === rid);
}
