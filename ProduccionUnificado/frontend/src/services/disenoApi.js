/**
 * Diseño API Service
 * Handles all API calls for Diseño Budget and Expense Management
 */

import api from './apiClient';

const API_BASE_URL = 'diseno';

// ==================== RUBROS ====================

export async function getRubros() {
    const response = await api.get(`${API_BASE_URL}/rubros`);
    return response.data;
}

export async function createRubro(rubro) {
    const response = await api.post(`${API_BASE_URL}/rubros`, rubro);
    return response.data;
}

export async function updateRubro(id, rubro) {
    const response = await api.put(`${API_BASE_URL}/rubros/${id}`, { ...rubro, id });
    return response.data;
}

export async function deleteRubro(id) {
    await api.delete(`${API_BASE_URL}/rubros/${id}`);
    return true;
}

// Tipos de Servicio removed - hierarchy is now Rubro -> Proveedor

// ==================== PROVEEDORES ====================

export async function getProveedores(rubroId = null) {
    let url = `${API_BASE_URL}/proveedores`;
    if (rubroId) url += `?rubroId=${rubroId}`;
    const response = await api.get(url);
    return response.data;
}

export async function createProveedor(proveedor) {
    const response = await api.post(`${API_BASE_URL}/proveedores`, proveedor);
    return response.data;
}

export async function updateProveedor(id, proveedor) {
    const response = await api.put(`${API_BASE_URL}/proveedores/${id}`, { ...proveedor, id });
    return response.data;
}

export async function deleteProveedor(id) {
    await api.delete(`${API_BASE_URL}/proveedores/${id}`);
    return true;
}

// ==================== COTIZACIONES ====================

export async function getCotizaciones(proveedorId = null, anio = null, mes = null) {
    let url = `${API_BASE_URL}/cotizaciones`;
    const params = [];
    if (proveedorId) params.push(`proveedorId=${proveedorId}`);
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (params.length > 0) url += '?' + params.join('&');

    const response = await api.get(url);
    return response.data;
}

export async function createCotizacion(cotizacion) {
    const response = await api.post(`${API_BASE_URL}/cotizaciones`, cotizacion);
    return response.data;
}

export async function updateCotizacion(id, cotizacion) {
    const response = await api.put(`${API_BASE_URL}/cotizaciones/${id}`, { ...cotizacion, id });
    return response.data;
}

export async function deleteCotizacion(id) {
    await api.delete(`${API_BASE_URL}/cotizaciones/${id}`);
    return true;
}

// ==================== PRESUPUESTOS ====================

export async function getPresupuestos(anio) {
    const response = await api.get(`${API_BASE_URL}/presupuestos?anio=${anio}`);
    return response.data;
}

export async function getPresupuestosGrid(anio) {
    const response = await api.get(`${API_BASE_URL}/presupuestos/grid?anio=${anio}`);
    return response.data;
}

export async function setPresupuesto(presupuesto) {
    const response = await api.post(`${API_BASE_URL}/presupuestos`, presupuesto);
    return response.data;
}

export async function setPresupuestosBulk(presupuestos) {
    const response = await api.post(`${API_BASE_URL}/presupuestos/bulk`, presupuestos);
    return response.data;
}

// ==================== GASTOS ====================

export async function getGastos(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/gastos?anio=${anio}&mes=${mes}`);
    return response.data;
}

export async function createGasto(gasto) {
    const response = await api.post(`${API_BASE_URL}/gastos`, gasto);
    return response.data;
}

export async function updateGasto(id, gasto) {
    const response = await api.put(`${API_BASE_URL}/gastos/${id}`, { ...gasto, id });
    return response.data;
}

export async function deleteGasto(id) {
    await api.delete(`${API_BASE_URL}/gastos/${id}`);
    return true;
}

// ==================== GRAFICAS ====================

export async function getGraficas(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/graficas/${anio}/${mes}`);
    return response.data;
}

export async function getGraficasAnual(anio) {
    const response = await api.get(`${API_BASE_URL}/graficas/anual/${anio}`);
    return response.data;
}

import { getFileServerUrl } from './apiConfig';

export async function uploadFactura(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${API_BASE_URL}/upload-factura`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
}

export async function getFileUrl() {
    return await getFileServerUrl();
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
