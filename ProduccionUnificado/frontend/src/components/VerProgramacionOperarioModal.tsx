import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as planeacionApi from '../services/planeacionApi';
import { normalizeLineasTiros } from '../utils/calculoMaquinaTiros';
import {
    fechaEntregaFromProgramacion,
    formatFechaEntregaDisplay,
    diasHastaEntrega,
    formatEntregaCountdown,
    entregaBadgeColor,
} from '../utils/fechaEntregaPlanner';

type PlanBlock = {
    key: string;
    op: string;
    proceso: string;
    maquinaNombre: string;
    inicio: Date;
    fin: Date;
    horas: number | null;
    estado: string;
    esOpActual: boolean;
    esProcesoActual: boolean;
    fechaEntrega?: string;
    diasEntrega?: number | null;
    lineasTiros?: { concepto: string; tirosBruto: string }[];
};

type VerProgramacionOperarioModalProps = {
    visible: boolean;
    onClose: () => void;
    planeacionActual?: any;
    maquinaId?: number | null;
    maquinaNombre?: string | null;
};

const ESTADO_CFG: Record<string, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: '#94A3B8' },
    en_proceso: { label: 'En proceso', color: '#3B82F6' },
    completado: { label: 'Listo', color: '#22C55E' },
    atrasado: { label: 'Atrasado', color: '#EF4444' },
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

const getWeekRange = (ref = new Date()) => {
    const d = new Date(ref);
    const offset = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - offset);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return { mon, sun };
};

const overlapsRange = (ini: Date, fin: Date, from: Date, to: Date) => ini <= to && fin >= from;

const fmtHora = (d: Date) => d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const fmtFecha = (d: Date) => d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

const parseCalculoJson = (raw: unknown) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    try {
        return JSON.parse(String(raw));
    } catch {
        return null;
    }
};

const extractBlocks = (
    programaciones: any[],
    maquinaId: number,
    opActualId?: number | null,
    procesoActual?: string | null,
): PlanBlock[] => {
    const blocks: PlanBlock[] = [];
    for (const prog of programaciones || []) {
        const progId = prog.id ?? prog.Id;
        const op = prog.numeroOP ?? prog.NumeroOP ?? '—';
        const entrega = fechaEntregaFromProgramacion(prog);
        const diasEntrega = entrega ? diasHastaEntrega(entrega) : null;
        const calculo = parseCalculoJson(prog.calculoJson ?? prog.CalculoJson);
        const maqSnap = calculo?.porMaquina?.[maquinaId] ?? calculo?.porMaquina?.[String(maquinaId)];
        const lineasTiros = normalizeLineasTiros(maqSnap || calculo || {})
            .filter((l) => String(l.tirosBruto || '').trim())
            .map((l) => ({ concepto: l.concepto, tirosBruto: String(l.tirosBruto) }));
        const procesos = prog.procesos ?? prog.Procesos ?? [];
        for (const p of procesos) {
            const mid = p.maquinaId ?? p.MaquinaId;
            if (Number(mid) !== Number(maquinaId)) continue;
            const inicio = new Date(p.fechaInicio ?? p.FechaInicio);
            const fin = new Date(p.fechaFin ?? p.FechaFin);
            if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) continue;
            const proceso = p.proceso ?? p.Proceso ?? '—';
            blocks.push({
                key: `${progId}-${p.id ?? p.Id ?? proceso}-${inicio.getTime()}`,
                op: String(op),
                proceso,
                maquinaNombre: p.maquinaNombre ?? p.MaquinaNombre ?? '',
                inicio,
                fin,
                horas: p.horasEstimadas ?? p.HorasEstimadas ?? null,
                estado: p.estado ?? p.Estado ?? 'pendiente',
                esOpActual: opActualId != null && Number(progId) === Number(opActualId),
                esProcesoActual: !!procesoActual && proceso === procesoActual,
                fechaEntrega: entrega ? formatFechaEntregaDisplay(entrega) : undefined,
                diasEntrega,
                lineasTiros,
            });
        }
    }
    return blocks.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
};

