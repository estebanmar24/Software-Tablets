import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

/**
 * Scroll único para autorizaciones + lista de gastos en pantallas de captura.
 * Evita que el bloque de autorizaciones bloquee el scroll de la página.
 */
export default function GastosCapturaBodyScroll({ children, style, contentContainerStyle }) {
    return (
        <ScrollView
            style={[styles.scroll, style]}
            contentContainerStyle={[styles.content, contentContainerStyle]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
        >
            {children}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingBottom: 32 },
});
