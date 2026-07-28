/**
 * Planeación API Service
 * Handles all API calls for Planeación Budget and Expense Management
 */

import { getFileServerUrl } from './apiConfig';
import api from './apiClient';

const API_BASE_URL = '';

// ==================== RUBROS ====================

export async function getRubros() {
    const response = await api.get(`${API_BASE_URL}/planeacion/rubros`);
    return response.data;
}

export async function createRubro(rubro) {
    const response = await api.post(`${API_BASE_URL}/planeacion/rubros`, rubro);
    return response.data;
}

export async function updateRubro(id, rubro) {
    const response = await api.put(`${API_BASE_URL}/planeacion/rubros/${id}`, { ...rubro, id });
    return response.data;
}

export async function deleteRubro(id) {
    await api.delete(`${API_BASE_URL}/planeacion/rubros/${id}`);
    return true;
}

// Tipos de Servicio removed - hierarchy is now Rubro -> Proveedor

// ==================== PROVEEDORES ====================

export async function getProveedores(rubroId = null) {
    let url = `${API_BASE_URL}/planeacion/proveedores`;
    if (rubroId) url += `?rubroId=${rubroId}`;
    const response = await api.get(url);
    return response.data;
}

export async function createProveedor(proveedor) {
    const response = await api.post(`${API_BASE_URL}/planeacion/proveedores`, proveedor);
    return response.data;
}

export async function updateProveedor(id, proveedor) {
    const response = await api.put(`${API_BASE_URL}/planeacion/proveedores/${id}`, { ...proveedor, id });
    return response.data;
}

export async function deleteProveedor(id) {
    await api.delete(`${API_BASE_URL}/planeacion/proveedores/${id}`);
    return true;
}

// ==================== PERSONAL (HORAS EXTRAS) ====================

export async function getPersonal() {
    const response = await api.get(`${API_BASE_URL}/planeacion/personal`);
    return response.data;
}

export async function createPersonal(personal) {
    const response = await api.post(`${API_BASE_URL}/planeacion/personal`, personal);
    return response.data;
}

export async function updatePersonal(id, personal) {
    const response = await api.put(`${API_BASE_URL}/planeacion/personal/${id}`, { ...personal, id });
    return response.data;
}

export async function deletePersonal(id) {
    await api.delete(`${API_BASE_URL}/planeacion/personal/${id}`);
    return true;
}

// ==================== COTIZACIONES ====================

export async function getCotizaciones(proveedorId = null, anio = null, mes = null) {
    let url = `${API_BASE_URL}/planeacion/cotizaciones`;
    const params = [];
    if (proveedorId) params.push(`proveedorId=${proveedorId}`);
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (params.length > 0) url += '?' + params.join('&');

    const response = await api.get(url);
    return response.data;
}

export async function createCotizacion(cotizacion) {
    const response = await api.post(`${API_BASE_URL}/planeacion/cotizaciones`, cotizacion);
    return response.data;
}

export async function updateCotizacion(id, cotizacion) {
    const response = await api.put(`${API_BASE_URL}/planeacion/cotizaciones/${id}`, { ...cotizacion, id });
    return response.data;
}

export async function deleteCotizacion(id) {
    await api.delete(`${API_BASE_URL}/planeacion/cotizaciones/${id}`);
    return true;
}

// ==================== PRESUPUESTOS ====================

export async function getPresupuestos(anio) {
    const response = await api.get(`${API_BASE_URL}/planeacion/presupuestos?anio=${anio}`);
    return response.data;
}

export async function getPresupuestosGrid(anio) {
    const response = await api.get(`${API_BASE_URL}/planeacion/presupuestos/grid?anio=${anio}`);
    return response.data;
}

export async function setPresupuesto(presupuesto) {
    const response = await api.post(`${API_BASE_URL}/planeacion/presupuestos`, presupuesto);
    return response.data;
}

export async function setPresupuestosBulk(presupuestos) {
    const response = await api.post(`${API_BASE_URL}/planeacion/presupuestos/bulk`, presupuestos);
    return response.data;
}

// ==================== GASTOS ====================

export async function getGastos(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/planeacion/gastos?anio=${anio}&mes=${mes}`);
    return response.data;
}

export async function createGasto(gasto, autorizacionId) {
    const q = autorizacionId ? `?autorizacionId=${encodeURIComponent(autorizacionId)}` : '';
    const response = await api.post(`${API_BASE_URL}/planeacion/gastos${q}`, gasto);
    return response.data;
}

export async function updateGasto(id, gasto) {
    const response = await api.put(`${API_BASE_URL}/planeacion/gastos/${id}`, { ...gasto, id });
    return response.data;
}

export async function deleteGasto(id) {
    await api.delete(`${API_BASE_URL}/planeacion/gastos/${id}`);
    return true;
}

// ==================== GRAFICAS ====================

export async function getGraficas(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/planeacion/graficas/${anio}/${mes}`);
    return response.data;
}

