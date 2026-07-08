export const MSG_GASTO_HORAS_DUPLICADO =
    'Ya existe un registro con los mismos datos (operario, horario, cantidad y tipo de hora/recargo).';

/** Normaliza HH:MM o HH:MM:SS a HH:MM */
export function normalizeTimeValue(value) {
    if (value == null || value === '') return '';
    const raw = String(value).trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return raw;
    const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
    const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Normaliza fecha a YYYY-MM-DD */
export function normalizeFechaValue(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (raw.includes('/')) {
        const [day, month, year] = raw.split('/');
        if (year && month && day) {
            return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return raw;
}

export function getGastoOperarioId(gasto) {
    return gasto?.usuarioId ?? gasto?.UsuarioId ?? gasto?.personalId ?? gasto?.PersonalId ?? null;
}

export function getGastoFecha(gasto) {
    const f = gasto?.fecha ?? gasto?.Fecha;
    return normalizeFechaValue(f);
}

function normalizeCantidad(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

function sameOptionalId(a, b) {
    const na = a == null || a === '' ? null : Number(a);
    const nb = b == null || b === '' ? null : Number(b);
    if (na == null && nb == null) return true;
    if (na == null || nb == null) return false;
    return na === nb;
}

function horariosCoinciden(hiExisting, hfExisting, hiCandidate, hfCandidate) {
    const hiE = normalizeTimeValue(hiExisting);
    const hfE = normalizeTimeValue(hfExisting);
    const hiC = normalizeTimeValue(hiCandidate);
    const hfC = normalizeTimeValue(hfCandidate);
    if (hiE === hiC && hfE === hfC) return true;
    // Registros antiguos sin horario guardado: mismo operario/tipo/cantidad/fecha = duplicado
    if (!hiE && !hfE && (hiC || hfC)) return true;
    return false;
}

/**
 * Compara un candidato nuevo contra un gasto existente de HE/recargo.
 */
export function isDuplicateOvertimeGasto(existing, candidate, excludeId = null) {
    if (!existing || !candidate) return false;
    const existingId = existing.id ?? existing.Id;
    if (excludeId != null && existingId != null && Number(existingId) === Number(excludeId)) {
        return false;
    }

    const operarioExisting = getGastoOperarioId(existing);
    const operarioCandidate = candidate.operarioId ?? candidate.usuarioId ?? candidate.personalId;
    if (!sameOptionalId(operarioExisting, operarioCandidate)) return false;

    const fechaExisting = getGastoFecha(existing);
    const fechaCandidate = normalizeFechaValue(candidate.fecha);
    if (fechaExisting && fechaCandidate && fechaExisting !== fechaCandidate) return false;

    const cantExisting = normalizeCantidad(existing.cantidadHoras ?? existing.CantidadHoras);
    const cantCandidate = normalizeCantidad(candidate.cantidadHoras);
    if (cantExisting == null || cantCandidate == null || cantExisting !== cantCandidate) return false;

    const tipoHoraExisting = existing.tipoHoraId ?? existing.TipoHoraId ?? null;
    const tipoRecExisting = existing.tipoRecargoId ?? existing.TipoRecargoId ?? null;
    const tipoHoraCandidate = candidate.tipoHoraId ?? null;
    const tipoRecCandidate = candidate.tipoRecargoId ?? null;
    if (!sameOptionalId(tipoHoraExisting, tipoHoraCandidate)) return false;
    if (!sameOptionalId(tipoRecExisting, tipoRecCandidate)) return false;

    return horariosCoinciden(
        existing.horaInicio ?? existing.HoraInicio,
        existing.horaFin ?? existing.HoraFin,
        candidate.horaInicio,
        candidate.horaFin
    );
}

/** Devuelve el primer duplicado encontrado o null */
export function findDuplicateOvertimeGasto(existingList, candidate, excludeId = null) {
    if (!Array.isArray(existingList) || !candidate) return null;
    return existingList.find(g => isDuplicateOvertimeGasto(g, candidate, excludeId)) || null;
}

export function findDuplicateOvertimeAmongCandidates(existingList, candidates, excludeId = null) {
    if (!Array.isArray(candidates)) return null;
    for (const candidate of candidates) {
        const dup = findDuplicateOvertimeGasto(existingList, candidate, excludeId);
        if (dup) return dup;
    }
    return null;
}

/** Construye candidatos a guardar desde formulario + desglose automático */
export function buildOvertimeCandidatesFromForm(formData, breakdown = [], operarioField = 'usuarioId') {
    const operarioId = formData[operarioField];
    const items = (breakdown || []).filter(item => !item.isLunch);
    if (items.length > 0) {
        return items.map(item => ({
            operarioId,
            horaInicio: formData.horaInicio,
            horaFin: formData.horaFin,
            fecha: formData.fecha,
            cantidadHoras: item.hours,
            tipoHoraId: item.isHe ? item.typeId : null,
            tipoRecargoId: !item.isHe ? item.typeId : null,
        }));
    }
    return [{
        operarioId,
        horaInicio: formData.horaInicio,
        horaFin: formData.horaFin,
        fecha: formData.fecha,
        cantidadHoras: formData.cantidadHoras ? parseFloat(formData.cantidadHoras) : null,
        tipoHoraId: formData.tipoHoraId || null,
        tipoRecargoId: formData.tipoRecargoId || null,
    }];
}
