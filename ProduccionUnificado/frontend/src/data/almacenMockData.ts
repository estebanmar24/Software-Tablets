/** Datos estáticos de demostración para el módulo Almacén (solo frontend). */

export interface OrdenProduccionAlmacen {
    id: string;
    numero: string;
    cliente: string;
    referencia: string;
}

/** Tipos de requisición (equivalente a hojas del Excel de solicitud de insumos). */
export type TipoRequisicionId =
    | 'consumo_diario'
    | 'cajas_empaque'
    | 'gomas_adhesivos'
    | 'pantone';

export interface TipoRequisicion {
    id: TipoRequisicionId;
    label: string;
    /** Color de acento para la pestaña activa (estilo hoja Excel). */
    accentColor: string;
}

export const TIPOS_REQUISICION: TipoRequisicion[] = [
    { id: 'consumo_diario', label: 'Insumos de Consumo Diario', accentColor: '#22C55E' },
    { id: 'cajas_empaque', label: 'Cajas y Empaque', accentColor: '#3B82F6' },
    { id: 'gomas_adhesivos', label: 'Gomas y Adhesivos', accentColor: '#EAB308' },
    { id: 'pantone', label: 'Tinta', accentColor: '#A855F7' },
];

export interface ProductoInsumo {
    id: string;
    nombre: string;
    descripcion?: string;
    costoEstandar?: number;
    tipoRequisicion: TipoRequisicionId;
    unidadSugerida?: string;
}

/** Proveedor maestro (catálogo reutilizable en pedidos). */
export interface ProveedorCatalogo {
    id: string;
    nombre: string;
    nit: string;
    correo?: string;
    telefonoTrabajo?: string;
    telefonoMovil?: string;
    direccion?: string;
    /** Clasificación fiscal (p. ej. declarante). */
    categoria?: string;
    /** Si aplica, la orden de compra incluye IVA automáticamente. */
    responsableIva?: boolean;
    /** Teléfono principal (móvil o trabajo) para pedidos. */
    telefono: string;
}

/** Categorías fiscales — empresas. */
export const CATEGORIAS_PROVEEDOR_EMPRESA = [
    { id: 'declarante', label: 'Declarante' },
    { id: 'no_declarante', label: 'No declarante' },
    { id: 'rst', label: 'RST' },
    { id: 'autoretenedor', label: 'Autoretenedor' },
] as const;

/** Categorías fiscales — personas naturales. */
export const CATEGORIAS_PROVEEDOR_PERSONA = [
    { id: 'persona_no_responsable_iva', label: 'No responsable IVA' },
    { id: 'persona_responsable_iva', label: 'Responsable IVA' },
] as const;

export const CATEGORIAS_PROVEEDOR = [
    ...CATEGORIAS_PROVEEDOR_EMPRESA,
    ...CATEGORIAS_PROVEEDOR_PERSONA,
] as const;

export const GRUPOS_CATEGORIAS_PROVEEDOR = [
    { titulo: 'Empresa', categorias: CATEGORIAS_PROVEEDOR_EMPRESA },
    { titulo: 'Persona natural', categorias: CATEGORIAS_PROVEEDOR_PERSONA },
] as const;

export type CategoriaProveedorId = (typeof CATEGORIAS_PROVEEDOR)[number]['id'];

/** Categorías que siempre llevan IVA en la orden de compra. */
export function responsableIvaDesdeCategoria(categoria?: string): boolean {
    return (
        categoria === 'declarante' ||
        categoria === 'autoretenedor' ||
        categoria === 'persona_responsable_iva'
    );
}

export interface ProveedorAsignado {
    id: string;
    nombre: string;
    cantidad: number;
    nit?: string;
    telefono?: string;
    /** Referencia al registro del catálogo, si se eligió desde ahí. */
    catalogoId?: string;
    categoria?: string;
    responsableIva?: boolean;
    /** Fecha estimada de llegada de este proveedor (obligatoria en pedidos con varios proveedores). */
    fechaEntregaEstimada?: string;
    /** Envío de este proveedor ya recibido en almacén. */
    recibido?: boolean;
    /** Pago registrado a este proveedor. */
    pagado?: boolean;
    /** Medio de pago: credito | efectivo | contado */
    formaPago?: 'credito' | 'efectivo' | 'contado';
    /** Precio unitario acordado con este proveedor para el producto. */
    precioUnitario?: number;
    /** Si true, el precio difiere del costo estándar del catálogo. */
    precioEspecial?: boolean;
    /** Motivo obligatorio cuando precioEspecial es true. */
    comentarioPrecioEspecial?: string;
    /** Texto del precio mientras se edita (ej. 64033,61); no se persiste en API. */
    precioUnitarioTexto?: string;
    /** Texto de la cantidad mientras se edita (permite 20,9); no se persiste en API. */
    cantidadTexto?: string;
    /** Consecutivo global de orden de compra (cabecera Almacen_OrdenesCompra). */
    numeroOrdenCompra?: number;
    /** Id de la orden de compra consolidada (varias requisiciones pueden compartirla). */
    ordenCompraId?: string;
    /** Al guardar: adjuntar línea a esta OC existente (opcional). */
    agregarAOrdenCompraId?: string;
    /** Número visible de la OC elegida (solo UI). */
    agregarAOrdenCompraNumero?: number;
    /** Ruta relativa del documento proforma subido. */
    proformaUrl?: string;
    /** Nombre original del archivo proforma. */
    proformaNombre?: string;
}

export function formatearConsecutivoOrdenCompra(numero: number): string {
    if (!Number.isFinite(numero) || numero <= 0) return '';
    return String(Math.trunc(numero)).padStart(3, '0');
}

export function labelFormaPagoAlmacen(forma?: string): string {
    if (forma === 'credito') return 'Crédito';
    if (forma === 'efectivo') return 'Efectivo';
    if (forma === 'contado') return 'Contado';
    return '';
}

export function textoIngresadoPorRequisicion(req: Requisicion): string {
    return req.creadoPorNombre?.trim() || '—';
}

export function textoIngresadoPorPedido(req: Requisicion): string {
    return req.pedido?.procesadoPorNombre?.trim() || req.creadoPorNombre?.trim() || '—';
}

export function textoIngresadoPorRecepcion(req: Requisicion): string {
    const nombres = [
        ...new Set(
            (req.recepcion?.lineas ?? [])
                .map((l) => l.registradoPorNombre?.trim())
                .filter((n): n is string => Boolean(n))
        ),
    ];
    if (nombres.length > 0) return nombres.join(', ');
    return textoIngresadoPorPedido(req);
}

export interface DatosPedido {
    fechaPedido: string;
    /** Resumen: la más lejana entre proveedores (o la única fecha global legacy). */
    fechaEntregaEstimada: string;
    /** Precio unitario acordado en el pedido (puede diferir del costo estándar del catálogo). */
    precioUnitario?: number;
    /** Usuario que procesó / guardó el pedido. */
    procesadoPorNombre?: string;
    proveedores: ProveedorAsignado[];
}

