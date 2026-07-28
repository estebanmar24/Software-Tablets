import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
    Modal,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { downloadBlobFromApi, type DownloadProgress } from '../utils/blobDownload';

const inicioSemanaActual = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
};

const initialProgress = (): DownloadProgress => ({
    phase: 'preparing',
    percent: 0,
    loadedBytes: 0,
    label: '',
});

export default function InformeSemanalCalidadView() {
    const { colors } = useTheme();
    const [fechaInicio, setFechaInicio] = useState(inicioSemanaActual);
    const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
    const [generando, setGenerando] = useState(false);
    const [progress, setProgress] = useState<DownloadProgress>(initialProgress);

    const descargarExcel = async () => {
        if (!fechaInicio || !fechaFin) {
            Alert.alert('Informe semanal', 'Indique fecha inicio y fecha final.');
            return;
        }

        setGenerando(true);
        setProgress({
            phase: 'preparing',
            percent: 2,
            loadedBytes: 0,
            label: 'Iniciando...',
        });

        try {
            await downloadBlobFromApi(
                'calidad/informe-semanal/export-excel',
                { fechaInicio, fechaFin },
                `Informe_Semanal_Calidad_${fechaInicio}_${fechaFin}.xlsx`,
                setProgress
            );
        } catch (error: unknown) {
            const mensaje = error instanceof Error ? error.message : 'No se pudo generar el Excel.';
            Alert.alert('Informe semanal', mensaje);
        } finally {
            setGenerando(false);
            setProgress(initialProgress());
        }
    };

    return (
        <>
            <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
                <View style={styles.headerCard}>
                    <Text style={styles.titulo}>INFORME DE CONTROL DE CALIDAD EN PROCESO - SEMANAL</Text>
                    <Text style={[styles.subtitulo, { color: colors.subText }]}>
                        Seleccione el rango de fechas y descargue el informe en Excel con fotos, referencias y defectos
                        registrados. La columna Observaciones incluye el texto de la encuesta de calidad.
                    </Text>

                    <View style={styles.fechasRow}>
                        <View style={styles.fechaCol}>
                            <Text style={styles.fechaLabel}>Fecha inicio</Text>
                            <TextInput
                                style={[styles.fechaInput, { borderColor: colors.border, color: colors.text }]}
                                value={fechaInicio}
                                onChangeText={setFechaInicio}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor={colors.subText}
                                editable={!generando}
                            />
                        </View>
                        <View style={styles.fechaCol}>
                            <Text style={styles.fechaLabel}>Fecha final</Text>
                            <TextInput
                                style={[styles.fechaInput, { borderColor: colors.border, color: colors.text }]}
                                value={fechaFin}
                                onChangeText={setFechaFin}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor={colors.subText}
                                editable={!generando}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.btnExcel, generando && styles.btnDisabled]}
                            onPress={descargarExcel}
                            disabled={generando}
                        >
                            <Text style={styles.btnExcelText}>
                                {generando ? 'Generando...' : 'Descargar Excel'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>Columnas del informe</Text>
                    <Text style={[styles.previewCols, { color: colors.subText }]}>
                        N° · FOTO · REFERENCIA · DEFECTO · OBSERVACIONES · CANTIDAD · ESTADO · celda libre
                    </Text>
                    <Text style={[styles.previewHint, { color: colors.subText }]}>
                        Una sola hoja con fotos. La última columna queda vacía para anotaciones manuales.
                    </Text>
                </View>
            </ScrollView>

            <Modal visible={generando} transparent animationType="fade">
                <View style={styles.progressOverlay}>
                    <View style={styles.progressCard}>
                        <Text style={styles.progressTitle}>Generando informe Excel</Text>
                        <Text style={styles.progressLabel}>{progress.label || 'Espere un momento...'}</Text>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.max(progress.percent, 4)}%` }]} />
                        </View>
                        <Text style={styles.progressPercent}>{progress.percent}%</Text>
                        <Text style={styles.progressHint}>
                            No cierre esta ventana. Con muchas fotos puede tardar 1–2 minutos.
                        </Text>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#F5F7FA' },
    content: { padding: 16, paddingBottom: 40 },
    headerCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    titulo: {
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '800',
        color: '#1E3A5F',
        letterSpacing: 0.3,
        marginBottom: 12,
    },
    subtitulo: {
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 18,
    },
    fechasRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 12,
    },
    fechaCol: { minWidth: 160, flex: 1 },
    fechaLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 6 },
    fechaInput: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'web' ? 8 : 10,
        fontSize: 14,
        backgroundColor: '#fff',
    },
    btnExcel: {
        backgroundColor: '#38A169',
        paddingHorizontal: 22,
        paddingVertical: 11,
        borderRadius: 8,
        minWidth: 170,
        alignItems: 'center',
    },
    btnDisabled: { opacity: 0.7 },
    btnExcelText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    previewCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E3A5F',
        marginBottom: 8,
    },
    previewCols: { fontSize: 13, lineHeight: 20 },
    previewHint: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
    progressOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    progressCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    progressTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E3A5F',
        textAlign: 'center',
        marginBottom: 10,
    },
    progressLabel: {
        fontSize: 13,
        color: '#4A5568',
        textAlign: 'center',
        marginBottom: 14,
        minHeight: 36,
    },
    progressTrack: {
        height: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#38A169',
        borderRadius: 999,
    },
    progressPercent: {
        marginTop: 8,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '700',
        color: '#1E3A5F',
    },
    progressHint: {
        marginTop: 12,
        fontSize: 12,
        color: '#718096',
        textAlign: 'center',
        lineHeight: 18,
    },
});