export async function getGraficasAnual(anio) {
    const response = await api.get(`${API_BASE_URL}/planeacion/graficas/anual/${anio}`);
    return response.data;
}

// ==================== TIPOS HORAS/RECARGOS ====================

export async function getTiposHorasRecargos() {
    const response = await api.get(`${API_BASE_URL}/planeacion/tipos-horas-recargos`);
    return response.data;
}

// ==================== UPLOAD FACTURA ====================

export async function uploadFactura(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`${API_BASE_URL}/planeacion/upload-factura`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
}

export async function getFileUrl() {
    return await getFileServerUrl();
}
// ==================== HELPERS ====================

export const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
];

export function getMesNombre(mes) {
    return MESES.find(m => m.value === mes)?.label || '';
}

export function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// ==================== PLANEADOR DE MÁQUINAS ====================

export async function getPlaneadorRango(start, end) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/rango?start=${start}&end=${end}`);
    return response.data;
}

export async function getPlaneadorActual(maquinaId, horarioId = null, usuarioId = null) {
    const params = new URLSearchParams({ maquinaId: String(maquinaId) });
    if (horarioId) params.set('horarioId', String(horarioId));
    if (usuarioId) params.set('usuarioId', String(usuarioId));
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/actual?${params.toString()}`);
    return response.data;
}

export async function crearPlaneacion(plan) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorMaquinas`, plan);
    return response.data;
}

export async function eliminarPlaneacion(id) {
    await api.delete(`${API_BASE_URL}/PlaneadorMaquinas/${id}`);
    return true;
}

export async function actualizarPlaneacion(id, plan) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorMaquinas/${id}`, plan);
    return response.data;
}

export async function getEstadoActualMaquinas() {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/telemetria/estado`);
    return response.data;
}

export async function getDebugData() {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/telemetria/debug`);
    return response.data;
}

// ==================== PROGRAMACIÓN GANTT (RC-002) ====================

export async function getMetaFacturacion(anio, mes) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/facturacion/meta`, {
        params: { anio, mes },
    });
    return response.data;
}

export async function upsertMetaFacturacion(anio, mes, meta) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorMaquinas/facturacion/meta`, {
        anio,
        mes,
        meta,
    });
    return response.data;
}

export async function getProcesosGantt() {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/procesos`);
    return response.data;
}

export async function crearProcesoGantt(nombre) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorMaquinas/procesos`, { nombre });
    return response.data;
}

export async function actualizarProcesoGantt(id, nombre) {
    await api.put(`${API_BASE_URL}/PlaneadorMaquinas/procesos/${id}`, { nombre });
    return true;
}

export async function reordenarProcesosGantt(ids) {
    await api.put(`${API_BASE_URL}/PlaneadorMaquinas/procesos/reordenar`, { ids });
    return true;
}

export async function eliminarProcesoGantt(id) {
    await api.delete(`${API_BASE_URL}/PlaneadorMaquinas/procesos/${id}`);
    return true;
}

export async function getProgramacionesRango(start, end) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/programacion/rango`, {
        params: { start, end },
    });
    return response.data;
}

export async function getProgramacion(id) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/programacion/${id}`);
    return response.data;
}

export async function crearProgramacionOP(payload) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorMaquinas/programacion`, payload);
    return response.data;
}

export async function crearUrgenciaConAjustes(urgencia, ajustes) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorMaquinas/programacion/urgencia`, {
        urgencia,
        ajustes,
    });
    return response.data;
}

/** Crea una actividad auxiliar (capacitación/limpieza) con ajustes de reacomodo de OPs. */
export async function crearActividadAuxiliar(actividad, ajustes) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorMaquinas/programacion/auxiliar`, {
        actividad,
        ajustes,
    });
    return response.data;
}

/** Actualiza una actividad auxiliar (mover/redimensionar) con ajustes de reacomodo de OPs. */
export async function actualizarActividadAuxiliar(id, actividad, ajustes) {
    await api.put(`${API_BASE_URL}/PlaneadorMaquinas/programacion/auxiliar/${id}`, {
        actividad,
        ajustes,
    });
    return true;
}

export async function actualizarProgramacionOP(id, payload) {
    await api.put(`${API_BASE_URL}/PlaneadorMaquinas/programacion/${id}`, payload);
    return true;
}

export async function eliminarProgramacionOP(id) {
    await api.delete(`${API_BASE_URL}/PlaneadorMaquinas/programacion/${id}`);
    return true;
}

/** OPs disponibles desde Planeación (ficha + OP + línea de troquel). */
export async function getOpsDisponiblesProgramacion(q = '') {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/programacion/ops-disponibles`, {
        params: q ? { q } : {},
    });
    return response.data;
}

