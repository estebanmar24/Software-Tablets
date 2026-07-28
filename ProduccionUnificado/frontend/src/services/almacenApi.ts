import { api } from './productionApi';
import type {
    Requisicion,
    ProveedorCatalogo,
    ProductoInsumo,
    OrdenProduccionAlmacen,
    DatosPedido,
    TipoRequisicionId,
    TipoRequisicion,
    RecepcionLineaProveedor,
    OrdenCompra,
    ConsolidarPedidoPayload,
    RequisicionComentario,
} from '../data/almacenMockData';

const BASE = 'almacen';

export interface AlmacenNotificacionesConfig {
    nombreDestino: string;
    correosDestino: string[];
}

export interface AlmacenCatalogosResponse {
    tiposRequisicion: TipoRequisicion[];
    productos: ProductoInsumo[];
    unidadesMedida: string[];
    notificaciones?: AlmacenNotificacionesConfig;
}

export interface RequisicionWritePayload {
    tipoRequisicionId: TipoRequisicionId;
    ordenProduccionId?: string;
    ordenProduccionNumero?: string;
    cliente?: string;
    referencia?: string;
    productoId: string;
    fechaSolicitud?: string;
    fechaRequerida: string;
    cantidad: number;
    unidad: string;
    observacion?: string;
}

function mapProducto(p: {
    id: string;
    nombre: string;
    descripcion?: string;
    costoEstandar?: number;
    tipoRequisicion: string;
    unidadSugerida?: string;
}): ProductoInsumo {
    return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        costoEstandar: p.costoEstandar != null ? Number(p.costoEstandar) : undefined,
        tipoRequisicion: p.tipoRequisicion as TipoRequisicionId,
        unidadSugerida: p.unidadSugerida,
    };
}

function mapProveedor(p: Record<string, unknown>): ProveedorCatalogo {
    const telefonoMovil = String(p.telefonoMovil ?? p.TelefonoMovil ?? '').trim() || undefined;
    const telefonoTrabajo = String(p.telefonoTrabajo ?? p.TelefonoTrabajo ?? '').trim() || undefined;
    const telefonoLegacy = String(p.telefono ?? p.Telefono ?? '').trim();
    return {
        id: String(p.id ?? p.Id ?? ''),
        nombre: String(p.nombre ?? p.Nombre ?? ''),
        nit: String(p.nit ?? p.Nit ?? ''),
        correo: String(p.correo ?? p.Correo ?? '').trim() || undefined,
        telefonoTrabajo,
        telefonoMovil,
        direccion: String(p.direccion ?? p.Direccion ?? '').trim() || undefined,
        categoria: String(p.categoria ?? p.Categoria ?? '').trim() || undefined,
        responsableIva: Boolean(p.responsableIva ?? p.ResponsableIva ?? false),
        telefono: telefonoLegacy || telefonoMovil || telefonoTrabajo || '',
    };
}

function mapComentario(raw: Record<string, unknown>): RequisicionComentario {
    const respuestasRaw = (raw.respuestas ?? raw.Respuestas ?? []) as Record<string, unknown>[];
    return {
        id: String(raw.id ?? raw.Id ?? ''),
        texto: String(raw.texto ?? raw.Texto ?? ''),
        usuarioNombre: (() => {
            const s = String(raw.usuarioNombre ?? raw.UsuarioNombre ?? '').trim();
            return s || undefined;
        })(),
        fecha: String(raw.fecha ?? raw.Fecha ?? ''),
        hora: String(raw.hora ?? raw.Hora ?? ''),
        esLegacy: Boolean(raw.esLegacy ?? raw.EsLegacy ?? false),
        respuestas: respuestasRaw.map(mapComentario),
    };
}

