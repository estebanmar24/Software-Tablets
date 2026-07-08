import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { obtenerDatosAdjuntos } from '../services/adjuntosApi';
import {
    buscarProcesoOpParaMaquina,
    materialDesdeOp,
    codigoOpParaMaquina,
} from '../utils/opProcesoMaquina';

interface OpInfoOperarioPanelProps {
    opNumero: string;
    maquinaId: number | null;
    maquinaNombre: string | null;
    /** Dentro del cuadro "Producción del Día" (sin borde propio). */
    embedded?: boolean;
}

export function OpInfoOperarioPanel({
    opNumero,
    maquinaId,
    maquinaNombre,
    embedded = false,
}: OpInfoOperarioPanelProps) {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [sinDatos, setSinDatos] = useState(false);

    const digits = (opNumero || '').replace(/\D/g, '');
    const visible = digits.length >= 4 && maquinaId != null;

    const [material, setMaterial] = useState<ReturnType<typeof materialDesdeOp>>(null);
    const [procesoNotas, setProcesoNotas] = useState<string | null>(null);
    const [procesoTitulo, setProcesoTitulo] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        if (!visible) {
            setMaterial(null);
            setProcesoNotas(null);
            setProcesoTitulo(null);
            setSinDatos(false);
            return;
        }

        setLoading(true);
        setSinDatos(false);
        try {
            const data = await obtenerDatosAdjuntos(digits, false);
            const campos = data?.op?.campos;
            if (!campos || Object.keys(campos).length === 0) {
                setMaterial(null);
                setProcesoNotas(null);
                setProcesoTitulo(null);
                setSinDatos(true);
                return;
            }

            setMaterial(materialDesdeOp(campos));
            const fila = buscarProcesoOpParaMaquina(campos, maquinaId, maquinaNombre);
            if (fila) {
                setProcesoTitulo(fila.proceso.replace(/^\d{1,2}[a-z]?\s+/i, '').trim() || fila.proceso);
                setProcesoNotas(fila.notas && fila.notas !== '—' ? fila.notas : null);
            } else {
                const cod = codigoOpParaMaquina(maquinaId, maquinaNombre);
                setProcesoTitulo(null);
                setProcesoNotas(
                    cod
                        ? `No hay proceso con código ${cod} en esta OP`
                        : 'No se pudo identificar el proceso para esta máquina'
                );
            }
        } catch (e) {
            console.warn('OpInfoOperario:', e);
            setSinDatos(true);
        } finally {
            setLoading(false);
        }
    }, [digits, visible, maquinaId, maquinaNombre]);

    useEffect(() => {
        const t = setTimeout(() => void cargar(), 450);
        return () => clearTimeout(t);
    }, [cargar]);

    if (!visible) return null;

    const wrapStyle = embedded
        ? [styles.wrapEmbedded, { borderTopColor: colors.border }]
        : [styles.wrap, { borderColor: colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }];

    if (loading) {
        return (
            <View style={wrapStyle}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.hint, { color: colors.subText }]}>Cargando datos de la OP…</Text>
            </View>
        );
    }

    if (sinDatos && !material && !procesoNotas) {
        return null;
    }

    const medidas = material
        ? [
              material.anchoRollo && { l: 'Ancho rollo', v: material.anchoRollo },
              material.largoCorte && { l: 'Largo corte', v: material.largoCorte },
              material.anchoPliego && { l: 'Ancho pliego', v: material.anchoPliego },
              material.altoPliego && { l: 'Alto pliego', v: material.altoPliego },
              material.hojas && { l: 'Hojas', v: material.hojas },
              material.cb && { l: 'CB', v: material.cb },
              material.tamanoFinal && { l: 'Tamaño final', v: material.tamanoFinal },
          ].filter(Boolean) as { l: string; v: string }[]
        : [];

    return (
        <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Información OP {digits}</Text>

            {material ? (
                <View style={styles.block}>
                    <Text style={[styles.blockLabel, { color: colors.subText }]}>Material</Text>
                    {material.material ? (
                        <Text style={[styles.materialNombre, { color: colors.text }]}>{material.material}</Text>
                    ) : null}
                    {medidas.length > 0 ? (
                        <View style={styles.medidasGrid}>
                            {medidas.map((m) => (
                                <View key={m.l} style={[styles.medidaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[styles.medidaLabel, { color: colors.subText }]}>{m.l}</Text>
                                    <Text style={[styles.medidaVal, { color: colors.text }]}>{m.v}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>
            ) : null}

            {(procesoTitulo || procesoNotas) && (
                <View style={styles.block}>
                    <Text style={[styles.blockLabel, { color: colors.subText }]}>Proceso en esta máquina</Text>
                    {procesoTitulo ? (
                        <Text style={[styles.procesoNombre, { color: colors.text }]}>{procesoTitulo}</Text>
                    ) : null}
                    {procesoNotas ? (
                        <Text style={[styles.procesoNotas, { color: colors.text }]}>{procesoNotas}</Text>
                    ) : null}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    wrapEmbedded: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
    },
    sectionTitleEmbedded: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 10,
    },
    hint: {
        fontSize: 10,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    block: {
        marginBottom: 10,
    },
    blockLabel: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    materialNombre: {
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
        marginBottom: 6,
    },
    medidasGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    medidaChip: {
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 6,
        borderWidth: 1,
        minWidth: '46%',
    },
    medidaLabel: {
        fontSize: 8,
        fontWeight: '600',
    },
    medidaVal: {
        fontSize: 11,
        fontWeight: '700',
    },
    procesoNombre: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 4,
    },
    procesoNotas: {
        fontSize: 11,
        lineHeight: 16,
    },
});
