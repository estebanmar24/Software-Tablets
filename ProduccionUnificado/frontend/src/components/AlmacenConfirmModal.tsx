import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
    primary: string;
};

type AlmacenConfirmModalProps = {
    visible: boolean;
    titulo: string;
    mensaje: string;
    textoConfirmar?: string;
    textoCancelar?: string;
    onConfirmar: () => void;
    onCancelar: () => void;
    /** Cierra sin ejecutar ninguna acción (botón ✕). */
    onCerrar?: () => void;
    colors: ThemeColors;
    isDarkMode: boolean;
    cardBg: string;
    icono?: string;
};

export default function AlmacenConfirmModal({
    visible,
    titulo,
    mensaje,
    textoConfirmar = 'Aceptar',
    textoCancelar = 'Cancelar',
    onConfirmar,
    onCancelar,
    onCerrar,
    colors,
    isDarkMode,
    cardBg,
    icono = '?',
}: AlmacenConfirmModalProps) {
    const cerrarSinAccion = onCerrar ?? onCancelar;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrarSinAccion}>
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
                    {onCerrar ? (
                        <TouchableOpacity
                            style={[styles.cerrarBtn, { borderColor: colors.border }]}
                            onPress={onCerrar}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel="Cerrar"
                        >
                            <Text style={[styles.cerrarBtnText, { color: colors.subText }]}>✕</Text>
                        </TouchableOpacity>
                    ) : null}
                    <View
                        style={[
                            styles.iconWrap,
                            {
                                backgroundColor: isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)',
                            },
                        ]}
                    >
                        <Text style={[styles.iconText, { color: colors.primary }]}>{icono}</Text>
                    </View>
                    <Text style={[styles.titulo, { color: colors.text }]}>{titulo}</Text>
                    <Text style={[styles.mensaje, { color: colors.subText }]}>{mensaje}</Text>
                    <View style={styles.acciones}>
                        <TouchableOpacity
                            style={[styles.btnSecundario, { borderColor: colors.border }]}
                            onPress={onCancelar}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.btnSecundarioText, { color: colors.text }]}>
                                {textoCancelar}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.btnPrimario}
                            onPress={onConfirmar}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.btnPrimarioText}>{textoConfirmar}</Text>
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
        padding: 24,
    },
    box: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: 18,
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    iconText: {
        fontSize: 22,
        fontWeight: '700',
    },
    titulo: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    mensaje: {
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 20,
    },
    acciones: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    btnSecundario: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 46,
    },
    btnSecundarioText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    btnPrimario: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 46,
    },
    btnPrimarioText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    cerrarBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 34,
        height: 34,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    cerrarBtnText: {
        fontSize: 18,
        lineHeight: 20,
    },
});
