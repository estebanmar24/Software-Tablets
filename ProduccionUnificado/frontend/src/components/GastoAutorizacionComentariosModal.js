import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import {
    getComentariosAutorizacionGasto,
    agregarComentarioAutorizacionGasto,
    contarComentariosAutorizacion,
    etiquetaModuloGasto,
} from '../services/gastosAutorizacionApi';

function metaComentario(c) {
    const nombre = c.usuarioNombre?.trim() || 'Usuario';
    const fecha = c.fecha || '';
    const hora = c.hora?.trim();
    return hora ? `${nombre} · ${fecha} ${hora}` : `${nombre} · ${fecha}`;
}

const ComentarioEditor = memo(function ComentarioEditor({
    solicitudKey,
    respondiendoA,
    guardando,
    onEnviar,
    onClose,
    colors,
    inputBg,
}) {
    const [texto, setTexto] = useState('');

    useEffect(() => {
        setTexto('');
    }, [solicitudKey, respondiendoA]);

    const enviar = () => {
        const trimmed = texto.trim();
        if (!trimmed || guardando) return;
        onEnviar(trimmed, () => setTexto(''));
    };

    return (
        <>
            {respondiendoA ? (
                <Text style={[styles.respondiendoLabel, { color: colors.primary }]}>
                    Respondiendo a un comentario
                </Text>
            ) : null}

            <TextInput
                style={[
                    styles.input,
                    { backgroundColor: inputBg, borderColor: colors.border, color: colors.text },
                ]}
                placeholder={respondiendoA ? 'Escriba su respuesta...' : 'Nuevo comentario u observación...'}
                placeholderTextColor={colors.subText}
                value={texto}
                onChangeText={setTexto}
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
                            opacity: guardando || !texto.trim() ? 0.55 : 1,
                        },
                    ]}
                    onPress={enviar}
                    disabled={guardando || !texto.trim()}
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
        </>
    );
});

function ComentarioItem({
    comentario,
    nivel,
    respondiendoA,
    onResponder,
    colors,
    inputBg,
}) {
    return (
        <View style={{ marginLeft: nivel * 14, marginBottom: 10 }}>
            <View style={[styles.comentarioCard, { backgroundColor: inputBg, borderColor: colors.border }]}>
                <Text style={[styles.comentarioMeta, { color: colors.subText }]}>{metaComentario(comentario)}</Text>
                <Text style={[styles.comentarioTexto, { color: colors.text }]}>{comentario.texto}</Text>
                <TouchableOpacity
                    onPress={() => onResponder(respondiendoA === comentario.id ? null : comentario.id)}
                    style={styles.responderBtn}
                >
                    <Text style={[styles.responderBtnText, { color: colors.primary }]}>
                        {respondiendoA === comentario.id ? 'Cancelar respuesta' : 'Responder'}
                    </Text>
                </TouchableOpacity>
            </View>
            {(comentario.respuestas ?? []).map((r) => (
                <ComentarioItem
                    key={r.id}
                    comentario={r}
                    nivel={nivel + 1}
                    respondiendoA={respondiendoA}
                    onResponder={onResponder}
                    colors={colors}
                    inputBg={inputBg}
                />
            ))}
        </View>
    );
}