/** Datos integrados de una OP para autocompletar el formulario. */
export async function getDatosOpProgramacion(numero) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/programacion/datos-op`, {
        params: { numero },
    });
    return response.data;
}

/** Parámetros de cálculo de horas por máquina (estándar, alistamiento, lavada). */
export async function getParametrosCalculoMaquinas() {
    const response = await api.get(`${API_BASE_URL}/PlaneadorMaquinas/maquinas/parametros-calculo`);
    return response.data;
}

export async function upsertParametrosCalculoMaquina(id, horasAlistamiento, horasLavada) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorMaquinas/maquinas/${id}/parametros-calculo`, {
        maquinaId: id,
        horasAlistamiento,
        horasLavada,
    });
    return response.data;
}

// ==================== ROSTER / DISPONIBILIDAD ====================

export async function getHorariosDisponibilidad(includeInactive = false) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorDisponibilidad/horarios`, {
        params: includeInactive ? { includeInactive: true } : {},
    });
    return response.data;
}

export async function crearHorario(payload) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorDisponibilidad/horarios`, payload);
    return response.data;
}

export async function actualizarHorario(id, payload) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorDisponibilidad/horarios/${id}`, payload);
    return response.data;
}

export async function eliminarHorario(id) {
    const response = await api.delete(`${API_BASE_URL}/PlaneadorDisponibilidad/horarios/${id}`);
    return response.data;
}

export async function getTurnosConfigMaquina(maquinaId) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorDisponibilidad/maquinas/${maquinaId}/turnos-config`);
    return response.data;
}

export async function putTurnosConfigMaquina(maquinaId, items) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorDisponibilidad/maquinas/${maquinaId}/turnos-config`, items);
    return response.data;
}

export async function putEstadoOperativoMaquina(maquinaId, estadoOperativo) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorDisponibilidad/maquinas/${maquinaId}/estado-operativo`, {
        estadoOperativo,
    });
    return response.data;
}

export async function getRosterSemana(semanaInicio) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorDisponibilidad/roster`, {
        params: { semanaInicio },
    });
    return response.data;
}

export async function putRosterSemana(semanaInicio, asignaciones) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorDisponibilidad/roster`, {
        semanaInicio,
        asignaciones,
    });
    return response.data;
}

export async function copiarRosterSemanaAnterior(semanaInicio) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorDisponibilidad/roster/copiar-semana`, {
        semanaInicio,
    });
    return response.data;
}

/** Excepción de turno por día: incluir=true agrega, incluir=false quita ese día. */
export async function upsertTurnoDia({ fechaDia, maquinaId, horarioId, incluir }) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorDisponibilidad/roster/turnos-dia`, {
        fechaDia,
        maquinaId,
        horarioId,
        incluir,
    });
    return response.data;
}

/** Quita la excepción: el día vuelve al config base de la máquina. */
export async function deleteTurnoDia(fechaDia, maquinaId, horarioId) {
    await api.delete(`${API_BASE_URL}/PlaneadorDisponibilidad/roster/turnos-dia`, {
        params: { fechaDia, maquinaId, horarioId },
    });
    return true;
}

/** Marca o desmarca un día como festivo (persistido por fecha). */
export async function putDiaFestivo({ fechaDia, festivo, observacion = null }) {
    const response = await api.put(`${API_BASE_URL}/PlaneadorDisponibilidad/roster/dias-festivos`, {
        fechaDia,
        festivo,
        observacion,
    });
    return response.data;
}

export async function getPersonalNovedades(desde, hasta) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorDisponibilidad/personal/novedades`, {
        params: { desde, hasta },
    });
    return response.data;
}

export async function crearPersonalNovedad(payload) {
    const response = await api.post(`${API_BASE_URL}/PlaneadorDisponibilidad/personal/novedades`, payload);
    return response.data;
}

export async function eliminarPersonalNovedad(id) {
    await api.delete(`${API_BASE_URL}/PlaneadorDisponibilidad/personal/novedades/${id}`);
    return true;
}

/** Avisos no bloqueantes de cobertura/disponibilidad para un tramo en una máquina. */
export async function getAvisosDisponibilidad(maquinaId, inicio, fin) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorDisponibilidad/disponibilidad/avisos`, {
        params: { maquinaId, inicio, fin },
    });
    return response.data;
}

/** Resumen máquina ↔ turnos ↔ operarios del roster para el tramo. */
export async function getCoberturaDisponibilidad(maquinaId, inicio, fin) {
    const response = await api.get(`${API_BASE_URL}/PlaneadorDisponibilidad/disponibilidad/cobertura`, {
        params: { maquinaId, inicio, fin },
    });
    return response.data;
}


