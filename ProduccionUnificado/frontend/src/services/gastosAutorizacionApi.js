import api from './apiClient';

export const MODULOS_GASTO = {
    produccion: 'produccion',
    planeacion: 'planeacion',
    sst: 'sst',
    gh: 'gh',
    diseno: 'diseno',
    mantenimiento: 'mantenimiento',
    talleres: 'talleres',
};

export const ESTADOS_AUTORIZACION = {
    pendiente: 'Pendiente',
    autorizada: 'Autorizada',
    noAutorizada: 'NoAutorizada',
};

const BASE = 'gastos-autorizacion';

export function esAutorizadorGastos(displayName, role) {
    if (String(displayName || '').trim().toLowerCase() === 'nohora ortiz') return true;
    return String(role || '')
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .includes('admin');
}

function mapComentario(raw) {
    const respuestasRaw = raw.respuestas ?? raw.Respuestas ?? [];
    return {
        id: String(raw.id ?? raw.Id ?? ''),
        texto: String(raw.texto ?? raw.Texto ?? ''),
        usuarioNombre: String(raw.usuarioNombre ?? raw.UsuarioNombre ?? '').trim() || undefined,
        fecha: String(raw.fecha ?? raw.Fecha ?? ''),
        hora: String(raw.hora ?? raw.Hora ?? ''),
        respuestas: Array.isArray(respuestasRaw) ? respuestasRaw.map(mapComentario) : [],
    };
}

export function contarComentariosAutorizacion(comentarios) {
    if (!Array.isArray(comentarios)) return 0;
    return comentarios.reduce(
        (acc, c) => acc + 1 + contarComentariosAutorizacion(c.respuestas),
        0
    );
}

function mapAutorizacion(raw) {
    return {
        id: String(raw.id ?? raw.Id ?? ''),
        modulo: raw.modulo ?? raw.Modulo ?? '',
        rubroId: raw.rubroId ?? raw.RubroId ?? null,
        rubroNombre: raw.rubroNombre ?? raw.RubroNombre ?? '',
        proveedorId: raw.proveedorId ?? raw.ProveedorId ?? null,
        proveedorNombre: raw.proveedorNombre ?? raw.ProveedorNombre ?? '',
        fechaAproximada: raw.fechaAproximada ?? raw.FechaAproximada ?? '',
        cantidad: Number(raw.cantidad ?? raw.Cantidad ?? 0),
        razon: raw.razon ?? raw.Razon ?? '',
        esSolicitudCredito: Boolean(raw.esSolicitudCredito ?? raw.EsSolicitudCredito),
        esEfectivo: Boolean(raw.esEfectivo ?? raw.EsEfectivo),
        estadoAutorizacion: raw.estadoAutorizacion ?? raw.EstadoAutorizacion ?? '',
        solicitadoPorNombre: raw.solicitadoPorNombre ?? raw.SolicitadoPorNombre ?? '',
        autorizadoPorNombre: raw.autorizadoPorNombre ?? raw.AutorizadoPorNombre ?? '',
        fechaSolicitud: raw.fechaSolicitud ?? raw.FechaSolicitud ?? '',
        fechaResolucion: raw.fechaResolucion ?? raw.FechaResolucion ?? '',
        motivoRechazo: raw.motivoRechazo ?? raw.MotivoRechazo ?? '',
        gastoId: raw.gastoId ?? raw.GastoId ?? null,
        totalComentarios: Number(raw.totalComentarios ?? raw.TotalComentarios ?? 0),
        puedeRegistrarGasto: Boolean(raw.puedeRegistrarGasto ?? raw.PuedeRegistrarGasto),
        puedeAutorizar: Boolean(raw.puedeAutorizar ?? raw.PuedeAutorizar),
        puedeEditar: Boolean(raw.puedeEditar ?? raw.PuedeEditar),
        puedeEliminar: Boolean(raw.puedeEliminar ?? raw.PuedeEliminar),
    };
}

export async function getAutorizacionesGasto(modulo, anio, mes, estado) {
    const params = new URLSearchParams({ modulo: String(modulo) });
    if (anio) params.set('anio', String(anio));
    if (mes) params.set('mes', String(mes));
    if (estado && estado !== 'todos') params.set('estado', estado);
    const res = await api.get(`${BASE}?${params.toString()}`);
    return (res.data ?? []).map(mapAutorizacion);
}

