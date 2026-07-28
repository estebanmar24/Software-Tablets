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

/** Normaliza código a forma comparable: "01a" → "1a", "03" → "3". */
export function normalizeCodigoMaquina(codigo: string | null | undefined): string {
    if (!codigo) return '';
    const m = String(codigo).trim().toLowerCase().match(/^0*(\d{1,2})([a-z]?)$/);
    if (!m) return String(codigo).trim().toLowerCase();
    return `${parseInt(m[1], 10)}${m[2] || ''}`;
}

export function normalizarNombreProceso(nombre: string | null | undefined): string {
    return (nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Máquinas permitidas por proceso del Gantt (códigos Perla).
 * `null` = solo "Sin máquina".
 */
export const PROCESO_A_CODIGOS_MAQUINA: Record<string, string[] | null> = {
    conversion: ['1a', '1b'],
    corrugacion: ['13a', '13b'],
    corte: ['2a', '2b'],
    impresion: ['3', '4', '5', '6', '7'],
    acabado: ['11', '16', '8c'],
    colaminado: ['10a', '10b'],
    troquelado: ['8a', '8b', '9'],
    despique: null,
    pegadora: ['14'],
    terminado: null,
    'terminado manual': null,
};

/** Códigos permitidos, null (sin máquina) o undefined (sin regla → todas). */
export function codigosMaquinaParaProceso(proceso: string | null | undefined): string[] | null | undefined {
    const key = normalizarNombreProceso(proceso);
    if (!key) return undefined;
    if (Object.prototype.hasOwnProperty.call(PROCESO_A_CODIGOS_MAQUINA, key)) {
        return PROCESO_A_CODIGOS_MAQUINA[key];
    }
    return undefined;
}

export function procesoRequiereSinMaquina(proceso: string | null | undefined): boolean {
    return codigosMaquinaParaProceso(proceso) === null;
}

/**
 * Filtra máquinas del catálogo según el proceso.
 * Si el proceso no tiene mapeo, devuelve todas.
 */
export function maquinasParaProceso<T extends { nombre?: string; Nombre?: string }>(
    proceso: string | null | undefined,
    maquinas: T[] | null | undefined
): T[] {
    const list = Array.isArray(maquinas) ? maquinas : [];
    const codes = codigosMaquinaParaProceso(proceso);
    if (codes === null) return [];
    if (!codes?.length) return list;
    const wanted = new Set(codes.map(normalizeCodigoMaquina));
    return list.filter((m) => {
        const cod = normalizeCodigoMaquina(codigoPerlaDesdeNombre(m.nombre ?? m.Nombre));
        return !!cod && wanted.has(cod);
    });
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
    calibre: string;
    gramaje: string;
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
    const calibre = valorCampo(campos, 'calibre');
    const gramaje = valorCampo(campos, 'gramaje');
    if (!material && !anchoRollo && !calibre && !gramaje) return null;
    return {
        material,
        calibre,
        gramaje,
        anchoRollo: valorCampo(campos, 'anchoRollo'),
        largoCorte: valorCampo(campos, 'largoCorte'),
        anchoPliego: valorCampo(campos, 'anchoPliego'),
        altoPliego: valorCampo(campos, 'altoPliego'),
        hojas: valorCampo(campos, 'hojas'),
        cb: valorCampo(campos, 'cb'),
        tamanoFinal: valorCampo(campos, 'tamanoFinal'),
    };
}
