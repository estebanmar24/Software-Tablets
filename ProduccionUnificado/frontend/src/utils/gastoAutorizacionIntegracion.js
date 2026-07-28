/**
 * Helpers para integrar autorización de gastos en pantallas de módulos.
 */
import { flagsToMedioPago } from '../components/MedioPagoGastoControls';

/** Horas extras y recargos no requieren autorización previa (solo en módulos que lo permiten). */
export function esRubroSinAutorizacion(nombreRubro) {
    const n = (nombreRubro || '').toLowerCase();
    return n.includes('horas extras') || n.includes('hora extra') || n.includes('recargo');
}

export function prefijarFormularioDesdeAutorizacion(sol, baseForm, { fechaField = 'fecha' } = {}) {
    const fecha = sol.fechaAproximada?.split('T')[0] || new Date().toISOString().split('T')[0];
    return {
        ...baseForm,
        rubroId: sol.rubroId ? String(sol.rubroId) : '',
        proveedorId: sol.proveedorId ? String(sol.proveedorId) : '',
        [fechaField]: fecha,
        precio: String(sol.cantidad ?? ''),
        precioBase: String(sol.cantidad ?? ''),
        precioIva: '0',
        nota: sol.razon || '',
        esPendiente: false,
        esSolicitudCredito: sol.esSolicitudCredito || false,
        desdeAutorizacion: true,
    };
}

/** Permite editar montos sin factura cuando el gasto viene de una solicitud autorizada. */
export function puedeEditarMontosGasto(formData, editItem = null) {
    if (!formData) return false;
    return !!(
        formData.esPendiente ||
        formData.desdeAutorizacion ||
        (formData.numeroFactura && String(formData.numeroFactura).trim()) ||
        editItem
    );
}

/** Planeación oculta montos hasta factura; desde autorización deben mostrarse de inmediato. */
export function debeMostrarCamposMonto(formData, { medioPago } = {}) {
    if (!formData) return false;
    if (formData.desdeAutorizacion) return true;
    return !!(
        medioPago &&
        (formData.esPendiente || (formData.numeroFactura && String(formData.numeroFactura).trim()))
    );
}

export function medioPagoDesdeAutorizacion(sol) {
    return flagsToMedioPago(!!sol.esSolicitudCredito, !!sol.esEfectivo);
}

export async function crearGastoConAutorizacion(apiCreateFn, gastoData, autorizacionActivaRef, setAuthRefreshKey) {
    const authId = autorizacionActivaRef?.current?.id;
    await apiCreateFn(gastoData, authId);
    if (autorizacionActivaRef) autorizacionActivaRef.current = null;
    if (setAuthRefreshKey) setAuthRefreshKey((k) => k + 1);
}
