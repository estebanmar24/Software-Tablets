import { valorCampo } from './adjuntosCamposResumen';
import { normalizarNombreProceso } from './opProcesoMaquina';

/** Parsea piezasJson del OCR (lista de OpPiezaDto). */
export function parsePiezasDesdeCampos(campos) {
    const raw = valorCampo(campos, 'piezasJson');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function parsePiezasDesdeDatosOp(datos) {
    if (Array.isArray(datos?.piezas) && datos.piezas.length > 0) return datos.piezas;
    return [];
}

export function esOpMultiPieza(datosOrCampos) {
    if (Array.isArray(datosOrCampos?.piezas)) return datosOrCampos.piezas.length > 1;
    if (datosOrCampos?.multiPieza) return true;
    const n = Number(valorCampo(datosOrCampos, 'cantidadPiezas') || 0);
    return n > 1;
}

/** Mapeo código OP → proceso Gantt. */
export function procesoGanttDesdeLineaOp(nombreOp) {
    const n = normalizarNombreProceso(nombreOp);
    if (n.includes('convertid') || /^01/.test(n)) return 'Conversion';
    if (n.includes('guillot') || /^02/.test(n)) return 'Corte';
    if (n.includes('speed') || n.includes('sord') || n.includes('impres') || /^0[3-7]/.test(n)) return 'Impresion';
    if (n.includes('colamin') || /^10/.test(n)) return 'Colaminado';
    if (n.includes('troquel') || n.includes('estamp') || /^8/.test(n) || /^09/.test(n)) return 'Troquelado';
    if (n.includes('corrug') || /^13/.test(n)) return 'Corrugacion';
    if (n.includes('barniz') || n.includes('lamin') || /^11/.test(n) || /^16/.test(n)) return 'Acabado';
    if (n.includes('pegad') || /^14/.test(n)) return 'Pegadora';
    if (n.includes('manual') || n.includes('termin') || /^16/.test(n)) return 'Terminado Manual';
    if (n.includes('despique')) return 'Despique';
    return null;
}

/** Procesos Gantt que aparecen en más de una pieza → candidatos a unión. */
export function detectUnionesSugeridas(piezas) {
    if (!Array.isArray(piezas) || piezas.length < 2) return [];
    const map = new Map();
    piezas.forEach((pieza) => {
        (pieza.procesos || []).forEach((proc) => {
            const gantt = procesoGanttDesdeLineaOp(proc.proceso || '');
            if (!gantt) return;
            if (!map.has(gantt)) map.set(gantt, new Set());
            map.get(gantt).add(pieza.id);
        });
    });
    return [...map.entries()]
        .filter(([, ids]) => ids.size > 1)
        .map(([procesoGantt, idsSet]) => ({
            procesoGantt,
            piezaIds: [...idsSet].sort((a, b) => a - b),
            activo: procesoGantt === 'Colaminado',
        }));
}

export function materialPiezaToCalculoFields(pieza, datosGlobales = {}) {
    const m = pieza?.material || {};
    const tam = m.tamanoFinal || '';
    const [largoTam, anchoTam] = tam.includes('x')
        ? tam.split(/x/i).map((s) => s.trim())
        : ['', ''];
    return {
        sustrato: m.material || '',
        calibre: m.calibre || '',
        gramaje: m.gramaje || '',
        anchoRollo: m.anchoRollo || '',
        largoCorte: m.largoCorte || '',
        hojas: m.hojas || '',
        tamanoFinal: tam,
        cabidad: m.cabidad || m.cb || '',
        largo: m.anchoPliego || largoTam,
        ancho: m.altoPliego || anchoTam,
        colores: datosGlobales.colores || '',
        cantidadTinta: datosGlobales.cantidadTinta != null ? String(datosGlobales.cantidadTinta) : '',
        cantidadSolicitada: datosGlobales.cantidadSolicitada
            ? String(datosGlobales.cantidadSolicitada)
            : String(datosGlobales.metaTiros || ''),
    };
}
