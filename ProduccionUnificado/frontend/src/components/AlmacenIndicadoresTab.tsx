import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    TextInput,
} from 'react-native';
import AlmacenCalidadProveedoresTab from './AlmacenCalidadProveedoresTab';
import {
    type Requisicion,
    formatearMonedaCop,
    formatFechaDisplay,
} from '../data/almacenMockData';

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
    inputBackground: string;
};

type SeccionIndicador = 'proveedores' | 'precios' | 'gastos';

type TipoRequisicionId = Requisicion['tipoRequisicion'];

interface Props {
    requisiciones: Requisicion[];
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
    isWide: boolean;
}

interface PuntoPrecio {
    key: string;
    producto: string;
    proveedor: string;
    precio: number;
    cantidad: number;
    fecha: string;
    codigo: string;
    tipoRequisicion: TipoRequisicionId;
    total: number;
    precioEspecial?: boolean;
    comentarioPrecioEspecial?: string;
}

interface GastoMes {
    mesKey: string;
    label: string;
    total: number;
    porProveedor: Record<string, number>;
    porProducto: Record<string, number>;
}

const SECCIONES: { id: SeccionIndicador; label: string; icon: string }[] = [
    { id: 'proveedores', label: 'Proveedores', icon: '⏱' },
    { id: 'precios', label: 'Historial de precios', icon: '📈' },
    { id: 'gastos', label: 'Gastos', icon: '💰' },
];

function normalizarProducto(nombre: string): string {
    return nombre.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mesKeyFromIso(iso: string): string {
    if (!iso || iso.length < 7) return '';
    return iso.slice(0, 7);
}

function labelMes(mesKey: string): string {
    if (!mesKey || mesKey.length < 7) return mesKey;
    const [y, m] = mesKey.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
}

/** Extrae cada línea de pedido con precio unitario como punto histórico. */
function extraerPuntosPrecio(requisiciones: Requisicion[]): PuntoPrecio[] {
    const puntos: PuntoPrecio[] = [];
    requisiciones.forEach((req) => {
        const pedido = req.pedido;
        if (!pedido?.fechaPedido) return;
        const proveedores = pedido.proveedores ?? [];
        if (proveedores.length === 0) {
            const precio = pedido.precioUnitario;
            if (precio == null || precio <= 0) return;
            puntos.push({
                key: `${req.id}-pedido`,
                producto: req.producto || 'Sin producto',
                proveedor: '—',
                precio,
                cantidad: req.cantidad,
                fecha: pedido.fechaPedido,
                codigo: req.codigo,
                tipoRequisicion: req.tipoRequisicion,
                total: precio * (req.cantidad || 0),
            });
            return;
        }
        proveedores.forEach((prov, idx) => {
            const precio = prov.precioUnitario ?? pedido.precioUnitario;
            if (precio == null || precio <= 0) return;
            const cantidad = prov.cantidad > 0 ? prov.cantidad : req.cantidad;
            puntos.push({
                key: `${req.id}-p${idx}`,
                producto: req.producto || 'Sin producto',
                proveedor: prov.nombre?.trim() || 'Sin proveedor',
                precio,
                cantidad,
                fecha: pedido.fechaPedido,
                codigo: req.codigo,
                tipoRequisicion: req.tipoRequisicion,
                total: precio * cantidad,
                precioEspecial: prov.precioEspecial === true,
                comentarioPrecioEspecial: prov.comentarioPrecioEspecial?.trim() || undefined,
            });
        });
    });
    return puntos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.producto.localeCompare(b.producto));
}