/** Normaliza la respuesta del backend al tipo usado en pantallas. */
export function mapRequisicionApi(raw: Record<string, unknown>): Requisicion {
    const r = raw as Requisicion;
    const pedRaw = raw.pedido as Record<string, unknown> | undefined;
    return {
        ...r,
        creadoPorNombre: String(
            r.creadoPorNombre ?? raw.creadoPorNombre ?? raw.CreadoPorNombre ?? ''
        ).trim() || undefined,
        horaRegistro: String(
            r.horaRegistro ?? raw.horaRegistro ?? raw.HoraRegistro ?? ''
        ).trim() || undefined,
        tipoRequisicion: (r.tipoRequisicion ?? raw.tipoRequisicion) as TipoRequisicionId,
        pedido: r.pedido
            ? {
                  ...r.pedido,
                  procesadoPorNombre: (() => {
                      const val =
                          r.pedido?.procesadoPorNombre ??
                          pedRaw?.procesadoPorNombre ??
                          pedRaw?.ProcesadoPorNombre;
                      const s = val != null ? String(val).trim() : '';
                      return s || undefined;
                  })(),
                  precioUnitario: (() => {
                      const ped = raw.pedido as Record<string, unknown> | undefined;
                      const val =
                          r.pedido?.precioUnitario ?? ped?.precioUnitario ?? ped?.PrecioUnitario;
                      if (val == null || val === '') return undefined;
                      const n = Number(val);
                      return Number.isFinite(n) && n > 0 ? n : undefined;
                  })(),
                  proveedores: (r.pedido.proveedores ?? []).map((p) => {
                      const rawProv = p as Record<string, unknown>;
                      const precio = p.precioUnitario ?? rawProv.PrecioUnitario;
                      const precioNum =
                          precio != null && precio !== '' ? Number(precio) : undefined;
                      const numOcRaw = p.numeroOrdenCompra ?? rawProv.NumeroOrdenCompra;
                      const numOc =
                          numOcRaw != null && numOcRaw !== '' ? Number(numOcRaw) : undefined;
                      return {
                          ...p,
                          precioUnitario:
                              precioNum != null && Number.isFinite(precioNum) && precioNum > 0
                                  ? precioNum
                                  : undefined,
                          numeroOrdenCompra:
                              numOc != null && Number.isFinite(numOc) && numOc > 0 ? numOc : undefined,
                          ordenCompraId: (() => {
                              const raw = String(
                                  p.ordenCompraId ?? rawProv.ordenCompraId ?? rawProv.OrdenCompraId ?? ''
                              ).trim();
                              return raw || undefined;
                          })(),
                          recibido: Boolean(p.recibido ?? rawProv.recibido ?? rawProv.Recibido ?? false),
                          pagado: Boolean(p.pagado ?? rawProv.pagado ?? rawProv.Pagado ?? false),
                          formaPago: (() => {
                              const raw = String(
                                  p.formaPago ?? rawProv.formaPago ?? rawProv.FormaPago ?? ''
                              )
                                  .trim()
                                  .toLowerCase();
                              if (raw === 'credito' || raw === 'efectivo' || raw === 'contado') return raw;
                              return undefined;
                          })(),
                          precioEspecial: Boolean(
                              p.precioEspecial ?? rawProv.precioEspecial ?? rawProv.PrecioEspecial ?? false
                          ),
                          comentarioPrecioEspecial: (() => {
                              const val =
                                  p.comentarioPrecioEspecial ??
                                  rawProv.comentarioPrecioEspecial ??
                                  rawProv.ComentarioPrecioEspecial;
                              const s = val != null ? String(val).trim() : '';
                              return s || undefined;
                          })(),
                          proformaUrl: (() => {
                              const val = p.proformaUrl ?? rawProv.proformaUrl ?? rawProv.ProformaUrl;
                              const s = val != null ? String(val).trim() : '';
                              return s || undefined;
                          })(),
                          proformaNombre: (() => {
                              const val = p.proformaNombre ?? rawProv.proformaNombre ?? rawProv.ProformaNombre;
                              const s = val != null ? String(val).trim() : '';
                              return s || undefined;
                          })(),
                      };
                  }),
              }
            : undefined,
        recepcion: r.recepcion?.lineas?.length
            ? {
                  lineas: (r.recepcion.lineas ?? []).map((l: Record<string, unknown>) => ({
                      proveedorId: String(l.proveedorId ?? l.ProveedorId ?? ''),
                      nombreProveedor: String(l.nombreProveedor ?? l.NombreProveedor ?? ''),
                      codigoUsuario: String(l.codigoUsuario ?? l.CodigoUsuario ?? ''),
                      registradoPorNombre: (() => {
                          const val = l.registradoPorNombre ?? l.RegistradoPorNombre;
                          const s = val != null ? String(val).trim() : '';
                          return s || undefined;
                      })(),
                      fechaLlegada: String(l.fechaLlegada ?? l.FechaLlegada ?? ''),
                      calidadEsperada: Boolean(l.calidadEsperada ?? l.CalidadEsperada),
                      motivoCalidadNo: (l.motivoCalidadNo ?? l.MotivoCalidadNo) as string | undefined,
                      facturaEntregada: Boolean(l.facturaEntregada ?? l.FacturaEntregada),
                      motivoFacturaNo: (l.motivoFacturaNo ?? l.MotivoFacturaNo) as string | undefined,
                      cantidadRecibida: Number(l.cantidadRecibida ?? l.CantidadRecibida ?? 0),
                      cantidadPedidaEnMomento: Number(l.cantidadPedidaEnMomento ?? l.CantidadPedidaEnMomento ?? 0),
                      pedidoCompleto: Boolean(l.pedidoCompleto ?? l.PedidoCompleto),
                      motivoCantidadParcial: (l.motivoCantidadParcial ?? l.MotivoCantidadParcial) as
                          | string
                          | undefined,
                      nuevaFechaEntrega: (l.nuevaFechaEntrega ?? l.NuevaFechaEntrega) as string | undefined,
                  })),
              }
            : undefined,
        comentarios: (() => {
            const list = (raw.comentarios ?? raw.Comentarios ?? []) as Record<string, unknown>[];
            return list.length ? list.map(mapComentario) : undefined;
        })(),
        totalComentarios: (() => {
            const val = raw.totalComentarios ?? raw.TotalComentarios;
            if (val == null || val === '') return undefined;
            const n = Number(val);
            return Number.isFinite(n) ? n : undefined;
        })(),
    };
}

