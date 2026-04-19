/**
 * Orden y Aseo API Service
 * Handles all API calls for Orden y Aseo surveys
 */

import api from './apiClient';

const API_BASE_URL = '';

// Get list of processes
export async function getProcesos() {
    const response = await api.get(`${API_BASE_URL}/ordenaseo/procesos`);
    return response.data;
}

// Get list of plants
export async function getPlantas() {
    const response = await api.get(`${API_BASE_URL}/ordenaseo/plantas`);
    return response.data;
}

// Get surveys (optionally filtered by date)
export async function getEncuestas(fecha = null) {
    let url = `${API_BASE_URL}/ordenaseo/encuestas`;
    if (fecha) {
        url += `?fecha=${fecha}`;
    }
    const response = await api.get(url);
    return response.data;
}

// Get single survey by ID
export async function getEncuesta(id) {
    const response = await api.get(`${API_BASE_URL}/ordenaseo/encuestas/${id}`);
    return response.data;
}

// Create new survey
export async function crearEncuesta(data) {
    const response = await api.post(`${API_BASE_URL}/ordenaseo/encuestas`, data);
    return response.data;
}

// Update survey
export async function actualizarEncuesta(id, data) {
    const response = await api.put(`${API_BASE_URL}/ordenaseo/encuestas/${id}`, data);
    return response.data;
}

// Delete survey
export async function eliminarEncuesta(id) {
    const response = await api.delete(`${API_BASE_URL}/ordenaseo/encuestas/${id}`);
    return response.data;
}

// Get photo URL
/**
 * Constructs the full URL for a photo
 * @param {string} filename The name of the photo file
 * @param {string} baseUrl Optional base URL (e.g., from getApiBaseUrl)
 * @returns {string|null} The full URL or null if no filename
 */
export function getFotoUrl(filename, baseUrl = '') {
    if (!filename) return null;
    
    // Ensure we only have the filename part and remove any leading slashes
    const cleanFilename = filename.split('|')[0].trim().replace(/^\//, '');
    if (!cleanFilename) return null;

    // Default to /api for same-origin relative URLs if no baseUrl is provided
    let base = baseUrl || '/api';
    
    // Normalize: ensure it starts with / or http
    if (!base.startsWith('/') && !base.startsWith('http')) {
        base = '/' + base;
    }

    // Force /api prefix if missing. Backend routes are [Route("api/[controller]")]
    if (!base.includes('/api')) {
        base = base.endsWith('/') ? base + 'api' : base + '/api';
    }

    // Remove trailing slash for joining
    const finalBase = base.endsWith('/') ? base.slice(0, -1) : base;
    
    // Final check: if we are in production web, ensure it starts with /api/ or domain/api/
    const url = `${finalBase}/ordenaseo/foto/${cleanFilename}`;
    
    // Sanitize double slashes
    return url.replace(/([^:]\/)\/+/g, "$1");
}
