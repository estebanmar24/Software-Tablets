// API Service for Production Screens (compatible with axios-style responses)
// This file provides functions that match the interface expected by screens migrated from Software-Empresa-Elliot

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';
// Wrapper to make fetch responses compatible with axios { data } structure
async function axiosWrapper<T>(url: string, options?: RequestInit): Promise<{ data: T }> {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Handle 204 NoContent and empty responses
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return { data };
}

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
export const getUsuarios = () => axiosWrapper<any[]>(`${API_BASE_URL}/usuarios`);
export const createUsuario = (data: any) => axiosWrapper<any>(`${API_BASE_URL}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

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

// Generic get for flexibility - now supports params like axios
export const get = (url: string, options?: { params?: Record<string, any> }) => {
    // If url starts with /, append base. Otherwise use as is?
    // DashboardScreen uses relative paths like '/maquinas'
    let fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

    // Add query params if provided
    if (options?.params) {
        const searchParams = new URLSearchParams();
        for (const key in options.params) {
            if (options.params[key] !== undefined && options.params[key] !== null) {
                searchParams.append(key, String(options.params[key]));
            }
        }
        const queryString = searchParams.toString();
        if (queryString) {
            fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
        }
    }

    return axiosWrapper<any>(fullUrl);
};

// Generic post for flexibility
export const post = (url: string, data?: any) => {
    let fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

    return axiosWrapper<any>(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
    });
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
