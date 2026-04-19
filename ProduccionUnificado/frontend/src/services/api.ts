import {
    Actividad,
    Usuario,
    Maquina,
    OrdenProduccion,
    ProduccionDia,
    RegistrarTiempoRequest,
    TiempoProceso,
    Horario,
} from '../types';

import { api } from './productionApi';

const API_BASE_URL = `tiempoproceso`; // Relative to base URL in api instance

// Obtener lista de actividades
export async function getActividades(): Promise<Actividad[]> {
    const response = await api.get<Actividad[]>(`${API_BASE_URL}/actividades`);
    return response.data;
}

// Obtener lista de usuarios/operarios
export async function getUsuarios(): Promise<Usuario[]> {
    const response = await api.get<Usuario[]>(`${API_BASE_URL}/usuarios`);
    return response.data;
}

// Obtener lista de máquinas
export async function getMaquinas(): Promise<Maquina[]> {
    const response = await api.get<Maquina[]>(`${API_BASE_URL}/maquinas`);
    return response.data;
}

// Obtener lista de órdenes de producción
export async function getOrdenes(): Promise<OrdenProduccion[]> {
    const response = await api.get<OrdenProduccion[]>(`${API_BASE_URL}/ordenes`);
    return response.data;
}

// Obtener lista de horarios/turnos
export async function getHorarios(): Promise<Horario[]> {
    const response = await api.get<Horario[]>(`${API_BASE_URL}/horarios`);
    return response.data;
}

// Obtener producción del día
export async function getProduccionDia(
    fecha?: string,
    maquinaId?: number,
    usuarioId?: number
): Promise<ProduccionDia> {
    const params = new URLSearchParams();
    if (fecha) params.append('fecha', fecha);
    if (maquinaId !== undefined && maquinaId !== null) params.append('maquinaId', maquinaId.toString());
    if (usuarioId !== undefined && usuarioId !== null) params.append('usuarioId', usuarioId.toString());

    const response = await api.get<ProduccionDia>(`${API_BASE_URL}/produccion-dia`, { params: { fecha, maquinaId, usuarioId } });
    return response.data;
}

// Finalizar tiempo de actividad
export async function finalizarTiempo(
    id: number,
    request: RegistrarTiempoRequest
): Promise<TiempoProceso> {
    const response = await api.put<TiempoProceso>(`${API_BASE_URL}/finalizar/${id}`, request);
    return response.data;
}

// Registrar tiempo de actividad
export async function registrarTiempo(
    request: RegistrarTiempoRequest
): Promise<TiempoProceso> {
    const response = await api.post<TiempoProceso>(`${API_BASE_URL}/registrar`, request);
    return response.data;
}

// Limpiar datos del día
export async function limpiarDatos(
    fecha?: string,
    maquinaId?: number,
    usuarioId?: number
): Promise<void> {
    const params = new URLSearchParams();
    if (fecha) params.append('fecha', fecha);
    if (maquinaId) params.append('maquinaId', maquinaId.toString());
    if (usuarioId) params.append('usuarioId', usuarioId.toString());

    await api.delete(`${API_BASE_URL}/limpiar`, { params: { fecha, maquinaId, usuarioId } });
}

// Login
export async function adminLogin(username: string, password: string): Promise<{ id: number; token: string; role: string; username: string; nombreMostrar: string; area?: string }> {
    const response = await api.post(`auth/login`, { username, password });
    return response.data;
}

// === GESTIÓN DE USUARIOS (CRUD) ===

export async function getUsers(): Promise<any[]> {
    const response = await api.get(`adminusuarios`);
    return response.data;
}

export async function createUser(user: any): Promise<any> {
    const response = await api.post(`adminusuarios`, user);
    return response.data;
}

export async function updateUser(id: number, user: any): Promise<void> {
    await api.put(`adminusuarios/${id}`, user);
}

export async function deleteUser(id: number): Promise<void> {
    await api.delete(`adminusuarios/${id}`);
}
export async function getCodigosDesperdicio(): Promise<import('../types').CodigoDesperdicio[]> {
    const response = await api.get(`desperdicio/codigos/activos`);
    return response.data;
}

export async function registrarDesperdicio(data: import('../types').RegistroDesperdicioRequest): Promise<any> {
    const response = await api.post(`desperdicio`, data);
    return response.data;
}

export { API_URL } from './apiConfig';
