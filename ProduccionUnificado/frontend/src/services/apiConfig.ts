import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_KEY_STORAGE = '@api_base_url';
export const LOCAL_API_URL = 'http://192.168.100.227:5144/api';
export const CLOUDFLARE_API_URL = 'https://foam-insured-motels-anne.trycloudflare.com/api';
export const API_URL = (typeof window !== 'undefined' && isServedFromBackend()) ? '/api' : (process.env.EXPO_PUBLIC_API_URL || LOCAL_API_URL);

/**
 * Detecta si estamos corriendo como web build servido desde el backend (mismo origen).
 * En ese caso usamos URLs relativas (/api) para que funcione con cualquier dominio/tunnel.
 */
function isServedFromBackend(): boolean {
    if (Platform.OS !== 'web') return false;
    // Si estamos en un navegador y NO en el dev server de Expo (puerto 8081/19006)
    if (typeof window !== 'undefined' && window.location) {
        const port = window.location.port;
        // El dev server de Expo usa puertos como 8081, 19006, etc.
        // Si estamos en otro puerto o sin puerto (80/443), es el build servido desde el backend
        return port !== '8081' && port !== '19006' && port !== '19000';
    }
    return false;
}

/**
 * Retorna la URL base configurada.
 * - En web servido desde backend: usa URL relativa '/api'
 * - En móvil/dev: Prioriza AsyncStorage, luego process.env, luego LOCAL_API_URL.
 */
export async function getApiBaseUrl(): Promise<string> {
    // En web build servido desde el backend, siempre usar URL relativa
    if (isServedFromBackend()) {
        return '/api';
    }

    try {
        const savedUrl = await AsyncStorage.getItem(API_KEY_STORAGE);
        if (savedUrl) return savedUrl;
    } catch (e) {
        console.error('Error reading API URL from storage', e);
    }

    return process.env.EXPO_PUBLIC_API_URL || LOCAL_API_URL;
}

/**
 * Guarda una nueva URL base (ej: para conmutar entre Local y Cloudflare).
 */
export async function setApiBaseUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(API_KEY_STORAGE, url);
}

/**
 * Determina si estamos usando la URL de Cloudflare.
 */
export async function isRemoteMode(): Promise<boolean> {
    const url = await getApiBaseUrl();
    return url.includes('trycloudflare.com') || url.includes('cloudflare');
}
/**
 * Retorna la URL raíz del servidor (sin /api), útil para imágenes y archivos.
 */
export async function getFileServerUrl(): Promise<string> {
    if (isServedFromBackend()) {
        return ''; // mismo origen, URLs relativas
    }
    const baseUrl = await getApiBaseUrl();
    return baseUrl.replace(/\/api$/, '');
}
