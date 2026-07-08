import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '../contexts/ThemeContext';
import { mantenimientoApi } from '../services/mantenimientoApi';

export interface BitacoraMantEntry {
    id?: number;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    actividad: string;
    descripcion: string;
    registradoPor?: string;
    fechaRegistro?: string;
}

type FiltroRango = 'HOY' | 'SEMANA' | 'MES' | 'TODOS';

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const norm = (item: BitacoraMantEntry & Record<string, unknown>): BitacoraMantEntry => ({
    id: item.id ?? (item.Id as number),
    fecha: String(item.fecha ?? item.Fecha ?? '').slice(0, 10),
    horaInicio: String(item.horaInicio ?? item.HoraInicio ?? '08:00').slice(0, 8),
    horaFin: String(item.horaFin ?? item.HoraFin ?? '17:00').slice(0, 8),
    actividad: String(item.actividad ?? item.Actividad ?? ''),
    descripcion: String(item.descripcion ?? item.Descripcion ?? ''),
    registradoPor: String(item.registradoPor ?? item.RegistradoPor ?? ''),
    fechaRegistro: item.fechaRegistro as string | undefined,
});

const emptyForm = (): BitacoraMantEntry => ({
    fecha: todayStr(),
    horaInicio: '08:00',
    horaFin: '17:00',
    actividad: '',
    descripcion: '',
});

const ACTIVIDADES_SUGERIDAS = [
    'Mantenimiento preventivo',
    'Mantenimiento correctivo',
    'Limpieza y aseo',
    'Reparación',
    'Inspección',
    'Cambio de repuesto',
    'Calibración',
    'Otra actividad',
];

function getRangoFechas(filtro: FiltroRango): { desde?: string; hasta?: string } {
    const hoy = new Date();
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (filtro === 'TODOS') return {};
    if (filtro === 'HOY') return { desde: fmt(hoy), hasta: fmt(hoy) };
    if (filtro === 'SEMANA') {
        const inicio = new Date(hoy);
        inicio.setDate(hoy.getDate() - 6);
        return { desde: fmt(inicio), hasta: fmt(hoy) };
    }
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fmt(inicioMes), hasta: fmt(hoy) };
}

const formatFecha = (f: string) => {
    if (!f) return '—';
    const [y, m, d] = f.slice(0, 10).split('-');
    return d && m && y ? `${d}/${m}/${y}` : f;
};

const normalizarHora = (hora?: string): string | null => {
    if (!hora?.trim()) return null;
    const t = hora.trim().slice(0, 8);
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    return null;
};

const horaAMinutos = (hora: string): number => {
    const [h, m] = hora.split(':').map((x) => parseInt(x, 10));
    return (h || 0) * 60 + (m || 0);
};

const mostrarAlerta = (titulo: string, mensaje: string) => {
    if (Platform.OS === 'web') window.alert(`${titulo}\n\n${mensaje}`);
    else Alert.alert(titulo, mensaje);
};

const webInputStyle = (border: string, isDarkMode: boolean, textColor: string): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    height: 40,
    padding: '0 12px',
    marginBottom: 4,
    borderRadius: 8,
    border: `1px solid ${border}`,
    backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
    color: textColor,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
});

