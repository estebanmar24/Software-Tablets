import axios from 'axios';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';
const BASE_URL = `${API_URL}/produccion`;

export const produccionApi = {
    getMaestros: async () => {
        const response = await axios.get(`${BASE_URL}/maestros`);
        return response.data;
    },

    getGastos: async (anio, mes) => {
        const response = await axios.get(`${BASE_URL}/gastos?anio=${anio}${mes ? `&mes=${mes}` : ''}`);
        return response.data;
    },

    createGasto: async (gasto) => {
        const response = await axios.post(`${BASE_URL}/gastos`, gasto);
        return response.data;
    },

    updateGasto: async (id, gasto) => {
        const response = await axios.put(`${BASE_URL}/gastos/${id}`, gasto);
        return response.data;
    },

    deleteGasto: async (id) => {
        await axios.delete(`${BASE_URL}/gastos/${id}`);
    },

    // ==================== RUBROS CRUD ====================
    createRubro: async (rubro) => {
        const response = await axios.post(`${BASE_URL}/rubros`, rubro);
        return response.data;
    },

    updateRubro: async (id, rubro) => {
        const response = await axios.put(`${BASE_URL}/rubros/${id}`, rubro);
        return response.data;
    },

    deleteRubro: async (id) => {
        await axios.delete(`${BASE_URL}/rubros/${id}`);
    },

    // ==================== PROVEEDORES CRUD ====================
    createProveedor: async (proveedor) => {
        const response = await axios.post(`${BASE_URL}/proveedores`, proveedor);
        return response.data;
    },

    updateProveedor: async (id, proveedor) => {
        const response = await axios.put(`${BASE_URL}/proveedores/${id}`, proveedor);
        return response.data;
    },

    deleteProveedor: async (id) => {
        await axios.delete(`${BASE_URL}/proveedores/${id}`);
    },

    // ==================== TIPOS DE HORA CRUD ====================
    createTipoHora: async (tipoHora) => {
        const response = await axios.post(`${BASE_URL}/tiposhora`, tipoHora);
        return response.data;
    },

    updateTipoHora: async (id, tipoHora) => {
        const response = await axios.put(`${BASE_URL}/tiposhora/${id}`, tipoHora);
        return response.data;
    },

    deleteTipoHora: async (id) => {
        await axios.delete(`${BASE_URL}/tiposhora/${id}`);
    },

    // ==================== BUDGET ENDPOINTS ====================
    getResumen: async (anio, mes) => {
        const response = await axios.get(`${BASE_URL}/resumen?anio=${anio}&mes=${mes}`);
        return response.data;
    },

    getPresupuestos: async (anio, mes) => {
        const response = await axios.get(`${BASE_URL}/presupuestos?anio=${anio}&mes=${mes}`);
        return response.data;
    },

    setPresupuesto: async (presupuesto) => {
        const response = await axios.post(`${BASE_URL}/presupuesto`, presupuesto);
        return response.data;
    },

    setPresupuestosBulk: async (presupuestos) => {
        const response = await axios.post(`${BASE_URL}/presupuestos/bulk`, presupuestos);
        return response.data;
    },

    getPresupuestosGrid: async (anio) => {
        const response = await axios.get(`${BASE_URL}/presupuestos-grid?anio=${anio}`);
        return response.data;
    },

    // ==================== GRAFICAS ENDPOINT ====================
    getGraficas: async (anio, mes) => {
        const response = await axios.get(`${BASE_URL}/graficas?anio=${anio}${mes ? `&mes=${mes}` : ''}`);
        return response.data;
    },

    // ==================== SALARIOS ENDPOINT ====================
    updateSalario: async (usuarioId, salario) => {
        const response = await axios.put(`${BASE_URL}/usuarios/${usuarioId}/salario`, { salario });
        return response.data;
    },

    // Helper for month names
    getMesNombre: (mes) => {
        const nombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return nombres[mes] || '';
    }
};
