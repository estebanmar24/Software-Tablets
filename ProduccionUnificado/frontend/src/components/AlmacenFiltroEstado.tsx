import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ESTADO_REQUISICION_CONFIG, type EstadoRequisicion } from '../data/almacenMockData';
import AlmacenContadorBadge from './AlmacenContadorBadge';

export type FiltroEstadoValor = 'todos' | EstadoRequisicion;

export interface OpcionFiltroEstado {
    id: FiltroEstadoValor;
    label: string;
}

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
};

interface AlmacenFiltroEstadoProps {
    opciones: OpcionFiltroEstado[];
    activo: FiltroEstadoValor;
    onChange: (id: FiltroEstadoValor) => void;
    conteos: Partial<Record<FiltroEstadoValor, number>>;
    colors: ThemeColors;
    isDarkMode: boolean;
}

export default function AlmacenFiltroEstado({
    opciones,
    activo,
    onChange,
    conteos,
    colors,
    isDarkMode,
}: AlmacenFiltroEstadoProps) {
    return (
        <View style={filtroStyles.wrap}>
            <Text style={[filtroStyles.titulo, { color: colors.subText }]}>Filtrar por estado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filtroStyles.scroll}>
                {opciones.map((op) => {
                    const seleccionado = activo === op.id;
                    const count = conteos[op.id] ?? 0;
                    const estadoStyle =
                        op.id !== 'todos' ? ESTADO_REQUISICION_CONFIG[op.id as EstadoRequisicion] : null;
                    const accent = estadoStyle?.border ?? colors.primary;

                    return (
                        <TouchableOpacity
                            key={op.id}
                            style={[
                                filtroStyles.chip,
                                {
                                    borderColor: seleccionado ? accent : colors.border,
                                    backgroundColor: seleccionado
                                        ? isDarkMode
                                            ? `${accent}33`
                                            : `${accent}18`
                                        : isDarkMode
                                          ? '#0F172A'
                                          : colors.inputBackground,
                                },
                            ]}
                            onPress={() => onChange(op.id)}
                            activeOpacity={0.85}
                        >
                            <Text
                                style={[
                                    filtroStyles.chipText,
                                    {
                                        color: seleccionado ? colors.text : colors.subText,
                                        fontWeight: seleccionado ? '700' : '500',
                                    },
                                ]}
                            >
                                {op.label}
                            </Text>
                            <AlmacenContadorBadge
                                count={count}
                                accentColor={accent}
                                variant="filtro"
                                activo={seleccionado}
                                destacarPendiente={
                                    count > 0 && (op.id === 'Pendiente' || op.id === 'Pedido')
                                }
                            />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const filtroStyles = StyleSheet.create({
    wrap: { marginBottom: 16 },
    titulo: { fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
    scroll: { flexDirection: 'row', gap: 8, paddingRight: 8 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: { fontSize: 13, marginRight: 2 },
});