function construirGastosPorMes(puntos: PuntoPrecio[]): GastoMes[] {
    const map = new Map<string, GastoMes>();
    puntos.forEach((p) => {
        const mk = mesKeyFromIso(p.fecha);
        if (!mk) return;
        if (!map.has(mk)) {
            map.set(mk, {
                mesKey: mk,
                label: labelMes(mk),
                total: 0,
                porProveedor: {},
                porProducto: {},
            });
        }
        const row = map.get(mk)!;
        row.total += p.total;
        row.porProveedor[p.proveedor] = (row.porProveedor[p.proveedor] || 0) + p.total;
        row.porProducto[p.producto] = (row.porProducto[p.producto] || 0) + p.total;
    });
    return Array.from(map.values()).sort((a, b) => a.mesKey.localeCompare(b.mesKey));
}

/** Gráfico de área/línea con Chart.js (solo web). */
function AreaLineChart({
    labels,
    values,
    isDarkMode,
    height = 260,
    color = '#22C55E',
    yPrefix = '$',
}: {
    labels: string[];
    values: number[];
    isDarkMode: boolean;
    height?: number;
    color?: string;
    yPrefix?: string;
}) {
    const hostRef = useRef<View>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
        let cancelled = false;

        const mount = async () => {
            const host = hostRef.current as unknown as HTMLElement | null;
            if (!host || cancelled) return;

            host.innerHTML = '';
            const canvas = document.createElement('canvas');
            canvas.style.width = '100%';
            canvas.style.height = `${height}px`;
            host.appendChild(canvas);

            const { Chart, registerables } = await import('chart.js');
            Chart.register(...registerables);
            if (cancelled) return;

            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }

            const grid = isDarkMode ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.2)';
            const tick = isDarkMode ? '#94A3B8' : '#64748B';

            chartRef.current = new Chart(canvas.getContext('2d')!, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            data: values,
                            borderColor: color,
                            backgroundColor: (ctx: any) => {
                                const chart = ctx.chart;
                                const { ctx: c, chartArea } = chart;
                                if (!chartArea) return `${color}33`;
                                const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                g.addColorStop(0, `${color}55`);
                                g.addColorStop(1, `${color}05`);
                                return g;
                            },
                            fill: true,
                            tension: 0.25,
                            pointRadius: values.map((_, i) => (i === values.length - 1 ? 5 : 3)),
                            pointBackgroundColor: color,
                            pointBorderColor: isDarkMode ? '#0F172A' : '#fff',
                            pointBorderWidth: 2,
                            borderWidth: 2.5,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (item: any) =>
                                    `${yPrefix}${Number(item.raw).toLocaleString('es-CO', {
                                        maximumFractionDigits: 2,
                                    })}`,
                            },
                        },
                    },
                    scales: {
                        x: {
                            grid: { color: grid, drawBorder: false },
                            ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                        },
                        y: {
                            grid: { color: grid, drawBorder: false },
                            ticks: {
                                color: tick,
                                callback: (v: any) =>
                                    `${yPrefix}${Number(v).toLocaleString('es-CO', {
                                        notation: 'compact',
                                        maximumFractionDigits: 1,
                                    })}`,
                            },
                        },
                    },
                },
            });
        };

        mount();
        return () => {
            cancelled = true;
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [labels, values, isDarkMode, height, color, yPrefix]);

    if (Platform.OS !== 'web') {
        return (
            <View style={{ height, justifyContent: 'center', padding: 12 }}>
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', textAlign: 'center' }}>
                    El gráfico está disponible en la versión web.
                </Text>
                {values.map((v, i) => (
                    <Text key={i} style={{ color: isDarkMode ? '#E2E8F0' : '#0F172A', fontSize: 12 }}>
                        {labels[i]}: {formatearMonedaCop(v)}
                    </Text>
                ))}
            </View>
        );
    }

    return <View ref={hostRef} style={{ height, width: '100%' }} />;
}

