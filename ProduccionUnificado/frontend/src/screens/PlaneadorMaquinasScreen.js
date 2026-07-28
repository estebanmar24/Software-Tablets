import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Modal, TextInput, Platform, useWindowDimensions
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as planeacionApi from '../services/planeacionApi';
import * as api from '../services/api';
import {
    maquinasParaProceso,
    procesoRequiereSinMaquina,
    codigoPerlaDesdeNombre,
    normalizarNombreProceso,
    PROCESO_A_CODIGOS_MAQUINA,
    normalizeCodigoMaquina,
} from '../utils/opProcesoMaquina';
import {
    maquinaIdsParaCoberturaOp,
    mergeCoberturaTurnos,
    findMaquinaVirtualProceso,
} from '../utils/rosterProcesoUtils';
import {
    parsePiezasDesdeDatosOp,
    detectUnionesSugeridas,
    materialPiezaToCalculoFields,
    procesoGanttDesdeLineaOp,
} from '../utils/opPiezas';
import {
    emptyLineaTiros,
    normalizeLineasTiros,
    sumTirosFromLineas,
    ensurePorMaquinaLineas,
    applyLineasTirosToCalculoRoot,
    buildLineasTirosMapFromOpDatos,
    getOrdenMaquinasCalculoIds,
    syncMaquinasCalculoOrden,
} from '../utils/calculoMaquinaTiros';
import {
    parseFechaEntregaValue,
    fechaEntregaFromProgramacion,
    formatFechaEntregaDisplay,
    toDateKeyLocal,
    diasHastaEntrega,
    formatEntregaCountdown,
    entregaBadgeColor,
    entregaEsMismoDia,
} from '../utils/fechaEntregaPlanner';
import { showAppAlert, extractApiErrorMessage } from '../utils/appAlert';
import RosterDisponibilidadPanel from '../components/RosterDisponibilidadPanel';

/** Selector de fecha con calendario nativo en web (type=date). */
function DateCalendarField({ value, onChange, style, isDarkMode, placeholderColor }) {
    const flat = StyleSheet.flatten(style) || {};
    if (Platform.OS === 'web') {
        return (
            <input
                type="date"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    minWidth: flat.minWidth || 130,
                    height: flat.height || 36,
                    borderRadius: flat.borderRadius || 8,
                    border: `1px solid ${flat.borderColor || '#4A5568'}`,
                    padding: '0 10px',
                    fontSize: flat.fontSize || 13,
                    color: flat.color || '#FFF',
                    backgroundColor: flat.backgroundColor || '#2D3748',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    colorScheme: isDarkMode ? 'dark' : 'light',
                    flex: flat.flex ?? 1,
                }}
            />
        );
    }
    return (
        <TextInput
            style={style}
            value={value || ''}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={placeholderColor}
        />
    );
}

const DEFAULT_PROCESOS = [
    'Conversion', 'Corrugacion', 'Corte', 'Impresion', 'Acabado',
    'Colaminado', 'Troquelado', 'Despique', 'Pegadora', 'Terminado Manual',
];

const normalizeProcesoCatalog = (data) => {
    if (!Array.isArray(data)) return [];
    if (data.length && typeof data[0] === 'string') {
        return data.map((nombre, orden) => ({ id: 0, nombre, orden }));
    }
    return data
        .map((p) => ({
            id: p.id ?? p.Id ?? 0,
            nombre: p.nombre ?? p.Nombre ?? '',
            orden: p.orden ?? p.Orden ?? 0,
        }))
        .filter((p) => p.nombre)
        .sort((a, b) => a.orden - b.orden);
};

const reorderCatalogItems = (list, fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) {
        return list;
    }
    const next = [...list];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    return next.map((p, i) => ({ ...p, orden: i }));
};

const DAY_WIDTH = 56;
const WEEK_DAY_WIDTH = 112;
const HOUR_WIDTH = 68;
const BASE_ROW_HEIGHT = 52;
const CHIP_HEIGHT = 18;
const LABEL_COL_WIDTH = 118;
const PROCESS_COL_WIDTH = LABEL_COL_WIDTH;
const DAYS_PER_WEEK = 7;
const MAX_VISIBLE_CHIPS = 3;
const HOURS_PER_DAY = 24;
const HOUR_SLOTS = Array.from({ length: HOURS_PER_DAY }, (_, i) => i);
const MIN_PROCESS_MS = 30 * 60 * 1000;
const DRAG_SNAP_MS = 30 * 60 * 1000;
const DRAG_HANDLE_PX = 8;

const HOUR_OPTIONS = Array.from({ length: HOURS_PER_DAY }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}:00`,
}));

/** Ancho aproximado de cada chip (padding + texto) para auto-scroll. */
const HOUR_CHIP_SCROLL_W = 54;

/** Selector de horas con auto-enfoque a la seleccionada y barra ◀ ▶.
 * blockedHours: { [hora: number]: string } — hora bloqueada → motivo (ej. "OP 7717")
 */
function HourChipsScroller({
    selectedHour,
    onSelect,
    helperColor = '#94A3B8',
    activeTextColor = '#FFF',
    chipKey = 'h',
    blockedHours = null,
}) {
    const scrollRef = useRef(null);
    const hour = Number.isFinite(Number(selectedHour)) ? Number(selectedHour) : 8;
    const isBlocked = useCallback((h) => !!(blockedHours && blockedHours[h]), [blockedHours]);

    const scrollToHour = useCallback((h) => {
        const target = Math.min(23, Math.max(0, Number(h) || 0));
        const x = Math.max(0, (target - 1) * HOUR_CHIP_SCROLL_W);
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo?.({ x, animated: true });
        });
    }, []);

    useEffect(() => {
        const t = setTimeout(() => scrollToHour(hour), 80);
        return () => clearTimeout(t);
    }, [hour, scrollToHour]);

    const findFreeHour = (from, delta) => {
        let next = from + delta;
        const step = delta >= 0 ? 1 : -1;
        while (next >= 0 && next <= 23) {
            if (!isBlocked(next)) return next;
            next += step;
        }
        return null;
    };

    const shiftHour = (delta) => {
        const next = findFreeHour(hour, delta === 0 ? 1 : delta);
        if (next == null) return;
        onSelect(next);
        scrollToHour(next);
    };

    return (
        <View style={{ marginTop: 4 }}>
            <View style={styles.hourNavBar}>
                <TouchableOpacity
                    style={styles.hourNavBtn}
                    onPress={() => shiftHour(-1)}
                    accessibilityLabel="Hora anterior"
                >
                    <Text style={styles.hourNavBtnText}>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.hourNavCenter}
                    onPress={() => scrollToHour(hour)}
                >
                    <Text style={styles.hourNavCenterText}>{`${String(hour).padStart(2, '0')}:00`}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.hourNavBtn}
                    onPress={() => shiftHour(1)}
                    accessibilityLabel="Hora siguiente"
                >
                    <Text style={styles.hourNavBtnText}>▶</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.hourNavBtn} onPress={() => shiftHour(-4)}>
                    <Text style={[styles.hourNavBtnText, { fontSize: 10 }]}>−4h</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.hourNavBtn} onPress={() => shiftHour(4)}>
                    <Text style={[styles.hourNavBtnText, { fontSize: 10 }]}>+4h</Text>
                </TouchableOpacity>
            </View>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 4 }}
                contentContainerStyle={{ paddingRight: 12 }}
            >
                <View style={styles.hourPickerRowNowrap}>
                    {HOUR_OPTIONS.map((h) => {
                        const active = hour === h.value;
                        const blocked = isBlocked(h.value);
                        const motivo = blocked ? blockedHours[h.value] : null;
                        return (
                            <TouchableOpacity
                                key={`${chipKey}-${h.value}`}
                                disabled={blocked}
                                style={[
                                    styles.hourChip,
                                    active && !blocked && styles.hourChipActive,
                                    blocked && styles.hourChipBlocked,
                                ]}
                                onPress={() => {
                                    if (blocked) return;
                                    onSelect(h.value);
                                    scrollToHour(h.value);
                                }}
                            >
                                <Text style={[
                                    styles.hourChipText,
                                    { color: helperColor },
                                    active && !blocked && { color: activeTextColor },
                                    blocked && styles.hourChipBlockedText,
                                ]}
                                >
                                    {h.label}
                                </Text>
                                {blocked ? (
                                    <Text style={styles.hourChipBlockedHint} numberOfLines={1}>
                                        {motivo || 'Ocup.'}
                                    </Text>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const TIPOS_TRABAJO = ['Nuevo', 'Repetición', 'Repetición con cambios'];
const FACTOR_TOTAL_HORAS = 1.1;

const isConvertidora = (m) => /convertidora/i.test(m?.nombre || m?.Nombre || '');
const isGuillotina = (m) => /guillotina/i.test(m?.nombre || m?.Nombre || '');
const isSpeedMaster = (m) => /speedmaster/i.test(m?.nombre || m?.Nombre || '');
const isSpeedMaster6 = (m) => isSpeedMaster(m) && /(?:^|\s)6\s/i.test(m?.nombre || m?.Nombre || '');
const isMaquinaCalculoManual = (m) => /despique|terminado\s*manual|manual\s*\/?\s*terminados/i.test(m?.nombre || m?.Nombre || '');
const parametroTieneCalculoEstandar = (p) => {
    if (!p) return false;
    const meta = Number(p.metaTirosTurno) || 0;
    const run = Number(p.estandarPorHora) || 0;
    return meta > 0 && run > 0;
};
const maquinaSoportaCalculoHoras = (m, param = null) => {
    if (isMaquinaCalculoManual(m)) return false;
    if (param) return parametroTieneCalculoEstandar(param);
    return isConvertidora(m) || isGuillotina(m) || isSpeedMaster(m);
};

const parametroComoMaquina = (p) => (p ? { nombre: p.nombre || p.Nombre || '', Nombre: p.nombre || p.Nombre || '' } : null);

const calcMaquinaParam = (calc, parametrosCalculo) =>
    (parametrosCalculo || []).find((p) => p.maquinaId === calc?.maquinaCalculoId) || null;

const isCalculoModoSpeed = (calc, parametrosCalculo) =>
    isSpeedMaster(parametroComoMaquina(calcMaquinaParam(calc, parametrosCalculo)));

const findMaquinaCatalogo = (maquinas, matcher) => (
    Array.isArray(maquinas) ? maquinas.find(matcher) : null
);

const findParametrosMaquina = (parametros, maquinaId) => (
    (parametros || []).find((p) => p.maquinaId === maquinaId) || null
);

/** Proceso del Gantt asociado a la máquina de cálculo (código Perla ↔ proceso). */
const findProcesoKeyForMaquinaCalculo = (procesoList, maquinaId, maquinas) => {
    const m = (maquinas || []).find((x) => x.id === maquinaId);
    if (!m) return null;
    const nombre = m.nombre || m.Nombre || '';
    const byVirtual = (procesoList || []).find(
        (k) => normalizarNombreProceso(k) === normalizarNombreProceso(nombre)
            && !codigoPerlaDesdeNombre(nombre),
    );
    if (byVirtual) return byVirtual;
    const cod = normalizeCodigoMaquina(codigoPerlaDesdeNombre(nombre));
    if (cod) {
        for (const [procesoKey, codes] of Object.entries(PROCESO_A_CODIGOS_MAQUINA)) {
            if (!codes?.length) continue;
            if (codes.some((c) => normalizeCodigoMaquina(c) === cod)) {
                const match = (procesoList || []).find((k) => normalizarNombreProceso(k) === procesoKey);
                if (match) return match;
            }
        }
    }
    if (isConvertidora(m)) return (procesoList || []).find((k) => /conver/i.test(k)) || null;
    if (isGuillotina(m)) return (procesoList || []).find((k) => /corte/i.test(k)) || null;
    if (isSpeedMaster(m)) return (procesoList || []).find((k) => /impres/i.test(k)) || null;
    return null;
};

const resolveMaquinaCalculoPreferida = (procesosSugeridos, maquinas, parametrosCalculo) => {
    const sugeridos = Array.isArray(procesosSugeridos) ? procesosSugeridos : [];
    const tieneImpresion = sugeridos.some((n) => /impres/i.test(n));
    const tieneCorte = sugeridos.some((n) => /corte/i.test(n));
    const tieneConv = sugeridos.some((n) => /conver/i.test(n));
    const params = paramsCalculoBase(parametrosCalculo);

    if (tieneImpresion && !tieneCorte && !tieneConv) {
        const speedMaq = findMaquinaCatalogo(maquinas, (m) => isSpeedMaster6(m))
            || findMaquinaCatalogo(maquinas, (m) => isSpeedMaster(m));
        const param = findParametrosMaquina(params, speedMaq?.id)
            || params.find((p) => isSpeedMaster(parametroComoMaquina(p)));
        return {
            maquina: speedMaq,
            param,
            maquinaCalculoId: speedMaq?.id || param?.maquinaId || null,
        };
    }

    if (tieneCorte && !tieneConv && !tieneImpresion) {
        const guillotinaMaq = findMaquinaCatalogo(maquinas, (m) => isGuillotina(m) && /2\s*A/i.test(m.nombre))
            || findMaquinaCatalogo(maquinas, (m) => isGuillotina(m));
        const param = findParametrosMaquina(params, guillotinaMaq?.id)
            || params.find((p) => isGuillotina(p));
        return {
            maquina: guillotinaMaq,
            param,
            maquinaCalculoId: guillotinaMaq?.id || param?.maquinaId || null,
        };
    }

    const convertidoraMaq = findMaquinaCatalogo(maquinas, (m) => isConvertidora(m) && /1\s*A/i.test(m.nombre))
        || findMaquinaCatalogo(maquinas, (m) => isConvertidora(m));
    const param = findParametrosMaquina(params, convertidoraMaq?.id)
        || params.find((p) => isConvertidora(p))
        || params[0];
    return {
        maquina: convertidoraMaq,
        param,
        maquinaCalculoId: convertidoraMaq?.id || param?.maquinaId || null,
    };
};

const numeroMaquinaDesdeNombre = (nom) => {
    const m = String(nom || '').match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 9999;
};

const sufijoMaquinaDesdeNombre = (nom) => {
    const m = String(nom || '').match(/^\d+\s*([A-Za-z]?)/);
    return (m?.[1] || '').toLowerCase();
};

const ordenMaquinaCalculo = (p) => {
    const nom = parametroComoMaquina(p)?.nombre || p?.nombre || '';
    const num = numeroMaquinaDesdeNombre(nom);
    const suf = sufijoMaquinaDesdeNombre(nom);
    return num * 100 + (suf ? suf.charCodeAt(0) : 0);
};

const paramsCalculoBase = (parametrosCalculo) =>
    (parametrosCalculo || []).filter((p) => maquinaSoportaCalculoHoras(parametroComoMaquina(p), p));

/** Procesos que determinan qué máquinas mostrar (activos + sugeridos por la OP). */
const getProcesosKeysParaMaquinasCalculo = (form, procesoList, procesosSugeridos = []) => {
    const keys = new Set(
        (procesoList || []).filter((k) => form.procesosSeleccionados?.[k]?.activo)
    );
    (procesosSugeridos || []).forEach((nombre) => {
        if ((procesoList || []).includes(nombre)) keys.add(nombre);
    });
    return [...keys];
};

/** Máquinas de cálculo sugeridas según procesos activos/sugeridos de la OP (1A, 2A, 6…). */
const getMaquinasCalculoAplicables = (form, procesoList, parametrosCalculo, procesosSugeridos = []) => {
    const base = paramsCalculoBase(parametrosCalculo);
    const procesosKeys = getProcesosKeysParaMaquinasCalculo(form, procesoList, procesosSugeridos);
    const ids = new Set();
    const pick = (matcher) => {
        const found = base.find((p) => matcher(parametroComoMaquina(p), p));
        if (found) ids.add(found.maquinaId);
    };

    procesosKeys.forEach((procesoKey) => {
        if (/conver/i.test(procesoKey)) {
            pick((m) => isConvertidora(m) && /1\s*A/i.test(m?.nombre || ''));
            if (![...ids].some((id) => isConvertidora(parametroComoMaquina(base.find((p) => p.maquinaId === id))))) {
                pick((m) => isConvertidora(m));
            }
        }
        if (/corte/i.test(procesoKey)) {
            pick((m) => isGuillotina(m) && /2\s*A/i.test(m?.nombre || ''));
            if (![...ids].some((id) => isGuillotina(parametroComoMaquina(base.find((p) => p.maquinaId === id))))) {
                pick((m) => isGuillotina(m));
            }
        }
        if (/impres/i.test(procesoKey)) {
            pick((m) => isSpeedMaster6(m));
            if (![...ids].some((id) => isSpeedMaster(parametroComoMaquina(base.find((p) => p.maquinaId === id))))) {
                pick((m) => isSpeedMaster(m));
            }
        }
    });

    if (ids.size === 0) {
        pick((m) => isConvertidora(m) && /1\s*A/i.test(m?.nombre || ''));
        pick((m) => isGuillotina(m) && /2\s*A/i.test(m?.nombre || ''));
        pick((m) => isSpeedMaster6(m));
    }

    return base
        .filter((p) => ids.has(p.maquinaId))
        .sort((a, b) => ordenMaquinaCalculo(a) - ordenMaquinaCalculo(b));
};

/** Máquinas elegidas explícitamente por el usuario (orden de clic, sin reordenar alfabético). */
const getMaquinasCalculoVisibles = (calc, _form, _procesoList, parametrosCalculo, _procesosSugeridos = []) => {
    const baseAll = paramsCalculoBase(parametrosCalculo);
    const orden = getOrdenMaquinasCalculoIds(calc);
    return orden
        .map((id) => baseAll.find((x) => x.maquinaId === id))
        .filter(Boolean);
};

const getMaquinasCalculoDisponiblesAgregar = (calc, form, procesoList, parametrosCalculo, procesosSugeridos = []) => {
    const visibles = new Set(getMaquinasCalculoVisibles(calc, form, procesoList, parametrosCalculo, procesosSugeridos).map((p) => p.maquinaId));
    return paramsCalculoBase(parametrosCalculo)
        .filter((p) => !visibles.has(p.maquinaId))
        .sort((a, b) => ordenMaquinaCalculo(a) - ordenMaquinaCalculo(b));
};

/** Procesos del Gantt sin máquina (Despique, Terminado Manual). */
const getProcesosManualesCatalogo = (procesoList) =>
    (procesoList || []).filter((p) => procesoRequiereSinMaquina(p));

const getProcesosManualesSeleccionados = (calc, procesoList) => {
    const sel = Array.isArray(calc?.procesosManualesSeleccionados) ? calc.procesosManualesSeleccionados : [];
    return sel.filter((p) => (procesoList || []).includes(p));
};

const getProcesosManualesDisponiblesAgregar = (calc, procesoList) => {
    const sel = new Set(getProcesosManualesSeleccionados(calc, procesoList));
    return getProcesosManualesCatalogo(procesoList).filter((p) => !sel.has(p));
};

const inferProcesosManualesDesdeSugeridos = (procesosSugeridos, procesoList) => {
    const catalogo = getProcesosManualesCatalogo(procesoList);
    return catalogo.filter((p) => {
        const np = normalizarNombreProceso(p);
        return (procesosSugeridos || []).some((s) => {
            const ns = normalizarNombreProceso(s);
            return ns === np || ns.includes(np) || np.includes(ns);
        });
    });
};

const mergeProcesosManualesSeleccionados = (calc, procesoList, extra = []) => {
    const current = new Set(getProcesosManualesSeleccionados(calc, procesoList));
    (extra || []).forEach((p) => {
        if ((procesoList || []).includes(p)) current.add(p);
    });
    return [...current];
};

const applyHorasCalculoAProcesoMap = (procesos, procesoKey, calculo, horasCalc) => {
    if (!procesoKey || !procesos?.[procesoKey]) return procesos;
    let updated = {
        ...procesos[procesoKey],
        activo: true,
        maquinaId: calculo.maquinaCalculoId || procesos[procesoKey].maquinaId || null,
    };
    if (horasCalc.totalHoras > 0) {
        updated.horasEstimadas = String(Math.round(horasCalc.totalHoras * 100) / 100);
    }
    updated = applyFinAuto(updated);
    return { ...procesos, [procesoKey]: updated };
};

const getCalculoTituloMaquina = (calc, parametrosCalculo) => {
    const p = calcMaquinaParam(calc, parametrosCalculo);
    const m = parametroComoMaquina(p);
    if (isSpeedMaster6(m)) return 'Cálculo de horas (SpeedMaster · 6)';
    if (isSpeedMaster(m)) return 'Cálculo de horas (SpeedMaster)';
    if (isGuillotina(m)) return 'Cálculo de horas (Guillotina / Corte)';
    if (isConvertidora(m)) return 'Cálculo de horas (Convertidora)';
    if (p?.nombre) return `Cálculo de horas (${p.nombre})`;
    return 'Cálculo de horas';
};

const emptyCalculoForm = () => ({
    fechaEntrega: '',
    tipoTrabajo: 'Nuevo',
    colores: '',
    cantidadTinta: '',
    sustrato: '',
    calibre: '',
    gramaje: '',
    anchoRollo: '',
    largoCorte: '',
    hojas: '',
    tamanoFinal: '',
    cantidadSolicitada: '',
    cabidad: '',
    largo: '',
    ancho: '',
    tirosBruto: '',
    tirosRegistrados: 0,
    sobrante: '0',
    restaManualTiros: '0',
    extrasTiros: '0',
    extrasConcepto: '',
    usarTirosPrograma: false,
    maquinaCalculoId: null,
    maquinasCalculoExtraIds: [],
    ordenMaquinasCalculoIds: [],
    porMaquina: {},
    alistamiento: '1',
    lavada: '0.5',
    multiPieza: false,
    piezaActivaId: 1,
    piezas: {},
    uniones: [],
    procesosManualesSeleccionados: [],
});

/** Datos generales del proceso (una sola vez; no se repiten por máquina). */
const CALCULO_CAMPOS_PROCESO = [
    'colores', 'cantidadTinta', 'calibre', 'gramaje',
    'sustrato', 'anchoRollo', 'largoCorte', 'largo', 'ancho',
    'hojas', 'tamanoFinal', 'cantidadSolicitada', 'cabidad',
];

/** Campos por máquina (tiros libres, tiempos…). */
const CALCULO_CAMPOS_MAQUINA = [
    'tipoTrabajo',
    'tirosBruto', 'sobrante', 'restaManualTiros', 'extrasTiros',
    'extrasConcepto', 'usarTirosPrograma', 'alistamiento', 'lavada',
];

const CALCULO_CAMPOS_PIEZA_SNAPSHOT = [
    ...CALCULO_CAMPOS_PROCESO,
    ...CALCULO_CAMPOS_MAQUINA,
    'maquinaCalculoId',
    'maquinasCalculoExtraIds',
    'ordenMaquinasCalculoIds',
    'porMaquina',
    'nombre',
];

const snapshotCalculoPiezaActiva = (calculo) => {
    if (!calculo?.multiPieza || !calculo.piezaActivaId) return calculo;
    const id = calculo.piezaActivaId;
    const snap = { ...(calculo.piezas?.[id] || {}) };
    CALCULO_CAMPOS_PIEZA_SNAPSHOT.forEach((k) => {
        if (calculo[k] !== undefined) snap[k] = calculo[k];
    });
    return {
        ...calculo,
        piezas: { ...(calculo.piezas || {}), [id]: snap },
    };
};

const applyPiezaActivaToCalculoRoot = (calculo, piezaId) => {
    const base = snapshotCalculoPiezaActiva(calculo);
    const snap = base.piezas?.[piezaId] || {};
    const merged = {
        ...base,
        piezaActivaId: piezaId,
        maquinaCalculoId: snap.maquinaCalculoId ?? null,
        maquinasCalculoExtraIds: snap.maquinasCalculoExtraIds || [],
        porMaquina: snap.porMaquina || {},
    };
    [...CALCULO_CAMPOS_PROCESO, ...CALCULO_CAMPOS_MAQUINA].forEach((k) => {
        if (snap[k] !== undefined && snap[k] !== null) merged[k] = snap[k];
    });
    return merged;
};

const switchCalculoPieza = (calculo, piezaId) => {
    if (!calculo?.multiPieza || !piezaId) return calculo;
    return applyPiezaActivaToCalculoRoot(calculo, piezaId);
};

const buildCalculoPiezaBase = (pieza, datos, overrides = {}) => ({
    ...emptyCalculoForm(),
    nombre: pieza?.nombre || `Pieza ${pieza?.id || ''}`,
    ...materialPiezaToCalculoFields(pieza, datos),
    tipoTrabajo: TIPOS_TRABAJO.includes(datos?.tipoTrabajoHint) ? datos.tipoTrabajoHint : 'Nuevo',
    tirosRegistrados: datos?.tirosRegistrados || 0,
    usarTirosPrograma: (Number(datos?.tirosRegistrados) || 0) > 0,
    ...overrides,
});

const getPiezasListFromCalculo = (calculo) => {
    if (!calculo?.multiPieza || !calculo.piezas) return [];
    return Object.entries(calculo.piezas)
        .map(([id, p]) => ({ id: Number(id), nombre: p?.nombre || `Pieza ${id}` }))
        .sort((a, b) => a.id - b.id);
};

const getCalculoPiezaView = (calculo, piezaId) => {
    if (!calculo?.multiPieza || piezaId == null) return calculo;
    return applyPiezaActivaToCalculoRoot(calculo, piezaId);
};

const persistCalculoFormState = (calculo) => {
    let c = calculo || emptyCalculoForm();
    if (c.multiPieza) c = snapshotCalculoPiezaActiva(c);
    else if (c.maquinaCalculoId) c = snapshotCalculoMaquina(c, c.maquinaCalculoId);
    c.porMaquina = ensurePorMaquinaLineas(c.porMaquina || {});
    return syncMaquinasCalculoOrden(c);
};

const updateLineasTirosInCalculo = (calculo, maquinaId, updater) => {
    if (!maquinaId) return calculo;
    const porMaquina = ensurePorMaquinaLineas({ ...(calculo.porMaquina || {}) });
    const snap = porMaquina[maquinaId] || extractCalculoCamposMaquina(calculo);
    const lineas = updater(normalizeLineasTiros(snap));
    const { bruto, sobrante } = sumTirosFromLineas(lineas);
    porMaquina[maquinaId] = {
        ...snap,
        lineasTiros: lineas,
        tirosBruto: bruto > 0 ? String(Math.round(bruto)) : '',
        sobrante: sobrante > 0 ? String(sobrante) : '0',
    };
    let next = { ...calculo, porMaquina };
    if (calculo.maquinaCalculoId === maquinaId) {
        next = {
            ...next,
            lineasTiros: lineas,
            tirosBruto: porMaquina[maquinaId].tirosBruto,
            sobrante: porMaquina[maquinaId].sobrante,
        };
    }
    return next;
};

const applyLineasOpToCalculoMaquina = (calculo, maquinaId, lineasSugeridas) => {
    if (!maquinaId || !lineasSugeridas?.length) return calculo;
    const porMaquina = ensurePorMaquinaLineas({ ...(calculo.porMaquina || {}) });
    const existente = normalizeLineasTiros(porMaquina[maquinaId] || {});
    const vacio = existente.every((l) => !parseNumFlexible(l.tirosBruto));
    if (!vacio) return calculo;
    return updateLineasTirosInCalculo(calculo, maquinaId, () => lineasSugeridas.map((l) => ({ ...l })));
};

const procesoKeyMatchesGantt = (procesoKey, ganttName) =>
    normalizarNombreProceso(procesoKey) === normalizarNombreProceso(ganttName);

const isFieldFilled = (v) => String(v ?? '').trim() !== '';

const parseNumFlexible = (v) => {
    if (v == null || v === '') return 0;
    const s = String(v).trim().replace(/\s/g, '');
    if (/^\d{1,4}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, '')) || 0;
    return parseFloat(s.replace(',', '.')) || 0;
};

const extractCalculoCamposMaquina = (calculo) => {
    const snap = {};
    CALCULO_CAMPOS_MAQUINA.forEach((k) => { snap[k] = calculo?.[k]; });
    snap.lineasTiros = normalizeLineasTiros(calculo);
    return snap;
};

const snapshotCalculoMaquina = (calculo, maquinaId) => {
    if (!calculo || !maquinaId) return calculo;
    return {
        ...calculo,
        porMaquina: {
            ...(calculo.porMaquina || {}),
            [maquinaId]: extractCalculoCamposMaquina(calculo),
        },
    };
};

const applySnapToCalculo = (calculo, snap, maquinaId) => {
    const lineas = normalizeLineasTiros(snap);
    const { bruto, sobrante } = sumTirosFromLineas(lineas);
    const merged = {
        ...calculo,
        maquinaCalculoId: maquinaId,
        lineasTiros: lineas,
        tirosBruto: bruto > 0 ? String(Math.round(bruto)) : '',
        sobrante: sobrante > 0 ? String(sobrante) : '0',
    };
    CALCULO_CAMPOS_MAQUINA.forEach((k) => {
        if (snap[k] !== undefined && snap[k] !== null) merged[k] = snap[k];
    });
    CALCULO_CAMPOS_PROCESO.forEach((k) => {
        if (calculo[k] !== undefined && calculo[k] !== null) merged[k] = calculo[k];
    });
    return merged;
};

const liftProcessFieldsFromPorMaquina = (calculo) => {
    const base = { ...calculo, porMaquina: { ...(calculo.porMaquina || {}) } };
    CALCULO_CAMPOS_PROCESO.forEach((k) => {
        if (isFieldFilled(base[k])) return;
        for (const snap of Object.values(base.porMaquina)) {
            if (snap && isFieldFilled(snap[k])) {
                base[k] = snap[k];
                break;
            }
        }
    });
    base.porMaquina = Object.fromEntries(
        Object.entries(base.porMaquina).map(([id, snap]) => {
            if (!snap || typeof snap !== 'object') return [id, snap];
            const cleaned = { ...snap };
            CALCULO_CAMPOS_PROCESO.forEach((k) => { delete cleaned[k]; });
            if (!parseNumFlexible(cleaned.tirosBruto)) {
                const cant = parseNumFlexible(base.cantidadSolicitada || snap.cantidadSolicitada);
                const cb = parseNumFlexible(base.cabidad || snap.cabidad) || 1;
                if (cant > 0 && cb > 0) {
                    cleaned.tirosBruto = String(Math.round(cant / cb));
                }
            }
            return [id, cleaned];
        })
    );
    return base;
};

const loadCalculoMaquina = (calculo, maquinaId, parametrosCalculo) => {
    if (!maquinaId) return calculo;
    const porMaquina = { ...(calculo.porMaquina || {}) };
    let snap = porMaquina[maquinaId];
    if (!snap) {
        snap = extractCalculoCamposMaquina(calculo);
        const p = (parametrosCalculo || []).find((x) => x.maquinaId === maquinaId);
        if (p) {
            snap.alistamiento = String(p.horasAlistamiento ?? snap.alistamiento ?? 1);
            snap.lavada = String(p.horasLavada ?? snap.lavada ?? 0.5);
        }
        porMaquina[maquinaId] = snap;
    }
    return applySnapToCalculo({ ...calculo, porMaquina }, snap, maquinaId);
};

const switchCalculoMaquina = (calculo, newMaquinaId, parametrosCalculo) => {
    if (!newMaquinaId) return calculo;
    const prevPrimary = calculo.maquinaCalculoId;
    let next = prevPrimary
        ? snapshotCalculoMaquina(calculo, prevPrimary)
        : { ...calculo };

    let orden = getOrdenMaquinasCalculoIds(next);
    if (!orden.includes(newMaquinaId)) orden = [...orden, newMaquinaId];

    next = loadCalculoMaquina(next, newMaquinaId, parametrosCalculo);
    next = syncMaquinasCalculoOrden({ ...next, maquinaCalculoId: newMaquinaId, ordenMaquinasCalculoIds: orden });
    return applyLineasTirosToCalculoRoot(next);
};

const getCalculoForMaquina = (calculo, maquinaId, parametrosCalculo) => {
    if (!calculo || !maquinaId) return calculo;
    const snap = calculo.porMaquina?.[maquinaId];
    const merged = snap
        ? applySnapToCalculo(calculo, snap, maquinaId)
        : loadCalculoMaquina(calculo, maquinaId, parametrosCalculo);
    CALCULO_CAMPOS_PROCESO.forEach((k) => {
        if (calculo[k] !== undefined && calculo[k] !== null) merged[k] = calculo[k];
    });
    return merged;
};

const normalizeCalculoForm = (calculo, parametrosCalculo) => {
    if (!calculo) return emptyCalculoForm();
    let base = {
        ...emptyCalculoForm(),
        ...calculo,
        porMaquina: ensurePorMaquinaLineas({ ...(calculo.porMaquina || {}) }),
    };
    if (base.multiPieza && base.piezas && Object.keys(base.piezas).length > 0) {
        const piezaId = base.piezaActivaId || Number(Object.keys(base.piezas).sort((a, b) => Number(a) - Number(b))[0]);
        base = applyPiezaActivaToCalculoRoot(base, piezaId);
        base.porMaquina = ensurePorMaquinaLineas(base.porMaquina || {});
    }
    base = liftProcessFieldsFromPorMaquina(base);
    const idsPorMaquina = Object.keys(base.porMaquina || {}).filter((k) => k !== '__seed__');
    if (idsPorMaquina.length > 0) {
        let orden = getOrdenMaquinasCalculoIds(base);
        if (orden.length === 0) orden = idsPorMaquina.map(Number);
        idsPorMaquina.forEach((id) => {
            const numId = Number(id);
            if (!orden.includes(numId)) orden.push(numId);
        });
        base.ordenMaquinasCalculoIds = orden;
        if (!base.maquinaCalculoId) base.maquinaCalculoId = orden[0];
        base = syncMaquinasCalculoOrden(base);
    }
    if (Object.keys(base.porMaquina).length === 0 && base.maquinaCalculoId) {
        base.porMaquina[base.maquinaCalculoId] = extractCalculoCamposMaquina(base);
    } else if (Object.keys(base.porMaquina).length === 0) {
        base.porMaquina.__seed__ = extractCalculoCamposMaquina(base);
    }
    if (base.maquinaCalculoId) {
        return applyLineasTirosToCalculoRoot(loadCalculoMaquina(base, base.maquinaCalculoId, parametrosCalculo));
    }
    return base;
};

const getCalculoFormulaHint = (calc, parametrosCalculo) => {
    if (isCalculoModoSpeed(calc, parametrosCalculo)) {
        return 'Speed 6: ingrese tiros brutos por máquina; total = tiros − sobrante; PN = total tiros ÷ run; total tiempo = alistamiento + PN + lavada (sin ×1,1).';
    }
    return 'Material y dimensiones son del proceso. Cada máquina define sus tiros brutos y tiempos; PN = total tiros ÷ estándar/h; total horas = (Alistamiento + PN + Lavada) × 1,1.';
};

/** Máquinas permitidas para un proceso (lista completa). */
const getMaquinasParaProceso = (proceso, maquinasList) => maquinasParaProceso(proceso, maquinasList);

/** ¿Esta máquina aplica al proceso? */
const maquinaPermitidaEnProceso = (proceso, maquina, maquinasList) => {
    if (!maquina) return false;
    return getMaquinasParaProceso(proceso, maquinasList).some((m) => m.id === maquina.id);
};

/** UI máquinas: si ya hay asignada, solo esa; si no, las del proceso. */
const getMaquinasUiProceso = (proceso, maquinasList, maquinaIdAsignada = null) => {
    const virtual = findMaquinaVirtualProceso(proceso, maquinasList);
    const permitidas = getMaquinasParaProceso(proceso, maquinasList);
    const merged = [];
    const seen = new Set();
    const push = (m) => {
        if (!m || seen.has(m.id)) return;
        seen.add(m.id);
        merged.push(m);
    };
    if (virtual) push(virtual);
    permitidas.forEach(push);
    if (maquinaIdAsignada) {
        const asignada = maquinasList.find((m) => m.id === maquinaIdAsignada);
        if (asignada) return [asignada];
    }
    return merged.length ? merged : permitidas;
};

/** Campos faltantes del paso Datos OP (observaciones es opcional). Urgencias: nada obligatorio. */
const getDatosPasoMissing = (form) => {
    if (form.esUrgencia) return [];
    const missing = [];
    if (!form.numeroOP?.trim()) missing.push('Número de OP');
    if (!form.ordenCompra?.trim()) missing.push('Orden de compra');
    if (!form.lineaTroquel?.trim()) missing.push('Línea de troquel');
    if (!form.cliente?.trim()) missing.push('Cliente');
    if (!form.calculo?.fechaEntrega?.trim()) missing.push('Fecha entrega');
    if (!form.referencia?.trim()) missing.push('Referencia');
    if (!(parseNumFlexible(form.metaTiros) > 0)) missing.push('Unidades');
    if (!(parseNumFlexible(form.precioUnitario) > 0)) missing.push('Precio unitario');
    return missing;
};

/** Campos faltantes del paso Cálculo (concepto extras es opcional). */
const getCalculoPasoMissingSingle = (form, parametrosCalculo, procesoList = [], procesosSugeridos = [], piezaLabel = '') => {
    let c = form.calculo || emptyCalculoForm();
    if (c.maquinaCalculoId) c = snapshotCalculoMaquina(c, c.maquinaCalculoId);
    const missing = [];
    const prefixPieza = piezaLabel ? `${piezaLabel}: ` : '';

    if (!isFieldFilled(c.fechaEntrega)) missing.push(`${prefixPieza}Fecha entrega`);

    const maqs = getMaquinasCalculoVisibles(c, form, procesoList, parametrosCalculo, procesosSugeridos);
    const targets = maqs.length ? maqs : (c.maquinaCalculoId
        ? [{ maquinaId: c.maquinaCalculoId, nombre: calcMaquinaParam(c, parametrosCalculo)?.nombre || 'Máquina' }]
        : []);

    if (targets.length === 0) missing.push(`${prefixPieza}Agregue al menos una máquina`);

    const requiredProceso = [
        ['colores', 'Colores'],
        ['cantidadTinta', 'Cantidad tintas'],
        ['calibre', 'Calibre'],
        ['gramaje', 'Gramaje'],
        ['sustrato', 'Sustrato'],
        ['anchoRollo', 'Ancho rollo'],
        ['largoCorte', 'Largo corte'],
        ['largo', 'Ancho pliego'],
        ['ancho', 'Alto pliego'],
        ['hojas', 'Hojas'],
        ['tamanoFinal', 'Tamaño final'],
        ['cantidadSolicitada', 'Cantidad solicitada'],
        ['cabidad', 'Cabidad'],
    ];
    for (const [key, label] of requiredProceso) {
        if (!isFieldFilled(c[key])) missing.push(`${prefixPieza}${label}`);
    }

    const requiredMaquina = [
        ['tipoTrabajo', 'Tipo de trabajo'],
        ['sobrante', 'Sobrante'],
        ['alistamiento', 'Alistamiento'],
        ['lavada', 'Lavada'],
    ];

    targets.forEach((p) => {
        const calcM = getCalculoForMaquina(c, p.maquinaId, parametrosCalculo);
        const prefix = targets.length > 1 ? `${prefixPieza}${p.nombre || p.maquinaId}: ` : prefixPieza;
        for (const [key, label] of requiredMaquina) {
            if (!isFieldFilled(calcM[key])) missing.push(`${prefix}${label}`);
        }
        const res = computeCalculoHoras({ ...calcM, maquinaCalculoId: p.maquinaId }, parametrosCalculo);
        const lineas = normalizeLineasTiros(calcM.porMaquina?.[p.maquinaId] || calcM);
        const tieneTiros = lineas.some((l) => parseNumFlexible(l.tirosBruto) > 0) || parseNumFlexible(calcM.tirosBruto) > 0;
        if (!tieneTiros) missing.push(`${prefix}Tiros bruto (al menos una línea)`);
        if (res.run <= 0) missing.push(`${prefix}Estándar/run`);
        if (res.totalTiros <= 0) missing.push(`${prefix}Total tiros`);
        if (res.pn <= 0) missing.push(`${prefix}PN`);
        if (res.totalHoras <= 0) missing.push(`${prefix}Total horas`);
    });

    return missing;
};

const getCalculoPasoMissing = (form, parametrosCalculo, procesoList = [], procesosSugeridos = []) => {
    if (form.esUrgencia) return [];
    const c = form.calculo || emptyCalculoForm();
    if (c.multiPieza && c.piezas && Object.keys(c.piezas).length > 0) {
        const snap = snapshotCalculoPiezaActiva(c);
        const piezas = getPiezasListFromCalculo(snap);
        const allMissing = [];
        piezas.forEach(({ id, nombre }) => {
            const calcP = getCalculoPiezaView(snap, id);
            allMissing.push(...getCalculoPasoMissingSingle(
                { ...form, calculo: calcP },
                parametrosCalculo,
                procesoList,
                procesosSugeridos,
                nombre,
            ));
        });
        return allMissing;
    }
    return getCalculoPasoMissingSingle(form, parametrosCalculo, procesoList, procesosSugeridos);
};

const computeCalculoHoras = (calculo, parametrosMaquina) => {
    const snap = calculo?.porMaquina?.[calculo?.maquinaCalculoId];
    const lineas = normalizeLineasTiros(snap || calculo);
    const sumLineas = sumTirosFromLineas(lineas);
    const bruto = sumLineas.bruto || parseNumFlexible(calculo.tirosBruto);
    const params = parametrosMaquina?.find((p) => p.maquinaId === calculo.maquinaCalculoId) || null;
    const speedMode = isSpeedMaster(parametroComoMaquina(params));
    const sobrante = sumLineas.sobrante || parseNumFlexible(calculo.sobrante);

    let extras = 0;
    let restaProg = 0;
    let restaManual = 0;
    let totalTiros;
    if (speedMode) {
        totalTiros = Math.max(0, bruto - sobrante);
    } else {
        extras = parseNumFlexible(calculo.extrasTiros);
        const tirosReg = Number(calculo.tirosRegistrados) || 0;
        const puedeRestar = tirosReg > 0;
        restaProg = puedeRestar && calculo.usarTirosPrograma ? tirosReg : 0;
        restaManual = puedeRestar ? parseNumFlexible(calculo.restaManualTiros) : 0;
        totalTiros = Math.max(0, bruto + extras - restaProg - sobrante - restaManual);
    }

    const run = Number(params?.estandarPorHora) || 0;
    const alistamiento = parseNumFlexible(calculo.alistamiento);
    const lavada = parseNumFlexible(calculo.lavada);
    const pn = run > 0 ? totalTiros / run : 0;
    const factor = speedMode ? 1 : FACTOR_TOTAL_HORAS;
    const totalHoras = (alistamiento + pn + lavada) * factor;
    const netoTiros = Math.max(0, bruto - sobrante);

    return {
        brutoTiros: bruto,
        netoTiros,
        extrasTiros: extras,
        sobrante,
        restaManual,
        restaProg,
        totalTiros,
        lineasTiros: lineas,
        estandarPorHora: run,
        run,
        pn,
        alistamiento,
        lavada,
        totalHoras,
        speedMode,
        maquinaNombre: params?.nombre || '',
        metaTurno: params?.metaTirosTurno || 0,
    };
};

/** Activa solo los procesos ligados a las máquinas elegidas en el paso Cálculo; desactiva el resto. */
const syncProcesosActivosDesdeMaquinasCalculo = (
    procesos,
    calculo,
    parametrosCalculo,
    procesoList,
    maquinasList
) => {
    let calculoSnap = calculo || emptyCalculoForm();
    if (calculoSnap.multiPieza && calculoSnap.piezaActivaId) {
        calculoSnap = snapshotCalculoPiezaActiva(calculoSnap);
    } else if (calculoSnap.maquinaCalculoId) {
        calculoSnap = snapshotCalculoMaquina(calculoSnap, calculoSnap.maquinaCalculoId);
    }
    let next = { ...procesos };

    (procesoList || []).forEach((procKey) => {
        if (procesoRequiereSinMaquina(procKey)) return;
        if (next[procKey]) next[procKey] = { ...next[procKey], activo: false };
    });

    const unionesActivas = (calculoSnap.uniones || []).filter((u) => u.activo);
    const horasPorProceso = new Map();

    const piezaIds = calculoSnap.multiPieza && calculoSnap.piezas
        ? Object.keys(calculoSnap.piezas).map(Number).sort((a, b) => a - b)
        : [null];

    piezaIds.forEach((piezaId) => {
        const calcP = piezaId != null ? getCalculoPiezaView(calculoSnap, piezaId) : calculoSnap;
        let calcSnap = calcP;
        if (calcSnap.maquinaCalculoId) {
            calcSnap = snapshotCalculoMaquina(calcSnap, calcSnap.maquinaCalculoId);
        }
        const maqs = getMaquinasCalculoVisibles(calcSnap, {}, procesoList, parametrosCalculo);
        maqs.forEach((p) => {
            const procKey = findProcesoKeyForMaquinaCalculo(procesoList, p.maquinaId, maquinasList);
            if (!procKey) return;
            const calcM = getCalculoForMaquina(calcSnap, p.maquinaId, parametrosCalculo);
            const calcConMaquina = { ...calcM, maquinaCalculoId: p.maquinaId };
            const horasCalc = computeCalculoHoras(calcConMaquina, parametrosCalculo);
            const union = unionesActivas.find((u) => procesoKeyMatchesGantt(procKey, u.procesoGantt));
            const prev = horasPorProceso.get(procKey) || {
                horas: 0,
                maquinaId: p.maquinaId,
                esUnion: false,
                piezaIds: [],
            };
            if (union) {
                prev.horas += horasCalc.totalHoras;
                prev.esUnion = true;
                prev.piezaIds = union.piezaIds || [];
                if (!prev.maquinaId) prev.maquinaId = p.maquinaId;
            } else {
                if (horasCalc.totalHoras >= prev.horas) {
                    prev.horas = horasCalc.totalHoras;
                    prev.maquinaId = p.maquinaId;
                }
                if (piezaId != null) {
                    prev.piezaIds = [...new Set([...(prev.piezaIds || []), piezaId])];
                }
            }
            horasPorProceso.set(procKey, prev);
        });
    });

    horasPorProceso.forEach((entry, procKey) => {
        next = applyHorasCalculoAProcesoMap(
            next,
            procKey,
            { maquinaCalculoId: entry.maquinaId },
            { totalHoras: entry.horas },
        );
        if (next[procKey]) {
            next[procKey] = {
                ...next[procKey],
                piezaId: entry.piezaIds?.length === 1 ? entry.piezaIds[0] : null,
                esUnion: !!entry.esUnion,
                piezaIds: entry.piezaIds || [],
            };
        }
    });

    getProcesosManualesSeleccionados(calculoSnap, procesoList).forEach((procKey) => {
        if (!next[procKey]) return;
        next[procKey] = {
            ...next[procKey],
            activo: true,
            maquinaId: null,
        };
    });

    return { procesos: next, calculo: calculoSnap };
};

const WEEK_PALETTE = [
    { header: '#1D4ED8', bg: '#1E40AF18', border: '#3B82F6', label: 'Semana 1' },
    { header: '#7C3AED', bg: '#6D28D918', border: '#8B5CF6', label: 'Semana 2' },
    { header: '#0D9488', bg: '#0F766E18', border: '#14B8A6', label: 'Semana 3' },
    { header: '#C2410C', bg: '#EA580C18', border: '#F97316', label: 'Semana 4' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Actividades auxiliares que se pueden arrastrar al Gantt. */
const AUX_ACTIVITY_TYPES = [
    { tipo: 'capacitacion', label: 'Capacitación', icon: '🎓', color: '#8B5CF6', horas: 2 },
    { tipo: 'limpieza', label: 'Limpieza', icon: '🧹', color: '#0D9488', horas: 1 },
];

const ESTADO_GENERAL_CONFIG = {
    pendiente: { label: 'Pendiente', color: '#94A3B8' },
    programado: { label: 'Programado', color: '#3B82F6' },
    en_ejecucion: { label: 'En ejecución', color: '#F59E0B' },
    finalizado: { label: 'Finalizado', color: '#22C55E' },
    cancelado: { label: 'Cancelado', color: '#EF4444' },
};

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');

const ESTADO_CONFIG = {
    pendiente: { label: 'Pendiente', color: '#94A3B8', bg: '#94A3B822' },
    en_proceso: { label: 'En proceso', color: '#3B82F6', bg: '#3B82F622' },
    completado: { label: 'Completado', color: '#22C55E', bg: '#22C55E22' },
    atrasado: { label: 'Atrasado', color: '#EF4444', bg: '#EF444422' },
};

/** Checklist visual de procesos para la vista Lista. */
function ListaProcesosChecklist({ procesos, isDarkMode }) {
    if (!Array.isArray(procesos) || procesos.length === 0) return null;

    return (
        <View style={styles.listProcRow}>
            {procesos.map((p, idx) => {
                const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
                const done = p.estado === 'completado';
                const active = p.estado === 'en_proceso';
                const late = p.estado === 'atrasado';
                return (
                    <View
                        key={p.id || `${p.proceso}-${idx}`}
                        style={[
                            styles.listProcChip,
                            {
                                borderColor: cfg.color + '88',
                                backgroundColor: isDarkMode ? cfg.bg : cfg.bg,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.listProcCheck,
                                {
                                    borderColor: cfg.color,
                                    backgroundColor: done ? cfg.color : 'transparent',
                                },
                            ]}
                        >
                            {done ? (
                                <Text style={styles.listProcCheckMark}>✓</Text>
                            ) : active ? (
                                <View style={[styles.listProcCheckDot, { backgroundColor: cfg.color }]} />
                            ) : late ? (
                                <Text style={[styles.listProcCheckMark, { color: cfg.color, fontSize: 10 }]}>!</Text>
                            ) : null}
                        </View>
                        <Text style={[styles.listProcLabel, { color: isDarkMode ? '#E2E8F0' : '#334155' }]} numberOfLines={1}>
                            {p.proceso}
                        </Text>
                        <Text style={[styles.listProcEstado, { color: cfg.color }]} numberOfLines={1}>
                            {cfg.label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

const formatDateKey = (d) => {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatMoney = (n) => {
    const v = Number(n) || 0;
    return v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
};

/**
 * Facturación semanal del mes:
 * - Meta base = metaMensual / N semanas (cuota fija por semana)
 * - Generado = suma precios de OPs cuyo primer proceso inicia en esa semana
 * - Arrastre = faltantes acumulados de semanas anteriores ya cerradas
 * - Meta total semana = meta base + arrastre
 * - Ej.: mes 1000 en 2 sem → base 500/500; S1 gen 100 → falta 400; S2 base 500 + arrastre 400 = meta 900
 */
const computeWeeklyBilling = (weekGroups, dates, programaciones, metaMensual, today = new Date()) => {
    const n = weekGroups.length;
    if (n === 0) return [];

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const generated = weekGroups.map((w) => {
        const ws = new Date(dates[w.startIdx]);
        ws.setHours(0, 0, 0, 0);
        const we = new Date(dates[w.endIdx]);
        we.setHours(23, 59, 59, 999);
        let sum = 0;
        (programaciones || []).forEach((prog) => {
            if ((prog.tipoActividad || 'op') !== 'op') return;
            const precio = Number(prog.precio) || 0;
            if (precio <= 0) return;
            const procs = prog.procesos || [];
            if (!procs.length) return;
            let minStart = Infinity;
            procs.forEach((p) => {
                const t = new Date(p.fechaInicio).getTime();
                if (!isNaN(t) && t < minStart) minStart = t;
            });
            if (minStart === Infinity) return;
            if (minStart >= ws.getTime() && minStart <= we.getTime()) sum += precio;
        });
        return sum;
    });

    const metaBase = (Number(metaMensual) || 0) / n;
    let arrastreAcum = 0;

    return weekGroups.map((w, i) => {
        const arrastre = arrastreAcum;
        const gen = generated[i];
        const metaTotal = metaBase + arrastre;
        const weekEnd = new Date(dates[w.endIdx]);
        weekEnd.setHours(23, 59, 59, 999);
        const cerrado = weekEnd < todayStart;
        const falta = Math.max(0, metaTotal - gen);
        const saldo = metaTotal - gen;

        if (cerrado) {
            arrastreAcum += falta;
        }

        return {
            weekKey: w.key,
            metaBase,
            arrastre,
            meta: metaTotal,
            generado: gen,
            falta,
            saldo,
            cerrado,
            cumplida: gen >= metaTotal && metaTotal > 0,
        };
    });
};

const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

/** Todos los días del mes calendario de baseDate (del 1 al último día). */
const getRangeDates = (baseDate) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
};

const buildDefaultProcesosForm = (procesoList = DEFAULT_PROCESOS) => {
    const result = {};
    procesoList.forEach((p) => {
        result[p] = {
            activo: false,
            fechaInicio: '',
            horaInicio: 8,
            fechaFin: '',
            horaFin: 16,
            horasEstimadas: '',
            maquinaId: null,
            tiemposAuxiliares: [],
        };
    });
    return result;
};

const getProcesoFormEntry = () => ({
    activo: false,
    fechaInicio: '',
    horaInicio: 8,
    fechaFin: '',
    horaFin: 16,
    horasEstimadas: '',
    maquinaId: null,
    tiemposAuxiliares: [],
    piezaId: null,
    esUnion: false,
    piezaIds: [],
});

/** Campos faltantes del paso Procesos (fechas obligatorias si el proceso está activo). Urgencias: nada obligatorio. */
const getProcesosPasoMissing = (form, procesoOrder = DEFAULT_PROCESOS) => {
    if (form.esUrgencia) return [];
    const missing = [];
    const activos = Object.entries(form.procesosSeleccionados || {}).filter(([, v]) => v?.activo);
    if (activos.length === 0) {
        missing.push('Al menos un proceso activo');
        return missing;
    }
    for (const [proceso] of activos) {
        const v = form.procesosSeleccionados[proceso];
        if (!v?.fechaInicio?.trim()) {
            missing.push(`${proceso}: fecha inicio`);
            continue;
        }
        if (!v?.fechaFin?.trim()) {
            missing.push(`${proceso}: fecha fin`);
            continue;
        }
        const inicio = buildDateTime(v.fechaInicio, v.horaInicio);
        const fin = buildDateTime(v.fechaFin, v.horaFin);
        if (Number.isNaN(new Date(inicio).getTime()) || Number.isNaN(new Date(fin).getTime())) {
            missing.push(`${proceso}: fechas válidas`);
            continue;
        }
        if (new Date(inicio) >= new Date(fin)) {
            missing.push(`${proceso}: fin posterior al inicio`);
        }
    }
    return missing;
};

const buildDateTime = (dateStr, hour) => {
    const h = String(hour ?? 8).padStart(2, '0');
    return `${dateStr}T${h}:00:00`;
};

/** Turnos del roster que se solapan con la ventana programada del proceso. */
const filterTurnosParaVentana = (turnos, fechaInicio, horaInicio, fechaFin, horaFin) => {
    const iniMs = new Date(buildDateTime(fechaInicio, horaInicio)).getTime();
    const finMs = new Date(buildDateTime(fechaFin, horaFin)).getTime();
    if (Number.isNaN(iniMs) || Number.isNaN(finMs)) return [];

    return (turnos || []).filter((t) => {
        if (!t?.fechaDia) return false;
        const hi = String(t.inicio || '00:00').slice(0, 5);
        const hf = String(t.fin || '23:59').slice(0, 5);
        const tIni = new Date(`${t.fechaDia}T${hi}:00`).getTime();
        const tFin = new Date(`${t.fechaDia}T${hf}:00`).getTime();
        if (Number.isNaN(tIni) || Number.isNaN(tFin)) return false;
        return tIni < finMs && tFin > iniMs;
    });
};

/**
 * Calcula fecha/hora de fin a partir de inicio + horas de trabajo.
 * Si hay minutos de sobra, sube a la siguiente hora en punto (chips 00:00–23:00).
 * Ej: 1-jul 08:00 + 2,49 h → 10:29 → Fin 1-jul 11:00.
 */
const computeFinFromInicioYHoras = (fechaInicio, horaInicio, horasStr) => {
    const horas = parseNumFlexible(horasStr);
    if (!fechaInicio || !(horas > 0)) return null;
    const h0 = Number(horaInicio);
    const hour = Number.isFinite(h0) ? h0 : 8;
    const start = new Date(`${fechaInicio}T${String(hour).padStart(2, '0')}:00:00`);
    if (Number.isNaN(start.getTime())) return null;

    const endExact = new Date(start.getTime() + horas * 60 * 60 * 1000);
    const end = new Date(endExact);
    // Cualquier fracción de hora → siguiente hora en punto (10:29 → 11:00)
    if (end.getMinutes() > 0 || end.getSeconds() > 0 || end.getMilliseconds() > 0) {
        end.setHours(end.getHours() + 1);
    }
    end.setMinutes(0, 0, 0);

    // Al menos 1 h de duración visible en el Gantt
    if (end.getTime() <= start.getTime()) {
        end.setTime(start.getTime() + 60 * 60 * 1000);
    }

    return {
        fechaFin: formatDateKey(end),
        horaFin: end.getHours(),
    };
};

const applyFinAuto = (proc) => {
    if (!proc) return proc;
    const { total } = getHorasEfectivasProceso(proc);
    const fin = computeFinFromInicioYHoras(proc.fechaInicio, proc.horaInicio, total || proc.horasEstimadas);
    if (!fin) return proc;
    return { ...proc, fechaFin: fin.fechaFin, horaFin: fin.horaFin };
};

/** Enriquece segmentos del scheduler con operarios del roster. */
const enrichSegmentsWithPersonas = (segments, turnosCobertura = []) => {
    if (!Array.isArray(segments) || segments.length === 0) return [];
    return segments.map((seg) => ({
        ...seg,
        personas: mergePersonasTurnos(
            seg.personas,
            personasEnRango(turnosCobertura, seg.fecha, seg.startMin, seg.endMin),
        ),
    }));
};

/** Segmentos visuales: prioriza reparto calculado por turnos; si no, deriva del rango manual. */
const resolveRepartoSegmentsForProc = (proc, turnosCobertura = []) => {
    const scheduled = proc?.rosterMeta?.segments;
    if (scheduled?.length && !proc.rosterMeta?.sinTurnos) {
        return enrichSegmentsWithPersonas(scheduled, turnosCobertura);
    }
    return buildSegmentsFromHorarioProceso(proc, turnosCobertura);
};

const parseHoraToMinutes = (raw) => {
    const s = String(raw || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

/** Une operarios/auxiliares de turnos sin duplicar. */
const mergePersonasTurnos = (...lists) => {
    const out = [];
    const seen = new Set();
    for (const list of lists) {
        for (const p of list || []) {
            const id = String(p.usuarioId ?? p.UsuarioId ?? p.nombre ?? '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push(p);
        }
    }
    return out;
};

const turnoCoberturaToWindow = (t) => {
    const ini = parseHoraToMinutes(t.inicio ?? t.Inicio);
    const fin = parseHoraToMinutes(t.fin ?? t.Fin);
    if (ini == null || fin == null || fin <= ini) return null;
    return {
        inicioMin: ini,
        finMin: fin,
        codigo: t.codigo || t.Codigo || '',
        nombre: t.nombre || t.Nombre || '',
        horarioId: t.horarioId ?? t.HorarioId ?? null,
        personas: mergePersonasTurnos(t.personas),
    };
};

const personasEnRango = (turnos, fecha, startMin, endMin) => mergePersonasTurnos(
    ...(turnos || []).filter((t) => {
        if (t.fechaDia !== fecha) return false;
        const ti = parseHoraToMinutes(t.inicio ?? t.Inicio);
        const tf = parseHoraToMinutes(t.fin ?? t.Fin);
        if (ti == null || tf == null) return false;
        return ti < endMin && tf > startMin;
    }).map((t) => t.personas),
);

const addDaysToDateKey = (dateKey, days) => {
    const d = new Date(`${dateKey}T12:00:00`);
    d.setDate(d.getDate() + days);
    return formatDateKey(d);
};

/** Horas base del proceso + suma de tiempos auxiliares. */
const getHorasEfectivasProceso = (proc) => {
    const base = parseNumFlexible(proc?.horasEstimadas);
    const aux = (proc?.tiemposAuxiliares || []).reduce((sum, t) => sum + parseNumFlexible(t.horas), 0);
    return {
        base,
        aux,
        total: Math.round((base + aux) * 100) / 100,
    };
};

/** Franja nocturna Colombia (art. 160 CST / Ley 2466): 19:00 → 06:00. */
const NOCTURNO_INI_MIN = 19 * 60;
const NOCTURNO_FIN_EXCL_MIN = 6 * 60;
const isMinutoNocturno = (minOfDay) => {
    const m = ((minOfDay % (24 * 60)) + (24 * 60)) % (24 * 60);
    return m >= NOCTURNO_INI_MIN || m < NOCTURNO_FIN_EXCL_MIN;
};

/**
 * Compara el horario manual del proceso vs turnos del roster.
 * - Fuera de turno → posible hora extra
 * - Franja 19:00–06:00 → recargo nocturno
 */
const analyzeHorarioVsTurnos = (proc, turnosCobertura = []) => {
    const scheduled = proc?.rosterMeta?.segments;
    if (scheduled?.length && !proc.rosterMeta?.sinTurnos) {
        let dentroMin = 0;
        let fueraMin = 0;
        let nocturnoMin = 0;
        let nocturnoFueraMin = 0;
        for (const seg of scheduled) {
            const mins = Math.max(0, seg.endMin - seg.startMin);
            if (seg.fueraDeTurno) {
                fueraMin += mins;
                for (let m = seg.startMin; m < seg.endMin; m++) {
                    if (isMinutoNocturno(m)) nocturnoFueraMin += 1;
                }
            } else {
                dentroMin += mins;
                for (let m = seg.startMin; m < seg.endMin; m++) {
                    if (isMinutoNocturno(m)) nocturnoMin += 1;
                }
            }
        }
        const totalMin = dentroMin + fueraMin;
        if (totalMin <= 0) return null;
        const horasEnTurno = Math.round((dentroMin / 60) * 100) / 100;
        const horasExtra = Math.round((fueraMin / 60) * 100) / 100;
        const horasNocturnas = Math.round((nocturnoMin / 60) * 100) / 100;
        const horasNocturnasExtra = Math.round((nocturnoFueraMin / 60) * 100) / 100;
        return {
            tieneFueraDeTurno: fueraMin > 0,
            tieneRecargoNocturno: nocturnoMin > 0,
            tieneCruceTurno: scheduled.length > 1 && !proc.rosterMeta?.continuesNextDay,
            horasEnTurno,
            horasExtra,
            horasNocturnas,
            horasNocturnasExtra,
            horasOtroTurno: scheduled.length > 1
                ? Math.round((scheduled.slice(1).reduce((a, s) => a + Math.max(0, s.endMin - s.startMin), 0) / 60) * 100) / 100
                : 0,
            primerTurno: scheduled[0] ? {
                codigo: scheduled[0].codigo,
                inicio: `${String(Math.floor((scheduled[0].ventanaInicioMin ?? scheduled[0].startMin) / 60)).padStart(2, '0')}:${String((scheduled[0].ventanaInicioMin ?? scheduled[0].startMin) % 60).padStart(2, '0')}`,
                fin: `${String(Math.floor((scheduled[0].ventanaFinMin ?? scheduled[0].endMin) / 60)).padStart(2, '0')}:${String((scheduled[0].ventanaFinMin ?? scheduled[0].endMin) % 60).padStart(2, '0')}`,
                nombre: scheduled[0].nombre,
            } : null,
        };
    }

    const fechaIni = typeof proc?.fechaInicio === 'string' ? proc.fechaInicio.slice(0, 10) : null;
    const fechaFin = typeof proc?.fechaFin === 'string' ? proc.fechaFin.slice(0, 10) : null;
    const hIni = Number(proc?.horaInicio);
    const hFin = Number(proc?.horaFin);
    if (!fechaIni || !fechaFin || !Number.isFinite(hIni) || !Number.isFinite(hFin)) return null;

    const turnos = Array.isArray(turnosCobertura) ? turnosCobertura : [];
    const byDay = {};
    const plantilla = [];
    const seenWin = new Set();
    for (const t of turnos) {
        const day = t.fechaDia;
        const ini = parseHoraToMinutes(t.inicio);
        const fin = parseHoraToMinutes(t.fin);
        if (!day || ini == null || fin == null || fin <= ini) continue;
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push({ inicioMin: ini, finMin: fin, codigo: t.codigo || '', nombre: t.nombre || '' });
        const key = `${ini}-${fin}`;
        if (!seenWin.has(key)) {
            seenWin.add(key);
            plantilla.push({ inicioMin: ini, finMin: fin });
        }
    }

    if (plantilla.length === 0 && Object.keys(byDay).length === 0) return null;

    const windowsFor = (day) => {
        const list = byDay[day];
        if (list && list.length) return list;
        return plantilla;
    };

    let totalMin = 0;
    let dentroMin = 0;
    let fueraMin = 0;
    let nocturnoMin = 0;
    let nocturnoFueraMin = 0;
    let day = fechaIni;
    let guard = 0;

    while (day <= fechaFin && guard++ < 40) {
        const startM = day === fechaIni ? hIni * 60 : 0;
        let endM = day === fechaFin ? hFin * 60 : 24 * 60;
        if (day === fechaIni && day === fechaFin && endM <= startM) return null;
        if (endM <= startM) {
            day = addDaysToDateKey(day, 1);
            continue;
        }

        const wins = windowsFor(day);
        for (let m = startM; m < endM; m++) {
            totalMin += 1;
            const inShift = wins.some((w) => m >= w.inicioMin && m < w.finMin);
            if (inShift) dentroMin += 1;
            else fueraMin += 1;
            if (isMinutoNocturno(m)) {
                nocturnoMin += 1;
                if (!inShift) nocturnoFueraMin += 1;
            }
        }
        day = addDaysToDateKey(day, 1);
    }

    if (totalMin <= 0) return null;

    // Turno inicial (donde empieza el proceso): lo que lo supera puede ser otro turno u HE
    const winsIni = windowsFor(fechaIni).slice().sort((a, b) => a.inicioMin - b.inicioMin);
    const startAbs = hIni * 60;
    const primerTurno = winsIni.find((w) => startAbs >= w.inicioMin && startAbs < w.finMin) || winsIni[0] || null;
    let otroTurnoMin = 0;
    let fueraTrasPrimerTurnoMin = 0;
    if (primerTurno) {
        let day = fechaIni;
        let guard2 = 0;
        while (day <= fechaFin && guard2++ < 40) {
            const startM = day === fechaIni ? hIni * 60 : 0;
            const endM = day === fechaFin ? hFin * 60 : 24 * 60;
            const wins = windowsFor(day);
            for (let m = startM; m < endM; m++) {
                const afterFirst = day > fechaIni || m >= primerTurno.finMin;
                if (!afterFirst) continue;
                const inShift = wins.some((w) => m >= w.inicioMin && m < w.finMin);
                if (inShift) otroTurnoMin += 1;
                else fueraTrasPrimerTurnoMin += 1;
            }
            day = addDaysToDateKey(day, 1);
        }
    }

    const toH = (mins) => Math.round((mins / 60) * 100) / 100;
    const horasExtra = toH(fueraMin);
    const horasRecargoNocturno = toH(nocturnoMin);
    const horasRecargoNocturnoExtra = toH(nocturnoFueraMin);
    const horasEnTurno = toH(dentroMin);
    const horasTotal = toH(totalMin);
    const horasOtroTurno = toH(otroTurnoMin);
    const fmtWin = (w) => {
        if (!w) return null;
        const f = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        return {
            codigo: w.codigo || '',
            nombre: w.nombre || '',
            inicio: f(w.inicioMin),
            fin: f(w.finMin),
        };
    };

    return {
        horasTotal,
        horasEnTurno,
        horasExtra,
        horasOtroTurno,
        horasRecargoNocturno,
        horasRecargoNocturnoExtra,
        tieneFueraDeTurno: fueraMin > 0,
        tieneCruceTurno: otroTurnoMin > 0,
        tieneRecargoNocturno: nocturnoMin > 0,
        primerTurno: fmtWin(primerTurno),
        turnosReferencia: plantilla.map((w) => ({
            inicio: `${String(Math.floor(w.inicioMin / 60)).padStart(2, '0')}:${String(w.inicioMin % 60).padStart(2, '0')}`,
            fin: `${String(Math.floor(w.finMin / 60)).padStart(2, '0')}:${String(w.finMin % 60).padStart(2, '0')}`,
        })),
    };
};

/**
 * Arma segmentos visuales desde Inicio/Fin manuales del formulario
 * (no desde horasEstimadas), partiendo el rango en turnos y huecos (HE).
 */
const buildSegmentsFromHorarioProceso = (proc, turnosCobertura = []) => {
    const fechaIni = typeof proc?.fechaInicio === 'string' ? proc.fechaInicio.slice(0, 10) : null;
    const fechaFin = typeof proc?.fechaFin === 'string' ? proc.fechaFin.slice(0, 10) : null;
    const hIni = Number(proc?.horaInicio);
    const hFin = Number(proc?.horaFin);
    if (!fechaIni || !fechaFin || !Number.isFinite(hIni) || !Number.isFinite(hFin)) return [];

    const turnos = Array.isArray(turnosCobertura) ? turnosCobertura : [];
    const byDay = {};
    const plantilla = [];
    const seen = new Set();
    for (const t of turnos) {
        const day = t.fechaDia;
        const ini = parseHoraToMinutes(t.inicio ?? t.Inicio);
        const fin = parseHoraToMinutes(t.fin ?? t.Fin);
        if (!day || ini == null || fin == null || fin <= ini) continue;
        const personas = mergePersonasTurnos(t.personas ?? t.Personas);
        const w = {
            inicioMin: ini,
            finMin: fin,
            codigo: t.codigo || '',
            nombre: t.nombre || '',
            horarioId: t.horarioId ?? null,
            personas,
        };
        if (!byDay[day]) byDay[day] = [];
        const prev = byDay[day].find((x) => x.inicioMin === ini && x.finMin === fin);
        if (prev) {
            prev.personas = mergePersonasTurnos(prev.personas, personas);
        } else {
            byDay[day].push(w);
        }
        const key = `${ini}-${fin}`;
        if (!seen.has(key)) {
            seen.add(key);
            plantilla.push({ ...w, personas: [...personas] });
        }
    }

    const windowsFor = (day) => {
        const list = (byDay[day] || []).slice().sort((a, b) => a.inicioMin - b.inicioMin);
        if (list.length) return list;
        return plantilla.slice().sort((a, b) => a.inicioMin - b.inicioMin);
    };

    const segments = [];
    let day = fechaIni;
    let guard = 0;
    while (day <= fechaFin && guard++ < 40) {
        const rangeStart = day === fechaIni ? hIni * 60 : 0;
        const rangeEnd = day === fechaFin ? hFin * 60 : 24 * 60;
        if (rangeEnd <= rangeStart) {
            day = addDaysToDateKey(day, 1);
            continue;
        }

        const wins = windowsFor(day);
        let cursor = rangeStart;
        const relevant = wins.filter((w) => w.finMin > rangeStart && w.inicioMin < rangeEnd);

        if (relevant.length === 0) {
            segments.push({
                fecha: day,
                startMin: rangeStart,
                endMin: rangeEnd,
                codigo: 'HE',
                nombre: 'Fuera de turno',
                ventanaInicioMin: rangeStart,
                ventanaFinMin: rangeEnd,
                personas: [],
                fueraDeTurno: true,
            });
        } else {
            for (const w of relevant) {
                if (cursor < w.inicioMin) {
                    const gapEnd = Math.min(w.inicioMin, rangeEnd);
                    if (gapEnd > cursor) {
                        segments.push({
                            fecha: day,
                            startMin: cursor,
                            endMin: gapEnd,
                            codigo: 'HE',
                            nombre: 'Fuera de turno',
                            ventanaInicioMin: cursor,
                            ventanaFinMin: gapEnd,
                            personas: [],
                            fueraDeTurno: true,
                        });
                    }
                    cursor = gapEnd;
                }
                if (cursor >= rangeEnd) break;
                const occStart = Math.max(cursor, w.inicioMin);
                const occEnd = Math.min(rangeEnd, w.finMin);
                if (occEnd > occStart) {
                    const personas = mergePersonasTurnos(
                        w.personas,
                        personasEnRango(turnos, day, occStart, occEnd),
                    );
                    segments.push({
                        fecha: day,
                        startMin: occStart,
                        endMin: occEnd,
                        codigo: w.codigo,
                        nombre: w.nombre,
                        ventanaInicioMin: w.inicioMin,
                        ventanaFinMin: w.finMin,
                        horarioId: w.horarioId,
                        personas,
                        fueraDeTurno: false,
                    });
                    cursor = occEnd;
                }
            }
            if (cursor < rangeEnd) {
                segments.push({
                    fecha: day,
                    startMin: cursor,
                    endMin: rangeEnd,
                    codigo: 'HE',
                    nombre: 'Fuera de turno',
                    ventanaInicioMin: cursor,
                    ventanaFinMin: rangeEnd,
                    personas: [],
                    fueraDeTurno: true,
                });
            }
        }
        day = addDaysToDateKey(day, 1);
    }

    return segments;
};

/**
 * Programa el proceso según turnos del roster:
 * - RESPETA la fecha de inicio elegida (no la mueve al cambiar el modo de reparto).
 * - Modo "siguiente_turno" (default): si sobra, sigue en el siguiente turno del MISMO día.
 * - Modo "siguiente_dia": si sobra, salta al mismo tipo de turno del día siguiente.
 * - Modo "siguiente_turno_dia_siguiente": si sobra, salta al primer turno del día siguiente
 *   (no llena el resto de turnos del mismo día).
 * - Incluye horas de tiempos auxiliares.
 */
const scheduleProcesoConTurnos = (proc, turnosCobertura = [], options = {}) => {
    const { snapToShiftStart = false, startMinOverride = null } = options;
    const { base, aux, total: horas } = getHorasEfectivasProceso(proc);
    if (!proc || !(horas > 0)) {
        return { proc: applyFinAuto(proc), meta: null };
    }

    const modo = proc.repartoContinuacion === 'siguiente_dia'
        ? 'siguiente_dia'
        : proc.repartoContinuacion === 'siguiente_turno_dia_siguiente'
            ? 'siguiente_turno_dia_siguiente'
            : 'siguiente_turno';
    const turnos = Array.isArray(turnosCobertura) ? [...turnosCobertura] : [];

    // Fecha de inicio del usuario: nunca sustituir por otra ni inventar desde el roster
    const fechaProc = typeof proc.fechaInicio === 'string' && /^\d{4}-\d{2}-\d{2}/.test(proc.fechaInicio)
        ? proc.fechaInicio.slice(0, 10)
        : null;

    if (!fechaProc) {
        return {
            proc: applyFinAuto(proc),
            meta: { sinFechaInicio: true, mensaje: 'Indique fecha de inicio' },
        };
    }

    if (turnos.length === 0) {
        return {
            proc: applyFinAuto(proc),
            meta: { sinTurnos: true, mensaje: 'Sin turnos asignados', horasBase: base, horasAux: aux, horasTotal: horas, modo },
        };
    }

    const byDay = {};
    for (const t of turnos) {
        const day = t.fechaDia;
        if (!day) continue;
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(t);
    }

    const toWindow = (t) => turnoCoberturaToWindow(t);

    const windowsForDay = (day) => {
        const map = new Map();
        for (const t of byDay[day] || []) {
            const w = toWindow(t);
            if (!w) continue;
            const key = `${w.inicioMin}-${w.finMin}`;
            if (map.has(key)) {
                const prev = map.get(key);
                prev.personas = mergePersonasTurnos(prev.personas, w.personas);
            } else {
                map.set(key, { ...w, personas: [...(w.personas || [])] });
            }
        }
        return [...map.values()].sort((a, b) => a.inicioMin - b.inicioMin);
    };

    // Plantilla de ventanas (unión de todos los días) por si un día viene vacío
    const plantilla = [];
    {
        const seen = new Set();
        for (const t of turnos) {
            const w = toWindow(t);
            if (!w) continue;
            const key = `${w.inicioMin}-${w.finMin}`;
            if (seen.has(key)) continue;
            seen.add(key);
            plantilla.push({ ...w, personas: [] });
        }
        plantilla.sort((a, b) => a.inicioMin - b.inicioMin);
    }

    if (plantilla.length === 0) {
        return { proc: applyFinAuto(proc), meta: null };
    }

    // Siempre partir del día que el usuario eligió (no saltar a otro día con cobertura)
    let day = fechaProc;
    const dayStart = day;
    let windowsToday = windowsForDay(day);
    if (windowsToday.length === 0) {
        windowsToday = plantilla.map((w) => ({ ...w, personas: [] }));
    }

    // Arrancar al inicio del turno (7:00) salvo encadenamiento exacto o hora explícita del usuario.
    const horaUser = Number(proc.horaInicio);
    const userMin = Number.isFinite(horaUser) ? horaUser * 60 : null;
    let startWindow = windowsToday[0];
    let cursorMin = startWindow.inicioMin;

    if (startMinOverride != null && Number.isFinite(startMinOverride)) {
        const containing = windowsToday.find((w) => startMinOverride >= w.inicioMin && startMinOverride < w.finMin);
        if (containing) startWindow = containing;
        else {
            const later = windowsToday.find((w) => w.inicioMin >= startMinOverride);
            if (later) startWindow = later;
        }
        cursorMin = Math.max(startWindow.inicioMin, startMinOverride);
    } else if (snapToShiftStart) {
        cursorMin = startWindow.inicioMin;
    } else if (userMin != null) {
        const containing = windowsToday.find((w) => userMin >= w.inicioMin && userMin < w.finMin);
        if (containing) {
            startWindow = containing;
            cursorMin = userMin;
        } else {
            const later = windowsToday.find((w) => w.inicioMin >= userMin);
            if (later) {
                startWindow = later;
                cursorMin = later.inicioMin;
            }
        }
    }

    const ancla = startWindow;

    let remainingMin = Math.round(horas * 60);
    const segments = [];
    let guard = 0;
    let multiTurnoUsado = false;

    while (remainingMin > 0 && guard++ < 40) {
        let wins = windowsForDay(day);
        if (wins.length === 0) {
            wins = plantilla.map((w) => ({ ...w, personas: [] }));
        }

        if (modo === 'siguiente_dia') {
            const same = wins.find((w) => w.inicioMin === ancla.inicioMin && w.finMin === ancla.finMin)
                || wins.find((w) => w.codigo && w.codigo === ancla.codigo)
                || wins[0];
            wins = same ? [same] : [];
        } else if (modo === 'siguiente_turno_dia_siguiente' && day === dayStart) {
            // Solo el turno de arranque hoy; el resto va al primer turno del día siguiente
            const same = wins.find((w) => w.inicioMin === ancla.inicioMin && w.finMin === ancla.finMin)
                || wins.find((w) => w.codigo && w.codigo === ancla.codigo)
                || wins[0];
            wins = same ? [same] : [];
        }

        for (const w of wins) {
            if (remainingMin <= 0) break;
            const startWork = Math.max(cursorMin, w.inicioMin);
            if (startWork >= w.finMin) continue;
            const available = w.finMin - startWork;
            const use = Math.min(available, remainingMin);
            segments.push({
                fecha: day,
                startMin: startWork,
                endMin: startWork + use,
                codigo: w.codigo,
                nombre: w.nombre,
                ventanaInicioMin: w.inicioMin,
                ventanaFinMin: w.finMin,
                horarioId: w.horarioId,
                personas: mergePersonasTurnos(
                    w.personas,
                    personasEnRango(turnos, day, startWork, startWork + use),
                ),
                fueraDeTurno: false,
            });
            remainingMin -= use;
            cursorMin = startWork + use;
            if (segments.length > 1 && segments[segments.length - 1].fecha === segments[0].fecha) {
                multiTurnoUsado = true;
            }
            // En día de arranque: un solo turno; luego se puede repartir normal en días siguientes
            if (modo === 'siguiente_dia' || (modo === 'siguiente_turno_dia_siguiente' && day === dayStart)) break;
        }

        if (remainingMin <= 0) break;

        day = addDaysToDateKey(day, 1);
        const nextWins = windowsForDay(day);
        if (modo === 'siguiente_dia') {
            cursorMin = ancla.inicioMin;
        } else if (nextWins.length > 0) {
            // siguiente_turno y siguiente_turno_dia_siguiente: arrancan en el primer turno del día
            cursorMin = nextWins[0].inicioMin;
        } else {
            cursorMin = plantilla[0].inicioMin;
        }
    }

    if (segments.length === 0) {
        return { proc: applyFinAuto(proc), meta: null };
    }

    const seg0 = segments[0];
    const segN = segments[segments.length - 1];
    let horaFin = Math.floor(segN.endMin / 60);
    let minFin = segN.endMin % 60;
    let fechaFin = segN.fecha;
    if (minFin > 0) {
        horaFin += 1;
        minFin = 0;
    }
    if (horaFin >= 24) {
        horaFin -= 24;
        fechaFin = addDaysToDateKey(fechaFin, 1);
    }
    const startHour = Math.floor(seg0.startMin / 60);
    const startMinRem = seg0.startMin % 60;
    if (fechaFin === seg0.fecha && horaFin <= startHour && minFin === 0) {
        horaFin = startHour + 1;
    }

    const continuesNextDay = segments.some((s) => s.fecha !== seg0.fecha);
    const daysUsed = [...new Set(segments.map((s) => s.fecha))];
    const turnosMismoDiaDisponibles = windowsForDay(fechaProc || seg0.fecha).length > 1
        || plantilla.length > 1;

    let mensaje = null;
    if (modo === 'siguiente_dia' && continuesNextDay) {
        const restoMin = segments.filter((s) => s.fecha !== seg0.fecha)
            .reduce((acc, s) => acc + (s.endMin - s.startMin), 0);
        const restoH = Math.round((restoMin / 60) * 100) / 100;
        mensaje = `Modo día siguiente: el resto (${restoH} h) va al mismo turno del día siguiente.`;
    } else if (modo === 'siguiente_turno_dia_siguiente' && continuesNextDay) {
        const restoMin = segments.filter((s) => s.fecha !== seg0.fecha)
            .reduce((acc, s) => acc + (s.endMin - s.startMin), 0);
        const restoH = Math.round((restoMin / 60) * 100) / 100;
        mensaje = `Modo siguiente turno del día siguiente: el resto (${restoH} h) continúa en el primer turno del día siguiente (sin usar el resto de turnos de hoy).`;
    } else if (continuesNextDay) {
        const restoMin = segments.filter((s) => s.fecha !== seg0.fecha)
            .reduce((acc, s) => acc + (s.endMin - s.startMin), 0);
        const restoH = Math.round((restoMin / 60) * 100) / 100;
        if (plantilla.length <= 1 || windowsForDay(fechaProc || seg0.fecha).length <= 1) {
            mensaje = `Solo hay un turno ese día: el resto (${restoH} h) pasa al día siguiente.`;
        } else {
            mensaje = `Tras agotar los turnos del día, continúa al día siguiente (${restoH} h).`;
        }
    } else if (multiTurnoUsado || (segments.length > 1 && !continuesNextDay)) {
        mensaje = `Se reparte en ${segments.length} turnos del mismo día.`;
    }
    if (aux > 0) {
        const auxMsg = `Incluye ${aux} h de tiempos auxiliares (base ${base} h).`;
        mensaje = mensaje ? `${mensaje} ${auxMsg}` : auxMsg;
    }

    const updated = {
        ...proc,
        fechaInicio: fechaProc || seg0.fecha,
        horaInicio: startHour,
        horaInicioMin: seg0.startMin,
        fechaFin,
        horaFin,
        horaFinMin: segN.endMin,
        repartoContinuacion: modo,
        rosterMeta: {
            multiTurno: multiTurnoUsado || turnosMismoDiaDisponibles,
            turnosMismoDiaDisponibles,
            continuesNextDay,
            daysUsed,
            segments,
            mensaje,
            modo,
            horasBase: base,
            horasAux: aux,
            horasTotal: horas,
        },
    };

    return { proc: updated, meta: updated.rosterMeta };
};

/** Visual: por cada tramo (día/turno) muestra las horas del turno y cuáles están ocupadas. */
function RepartoTurnosVisual({ segments, isDarkMode, helperColor, textColor }) {
    if (!Array.isArray(segments) || segments.length === 0) return null;

    const fmt = (min) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const days = [...new Set(segments.map((s) => s.fecha))];
    const multiDay = days.length > 1;

    return (
        <View style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isDarkMode ? '#475569' : '#CBD5E1',
            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
        }}
        >
            <Text style={{ color: helperColor, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                Reparto del trabajo por turno / día
            </Text>
            {segments.map((seg, idx) => {
                const winIni = seg.ventanaInicioMin ?? seg.startMin;
                const winFin = seg.ventanaFinMin ?? seg.endMin;
                const hourStart = Math.floor(winIni / 60);
                const hourEnd = Math.ceil(winFin / 60);
                const hours = [];
                for (let h = hourStart; h < hourEnd; h++) hours.push(h);
                const ocupMin = Math.max(0, seg.endMin - seg.startMin);
                const ocupH = Math.round((ocupMin / 60) * 100) / 100;
                const dayIdx = days.indexOf(seg.fecha) + 1;
                const title = seg.fueraDeTurno
                    ? (multiDay
                        ? `Día ${dayIdx} · ${seg.fecha} · Fuera de turno (HE)`
                        : `Fuera de turno (HE) · ${seg.fecha}`)
                    : (multiDay
                        ? `Día ${dayIdx} · ${seg.fecha} · T${seg.codigo || idx + 1}`
                        : `Turno ${idx + 1} · T${seg.codigo || idx + 1} · ${seg.fecha}`);
                const winLabel = `${fmt(winIni)}–${fmt(winFin)}`;
                const occLabel = `${fmt(seg.startMin)}–${fmt(seg.endMin)}`;
                const occColor = seg.fueraDeTurno ? '#F59E0B' : '#4F46E5';
                const occBorder = seg.fueraDeTurno ? '#FBBF24' : '#6366F1';
                const occLabelColor = seg.fueraDeTurno ? '#FEF3C7' : '#C7D2FE';

                return (
                    <View
                        key={`${seg.fecha}-${seg.startMin}-${idx}`}
                        style={{
                            marginBottom: idx < segments.length - 1 ? 12 : 0,
                            paddingBottom: idx < segments.length - 1 ? 10 : 0,
                            borderBottomWidth: idx < segments.length - 1 ? StyleSheet.hairlineWidth : 0,
                            borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                    >
                        <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>
                            {title}{seg.nombre ? ` · ${seg.nombre}` : ''}
                        </Text>
                        <Text style={{ color: helperColor, fontSize: 11, marginTop: 2 }}>
                            {seg.fueraDeTurno ? 'Tramo fuera de turno' : 'Ventana del turno'}: {winLabel} · Ocupado: {occLabel} ({ocupH} h)
                        </Text>
                        {!seg.fueraDeTurno ? (
                        <Text style={{ color: helperColor, fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
                            Cada bloque es una hora completa (ej. 13–14 = 1pm a 2pm). A las {fmt(winFin)} cierra este turno y puede empezar el siguiente.
                        </Text>
                        ) : (
                        <Text style={{ color: '#FBBF24', fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
                            {(seg.personas || []).length > 0
                                ? `Hora extra imputada al operario del último turno${seg.heDeTurnoCodigo ? ` (T${seg.heDeTurnoCodigo})` : ''}.`
                                : 'Este tramo cuenta como hora extra (fuera de los turnos configurados).'}
                        </Text>
                        )}
                        {(() => {
                            const personas = seg.personas || [];
                            const ops = personas.filter((x) => !x.esAuxiliar);
                            const auxs = personas.filter((x) => x.esAuxiliar);
                            if (ops.length === 0 && auxs.length === 0) {
                                return (
                                    <Text style={{ color: helperColor, fontSize: 11, marginTop: 3, fontStyle: 'italic' }}>
                                        Sin operario asignado en este turno
                                    </Text>
                                );
                            }
                            return (
                                <View style={{ marginTop: 3 }}>
                                    {ops.map((p) => (
                                        <Text
                                            key={`rep-op-${idx}-${p.usuarioId || p.nombre}`}
                                            style={{ color: p.novedad ? '#FBBF24' : '#86EFAC', fontSize: 11 }}
                                        >
                                            Op: {p.nombre}{seg.fueraDeTurno ? ' (HE)' : ''}
                                            {p.novedad ? ` ⚠ ${p.novedad.label || p.novedad.tipo}` : ''}
                                        </Text>
                                    ))}
                                    {auxs.map((p) => (
                                        <Text
                                            key={`rep-ax-${idx}-${p.usuarioId || p.nombre}`}
                                            style={{ color: p.novedad ? '#FBBF24' : '#5EEAD4', fontSize: 11 }}
                                        >
                                            Ax: {p.nombre}{seg.fueraDeTurno ? ' (HE)' : ''}
                                            {p.novedad ? ` ⚠ ${p.novedad.label || p.novedad.tipo}` : ''}
                                        </Text>
                                    ))}
                                </View>
                            );
                        })()}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {hours.map((h) => {
                                const slotIni = h * 60;
                                const slotFin = (h + 1) * 60;
                                const occupied = seg.startMin < slotFin && seg.endMin > slotIni;
                                const inWindow = slotIni >= winIni && slotIni < winFin;
                                if (!inWindow && !occupied) return null;
                                const labelFrom = String(h).padStart(2, '0');
                                const labelTo = String(h + 1).padStart(2, '0');
                                return (
                                    <View
                                        key={`occ-${idx}-${h}`}
                                        style={{
                                            paddingHorizontal: 6,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            backgroundColor: occupied
                                                ? occColor
                                                : (isDarkMode ? '#1E293B' : '#E2E8F0'),
                                            borderWidth: 1,
                                            borderColor: occupied
                                                ? occBorder
                                                : (isDarkMode ? '#334155' : '#CBD5E1'),
                                            minWidth: 52,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{
                                            color: occupied ? '#FFF' : helperColor,
                                            fontSize: 10,
                                            fontWeight: occupied ? '700' : '500',
                                        }}
                                        >
                                            {labelFrom}–{labelTo}
                                        </Text>
                                        <Text style={{
                                            color: occupied ? occLabelColor : helperColor,
                                            fontSize: 8,
                                            marginTop: 1,
                                        }}
                                        >
                                            {occupied ? (seg.fueraDeTurno ? 'HE' : 'ocupada') : 'libre'}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

/**
 * Fecha-hora en formato local SIN zona horaria ("YYYY-MM-DDTHH:mm:ss").
 * Nunca usar toISOString() para enviar al backend: agrega la "Z" (UTC) y el
 * servidor guarda ese valor tal cual, corriendo las barras +5 horas por guardado.
 */
const toLocalIso = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const parseHour = (dateStr) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 8 : d.getHours();
};

/** Fecha/hora local a partir de ISO del servidor (evita desfases en calendario). */
const parseLocalDateParts = (value) => {
    if (!value) return { fecha: '', hora: 8 };
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return { fecha: '', hora: 8 };
    return { fecha: formatDateKey(d), hora: d.getHours() };
};

const parseCalculoJson = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const buildCalculoFromDatosOp = (datos, overrides = {}) => {
    const piezasOp = parsePiezasDesdeDatosOp(datos);
    const shared = {
        fechaEntrega: datos?.fechaEntrega || '',
        colores: datos?.colores || '',
        cantidadTinta: datos?.cantidadTinta != null ? String(datos.cantidadTinta) : '',
        tirosRegistrados: datos?.tirosRegistrados || 0,
        usarTirosPrograma: (Number(datos?.tirosRegistrados) || 0) > 0,
    };

    if (piezasOp.length > 1) {
        const piezasMap = {};
        piezasOp.forEach((pieza) => {
            piezasMap[pieza.id] = buildCalculoPiezaBase(pieza, { ...datos, ...shared }, overrides);
        });
        const uniones = detectUnionesSugeridas(piezasOp);
        const firstId = piezasOp[0].id;
        return applyPiezaActivaToCalculoRoot({
            ...emptyCalculoForm(),
            ...shared,
            multiPieza: true,
            piezaActivaId: firstId,
            piezas: piezasMap,
            uniones,
            ...overrides,
        }, firstId);
    }

    return {
        ...emptyCalculoForm(),
        ...shared,
        tipoTrabajo: TIPOS_TRABAJO.includes(datos?.tipoTrabajoHint) ? datos.tipoTrabajoHint : 'Nuevo',
        sustrato: datos?.sustrato || '',
        calibre: datos?.calibre || '',
        gramaje: datos?.gramaje || '',
        anchoRollo: datos?.anchoRollo || '',
        largoCorte: datos?.largoCorte || '',
        hojas: datos?.hojas || '',
        tamanoFinal: datos?.tamanoFinal || '',
        cantidadSolicitada: datos?.cantidadSolicitada
            ? String(datos.cantidadSolicitada)
            : String(overrides.metaTiros || overrides.cantidadSolicitada || datos?.metaTiros || ''),
        cabidad: datos?.cabidad || '',
        largo: datos?.largo || '',
        ancho: datos?.ancho || '',
        tirosBruto: '',
        sobrante: '0',
        restaManualTiros: '0',
        ...overrides,
    };
};

const buildProgramacionHeaderFromForm = (form, extras = {}) => ({
    numeroOP: extras.numeroOP ?? form.numeroOP,
    ordenProduccionId: extras.ordenProduccionId ?? null,
    numeroOT: form.numeroOT?.trim() || (form.esUrgencia ? 'SIN-OT' : ''),
    ordenCompra: form.ordenCompra?.trim() || '',
    lineaTroquel: form.lineaTroquel?.trim() || '',
    referencia: form.referencia?.trim() || '',
    cliente: form.cliente?.trim() || (form.esUrgencia ? 'Urgencia' : ''),
    metaTiros: extras.metaTiros ?? (Number.isNaN(parseInt(form.metaTiros, 10)) ? 0 : parseInt(form.metaTiros, 10)),
    precio: extras.precio ?? computePrecioTotalOp(form.metaTiros, form.precioUnitario),
    estadoGeneral: form.estadoGeneral || 'programado',
    esUrgencia: !!form.esUrgencia,
    observaciones: form.observaciones?.trim() || '',
    fechaEntrega: form.calculo?.fechaEntrega?.trim() || '',
    calculo: persistCalculoFormState(form.calculo || emptyCalculoForm()),
    color: extras.color ?? null,
    tipoActividad: extras.tipoActividad,
});

const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatClockTime = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const formatElapsedHms = (totalSeconds) => {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const ACTIVIDAD_TELEMETRIA = {
    '01': { label: 'Puesta a punto', short: 'PAP', color: '#F59E0B' },
    '02': { label: 'Producción', short: 'PROD', color: '#22C55E' },
};

const normalizeOpDigits = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.replace(/^0+/, '') || digits;
};

const normalizeTelemetriaRow = (row) => ({
    maquinaId: row?.maquinaId ?? row?.MaquinaId ?? null,
    actividadCodigo: String(row?.actividadCodigo ?? row?.ActividadCodigo ?? '').padStart(2, '0'),
    actividadNombre: row?.actividadNombre ?? row?.ActividadNombre ?? '',
    ordenProduccionNumero: row?.ordenProduccionNumero ?? row?.OrdenProduccionNumero ?? '',
    horaInicio: row?.horaInicio ?? row?.HoraInicio ?? null,
    horaFin: row?.horaFin ?? row?.HoraFin ?? null,
    esActivo: !!(row?.esActivo ?? row?.EsActivo),
    estado: row?.estado ?? row?.Estado ?? '',
    tiros: Number(row?.tiros ?? row?.Tiros ?? 0) || 0,
    tirosAcumuladosOpMaquinaHoy: Number(row?.tirosAcumuladosOpMaquinaHoy ?? row?.TirosAcumuladosOpMaquinaHoy ?? 0) || 0,
    tiempoPausadoSegundos: Number(row?.tiempoPausadoSegundos ?? row?.TiempoPausadoSegundos ?? 0) || 0,
    pausadoEn: row?.pausadoEn ?? row?.PausadoEn ?? null,
    duracionSegundos: Number(row?.duracionSegundos ?? row?.DuracionSegundos ?? 0) || 0,
});

const isTelemetriaRecordLive = (row) => {
    if (!row) return false;
    return row.esActivo || row.estado === 'EnProgreso' || row.estado === 'Pausado';
};

const computeLiveElapsedSeconds = (row, nowMs = Date.now()) => {
    if (!row?.horaInicio) return row?.duracionSegundos || 0;
    const startMs = new Date(row.horaInicio).getTime();
    if (Number.isNaN(startMs)) return row?.duracionSegundos || 0;
    const pausa = row.tiempoPausadoSegundos || 0;
    if (row.estado === 'Pausado' && row.pausadoEn) {
        const pausedMs = new Date(row.pausadoEn).getTime();
        if (!Number.isNaN(pausedMs)) {
            return Math.max(0, Math.floor((pausedMs - startMs) / 1000) - pausa);
        }
    }
    if (row.duracionSegundos > 0 && (row.estado === 'EnProgreso' || row.estado === 'Pausado')) {
        const serverElapsed = row.duracionSegundos;
        const localElapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000) - pausa);
        return Math.max(serverElapsed, localElapsed);
    }
    if (isTelemetriaRecordLive(row)) {
        return Math.max(0, Math.floor((nowMs - startMs) / 1000) - pausa);
    }
    if (row.horaFin) {
        const finMs = new Date(row.horaFin).getTime();
        if (!Number.isNaN(finMs)) return Math.max(0, Math.floor((finMs - startMs) / 1000) - pausa);
    }
    return row?.duracionSegundos || 0;
};

const buildTelemetriaIndex = (rows = []) => {
    const index = new Map();
    (Array.isArray(rows) ? rows : []).map(normalizeTelemetriaRow).forEach((row) => {
        if (!isTelemetriaRecordLive(row)) return;
        const cod = row.actividadCodigo;
        if (cod !== '01' && cod !== '02') return;
        const opKey = normalizeOpDigits(row.ordenProduccionNumero);
        if (!row.maquinaId || !opKey) return;
        const key = `${row.maquinaId}|${opKey}`;
        const prev = index.get(key);
        if (!prev) {
            index.set(key, row);
            return;
        }
        const rank = (x) => (x.actividadCodigo === '02' ? 2 : 1);
        if (rank(row) > rank(prev)) {
            index.set(key, row);
            return;
        }
        if (rank(row) === rank(prev)) {
            const tStart = new Date(row.horaInicio).getTime();
            const pStart = new Date(prev.horaInicio).getTime();
            if (tStart >= pStart) index.set(key, row);
        }
    });
    return index;
};

const findLiveTelemetry = (prog, proceso, telemetriaIndex) => {
    const maquinaId = proceso?.maquinaId;
    const opKey = normalizeOpDigits(prog?.numeroOP);
    if (!maquinaId || !opKey || !telemetriaIndex) return null;
    return telemetriaIndex.get(`${maquinaId}|${opKey}`) || null;
};

const buildTirosTelemetriaIndex = (rows = []) => {
    const index = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const maquinaId = row?.maquinaId ?? row?.MaquinaId;
        const opNum = row?.ordenProduccionNumero ?? row?.OrdenProduccionNumero ?? '';
        const opKey = normalizeOpDigits(opNum);
        const total = Number(row?.total ?? row?.Total ?? 0) || 0;
        if (!maquinaId || !opKey) return;
        index.set(`${maquinaId}|${opKey}`, total);
    });
    return index;
};

const findTirosForBar = (prog, proceso, tirosIndex, liveTelemetry) => {
    if (liveTelemetry) {
        return Number(liveTelemetry.tirosAcumuladosOpMaquinaHoy ?? liveTelemetry.tiros ?? 0) || 0;
    }
    const maquinaId = proceso?.maquinaId;
    const opKey = normalizeOpDigits(prog?.numeroOP);
    if (!maquinaId || !opKey || !tirosIndex) return 0;
    return tirosIndex.get(`${maquinaId}|${opKey}`) || 0;
};

const BAR_SEGMENT_COLORS = {
    pap: '#F59E0B',
    lava: '#3B82F6',
};

/** Segmentos de color dentro de la barra: PAP (amarillo), lavada (azul), producción (color OP). */
const buildPlannedBarSegments = (prog, proceso) => {
    const prodColor = prog?.color || '#3B82F6';
    const calculo = parseCalculoJson(prog?.calculoJson);
    const alist = parseNumFlexible(calculo?.alistamiento) || 0;
    const lav = parseNumFlexible(calculo?.lavada) || 0;
    const totalH = parseNumFlexible(proceso?.horasEstimadas) || 0;
    const baseTotal = totalH > 0 ? totalH / FACTOR_TOTAL_HORAS : 0;
    const prodRaw = Math.max(0, baseTotal - alist - lav);
    const denom = alist + lav + prodRaw;

    if (denom <= 0) {
        return [{ leftFrac: 0, widthFrac: 1, color: prodColor, kind: 'prod' }];
    }

    const segs = [];
    let cursor = 0;
    const pushSeg = (hours, color, kind) => {
        if (hours <= 0) return;
        const w = hours / denom;
        segs.push({ leftFrac: cursor, widthFrac: w, color, kind });
        cursor += w;
    };
    pushSeg(alist, BAR_SEGMENT_COLORS.pap, 'pap');
    pushSeg(lav, BAR_SEGMENT_COLORS.lava, 'lava');
    pushSeg(prodRaw, prodColor, 'prod');
    if (cursor < 0.999 && segs.length === 0) {
        segs.push({ leftFrac: 0, widthFrac: 1, color: prodColor, kind: 'prod' });
    }
    return segs;
};

const parseTelemetriaPayload = (data) => {
    if (Array.isArray(data)) {
        return { activos: data, tirosPorOpMaquina: [] };
    }
    return {
        activos: Array.isArray(data?.activos) ? data.activos : [],
        tirosPorOpMaquina: Array.isArray(data?.tirosPorOpMaquina) ? data.tirosPorOpMaquina : [],
    };
};

const resolveMaquinaNombre = (proceso, maquinas = []) => {
    if (proceso?.maquinaNombre) return proceso.maquinaNombre;
    if (proceso?.maquinaId) {
        const m = maquinas.find((x) => x.id === proceso.maquinaId);
        return m?.nombre || '';
    }
    return '';
};

/** Texto multilínea para tooltip nativo (web) al pasar el cursor sobre una barra del Gantt. */
const buildGanttBarTooltip = (prog, proceso, maquinas = [], liveTelemetry = null, liveNowMs = Date.now(), tirosActuales = 0) => {
    const maq = resolveMaquinaNombre(proceso, maquinas);
    const lines = [
        `OP: ${prog?.numeroOP || '—'}`,
        `OT: ${prog?.numeroOT || '—'}`,
        `Línea troquel: ${prog?.lineaTroquel || '—'}`,
        `Cliente: ${prog?.cliente || '—'}`,
        `Trabajo: ${prog?.referencia || '—'}`,
        `Precio: ${Number(prog?.precio) > 0 ? formatMoney(prog.precio) : '—'}`,
        `Máquina: ${maq || 'Sin máquina'}`,
        `Proceso: ${proceso?.proceso || '—'}`,
        `Inicio: ${formatDateTime(proceso?.fechaInicio)}`,
        `Fin: ${formatDateTime(proceso?.fechaFin)}`,
        `Tiros necesarios: ${prog?.metaTiros ? Number(prog.metaTiros).toLocaleString('es-CO') : '—'}`,
    ];
    const entrega = fechaEntregaFromProgramacion(prog);
    if (entrega) {
        const dias = diasHastaEntrega(entrega);
        lines.push(`Entrega: ${formatFechaEntregaDisplay(entrega)} (${formatEntregaCountdown(dias)})`);
    }
    if (Number(proceso?.horasEstimadas) > 0) {
        lines.push(`Horas trabajo: ${proceso.horasEstimadas} h`);
    }
    const calculo = parseCalculoJson(prog?.calculoJson);
    if (parseNumFlexible(calculo?.alistamiento) > 0) {
        lines.push(`Puesta a punto planificada: ${calculo.alistamiento} h`);
    }
    if (parseNumFlexible(calculo?.lavada) > 0) {
        lines.push(`Lavada planificada: ${calculo.lavada} h`);
    }
    const maqSnap = calculo?.porMaquina?.[proceso?.maquinaId];
    const lineasTiros = normalizeLineasTiros(maqSnap || calculo);
    const lineasConTiros = lineasTiros.filter((l) => parseNumFlexible(l.tirosBruto) > 0);
    if (lineasConTiros.length > 1 || (lineasConTiros.length === 1 && lineasConTiros[0].concepto !== 'Principal')) {
        lines.push('Tiros por línea:');
        lineasConTiros.forEach((l) => {
            lines.push(`  · ${l.concepto}: ${parseNumFlexible(l.tirosBruto).toLocaleString('es-CO')}`);
        });
    }
    if (liveTelemetry) {
        const cfg = ACTIVIDAD_TELEMETRIA[liveTelemetry.actividadCodigo] || { label: 'En vivo' };
        const elapsed = formatElapsedHms(computeLiveElapsedSeconds(liveTelemetry, liveNowMs));
        lines.push('');
        lines.push(`▶ ${cfg.label}${liveTelemetry.estado === 'Pausado' ? ' (pausado)' : ''}`);
        lines.push(`Inicio real: ${formatClockTime(liveTelemetry.horaInicio)}`);
        lines.push(`Tiempo transcurrido: ${elapsed}`);
    }
    if (tirosActuales > 0 || liveTelemetry?.actividadCodigo === '02') {
        const meta = Number(prog?.metaTiros) || 0;
        const tiros = tirosActuales || 0;
        lines.push(`Tiros: ${Number(tiros).toLocaleString('es-CO')}${meta > 0 ? ` / ${meta.toLocaleString('es-CO')} planeados` : ''}`);
    }
    return lines.join('\n');
};

/** Etiqueta visible dentro de la barra: siempre incluye el número de OP. */
const buildGanttBarLabel = (prog, proceso, segment, width, maquinas = [], liveTelemetry = null, liveNowMs = Date.now(), tirosActuales = 0) => {
    const opRaw = String(prog?.numeroOP || '?').trim();
    const op = prog?.esUrgencia ? `⚡${opRaw}` : opRaw;
    let label = op;
    if (segment.continuesFromPrev && segment.continuesToNext) label = op;
    else if (segment.continuesFromPrev) label = `‹ ${op}`;
    else if (segment.continuesToNext) label = `${op} ›`;

    if (width < 28 && opRaw.length > 4) {
        label = segment.continuesFromPrev ? `‹ ${opRaw.slice(-4)}` : (segment.continuesToNext ? `${opRaw.slice(-4)} ›` : opRaw.slice(-4));
    }

    const parts = [label];
    if (width >= 72 && prog?.cliente) parts.push(prog.cliente.slice(0, 18));
    if (width >= 110 && prog?.lineaTroquel) parts.push(`LT ${prog.lineaTroquel}`);
    if (width >= 150) {
        const maq = resolveMaquinaNombre(proceso, maquinas);
        if (maq) parts.push(maq.slice(0, 16));
    }
    if (width >= 190 && Number(prog?.metaTiros) > 0) {
        parts.push(`${Number(prog.metaTiros).toLocaleString('es-CO')} tiros`);
    }
    if (width >= 230 && Number(prog?.precio) > 0) {
        parts.push(formatMoney(prog.precio));
    }

    if (liveTelemetry) {
        const cfg = ACTIVIDAD_TELEMETRIA[liveTelemetry.actividadCodigo] || { short: 'LIVE', color: '#FACC15' };
        const elapsed = formatElapsedHms(computeLiveElapsedSeconds(liveTelemetry, liveNowMs));
        parts.push(`${cfg.short} ${elapsed}${liveTelemetry.estado === 'Pausado' ? ' ⏸' : ''}`);
    }
    if (tirosActuales > 0) {
        const meta = Number(prog?.metaTiros) || 0;
        if (meta > 0) {
            parts.push(`${Number(tirosActuales).toLocaleString('es-CO')}/${meta.toLocaleString('es-CO')}`);
        } else {
            parts.push(`${Number(tirosActuales).toLocaleString('es-CO')} tiros`);
        }
    }

    return parts.join(' · ');
};

const getErrorMessage = (error) => extractApiErrorMessage(error, 'Error desconocido');

/** Une procesos del formulario con los ya guardados (no borra procesos omitidos por error). */
const mergeProcesosActivosConExistente = (procesosActivos, progExistente, procesoOrder = DEFAULT_PROCESOS) => {
    if (!progExistente?.procesos?.length) return procesosActivos;
    const names = new Set(procesosActivos.map((p) => p.proceso));
    const extras = progExistente.procesos
        .filter((p) => p?.proceso && !names.has(p.proceso))
        .map((p) => ({
            proceso: p.proceso,
            fechaInicio: typeof p.fechaInicio === 'string' ? p.fechaInicio : new Date(p.fechaInicio).toISOString(),
            fechaFin: typeof p.fechaFin === 'string' ? p.fechaFin : new Date(p.fechaFin).toISOString(),
            horasEstimadas: p.horasEstimadas ?? null,
            maquinaId: p.maquinaId ?? null,
            tiemposAuxiliares: (p.tiemposAuxiliares || []).map((t) => ({
                descripcion: t.descripcion,
                horas: parseFloat(t.horas) || 0,
            })),
        }));
    if (!extras.length) return procesosActivos;
    const merged = [...procesosActivos, ...extras];
    merged.sort((a, b) => {
        const ia = procesoOrder.indexOf(a.proceso);
        const ib = procesoOrder.indexOf(b.proceso);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    return enforceProcessChain(merged);
};

const groupDatesByMonth = (dates) => {
    const groups = [];
    dates.forEach((date, idx) => {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
            last.count += 1;
            last.endIdx = idx;
        } else {
            groups.push({
                key,
                label: MESES[date.getMonth()],
                year: date.getFullYear(),
                count: 1,
                startIdx: idx,
                endIdx: idx,
            });
        }
    });
    return groups;
};

/** Agrupa por semana calendario real (lunes a domingo); la primera y última pueden ser parciales. */
const groupDatesByWeek = (dates) => {
    const groups = [];
    dates.forEach((date, idx) => {
        const weekKey = formatDateKey(getMonday(date));
        const last = groups[groups.length - 1];
        if (last && last.weekKey === weekKey) {
            last.count += 1;
            last.endIdx = idx;
        } else {
            groups.push({ weekKey, count: 1, startIdx: idx, endIdx: idx });
        }
    });
    return groups.map((g, i) => {
        const start = dates[g.startIdx];
        const end = dates[g.endIdx];
        const basePalette = WEEK_PALETTE[i % WEEK_PALETTE.length];
        return {
            ...g,
            weekIdx: i,
            key: `week-${g.weekKey}`,
            palette: { ...basePalette, label: `Semana ${i + 1}` },
            label: `${start.getDate()}–${end.getDate()} ${MESES[start.getMonth()].slice(0, 3)}`,
        };
    });
};

const overlapsDay = (fechaInicio, fechaFin, dayDate) => {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    return start <= dayEnd && end >= dayStart;
};

const overlapsHour = (fechaInicio, fechaFin, dayDate, hour) => {
    const slotStart = new Date(dayDate);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(dayDate);
    slotEnd.setHours(hour, 59, 59, 999);
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    return start <= slotEnd && end >= slotStart;
};

const toHourFrac = (d) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

/** Segmento visible de un proceso dentro de un día (0–24 h), con flags de continuación. */
const getProcessDaySegment = (fechaInicio, fechaFin, dayDate) => {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (start > dayEnd || end < dayStart) return null;

    const continuesFromPrev = start < dayStart;
    const continuesToNext = end > dayEnd;
    const startFrac = continuesFromPrev ? 0 : Math.max(0, Math.min(1, toHourFrac(start) / HOURS_PER_DAY));
    const endFrac = continuesToNext ? 1 : Math.max(0, Math.min(1, toHourFrac(end) / HOURS_PER_DAY));
    if (endFrac <= startFrac) return null;

    return {
        leftFrac: startFrac,
        widthFrac: endFrac - startFrac,
        continuesFromPrev,
        continuesToNext,
    };
};

const getActiveOrderedProcesos = (prog, procesoList = DEFAULT_PROCESOS) => {
    const names = Array.isArray(procesoList) ? procesoList : DEFAULT_PROCESOS;
    const ordered = names
        .map((name) => (prog.procesos || []).find((p) => p.proceso === name))
        .filter(Boolean);
    const known = new Set(ordered.map((p) => p.proceso));
    const extras = (prog.procesos || []).filter((p) => p?.proceso && !known.has(p.proceso));
    return [...ordered, ...extras];
};

const snapMs = (ms, interval = DRAG_SNAP_MS) => Math.round(ms / interval) * interval;

/** Ajusta en cadena: un proceso no puede iniciar antes de que termine el anterior. */
const cascadeProcessChain = (orderedProcs, changedProcessName, newStartMs, newEndMs) => {
    const idx = orderedProcs.findIndex((p) => p.proceso === changedProcessName);
    if (idx < 0) return orderedProcs;

    const updated = orderedProcs.map((p) => ({
        ...p,
        fechaInicio: new Date(p.fechaInicio).getTime(),
        fechaFin: new Date(p.fechaFin).getTime(),
    }));

    let startMs = newStartMs;
    let endMs = Math.max(newEndMs, startMs + MIN_PROCESS_MS);

    updated[idx].fechaInicio = startMs;
    updated[idx].fechaFin = endMs;

    if (idx > 0) {
        const prevEnd = updated[idx - 1].fechaFin;
        if (startMs < prevEnd) {
            const dur = endMs - startMs;
            startMs = prevEnd;
            endMs = prevEnd + dur;
            updated[idx].fechaInicio = startMs;
            updated[idx].fechaFin = endMs;
        }
    }

    for (let i = idx + 1; i < updated.length; i++) {
        const prevEnd = updated[i - 1].fechaFin;
        const dur = Math.max(MIN_PROCESS_MS, updated[i].fechaFin - updated[i].fechaInicio);
        let curStart = updated[i].fechaInicio;
        if (curStart < prevEnd) {
            curStart = prevEnd;
            updated[i].fechaInicio = curStart;
            updated[i].fechaFin = curStart + dur;
        }
    }

    return updated.map((p) => ({
        ...p,
        fechaInicio: toLocalIso(p.fechaInicio),
        fechaFin: toLocalIso(p.fechaFin),
    }));
};

/** Alinea toda la cadena: cada proceso empieza cuando termina el anterior. */
const enforceProcessChain = (orderedProcs) => {
    if (!orderedProcs.length) return [];
    const updated = orderedProcs.map((p) => ({
        ...p,
        fechaInicio: new Date(p.fechaInicio).getTime(),
        fechaFin: new Date(p.fechaFin).getTime(),
    }));
    for (let i = 1; i < updated.length; i++) {
        const prevEnd = updated[i - 1].fechaFin;
        const dur = Math.max(MIN_PROCESS_MS, updated[i].fechaFin - updated[i].fechaInicio);
        if (updated[i].fechaInicio < prevEnd) {
            updated[i].fechaInicio = prevEnd;
            updated[i].fechaFin = prevEnd + dur;
        }
    }
    return updated.map((p) => ({
        ...p,
        fechaInicio: toLocalIso(p.fechaInicio),
        fechaFin: toLocalIso(p.fechaFin),
    }));
};

const getDefaultStartAfterChain = (prog, procesoName, procesoList = DEFAULT_PROCESOS) => {
    const idx = procesoList.indexOf(procesoName);
    let start = new Date();
    start.setHours(8, 0, 0, 0);
    for (let i = idx - 1; i >= 0; i--) {
        const prev = prog.procesos.find((p) => p.proceso === procesoList[i]);
        if (prev) {
            start = new Date(prev.fechaFin);
            break;
        }
    }
    const end = new Date(start);
    end.setTime(start.getTime() + 8 * 3600000);
    return { start, end };
};

const getAvailableProcesosToAdd = (prog, procesoList = DEFAULT_PROCESOS) =>
    procesoList.filter((name) => !prog.procesos.some((p) => p.proceso === name));

const sortByProcesoOrder = (a, b, procesoList = DEFAULT_PROCESOS) =>
    procesoList.indexOf(a.proceso) - procesoList.indexOf(b.proceso);

/**
 * Procesos activos con datos mínimos para consultar cobertura/turnos del roster.
 * No exige fecha fin ni que todos los procesos activos estén completos.
 */
const buildProcesosForCobertura = (form, procesoOrder = DEFAULT_PROCESOS) => {
    const items = [];
    let chainDate = null;

    for (const proceso of procesoOrder) {
        const v = form.procesosSeleccionados?.[proceso];
        if (!v?.activo) continue;

        let fechaIniKey = v.fechaInicio?.trim() ? String(v.fechaInicio).slice(0, 10) : null;
        if (!fechaIniKey && chainDate) fechaIniKey = chainDate;
        if (!fechaIniKey) continue;

        const { total } = getHorasEfectivasProceso(v);
        const horas = total > 0 ? total : (parseNumFlexible(v.horasEstimadas) || 8);
        let fechaFinKey = v.fechaFin?.trim() ? String(v.fechaFin).slice(0, 10) : fechaIniKey;
        const padDays = Math.min(21, Math.max(3, Math.ceil(horas / 4) + 4));
        const finBase = new Date(`${fechaFinKey}T12:00:00`);
        finBase.setDate(finBase.getDate() + padDays);
        fechaFinKey = formatDateKey(finBase);

        items.push({
            proceso,
            maquinaId: v.maquinaId ?? null,
            fechaInicio: fechaIniKey,
            fechaFin: fechaFinKey,
            horasEstimadas: v.horasEstimadas,
            tiemposAuxiliares: v.tiemposAuxiliares,
        });

        if (v.fechaFin?.trim()) {
            chainDate = String(v.fechaFin).slice(0, 10);
        } else {
            const d = new Date(`${fechaIniKey}T12:00:00`);
            d.setDate(d.getDate() + Math.max(1, Math.ceil(horas / 8)));
            chainDate = formatDateKey(d);
        }
    }
    return items;
};

/** Programa en cadena: cada proceso arranca al terminar el anterior, respetando turnos. */
const applyCascadeScheduleAlign = (formBase, cobertura, procesoOrder = DEFAULT_PROCESOS) => {
    const procesos = { ...(formBase?.procesosSeleccionados || {}) };
    let changed = false;
    const orderedNames = (procesoOrder || DEFAULT_PROCESOS).filter((name) => procesos[name]?.activo);

    let anchorSet = false;
    /** @type {{ fecha: string, endMin: number } | null} */
    let prevEnd = null;

    for (const nombre of orderedNames) {
        const orig = procesos[nombre];
        if (!orig) continue;
        const { total } = getHorasEfectivasProceso(orig);
        if (!(total > 0) && !parseNumFlexible(orig.horasEstimadas)) continue;

        let proc = { ...orig };
        const cob = cobertura?.[nombre];

        let scheduleOptions = {};
        let isFirstInChain = false;

        if (!anchorSet) {
            const fechaInicioLocked = typeof orig.fechaInicio === 'string'
                ? orig.fechaInicio.slice(0, 10)
                : orig.fechaInicio;
            if (!fechaInicioLocked?.trim()) continue;
            anchorSet = true;
            isFirstInChain = true;
            proc = { ...proc, fechaInicio: fechaInicioLocked };
            scheduleOptions = { snapToShiftStart: !orig.inicioManualLock };
        } else if (prevEnd && !orig.inicioManualLock) {
            proc = {
                ...proc,
                fechaInicio: prevEnd.fecha,
                horaInicio: Math.floor(prevEnd.endMin / 60),
            };
            scheduleOptions = { startMinOverride: prevEnd.endMin };
        } else if (prevEnd && orig.inicioManualLock) {
            const h = Number(orig.horaInicio);
            const startMin = Number.isFinite(h) ? h * 60 : prevEnd.endMin;
            scheduleOptions = { startMinOverride: startMin };
        } else {
            continue;
        }

        const { proc: scheduled, meta } = scheduleProcesoConTurnos(proc, cob?.turnos || [], scheduleOptions);
        let next = scheduled;
        if (meta?.sinTurnos || !scheduled?.fechaFin) {
            next = applyFinAuto(proc);
        }
        if (isFirstInChain) {
            const locked = typeof orig.fechaInicio === 'string'
                ? orig.fechaInicio.slice(0, 10)
                : orig.fechaInicio;
            next = { ...next, fechaInicio: locked || next.fechaInicio };
            if (!orig.inicioManualLock && next.horaInicioMin != null) {
                next = { ...next, horaInicio: Math.floor(next.horaInicioMin / 60) };
            }
        }

        const lastSeg = meta?.segments?.[meta.segments.length - 1];
        if (lastSeg) {
            prevEnd = { fecha: lastSeg.fecha, endMin: lastSeg.endMin };
        } else if (next.fechaFin) {
            const hf = Number(next.horaFin);
            prevEnd = {
                fecha: next.fechaFin,
                endMin: (Number.isFinite(hf) ? hf : 0) * 60,
            };
        } else {
            prevEnd = null;
        }

        const origIni = typeof orig.fechaInicio === 'string' ? orig.fechaInicio.slice(0, 10) : orig.fechaInicio;
        const nextIni = typeof next.fechaInicio === 'string' ? next.fechaInicio.slice(0, 10) : next.fechaInicio;
        if (
            nextIni !== origIni
            || Number(next.horaInicio) !== Number(orig.horaInicio)
            || next.fechaFin !== orig.fechaFin
            || Number(next.horaFin) !== Number(orig.horaFin)
            || next.repartoContinuacion !== orig.repartoContinuacion
            || JSON.stringify(next.rosterMeta || null) !== JSON.stringify(orig.rosterMeta || null)
        ) {
            procesos[nombre] = next;
            changed = true;
        }
    }

    if (!changed) return { form: formBase, changed: false };
    return { form: { ...formBase, procesosSeleccionados: procesos }, changed: true };
};

const buildProcesosActivosFromForm = (form, procesoOrder = DEFAULT_PROCESOS) => {
    const activos = Object.entries(form.procesosSeleccionados)
        .filter(([, v]) => v?.activo)
        .map(([proceso, v]) => {
            if (!v.fechaInicio?.trim()) {
                throw new Error(`El proceso "${proceso}" requiere fecha de inicio.`);
            }
            if (!v.fechaFin?.trim()) {
                throw new Error(`El proceso "${proceso}" requiere fecha de fin.`);
            }
            const inicio = buildDateTime(v.fechaInicio, v.horaInicio);
            const fin = buildDateTime(v.fechaFin, v.horaFin);
            if (Number.isNaN(new Date(inicio).getTime()) || Number.isNaN(new Date(fin).getTime())) {
                throw new Error(`El proceso "${proceso}" tiene fechas inválidas.`);
            }
            if (new Date(inicio) >= new Date(fin)) {
                throw new Error(`El proceso "${proceso}" tiene fecha/hora de fin anterior al inicio.`);
            }
            return {
                proceso,
                fechaInicio: inicio,
                fechaFin: fin,
                horasEstimadas: v.horasEstimadas ? parseFloat(v.horasEstimadas) : null,
                maquinaId: v.maquinaId ?? null,
                tiemposAuxiliares: (v.tiemposAuxiliares || [])
                    .filter((t) => t.descripcion?.trim())
                    .map((t) => ({
                        descripcion: t.descripcion.trim(),
                        horas: parseFloat(t.horas) || 0,
                    })),
            };
        });

    activos.sort((a, b) => {
        const ia = procesoOrder.indexOf(a.proceso);
        const ib = procesoOrder.indexOf(b.proceso);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    return enforceProcessChain(activos);
};

const getUrgencyDefaultStart = () => {
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    return start;
};

/** Normaliza un proceso activo de urgencia: rellena fechas/horas faltantes con valores por defecto. */
const normalizeUrgencyProcesoEntry = (proceso, v, chainEndMs) => {
    if (!v?.activo) return null;
    let proc = { ...v };
    const horas = getHorasEfectivasProceso(proc).total || parseNumFlexible(proc.horasEstimadas) || 8;
    proc.horasEstimadas = String(horas);

    if (!proc.fechaInicio?.trim()) {
        const start = chainEndMs ? new Date(chainEndMs) : getUrgencyDefaultStart();
        proc.fechaInicio = formatDateKey(start);
        proc.horaInicio = start.getHours();
    }

    proc = applyFinAuto(proc);
    if (!proc.fechaFin?.trim()) {
        const fin = computeFinFromInicioYHoras(proc.fechaInicio, proc.horaInicio, proc.horasEstimadas);
        if (fin) {
            proc.fechaFin = fin.fechaFin;
            proc.horaFin = fin.horaFin;
        }
    }

    const inicio = buildDateTime(proc.fechaInicio, proc.horaInicio);
    const fin = buildDateTime(proc.fechaFin, proc.horaFin);
    if (Number.isNaN(new Date(inicio).getTime()) || Number.isNaN(new Date(fin).getTime())) return null;
    if (new Date(inicio) >= new Date(fin)) return null;

    return {
        proceso,
        fechaInicio: inicio,
        fechaFin: fin,
        horasEstimadas: parseFloat(proc.horasEstimadas) || horas,
        maquinaId: proc.maquinaId ?? null,
        tiemposAuxiliares: (proc.tiemposAuxiliares || [])
            .filter((t) => t.descripcion?.trim())
            .map((t) => ({
                descripcion: t.descripcion.trim(),
                horas: parseFloat(t.horas) || 0,
            })),
    };
};

/** Procesos para urgencia: acepta datos parciales y garantiza al menos un bloque en el Gantt. */
const buildUrgencyProcesosFromForm = (form, procesoOrder = DEFAULT_PROCESOS) => {
    const items = [];
    let chainEndMs = null;

    for (const proceso of procesoOrder) {
        const v = form.procesosSeleccionados?.[proceso];
        const normalized = normalizeUrgencyProcesoEntry(proceso, v, chainEndMs);
        if (normalized) {
            items.push(normalized);
            chainEndMs = new Date(normalized.fechaFin).getTime();
        }
    }

    if (items.length === 0) {
        const firstProceso = procesoOrder[0] || 'Conversion';
        const start = getUrgencyDefaultStart();
        const end = new Date(start.getTime() + 8 * 3600000);
        items.push({
            proceso: firstProceso,
            fechaInicio: toLocalIso(start),
            fechaFin: toLocalIso(end),
            horasEstimadas: 8,
            maquinaId: null,
            tiemposAuxiliares: [],
        });
    }

    return enforceProcessChain(items);
};

const isUrgencyFormComplete = (form) => !!form.esUrgencia;

const getUrgencyFormMissing = () => [];

const computePrecioTotalOp = (unidades, precioUnitario) => {
    const u = parseNumFlexible(unidades);
    const p = parseNumFlexible(precioUnitario);
    if (u <= 0 || p <= 0) return 0;
    return Math.round(u * p * 100) / 100;
};

const precioUnitarioDesdeTotal = (precioTotal, unidades) => {
    const u = parseNumFlexible(unidades);
    const total = parseNumFlexible(precioTotal);
    if (u <= 0 || total <= 0) return '';
    const unit = total / u;
    return String(Math.round(unit * 10000) / 10000);
};

const cloneProgramacion = (prog) => ({
    ...prog,
    procesos: (prog.procesos || []).map((pr) => ({ ...pr })),
});

const computeUrgencyScheduleShift = (programaciones, urgencyDraft, procesoList) => {
    const shifted = programaciones.map(cloneProgramacion);
    const urgencyProcs = (urgencyDraft.procesos || []).map((p) => ({
        ...p,
        _start: new Date(p.fechaInicio).getTime(),
        _end: new Date(p.fechaFin).getTime(),
    })).filter((p) => !Number.isNaN(p._start) && !Number.isNaN(p._end) && p._end > p._start);

    procesoList.forEach((procesoNombre) => {
        const urgProc = urgencyProcs.find((p) => p.proceso === procesoNombre);
        if (!urgProc) return;

        const placed = [{ start: urgProc._start, end: urgProc._end, fixed: true }];
        const rowSegments = [];
        shifted.forEach((prog) => {
            prog.procesos.forEach((pr) => {
                if (pr.proceso !== procesoNombre) return;
                rowSegments.push({
                    procRef: pr,
                    start: new Date(pr.fechaInicio).getTime(),
                    end: new Date(pr.fechaFin).getTime(),
                });
            });
        });

        rowSegments.sort((a, b) => a.start - b.start);
        rowSegments.forEach((seg) => {
            const dur = Math.max(MIN_PROCESS_MS, seg.end - seg.start);
            let start = seg.start;
            let end = seg.end;
            let moved = true;
            while (moved) {
                moved = false;
                for (const p of placed) {
                    if (start < p.end && end > p.start) {
                        start = p.end;
                        end = start + dur;
                        moved = true;
                    }
                }
            }
            if (start !== seg.start) {
                seg.procRef.fechaInicio = toLocalIso(start);
                seg.procRef.fechaFin = toLocalIso(end);
            }
            placed.push({ start, end });
            placed.sort((a, b) => a.start - b.start);
        });
    });

    shifted.forEach((prog) => {
        const ordered = getActiveOrderedProcesos(prog, procesoList);
        if (!ordered.length) return;
        const cascaded = enforceProcessChain(ordered);
        const byName = Object.fromEntries(cascaded.map((p) => [p.proceso, p]));
        prog.procesos = prog.procesos.map((pr) => (byName[pr.proceso] ? { ...pr, ...byName[pr.proceso] } : pr));
    });

    return shifted;
};

/** Ajustes (OPs corridas) comparando la planificación desplazada contra la original. */
const buildAjustesFromShift = (shifted, originals, procesoList) =>
    shifted
        .map((prog) => {
            const original = originals.find((p) => p.id === prog.id);
            if (!original) return null;
            const changed = prog.procesos.some((pr) => {
                const orig = original.procesos.find((o) => o.proceso === pr.proceso);
                // Comparar instantes, no strings (formatos local vs ISO difieren).
                return orig && (
                    new Date(orig.fechaInicio).getTime() !== new Date(pr.fechaInicio).getTime()
                    || new Date(orig.fechaFin).getTime() !== new Date(pr.fechaFin).getTime()
                );
            });
            if (!changed) return null;
            const ordered = getActiveOrderedProcesos(prog, procesoList);
            return {
                id: prog.id,
                procesos: ordered.map((p) => ({
                    proceso: p.proceso,
                    fechaInicio: toLocalIso(p.fechaInicio),
                    fechaFin: toLocalIso(p.fechaFin),
                    horasEstimadas: p.horasEstimadas ?? null,
                    maquinaId: p.maquinaId ?? null,
                    tiemposAuxiliares: (p.tiemposAuxiliares || []).map((t) => ({
                        descripcion: t.descripcion,
                        horas: t.horas ?? 0,
                    })),
                })),
            };
        })
        .filter(Boolean);

const buildUrgencyDraftFromForm = (form, procesoList, ordenes = []) => {
    const procesosActivos = buildUrgencyProcesosFromForm(form, procesoList);
    const ot = form.numeroOT?.trim() || 'SIN-OT';
    const opLabel = form.numeroOP?.trim()
        ? (soloDigitos(form.numeroOP) || form.numeroOP.trim())
        : `URG-${Date.now().toString().slice(-6)}`;
    const metaParsed = parseInt(form.metaTiros, 10);
    const ordenMatch = ordenes.find(
        (o) => form.numeroOP && (o.numero === form.numeroOP.trim() || soloDigitos(o.numero) === soloDigitos(form.numeroOP))
    );
    return {
        id: '__urgency_preview__',
        numeroOP: opLabel,
        numeroOT: ot,
        lineaTroquel: form.lineaTroquel?.trim() || '',
        referencia: form.referencia?.trim() || '',
        cliente: form.cliente?.trim() || 'Urgencia',
        metaTiros: Number.isNaN(metaParsed) ? 0 : metaParsed,
        precio: computePrecioTotalOp(form.metaTiros, form.precioUnitario),
        estadoGeneral: 'programado',
        esUrgencia: true,
        isPreview: true,
        color: '#EF4444',
        ordenProduccionId: ordenMatch?.id ?? null,
        observaciones: form.observaciones?.trim() || '',
        progresoGeneral: 0,
        procesos: procesosActivos.map((p, i) => ({
            id: `preview-${i}`,
            ...p,
            estado: 'pendiente',
        })),
    };
};

const buildProgramacionPayload = (prog, procesosList, ordenes = []) => {
    const ordenMatch = ordenes.find(
        (o) => o.numero === prog.numeroOP || soloDigitos(o.numero) === soloDigitos(prog.numeroOP)
    );
    const calculoObj = prog.calculo && typeof prog.calculo === 'object' ? prog.calculo : null;
    return {
        numeroOP: soloDigitos(prog.numeroOP) || String(prog.numeroOP).trim(),
        ordenProduccionId: prog.ordenProduccionId ?? ordenMatch?.id ?? null,
        numeroOT: prog.numeroOT?.trim() || '',
        ordenCompra: prog.ordenCompra?.trim() || '',
        fechaEntrega: prog.fechaEntrega?.trim() || calculoObj?.fechaEntrega?.trim() || '',
        calculoJson: calculoObj ? JSON.stringify(calculoObj) : (prog.calculoJson || null),
        lineaTroquel: prog.lineaTroquel?.trim() || '',
        referencia: prog.referencia?.trim() || '',
        cliente: prog.cliente?.trim() || '',
        metaTiros: prog.metaTiros,
        precio: Number(prog.precio) || 0,
        color: prog.color,
        estadoGeneral: prog.estadoGeneral || 'programado',
        esUrgencia: !!prog.esUrgencia,
        tipoActividad: prog.tipoActividad || 'op',
        observaciones: prog.observaciones?.trim() || '',
        procesos: procesosList.map((p) => ({
            proceso: p.proceso,
            fechaInicio: toLocalIso(p.fechaInicio),
            fechaFin: toLocalIso(p.fechaFin),
            horasEstimadas: p.horasEstimadas ?? null,
            maquinaId: p.maquinaId ?? null,
            tiemposAuxiliares: (p.tiemposAuxiliares || []).map((t) => ({
                descripcion: t.descripcion,
                horas: t.horas ?? 0,
            })),
        })),
    };
};

const getWeekDates = (weekStart) => Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
});

export default function PlaneadorMaquinasScreen() {
    const { colors, isDarkMode } = useTheme();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [loading, setLoading] = useState(true);
    const [pivotDate, setPivotDate] = useState(new Date());
    const [rangeDates, setRangeDates] = useState(getRangeDates(new Date()));
    const [programaciones, setProgramaciones] = useState([]);
    const [ordenes, setOrdenes] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [parametrosCalculo, setParametrosCalculo] = useState([]);
    const [savingCalculoParams, setSavingCalculoParams] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [backendUnavailable, setBackendUnavailable] = useState(false);
    const [viewMode, setViewMode] = useState('gantt');
    const [disponibilidadAvisos, setDisponibilidadAvisos] = useState([]);
    const [coberturaRoster, setCoberturaRoster] = useState({}); // { [proceso]: { maquinaNombre, turnos: [...] } }
    const [ganttZoom, setGanttZoom] = useState('range'); // range | week | day
    const [focusedWeekStart, setFocusedWeekStart] = useState(null);
    const [focusedDay, setFocusedDay] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterEstado, setFilterEstado] = useState('todos');
    const [opSearchQuery, setOpSearchQuery] = useState('');
    const [opsDisponibles, setOpsDisponibles] = useState([]);
    const [loadingOps, setLoadingOps] = useState(false);
    const [loadingOpDatos, setLoadingOpDatos] = useState(false);
    const [opDatos, setOpDatos] = useState(null);
    const [detailExpanded, setDetailExpanded] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [dragPreview, setDragPreview] = useState(null);
    const [savingDrag, setSavingDrag] = useState(false);
    const dragSessionRef = useRef(null);
    const dragPreviewRef = useRef(null);
    const didDragRef = useRef(false);

    const [auxDrag, setAuxDrag] = useState(null);
    const [auxConfirm, setAuxConfirm] = useState(null);
    const [savingAux, setSavingAux] = useState(false);
    const auxDragRef = useRef(null);
    const rowDomRefs = useRef({});
    const labelScrollRef = useRef(null);
    const bodyScrollRef = useRef(null);
    /** Evita que onBlur del input OP dispare carga con prefijo parcial al elegir de la lista. */
    const skipOpBlurLoadRef = useRef(false);

    /** Mantiene la columna de procesos y las filas del Gantt desplazándose juntas. */
    const syncVerticalScroll = useCallback((source) => (e) => {
        const y = e.nativeEvent.contentOffset.y;
        const other = source === 'body' ? labelScrollRef.current : bodyScrollRef.current;
        other?.scrollTo({ y, animated: false });
    }, []);

    const [showActivityModal, setShowActivityModal] = useState(false);
    const [activityModalMode, setActivityModalMode] = useState('edit');
    const [activityForm, setActivityForm] = useState(null);
    const [activityCobertura, setActivityCobertura] = useState(null);
    const [activityValidation, setActivityValidation] = useState(null);
    const [showAddActivityPicker, setShowAddActivityPicker] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [savingActivity, setSavingActivity] = useState(false);
    const [telemetriaRows, setTelemetriaRows] = useState([]);
    const [tirosTelemetriaRows, setTirosTelemetriaRows] = useState([]);
    const [liveNow, setLiveNow] = useState(() => Date.now());
    const telemetriaActivosPrevRef = useRef(0);

    const [procesoCatalog, setProcesoCatalog] = useState([]);
    const [procesosEditMode, setProcesosEditMode] = useState(false);
    const [procesoDragIdx, setProcesoDragIdx] = useState(null);
    const [showProcesoCatalogModal, setShowProcesoCatalogModal] = useState(false);
    const [procesoCatalogForm, setProcesoCatalogForm] = useState({ id: null, nombre: '' });
    const [savingProcesoCatalog, setSavingProcesoCatalog] = useState(false);
    const procesoRowDragRef = useRef(null);
    const procesoListRef = useRef(DEFAULT_PROCESOS);
    const [urgencyPreview, setUrgencyPreview] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [formModalTab, setFormModalTab] = useState('datos'); // datos | calculo | procesos
    const [agregarMaquinaCalculoOpen, setAgregarMaquinaCalculoOpen] = useState(false);
    const [agregarProcesoManualOpen, setAgregarProcesoManualOpen] = useState(false);
    const [showDayDetail, setShowDayDetail] = useState(false);
    const [dayDetailData, setDayDetailData] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [form, setForm] = useState({
        numeroOP: '',
        numeroOT: '',
        ordenCompra: '',
        lineaTroquel: '',
        referencia: '',
        cliente: '',
        metaTiros: '',
        precioUnitario: '',
        estadoGeneral: 'programado',
        esUrgencia: false,
        observaciones: '',
        procesosSeleccionados: buildDefaultProcesosForm(),
    });
    const formRef = useRef(form);
    formRef.current = form;

    const [metaMensual, setMetaMensual] = useState(0);
    const [metaMensualDraft, setMetaMensualDraft] = useState('');
    const [showMetaModal, setShowMetaModal] = useState(false);
    const [savingMeta, setSavingMeta] = useState(false);
    const [ganttTooltip, setGanttTooltip] = useState(null);

    const updateGanttTooltip = useCallback((e, text) => {
        if (Platform.OS !== 'web') return;
        const clientX = e.clientX ?? e.nativeEvent?.pageX ?? e.nativeEvent?.clientX;
        const clientY = e.clientY ?? e.nativeEvent?.pageY ?? e.nativeEvent?.clientY;
        if (clientX == null || clientY == null) return;
        setGanttTooltip({ x: clientX, y: clientY, text });
    }, []);

    const clearGanttTooltip = useCallback(() => setGanttTooltip(null), []);

    const displayDates = useMemo(() => {
        if (ganttZoom === 'day' && focusedDay) {
            return [focusedDay];
        }
        if (ganttZoom === 'week' && focusedWeekStart) {
            return getWeekDates(focusedWeekStart);
        }
        return rangeDates;
    }, [ganttZoom, focusedWeekStart, focusedDay, rangeDates]);

    const procesoList = useMemo(() => (
        procesoCatalog.length
            ? procesoCatalog.map((p) => p.nombre)
            : DEFAULT_PROCESOS
    ), [procesoCatalog]);

    useEffect(() => {
        procesoListRef.current = procesoList;
    }, [procesoList]);

    const labelColWidth = procesosEditMode ? 156 : LABEL_COL_WIDTH;
    const timelineAvail = Math.max(280, windowWidth - labelColWidth - 24);

    const numTimelineCols = ganttZoom === 'day' ? HOUR_SLOTS.length : displayDates.length;

    const columnWidth = useMemo(() => {
        const minW = ganttZoom === 'day' ? 32 : ganttZoom === 'week' ? 88 : 42;
        return Math.max(minW, Math.floor(timelineAvail / numTimelineCols));
    }, [ganttZoom, timelineAvail, numTimelineCols]);

    const trackWidth = columnWidth * numTimelineCols;

    const monthGroups = useMemo(() => groupDatesByMonth(displayDates), [displayDates]);
    const weekGroups = useMemo(() => groupDatesByWeek(displayDates), [displayDates]);

    const weekRangeShort = useMemo(() => {
        if (!focusedWeekStart) return '';
        const end = new Date(focusedWeekStart);
        end.setDate(end.getDate() + 6);
        return `${focusedWeekStart.getDate()}–${end.getDate()} ${MESES[focusedWeekStart.getMonth()].slice(0, 3)}`;
    }, [focusedWeekStart]);

    const renderToolbar = () => {
        const navStepLabel = ganttZoom === 'day' ? 'día' : (ganttZoom === 'week' ? 'sem' : 'mes');
        const surface = isDarkMode ? '#0F172A' : '#F8FAFC';
        const border = colors.border;

        return (
            <View style={[styles.toolbar, { backgroundColor: surface, borderBottomColor: border }]}>
                <View style={styles.toolbarRow}>
                    <View style={styles.toolbarLeft}>
                        {ganttZoom !== 'range' && (
                            <TouchableOpacity style={styles.toolbarBackBtn} onPress={zoomOut}>
                                <Text style={styles.toolbarBackBtnText}>←</Text>
                            </TouchableOpacity>
                        )}
                        <View style={styles.toolbarTitleBlock}>
                            <Text style={[styles.toolbarTitle, { color: colors.text }]} numberOfLines={1}>
                                {ganttZoom === 'day' && focusedDay
                                    ? focusedDay.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
                                    : ganttZoom === 'week'
                                        ? `Semana ${weekRangeShort}`
                                        : `${MESES[rangeDates[0].getMonth()]} ${rangeDates[0].getFullYear()}`}
                            </Text>
                            <View style={styles.toolbarBreadcrumb}>
                                <TouchableOpacity onPress={resetZoom}>
                                    <Text style={[styles.toolbarCrumb, ganttZoom === 'range' && styles.toolbarCrumbActive]}>Mes</Text>
                                </TouchableOpacity>
                                {(ganttZoom === 'week' || ganttZoom === 'day') && (
                                    <>
                                        <Text style={[styles.toolbarCrumbSep, { color: colors.subText }]}>›</Text>
                                        <TouchableOpacity onPress={() => { setGanttZoom('week'); setFocusedDay(null); }}>
                                            <Text style={[styles.toolbarCrumb, ganttZoom === 'week' && styles.toolbarCrumbActive]}>Semana</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                {ganttZoom === 'day' && (
                                    <>
                                        <Text style={[styles.toolbarCrumbSep, { color: colors.subText }]}>›</Text>
                                        <Text style={[styles.toolbarCrumb, styles.toolbarCrumbActive]}>Día</Text>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.toolbarCenter}>
                        <View style={styles.viewToggleGroup}>
                            <TouchableOpacity
                                style={[styles.viewToggleBtn, viewMode === 'gantt' && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode('gantt')}
                            >
                                <Text style={styles.viewToggleText}>Gantt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.viewToggleBtn, viewMode === 'lista' && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode('lista')}
                            >
                                <Text style={styles.viewToggleText}>Lista</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.viewToggleBtn, viewMode === 'roster' && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode('roster')}
                            >
                                <Text style={styles.viewToggleText}>Roster</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.navBtnCompact} onPress={() => shiftRange(-1)}>
                            <Text style={styles.navBtnText}>◀</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navBtnCompact} onPress={goToToday}>
                            <Text style={styles.navBtnText}>Hoy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navBtnCompact} onPress={() => shiftRange(1)}>
                            <Text style={styles.navBtnText}>▶</Text>
                        </TouchableOpacity>
                        <Text style={[styles.navHint, { color: colors.subText }]}>{navStepLabel}</Text>
                    </View>

                    <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
                        <Text style={styles.createBtnText}>+ Programar OP</Text>
                    </TouchableOpacity>
                    {viewMode === 'gantt' && ganttZoom === 'range' && (
                        <TouchableOpacity
                            style={styles.metaFactBtn}
                            onPress={() => {
                                setMetaMensualDraft(metaMensual ? String(metaMensual) : '');
                                setShowMetaModal(true);
                            }}
                        >
                            <Text style={styles.metaFactBtnText}>
                                Meta {metaMensual > 0 ? formatMoney(metaMensual) : 'mes'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {viewMode === 'gantt' && (
                        <TouchableOpacity
                            style={[styles.procesosEditBtn, procesosEditMode && styles.procesosEditBtnActive]}
                            onPress={() => setProcesosEditMode((v) => !v)}
                        >
                            <Text style={[styles.procesosEditBtnText, procesosEditMode && { color: '#FFF' }]}>
                                {procesosEditMode ? '✓ Procesos' : '⚙ Procesos'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {viewMode === 'gantt' && Platform.OS === 'web' && (
                        <View style={styles.auxPalette}>
                            {AUX_ACTIVITY_TYPES.map((aux) => (
                                <View
                                    key={aux.tipo}
                                    style={[
                                        styles.auxChip,
                                        {
                                            borderColor: aux.color,
                                            backgroundColor: aux.color + '22',
                                            cursor: 'grab',
                                            opacity: savingAux ? 0.5 : 1,
                                        },
                                    ]}
                                    onMouseDown={(e) => startAuxDrag(aux, e)}
                                >
                                    <Text style={[styles.auxChipText, { color: aux.color }]}>
                                        {aux.icon} {aux.label}
                                    </Text>
                                </View>
                            ))}
                            <Text style={{ color: colors.subText, fontSize: 9, alignSelf: 'center' }}>← arrastre al Gantt</Text>
                        </View>
                    )}
                </View>

                {viewMode !== 'roster' && (
                <View style={styles.toolbarRow2}>
                    <TextInput
                        style={[styles.searchInputCompact, { color: colors.text, borderColor: border, backgroundColor: isDarkMode ? '#1E293B' : '#FFF' }]}
                        placeholder="Buscar OP, OT, cliente..."
                        placeholderTextColor="#718096"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <TouchableOpacity
                        style={[styles.filterToggleBtn, filtersExpanded && styles.filterToggleBtnActive]}
                        onPress={() => setFiltersExpanded((v) => !v)}
                    >
                        <Text style={[styles.filterToggleText, filtersExpanded && { color: '#FFF' }]}>
                            Filtros {filterEstado !== 'todos' ? '●' : ''}
                        </Text>
                    </TouchableOpacity>
                    {viewMode === 'gantt' && ganttZoom === 'range' && (
                        <View style={styles.legendInline}>
                            {weekGroups.map((w, i) => (
                                <View key={w.key} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: w.palette.header }]} />
                                    <Text style={{ color: colors.subText, fontSize: 10 }}>S{i + 1}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    <Text style={[styles.countBadge, { color: colors.subText }]}>
                        {filteredProgramaciones.length} OP{(savingDrag || savingAux) ? ' · guardando…' : ''}
                    </Text>
                </View>
                )}

                {viewMode !== 'roster' && (filtersExpanded || filterEstado !== 'todos') && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsRow}>
                        {['todos', ...Object.keys(ESTADO_GENERAL_CONFIG)].map((est) => (
                            <TouchableOpacity
                                key={est}
                                style={[styles.filterChip, filterEstado === est && styles.filterChipActive]}
                                onPress={() => setFilterEstado(est)}
                            >
                                <Text style={[styles.filterChipText, filterEstado === est && { color: '#FFF' }]}>
                                    {est === 'todos' ? 'Todos' : ESTADO_GENERAL_CONFIG[est].label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>
        );
    };
    const zoomLabel = useMemo(() => {
        if (ganttZoom === 'day' && focusedDay) {
            return focusedDay.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        if (ganttZoom === 'week' && focusedWeekStart) {
            const end = new Date(focusedWeekStart);
            end.setDate(end.getDate() + 6);
            return `Semana ${focusedWeekStart.getDate()}–${end.getDate()} ${MESES[focusedWeekStart.getMonth()].slice(0, 3)} ${focusedWeekStart.getFullYear()}`;
        }
        return `${MESES[rangeDates[0].getMonth()]} ${rangeDates[0].getFullYear()} · ${rangeDates.length} días`;
    }, [ganttZoom, focusedDay, focusedWeekStart, rangeDates]);

    const selectedProgramacion = useMemo(() => {
        if (selectedId === '__urgency_preview__' && urgencyPreview) return urgencyPreview.draft;
        return programaciones.find((p) => p.id === selectedId) || programaciones[0] || null;
    }, [programaciones, selectedId, urgencyPreview]);

    const filteredProgramaciones = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return programaciones.filter((p) => {
            if (filterEstado !== 'todos' && (p.estadoGeneral || 'programado') !== filterEstado) return false;
            if (!q) return true;
            const haystack = [
                p.numeroOP, p.numeroOT, p.lineaTroquel, p.referencia, p.cliente,
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [programaciones, searchQuery, filterEstado]);

    const displayProgramaciones = useMemo(() => {
        let base = filteredProgramaciones;

        if (urgencyPreview) {
            const shiftedById = Object.fromEntries(urgencyPreview.shifted.map((p) => [p.id, p]));
            base = filteredProgramaciones.map((p) => shiftedById[p.id] || p);
            base = [urgencyPreview.draft, ...base];
        }

        if (!dragPreview) return base;
        return base.map((p) => {
            if (p.id !== dragPreview.progId) return p;
            const byName = Object.fromEntries(dragPreview.procesos.map((pr) => [pr.proceso, pr]));
            return {
                ...p,
                procesos: p.procesos.map((proc) => {
                    const u = byName[proc.proceso];
                    return u ? { ...proc, fechaInicio: u.fechaInicio, fechaFin: u.fechaFin } : proc;
                }),
            };
        });
    }, [filteredProgramaciones, dragPreview, urgencyPreview]);

    const entregasPorDiaKey = useMemo(() => {
        const map = new Map();
        displayProgramaciones.forEach((prog) => {
            const entrega = fechaEntregaFromProgramacion(prog);
            if (!entrega) return;
            const key = toDateKeyLocal(entrega);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(prog);
        });
        return map;
    }, [displayProgramaciones]);

    const getDayItems = useCallback((procesoNombre, dayIdx) => {
        const dayDate = displayDates[dayIdx];
        if (!dayDate) return [];
        const items = [];
        displayProgramaciones.forEach((prog) => {
            prog.procesos
                .filter((p) => p.proceso === procesoNombre && overlapsDay(p.fechaInicio, p.fechaFin, dayDate))
                .forEach((p) => items.push({ prog, proceso: p }));
        });
        return items;
    }, [displayProgramaciones, displayDates]);

    const getHourItems = useCallback((procesoNombre, hour) => {
        if (!focusedDay) return [];
        const items = [];
        displayProgramaciones.forEach((prog) => {
            prog.procesos
                .filter((p) => p.proceso === procesoNombre && overlapsHour(p.fechaInicio, p.fechaFin, focusedDay, hour))
                .forEach((p) => items.push({ prog, proceso: p }));
        });
        return items;
    }, [displayProgramaciones, focusedDay]);

    const processLanes = useMemo(() => {
        const lanes = {};
        procesoList.forEach((procesoNombre) => {
            const progIds = new Set();
            displayProgramaciones.forEach((prog) => {
                if (prog.procesos.some((p) => p.proceso === procesoNombre)) {
                    progIds.add(prog.id);
                }
            });
            const sorted = [...progIds].sort((a, b) => a - b);
            lanes[procesoNombre] = {};
            sorted.forEach((id, i) => { lanes[procesoNombre][id] = i; });
        });
        return lanes;
    }, [displayProgramaciones, procesoList]);

    const rowHeights = useMemo(() => {
        const heights = {};
        procesoList.forEach((proceso) => {
            let maxItems = 0;
            if (ganttZoom === 'day') {
                maxItems = getDayItems(proceso, 0).length;
            } else {
                displayDates.forEach((_, i) => {
                    maxItems = Math.max(maxItems, getDayItems(proceso, i).length);
                });
            }
            const visible = Math.min(maxItems, MAX_VISIBLE_CHIPS);
            const extra = maxItems > MAX_VISIBLE_CHIPS ? 1 : 0;
            heights[proceso] = Math.max(BASE_ROW_HEIGHT, 10 + visible * (CHIP_HEIGHT + 2) + extra * 14);
        });
        return heights;
    }, [getDayItems, displayDates, ganttZoom, procesoList]);

    const loadProcesosCatalog = useCallback(async () => {
        try {
            const data = await planeacionApi.getProcesosGantt();
            const catalog = normalizeProcesoCatalog(data);
            if (catalog.length) {
                setProcesoCatalog(catalog);
            } else {
                setProcesoCatalog(DEFAULT_PROCESOS.map((nombre, orden) => ({ id: 0, nombre, orden })));
            }
        } catch (error) {
            console.error('Error cargando catálogo de procesos:', error);
            setProcesoCatalog(DEFAULT_PROCESOS.map((nombre, orden) => ({ id: 0, nombre, orden })));
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const start = formatDateKey(rangeDates[0]);
            const end = `${formatDateKey(rangeDates[rangeDates.length - 1])}T23:59:59`;
            const [progs, ords, maqs, paramsCalc] = await Promise.all([
                planeacionApi.getProgramacionesRango(start, end),
                api.getOrdenes(),
                api.getMaquinas().catch(() => []),
                planeacionApi.getParametrosCalculoMaquinas().catch(() => []),
            ]);
            setProgramaciones(Array.isArray(progs) ? progs : []);
            setOrdenes(ords);
            setMaquinas((Array.isArray(maqs) ? maqs : []).filter((m) => m.activo !== false));
            setParametrosCalculo(Array.isArray(paramsCalc) ? paramsCalc : []);
            setBackendUnavailable(false);
            setSelectedId((prev) => prev ?? (progs.length > 0 ? progs[0].id : null));
        } catch (error) {
            console.error('Error cargando programaciones:', error);
            if (error?.response?.status === 404) {
                setProgramaciones([]);
                setBackendUnavailable(true);
            } else {
                Alert.alert('Error', getErrorMessage(error));
            }
        } finally {
            setLoading(false);
        }
    }, [rangeDates]);

    useEffect(() => {
        setRangeDates(getRangeDates(pivotDate));
    }, [pivotDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const telemetriaIndex = useMemo(() => buildTelemetriaIndex(telemetriaRows), [telemetriaRows]);
    const tirosTelemetriaIndex = useMemo(() => buildTirosTelemetriaIndex(tirosTelemetriaRows), [tirosTelemetriaRows]);
    const hasLiveTelemetry = telemetriaIndex.size > 0;

    useEffect(() => {
        let cancelled = false;
        const fetchTelemetria = async () => {
            try {
                const data = await planeacionApi.getEstadoActualMaquinas();
                if (cancelled) return;
                const parsed = parseTelemetriaPayload(data);
                setTelemetriaRows(parsed.activos);
                setTirosTelemetriaRows(parsed.tirosPorOpMaquina);
                const activosCount = parsed.activos.length;
                if (telemetriaActivosPrevRef.current > 0 && activosCount === 0) {
                    loadData();
                }
                telemetriaActivosPrevRef.current = activosCount;
            } catch (error) {
                if (!cancelled) console.warn('Telemetría planeador:', error?.message || error);
            }
        };
        fetchTelemetria();
        const pollId = setInterval(fetchTelemetria, 5000);
        return () => {
            cancelled = true;
            clearInterval(pollId);
        };
    }, [loadData]);

    useEffect(() => {
        if (viewMode !== 'gantt') return undefined;
        const tickId = setInterval(() => setLiveNow(Date.now()), 1000);
        return () => clearInterval(tickId);
    }, [viewMode, hasLiveTelemetry, tirosTelemetriaIndex.size]);

    useEffect(() => {
        loadProcesosCatalog();
    }, [loadProcesosCatalog]);

    const loadMetaMensual = useCallback(async () => {
        if (!rangeDates.length) return;
        const anio = rangeDates[0].getFullYear();
        const mes = rangeDates[0].getMonth() + 1;
        try {
            const data = await planeacionApi.getMetaFacturacion(anio, mes);
            const meta = Number(data?.meta ?? data?.Meta ?? 0) || 0;
            setMetaMensual(meta);
            setMetaMensualDraft(meta ? String(meta) : '');
        } catch {
            setMetaMensual(0);
            setMetaMensualDraft('');
        }
    }, [rangeDates]);

    useEffect(() => {
        loadMetaMensual();
    }, [loadMetaMensual]);

    const weeklyBilling = useMemo(() => {
        if (ganttZoom !== 'range') return [];
        return computeWeeklyBilling(weekGroups, rangeDates, displayProgramaciones, metaMensual);
    }, [ganttZoom, weekGroups, rangeDates, displayProgramaciones, metaMensual]);

    const monthlyBillingSummary = useMemo(() => {
        const generado = weeklyBilling.reduce((s, w) => s + w.generado, 0);
        return {
            meta: metaMensual,
            generado,
            saldo: metaMensual - generado,
        };
    }, [weeklyBilling, metaMensual]);

    const handleSaveMetaMensual = async () => {
        if (!rangeDates.length) return;
        const anio = rangeDates[0].getFullYear();
        const mes = rangeDates[0].getMonth() + 1;
        const meta = parseFloat(String(metaMensualDraft).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        if (meta < 0) {
            Alert.alert('Meta inválida', 'La meta no puede ser negativa.');
            return;
        }
        setSavingMeta(true);
        try {
            const data = await planeacionApi.upsertMetaFacturacion(anio, mes, meta);
            const saved = Number(data?.meta ?? data?.Meta ?? meta) || 0;
            setMetaMensual(saved);
            setMetaMensualDraft(saved ? String(saved) : '');
            setShowMetaModal(false);
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSavingMeta(false);
        }
    };

    useEffect(() => {
        if (!procesoList.length) return;
        setForm((f) => {
            const next = { ...f.procesosSeleccionados };
            let changed = false;
            procesoList.forEach((nombre) => {
                if (!next[nombre]) {
                    changed = true;
                    next[nombre] = getProcesoFormEntry();
                }
            });
            return changed ? { ...f, procesosSeleccionados: next } : f;
        });
    }, [procesoList]);

    const resetZoom = () => {
        setGanttZoom('range');
        setFocusedWeekStart(null);
        setFocusedDay(null);
    };

    const zoomToWeek = (weekGroup) => {
        const weekStart = rangeDates[weekGroup.startIdx];
        if (!weekStart) return;
        setFocusedWeekStart(getMonday(weekStart));
        setFocusedDay(null);
        setGanttZoom('week');
    };

    const zoomToDay = (date) => {
        const d = new Date(date);
        setFocusedDay(d);
        setFocusedWeekStart(getMonday(d));
        setGanttZoom('day');
    };

    const zoomOut = () => {
        if (ganttZoom === 'day') {
            setGanttZoom('week');
            setFocusedDay(null);
        } else if (ganttZoom === 'week') {
            resetZoom();
        }
    };

    const shiftRange = (direction) => {
        if (ganttZoom === 'day' && focusedDay) {
            const next = new Date(focusedDay);
            next.setDate(next.getDate() + direction);
            setFocusedDay(next);
            setFocusedWeekStart(getMonday(next));
            return;
        }
        if (ganttZoom === 'week' && focusedWeekStart) {
            const next = new Date(focusedWeekStart);
            next.setDate(next.getDate() + direction * DAYS_PER_WEEK);
            setFocusedWeekStart(next);
            return;
        }
        const next = new Date(pivotDate.getFullYear(), pivotDate.getMonth() + direction, 1);
        setPivotDate(next);
        resetZoom();
    };

    const goToToday = () => {
        const today = new Date();
        if (ganttZoom === 'day') {
            setFocusedDay(today);
            setFocusedWeekStart(getMonday(today));
        } else if (ganttZoom === 'week') {
            setFocusedWeekStart(getMonday(today));
        } else {
            setPivotDate(today);
            resetZoom();
        }
    };

    const openDayDetailModal = (proceso, dayDate, items) => {
        setDayDetailData({ proceso, dayDate, items });
        setShowDayDetail(true);
    };

    /** OP que tiene ocupada la máquina en el rango dado (null = libre). */
    const getOcupacionMaquina = useCallback((maquinaId, inicioMs, finMs, excludeProgId = null) => {
        if (!maquinaId) return null;
        const mid = Number(maquinaId);
        for (const prog of programaciones) {
            if (excludeProgId != null && prog.id === excludeProgId) continue;
            for (const pr of prog.procesos || []) {
                if (Number(pr.maquinaId) !== mid) continue;
                const s = new Date(pr.fechaInicio).getTime();
                const e = new Date(pr.fechaFin).getTime();
                // [inicio, fin) — pueden encadenarse: una termina a las 11 y otra empieza a las 11
                if (s < finMs && e > inicioMs) return prog.numeroOP;
            }
        }
        return null;
    }, [programaciones]);

    /** Horas de un día bloqueadas para INICIO (punto dentro de [ocupInicio, ocupFin)). */
    const getHorasInicioBloqueadas = useCallback((maquinaId, fechaStr, excludeProgId = null) => {
        const blocked = {};
        if (!maquinaId || !fechaStr) return blocked;
        const mid = Number(maquinaId);
        for (let h = 0; h < 24; h++) {
            const point = new Date(buildDateTime(fechaStr, h)).getTime();
            if (Number.isNaN(point)) continue;
            for (const prog of programaciones) {
                if (excludeProgId != null && prog.id === excludeProgId) continue;
                for (const pr of prog.procesos || []) {
                    if (Number(pr.maquinaId) !== mid) continue;
                    const s = new Date(pr.fechaInicio).getTime();
                    const e = new Date(pr.fechaFin).getTime();
                    if (point >= s && point < e) {
                        blocked[h] = `OP ${prog.numeroOP}`;
                        break;
                    }
                }
                if (blocked[h]) break;
            }
        }
        return blocked;
    }, [programaciones]);

    /** Horas de fin bloqueadas: el intervalo [inicio, fin) solapa otra OP en la misma máquina. */
    const getHorasFinBloqueadas = useCallback((maquinaId, fechaInicio, horaInicio, fechaFin, excludeProgId = null) => {
        const blocked = {};
        if (!maquinaId || !fechaInicio || !fechaFin) return blocked;
        const startMs = new Date(buildDateTime(fechaInicio, horaInicio)).getTime();
        if (Number.isNaN(startMs)) return blocked;
        for (let h = 0; h < 24; h++) {
            const endMs = new Date(buildDateTime(fechaFin, h)).getTime();
            if (Number.isNaN(endMs) || endMs <= startMs) {
                if (endMs <= startMs) blocked[h] = '≤ inicio';
                continue;
            }
            const op = getOcupacionMaquina(maquinaId, startMs, endMs, excludeProgId);
            if (op) blocked[h] = `OP ${op}`;
        }
        return blocked;
    }, [programaciones, getOcupacionMaquina]);

    const findNextFreeStartHour = useCallback((maquinaId, fechaStr, fromHour, excludeProgId = null) => {
        const blocked = getHorasInicioBloqueadas(maquinaId, fechaStr, excludeProgId);
        for (let h = fromHour; h < 24; h++) {
            if (!blocked[h]) return h;
        }
        for (let h = 0; h < fromHour; h++) {
            if (!blocked[h]) return h;
        }
        return null;
    }, [getHorasInicioBloqueadas]);

    const collectAvisosDisponibilidad = useCallback(async (procesosActivos) => {
        const mensajes = [];
        const seen = new Set();
        for (const p of procesosActivos || []) {
            if (!p.maquinaId || !p.fechaInicio || !p.fechaFin) continue;
            try {
                const res = await planeacionApi.getAvisosDisponibilidad(p.maquinaId, p.fechaInicio, p.fechaFin);
                const list = res?.avisos || [];
                for (const a of list) {
                    const msg = a.mensaje || a.Mensaje || '';
                    if (!msg || seen.has(msg)) continue;
                    seen.add(msg);
                    mensajes.push(msg);
                }
            } catch {
                // API antigua o red: no bloquear
            }
        }
        return mensajes;
    }, []);

    const collectCoberturaRoster = useCallback(async (procesosActivos) => {
        const map = {};
        for (const p of procesosActivos || []) {
            if (!p.proceso || !p.fechaInicio) continue;
            try {
                const iniKey = String(p.fechaInicio).slice(0, 10);
                const finKey = p.fechaFin
                    ? String(p.fechaFin).slice(0, 10)
                    : iniKey;
                const inicio = `${iniKey}T00:00:00`;
                const fin = `${finKey}T23:59:59`;
                const ids = maquinaIdsParaCoberturaOp(p.proceso, maquinas, procesoList, p.maquinaId);
                if (!ids.length) {
                    map[p.proceso] = { turnos: [] };
                    continue;
                }
                const responses = await Promise.all(
                    ids.map((mid) => planeacionApi.getCoberturaDisponibilidad(mid, inicio, fin).catch(() => ({ turnos: [] }))),
                );
                map[p.proceso] = mergeCoberturaTurnos(...responses);
            } catch {
                map[p.proceso] = null;
            }
        }
        return map;
    }, [maquinas, procesoList]);

    const applyScheduleAlign = useCallback((formBase, cobertura) => (
        applyCascadeScheduleAlign(formBase, cobertura, procesoList)
    ), [procesoList]);

    const refreshDisponibilidadUi = useCallback(async (formLike, { alignSchedule = false } = {}) => {
        try {
            const base = formLike || formRef.current;
            const activos = buildProcesosForCobertura(base, procesoList);
            const cobertura = await collectCoberturaRoster(activos);
            setCoberturaRoster(cobertura);
            setDisponibilidadAvisos([]);

            if (!alignSchedule) return cobertura;

            const { form: aligned1, changed: changed1 } = applyScheduleAlign(base, cobertura);
            let current = aligned1;
            if (changed1) {
                formRef.current = current;
                setForm(current);
            }

            try {
                const activos2 = buildProcesosForCobertura(current, procesoList);
                const cobertura2 = await collectCoberturaRoster(activos2);
                const { form: aligned2, changed: changed2 } = applyScheduleAlign(current, cobertura2);
                if (changed2) {
                    formRef.current = aligned2;
                    setForm(aligned2);
                }
                setCoberturaRoster(cobertura2);
                return cobertura2;
            } catch {
                return cobertura;
            }
        } catch {
            return null;
        }
    }, [applyScheduleAlign, collectCoberturaRoster, procesoList]);

    /** Lleva datos del cálculo (máquina/horas) al proceso correspondiente y carga roster al entrar al paso 3. */
    const syncCalculoIntoProcesosForm = useCallback((f) => {
        const { procesos, calculo } = syncProcesosActivosDesdeMaquinasCalculo(
            f.procesosSeleccionados || {},
            f.calculo || emptyCalculoForm(),
            parametrosCalculo,
            procesoList,
            maquinas
        );
        return { ...f, calculo, procesosSeleccionados: procesos };
    }, [parametrosCalculo, procesoList, maquinas]);

    const goToProcesosTab = useCallback(() => {
        setForm((f) => {
            const next = syncCalculoIntoProcesosForm(f);
            formRef.current = next;
            return next;
        });
        setFormModalTab('procesos');
        setTimeout(() => {
            refreshDisponibilidadUi(formRef.current, { alignSchedule: !editingId });
        }, 50);
    }, [syncCalculoIntoProcesosForm, refreshDisponibilidadUi, editingId, opDatos]);

    useEffect(() => {
        if (!showModal || formModalTab !== 'procesos') return;
        const t = setTimeout(() => {
            refreshDisponibilidadUi(formRef.current, { alignSchedule: !editingId });
        }, 80);
        return () => clearTimeout(t);
    }, [showModal, formModalTab, refreshDisponibilidadUi, editingId]);

    const openCreateModal = () => {
        setEditingId(null);
        setSaveError(null);
        setDisponibilidadAvisos([]);
        setCoberturaRoster({});
        setOpSearchQuery('');
        setOpsDisponibles([]);
        setOpDatos(null);
        setUrgencyPreview(null);
        setForm({
            numeroOP: '',
            numeroOT: '',
            ordenCompra: '',
            lineaTroquel: '',
            referencia: '',
            cliente: '',
            metaTiros: '',
            precioUnitario: '',
            estadoGeneral: 'programado',
            esUrgencia: false,
            observaciones: '',
            procesosSeleccionados: buildDefaultProcesosForm(procesoList),
            calculo: emptyCalculoForm(),
        });
        setFormModalTab('datos');
        setShowModal(true);
    };

    const openEditModal = async (prog) => {
        setEditingId(prog.id);
        setSaveError(null);
        setDisponibilidadAvisos([]);
        setCoberturaRoster({});
        const procesosMap = buildDefaultProcesosForm(procesoList);
        prog.procesos.forEach((p) => {
            const ini = parseLocalDateParts(p.fechaInicio);
            const fin = parseLocalDateParts(p.fechaFin);
            procesosMap[p.proceso] = {
                activo: true,
                fechaInicio: ini.fecha,
                horaInicio: ini.hora,
                fechaFin: fin.fecha,
                horaFin: fin.hora,
                horasEstimadas: String(p.horasEstimadas ?? ''),
                maquinaId: p.maquinaId ?? null,
                tiemposAuxiliares: (p.tiemposAuxiliares || []).map((t, i) => ({
                    id: `${i}-${t.descripcion}`,
                    descripcion: t.descripcion,
                    horas: String(t.horas ?? ''),
                })),
            };
        });

        const calculoPersistido = parseCalculoJson(prog.calculoJson);
        let datosOp = null;
        setLoadingOpDatos(true);
        try {
            const digits = soloDigitos(prog.numeroOP) || String(prog.numeroOP || '').trim();
            if (digits) {
                datosOp = await planeacionApi.getDatosOpProgramacion(digits);
                setOpDatos(datosOp);
            }
        } catch {
            datosOp = null;
        } finally {
            setLoadingOpDatos(false);
        }

        const calculoFromDatos = datosOp
            ? buildCalculoFromDatosOp(datosOp, { cantidadSolicitada: String(prog.metaTiros || '') })
            : null;
        const procConv = prog.procesos?.find((p) => /conver/i.test(p.proceso || ''));
        const procCorte = prog.procesos?.find((p) => /corte/i.test(p.proceso || ''));
        const calculo = normalizeCalculoForm({
            ...emptyCalculoForm(),
            ...(calculoFromDatos || {}),
            ...(calculoPersistido || {}),
            sobrante: String(calculoPersistido?.sobrante ?? calculoPersistido?.restaManualTiros ?? '0'),
            cantidadSolicitada: String(prog.metaTiros || calculoPersistido?.cantidadSolicitada || calculoFromDatos?.cantidadSolicitada || ''),
            fechaEntrega: prog.fechaEntrega
                || calculoPersistido?.fechaEntrega
                || calculoFromDatos?.fechaEntrega
                || '',
            maquinaCalculoId: calculoPersistido?.maquinaCalculoId ?? null,
            maquinasCalculoExtraIds: Array.isArray(calculoPersistido?.maquinasCalculoExtraIds)
                ? calculoPersistido.maquinasCalculoExtraIds
                : [],
            porMaquina: calculoPersistido?.porMaquina || {},
            procesosManualesSeleccionados: Array.isArray(calculoPersistido?.procesosManualesSeleccionados)
                ? calculoPersistido.procesosManualesSeleccionados
                : procesoList.filter((p) => procesoRequiereSinMaquina(p) && procesosMap[p]?.activo),
        }, parametrosCalculo);

        setForm({
            numeroOP: prog.numeroOP,
            numeroOT: prog.numeroOT || '',
            ordenCompra: prog.ordenCompra || datosOp?.ordenCompra || '',
            lineaTroquel: prog.lineaTroquel || '',
            referencia: prog.referencia || '',
            cliente: prog.cliente || '',
            metaTiros: String(prog.metaTiros || ''),
            precioUnitario: precioUnitarioDesdeTotal(prog.precio, prog.metaTiros),
            estadoGeneral: prog.estadoGeneral || 'programado',
            esUrgencia: !!prog.esUrgencia,
            observaciones: prog.observaciones || '',
            procesosSeleccionados: procesosMap,
            calculo,
        });
        setFormModalTab('datos');
        setShowModal(true);
    };

    const buscarOpsDisponibles = useCallback(async (q) => {
        setLoadingOps(true);
        try {
            const lista = await planeacionApi.getOpsDisponiblesProgramacion(q);
            setOpsDisponibles(Array.isArray(lista) ? lista : []);
        } catch {
            setOpsDisponibles([]);
        } finally {
            setLoadingOps(false);
        }
    }, []);

    useEffect(() => {
        if (!showModal || editingId) return undefined;
        const q = (opSearchQuery || '').trim();
        if (q.length < 2) {
            setOpsDisponibles([]);
            return undefined;
        }
        const t = setTimeout(() => buscarOpsDisponibles(q), 300);
        return () => clearTimeout(t);
    }, [showModal, editingId, opSearchQuery, buscarOpsDisponibles]);

    /** Si el usuario escribe "78" y en la lista está 7872, usa el número completo. */
    const resolverNumeroOpCompleto = useCallback((numero) => {
        const digits = soloDigitos(numero);
        if (!digits) return '';
        const lista = Array.isArray(opsDisponibles) ? opsDisponibles : [];
        const exact = lista.find((o) => soloDigitos(o.numero) === digits);
        if (exact) return soloDigitos(exact.numero);

        const prefijo = lista.filter((o) => {
            const n = soloDigitos(o.numero);
            return n.startsWith(digits) || n.endsWith(digits) || n.includes(digits);
        });
        if (prefijo.length === 1) return soloDigitos(prefijo[0].numero);
        if (lista.length === 1 && digits.length >= 2) {
            const n = soloDigitos(lista[0].numero);
            if (n.includes(digits) || digits.includes(n)) return n;
        }
        return digits;
    }, [opsDisponibles]);

    const aplicarDatosOp = async (numero) => {
        const digitsIn = soloDigitos(numero);
        if (!digitsIn) return;
        const digits = resolverNumeroOpCompleto(numero) || digitsIn;
        if (digits !== digitsIn) {
            setForm((f) => ({ ...f, numeroOP: digits }));
            setOpSearchQuery(digits);
        }
        setLoadingOpDatos(true);
        try {
            const datos = await planeacionApi.getDatosOpProgramacion(digits);
            setOpDatos(datos);

            if (!datos.listoParaProgramar && !datos.tieneOp) {
                const sugeridas = (opsDisponibles || [])
                    .filter((o) => soloDigitos(o.numero).includes(digitsIn) || digitsIn.includes(soloDigitos(o.numero)))
                    .slice(0, 5)
                    .map((o) => o.numero);
                if (sugeridas.length > 0 && digits === digitsIn) {
                    showAppAlert(
                        'Seleccione la OP completa',
                        `No hay documento para OP ${digitsIn}. Elija de la lista (ej. ${sugeridas.map((n) => `OP ${n}`).join(', ')}) o escriba el número completo.`
                    );
                    return;
                }
                showAppAlert('Documentos incompletos', datos.mensaje || 'Falta adjuntar el documento OP en Planeación.');
                return;
            }

            // OP ya programada → modo edición (evita POST 400 "ya está programada")
            let progExistente = null;
            const progId = datos.programacionId || datos.ProgramacionId;
            if (progId) {
                try {
                    progExistente = await planeacionApi.getProgramacion(progId);
                } catch {
                    progExistente = programaciones.find((p) => p.id === progId) || null;
                }
            }
            if (!progExistente) {
                progExistente = programaciones.find((p) =>
                    !p.esUrgencia
                    && (soloDigitos(p.numeroOP) === digits || String(p.numeroOP).trim() === digits)
                ) || null;
            }

            if (progExistente?.id) {
                setEditingId(progExistente.id);
                const procesosMap = buildDefaultProcesosForm(procesoList);
                (progExistente.procesos || []).forEach((p) => {
                    procesosMap[p.proceso] = {
                        activo: true,
                        fechaInicio: formatDateKey(new Date(p.fechaInicio)),
                        horaInicio: parseHour(p.fechaInicio),
                        fechaFin: formatDateKey(new Date(p.fechaFin)),
                        horaFin: parseHour(p.fechaFin),
                        horasEstimadas: String(p.horasEstimadas ?? ''),
                        maquinaId: p.maquinaId ?? null,
                        tiemposAuxiliares: (p.tiemposAuxiliares || []).map((t, i) => ({
                            id: `${i}-${t.descripcion}`,
                            descripcion: t.descripcion,
                            horas: String(t.horas ?? ''),
                        })),
                    };
                });

                const calculoEdit = normalizeCalculoForm(
                    buildCalculoFromDatosOp(datos, {
                        cantidadSolicitada: datos.cantidadSolicitada
                            ? String(datos.cantidadSolicitada)
                            : String(progExistente.metaTiros || datos.metaTiros || ''),
                    }),
                    parametrosCalculo,
                );

                setForm({
                    numeroOP: digits,
                    numeroOT: datos.numeroOT || progExistente.numeroOT || '',
                    ordenCompra: datos.ordenCompra || progExistente.ordenCompra || '',
                    lineaTroquel: datos.lineaTroquel || progExistente.lineaTroquel || '',
                    referencia: datos.referencia || progExistente.referencia || '',
                    cliente: datos.cliente || progExistente.cliente || '',
                    metaTiros: datos.cantidadSolicitada
                        ? String(datos.cantidadSolicitada)
                        : String(progExistente.metaTiros || datos.metaTiros || ''),
                    precioUnitario: precioUnitarioDesdeTotal(progExistente.precio, progExistente.metaTiros),
                    estadoGeneral: progExistente.estadoGeneral || 'programado',
                    esUrgencia: !!progExistente.esUrgencia,
                    observaciones: progExistente.observaciones || '',
                    procesosSeleccionados: procesosMap,
                    calculo: calculoEdit,
                });
                setOpsDisponibles([]);
                setOpSearchQuery('');
                setFormModalTab('procesos');
                showAppAlert(
                    'OP ya programada',
                    'Se abrió en modo edición. Agregue o ajuste procesos y pulse Guardar (no se crea una programación nueva).'
                );
                return;
            }

            const procesosMap = { ...form.procesosSeleccionados };

            const calculoBase = buildCalculoFromDatosOp(datos, {
                cantidadSolicitada: datos.cantidadSolicitada
                    ? String(datos.cantidadSolicitada)
                    : (datos.metaTiros ? String(datos.metaTiros) : ''),
                maquinaCalculoId: null,
                maquinasCalculoExtraIds: [],
            });
            const manualesSugeridos = inferProcesosManualesDesdeSugeridos(datos.procesosSugeridos, procesoList);
            calculoBase.procesosManualesSeleccionados = mergeProcesosManualesSeleccionados(
                calculoBase,
                procesoList,
                manualesSugeridos,
            );
            const calculo = normalizeCalculoForm(calculoBase, parametrosCalculo);

            setForm((f) => ({
                ...f,
                numeroOP: digits,
                numeroOT: datos.numeroOT || f.numeroOT,
                ordenCompra: datos.ordenCompra || f.ordenCompra,
                lineaTroquel: datos.lineaTroquel || f.lineaTroquel,
                referencia: datos.referencia || f.referencia,
                cliente: datos.cliente || f.cliente,
                metaTiros: datos.cantidadSolicitada
                    ? String(datos.cantidadSolicitada)
                    : (datos.metaTiros ? String(datos.metaTiros) : f.metaTiros),
                procesosSeleccionados: procesosMap,
                calculo,
            }));
            setOpsDisponibles([]);
            setOpSearchQuery('');
            if (datos.mensaje) {
                showAppAlert('Aviso', datos.mensaje);
            }
        } catch (error) {
            showAppAlert('Error', getErrorMessage(error));
        } finally {
            setLoadingOpDatos(false);
        }
    };

    const handleSave = async () => {
        const isUrgency = !!form.esUrgencia && !editingId;
        setSaveError(null);

        if (!isUrgency && !form.numeroOP.trim()) {
            const msg = 'Ingrese el número de OP.';
            setSaveError(msg);
            showAppAlert('Campos incompletos', msg);
            return;
        }
        if (!isUrgency && !editingId && opDatos && !opDatos.listoParaProgramar) {
            const msg = opDatos.mensaje || 'La OP debe tener documento OP en Planeación.';
            setSaveError(msg);
            showAppAlert('Documentos requeridos', msg);
            return;
        }
        if (!isUrgency && !form.cliente?.trim()) {
            const msg = 'Indique el cliente.';
            setSaveError(msg);
            showAppAlert('Campos incompletos', msg);
            return;
        }
        if (!isUrgency) {
            const missDatos = getDatosPasoMissing(form);
            if (missDatos.length) {
                const msg = `Complete el paso Datos OP: faltan ${missDatos.join(', ')}.`;
                setSaveError(msg);
                showAppAlert('Campos incompletos', msg);
                setFormModalTab('datos');
                return;
            }
            const missCalc = getCalculoPasoMissing(form, parametrosCalculo, procesoList, opDatos?.procesosSugeridos || []);
            if (missCalc.length) {
                const msg = `Complete el paso Cálculo: faltan ${missCalc.join(', ')}.`;
                setSaveError(msg);
                showAppAlert('Campos incompletos', msg);
                setFormModalTab('calculo');
                return;
            }
        }
        if (!isUrgency && (!form.metaTiros || isNaN(parseInt(form.metaTiros, 10)))) {
            const msg = 'Ingrese las unidades (número válido).';
            setSaveError(msg);
            showAppAlert('Campos incompletos', msg);
            return;
        }

        let procesosActivos;
        try {
            procesosActivos = isUrgency
                ? buildUrgencyProcesosFromForm(form, procesoList)
                : buildProcesosActivosFromForm(form, procesoList);
        } catch (error) {
            setSaveError(error.message);
            showAppAlert('Validación', error.message);
            return;
        }

        if (!isUrgency && procesosActivos.length === 0) {
            const msg = 'Seleccione al menos un proceso.';
            setSaveError(msg);
            showAppAlert('Procesos', msg);
            return;
        }

        for (const p of procesosActivos) {
            if (!p.maquinaId) continue;
            const inicioMs = new Date(p.fechaInicio).getTime();
            const finMs = new Date(p.fechaFin).getTime();
            if (Number.isNaN(inicioMs) || Number.isNaN(finMs)) continue;
            const ocupadaPor = getOcupacionMaquina(p.maquinaId, inicioMs, finMs, editingId);
            if (ocupadaPor) {
                const msg = `${p.proceso}: la máquina ya está ocupada por la OP ${ocupadaPor} en ese horario. Elija otras horas o otra máquina.`;
                setSaveError(msg);
                showAppAlert('Máquina ocupada', msg);
                return;
            }
        }

        // Cobertura roster (informativa; sin avisos bloqueantes)
        try {
            const cobertura = await collectCoberturaRoster(procesosActivos);
            setCoberturaRoster(cobertura);
            setDisponibilidadAvisos([]);
        } catch {
            setDisponibilidadAvisos([]);
            setCoberturaRoster({});
        }

        const ordenMatch = form.numeroOP?.trim()
            ? ordenes.find((o) => o.numero === form.numeroOP.trim() || soloDigitos(o.numero) === soloDigitos(form.numeroOP))
            : null;

        const opNumber = form.numeroOP?.trim()
            ? (soloDigitos(form.numeroOP) || form.numeroOP.trim())
            : (isUrgency ? `URG-${Date.now().toString().slice(-8)}` : '');

        const payload = buildProgramacionPayload(
            buildProgramacionHeaderFromForm(form, {
                numeroOP: opNumber,
                ordenProduccionId: ordenMatch?.id || null,
                esUrgencia: isUrgency,
                color: isUrgency ? '#EF4444' : null,
                metaTiros: isUrgency && (!form.metaTiros || isNaN(parseInt(form.metaTiros, 10)))
                    ? 0
                    : parseInt(form.metaTiros, 10),
            }),
            procesosActivos,
            ordenes
        );

        setSaving(true);
        let savedAsUpdate = !!editingId;
        try {
            if (editingId) {
                await planeacionApi.actualizarProgramacionOP(editingId, payload);
            } else if (isUrgency) {
                const preview = urgencyPreview || (() => {
                    const draft = buildUrgencyDraftFromForm(form, procesoList, ordenes);
                    const shifted = computeUrgencyScheduleShift(programaciones, draft, procesoList);
                    return { draft, shifted };
                })();

                const ajustes = buildAjustesFromShift(preview.shifted, programaciones, procesoList);

                await planeacionApi.crearUrgenciaConAjustes(payload, ajustes);
            } else {
                // Si la OP ya existe, actualizar en lugar de POST (evita 400)
                let existingId = opDatos?.programacionId || opDatos?.ProgramacionId || null;
                let existingProg = existingId
                    ? (programaciones.find((p) => p.id === existingId) || null)
                    : programaciones.find((p) =>
                        !p.esUrgencia
                        && (soloDigitos(p.numeroOP) === soloDigitos(opNumber) || String(p.numeroOP).trim() === String(opNumber).trim())
                    ) || null;
                if (!existingId && existingProg) existingId = existingProg.id;

                if (existingId && !existingProg) {
                    try {
                        existingProg = await planeacionApi.getProgramacion(existingId);
                    } catch {
                        existingProg = null;
                    }
                }

                if (existingId) {
                    const mergedProcs = mergeProcesosActivosConExistente(procesosActivos, existingProg, procesoList);
                    const updatePayload = buildProgramacionPayload(
                        buildProgramacionHeaderFromForm(form, {
                            numeroOP: opNumber,
                            ordenProduccionId: ordenMatch?.id || null,
                            esUrgencia: false,
                        }),
                        mergedProcs,
                        ordenes
                    );
                    await planeacionApi.actualizarProgramacionOP(existingId, updatePayload);
                    setEditingId(existingId);
                    savedAsUpdate = true;
                } else {
                    await planeacionApi.crearProgramacionOP(payload);
                }
            }
            setShowModal(false);
            setUrgencyPreview(null);
            await loadData();
            showAppAlert(
                'Éxito',
                savedAsUpdate
                    ? 'Programación actualizada.'
                    : (isUrgency ? 'Urgencia programada y planificación ajustada.' : 'Programación guardada correctamente.')
            );
        } catch (error) {
            const msg = getErrorMessage(error);
            setSaveError(msg);
            if (error?.response?.status === 404) {
                setBackendUnavailable(true);
                showAppAlert('Backend desactualizado', 'Reinicie el backend (dotnet run) para habilitar guardar programaciones OP.');
            } else if (error.message && !error.response) {
                showAppAlert('Validación', error.message);
            } else {
                showAppAlert('Error al guardar', msg);
            }
        } finally {
            setSaving(false);
        }
    };

    const handlePreviewUrgency = () => {
        try {
            const draft = buildUrgencyDraftFromForm(form, procesoList, ordenes);
            const shifted = computeUrgencyScheduleShift(programaciones, draft, procesoList);
            setUrgencyPreview({ draft, shifted });
            setViewMode('gantt');
            setSelectedId('__urgency_preview__');
            setShowModal(false);
        } catch (error) {
            Alert.alert('Validación', error.message || 'No se pudo generar la vista previa.');
        }
    };

    const handleReopenUrgencyEdit = () => {
        setShowModal(true);
    };

    const handleCancelUrgencyFlow = () => {
        setUrgencyPreview(null);
        setShowModal(false);
        if (selectedId === '__urgency_preview__') {
            setSelectedId(programaciones[0]?.id ?? null);
        }
    };

    const handleClearUrgencyPreview = () => {
        setUrgencyPreview(null);
        if (selectedId === '__urgency_preview__') {
            setSelectedId(programaciones[0]?.id ?? null);
        }
    };

    const updateProcesoField = (proceso, field, value) => {
        if (urgencyPreview) setUrgencyPreview(null);
        setForm((f) => {
            let updated = { ...f.procesosSeleccionados[proceso], [field]: value };
            if (field === 'fechaInicio' || field === 'horaInicio') {
                updated.inicioManualLock = true;
            }
            if (field === 'repartoContinuacion') {
                updated.inicioManualLock = false;
            }
            if (procesoRequiereSinMaquina(proceso)) {
                updated.maquinaId = null;
            } else if (field === 'maquinaId' && value != null) {
                const allowed = maquinasParaProceso(proceso, maquinas);
                if (!allowed.some((m) => m.id === value)) {
                    updated.maquinaId = null;
                }
            }

            // Al activar un proceso, colocarlo justo después del anterior activo en la cadena
            if (field === 'activo' && value === true) {
                const idx = procesoList.indexOf(proceso);
                for (let i = idx - 1; i >= 0; i--) {
                    const prevName = procesoList[i];
                    const prev = f.procesosSeleccionados[prevName];
                    if (prev?.activo) {
                        updated.fechaInicio = prev.fechaFin || updated.fechaInicio;
                        updated.horaInicio = prev.horaFin ?? updated.horaInicio;
                        break;
                    }
                }
            }

            const shouldRecalcFin =
                field === 'fechaInicio'
                || field === 'horaInicio'
                || field === 'horasEstimadas'
                || field === 'maquinaId'
                || (field === 'activo' && value === true);

            if (shouldRecalcFin) {
                updated = applyFinAuto(updated);
            }

            // Si hay máquina, evitar solapes: mover inicio a la siguiente hora libre y recalcular fin
            if (updated.maquinaId && updated.fechaInicio && shouldRecalcFin) {
                let guard = 0;
                while (guard++ < 48) {
                    const blockedStart = getHorasInicioBloqueadas(updated.maquinaId, updated.fechaInicio, editingId);
                    if (blockedStart[updated.horaInicio]) {
                        const nextH = findNextFreeStartHour(
                            updated.maquinaId,
                            updated.fechaInicio,
                            (Number(updated.horaInicio) || 0) + 1,
                            editingId
                        );
                        if (nextH == null) break;
                        updated = applyFinAuto({ ...updated, horaInicio: nextH });
                        continue;
                    }
                    const inicioMs = new Date(buildDateTime(updated.fechaInicio, updated.horaInicio)).getTime();
                    const finMs = new Date(buildDateTime(updated.fechaFin, updated.horaFin)).getTime();
                    if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) break;
                    const conflicto = getOcupacionMaquina(updated.maquinaId, inicioMs, finMs, editingId);
                    if (!conflicto) break;
                    const nextH = findNextFreeStartHour(
                        updated.maquinaId,
                        updated.fechaInicio,
                        (Number(updated.horaInicio) || 0) + 1,
                        editingId
                    );
                    if (nextH == null) break;
                    updated = applyFinAuto({ ...updated, horaInicio: nextH });
                }
            }

            const nextForm = {
                ...f,
                procesosSeleccionados: {
                    ...f.procesosSeleccionados,
                    [proceso]: updated,
                },
            };
            if (procesoRequiereSinMaquina(proceso) && field === 'activo') {
                let calc = { ...(f.calculo || emptyCalculoForm()) };
                const sel = getProcesosManualesSeleccionados(calc, procesoList);
                const nextSel = value
                    ? (sel.includes(proceso) ? sel : [...sel, proceso])
                    : sel.filter((p) => p !== proceso);
                calc = { ...calc, procesosManualesSeleccionados: nextSel };
                const synced = { ...nextForm, calculo: calc };
                formRef.current = synced;
                return synced;
            }
            formRef.current = nextForm;
            return nextForm;
        });

        const warnFields = ['maquinaId', 'fechaInicio', 'horaInicio', 'fechaFin', 'horaFin', 'horasEstimadas', 'activo', 'tiemposAuxiliares', 'repartoContinuacion'];
        if (!warnFields.includes(field)) return;

        // El modo de reparto se maneja en setRepartoContinuacion (snapshot síncrono)
        if (field === 'repartoContinuacion') return;

        const alignSchedule = field === 'maquinaId'
            || field === 'horasEstimadas'
            || field === 'fechaInicio'
            || field === 'fechaFin'
            || field === 'activo'
            || field === 'tiemposAuxiliares';
        setTimeout(async () => {
            await refreshDisponibilidadUi(formRef.current, { alignSchedule });
        }, 0);
    };

    /** Cambia modo de reparto sin mover la fecha de inicio elegida. */
    const setRepartoContinuacion = (proceso, modo) => {
        if (urgencyPreview) setUrgencyPreview(null);
        const base = formRef.current || form;
        const prev = base.procesosSeleccionados?.[proceso] || {};
        const fechaInicioLocked = typeof prev.fechaInicio === 'string'
            ? prev.fechaInicio.slice(0, 10)
            : prev.fechaInicio;
        const updated = {
            ...prev,
            repartoContinuacion: modo,
            inicioManualLock: false,
            fechaInicio: fechaInicioLocked || prev.fechaInicio,
        };
        const nextForm = {
            ...base,
            procesosSeleccionados: {
                ...base.procesosSeleccionados,
                [proceso]: updated,
            },
        };
        formRef.current = nextForm;
        setForm(nextForm);
        refreshDisponibilidadUi(nextForm, { alignSchedule: true });
    };

    const updateCalculoField = (field, value) => {
        setForm((f) => {
            let calculo = { ...(f.calculo || emptyCalculoForm()) };
            if (calculo.multiPieza && field !== 'piezaActivaId') {
                calculo = snapshotCalculoPiezaActiva(calculo);
            }
            if (field === 'piezaActivaId') {
                calculo = switchCalculoPieza(calculo, value);
            } else if (field === 'maquinaCalculoId') {
                calculo = switchCalculoMaquina(calculo, value, parametrosCalculo);
            } else if (CALCULO_CAMPOS_PROCESO.includes(field)) {
                calculo = { ...calculo, [field]: value };
            } else if (CALCULO_CAMPOS_MAQUINA.includes(field)) {
                calculo = { ...calculo, [field]: value };
                if (calculo.maquinaCalculoId) {
                    calculo = snapshotCalculoMaquina(calculo, calculo.maquinaCalculoId);
                }
            } else {
                calculo = { ...calculo, [field]: value };
            }
            if (calculo.multiPieza && field !== 'piezaActivaId') {
                calculo = snapshotCalculoPiezaActiva(calculo);
            }
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calculo,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
    };

    const toggleUnionProceso = (procesoGantt) => {
        setForm((f) => {
            const calc = persistCalculoFormState(f.calculo || emptyCalculoForm());
            const uniones = (calc.uniones || []).map((u) => (
                u.procesoGantt === procesoGantt ? { ...u, activo: !u.activo } : u
            ));
            const calculo = { ...calc, uniones };
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calculo,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
    };

    const addMaquinaCalculoExtra = (maquinaId) => {
        if (!maquinaId) return;
        setForm((f) => {
            let calc = { ...(f.calculo || emptyCalculoForm()) };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            if (calc.maquinaCalculoId) {
                calc = snapshotCalculoMaquina(calc, calc.maquinaCalculoId);
            }
            let orden = getOrdenMaquinasCalculoIds(calc);
            if (!orden.includes(maquinaId)) orden = [...orden, maquinaId];
            if (!calc.maquinaCalculoId) {
                calc = switchCalculoMaquina(calc, maquinaId, parametrosCalculo);
            } else {
                calc.maquinasCalculoExtraIds = orden.filter((id) => id !== calc.maquinaCalculoId);
            }
            calc.ordenMaquinasCalculoIds = orden;
            calc = syncMaquinasCalculoOrden(calc);
            const lineasMap = buildLineasTirosMapFromOpDatos(opDatos, maquinas, parametrosCalculo);
            if (lineasMap.has(maquinaId)) {
                calc = applyLineasOpToCalculoMaquina(calc, maquinaId, lineasMap.get(maquinaId));
            }
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calc,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
        setAgregarMaquinaCalculoOpen(false);
    };

    const toggleProcesoManual = (procesoKey, add) => {
        if (!procesoKey) return;
        setForm((f) => {
            let calc = { ...(f.calculo || emptyCalculoForm()) };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            let sel = getProcesosManualesSeleccionados(calc, procesoList);
            if (add) {
                if (!sel.includes(procesoKey)) sel = [...sel, procesoKey];
            } else {
                sel = sel.filter((p) => p !== procesoKey);
            }
            calc = { ...calc, procesosManualesSeleccionados: sel };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calc,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
        if (!add) setAgregarProcesoManualOpen(false);
    };

    const removeMaquinaCalculo = (maquinaId) => {
        if (!maquinaId) return;
        setForm((f) => {
            let calc = { ...(f.calculo || emptyCalculoForm()) };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            if (calc.maquinaCalculoId) {
                calc = snapshotCalculoMaquina(calc, calc.maquinaCalculoId);
            }
            const porMaquina = { ...(calc.porMaquina || {}) };
            delete porMaquina[maquinaId];
            let orden = getOrdenMaquinasCalculoIds(calc).filter((id) => id !== maquinaId);

            if (calc.maquinaCalculoId === maquinaId) {
                const nextPrimary = orden[0] || null;
                calc = {
                    ...calc,
                    porMaquina,
                    ordenMaquinasCalculoIds: orden,
                    maquinasCalculoExtraIds: orden.filter((id) => id !== nextPrimary),
                    maquinaCalculoId: nextPrimary,
                };
                if (nextPrimary) {
                    calc = loadCalculoMaquina(calc, nextPrimary, parametrosCalculo);
                }
            } else {
                calc = {
                    ...calc,
                    porMaquina,
                    ordenMaquinasCalculoIds: orden,
                    maquinasCalculoExtraIds: orden.filter((id) => id !== calc.maquinaCalculoId),
                };
            }
            calc = syncMaquinasCalculoOrden(calc);
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calc,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
        setAgregarMaquinaCalculoOpen(false);
    };

    const updateLineaTirosField = (maquinaId, lineaId, field, value) => {
        setForm((f) => {
            let calc = { ...(f.calculo || emptyCalculoForm()) };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            if (calc.maquinaCalculoId) calc = snapshotCalculoMaquina(calc, calc.maquinaCalculoId);
            calc = updateLineasTirosInCalculo(calc, maquinaId, (lineas) =>
                lineas.map((l) => (l.id === lineaId ? { ...l, [field]: value } : l))
            );
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calc,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
    };

    const addLineaTirosMaquina = (maquinaId) => {
        setForm((f) => {
            let calc = { ...(f.calculo || emptyCalculoForm()) };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            if (calc.maquinaCalculoId) calc = snapshotCalculoMaquina(calc, calc.maquinaCalculoId);
            calc = updateLineasTirosInCalculo(calc, maquinaId, (lineas) => [
                ...lineas,
                emptyLineaTiros(`Línea ${lineas.length + 1}`),
            ]);
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calc,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
    };

    const removeLineaTirosMaquina = (maquinaId, lineaId) => {
        setForm((f) => {
            let calc = { ...(f.calculo || emptyCalculoForm()) };
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            if (calc.maquinaCalculoId) calc = snapshotCalculoMaquina(calc, calc.maquinaCalculoId);
            calc = updateLineasTirosInCalculo(calc, maquinaId, (lineas) => {
                const next = lineas.filter((l) => l.id !== lineaId);
                return next.length ? next : [emptyLineaTiros('Principal')];
            });
            if (calc.multiPieza) calc = snapshotCalculoPiezaActiva(calc);
            const synced = syncProcesosActivosDesdeMaquinasCalculo(
                f.procesosSeleccionados || {},
                calc,
                parametrosCalculo,
                procesoList,
                maquinas
            );
            return { ...f, calculo: synced.calculo, procesosSeleccionados: synced.procesos };
        });
    };

    const persistCalculoParams = async () => {
        const id = form.calculo?.maquinaCalculoId;
        if (!id) return;
        setSavingCalculoParams(true);
        try {
            const updated = await planeacionApi.upsertParametrosCalculoMaquina(
                id,
                parseNumFlexible(form.calculo.alistamiento),
                parseNumFlexible(form.calculo.lavada),
            );
            setParametrosCalculo((prev) => prev.map((p) => (p.maquinaId === id ? { ...p, ...updated } : p)));
            Alert.alert('Guardado', 'Alistamiento y lavada actualizados para esta máquina.');
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSavingCalculoParams(false);
        }
    };

    const addTiempoAuxiliar = (proceso) => {
        const proc = form.procesosSeleccionados[proceso];
        updateProcesoField(proceso, 'tiemposAuxiliares', [
            ...(proc.tiemposAuxiliares || []),
            { id: `${Date.now()}`, descripcion: '', horas: '' },
        ]);
    };

    const updateTiempoAuxiliar = (proceso, auxId, field, value) => {
        const proc = form.procesosSeleccionados[proceso];
        updateProcesoField(proceso, 'tiemposAuxiliares', proc.tiemposAuxiliares.map((t) =>
            t.id === auxId ? { ...t, [field]: value } : t
        ));
    };

    const removeTiempoAuxiliar = (proceso, auxId) => {
        const proc = form.procesosSeleccionados[proceso];
        updateProcesoField(proceso, 'tiemposAuxiliares', proc.tiemposAuxiliares.filter((t) => t.id !== auxId));
    };

    const handleDelete = (id) => {
        const performDelete = async () => {
            try {
                await planeacionApi.eliminarProgramacionOP(id);
                if (selectedId === id) setSelectedId(null);
                setShowModal(false);
                setShowDayDetail(false);
                await loadData();
            } catch (e) {
                Alert.alert('Error', 'No se pudo eliminar la programación.');
            }
        };

        if (Platform.OS === 'web' && window.confirm) {
            if (window.confirm('¿Eliminar esta programación de OP?')) performDelete();
        } else {
            Alert.alert('Eliminar', '¿Eliminar esta programación de OP?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: performDelete },
            ]);
        }
    };

    const getWeekForDay = (dayIdx) => weekGroups.find((w) => dayIdx >= w.startIdx && dayIdx <= w.endIdx);

    const getTimelineMsPerPixel = useCallback((trackW) => {
        const totalMs = ganttZoom === 'day'
            ? HOURS_PER_DAY * 3600000
            : displayDates.length * HOURS_PER_DAY * 3600000;
        return totalMs / Math.max(trackW, 1);
    }, [ganttZoom, displayDates.length]);

    const persistDragChanges = useCallback(async (prog, procesosCascaded) => {
        setSavingDrag(true);
        try {
            const payload = buildProgramacionPayload(prog, procesosCascaded, ordenes);

            if (prog.tipoActividad && prog.tipoActividad !== 'op') {
                // Actividad auxiliar: se corre lo que se solape con la nueva posición.
                const otras = programaciones.filter((p) => p.id !== prog.id);
                const draft = { procesos: payload.procesos };
                const shifted = computeUrgencyScheduleShift(otras, draft, procesoListRef.current);
                const ajustes = buildAjustesFromShift(shifted, otras, procesoListRef.current);
                await planeacionApi.actualizarActividadAuxiliar(prog.id, payload, ajustes);
                await loadData();
                return;
            }

            await planeacionApi.actualizarProgramacionOP(prog.id, payload);
            setProgramaciones((prev) => prev.map((p) => {
                if (p.id !== prog.id) return p;
                const procesos = procesosCascaded.map((pr) => {
                    const existing = p.procesos.find((ep) => ep.proceso === pr.proceso);
                    if (existing) {
                        return {
                            ...existing,
                            fechaInicio: pr.fechaInicio,
                            fechaFin: pr.fechaFin,
                            horasEstimadas: pr.horasEstimadas ?? existing.horasEstimadas,
                        };
                    }
                    return {
                        id: `new-${pr.proceso}-${Date.now()}`,
                        proceso: pr.proceso,
                        fechaInicio: pr.fechaInicio,
                        fechaFin: pr.fechaFin,
                        horasEstimadas: pr.horasEstimadas,
                        tiemposAuxiliares: pr.tiemposAuxiliares || [],
                        estado: 'pendiente',
                    };
                });
                return { ...p, procesos };
            }));
        } catch (error) {
            Alert.alert('Error al guardar', getErrorMessage(error));
            await loadData();
        } finally {
            setSavingDrag(false);
        }
    }, [ordenes, loadData, programaciones]);

    const saveProcesosForProg = useCallback(async (prog, procesosList) => {
        const normalized = enforceProcessChain(procesosList);
        await persistDragChanges(prog, normalized);
    }, [persistDragChanges]);

    const openEditActivity = useCallback((prog, procesoProc) => {
        setContextMenu(null);
        setActivityModalMode('edit');
        setActivityValidation(null);
        setActivityCobertura(null);
        const ini = parseLocalDateParts(procesoProc.fechaInicio);
        const fin = parseLocalDateParts(procesoProc.fechaFin);
        setActivityForm({
            progId: prog.id,
            proceso: procesoProc.proceso,
            maquinaId: procesoProc.maquinaId ?? null,
            maquinaNombre: procesoProc.maquinaNombre || resolveMaquinaNombre(procesoProc, maquinas),
            fechaInicio: ini.fecha,
            horaInicio: ini.hora,
            fechaFin: fin.fecha,
            horaFin: fin.hora,
            horasEstimadas: String(procesoProc.horasEstimadas ?? '8'),
            tiemposAuxiliares: procesoProc.tiemposAuxiliares || [],
        });
        setShowActivityModal(true);
    }, [maquinas]);

    const openAddActivity = useCallback((prog, procesoName) => {
        setShowAddActivityPicker(false);
        setContextMenu(null);
        const { start, end } = getDefaultStartAfterChain(prog, procesoName, procesoListRef.current);
        setActivityModalMode('add');
        setActivityForm({
            progId: prog.id,
            proceso: procesoName,
            fechaInicio: formatDateKey(start),
            horaInicio: start.getHours(),
            fechaFin: formatDateKey(end),
            horaFin: end.getHours(),
            horasEstimadas: '8',
        });
        setShowActivityModal(true);
    }, []);

    const confirmDeleteActivity = useCallback((prog, procesoName) => {
        const doDelete = async () => {
            const ordered = getActiveOrderedProcesos(prog, procesoListRef.current)
                .filter((p) => String(p.proceso || '').trim().toLowerCase() !== String(procesoName || '').trim().toLowerCase());

            // Si es la última actividad, eliminar toda la programación (no hay OP sin procesos).
            if (ordered.length === 0) {
                const msgUltima =
                    `"${procesoName}" es la única actividad de la OP ${prog.numeroOP}.\n\n¿Eliminar toda la programación de esta OP?`;
                let ok = true;
                if (Platform.OS === 'web' && window.confirm) {
                    ok = window.confirm(msgUltima);
                } else {
                    // En nativo ya confirmó el primer diálogo; aquí se vuelve a pedir confirmación explícita vía Alert
                    ok = await new Promise((resolve) => {
                        Alert.alert('Última actividad', msgUltima, [
                            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                            { text: 'Eliminar OP', style: 'destructive', onPress: () => resolve(true) },
                        ]);
                    });
                }
                if (!ok) return;

                setSavingActivity(true);
                try {
                    await planeacionApi.eliminarProgramacionOP(prog.id);
                    if (selectedId === prog.id) setSelectedId(null);
                    await loadData();
                } catch (error) {
                    Alert.alert('Error', getErrorMessage(error) || 'No se pudo eliminar la OP.');
                } finally {
                    setSavingActivity(false);
                }
                return;
            }

            setSavingActivity(true);
            try {
                await saveProcesosForProg(prog, ordered);
            } catch (error) {
                Alert.alert('Error', getErrorMessage(error) || 'No se pudo eliminar la actividad.');
            } finally {
                setSavingActivity(false);
            }
        };

        const msg = `¿Eliminar la actividad "${procesoName}" de la OP ${prog.numeroOP}?`;
        if (Platform.OS === 'web' && window.confirm) {
            if (window.confirm(msg)) doDelete();
        } else {
            Alert.alert('Eliminar actividad', msg, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: doDelete },
            ]);
        }
    }, [saveProcesosForProg, loadData, selectedId]);

    const validateActivityFormFields = useCallback((form, progId) => {
        if (!form) return null;
        const inicio = buildDateTime(form.fechaInicio, form.horaInicio);
        const fin = buildDateTime(form.fechaFin, form.horaFin);
        if (new Date(inicio) >= new Date(fin)) {
            return 'La hora de fin debe ser posterior al inicio.';
        }
        if (form.maquinaId) {
            const blocked = getHorasInicioBloqueadas(form.maquinaId, form.fechaInicio, progId);
            if (blocked[form.horaInicio]) {
                return `Inicio bloqueado: ${blocked[form.horaInicio]}`;
            }
            const inicioMs = new Date(inicio).getTime();
            const finMs = new Date(fin).getTime();
            const ocupada = getOcupacionMaquina(form.maquinaId, inicioMs, finMs, progId);
            if (ocupada) return `Máquina ocupada por OP ${ocupada} en ese horario.`;
        }
        return null;
    }, [getHorasInicioBloqueadas, getOcupacionMaquina]);

    useEffect(() => {
        if (!showActivityModal || !activityForm) {
            setActivityCobertura(null);
            setActivityValidation(null);
            return undefined;
        }
        setActivityValidation(validateActivityFormFields(activityForm, activityForm.progId));
        let cancelled = false;
        (async () => {
            if (!activityForm.maquinaId || !activityForm.fechaInicio) {
                setActivityCobertura(null);
                return;
            }
            try {
                const inicio = buildDateTime(activityForm.fechaInicio, activityForm.horaInicio);
                const fin = buildDateTime(activityForm.fechaFin, activityForm.horaFin);
                const res = await planeacionApi.getCoberturaDisponibilidad(
                    activityForm.maquinaId,
                    inicio,
                    fin
                );
                if (!cancelled) setActivityCobertura(res || null);
            } catch {
                if (!cancelled) setActivityCobertura(null);
            }
        })();
        return () => { cancelled = true; };
    }, [showActivityModal, activityForm, validateActivityFormFields]);

    const handleSaveActivity = async () => {
        if (!activityForm) return;
        const prog = programaciones.find((p) => p.id === activityForm.progId);
        if (!prog) return;

        const validationErr = validateActivityFormFields(activityForm, activityForm.progId);
        if (validationErr) {
            Alert.alert('No se puede guardar', validationErr);
            return;
        }

        const inicio = buildDateTime(activityForm.fechaInicio, activityForm.horaInicio);
        const fin = buildDateTime(activityForm.fechaFin, activityForm.horaFin);

        const newProc = {
            proceso: activityForm.proceso,
            fechaInicio: inicio,
            fechaFin: fin,
            horasEstimadas: activityForm.horasEstimadas ? parseFloat(activityForm.horasEstimadas) : null,
            maquinaId: activityForm.maquinaId ?? null,
            tiemposAuxiliares: (activityForm.tiemposAuxiliares || []).map((t) => ({
                descripcion: t.descripcion,
                horas: parseNumFlexible(t.horas),
            })),
        };

        let ordered = getActiveOrderedProcesos(prog, procesoListRef.current);
        if (activityModalMode === 'add') {
            ordered = [...ordered, newProc].sort(
                (a, b) => sortByProcesoOrder(a, b, procesoListRef.current)
            );
        } else {
            ordered = ordered.map((p) => (p.proceso === activityForm.proceso ? { ...p, ...newProc } : p));
        }

        const cascaded = cascadeProcessChain(
            ordered,
            activityForm.proceso,
            new Date(newProc.fechaInicio).getTime(),
            new Date(newProc.fechaFin).getTime()
        );

        setSavingActivity(true);
        try {
            await saveProcesosForProg(prog, cascaded);
            setShowActivityModal(false);
            setActivityForm(null);
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSavingActivity(false);
        }
    };

    const showActivityMenu = useCallback((prog, procesoProc, x, y) => {
        setContextMenu({ prog, procesoProc, x: Math.min(x, windowWidth - 200), y: Math.min(y, windowHeight - 160) });
    }, [windowWidth, windowHeight]);

    // ==================== ACTIVIDADES AUXILIARES (drag & drop) ====================

    /** Fila de proceso + instante de tiempo bajo el cursor (coordenadas de viewport). */
    const getAuxDropTarget = useCallback((clientX, clientY) => {
        for (const proceso of procesoListRef.current) {
            const node = rowDomRefs.current[proceso];
            const rect = node?.getBoundingClientRect?.();
            if (!rect || rect.width <= 0) continue;
            if (clientY < rect.top || clientY > rect.bottom || clientX < rect.left || clientX > rect.right) continue;
            const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            let baseMs;
            let totalMs;
            if (ganttZoom === 'day' && focusedDay) {
                const d = new Date(focusedDay);
                d.setHours(0, 0, 0, 0);
                baseMs = d.getTime();
                totalMs = HOURS_PER_DAY * 3600000;
            } else {
                const d = new Date(displayDates[0]);
                d.setHours(0, 0, 0, 0);
                baseMs = d.getTime();
                totalMs = displayDates.length * HOURS_PER_DAY * 3600000;
            }
            return { proceso, startMs: snapMs(baseMs + frac * totalMs) };
        }
        return null;
    }, [ganttZoom, focusedDay, displayDates]);

    const getAuxDropTargetRef = useRef(getAuxDropTarget);
    useEffect(() => { getAuxDropTargetRef.current = getAuxDropTarget; }, [getAuxDropTarget]);

    /** Crea la actividad auxiliar en el destino y corre las OP que se solapan. */
    const dropAuxActivity = useCallback(async (aux, target) => {
        const startMs = target.startMs;
        const endMs = startMs + aux.horas * 3600000;
        const fechaInicio = toLocalIso(startMs);
        const fechaFin = toLocalIso(endMs);

        const draft = { procesos: [{ proceso: target.proceso, fechaInicio, fechaFin }] };
        const shifted = computeUrgencyScheduleShift(programaciones, draft, procesoListRef.current);
        const ajustes = buildAjustesFromShift(shifted, programaciones, procesoListRef.current);

        const actividad = {
            numeroOP: aux.label.toUpperCase(),
            ordenProduccionId: null,
            numeroOT: '',
            lineaTroquel: '',
            referencia: '',
            cliente: aux.label,
            metaTiros: 0,
            color: aux.color,
            estadoGeneral: 'programado',
            esUrgencia: false,
            tipoActividad: aux.tipo,
            observaciones: '',
            procesos: [{
                proceso: target.proceso,
                fechaInicio,
                fechaFin,
                horasEstimadas: aux.horas,
                tiemposAuxiliares: [],
            }],
        };

        setSavingAux(true);
        try {
            await planeacionApi.crearActividadAuxiliar(actividad, ajustes);
            await loadData();
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSavingAux(false);
        }
    }, [programaciones, loadData]);

    const startAuxDrag = useCallback((aux, e) => {
        if (Platform.OS !== 'web' || savingAux) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        const native = e.nativeEvent || e;
        const startX = native.clientX ?? 0;
        const startY = native.clientY ?? 0;

        auxDragRef.current = { aux, target: null };
        setAuxDrag({ ...aux, x: startX, y: startY, target: null });

        const onMove = (ev) => {
            const target = getAuxDropTargetRef.current(ev.clientX, ev.clientY);
            auxDragRef.current = { aux, target };
            setAuxDrag({ ...aux, x: ev.clientX, y: ev.clientY, target });
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            const session = auxDragRef.current;
            auxDragRef.current = null;
            setAuxDrag(null);
            if (session?.target) {
                // Antes de guardar, permitir ajustar fecha/hora/duración.
                const d = new Date(session.target.startMs);
                setAuxConfirm({
                    aux: session.aux,
                    proceso: session.target.proceso,
                    fecha: formatDateKey(d),
                    hora: d.getHours(),
                    minutos: d.getMinutes() >= 30 ? 30 : 0,
                    duracion: String(session.aux.horas),
                });
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [savingAux]);

    const handleConfirmAuxDrop = async () => {
        if (!auxConfirm) return;
        const dur = parseFloat(String(auxConfirm.duracion).replace(',', '.'));
        if (!dur || isNaN(dur) || dur <= 0) {
            Alert.alert('Duración inválida', 'Ingrese la duración en horas (mayor a 0).');
            return;
        }
        const start = new Date(
            `${auxConfirm.fecha}T${String(auxConfirm.hora).padStart(2, '0')}:${String(auxConfirm.minutos).padStart(2, '0')}:00`
        );
        if (isNaN(start.getTime())) {
            Alert.alert('Fecha inválida', 'Use el formato YYYY-MM-DD.');
            return;
        }
        const target = { proceso: auxConfirm.proceso, startMs: start.getTime() };
        const aux = { ...auxConfirm.aux, horas: dur };
        setAuxConfirm(null);
        await dropAuxActivity(aux, target);
    };

    const applyDragDelta = useCallback((clientX) => {
        const session = dragSessionRef.current;
        if (!session) return;

        const deltaPx = clientX - session.startX;
        if (Math.abs(deltaPx) > 4) didDragRef.current = true;

        const deltaMs = snapMs(deltaPx * session.msPerPixel);
        const ordered = getActiveOrderedProcesos(session.prog, procesoListRef.current);
        const target = ordered.find((p) => p.proceso === session.procesoNombre);
        if (!target) return;

        let newStartMs = session.origStartMs;
        let newEndMs = session.origEndMs;

        if (session.mode === 'move') {
            newStartMs = session.origStartMs + deltaMs;
            newEndMs = session.origEndMs + deltaMs;
        } else if (session.mode === 'resize-start') {
            newStartMs = Math.min(session.origEndMs - MIN_PROCESS_MS, session.origStartMs + deltaMs);
        } else if (session.mode === 'resize-end') {
            newEndMs = Math.max(session.origStartMs + MIN_PROCESS_MS, session.origEndMs + deltaMs);
        }

        const cascaded = cascadeProcessChain(ordered, session.procesoNombre, newStartMs, newEndMs);
        dragPreviewRef.current = { progId: session.prog.id, procesos: cascaded };
        setDragPreview(dragPreviewRef.current);
    }, []);

    const handleBarMouseDown = useCallback((e, prog, procesoProc, segment, trackW) => {
        if (Platform.OS !== 'web' || savingDrag || prog.isPreview) return;
        e.preventDefault?.();
        e.stopPropagation?.();

        const native = e.nativeEvent || e;
        const clientX = native.clientX ?? native.pageX;
        const rect = e.currentTarget?.getBoundingClientRect?.();
        const offsetX = rect ? clientX - rect.left : 0;
        const barWidth = rect?.width ?? 0;

        let mode = 'move';
        // Solo activar resize si la barra es lo bastante ancha; en barras pequeñas siempre mover.
        if (barWidth >= DRAG_HANDLE_PX * 3) {
            if (!segment.continuesFromPrev && offsetX < DRAG_HANDLE_PX) mode = 'resize-start';
            else if (!segment.continuesToNext && offsetX > barWidth - DRAG_HANDLE_PX) mode = 'resize-end';
        }

        didDragRef.current = false;
        dragSessionRef.current = {
            prog,
            procesoNombre: procesoProc.proceso,
            mode,
            startX: clientX,
            origStartMs: new Date(procesoProc.fechaInicio).getTime(),
            origEndMs: new Date(procesoProc.fechaFin).getTime(),
            msPerPixel: getTimelineMsPerPixel(trackW),
        };
        setSelectedId(prog.id);
    }, [getTimelineMsPerPixel, savingDrag]);

    useEffect(() => {
        if (Platform.OS !== 'web') return undefined;

        const onMove = (e) => applyDragDelta(e.clientX);
        const onUp = async () => {
            const session = dragSessionRef.current;
            const preview = dragPreviewRef.current;
            dragSessionRef.current = null;

            if (session && preview && didDragRef.current) {
                await persistDragChanges(session.prog, preview.procesos);
            }
            dragPreviewRef.current = null;
            setDragPreview(null);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [applyDragDelta, persistDragChanges]);

    const renderSegmentBar = (proceso, { prog, proceso: p }, segment, lane, unitWidth, trackW) => {
        const liveTelemetry = findLiveTelemetry(prog, p, telemetriaIndex);
        const tirosActuales = findTirosForBar(prog, p, tirosTelemetriaIndex, liveTelemetry);
        const liveCfg = liveTelemetry ? (ACTIVIDAD_TELEMETRIA[liveTelemetry.actividadCodigo] || null) : null;
        const isLive = !!liveTelemetry;
        const isSelected = selectedProgramacion?.id === prog.id;
        const isDragging = dragPreview?.progId === prog.id;
        const left = segment.leftFrac * unitWidth;
        const width = Math.max(segment.continuesFromPrev || segment.continuesToNext ? 4 : 22, segment.widthFrac * unitWidth);
        const laneTop = 4 + lane * (CHIP_HEIGHT + 2);
        const color = prog.color || '#3B82F6';
        const isPreviewBar = !!prog.isPreview;
        const canResizeStart = !segment.continuesFromPrev && !isPreviewBar;
        const canResizeEnd = !segment.continuesToNext && !isPreviewBar;
        const barSegments = buildPlannedBarSegments(prog, p);
        const tooltip = buildGanttBarTooltip(prog, p, maquinas, liveTelemetry, liveNow, tirosActuales);
        const labelText = buildGanttBarLabel(prog, p, segment, width, maquinas, liveTelemetry, liveNow, tirosActuales);
        const labelFontSize = width >= 56 ? 8 : (width >= 34 ? 7 : 6);
        const liveBorderColor = isLive ? (liveCfg?.color || '#FACC15') : (isSelected ? '#FACC15' : color);

        const webDragProps = isPreviewBar ? {} : (Platform.OS === 'web' ? {
            onMouseDown: (e) => handleBarMouseDown(e, prog, p, segment, trackW || unitWidth),
            onMouseEnter: (e) => {
                e.stopPropagation?.();
                updateGanttTooltip(e, tooltip);
            },
            onMouseMove: (e) => {
                e.stopPropagation?.();
                updateGanttTooltip(e, tooltip);
            },
            onMouseLeave: (e) => {
                e.stopPropagation?.();
                clearGanttTooltip();
            },
            onClick: (e) => {
                e.stopPropagation?.();
                if (!didDragRef.current) setSelectedId(prog.id);
            },
            onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                showActivityMenu(prog, p, e.clientX, e.clientY);
            },
        } : {
            onLongPress: () => {
                Alert.alert(`Actividad: ${p.proceso}`, tooltip.replace(/\n/g, '\n\n'), [
                    { text: 'Editar', onPress: () => openEditActivity(prog, p) },
                    { text: 'Eliminar', style: 'destructive', onPress: () => confirmDeleteActivity(prog, p.proceso) },
                    { text: 'Cancelar', style: 'cancel' },
                ]);
            },
        });

        return (
            <View
                key={`${prog.id}-${p.id}-${segment.leftFrac}-${isDragging ? 'd' : 's'}`}
                style={[
                    styles.opBar,
                    {
                        left,
                        width,
                        top: laneTop,
                        backgroundColor: isPreviewBar ? (color + '22') : 'transparent',
                        borderColor: liveBorderColor,
                        borderTopLeftRadius: segment.continuesFromPrev ? 0 : 4,
                        borderBottomLeftRadius: segment.continuesFromPrev ? 0 : 4,
                        borderTopRightRadius: segment.continuesToNext ? 0 : 4,
                        borderBottomRightRadius: segment.continuesToNext ? 0 : 4,
                        borderLeftWidth: segment.continuesFromPrev ? 0 : (isLive ? 2 : 1),
                        borderRightWidth: segment.continuesToNext ? 0 : (isLive ? 2 : 1),
                        opacity: isDragging ? 0.92 : (isPreviewBar ? 0.95 : 1),
                        zIndex: isDragging ? 10 : (isPreviewBar ? 12 : (isLive ? 5 : 3)),
                        borderStyle: isPreviewBar ? 'dashed' : 'solid',
                        borderWidth: isPreviewBar ? 2 : 1,
                        overflow: 'hidden',
                        ...(Platform.OS === 'web' ? { cursor: isPreviewBar ? 'default' : 'grab' } : {}),
                    },
                ]}
                {...webDragProps}
            >
                {!isPreviewBar && barSegments.map((seg, idx) => (
                    <View
                        key={`${prog.id}-${p.id}-seg-${seg.kind}-${idx}`}
                        style={{
                            position: 'absolute',
                            left: seg.leftFrac * width,
                            width: Math.max(1, seg.widthFrac * width),
                            top: 0,
                            bottom: 0,
                            backgroundColor: seg.color + (isSelected ? 'FF' : 'DD'),
                            opacity: seg.kind === 'prod' && isLive ? 0.92 : 1,
                        }}
                    />
                ))}
                {isPreviewBar && (
                    <View style={{
                        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                        backgroundColor: color + '33',
                    }} />
                )}
                {canResizeStart && width > 16 && (
                    <View style={[styles.opBarHandle, styles.opBarHandleLeft]} />
                )}
                {canResizeEnd && width > 16 && (
                    <View style={[styles.opBarHandle, styles.opBarHandleRight]} />
                )}
                <Text
                    style={[styles.opChipText, { fontSize: labelFontSize, zIndex: 2 }]}
                    numberOfLines={width >= 90 ? 2 : 1}
                >
                    {labelText}
                </Text>
                {isLive && !segment.continuesFromPrev && (
                    <View style={[styles.chipPulse, liveCfg?.color ? { backgroundColor: liveCfg.color } : null]} />
                )}
                {isLive && liveCfg && width >= 40 && (
                    <View style={[styles.liveBarStripe, { backgroundColor: liveCfg.color }]} />
                )}
            </View>
        );
    };

    const renderDayCell = (proceso, dayIdx) => {
        const dayDate = displayDates[dayIdx];
        const items = getDayItems(proceso, dayIdx);
        const week = getWeekForDay(dayIdx);
        const palette = week?.palette || WEEK_PALETTE[0];
        const isToday = dayDate.toDateString() === new Date().toDateString();
        const dayKey = toDateKeyLocal(dayDate);
        const entregasDia = entregasPorDiaKey.get(dayKey) || [];
        const lanes = processLanes[proceso] || {};
        const hiddenCount = Math.max(0, items.length - MAX_VISIBLE_CHIPS);

        return (
            <TouchableOpacity
                key={dayIdx}
                style={[
                    styles.daySlot,
                    {
                        width: columnWidth,
                        height: rowHeights[proceso],
                        backgroundColor: isToday ? palette.header + '33' : palette.bg,
                        borderRightColor: palette.border + '55',
                        overflow: 'visible',
                    },
                ]}
                onPress={() => {
                    if (items.length > 1) {
                        openDayDetailModal(proceso, dayDate, items);
                    } else if (items.length === 1) {
                        setSelectedId(items[0].prog.id);
                    } else if (ganttZoom !== 'day') {
                        zoomToDay(dayDate);
                    }
                }}
                onLongPress={() => {
                    if (items.length > 0) {
                        openDayDetailModal(proceso, dayDate, items);
                        return;
                    }
                    if (selectedProgramacion && !selectedProgramacion.procesos.some((pr) => pr.proceso === proceso)) {
                        openAddActivity(selectedProgramacion, proceso);
                    }
                }}
            >
                {entregasDia.length > 0 ? (
                    <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: '#EF4444',
                        zIndex: 3,
                    }}
                    />
                ) : null}
                {entregasDia.length > 0 && rowHeights[proceso] > 28 ? (
                    <View style={{
                        position: 'absolute',
                        top: 4,
                        right: 2,
                        zIndex: 4,
                        backgroundColor: '#EF444422',
                        borderRadius: 4,
                        paddingHorizontal: 3,
                        paddingVertical: 1,
                    }}
                    >
                        <Text style={{ color: '#FCA5A5', fontSize: 8, fontWeight: '700' }}>📦</Text>
                    </View>
                ) : null}
                {items.slice(0, MAX_VISIBLE_CHIPS).map((item) => {
                    const segment = getProcessDaySegment(item.proceso.fechaInicio, item.proceso.fechaFin, dayDate);
                    if (!segment) return null;
                    const lane = lanes[item.prog.id] ?? 0;
                    // En mes/semana: barra a ancho completo del día (legible); en día: posición horaria real
                    const visualSegment = ganttZoom === 'day' ? segment : {
                        leftFrac: 0,
                        widthFrac: 1,
                        continuesFromPrev: segment.continuesFromPrev,
                        continuesToNext: segment.continuesToNext,
                    };
                    return renderSegmentBar(proceso, item, visualSegment, lane, columnWidth, columnWidth * displayDates.length);
                })}
                {hiddenCount > 0 && (
                    <View style={[styles.moreChip, { top: 4 + MAX_VISIBLE_CHIPS * (CHIP_HEIGHT + 2) }]}>
                        <Text style={styles.moreChipText}>+{hiddenCount}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderDayHourTrack = (proceso) => {
        const items = focusedDay ? getDayItems(proceso, 0) : [];
        const lanes = processLanes[proceso] || {};
        const trackW = Math.max(trackWidth, timelineAvail);
        const dayUnitWidth = trackW;
        const hiddenCount = Math.max(0, items.length - MAX_VISIBLE_CHIPS);
        const now = new Date();
        const isToday = focusedDay?.toDateString() === now.toDateString();
        const nowHourFrac = isToday ? toHourFrac(now) / HOURS_PER_DAY : null;

        return (
            <View style={[styles.dayHourTrack, { width: trackW, height: rowHeights[proceso] }]}>
                <View style={styles.hourGridRow}>
                    {HOUR_SLOTS.map((h) => {
                        const isNow = isToday && now.getHours() === h;
                        return (
                            <TouchableOpacity
                                key={h}
                                style={[
                                    styles.hourGridCell,
                                    {
                                        width: columnWidth,
                                        height: rowHeights[proceso],
                                        backgroundColor: isNow ? '#FACC1522' : (isDarkMode ? '#1E293B11' : '#F1F5F9'),
                                        borderRightColor: colors.border,
                                    },
                                ]}
                                onPress={() => {
                                    const hourItems = getHourItems(proceso, h);
                                    if (hourItems.length > 1 && focusedDay) {
                                        openDayDetailModal(proceso, focusedDay, hourItems);
                                    } else if (hourItems.length === 1) {
                                        setSelectedId(hourItems[0].prog.id);
                                    }
                                }}
                                onLongPress={() => {
                                    const hourItems = getHourItems(proceso, h);
                                    if (hourItems.length > 0 && focusedDay) {
                                        openDayDetailModal(proceso, focusedDay, hourItems);
                                        return;
                                    }
                                    if (selectedProgramacion && !selectedProgramacion.procesos.some((pr) => pr.proceso === proceso)) {
                                        openAddActivity(selectedProgramacion, proceso);
                                    }
                                }}
                            />
                        );
                    })}
                </View>
                {isToday && nowHourFrac != null && (
                    <View
                        style={[
                            styles.nowMarker,
                            { left: nowHourFrac * dayUnitWidth },
                        ]}
                    />
                )}
                {items.slice(0, MAX_VISIBLE_CHIPS).map((item) => {
                    const segment = getProcessDaySegment(item.proceso.fechaInicio, item.proceso.fechaFin, focusedDay);
                    if (!segment) return null;
                    const lane = lanes[item.prog.id] ?? 0;
                    return renderSegmentBar(proceso, item, segment, lane, dayUnitWidth, dayUnitWidth);
                })}
                {hiddenCount > 0 && (
                    <View style={[styles.moreChip, { top: 4 + MAX_VISIBLE_CHIPS * (CHIP_HEIGHT + 2), right: 4 }]}>
                        <Text style={styles.moreChipText}>+{hiddenCount}</Text>
                    </View>
                )}
            </View>
        );
    };

    const headerBg = isDarkMode ? '#1E293B' : '#475569';
    const billingRowH = ganttZoom === 'range' && weeklyBilling.length > 0 ? 98 : 0;
    const headerHeight = ganttZoom === 'day' ? 64 : 76;
    const ganttBodyMaxH = Math.max(280, windowHeight - (detailExpanded ? 220 : 120) - 160 - billingRowH);

    const renderTimelineHeader = () => (
        <View style={{ width: trackWidth }}>
            {ganttZoom === 'range' && (
                <View style={styles.monthRow}>
                    {monthGroups.map((g) => (
                        <View
                            key={g.key}
                            style={[styles.monthCell, { width: g.count * columnWidth, backgroundColor: headerBg }]}
                        >
                            <Text style={styles.monthText}>{g.label} {g.year}</Text>
                        </View>
                    ))}
                </View>
            )}
            {ganttZoom === 'day' && focusedDay ? (
                <View style={[styles.weekCell, { width: trackWidth, backgroundColor: '#4F46E5', height: 34 }]}>
                    <Text style={styles.weekText}>
                        {focusedDay.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                    <Text style={styles.weekSubText}>Vista por hora</Text>
                </View>
            ) : (
                <View style={styles.weekRow}>
                    {weekGroups.map((w) => (
                        <TouchableOpacity
                            key={w.key}
                            style={[styles.weekCell, { width: w.count * columnWidth, backgroundColor: w.palette.header }]}
                            onPress={() => { if (ganttZoom === 'range') zoomToWeek(w); }}
                            disabled={ganttZoom !== 'range'}
                        >
                            <Text style={styles.weekText}>{w.palette.label}</Text>
                            <Text style={styles.weekSubText}>{w.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            {ganttZoom === 'day' ? (
                <View style={styles.dayRow}>
                    {HOUR_SLOTS.map((h) => {
                        const isNow = focusedDay?.toDateString() === new Date().toDateString() && new Date().getHours() === h;
                        const showLabel = columnWidth >= 40 || h % 3 === 0;
                        return (
                            <View
                                key={h}
                                style={[styles.dayCell, { width: columnWidth, backgroundColor: isNow ? '#FACC15' : '#4F46E5', borderRightColor: '#6366F1' }]}
                            >
                                <Text style={[styles.dayNameText, isNow && { color: '#1E293B' }]}>
                                    {showLabel ? String(h).padStart(2, '0') : '·'}
                                </Text>
                                {columnWidth >= 36 && (
                                    <Text style={[styles.dayText, isNow && { color: '#1E293B' }, { fontSize: 9 }]}>
                                        {showLabel ? 'h' : ''}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View style={styles.dayRow}>
                    {displayDates.map((d, i) => {
                        const week = getWeekForDay(i);
                        const palette = week?.palette || WEEK_PALETTE[0];
                        const isToday = d.toDateString() === new Date().toDateString();
                        const dayKey = toDateKeyLocal(d);
                        const entregasDia = entregasPorDiaKey.get(dayKey) || [];
                        const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
                        return (
                            <TouchableOpacity
                                key={i}
                                style={[
                                    styles.dayCell,
                                    {
                                        width: columnWidth,
                                        backgroundColor: isToday ? '#FACC15' : palette.header,
                                        borderRightColor: palette.border,
                                        borderTopWidth: entregasDia.length ? 3 : 0,
                                        borderTopColor: '#EF4444',
                                    },
                                ]}
                                onPress={() => zoomToDay(d)}
                            >
                                <Text style={[styles.dayNameText, isToday && { color: '#1E293B' }]}>{dayNames[d.getDay()]}</Text>
                                <Text style={[styles.dayText, isToday && { color: '#1E293B' }]}>{d.getDate()}</Text>
                                {entregasDia.length > 0 ? (
                                    <Text style={{ color: '#FCA5A5', fontSize: 8, fontWeight: '700' }}>
                                        {entregasDia.length} ent.
                                    </Text>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );

    const displayCatalog = useMemo(() => (
        procesoCatalog.length
            ? procesoCatalog
            : DEFAULT_PROCESOS.map((nombre, orden) => ({ id: 0, nombre, orden }))
    ), [procesoCatalog]);

    const commitProcesoReorder = useCallback(async (catalog) => {
        const ids = catalog.map((p) => p.id).filter((id) => id > 0);
        if (ids.length !== catalog.length) return;
        try {
            await planeacionApi.reordenarProcesosGantt(ids);
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
            await loadProcesosCatalog();
        }
    }, [loadProcesosCatalog]);

    const moveProcesoCatalog = useCallback(async (fromIdx, toIdx) => {
        const next = reorderCatalogItems(displayCatalog, fromIdx, toIdx);
        setProcesoCatalog(next);
        await commitProcesoReorder(next);
    }, [displayCatalog, commitProcesoReorder]);

    const onProcesoGripMouseDown = useCallback((e, fromIdx) => {
        if (!procesosEditMode || Platform.OS !== 'web') return;
        e.preventDefault?.();
        e.stopPropagation?.();

        const dragState = { fromIdx, lastOver: fromIdx, startY: e.clientY ?? e.nativeEvent?.clientY ?? 0 };
        setProcesoDragIdx(fromIdx);

        const onMove = (ev) => {
            const clientY = ev.clientY ?? 0;
            const step = Math.round((clientY - dragState.startY) / BASE_ROW_HEIGHT);
            const target = Math.max(0, Math.min(displayCatalog.length - 1, fromIdx + step));
            if (target !== dragState.lastOver) {
                dragState.lastOver = target;
                setProcesoCatalog((prev) => {
                    const base = prev.length ? prev : displayCatalog;
                    const reordered = reorderCatalogItems(base, dragState.fromIdx, target);
                    dragState.fromIdx = target;
                    return reordered;
                });
            }
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setProcesoDragIdx(null);
            setProcesoCatalog((prev) => {
                if (prev.length) commitProcesoReorder(prev);
                return prev;
            });
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [procesosEditMode, displayCatalog, commitProcesoReorder]);

    const openAddProcesoCatalog = () => {
        setProcesoCatalogForm({ id: null, nombre: '' });
        setShowProcesoCatalogModal(true);
    };

    const openEditProcesoCatalog = (item) => {
        setProcesoCatalogForm({ id: item.id, nombre: item.nombre });
        setShowProcesoCatalogModal(true);
    };

    const handleSaveProcesoCatalog = async () => {
        const nombre = procesoCatalogForm.nombre.trim();
        if (!nombre) {
            Alert.alert('Nombre requerido', 'Indique el nombre del proceso.');
            return;
        }
        setSavingProcesoCatalog(true);
        try {
            const oldItem = procesoCatalogForm.id
                ? procesoCatalog.find((p) => p.id === procesoCatalogForm.id)
                : null;
            const oldName = oldItem?.nombre;

            if (procesoCatalogForm.id) {
                await planeacionApi.actualizarProcesoGantt(procesoCatalogForm.id, nombre);
                if (oldName && oldName !== nombre) {
                    setForm((f) => {
                        const next = { ...f.procesosSeleccionados };
                        if (next[oldName]) {
                            next[nombre] = { ...next[oldName] };
                            delete next[oldName];
                        }
                        return { ...f, procesosSeleccionados: next };
                    });
                }
            } else {
                await planeacionApi.crearProcesoGantt(nombre);
                setForm((f) => ({
                    ...f,
                    procesosSeleccionados: {
                        ...f.procesosSeleccionados,
                        [nombre]: f.procesosSeleccionados[nombre]
                            ?? getProcesoFormEntry(),
                    },
                }));
            }
            setShowProcesoCatalogModal(false);
            await loadProcesosCatalog();
        } catch (error) {
            Alert.alert('Error', getErrorMessage(error));
        } finally {
            setSavingProcesoCatalog(false);
        }
    };

    const handleDeleteProcesoCatalog = (item) => {
        if (displayCatalog.length <= 1) {
            Alert.alert('No permitido', 'Debe quedar al menos un proceso en el catálogo.');
            return;
        }
        const doDelete = async () => {
            try {
                await planeacionApi.eliminarProcesoGantt(item.id);
                await loadProcesosCatalog();
            } catch (error) {
                Alert.alert('Error', getErrorMessage(error));
            }
        };
        const msg = `¿Eliminar el proceso "${item.nombre}" del catálogo?`;
        if (Platform.OS === 'web' && window.confirm) {
            if (window.confirm(msg)) doDelete();
        } else {
            Alert.alert('Eliminar proceso', msg, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: doDelete },
            ]);
        }
    };

    const renderProcessLabelCard = (item, rowIdx) => {
        const proceso = item.nombre;
        const rowBg = rowIdx % 2 === 0
            ? (isDarkMode ? '#111827' : '#F8FAFC')
            : (isDarkMode ? '#0F172A' : '#FFFFFF');
        const isDragging = procesoDragIdx === rowIdx;
        const gripProps = Platform.OS === 'web' && procesosEditMode
            ? { onMouseDown: (e) => onProcesoGripMouseDown(e, rowIdx) }
            : {};

        return (
            <View
                key={`${item.id}-${proceso}-${rowIdx}`}
                style={[
                    procesosEditMode ? styles.processLabelCard : styles.processLabelCell,
                    {
                        height: rowHeights[proceso],
                        width: labelColWidth,
                        borderColor: colors.border,
                        backgroundColor: isDragging ? '#4F46E522' : rowBg,
                    },
                ]}
            >
                {procesosEditMode && (
                    <View style={styles.processCardGrip} {...gripProps}>
                        <Text style={styles.processGrip}>⠿</Text>
                        {Platform.OS !== 'web' && (
                            <View style={styles.processMoveBtns}>
                                <TouchableOpacity
                                    disabled={rowIdx === 0}
                                    onPress={() => moveProcesoCatalog(rowIdx, rowIdx - 1)}
                                >
                                    <Text style={[styles.processMoveBtn, rowIdx === 0 && { opacity: 0.3 }]}>▲</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={rowIdx === displayCatalog.length - 1}
                                    onPress={() => moveProcesoCatalog(rowIdx, rowIdx + 1)}
                                >
                                    <Text style={[styles.processMoveBtn, rowIdx === displayCatalog.length - 1 && { opacity: 0.3 }]}>▼</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                <Text style={[styles.processLabel, { color: colors.text, flex: 1 }]} numberOfLines={2}>{proceso}</Text>
                {procesosEditMode && item.id > 0 && (
                    <View style={styles.processCardBtns}>
                        <TouchableOpacity onPress={() => openEditProcesoCatalog(item)}>
                            <Text style={styles.processCardBtn}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteProcesoCatalog(item)}>
                            <Text style={[styles.processCardBtn, { color: '#EF4444' }]}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderGantt = () => (
        <View style={styles.ganttRoot}>
            <View style={styles.ganttSplitRow}>
                <View style={[styles.labelColumn, { width: labelColWidth, borderColor: colors.border }]}>
                    <View style={[styles.processHeaderCell, { backgroundColor: headerBg, height: headerHeight, width: labelColWidth }]}>
                        <Text style={styles.processHeaderText}>PROCESOS</Text>
                        {procesosEditMode && (
                            <TouchableOpacity style={styles.processHeaderAddBtn} onPress={openAddProcesoCatalog}>
                                <Text style={styles.processHeaderAddText}>+</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView
                        ref={labelScrollRef}
                        style={{ maxHeight: ganttBodyMaxH }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                        onScroll={syncVerticalScroll('label')}
                        scrollEventThrottle={16}
                    >
                        {displayCatalog.map((item, rowIdx) => renderProcessLabelCard(item, rowIdx))}
                    </ScrollView>
                    {billingRowH > 0 && (
                        <TouchableOpacity
                            style={[styles.billingLabelCell, {
                                width: labelColWidth,
                                height: billingRowH,
                                backgroundColor: headerBg,
                                borderColor: colors.border,
                            }]}
                            onPress={() => {
                                setMetaMensualDraft(metaMensual ? String(metaMensual) : '');
                                setShowMetaModal(true);
                            }}
                        >
                            <Text style={styles.billingLabelTitle}>FACTURADO</Text>
                            <Text style={styles.billingLabelSub} numberOfLines={1}>
                                {metaMensual > 0 ? formatMoney(monthlyBillingSummary.generado) : 'Definir meta'}
                            </Text>
                            {metaMensual > 0 ? (
                                <Text style={[styles.billingLabelSub, { fontSize: 8, marginTop: 2 }]} numberOfLines={2}>
                                    Meta mes {formatMoney(metaMensual)} · arrastre acumulado
                                </Text>
                            ) : null}
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator style={styles.timelineScroll} contentContainerStyle={{ minWidth: Math.max(trackWidth, timelineAvail) }}>
                    <View style={{ width: Math.max(trackWidth, timelineAvail) }}>
                        <View style={{ height: headerHeight }}>{renderTimelineHeader()}</View>
                        <ScrollView
                            ref={bodyScrollRef}
                            style={{ maxHeight: ganttBodyMaxH }}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                            onScroll={syncVerticalScroll('body')}
                            scrollEventThrottle={16}
                        >
                            {procesoList.map((proceso, rowIdx) => (
                                <View
                                    key={proceso}
                                    ref={(node) => {
                                        if (node) rowDomRefs.current[proceso] = node;
                                        else delete rowDomRefs.current[proceso];
                                    }}
                                    style={[
                                        styles.processRow,
                                        {
                                            height: rowHeights[proceso],
                                            width: Math.max(trackWidth, timelineAvail),
                                            backgroundColor: auxDrag?.target?.proceso === proceso
                                                ? (isDarkMode ? '#4F46E533' : '#C7D2FE66')
                                                : rowIdx % 2 === 0
                                                    ? (isDarkMode ? '#111827' : '#F8FAFC')
                                                    : (isDarkMode ? '#0F172A' : '#FFFFFF'),
                                        },
                                    ]}
                                >
                                    <View style={[styles.processTrack, { width: Math.max(trackWidth, timelineAvail), height: rowHeights[proceso] }]}>
                                        {ganttZoom === 'day'
                                            ? renderDayHourTrack(proceso)
                                            : displayDates.map((_, i) => renderDayCell(proceso, i))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        {billingRowH > 0 && (
                            <View style={[styles.billingRow, { width: trackWidth, height: billingRowH }]}>
                                {weekGroups.map((w, i) => {
                                    const bill = weeklyBilling[i];
                                    if (!bill) return null;
                                    const saldoColor = bill.saldo <= 0 ? '#4ADE80' : '#FBBF24';
                                    return (
                                        <View
                                            key={`bill-${w.key}`}
                                            style={[
                                                styles.billingCell,
                                                {
                                                    width: w.count * columnWidth,
                                                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                                    borderRightColor: w.palette.border,
                                                    borderTopColor: w.palette.header,
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.billingLine, { color: '#60A5FA' }]} numberOfLines={1}>
                                                Gen. {formatMoney(bill.generado)}
                                            </Text>
                                            <Text style={[styles.billingLine, { color: isDarkMode ? '#E2E8F0' : '#334155' }]} numberOfLines={1}>
                                                Meta base {formatMoney(bill.metaBase)}
                                            </Text>
                                            {bill.arrastre > 0 ? (
                                                <Text style={[styles.billingLine, { color: '#94A3B8', fontSize: 8 }]} numberOfLines={1}>
                                                    Arrastre {formatMoney(bill.arrastre)} · Total {formatMoney(bill.meta)}
                                                </Text>
                                            ) : (
                                                <Text style={[styles.billingLine, { color: '#94A3B8', fontSize: 8 }]} numberOfLines={1}>
                                                    Total meta {formatMoney(bill.meta)}
                                                </Text>
                                            )}
                                            <Text style={[styles.billingLine, { color: saldoColor, fontWeight: '800' }]} numberOfLines={1}>
                                                {bill.saldo <= 0 ? `+${formatMoney(-bill.saldo)}` : `Falta ${formatMoney(bill.falta)}`}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );

    const renderDayDetailModal = () => {
        if (!dayDetailData) return null;
        const { proceso, dayDate, items } = dayDetailData;

        return (
            <Modal visible={showDayDetail} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.dayDetailContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFFFFF' }]}>
                        <View style={styles.dayDetailHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.dayDetailTitle, { color: colors.text }]}>{proceso}</Text>
                                <Text style={{ color: colors.subText, fontSize: 13 }}>
                                    {dayDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDayDetail(false)}>
                                <Text style={{ color: colors.subText, fontSize: 22, fontWeight: '700' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: colors.subText, marginBottom: 12 }}>
                            {items.length} OP{items.length !== 1 ? 's' : ''} programada{items.length !== 1 ? 's' : ''} en este día
                        </Text>

                        <ScrollView style={{ maxHeight: 360 }}>
                            {items.map(({ prog, proceso: p }) => {
                                const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
                                return (
                                    <TouchableOpacity
                                        key={`${prog.id}-${p.id}`}
                                        style={[styles.dayDetailCard, { borderLeftColor: prog.color || '#3B82F6' }]}
                                        onPress={() => {
                                            setSelectedId(prog.id);
                                            setShowDayDetail(false);
                                        }}
                                    >
                                        <View style={styles.dayDetailCardHeader}>
                                            <View style={[styles.colorDot, { backgroundColor: prog.color || '#3B82F6' }]} />
                                            <Text style={[styles.dayDetailOp, { color: colors.text }]}>{prog.numeroOP}</Text>
                                            <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                                                <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: colors.subText, fontSize: 12, marginTop: 6 }}>
                                            Cliente: {prog.cliente || '—'} · {prog.metaTiros?.toLocaleString()} und.
                                        </Text>
                                        <Text style={{ color: colors.subText, fontSize: 11, marginTop: 4 }}>
                                            {formatDateTime(p.fechaInicio)} → {formatDateTime(p.fechaFin)}
                                        </Text>
                                        {p.horasEstimadas > 0 && (
                                            <Text style={{ color: '#60A5FA', fontSize: 11, marginTop: 4 }}>
                                                Horas trabajo: {p.horasEstimadas}h
                                            </Text>
                                        )}
                                        {!!p.maquinaNombre && (
                                            <Text style={{ color: '#5EEAD4', fontSize: 11, marginTop: 4 }}>
                                                Máquina: {p.maquinaNombre}
                                            </Text>
                                        )}
                                        {(p.tiemposAuxiliares || []).length > 0 && (
                                            <Text style={{ color: '#A78BFA', fontSize: 10, marginTop: 4 }}>
                                                +{(p.tiemposAuxiliares || []).length} tiempo(s) auxiliar(es)
                                            </Text>
                                        )}
                                        {p.cantidadProducida > 0 && (
                                            <Text style={{ color: '#22C55E', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                                                Producido: {p.cantidadProducida}
                                            </Text>
                                        )}
                                        <View style={styles.dayDetailActions}>
                                            <TouchableOpacity
                                                style={styles.dayDetailBtn}
                                                onPress={() => { setSelectedId(prog.id); setShowDayDetail(false); }}
                                            >
                                                <Text style={styles.dayDetailBtnText}>Ver seguimiento</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.dayDetailBtn}
                                                onPress={() => { setShowDayDetail(false); openEditActivity(prog, p); }}
                                            >
                                                <Text style={styles.dayDetailBtnText}>Editar actividad</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.dayDetailBtn, { backgroundColor: '#DC2626' }]}
                                                onPress={() => { setShowDayDetail(false); confirmDeleteActivity(prog, p.proceso); }}
                                            >
                                                <Text style={styles.dayDetailBtnText}>Eliminar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderProgressPanel = () => {
        if (urgencyPreview && !showModal) return null;

        const panelBg = isDarkMode ? '#111827' : '#F1F5F9';

        if (!selectedProgramacion) {
            return (
                <View style={[styles.detailPanel, { backgroundColor: panelBg, borderColor: colors.border }]}>
                    <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 13 }}>
                        Seleccione una OP en el diagrama o pulse + Programar OP
                    </Text>
                </View>
            );
        }

        const prog = selectedProgramacion;
        return (
            <View style={[styles.detailPanel, { backgroundColor: panelBg, borderColor: colors.border }]}>
                <TouchableOpacity style={styles.detailPanelHeader} onPress={() => setDetailExpanded((v) => !v)}>
                    <View style={[styles.colorDot, { backgroundColor: prog.color || '#3B82F6', width: 10, height: 10 }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.detailPanelTitle, { color: colors.text }]}>
                            OP {prog.numeroOP} {prog.esUrgencia ? '⚡' : ''}
                            <Text style={{ color: colors.subText, fontWeight: '400' }}> · {prog.cliente || '—'}</Text>
                        </Text>
                        {!detailExpanded && (
                            <Text style={{ color: colors.subText, fontSize: 11 }} numberOfLines={1}>
                                {prog.progresoGeneral || 0}% · {prog.procesos?.length || 0} procesos
                            </Text>
                        )}
                    </View>
                    <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>{prog.progresoGeneral || 0}%</Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(prog)}>
                        <Text style={styles.editBtnText}>Editar OP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: '#4F46E5' }]}
                        onPress={() => setShowAddActivityPicker(true)}
                        disabled={getAvailableProcesosToAdd(prog, procesoList).length === 0}
                    >
                        <Text style={styles.editBtnText}>+ Actividad</Text>
                    </TouchableOpacity>
                    <Text style={{ color: colors.subText, fontSize: 16, marginLeft: 8 }}>{detailExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>

                {detailExpanded && (
                    <>
                        <Text style={{ color: colors.subText, fontSize: 11, marginBottom: 8 }} numberOfLines={2}>
                            OT {prog.numeroOT || '—'} · LT {prog.lineaTroquel || '—'} · {prog.referencia || 'Sin ref.'} · {prog.metaTiros?.toLocaleString()} und.
                            {(Number(prog.precio) > 0) ? ` · ${formatMoney(prog.precio)}` : ''}
                        </Text>
                        <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${prog.progresoGeneral || 0}%` }]} />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                            {prog.procesos.map((p) => {
                                const cfg = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={[styles.processStatusCard, { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                                        onPress={() => openEditActivity(prog, p)}
                                        onLongPress={() => confirmDeleteActivity(prog, p.proceso)}
                                    >
                                        <View style={styles.processCardHeader}>
                                            <Text style={[styles.processStatusName, { color: colors.text }]}>{p.proceso}</Text>
                                            <TouchableOpacity
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                onPress={(e) => {
                                                    e?.stopPropagation?.();
                                                    confirmDeleteActivity(prog, p.proceso);
                                                }}
                                            >
                                                <Text style={{ color: '#EF4444', fontSize: 12 }}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={[styles.processStatusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                        <Text style={{ color: colors.subText, fontSize: 9, marginTop: 2 }}>
                                            {formatDateTime(p.fechaInicio)} → {formatDateTime(p.fechaFin)}
                                        </Text>
                                        {!!p.maquinaNombre && (
                                            <Text style={{ color: '#5EEAD4', fontSize: 9, marginTop: 2 }}>
                                                {p.maquinaNombre}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <View style={styles.detailPanelActions}>
                            <TouchableOpacity onPress={() => handleDelete(prog.id)}>
                                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Eliminar OP</Text>
                            </TouchableOpacity>
                            <Text style={{ color: colors.subText, fontSize: 11 }}>
                                Clic en actividad para editar · clic derecho en barra del Gantt
                            </Text>
                        </View>
                    </>
                )}
            </View>
        );
    };

    const renderContextMenu = () => {
        if (!contextMenu) return null;
        const { prog, procesoProc, x, y } = contextMenu;
        return (
            <Modal visible transparent animationType="fade" onRequestClose={() => setContextMenu(null)}>
                <TouchableOpacity style={styles.contextMenuOverlay} activeOpacity={1} onPress={() => setContextMenu(null)}>
                    <View style={[styles.contextMenu, { top: y, left: x, backgroundColor: isDarkMode ? '#1E293B' : '#FFF' }]}>
                        <Text style={[styles.contextMenuTitle, { color: colors.text }]}>
                            {procesoProc.proceso} · OP {prog.numeroOP}
                        </Text>
                        <TouchableOpacity style={styles.contextMenuItem} onPress={() => openEditActivity(prog, procesoProc)}>
                            <Text style={{ color: colors.text }}>✏️  Editar actividad</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.contextMenuItem}
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                const p = prog;
                                const name = procesoProc.proceso;
                                setContextMenu(null);
                                // Diferir al cierre del menú para que window.confirm no quede bloqueado por el Modal
                                setTimeout(() => confirmDeleteActivity(p, name), 50);
                            }}
                        >
                            <Text style={{ color: '#EF4444', fontWeight: '700' }}>🗑️  Eliminar actividad</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setContextMenu(null); openEditModal(prog); }}>
                            <Text style={{ color: colors.text }}>📋  Editar OP completa</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    const renderAddActivityPicker = () => {
        if (!showAddActivityPicker || !selectedProgramacion) return null;
        const available = getAvailableProcesosToAdd(selectedProgramacion, procesoList);
        return (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowAddActivityPicker(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.activityPickerContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 12 }]}>
                            Agregar actividad a OP {selectedProgramacion.numeroOP}
                        </Text>
                        {available.length === 0 ? (
                            <Text style={{ color: colors.subText }}>Todas las actividades ya están programadas.</Text>
                        ) : (
                            available.map((nombre) => (
                                <TouchableOpacity
                                    key={nombre}
                                    style={[styles.activityPickerRow, { borderColor: colors.border }]}
                                    onPress={() => openAddActivity(selectedProgramacion, nombre)}
                                >
                                    <Text style={{ color: colors.text, fontWeight: '600' }}>{nombre}</Text>
                                    <Text style={{ color: colors.subText, fontSize: 12 }}>+</Text>
                                </TouchableOpacity>
                            ))
                        )}
                        <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#334155', marginTop: 16 }]} onPress={() => setShowAddActivityPicker(false)}>
                            <Text style={styles.modalBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderActivityModal = () => {
        if (!showActivityModal || !activityForm) return null;
        const modalPalette = {
            label: isDarkMode ? '#CBD5E0' : '#334155',
            helper: isDarkMode ? '#718096' : '#64748B',
            inputBg: isDarkMode ? '#2D3748' : '#F8FAFC',
            inputBorder: isDarkMode ? '#4A5568' : '#CBD5E1',
            inputText: isDarkMode ? '#FFFFFF' : '#0F172A',
        };
        const themedInput = [styles.input, {
            backgroundColor: modalPalette.inputBg,
            borderColor: modalPalette.inputBorder,
            color: modalPalette.inputText,
        }];
        const themedDateInput = [styles.dateInput, {
            backgroundColor: modalPalette.inputBg,
            borderColor: modalPalette.inputBorder,
            color: modalPalette.inputText,
        }];

        return (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowActivityModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.activityModalContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {activityModalMode === 'add' ? 'Nueva actividad' : 'Editar actividad'}: {activityForm.proceso}
                        </Text>
                        <Text style={{ color: modalPalette.helper, fontSize: 12, marginBottom: 12 }}>
                            Los procesos posteriores se ajustan automáticamente si hay solapamiento.
                        </Text>

                        <View style={styles.timeRow}>
                            <View style={styles.timeGroup}>
                                <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Inicio</Text>
                                <DateCalendarField
                                    value={activityForm.fechaInicio}
                                    onChange={(v) => setActivityForm((f) => ({ ...f, fechaInicio: v }))}
                                    style={themedDateInput}
                                    isDarkMode={isDarkMode}
                                    placeholderColor={modalPalette.helper}
                                />
                                <HourChipsScroller
                                    chipKey="act-ini"
                                    selectedHour={activityForm.horaInicio}
                                    helperColor={modalPalette.helper}
                                    blockedHours={
                                        activityForm.maquinaId
                                            ? getHorasInicioBloqueadas(activityForm.maquinaId, activityForm.fechaInicio, activityForm.progId)
                                            : null
                                    }
                                    onSelect={(h) => setActivityForm((f) => ({ ...f, horaInicio: h }))}
                                />
                            </View>
                            <Text style={{ color: modalPalette.helper, marginTop: 20 }}>→</Text>
                            <View style={styles.timeGroup}>
                                <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Fin</Text>
                                <DateCalendarField
                                    value={activityForm.fechaFin}
                                    onChange={(v) => setActivityForm((f) => ({ ...f, fechaFin: v }))}
                                    style={themedDateInput}
                                    isDarkMode={isDarkMode}
                                    placeholderColor={modalPalette.helper}
                                />
                                <HourChipsScroller
                                    chipKey="act-fin"
                                    selectedHour={activityForm.horaFin}
                                    helperColor={modalPalette.helper}
                                    blockedHours={
                                        activityForm.maquinaId
                                            ? getHorasFinBloqueadas(
                                                activityForm.maquinaId,
                                                activityForm.fechaInicio,
                                                activityForm.horaInicio,
                                                activityForm.fechaFin,
                                                activityForm.progId
                                            )
                                            : null
                                    }
                                    onSelect={(h) => setActivityForm((f) => ({ ...f, horaFin: h }))}
                                />
                            </View>
                        </View>

                        <View style={styles.horasEstimadasRow}>
                            <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Horas estimadas</Text>
                            <TextInput
                                style={[...themedDateInput, { width: 100 }]}
                                value={activityForm.horasEstimadas}
                                onChangeText={(v) => setActivityForm((f) => {
                                    const next = { ...f, horasEstimadas: v };
                                    const computed = computeFinFromInicioYHoras(f.fechaInicio, f.horaInicio, v);
                                    if (computed) {
                                        next.fechaFin = computed.fechaFin;
                                        next.horaFin = computed.horaFin;
                                    }
                                    return next;
                                })}
                                keyboardType="decimal-pad"
                                placeholderTextColor={modalPalette.helper}
                            />
                        </View>

                        {!procesoRequiereSinMaquina(activityForm.proceso) ? (
                            <View style={{ marginTop: 12 }}>
                                <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Máquina asignada</Text>
                                {(() => {
                                    const maqsUi = getMaquinasUiProceso(
                                        activityForm.proceso,
                                        maquinas,
                                        activityForm.maquinaId
                                    );
                                    if (maqsUi.length === 0) {
                                        return (
                                            <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 4 }}>
                                                Sin máquina asignada a este proceso.
                                            </Text>
                                        );
                                    }
                                    if (activityForm.maquinaId && maqsUi.length === 1) {
                                        return (
                                            <Text style={{ color: colors.text, fontSize: 13, marginTop: 6, fontWeight: '600' }}>
                                                {maqsUi[0].nombre}
                                            </Text>
                                        );
                                    }
                                    return (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                            <View style={styles.hourPickerRow}>
                                                {maqsUi.map((m) => (
                                                    <TouchableOpacity
                                                        key={`act-mq-${m.id}`}
                                                        style={[
                                                            styles.hourChip,
                                                            activityForm.maquinaId === m.id && styles.hourChipActive,
                                                        ]}
                                                        onPress={() => setActivityForm((f) => ({ ...f, maquinaId: m.id, maquinaNombre: m.nombre }))}
                                                    >
                                                        <Text style={[
                                                            styles.hourChipText,
                                                            activityForm.maquinaId === m.id && { color: '#FFF' },
                                                        ]}>
                                                            {m.nombre}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    );
                                })()}
                            </View>
                        ) : null}

                        {activityValidation ? (
                            <View style={{ marginTop: 10, padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#451a1a' : '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' }}>
                                <Text style={{ color: isDarkMode ? '#FCA5A5' : '#B91C1C', fontSize: 12 }}>{activityValidation}</Text>
                            </View>
                        ) : (
                            <Text style={{ color: '#22C55E', fontSize: 11, marginTop: 8 }}>Horario disponible para guardar.</Text>
                        )}

                        {(() => {
                            const turnosFiltrados = filterTurnosParaVentana(
                                activityCobertura?.turnos,
                                activityForm.fechaInicio,
                                activityForm.horaInicio,
                                activityForm.fechaFin,
                                activityForm.horaFin
                            );
                            if (!turnosFiltrados.length) {
                                if (!activityForm.maquinaId) return null;
                                return (
                                    <Text style={{ color: modalPalette.helper, fontSize: 11, marginTop: 8 }}>
                                        Sin turnos del roster que crucen este horario en la máquina asignada.
                                    </Text>
                                );
                            }
                            return (
                                <View style={{ marginTop: 10 }}>
                                    <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>
                                        Turnos y operarios (máquina · ventana programada)
                                    </Text>
                                    {turnosFiltrados.map((t) => {
                                        const ops = (t.personas || []).filter((p) => !p.esAuxiliar);
                                        const auxs = (t.personas || []).filter((p) => p.esAuxiliar);
                                        return (
                                            <Text key={`${t.fechaDia}-${t.horarioId}`} style={{ color: colors.subText, fontSize: 11, marginTop: 4 }}>
                                                {t.fechaDia} · T{t.codigo || t.horarioId} {t.inicio}–{t.fin}
                                                {ops.length
                                                    ? ` — Op: ${ops.map((p) => p.nombre).filter(Boolean).join(', ')}`
                                                    : ' — sin operario'}
                                                {auxs.length ? ` · Aux: ${auxs.map((p) => p.nombre).join(', ')}` : ''}
                                            </Text>
                                        );
                                    })}
                                </View>
                            );
                        })()}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#4F46E5', opacity: activityValidation ? 0.5 : 1 }]}
                                onPress={handleSaveActivity}
                                disabled={savingActivity || !!activityValidation}
                            >
                                {savingActivity ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>Guardar</Text>}
                            </TouchableOpacity>
                            {activityModalMode === 'edit' && (
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: '#DC2626' }]}
                                    onPress={() => {
                                        const prog = programaciones.find((p) => p.id === activityForm.progId);
                                        if (prog) {
                                            setShowActivityModal(false);
                                            confirmDeleteActivity(prog, activityForm.proceso);
                                        }
                                    }}
                                >
                                    <Text style={styles.modalBtnText}>Eliminar</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4A5568' }]}
                                onPress={() => { setShowActivityModal(false); setActivityForm(null); }}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.subText }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderModal = () => {
        if (!showModal) return null;

        const modalPalette = {
            label: isDarkMode ? '#CBD5E0' : '#334155',
            helper: isDarkMode ? '#718096' : '#64748B',
            inputBg: isDarkMode ? '#2D3748' : '#F8FAFC',
            inputBorder: isDarkMode ? '#4A5568' : '#CBD5E1',
            inputText: isDarkMode ? '#FFFFFF' : '#0F172A',
            cardBg: isDarkMode ? '#11182744' : '#F1F5F9',
            cardBgActive: isDarkMode ? '#4F46E511' : '#DBEAFE',
            cardBorder: isDarkMode ? '#334155' : '#CBD5E1',
        };

        const themedInput = [styles.input, {
            backgroundColor: modalPalette.inputBg,
            borderColor: modalPalette.inputBorder,
            color: modalPalette.inputText,
        }];

        const themedDateInput = [styles.dateInput, {
            backgroundColor: modalPalette.inputBg,
            borderColor: modalPalette.inputBorder,
            color: modalPalette.inputText,
        }];

        const isUrgencyFlow = form.esUrgencia && !editingId;
        const pasoMissing = isUrgencyFlow
            ? []
            : formModalTab === 'datos'
                ? getDatosPasoMissing(form)
                : formModalTab === 'calculo'
                    ? getCalculoPasoMissing(form, parametrosCalculo, procesoList, opDatos?.procesosSugeridos || [])
                    : formModalTab === 'procesos'
                        ? getProcesosPasoMissing(form, procesoList)
                        : [];
        const canAdvancePaso = isUrgencyFlow || pasoMissing.length === 0;

        const renderUrgencyPreviewCta = (compact = false) => {
            if (!form.esUrgencia || editingId) return null;
            return (
                <View
                    style={[
                        styles.urgencyPreviewCtaCard,
                        {
                            borderColor: '#F59E0B',
                            backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                            marginBottom: compact ? 0 : 14,
                            marginTop: compact ? 16 : 0,
                        },
                    ]}
                >
                    <Text style={[styles.urgencyPreviewCtaTitle, { color: '#F59E0B' }]}>
                        ⚡ Listo para previsualizar
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
                        Complete solo los datos que tenga. Los campos vacíos usarán valores por defecto y verá la urgencia en{' '}
                        <Text style={{ fontWeight: '700' }}>rojo</Text> en el Gantt. Las demás OP se ajustarán temporalmente.
                    </Text>
                    <TouchableOpacity style={styles.previewUrgencyBtn} onPress={handlePreviewUrgency}>
                        <Text style={styles.previewUrgencyBtnText}>👁 Previsualizar en el planeador</Text>
                    </TouchableOpacity>
                </View>
            );
        };

        return (
        <Modal visible={showModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalShell, { backgroundColor: isDarkMode ? '#1A202C' : '#FFFFFF' }]}>
                    <View style={styles.modalHeaderBar}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>
                                {editingId ? 'Editar Programación' : (form.esUrgencia ? 'Nueva Urgencia' : 'Nueva Programación de OP')}
                            </Text>
                            <Text style={{ color: modalPalette.helper, fontSize: 12, marginTop: 4 }}>
                                {formModalTab === 'datos' && 'Paso 1 de 3 · Datos OP'}
                                {formModalTab === 'calculo' && 'Paso 2 de 3 · Cálculo de horas'}
                                {formModalTab === 'procesos' && 'Paso 3 de 3 · Procesos'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => { setUrgencyPreview(null); setShowModal(false); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={{ color: modalPalette.helper, fontSize: 22, fontWeight: '700' }}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.modalBodyScroll}
                        contentContainerStyle={styles.modalBodyContent}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                    >
                        {formModalTab === 'datos' && (
                        <View>
                        {!editingId && (
                            <>
                                <View style={[styles.urgenciaRow, { marginTop: 0, marginBottom: 10 }]}>
                                    <TouchableOpacity
                                        style={[styles.checkBox, form.esUrgencia && styles.checkBoxActive]}
                                        onPress={() => {
                                            setUrgencyPreview(null);
                                            setForm((f) => ({ ...f, esUrgencia: !f.esUrgencia }));
                                        }}
                                    >
                                        <Text style={{ color: form.esUrgencia ? '#FFF' : modalPalette.helper, fontSize: 12 }}>
                                            {form.esUrgencia ? '✓' : ''}
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontWeight: '700' }}>Marcar como urgencia</Text>
                                        <Text style={{ color: modalPalette.helper, fontSize: 11, marginTop: 2 }}>
                                            Trabajo no planeado. Todos los campos son opcionales: complete lo que pueda y programe en el paso 3.
                                        </Text>
                                    </View>
                                </View>

                                {renderUrgencyPreviewCta()}

                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>
                                    Número de OP {form.esUrgencia ? '(opcional)' : '*'}
                                </Text>
                                <View style={styles.opSearchWrap}>
                                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                        <TextInput
                                            style={[...themedInput, { flex: 1 }]}
                                            placeholder={form.esUrgencia ? 'Opcional para urgencias...' : 'Buscar número de OP...'}
                                            placeholderTextColor={modalPalette.helper}
                                            value={form.numeroOP || ''}
                                            onChangeText={(v) => {
                                                if (urgencyPreview) setUrgencyPreview(null);
                                                setForm((f) => ({ ...f, numeroOP: v }));
                                                setOpSearchQuery(v);
                                            }}
                                            onBlur={() => {
                                                if (skipOpBlurLoadRef.current) {
                                                    skipOpBlurLoadRef.current = false;
                                                    return;
                                                }
                                                if (!editingId && form.numeroOP) aplicarDatosOp(form.numeroOP);
                                            }}
                                        />
                                        <TouchableOpacity style={styles.loadOpBtn} onPress={() => aplicarDatosOp(form.numeroOP)}>
                                            <Text style={styles.loadOpBtnText}>Cargar</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {!form.esUrgencia && loadingOps && (
                                        <ActivityIndicator size="small" color="#60A5FA" style={{ marginTop: 6 }} />
                                    )}
                                    {!form.esUrgencia && opsDisponibles.length > 0 && (
                                        <View
                                            style={[
                                                styles.opResultsDropdown,
                                                {
                                                    borderColor: modalPalette.inputBorder,
                                                    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                                                },
                                            ]}
                                        >
                                            <ScrollView nestedScrollEnabled style={{ maxHeight: 168 }} keyboardShouldPersistTaps="handled">
                                                {opsDisponibles.slice(0, 8).map((op) => (
                                                    <TouchableOpacity
                                                        key={op.numero}
                                                        style={[
                                                            styles.opResultRow,
                                                            { borderBottomColor: modalPalette.inputBorder },
                                                            op.yaProgramada && styles.opResultRowUsed,
                                                        ]}
                                                        onPressIn={() => { skipOpBlurLoadRef.current = true; }}
                                                        {...(Platform.OS === 'web' ? {
                                                            // Evita blur del TextInput antes del click (web).
                                                            onMouseDown: (e) => {
                                                                e.preventDefault?.();
                                                                skipOpBlurLoadRef.current = true;
                                                            },
                                                        } : {})}
                                                        onPress={() => {
                                                            const num = String(op.numero ?? '').trim();
                                                            skipOpBlurLoadRef.current = false;
                                                            setForm((f) => ({ ...f, numeroOP: num }));
                                                            setOpSearchQuery(num);
                                                            setOpsDisponibles([]);
                                                            aplicarDatosOp(num);
                                                        }}
                                                    >
                                                        <Text style={[styles.opResultNum, { color: modalPalette.inputText }]}>
                                                            OP {op.numero}
                                                        </Text>
                                                        <Text style={[styles.opResultMeta, { color: modalPalette.helper }]} numberOfLines={1}>
                                                            {op.cliente || '—'}{op.yaProgramada ? ' · Ya programada' : ''}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                                {!form.esUrgencia && loadingOpDatos && (
                                    <Text style={{ color: '#60A5FA', fontSize: 12, marginBottom: 8 }}>Cargando datos de la OP...</Text>
                                )}
                                {!form.esUrgencia && opDatos?.mensaje && (
                                    <Text style={{ color: '#F59E0B', fontSize: 12, marginBottom: 8 }}>{opDatos.mensaje}</Text>
                                )}
                            </>
                        )}
                        {editingId && (
                            <>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label }]}>Número de OP *</Text>
                                <TextInput
                                    style={themedInput}
                                    placeholderTextColor={modalPalette.helper}
                                    value={form.numeroOP || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, numeroOP: v }))}
                                />
                            </>
                        )}

                        <View style={styles.formGrid}>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>
                                    Número OT (opcional)
                                </Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="Orden de trabajo"
                                    placeholderTextColor={modalPalette.helper}
                                    value={form.numeroOT || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, numeroOT: v }))}
                                />
                            </View>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Orden de compra</Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="O. compra Cliente (OCR)"
                                    placeholderTextColor={modalPalette.helper}
                                    value={form.ordenCompra || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, ordenCompra: v }))}
                                />
                            </View>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Línea de troquel</Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="Código LT"
                                    placeholderTextColor={modalPalette.helper}
                                    value={form.lineaTroquel || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, lineaTroquel: v }))}
                                />
                            </View>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>
                                    Cliente {form.esUrgencia ? '(opcional)' : '*'}
                                </Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="Nombre del cliente"
                                    placeholderTextColor={modalPalette.helper}
                                    value={form.cliente || ''}
                                    onChangeText={(v) => {
                                        if (urgencyPreview) setUrgencyPreview(null);
                                        setForm((f) => ({ ...f, cliente: v }));
                                    }}
                                />
                            </View>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Fecha entrega (despacho)</Text>
                                <DateCalendarField
                                    value={(() => {
                                        const raw = form.calculo?.fechaEntrega || '';
                                        // Acepta YYYY-MM-DD o DD/MM/AAAA → valor ISO para el calendario
                                        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
                                        const m = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                                        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                                        return '';
                                    })()}
                                    onChange={(v) => setForm((f) => ({
                                        ...f,
                                        calculo: { ...(f.calculo || emptyCalculoForm()), fechaEntrega: v },
                                    }))}
                                    style={themedInput}
                                    isDarkMode={isDarkMode}
                                    placeholderColor={modalPalette.helper}
                                />
                            </View>
                            <View style={[styles.formGridItem, styles.formGridItemFull]}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Referencia</Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="Trabajo / referencia"
                                    placeholderTextColor={modalPalette.helper}
                                    value={form.referencia || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, referencia: v }))}
                                />
                            </View>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>
                                    Unidades {form.esUrgencia ? '(opcional)' : '*'}
                                </Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="Cantidad a producir"
                                    placeholderTextColor={modalPalette.helper}
                                    keyboardType="numeric"
                                    value={form.metaTiros || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, metaTiros: v }))}
                                />
                            </View>
                            <View style={styles.formGridItem}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Precio unitario ($)</Text>
                                <TextInput
                                    style={themedInput}
                                    placeholder="Ej: 450"
                                    placeholderTextColor={modalPalette.helper}
                                    keyboardType="numeric"
                                    value={form.precioUnitario || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, precioUnitario: v }))}
                                />
                            </View>
                            <View style={[styles.formGridItem, styles.formGridItemFull]}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Valor total OP</Text>
                                <View style={[
                                    themedInput,
                                    { justifyContent: 'center', height: 42 },
                                ]}
                                >
                                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                                        {formatMoney(computePrecioTotalOp(form.metaTiros, form.precioUnitario))}
                                    </Text>
                                </View>
                                <Text style={{ color: modalPalette.helper, fontSize: 11, marginTop: 4 }}>
                                    Unidades × precio unitario (se usa en la facturación del mes).
                                </Text>
                            </View>
                            <View style={[styles.formGridItem, styles.formGridItemFull]}>
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginTop: 4 }]}>Observaciones (opcional)</Text>
                                <TextInput
                                    style={[...themedInput, { minHeight: 52 }]}
                                    placeholder="Notas de programación..."
                                    placeholderTextColor={modalPalette.helper}
                                    multiline
                                    value={form.observaciones || ''}
                                    onChangeText={(v) => setForm((f) => ({ ...f, observaciones: v }))}
                                />
                            </View>
                        </View>

                        </View>
                        )}

                        {formModalTab === 'calculo' && (
                        <View>
                        {form.esUrgencia && !editingId ? (
                            <Text style={{ color: '#F59E0B', fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
                                Paso opcional en urgencias. Puede omitir el cálculo y pasar directo al paso 3 para programar tiempos manualmente.
                            </Text>
                        ) : null}
                        {(() => {
                            const calcRoot = form.calculo || emptyCalculoForm();
                            const piezasCalc = getPiezasListFromCalculo(calcRoot);
                            if (piezasCalc.length <= 1) return null;
                            return (
                                <View style={[styles.formGridItemFull, { marginBottom: 8 }]}>
                                    <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Pieza *</Text>
                                    <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 6 }}>
                                        Esta OP tiene {piezasCalc.length} piezas. Calcule tiros y máquinas por pieza.
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 2 }}>
                                            {piezasCalc.map((pieza) => (
                                                <TouchableOpacity
                                                    key={pieza.id}
                                                    onPress={() => updateCalculoField('piezaActivaId', pieza.id)}
                                                    style={[
                                                        styles.maquinaChip,
                                                        calcRoot.piezaActivaId === pieza.id && styles.maquinaChipActive,
                                                    ]}
                                                >
                                                    <Text style={[
                                                        styles.maquinaChipText,
                                                        { color: calcRoot.piezaActivaId === pieza.id ? '#FFF' : modalPalette.helper },
                                                    ]}
                                                    >
                                                        {pieza.nombre}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            );
                        })()}
                        <Text style={[styles.fieldLabel, { marginTop: 4, color: modalPalette.label }]}>
                            {getCalculoTituloMaquina(form.calculo || emptyCalculoForm(), parametrosCalculo)}
                        </Text>
                        <Text style={{ color: modalPalette.helper, fontSize: 12, marginBottom: 10 }}>
                            {getCalculoFormulaHint(form.calculo || emptyCalculoForm(), parametrosCalculo)}
                            {' '}
                            Despique y Terminado Manual no usan cálculo de tiros: agréguelos abajo y programe fechas y horas en el paso 3.
                        </Text>
                        {(() => {
                            const calc = form.calculo || emptyCalculoForm();
                            const res = computeCalculoHoras(calc, parametrosCalculo);
                            const speedMode = res.speedMode;
                            const procesosSugeridosOp = opDatos?.procesosSugeridos || [];
                            const maqsCalc = getMaquinasCalculoVisibles(calc, form, procesoList, parametrosCalculo, procesosSugeridosOp);
                            const maqsAgregar = getMaquinasCalculoDisponiblesAgregar(calc, form, procesoList, parametrosCalculo, procesosSugeridosOp);
                            const procManualesSel = getProcesosManualesSeleccionados(calc, procesoList);
                            const procManualesAgregar = getProcesosManualesDisponiblesAgregar(calc, procesoList);
                            const esGuillotinaCalc = isGuillotina(calcMaquinaParam(calc, parametrosCalculo));
                            const renderMaquinasCalculoSelector = (label, hint) => (
                                <View style={[fieldStyle, styles.formGridItemFull]}>
                                    <Text style={labelStyle}>{label} *</Text>
                                    <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 4 }}>
                                        {hint}
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 2, alignItems: 'center' }}>
                                            {maqsCalc.length === 0 ? (
                                                <Text style={{ color: modalPalette.helper, fontSize: 12, fontStyle: 'italic' }}>
                                                    Sin máquinas — use + Agregar
                                                </Text>
                                            ) : null}
                                            {maqsCalc.map((p) => (
                                                <View
                                                    key={p.maquinaId}
                                                    style={[
                                                        styles.maquinaChip,
                                                        calc.maquinaCalculoId === p.maquinaId && styles.maquinaChipActive,
                                                        { flexDirection: 'row', alignItems: 'center', paddingRight: 2 },
                                                    ]}
                                                >
                                                    <TouchableOpacity
                                                        onPress={() => updateCalculoField('maquinaCalculoId', p.maquinaId)}
                                                        style={{ flexShrink: 1 }}
                                                    >
                                                        <Text style={[styles.maquinaChipText, { color: calc.maquinaCalculoId === p.maquinaId ? '#FFF' : modalPalette.helper }]}>
                                                            {p.nombre}
                                                        </Text>
                                                        <Text style={[styles.maquinaChipStatus, { color: '#60A5FA' }]}>
                                                            {isSpeedMaster(parametroComoMaquina(p))
                                                                ? `Run ${p.estandarPorHora}/h`
                                                                : `Est. ${p.estandarPorHora}/h`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => removeMaquinaCalculo(p.maquinaId)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                                                        style={{ marginLeft: 2, paddingHorizontal: 4, paddingVertical: 2 }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: calc.maquinaCalculoId === p.maquinaId ? '#FCA5A5' : '#F87171',
                                                                fontWeight: '800',
                                                                fontSize: 16,
                                                                lineHeight: 18,
                                                            }}
                                                        >
                                                            ×
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                            {maqsAgregar.length > 0 ? (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.maquinaChip,
                                                        agregarMaquinaCalculoOpen && styles.maquinaChipActive,
                                                        { borderStyle: 'dashed', borderColor: '#94A3B8' },
                                                    ]}
                                                    onPress={() => setAgregarMaquinaCalculoOpen((v) => !v)}
                                                >
                                                    <Text style={[styles.maquinaChipText, { color: modalPalette.helper }]}>
                                                        + Agregar
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    </ScrollView>
                                    {agregarMaquinaCalculoOpen && maqsAgregar.length > 0 ? (
                                        <View style={{ marginTop: 6 }}>
                                            <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 4 }}>
                                                Máquinas disponibles para agregar:
                                            </Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                {maqsAgregar.map((p) => (
                                                    <TouchableOpacity
                                                        key={`add-${p.maquinaId}`}
                                                        style={styles.maquinaChip}
                                                        onPress={() => addMaquinaCalculoExtra(p.maquinaId)}
                                                    >
                                                        <Text style={[styles.maquinaChipText, { color: modalPalette.helper }]}>
                                                            {p.nombre}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                            );
                            const renderProcesosManualesSelector = () => {
                                const catalogo = getProcesosManualesCatalogo(procesoList);
                                if (catalogo.length === 0) return null;
                                return (
                                    <View style={[fieldStyle, styles.formGridItemFull, { marginTop: 4 }]}>
                                        <Text style={labelStyle}>Procesos manuales (sin máquina)</Text>
                                        <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 4 }}>
                                            Despique y Terminado Manual: inclúyalos en la OP y asigne horas en el paso 3.
                                        </Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 2, alignItems: 'center' }}>
                                                {procManualesSel.length === 0 ? (
                                                    <Text style={{ color: modalPalette.helper, fontSize: 12, fontStyle: 'italic' }}>
                                                        Ninguno — use + Agregar
                                                    </Text>
                                                ) : null}
                                                {procManualesSel.map((nombre) => (
                                                    <View
                                                        key={`manual-${nombre}`}
                                                        style={[
                                                            styles.maquinaChip,
                                                            { flexDirection: 'row', alignItems: 'center', paddingRight: 2, borderColor: '#A78BFA' },
                                                        ]}
                                                    >
                                                        <Text style={[styles.maquinaChipText, { color: '#C4B5FD' }]}>
                                                            {nombre}
                                                        </Text>
                                                        <Text style={[styles.maquinaChipStatus, { color: '#A78BFA' }]}>
                                                            Horas en paso 3
                                                        </Text>
                                                        <TouchableOpacity
                                                            onPress={() => toggleProcesoManual(nombre, false)}
                                                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                                                            style={{ marginLeft: 2, paddingHorizontal: 4, paddingVertical: 2 }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    color: '#F87171',
                                                                    fontWeight: '800',
                                                                    fontSize: 16,
                                                                    lineHeight: 18,
                                                                }}
                                                            >
                                                                ×
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                                {procManualesAgregar.length > 0 ? (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.maquinaChip,
                                                            agregarProcesoManualOpen && styles.maquinaChipActive,
                                                            { borderStyle: 'dashed', borderColor: '#A78BFA' },
                                                        ]}
                                                        onPress={() => setAgregarProcesoManualOpen((v) => !v)}
                                                    >
                                                        <Text style={[styles.maquinaChipText, { color: '#C4B5FD' }]}>
                                                            + Agregar
                                                        </Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                            </View>
                                        </ScrollView>
                                        {agregarProcesoManualOpen && procManualesAgregar.length > 0 ? (
                                            <View style={{ marginTop: 6 }}>
                                                <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 4 }}>
                                                    Procesos manuales disponibles:
                                                </Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                    {procManualesAgregar.map((nombre) => (
                                                        <TouchableOpacity
                                                            key={`add-manual-${nombre}`}
                                                            style={[styles.maquinaChip, { borderColor: '#A78BFA' }]}
                                                            onPress={() => toggleProcesoManual(nombre, true)}
                                                        >
                                                            <Text style={[styles.maquinaChipText, { color: '#C4B5FD' }]}>
                                                                {nombre}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            };
                            const themedInput = [
                                styles.dateInput,
                                {
                                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                    borderColor: modalPalette.cardBorder,
                                    color: colors.text,
                                },
                            ];
                            const fieldStyle = { flex: 1, minWidth: 140, marginBottom: 8 };
                            const labelStyle = [styles.timeLabel, { color: modalPalette.helper }];
                            return (
                                <View style={[styles.calculoBox, {
                                    backgroundColor: modalPalette.cardBg,
                                    borderColor: modalPalette.cardBorder,
                                }]}
                                >
                                    <View style={[styles.calculoResumenOp, { borderColor: modalPalette.cardBorder, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
                                        <Text style={{ color: modalPalette.helper, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                                            Datos de la OP (paso 1)
                                        </Text>
                                        <View style={styles.calculoGrid}>
                                            <View style={{ flex: 1, minWidth: 120 }}>
                                                <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Cliente</Text>
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{form.cliente || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, minWidth: 90 }}>
                                                <Text style={{ color: modalPalette.helper, fontSize: 10 }}>OP</Text>
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{form.numeroOP || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, minWidth: 120 }}>
                                                <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Fecha entrega</Text>
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{calc.fechaEntrega || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, minWidth: 120 }}>
                                                <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Referencia</Text>
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{form.referencia || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1, minWidth: 120 }}>
                                                <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Troquel</Text>
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{form.lineaTroquel || '—'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={[styles.calculoResumenOp, { borderColor: modalPalette.cardBorder, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', marginBottom: 10 }]}>
                                        <Text style={{ color: modalPalette.helper, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
                                            Datos generales del proceso
                                        </Text>
                                        <View style={styles.calculoGrid}>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Colores</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.colores}
                                                    onChangeText={(v) => updateCalculoField('colores', v)}
                                                    placeholder="Pantones / descripción"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Cantidad tintas</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.cantidadTinta}
                                                    onChangeText={(v) => updateCalculoField('cantidadTinta', v)}
                                                    keyboardType="number-pad"
                                                    placeholder="OCR: Cantidad Tinta"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Calibre</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.calibre}
                                                    onChangeText={(v) => updateCalculoField('calibre', v)}
                                                    keyboardType="number-pad"
                                                    placeholder="ej. 16"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Gramaje (g)</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.gramaje}
                                                    onChangeText={(v) => updateCalculoField('gramaje', v)}
                                                    keyboardType="number-pad"
                                                    placeholder="ej. 270"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Sustrato</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.sustrato}
                                                    onChangeText={(v) => updateCalculoField('sustrato', v)}
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Ancho rollo</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.anchoRollo}
                                                    onChangeText={(v) => updateCalculoField('anchoRollo', v)}
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Largo corte</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.largoCorte}
                                                    onChangeText={(v) => updateCalculoField('largoCorte', v)}
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Ancho pliego</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.largo}
                                                    onChangeText={(v) => updateCalculoField('largo', v)}
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Alto pliego</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.ancho}
                                                    onChangeText={(v) => updateCalculoField('ancho', v)}
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Cantidad solicitada</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.cantidadSolicitada}
                                                    onChangeText={(v) => updateCalculoField('cantidadSolicitada', v)}
                                                    keyboardType="decimal-pad"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Cabidad (CB)</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.cabidad}
                                                    onChangeText={(v) => updateCalculoField('cabidad', v)}
                                                    keyboardType="decimal-pad"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Hojas</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.hojas}
                                                    onChangeText={(v) => updateCalculoField('hojas', v)}
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                            <View style={fieldStyle}>
                                                <Text style={labelStyle}>Tamaño final</Text>
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.tamanoFinal}
                                                    onChangeText={(v) => updateCalculoField('tamanoFinal', v)}
                                                    placeholder="35 x 58"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.calculoGrid}>
                                        {renderMaquinasCalculoSelector(
                                            'Máquinas de la programación',
                                            'Agregue máquinas con + Agregar en el orden del proceso (ej. 1A → 2A → 1B). Pulse un chip para editar; × para quitar.'
                                        )}
                                        {renderProcesosManualesSelector()}
                                    </View>

                                    {maqsCalc.length > 0 && calc.maquinaCalculoId ? (
                                    <>
                                    <Text style={{ color: modalPalette.helper, fontSize: 11, fontWeight: '700', marginBottom: 8, marginTop: 4 }}>
                                        Datos de la máquina seleccionada
                                    </Text>
                                    <View style={styles.calculoGrid}>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Tipo de trabajo</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                                    {TIPOS_TRABAJO.map((t) => (
                                                        <TouchableOpacity
                                                            key={t}
                                                            style={[styles.maquinaChip, calc.tipoTrabajo === t && styles.maquinaChipActive]}
                                                            onPress={() => updateCalculoField('tipoTrabajo', t)}
                                                        >
                                                            <Text style={[styles.maquinaChipText, { color: calc.tipoTrabajo === t ? '#FFF' : modalPalette.helper }]}>
                                                                {t}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    </View>

                                    <View style={styles.calculoGrid}>
                                        <View style={[fieldStyle, styles.formGridItemFull]}>
                                            <Text style={labelStyle}>Líneas de tiros (máquina)</Text>
                                            <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 6 }}>
                                                Una misma máquina puede tener varios trabajos (ej. tiros normales + fondos). Cada línea suma al total de horas.
                                            </Text>
                                            {(calc.lineasTiros || normalizeLineasTiros(calc)).map((linea, idx) => (
                                                <View
                                                    key={linea.id}
                                                    style={{
                                                        marginBottom: 8,
                                                        padding: 8,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: modalPalette.cardBorder,
                                                        backgroundColor: modalPalette.cardBg,
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                                                        <Text style={{ color: modalPalette.helper, fontSize: 11, width: 52 }}>Concepto</Text>
                                                        <TextInput
                                                            style={[themedInput, { flex: 1, height: 36 }]}
                                                            value={linea.concepto}
                                                            onChangeText={(v) => updateLineaTirosField(calc.maquinaCalculoId, linea.id, 'concepto', v)}
                                                            placeholder={`Línea ${idx + 1}`}
                                                            placeholderTextColor={modalPalette.helper}
                                                        />
                                                        {(normalizeLineasTiros(calc).length > 1) ? (
                                                            <TouchableOpacity
                                                                onPress={() => removeLineaTirosMaquina(calc.maquinaCalculoId, linea.id)}
                                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                            >
                                                                <Text style={{ color: '#F87171', fontWeight: '800', fontSize: 18 }}>×</Text>
                                                            </TouchableOpacity>
                                                        ) : null}
                                                    </View>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Tiros bruto</Text>
                                                            <TextInput
                                                                style={[themedInput, { height: 36 }]}
                                                                value={linea.tirosBruto}
                                                                onChangeText={(v) => updateLineaTirosField(calc.maquinaCalculoId, linea.id, 'tirosBruto', v)}
                                                                keyboardType="decimal-pad"
                                                                placeholder="0"
                                                                placeholderTextColor={modalPalette.helper}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Sobrante (−)</Text>
                                                            <TextInput
                                                                style={[themedInput, { height: 36 }]}
                                                                value={linea.sobrante}
                                                                onChangeText={(v) => updateLineaTirosField(calc.maquinaCalculoId, linea.id, 'sobrante', v)}
                                                                keyboardType="decimal-pad"
                                                                placeholder="0"
                                                                placeholderTextColor={modalPalette.helper}
                                                            />
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                            <TouchableOpacity
                                                onPress={() => addLineaTirosMaquina(calc.maquinaCalculoId)}
                                                style={[styles.maquinaChip, { alignSelf: 'flex-start', marginTop: 2 }]}
                                            >
                                                <Text style={[styles.maquinaChipText, { color: modalPalette.helper }]}>+ Línea de tiros</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Total tiros (suma líneas)</Text>
                                            <View style={[themedInput, { justifyContent: 'center', minHeight: 36 }]}>
                                                <Text style={{ color: '#4ADE80', fontWeight: '800' }}>
                                                    {Math.round(res.totalTiros).toLocaleString('es-CO')}
                                                </Text>
                                            </View>
                                            <Text style={{ color: modalPalette.helper, fontSize: 10, marginTop: 2 }}>
                                                Bruto − sobrante − restas
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.calculoGrid}>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Alistamiento (h)</Text>
                                            <TextInput
                                                style={themedInput}
                                                value={calc.alistamiento}
                                                onChangeText={(v) => updateCalculoField('alistamiento', v)}
                                                keyboardType="decimal-pad"
                                                placeholderTextColor={modalPalette.helper}
                                            />
                                        </View>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Lavada (h)</Text>
                                            <TextInput
                                                style={themedInput}
                                                value={calc.lavada}
                                                onChangeText={(v) => updateCalculoField('lavada', v)}
                                                keyboardType="decimal-pad"
                                                placeholderTextColor={modalPalette.helper}
                                            />
                                        </View>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}> </Text>
                                            <TouchableOpacity
                                                style={[styles.addAuxBtn, { alignSelf: 'flex-start', marginTop: 4 }]}
                                                onPress={persistCalculoParams}
                                                disabled={savingCalculoParams || !calc.maquinaCalculoId}
                                            >
                                                {savingCalculoParams
                                                    ? <ActivityIndicator color="#FFF" size="small" />
                                                    : <Text style={styles.addAuxBtnText}>Guardar params máquina</Text>}
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.calculoGrid}>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Resta tiros del programa</Text>
                                            {(Number(calc.tirosRegistrados) || 0) > 0 ? (
                                                <TouchableOpacity
                                                    style={[styles.maquinaChip, calc.usarTirosPrograma && styles.maquinaChipActive]}
                                                    onPress={() => updateCalculoField('usarTirosPrograma', !calc.usarTirosPrograma)}
                                                >
                                                    <Text style={[styles.maquinaChipText, { color: calc.usarTirosPrograma ? '#FFF' : modalPalette.helper }]}>
                                                        {calc.usarTirosPrograma
                                                            ? `Sí · ${calc.tirosRegistrados} tiros`
                                                            : 'No restar del programa'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <Text style={{ color: modalPalette.helper, fontSize: 12, marginTop: 6 }}>
                                                    Sin tiros registrados: no aplica restar.
                                                </Text>
                                            )}
                                        </View>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Resta manual de tiros</Text>
                                            {(Number(calc.tirosRegistrados) || 0) > 0 ? (
                                                <TextInput
                                                    style={themedInput}
                                                    value={calc.restaManualTiros}
                                                    onChangeText={(v) => updateCalculoField('restaManualTiros', v)}
                                                    keyboardType="decimal-pad"
                                                    placeholder="0"
                                                    placeholderTextColor={modalPalette.helper}
                                                />
                                            ) : (
                                                <Text style={{ color: modalPalette.helper, fontSize: 12, marginTop: 6 }}>
                                                    Solo disponible con tiros registrados.
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.calculoGrid}>
                                        <View style={[fieldStyle, { flex: 2, minWidth: 200 }]}>
                                            <Text style={labelStyle}>Concepto extras (ajeno al pedido)</Text>
                                            <TextInput
                                                style={themedInput}
                                                value={calc.extrasConcepto}
                                                onChangeText={(v) => updateCalculoField('extrasConcepto', v)}
                                                placeholder="Ej: Carta de color, pruebas, muestrario..."
                                                placeholderTextColor={modalPalette.helper}
                                            />
                                        </View>
                                        <View style={fieldStyle}>
                                            <Text style={labelStyle}>Tiros extras (+)</Text>
                                            <TextInput
                                                style={themedInput}
                                                value={calc.extrasTiros}
                                                onChangeText={(v) => updateCalculoField('extrasTiros', v)}
                                                keyboardType="decimal-pad"
                                                placeholder="0"
                                                placeholderTextColor={modalPalette.helper}
                                            />
                                        </View>
                                    </View>

                                    <View style={[styles.calculoResultRow, { borderTopColor: modalPalette.cardBorder }]}>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>Tiros brutos</Text>
                                            <Text style={[styles.calculoResultValue, { color: colors.text }]}>
                                                {Math.round(res.brutoTiros).toLocaleString('es-CO')}
                                            </Text>
                                        </View>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>Sobrante</Text>
                                            <Text style={[styles.calculoResultValue, { color: '#F59E0B' }]}>
                                                {Math.round(res.sobrante).toLocaleString('es-CO')}
                                            </Text>
                                        </View>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>Total tiros</Text>
                                            <Text style={[styles.calculoResultValue, { color: colors.text }]}>
                                                {Math.round(res.totalTiros).toLocaleString('es-CO')}
                                            </Text>
                                            <Text style={{ color: modalPalette.helper, fontSize: 10 }}>
                                                {res.extrasTiros > 0 ? `+ ${Math.round(res.extrasTiros).toLocaleString('es-CO')} extras` : 'Neto para PN'}
                                            </Text>
                                        </View>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>
                                                {speedMode ? 'Run/h' : 'Estándar/h'}
                                            </Text>
                                            <Text style={[styles.calculoResultValue, { color: '#60A5FA' }]}>
                                                {res.estandarPorHora.toLocaleString('es-CO')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.calculoResultRow, { borderTopWidth: 0, paddingTop: 0 }]}>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>Alistamiento</Text>
                                            <Text style={[styles.calculoResultValue, { color: '#FBBF24' }]}>
                                                {res.alistamiento.toFixed(2)} h
                                            </Text>
                                        </View>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>PN</Text>
                                            <Text style={[styles.calculoResultValue, { color: '#A78BFA' }]}>
                                                {res.pn.toFixed(2)} h
                                            </Text>
                                            {!speedMode ? null : (
                                                <Text style={{ color: modalPalette.helper, fontSize: 10 }}>Total tiros ÷ run</Text>
                                            )}
                                        </View>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>
                                                {esGuillotinaCalc ? 'Lavada / ajuste' : 'Lavada'}
                                            </Text>
                                            <Text style={[styles.calculoResultValue, { color: '#38BDF8' }]}>
                                                {res.lavada.toFixed(2)} h
                                            </Text>
                                        </View>
                                        <View style={styles.calculoResultItem}>
                                            <Text style={[styles.calculoResultLabel, { color: modalPalette.helper }]}>
                                                {speedMode ? 'Total tiempo' : 'Total horas ×1,1'}
                                            </Text>
                                            <Text style={[styles.calculoResultValue, { color: '#4ADE80', fontSize: 18 }]}>
                                                {res.totalHoras.toFixed(2)} h
                                            </Text>
                                            <Text style={{ color: modalPalette.helper, fontSize: 10 }}>
                                                {speedMode
                                                    ? 'Alistamiento + PN + lavada'
                                                    : `(${(res.alistamiento + res.pn + res.lavada).toFixed(2)} h base)`}
                                            </Text>
                                        </View>
                                    </View>
                                    </>
                                    ) : null}
                                </View>
                            );
                        })()}

                        </View>
                        )}

                        {formModalTab === 'procesos' && (
                        <View>
                        <Text style={[styles.fieldLabel, { marginTop: 4, color: modalPalette.label }]}>Procesos, fechas y horas</Text>
                        <Text style={{ color: modalPalette.helper, fontSize: 12, marginBottom: 10 }}>
                            {form.esUrgencia && !editingId
                                ? 'Marque los procesos que aplique. Si faltan fechas u horas, se usarán valores por defecto (hoy 8:00, 8 h).'
                                : 'Marque los procesos e indique inicio/fin con hora. Las fechas no se prellenan: elija el día en el calendario.'}
                        </Text>
                        {(form.calculo?.multiPieza && (form.calculo?.uniones || []).length > 0) ? (
                            <View style={{
                                marginBottom: 12,
                                padding: 10,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: modalPalette.cardBorder,
                                backgroundColor: modalPalette.cardBg,
                            }}
                            >
                                <Text style={[styles.fieldLabel, { color: modalPalette.label, marginBottom: 6 }]}>
                                    Uniones entre piezas
                                </Text>
                                {(form.calculo.uniones || []).map((union) => {
                                    const nombres = (union.piezaIds || [])
                                        .map((id) => form.calculo?.piezas?.[id]?.nombre || `Pieza ${id}`)
                                        .join(' + ');
                                    return (
                                        <TouchableOpacity
                                            key={union.procesoGantt}
                                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
                                            onPress={() => toggleUnionProceso(union.procesoGantt)}
                                        >
                                            <View style={[styles.checkBox, union.activo && styles.checkBoxActive, { marginRight: 8 }]}>
                                                <Text style={{ color: union.activo ? '#FFF' : modalPalette.helper, fontSize: 12 }}>
                                                    {union.activo ? '✓' : ''}
                                                </Text>
                                            </View>
                                            <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>
                                                Unir piezas en {union.procesoGantt}
                                                {nombres ? ` (${nombres})` : ''}
                                                {' — '}
                                                {union.activo ? 'suma tiempos' : 'tiempo mayor por pieza'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : null}

                        {procesoList.map((proceso) => {
                            const proc = form.procesosSeleccionados[proceso]
                                ?? getProcesoFormEntry();
                            return (
                                <View
                                    key={proceso}
                                    style={[
                                        styles.procesoBlock,
                                        { backgroundColor: modalPalette.cardBg, borderColor: modalPalette.cardBorder },
                                        proc.activo && styles.procesoBlockActive,
                                        proc.activo && { backgroundColor: modalPalette.cardBgActive },
                                    ]}
                                >
                                    <View style={styles.procesoFormRow}>
                                        <TouchableOpacity
                                            style={[styles.checkBox, proc.activo && styles.checkBoxActive]}
                                            onPress={() => updateProcesoField(proceso, 'activo', !proc.activo)}
                                        >
                                            <Text style={{ color: proc.activo ? '#FFF' : modalPalette.helper, fontSize: 12 }}>
                                                {proc.activo ? '✓' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                        <Text style={[styles.procesoFormName, { color: colors.text, opacity: proc.activo ? 1 : 0.5 }]}>
                                            {proceso}
                                            {proc.esUnion && proc.piezaIds?.length > 1 ? (
                                                <Text style={{ color: '#60A5FA', fontSize: 11 }}>
                                                    {' '}(unión {proc.piezaIds.map((id) => form.calculo?.piezas?.[id]?.nombre || id).join(' + ')})
                                                </Text>
                                            ) : proc.piezaId ? (
                                                <Text style={{ color: modalPalette.helper, fontSize: 11 }}>
                                                    {' '}({form.calculo?.piezas?.[proc.piezaId]?.nombre || `Pieza ${proc.piezaId}`})
                                                </Text>
                                            ) : null}
                                        </Text>
                                    </View>

                                    {proc.activo && (
                                        <View style={styles.procesoFields}>
                                            <View style={styles.timeRow}>
                                                <View style={styles.timeGroup}>
                                                    <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Inicio</Text>
                                                    <DateCalendarField
                                                        value={proc.fechaInicio || ''}
                                                        onChange={(v) => updateProcesoField(proceso, 'fechaInicio', v)}
                                                        style={themedDateInput}
                                                        isDarkMode={isDarkMode}
                                                        placeholderColor={modalPalette.helper}
                                                    />
                                                    <HourChipsScroller
                                                        chipKey={`si-${proceso}`}
                                                        selectedHour={proc.horaInicio}
                                                        helperColor={modalPalette.helper}
                                                        blockedHours={
                                                            proc.maquinaId
                                                                ? getHorasInicioBloqueadas(proc.maquinaId, proc.fechaInicio, editingId)
                                                                : null
                                                        }
                                                        onSelect={(h) => updateProcesoField(proceso, 'horaInicio', h)}
                                                    />
                                                </View>

                                                <Text style={{ color: modalPalette.helper, marginTop: 20 }}>→</Text>

                                                <View style={styles.timeGroup}>
                                                    <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Fin</Text>
                                                    <DateCalendarField
                                                        value={proc.fechaFin || ''}
                                                        onChange={(v) => updateProcesoField(proceso, 'fechaFin', v)}
                                                        style={themedDateInput}
                                                        isDarkMode={isDarkMode}
                                                        placeholderColor={modalPalette.helper}
                                                    />
                                                    <HourChipsScroller
                                                        chipKey={`sf-${proceso}`}
                                                        selectedHour={proc.horaFin}
                                                        helperColor={modalPalette.helper}
                                                        blockedHours={
                                                            proc.maquinaId
                                                                ? getHorasFinBloqueadas(
                                                                    proc.maquinaId,
                                                                    proc.fechaInicio,
                                                                    proc.horaInicio,
                                                                    proc.fechaFin,
                                                                    editingId
                                                                )
                                                                : null
                                                        }
                                                        onSelect={(h) => updateProcesoField(proceso, 'horaFin', h)}
                                                    />
                                                </View>
                                            </View>
                                            <Text style={{ color: modalPalette.helper, fontSize: 10, marginTop: 4, lineHeight: 14 }}>
                                                Las 14:00 se pueden elegir: como Fin = cierra T1 (6am–2pm); como Inicio = arranca T4 (2pm–10pm). Es el cambio de turno.
                                            </Text>
                                            {(() => {
                                                const info = analyzeHorarioVsTurnos(proc, coberturaRoster[proceso]?.turnos || []);
                                                if (!info || (!info.tieneFueraDeTurno && !info.tieneRecargoNocturno && !info.tieneCruceTurno)) return null;
                                                const alertaFuerte = info.tieneFueraDeTurno;
                                                return (
                                                    <View style={{
                                                        marginTop: 8,
                                                        padding: 10,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: alertaFuerte ? '#F59E0B' : '#818CF8',
                                                        backgroundColor: isDarkMode
                                                            ? (alertaFuerte ? '#422006' : '#1E1B4B')
                                                            : (alertaFuerte ? '#FFFBEB' : '#EEF2FF'),
                                                    }}
                                                    >
                                                        <Text style={{
                                                            color: alertaFuerte ? '#FBBF24' : '#A5B4FC',
                                                            fontSize: 12,
                                                            fontWeight: '700',
                                                            marginBottom: 4,
                                                        }}
                                                        >
                                                            {info.tieneFueraDeTurno
                                                                ? 'Horario fuera de turno (posible hora extra)'
                                                                : info.tieneCruceTurno
                                                                    ? 'El horario cruza a otro turno'
                                                                    : 'Recargo nocturno en el horario seleccionado'}
                                                        </Text>
                                                        {info.tieneCruceTurno && info.primerTurno ? (
                                                            <Text style={{ color: isDarkMode ? '#C7D2FE' : '#3730A3', fontSize: 11, lineHeight: 15, marginBottom: 4 }}>
                                                                Supera el turno inicial T{info.primerTurno.codigo || ''} {info.primerTurno.inicio}–{info.primerTurno.fin}
                                                                {' '}({info.primerTurno.nombre || 'turno de inicio'}).
                                                                {' '}Hay {info.horasOtroTurno} h en otro(s) turno(s) de la máquina (otro personal / ventana).
                                                            </Text>
                                                        ) : null}
                                                        {info.tieneFueraDeTurno ? (
                                                            <View style={{ marginBottom: info.tieneRecargoNocturno ? 6 : 0 }}>
                                                                <Text style={{ color: isDarkMode ? '#FDE68A' : '#92400E', fontSize: 11, lineHeight: 15 }}>
                                                                    Tiempo fuera de los turnos configurados.
                                                                    {' '}En turno: {info.horasEnTurno} h · Fuera de turno (HE): {info.horasExtra} h.
                                                                </Text>
                                                                {info.turnosReferencia?.length ? (
                                                                    <Text style={{ color: isDarkMode ? '#FDE68A' : '#92400E', fontSize: 11, marginTop: 2 }}>
                                                                        Turnos de referencia: {info.turnosReferencia.map((t) => `${t.inicio}–${t.fin}`).join(', ')}.
                                                                    </Text>
                                                                ) : null}
                                                            </View>
                                                        ) : null}
                                                        {info.tieneRecargoNocturno ? (
                                                            <Text style={{
                                                                color: isDarkMode ? '#C7D2FE' : '#3730A3',
                                                                fontSize: 11,
                                                                lineHeight: 15,
                                                                marginTop: (info.tieneFueraDeTurno || info.tieneCruceTurno) ? 6 : 0,
                                                            }}
                                                            >
                                                                Recargo nocturno (19:00–06:00): {info.horasRecargoNocturno} h
                                                                {info.horasRecargoNocturnoExtra > 0
                                                                    ? ` (de las cuales ${info.horasRecargoNocturnoExtra} h son también fuera de turno / HE nocturna).`
                                                                    : ' (dentro de turno habilitado, aplica recargo nocturno ordinario).'}
                                                            </Text>
                                                        ) : null}
                                                        <Text style={{ color: modalPalette.helper, fontSize: 10, marginTop: 6, fontStyle: 'italic' }}>
                                                            Aviso informativo para planeación; no bloquea el guardado. El reparto visual sigue el Inicio/Fin que eligió.
                                                        </Text>
                                                    </View>
                                                );
                                            })()}

                                            <View style={styles.horasEstimadasRow}>
                                                <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Horas de trabajo *</Text>
                                                <TextInput
                                                    style={[...themedDateInput, { width: 100 }]}
                                                    value={proc.horasEstimadas || ''}
                                                    onChangeText={(v) => updateProcesoField(proceso, 'horasEstimadas', v)}
                                                    placeholder="Ej: 8"
                                                    placeholderTextColor={modalPalette.helper}
                                                    keyboardType="decimal-pad"
                                                />
                                            </View>
                                            {(() => {
                                                const { base, aux, total } = getHorasEfectivasProceso(proc);
                                                if (!(aux > 0) || !(base > 0)) return null;
                                                return (
                                                    <Text style={{ color: '#A5B4FC', fontSize: 11, marginTop: 2 }}>
                                                        Total a programar: {total} h (trabajo {base} + auxiliares {aux})
                                                    </Text>
                                                );
                                            })()}
                                            {(() => {
                                                const { total } = getHorasEfectivasProceso(proc);
                                                if (!(total > 0)) return null;
                                                const modo = proc.repartoContinuacion === 'siguiente_dia'
                                                    ? 'siguiente_dia'
                                                    : proc.repartoContinuacion === 'siguiente_turno_dia_siguiente'
                                                        ? 'siguiente_turno_dia_siguiente'
                                                        : 'siguiente_turno';
                                                const btnStyle = (active) => ({
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 7,
                                                    borderRadius: 8,
                                                    backgroundColor: active ? '#4F46E5' : (isDarkMode ? '#1E293B' : '#E2E8F0'),
                                                    borderWidth: 1,
                                                    borderColor: active ? '#6366F1' : (isDarkMode ? '#334155' : '#CBD5E1'),
                                                });
                                                const btnText = (active) => ({
                                                    color: active ? '#FFF' : modalPalette.helper,
                                                    fontSize: 11,
                                                    fontWeight: '600',
                                                });
                                                return (
                                                    <View style={{
                                                        marginTop: 8,
                                                        padding: 8,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                                                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                                    }}
                                                    >
                                                        <Text style={{ color: modalPalette.helper, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                                                            Reparto si el trabajo no cabe en el turno actual ({total} h)
                                                        </Text>
                                                        <Text style={{ color: modalPalette.helper, fontSize: 10, marginBottom: 6, lineHeight: 14 }}>
                                                            Por defecto continúa en el siguiente turno del mismo día y, si hace falta, al día siguiente dentro del horario del roster (no hora extra).
                                                        </Text>
                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                            <TouchableOpacity
                                                                style={btnStyle(modo === 'siguiente_turno')}
                                                                onPress={() => setRepartoContinuacion(proceso, 'siguiente_turno')}
                                                            >
                                                                <Text style={btnText(modo === 'siguiente_turno')}>
                                                                    Siguiente turno del mismo día
                                                                </Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={btnStyle(modo === 'siguiente_dia')}
                                                                onPress={() => setRepartoContinuacion(proceso, 'siguiente_dia')}
                                                            >
                                                                <Text style={btnText(modo === 'siguiente_dia')}>
                                                                    Mismo turno del día siguiente
                                                                </Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={btnStyle(modo === 'siguiente_turno_dia_siguiente')}
                                                                onPress={() => setRepartoContinuacion(proceso, 'siguiente_turno_dia_siguiente')}
                                                            >
                                                                <Text style={btnText(modo === 'siguiente_turno_dia_siguiente')}>
                                                                    Siguiente turno del día siguiente
                                                                </Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            })()}
                                            {getHorasEfectivasProceso(proc).total > 8 && proc.rosterMeta?.mensaje ? (
                                                <Text style={{
                                                    color: proc.rosterMeta.continuesNextDay ? '#FBBF24' : modalPalette.helper,
                                                    fontSize: 11,
                                                    marginTop: 4,
                                                    marginBottom: 4,
                                                    lineHeight: 15,
                                                }}
                                                >
                                                    {proc.rosterMeta.mensaje}
                                                </Text>
                                            ) : null}
                                            {(() => {
                                                const turnosProc = coberturaRoster[proceso]?.turnos || [];
                                                const segs = resolveRepartoSegmentsForProc(proc, turnosProc);
                                                if (!segs.length) return null;
                                                return (
                                                    <RepartoTurnosVisual
                                                        segments={segs}
                                                        isDarkMode={isDarkMode}
                                                        helperColor={modalPalette.helper}
                                                        textColor={colors.text}
                                                    />
                                                );
                                            })()}

                                            {(() => {
                                                const maqsProc = getMaquinasUiProceso(proceso, maquinas, proc.maquinaId);
                                                const soloSinMaquina = procesoRequiereSinMaquina(proceso);
                                                if (soloSinMaquina) {
                                                    return (
                                                        <View style={{ marginTop: 10 }}>
                                                            <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Máquina asignada</Text>
                                                            <Text style={{ color: modalPalette.helper, fontSize: 12, marginTop: 4 }}>
                                                                Este proceso no usa máquina (solo tiempos / personal).
                                                            </Text>
                                                        </View>
                                                    );
                                                }
                                                if (maquinas.length === 0) return null;
                                                return (
                                                <View style={{ marginTop: 10 }}>
                                                    <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Máquina asignada</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                                                        <View style={styles.maquinaPickerRow}>
                                                            <TouchableOpacity
                                                                style={[styles.maquinaChip, !proc.maquinaId && styles.maquinaChipActive]}
                                                                onPress={() => updateProcesoField(proceso, 'maquinaId', null)}
                                                            >
                                                                <Text style={[styles.maquinaChipText, { color: modalPalette.helper }, !proc.maquinaId && { color: '#FFF' }]}>
                                                                    Sin máquina
                                                                </Text>
                                                            </TouchableOpacity>
                                                            {maqsProc.map((m) => {
                                                                const inicioMs = new Date(buildDateTime(proc.fechaInicio, proc.horaInicio)).getTime();
                                                                const finMs = new Date(buildDateTime(proc.fechaFin, proc.horaFin)).getTime();
                                                                const ocupadaPor = getOcupacionMaquina(m.id, inicioMs, finMs, editingId);
                                                                const selected = proc.maquinaId === m.id;
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={`maq-${m.id}`}
                                                                        style={[
                                                                            styles.maquinaChip,
                                                                            ocupadaPor && styles.maquinaChipBusy,
                                                                            selected && styles.maquinaChipActive,
                                                                        ]}
                                                                        onPress={() => updateProcesoField(proceso, 'maquinaId', selected ? null : m.id)}
                                                                    >
                                                                        <Text style={[styles.maquinaChipText, { color: modalPalette.helper }, selected && { color: '#FFF' }]}>
                                                                            {m.nombre}
                                                                        </Text>
                                                                        <Text style={[styles.maquinaChipStatus, { color: ocupadaPor ? '#F87171' : '#4ADE80' }]}>
                                                                            {ocupadaPor ? `Ocupada · OP ${ocupadaPor}` : 'Libre'}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    </ScrollView>
                                                    {maqsProc.length === 0 ? (
                                                        <Text style={{ color: '#F59E0B', fontSize: 11, marginTop: 6 }}>
                                                            No hay máquinas del catálogo para este proceso.
                                                        </Text>
                                                    ) : null}
                                                    {proc.maquinaId && (coberturaRoster[proceso] || proc.rosterMeta?.segments?.length) ? (
                                                        <View style={{
                                                            marginTop: 8,
                                                            padding: 8,
                                                            borderRadius: 8,
                                                            borderWidth: 1,
                                                            borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                                                            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                                        }}>
                                                            <Text style={{ color: modalPalette.helper, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                                                                Roster (máquina ↔ turnos ↔ personal)
                                                            </Text>
                                                            {(() => {
                                                                const fmtMin = (min) => {
                                                                    const h = Math.floor(min / 60);
                                                                    const m = min % 60;
                                                                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                                };
                                                                const turnos = coberturaRoster[proceso]?.turnos || [];
                                                                const segs = resolveRepartoSegmentsForProc(proc, turnos);

                                                                // Preferir los segmentos del reparto (todos los días/turnos usados)
                                                                const filas = segs.length > 0
                                                                    ? segs.map((seg, idx) => ({
                                                                        key: `seg-${seg.fecha}-${seg.startMin}-${idx}`,
                                                                        titulo: seg.fueraDeTurno
                                                                            ? `${seg.fecha} · Fuera de turno / HE (${fmtMin(seg.startMin)}–${fmtMin(seg.endMin)})`
                                                                            : `${seg.fecha} · T${seg.codigo || idx + 1}${seg.nombre ? ` ${seg.nombre}` : ''} (${fmtMin(seg.ventanaInicioMin ?? seg.startMin)}–${fmtMin(seg.ventanaFinMin ?? seg.endMin)})`,
                                                                        ocupado: `${fmtMin(seg.startMin)}–${fmtMin(seg.endMin)}`,
                                                                        personas: seg.personas || [],
                                                                        he: !!seg.fueraDeTurno,
                                                                    }))
                                                                    : filterTurnosParaVentana(
                                                                        turnos,
                                                                        proc.fechaInicio,
                                                                        proc.horaInicio,
                                                                        proc.fechaFin,
                                                                        proc.horaFin
                                                                    ).map((t) => ({
                                                                            key: `${t.fechaDia}-${t.horarioId}`,
                                                                            titulo: `${t.fechaDia} · T${t.codigo} ${t.nombre} (${t.inicio}–${t.fin})`,
                                                                            ocupado: null,
                                                                            personas: t.personas || [],
                                                                        }));

                                                                if (filas.length === 0) {
                                                                    return (
                                                                        <Text style={{ color: modalPalette.helper, fontSize: 12 }}>
                                                                            Sin turnos asignados
                                                                        </Text>
                                                                    );
                                                                }

                                                                return filas.map((fila) => {
                                                                    const ops = (fila.personas || []).filter((x) => !x.esAuxiliar);
                                                                    const auxs = (fila.personas || []).filter((x) => x.esAuxiliar);
                                                                    return (
                                                                        <View key={fila.key} style={{ marginBottom: 6 }}>
                                                                            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>
                                                                                {fila.titulo}
                                                                                {fila.ocupado ? ` · ocupado ${fila.ocupado}` : ''}
                                                                            </Text>
                                                                            {ops.length === 0 && auxs.length === 0 ? (
                                                                                <Text style={{ color: modalPalette.helper, fontSize: 11, marginLeft: 4, fontStyle: 'italic' }}>
                                                                                    Sin operario asignado
                                                                                </Text>
                                                                            ) : null}
                                                                            {ops.map((p) => (
                                                                                <Text
                                                                                    key={`op-${fila.key}-${p.usuarioId || p.nombre}`}
                                                                                    style={{
                                                                                        color: p.novedad ? '#FBBF24' : '#86EFAC',
                                                                                        fontSize: 11,
                                                                                        marginLeft: 4,
                                                                                    }}
                                                                                >
                                                                                    Op: {p.nombre}{fila.he ? ' (HE)' : ''}
                                                                                    {p.novedad ? ` ⚠ ${p.novedad.label || p.novedad.tipo}` : ''}
                                                                                </Text>
                                                                            ))}
                                                                            {auxs.map((p) => (
                                                                                <Text
                                                                                    key={`ax-${fila.key}-${p.usuarioId || p.nombre}`}
                                                                                    style={{
                                                                                        color: p.novedad ? '#FBBF24' : '#5EEAD4',
                                                                                        fontSize: 11,
                                                                                        marginLeft: 4,
                                                                                    }}
                                                                                >
                                                                                    Ax: {p.nombre}
                                                                                    {p.novedad ? ` ⚠ ${p.novedad.label || p.novedad.tipo}` : ''}
                                                                                </Text>
                                                                            ))}
                                                                        </View>
                                                                    );
                                                                });
                                                            })()}
                                                        </View>
                                                    ) : null}
                                                </View>
                                                );
                                            })()}

                                            <View style={[styles.auxSection, { borderTopColor: modalPalette.cardBorder }]}>
                                                <View style={styles.auxHeader}>
                                                    <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Tiempos auxiliares</Text>
                                                    <TouchableOpacity style={styles.addAuxBtn} onPress={() => addTiempoAuxiliar(proceso)}>
                                                        <Text style={styles.addAuxBtnText}>+ Añadir</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {(proc.tiemposAuxiliares || []).length === 0 ? (
                                                    <Text style={{ color: modalPalette.helper, fontSize: 11, fontStyle: 'italic' }}>
                                                        Ej: montaje, limpieza, puesta a punto...
                                                    </Text>
                                                ) : (
                                                    proc.tiemposAuxiliares.map((aux) => (
                                                        <View key={aux.id} style={styles.auxRow}>
                                                            <TextInput
                                                                style={[...themedDateInput, { flex: 2 }]}
                                                                value={aux.descripcion || ''}
                                                                onChangeText={(v) => updateTiempoAuxiliar(proceso, aux.id, 'descripcion', v)}
                                                                placeholder="Descripción"
                                                                placeholderTextColor={modalPalette.helper}
                                                            />
                                                            <TextInput
                                                                style={[...themedDateInput, { width: 70 }]}
                                                                value={aux.horas || ''}
                                                                onChangeText={(v) => updateTiempoAuxiliar(proceso, aux.id, 'horas', v)}
                                                                placeholder="Hrs"
                                                                placeholderTextColor={modalPalette.helper}
                                                                keyboardType="decimal-pad"
                                                            />
                                                            <TouchableOpacity onPress={() => removeTiempoAuxiliar(proceso, aux.id)}>
                                                                <Text style={{ color: '#EF4444', fontSize: 18, padding: 4 }}>✕</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))
                                                )}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        {form.esUrgencia && !editingId && renderUrgencyPreviewCta(true)}

                        </View>
                        )}
                    </ScrollView>

                        <View style={[styles.modalButtons, { borderTopColor: modalPalette.cardBorder }]}>
                            {!!saveError && (
                                <View style={{ flexBasis: '100%', width: '100%', marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2', borderWidth: 1, borderColor: '#EF4444' }}>
                                    <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '600' }}>{saveError}</Text>
                                </View>
                            )}
                            {pasoMissing.length > 0 && !isUrgencyFlow ? (
                                <View style={{ flexBasis: '100%', width: '100%', marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#3F1F0A' : '#FFF7ED', borderWidth: 1, borderColor: '#F59E0B' }}>
                                    <Text style={{ color: isDarkMode ? '#FDE68A' : '#92400E', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                                        {formModalTab === 'procesos'
                                            ? 'Complete las fechas y horarios antes de guardar'
                                            : 'Complete los campos para continuar (observaciones opcionales)'}
                                    </Text>
                                    <Text style={{ color: isDarkMode ? '#FDE68A' : '#92400E', fontSize: 11 }}>
                                        Falta: {pasoMissing.slice(0, 6).join(', ')}
                                        {pasoMissing.length > 6 ? ` (+${pasoMissing.length - 6})` : ''}
                                    </Text>
                                </View>
                            ) : null}
                            {formModalTab !== 'datos' && (
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4A5568' }]}
                                    onPress={() => {
                                        if (formModalTab === 'procesos') setFormModalTab('calculo');
                                        else if (formModalTab === 'calculo') setFormModalTab('datos');
                                    }}
                                >
                                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Paso anterior</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.modalBtn,
                                    { backgroundColor: '#4F46E5' },
                                    !canAdvancePaso && { opacity: 0.45 },
                                ]}
                                onPress={() => {
                                    if (form.esUrgencia && !editingId) {
                                        if (formModalTab === 'datos') setFormModalTab('calculo');
                                        else if (formModalTab === 'calculo') goToProcesosTab();
                                        else handleSave();
                                        return;
                                    }
                                    if (formModalTab === 'datos') {
                                        const missing = getDatosPasoMissing(form);
                                        if (missing.length) {
                                            showAppAlert('Campos incompletos', `Complete: ${missing.join(', ')}.`);
                                            return;
                                        }
                                        setFormModalTab('calculo');
                                        return;
                                    }
                                    if (formModalTab === 'calculo') {
                                        const missing = getCalculoPasoMissing(form, parametrosCalculo, procesoList, opDatos?.procesosSugeridos || []);
                                        if (missing.length) {
                                            showAppAlert('Campos incompletos', `Complete: ${missing.join(', ')}.`);
                                            return;
                                        }
                                        goToProcesosTab();
                                        return;
                                    }
                                    const missingProcesos = getProcesosPasoMissing(form, procesoList);
                                    if (missingProcesos.length) {
                                        showAppAlert('Campos incompletos', `Complete: ${missingProcesos.join(', ')}.`);
                                        return;
                                    }
                                    handleSave();
                                }}
                                disabled={!canAdvancePaso || (saving && formModalTab === 'procesos')}
                            >
                                {saving && formModalTab === 'procesos' ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.modalBtnText}>
                                        {formModalTab === 'procesos'
                                            ? (form.esUrgencia && !editingId ? 'Confirmar urgencia' : 'Guardar')
                                            : 'Siguiente'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            {editingId && formModalTab === 'procesos' && (
                                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#DC2626' }]} onPress={() => handleDelete(editingId)}>
                                    <Text style={styles.modalBtnText}>Eliminar</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4A5568' }]}
                                onPress={() => { setUrgencyPreview(null); setShowModal(false); }}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                </View>
            </View>
        </Modal>
        );
    };

    const renderListView = () => (
        <ScrollView style={styles.listWrapper}>
            {filteredProgramaciones.length === 0 ? (
                <Text style={{ color: colors.subText, textAlign: 'center', marginTop: 40 }}>
                    No hay programaciones que coincidan con los filtros.
                </Text>
            ) : (
                filteredProgramaciones.map((prog) => {
                    const estadoCfg = ESTADO_GENERAL_CONFIG[prog.estadoGeneral] || ESTADO_GENERAL_CONFIG.programado;
                    const isSelected = selectedProgramacion?.id === prog.id;
                    const inicio = prog.procesos?.[0]?.fechaInicio;
                    const fin = prog.procesos?.[prog.procesos.length - 1]?.fechaFin;
                    const procesosOrdenados = getActiveOrderedProcesos(prog, procesoList);
                    const doneCount = procesosOrdenados.filter((p) => p.estado === 'completado').length;
                    const entrega = fechaEntregaFromProgramacion(prog);
                    const diasEntrega = entrega ? diasHastaEntrega(entrega) : null;
                    const entregaColor = entregaBadgeColor(diasEntrega);
                    return (
                        <TouchableOpacity
                            key={prog.id}
                            style={[
                                styles.listRow,
                                {
                                    backgroundColor: isSelected ? '#1E40AF33' : (isDarkMode ? '#111827' : '#FFFFFF'),
                                    borderColor: isSelected ? '#3B82F6' : colors.border,
                                },
                            ]}
                            onPress={() => setSelectedId(prog.id)}
                            onLongPress={() => openEditModal(prog)}
                        >
                            <View style={[styles.colorDot, { backgroundColor: prog.color || '#3B82F6', marginTop: 4 }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.listOp, { color: colors.text }]}>
                                    OP {prog.numeroOP} {prog.esUrgencia ? '⚡' : ''}
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 12 }}>
                                    {prog.cliente || '—'} · OT {prog.numeroOT || '—'} · LT {prog.lineaTroquel || '—'}
                                </Text>
                                <Text style={{ color: colors.subText, fontSize: 11 }}>
                                    {prog.referencia || 'Sin referencia'} · {prog.progresoGeneral || 0}% · {formatDateTime(inicio)} – {formatDateTime(fin)}
                                </Text>
                                {entrega ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        <Text style={{ color: colors.subText, fontSize: 11 }}>
                                            Entrega: {formatFechaEntregaDisplay(entrega)}
                                        </Text>
                                        <View style={{
                                            backgroundColor: entregaColor + '22',
                                            borderRadius: 6,
                                            paddingHorizontal: 6,
                                            paddingVertical: 2,
                                        }}
                                        >
                                            <Text style={{ color: entregaColor, fontSize: 10, fontWeight: '700' }}>
                                                {formatEntregaCountdown(diasEntrega)}
                                            </Text>
                                        </View>
                                    </View>
                                ) : null}
                                {procesosOrdenados.length > 0 ? (
                                    <>
                                        <Text style={{ color: colors.subText, fontSize: 10, marginTop: 6, marginBottom: 2 }}>
                                            Procesos ({doneCount}/{procesosOrdenados.length} completados)
                                        </Text>
                                        <ListaProcesosChecklist procesos={procesosOrdenados} isDarkMode={isDarkMode} />
                                    </>
                                ) : null}
                            </View>
                            <View style={[styles.listEstadoBadge, { backgroundColor: estadoCfg.color + '22', alignSelf: 'flex-start', marginTop: 2 }]}>
                                <Text style={{ color: estadoCfg.color, fontSize: 11, fontWeight: '700' }}>{estadoCfg.label}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}
        </ScrollView>
    );

    const renderProcesoCatalogModal = () => {
        if (!showProcesoCatalogModal) return null;
        const modalPalette = {
            label: isDarkMode ? '#CBD5E0' : '#334155',
            helper: isDarkMode ? '#718096' : '#64748B',
            inputBg: isDarkMode ? '#2D3748' : '#F8FAFC',
            inputBorder: isDarkMode ? '#4A5568' : '#CBD5E1',
            inputText: isDarkMode ? '#FFFFFF' : '#0F172A',
        };
        const themedInput = [styles.input, {
            backgroundColor: modalPalette.inputBg,
            borderColor: modalPalette.inputBorder,
            color: modalPalette.inputText,
        }];

        return (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowProcesoCatalogModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.activityModalContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {procesoCatalogForm.id ? 'Editar proceso' : 'Nuevo proceso'}
                        </Text>
                        <Text style={{ color: modalPalette.helper, fontSize: 12, marginBottom: 12 }}>
                            Define el nombre del proceso productivo. El orden se ajusta arrastrando las tarjetas en el Gantt.
                        </Text>
                        <Text style={[styles.fieldLabel, { color: modalPalette.label }]}>Nombre del proceso *</Text>
                        <TextInput
                            style={themedInput}
                            placeholder="Ej: Corte, Troquelado..."
                            placeholderTextColor={modalPalette.helper}
                            value={procesoCatalogForm.nombre}
                            onChangeText={(v) => setProcesoCatalogForm((f) => ({ ...f, nombre: v }))}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                                onPress={() => setShowProcesoCatalogModal(false)}
                            >
                                <Text style={styles.modalBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#4F46E5' }]}
                                onPress={handleSaveProcesoCatalog}
                                disabled={savingProcesoCatalog}
                            >
                                {savingProcesoCatalog
                                    ? <ActivityIndicator color="#FFF" size="small" />
                                    : <Text style={styles.modalBtnText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderAuxConfirmModal = () => {
        if (!auxConfirm) return null;
        const modalPalette = {
            helper: isDarkMode ? '#718096' : '#64748B',
            inputBg: isDarkMode ? '#2D3748' : '#F8FAFC',
            inputBorder: isDarkMode ? '#4A5568' : '#CBD5E1',
            inputText: isDarkMode ? '#FFFFFF' : '#0F172A',
        };
        const themedDateInput = [styles.dateInput, {
            backgroundColor: modalPalette.inputBg,
            borderColor: modalPalette.inputBorder,
            color: modalPalette.inputText,
        }];

        return (
            <Modal visible transparent animationType="fade" onRequestClose={() => setAuxConfirm(null)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.activityModalContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: auxConfirm.aux.color }]}>
                            {auxConfirm.aux.icon} {auxConfirm.aux.label} · {auxConfirm.proceso}
                        </Text>
                        <Text style={{ color: modalPalette.helper, fontSize: 12, marginBottom: 12 }}>
                            Ajuste fecha, hora y duración. Si hay OPs en ese horario, se correrán automáticamente.
                        </Text>

                        <View style={styles.timeRow}>
                            <View style={styles.timeGroup}>
                                <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Fecha inicio</Text>
                                <DateCalendarField
                                    value={auxConfirm.fecha}
                                    onChange={(v) => setAuxConfirm((f) => ({ ...f, fecha: v }))}
                                    style={themedDateInput}
                                    isDarkMode={isDarkMode}
                                    placeholderColor={modalPalette.helper}
                                />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                                    <View style={styles.hourPickerRow}>
                                        {HOUR_OPTIONS.map((h) => (
                                            <TouchableOpacity
                                                key={`aux-h-${h.value}`}
                                                style={[styles.hourChip, auxConfirm.hora === h.value && styles.hourChipActive]}
                                                onPress={() => setAuxConfirm((f) => ({ ...f, hora: h.value }))}
                                            >
                                                <Text style={[styles.hourChipText, auxConfirm.hora === h.value && { color: '#FFF' }]}>
                                                    {h.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                                <View style={[styles.hourPickerRow, { marginTop: 6 }]}>
                                    {[0, 30].map((m) => (
                                        <TouchableOpacity
                                            key={`aux-m-${m}`}
                                            style={[styles.hourChip, auxConfirm.minutos === m && styles.hourChipActive]}
                                            onPress={() => setAuxConfirm((f) => ({ ...f, minutos: m }))}
                                        >
                                            <Text style={[styles.hourChipText, auxConfirm.minutos === m && { color: '#FFF' }]}>
                                                :{String(m).padStart(2, '0')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={styles.horasEstimadasRow}>
                            <Text style={[styles.timeLabel, { color: modalPalette.helper }]}>Duración (horas)</Text>
                            <TextInput
                                style={[...themedDateInput, { width: 100 }]}
                                value={auxConfirm.duracion}
                                onChangeText={(v) => setAuxConfirm((f) => ({ ...f, duracion: v }))}
                                keyboardType="decimal-pad"
                                placeholderTextColor={modalPalette.helper}
                            />
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: auxConfirm.aux.color }]}
                                onPress={handleConfirmAuxDrop}
                                disabled={savingAux}
                            >
                                {savingAux ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>Guardar</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4A5568' }]}
                                onPress={() => setAuxConfirm(null)}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.subText }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderMetaFacturacionModal = () => {
        if (!showMetaModal || !rangeDates.length) return null;
        const anio = rangeDates[0].getFullYear();
        const mesNom = MESES[rangeDates[0].getMonth()];
        const nSem = weekGroups.length || 1;
        const draft = parseFloat(String(metaMensualDraft).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        const porSemana = draft / nSem;

        return (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowMetaModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.activityModalContent, { backgroundColor: isDarkMode ? '#1A202C' : '#FFF' }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            Meta de facturación · {mesNom} {anio}
                        </Text>
                        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                            La meta mensual se divide en partes iguales entre las {nSem} semanas (meta base).
                            Si una semana cierra sin cumplir, su faltante se arrastra completo a la siguiente:
                            meta total = meta base + arrastre acumulado. Ej.: mes $ 1.000 M en 2 sem → base $ 500 M;
                            si en S1 solo se generó $ 100 M, falta $ 400 M y en S2 la meta total será $ 900 M ($ 500 + $ 400).
                        </Text>
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Meta mensual ($)</Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: isDarkMode ? '#2D3748' : '#F8FAFC',
                                borderColor: isDarkMode ? '#4A5568' : '#CBD5E1',
                                color: isDarkMode ? '#FFF' : '#0F172A',
                            }]}
                            value={metaMensualDraft}
                            onChangeText={setMetaMensualDraft}
                            keyboardType="numeric"
                            placeholder="Ej: 80000000"
                            placeholderTextColor="#718096"
                            autoFocus
                        />
                        {draft > 0 && (
                            <Text style={{ color: colors.subText, fontSize: 12, marginTop: 8 }}>
                                Base por semana: {formatMoney(porSemana)}
                            </Text>
                        )}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                                onPress={() => setShowMetaModal(false)}
                            >
                                <Text style={styles.modalBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#0D9488' }]}
                                onPress={handleSaveMetaMensual}
                                disabled={savingMeta}
                            >
                                {savingMeta
                                    ? <ActivityIndicator color="#FFF" size="small" />
                                    : <Text style={styles.modalBtnText}>Guardar meta</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderUrgencyPreviewDock = () => {
        if (!urgencyPreview || showModal) return null;
        const draft = urgencyPreview.draft;
        const procNames = (draft.procesos || []).map((p) => p.proceso).join(', ');

        return (
            <View style={styles.urgencyPreviewDock}>
                <View style={styles.urgencyPreviewDockInfo}>
                    <Text style={styles.urgencyPreviewDockTitle}>⚡ Vista previa de urgencia</Text>
                    <Text style={styles.urgencyPreviewDockMeta} numberOfLines={1}>
                        {draft.numeroOP} · OT {draft.numeroOT} · {draft.cliente}
                        {procNames ? ` · ${procNames}` : ''}
                    </Text>
                    <Text style={styles.urgencyPreviewDockHint}>
                        La barra roja es la urgencia. Las demás OP se ajustaron temporalmente hasta confirmar.
                    </Text>
                </View>
                <View style={styles.urgencyPreviewDockActions}>
                    <TouchableOpacity style={styles.urgencyDockBtnSecondary} onPress={handleReopenUrgencyEdit}>
                        <Text style={styles.urgencyDockBtnSecondaryText}>✎ Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.urgencyDockBtnPrimary} onPress={handleSave} disabled={saving}>
                        {saving
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <Text style={styles.urgencyDockBtnPrimaryText}>Confirmar urgencia</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.urgencyDockBtnCancel} onPress={handleCancelUrgencyFlow}>
                        <Text style={styles.urgencyDockBtnCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading && programaciones.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb, { backgroundColor: colors.background }]}>
            {renderToolbar()}

            {backendUnavailable && (
                <View style={styles.backendBanner}>
                    <Text style={styles.backendBannerText}>
                        Backend sin API de programación OP. Reinicie dotnet en carpeta backend.
                    </Text>
                </View>
            )}

            {urgencyPreview && !showModal && (
                <View style={styles.urgencyPreviewToolbarBanner}>
                    <Text style={styles.urgencyPreviewToolbarText}>
                        ⚡ Vista previa activa — use la barra inferior para editar, confirmar o cancelar.
                    </Text>
                </View>
            )}

            <View style={[styles.mainArea, urgencyPreview && !showModal && styles.mainAreaWithDock]}>
                <View style={[styles.chartArea, viewMode === 'roster' && styles.chartAreaRoster]}>
                    {viewMode === 'roster' ? (
                        <RosterDisponibilidadPanel
                            maquinas={maquinas}
                            colors={colors}
                            isDarkMode={isDarkMode}
                        />
                    ) : viewMode === 'gantt' ? (
                        renderGantt()
                    ) : (
                        renderListView()
                    )}
                </View>
                {viewMode !== 'roster' && renderProgressPanel()}
            </View>

            {renderModal()}
            {renderActivityModal()}
            {renderAddActivityPicker()}
            {renderContextMenu()}
            {renderDayDetailModal()}
            {renderProcesoCatalogModal()}
            {renderMetaFacturacionModal()}
            {renderAuxConfirmModal()}
            {renderUrgencyPreviewDock()}

            {auxDrag && Platform.OS === 'web' && (
                <View
                    pointerEvents="none"
                    style={[
                        styles.auxGhost,
                        {
                            position: 'fixed',
                            left: auxDrag.x + 14,
                            top: auxDrag.y + 14,
                            borderColor: auxDrag.color,
                            backgroundColor: auxDrag.target ? auxDrag.color : '#334155',
                        },
                    ]}
                >
                    <Text style={styles.auxGhostText}>{auxDrag.icon} {auxDrag.label} · {auxDrag.horas}h</Text>
                    <Text style={styles.auxGhostSub}>
                        {auxDrag.target
                            ? (() => {
                                const d = new Date(auxDrag.target.startMs);
                                return `${auxDrag.target.proceso} · ${d.toLocaleDateString()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                            })()
                            : 'Suelte sobre una fila del Gantt'}
                    </Text>
                </View>
            )}

            {ganttTooltip && Platform.OS === 'web' && (
                <View
                    pointerEvents="none"
                    style={[
                        styles.ganttTooltip,
                        {
                            position: 'fixed',
                            left: Math.min(ganttTooltip.x + 14, windowWidth - 340),
                            top: ganttTooltip.y + 14,
                            backgroundColor: isDarkMode ? '#0F172A' : '#1E293B',
                            borderColor: isDarkMode ? '#475569' : '#334155',
                        },
                    ]}
                >
                    {ganttTooltip.text.split('\n').map((line, idx) => (
                        <Text key={`gt-${idx}`} style={styles.ganttTooltipLine}>{line}</Text>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    containerWeb: {
        minHeight: '100vh',
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    mainArea: { flex: 1, flexDirection: 'column', minHeight: 0 },
    mainAreaWithDock: { paddingBottom: Platform.OS === 'web' ? 88 : 72 },
    chartArea: { flex: 1, minHeight: 0 },
    chartAreaRoster: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        ...(Platform.OS === 'web' ? { overflow: 'hidden', height: '100%' } : null),
    },
    toolbar: {
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 6,
        gap: 6,
    },
    toolbarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
    },
    toolbarRow2: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 140 },
    toolbarTitleBlock: { flex: 1 },
    toolbarTitle: { fontSize: 16, fontWeight: '800' },
    toolbarBreadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    toolbarCrumb: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    toolbarCrumbActive: { color: '#60A5FA', fontWeight: '800' },
    toolbarCrumbSep: { fontSize: 11 },
    toolbarCenter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    toolbarBackBtn: {
        backgroundColor: '#4F46E5',
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolbarBackBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    viewToggleGroup: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
    navBtnCompact: {
        backgroundColor: '#1E40AF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        minWidth: 36,
        alignItems: 'center',
    },
    navHint: { fontSize: 10, marginLeft: 2 },
    searchInputCompact: {
        flex: 1,
        minWidth: 160,
        height: 34,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 13,
    },
    filterToggleBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    filterToggleBtnActive: { backgroundColor: '#4F46E5' },
    filterToggleText: { color: '#CBD5E0', fontSize: 12, fontWeight: '600' },
    legendInline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    countBadge: { fontSize: 11, fontWeight: '600', marginLeft: 'auto' },
    filterChipsRow: { flexGrow: 0, paddingBottom: 4 },
    ganttRoot: { flex: 1, minHeight: 0 },
    ganttSplitRow: { flex: 1, flexDirection: 'row', minHeight: 0 },
    labelColumn: { borderRightWidth: 1 },
    timelineScroll: { flex: 1 },
    detailPanel: {
        borderTopWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    detailPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailPanelTitle: { fontSize: 14, fontWeight: '800' },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    ganttTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navBtn: {
        backgroundColor: '#1E40AF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    navBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    createBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        elevation: 2,
    },
    createBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    metaFactBtn: {
        backgroundColor: '#0F766E',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 8,
    },
    metaFactBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    billingRow: { flexDirection: 'row' },
    billingCell: {
        borderRightWidth: 1,
        borderTopWidth: 3,
        paddingHorizontal: 6,
        paddingVertical: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    billingLine: { fontSize: 14, lineHeight: 22, textAlign: 'center', fontWeight: '600' },
    billingLabelCell: {
        borderTopWidth: 1,
        borderRightWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    billingLabelTitle: { color: '#FFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
    billingLabelSub: { color: '#5EEAD4', fontSize: 12, fontWeight: '700', marginTop: 3 },
    procesosEditBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 8,
    },
    procesosEditBtnActive: { backgroundColor: '#0D9488' },
    procesosEditBtnText: { color: '#CBD5E0', fontWeight: '700', fontSize: 12 },
    auxPalette: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
    auxChip: {
        borderWidth: 1.5,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    auxChipText: { fontWeight: '700', fontSize: 12 },
    auxGhost: {
        zIndex: 9999,
        borderWidth: 2,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        maxWidth: 280,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    auxGhostText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
    auxGhostSub: { color: '#E2E8F0', fontSize: 11, marginTop: 2 },
    weekLegend: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 16,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    backendBanner: {
        marginHorizontal: 12,
        marginBottom: 4,
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#7F1D1D',
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    backendBannerText: { color: '#FEE2E2', fontSize: 12, fontWeight: '600' },
    urgencyPreviewToolbarBanner: {
        marginHorizontal: 12,
        marginBottom: 4,
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#78350F',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    urgencyPreviewToolbarText: { color: '#FDE68A', fontSize: 12, fontWeight: '600' },
    urgencyPreviewDock: {
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#1E293B',
        borderTopWidth: 2,
        borderTopColor: '#F59E0B',
        ...(Platform.OS === 'web' ? { boxShadow: '0 -4px 24px rgba(0,0,0,0.45)' } : {}),
    },
    urgencyPreviewDockInfo: { flex: 1, minWidth: 0 },
    urgencyPreviewDockTitle: { color: '#F59E0B', fontWeight: '800', fontSize: 13 },
    urgencyPreviewDockMeta: { color: '#E2E8F0', fontSize: 12, marginTop: 2, fontWeight: '600' },
    urgencyPreviewDockHint: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
    urgencyPreviewDockActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    urgencyDockBtnPrimary: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 130,
        alignItems: 'center',
    },
    urgencyDockBtnPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
    urgencyDockBtnSecondary: {
        backgroundColor: '#334155',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
    },
    urgencyDockBtnSecondaryText: { color: '#E2E8F0', fontWeight: '700', fontSize: 13 },
    urgencyDockBtnCancel: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
    },
    urgencyDockBtnCancelText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
    ganttWrapper: { flex: 1 },
    ganttScroll: { flex: 1 },
    ganttHeaderRow: { flexDirection: 'row' },
    processHeaderCell: {
        width: PROCESS_COL_WIDTH,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderColor: '#334155',
        gap: 6,
        paddingHorizontal: 6,
    },
    processHeaderText: { color: '#FFF', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
    processHeaderAddBtn: {
        backgroundColor: '#4F46E5',
        width: 22,
        height: 22,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    processHeaderAddText: { color: '#FFF', fontSize: 16, fontWeight: '800', lineHeight: 18 },
    monthRow: { flexDirection: 'row', height: 26 },
    monthCell: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#334155' },
    monthText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
    weekRow: { flexDirection: 'row', height: 34 },
    weekCell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 2,
        borderRightColor: '#FFFFFF33',
    },
    weekText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
    weekSubText: { color: '#FFFFFFCC', fontSize: 9, marginTop: 1 },
    zoomHintText: { color: '#FFFFFFAA', fontSize: 8, marginTop: 2, fontStyle: 'italic' },
    zoomBackBtn: {
        marginTop: 8,
        backgroundColor: '#4F46E5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    zoomBackBtnText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
    zoomNavBar: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    zoomNavBackBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    zoomNavBackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    zoomBreadcrumb: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        flex: 1,
    },
    zoomCrumb: { fontSize: 13 },
    zoomCrumbSep: { fontSize: 14, fontWeight: '700' },
    zoomNavHint: { fontSize: 11, maxWidth: 180 },
    dayRow: { flexDirection: 'row', height: 38 },
    dayCell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
    },
    dayNameText: { color: '#FFFFFFAA', fontSize: 9, fontWeight: '600' },
    dayText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    ganttBody: { maxHeight: 480 },
    processRow: { flexDirection: 'row' },
    processLabelCell: {
        width: PROCESS_COL_WIDTH,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRightWidth: 1,
        borderBottomWidth: 1,
    },
    processLabelCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        gap: 4,
    },
    processCardGrip: { flexDirection: 'row', alignItems: 'center', gap: 2, cursor: 'grab' },
    processGrip: { color: '#94A3B8', fontSize: 14, fontWeight: '700', paddingHorizontal: 2 },
    processMoveBtns: { flexDirection: 'column' },
    processMoveBtn: { color: '#94A3B8', fontSize: 10, fontWeight: '700', paddingHorizontal: 2 },
    processCardBtns: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    processCardBtn: { color: '#60A5FA', fontSize: 13, fontWeight: '700', paddingHorizontal: 4 },
    processLabel: { fontSize: 12, fontWeight: '600' },
    processTrack: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#334155', overflow: 'visible' },
    daySlot: {
        borderRightWidth: 1,
        position: 'relative',
        paddingHorizontal: 0,
    },
    dayHourTrack: {
        position: 'relative',
        overflow: 'visible',
    },
    hourGridRow: {
        flexDirection: 'row',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    hourGridCell: {
        borderRightWidth: 1,
    },
    nowMarker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#FACC15',
        zIndex: 2,
        opacity: 0.85,
    },
    opBar: {
        position: 'absolute',
        height: CHIP_HEIGHT,
        borderWidth: 1,
        justifyContent: 'center',
        paddingHorizontal: 3,
        zIndex: 3,
        overflow: 'hidden',
        minWidth: 22,
    },
    opBarHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: DRAG_HANDLE_PX,
        zIndex: 4,
    },
    opBarHandleLeft: { left: 0 },
    opBarHandleRight: { right: 0 },
    opBarContinuation: {
        color: '#FFFFFFCC',
        fontSize: 10,
        fontWeight: '800',
        textAlign: 'center',
    },
    opChip: {
        position: 'absolute',
        left: 3,
        right: 3,
        height: CHIP_HEIGHT,
        borderRadius: 4,
        borderWidth: 1,
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    opChipText: { color: '#FFF', fontSize: 8, fontWeight: '800', lineHeight: 9 },
    ganttTooltip: {
        maxWidth: 320,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        zIndex: 99999,
        ...(Platform.OS === 'web' ? { boxShadow: '0 10px 28px rgba(0,0,0,0.45)' } : {}),
    },
    ganttTooltipLine: {
        color: '#E2E8F0',
        fontSize: 11,
        lineHeight: 16,
    },
    chipPulse: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#FACC15',
    },
    liveBarStripe: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 3,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
    },
    moreChip: {
        position: 'absolute',
        left: 3,
        right: 3,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreChipText: { color: '#94A3B8', fontSize: 8, fontWeight: '700' },
    colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    dayDetailContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 520,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    dayDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    dayDetailTitle: { fontSize: 18, fontWeight: '800' },
    dayDetailCard: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderLeftWidth: 4,
    },
    dayDetailCardHeader: { flexDirection: 'row', alignItems: 'center' },
    dayDetailOp: { fontSize: 15, fontWeight: '800', flex: 1 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusPillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
    dayDetailActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    dayDetailBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    dayDetailBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    progressPanel: {
        borderTopWidth: 1,
        padding: 16,
        maxHeight: 200,
    },
    progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    progressTitle: { fontSize: 15, fontWeight: '800' },
    progressBadge: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    progressBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    editBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    editBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    progressBarTrack: {
        height: 6,
        backgroundColor: '#334155',
        borderRadius: 3,
        marginTop: 4,
        overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
    processStatusCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginRight: 10,
        minWidth: 130,
    },
    processStatusName: { fontSize: 12, fontWeight: '700' },
    processCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailPanelActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    contextMenuOverlay: { flex: 1 },
    contextMenu: {
        position: 'absolute',
        minWidth: 200,
        borderRadius: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#334155',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    contextMenuTitle: { fontSize: 12, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#33415544' },
    contextMenuItem: { paddingHorizontal: 14, paddingVertical: 10 },
    activityModalContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    activityPickerContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    activityPickerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
    },
    processStatusLabel: { fontSize: 10, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
    miniProgressTrack: {
        height: 4,
        backgroundColor: '#33415544',
        borderRadius: 2,
        marginTop: 6,
        overflow: 'hidden',
    },
    miniProgressFill: { height: '100%', borderRadius: 2 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalScrollContent: { flexGrow: 1, justifyContent: 'center' },
    modalShell: {
        borderRadius: 16,
        width: '100%',
        maxWidth: 960,
        maxHeight: Platform.OS === 'web' ? '90vh' : '92%',
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 10,
        gap: 12,
    },
    formTabsRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        paddingHorizontal: 8,
    },
    formTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    formTabActive: {},
    formTabText: { fontSize: 13, fontWeight: '700' },
    modalBodyScroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
    modalBodyContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    formGridItem: { width: '48%', flexGrow: 1, minWidth: 200 },
    formGridItemFull: { width: '100%', minWidth: '100%' },
    nextTabBtn: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    nextTabBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    opSearchWrap: {
        zIndex: 20,
        marginBottom: 10,
    },
    opResultsDropdown: {
        marginTop: 6,
        borderWidth: 1,
        borderRadius: 10,
        maxHeight: 160,
        overflow: 'hidden',
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: '#CBD5E0', marginBottom: 4, marginTop: 8 },
    input: {
        height: 42,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#FFF',
    },
    procesoFormRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    procesoBlock: {
        marginBottom: 10,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#11182744',
    },
    procesoBlockActive: {
        borderColor: '#4F46E5',
        backgroundColor: '#4F46E511',
    },
    procesoFields: { marginTop: 8, marginLeft: 30 },
    timeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' },
    timeGroup: { flex: 1, minWidth: 200 },
    timeLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
    hourPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    hourPickerRowNowrap: { flexDirection: 'row', flexWrap: 'nowrap', gap: 4, alignItems: 'center' },
    hourNavBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    hourNavBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#475569',
        minWidth: 36,
        alignItems: 'center',
    },
    hourNavBtnText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
    hourNavCenter: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#312E81',
        borderWidth: 1,
        borderColor: '#6366F1',
        minWidth: 64,
        alignItems: 'center',
    },
    hourNavCenterText: { color: '#EEF2FF', fontSize: 13, fontWeight: '800' },
    hourChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
    },
    hourChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    hourChipBlocked: {
        backgroundColor: '#3F1D1D',
        borderColor: '#991B1B',
        opacity: 0.85,
        minWidth: 48,
        alignItems: 'center',
    },
    hourChipBlockedText: { color: '#FCA5A5', textDecorationLine: 'line-through' },
    hourChipBlockedHint: { color: '#F87171', fontSize: 8, fontWeight: '700', marginTop: 1 },
    hourChipText: { color: '#CBD5E0', fontSize: 10, fontWeight: '600' },
    maquinaPickerRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
    maquinaChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
        alignItems: 'center',
        justifyContent: 'center',
    },
    maquinaChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    maquinaChipBusy: { borderColor: '#B91C1C' },
    maquinaChipText: { fontSize: 11, fontWeight: '700' },
    maquinaChipStatus: { fontSize: 9, fontWeight: '600', marginTop: 1 },
    calculoBox: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
    calculoResumenOp: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    calculoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    calculoResultRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        marginTop: 10,
        paddingTop: 10,
        gap: 12,
    },
    calculoResultItem: { minWidth: 100, flex: 1 },
    calculoResultLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
    calculoResultValue: { fontSize: 15, fontWeight: '800' },
    horasEstimadasRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    auxSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
    auxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    addAuxBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    addAuxBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    auxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    checkBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#4A5568',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2D3748',
    },
    checkBoxActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    procesoFormName: { width: 100, fontSize: 13, fontWeight: '600' },
    dateInputs: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    dateInput: {
        flex: 1,
        height: 36,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
        borderRadius: 8,
        paddingHorizontal: 8,
        fontSize: 12,
        color: '#FFF',
        minWidth: 110,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
    },
    modalBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        minWidth: 100,
        alignItems: 'center',
    },
    modalBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    viewToggleBtn: {
        backgroundColor: '#334155',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
    },
    viewToggleBtnActive: { backgroundColor: '#4F46E5' },
    viewToggleText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    filterBar: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 8,
    },
    searchInput: {
        height: 40,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        backgroundColor: '#1E293B',
        fontSize: 14,
    },
    filterChips: { flexGrow: 0 },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#334155',
        marginRight: 8,
    },
    filterChipActive: { backgroundColor: '#4F46E5' },
    filterChipText: { color: '#CBD5E0', fontSize: 12, fontWeight: '600' },
    listWrapper: { flex: 1, paddingHorizontal: 12, paddingTop: 4, minHeight: 0 },
    listRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    listOp: { fontSize: 15, fontWeight: '800' },
    listEstadoBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    listProcRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    listProcChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        maxWidth: '100%',
    },
    listProcCheck: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listProcCheckMark: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '800',
        lineHeight: 12,
    },
    listProcCheckDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    listProcLabel: {
        fontSize: 10,
        fontWeight: '700',
        maxWidth: 90,
    },
    listProcEstado: {
        fontSize: 9,
        fontWeight: '600',
    },
    opResultsBox: {
        maxHeight: 180,
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 10,
        marginBottom: 10,
        overflow: 'hidden',
    },
    opResultRow: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    opResultRowUsed: { opacity: 0.65 },
    opResultNum: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    opResultMeta: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
    loadOpBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 10,
    },
    loadOpBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    urgenciaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    previewUrgencyBtn: {
        backgroundColor: '#F59E0B',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 14,
        alignItems: 'center',
    },
    previewUrgencyBtnText: { color: '#1E293B', fontWeight: '800', fontSize: 14 },
    urgencyPreviewCtaCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
    },
    urgencyPreviewCtaTitle: { fontWeight: '800', fontSize: 14, marginBottom: 6 },
});