export default function GastoAutorizacionComentariosModal({
    visible,
    solicitud,
    onClose,
    onComentariosActualizados,
    colors,
    isDarkMode,
    cardBg,
    inputBg,
}) {
    const solicitudId = solicitud?.id ? String(solicitud.id) : null;
    const solicitudKey = visible && solicitudId ? solicitudId : null;

    const [comentarios, setComentarios] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [respondiendoA, setRespondiendoA] = useState(null);
    const [errorCarga, setErrorCarga] = useState('');

    const onComentariosActualizadosRef = useRef(onComentariosActualizados);
    onComentariosActualizadosRef.current = onComentariosActualizados;

    const solicitudActivaRef = useRef(null);
    const cargandoRef = useRef(false);

    const cargar = useCallback(async (id, { forzar = false } = {}) => {
        const targetId = String(id || '');
        if (!targetId || (cargandoRef.current && !forzar)) return;

        cargandoRef.current = true;
        setCargando(true);
        setErrorCarga('');
        try {
            const list = await getComentariosAutorizacionGasto(targetId);
            if (solicitudActivaRef.current !== targetId) return;
            setComentarios(list);
            onComentariosActualizadosRef.current?.(targetId, contarComentariosAutorizacion(list));
        } catch (e) {
            if (solicitudActivaRef.current !== targetId) return;
            const msg = e?.response?.data?.message || 'No se pudieron cargar los comentarios.';
            setErrorCarga(msg);
            Alert.alert('Error', msg);
        } finally {
            cargandoRef.current = false;
            if (solicitudActivaRef.current === targetId) {
                setCargando(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!visible || !solicitudId) {
            solicitudActivaRef.current = null;
            setRespondiendoA(null);
            setComentarios([]);
            setErrorCarga('');
            setCargando(false);
            cargandoRef.current = false;
            return;
        }

        solicitudActivaRef.current = solicitudId;
        setRespondiendoA(null);
        setComentarios([]);
        void cargar(solicitudId);
    }, [visible, solicitudId, cargar]);

    const enviar = async (texto, limpiarTexto) => {
        if (!solicitudId) return;

        setGuardando(true);
        try {
            await agregarComentarioAutorizacionGasto(solicitudId, {
                texto,
                parentId: respondiendoA ?? undefined,
            });
            limpiarTexto?.();
            setRespondiendoA(null);
            await cargar(solicitudId, { forzar: true });
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo guardar el comentario.');
        } finally {
            setGuardando(false);
        }
    };

    const total = contarComentariosAutorizacion(comentarios);
    const tituloSolicitud = solicitud
        ? `${etiquetaModuloGasto(solicitud.modulo)} · ${solicitud.proveedorNombre || 'Sin proveedor'}`
        : '';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.box, { backgroundColor: cardBg, borderColor: colors.border }]}>
                    <TouchableOpacity style={[styles.cerrarBtn, { borderColor: colors.border }]} onPress={onClose}>
                        <Text style={[styles.cerrarBtnText, { color: colors.subText }]}>✕</Text>
                    </TouchableOpacity>

                    <Text style={[styles.titulo, { color: colors.text }]}>Comentarios</Text>
                    <Text style={[styles.subtitulo, { color: colors.subText }]}>
                        {tituloSolicitud} · {total} comentario{total === 1 ? '' : 's'}
                    </Text>

                    <ScrollView style={styles.lista} contentContainerStyle={styles.listaContent}>
                        {cargando && comentarios.length === 0 && !errorCarga ? (
                            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
                        ) : errorCarga && comentarios.length === 0 ? (
                            <Text style={[styles.vacio, { color: '#DC2626' }]}>{errorCarga}</Text>
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
                                    inputBg={inputBg}
                                />
                            ))
                        )}
                    </ScrollView>

                    <ComentarioEditor
                        key={solicitudKey ?? 'cerrado'}
                        solicitudKey={solicitudKey ?? 'cerrado'}
                        respondiendoA={respondiendoA}
                        guardando={guardando}
                        onEnviar={(texto, limpiarTexto) => void enviar(texto, limpiarTexto)}
                        onClose={onClose}
                        colors={colors}
                        inputBg={inputBg}
                    />
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
    cerrarBtnText: { fontSize: 14, fontWeight: '700' },
    titulo: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    subtitulo: { fontSize: 13, marginBottom: 12 },
    lista: { maxHeight: 340, marginBottom: 12 },
    listaContent: { paddingBottom: 4 },
    vacio: { textAlign: 'center', fontSize: 14, paddingVertical: 24 },
    comentarioCard: { borderWidth: 1, borderRadius: 10, padding: 12 },
    comentarioMeta: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    comentarioTexto: { fontSize: 14, lineHeight: 20 },
    responderBtn: { marginTop: 8, alignSelf: 'flex-start' },
    responderBtnText: { fontSize: 12, fontWeight: '700' },
    respondiendoLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    input: {
        minHeight: 84,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 12,
    },
    acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    btnSecundario: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
    btnSecundarioText: { fontSize: 14, fontWeight: '600' },
    btnPrimario: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, minWidth: 150, alignItems: 'center' },
    btnPrimarioText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
