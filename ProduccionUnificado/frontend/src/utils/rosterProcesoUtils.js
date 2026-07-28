import {
    codigoPerlaDesdeNombre,
    maquinasParaProceso,
    normalizarNombreProceso,
} from './opProcesoMaquina';

/** Catálogo Gantt (mismo orden que backend ProcesosGantt). */
export const GANTT_PROCESOS_CATALOGO = [
    'Conversion', 'Corrugacion', 'Corte', 'Impresion', 'Acabado',
    'Colaminado', 'Troquelado', 'Despique', 'Pegadora', 'Terminado Manual',
];

export function esProcesoVirtualRoster(nombre, procesoList = GANTT_PROCESOS_CATALOGO) {
    const n = normalizarNombreProceso(nombre);
    if (!n || codigoPerlaDesdeNombre(nombre)) return false;
    return (procesoList || GANTT_PROCESOS_CATALOGO).some(
        (p) => normalizarNombreProceso(p) === n,
    );
}

export function findMaquinaVirtualProceso(procesoNombre, maquinas, procesoList = GANTT_PROCESOS_CATALOGO) {
    const key = normalizarNombreProceso(procesoNombre);
    if (!key) return null;
    return (maquinas || []).find((m) => {
        const nombre = m.nombre ?? m.Nombre ?? '';
        return normalizarNombreProceso(nombre) === key
            && esProcesoVirtualRoster(nombre, procesoList);
    }) || null;
}

/** IDs de máquina cuyo roster aplica a un proceso Gantt (virtual + físicas). */
export function maquinaIdsParaProcesoGantt(procesoNombre, maquinas, procesoList = GANTT_PROCESOS_CATALOGO) {
    const ids = new Set();
    const virtual = findMaquinaVirtualProceso(procesoNombre, maquinas, procesoList);
    if (virtual) ids.add(Number(virtual.id ?? virtual.Id));
    for (const m of maquinasParaProceso(procesoNombre, maquinas)) {
        ids.add(Number(m.id ?? m.Id));
    }
    return [...ids].filter((id) => id > 0);
}

/**
 * IDs para consultar cobertura al programar OP.
 * - Máquina seleccionada: solo esa física (el backend agrega el proceso virtual).
 * - Sin máquina: solo el proceso virtual (horarios a nivel proceso).
 */
export function maquinaIdsParaCoberturaOp(procesoNombre, maquinas, procesoList, maquinaIdSeleccionada) {
    const sel = Number(maquinaIdSeleccionada);
    if (sel > 0) return [sel];

    const virtual = findMaquinaVirtualProceso(procesoNombre, maquinas, procesoList);
    if (virtual) {
        const vid = Number(virtual.id ?? virtual.Id);
        if (vid > 0) return [vid];
    }
    return [];
}

export function mergeCoberturaTurnos(...responses) {
    const map = new Map();
    for (const res of responses) {
        for (const t of res?.turnos || []) {
            const key = `${t.fechaDia}|${t.inicio}|${t.fin}|${t.horarioId ?? ''}`;
            if (!map.has(key)) {
                map.set(key, { ...t, personas: [...(t.personas || [])] });
                continue;
            }
            const existing = map.get(key);
            const seen = new Set((existing.personas || []).map((p) => p.usuarioId ?? p.UsuarioId));
            for (const p of t.personas || []) {
                const uid = p.usuarioId ?? p.UsuarioId;
                if (seen.has(uid)) continue;
                seen.add(uid);
                existing.personas.push(p);
            }
        }
    }
    const turnos = [...map.values()].sort((a, b) => {
        const cmp = String(a.fechaDia).localeCompare(String(b.fechaDia));
        if (cmp !== 0) return cmp;
        return String(a.inicio).localeCompare(String(b.inicio));
    });
    return { turnos };
}

/** Separa máquinas virtuales de proceso vs equipos físicos Perla. */
export function splitMaquinasRoster(maquinas, procesoList = GANTT_PROCESOS_CATALOGO) {
    const procesos = [];
    const fisicas = [];
    for (const m of maquinas || []) {
        const nombre = m.nombre ?? m.Nombre ?? '';
        if (esProcesoVirtualRoster(nombre, procesoList)) {
            procesos.push(m);
        } else {
            fisicas.push(m);
        }
    }
    const ordenProceso = (a, b) => {
        const na = normalizarNombreProceso(a.nombre ?? a.Nombre);
        const nb = normalizarNombreProceso(b.nombre ?? b.Nombre);
        const ia = procesoList.findIndex((p) => normalizarNombreProceso(p) === na);
        const ib = procesoList.findIndex((p) => normalizarNombreProceso(p) === nb);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return na.localeCompare(nb, 'es', { numeric: true });
    };
    procesos.sort(ordenProceso);
    fisicas.sort((a, b) => String(a.nombre ?? a.Nombre).localeCompare(String(b.nombre ?? b.Nombre), 'es', { numeric: true }));
    return { procesos, fisicas };
}

export function buildProcesosOpcionesRoster(procesosGantt, maquinas) {
    const list = (procesosGantt?.length ? procesosGantt : GANTT_PROCESOS_CATALOGO)
        .map((p) => (typeof p === 'string' ? p : (p.nombre ?? p.Nombre ?? '')))
        .filter(Boolean);
    const byName = {};
    for (const m of maquinas || []) {
        const n = normalizarNombreProceso(m.nombre ?? m.Nombre);
        if (n) byName[n] = m;
    }
    return list.map((nombre) => ({
        nombre,
        maquina: byName[normalizarNombreProceso(nombre)] ?? null,
    }));
}

export function labelProcesoFila(nombreMaquina, procesoList = GANTT_PROCESOS_CATALOGO) {
    const n = (nombreMaquina || '').trim();
    if (esProcesoVirtualRoster(n, procesoList)) return n;
    return n;
}

export function toggleSeleccionMaquina(currentId, nextId) {
    if (currentId != null && String(currentId) === String(nextId)) return '';
    return String(nextId);
}

/** Mapa id máquina virtual → ids físicas del mismo proceso Gantt. */
export function virtualMaquinaToFisicasMap(maquinas, procesoList = GANTT_PROCESOS_CATALOGO) {
    const map = {};
    for (const m of maquinas || []) {
        const nombre = m.nombre ?? m.Nombre ?? '';
        if (!esProcesoVirtualRoster(nombre, procesoList)) continue;
        const mid = Number(m.id ?? m.Id);
        if (!mid) continue;
        map[mid] = maquinasParaProceso(nombre, maquinas)
            .map((x) => Number(x.id ?? x.Id))
            .filter((id) => id > 0);
    }
    return map;
}

/** Replica asignaciones de proceso virtual en máquinas físicas (cobertura). */
export function maquinaIdsParaAsignacionCobertura(maquinaId, virtualMap) {
    const id = Number(maquinaId);
    const spread = virtualMap?.[id];
    if (spread?.length) return [id, ...spread];
    return [id];
}
