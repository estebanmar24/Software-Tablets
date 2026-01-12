/**
 * Talleres API Service
 * Handles all API calls for Talleres y Despachos Budget and Expense Management
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

// ==================== RUBROS ====================

export async function getRubros() {
    const response = await fetch(`${API_BASE_URL}/talleres/rubros`);
    if (!response.ok) throw new Error('Error fetching rubros');
    return response.json();
}

export async function createRubro(rubro) {
    const response = await fetch(`${API_BASE_URL}/talleres/rubros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rubro)
    });
    if (!response.ok) throw new Error(`Error creating rubro (Status: ${response.status})`);
    return response.ok;
}

export async function updateRubro(id, rubro) {
    const response = await fetch(`${API_BASE_URL}/talleres/rubros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rubro, id })
    });
    if (!response.ok) throw new Error('Error updating rubro');
    return response.ok;
}

export async function deleteRubro(id) {
    const response = await fetch(`${API_BASE_URL}/talleres/rubros/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting rubro');
    return response.ok;
}

// ==================== PROVEEDORES ====================

export async function getProveedores() {
    const response = await fetch(`${API_BASE_URL}/talleres/proveedores`);
    if (!response.ok) throw new Error('Error fetching proveedores');
    return response.json();
}

export async function createProveedor(proveedor) {
    const response = await fetch(`${API_BASE_URL}/talleres/proveedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proveedor)
    });
    if (!response.ok) throw new Error(`Error creating proveedor (Status: ${response.status})`);
    return response.ok;
}

export async function updateProveedor(id, proveedor) {
    const response = await fetch(`${API_BASE_URL}/talleres/proveedores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...proveedor, id })
    });
    if (!response.ok) throw new Error('Error updating proveedor');
    return response.ok;
}

export async function deleteProveedor(id) {
    const response = await fetch(`${API_BASE_URL}/talleres/proveedores/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting proveedor');
    return response.ok;
}

// ==================== GASTOS ====================

export async function getGastos(anio, mes) {
    const response = await fetch(`${API_BASE_URL}/talleres/gastos?anio=${anio}&mes=${mes}`);
    if (!response.ok) throw new Error('Error fetching gastos');
    return response.json();
}

export async function createGasto(gasto) {
    const response = await fetch(`${API_BASE_URL}/talleres/gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gasto)
    });
    if (!response.ok) throw new Error(`Error creating gasto (Status: ${response.status})`);
    return response.ok;
}

export async function updateGasto(id, gasto) {
    const response = await fetch(`${API_BASE_URL}/talleres/gastos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gasto, id })
    });
    if (!response.ok) throw new Error('Error updating gasto');
    return response.ok;
}

export async function deleteGasto(id) {
    const response = await fetch(`${API_BASE_URL}/talleres/gastos/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error deleting gasto');
    return response.ok;
}

// ==================== GRAFICAS ====================

export async function getGraficas(anio, mes) {
    const response = await fetch(`${API_BASE_URL}/talleres/graficas/${anio}/${mes}`);
    if (!response.ok) throw new Error('Error fetching graficas');
    return response.json();
}

export async function getGraficasAnual(anio) {
    const response = await fetch(`${API_BASE_URL}/talleres/graficas/anual/${anio}`);
    if (!response.ok) throw new Error('Error fetching graficas anual');
    return response.json();
}

// ==================== PRESUPUESTOS ====================

export async function getPresupuestos(anio) {
    const response = await fetch(`${API_BASE_URL}/talleres/presupuestos?anio=${anio}`);
    if (!response.ok) throw new Error('Error fetching presupuestos');
    return response.json();
}

/**
 * Helper to transform flat budget list into grid format for the UI
 */
export async function getPresupuestosGrid(anio) {
    // 1. Get all active Rubros
    const rubros = await getRubros();

    // 2. Get existing budgets for year
    const presupuestos = await getPresupuestos(anio); // Returns [{ rubroId, anio, mes, presupuesto, ... }]

    // 3. Build grid structure
    const totalesMensuales = Array(12).fill(0);
    let totalAnual = 0;

    const tiposServicio = rubros.map(rubro => {
        const meses = [];
        for (let m = 1; m <= 12; m++) {
            const p = presupuestos.find(x => x.rubroId === rubro.id && x.mes === m);
            const val = p ? p.presupuesto : 0;

            meses.push({
                mes: m,
                presupuesto: val
            });

            totalesMensuales[m - 1] += val;
            totalAnual += val;
        }

        return {
            tipoServicioId: rubro.id,
            tipoServicioNombre: rubro.nombre,
            meses: meses
        };
    });

    return {
        tiposServicio,
        totalesMensuales,
        totalAnual
    };
}

export async function setPresupuestosBulk(presupuestos) {
    // Transform incoming array if necessary, but the backend accepts [{rubroId, anio, mes, presupuesto}]
    // The UI sends { rubroId, anio, mes, presupuesto } if mapped correctly
    const response = await fetch(`${API_BASE_URL}/talleres/presupuestos/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presupuestos)
    });
    if (!response.ok) throw new Error('Error setting presupuestos bulk');
    return response.ok;
}
