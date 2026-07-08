import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';

/**
 * Convierte selección UI a flags de API (mutuamente excluyentes).
 * @param {'credito'|'efectivo'} medio
 */
export function medioPagoToFlags(medio) {
    if (medio === 'credito') return { esSolicitudCredito: true, esEfectivo: false };
    if (medio === 'efectivo') return { esSolicitudCredito: false, esEfectivo: true };
    return { esSolicitudCredito: false, esEfectivo: false };
}

/** Deriva valor UI desde respuesta API */
export function flagsToMedioPago(esSolicitudCredito, esEfectivo) {
    if (esSolicitudCredito) return 'credito';
    if (esEfectivo) return 'efectivo';
    return null;
}

/** Título y mensaje del informe si guardan sin elegir crédito o efectivo */
export const ALERT_MEDIO_PAGO_TITULO = 'Informe';
export const ALERT_MEDIO_PAGO_MENSAJE =
    'Para guardar el gasto debe marcar la forma de pago: indique si es a crédito (solicitud de crédito) o en efectivo, usando los dos botones de la sección «Forma de pago», y luego vuelva a pulsar Guardar.';

/** En web, `Alert.alert` de react-native-web no hace nada; usar este helper para el aviso de forma de pago. */
export function showAlertMedioPagoRequerido() {
    if (Platform.OS === 'web') {
        window.alert(`${ALERT_MEDIO_PAGO_TITULO}\n\n${ALERT_MEDIO_PAGO_MENSAJE}`);
    } else {
        Alert.alert(ALERT_MEDIO_PAGO_TITULO, ALERT_MEDIO_PAGO_MENSAJE);
    }
}

/**
 * @param {object} props
 * @param {'credito'|'efectivo'|null} props.value
 * @param {(v: 'credito'|'efectivo') => void} props.onChange
 * @param {object} props.colors - theme colors (text, subText, primary, border, card)
 */
export default function MedioPagoGastoControls({ value, onChange, colors }) {
    const c = colors || {};
    return (
        <View style={{ marginBottom: 14 }}>
            <Text style={[styles.label, { color: c.text || '#111' }]}>Forma de pago *</Text>
            <Text style={[styles.hint, { color: c.subText || '#64748b' }]}>
                Obligatorio: indique si el gasto es a crédito o en efectivo.
            </Text>
            <View style={styles.row}>
                <TouchableOpacity
                    style={[
                        styles.half,
                        {
                            borderColor: value === 'credito' ? (c.primary || '#7C3AED') : (c.border || '#E5E7EB'),
                            backgroundColor: value === 'credito' ? (c.primary || '#7C3AED') : (c.card || '#fff')
                        }
                    ]}
                    onPress={() => onChange('credito')}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.halfTitle, { color: value === 'credito' ? '#fff' : (c.text || '#111') }]}>
                        Crédito
                    </Text>
                    <Text style={[styles.halfSub, { color: value === 'credito' ? 'rgba(255,255,255,0.9)' : (c.subText || '#64748b') }]}>
                        Solicitud de crédito
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.half,
                        {
                            borderColor: value === 'efectivo' ? '#059669' : (c.border || '#E5E7EB'),
                            backgroundColor: value === 'efectivo' ? '#059669' : (c.card || '#fff')
                        }
                    ]}
                    onPress={() => onChange('efectivo')}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.halfTitle, { color: value === 'efectivo' ? '#fff' : (c.text || '#111') }]}>
                        Efectivo
                    </Text>
                    <Text style={[styles.halfSub, { color: value === 'efectivo' ? 'rgba(255,255,255,0.9)' : (c.subText || '#64748b') }]}>
                        Pago inmediato
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/** Badge para listas */
export function MedioPagoBadge({ esSolicitudCredito, esEfectivo, compact }) {
    if (esSolicitudCredito) {
        return (
            <View style={[styles.badge, { backgroundColor: '#7C3AED' }]}>
                <Text style={styles.badgeText}>{compact ? 'Créd.' : 'Crédito'}</Text>
            </View>
        );
    }
    if (esEfectivo) {
        return (
            <View style={[styles.badge, { backgroundColor: '#059669' }]}>
                <Text style={styles.badgeText}>{compact ? 'Efec.' : 'Efectivo'}</Text>
            </View>
        );
    }
    return (
        <View style={[styles.badge, { backgroundColor: '#94A3B8' }]}>
            <Text style={styles.badgeText}>{compact ? '—' : 'Sin clasificar'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    label: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    hint: { fontSize: 12, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 10 },
    half: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 2
    },
    halfTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
    halfSub: { fontSize: 11, marginTop: 4, textAlign: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' }
});
