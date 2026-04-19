import axios from 'axios';
import { getToken } from './authStorage';
import { getApiBaseUrl } from './apiConfig';

/**
 * Cliente Axios centralizado para toda la aplicación.
 */
export const apiClient = axios.create({
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
});

// Interceptor para inyectar la URL Base dinámica y el Token de Autenticación
apiClient.interceptors.request.use(async (config) => {
    // 1. Obtener URL Base activa (Local vs Cloudflare)
    const baseUrl = await getApiBaseUrl();
    config.baseURL = baseUrl;

    // 2. Inyectar Token de Autenticación
    const token = await getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

export default apiClient;
