import { api } from './productionApi';

export interface ContabilidadGasto {
    id: number;
    area: string;
    rubro: string;
    proveedor?: string;
    precio: number;
    fecha: string;
    numeroFactura?: string;
    numeroOP?: string;
    nota?: string;
    facturaPdfUrl?: string;
    esPendiente: boolean;
    esSolicitudCredito: boolean;
    mes: number;
    anio: number;
}

const API_BASE_URL = 'contabilidad';

export async function getConsolidado(mes: number, anio: number): Promise<ContabilidadGasto[]> {
    const response = await api.get<ContabilidadGasto[]>(`${API_BASE_URL}/consolidado`, {
        params: { mes, anio }
    });
    return response.data;
}

export async function getFileUrl(): Promise<string> {
    const response = await api.get<{ url: string }>('produccion/file-url');
    return response.data.url;
}