export async function getCatalogos(): Promise<AlmacenCatalogosResponse> {
    const res = await api.get(`${BASE}/catalogos`);
    const data = res.data;
    return {
        tiposRequisicion: data.tiposRequisicion ?? [],
        productos: (data.productos ?? []).map(mapProducto),
        unidadesMedida: data.unidadesMedida ?? [],
        notificaciones: data.notificaciones
            ? {
                  nombreDestino: data.notificaciones.nombreDestino ?? '',
                  correosDestino: data.notificaciones.correosDestino ?? [],
              }
            : undefined,
    };
}

export async function getProveedores(q?: string, limit = 5000): Promise<ProveedorCatalogo[]> {
    const res = await api.get(`${BASE}/proveedores`, { params: { q, limit } });
    return (res.data ?? []).map(mapProveedor);
}

export interface ImportarProveedoresExcelResult {
    importados: number;
    actualizados: number;
    omitidosDuplicados: number;
    filasVacias: number;
    filasInvalidas: number;
    filasConNit: number;
    filasConTelefono: number;
    filasConCorreo: number;
    columnasDetectadas: string;
    proveedores: ProveedorCatalogo[];
}

type ArchivoExcelImport =
    | File
    | Blob
    | { uri: string; name: string; type?: string };

export interface ImportarProductosExcelResult {
    importados: number;
    omitidosDuplicados: number;
    filasVacias: number;
    filasInvalidas: number;
    productos: ProductoInsumo[];
}

