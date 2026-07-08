import { parseProcesosDetalle, valorCampo } from './adjuntosCamposResumen';

/** Número Perla (sin cero inicial) → código proceso en PDF/OP cuando difieren. */
export const MAQUINA_PERLA_A_CODIGO_OP: Record<string, string> = {
    '16': '12', // 16 Barnizadora UV (Perla) = 12 en la OP
};

export type ProcesoOpFila = {
    proceso: string;
    notas: string;
    cantidad: string;
};

const PALABRAS_A_CODIGO_OP: { patron: RegExp; codigo: string }[] = [
    { patron: /convertidora/i, codigo: '01a' },
    { patron: /guillotina/i, codigo: '02a' },
    { patron: /speedmaster|impresi[oó]n/i, codigo: '07' },
    { patron: /troqueladora/i, codigo: '09' },
    { patron: /barnizadora/i, codigo: '12' },
    { patron: /manual|terminados/i, codigo: '16' },
];

/** Extrae código OP del proceso (ej. "01a Convertidora" → "01a"). */
export function codigoDesdeProcesoOp(proceso: string): string {
    const m = (proceso || '').trim().match(/^(\d{1,2}[a-z]?)/i);
    return m ? m[1].toLowerCase() : '';
}

/**
 * Código Perla desde nombre: "1A CONVERTIDORA" → "01a", "16 Barnizadora" → "16".
 */
export function codigoPerlaDesdeNombre(nombre: string | null | undefined): string | null {
    const n = (nombre || '').trim();
    if (!n) return null;
    const m = n.match(/^(\d{1,2})([a-z])?/i);
    if (!m) return null;
    const num = m[1].padStart(2, '0');
    const letter = (m[2] || '').toLowerCase();
    return num + letter;
}

/**
 * Código de proceso a buscar en la OP según la máquina seleccionada en Perla.
 */
export function codigoOpParaMaquina(
    maquinaId: number | null | undefined,
    maquinaNombre: string | null | undefined
): string | null {
    const codPerla = codigoPerlaDesdeNombre(maquinaNombre);
    if (codPerla) {
        const numSinCero = String(parseInt(codPerla.replace(/[a-z]$/i, ''), 10) || '');
        const mapped = MAQUINA_PERLA_A_CODIGO_OP[numSinCero];
        if (mapped) return mapped.toLowerCase();
        return codPerla.toLowerCase();
    }

    if (maquinaNombre) {
        for (const { patron, codigo } of PALABRAS_A_CODIGO_OP) {
            if (patron.test(maquinaNombre)) return codigo;
        }
    }

    if (maquinaId != null && MAQUINA_PERLA_A_CODIGO_OP[String(maquinaId)]) {
        return MAQUINA_PERLA_A_CODIGO_OP[String(maquinaId)].toLowerCase();
    }

    return null;
}

function codigoBase(codigo: string): string {
    return codigo.replace(/[a-z]$/i, '').padStart(2, '0');
}

/** ¿El proceso de la OP corresponde a esta máquina? */
export function procesoCoincideMaquina(procesoLinea: string, codigoOp: string): boolean {
    const cod = codigoDesdeProcesoOp(procesoLinea);
    if (!cod || !codigoOp) return false;
    const op = codigoOp.toLowerCase();
    if (cod === op) return true;
    if (cod.startsWith(op)) return true;
    if (op.startsWith(cod)) return true;
    return codigoBase(cod) === codigoBase(op);
}

export function buscarProcesoOpParaMaquina(
    campos: Record<string, string> | null | undefined,
    maquinaId: number | null | undefined,
    maquinaNombre: string | null | undefined
): ProcesoOpFila | null {
    const codigoOp = codigoOpParaMaquina(maquinaId, maquinaNombre);
    if (!codigoOp) return null;
    const filas = parseProcesosDetalle(campos || {});
    return filas.find((f) => procesoCoincideMaquina(f.proceso, codigoOp)) ?? null;
}

export type MaterialOpResumen = {
    material: string;
    anchoRollo: string;
    largoCorte: string;
    anchoPliego: string;
    altoPliego: string;
    hojas: string;
    cb: string;
    tamanoFinal: string;
};

export function materialDesdeOp(campos: Record<string, string> | null | undefined): MaterialOpResumen | null {
    if (!campos) return null;
    const material = valorCampo(campos, 'material');
    const anchoRollo = valorCampo(campos, 'anchoRollo');
    if (!material && !anchoRollo) return null;
    return {
        material,
        anchoRollo: valorCampo(campos, 'anchoRollo'),
        largoCorte: valorCampo(campos, 'largoCorte'),
        anchoPliego: valorCampo(campos, 'anchoPliego'),
        altoPliego: valorCampo(campos, 'altoPliego'),
        hojas: valorCampo(campos, 'hojas'),
        cb: valorCampo(campos, 'cb'),
        tamanoFinal: valorCampo(campos, 'tamanoFinal'),
    };
}
