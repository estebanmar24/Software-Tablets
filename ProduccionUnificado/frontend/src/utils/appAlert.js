import { Alert, Platform } from 'react-native';

/** Alerta visible en web (window.alert) y nativo (Alert.alert). */
export function showAppAlert(title, message, onPress) {
    const text = message ? `${title}\n\n${message}` : title;
    if (Platform.OS === 'web') {
        window.alert(text);
        if (onPress) onPress();
    } else {
        Alert.alert(title, message, onPress ? [{ text: 'Aceptar', onPress }] : undefined);
    }
}

/** Extrae mensaje legible de errores Axios / ASP.NET (string, ProblemDetails, { message }). */
export function extractApiErrorMessage(error, fallback = 'No se pudo guardar') {
    const data = error?.response?.data;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data && typeof data === 'object') {
        if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
        if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
        if (typeof data.title === 'string' && data.title.trim()) return data.title.trim();
    }
    if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
    return fallback;
}

export function isOvertimeDuplicateMessage(texto, status) {
    if (!texto) return false;
    return texto.includes('Ya existe un registro')
        || (status === 400 && texto.includes('mismos datos'));
}
