/** Registro sin finalizar (EnProgreso, Pausado o legado horaInicio === horaFin). */
export const isRegistroEnProgreso = (r) => {
    if (!r) return false;
    if (r.estado === 'EnProgreso' || r.estado === 'Pausado') return true;
    if (r.estado === 'Finalizado') return false;
    if (!r.horaInicio || !r.horaFin) return false;
    const hi = String(r.horaInicio).trim();
    const hf = String(r.horaFin).trim();
    return hi === hf || hf === '---' || r.duracion === 'En Progreso';
};

export const isRegistroPausado = (r) => r?.estado === 'Pausado';

export const parseRecordStartDate = (r) => {
    if (!r?.fecha || !r?.horaInicio) return null;
    const fecha = String(r.fecha).includes('T') ? String(r.fecha).slice(0, 10) : String(r.fecha);
    const d = new Date(`${fecha}T${String(r.horaInicio).slice(0, 8)}`);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** Registro abierto más reciente por hora de inicio. */
export const getRegistroVivoMasReciente = (registros) => {
    if (!Array.isArray(registros) || registros.length === 0) return null;
    const abiertos = registros.filter(isRegistroEnProgreso);
    if (abiertos.length === 0) return null;
    return [...abiertos].sort((a, b) => {
        const ta = parseRecordStartDate(a)?.getTime() ?? 0;
        const tb = parseRecordStartDate(b)?.getTime() ?? 0;
        return tb - ta;
    })[0];
};
