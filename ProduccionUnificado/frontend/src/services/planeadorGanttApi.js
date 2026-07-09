/**
 * API del Planeador de Máquinas (Gantt, programación OP y actividades).
 * Módulo dedicado para evitar problemas de importación con planeacionApi.
 */
import api from './apiClient';

const BASE = '/PlaneadorMaquinas';

export async function getProgramacionesRango(start, end) {
    const response = await api.get(`${BASE}/programacion/rango?start=${start}&end=${end}`);
    return response.data;
}

export async function crearProgramacionOP(plan) {
    const response = await api.post(`${BASE}/programacion`, plan);
    return response.data;
}

export async function actualizarProgramacionOP(id, plan) {
    const response = await api.put(`${BASE}/programacion/${id}`, plan);
    return response.data;
}

export async function eliminarProgramacionOP(id) {
    await api.delete(`${BASE}/programacion/${id}`);
    return true;
}

export async function getPlaneadorActividades() {
    const response = await api.get(`${BASE}/actividades`);
    return response.data;
}

export async function crearPlaneadorActividad(data) {
    const response = await api.post(`${BASE}/actividades`, data);
    return response.data;
}

export async function actualizarPlaneadorActividad(id, data) {
    const response = await api.put(`${BASE}/actividades/${id}`, data);
    return response.data;
}

export async function eliminarPlaneadorActividad(id) {
    await api.delete(`${BASE}/actividades/${id}`);
    return true;
}
