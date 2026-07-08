import React from 'react';

import { View, Text, Platform } from 'react-native';

/**
 * Parsing de montos en formularios de gastos (base + IVA).
 * @param {unknown} s
 * @returns {number|null} null si vacío o no numérico
 */
export function parseMontoInput(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).trim();
    if (t === '') return null;
    const n = parseFloat(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

/** Colores alineados a summaryCard de Producción / SST (presupuesto / gastado / restante). */
const MINI_LIGHT = {
    base: { bg: '#DBEAFE', label: '#4B5563', value: '#1E40AF' },
    iva: { bg: '#FEE2E2', label: '#4B5563', value: '#991B1B' },
    total: { bg: '#D1FAE5', label: '#4B5563', value: '#065F46' },
};

const MINI_DARK = {
    base: { bg: '#1E3A5F', label: '#93C5FD', value: '#E0E7FF' },
    iva: { bg: '#5C2C0C', label: '#FCD34D', value: '#FEF3C7' },
    total: { bg: '#064E3B', label: '#6EE7B7', value: '#ECFDF5' },
};

/**
 * Montos para tarjetas de lista: nómina/HE/recargo = solo total; resto = base + IVA + total.
 * @param {object} gasto objeto API (precio, precioBase?, precioIva?)
 * @param {boolean} singlePriceRow
 * @returns {{ single: true, total: number } | { single: false, base: number, iva: number, total: number }}
 */
export function getListaMontosGasto(gasto, singlePriceRow) {
    const precio = Number(gasto?.precio);
    const total = Number.isFinite(precio) ? precio : 0;
    if (singlePriceRow) {
        return { single: true, total };
    }
    const pb = parseMontoInput(gasto?.precioBase);
    const pi = parseMontoInput(gasto?.precioIva);
    if (pb !== null && pi !== null) {
        const sum = pb + pi;
        const totalOut = total || sum;
        return { single: false, base: pb, iva: pi, total: totalOut };
    }
    if (pb !== null) {
        return { single: false, base: pb, iva: 0, total: total || pb };
    }
    return { single: false, base: total, iva: 0, total };
}

function MiniMontoCard({ label, amountFormatted, palette, valueSize }) {
    return (
        <View
            style={{
                backgroundColor: palette.bg,
                borderRadius: 8,
                paddingVertical: 8,
                paddingHorizontal: 10,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: Platform.OS === 'web' ? 90 : 78,
                flexShrink: 0,
            }}
        >
            <Text style={{ fontSize: 11, fontWeight: '600', color: palette.label, marginBottom: 2 }}>{label}</Text>
            <Text
                style={{
                    fontSize: valueSize,
                    fontWeight: '800',
                    color: palette.value,
                    textAlign: 'center',
                }}
                numberOfLines={1}
            >
                {amountFormatted}
            </Text>
        </View>
    );
}

/**
 * Bloque de precios en listas de gastos (tarjeta derecha).
 * @param {{ gasto: object, singlePriceRow: boolean, formatCurrency: (n: number) => string, precioStyle: object, theme?: 'light' | 'dark' }} props
 */
export function GastoListaPrecios({ gasto, singlePriceRow, formatCurrency, precioStyle, theme = 'light' }) {
    const m = getListaMontosGasto(gasto, singlePriceRow);
    const pal = theme === 'dark' ? MINI_DARK : MINI_LIGHT;

    if (m.single) {
        return <Text style={precioStyle}>{formatCurrency(m.total)}</Text>;
    }

    return (
        <View
            style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'stretch',
                gap: 8,
                maxWidth: Platform.OS === 'web' ? 340 : 320,
            }}
        >
            <MiniMontoCard label="Base" amountFormatted={formatCurrency(m.base)} palette={pal.base} valueSize={14} />
            <MiniMontoCard label="IVA" amountFormatted={formatCurrency(m.iva)} palette={pal.iva} valueSize={14} />
            <MiniMontoCard label="Total" amountFormatted={formatCurrency(m.total)} palette={pal.total} valueSize={16} />
        </View>
    );
}
