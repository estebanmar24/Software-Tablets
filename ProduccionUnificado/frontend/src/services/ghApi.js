/**
 * GH (Gestión Humana) API Service
 * Handles all API calls for GH Budget and Expense Management
 * Includes Cotizaciones (Quotations) for price comparison
 */

import axios from 'axios';
import { getToken } from './authStorage';

const api = axios.create();
/*
api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => Promise.reject(error));
*/

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

// ==================== RUBROS ====================

export async function getRubros() {
    const response = await api.get(`${API_BASE_URL}/gh/rubros`);
    return response.data;
}

export async function createRubro(rubro) {
    const response = await api.post(`${API_BASE_URL}/gh/rubros`, rubro);
    return response.data;
}

export async function updateRubro(id, rubro) {
    const response = await api.put(`${API_BASE_URL}/gh/rubros/${id}`, { ...rubro, id });
    return response.data;
}

export async function deleteRubro(id) {
    await api.delete(`${API_BASE_URL}/gh/rubros/${id}`);
    return true;
}

// ==================== TIPOS DE SERVICIO ====================

export async function getTiposServicio(rubroId = null) {
    let url = `${API_BASE_URL}/gh/tipos-servicio`;
    if (rubroId) url += `?rubroId=${rubroId}`;

    const response = await api.get(url);
    return response.data;
}

export async function createTipoServicio(tipoServicio) {
    const response = await api.post(`${API_BASE_URL}/gh/tipos-servicio`, tipoServicio);
    return response.data;
}

export async function updateTipoServicio(id, tipoServicio) {
    const response = await api.put(`${API_BASE_URL}/gh/tipos-servicio/${id}`, { ...tipoServicio, id });
    return response.data;
}

export async function deleteTipoServicio(id) {
    await api.delete(`${API_BASE_URL}/gh/tipos-servicio/${id}`);
    return true;
}

/**
 * Bulk update presupuestos for multiple TiposServicio
 * @param {Array} presupuestos - Array of {tipoServicioId, anio, mes, presupuesto}
 */
export async function setPresupuestosBulk(presupuestos) {
    const response = await api.post(`${API_BASE_URL}/gh/tipos-servicio/presupuestos`, presupuestos);
    return response.data;
}

/**
 * Get flat list of presupuestos for a given year
 * @param {number} anio 
 */
export async function getPresupuestos(anio) {
    const response = await api.get(`${API_BASE_URL}/gh/presupuestos/list?anio=${anio}`);
    return response.data;
}

/**
 * Get presupuestos grid for a given year
 * @param {number} anio - Year to get presupuestos for
 */
export async function getPresupuestosGrid(anio) {
    const response = await api.get(`${API_BASE_URL}/gh/presupuestos?anio=${anio}`);
    return response.data;
}

// ==================== PROVEEDORES (Extended with contact info) ====================

export async function getProveedores(tipoServicioId = null) {
    let url = `${API_BASE_URL}/gh/proveedores`;
    if (tipoServicioId) url += `?tipoServicioId=${tipoServicioId}`;

    const response = await api.get(url);
    return response.data;
}

export async function createProveedor(proveedor) {
    const response = await api.post(`${API_BASE_URL}/gh/proveedores`, proveedor);
    return response.data;
}

export async function updateProveedor(id, proveedor) {
    const response = await api.put(`${API_BASE_URL}/gh/proveedores/${id}`, { ...proveedor, id });
    return response.data;
}

export async function deleteProveedor(id) {
    await api.delete(`${API_BASE_URL}/gh/proveedores/${id}`);
    return true;
}

// ==================== COTIZACIONES (New feature for price comparison) ====================

export async function getCotizaciones(proveedorId = null, anio = null, mes = null) {
    let url = `${API_BASE_URL}/gh/cotizaciones`;
    const params = [];
    if (proveedorId) params.push(`proveedorId=${proveedorId}`);
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (params.length > 0) url += '?' + params.join('&');

    const response = await api.get(url);
    return response.data;
}

export async function createCotizacion(cotizacion) {
    const response = await api.post(`${API_BASE_URL}/gh/cotizaciones`, cotizacion);
    return response.data;
}

export async function updateCotizacion(id, cotizacion) {
    const response = await api.put(`${API_BASE_URL}/gh/cotizaciones/${id}`, { ...cotizacion, id });
    return response.data;
}

export async function deleteCotizacion(id) {
    await api.delete(`${API_BASE_URL}/gh/cotizaciones/${id}`);
    return true;
}

// ==================== GASTOS ====================

export async function getGastos(anio, mes = null) {
    let url = `${API_BASE_URL}/gh/gastos?anio=${anio}`;
    if (mes) url += `&mes=${mes}`;

    const response = await api.get(url);
    return response.data;
}

export async function getGastosResumen(anio, mes = null) {
    let url = `${API_BASE_URL}/gh/gastos/resumen?anio=${anio}`;
    if (mes) url += `&mes=${mes}`;

    const response = await api.get(url);
    return response.data;
}

export async function createGasto(gasto) {
    const response = await api.post(`${API_BASE_URL}/gh/gastos`, gasto);
    return response.data;
}

export async function updateGasto(id, gasto) {
    const response = await api.put(`${API_BASE_URL}/gh/gastos/${id}`, { ...gasto, id });
    return response.data;
}

export async function deleteGasto(id) {
    await api.delete(`${API_BASE_URL}/gh/gastos/${id}`);
    return true;
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
