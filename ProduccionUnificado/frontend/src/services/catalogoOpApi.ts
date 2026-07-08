import { api } from './productionApi';

export interface CatalogoOpDto {
    id?: number;
    numero: string;
    cliente?: string;
    referencia?: string;
    cantidadPlanificada: number;
    mes?: number;
    anio?: number;
    fuente?: string;
}

export const buscarCatalogoOp = async (numero: string, mes?: number, anio?: number) => {
    const digits = String(numero || '').replace(/\D/g, '');
    if (digits.length < 4) return null;
    const params: Record<string, string | number> = { numero: digits };
    if (mes) params.mes = mes;
    if (anio) params.anio = anio;
    try {
        const res = await api.get('catalogo-op/buscar', { params });
        return res.data as CatalogoOpDto;
    } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
    }
};

export const importarCatalogoOpExcel = async (file: File | Blob, mes: number, anio: number, fileName = 'catalogo.xlsx') => {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('mes', String(mes));
    formData.append('anio', String(anio));
    const res = await api.post('catalogo-op/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

export const listarCatalogoOp = async (mes: number, anio: number) => {
    const res = await api.get(`catalogo-op/lista?mes=${mes}&anio=${anio}`);
    return res.data;
};
