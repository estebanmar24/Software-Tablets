import { api } from './productionApi';
import { getFileServerUrl } from './apiConfig';

export type AdjuntoArchivo = {
    url: string;
    nombre: string;
};

export type AdjuntoTipoDoc = 'ficha' | 'op' | 'linea_troquel';

export type AdjuntosOpResult = {
    numero: string;
    ficha: AdjuntoArchivo | null;
    op: AdjuntoArchivo | null;
    lineaTroquel: AdjuntoArchivo | null;
};

export async function buscarAdjuntosOp(numero: string): Promise<AdjuntosOpResult> {
    const digits = (numero || '').replace(/\D/g, '');
    if (!digits) {
        return { numero: '', ficha: null, op: null, lineaTroquel: null };
    }
    const { data } = await api.get<AdjuntosOpResult>('Adjuntos/buscar', { params: { numero: digits } });
    return data;
}

export type AdjuntoExtraccionDoc = {
    tipo: string;
    archivoNombre: string;
    url?: string | null;
    metodo: string;
    textoCompleto: string;
    campos: Record<string, string>;
    fechaExtraccion?: string;
    error?: string;
};

export type AdjuntoExtraccionOp = {
    numero: string;
    ficha?: AdjuntoExtraccionDoc | null;
    op?: AdjuntoExtraccionDoc | null;
    lineaTroquel?: AdjuntoExtraccionDoc | null;
};

export async function obtenerDatosAdjuntos(numero: string, forzar = false): Promise<AdjuntoExtraccionOp> {
    const digits = (numero || '').replace(/\D/g, '');
    const { data } = await api.get<AdjuntoExtraccionOp>('Adjuntos/datos', {
        params: { numero: digits, forzar },
        timeout: 120000,
    });
    return data;
}

export type AdjuntoSubirResponse = {
    numero: string;
    tipo: string;
    archivoNombre: string;
    url: string;
    extraccion?: AdjuntoExtraccionDoc | null;
};

export async function subirAdjuntoOp(
    numero: string,
    tipo: AdjuntoTipoDoc,
    file: File | Blob | { uri: string; name: string; type: string }
): Promise<AdjuntoSubirResponse> {
    const digits = (numero || '').replace(/\D/g, '');
    const formData = new FormData();
    formData.append('numero', digits);
    formData.append('tipo', tipo);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formData.append('file', file as any);
    const { data } = await api.post<AdjuntoSubirResponse>('Adjuntos/subir', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
    });
    return data;
}

export type AdjuntoExtraccionResumen = {
    tipo: string;
    archivoNombre: string;
    url?: string | null;
    metodo: string;
    fechaExtraccion?: string | null;
    error?: string | null;
    campos: Record<string, string>;
    textoLongitud: number;
};

export type AdjuntoBibliotecaItem = {
    numero: string;
    tieneFicha: boolean;
    tieneOp: boolean;
    tieneLineaTroquel: boolean;
    fichaModificado?: string | null;
    opModificado?: string | null;
    lineaTroquelModificado?: string | null;
    ficha?: AdjuntoExtraccionResumen | null;
    op?: AdjuntoExtraccionResumen | null;
    lineaTroquel?: AdjuntoExtraccionResumen | null;
};

export type AdjuntoBibliotecaLista = {
    total: number;
    items: AdjuntoBibliotecaItem[];
};

export async function listarBibliotecaAdjuntos(q = ''): Promise<AdjuntoBibliotecaLista> {
    const { data } = await api.get<AdjuntoBibliotecaLista>('Adjuntos/biblioteca', {
        params: q ? { q } : undefined,
    });
    return data;
}

export async function reextraerAdjunto(
    numero: string,
    tipo: AdjuntoTipoDoc | 'ambos' = 'ambos'
): Promise<AdjuntoExtraccionOp | AdjuntoExtraccionDoc> {
    const digits = (numero || '').replace(/\D/g, '');
    const { data } = await api.post('Adjuntos/reextraer', null, {
        params: { numero: digits, tipo },
        timeout: 300000,
    });
    return data;
}

export async function eliminarAdjuntoOp(numero: string): Promise<{
    numero: string;
    archivosEliminados: number;
    registrosEliminados: number;
    errores?: string[] | null;
    message?: string;
}> {
    const digits = (numero || '').replace(/\D/g, '');
    const { data } = await api.delete('Adjuntos', { params: { numero: digits } });
    return data;
}

export async function resolveAdjuntoUrl(relativeUrl: string): Promise<string> {
    const base = await getFileServerUrl();
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return relativeUrl;
    return `${base}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
}
