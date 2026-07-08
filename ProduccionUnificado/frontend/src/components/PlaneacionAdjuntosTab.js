/**
 * Planeación — Adjuntos OP / Ficha técnica
 * Requiere número OP; renombra a F{n}.pdf y OP{n}.pdf; OCR automático al subir.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../contexts/ThemeContext';
import {
    buscarAdjuntosOp,
    subirAdjuntoOp,
    resolveAdjuntoUrl,
} from '../services/adjuntosApi';

import AdjuntosResumenPresentacion from './AdjuntosResumenPresentacion';
import PlaneacionAdjuntosBiblioteca from './PlaneacionAdjuntosBiblioteca';
import { nombreArchivoAdjunto } from '../utils/adjuntoNombres';

const showAlert = (title, message) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
};

async function fileFromPickerAsset(file) {
    if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        return new File([blob], file.name || 'documento.pdf', { type: 'application/pdf' });
    }
    return {
        uri: file.uri,
        name: file.name || 'documento.pdf',
        type: 'application/pdf',
    };
}

function BloqueCampos({ titulo, extraccion, tipoDoc, colors }) {
    if (!extraccion) return null;

    return (
        <View style={[local.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[local.cardTitle, { color: colors.text }]}>
                {titulo} · {extraccion.metodo}
                {extraccion.error ? ` · ${extraccion.error}` : ''}
            </Text>
            <AdjuntosResumenPresentacion campos={extraccion.campos} tipoDoc={tipoDoc} colors={colors} />
        </View>
    );
}

const SECCIONES = [
    { key: 'subir', label: 'Subir documentos' },
    { key: 'biblioteca', label: 'Biblioteca' },
];

export default function PlaneacionAdjuntosTab() {
    const { colors } = useTheme();
    const [seccion, setSeccion] = useState('subir');
    const [opNumero, setOpNumero] = useState('');
    const [busqueda, setBusqueda] = useState(null);
    const [fichaExtraccion, setFichaExtraccion] = useState(null);
    const [opExtraccion, setOpExtraccion] = useState(null);
    const [lineaTroquelExtraccion, setLineaTroquelExtraccion] = useState(null);
    const [subiendo, setSubiendo] = useState(null);
    const [mensaje, setMensaje] = useState('');

    const digits = (opNumero || '').replace(/\D/g, '');
    const opValida = digits.length >= 1;

    const refrescarBusqueda = useCallback(async () => {
        if (!opValida) {
            setBusqueda(null);
            return;
        }
        try {
            const data = await buscarAdjuntosOp(digits);
            setBusqueda(data);
        } catch {
            setBusqueda({ numero: digits, ficha: null, op: null, lineaTroquel: null });
        }
    }, [digits, opValida]);

    useEffect(() => {
        const t = setTimeout(() => void refrescarBusqueda(), 400);
        return () => clearTimeout(t);
    }, [refrescarBusqueda]);

    const onOpChange = (text) => {
        const d = text.replace(/\D/g, '');
        setOpNumero(d);
        setFichaExtraccion(null);
        setOpExtraccion(null);
        setLineaTroquelExtraccion(null);
        setMensaje('');
    };

    const subirDocumento = async (tipoDoc) => {
        if (!opValida) {
            showAlert('OP requerida', 'Ingrese el número de OP (solo números) antes de subir archivos.');
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;

            const asset = result.assets?.[0];
            if (!asset) return;

            const uploadFile = await fileFromPickerAsset(asset);
            setSubiendo(tipoDoc);
            setMensaje('');

            const res = await subirAdjuntoOp(digits, tipoDoc, uploadFile);
            const nombreEsperado = nombreArchivoAdjunto(tipoDoc, digits);

            if (tipoDoc === 'ficha') setFichaExtraccion(res.extraccion || null);
            else if (tipoDoc === 'op') setOpExtraccion(res.extraccion || null);
            else setLineaTroquelExtraccion(res.extraccion || null);

            setMensaje(`Guardado como ${nombreEsperado} y analizado con OCR.`);
            await refrescarBusqueda();
        } catch (e) {
            console.error(e);
            const msg = e?.response?.data?.message || e?.message || 'Error al subir';
            showAlert('Error', msg);
        } finally {
            setSubiendo(null);
        }
    };

    const abrirPdf = async (archivo) => {
        if (!archivo?.url) return;
        const url = await resolveAdjuntoUrl(archivo.url);
        if (Platform.OS === 'web') window.open(url, '_blank');
    };

    if (seccion === 'biblioteca') {
        return (
            <ScrollView style={local.scroll} contentContainerStyle={local.scrollContent}>
                <View style={local.seccionRow}>
                    {SECCIONES.map((s) => (
                        <TouchableOpacity
                            key={s.key}
                            style={[
                                local.seccionBtn,
                                {
                                    borderColor: colors.border,
                                    backgroundColor: seccion === s.key ? '#2563EB' : colors.card,
                                },
                            ]}
                            onPress={() => setSeccion(s.key)}
                        >
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: seccion === s.key ? '#FFF' : colors.text,
                                }}
                            >
                                {s.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <PlaneacionAdjuntosBiblioteca />
            </ScrollView>
        );
    }

    return (
        <ScrollView style={local.scroll} contentContainerStyle={local.scrollContent}>
            <View style={local.seccionRow}>
                {SECCIONES.map((s) => (
                    <TouchableOpacity
                        key={s.key}
                        style={[
                            local.seccionBtn,
                            {
                                borderColor: colors.border,
                                backgroundColor: seccion === s.key ? '#2563EB' : colors.card,
                            },
                        ]}
                        onPress={() => setSeccion(s.key)}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: seccion === s.key ? '#FFF' : colors.text,
                            }}
                        >
                            {s.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <Text style={[local.heading, { color: colors.text }]}>Adjuntos OP, ficha y línea de troquel</Text>
            <Text style={[local.hint, { color: colors.subText }]}>
                Ingrese el número de OP. Los PDF se renombran a F{'{n}'}.pdf, OP{'{n}'}.pdf y LT{'{n}'}.pdf
                y se analizan con OCR al subirlos.
            </Text>

            <Text style={[local.label, { color: colors.text }]}>Número de OP *</Text>
            <TextInput
                style={[local.opInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                value={opNumero}
                onChangeText={onOpChange}
                placeholder="Ej: 7679"
                keyboardType="numeric"
                maxLength={12}
            />
            {opValida && (
                <Text style={[local.hint, { color: colors.subText, marginTop: 4 }]}>
                    Archivos: F{digits}.pdf · OP{digits}.pdf · LT{digits}.pdf
                </Text>
            )}

            <View style={local.uploadRow}>
                <TouchableOpacity
                    style={[
                        local.uploadBtn,
                        { backgroundColor: '#2563EB', opacity: !opValida || subiendo ? 0.5 : 1 },
                    ]}
                    disabled={!opValida || !!subiendo}
                    onPress={() => void subirDocumento('ficha')}
                >
                    {subiendo === 'ficha' ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={local.uploadBtnText}>📄 Subir ficha técnica</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        local.uploadBtn,
                        { backgroundColor: '#059669', opacity: !opValida || subiendo ? 0.5 : 1 },
                    ]}
                    disabled={!opValida || !!subiendo}
                    onPress={() => void subirDocumento('op')}
                >
                    {subiendo === 'op' ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={local.uploadBtnText}>📋 Subir orden de producción</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        local.uploadBtn,
                        { backgroundColor: '#7C3AED', opacity: !opValida || subiendo ? 0.5 : 1 },
                    ]}
                    disabled={!opValida || !!subiendo}
                    onPress={() => void subirDocumento('linea_troquel')}
                >
                    {subiendo === 'linea_troquel' ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={local.uploadBtnText}>✂️ Subir línea de troquel</Text>
                    )}
                </TouchableOpacity>
            </View>

            {subiendo && (
                <Text style={[local.status, { color: colors.primary }]}>
                    Subiendo y ejecutando OCR… puede tardar hasta 2 minutos en OP escaneadas.
                </Text>
            )}
            {mensaje ? (
                <Text style={[local.status, { color: '#059669' }]}>{mensaje}</Text>
            ) : null}

            {opValida && busqueda && (
                <View style={[local.estadoBox, { borderColor: colors.border }]}>
                    <Text style={[local.label, { color: colors.text }]}>Archivos en servidor</Text>
                    <View style={local.estadoRow}>
                        <Text style={{ color: colors.subText, fontSize: 13 }}>
                            Ficha: {busqueda.ficha ? busqueda.ficha.nombre : '— no cargada —'}
                        </Text>
                        {busqueda.ficha && (
                            <TouchableOpacity onPress={() => void abrirPdf(busqueda.ficha)}>
                                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Ver</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={local.estadoRow}>
                        <Text style={{ color: colors.subText, fontSize: 13 }}>
                            OP: {busqueda.op ? busqueda.op.nombre : '— no cargada —'}
                        </Text>
                        {busqueda.op && (
                            <TouchableOpacity onPress={() => void abrirPdf(busqueda.op)}>
                                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Ver</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={local.estadoRow}>
                        <Text style={{ color: colors.subText, fontSize: 13 }}>
                            Línea troquel: {busqueda.lineaTroquel ? busqueda.lineaTroquel.nombre : '— no cargada —'}
                        </Text>
                        {busqueda.lineaTroquel && (
                            <TouchableOpacity onPress={() => void abrirPdf(busqueda.lineaTroquel)}>
                                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Ver</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {(fichaExtraccion || opExtraccion || lineaTroquelExtraccion) && (
                <View style={{ marginTop: 16, gap: 12 }}>
                    <Text style={[local.label, { color: colors.text }]}>Datos extraídos (última subida)</Text>
                            <BloqueCampos titulo="Ficha técnica" extraccion={fichaExtraccion} tipoDoc="ficha" colors={colors} />
                            <BloqueCampos titulo="Orden de producción" extraccion={opExtraccion} tipoDoc="op" colors={colors} />
                            <BloqueCampos titulo="Línea de troquel" extraccion={lineaTroquelExtraccion} tipoDoc="linea_troquel" colors={colors} />
                </View>
            )}
        </ScrollView>
    );
}

const local = StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    seccionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    seccionBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
    },
    heading: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    hint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
    opInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 14,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 1,
    },
    uploadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
    uploadBtn: {
        flex: 1,
        minWidth: 160,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    uploadBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    status: { marginTop: 12, fontSize: 12, fontWeight: '600' },
    estadoBox: {
        marginTop: 20,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    estadoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    card: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    cardTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
    campoRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
    campoLabel: { fontSize: 11, fontWeight: '600', marginRight: 4 },
    campoVal: { fontSize: 11, flex: 1 },
});