export async function importarProductosExcel(
    file: ArchivoExcelImport,
    fileName = 'productos.xlsx'
): Promise<ImportarProductosExcelResult> {
    const formData = new FormData();
    if ('uri' in file) {
        formData.append('file', file as unknown as Blob);
    } else {
        formData.append('file', file, fileName);
    }
    const res = await api.post(`${BASE}/productos/importar-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    const d = res.data ?? {};
    return {
        importados: Number(d.importados ?? d.Importados ?? 0),
        omitidosDuplicados: Number(d.omitidosDuplicados ?? d.OmitidosDuplicados ?? 0),
        filasVacias: Number(d.filasVacias ?? d.FilasVacias ?? 0),
        filasInvalidas: Number(d.filasInvalidas ?? d.FilasInvalidas ?? 0),
        productos: (d.productos ?? d.Productos ?? []).map(mapProducto),
    };
}

export async function importarProveedoresExcel(
    file: ArchivoExcelImport,
    fileName = 'proveedores.xlsx'
): Promise<ImportarProveedoresExcelResult> {
    const formData = new FormData();
    if ('uri' in file) {
        formData.append('file', file as unknown as Blob);
    } else {
        formData.append('file', file, fileName);
    }
    const res = await api.post(`${BASE}/proveedores/importar-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    const d = res.data ?? {};
    return {
        importados: Number(d.importados ?? d.Importados ?? 0),
        actualizados: Number(d.actualizados ?? d.Actualizados ?? 0),
        omitidosDuplicados: Number(d.omitidosDuplicados ?? d.OmitidosDuplicados ?? 0),
        filasVacias: Number(d.filasVacias ?? d.FilasVacias ?? 0),
        filasInvalidas: Number(d.filasInvalidas ?? d.FilasInvalidas ?? 0),
        filasConNit: Number(d.filasConNit ?? d.FilasConNit ?? 0),
        filasConTelefono: Number(d.filasConTelefono ?? d.FilasConTelefono ?? 0),
        filasConCorreo: Number(d.filasConCorreo ?? d.FilasConCorreo ?? 0),
        columnasDetectadas: String(d.columnasDetectadas ?? d.ColumnasDetectadas ?? ''),
        proveedores: (d.proveedores ?? d.Proveedores ?? []).map(mapProveedor),
    };
}

export type ProveedorCatalogoPayload = {
    nombre: string;
    nit?: string;
    correo?: string;
    telefonoTrabajo?: string;
    telefonoMovil?: string;
    direccion?: string;
    categoria?: string;
    responsableIva?: boolean;
};

export async function createProveedor(payload: ProveedorCatalogoPayload): Promise<ProveedorCatalogo> {
    const res = await api.post(`${BASE}/proveedores`, payload);
    return mapProveedor(res.data);
}

export async function updateProveedor(id: string, payload: ProveedorCatalogoPayload): Promise<ProveedorCatalogo> {
    const res = await api.put(`${BASE}/proveedores/${id}`, payload);
    return mapProveedor(res.data);
}

export async function deleteProveedor(id: string): Promise<void> {
    await api.delete(`${BASE}/proveedores/${id}`);
}

export async function vaciarCatalogoProveedores(): Promise<void> {
    await api.delete(`${BASE}/proveedores/todos`);
}

export type ProductoCatalogoPayload = {
    nombre: string;
    descripcion?: string;
    costoEstandar?: number;
    tipoRequisicion: TipoRequisicionId;
    unidadSugerida?: string;
};

export async function createProducto(payload: ProductoCatalogoPayload): Promise<ProductoInsumo> {
    const res = await api.post(`${BASE}/productos`, {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        costoEstandar: payload.costoEstandar,
        tipoRequisicion: payload.tipoRequisicion,
        unidadSugerida: payload.unidadSugerida,
    });
    return mapProducto(res.data);
}

export async function updateProducto(id: string, payload: ProductoCatalogoPayload): Promise<ProductoInsumo> {
    const res = await api.put(`${BASE}/productos/${id}`, {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        costoEstandar: payload.costoEstandar,
        tipoRequisicion: payload.tipoRequisicion,
        unidadSugerida: payload.unidadSugerida,
    });
    return mapProducto(res.data);
}

export async function deleteProducto(id: string): Promise<void> {
    await api.delete(`${BASE}/productos/${id}`);
}

/** Misma fuente que la vista de operarios y "Buscar por OP" en captura mensual. */
export async function listarOpsUnicos(): Promise<string[]> {
    const res = await api.get('produccion/ops-unicos');
    if (!Array.isArray(res.data)) return [];
    return res.data.map((op) => String(op).trim()).filter(Boolean);
}

export async function buscarOrdenesProduccion(q?: string, limit = 50): Promise<OrdenProduccionAlmacen[]> {
    const term = q?.trim() ?? '';
    const res = await api.get(`${BASE}/ordenes-produccion`, {
        params: { q: term || undefined, limit },
    });
    return (res.data ?? []).map((op: OrdenProduccionAlmacen) => ({
        id: String(op.id),
        numero: op.numero,
        cliente: op.cliente ?? '',
        referencia: op.referencia ?? '',
    }));
}

export async function getRequisiciones(params?: {
    tipo?: TipoRequisicionId;
    estado?: string;
    q?: string;
}): Promise<Requisicion[]> {
    const res = await api.get(`${BASE}/requisiciones`, { params });
    return (res.data ?? []).map((r: Record<string, unknown>) => mapRequisicionApi(r));
}

export async function getRequisicion(id: string | number): Promise<Requisicion> {
    const res = await api.get(`${BASE}/requisiciones/${id}`);
    return mapRequisicionApi(res.data);
}

export async function createRequisicion(payload: RequisicionWritePayload): Promise<Requisicion> {
    const res = await api.post(`${BASE}/requisiciones`, payload);
    return mapRequisicionApi(res.data);
}

export async function updateRequisicion(id: string | number, payload: RequisicionWritePayload): Promise<Requisicion> {
    const res = await api.put(`${BASE}/requisiciones/${id}`, payload);
    return mapRequisicionApi(res.data);
}

export async function getComentariosRequisicion(id: string | number): Promise<RequisicionComentario[]> {
    const res = await api.get(`${BASE}/requisiciones/${id}/comentarios`);
    return (res.data ?? []).map((c: Record<string, unknown>) => mapComentario(c));
}

export async function agregarComentarioRequisicion(
    id: string | number,
    payload: { texto: string; parentId?: string }
): Promise<RequisicionComentario> {
    const res = await api.post(`${BASE}/requisiciones/${id}/comentarios`, payload);
    return mapComentario(res.data);
}

export async function guardarPedidoRequisicion(requisicionId: string | number, pedido: DatosPedido): Promise<Requisicion> {
    const res = await api.put(`${BASE}/requisiciones/${requisicionId}/pedido`, {
        fechaPedido: pedido.fechaPedido,
        fechaEntregaEstimada: pedido.fechaEntregaEstimada,
        proveedores: pedido.proveedores.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            cantidad: p.cantidad,
            nit: p.nit,
            telefono: p.telefono,
            catalogoId: p.catalogoId,
            fechaEntregaEstimada: p.fechaEntregaEstimada,
            precioUnitario: p.precioUnitario ?? null,
            precioEspecial: p.precioEspecial === true,
            comentarioPrecioEspecial: p.comentarioPrecioEspecial?.trim() || null,
            recibido: p.recibido ?? false,
            categoria: p.categoria ?? null,
            responsableIva: p.responsableIva ?? false,
            agregarAOrdenCompraId: p.agregarAOrdenCompraId ?? null,
            proformaUrl: p.proformaUrl?.trim() || null,
            proformaNombre: p.proformaNombre?.trim() || null,
        })),
    });
    return mapRequisicionApi(res.data);
}

