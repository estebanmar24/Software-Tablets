import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import {
    type Requisicion,
    type RequisicionComentario,
    contarComentariosRequisicion,
    formatFechaDisplay,
} from '../data/almacenMockData';
import {
    agregarComentarioRequisicion,
    getComentariosRequisicion,
    extraerMensajeErrorApi,
} from '../services/almacenApi';
import { almacenAlert } from '../utils/almacenAlert';

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
};

type Props = {
    visible: boolean;
    requisicion: Requisicion | null;
    onClose: () => void;
    onComentariosActualizados: (requisicionId: string, comentarios: RequisicionComentario[]) => void;
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
    inputBg: string;
};

function metaComentario(c: RequisicionComentario): string {
    const nombre = c.usuarioNombre?.trim() || 'Usuario';
    const fecha = formatFechaDisplay(c.fecha) || c.fecha;
    const hora = c.hora?.trim();
    return hora ? `${nombre} · ${fecha} ${hora}` : `${nombre} · ${fecha}`;
}

function ComentarioItem({
    comentario,
    nivel,
    respondiendoA,
    onResponder,
    colors,
    isDarkMode,
    inputBg,
}: {
    comentario: RequisicionComentario;
    nivel: number;
    respondiendoA: string | null;
    onResponder: (id: string | null) => void;
    colors: ThemeColors;
    isDarkMode: boolean;
    inputBg: string;
}) {
    const esLegacy = comentario.esLegacy || comentario.id === 'legacy';

    return (
        <View style={{ marginLeft: nivel * 14, marginBottom: 10 }}>
            <View
                style={[
                    styles.comentarioCard,
                    {
                        backgroundColor: inputBg,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Text style={[styles.comentarioMeta, { color: colors.subText }]}>
                    {metaComentario(comentario)}
                    {esLegacy ? ' · observación anterior' : ''}
                </Text>
                <Text style={[styles.comentarioTexto, { color: colors.text }]}>{comentario.texto}</Text>
                {!esLegacy ? (
                    <TouchableOpacity
                        onPress={() => onResponder(respondiendoA === comentario.id ? null : comentario.id)}
                        style={styles.responderBtn}
                    >
                        <Text style={[styles.responderBtnText, { color: colors.primary }]}>
                            {respondiendoA === comentario.id ? 'Cancelar respuesta' : 'Responder'}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            {(comentario.respuestas ?? []).map((r) => (
                <ComentarioItem
                    key={r.id}
                    comentario={r}
                    nivel={nivel + 1}
                    respondiendoA={respondiendoA}
                    onResponder={onResponder}
                    colors={colors}
                    isDarkMode={isDarkMode}
                    inputBg={inputBg}
                />
            ))}
        </View>
    );
}

export default function AlmacenRequisicionComentariosModal({
    visible,
    requisicion,
    onClose,
    onComentariosActualizados,
    colors,
    isDarkMode,
    cardBg,
    inputBg,
}: Props) {
    const [comentarios, setComentarios] = useState<RequisicionComentario[]>([]);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [textoNuevo, setTextoNuevo] = useState('');
    const [respondiendoA, setRespondiendoA] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        if (!requisicion?.id) return;
        setCargando(true);
        try {
            const list = await getComentariosRequisicion(requisicion.id);
            setComentarios(list);
            onComentariosActualizados(requisicion.id, list);
        } catch (error) {
            almacenAlert('Error', extraerMensajeErrorApi(error, 'No se pudieron cargar los comentarios.'));
        } finally {
            setCargando(false);
        }
    }, [onComentariosActualizados, requisicion?.id]);

    useEffect(() => {
        if (!visible || !requisicion) return;
        setTextoNuevo('');
        setRespondiendoA(null);
        setComentarios(requisicion.comentarios ?? []);
        void cargar();
    }, [visible, requisicion?.id, cargar]);

    const enviar = async () => {
        if (!requisicion?.id) return;
        const texto = textoNuevo.trim();
        if (!texto) return;

        setGuardando(true);
        try {
            await agregarComentarioRequisicion(requisicion.id, {
                texto,
                parentId: respondiendoA ?? undefined,
            });
            setTextoNuevo('');
            setRespondiendoA(null);
            await cargar();
        } catch (error) {
            almacenAlert('Error', extraerMensajeErrorApi(error, 'No se pudo guardar el comentario.'));
        } finally {
            setGuardando(false);
        }
    };

    const total = contarComentariosRequisicion(comentarios);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View
                    style={[
                        styles.box,
                        {
                            backgroundColor: cardBg,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.cerrarBtn, { borderColor: colors.border }]}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Cerrar"
                    >
                        <Text style={[styles.cerrarBtnText, { color: colors.subText }]}>✕</Text>
                    </TouchableOpacity>

                    <Text style={[styles.titulo, { color: colors.text }]}>Comentarios</Text>
                    <Text style={[styles.subtitulo, { color: colors.subText }]}>
                        {requisicion?.codigo ?? ''} · {total} comentario{total === 1 ? '' : 's'}
                    </Text>

                    <ScrollView style={styles.lista} contentContainerStyle={styles.listaContent}>
                        {cargando && comentarios.length === 0 ? (
                            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
                        ) : comentarios.length === 0 ? (
                            <Text style={[styles.vacio, { color: colors.subText }]}>
                                Aún no hay comentarios. Escriba el primero abajo.
                            </Text>
                        ) : (
                            comentarios.map((c) => (
                                <ComentarioItem
                                    key={c.id}
                                    comentario={c}
                                    nivel={0}
                                    respondiendoA={respondiendoA}
                                    onResponder={setRespondiendoA}
                                    colors={colors}
                                    isDarkMode={isDarkMode}
                                    inputBg={inputBg}
                                />
                            ))
                        )}
                    </ScrollView>

                    {respondiendoA ? (
                        <Text style={[styles.respondiendoLabel, { color: colors.primary }]}>
                            Respondiendo a un comentario
                        </Text>
                    ) : null}

                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: inputBg,
                                borderColor: colors.border,
                                color: colors.text,
                            },
                        ]}
                        placeholder={
                            respondiendoA ? 'Escriba su respuesta...' : 'Nuevo comentario u observación...'
                        }
                        placeholderTextColor={colors.subText}
                        value={textoNuevo}
                        onChangeText={setTextoNuevo}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!guardando}
                    />

                    <View style={styles.acciones}>
                        <TouchableOpacity
                            style={[styles.btnSecundario, { borderColor: colors.border }]}
                            onPress={onClose}
                            disabled={guardando}
                        >
                            <Text style={[styles.btnSecundarioText, { color: colors.text }]}>Cerrar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.btnPrimario,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: guardando || !textoNuevo.trim() ? 0.55 : 1,
                                },
                            ]}
                            onPress={() => void enviar()}
                            disabled={guardando || !textoNuevo.trim()}
                        >
                            {guardando ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.btnPrimarioText}>
                                    {respondiendoA ? 'Publicar respuesta' : 'Publicar comentario'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    box: {
        width: '100%',
        maxWidth: 560,
        maxHeight: '88%',
        borderRadius: 14,
        borderWidth: 1,
        padding: 18,
        paddingTop: 42,
    },
    cerrarBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cerrarBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    titulo: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitulo: {
        fontSize: 13,
        marginBottom: 12,
    },
    lista: {
        maxHeight: 340,
        marginBottom: 12,
    },
    listaContent: {
        paddingBottom: 4,
    },
    vacio: {
        textAlign: 'center',
        fontSize: 14,
        paddingVertical: 24,
    },
    comentarioCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
    },
    comentarioMeta: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    comentarioTexto: {
        fontSize: 14,
        lineHeight: 20,
    },
    responderBtn: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    responderBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    respondiendoLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
    },
    input: {
        minHeight: 84,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 12,
    },
    acciones: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    btnSecundario: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    btnSecundarioText: {
        fontSize: 14,
        fontWeight: '600',
    },
    btnPrimario: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minWidth: 150,
        alignItems: 'center',
    },
    btnPrimarioText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