function SeccionPrecios({
    puntos,
    colors,
    isDarkMode,
    cardBg,
}: {
    puntos: PuntoPrecio[];
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
}) {
    const productos = useMemo(() => {
        const map = new Map<string, string>();
        puntos.forEach((p) => map.set(normalizarProducto(p.producto), p.producto));
        return Array.from(map.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [puntos]);

    const [productoKey, setProductoKey] = useState('');
    const [busqueda, setBusqueda] = useState('');
    /** '' = hasta la fecha; 'YYYY-MM' = mes individual */
    const [filtroMes, setFiltroMes] = useState('');

    useEffect(() => {
        if (!productoKey && productos.length > 0) setProductoKey(productos[0].key);
        if (productoKey && !productos.some((p) => p.key === productoKey)) {
            setProductoKey(productos[0]?.key || '');
        }
    }, [productos, productoKey]);

    const productosFiltrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return productos;
        return productos.filter((p) => p.label.toLowerCase().includes(q));
    }, [productos, busqueda]);

    const serieCompleta = useMemo(() => {
        return puntos
            .filter((p) => normalizarProducto(p.producto) === productoKey)
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [puntos, productoKey]);

    const mesesSerie = useMemo(() => {
        const map = new Map<string, string>();
        serieCompleta.forEach((p) => {
            const mk = mesKeyFromIso(p.fecha);
            if (mk) map.set(mk, labelMes(mk));
        });
        return Array.from(map.entries())
            .map(([key, label]) => ({ key, label }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }, [serieCompleta]);

    useEffect(() => {
        if (filtroMes && !mesesSerie.some((m) => m.key === filtroMes)) setFiltroMes('');
    }, [mesesSerie, filtroMes]);

    const serie = useMemo(() => {
        if (!filtroMes) return serieCompleta;
        return serieCompleta.filter((p) => mesKeyFromIso(p.fecha) === filtroMes);
    }, [serieCompleta, filtroMes]);

    // La curva siempre muestra el historial completo del producto (tendencia).
    const labelsChart = serieCompleta.map((p) => formatFechaDisplay(p.fecha) || p.fecha);
    const valuesChart = serieCompleta.map((p) => p.precio);

    const delta =
        serie.length >= 2 ? serie[serie.length - 1].precio - serie[0].precio : 0;
    const deltaPct =
        serie.length >= 2 && serie[0].precio > 0
            ? (delta / serie[0].precio) * 100
            : 0;
    const ultimo = serie.length > 0 ? serie[serie.length - 1] : null;
    const penultimo = serie.length > 1 ? serie[serie.length - 2] : null;
    const cambioUltimo = ultimo && penultimo ? ultimo.precio - penultimo.precio : null;
    const mesActivoLabel = filtroMes
        ? mesesSerie.find((m) => m.key === filtroMes)?.label || filtroMes
        : 'Hasta la fecha';

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <Text style={[styles.titulo, { color: colors.text }]}>Historial de precios</Text>
            <Text style={[styles.ayuda, { color: colors.subText }]}>
                Cada pedido con precio unitario queda en la curva. Usa «Hasta la fecha» o un mes
                concreto para filtrar el detalle y las variaciones.
            </Text>

            <TextInput
                style={[
                    styles.search,
                    {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                        color: colors.text,
                    },
                ]}
                placeholder="Buscar producto…"
                placeholderTextColor={colors.subText}
                value={busqueda}
                onChangeText={setBusqueda}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {productosFiltrados.map((p) => {
                        const activo = p.key === productoKey;
                        return (
                            <TouchableOpacity
                                key={p.key}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: activo
                                            ? '#22C55E22'
                                            : isDarkMode
                                              ? '#1E293B'
                                              : '#F1F5F9',
                                        borderColor: activo ? '#22C55E' : colors.border,
                                    },
                                ]}
                                onPress={() => setProductoKey(p.key)}
                            >
                                <Text
                                    style={{
                                        color: activo ? '#22C55E' : colors.text,
                                        fontWeight: activo ? '800' : '600',
                                        fontSize: 12,
                                    }}
                                    numberOfLines={1}
                                >
                                    {p.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {mesesSerie.length > 0 && (
                <>
                    <Text style={[styles.filtroLabel, { color: colors.subText }]}>Período</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: !filtroMes
                                            ? '#22C55E22'
                                            : isDarkMode
                                              ? '#1E293B'
                                              : '#F1F5F9',
                                        borderColor: !filtroMes ? '#22C55E' : colors.border,
                                    },
                                ]}
                                onPress={() => setFiltroMes('')}
                            >
                                <Text
                                    style={{
                                        color: !filtroMes ? '#22C55E' : colors.text,
                                        fontWeight: '800',
                                        fontSize: 12,
                                    }}
                                >
                                    Hasta la fecha
                                </Text>
                            </TouchableOpacity>
                            {mesesSerie
                                .slice()
                                .reverse()
                                .map((m) => {
                                    const activo = filtroMes === m.key;
                                    return (
                                        <TouchableOpacity
                                            key={m.key}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: activo
                                                        ? '#22C55E22'
                                                        : isDarkMode
                                                          ? '#1E293B'
                                                          : '#F1F5F9',
                                                    borderColor: activo ? '#22C55E' : colors.border,
                                                },
                                            ]}
                                            onPress={() => setFiltroMes(m.key)}
                                        >
                                            <Text
                                                style={{
                                                    color: activo ? '#22C55E' : colors.text,
                                                    fontWeight: activo ? '800' : '600',
                                                    fontSize: 12,
                                                }}
                                            >
                                                {m.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                        </View>
                    </ScrollView>
                </>
            )}

            {serieCompleta.length === 0 ? (
                <Text style={{ color: colors.subText, marginVertical: 24, textAlign: 'center' }}>
                    No hay pedidos con precio unitario para este producto.
                </Text>
            ) : (
                <>
                    <View style={styles.kpiRow}>
                        <View style={[styles.kpi, { borderColor: colors.border }]}>
                            <Text style={[styles.kpiLabel, { color: colors.subText }]}>
                                {filtroMes ? `Último precio · ${mesActivoLabel}` : 'Último precio'}
                            </Text>
                            <Text style={[styles.kpiValuePrice, { color: isDarkMode ? '#4ADE80' : '#15803D' }]}>
                                {ultimo ? formatearMonedaCop(ultimo.precio) : '—'}
                            </Text>
                        </View>
                        <View style={[styles.kpi, { borderColor: colors.border }]}>
                            <Text style={[styles.kpiLabel, { color: colors.subText }]}>
                                Vs. pedido anterior{filtroMes ? ' (en el mes)' : ''}
                            </Text>
                            <Text
                                style={[
                                    styles.kpiValue,
                                    {
                                        color:
                                            cambioUltimo == null
                                                ? colors.subText
                                                : cambioUltimo > 0
                                                  ? '#F87171'
                                                  : cambioUltimo < 0
                                                    ? '#34D399'
                                                    : colors.text,
                                    },
                                ]}
                            >
                                {cambioUltimo == null
                                    ? '—'
                                    : `${cambioUltimo > 0 ? '+' : ''}${formatearMonedaCop(cambioUltimo)}`}
                            </Text>
                        </View>
                        <View style={[styles.kpi, { borderColor: colors.border }]}>
                            <Text style={[styles.kpiLabel, { color: colors.subText }]}>
                                Variación {filtroMes ? 'del mes' : 'histórica'}
                            </Text>
                            <Text
                                style={[
                                    styles.kpiValue,
                                    {
                                        color:
                                            delta > 0 ? '#F87171' : delta < 0 ? '#34D399' : colors.text,
                                    },
                                ]}
                            >
                                {serie.length < 2
                                    ? '—'
                                    : `${delta > 0 ? '+' : ''}${formatearMonedaCop(delta)} (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.subTitulo, { color: colors.text, marginTop: 4 }]}>
                        Tendencia completa del producto
                    </Text>
                    <View
                        style={[
                            styles.chartBox,
                            {
                                backgroundColor: isDarkMode ? '#0B1220' : '#F8FAFC',
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <AreaLineChart
                            labels={labelsChart}
                            values={valuesChart}
                            isDarkMode={isDarkMode}
                            color="#22C55E"
                        />
                    </View>

                    <Text style={[styles.subTitulo, { color: colors.text }]}>
                        Detalle de pedidos · {mesActivoLabel}
                    </Text>
                    {serie.length === 0 ? (
                        <Text style={{ color: colors.subText, marginBottom: 8 }}>
                            Sin pedidos con precio en este período.
                        </Text>
                    ) : (
                        <>
                            <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                                {['FECHA', 'REQ', 'PROVEEDOR', 'PRECIO', 'TIPO', 'Δ', 'TOTAL'].map((h) => (
                                    <Text key={h} style={[styles.th, { color: colors.subText, flex: 1 }]}>
                                        {h}
                                    </Text>
                                ))}
                            </View>
                            {serie.map((p, i) => {
                                const prev = i > 0 ? serie[i - 1].precio : null;
                                const dlt = prev != null ? p.precio - prev : null;
                                return (
                                    <View
                                        key={p.key}
                                        style={[styles.tableRow, { borderBottomColor: colors.border }]}
                                    >
                                        <Text style={[styles.td, { color: colors.text, flex: 1 }]}>
                                            {formatFechaDisplay(p.fecha)}
                                        </Text>
                                        <Text style={[styles.td, { color: colors.subText, flex: 1 }]}>{p.codigo}</Text>
                                        <Text style={[styles.td, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                                            {p.proveedor}
                                        </Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.td, { color: colors.text, fontWeight: '700' }]}>
                                                {formatearMonedaCop(p.precio)}
                                            </Text>
                                            {p.precioEspecial ? (
                                                <Text
                                                    style={{
                                                        color: '#F59E0B',
                                                        fontSize: 10,
                                                        fontWeight: '700',
                                                    }}
                                                    numberOfLines={2}
                                                >
                                                    Precio esp.
                                                    {p.comentarioPrecioEspecial
                                                        ? `: ${p.comentarioPrecioEspecial}`
                                                        : ''}
                                                </Text>
                                            ) : p.comentarioPrecioEspecial ? (
                                                <Text
                                                    style={{ color: colors.subText, fontSize: 10 }}
                                                    numberOfLines={2}
                                                >
                                                    {p.comentarioPrecioEspecial}
                                                </Text>
                                            ) : (
                                                <Text style={{ color: colors.subText, fontSize: 10 }}>Estándar</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.td, { color: colors.subText, flex: 1, fontSize: 11 }]}>
                                            {p.precioEspecial ? 'Especial' : 'Catálogo'}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.td,
                                                {
                                                    flex: 1,
                                                    fontWeight: '700',
                                                    color:
                                                        dlt == null
                                                            ? colors.subText
                                                            : dlt > 0
                                                              ? '#F87171'
                                                              : dlt < 0
                                                                ? '#34D399'
                                                                : colors.text,
                                                },
                                            ]}
                                        >
                                            {dlt == null
                                                ? '—'
                                                : `${dlt > 0 ? '+' : ''}${formatearMonedaCop(dlt)}`}
                                        </Text>
                                        <Text style={[styles.td, { color: colors.subText, flex: 1 }]}>
                                            {formatearMonedaCop(p.total)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </>
                    )}
                </>
            )}
        </View>
    );
}

function SeccionGastos({
    puntos,
    colors,
    isDarkMode,
    cardBg,
}: {
    puntos: PuntoPrecio[];
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
}) {
    const [vista, setVista] = useState<'proveedor' | 'producto'>('proveedor');
    /** '' = hasta la fecha (todos); 'YYYY-MM' = mes individual */
    const [filtroMes, setFiltroMes] = useState('');

    const gastosMes = useMemo(() => construirGastosPorMes(puntos), [puntos]);
    const mesesDisponibles = useMemo(
        () => gastosMes.map((g) => ({ key: g.mesKey, label: g.label })),
        [gastosMes]
    );

    useEffect(() => {
        if (filtroMes && !mesesDisponibles.some((m) => m.key === filtroMes)) {
            setFiltroMes('');
        }
    }, [mesesDisponibles, filtroMes]);

    const puntosFiltrados = useMemo(() => {
        if (!filtroMes) return puntos;
        return puntos.filter((p) => mesKeyFromIso(p.fecha) === filtroMes);
    }, [puntos, filtroMes]);

    const gastosMesVista = useMemo(() => {
        if (!filtroMes) return gastosMes;
        return gastosMes.filter((g) => g.mesKey === filtroMes);
    }, [gastosMes, filtroMes]);

    const totalFiltrado = useMemo(
        () => puntosFiltrados.reduce((s, p) => s + p.total, 0),
        [puntosFiltrados]
    );
    const totalHastaFecha = useMemo(() => puntos.reduce((s, p) => s + p.total, 0), [puntos]);

    const labels = gastosMes.map((g) => g.label);
    const values = gastosMes.map((g) => g.total);

    const ranking = useMemo(() => {
        const map: Record<string, number> = {};
        puntosFiltrados.forEach((p) => {
            const key = vista === 'proveedor' ? p.proveedor : p.producto;
            map[key] = (map[key] || 0) + p.total;
        });
        return Object.entries(map)
            .map(([nombre, total]) => ({ nombre, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 12);
    }, [puntosFiltrados, vista]);

    const maxRank = ranking[0]?.total || 1;
    const mesActivoLabel = filtroMes
        ? mesesDisponibles.find((m) => m.key === filtroMes)?.label || filtroMes
        : 'Hasta la fecha';

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <Text style={[styles.titulo, { color: colors.text }]}>Gastos mes a mes</Text>
            <Text style={[styles.ayuda, { color: colors.subText }]}>
                Suma de (precio unitario × cantidad) de cada pedido. Elige «Hasta la fecha» para el
                acumulado, o un mes concreto para ver solo ese período.
            </Text>

            <Text style={[styles.filtroLabel, { color: colors.subText }]}>Período</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={[
                            styles.chip,
                            {
                                backgroundColor: !filtroMes
                                    ? '#3B82F622'
                                    : isDarkMode
                                      ? '#1E293B'
                                      : '#F1F5F9',
                                borderColor: !filtroMes ? '#3B82F6' : colors.border,
                            },
                        ]}
                        onPress={() => setFiltroMes('')}
                    >
                        <Text
                            style={{
                                color: !filtroMes ? '#60A5FA' : colors.text,
                                fontWeight: '800',
                                fontSize: 12,
                            }}
                        >
                            Hasta la fecha
                        </Text>
                    </TouchableOpacity>
                    {mesesDisponibles
                        .slice()
                        .reverse()
                        .map((m) => {
                            const activo = filtroMes === m.key;
                            return (
                                <TouchableOpacity
                                    key={m.key}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: activo
                                                ? '#3B82F622'
                                                : isDarkMode
                                                  ? '#1E293B'
                                                  : '#F1F5F9',
                                            borderColor: activo ? '#3B82F6' : colors.border,
                                        },
                                    ]}
                                    onPress={() => setFiltroMes(m.key)}
                                >
                                    <Text
                                        style={{
                                            color: activo ? '#60A5FA' : colors.text,
                                            fontWeight: activo ? '800' : '600',
                                            fontSize: 12,
                                        }}
                                    >
                                        {m.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                </View>
            </ScrollView>

            <View style={styles.kpiRow}>
                <View style={[styles.kpi, { borderColor: colors.border, flex: 1.2 }]}>
                    <Text style={[styles.kpiLabel, { color: colors.subText }]}>
                        {filtroMes ? `Gasto de ${mesActivoLabel}` : 'Gasto hasta la fecha'}
                    </Text>
                    <Text style={[styles.kpiValuePrice, { color: '#60A5FA' }]}>
                        {formatearMonedaCop(totalFiltrado)}
                    </Text>
                </View>
                {filtroMes ? (
                    <View style={[styles.kpi, { borderColor: colors.border, flex: 1.2 }]}>
                        <Text style={[styles.kpiLabel, { color: colors.subText }]}>
                            Acumulado hasta la fecha
                        </Text>
                        <Text style={[styles.kpiValue, { color: colors.text }]}>
                            {formatearMonedaCop(totalHastaFecha)}
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.kpi, { borderColor: colors.border }]}>
                        <Text style={[styles.kpiLabel, { color: colors.subText }]}>Meses con pedidos</Text>
                        <Text style={[styles.kpiValue, { color: colors.text }]}>{gastosMes.length}</Text>
                    </View>
                )}
            </View>

            {gastosMes.length === 0 ? (
                <Text style={{ color: colors.subText, marginVertical: 24, textAlign: 'center' }}>
                    No hay pedidos con precio para calcular gastos.
                </Text>
            ) : (
                <>
                    <Text style={[styles.subTitulo, { color: colors.text, marginTop: 4 }]}>
                        Tendencia mensual (todos los meses)
                    </Text>
                    <View
                        style={[
                            styles.chartBox,
                            {
                                backgroundColor: isDarkMode ? '#0B1220' : '#F8FAFC',
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <AreaLineChart
                            labels={labels}
                            values={values}
                            isDarkMode={isDarkMode}
                            color="#3B82F6"
                            height={240}
                        />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 4 }}>
                        {(
                            [
                                { id: 'proveedor' as const, label: 'Por proveedor' },
                                { id: 'producto' as const, label: 'Por producto' },
                            ] as const
                        ).map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor:
                                            vista === opt.id
                                                ? '#3B82F622'
                                                : isDarkMode
                                                  ? '#1E293B'
                                                  : '#F1F5F9',
                                        borderColor: vista === opt.id ? '#3B82F6' : colors.border,
                                    },
                                ]}
                                onPress={() => setVista(opt.id)}
                            >
                                <Text
                                    style={{
                                        color: vista === opt.id ? '#60A5FA' : colors.text,
                                        fontWeight: '700',
                                        fontSize: 12,
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.subTitulo, { color: colors.text }]}>
                        Ranking {vista === 'proveedor' ? 'de proveedores' : 'de productos'}
                        {filtroMes ? ` · ${mesActivoLabel}` : ' · hasta la fecha'}
                    </Text>
                    {ranking.length === 0 ? (
                        <Text style={{ color: colors.subText, marginBottom: 8 }}>
                            Sin gastos en este período.
                        </Text>
                    ) : (
                        ranking.map((r, i) => (
                            <View key={r.nombre} style={styles.rankRow}>
                                <Text style={[styles.rankPos, { color: colors.subText }]}>{i + 1}</Text>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text
                                            style={{ color: colors.text, fontWeight: '700', fontSize: 13, flex: 1 }}
                                            numberOfLines={1}
                                        >
                                            {r.nombre}
                                        </Text>
                                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                                            {formatearMonedaCop(r.total)}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.rankTrack,
                                            { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.rankFill,
                                                {
                                                    width: `${Math.max(4, (r.total / maxRank) * 100)}%`,
                                                    backgroundColor: vista === 'proveedor' ? '#A855F7' : '#3B82F6',
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))
                    )}

                    <Text style={[styles.subTitulo, { color: colors.text, marginTop: 16 }]}>
                        {filtroMes ? `Detalle · ${mesActivoLabel}` : 'Desglose mensual'}
                    </Text>
                    {gastosMesVista
                        .slice()
                        .reverse()
                        .map((g) => {
                            const top = Object.entries(
                                vista === 'proveedor' ? g.porProveedor : g.porProducto
                            )
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, filtroMes ? 20 : 3);
                            return (
                                <View
                                    key={g.mesKey}
                                    style={[
                                        styles.mesCard,
                                        {
                                            borderColor:
                                                filtroMes === g.mesKey ? '#3B82F6' : colors.border,
                                        },
                                    ]}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: colors.text, fontWeight: '800' }}>{g.label}</Text>
                                        <Text style={{ color: '#60A5FA', fontWeight: '800' }}>
                                            {formatearMonedaCop(g.total)}
                                        </Text>
                                    </View>
                                    {top.map(([nombre, valor]) => (
                                        <Text
                                            key={nombre}
                                            style={{ color: colors.subText, fontSize: 12, marginTop: 3 }}
                                            numberOfLines={1}
                                        >
                                            · {nombre}: {formatearMonedaCop(valor)}
                                        </Text>
                                    ))}
                                </View>
                            );
                        })}
                </>
            )}
        </View>
    );
}

export default function AlmacenIndicadoresTab({
    requisiciones,
    colors,
    isDarkMode,
    cardBg,
    isWide,
}: Props) {
    const [seccion, setSeccion] = useState<SeccionIndicador>('proveedores');
    const puntos = useMemo(() => extraerPuntosPrecio(requisiciones), [requisiciones]);

    return (
        <View>
            <View style={styles.subTabsRow}>
                {SECCIONES.map((s) => {
                    const activo = seccion === s.id;
                    return (
                        <TouchableOpacity
                            key={s.id}
                            style={[
                                styles.subTab,
                                {
                                    backgroundColor: activo
                                        ? isDarkMode
                                            ? '#1E3A5F'
                                            : '#DBEAFE'
                                        : 'transparent',
                                    borderColor: activo ? '#3B82F6' : colors.border,
                                },
                            ]}
                            onPress={() => setSeccion(s.id)}
                        >
                            <Text style={{ marginRight: 6 }}>{s.icon}</Text>
                            <Text
                                style={{
                                    color: activo ? (isDarkMode ? '#93C5FD' : '#1D4ED8') : colors.subText,
                                    fontWeight: activo ? '800' : '600',
                                    fontSize: 13,
                                }}
                            >
                                {s.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {seccion === 'proveedores' && (
                <AlmacenCalidadProveedoresTab
                    requisiciones={requisiciones}
                    colors={colors}
                    isDarkMode={isDarkMode}
                    cardBg={cardBg}
                    isWide={isWide}
                />
            )}
            {seccion === 'precios' && (
                <SeccionPrecios
                    puntos={puntos}
                    colors={colors}
                    isDarkMode={isDarkMode}
                    cardBg={cardBg}
                />
            )}
            {seccion === 'gastos' && (
                <SeccionGastos
                    puntos={puntos}
                    colors={colors}
                    isDarkMode={isDarkMode}
                    cardBg={cardBg}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    subTabsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    subTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
    },
    titulo: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    subTitulo: { fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 8 },
    ayuda: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
    filtroLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
    search: {
        height: 40,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
        fontSize: 14,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        maxWidth: 220,
    },
    kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    kpi: {
        flexGrow: 1,
        minWidth: 140,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
    },
    kpiLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    kpiValue: { fontSize: 15, fontWeight: '800' },
    kpiValuePrice: { fontSize: 20, fontWeight: '900', letterSpacing: 0.2 },
    chartBox: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        gap: 4,
    },
    th: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 4,
        alignItems: 'center',
    },
    td: { fontSize: 12 },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    rankPos: { width: 22, fontWeight: '800', fontSize: 13 },
    rankTrack: { height: 6, borderRadius: 3, marginTop: 5, overflow: 'hidden' },
    rankFill: { height: '100%', borderRadius: 3 },
    mesCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
});