export async function uploadProformaAlmacen(file: File): Promise<{ url: string; nombre?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`${BASE}/upload-proforma`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    const d = res.data ?? {};
    return {
        url: String(d.url ?? d.Url ?? ''),
        nombre: String(d.nombre ?? d.Nombre ?? file.name ?? '').trim() || undefined,
    };
}

export async function marcarProveedorPagado(
    requisicionId: string | number,
    proveedorId: string | number,
    pagado = true,
    formaPago?: 'credito' | 'efectivo' | 'contado'
): Promise<Requisicion> {
    const res = await api.patch(`${BASE}/requisiciones/${requisicionId}/pedido/proveedores/${proveedorId}/pagado`, {
        pagado,
        formaPago: pagado ? formaPago : null,
    });
    return mapRequisicionApi(res.data);
}

export async function registrarRecepcionRequisicion(
    requisicionId: string | number,
    linea: RecepcionLineaProveedor
): Promise<Requisicion> {
    const res = await api.post(`${BASE}/requisiciones/${requisicionId}/recepciones`, {
        proveedorId: linea.proveedorId,
        codigoUsuario: linea.codigoUsuario,
        fechaLlegada: linea.fechaLlegada,
        calidadEsperada: linea.calidadEsperada,
        motivoCalidadNo: linea.motivoCalidadNo,
        facturaEntregada: linea.facturaEntregada,
        motivoFacturaNo: linea.motivoFacturaNo,
        cantidadRecibida: linea.cantidadRecibida,
        cantidadPedidaEnMomento: linea.cantidadPedidaEnMomento,
        pedidoCompleto: linea.pedidoCompleto,
        motivoCantidadParcial: linea.motivoCantidadParcial,
        nuevaFechaEntrega: linea.nuevaFechaEntrega,
    });
    return mapRequisicionApi(res.data);
}

