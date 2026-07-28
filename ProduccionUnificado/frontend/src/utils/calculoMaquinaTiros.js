import { codigoPerlaDesdeNombre, normalizeCodigoMaquina } from './opProcesoMaquina';

export const emptyLineaTiros = (concepto = 'Principal') => ({
    id: `lt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    concepto,
    tirosBruto: '',
    sobrante: '0',
});

export const parseNumFlexible = (v) => {
    if (v == null || v === '') return 0;
    const s = String(v).trim().replace(/\s/g, '');
    if (/^\d{1,4}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, '')) || 0;
    return parseFloat(s.replace(',', '.')) || 0;
};

/** Migra tirosBruto plano → lineasTiros[]. */
export function normalizeLineasTiros(snapOrCalc) {
    const snap = snapOrCalc || {};
    if (Array.isArray(snap.lineasTiros) && snap.lineasTiros.length > 0) {
        return snap.lineasTiros.map((l, i) => ({
            id: l.id || `lt-${i}`,
            concepto: l.concepto || `Línea ${i + 1}`,
            tirosBruto: l.tirosBruto != null ? String(l.tirosBruto) : '',
            sobrante: l.sobrante != null ? String(l.sobrante) : '0',
        }));
    }
    const bruto = snap.tirosBruto != null ? String(snap.tirosBruto) : '';
    if (!bruto.trim()) return [emptyLineaTiros('Principal')];
    return [{
        id: 'lt-1',
        concepto: 'Principal',
        tirosBruto: bruto,
        sobrante: snap.sobrante != null ? String(snap.sobrante) : '0',
    }];
}

export function sumTirosFromLineas(lineasTiros) {
    let bruto = 0;
    let sobrante = 0;
    (lineasTiros || []).forEach((l) => {
        bruto += parseNumFlexible(l.tirosBruto);
        sobrante += parseNumFlexible(l.sobrante);
    });
    return { bruto, sobrante, neto: Math.max(0, bruto - sobrante) };
}

export function ensurePorMaquinaLineas(porMaquina = {}) {
    const next = { ...porMaquina };
    Object.keys(next).forEach((id) => {
        if (id === '__seed__') return;
        const snap = next[id];
        if (!snap || typeof snap !== 'object') return;
        next[id] = {
            ...snap,
            lineasTiros: normalizeLineasTiros(snap),
        };
    });
    return next;
}

/** Suma bruto/sobrante de líneas al root del cálculo activo (compat UI). */
export function applyLineasTirosToCalculoRoot(calc) {
    if (!calc?.maquinaCalculoId) return calc;
    const snap = calc.porMaquina?.[calc.maquinaCalculoId] || calc;
    const lineas = normalizeLineasTiros(snap);
    const { bruto, sobrante } = sumTirosFromLineas(lineas);
    return {
        ...calc,
        lineasTiros: lineas,
        tirosBruto: bruto > 0 ? String(Math.round(bruto)) : '',
        sobrante: sobrante > 0 ? String(sobrante) : '0',
    };
}

/** Extrae cantidad de tiros desde notas OP ("2848 TIROS", "109 TIROS"). */
export function extractTirosFromNotas(notas) {
    const text = String(notas || '');
    const m = text.match(/([\d]{1,4}(?:\.\d{3})*|\d+)\s*TIROS/i)
        || text.match(/([\d]{1,4}(?:\.\d{3})*|\d+)\s*FONDOS/i)
        || text.match(/([\d]{1,4}(?:\.\d{3})*|\d+)\s*TAMA[NÑ]OS/i);
    if (!m) return '';
    return String(parseNumFlexible(m[1]));
}

export function conceptoDesdeProcesoOp(proceso, notas) {
    const n = String(notas || '').toUpperCase();
    const p = String(proceso || '').toUpperCase();
    if (/FONDO/.test(n) || /FONDO/.test(p)) return 'Fondos';
    if (/LADO\s*1/i.test(n)) return 'Lado 1';
    if (/LADO\s*2/i.test(n)) return 'Lado 2';
    if (/REFILAR|TAMA[NÑ]O/i.test(n)) return 'Refilar';
    if (/TROQUEL/i.test(n)) return 'Troquelar';
    return 'Principal';
}

function codigoMaquinaDesdeProcesoOp(nombreProceso) {
    const m = String(nombreProceso || '').trim().match(/^((?:\d{2}[A-Za-z]?)|(?:\d[A-Za-z]))/i);
    return m ? normalizeCodigoMaquina(m[1]) : '';
}

function maquinaIdDesdeCodigoOp(codigo, maquinasList, parametrosCalculo) {
    if (!codigo) return null;
    const fromMaquinas = (maquinasList || []).find((m) => {
        const c = normalizeCodigoMaquina(codigoPerlaDesdeNombre(m.nombre || m.Nombre));
        return c === codigo;
    });
    if (fromMaquinas) return fromMaquinas.id;
    const fromParams = (parametrosCalculo || []).find((p) => {
        const c = normalizeCodigoMaquina(codigoPerlaDesdeNombre(p.nombre || p.Nombre));
        return c === codigo;
    });
    return fromParams?.maquinaId || null;
}

/** Agrupa filas OP por máquina → líneas de tiros sugeridas. */
export function buildLineasTirosMapFromOpDatos(opDatos, maquinasList = [], parametrosCalculo = []) {
    const map = new Map();
    const filas = [];
    if (Array.isArray(opDatos?.piezas)) {
        opDatos.piezas.forEach((pieza) => {
            (pieza.procesos || []).forEach((proc) => {
                filas.push({
                    proceso: proc.proceso || proc.Proceso || '',
                    notas: proc.notas || proc.Notas || '',
                    pieza: pieza.nombre,
                });
            });
        });
    }
    const detalle = opDatos?.procesosDetalle;
    if (typeof detalle === 'string' && detalle.trim()) {
        detalle.split('\n').forEach((linea) => {
            const parts = linea.split('|').map((s) => s.trim());
            if (parts[0]) filas.push({ proceso: parts[0], notas: parts[1] || '', cantidad: parts[2] || '' });
        });
    }

    filas.forEach((f) => {
        const cod = codigoMaquinaDesdeProcesoOp(f.proceso);
        const maquinaId = maquinaIdDesdeCodigoOp(cod, maquinasList, parametrosCalculo);
        if (!maquinaId) return;
        const conceptoBase = conceptoDesdeProcesoOp(f.proceso, f.notas);
        const concepto = f.pieza ? `${conceptoBase} (${f.pieza})` : conceptoBase;
        const tiros = extractTirosFromNotas(f.notas);
        if (!map.has(maquinaId)) map.set(maquinaId, []);
        const list = map.get(maquinaId);
        const dup = list.find((l) => l.concepto === concepto);
        if (dup) {
            if (tiros && !dup.tirosBruto) dup.tirosBruto = tiros;
            return;
        }
        list.push({
            id: `lt-op-${maquinaId}-${list.length}`,
            concepto,
            tirosBruto: tiros,
            sobrante: '0',
        });
    });

    return map;
}

export function getOrdenMaquinasCalculoIds(calc) {
    if (Array.isArray(calc?.ordenMaquinasCalculoIds) && calc.ordenMaquinasCalculoIds.length > 0) {
        return calc.ordenMaquinasCalculoIds.filter(Boolean);
    }
    const ids = [];
    if (calc?.maquinaCalculoId) ids.push(calc.maquinaCalculoId);
    (calc?.maquinasCalculoExtraIds || []).forEach((id) => {
        if (id && !ids.includes(id)) ids.push(id);
    });
    return ids;
}

export function syncMaquinasCalculoOrden(calc) {
    const orden = getOrdenMaquinasCalculoIds(calc);
    const active = calc?.maquinaCalculoId && orden.includes(calc.maquinaCalculoId)
        ? calc.maquinaCalculoId
        : (orden[0] || null);
    return {
        ...calc,
        ordenMaquinasCalculoIds: orden,
        maquinaCalculoId: active,
        maquinasCalculoExtraIds: orden.filter((id) => id !== active),
    };
}

export function parseCalculoJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Tiros programados en el planeador para una máquina (suma líneas Principal + Fondos…). */
export function getTirosProgramadosMaquina(calculoJsonOrObj, maquinaId) {
    const calc = parseCalculoJson(calculoJsonOrObj);
    if (!calc || !maquinaId) {
        return { total: 0, lineas: [], cantidadEntregar: 0 };
    }

    const mid = Number(maquinaId);
    const key = String(maquinaId);
    let lineas = [];

    const snapDirect = calc.porMaquina?.[mid] ?? calc.porMaquina?.[key];
    if (snapDirect) {
        lineas = normalizeLineasTiros(snapDirect);
    }

    if (calc.multiPieza && calc.piezas) {
        Object.values(calc.piezas).forEach((pieza) => {
            const snap = pieza?.porMaquina?.[mid] ?? pieza?.porMaquina?.[key];
            if (!snap) return;
            const ls = normalizeLineasTiros(snap);
            if (lineas.length === 0) {
                lineas = ls;
            } else {
                lineas = [...lineas, ...ls];
            }
        });
    }

    const activas = lineas.filter((l) => parseNumFlexible(l.tirosBruto) > 0);
    const { bruto } = sumTirosFromLineas(activas.length ? activas : lineas);

    return {
        total: bruto,
        lineas: activas.length ? activas : lineas,
        cantidadEntregar: parseNumFlexible(calc.cantidadSolicitada) || 0,
    };
}