export default function BitacoraMantenimientoTab() {
    const { colors, isDarkMode } = useTheme();
    const [registros, setRegistros] = useState<BitacoraMantEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exportando, setExportando] = useState(false);
    const [filtroRango, setFiltroRango] = useState<FiltroRango>('MES');
    const [busqueda, setBusqueda] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState<BitacoraMantEntry>(emptyForm());
    const [formError, setFormError] = useState('');

    const rango = useMemo(() => getRangoFechas(filtroRango), [filtroRango]);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const data = await mantenimientoApi.getBitacoraMantenimiento({
                ...rango,
                q: busqueda.trim() || undefined,
            });
            const list = (Array.isArray(data) ? data : []).map((r) => norm(r as BitacoraMantEntry & Record<string, unknown>));
            setRegistros(list);
        } catch {
            setRegistros([]);
        } finally {
            setLoading(false);
        }
    }, [rango, busqueda]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const abrirNuevo = () => {
        setForm(emptyForm());
        setFormError('');
        setIsEditing(false);
        setModalVisible(true);
    };

    const abrirEditar = (item: BitacoraMantEntry) => {
        setForm({ ...item });
        setFormError('');
        setIsEditing(true);
        setModalVisible(true);
    };

    const validarFormulario = (): string | null => {
        const fecha = (form.fecha || '').trim().slice(0, 10);
        if (!fecha) return 'Seleccione la fecha.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'La fecha no es válida.';

        const horaInicio = normalizarHora(form.horaInicio);
        const horaFin = normalizarHora(form.horaFin);
        if (!horaInicio) return 'Indique la hora de inicio.';
        if (!horaFin) return 'Indique la hora de fin.';
        if (horaAMinutos(horaFin) <= horaAMinutos(horaInicio)) {
            return 'La hora fin debe ser posterior a la hora de inicio.';
        }

        if (!form.actividad.trim()) return 'Indique la actividad realizada.';
        if (!form.descripcion.trim()) return 'Indique la descripción del trabajo.';
        return null;
    };

    const patchForm = (patch: Partial<BitacoraMantEntry>) => {
        setForm((p) => ({ ...p, ...patch }));
        if (formError) setFormError('');
    };

    const guardar = async () => {
        const error = validarFormulario();
        if (error) {
            setFormError(error);
            mostrarAlerta('Revise el formulario', error);
            return;
        }
        setFormError('');
        setSaving(true);
        try {
            const horaInicio = normalizarHora(form.horaInicio)!;
            const horaFin = normalizarHora(form.horaFin)!;
            const payload = {
                ...form,
                fecha: `${form.fecha.slice(0, 10)}T12:00:00`,
                horaInicio,
                horaFin,
                actividad: form.actividad.trim(),
                descripcion: form.descripcion.trim(),
            };
            if (isEditing && form.id) {
                await mantenimientoApi.updateBitacoraMantenimiento(form.id, payload);
            } else {
                await mantenimientoApi.createBitacoraMantenimiento(payload);
            }
            setModalVisible(false);
            await cargar();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { error?: string; message?: string } } };
            const msg = err?.response?.data?.error || err?.response?.data?.message || 'No se pudo guardar el registro.';
            setFormError(msg);
            mostrarAlerta('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const eliminar = (item: BitacoraMantEntry) => {
        const msg = '¿Eliminar este registro de la bitácora?';
        const run = async () => {
            try {
                await mantenimientoApi.deleteBitacoraMantenimiento(item.id!);
                await cargar();
            } catch {
                Alert.alert('Error', 'No se pudo eliminar.');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm(msg)) run();
        } else {
            Alert.alert('Eliminar', msg, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: run },
            ]);
        }
    };

    const descargarExcel = async () => {
        setExportando(true);
        try {
            const blob = await mantenimientoApi.exportarBitacoraMantenimientoExcel({
                ...rango,
                q: busqueda.trim() || undefined,
            });
            if (Platform.OS === 'web') {
                const fileBlob = new Blob([blob], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
                const url = window.URL.createObjectURL(fileBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Bitacora_Mantenimiento_${todayStr().replace(/-/g, '')}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                Alert.alert('Exportar', 'La descarga de Excel está disponible en la versión web.');
            }
        } catch {
            Alert.alert('Sin datos', 'No hay registros para exportar con el filtro actual.');
        } finally {
            setExportando(false);
        }
    };

    const descargarPdf = () => {
        if (registros.length === 0) {
            Alert.alert('Sin datos', 'No hay registros para exportar.');
            return;
        }
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Bitácora de Mantenimiento', 14, 16);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado: ${new Date().toLocaleString('es-CO')} · ${registros.length} registro(s)`, 14, 24);

        const body = registros.map((r) => [
            formatFecha(r.fecha),
            (r.horaInicio || '').slice(0, 5),
            (r.horaFin || '').slice(0, 5),
            r.actividad,
            r.descripcion,
            r.registradoPor || '—',
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Fecha', 'Inicio', 'Fin', 'Actividad', 'Descripción', 'Registrado por']],
            body,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 64, 175] },
            columnStyles: {
                4: { cellWidth: 80 },
            },
        });

        if (Platform.OS === 'web') {
            doc.save(`Bitacora_Mantenimiento_${todayStr().replace(/-/g, '')}.pdf`);
        } else {
            Alert.alert('PDF', 'La descarga de PDF está disponible en la versión web.');
        }
    };

    const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
    const border = colors.border || '#e2e8f0';

    return (
        <View style={styles.container}>
            <View style={[styles.toolbar, { backgroundColor: isDarkMode ? '#111827' : '#f8fafc', borderBottomColor: border }]}>
                <View style={styles.searchRow}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.subText} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text, backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderColor: border }]}
                        value={busqueda}
                        onChangeText={setBusqueda}
                        placeholder="Buscar actividad o descripción..."
                        placeholderTextColor={colors.subText}
                        onSubmitEditing={cargar}
                    />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                    {(['HOY', 'SEMANA', 'MES', 'TODOS'] as FiltroRango[]).map((k) => (
                        <TouchableOpacity
                            key={k}
                            onPress={() => setFiltroRango(k)}
                            style={[styles.chip, { borderColor: border }, filtroRango === k && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        >
                            <Text style={[styles.chipText, { color: filtroRango === k ? '#fff' : colors.text }]}>
                                {k === 'HOY' ? 'Hoy' : k === 'SEMANA' ? '7 días' : k === 'MES' ? 'Este mes' : 'Todos'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <View style={styles.exportRow}>
                    <TouchableOpacity style={[styles.exportBtn, { borderColor: '#16a34a' }]} onPress={descargarExcel} disabled={exportando}>
                        {exportando ? <ActivityIndicator size="small" color="#16a34a" /> : (
                            <>
                                <MaterialCommunityIcons name="microsoft-excel" size={18} color="#16a34a" />
                                <Text style={styles.exportExcelText}>Excel</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.exportBtn, { borderColor: '#e11d48' }]} onPress={descargarPdf}>
                        <MaterialCommunityIcons name="file-pdf-box" size={18} color="#e11d48" />
                        <Text style={styles.exportPdfText}>PDF</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={registros}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ padding: 15, paddingBottom: 90 }}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="notebook-outline" size={64} color={colors.subText} style={{ opacity: 0.4 }} />
                            <Text style={{ color: colors.subText, marginTop: 12, textAlign: 'center' }}>
                                No hay registros en la bitácora. Pulse + para agregar lo realizado en el día.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.cardHeader}>
                                    <Text style={[styles.cardFecha, { color: colors.primary }]}>{formatFecha(item.fecha)}</Text>
                                    <Text style={[styles.cardHoras, { color: colors.subText }]}>
                                        {(item.horaInicio || '').slice(0, 5)} — {(item.horaFin || '').slice(0, 5)}
                                    </Text>
                                </View>
                                <Text style={[styles.cardActividad, { color: colors.text }]}>{item.actividad}</Text>
                                <Text style={[styles.cardDesc, { color: colors.subText }]} numberOfLines={3}>{item.descripcion}</Text>
                                {item.registradoPor ? (
                                    <Text style={[styles.cardUser, { color: colors.primary }]}>{item.registradoPor}</Text>
                                ) : null}
                            </View>
                            <View style={styles.cardActions}>
                                <TouchableOpacity onPress={() => abrirEditar(item)} style={styles.iconBtn}>
                                    <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.subText} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => eliminar(item)} style={styles.iconBtn}>
                                    <MaterialCommunityIcons name="delete-outline" size={22} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={abrirNuevo}>
                <MaterialCommunityIcons name="plus" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#111827' : '#fff', borderColor: border }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: border }]}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    {isEditing ? 'Editar registro' : 'Nuevo registro'}
                                </Text>
                                <Text style={[styles.modalSubtitle, { color: colors.subText }]}>Bitácora de mantenimiento</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <MaterialCommunityIcons name="close" size={22} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalBody}
                            contentContainerStyle={styles.modalBodyContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={[styles.label, { color: colors.subText }]}>Fecha</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={form.fecha}
                                    onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                                    style={webInputStyle(border, isDarkMode, colors.text)}
                                />
                            ) : (
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                    value={form.fecha}
                                    onChangeText={(t) => setForm((p) => ({ ...p, fecha: t }))}
                                    placeholder="YYYY-MM-DD"
                                />
                            )}

                            <View style={styles.row2}>
                                <View style={styles.row2Col}>
                                    <Text style={[styles.label, { color: colors.subText }]}>Hora inicio *</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="time"
                                            value={(form.horaInicio || '').slice(0, 5)}
                                            onChange={(e) => patchForm({ horaInicio: e.target.value })}
                                            style={webInputStyle(border, isDarkMode, colors.text)}
                                        />
                                    ) : (
                                        <TextInput
                                            style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                            value={form.horaInicio}
                                            onChangeText={(t) => patchForm({ horaInicio: t })}
                                            placeholder="08:00"
                                        />
                                    )}
                                </View>
                                <View style={styles.row2Col}>
                                    <Text style={[styles.label, { color: colors.subText }]}>Hora fin *</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="time"
                                            value={(form.horaFin || '').slice(0, 5)}
                                            onChange={(e) => patchForm({ horaFin: e.target.value })}
                                            style={webInputStyle(border, isDarkMode, colors.text)}
                                        />
                                    ) : (
                                        <TextInput
                                            style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                            value={form.horaFin}
                                            onChangeText={(t) => patchForm({ horaFin: t })}
                                            placeholder="17:00"
                                        />
                                    )}
                                </View>
                            </View>

                            <Text style={[styles.label, { color: colors.subText }]}>Actividad *</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                value={form.actividad}
                                onChangeText={(t) => patchForm({ actividad: t })}
                                placeholder="Ej: Mantenimiento preventivo"
                            />
                            <View style={styles.chipsWrap}>
                                {ACTIVIDADES_SUGERIDAS.map((a) => {
                                    const selected = form.actividad === a;
                                    return (
                                        <TouchableOpacity
                                            key={a}
                                            onPress={() => patchForm({ actividad: a })}
                                            style={[
                                                styles.suggestChip,
                                                { borderColor: selected ? colors.primary : border },
                                                selected && { backgroundColor: `${colors.primary}18` },
                                            ]}
                                        >
                                            <Text style={{ fontSize: 11, color: selected ? colors.primary : colors.subText }}>{a}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.label, { color: colors.subText }]}>Descripción *</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, { color: colors.text, borderColor: border, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                value={form.descripcion}
                                onChangeText={(t) => patchForm({ descripcion: t })}
                                placeholder="Detalle de lo realizado..."
                                multiline
                                numberOfLines={4}
                            />
                        </ScrollView>

                        <View style={[styles.modalActions, { borderTopColor: border }]}>
                            <TouchableOpacity style={[styles.btnCancel, { borderColor: border }]} onPress={() => setModalVisible(false)}>
                                <Text style={{ color: colors.subText, fontWeight: '600' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnSave, { backgroundColor: colors.primary }]} onPress={guardar} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    toolbar: { padding: 12, borderBottomWidth: 1, gap: 10 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    searchInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
    chipsRow: { flexGrow: 0 },
    chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
    chipText: { fontSize: 12, fontWeight: '600' },
    exportRow: { flexDirection: 'row', gap: 10 },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    exportExcelText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
    exportPdfText: { color: '#e11d48', fontWeight: '600', fontSize: 13 },
    empty: { alignItems: 'center', padding: 40 },
    card: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#2563eb' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardFecha: { fontSize: 13, fontWeight: '700' },
    cardHoras: { fontSize: 12 },
    cardActividad: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    cardDesc: { fontSize: 13, lineHeight: 18 },
    cardUser: { fontSize: 11, marginTop: 6, fontStyle: 'italic' },
    cardActions: { justifyContent: 'center', paddingLeft: 8 },
    iconBtn: { padding: 6 },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 480,
        borderRadius: 14,
        borderWidth: 1,
        maxHeight: '92%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    modalSubtitle: { fontSize: 12, marginTop: 2 },
    modalCloseBtn: { padding: 4, marginTop: -2 },
    modalBody: { flexGrow: 0, flexShrink: 1 },
    modalBodyContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    formErrorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 10,
        marginBottom: 4,
    },
    formErrorText: { flex: 1, color: '#b91c1c', fontSize: 13, lineHeight: 18 },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4, fontSize: 14, width: '100%' },
    textArea: { minHeight: 88, maxHeight: 140, textAlignVertical: 'top' },
    row2: { flexDirection: 'row', gap: 12, marginTop: 2 },
    row2Col: { flex: 1, minWidth: 0 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 4 },
    suggestChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
    },
    btnCancel: {
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 8,
        borderWidth: 1,
    },
    btnSave: {
        paddingHorizontal: 22,
        paddingVertical: 11,
        borderRadius: 8,
        minWidth: 110,
        alignItems: 'center',
    },
});