export function mergeRequisicionEnLista(lista: Requisicion[], actualizada: Requisicion): Requisicion[] {
    const idx = lista.findIndex((r) => r.id === actualizada.id);
    if (idx < 0) return [actualizada, ...lista];
    const copia = [...lista];
    copia[idx] = actualizada;
    return copia;
}

/** Provisional pruebas: elimina requisición, pedido y recepciones asociadas. */
export async function eliminarRequisicion(requisicionId: string | number): Promise<void> {
    await api.delete(`${BASE}/requisiciones/${requisicionId}`);
}

/** Provisional pruebas: vacía todo el módulo operativo y reinicia IDs. */
export async function resetDatosPruebasAlmacen(): Promise<void> {
    await api.delete(`${BASE}/pruebas/reset`);
}

function mapOrdenCompraLineaApi(raw: Record<string, unknown>) {
    const precio = raw.precioUnitario ?? raw.PrecioUnitario;
    const precioNum = precio != null && precio !== '' ? Number(precio) : undefined;
    return {
        id: String(raw.id ?? raw.Id ?? ''),
        pedidoProveedorId: String(raw.pedidoProveedorId ?? raw.PedidoProveedorId ?? ''),
        requisicionId: String(raw.requisicionId ?? raw.RequisicionId ?? ''),
        requisicionCodigo: String(raw.requisicionCodigo ?? raw.RequisicionCodigo ?? ''),
        producto: String(raw.producto ?? raw.Producto ?? ''),
        ordenProduccion: String(raw.ordenProduccion ?? raw.OrdenProduccion ?? ''),
        referencia: String(raw.referencia ?? raw.Referencia ?? ''),
        cliente: String(raw.cliente ?? raw.Cliente ?? ''),
        cantidad: Number(raw.cantidad ?? raw.Cantidad ?? 0),
        unidad: String(raw.unidad ?? raw.Unidad ?? ''),
        precioUnitario:
            precioNum != null && Number.isFinite(precioNum) && precioNum > 0 ? precioNum : undefined,
        precioEspecial: Boolean(raw.precioEspecial ?? raw.PrecioEspecial ?? false),
        comentarioPrecioEspecial: (() => {
            const val = raw.comentarioPrecioEspecial ?? raw.ComentarioPrecioEspecial;
            const s = val != null ? String(val).trim() : '';
            return s || undefined;
        })(),
        fechaEntregaEstimada: String(
            raw.fechaEntregaEstimada ?? raw.FechaEntregaEstimada ?? ''
        ).trim() || undefined,
        recibido: Boolean(raw.recibido ?? raw.Recibido ?? false),
        pagado: Boolean(raw.pagado ?? raw.Pagado ?? false),
    };
}

