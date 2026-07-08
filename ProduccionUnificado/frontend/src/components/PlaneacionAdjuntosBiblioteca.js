/**
 * Biblioteca de adjuntos OP / Ficha: consultar, ver texto OCR, reemplazar y re-extraer.
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
    listarBibliotecaAdjuntos,
    obtenerDatosAdjuntos,
    reextraerAdjunto,
    subirAdjuntoOp,
    eliminarAdjuntoOp,
    resolveAdjuntoUrl,
    buscarAdjuntosOp,
} from '../services/adjuntosApi';
import AdjuntosResumenPresentacion from './AdjuntosResumenPresentacion';
import { nombreArchivoAdjunto } from '../utils/adjuntoNombres';

const showAlert = (title, message) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
};

const confirmar = (mensaje) => {
    if (Platform.OS === 'web') return window.confirm(mensaje);
    return Promise.resolve(true);
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

function Badge({ label, ok, colors }) {
    return (
        <View
            style={[
                bib.badge,
                { backgroundColor: ok ? '#DCFCE7' : '#F3F4F6', borderColor: ok ? '#86EFAC' : colors.border },
            ]}
        >
            <Text style={{ fontSize: 10, fontWeight: '700', color: ok ? '#166534' : '#9CA3AF' }}>{label}</Text>
        </View>
    );
}

export default function PlaneacionAdjuntosBiblioteca() {
    const { colors } = useTheme();
    const [filtro, setFiltro] = useState('');
    const [lista, setLista] = useState([]);
    const [loadingLista, setLoadingLista] = useState(true);
    const [seleccionado, setSeleccionado] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [reextrayendo, setReextrayendo] = useState(null);
    const [subiendo, setSubiendo] = useState(null);
    const [eliminando, setEliminando] = useState(null);
    const [textoExpandido, setTextoExpandido] = useState({ ficha: false, op: false, linea_troquel: false });

    const cargarLista = useCallback(async () => {
        setLoadingLista(true);
        try {
            const data = await listarBibliotecaAdjuntos(filtro);
            setLista(data.items || []);
        } catch (e) {
            console.error(e);
            setLista([]);
        } finally {
            setLoadingLista(false);
        }
    }, [filtro]);

    useEffect(() => {
        const t = setTimeout(() => void cargarLista(), 350);
        return () => clearTimeout(t);
    }, [cargarLista]);

    const cargarDetalle = useCallback(async (numero, forzar = false) => {
        setLoadingDetalle(true);
        try {
            const data = await obtenerDatosAdjuntos(numero, forzar);
            setDetalle(data);
        } catch (e) {
            console.error(e);
            const msg = e?.response?.data?.message || e?.response?.data?.detail || e?.message;
            showAlert('Error al abrir', msg || 'No se pudo cargar el detalle. Cierre el PDF si está abierto en otra ventana.');
            setDetalle({
                numero,
                ficha: null,
                op: {
                    tipo: 'OP',
                    archivoNombre: `OP${numero}.pdf`,
                    metodo: 'Error',
                    textoCompleto: '',
                    campos: {},
                    error: msg,
                },
            });
        } finally {
            setLoadingDetalle(false);
        }
    }, []);

    const seleccionarOp = (numero) => {
        setSeleccionado(numero);
        setDetalle(null);
        setTextoExpandido({ ficha: false, op: false, linea_troquel: false });
        void cargarDetalle(numero, false);
    };

    const ejecutarReocr = async (tipo) => {
        if (!seleccionado) return;
        setReextrayendo(tipo);
        try {
            await reextraerAdjunto(seleccionado, tipo);
            await cargarDetalle(seleccionado, false);
            await cargarLista();
            showAlert('OCR', 'Extracción completada.');
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Error en OCR';
            showAlert('Error OCR', msg);
        } finally {
            setReextrayendo(null);
        }
    };

    const reemplazarArchivo = async (tipoDoc) => {
        if (!seleccionado) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            const asset = result.assets?.[0];
            if (!asset) return;

            setSubiendo(tipoDoc);
            const uploadFile = await fileFromPickerAsset(asset);
            await subirAdjuntoOp(seleccionado, tipoDoc, uploadFile);
            await cargarDetalle(seleccionado, false);
            await cargarLista();
            showAlert('Actualizado', `Archivo ${nombreArchivoAdjunto(tipoDoc, seleccionado)} reemplazado y analizado.`);
        } catch (e) {
            showAlert('Error', e?.response?.data?.message || 'No se pudo actualizar el archivo.');
        } finally {
            setSubiendo(null);
        }
    };

    const eliminarOp = async (numero) => {
        const ok = await confirmar(
            `¿Eliminar OP ${numero} de la biblioteca?\n\nSe borrarán los PDF (F${numero}.pdf, OP${numero}.pdf y LT${numero}.pdf) y los datos de OCR. Esta acción no se puede deshacer.`
        );
        if (!ok) return;

        setEliminando(numero);
        try {
            const res = await eliminarAdjuntoOp(numero);
            if (seleccionado === numero) {
                setSeleccionado(null);
                setDetalle(null);
            }
            await cargarLista();
            const errList = res.errores?.length ? `\n${res.errores.join('\n')}` : '';
            if (res.archivosEliminados === 0 && res.errores?.length) {
                showAlert(
                    'No se pudo borrar',
                    (res.message || 'Cierre el PDF si está abierto en otra ventana.') + errList
                );
                return;
            }
            showAlert('Eliminado', (res.message || `OP ${numero} eliminada.`) + errList);
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'No se pudo eliminar';
            const det = e?.response?.data?.errores?.join?.('\n');
            showAlert('Error', det ? `${msg}\n${det}` : msg);
        } finally {
            setEliminando(null);
        }
    };

    const abrirPdf = async (numero, tipoDoc) => {
        const data = await buscarAdjuntosOp(numero);
        const archivo =
            tipoDoc === 'ficha'
                ? data.ficha
                : tipoDoc === 'linea_troquel'
                  ? data.lineaTroquel
                  : data.op;
        if (!archivo?.url) return;
        const url = await resolveAdjuntoUrl(archivo.url);
        if (Platform.OS === 'web') window.open(url, '_blank');
    };

    const itemLista = lista.find((x) => x.numero === seleccionado);

    return (
        <View style={bib.wrap}>
            <Text style={[bib.heading, { color: colors.text }]}>Biblioteca de adjuntos</Text>
            <Text style={[bib.hint, { color: colors.subText }]}>
                Consulte OPs subidas, revise el texto OCR y vuelva a extraer si algún dato falló.
            </Text>

            <TextInput
                style={[bib.filtroInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                placeholder="Buscar por número de OP…"
                value={filtro}
                onChangeText={setFiltro}
                keyboardType="numeric"
            />

            <View style={bib.split}>
                <View style={[bib.listaPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={[bib.panelTitle, { color: colors.subText }]}>
                        OP registradas ({lista.length})
                    </Text>
                    {loadingLista ? (
                        <ActivityIndicator style={{ marginTop: 20 }} />
                    ) : lista.length === 0 ? (
                        <Text style={{ fontSize: 12, color: colors.subText, marginTop: 12 }}>
                            No hay adjuntos. Use la pestaña Subir para cargar documentos.
                        </Text>
                    ) : (
                        <ScrollView style={{ maxHeight: 420 }}>
                            {lista.map((item) => (
                                <View
                                    key={item.numero}
                                    style={[
                                        bib.listaItem,
                                        {
                                            borderColor: colors.border,
                                            backgroundColor:
                                                seleccionado === item.numero ? '#EFF6FF' : 'transparent',
                                        },
                                    ]}
                                >
                                    <View style={bib.listaItemRow}>
                                        <TouchableOpacity
                                            style={{ flex: 1 }}
                                            onPress={() => seleccionarOp(item.numero)}
                                        >
                                            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }}>
                                                OP {item.numero}
                                            </Text>
                                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                                                <Badge label="Ficha" ok={item.tieneFicha} colors={colors} />
                                                <Badge label="OP" ok={item.tieneOp} colors={colors} />
                                                <Badge label="LT" ok={item.tieneLineaTroquel} colors={colors} />
                                            </View>
                                            {(item.ficha?.error || item.op?.error) && (
                                                <Text style={{ fontSize: 10, color: '#DC2626', marginTop: 4 }}>
                                                    ⚠ Revisar extracción
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                bib.btnEliminar,
                                                { opacity: eliminando === item.numero ? 0.5 : 1 },
                                            ]}
                                            disabled={!!eliminando}
                                            onPress={() => void eliminarOp(item.numero)}
                                        >
                                            {eliminando === item.numero ? (
                                                <ActivityIndicator size="small" color="#DC2626" />
                                            ) : (
                                                <Text style={bib.btnEliminarText}>🗑</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>

                <View style={[bib.detallePanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    {!seleccionado ? (
                        <Text style={{ fontSize: 13, color: colors.subText, marginTop: 24, textAlign: 'center' }}>
                            Seleccione una OP de la lista
                        </Text>
                    ) : loadingDetalle ? (
                        <ActivityIndicator style={{ marginTop: 40 }} />
                    ) : (
                        <ScrollView>
                            <Text style={[bib.panelTitle, { color: colors.text, fontSize: 16 }]}>
                                OP {seleccionado}
                            </Text>

                            <View style={bib.accionesRow}>
                                <TouchableOpacity
                                    style={[bib.btnSec, { opacity: reextrayendo ? 0.6 : 1 }]}
                                    disabled={!!reextrayendo || !!subiendo || !!eliminando}
                                    onPress={() => void ejecutarReocr('ambos')}
                                >
                                    <Text style={bib.btnSecText}>
                                        {reextrayendo === 'ambos' ? '…' : '🔄 Re-OCR todos'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[bib.btnEliminarDetalle, { opacity: eliminando ? 0.6 : 1 }]}
                                    disabled={!!eliminando || !!reextrayendo || !!subiendo}
                                    onPress={() => void eliminarOp(seleccionado)}
                                >
                                    <Text style={bib.btnEliminarDetalleText}>
                                        {eliminando === seleccionado ? 'Eliminando…' : '🗑 Eliminar OP'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {renderDocDetalle(
                                'Ficha técnica',
                                'ficha',
                                itemLista?.tieneFicha,
                                detalle?.ficha,
                                colors,
                                textoExpandido.ficha,
                                () => setTextoExpandido((p) => ({ ...p, ficha: !p.ficha })),
                                () => void abrirPdf(seleccionado, 'ficha'),
                                () => void reemplazarArchivo('ficha'),
                                () => void ejecutarReocr('ficha'),
                                reextrayendo === 'ficha',
                                subiendo === 'ficha',
                                !!reextrayendo || !!subiendo
                            )}

                            {renderDocDetalle(
                                'Orden de producción',
                                'op',
                                itemLista?.tieneOp,
                                detalle?.op,
                                colors,
                                textoExpandido.op,
                                () => setTextoExpandido((p) => ({ ...p, op: !p.op })),
                                () => void abrirPdf(seleccionado, 'op'),
                                () => void reemplazarArchivo('op'),
                                () => void ejecutarReocr('op'),
                                reextrayendo === 'op',
                                subiendo === 'op',
                                !!reextrayendo || !!subiendo
                            )}

                            {renderDocDetalle(
                                'Línea de troquel',
                                'linea_troquel',
                                itemLista?.tieneLineaTroquel,
                                detalle?.lineaTroquel,
                                colors,
                                textoExpandido.linea_troquel,
                                () => setTextoExpandido((p) => ({ ...p, linea_troquel: !p.linea_troquel })),
                                () => void abrirPdf(seleccionado, 'linea_troquel'),
                                () => void reemplazarArchivo('linea_troquel'),
                                () => void ejecutarReocr('linea_troquel'),
                                reextrayendo === 'linea_troquel',
                                subiendo === 'linea_troquel',
                                !!reextrayendo || !!subiendo
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </View>
    );
}

function renderDocDetalle(
    titulo,
    tipoDoc,
    existe,
    doc,
    colors,
    textoAbierto,
    toggleTexto,
    verPdf,
    reemplazar,
    reocr,
    reocrLoading,
    subirLoading,
    disabled
) {
    return (
        <View style={[bib.docBlock, { borderColor: colors.border }]}>
            <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text, marginBottom: 8 }}>
                {titulo}
            </Text>
            {!existe ? (
                <Text style={{ fontSize: 12, color: colors.subText }}>Archivo no cargado.</Text>
            ) : (
                <>
                    <Text style={{ fontSize: 11, color: colors.subText, marginBottom: 6 }}>
                        {doc?.archivoNombre || '—'} · {doc?.metodo || '—'}
                        {doc?.fechaExtraccion
                            ? ` · ${new Date(doc.fechaExtraccion).toLocaleString('es-CO')}`
                            : ''}
                        {doc?.error ? ` · ⚠ ${doc.error}` : ''}
                    </Text>

                    <AdjuntosResumenPresentacion campos={doc?.campos} tipoDoc={tipoDoc} colors={colors} />

                    <View style={bib.accionesRow}>
                        <TouchableOpacity style={bib.btnMini} onPress={verPdf}>
                            <Text style={bib.btnMiniText}>Ver PDF</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[bib.btnMini, { opacity: disabled ? 0.5 : 1 }]}
                            disabled={disabled}
                            onPress={reemplazar}
                        >
                            <Text style={bib.btnMiniText}>
                                {subirLoading ? '…' : 'Reemplazar'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[bib.btnMini, bib.btnOcr, { opacity: disabled ? 0.5 : 1 }]}
                            disabled={disabled}
                            onPress={reocr}
                        >
                            <Text style={[bib.btnMiniText, { color: '#FFF' }]}>
                                {reocrLoading ? 'OCR…' : 'Re-OCR'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {doc?.textoCompleto ? (
                        <>
                            <TouchableOpacity onPress={toggleTexto} style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                                    {textoAbierto ? '▲ Ocultar texto' : '▼ Ver texto recopilado'} (
                                    {doc.textoCompleto.length} caracteres)
                                </Text>
                            </TouchableOpacity>
                            {textoAbierto && (
                                <TextInput
                                    style={[
                                        bib.textoBox,
                                        {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background || '#F9FAFB',
                                        },
                                    ]}
                                    value={doc.textoCompleto}
                                    multiline
                                    editable={false}
                                    scrollEnabled
                                />
                            )}
                        </>
                    ) : (
                        <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>
                            Sin texto extraído. Use Re-OCR.
                        </Text>
                    )}
                </>
            )}
        </View>
    );
}

const bib = StyleSheet.create({
    wrap: { flex: 1 },
    heading: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    hint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
    filtroInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        marginBottom: 12,
    },
    split: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    listaPanel: {
        flex: 1,
        minWidth: 220,
        maxWidth: 320,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
    },
    detallePanel: {
        flex: 2,
        minWidth: 280,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        minHeight: 400,
    },
    panelTitle: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    listaItem: {
        padding: 8,
        borderRadius: 6,
        borderWidth: 1,
        marginBottom: 8,
    },
    listaItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
    },
    btnEliminar: {
        padding: 6,
        borderRadius: 6,
        minWidth: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnEliminarText: { fontSize: 16 },
    btnEliminarDetalle: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnEliminarDetalleText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
    },
    docBlock: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    accionesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
        marginBottom: 4,
    },
    btnSec: {
        backgroundColor: '#7C3AED',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnSecText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    btnMini: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#FFF',
    },
    btnMiniText: { fontSize: 11, fontWeight: '600', color: '#374151' },
    btnOcr: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    textoBox: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontSize: 10,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
        minHeight: 160,
        maxHeight: 280,
        textAlignVertical: 'top',
    },
});
