/**
 * GH (Gestión Humana) API Service
 * Handles all API calls for GH Budget and Expense Management
 * Includes Cotizaciones (Quotations) for price comparison
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5200/api';

// ==================== RUBROS ====================

export async function getRubros() {
    const response = await fetch(`${API_BASE_URL}/gh/rubros`);
    if (!response.ok) throw new Error('Error fetching rubros');
    return response.json();
}

export async function createRubro(rubro) {
    const response = await fetch(`${API_BASE_URL}/gh/rubros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rubro)
    });
    if (!response.ok) throw new Error('Error creating rubro');
    return response.json();
}

export async function updateRubro(id, rubro) {
    const response = await fetch(`${API_BASE_URL}/gh/rubros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rubro, id })
    });
    if (!response.ok) throw new Error('Error updating rubro');
    return response.ok;
}

export async function deleteRubro(id) {
    const response = await fetch(`${API_BASE_URL}/gh/rubros/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting rubro');
    return response.ok;
}

// ==================== TIPOS DE SERVICIO ====================

export async function getTiposServicio(rubroId = null) {
    let url = `${API_BASE_URL}/gh/tipos-servicio`;
    if (rubroId) url += `?rubroId=${rubroId}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching tipos servicio');
    return response.json();
}

export async function createTipoServicio(tipoServicio) {
    const response = await fetch(`${API_BASE_URL}/gh/tipos-servicio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipoServicio)
    });
    if (!response.ok) throw new Error('Error creating tipo servicio');
    return response.json();
}

export async function updateTipoServicio(id, tipoServicio) {
    const response = await fetch(`${API_BASE_URL}/gh/tipos-servicio/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tipoServicio, id })
    });
    if (!response.ok) throw new Error('Error updating tipo servicio');
    return response.ok;
}

export async function deleteTipoServicio(id) {
    const response = await fetch(`${API_BASE_URL}/gh/tipos-servicio/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting tipo servicio');
    return response.ok;
}

/**
 * Bulk update presupuestos for multiple TiposServicio
 * @param {Array} presupuestos - Array of {tipoServicioId, anio, mes, presupuesto}
 */
export async function setPresupuestosBulk(presupuestos) {
    const response = await fetch(`${API_BASE_URL}/gh/tipos-servicio/presupuestos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presupuestos)
    });
    if (!response.ok) throw new Error('Error updating presupuestos');
    return response.json();
}

/**
 * Get flat list of presupuestos for a given year
 * @param {number} anio 
 */
export async function getPresupuestos(anio) {
    const response = await fetch(`${API_BASE_URL}/gh/presupuestos/list?anio=${anio}`);
    if (!response.ok) throw new Error('Error fetching presupuestos list');
    return response.json();
}

/**
 * Get presupuestos grid for a given year
 * @param {number} anio - Year to get presupuestos for
 */
export async function getPresupuestosGrid(anio) {
    const response = await fetch(`${API_BASE_URL}/gh/presupuestos?anio=${anio}`);
    if (!response.ok) throw new Error('Error fetching presupuestos grid');
    return response.json();
}

// ==================== PROVEEDORES (Extended with contact info) ====================

export async function getProveedores(tipoServicioId = null) {
    let url = `${API_BASE_URL}/gh/proveedores`;
    if (tipoServicioId) url += `?tipoServicioId=${tipoServicioId}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching proveedores');
    return response.json();
}

export async function createProveedor(proveedor) {
    const response = await fetch(`${API_BASE_URL}/gh/proveedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proveedor)
    });
    if (!response.ok) throw new Error('Error creating proveedor');
    return response.json();
}

export async function updateProveedor(id, proveedor) {
    const response = await fetch(`${API_BASE_URL}/gh/proveedores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...proveedor, id })
    });
    if (!response.ok) throw new Error('Error updating proveedor');
    return response.ok;
}

export async function deleteProveedor(id) {
    const response = await fetch(`${API_BASE_URL}/gh/proveedores/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting proveedor');
    return response.ok;
}

// ==================== COTIZACIONES (New feature for price comparison) ====================

export async function getCotizaciones(proveedorId = null, anio = null, mes = null) {
    let url = `${API_BASE_URL}/gh/cotizaciones`;
    const params = [];
    if (proveedorId) params.push(`proveedorId=${proveedorId}`);
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (params.length > 0) url += '?' + params.join('&');

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching cotizaciones');
    return response.json();
}

export async function createCotizacion(cotizacion) {
    const response = await fetch(`${API_BASE_URL}/gh/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cotizacion)
    });
    if (!response.ok) throw new Error('Error creating cotizacion');
    return response.json();
}

export async function updateCotizacion(id, cotizacion) {
    const response = await fetch(`${API_BASE_URL}/gh/cotizaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cotizacion, id })
    });
    if (!response.ok) throw new Error('Error updating cotizacion');
    return response.ok;
}

export async function deleteCotizacion(id) {
    const response = await fetch(`${API_BASE_URL}/gh/cotizaciones/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting cotizacion');
    return response.ok;
}

// ==================== GASTOS ====================

export async function getGastos(anio, mes = null) {
    let url = `${API_BASE_URL}/gh/gastos?anio=${anio}`;
    if (mes) url += `&mes=${mes}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching gastos');
    return response.json();
}

export async function getGastosResumen(anio, mes = null) {
    let url = `${API_BASE_URL}/gh/gastos/resumen?anio=${anio}`;
    if (mes) url += `&mes=${mes}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching gastos resumen');
    return response.json();
}

export async function createGasto(gasto) {
    const response = await fetch(`${API_BASE_URL}/gh/gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gasto)
    });
    if (!response.ok) throw new Error('Error creating gasto');
    return response.json();
}

export async function updateGasto(id, gasto) {
    const response = await fetch(`${API_BASE_URL}/gh/gastos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gasto, id })
    });
    if (!response.ok) throw new Error('Error updating gasto');
    return response.ok;
}

export async function deleteGasto(id) {
    const response = await fetch(`${API_BASE_URL}/gh/gastos/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting gasto');
    return response.ok;
}

// ==================== HELPERS ====================

export const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
];

export function getMesNombre(mes) {
    return MESES.find(m => m.value === mes)?.label || '';
}

export function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}
