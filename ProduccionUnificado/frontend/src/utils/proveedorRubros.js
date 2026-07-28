/** IDs de rubros asignados a un proveedor (API nueva o legacy RubroId). */
export function getProveedorRubroIds(proveedor) {
    if (!proveedor) return [];
    if (Array.isArray(proveedor.rubroIds) && proveedor.rubroIds.length > 0) {
        return proveedor.rubroIds.map(id => Number(id)).filter(id => id > 0);
    }
    if (proveedor.rubroId != null && proveedor.rubroId !== '') {
        return [Number(proveedor.rubroId)];
    }
    return [];
}

/** Rubro(s) de un proveedor vía tipo de servicio (SST, GH). */
export function getProveedorRubroIdsViaTipoServicio(proveedor, tiposServicio = []) {
    const tipoId = proveedor?.tipoServicioId ?? proveedor?.TipoServicioId;
    if (!tipoId || !Array.isArray(tiposServicio) || tiposServicio.length === 0) return [];
    const tipo = tiposServicio.find((t) => Number(t.id) === Number(tipoId));
    if (!tipo) return [];
    const rid = tipo.rubroId ?? tipo.RubroId;
    return rid != null && rid !== '' ? [Number(rid)] : [];
}

export function getProveedorRubroIdsResolved(proveedor, tiposServicio = []) {
    const direct = getProveedorRubroIds(proveedor);
    if (direct.length > 0) return direct;
    return getProveedorRubroIdsViaTipoServicio(proveedor, tiposServicio);
}

export function proveedorMatchesRubro(proveedor, rubroId, tiposServicio = []) {
    if (!rubroId) return true;
    const rid = Number(rubroId);
    return getProveedorRubroIdsResolved(proveedor, tiposServicio).includes(rid);
}

export function getProveedorRubrosLabel(proveedor, tiposServicio = []) {
    if (!proveedor) return 'Sin rubro asignado';
    if (proveedor.rubroNombre) return proveedor.rubroNombre;
    if (Array.isArray(proveedor.rubros) && proveedor.rubros.length > 0) {
        return proveedor.rubros.map(r => r.nombre).join(', ');
    }
    if (proveedor.rubro?.nombre) return proveedor.rubro.nombre;
    const tipoId = proveedor.tipoServicioId ?? proveedor.TipoServicioId;
    if (tipoId && Array.isArray(tiposServicio) && tiposServicio.length > 0) {
        const tipo = tiposServicio.find((t) => Number(t.id) === Number(tipoId));
        if (tipo?.rubroNombre) return tipo.rubroNombre;
        if (tipo?.nombre) return tipo.nombre;
    }
    if (proveedor.tipoServicioNombre) return proveedor.tipoServicioNombre;
    return 'Sin rubro asignado';
}
