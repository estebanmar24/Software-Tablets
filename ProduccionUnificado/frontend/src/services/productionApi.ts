// API Service for Production Screens (compatible with axios-style responses)
// This file provides functions that match the interface expected by screens migrated from Software-Empresa-Elliot

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.101:5144/api';

// Wrapper to make fetch responses compatible with axios { data } structure
async function axiosWrapper<T>(url: string, options?: RequestInit): Promise<{ data: T }> {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { data };
}

export const API_URL = API_BASE_URL;

// Máquinas
export const getMaquinas = () => axiosWrapper<any[]>(`${API_BASE_URL}/maquinas`);
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

// Usuarios
export const getUsuarios = () => axiosWrapper<any[]>(`${API_BASE_URL}/usuarios`);
export const createUsuario = (data: any) => axiosWrapper<any>(`${API_BASE_URL}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
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
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/detalles?mes=${mes}&anio=${anio}&maquinaId=${maquinaId}&usuarioId=${usuarioId}`);

export const getOperariosConDatos = (mes: number, anio: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/operarios-con-datos?mes=${mes}&anio=${anio}`);

export const getMaquinasConDatos = (mes: number, anio: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/maquinas-con-datos?mes=${mes}&anio=${anio}`);

export const getProduccionPorMaquina = (mes: number, anio: number, maquinaId: number) =>
    axiosWrapper<any[]>(`${API_BASE_URL}/produccion/detalles-maquina?mes=${mes}&anio=${anio}&maquinaId=${maquinaId}`);

export const borrarProduccion = (mes: number, anio: number, usuarioId?: number, maquinaId?: number) => {
    let url = `${API_BASE_URL}/produccion/borrar?mes=${mes}&anio=${anio}`;
    if (usuarioId) url += `&usuarioId=${usuarioId}`;
    if (maquinaId) url += `&maquinaId=${maquinaId}`;
    return axiosWrapper<any>(url, { method: 'DELETE' });
};

export const getPeriodosDisponibles = () => axiosWrapper<any[]>(`${API_BASE_URL}/produccion/periodos-disponibles`);

// Generic get for flexibility
export const get = (url: string) => {
    // If url starts with /, append base. Otherwise use as is?
    // DashboardScreen uses relative paths like '/maquinas'
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    return axiosWrapper<any>(fullUrl);
};

export default {
    getMaquinas,
    getUsuarios,
    createMaquina,
    updateMaquina,
    createUsuario,
    saveProduccion,
    getResumen,
    getProduccionDetalles,
    getOperariosConDatos,
    getMaquinasConDatos,
    getProduccionPorMaquina,
    borrarProduccion,
    getPeriodosDisponibles,
    get,
    API_URL
};