export function mapOrdenCompraApi(raw: Record<string, unknown>): OrdenCompra {
    const lineasRaw = (raw.lineas ?? raw.Lineas ?? []) as Record<string, unknown>[];
    return {
        id: String(raw.id ?? raw.Id ?? ''),
        numeroOrdenCompra: Number(raw.numeroOrdenCompra ?? raw.NumeroOrdenCompra ?? 0),
        nombreProveedor: String(raw.nombreProveedor ?? raw.NombreProveedor ?? ''),
        nit: String(raw.nit ?? raw.Nit ?? '').trim() || undefined,
        telefono: String(raw.telefono ?? raw.Telefono ?? '').trim() || undefined,
        catalogoId: String(raw.catalogoId ?? raw.CatalogoId ?? '').trim() || undefined,
        fechaPedido: String(raw.fechaPedido ?? raw.FechaPedido ?? ''),
        fechaEntregaEstimada: String(raw.fechaEntregaEstimada ?? raw.FechaEntregaEstimada ?? ''),
        estado: String(raw.estado ?? raw.Estado ?? 'Emitida'),
        pagado: Boolean(raw.pagado ?? raw.Pagado ?? false),
        formaPago: String(raw.formaPago ?? raw.FormaPago ?? '').trim() || undefined,
        procesadoPorNombre: String(raw.procesadoPorNombre ?? raw.ProcesadoPorNombre ?? '').trim() || undefined,
        lineas: lineasRaw.map(mapOrdenCompraLineaApi),
    };
}

export async function getOrdenCompra(id: string | number): Promise<OrdenCompra> {
    const res = await api.get(`${BASE}/ordenes-compra/${id}`);
    return mapOrdenCompraApi(res.data);
}

export async function listarOrdenesCompra(estado?: string): Promise<OrdenCompra[]> {
    const res = await api.get(`${BASE}/ordenes-compra`, { params: estado ? { estado } : undefined });
    const list = (res.data ?? []) as Record<string, unknown>[];
    return list.map(mapOrdenCompraApi);
}

export async function listarOrdenesCompraPorProveedor(proveedor: {
    catalogoId?: string;
    nombre: string;
    nit?: string;
}): Promise<OrdenCompra[]> {
    const nombre = proveedor.nombre?.trim();
    if (!nombre) return [];
    const res = await api.get(`${BASE}/ordenes-compra`, {
        params: {
            estado: 'Emitida',
            proveedorCatalogoId: proveedor.catalogoId || undefined,
            nombreProveedor: nombre,
            nit: proveedor.nit?.trim() || undefined,
        },
    });
    const list = (res.data ?? []) as Record<string, unknown>[];
    return list.map(mapOrdenCompraApi);
}

export async function consolidarPedidoOc(payload: ConsolidarPedidoPayload): Promise<{
    ordenCompra: OrdenCompra;
    requisiciones: Requisicion[];
}> {
    const res = await api.post(`${BASE}/ordenes-compra/consolidar`, {
        fechaPedido: payload.fechaPedido,
        fechaEntregaEstimada: payload.fechaEntregaEstimada,
        proveedor: {
            nombre: payload.proveedor.nombre,
            cantidad: payload.proveedor.cantidad ?? 0,
            nit: payload.proveedor.nit,
            telefono: payload.proveedor.telefono,
            catalogoId: payload.proveedor.catalogoId,
            fechaEntregaEstimada: payload.proveedor.fechaEntregaEstimada,
            precioUnitario: payload.proveedor.precioUnitario ?? null,
            categoria: payload.proveedor.categoria ?? null,
            responsableIva: payload.proveedor.responsableIva ?? false,
        },
        lineas: payload.lineas.map((l) => ({
            requisicionId: l.requisicionId,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario ?? null,
            precioEspecial: l.precioEspecial === true,
            comentarioPrecioEspecial: l.comentarioPrecioEspecial?.trim() || null,
            fechaEntregaEstimada: l.fechaEntregaEstimada,
        })),
        agregarAOrdenCompraId: payload.agregarAOrdenCompraId,
    });
    const data = res.data as Record<string, unknown>;
    const ordenRaw = (data.ordenCompra ?? data.OrdenCompra ?? {}) as Record<string, unknown>;
    const reqsRaw = (data.requisiciones ?? data.Requisiciones ?? []) as Record<string, unknown>[];
    return {
        ordenCompra: mapOrdenCompraApi(ordenRaw),
        requisiciones: reqsRaw.map(mapRequisicionApi),
    };
}

export function extraerMensajeErrorApi(error: unknown, fallback: string): string {
    const e = error as { response?: { data?: { message?: string } }; message?: string };
    return e?.response?.data?.message ?? e?.message ?? fallback;
}
