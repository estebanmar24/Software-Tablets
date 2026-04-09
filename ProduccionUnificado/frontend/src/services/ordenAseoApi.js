/**
 * Orden y Aseo API Service
 * Handles all API calls for Orden y Aseo surveys
 */

import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

const api = axios.create();

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
export function getFotoUrl(filename) {
    if (!filename) return null;
    return `${API_BASE_URL}/ordenaseo/foto/${filename}`;
}
