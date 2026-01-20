import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DailyTotalsProps {
    tirosTotales: number;
    desperdicioTotal: number;
    meta?: number;
    valorPorTiro?: number;
}

// Colombian holidays calculation (mirrors backend HorarioLaboralHelper)
function esFestivoColombia(fecha: Date): boolean {
    const año = fecha.getFullYear();
    const festivos = obtenerFestivosColombia(año);
    return festivos.some(f => f.toDateString() === fecha.toDateString());
}

function obtenerFestivosColombia(año: number): Date[] {
    const festivos: Date[] = [];

    // Fixed holidays
    festivos.push(new Date(año, 0, 1));   // Año Nuevo
    festivos.push(new Date(año, 4, 1));   // Día del Trabajo
    festivos.push(new Date(año, 6, 20));  // Grito de Independencia
    festivos.push(new Date(año, 7, 7));   // Batalla de Boyacá
    festivos.push(new Date(año, 11, 8));  // Inmaculada Concepción
    festivos.push(new Date(año, 11, 25)); // Navidad

    // Easter calculation (Gauss algorithm)
    const pascua = calcularPascua(año);
    festivos.push(new Date(pascua.getTime() - 3 * 24 * 60 * 60 * 1000)); // Jueves Santo
    festivos.push(new Date(pascua.getTime() - 2 * 24 * 60 * 60 * 1000)); // Viernes Santo
    festivos.push(trasladarALunes(new Date(pascua.getTime() + 39 * 24 * 60 * 60 * 1000))); // Ascensión
    festivos.push(trasladarALunes(new Date(pascua.getTime() + 60 * 24 * 60 * 60 * 1000))); // Corpus Christi
    festivos.push(trasladarALunes(new Date(pascua.getTime() + 68 * 24 * 60 * 60 * 1000))); // Sagrado Corazón

    // Ley Emiliani holidays
    festivos.push(trasladarALunes(new Date(año, 0, 6)));   // Reyes Magos
    festivos.push(trasladarALunes(new Date(año, 2, 19)));  // San José
    festivos.push(trasladarALunes(new Date(año, 5, 29)));  // San Pedro y San Pablo
    festivos.push(trasladarALunes(new Date(año, 7, 15)));  // Asunción de la Virgen
    festivos.push(trasladarALunes(new Date(año, 9, 12)));  // Día de la Raza
    festivos.push(trasladarALunes(new Date(año, 10, 1)));  // Todos los Santos
    festivos.push(trasladarALunes(new Date(año, 10, 11))); // Independencia de Cartagena

    return festivos;
}

function calcularPascua(año: number): Date {
    const a = año % 19;
    const b = Math.floor(año / 100);
    const c = año % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(año, mes - 1, dia);
}

function trasladarALunes(fecha: Date): Date {
    const dia = fecha.getDay();
    if (dia === 1) return fecha; // Already Monday
    const diasHastaLunes = (1 - dia + 7) % 7 || 7;
    return new Date(fecha.getTime() + diasHastaLunes * 24 * 60 * 60 * 1000);
}

function esHorarioBonificable(): { esBonificable: boolean; mensaje?: string } {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0=Sunday, 6=Saturday
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();
    const horaDecimal = hora + minutos / 60;

    // Check Sunday
    if (diaSemana === 0) {
        return { esBonificable: false, mensaje: 'Domingo - Proceso no bonificable' };
    }

    // Check Holiday
    if (esFestivoColombia(ahora)) {
        return { esBonificable: false, mensaje: 'Día Festivo - Proceso no bonificable' };
    }

    // Saturday: 8:00 AM - 12:00 PM
    if (diaSemana === 6) {
        if (horaDecimal >= 8 && horaDecimal <= 12) {
            return { esBonificable: true };
        }
        return { esBonificable: false, mensaje: 'Fuera de horario (Sáb 8am-12pm)' };
    }

    // Monday-Friday: 7:00 AM - 4:00 PM
    if (horaDecimal >= 7 && horaDecimal <= 16) {
        return { esBonificable: true };
    }
    return { esBonificable: false, mensaje: 'Fuera de horario (L-V 7am-4pm)' };
}

