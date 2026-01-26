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

// Configurar la URL base de la API
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';
const API_BASE_URL = `${BASE_URL}/tiempoproceso`;

// Helper para manejar respuestas
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Error en la solicitud');
    }
    return response.json();
}

// Obtener lista de actividades
export async function getActividades(): Promise<Actividad[]> {
    const response = await fetch(`${API_BASE_URL}/actividades`);
    return handleResponse<Actividad[]>(response);
}

// Obtener lista de usuarios/operarios
export async function getUsuarios(): Promise<Usuario[]> {
    const response = await fetch(`${API_BASE_URL}/usuarios`);
    return handleResponse<Usuario[]>(response);
}

// Obtener lista de máquinas
export async function getMaquinas(): Promise<Maquina[]> {
    const response = await fetch(`${API_BASE_URL}/maquinas`);
    return handleResponse<Maquina[]>(response);
}

// Obtener lista de órdenes de producción
export async function getOrdenes(): Promise<OrdenProduccion[]> {
    const response = await fetch(`${API_BASE_URL}/ordenes`);
    return handleResponse<OrdenProduccion[]>(response);
}

// Obtener lista de horarios/turnos
export async function getHorarios(): Promise<Horario[]> {
    const response = await fetch(`${API_BASE_URL}/horarios`);
    return handleResponse<Horario[]>(response);
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

    const response = await fetch(`${API_BASE_URL}/produccion-dia?${params}`);
    return handleResponse<ProduccionDia>(response);
}

// Registrar tiempo de actividad
export async function registrarTiempo(
    request: RegistrarTiempoRequest
): Promise<TiempoProceso> {
    const response = await fetch(`${API_BASE_URL}/registrar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });
    return handleResponse<TiempoProceso>(response);
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

    const response = await fetch(`${API_BASE_URL}/limpiar?${params}`, {
        method: 'DELETE',
    });
    await handleResponse<{ message: string }>(response);
}

// Login
export async function adminLogin(username: string, password: string): Promise<{ token: string; role: string; username: string; nombreMostrar: string }> {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return handleResponse(response);
}

// === GESTIÓN DE USUARIOS (CRUD) ===

export async function getUsers(): Promise<any[]> {
    const response = await fetch(`${BASE_URL}/adminusuarios`);
    return handleResponse<any[]>(response);
}

export async function createUser(user: any): Promise<any> {
    const response = await fetch(`${BASE_URL}/adminusuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    return handleResponse<any>(response);
}

export async function updateUser(id: number, user: any): Promise<void> {
    const response = await fetch(`${BASE_URL}/adminusuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    if (response.status === 204) return;
    return handleResponse<void>(response);
}

export async function deleteUser(id: number): Promise<void> {
    const response = await fetch(`${BASE_URL}/adminusuarios/${id}`, {
        method: 'DELETE',
    });
    if (response.status === 204) return;
    return handleResponse<void>(response);
}
export async function getCodigosDesperdicio(): Promise<import('../types').CodigoDesperdicio[]> {
    const response = await fetch(`${BASE_URL}/desperdicio/codigos/activos`);
    return handleResponse<import('../types').CodigoDesperdicio[]>(response);
}

export async function registrarDesperdicio(data: import('../types').RegistroDesperdicioRequest): Promise<any> {
    const response = await fetch(`${BASE_URL}/desperdicio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
}
