import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Platform,
    Modal,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SearchablePicker } from '../components/SearchablePicker';
import { mantenimientoApi } from '../services/mantenimientoApi';
import api from '../services/apiClient';

interface ConsumosMantenimientoScreenProps {
    onBack: () => void;
}

interface LineaConsumo {
    key: string;
    productoId: string;
    cantidad: string;
}

const emptyLinea = (): LineaConsumo => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    productoId: '',
    cantidad: '',
});

const emptyForm = () => ({
    lineas: [emptyLinea()],
    fecha: new Date().toISOString().split('T')[0],
    hojaVidaId: '',
    mantenimientoId: '',
    tipoMantenimiento: '',
    bitacoraId: '',
    actividadIds: [] as number[],
    responsable: '',
    nota: '',
});

const ConsumosMantenimientoScreen: React.FC<ConsumosMantenimientoScreenProps> = ({ onBack }) => {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [consumos, setConsumos] = useState<any[]>([]);
    const [productos, setProductos] = useState<any[]>([]);
    const [hojasVida, setHojasVida] = useState<any[]>([]);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editOriginal, setEditOriginal] = useState<{ productoId: number; cantidad: number } | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [maquinaContexto, setMaquinaContexto] = useState<any>(null);
    const [loadingContexto, setLoadingContexto] = useState(false);
    const [openPickerId, setOpenPickerId] = useState<string | null>(null);

    const anios = useMemo(
        () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i),
        []
    );
    const meses = useMemo(
        () => [
            { v: 0, l: 'Todo el año' },
            ...Array.from({ length: 12 }, (_, i) => ({
                v: i + 1,
                l: mantenimientoApi.getMesNombre(i + 1),
            })),
        ],
        []
    );

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [lista, hojas, inventario] = await Promise.all([
                mantenimientoApi.getConsumos(anio, mes || undefined),
                mantenimientoApi.getHojasVidaMaquinas(),
                mantenimientoApi.getInventario(),
            ]);
            setConsumos(Array.isArray(lista) ? lista : []);
            const hojasList = Array.isArray(hojas) ? hojas : [];
            if (hojasList.length === 0) {
                console.warn('Sin máquinas en Maquinaria (Hoja de Vida).');
            }
            setHojasVida(
                hojasList
                    .map((h: any) => ({
                        id: h.id ?? h.Id,
                        nombre: h.nombre ?? h.Nombre ?? 'Sin nombre',
                        numeroInventario: h.numeroInventario ?? h.NumeroInventario ?? '',
                    }))
                    .filter((h: any) => h.id != null && h.id !== '')
                    .sort((a: any, b: any) =>
                        (a.nombre || '').localeCompare(b.nombre || '', 'es')
                    )
            );
            const inv = Array.isArray(inventario) ? inventario : inventario?.value || [];
            setProductos(
                inv.map((p: any) => ({
                    id: parseInt(String(p.id ?? p.Id ?? ''), 10),
                    nombre: p.nombre ?? p.Nombre ?? '',
                    codigo: p.codigo ?? p.Codigo ?? '',
                    stock: p.stock ?? p.Stock ?? 0,
                    medida: p.medida ?? p.Medida ?? '',
                })).filter((p: any) => Number.isFinite(p.id) && p.id > 0)
            );
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudieron cargar los consumos.');
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const updateLinea = (key: string, patch: Partial<LineaConsumo>) => {
        setForm((f) => ({
            ...f,
            lineas: f.lineas.map((l) => (l.key === key ? { ...l, ...patch } : l)),
        }));
    };

    const addLinea = () => {
        setForm((f) => ({ ...f, lineas: [...f.lineas, emptyLinea()] }));
    };

    const removeLinea = (key: string) => {
        setForm((f) => {
            if (f.lineas.length <= 1) return f;
            return { ...f, lineas: f.lineas.filter((l) => l.key !== key) };
        });
    };

    const getStockProducto = (productoId: string) =>
        productos.find((p) => String(p.id) === productoId)?.stock ?? 0;

    const getStockDisponible = (productoId: string) => {
        const base = getStockProducto(productoId);
        if (editId && editOriginal && String(editOriginal.productoId) === productoId) {
            return base + editOriginal.cantidad;
        }
        return base;
    };

    const sumCantidadProducto = (productoId: string) =>
        form.lineas.reduce((sum, l) => {
            if (String(l.productoId) !== productoId) return sum;
            const n = parseFloat(String(l.cantidad).replace(',', '.'));
            return sum + (Number.isFinite(n) && n > 0 ? n : 0);
        }, 0);

    const excedeStockProducto = (productoId: string) => {
        if (!productoId) return false;
        const total = sumCantidadProducto(productoId);
        if (total <= 0) return false;
        return total > getStockDisponible(productoId);
    };

    const hayErrorStock = form.lineas.some((l) => excedeStockProducto(l.productoId));

    const hojasVidaOptions = useMemo(
        () =>
            hojasVida.map((h: any) => ({
                value: String(h.id),
                label: h.numeroInventario
                    ? `${h.nombre} (Inv: ${h.numeroInventario})`
                    : String(h.nombre),
            })),
        [hojasVida]
    );

    const productoOptions = useMemo(
        () =>
            productos.map((p) => ({
                value: String(p.id),
                label: `${p.codigo} — ${p.nombre} (disp: ${p.stock})`,
            })),
        [productos]
    );

    const anioOptions = useMemo(
        () => anios.map((a) => ({ value: String(a), label: String(a) })),
        [anios]
    );

    const mesOptions = useMemo(
        () => meses.map((m) => ({ value: String(m.v), label: m.l })),
        [meses]
    );

    const filtered = consumos.filter((c) => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (
            (c.productoNombre || '').toLowerCase().includes(q) ||
            (c.codigo || '').toLowerCase().includes(q) ||
            (c.maquinaNombre || '').toLowerCase().includes(q) ||
            (c.responsable || '').toLowerCase().includes(q)
        );
    });

    const loadContextoHojaVida = async (hojaVidaId: string, legacyMaquinaId?: string) => {
        if (!hojaVidaId && !legacyMaquinaId) {
            setMaquinaContexto(null);
            return;
        }
        setLoadingContexto(true);
        try {
            let ctx = hojaVidaId
                ? await mantenimientoApi.getContextoConsumoHojaVida(parseInt(hojaVidaId, 10))
                : await mantenimientoApi.getContextoConsumoMaquina(parseInt(legacyMaquinaId!, 10));

            const sinMantenimientos = !Array.isArray(ctx?.mantenimientos) || ctx.mantenimientos.length === 0;
            if (hojaVidaId && sinMantenimientos) {
                try {
                    const mantResp = await api.get('MantenimientosMaquinas', {
                        params: { hojaVidaId: parseInt(hojaVidaId, 10) },
                    });
                    const lista = Array.isArray(mantResp.data) ? mantResp.data : [];
                    if (lista.length > 0) {
                        ctx = {
                            ...ctx,
                            mantenimientos: lista.map((m: any) => {
                                const consecutivo = m.consecutivo ?? m.Consecutivo ?? 0;
                                const tipo = m.tipoMantenimiento ?? m.TipoMantenimiento ?? '';
                                const ticketId = m.ticketId ?? m.TicketId;
                                const fecha = m.fecha ?? m.Fecha;
                                const fechaTxt = fecha
                                    ? new Date(fecha).toLocaleDateString('es-CO')
                                    : '';
                                const ticketTxt = ticketId ? ` · Ticket #${ticketId}` : '';
                                return {
                                    id: m.id ?? m.Id,
                                    consecutivo,
                                    ticketId,
                                    ticketConsecutivo: ticketId,
                                    fecha,
                                    tipoMantenimiento: tipo,
                                    observacion: m.observacion ?? m.Observacion,
                                    ejecutadoPor: m.ejecutadoPor ?? m.EjecutadoPor,
                                    etiqueta: `Mant. #${consecutivo} · ${tipo}${ticketTxt} · ${fechaTxt}`,
                                };
                            }),
                        };
                    }
                } catch {
                    /* usar contexto sin mantenimientos */
                }
            }
            setMaquinaContexto(ctx);
        } catch (e) {
            console.error('contexto consumo', e);
            setMaquinaContexto({ error: true });
        } finally {
            setLoadingContexto(false);
        }
    };

    const openNew = () => {
        setEditId(null);
        setEditOriginal(null);
        setForm(emptyForm());
        setMaquinaContexto(null);
        setOpenPickerId(null);
        setShowModal(true);
    };

    const openEdit = async (item: any) => {
        setEditId(item.id);
        setEditOriginal({
            productoId: Number(item.productoId),
            cantidad: Number(item.cantidad) || 0,
        });
        const hojaVidaId = item.hojaVidaId ? String(item.hojaVidaId) : '';
        const legacyMaquinaId = !hojaVidaId && item.maquinaId ? String(item.maquinaId) : '';
        setForm({
            lineas: [{
                key: 'edit',
                productoId: String(item.productoId),
                cantidad: String(item.cantidad),
            }],
            fecha: item.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            hojaVidaId,
            mantenimientoId: item.mantenimientoHojaVidaId ? String(item.mantenimientoHojaVidaId) : '',
            tipoMantenimiento: item.tipoMantenimiento || '',
            bitacoraId: item.bitacoraId ? String(item.bitacoraId) : '',
            actividadIds: item.actividadIds || [],
            responsable: item.responsable || '',
            nota: item.nota || '',
        });
        setShowModal(true);
        if (hojaVidaId) await loadContextoHojaVida(hojaVidaId);
        else if (legacyMaquinaId) await loadContextoHojaVida('', legacyMaquinaId);
    };

    const mantenimientosDisponibles = useMemo(() => {
        const raw = maquinaContexto?.mantenimientos;
        const lista = Array.isArray(raw) ? raw : [];
        if (!form.tipoMantenimiento) return lista;
        return lista.filter(
            (m: any) =>
                (m.tipoMantenimiento ?? m.TipoMantenimiento ?? '').toLowerCase() ===
                form.tipoMantenimiento.toLowerCase()
        );
    }, [maquinaContexto, form.tipoMantenimiento]);

    const mantenimientoSel = useMemo(() => {
        if (!form.mantenimientoId) return null;
        const raw = maquinaContexto?.mantenimientos;
        const lista = Array.isArray(raw) ? raw : [];
        return lista.find((m: any) => String(m.id ?? m.Id) === form.mantenimientoId) ?? null;
    }, [maquinaContexto, form.mantenimientoId]);

    const seleccionarMantenimiento = (m: any) => {
        const mid = m.id ?? m.Id;
        const tipo = m.tipoMantenimiento ?? m.TipoMantenimiento ?? '';
        const ticketId = m.ticketId ?? m.TicketId;
        setForm((f) => ({
            ...f,
            mantenimientoId: String(mid),
            tipoMantenimiento: tipo,
            bitacoraId: ticketId ? String(ticketId) : '',
            responsable: f.responsable || m.ejecutadoPor || m.EjecutadoPor || '',
        }));
    };

    const buildContextPayload = () => ({
        fecha: form.fecha,
        hojaVidaId: form.hojaVidaId ? parseInt(form.hojaVidaId, 10) : null,
        mantenimientoHojaVidaId: form.mantenimientoId ? parseInt(form.mantenimientoId, 10) : null,
        maquinaId: null,
        tipoMantenimiento: form.tipoMantenimiento || null,
        bitacoraId: form.bitacoraId ? parseInt(form.bitacoraId, 10) : null,
        responsable: form.responsable,
        nota: form.nota,
    });

    const save = async () => {
        const lineasValidas = form.lineas
            .map((l) => ({
                ...l,
                cantidadNum: parseFloat(String(l.cantidad).replace(',', '.')),
            }))
            .filter((l) => l.productoId && l.cantidadNum > 0);

        if (lineasValidas.length === 0) {
            Alert.alert('Validación', 'Agregue al menos un producto con cantidad válida.');
            return;
        }
        if (form.hojaVidaId && !form.mantenimientoId) {
            Alert.alert('Validación', 'Seleccione el mantenimiento al que cargar los materiales.');
            return;
        }

        const duplicados = new Map<number, number>();
        for (const l of lineasValidas) {
            const pid = parseInt(l.productoId, 10);
            duplicados.set(pid, (duplicados.get(pid) ?? 0) + l.cantidadNum);
        }
        for (const [pid, total] of duplicados) {
            const stock = getStockDisponible(String(pid));
            if (total > stock) {
                const prod = productos.find((p) => p.id === pid);
                Alert.alert(
                    'Stock insuficiente',
                    `${prod?.nombre ?? 'Producto'}: disponible ${stock}, solicitado ${total}.`
                );
                return;
            }
        }

        if (hayErrorStock) {
            Alert.alert(
                'Stock insuficiente',
                'Una o más líneas superan el inventario disponible. Revise las cantidades marcadas en rojo.'
            );
            return;
        }

        try {
            setSaving(true);
            if (editId) {
                const l = lineasValidas[0];
                await mantenimientoApi.updateConsumo(editId, {
                    ...buildContextPayload(),
                    productoId: parseInt(l.productoId, 10),
                    cantidad: l.cantidadNum,
                    actividadIds: null,
                });
            } else {
                await mantenimientoApi.createConsumoLote({
                    ...buildContextPayload(),
                    lineas: lineasValidas.map((l) => ({
                        productoId: parseInt(l.productoId, 10),
                        cantidad: l.cantidadNum,
                    })),
                });
            }
            setShowModal(false);
            await loadData();
        } catch (e: any) {
            const msg =
                e?.response?.data?.mensaje ||
                e?.response?.data?.title ||
                'No se pudo guardar el consumo.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const anular = (item: any) => {
        const confirm = () => {
            mantenimientoApi
                .deleteConsumo(item.id)
                .then(() => loadData())
                .catch(() => Alert.alert('Error', 'No se pudo anular el consumo.'));
        };
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Anular consumo de ${item.cantidad} × ${item.productoNombre}?`)) confirm();
        } else {
            Alert.alert('Anular consumo', '¿Desea anular este movimiento y devolver el stock?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Anular', style: 'destructive', onPress: confirm },
            ]);
        }
    };

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: isDarkMode ? '#020617' : '#F9FAFB' },
        toolbar: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            padding: 16,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        filterBox: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: isDarkMode ? '#1f2937' : '#fff',
            minWidth: 100,
        },
        searchInput: {
            flex: 1,
            minWidth: 200,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.text,
            backgroundColor: isDarkMode ? '#1f2937' : '#fff',
        },
        btnPrimary: {
            backgroundColor: '#0d7a78',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
        },
        btnPrimaryText: { color: '#fff', fontWeight: '700' },
        tableHeader: {
            flexDirection: 'row',
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: isDarkMode ? '#111827' : '#F3F4F6',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        th: { fontSize: 11, fontWeight: '800', color: colors.subText, letterSpacing: 0.5 },
        row: {
            flexDirection: 'row',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            alignItems: 'center',
        },
        td: { fontSize: 14, color: colors.text },
        link: { color: '#0d9488', fontWeight: '600', fontSize: 13 },
        empty: { padding: 40, alignItems: 'center' },
        modalBox: {
            backgroundColor: colors.card,
            borderRadius: 12,
            width: Platform.OS === 'web' ? 620 : '92%',
            maxWidth: 620,
            maxHeight: Platform.OS === 'web' ? '90vh' : '90%',
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            alignSelf: 'center',
        },
        modalScroll: {
            padding: 24,
        },
        lineaBox: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            backgroundColor: isDarkMode ? '#111827' : '#fff',
        },
        btnAddLine: {
            borderWidth: 1,
            borderColor: '#0d7a78',
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            alignSelf: 'flex-start',
            marginTop: 4,
        },
        label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 12 },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            padding: 12,
            color: colors.text,
            backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
        },
        stockHint: { fontSize: 12, color: colors.subText, marginTop: 4 },
        chip: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 8,
            marginBottom: 8,
        },
        chipActive: { backgroundColor: '#0d7a78', borderColor: '#0d7a78' },
        chipText: { fontSize: 12, color: colors.text },
        chipTextActive: { fontSize: 12, color: '#fff', fontWeight: '600' },
        panelBox: {
            backgroundColor: isDarkMode ? '#1f2937' : '#f1f5f9',
            borderRadius: 10,
            padding: 12,
            marginTop: 8,
            marginBottom: 8,
        },
    });

    return (
        <View style={styles.container}>
            <View style={styles.toolbar}>
                <TouchableOpacity onPress={onBack} style={{ marginRight: 8 }}>
                    <Text style={{ color: colors.subText, fontWeight: '600' }}>← Volver</Text>
                </TouchableOpacity>
                <View style={{ minWidth: 110, flex: 0 }}>
                    <SearchablePicker
                        data={anioOptions}
                        selectedValue={String(anio)}
                        onSelect={(v) => setAnio(parseInt(v, 10) || anio)}
                        placeholder="Año"
                    />
                </View>
                <View style={{ minWidth: 130, flex: 0 }}>
                    <SearchablePicker
                        data={mesOptions}
                        selectedValue={String(mes)}
                        onSelect={(v) => setMes(parseInt(v, 10) || mes)}
                        placeholder="Mes"
                    />
                </View>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar producto, máquina..."
                    placeholderTextColor={colors.subText}
                    value={search}
                    onChangeText={setSearch}
                />
                <TouchableOpacity style={styles.btnPrimary} onPress={openNew}>
                    <Text style={styles.btnPrimaryText}>+ Registrar consumo</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.empty}>
                    <ActivityIndicator size="large" color="#0d7a78" />
                </View>
            ) : (
                <ScrollView>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { flex: 1 }]}>FECHA</Text>
                        <Text style={[styles.th, { flex: 1.2 }]}>CÓDIGO</Text>
                        <Text style={[styles.th, { flex: 2 }]}>PRODUCTO</Text>
                        <Text style={[styles.th, { flex: 0.8 }]}>CANT.</Text>
                        <Text style={[styles.th, { flex: 1.2 }]}>MÁQUINA</Text>
                        <Text style={[styles.th, { flex: 1.5 }]}>NOTA</Text>
                        <Text style={[styles.th, { width: 90, textAlign: 'center' }]}>ACC.</Text>
                    </View>
                    {filtered.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={{ color: colors.subText }}>No hay consumos en este periodo.</Text>
                        </View>
                    ) : (
                        filtered.map((item) => (
                            <View key={item.id} style={styles.row}>
                                <Text style={[styles.td, { flex: 1 }]}>
                                    {item.fecha?.split('T')[0]}
                                </Text>
                                <Text style={[styles.td, { flex: 1.2, color: colors.subText }]}>
                                    {item.codigo}
                                </Text>
                                <Text style={[styles.td, { flex: 2, fontWeight: '600' }]}>
                                    {item.productoNombre}
                                </Text>
                                <Text style={[styles.td, { flex: 0.8, fontWeight: '700' }]}>
                                    {item.cantidad}
                                    {item.medida ? ` ${item.medida}` : ''}
                                </Text>
                                <Text style={[styles.td, { flex: 1.2 }]}>
                                    {item.maquinaNombre || '—'}
                                </Text>
                                <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={2}>
                                    {[
                                        item.mantenimientoConsecutivo != null
                                            ? `Mant. #${item.mantenimientoConsecutivo}`
                                            : null,
                                        item.tipoMantenimiento,
                                        item.nota,
                                        item.responsable,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || '—'}
                                </Text>
                                <View style={{ width: 90, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                                    <TouchableOpacity onPress={() => openEdit(item)}>
                                        <Text style={styles.link}>Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => anular(item)}>
                                        <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>
                                            Anular
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            <Modal visible={showModal} transparent animationType="fade">
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 16,
                    }}
                >
                    <View style={styles.modalBox}>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                            contentContainerStyle={styles.modalScroll}
                            style={{ maxHeight: Platform.OS === 'web' ? '90vh' : undefined }}
                        >
                            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
                                {editId ? 'Editar consumo' : 'Registrar consumo'}
                            </Text>
                            <Text style={{ color: colors.subText, fontSize: 13, marginBottom: 8 }}>
                                {editId
                                    ? 'Edite el producto consumido.'
                                    : 'Puede registrar varios productos al mismo mantenimiento.'}
                            </Text>

                            <Text style={styles.label}>Fecha *</Text>
                            <TextInput
                                style={styles.input}
                                value={form.fecha}
                                onChangeText={(t) => setForm((f) => ({ ...f, fecha: t }))}
                                placeholder="YYYY-MM-DD"
                            />

                            <Text style={styles.label}>Máquina (Maquinaria)</Text>
                            <SearchablePicker
                                data={hojasVidaOptions}
                                selectedValue={form.hojaVidaId}
                                onSelect={(id) => {
                                    setForm((f) => ({
                                        ...f,
                                        hojaVidaId: id,
                                        mantenimientoId: '',
                                        tipoMantenimiento: '',
                                        bitacoraId: '',
                                        actividadIds: [],
                                    }));
                                    loadContextoHojaVida(id);
                                }}
                                placeholder={
                                    hojasVidaOptions.length === 0
                                        ? 'No hay máquinas en Maquinaria'
                                        : 'Buscar máquina...'
                                }
                                allowEmpty
                                emptyLabel="Sin máquina"
                                inline
                                isOpen={openPickerId === 'maquina'}
                                onOpenChange={(open) =>
                                    setOpenPickerId(open ? 'maquina' : null)
                                }
                            />
                            {hojasVidaOptions.length === 0 ? (
                                <Text style={[styles.stockHint, { color: '#f59e0b' }]}>
                                    No hay máquinas activas en Maquinaria. Regístrelas en el módulo Maquinaria.
                                </Text>
                            ) : null}

                            {form.hojaVidaId ? (
                                loadingContexto ? (
                                    <ActivityIndicator style={{ marginTop: 12 }} color="#0d7a78" />
                                ) : (
                                    <>
                                        {maquinaContexto?.error ? (
                                            <Text style={[styles.stockHint, { color: '#dc2626' }]}>
                                                No se pudo cargar el contexto. Actualice la página o reinicie el servidor.
                                            </Text>
                                        ) : (
                                            maquinaContexto?.hojaVida && (
                                                <Text style={styles.stockHint}>
                                                    {maquinaContexto.hojaVida.nombre}
                                                    {maquinaContexto.hojaVida.numeroInventario
                                                        ? ` · Inv: ${maquinaContexto.hojaVida.numeroInventario}`
                                                        : ''}
                                                </Text>
                                            )
                                        )}

                                        <Text style={styles.label}>Filtrar por tipo (opcional)</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                            <TouchableOpacity
                                                style={[styles.chip, !form.tipoMantenimiento && styles.chipActive]}
                                                onPress={() =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        tipoMantenimiento: '',
                                                        mantenimientoId: '',
                                                        bitacoraId: '',
                                                    }))
                                                }
                                            >
                                                <Text
                                                    style={
                                                        !form.tipoMantenimiento
                                                            ? styles.chipTextActive
                                                            : styles.chipText
                                                    }
                                                >
                                                    Todos
                                                </Text>
                                            </TouchableOpacity>
                                            {(maquinaContexto?.tiposMantenimiento || [
                                                'Correctivo', 'Preventivo', 'Limpieza', 'Ajuste', 'Calibración',
                                            ]).map((t: string) => {
                                                const active = form.tipoMantenimiento === t;
                                                return (
                                                    <TouchableOpacity
                                                        key={t}
                                                        style={[styles.chip, active && styles.chipActive]}
                                                        onPress={() =>
                                                            setForm((f) => ({
                                                                ...f,
                                                                tipoMantenimiento: t,
                                                                mantenimientoId: '',
                                                                bitacoraId: '',
                                                            }))
                                                        }
                                                    >
                                                        <Text style={active ? styles.chipTextActive : styles.chipText}>
                                                            {t}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        <Text style={styles.label}>Mantenimiento registrado *</Text>
                                        <Text style={styles.stockHint}>
                                            Seleccione el mantenimiento de Maquinaria al que cargar los materiales
                                            (con su ticket si aplica).
                                        </Text>
                                        <View style={styles.panelBox}>
                                            {mantenimientosDisponibles.length === 0 ? (
                                                <Text style={styles.stockHint}>
                                                    No hay mantenimientos registrados para esta máquina. Créelos en
                                                    Maquinaria → Mantenimientos.
                                                </Text>
                                            ) : (
                                                mantenimientosDisponibles.map((m: any) => {
                                                    const mid = m.id ?? m.Id;
                                                    const active = form.mantenimientoId === String(mid);
                                                    const obs = (m.observacion ?? m.Observacion ?? '')
                                                        .replace(/\n/g, ' ')
                                                        .trim();
                                                    return (
                                                        <TouchableOpacity
                                                            key={mid}
                                                            onPress={() => seleccionarMantenimiento(m)}
                                                            style={[
                                                                styles.chip,
                                                                active && styles.chipActive,
                                                                {
                                                                    marginBottom: 8,
                                                                    alignSelf: 'stretch',
                                                                    paddingVertical: 10,
                                                                },
                                                            ]}
                                                        >
                                                            <Text
                                                                style={
                                                                    active
                                                                        ? styles.chipTextActive
                                                                        : styles.chipText
                                                                }
                                                            >
                                                                {m.etiqueta ?? m.Etiqueta ?? `Mant. #${m.consecutivo ?? m.Consecutivo}`}
                                                            </Text>
                                                            {obs ? (
                                                                <Text
                                                                    style={{
                                                                        fontSize: 11,
                                                                        color: active ? '#e0f2f1' : colors.subText,
                                                                        marginTop: 4,
                                                                    }}
                                                                    numberOfLines={2}
                                                                >
                                                                    {obs}
                                                                </Text>
                                                            ) : null}
                                                        </TouchableOpacity>
                                                    );
                                                })
                                            )}
                                        </View>

                                        {mantenimientoSel ? (
                                            <Text style={styles.stockHint}>
                                                Tipo: {form.tipoMantenimiento}
                                                {(mantenimientoSel.ticketConsecutivo ?? mantenimientoSel.ticketId)
                                                    ? ` · Ticket #${mantenimientoSel.ticketConsecutivo ?? mantenimientoSel.ticketId}`
                                                    : ''}
                                            </Text>
                                        ) : null}
                                    </>
                                )
                            ) : null}

                            <Text style={styles.label}>
                                Productos consumidos * {editId ? '' : `(${form.lineas.length})`}
                            </Text>
                            {hayErrorStock ? (
                                <View
                                    style={{
                                        backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2',
                                        borderRadius: 8,
                                        padding: 10,
                                        marginBottom: 8,
                                        borderWidth: 1,
                                        borderColor: '#dc2626',
                                    }}
                                >
                                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>
                                        La cantidad solicitada supera el inventario disponible en uno o más productos.
                                    </Text>
                                </View>
                            ) : null}
                            {form.lineas.map((linea, idx) => {
                                const prod = productos.find((p) => String(p.id) === linea.productoId);
                                const excede = excedeStockProducto(linea.productoId);
                                const disponible = linea.productoId
                                    ? getStockDisponible(linea.productoId)
                                    : 0;
                                const totalPedido = linea.productoId
                                    ? sumCantidadProducto(linea.productoId)
                                    : 0;
                                return (
                                    <View key={linea.key} style={styles.lineaBox}>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 6,
                                            }}
                                        >
                                            <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>
                                                Producto {idx + 1}
                                            </Text>
                                            {!editId && form.lineas.length > 1 ? (
                                                <TouchableOpacity onPress={() => removeLinea(linea.key)}>
                                                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 12 }}>
                                                        Quitar
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                        <SearchablePicker
                                            data={productoOptions}
                                            selectedValue={linea.productoId}
                                            onSelect={(v) =>
                                                updateLinea(linea.key, { productoId: v })
                                            }
                                            placeholder="Buscar producto..."
                                            inline
                                            isOpen={openPickerId === `prod-${linea.key}`}
                                            onOpenChange={(open) =>
                                                setOpenPickerId(open ? `prod-${linea.key}` : null)
                                            }
                                        />
                                        {prod ? (
                                            <Text
                                                style={[
                                                    styles.stockHint,
                                                    excede && { color: '#ef4444', fontWeight: '700' },
                                                ]}
                                            >
                                                {excede
                                                    ? `Disponible: ${disponible}${prod.medida ? ` ${prod.medida}` : ''} — solicitado: ${totalPedido}`
                                                    : `Disponible en inventario: ${disponible}${prod.medida ? ` ${prod.medida}` : ''}`}
                                            </Text>
                                        ) : null}
                                        <Text style={[styles.label, { marginTop: 8 }]}>Cantidad *</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                excede && {
                                                    borderColor: '#dc2626',
                                                    borderWidth: 2,
                                                },
                                            ]}
                                            keyboardType="decimal-pad"
                                            value={linea.cantidad}
                                            onChangeText={(t) => updateLinea(linea.key, { cantidad: t })}
                                            placeholder="0"
                                        />
                                        {excede ? (
                                            <Text style={[styles.stockHint, { color: '#ef4444', fontWeight: '700' }]}>
                                                No puede usar más de {disponible}
                                                {prod?.medida ? ` ${prod.medida}` : ''}; está pidiendo {totalPedido}.
                                            </Text>
                                        ) : null}
                                    </View>
                                );
                            })}
                            {!editId ? (
                                <TouchableOpacity style={styles.btnAddLine} onPress={addLinea}>
                                    <Text style={{ color: '#0d7a78', fontWeight: '700' }}>
                                        + Añadir otro producto
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            <Text style={styles.label}>Responsable</Text>
                            <TextInput
                                style={styles.input}
                                value={form.responsable}
                                onChangeText={(t) => setForm((f) => ({ ...f, responsable: t }))}
                            />

                            <Text style={styles.label}>Nota / motivo</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 72 }]}
                                multiline
                                value={form.nota}
                                onChangeText={(t) => setForm((f) => ({ ...f, nota: t }))}
                            />

                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end',
                                    gap: 12,
                                    marginTop: 24,
                                }}
                            >
                                <TouchableOpacity onPress={() => setShowModal(false)} disabled={saving}>
                                    <Text style={{ color: colors.subText, fontWeight: '600', padding: 10 }}>
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.btnPrimary,
                                        (saving || hayErrorStock) && { opacity: 0.6 },
                                    ]}
                                    onPress={save}
                                    disabled={saving || hayErrorStock}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>
                                            {editId ? 'Guardar' : `Guardar ${form.lineas.length > 1 ? `(${form.lineas.length} productos)` : ''}`}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default ConsumosMantenimientoScreen;