export function DailyTotals({ tirosTotales, desperdicioTotal, meta = 0, valorPorTiro = 0 }: DailyTotalsProps) {
    const formatNumber = (num: number): string => {
        return num.toLocaleString('es-CO');
    };

    const formatCurrency = (num: number): string => {
        return num.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Check if current time is bonificable
    const { esBonificable, mensaje } = esHorarioBonificable();

    // Calcular rendimiento (%)
    const rendimiento = meta > 0 ? ((tirosTotales / meta) * 100) : 0;

    // Calcular bonificación: (tiros - meta) * valorPorTiro (solo si supera la meta Y es bonificable)
    const tirosExcedente = Math.max(0, tirosTotales - meta);
    const bonificacion = esBonificable ? tirosExcedente * valorPorTiro : 0;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Producción del Día</Text>

            {/* Non-bonificable warning banner */}
            {!esBonificable && (
                <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>⚠️ {mensaje}</Text>
                </View>
            )}

            {/* Primera fila: Tiros y Desperdicio */}
            <View style={styles.cardsRow}>
                <View style={[styles.card, styles.cardTiros]}>
                    <Text style={styles.cardValue}>{formatNumber(tirosTotales)}</Text>
                    <Text style={styles.cardLabel}>Tiros</Text>
                </View>
                <View style={[styles.card, styles.cardDesperdicio]}>
                    <Text style={styles.cardValue}>{formatNumber(desperdicioTotal)}</Text>
                    <Text style={styles.cardLabel}>Desperdicio</Text>
                </View>
            </View>

            {/* Segunda fila: Rendimiento y Bonificación */}
            <View style={[styles.cardsRow, { marginTop: 12 }]}>
                <View style={[styles.card, styles.cardRendimiento]}>
                    {meta > 0 ? (
                        <>
                            <Text style={[styles.cardValue, rendimiento >= 100 ? styles.valueGood : styles.valueLow]}>
                                {rendimiento.toFixed(1)}%
                            </Text>
                            <Text style={styles.cardLabel}>Rendimiento</Text>
                            <Text style={styles.cardSubLabel}>Meta: {formatNumber(meta)}</Text>
                        </>
                    ) : (
                        <>
                            <Text style={[styles.cardValue, { color: '#A0AEC0' }]}>--%</Text>
                            <Text style={styles.cardLabel}>Rendimiento</Text>
                            <Text style={styles.cardSubLabel}>Seleccione Máquina</Text>
                        </>
                    )}
                </View>
                <View style={[styles.card, !esBonificable ? styles.cardDisabled : styles.cardBonificacion]}>
                    <Text style={[styles.cardValue, !esBonificable ? styles.valueDisabled : (bonificacion > 0 ? styles.valueGood : { color: '#A0AEC0' })]}>
                        {esBonificable ? formatCurrency(bonificacion) : '$0'}
                    </Text>
                    <Text style={styles.cardLabel}>Bonificación</Text>
                    {esBonificable && bonificacion > 0 && (
                        <Text style={styles.cardSubLabel}>+{formatNumber(tirosExcedente)} tiros extra</Text>
                    )}
                    {!esBonificable && (
                        <Text style={styles.cardSubLabel}>No aplica</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E3A5F',
        marginBottom: 12,
    },
    cardsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    card: {
        flex: 1,
        minWidth: 100,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
    },
    cardTiros: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    cardDesperdicio: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    cardRendimiento: {
        backgroundColor: '#F0FFF4',
        borderWidth: 1,
        borderColor: '#C6F6D5',
    },
    cardBonificacion: {
        backgroundColor: '#FAF5FF',
        borderWidth: 1,
        borderColor: '#E9D8FD',
    },
    cardValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E3A5F',
        fontVariant: ['tabular-nums'],
    },
    valueGood: {
        color: '#276749',
    },
    valueLow: {
        color: '#C53030',
    },
    cardLabel: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
        fontWeight: '500',
    },
    cardSubLabel: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2,
    },
    warningBanner: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        alignItems: 'center',
    },
    warningText: {
        color: '#92400E',
        fontWeight: '600',
        fontSize: 12,
    },
    cardDisabled: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    valueDisabled: {
        color: '#94A3B8',
    },
});