export function resolverCostoEstandarProducto(
    productoNombre: string,
    productos: ProductoInsumo[]
): number | undefined {
    const prod = findProductoPorNombre(productoNombre, productos);
    return prod?.costoEstandar != null && prod.costoEstandar > 0 ? prod.costoEstandar : undefined;
}

export function findProductoPorNombre(
    productoNombre: string,
    productos: ProductoInsumo[]
): ProductoInsumo | undefined {
    const clave = productoNombre.trim().toLowerCase();
    if (!clave) return undefined;
    return productos.find((p) => p.nombre.trim().toLowerCase() === clave);
}

/** Monto COP al peso entero más cercano (regla comercial para totales de OC). */
export function redondearMonedaCop(valor: number): number {
    if (!Number.isFinite(valor)) return 0;
    return Math.round(valor);
}

export function getSubtotalLineaOc(precioUnitario: number, cantidad: number): number {
    if (precioUnitario <= 0 || cantidad <= 0) return 0;
    return redondearMonedaCop(precioUnitario * cantidad);
}

export function formatearMonedaCop(valor: number): string {
    const redondeado = redondearMonedaCop(valor);
    const tieneCentavos = Math.abs(valor - redondeado) > 0.0001 && Math.abs(valor % 1) > 0.0001;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: tieneCentavos ? 2 : 0,
        maximumFractionDigits: 2,
    }).format(tieneCentavos ? valor : redondeado);
}

/** Cantidad con hasta 3 decimales, coma decimal (ej. 20,9 kg). */
export function formatearCantidad(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(valor)) return '0';
    const n = Math.round(valor * 1000) / 1000;
    if (Math.abs(n % 1) < 0.0000001) return String(Math.trunc(n));
    return String(n).replace('.', ',');
}

/** Limpia input de cantidad permitiendo dígitos y una sola coma/punto decimal. */
export function sanitizarCantidadInput(valor: string): string {
    let s = valor.replace(/[^\d.,]/g, '');
    const sepIdx = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    if (sepIdx >= 0) {
        const entero = s.slice(0, sepIdx).replace(/[.,]/g, '');
        let dec = s.slice(sepIdx + 1).replace(/[.,]/g, '').slice(0, 3);
        s = `${entero},${dec}`;
        if (valor.endsWith(',') || valor.endsWith('.')) {
            if (!s.endsWith(',')) s += ',';
        }
    } else {
        s = s.replace(/[.,]/g, '');
    }
    return s;
}

