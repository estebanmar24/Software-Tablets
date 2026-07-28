/** Campos de negocio a mostrar tras OCR (orden fijo, por secciones). */

export const SECCIONES_RESUMEN_OP = [
    {
        titulo: 'Datos generales',
        campos: [
            ['fechaApertura', 'Fecha de apertura'],
            ['fechaDespacho', 'Fecha de despacho'],
            ['cliente', 'Cliente'],
            ['nit', 'NIT/CC'],
            ['direccion', 'Dirección'],
            ['trabajo', 'Trabajo'],
            ['ctdAProducir', 'Ctd a producir'],
            ['compraCliente', 'O. compra cliente'],
            ['codigoTroquel', 'Código troquel'],
            ['pieza', 'Pieza'],
        ],
    },
    {
        titulo: 'Material',
        campos: [
            ['material', 'Material'],
            ['calibre', 'Calibre'],
            ['gramaje', 'Gramaje (g)'],
            ['anchoRollo', 'Ancho rollo'],
            ['largoCorte', 'Largo corte'],
            ['anchoPliego', 'Ancho pliego'],
            ['altoPliego', 'Alto pliego'],
            ['hojas', 'Hojas'],
            ['cb', 'CB'],
            ['tamanoFinal', 'Tamaño final'],
        ],
    },
    {
        titulo: 'Procesos',
        tipo: 'procesos',
    },
];

/** Lista plana (compatibilidad). */
export const CAMPOS_RESUMEN_OP = SECCIONES_RESUMEN_OP.flatMap((s) =>
    s.tipo === 'procesos' ? [['cantidadProcesos', 'Procesos']] : s.campos
);

export const CAMPOS_RESUMEN_FICHA = [
    ['fechaCreacion', 'Fecha de creación'],
    ['fechaModificacion', 'Fecha modificación'],
    ['cliente', 'Cliente'],
    ['ejecCuenta', 'Ejec. de cuenta'],
    ['lineaProducto', 'Línea de producto'],
    ['nombreProductoReferencia', 'Nombre del producto y referencia'],
    ['pieza', 'Pieza'],
];

export function valorCampo(campos, key) {
    if (!campos) return '';
    return String(campos[key] ?? campos[key.toLowerCase()] ?? '').trim();
}

/** Convierte cantidad OCR (ej. 5.500) a número sin separador de miles para formularios. */
export function cantidadOpParaFormulario(val) {
    const t = String(val ?? '').trim();
    if (!t) return '';
    if (/^\d{1,4}(\.\d{3})+$/.test(t)) return t.replace(/\./g, '');
    if (t.includes(',') && t.includes('.')) return t.replace(/\./g, '').replace(',', '.');
    return t.replace(/[^0-9.]/g, '');
}

/** Campos de encuesta NC desde extracción OP. */
export function camposEncuestaDesdeOp(campos) {
    if (!campos) return null;
    const referencia = valorCampo(campos, 'trabajo');
    const cliente = valorCampo(campos, 'cliente');
    const material = valorCampo(campos, 'material');
    const cabida = valorCampo(campos, 'cb');
    const ctd = cantidadOpParaFormulario(valorCampo(campos, 'ctdAProducir'));
    if (!referencia && !cliente && !material && !cabida && !ctd) return null;
    return { referencia, cliente, material, cabida, cantidadAProducir: ctd };
}

/** Cliente y referencia para requisición de almacén (OP OCR, ficha OCR o catálogo). */
export function camposRequisicionDesdeAdjuntos(data) {
    if (!data) return null;
    const desdeOp = camposEncuestaDesdeOp(data?.op?.campos);
    if (desdeOp?.cliente || desdeOp?.referencia) {
        return { cliente: desdeOp.cliente, referencia: desdeOp.referencia };
    }
    const ficha = data?.ficha?.campos;
    if (!ficha) return null;
    const cliente = valorCampo(ficha, 'cliente');
    const referencia =
        valorCampo(ficha, 'nombreProductoReferencia') ||
        valorCampo(ficha, 'lineaProducto') ||
        valorCampo(ficha, 'pieza');
    if (!cliente && !referencia) return null;
    return { cliente, referencia };
}

export function entradasResumen(campos, orden) {
    if (!campos) return [];
    return orden
        .map(([key, label]) => {
            const val = valorCampo(campos, key);
            return val ? { key, label, val } : null;
        })
        .filter(Boolean);
}

/** Convierte "01a X | notas | 1.375,00" en filas para tarjetas. */
export function parseProcesosDetalle(campos) {
    const raw = valorCampo(campos, 'procesosDetalle');
    if (!raw) return [];
    return raw
        .split('\n')
        .map((linea) => linea.trim())
        .filter(Boolean)
        .map((linea) => {
            const partes = linea.split('|').map((p) => p.trim());
            if (partes.length >= 3) {
                return {
                    proceso: partes[0],
                    notas: partes.slice(1, -1).join(' | '),
                    cantidad: partes[partes.length - 1],
                };
            }
            return { proceso: linea, notas: '', cantidad: '' };
        });
}

/** Parsea piezasJson (multi-pieza OP). */
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