export async function getAutorizacionesGastoConsolidado(filters = {}) {
    const params = new URLSearchParams();
    if (filters.anio) params.set('anio', String(filters.anio));
    if (filters.mes) params.set('mes', String(filters.mes));
    if (filters.modulo) params.set('modulo', String(filters.modulo));
    if (filters.estado && filters.estado !== 'todos') params.set('estado', filters.estado);
    if (filters.search) params.set('search', String(filters.search));
    if (filters.proveedor) params.set('proveedor', String(filters.proveedor));
    if (filters.fechaFiltro) params.set('fechaFiltro', String(filters.fechaFiltro));
    if (filters.soloPendientesRevision) params.set('soloPendientesRevision', 'true');
    const qs = params.toString();
    const res = await api.get(`${BASE}/consolidado${qs ? `?${qs}` : ''}`);
    return (res.data ?? []).map(mapAutorizacion);
}

/** Crea movimientos para solicitudes autorizadas que aún no tienen gasto (sincronización Contabilidad). */
export async function materializarMovimientosAutorizacion() {
    const res = await api.post(`${BASE}/materializar-movimientos`);
    return res.data?.materializados ?? 0;
}

const ETIQUETAS_MODULO = {
    produccion: 'Producción',
    planeacion: 'Planeación',
    sst: 'SST',
    gh: 'Gestión Humana',
    diseno: 'Diseño',
    mantenimiento: 'Mantenimiento',
    talleres: 'Talleres',
};

export function etiquetaModuloGasto(moduloKey) {
    const k = String(moduloKey || '').trim().toLowerCase();
    return ETIQUETAS_MODULO[k] || moduloKey || '—';
}

export function moduloContabilidadToKey(areaLabel) {
    const map = {
        Producción: 'produccion',
        Talleres: 'talleres',
        Mantenimiento: 'mantenimiento',
        'Gestión Humana': 'gh',
        SST: 'sst',
        Planeación: 'planeacion',
        Diseño: 'diseno',
    };
    return map[areaLabel] || areaLabel || '';
}

function buildPayload(payload) {
    return {
        modulo: payload.modulo,
        rubroId: payload.rubroId != null ? String(payload.rubroId) : null,
        rubroNombre: payload.rubroNombre ?? '',
        proveedorId: payload.proveedorId != null ? String(payload.proveedorId) : null,
        proveedorNombre: payload.proveedorNombre ?? '',
        fechaAproximada: payload.fechaAproximada,
        cantidad: Number(payload.cantidad),
        razon: payload.razon,
        esSolicitudCredito: payload.esSolicitudCredito,
        esEfectivo: payload.esEfectivo,
        anio: payload.anio,
        mes: payload.mes,
    };
}

export async function crearAutorizacionGasto(payload) {
    const res = await api.post(BASE, buildPayload(payload));
    return mapAutorizacion(res.data);
}

export async function actualizarAutorizacionGasto(id, payload) {
    const res = await api.put(`${BASE}/${id}`, buildPayload(payload));
    return mapAutorizacion(res.data);
}

export async function eliminarAutorizacionGasto(id) {
    await api.delete(`${BASE}/${id}`);
}

export async function autorizarSolicitudGasto(id) {
    const res = await api.post(`${BASE}/${id}/autorizar`);
    return mapAutorizacion(res.data);
}

export async function rechazarSolicitudGasto(id, motivoRechazo) {
    const res = await api.post(`${BASE}/${id}/rechazar`, { motivoRechazo });
    return mapAutorizacion(res.data);
}

export async function getComentariosAutorizacionGasto(id) {
    const res = await api.get(`${BASE}/${id}/comentarios`);
    return (res.data ?? []).map(mapComentario);
}

export async function agregarComentarioAutorizacionGasto(id, payload) {
    const res = await api.post(`${BASE}/${id}/comentarios`, payload);
    return mapComentario(res.data);
}

export function colorEstadoAutorizacion(estado) {
    switch (estado) {
        case ESTADOS_AUTORIZACION.autorizada:
            return '#10B981';
        case ESTADOS_AUTORIZACION.noAutorizada:
            return '#EF4444';
        default:
            return '#F59E0B';
    }
}

export function labelEstadoAutorizacion(estado) {
    switch (estado) {
        case ESTADOS_AUTORIZACION.autorizada:
            return 'Autorizada';
        case ESTADOS_AUTORIZACION.noAutorizada:
            return 'No autorizada';
        default:
            return 'Pendiente';
    }
}
