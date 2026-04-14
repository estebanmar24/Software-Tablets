/**
 * Talleres API Service
 * Handles all API calls for Talleres y Despachos Budget and Expense Management
 */

import axios from 'axios';
import { getToken } from './authStorage';

const api = axios.create();
api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => Promise.reject(error));

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

// ==================== RUBROS ====================

export async function getRubros() {
    const response = await api.get(`${API_BASE_URL}/talleres/rubros`);
    return response.data;
}

export async function getMaestros() {
    const response = await api.get(`${API_BASE_URL}/produccion/maestros`);
    return response.data;
}

export async function getHorarios() {
    const response = await api.get(`${API_BASE_URL}/talleres/horarios`);
    return response.data;
}

export async function createRubro(rubro) {
    const response = await api.post(`${API_BASE_URL}/talleres/rubros`, rubro);
    return response.data;
}

export async function updateRubro(id, rubro) {
    const response = await api.put(`${API_BASE_URL}/talleres/rubros/${id}`, { ...rubro, id });
    return response.data;
}

export async function deleteRubro(id) {
    await api.delete(`${API_BASE_URL}/talleres/rubros/${id}`);
    return true;
}

// ==================== PROVEEDORES ====================

export async function getProveedores() {
    const response = await api.get(`${API_BASE_URL}/talleres/proveedores`);
    return response.data;
}

export async function createProveedor(proveedor) {
    const response = await api.post(`${API_BASE_URL}/talleres/proveedores`, proveedor);
    return response.data;
}

export async function updateProveedor(id, proveedor) {
    const response = await api.put(`${API_BASE_URL}/talleres/proveedores/${id}`, { ...proveedor, id });
    return response.data;
}

export async function deleteProveedor(id) {
    await api.delete(`${API_BASE_URL}/talleres/proveedores/${id}`);
    return true;
}

// ==================== GASTOS ====================

export async function getGastos(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/talleres/gastos?anio=${anio}&mes=${mes}`);
    return response.data;
}

export async function createGasto(gasto) {
    const response = await api.post(`${API_BASE_URL}/talleres/gastos`, gasto);
    return response.data;
}

export async function updateGasto(id, gasto) {
    const response = await api.put(`${API_BASE_URL}/talleres/gastos/${id}`, { ...gasto, id });
    return response.data;
}

export async function deleteGasto(id) {
    await api.delete(`${API_BASE_URL}/talleres/gastos/${id}`);
    return true;
}

export async function uploadFactura(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${API_BASE_URL}/talleres/upload-factura`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
}

export async function getCotizaciones(anio, mes) {
    let url = `${API_BASE_URL}/talleres/cotizaciones?`;
    if (anio) url += `anio=${anio}&`;
    if (mes) url += `mes=${mes}`;
    const response = await api.get(url);
    return response.data;
}

export async function createCotizacion(cotizacion) {
    const response = await api.post(`${API_BASE_URL}/talleres/cotizaciones`, cotizacion);
    return response.data;
}

export async function updateCotizacion(id, cotizacion) {
    const response = await api.put(`${API_BASE_URL}/talleres/cotizaciones/${id}`, cotizacion);
    return true;
}

export async function deleteCotizacion(id) {
    await api.delete(`${API_BASE_URL}/talleres/cotizaciones/${id}`);
    return true;
}

// ==================== GRAFICAS ====================

export async function getGraficas(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/talleres/graficas/${anio}/${mes}`);
    return response.data;
}

export async function getGraficasAnual(anio) {
    const response = await api.get(`${API_BASE_URL}/talleres/graficas/anual/${anio}`);
    return response.data;
}

// ==================== PRESUPUESTOS ====================

export async function getPresupuestos(anio) {
    const response = await api.get(`${API_BASE_URL}/talleres/presupuestos?anio=${anio}`);
    return response.data;
}

/**
 * Helper to transform flat budget list into grid format for the UI
 */
export async function getPresupuestosGrid(anio) {
    // 1. Get all active Rubros
    const rubros = await getRubros();

    // 2. Get existing budgets for year
    const presupuestos = await getPresupuestos(anio); // Returns [{ rubroId, anio, mes, presupuesto, ... }]

    // 3. Build grid structure
    const totalesMensuales = Array(12).fill(0);
    let totalAnual = 0;

    const tiposServicio = rubros.map(rubro => {
        const meses = [];
        for (let m = 1; m <= 12; m++) {
            const p = presupuestos.find(x => x.rubroId === rubro.id && x.mes === m);
            const val = p ? p.presupuesto : 0;

            meses.push({
                mes: m,
                presupuesto: val
            });

            totalesMensuales[m - 1] += val;
            totalAnual += val;
        }

        return {
            tipoServicioId: rubro.id,
            tipoServicioNombre: rubro.nombre,
            meses: meses
        };
    });

    return {
        tiposServicio,
        totalesMensuales,
        totalAnual
    };
}

export async function setPresupuestosBulk(presupuestos) {
    // Transform incoming array if necessary, but the backend accepts [{rubroId, anio, mes, presupuesto}]
    // The UI sends { rubroId, anio, mes, presupuesto } if mapped correctly
    const response = await api.post(`${API_BASE_URL}/talleres/presupuestos/bulk`, presupuestos);
    return response.data;
}

// ==================== PERSONAL ====================
export async function getPersonal() {
    const response = await api.get(`${API_BASE_URL}/tallerespersonal`);
    return response.data;
}

export async function createPersonal(personal) {
    const response = await api.post(`${API_BASE_URL}/tallerespersonal`, personal);
    return response.data;
}

export async function updatePersonal(id, personal) {
    const response = await api.put(`${API_BASE_URL}/tallerespersonal/${id}`, { ...personal, id });
    return true;
}

export async function deletePersonal(id) {
    await api.delete(`${API_BASE_URL}/tallerespersonal/${id}`);
    return true;
}

// ==================== REPORTS ====================
export async function getHorasExtrasReport(fechaInicio, fechaFin) {
    const response = await api.get(`${API_BASE_URL}/talleres/gastos/horas-extras-report?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
    return response.data;
}

export async function getRecargosReport(fechaInicio, fechaFin) {
    const response = await api.get(`${API_BASE_URL}/talleres/gastos/recargos-report?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
    return response.data;
}