export function parseCantidadInput(valor: string): number {
    const n = parseFloat(String(valor || '').trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
}

/** Solo dígitos, puntos de miles y una coma decimal (máx. 2 decimales). */
export function sanitizarPrecioCopInput(valor: string): string {
    let s = valor.replace(/[^\d.,]/g, '');
    const comaIdx = s.indexOf(',');
    if (comaIdx >= 0) {
        const entero = s.slice(0, comaIdx).replace(/,/g, '');
        const dec = s.slice(comaIdx + 1).replace(/[.,]/g, '').slice(0, 2);
        return dec.length > 0 ? `${entero},${dec}` : `${entero},`;
    }
    return s.replace(/,/g, '');
}

/** Convierte texto COP (64033,61 o 64.033,61) a número. */
export function parsePrecioCopInput(valor: string): number | undefined {
    const t = valor.trim();
    if (!t || t === ',') return undefined;

    const hasComma = t.includes(',');
    const hasDot = t.includes('.');

    let normalized: string;
    if (hasComma && hasDot) {
        normalized = t.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
        normalized = t.replace(',', '.');
    } else if (hasDot) {
        const parts = t.split('.');
        normalized = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2
            ? t
            : t.replace(/\./g, '');
    } else {
        normalized = t;
    }

    const n = parseFloat(normalized);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function formatPrecioCopInput(valor?: number): string {
    if (valor == null || valor <= 0 || !Number.isFinite(valor)) return '';
    return valor.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Formatea puntos de miles mientras el usuario escribe el precio. */
export function formatearPrecioCopMientrasEscribe(valor: string): { display: string; numero?: number } {
    const sanitizado = sanitizarPrecioCopInput(valor);
    if (!sanitizado) return { display: '', numero: undefined };

    const comaIdx = sanitizado.indexOf(',');
    const parteEntera = comaIdx >= 0 ? sanitizado.slice(0, comaIdx) : sanitizado;
    const parteDecimal = comaIdx >= 0 ? sanitizado.slice(comaIdx + 1) : '';
    const digitosEnteros = parteEntera.replace(/\./g, '');

    if (!digitosEnteros && comaIdx < 0) return { display: '', numero: undefined };

    const enteroNum = digitosEnteros ? parseInt(digitosEnteros, 10) : 0;
    const enteroFormateado =
        digitosEnteros && !Number.isNaN(enteroNum)
            ? enteroNum.toLocaleString('es-CO', { maximumFractionDigits: 0 })
            : parteEntera;

    const display =
        comaIdx >= 0
            ? parteDecimal.length > 0
                ? `${enteroFormateado},${parteDecimal}`
                : `${enteroFormateado},`
            : enteroFormateado;

    const numero = parsePrecioCopInput(display) ?? parsePrecioCopInput(sanitizado);
    return { display, numero };
}

export function getPrecioUnitarioDisplay(prov: ProveedorAsignado): string {
    if (prov.precioUnitarioTexto !== undefined) {
        return prov.precioUnitarioTexto;
    }
    return formatPrecioCopInput(prov.precioUnitario);
}

/** Registro de recepción por cada envío / proveedor. */
export interface RecepcionLineaProveedor {
    proveedorId: string;
    nombreProveedor: string;
    /** Código de recepción asignado por el usuario (guía, remisión, acta, etc.). */
    codigoUsuario: string;
    /** Usuario del sistema que registró la recepción. */
    registradoPorNombre?: string;
    fechaLlegada: string;
    calidadEsperada: boolean;
    motivoCalidadNo?: string;
    facturaEntregada: boolean;
    motivoFacturaNo?: string;
    cantidadRecibida: number;
    cantidadPedidaEnMomento: number;
    pedidoCompleto: boolean;
    motivoCantidadParcial?: string;
    nuevaFechaEntrega?: string;
}

export interface DatosRecepcion {
    lineas: RecepcionLineaProveedor[];
}

/** Flujo: Pendiente → Pedido → Parcial (recepción incompleta) → En Almacen (100 % recibido). */
export type EstadoRequisicion = 'Pendiente' | 'Pedido' | 'Parcial' | 'En Almacen';

export const ESTADO_REQUISICION_CONFIG: Record<
    EstadoRequisicion,
    { bg: string; border: string; text: string }
> = {
    Pendiente: { bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B', text: '#FBBF24' },
    Pedido: { bg: 'rgba(59, 130, 246, 0.2)', border: '#3B82F6', text: '#60A5FA' },
    Parcial: { bg: 'rgba(245, 158, 11, 0.2)', border: '#F59E0B', text: '#FBBF24' },
    'En Almacen': { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', text: '#34D399' },
};

export const ORDEN_ESTADO_REQUISICION: Record<EstadoRequisicion, number> = {
    Pendiente: 0,
    Pedido: 1,
    Parcial: 2,
    'En Almacen': 3,
};

export function getEstadoRequisicionStyle(estado: EstadoRequisicion) {
    return ESTADO_REQUISICION_CONFIG[estado];
}

/** Requisiciones visibles en la pestaña Pedidos (incluye completados en almacén). */
export function esRequisicionEnPedidos(estado: EstadoRequisicion): boolean {
    return estado === 'Pendiente' || estado === 'Pedido' || estado === 'Parcial' || estado === 'En Almacen';
}

export function esRequisicionConPedidoActivo(estado: EstadoRequisicion): boolean {
    return estado === 'Pedido' || estado === 'Parcial' || estado === 'En Almacen';
}

export function getCantidadTotalPedido(pedido?: DatosPedido | null): number {
    return (pedido?.proveedores ?? []).reduce((sum, p) => sum + (p.cantidad || 0), 0);
}

export function getSubtotalProveedor(prov: ProveedorAsignado): number {
    const precio = prov.precioUnitario ?? 0;
    const cantidad = prov.cantidad ?? 0;
    return getSubtotalLineaOc(precio, cantidad);
}

export function getTotalPedidoMonetario(pedido?: DatosPedido | null): number {
    if (!pedido) return 0;
    return normalizarPedido(pedido).proveedores.reduce((sum, p) => sum + getSubtotalProveedor(p), 0);
}

export function resolverPrecioInicialProveedor(
    productoNombre: string,
    productos: ProductoInsumo[],
    guardado?: number,
    precioPedidoLegacy?: number
): number | undefined {
    if (guardado != null && guardado > 0) return guardado;
    if (precioPedidoLegacy != null && precioPedidoLegacy > 0) return precioPedidoLegacy;
    return resolverCostoEstandarProducto(productoNombre, productos);
}

export function normalizarProveedoresPedido(
    proveedores: ProveedorAsignado[],
    fechaGlobal?: string
): ProveedorAsignado[] {
    return proveedores.map((p) => {
        const { precioUnitarioTexto, cantidadTexto, ...rest } = p;
        const precioResuelto =
            rest.precioUnitario ?? parsePrecioCopInput(precioUnitarioTexto ?? '');
        const cantidadResuelta =
            cantidadTexto != null && String(cantidadTexto).trim() !== ''
                ? parseCantidadInput(cantidadTexto)
                : rest.cantidad;
        return {
            ...rest,
            cantidad: Number.isFinite(cantidadResuelta) && cantidadResuelta > 0 ? cantidadResuelta : rest.cantidad,
            precioUnitario: precioResuelto,
            fechaEntregaEstimada: rest.fechaEntregaEstimada || fechaGlobal || '',
            recibido: rest.recibido ?? false,
        };
    });
}

export function normalizarPedido(pedido: DatosPedido): DatosPedido {
    const proveedores = normalizarProveedoresPedido(pedido.proveedores ?? [], pedido.fechaEntregaEstimada);
    const fechas = proveedores.map((p) => p.fechaEntregaEstimada).filter(Boolean) as string[];
    const fechaEntregaEstimada =
        fechas.length > 0
            ? fechas.sort().reverse()[0]
            : pedido.fechaEntregaEstimada || '';
    return { ...pedido, proveedores, fechaEntregaEstimada };
}

export function getFechaEntregaResumenPedido(pedido: DatosPedido): string {
    const normalizado = normalizarPedido(pedido);
    const fechas = [...new Set(normalizado.proveedores.map((p) => p.fechaEntregaEstimada).filter(Boolean))].sort();
    if (fechas.length === 0) return normalizado.fechaEntregaEstimada || '—';
    if (fechas.length === 1) return fechas[0];
    return `${fechas[0]} … ${fechas[fechas.length - 1]}`;
}

export function getProveedoresPendientesRecepcion(pedido: DatosPedido): ProveedorAsignado[] {
    return normalizarPedido(pedido).proveedores.filter((p) => !p.recibido && p.cantidad > 0);
}

export function pedidoRecepcionCompleta(pedido: DatosPedido): boolean {
    const provs = normalizarPedido(pedido).proveedores.filter((p) => p.cantidad > 0);
    return provs.length > 0 && provs.every((p) => p.recibido);
}

export function getResumenRecepcionProveedores(pedido: DatosPedido): { recibidos: number; total: number } {
    const provs = normalizarPedido(pedido).proveedores.filter((p) => p.cantidad > 0);
    return {
        recibidos: provs.filter((p) => p.recibido).length,
        total: provs.length,
    };
}

/** Fecha ISO (yyyy-mm-dd) de la última línea de recepción registrada. */
export function getFechaUltimaRecepcion(req: Requisicion): string | undefined {
    const lineas = req.recepcion?.lineas ?? [];
    if (lineas.length === 0) return undefined;
    return lineas.reduce(
        (max, l) => (l.fechaLlegada > max ? l.fechaLlegada : max),
        lineas[0].fechaLlegada,
    );
}

/** En recepción: pedidos en tránsito, parciales y los ya completados (En Almacén). */
export function esRequisicionEnRecepcion(req: Requisicion): boolean {
    if (!req.pedido) return false;
    return req.estado === 'Pedido' || req.estado === 'Parcial' || req.estado === 'En Almacen';
}

export function puedeRegistrarRecepcionEnvio(req: Requisicion): boolean {
    if (!req.pedido) return false;
    if (req.estado !== 'Pedido' && req.estado !== 'Parcial' && req.estado !== 'En Almacen') return false;
    return getCantidadPendientePedido(req.pedido, req.recepcion) > 0;
}

export function getCantidadRecibidaProveedor(recepcion: DatosRecepcion | undefined, proveedorId: string): number {
    if (!recepcion?.lineas?.length) return 0;
    return recepcion.lineas
        .filter((l) => l.proveedorId === proveedorId)
        .reduce((s, l) => s + l.cantidadRecibida, 0);
}

export function inferirCantidadPedidaDesdeLineas(
    lineas: Pick<RecepcionLineaProveedor, 'fechaLlegada' | 'codigoUsuario' | 'cantidadPedidaEnMomento' | 'cantidadRecibida'>[]
): number {
    const ordenadas = [...lineas].sort((a, b) => {
        const cmp = a.fechaLlegada.localeCompare(b.fechaLlegada);
        if (cmp !== 0) return cmp;
        return a.codigoUsuario.localeCompare(b.codigoUsuario);
    });

    const momentos = ordenadas
        .map((l) => l.cantidadPedidaEnMomento)
        .filter((m) => m > 0);

    if (momentos.length === 0) return 0;

    const primerMomento = momentos[0];
    if (momentos.every((m) => Math.abs(m - primerMomento) < 0.001)) {
        return primerMomento;
    }

    let inferido = 0;
    let acum = 0;
    for (const l of ordenadas) {
        if (l.cantidadPedidaEnMomento > 0) {
            inferido = Math.max(inferido, acum + l.cantidadPedidaEnMomento);
        }
        acum += l.cantidadRecibida;
    }
    return inferido;
}

export function getCantidadPedidaOriginalProveedor(
    recepcion: DatosRecepcion | undefined,
    proveedor: ProveedorAsignado
): number {
    const recibido = getCantidadRecibidaProveedor(recepcion, proveedor.id);
    if (proveedor.recibido && recibido > 0) return recibido;

    const lineas = (recepcion?.lineas ?? []).filter((l) => l.proveedorId === proveedor.id);
    const inferidoDesdeLineas = inferirCantidadPedidaDesdeLineas(lineas);

    if (inferidoDesdeLineas > 0) return inferidoDesdeLineas;
    if (proveedor.cantidad > 0) return proveedor.cantidad;
    return recibido;
}

/** Saldo pendiente del proveedor justo antes de registrar esta línea de recepción. */
export function getSaldoPendienteAntesDeLinea(
    recepcion: DatosRecepcion | undefined,
    proveedor: ProveedorAsignado | undefined,
    linea: Pick<RecepcionLineaProveedor, 'proveedorId' | 'fechaLlegada' | 'codigoUsuario' | 'cantidadPedidaEnMomento'>
): number {
    const prov =
        proveedor ??
        ({ id: linea.proveedorId, nombre: '', cantidad: 0 } as ProveedorAsignado);

    if (!recepcion?.lineas?.length) {
        const pedido = getCantidadPedidaOriginalProveedor(recepcion, prov);
        return linea.cantidadPedidaEnMomento > 0 ? linea.cantidadPedidaEnMomento : pedido;
    }

    const ordenadas = [...recepcion.lineas]
        .filter((l) => l.proveedorId === linea.proveedorId)
        .sort((a, b) => {
            const cmp = a.fechaLlegada.localeCompare(b.fechaLlegada);
            if (cmp !== 0) return cmp;
            return a.codigoUsuario.localeCompare(b.codigoUsuario);
        });

    let recibidoAntes = 0;
    for (const l of ordenadas) {
        if (l.fechaLlegada === linea.fechaLlegada && l.codigoUsuario === linea.codigoUsuario) break;
        recibidoAntes += l.cantidadRecibida;
    }

    const pedidoOriginal = getCantidadPedidaOriginalProveedor(recepcion, prov);
    return Math.max(0, pedidoOriginal - recibidoAntes);
}

export function getSaldoPendienteProveedor(
    recepcion: DatosRecepcion | undefined,
    proveedor: ProveedorAsignado
): number {
    if (proveedor.recibido) return 0;
    const pedido = getCantidadPedidaOriginalProveedor(recepcion, proveedor);
    const recibido = getCantidadRecibidaProveedor(recepcion, proveedor.id);
    return Math.max(0, pedido - recibido);
}

/** Proveedor que ya tuvo al menos una recepción pero aún tiene saldo pendiente. */
export function esProveedorConRecepcionParcial(
    recepcion: DatosRecepcion | undefined,
    proveedor: ProveedorAsignado
): boolean {
    if (proveedor.recibido) return false;
    const recibido = getCantidadRecibidaProveedor(recepcion, proveedor.id);
    return recibido > 0 && getSaldoPendienteProveedor(recepcion, proveedor) > 0;
}

export function tieneProveedoresConRecepcionParcial(req: {
    pedido?: DatosPedido;
    recepcion?: DatosRecepcion;
}): boolean {
    if (!req.pedido) return false;
    return normalizarPedido(req.pedido).proveedores.some((p) =>
        esProveedorConRecepcionParcial(req.recepcion, p)
    );
}

/** Cantidad aún por recibir (suma de saldos por proveedor). */
export function getCantidadPendientePedido(pedido: DatosPedido, recepcion?: DatosRecepcion): number {
    return normalizarPedido(pedido)
        .proveedores.filter((p) => !p.recibido && (p.cantidad > 0 || getCantidadRecibidaProveedor(recepcion, p.id) > 0))
        .reduce((s, p) => s + getSaldoPendienteProveedor(recepcion, p), 0);
}

export function getTotalPedidoOriginal(pedido: DatosPedido, recepcion?: DatosRecepcion): number {
    return normalizarPedido(pedido).proveedores.reduce(
        (s, p) => s + getCantidadPedidaOriginalProveedor(recepcion, p),
        0
    );
}

export function getCantidadRecibidaPedido(recepcion: DatosRecepcion | undefined): number {
    if (!recepcion?.lineas?.length) return 0;
    return recepcion.lineas.reduce((s, l) => s + l.cantidadRecibida, 0);
}

export function getResumenCantidadesPedido(
    pedido: DatosPedido,
    recepcion?: DatosRecepcion
): { recibido: number; pendiente: number; totalPedido: number } {
    const pendiente = getCantidadPendientePedido(pedido, recepcion);
    const recibido = getCantidadRecibidaPedido(recepcion);
    const totalPedido = getTotalPedidoOriginal(pedido, recepcion);
    return { recibido, pendiente, totalPedido };
}

export function getLineasRecepcionProveedor(
    recepcion: DatosRecepcion | undefined,
    proveedorId: string
): RecepcionLineaProveedor[] {
    if (!recepcion?.lineas?.length) return [];
    return recepcion.lineas.filter((l) => l.proveedorId === proveedorId);
}

/** Días calendario entre dos fechas ISO (yyyy-mm-dd); positivo si fechaHasta es posterior. */
export function diffDiasEntreFechas(fechaDesde: string, fechaHasta: string): number | null {
    if (!fechaDesde || !fechaHasta) return null;
    const a = new Date(`${fechaDesde}T12:00:00`);
    const b = new Date(`${fechaHasta}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export interface LlegadaProveedorResumen {
    orden: number;
    fechaLlegada: string;
    cantidadRecibida: number;
    codigoUsuario: string;
    esParcial: boolean;
    cantidadPedidaEnMomento?: number;
    /** Saldo pendiente del proveedor antes de este envío (denominador del parcial). */
    saldoPendienteAntes?: number;
    nuevaFechaEntrega?: string;
    motivoCantidadParcial?: string;
}

/** Métricas de puntualidad y parciales por proveedor en un pedido/requisición. */
export interface EvaluacionProveedorPedido {
    requisicionId: string;
    codigoRequisicion: string;
    producto: string;
    unidad: string;
    fechaRequerida: string;
    proveedorId: string;
    nombreProveedor: string;
    cantidadPedidaTotal: number;
    fechaEntregaEstimada?: string;
    llegadas: LlegadaProveedorResumen[];
    fechaPrimeraLlegada: string | null;
    fechaUltimaLlegada: string | null;
    /** Días entre el primer y el último envío (solo si hubo más de uno). */
    diasEntreParciales: number | null;
    /** Positivo = última llegada después de la fecha requerida de la OP. */
    diasRetrasoUltimaVsRequerida: number | null;
    /** Positivo = última llegada después de la fecha estimada del proveedor. */
    diasRetrasoUltimaVsEstimada: number | null;
    entregoATiempo: boolean | null;
    entregoAntesDeEstimada: boolean | null;
    calidadSiempreOk: boolean;
    numEnvios: number;
    tuvoParciales: boolean;
}

export function esRequisicionEnCalidadProveedores(req: Requisicion): boolean {
    return (req.recepcion?.lineas?.length ?? 0) > 0;
}

export function getEvaluacionesProveedorRequisicion(req: Requisicion): EvaluacionProveedorPedido[] {
    if (!req.recepcion?.lineas?.length) return [];

    const porProveedor = new Map<string, RecepcionLineaProveedor[]>();
    for (const l of req.recepcion.lineas) {
        const lista = porProveedor.get(l.proveedorId) ?? [];
        lista.push(l);
        porProveedor.set(l.proveedorId, lista);
    }

    const evaluaciones: EvaluacionProveedorPedido[] = [];

    for (const [proveedorId, lineas] of porProveedor) {
        const ordenadas = [...lineas].sort((a, b) => {
            const cmp = a.fechaLlegada.localeCompare(b.fechaLlegada);
            if (cmp !== 0) return cmp;
            return a.codigoUsuario.localeCompare(b.codigoUsuario);
        });

        const provPedido = req.pedido?.proveedores.find((p) => p.id === proveedorId);
        const cantidadPedidaTotal = provPedido
            ? getCantidadPedidaOriginalProveedor(req.recepcion, provPedido)
            : ordenadas[0]?.cantidadPedidaEnMomento ??
              ordenadas.reduce((s, l) => s + l.cantidadRecibida, 0);

        const llegadas: LlegadaProveedorResumen[] = ordenadas.map((l, i) => ({
            orden: i + 1,
            fechaLlegada: l.fechaLlegada,
            cantidadRecibida: l.cantidadRecibida,
            codigoUsuario: l.codigoUsuario,
            esParcial: !l.pedidoCompleto,
            cantidadPedidaEnMomento: l.cantidadPedidaEnMomento,
            saldoPendienteAntes: getSaldoPendienteAntesDeLinea(req.recepcion, provPedido, l),
            nuevaFechaEntrega: l.nuevaFechaEntrega,
            motivoCantidadParcial: l.motivoCantidadParcial,
        }));

        const primera = ordenadas[0].fechaLlegada;
        const ultima = ordenadas[ordenadas.length - 1].fechaLlegada;
        const diasEntreParciales =
            ordenadas.length > 1 ? diffDiasEntreFechas(primera, ultima) : null;
        const diasRetrasoUltimaVsRequerida = diffDiasEntreFechas(req.fechaRequerida, ultima);
        const fechaEst = provPedido?.fechaEntregaEstimada;
        const diasRetrasoUltimaVsEstimada = fechaEst
            ? diffDiasEntreFechas(fechaEst, ultima)
            : null;

        evaluaciones.push({
            requisicionId: req.id,
            codigoRequisicion: req.codigo,
            producto: req.producto,
            unidad: req.unidad,
            fechaRequerida: req.fechaRequerida,
            proveedorId,
            nombreProveedor: ordenadas[0].nombreProveedor,
            cantidadPedidaTotal,
            fechaEntregaEstimada: fechaEst,
            llegadas,
            fechaPrimeraLlegada: primera,
            fechaUltimaLlegada: ultima,
            diasEntreParciales,
            diasRetrasoUltimaVsRequerida,
            diasRetrasoUltimaVsEstimada,
            entregoATiempo:
                diasRetrasoUltimaVsRequerida !== null ? diasRetrasoUltimaVsRequerida <= 0 : null,
            entregoAntesDeEstimada:
                diasRetrasoUltimaVsEstimada !== null ? diasRetrasoUltimaVsEstimada <= 0 : null,
            calidadSiempreOk: ordenadas.every((l) => l.calidadEsperada),
            numEnvios: ordenadas.length,
            tuvoParciales: ordenadas.some((l) => !l.pedidoCompleto) || ordenadas.length > 1,
        });
    }

    return evaluaciones;
}

export const OPCIONES_FILTRO_CALIDAD_PROVEEDOR = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'a_tiempo' as const, label: 'A tiempo' },
    { id: 'retraso' as const, label: 'Con retraso' },
    { id: 'parciales' as const, label: 'Varios envíos' },
];

export function compareEstadoRequisicion(a: EstadoRequisicion, b: EstadoRequisicion): number {
    return ORDEN_ESTADO_REQUISICION[a] - ORDEN_ESTADO_REQUISICION[b];
}

export const OPCIONES_FILTRO_ESTADO_REQUISICION = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'Pendiente' as const, label: 'Pendiente' },
    { id: 'Pedido' as const, label: 'Pedido' },
    { id: 'Parcial' as const, label: 'Parcial' },
    { id: 'En Almacen' as const, label: 'En Almacén' },
];

/** Filtros en pestaña Pedidos (solo estados que aplican ahí). */
export const OPCIONES_FILTRO_ESTADO_PEDIDOS = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'Pendiente' as const, label: 'Pendiente' },
    { id: 'Pedido' as const, label: 'Pedido' },
    { id: 'Parcial' as const, label: 'Parcial' },
    { id: 'En Almacen' as const, label: 'En Almacén' },
];

/** Filtros en pestaña Recepción. */
export const OPCIONES_FILTRO_ESTADO_RECEPCION = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'Pedido' as const, label: 'En tránsito' },
    { id: 'Parcial' as const, label: 'Parcial' },
    { id: 'En Almacen' as const, label: 'Historial' },
];

export interface OrdenCompraLinea {
    id: string;
    pedidoProveedorId: string;
    requisicionId: string;
    requisicionCodigo: string;
    producto: string;
    ordenProduccion: string;
    referencia: string;
    cliente: string;
    cantidad: number;
    unidad: string;
    precioUnitario?: number;
    precioEspecial?: boolean;
    comentarioPrecioEspecial?: string;
    fechaEntregaEstimada?: string;
    recibido?: boolean;
    pagado?: boolean;
}

export interface OrdenCompra {
    id: string;
    numeroOrdenCompra: number;
    nombreProveedor: string;
    nit?: string;
    telefono?: string;
    catalogoId?: string;
    fechaPedido: string;
    fechaEntregaEstimada: string;
    estado: string;
    pagado?: boolean;
    formaPago?: string;
    procesadoPorNombre?: string;
    lineas: OrdenCompraLinea[];
}

export interface ConsolidarPedidoPayload {
    fechaPedido: string;
    fechaEntregaEstimada?: string;
    proveedor: {
        nombre: string;
        cantidad?: number;
        nit?: string;
        telefono?: string;
        catalogoId?: string;
        fechaEntregaEstimada?: string;
        precioUnitario?: number;
        categoria?: string;
        responsableIva?: boolean;
    };
    lineas: Array<{
        requisicionId: string;
        cantidad: number;
        precioUnitario?: number;
        precioEspecial?: boolean;
        comentarioPrecioEspecial?: string;
        fechaEntregaEstimada?: string;
    }>;
    agregarAOrdenCompraId?: string;
}

export interface RequisicionComentario {
    id: string;
    texto: string;
    usuarioNombre?: string;
    fecha: string;
    hora: string;
    esLegacy?: boolean;
    respuestas?: RequisicionComentario[];
}

export function contarComentariosRequisicion(comentarios?: RequisicionComentario[]): number {
    if (!comentarios?.length) return 0;
    return comentarios.reduce(
        (acc, c) => acc + 1 + contarComentariosRequisicion(c.respuestas),
        0
    );
}

export function previewUltimoComentario(req: Pick<Requisicion, 'comentarios' | 'observacion'>): string {
    const flat = aplanarComentariosRequisicion(req.comentarios);
    if (flat.length > 0) return flat[flat.length - 1].texto;
    return req.observacion?.trim() ?? '';
}

function aplanarComentariosRequisicion(comentarios?: RequisicionComentario[]): RequisicionComentario[] {
    if (!comentarios?.length) return [];
    const out: RequisicionComentario[] = [];
    for (const c of comentarios) {
        out.push(c);
        if (c.respuestas?.length) out.push(...aplanarComentariosRequisicion(c.respuestas));
    }
    return out;
}

export interface Requisicion {
    id: string;
    codigo: string;
    tipoRequisicion: TipoRequisicionId;
    fechaSolicitud: string;
    /** Hora de registro de la requisición (HH:mm, Colombia). */
    horaRegistro?: string;
    ordenProduccion: string;
    cliente: string;
    referencia: string;
    producto: string;
    cantidad: number;
    unidad: string;
    fechaRequerida: string;
    observacion?: string;
    /** Comentarios con respuestas (usuario, fecha y hora). */
    comentarios?: RequisicionComentario[];
    totalComentarios?: number;
    estado: EstadoRequisicion;
    /** Usuario que registró la requisición. */
    creadoPorNombre?: string;
    pedido?: DatosPedido;
    recepcion?: DatosRecepcion;
}

export const PROVEEDORES_CATALOGO_INICIAL: ProveedorCatalogo[] = [
    { id: 'cat-1', nombre: 'Textil Sur', nit: '900.123.456-1', telefono: '300 123 4567' },
    { id: 'cat-2', nombre: 'Telas Rápidas', nit: '900.234.567-2', telefono: '310 987 6543' },
    { id: 'cat-3', nombre: 'Distribuidora Norte', nit: '800.345.678-3', telefono: '320 555 0101' },
    { id: 'cat-4', nombre: 'Químicos del Valle', nit: '900.456.789-4', telefono: '315 222 3344' },
    { id: 'cat-5', nombre: 'Empaques Global', nit: '900.567.890-5', telefono: '301 444 7788' },
    { id: 'cat-6', nombre: 'Tintas y Colorantes SA', nit: '800.678.901-6', telefono: '318 666 9900' },
];

/** @deprecated Use nombres desde PROVEEDORES_CATALOGO_INICIAL */
export const PROVEEDORES_SUGERIDOS = PROVEEDORES_CATALOGO_INICIAL.map((p) => p.nombre);

export function findProveedorCatalogoPorNombre(
    catalogo: ProveedorCatalogo[],
    nombre: string
): ProveedorCatalogo | undefined {
    const n = nombre.trim().toLowerCase();
    if (!n) return undefined;
    return catalogo.find((c) => c.nombre.trim().toLowerCase() === n);
}

export function filtrarProveedorCatalogo(
    catalogo: ProveedorCatalogo[],
    consulta: string,
    limite?: number
): ProveedorCatalogo[] {
    const q = consulta.trim().toLowerCase();
    const qNit = q.replace(/\s/g, '');
    const lista = q
        ? catalogo.filter((c) => {
              const nombre = c.nombre.toLowerCase();
              const nit = (c.nit ?? '').replace(/\s/g, '').toLowerCase();
              const correo = (c.correo ?? '').toLowerCase();
              const tel =
                  `${c.telefono ?? ''} ${c.telefonoMovil ?? ''} ${c.telefonoTrabajo ?? ''}`.toLowerCase();
              return (
                  nombre.includes(q) ||
                  nit.includes(qNit) ||
                  correo.includes(q) ||
                  tel.includes(q)
              );
          })
        : [...catalogo].sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (limite == null || limite <= 0) return lista;
    return lista.slice(0, limite);
}

export function resumenProveedorContacto(cat: ProveedorCatalogo): string {
    const categoriaLabel = CATEGORIAS_PROVEEDOR.find((c) => c.id === cat.categoria)?.label;
    const partes = [
        categoriaLabel ? categoriaLabel : null,
        cat.nit ? `NIT ${cat.nit}` : null,
        cat.telefonoMovil ? `Móvil ${cat.telefonoMovil}` : null,
        cat.telefonoTrabajo ? `Trab. ${cat.telefonoTrabajo}` : null,
        cat.correo || null,
        cat.direccion || null,
    ].filter(Boolean);
    return partes.length > 0 ? partes.join(' · ') : 'Sin datos de contacto';
}

export function datosProveedorDesdeCatalogo(
    cat: ProveedorCatalogo
): Pick<ProveedorAsignado, 'nombre' | 'nit' | 'telefono' | 'catalogoId' | 'categoria' | 'responsableIva'> {
    return {
        nombre: cat.nombre,
        nit: cat.nit ?? '',
        telefono: cat.telefono || cat.telefonoMovil || cat.telefonoTrabajo || '',
        catalogoId: cat.id,
        categoria: cat.categoria,
        responsableIva: cat.responsableIva ?? false,
    };
}

/** Indica si el proveedor está marcado como responsable de IVA (solo aplica a declarante). */
export function proveedorResponsableIva(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[]
): boolean {
    const p = enriquecerProveedorFiscal(prov, catalogo);
    if (p.responsableIva) return true;
    if (p.catalogoId) {
        const porId = catalogo.find((c) => c.id === p.catalogoId);
        if (porId?.responsableIva) return true;
    }
    const porNombre = findProveedorCatalogoPorNombre(catalogo, prov.nombre);
    return porNombre?.responsableIva ?? false;
}

/** Indica si aplica IVA según categoría, casilla y base gravable. */
export function aplicaIvaProveedor(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[],
    subtotal?: number
): boolean {
    const p = enriquecerProveedorFiscal(prov, catalogo);
    const base = subtotal ?? getSubtotalProveedor(p);
    if (
        p.categoria === 'declarante' ||
        p.categoria === 'autoretenedor' ||
        p.categoria === 'persona_responsable_iva'
    ) {
        return true;
    }
    if (p.categoria === 'no_declarante' || p.categoria === 'persona_no_responsable_iva') return false;
    if (p.categoria === 'rst') return base > ALMACEN_RETEFUENTE_UMBRAL;
    return proveedorResponsableIva(p, catalogo);
}

/** @deprecated Use aplicaIvaProveedor */
export function proveedorIncluyeIvaEnOrden(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[]
): boolean {
    return aplicaIvaProveedor(prov, catalogo);
}

export const ALMACEN_IVA_TASA = 0.19;
export const ALMACEN_RETEFUENTE_TASA_DECLARANTE = 0.025;
export const ALMACEN_RETEFUENTE_TASA_NO_DECLARANTE = 0.035;
export const ALMACEN_RETEFUENTE_UMBRAL = 1_414_000;
export const ALMACEN_RETEICA_TASA = 7.7;
export const ALMACEN_RETEICA_UMBRAL = 786_000;
export const ALMACEN_RETEIVA_TASA_RST = 0.0285;

const CATEGORIAS_RETEFUENTE_25 = new Set([
    'declarante',
    'persona_responsable_iva',
]);
const CATEGORIAS_RETEFUENTE_35 = new Set([
    'no_declarante',
    'persona_no_responsable_iva',
]);
const CATEGORIAS_CON_RETEICA = new Set([
    'declarante',
    'no_declarante',
    'persona_no_responsable_iva',
    'persona_responsable_iva',
]);

function tasaRetefuenteCategoria(categoria?: string): number | null {
    if (!categoria) return null;
    if (CATEGORIAS_RETEFUENTE_25.has(categoria)) return ALMACEN_RETEFUENTE_TASA_DECLARANTE;
    if (CATEGORIAS_RETEFUENTE_35.has(categoria)) return ALMACEN_RETEFUENTE_TASA_NO_DECLARANTE;
    return null;
}

export interface LineaFiscalProveedor {
    etiqueta: string;
    monto: number;
    esRetencion?: boolean;
    esTotal?: boolean;
}

export function resolverCatalogoProveedorPedido(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[]
): ProveedorCatalogo | undefined {
    if (prov.catalogoId) {
        const porId = catalogo.find((c) => c.id === prov.catalogoId);
        if (porId) return porId;
    }
    return findProveedorCatalogoPorNombre(catalogo, prov.nombre);
}

/** Completa categoría e IVA del proveedor con datos del catálogo si faltan en el pedido. */
export function enriquecerProveedorFiscal(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[]
): ProveedorAsignado {
    const cat = resolverCatalogoProveedorPedido(prov, catalogo);
    const categoria = prov.categoria ?? cat?.categoria;
    const responsableIva = categoria
        ? responsableIvaDesdeCategoria(categoria)
        : prov.responsableIva ?? cat?.responsableIva ?? false;
    return {
        ...prov,
        categoria,
        responsableIva,
    };
}

/** Impuestos y retenciones aplicables al proveedor (para tarjetas y totales). */
export function getLineasFiscalesProveedor(
    prov: ProveedorAsignado,
    catalogo: ProveedorCatalogo[]
): LineaFiscalProveedor[] {
    const p = enriquecerProveedorFiscal(prov, catalogo);
    const subtotal = getSubtotalProveedor(p);
    if (subtotal <= 0) return [];

    const lineas: LineaFiscalProveedor[] = [];
    let iva = 0;

    if (aplicaIvaProveedor(p, catalogo, subtotal)) {
        iva = Math.round(subtotal * ALMACEN_IVA_TASA * 100) / 100;
        lineas.push({
            etiqueta: `IVA (${(ALMACEN_IVA_TASA * 100).toFixed(0)}%)`,
            monto: iva,
        });
    }

    let totalRetenciones = 0;
    const categoria = p.categoria;

    const tasaRetefuente = tasaRetefuenteCategoria(categoria);
    if (tasaRetefuente != null && subtotal > ALMACEN_RETEFUENTE_UMBRAL) {
        const retefuente = redondearMonedaCop(subtotal * tasaRetefuente);
        lineas.push({
            etiqueta: `Retefuente (${(tasaRetefuente * 100).toFixed(1)}%)`,
            monto: retefuente,
            esRetencion: true,
        });
        totalRetenciones += retefuente;
    }

    if (categoria && CATEGORIAS_CON_RETEICA.has(categoria) && subtotal > ALMACEN_RETEICA_UMBRAL) {
        const reteica = redondearMonedaCop((subtotal * ALMACEN_RETEICA_TASA) / 1000);
        lineas.push({
            etiqueta: `ReteICA (${ALMACEN_RETEICA_TASA.toFixed(1)} por mil)`,
            monto: reteica,
            esRetencion: true,
        });
        totalRetenciones += reteica;
    }

    if (categoria === 'rst' && subtotal > ALMACEN_RETEFUENTE_UMBRAL) {
        const reteiva = redondearMonedaCop(subtotal * ALMACEN_RETEIVA_TASA_RST);
        lineas.push({
            etiqueta: `ReteIVA (${(ALMACEN_RETEIVA_TASA_RST * 100).toFixed(2)}%)`,
            monto: reteiva,
            esRetencion: true,
        });
        totalRetenciones += reteiva;
    }

    if (lineas.length === 0) return [];

    const totalPagar = redondearMonedaCop(subtotal + iva - totalRetenciones);
    lineas.push({ etiqueta: 'Total a pagar', monto: totalPagar, esTotal: true });
    return lineas;
}

export function getTotalPagarProveedor(prov: ProveedorAsignado, catalogo: ProveedorCatalogo[]): number {
    const lineas = getLineasFiscalesProveedor(prov, catalogo);
    const total = lineas.find((l) => l.esTotal);
    if (total) return total.monto;
    return getSubtotalProveedor(prov);
}

export const UNIDADES_MEDIDA = ['kg', 'unidades', 'metros', 'litros', 'rollos', 'cajas', 'galones'];

export const PRODUCTOS_INSUMOS: ProductoInsumo[] = [
    { id: '1', nombre: 'Alcohol propanol', tipoRequisicion: 'consumo_diario', unidadSugerida: 'litros' },
    { id: '2', nombre: 'Solvente limpieza', tipoRequisicion: 'consumo_diario', unidadSugerida: 'litros' },
    { id: '3', nombre: 'Cuchilla guillotina', tipoRequisicion: 'consumo_diario', unidadSugerida: 'unidades' },
    { id: '4', nombre: 'Caja corrugada 40x30', tipoRequisicion: 'cajas_empaque', unidadSugerida: 'unidades' },
    { id: '5', nombre: 'Film stretch', tipoRequisicion: 'cajas_empaque', unidadSugerida: 'metros' },
    { id: '6', nombre: 'Cartulina SBS 300g', tipoRequisicion: 'cajas_empaque', unidadSugerida: 'kg' },
    { id: '7', nombre: 'Goma 370', tipoRequisicion: 'gomas_adhesivos', unidadSugerida: 'kg' },
    { id: '8', nombre: 'Pegante hot melt', tipoRequisicion: 'gomas_adhesivos', unidadSugerida: 'kg' },
    { id: '9', nombre: 'Cinta enmascarar', tipoRequisicion: 'gomas_adhesivos', unidadSugerida: 'rollos' },
    { id: '10', nombre: 'Tinta Pantone 186 C', tipoRequisicion: 'pantone', unidadSugerida: 'kg' },
    { id: '11', nombre: 'Tinta Pantone 287 C', tipoRequisicion: 'pantone', unidadSugerida: 'kg' },
    { id: '12', nombre: 'Tinta offset negra', tipoRequisicion: 'pantone', unidadSugerida: 'litros' },
];

export function getProductosPorTipo(tipo: TipoRequisicionId): ProductoInsumo[] {
    return PRODUCTOS_INSUMOS.filter((p) => p.tipoRequisicion === tipo);
}

export function getTipoRequisicionLabel(tipo: TipoRequisicionId): string {
    return TIPOS_REQUISICION.find((t) => t.id === tipo)?.label ?? tipo;
}

export const ORDENES_PRODUCCION: OrdenProduccionAlmacen[] = [
    { id: '1', numero: 'OP-2026-001', cliente: 'Confecciones Andina', referencia: 'REF-AND-2401' },
    { id: '2', numero: 'OP-2026-002', cliente: 'Empaques del Valle', referencia: 'REF-EDV-1180' },
    { id: '3', numero: 'OP-2026-003', cliente: 'Textiles Nova', referencia: 'REF-NOV-3305' },
    { id: '4', numero: 'OP-2026-004', cliente: 'Industrias Plásticas SA', referencia: 'REF-IPS-9021' },
    { id: '5', numero: 'OP-2025-089', cliente: 'Grupo Logístico Norte', referencia: 'REF-GLN-7744' },
];

export const REQUISICIONES_INICIALES: Requisicion[] = [
    {
        id: '1',
        codigo: 'REQ-001',
        tipoRequisicion: 'consumo_diario',
        fechaSolicitud: '2026-05-27',
        ordenProduccion: 'OP-2026-001',
        cliente: 'Confecciones Andina',
        referencia: 'REF-AND-2401',
        producto: 'Tela antifluido',
        cantidad: 50,
        unidad: 'rollos',
        fechaRequerida: '2026-06-02',
        estado: 'En Almacen',
        pedido: {
            fechaPedido: '2026-06-01',
            fechaEntregaEstimada: '2026-07-24',
            proveedores: [
                {
                    id: 'p1',
                    nombre: 'Textil Sur',
                    cantidad: 30,
                    fechaEntregaEstimada: '2026-06-10',
                    recibido: true,
                },
                {
                    id: 'p2',
                    nombre: 'Telas Rápidas',
                    cantidad: 10,
                    fechaEntregaEstimada: '2026-07-24',
                    recibido: true,
                },
            ],
        },
        recepcion: {
            lineas: [
                {
                    proveedorId: 'p1',
                    nombreProveedor: 'Textil Sur',
                    codigoUsuario: 'adw',
                    fechaLlegada: '2026-06-03',
                    calidadEsperada: true,
                    facturaEntregada: true,
                    cantidadRecibida: 30,
                    cantidadPedidaEnMomento: 30,
                    pedidoCompleto: true,
                },
                {
                    proveedorId: 'p2',
                    nombreProveedor: 'Telas Rápidas',
                    codigoUsuario: 'fsfse',
                    fechaLlegada: '2026-06-03',
                    calidadEsperada: true,
                    facturaEntregada: true,
                    cantidadRecibida: 10,
                    cantidadPedidaEnMomento: 20,
                    pedidoCompleto: false,
                    motivoCantidadParcial: 'poq',
                    nuevaFechaEntrega: '2026-07-11',
                },
                {
                    proveedorId: 'p2',
                    nombreProveedor: 'Telas Rápidas',
                    codigoUsuario: 'vsf',
                    fechaLlegada: '2026-07-24',
                    calidadEsperada: true,
                    facturaEntregada: true,
                    cantidadRecibida: 10,
                    cantidadPedidaEnMomento: 10,
                    pedidoCompleto: true,
                },
            ],
        },
    },
    {
        id: '2',
        codigo: 'REQ-002',
        tipoRequisicion: 'gomas_adhesivos',
        fechaSolicitud: '2026-05-28',
        ordenProduccion: 'OP-2026-003',
        cliente: 'Textiles Nova',
        referencia: 'REF-NOV-3305',
        producto: 'Hilo poliéster',
        cantidad: 15,
        unidad: 'kg',
        fechaRequerida: '2026-05-30',
        estado: 'Pendiente',
    },
    {
        id: '3',
        codigo: 'REQ-003',
        tipoRequisicion: 'cajas_empaque',
        fechaSolicitud: '2026-05-26',
        ordenProduccion: 'OP-2026-002',
        cliente: 'Empaques del Valle',
        referencia: 'REF-EDV-1180',
        producto: 'Caja corrugada 40x30',
        cantidad: 80,
        unidad: 'unidades',
        fechaRequerida: '2026-05-29',
        estado: 'Pendiente',
    },
    {
        id: '4',
        codigo: 'REQ-004',
        tipoRequisicion: 'pantone',
        fechaSolicitud: '2026-05-25',
        ordenProduccion: 'OP-2026-004',
        cliente: 'Industrias Plásticas SA',
        referencia: 'REF-IPS-9021',
        producto: 'Tinta Pantone 186 C',
        cantidad: 5,
        unidad: 'kg',
        fechaRequerida: '2026-05-28',
        observacion: 'Urgente para aprobación de color',
        estado: 'En Almacen',
        pedido: {
            fechaPedido: '2026-05-20',
            fechaEntregaEstimada: '2026-05-27',
            proveedores: [
                {
                    id: 'p3',
                    nombre: 'Tintas y Colorantes SA',
                    cantidad: 5,
                    fechaEntregaEstimada: '2026-05-27',
                    recibido: true,
                },
            ],
        },
        recepcion: {
            lineas: [
                {
                    proveedorId: 'p3',
                    nombreProveedor: 'Tintas y Colorantes SA',
                    codigoUsuario: 'REC-2026-0045',
                    fechaLlegada: '2026-05-27',
                    calidadEsperada: true,
                    facturaEntregada: true,
                    cantidadRecibida: 5,
                    cantidadPedidaEnMomento: 5,
                    pedidoCompleto: true,
                },
            ],
        },
    },
];

export function formatFechaHoy(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatFechaDisplay(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}

export function parseFechaInput(value: string): string {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        const [, dd, mm, yyyy] = match;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return trimmed;
}
