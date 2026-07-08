import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
    Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import {
    buscarAdjuntosOp,
    obtenerDatosAdjuntos,
    resolveAdjuntoUrl,
    type AdjuntoArchivo,
    type AdjuntosOpResult,
    type AdjuntoExtraccionDoc,
} from '../services/adjuntosApi';

interface OpAdjuntosPanelProps {
    opNumero: string;
    actividadCodigo?: string | null;
}

function docToArchivo(
    doc: AdjuntoExtraccionDoc | null | undefined,
    fallbackUrl: string
): AdjuntoArchivo | null {
    if (!doc?.archivoNombre) return null;
    const url = doc.url || fallbackUrl;
    if (!url) return null;
    return { url, nombre: doc.archivoNombre };
}

export function OpAdjuntosPanel({ opNumero }: OpAdjuntosPanelProps) {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AdjuntosOpResult | null>(null);
    const [viewer, setViewer] = useState<{ titulo: string; url: string } | null>(null);

    const digits = (opNumero || '').replace(/\D/g, '');
    const visible = digits.length >= 4;

    const fetchAdjuntos = useCallback(async () => {
        if (!visible) {
            setResult(null);
            return;
        }

        setLoading(true);
        try {
            const datos = await obtenerDatosAdjuntos(digits, false);
            let ficha = docToArchivo(
                datos?.ficha,
                datos?.ficha?.archivoNombre ? `/adjuntos/fichas/F${digits}.pdf` : ''
            );
            let op = docToArchivo(
                datos?.op,
                datos?.op?.archivoNombre ? `/adjuntos/op/OP${digits}.pdf` : ''
            );
            let lineaTroquel = docToArchivo(
                datos?.lineaTroquel,
                datos?.lineaTroquel?.archivoNombre ? `/adjuntos/linea_troquel/LT${digits}.pdf` : ''
            );

            if (!ficha || !op || !lineaTroquel) {
                try {
                    const buscar = await buscarAdjuntosOp(digits);
                    ficha = ficha || buscar.ficha;
                    op = op || buscar.op;
                    lineaTroquel = lineaTroquel || buscar.lineaTroquel;
                } catch (e) {
                    console.warn('buscar adjuntos fallback:', e);
                }
            }

            setResult({ numero: digits, ficha, op, lineaTroquel });
        } catch (e) {
            console.warn('No se pudieron cargar adjuntos OP:', e);
            try {
                const buscar = await buscarAdjuntosOp(digits);
                setResult(buscar);
            } catch {
                setResult({ numero: digits, ficha: null, op: null, lineaTroquel: null });
            }
        } finally {
            setLoading(false);
        }
    }, [digits, visible]);

    useEffect(() => {
        if (!visible) {
            setResult(null);
            return;
        }
        const t = setTimeout(() => {
            void fetchAdjuntos();
        }, 400);
        return () => clearTimeout(t);
    }, [fetchAdjuntos, visible]);

    const openAdjunto = async (tipo: 'Ficha' | 'OP' | 'Línea troquel', archivo: AdjuntoArchivo) => {
        const fullUrl = await resolveAdjuntoUrl(archivo.url);
        if (!fullUrl) return;

        if (Platform.OS === 'web') {
            setViewer({ titulo: `${tipo}: ${archivo.nombre}`, url: fullUrl });
            return;
        }

        try {
            await Linking.openURL(fullUrl);
        } catch (e) {
            console.warn('No se pudo abrir adjunto:', e);
        }
    };

    if (!visible) return null;

    const hasFicha = !!result?.ficha;
    const hasOp = !!result?.op;
    const hasLineaTroquel = !!result?.lineaTroquel;
    const searched = result !== null && !loading;
    const tieneAdjuntos = hasFicha || hasOp || hasLineaTroquel;

    if (loading) {
        return (
            <Text style={[styles.soloTexto, { color: colors.subText }]}>
                Buscando ficha y OP…
            </Text>
        );
    }

    if (searched && !tieneAdjuntos) {
        return (
            <Text style={[styles.soloTexto, { color: colors.subText }]}>
                No hay archivos F{digits}, OP{digits} ni LT{digits} en Adjuntos.
            </Text>
        );
    }

    if (!tieneAdjuntos) return null;

    return (
        <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
            <Text style={[styles.title, { color: colors.subText }]}>Documentos OP {digits}</Text>

            <View style={styles.btnRow}>
                {hasFicha && (
                    <TouchableOpacity
                        style={[styles.docBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                        onPress={() => result?.ficha && void openAdjunto('Ficha', result.ficha)}
                    >
                        <MaterialCommunityIcons
                            name="file-document-outline"
                            size={18}
                            color={colors.primary}
                        />
                        <Text style={[styles.docBtnText, { color: colors.text }]}>Ver Ficha</Text>
                    </TouchableOpacity>
                )}

                {hasOp && (
                    <TouchableOpacity
                        style={[styles.docBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                        onPress={() => result?.op && void openAdjunto('OP', result.op)}
                    >
                        <MaterialCommunityIcons
                            name="clipboard-text-outline"
                            size={18}
                            color="#059669"
                        />
                        <Text style={[styles.docBtnText, { color: colors.text }]}>Ver OP</Text>
                    </TouchableOpacity>
                )}

                {hasLineaTroquel && (
                    <TouchableOpacity
                        style={[styles.docBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                        onPress={() => result?.lineaTroquel && void openAdjunto('Línea troquel', result.lineaTroquel)}
                    >
                        <MaterialCommunityIcons
                            name="vector-line"
                            size={18}
                            color="#7C3AED"
                        />
                        <Text style={[styles.docBtnText, { color: colors.text }]}>Ver LT</Text>
                    </TouchableOpacity>
                )}
            </View>

            {Platform.OS === 'web' && viewer && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setViewer(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                                    {viewer.titulo}
                                </Text>
                                <TouchableOpacity onPress={() => setViewer(null)} style={styles.closeBtn}>
                                    <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.viewerBody}>
                                {/* @ts-expect-error iframe solo en web */}
                                <iframe
                                    src={viewer.url}
                                    title={viewer.titulo}
                                    style={{ width: '100%', height: '100%', border: 'none', minHeight: 400 }}
                                />
                            </View>
                        </View>
                    </View>
                </Modal>
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
    title: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    soloTexto: {
        fontSize: 11,
        marginTop: 8,
        lineHeight: 16,
    },
    btnRow: {
        flexDirection: 'row',
        gap: 8,
    },
    docBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    docBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalBox: {
        width: '96%',
        maxWidth: 1100,
        height: '90%',
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    modalTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
    },
    closeBtn: {
        padding: 4,
    },
    viewerBody: {
        flex: 1,
        minHeight: 400,
    },
});
