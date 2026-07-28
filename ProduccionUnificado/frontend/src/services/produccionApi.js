import api from './apiClient';

const BASE_URL = 'produccion';
// API_URL kept for compatibility if exported elsewhere
const API_URL = '';

export const produccionApi = {
    getMaestros: async () => {
        const response = await api.get(`${BASE_URL}/maestros`);
        return response.data;
    },

    getGastos: async (anio, mes) => {
        const response = await api.get(`${BASE_URL}/gastos?anio=${anio}${mes ? `&mes=${mes}` : ''}`);
        return response.data;
    },

    createGasto: async (gasto, autorizacionId) => {
        const q = autorizacionId ? `?autorizacionId=${encodeURIComponent(autorizacionId)}` : '';
        const response = await api.post(`${BASE_URL}/gastos${q}`, gasto);
        return response.data;
    },

    updateGasto: async (id, gasto) => {
        const response = await api.put(`${BASE_URL}/gastos/${id}`, gasto);
        return response.data;
    },

    deleteGasto: async (id) => {
        await api.delete(`${BASE_URL}/gastos/${id}`);
    },

    // ==================== RUBROS CRUD ====================
    createRubro: async (rubro) => {
        const response = await api.post(`${BASE_URL}/rubros`, rubro);
        return response.data;
    },

    updateRubro: async (id, rubro) => {
        const response = await api.put(`${BASE_URL}/rubros/${id}`, rubro);
        return response.data;
    },

    deleteRubro: async (id) => {
        await api.delete(`${BASE_URL}/rubros/${id}`);
    },

    // ==================== PRODUCTOS CRUD ====================
    createProducto: async (producto) => {
        const response = await api.post(`${BASE_URL}/productos`, producto);
        return response.data;
    },

    updateProducto: async (id, producto) => {
        const response = await api.put(`${BASE_URL}/productos/${id}`, producto);
        return response.data;
    },

    deleteProducto: async (id) => {
        await api.delete(`${BASE_URL}/productos/${id}`);
    },

    // ==================== PROVEEDORES CRUD ====================
    createProveedor: async (proveedor) => {
        const response = await api.post(`${BASE_URL}/proveedores`, proveedor);
        return response.data;
    },

    updateProveedor: async (id, proveedor) => {
        const response = await api.put(`${BASE_URL}/proveedores/${id}`, proveedor);
        return response.data;
    },

    deleteProveedor: async (id) => {
        await api.delete(`${BASE_URL}/proveedores/${id}`);
    },

    // ==================== TIPOS DE HORA CRUD ====================
    createTipoHora: async (tipoHora) => {
        const response = await api.post(`${BASE_URL}/tiposhora`, tipoHora);
        return response.data;
    },

    updateTipoHora: async (id, tipoHora) => {
        const response = await api.put(`${BASE_URL}/tiposhora/${id}`, tipoHora);
        return response.data;
    },

    deleteTipoHora: async (id) => {
        await api.delete(`${BASE_URL}/tiposhora/${id}`);
    },

    // ==================== TIPOS DE RECARGO CRUD ====================
    createTipoRecargo: async (tipoRecargo) => {
        const response = await api.post(`${BASE_URL}/tiposrecargo`, tipoRecargo);
        return response.data;
    },

    updateTipoRecargo: async (id, tipoRecargo) => {
        const response = await api.put(`${BASE_URL}/tiposrecargo/${id}`, tipoRecargo);
        return response.data;
    },

    deleteTipoRecargo: async (id) => {
        await api.delete(`${BASE_URL}/tiposrecargo/${id}`);
    },

    // ==================== PARAMETROS JORNADA OT ====================
    getParametrosJornadaOt: async (fecha) => {
        const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
        const response = await api.get(`${BASE_URL}/parametros-jornada-ot${q}`);
        return response.data;
    },

    getAllParametrosJornadaOt: async () => {
        const response = await api.get(`${BASE_URL}/parametros-jornada-ot/all`);
        return response.data;
    },

    saveParametrosJornadaOt: async (payload) => {
        const response = await api.put(`${BASE_URL}/parametros-jornada-ot`, payload);
        return response.data;
    },

    // ==================== BUDGET ENDPOINTS ====================
    getResumen: async (anio, mes) => {
        const response = await api.get(`${BASE_URL}/resumen-gastos?anio=${anio}&mes=${mes}`);
        return response.data;
    },

    getPresupuestos: async (anio, mes) => {
        const response = await api.get(`${BASE_URL}/presupuestos?anio=${anio}&mes=${mes}`);
        return response.data;
    },

    setPresupuesto: async (presupuesto) => {
        const response = await api.post(`${BASE_URL}/presupuesto`, presupuesto);
        return response.data;
    },

    setPresupuestosBulk: async (presupuestos) => {
        const response = await api.post(`${BASE_URL}/presupuestos/bulk`, presupuestos);
        return response.data;
    },

    uploadFactura: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post(`${BASE_URL}/upload-factura`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // ==================== COTIZACIONES CRUD ====================
    getCotizaciones: async (anio, mes) => {
        let url = `${BASE_URL}/cotizaciones?`;
        if (anio) url += `anio=${anio}&`;
        if (mes) url += `mes=${mes}`;
        const response = await api.get(url);
        return response.data;
    },

    createCotizacion: async (cotizacion) => {
        const response = await api.post(`${BASE_URL}/cotizaciones`, cotizacion);
        return response.data;
    },

    updateCotizacion: async (id, cotizacion) => {
        const response = await api.put(`${BASE_URL}/cotizaciones/${id}`, cotizacion);
        return response.data; // or true
    },

    deleteCotizacion: async (id) => {
        await api.delete(`${BASE_URL}/cotizaciones/${id}`);
    },

    getPresupuestosGrid: async (anio) => {
        const response = await api.get(`${BASE_URL}/presupuestos-grid?anio=${anio}`);
        return response.data;
    },

    // ==================== GRAFICAS ENDPOINT ====================
    getGraficas: async (anio, mes) => {
        const response = await api.get(`${BASE_URL}/graficas?anio=${anio}${mes ? `&mes=${mes}` : ''}`);
        return response.data;
    },

    // ==================== SALARIOS ENDPOINT ====================
    updateSalario: async (usuarioId, salario) => {
        const response = await api.put(`${BASE_URL}/usuarios/${usuarioId}/salario`, { salario });
        return response.data;
    },

    // ==================== HORAS EXTRAS REPORT ====================
    getHorasExtrasReport: async (fechaInicio, fechaFin) => {
        const response = await api.get(`${BASE_URL}/gastos/horas-extras-report?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
        return response.data;
    },

    // ==================== RECARGOS REPORT ====================
    getRecargosReport: async (fechaInicio, fechaFin) => {
        const response = await api.get(`${BASE_URL}/gastos/recargos-report?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
        return response.data;
    },

    // Helper for month names
    getMesNombre: (mes) => {
        const nombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return nombres[mes] || '';
    }
};
