/**
 * Resumen estructurado de campos OCR (OP / Ficha) — presentación por secciones.
 */

import React from 'react';
import { View, Text, Platform } from 'react-native';
import {
    SECCIONES_RESUMEN_OP,
    CAMPOS_RESUMEN_FICHA,
    entradasResumen,
    parseProcesosDetalle,
    parsePiezasDesdeCampos,
    valorCampo,
} from '../utils/adjuntosCamposResumen';

function FilaCampo({ label, val, colors, destacado }) {
    return (
        <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.subText }}>{label}</Text>
            <Text
                style={{
                    fontSize: 12,
                    color: colors.text,
                    marginTop: 2,
                    fontWeight: destacado ? '600' : '400',
                    lineHeight: 18,
                    ...(Platform.OS === 'web' ? { whiteSpace: 'pre-wrap' } : {}),
                }}
            >
                {val}
            </Text>
        </View>
    );
}

function SeccionMaterial({ campos, colors }) {
    const material = valorCampo(campos, 'material');
    const medidas = [
        ['calibre', 'Calibre'],
        ['gramaje', 'Gramaje (g)'],
        ['anchoRollo', 'Ancho rollo'],
        ['largoCorte', 'Largo corte'],
        ['anchoPliego', 'Ancho pliego'],
        ['altoPliego', 'Alto pliego'],
        ['hojas', 'Hojas'],
        ['cb', 'CB'],
        ['tamanoFinal', 'Tamaño final'],
    ]
        .map(([key, label]) => ({ label, val: valorCampo(campos, key) }))
        .filter((x) => x.val);

    if (!material && medidas.length === 0) return null;

    return (
        <View
            style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
            }}
        >
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 8 }}>
                Material
            </Text>
            {material ? <FilaCampo label="Material" val={material} colors={colors} destacado /> : null}
            {medidas.length > 0 ? (
                <View
                    style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        marginTop: material ? 4 : 0,
                        gap: 8,
                    }}
                >
                    {medidas.map(({ label, val }) => (
                        <View
                            key={label}
                            style={{
                                minWidth: Platform.OS === 'web' ? 120 : '45%',
                                flexGrow: 1,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                backgroundColor: colors.background,
                            }}
                        >
                            <Text style={{ fontSize: 10, color: colors.subText, fontWeight: '600' }}>
                                {label}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>{val}</Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

function SeccionProcesos({ campos, colors }) {
    const filas = parseProcesosDetalle(campos);
    if (filas.length === 0) return null;

    return (
        <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 8 }}>
                Procesos ({filas.length})
            </Text>
            {filas.map((fila, idx) => (
                <View
                    key={`${fila.proceso}-${idx}`}
                    style={{
                        marginBottom: 8,
                        padding: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: 6,
                        }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, flex: 1 }}>
                            {fila.proceso}
                        </Text>
                        {fila.cantidad ? (
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: fila.cantidad === '0,00' ? colors.subText : colors.primary,
                                }}
                            >
                                {fila.cantidad}
                            </Text>
                        ) : null}
                    </View>
                    {fila.notas && fila.notas !== '—' ? (
                        <Text
                            style={{
                                fontSize: 11,
                                color: colors.subText,
                                marginTop: 6,
                                lineHeight: 16,
                                ...(Platform.OS === 'web' ? { whiteSpace: 'pre-wrap' } : {}),
                            }}
                        >
                            {fila.notas}
                        </Text>
                    ) : null}
                </View>
            ))}
        </View>
    );
}

export default function AdjuntosResumenPresentacion({ campos, tipoDoc, colors }) {
    if (!campos || Object.keys(campos).length === 0) {
        return <Text style={{ fontSize: 11, color: colors.subText }}>Sin campos estructurados.</Text>;
    }

    if (tipoDoc === 'ficha') {
        const entradas = entradasResumen(campos, CAMPOS_RESUMEN_FICHA);
        if (entradas.length === 0) {
            return <Text style={{ fontSize: 11, color: colors.subText }}>Sin campos estructurados.</Text>;
        }
        return entradas.map(({ key, label, val }) => (
            <FilaCampo key={key} label={label} val={val} colors={colors} />
        ));
    }

    if (tipoDoc === 'linea_troquel') {
        const vista = campos.vistaPrevia || campos.VistaPrevia;
        if (vista) {
            return <FilaCampo label="Vista previa OCR" val={vista} colors={colors} />;
        }
        return <Text style={{ fontSize: 11, color: colors.subText }}>Documento almacenado (sin texto OCR).</Text>;
    }

    const piezas = parsePiezasDesdeCampos(campos);
    if (piezas.length > 1) {
        return (
            <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 10 }}>
                    OP con {piezas.length} piezas
                </Text>
                {piezas.map((pieza) => {
                    const pseudoCampos = {
                        material: pieza.material?.material,
                        calibre: pieza.material?.calibre,
                        gramaje: pieza.material?.gramaje,
                        anchoRollo: pieza.material?.anchoRollo,
                        largoCorte: pieza.material?.largoCorte,
                        anchoPliego: pieza.material?.anchoPliego,
                        altoPliego: pieza.material?.altoPliego,
                        hojas: pieza.material?.hojas,
                        cb: pieza.material?.cabidad,
                        tamanoFinal: pieza.material?.tamanoFinal,
                        procesosDetalle: (pieza.procesos || [])
                            .map((p) => `${p.proceso} | ${p.notas || '—'} | ${p.cantidad || '0,00'}`)
                            .join('\n'),
                    };
                    return (
                        <View
                            key={`pieza-${pieza.id}`}
                            style={{
                                marginBottom: 14,
                                padding: 10,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.card,
                            }}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
                                Pieza {pieza.id}: {pieza.nombre || '—'}
                            </Text>
                            <SeccionMaterial campos={pseudoCampos} colors={colors} />
                            <SeccionProcesos campos={pseudoCampos} colors={colors} />
                        </View>
                    );
                })}
            </View>
        );
    }

    const tieneAlgo = SECCIONES_RESUMEN_OP.some((sec) => {
        if (sec.tipo === 'procesos') return parseProcesosDetalle(campos).length > 0;
        return sec.campos.some(([key]) => valorCampo(campos, key));
    });

    if (!tieneAlgo) {
        return <Text style={{ fontSize: 11, color: colors.subText }}>Sin campos estructurados.</Text>;
    }

    return (
        <View style={{ marginTop: 4 }}>
            {SECCIONES_RESUMEN_OP.map((sec) => {
                if (sec.tipo === 'procesos') {
                    return <SeccionProcesos key="procesos" campos={campos} colors={colors} />;
                }
                if (sec.titulo === 'Material') {
                    return <SeccionMaterial key="material" campos={campos} colors={colors} />;
                }
                const entradas = entradasResumen(campos, sec.campos);
                if (entradas.length === 0) return null;
                return (
                    <View key={sec.titulo} style={{ marginBottom: 12 }}>
                        {SECCIONES_RESUMEN_OP.length > 1 ? (
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: '800',
                                    color: colors.primary,
                                    marginBottom: 8,
                                }}
                            >
                                {sec.titulo}
                            </Text>
                        ) : null}
                        {entradas.map(({ key, label, val }) => (
                            <FilaCampo key={key} label={label} val={val} colors={colors} />
                        ))}
                    </View>
                );
            })}
        </View>
    );
}
