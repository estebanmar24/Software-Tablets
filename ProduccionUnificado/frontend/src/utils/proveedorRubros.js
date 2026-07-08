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

export function proveedorMatchesRubro(proveedor, rubroId) {
    if (!rubroId) return true;
    const rid = Number(rubroId);
    return getProveedorRubroIds(proveedor).includes(rid);
}

export function getProveedorRubrosLabel(proveedor) {
    if (!proveedor) return 'Sin rubro asignado';
    if (proveedor.rubroNombre) return proveedor.rubroNombre;
    if (Array.isArray(proveedor.rubros) && proveedor.rubros.length > 0) {
        return proveedor.rubros.map(r => r.nombre).join(', ');
    }
    if (proveedor.rubro?.nombre) return proveedor.rubro.nombre;
    return 'Sin rubro asignado';
}
