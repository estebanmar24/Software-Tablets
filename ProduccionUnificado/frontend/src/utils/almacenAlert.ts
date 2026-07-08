import { Alert, Platform } from 'react-native';

/** Alertas de validación visibles también en web (Alert nativo a veces no aparece). */
export function almacenAlert(titulo: string, mensaje: string): void {
    const texto = `${titulo}\n\n${mensaje}`;
    if (Platform.OS === 'web') {
        globalThis.alert?.(texto);
        return;
    }
    Alert.alert(titulo, mensaje);
}

/** Confirmación destructiva (web usa confirm nativo). */
export function almacenConfirm(titulo: string, mensaje: string): Promise<boolean> {
    const texto = `${titulo}\n\n${mensaje}`;
    if (Platform.OS === 'web') {
        return Promise.resolve(globalThis.confirm?.(texto) ?? false);
    }
    return new Promise((resolve) => {
        Alert.alert(titulo, mensaje, [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Borrar', style: 'destructive', onPress: () => resolve(true) },
        ]);
    });
}

/** Confirmación sí/no genérica (web: Aceptar = true, Cancelar = false). */
export function almacenConfirmSiNo(
    titulo: string,
    mensaje: string,
    textoSi = 'Sí',
    textoNo = 'No'
): Promise<boolean> {
    if (Platform.OS === 'web') {
        const texto = `${titulo}\n\n${mensaje}`;
        return Promise.resolve(globalThis.confirm?.(texto) ?? false);
    }
    return new Promise((resolve) => {
        Alert.alert(titulo, mensaje, [
            { text: textoNo, style: 'cancel', onPress: () => resolve(false) },
            { text: textoSi, onPress: () => resolve(true) },
        ]);
    });
}
