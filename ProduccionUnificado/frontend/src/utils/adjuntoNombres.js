/** Nombres de archivo estándar en Adjuntos/ por tipo de documento. */
export function nombreArchivoAdjunto(tipo, digits) {
    switch (tipo) {
        case 'ficha':
            return `F${digits}.pdf`;
        case 'op':
            return `OP${digits}.pdf`;
        case 'linea_troquel':
            return `LT${digits}.pdf`;
        default:
            return `${digits}.pdf`;
    }
}

export function prefijoArchivoAdjunto(tipo) {
    switch (tipo) {
        case 'ficha':
            return 'F';
        case 'op':
            return 'OP';
        case 'linea_troquel':
            return 'LT';
        default:
            return '';
    }
}
