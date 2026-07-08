/**
 * Permisos de edición/eliminación cuando contabilidad ya movió el gasto a Entregado/Pagado.
 * Objetivo: poder completar factura, PDF u observaciones si el registro aún no está legalizado del todo.
 */

export function esGastoLaborHorasExtrasORecargo(gasto) {
    if (!gasto) return false;
    const tipoNom = String(gasto.tipoServicioNombre || '').toLowerCase();
    const rubNom = String(gasto.rubroNombre || gasto.rubro || '').toLowerCase();
    if (gasto.tipoHoraId || gasto.tipoRecargoId) return true;
    if (tipoNom.includes('hora extra') || tipoNom.includes('recargo')) return true;
    if (rubNom.includes('hora extra') || rubNom.includes('recargo')) return true;
    return false;
}

/** Gasto normal (no HE/rec) que aún requiere datos de legalización. */
export function faltaLegalizacionGastoNormal(gasto) {
    if (!gasto || esGastoLaborHorasExtrasORecargo(gasto)) return false;
    if (gasto.esPendiente || gasto.EsPendiente) return true;
    if (!String(gasto.numeroFactura || '').trim()) return true;
    const adj = String(gasto.facturaPdfUrl || gasto.archivoFactura || '').trim();
    if (!adj) return true;
    return false;
}

/**
 * Si true, se muestran Editar/Eliminar y handleEdit/handleDelete no bloquean.
 * HE/recargo: siempre (comportamiento previo).
 * Montado u otros: siempre.
 * Entregado/Pagado: solo si falta legalización (pendiente, sin factura o sin adjunto).
 */
export function gastoPermiteEdicionTrasContabilidad(gasto) {
    if (!gasto) return false;
    if (esGastoLaborHorasExtrasORecargo(gasto)) return true;
    const st = gasto.estado || '';
    if (st !== 'Entregado' && st !== 'Pagado') return true;
    return faltaLegalizacionGastoNormal(gasto);
}