const progToDetalleList = (planeacionActual: any) => {
    if (!planeacionActual?.id) return [];
    return [{
        id: planeacionActual.id,
        numeroOP: planeacionActual.numeroOP,
        calculoJson: planeacionActual.calculoJson,
        fechaEntrega: planeacionActual.fechaEntrega,
        procesos: planeacionActual.procesos || [],
    }];
};

export function VerProgramacionOperarioModal({
    visible,
    onClose,
    planeacionActual,
    maquinaId,
    maquinaNombre,
}: VerProgramacionOperarioModalProps) {
    const { colors, isDarkMode } = useTheme();
    const [tab, setTab] = useState<'hoy' | 'semana'>('hoy');
    const [loading, setLoading] = useState(false);
    const [semanaData, setSemanaData] = useState<any[]>([]);

    const opActualId = planeacionActual?.id ?? null;
    const procesoActual = planeacionActual?.procesoActual?.proceso ?? null;
    const opNum = planeacionActual?.numeroOP || planeacionActual?.ordenProduccion?.numero || '';

    const cardBg = isDarkMode ? '#1E293B' : '#FFFFFF';
    const subBg = isDarkMode ? '#0F172A' : '#F8FAFC';

    const loadSemana = useCallback(async () => {
        if (!maquinaId) return;
        setLoading(true);
        try {
            const { mon, sun } = getWeekRange(new Date());
            const list = await planeacionApi.getProgramacionesRango(
                mon.toISOString(),
                sun.toISOString(),
            );
            setSemanaData(Array.isArray(list) ? list : []);
        } catch {
            setSemanaData(progToDetalleList(planeacionActual));
        } finally {
            setLoading(false);
        }
    }, [maquinaId, planeacionActual]);

    useEffect(() => {
        if (!visible) return;
        setTab('hoy');
        loadSemana();
    }, [visible, loadSemana]);

    const allBlocks = useMemo(() => {
        if (!maquinaId) return [];
        const merged = [...(semanaData || [])];
        const hasActual = merged.some((p) => Number(p.id ?? p.Id) === Number(opActualId));
        if (!hasActual && planeacionActual?.procesos?.length) {
            merged.unshift(...progToDetalleList(planeacionActual));
        }
        return extractBlocks(merged, maquinaId, opActualId, procesoActual);
    }, [semanaData, maquinaId, opActualId, procesoActual, planeacionActual]);

    const hoyBlocks = useMemo(() => {
        const h0 = startOfDay(new Date());
        const h1 = endOfDay(new Date());
        return allBlocks.filter((b) => overlapsRange(b.inicio, b.fin, h0, h1));
    }, [allBlocks]);

    const semanaBlocks = useMemo(() => {
        const { mon, sun } = getWeekRange(new Date());
        return allBlocks.filter((b) => overlapsRange(b.inicio, b.fin, mon, sun));
    }, [allBlocks]);

    const semanaPorDia = useMemo(() => {
        const { mon } = getWeekRange(new Date());
        const days: { key: string; label: string; blocks: PlanBlock[] }[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            const k = toDateKey(d);
            const from = startOfDay(d);
            const to = endOfDay(d);
            days.push({
                key: k,
                label: `${DAY_NAMES[d.getDay()]} ${d.getDate()}`,
                blocks: semanaBlocks.filter((b) => overlapsRange(b.inicio, b.fin, from, to)),
            });
        }
        return days;
    }, [semanaBlocks]);

    const renderBlock = (b: PlanBlock) => {
        const cfg = ESTADO_CFG[b.estado] || ESTADO_CFG.pendiente;
        const highlight = b.esOpActual;
        return (
            <View
                key={b.key}
                style={[
                    styles.block,
                    {
                        backgroundColor: highlight
                            ? (isDarkMode ? '#172554' : '#EFF6FF')
                            : subBg,
                        borderColor: highlight ? '#3B82F6' : colors.border,
                    },
                ]}
            >
                <View style={styles.blockHead}>
                    <Text style={[styles.blockOp, { color: colors.text }]}>
                        OP {b.op} · {b.proceso}
                        {b.esProcesoActual ? ' ★' : ''}
                    </Text>
                    <Text style={[styles.blockEstado, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={[styles.blockTime, { color: colors.subText }]}>
                    {fmtFecha(b.inicio)} · {fmtHora(b.inicio)} – {fmtHora(b.fin)}
                </Text>
                {b.horas != null ? (
                    <Text style={[styles.blockMeta, { color: colors.subText }]}>
                        {Number(b.horas).toFixed(2)} h estimadas
                    </Text>
                ) : null}
                {b.fechaEntrega ? (
                    <Text style={[styles.blockMeta, { color: entregaBadgeColor(b.diasEntrega ?? null) }]}>
                        Entrega: {b.fechaEntrega} · {formatEntregaCountdown(b.diasEntrega ?? null)}
                    </Text>
                ) : null}
                {b.lineasTiros && b.lineasTiros.length > 0 ? (
                    <Text style={[styles.blockMeta, { color: colors.subText }]}>
                        Tiros: {b.lineasTiros.map((l) => `${l.concepto} ${l.tirosBruto}`).join(' · ')}
                    </Text>
                ) : null}
            </View>
        );
    };

    const blocksToShow = tab === 'hoy' ? hoyBlocks : [];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: colors.text }]}>Programación planificada</Text>
                            <Text style={[styles.subtitle, { color: colors.subText }]}>
                                {maquinaNombre || 'Máquina'}
                                {procesoActual ? ` · ${procesoActual}` : ''}
                                {opNum ? ` · OP ${opNum}` : ''}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={{ color: colors.subText, fontSize: 18, fontWeight: '700' }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, tab === 'hoy' && styles.tabActive]}
                            onPress={() => setTab('hoy')}
                        >
                            <Text style={[styles.tabTxt, { color: tab === 'hoy' ? '#FFF' : colors.subText }]}>
                                Hoy
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, tab === 'semana' && styles.tabActive]}
                            onPress={() => setTab('semana')}
                        >
                            <Text style={[styles.tabTxt, { color: tab === 'semana' ? '#FFF' : colors.subText }]}>
                                Semana
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : (
                        <ScrollView style={styles.scroll} nestedScrollEnabled>
                            {tab === 'hoy' ? (
                                blocksToShow.length === 0 ? (
                                    <Text style={[styles.empty, { color: colors.subText }]}>
                                        Sin programación en esta máquina para hoy.
                                    </Text>
                                ) : (
                                    blocksToShow.map(renderBlock)
                                )
                            ) : (
                                semanaPorDia.map((day) => (
                                    <View key={day.key} style={styles.daySection}>
                                        <Text style={[styles.dayTitle, { color: colors.text }]}>{day.label}</Text>
                                        {day.blocks.length === 0 ? (
                                            <Text style={[styles.emptyDay, { color: colors.subText }]}>—</Text>
                                        ) : (
                                            day.blocks.map(renderBlock)
                                        )}
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    )}

                    <Text style={[styles.hint, { color: colors.subText }]}>
                        ★ = su proceso actual en esta máquina. Resaltado = su OP.
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    card: {
        width: '100%',
        maxWidth: 480,
        maxHeight: '85%',
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 12,
        marginTop: 4,
    },
    closeBtn: {
        padding: 4,
    },
    tabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#334155',
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: '#4F46E5',
    },
    tabTxt: {
        fontWeight: '700',
        fontSize: 13,
    },
    scroll: {
        maxHeight: 360,
    },
    loadingWrap: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    block: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
    },
    blockHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    blockOp: {
        fontSize: 13,
        fontWeight: '700',
        flex: 1,
    },
    blockEstado: {
        fontSize: 11,
        fontWeight: '700',
    },
    blockTime: {
        fontSize: 12,
        marginTop: 4,
    },
    blockMeta: {
        fontSize: 11,
        marginTop: 2,
    },
    daySection: {
        marginBottom: 14,
    },
    dayTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
    },
    empty: {
        textAlign: 'center',
        paddingVertical: 24,
        fontSize: 13,
    },
    emptyDay: {
        fontSize: 12,
        marginLeft: 4,
        marginBottom: 4,
    },
    hint: {
        fontSize: 10,
        marginTop: 10,
        fontStyle: 'italic',
    },
});
