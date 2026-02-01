import axios from 'axios';
import { getToken } from './authStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
});

/*
// Interceptor para inyectar token
api.interceptors.request.use(async (config) => {
    const token = await getToken();
    console.log(`[API DEBUG] Request: ${config.method?.toUpperCase()} ${config.url}, Token: ${token ? 'PRESENT' : 'MISSING'}`);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});
*/

// Helper para mantener compatibilidad con el código existente que espera { data }
// Axios ya devuelve { data, status, ... }, así que devolvemos la respuesta completa
// y el caller accederá a .data como siempre.
const axiosWrapper = async <T>(url: string, options?: any) => {
    // Si la URL es absoluta, usarla tal cual, si no, usa baseURL
    // Pero axios.create ya tiene baseURL.
    // El código existente pasa URLs completas a veces: `${API_BASE_URL}/maquinas`
    // Si pasamos url completa a axios instance, funciona.

    // Mapear options.method a axios method
    const method = options?.method || 'GET';
    const data = options?.body ? JSON.parse(options.body) : undefined;
    const headers = options?.headers;

    try {
        const response = await api.request<T>({
            url,
            method,
            data,
            headers
        });
        return { data: response.data };
    } catch (error: any) {
        console.error("API Error", error.message);
        throw error;
    }
};

export const API_URL = API_BASE_URL;

// Máquinas
export const getMaquinas = () => axiosWrapper<any[]>(`${API_BASE_URL}/maquinas`);
export const getMaquinasActivas = () => axiosWrapper<any[]>(`${API_BASE_URL}/maquinas?soloActivas=true`);
export const createMaquina = (data: any) => axiosWrapper<any>(`${API_BASE_URL}/maquinas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateMaquina = (id: number, data: any) => axiosWrapper<any>(`${API_BASE_URL}/maquinas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteMaquina = (id: number) => axiosWrapper<any>(`${API_BASE_URL}/maquinas/${id}`, {
    method: 'DELETE'
});

// Usuarios
export const getUsuarios = async (includeInactive = false) => {
    try {
        const response = await api.get(`/usuarios?includeInactive=${includeInactive}`);
        return { data: response.data };
    } catch (e) {
        throw e;
    }
};
export const createUsuario = async (data: any) => {
    try {
        const response = await api.post('/usuarios', data);
        return { data: response.data };
    } catch (e) {
        throw e;
    }
};

export const updateUsuario = (id: number, data: any) => axiosWrapper<any>(`${API_BASE_URL}/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

export const deleteUsuario = (id: number) => axiosWrapper<any>(`${API_BASE_URL}/usuarios/${id}`, {
    method: 'DELETE'
});

// Producción
export const saveProduccion = (data: any) => axiosWrapper<any>(`${API_BASE_URL}/produccion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

export const getResumen = (mes: number, anio: number) =>
    axiosWrapper<any>(`${API_BASE_URL}/produccion/resumen?mes=${mes}&anio=${anio}`);

export const getProduccionDetalles = (mes: number, anio: number, maquinaId: number, usuarioId: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/detalles?mes=${mes}&anio=${anio}&maquinaId=${maquinaId}&usuarioId=${usuarioId}&_t=${Date.now()}`);

export const getOperariosConDatos = (mes: number, anio: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/operarios-con-datos?mes=${mes}&anio=${anio}&_t=${Date.now()}`);

export const getMaquinasConDatos = (mes: number, anio: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/maquinas-con-datos?mes=${mes}&anio=${anio}&_t=${Date.now()}`);

export const getProduccionPorMaquina = (mes: number, anio: number, maquinaId: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/detalles-maquina?mes=${mes}&anio=${anio}&maquinaId=${maquinaId}&_t=${Date.now()}`);

export const borrarProduccion = (mes: number, anio: number, usuarioId?: number, maquinaId?: number) => {
    let url = `${API_BASE_URL}/produccion/borrar?mes=${mes}&anio=${anio}`;
    if (usuarioId) url += `&usuarioId=${usuarioId}`;
    if (maquinaId) url += `&maquinaId=${maquinaId}`;
    return axiosWrapper<any>(url, { method: 'DELETE' });
};

export const getPeriodosDisponibles = () => axiosWrapper<any[]>(`${API_BASE_URL}/produccion/periodos-disponibles`);

// Generic get for flexibility - now supports params like axios
// Generic get for flexibility - now supports params like axios
export const get = async (url: string, options?: { params?: Record<string, any> }) => {
    // Axios request handles params correctly
    try {
        // Handle absolute vs relative
        const isAbsolute = url.startsWith('http');

        const response = await api.get(url, {
            params: options?.params
        });
        return { data: response.data };
    } catch (e) { throw e; }
};

// Generic post for flexibility
export const post = async (url: string, data?: any) => {
    try {
        const response = await api.post(url, data);
        return { data: response.data };
    } catch (e) { throw e; }
};

export default {
    getMaquinas,
    getMaquinasActivas,
    getUsuarios,
    createMaquina,
    updateMaquina,
    deleteMaquina,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    saveProduccion,
    getResumen,
    getProduccionDetalles,
    getOperariosConDatos,
    getMaquinasConDatos,
    getProduccionPorMaquina,
    borrarProduccion,
    getPeriodosDisponibles,
    get,
    post,
    API_URL
};
