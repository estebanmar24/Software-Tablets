import api from './apiClient';

const API_BASE_URL = '';

// ============ TICKETS ============
export const fetchTicketStats = async (reportadoPor) => {
    let url = `${API_BASE_URL}/tickets/stats`;
    if (reportadoPor) url += `?reportadoPor=${encodeURIComponent(reportadoPor)}`;
    const response = await api.get(url);
    return response.data;
};

export const fetchTickets = async (filtros = {}) => {
    let url = `${API_BASE_URL}/tickets?`;
    if (filtros.estado) url += `estado=${filtros.estado}&`;
    if (filtros.prioridad) url += `prioridad=${filtros.prioridad}&`;
    if (filtros.modulo) url += `modulo=${filtros.modulo}&`;
    if (filtros.buscar) url += `buscar=${encodeURIComponent(filtros.buscar)}&`;
    if (filtros.reportadoPor) url += `reportadoPor=${encodeURIComponent(filtros.reportadoPor)}&`;
    const response = await api.get(url);
    return response.data;
};

export const fetchTicket = async (id) => {
    const response = await api.get(`${API_BASE_URL}/tickets/${id}`);
    return response.data;
};

export const createTicket = async (ticket) => {
    const response = await api.post(`${API_BASE_URL}/tickets`, ticket);
    return response.data;
};

export const updateTicket = async (id, ticket) => {
    const response = await api.put(`${API_BASE_URL}/tickets/${id}`, { ...ticket, id });
    return response.data;
};

export const cambiarEstadoTicket = async (id, estado, comentarios) => {
    const response = await api.patch(`${API_BASE_URL}/tickets/${id}/estado`, { estado, comentarios });
    return response.data;
};

export const deleteTicket = async (id) => {
    await api.delete(`${API_BASE_URL}/tickets/${id}`);
};

export const uploadTicketImagen = async (formData) => {
    const response = await api.post(`${API_BASE_URL}/tickets/upload-imagen`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
