import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Modal, Alert, Platform, ActivityIndicator, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import {
    fetchTickets, fetchTicketStats, createTicket, updateTicket,
    deleteTicket, cambiarEstadoTicket, uploadTicketImagen
} from '../services/ticketsApi';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

const MODULOS = [
    'Producción', 'Talleres y Despachos', 'Calidad', 'SST',
    'Gestión Humana', 'Presupuesto', 'Equipos', 'Planeación',
    'Diseño', 'Cuadro Master', 'Otro'
];

const PRIORIDADES = ['Baja', 'Media', 'Alta'];
const ESTADOS = ['Abierto', 'EnProgreso', 'Resuelto', 'Cerrado'];

const ESTADO_LABELS: Record<string, string> = {
    'Abierto': 'Abierto',
    'EnProgreso': 'En Progreso',
    'Resuelto': 'Resuelto',
    'Cerrado': 'Cerrado',
};

const PRIORIDAD_COLORS: Record<string, { bg: string; text: string }> = {
    'Baja': { bg: '#E8F5E9', text: '#2E7D32' },
    'Media': { bg: '#FFF8E1', text: '#F57F17' },
    'Alta': { bg: '#FFEBEE', text: '#C62828' },
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
    'Abierto': { bg: '#E3F2FD', text: '#1565C0' },
    'EnProgreso': { bg: '#FFF3E0', text: '#E65100' },
    'Resuelto': { bg: '#E8F5E9', text: '#2E7D32' },
    'Cerrado': { bg: '#F5F5F5', text: '#616161' },
};

interface TicketImagen {
    id?: number;
    ticketId?: number;
    imagenUrl: string;
    fechaSubida?: string;
}

interface Ticket {
    id?: number;
    titulo: string;
    descripcion: string;
    pasosReproducir?: string;
    prioridad: string;
    estado: string;
    moduloAfectado?: string;
    reportadoPor: string;
    comentarios?: string;
    fechaCreacion?: string;
    fechaActualizacion?: string;
    fechaResolucion?: string;
    imagenes?: TicketImagen[];
}

interface TicketStats {
    total: number;
    abiertos: number;
    enProgreso: number;
    resueltos: number;
    cerrados: number;
    altaPrioridad: number;
}

interface TicketsScreenProps {
    displayName?: string;
}

export default function TicketsScreen({ displayName }: TicketsScreenProps) {
    const { colors, isDarkMode } = useTheme();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [stats, setStats] = useState<TicketStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filtroEstado, setFiltroEstado] = useState<string>('');
    const [filtroPrioridad, setFiltroPrioridad] = useState<string>('');
    const [buscar, setBuscar] = useState('');

    // Form state
    const [formTitulo, setFormTitulo] = useState('');
    const [formDescripcion, setFormDescripcion] = useState('');
    const [formPasos, setFormPasos] = useState('');
    const [formPrioridad, setFormPrioridad] = useState('Media');
    const [formModulo, setFormModulo] = useState('');
    const [formComentarios, setFormComentarios] = useState('');
    const [formImagenes, setFormImagenes] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const filtros: any = {};
            if (filtroEstado) filtros.estado = filtroEstado;
            if (filtroPrioridad) filtros.prioridad = filtroPrioridad;
            if (buscar) filtros.buscar = buscar;

            const [ticketsData, statsData] = await Promise.all([
                fetchTickets(filtros),
                fetchTicketStats(),
            ]);
            setTickets(ticketsData);
            setStats(statsData);
        } catch (err: any) {
            console.error('Error loading tickets:', err);
            Alert.alert('Error', 'No se pudieron cargar los tickets');
        } finally {
            setLoading(false);
        }
    }, [filtroEstado, filtroPrioridad, buscar]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const resetForm = () => {
        setFormTitulo('');
        setFormDescripcion('');
        setFormPasos('');
        setFormPrioridad('Media');
        setFormModulo('');
        setFormComentarios('');
        setFormImagenes([]);
        setIsEditing(false);
    };

    const openCreate = () => {
        resetForm();
        setShowCreateModal(true);
    };

    const openEdit = (ticket: Ticket) => {
        setFormTitulo(ticket.titulo);
        setFormDescripcion(ticket.descripcion);
        setFormPasos(ticket.pasosReproducir || '');
        setFormPrioridad(ticket.prioridad);
        setFormModulo(ticket.moduloAfectado || '');
        setFormComentarios(ticket.comentarios || '');
        setFormImagenes(ticket.imagenes?.map(i => i.imagenUrl) || []);
        setIsEditing(true);
        setSelectedTicket(ticket);
        setShowDetailModal(false);
        setShowCreateModal(true);
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: false,
                quality: 0.7,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const formData = new FormData();
                const filename = asset.uri.split('/').pop() || 'image.jpg';

                if (Platform.OS === 'web') {
                    const response = await fetch(asset.uri);
                    const blob = await response.blob();
                    formData.append('archivo', blob, filename);
                } else {
                    formData.append('archivo', {
                        uri: asset.uri,
                        name: filename,
                        type: asset.mimeType || 'image/jpeg',
                    } as any);
                }

                const res = await uploadTicketImagen(formData);
                if (res.url) {
                    setFormImagenes(prev => [...prev, res.url]);
                }
            }
        } catch (err) {
            console.error('Error uploading image:', err);
            Alert.alert('Error', 'No se pudo subir la imagen');
        }
    };

    const handleSubmit = async () => {
        if (!formTitulo.trim() || !formDescripcion.trim()) {
            Alert.alert('Error', 'El título y la descripción son obligatorios');
            return;
        }

        setSubmitting(true);
        try {
            const ticketData: any = {
                titulo: formTitulo.trim(),
                descripcion: formDescripcion.trim(),
                pasosReproducir: formPasos.trim() || null,
                prioridad: formPrioridad,
                moduloAfectado: formModulo || null,
                reportadoPor: displayName || 'Usuario',
                comentarios: formComentarios.trim() || null,
                imagenes: formImagenes.map(url => ({ imagenUrl: url })),
            };

            if (isEditing && selectedTicket?.id) {
                ticketData.estado = selectedTicket.estado;
                await updateTicket(selectedTicket.id, ticketData);
                Alert.alert('Éxito', 'Ticket actualizado correctamente');
            } else {
                ticketData.estado = 'Abierto';
                await createTicket(ticketData);
                Alert.alert('Éxito', 'Ticket creado correctamente');
            }

            setShowCreateModal(false);
            resetForm();
            loadData();
        } catch (err: any) {
            console.error('Error saving ticket:', err);
            Alert.alert('Error', 'No se pudo guardar el ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangeEstado = async (ticket: Ticket, nuevoEstado: string) => {
        try {
            await cambiarEstadoTicket(ticket.id!, nuevoEstado, null);
            Alert.alert('Éxito', `Estado cambiado a ${ESTADO_LABELS[nuevoEstado]}`);
            loadData();
            if (selectedTicket?.id === ticket.id) {
                setSelectedTicket({ ...selectedTicket, estado: nuevoEstado } as Ticket);
            }
        } catch (err) {
            Alert.alert('Error', 'No se pudo cambiar el estado');
        }
    };

    const handleDelete = async (ticket: Ticket) => {
        Alert.alert(
            'Confirmar eliminación',
            `¿Desea eliminar el ticket "${ticket.titulo}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive', onPress: async () => {
                        try {
                            await deleteTicket(ticket.id!);
                            Alert.alert('Éxito', 'Ticket eliminado');
                            setShowDetailModal(false);
                            loadData();
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo eliminar el ticket');
                        }
                    }
                },
            ]
        );
    };

    const openDetail = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setShowDetailModal(true);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // ============ RENDER ============

    const renderBadge = (text: string, colorMap: Record<string, { bg: string; text: string }>) => {
        const c = colorMap[text] || { bg: '#E0E0E0', text: '#333' };
        return (
            <View style={[styles.badge, { backgroundColor: c.bg }]}>
                <Text style={[styles.badgeText, { color: c.text }]}>
                    {ESTADO_LABELS[text] || text}
                </Text>
            </View>
        );
    };

    const renderStatsCards = () => {
        if (!stats) return null;
        const cards = [
            { label: 'Total', value: stats.total, color: '#3182CE', icon: '🎫' },
            { label: 'Abiertos', value: stats.abiertos, color: '#1565C0', icon: '📬' },
            { label: 'En Progreso', value: stats.enProgreso, color: '#E65100', icon: '🔧' },
            { label: 'Resueltos', value: stats.resueltos, color: '#2E7D32', icon: '✅' },
            { label: 'Alta Prioridad', value: stats.altaPrioridad, color: '#C62828', icon: '🔴' },
        ];
        return (
            <View style={styles.statsRow}>
                {cards.map((card, i) => (
                    <View key={i} style={[styles.statCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                        <Text style={{ fontSize: 22 }}>{card.icon}</Text>
                        <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                        <Text style={[styles.statLabel, { color: colors.subText }]}>{card.label}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const renderFilters = () => (
        <View style={[styles.filtersRow, { backgroundColor: isDarkMode ? '#1E293B' : '#F7FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
            <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.subText }]}>Estado:</Text>
                <View style={styles.filterButtons}>
                    <TouchableOpacity
                        style={[styles.filterBtn, !filtroEstado && styles.filterBtnActive]}
                        onPress={() => setFiltroEstado('')}
                    >
                        <Text style={[styles.filterBtnText, !filtroEstado && styles.filterBtnTextActive]}>Todos</Text>
                    </TouchableOpacity>
                    {ESTADOS.map(e => (
                        <TouchableOpacity
                            key={e}
                            style={[styles.filterBtn, filtroEstado === e && styles.filterBtnActive]}
                            onPress={() => setFiltroEstado(filtroEstado === e ? '' : e)}
                        >
                            <Text style={[styles.filterBtnText, filtroEstado === e && styles.filterBtnTextActive]}>
                                {ESTADO_LABELS[e]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.subText }]}>Prioridad:</Text>
                <View style={styles.filterButtons}>
                    <TouchableOpacity
                        style={[styles.filterBtn, !filtroPrioridad && styles.filterBtnActive]}
                        onPress={() => setFiltroPrioridad('')}
                    >
                        <Text style={[styles.filterBtnText, !filtroPrioridad && styles.filterBtnTextActive]}>Todas</Text>
                    </TouchableOpacity>
                    {PRIORIDADES.map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.filterBtn, filtroPrioridad === p && styles.filterBtnActive]}
                            onPress={() => setFiltroPrioridad(filtroPrioridad === p ? '' : p)}
                        >
                            <Text style={[styles.filterBtnText, filtroPrioridad === p && styles.filterBtnTextActive]}>
                                {p}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            <View style={[styles.filterGroup, { flex: 1 }]}>
                <TextInput
                    style={[styles.searchInput, { color: colors.text, borderColor: isDarkMode ? '#475569' : '#CBD5E0', backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}
                    placeholder="Buscar tickets..."
                    placeholderTextColor={colors.subText}
                    value={buscar}
                    onChangeText={setBuscar}
                />
            </View>
        </View>
    );

    const renderTicketRow = (ticket: Ticket) => (
        <TouchableOpacity
            key={ticket.id}
            style={[styles.ticketRow, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
            onPress={() => openDetail(ticket)}
        >
            <View style={styles.ticketRowLeft}>
                <Text style={[styles.ticketId, { color: colors.subText }]}>#{ticket.id}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.ticketTitulo, { color: colors.text }]} numberOfLines={1}>{ticket.titulo}</Text>
                    <Text style={[styles.ticketMeta, { color: colors.subText }]}>
                        {ticket.moduloAfectado || 'Sin módulo'} · {ticket.reportadoPor} · {formatDate(ticket.fechaCreacion)}
                    </Text>
                </View>
            </View>
            <View style={styles.ticketRowRight}>
                {renderBadge(ticket.prioridad, PRIORIDAD_COLORS)}
                {renderBadge(ticket.estado, ESTADO_COLORS)}
            </View>
        </TouchableOpacity>
    );

    const renderCreateModal = () => (
        <Modal visible={showCreateModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {isEditing ? 'Editar Ticket' : 'Nuevo Ticket'}
                        </Text>
                        <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                            <Text style={{ fontSize: 24, color: colors.subText }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                        {/* Titulo */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Título del Ticket *</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: isDarkMode ? '#475569' : '#CBD5E0', backgroundColor: isDarkMode ? '#1E293B' : '#F7FAFC' }]}
                            placeholder="Ej: Error al guardar datos en módulo X"
                            placeholderTextColor={colors.subText}
                            value={formTitulo}
                            onChangeText={setFormTitulo}
                        />

                        {/* Descripcion */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Descripción del Error *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { color: colors.text, borderColor: isDarkMode ? '#475569' : '#CBD5E0', backgroundColor: isDarkMode ? '#1E293B' : '#F7FAFC' }]}
                            placeholder="Describa el error detalladamente..."
                            placeholderTextColor={colors.subText}
                            value={formDescripcion}
                            onChangeText={setFormDescripcion}
                            multiline
                            numberOfLines={4}
                        />

                        {/* Pasos para reproducir */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Pasos para Reproducir</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { color: colors.text, borderColor: isDarkMode ? '#475569' : '#CBD5E0', backgroundColor: isDarkMode ? '#1E293B' : '#F7FAFC' }]}
                            placeholder="1. Ir a...\n2. Hacer clic en...\n3. El error aparece..."
                            placeholderTextColor={colors.subText}
                            value={formPasos}
                            onChangeText={setFormPasos}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Prioridad */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Prioridad</Text>
                        <View style={styles.selectorRow}>
                            {PRIORIDADES.map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.selectorBtn,
                                        {
                                            backgroundColor: formPrioridad === p ? PRIORIDAD_COLORS[p].bg : (isDarkMode ? '#1E293B' : '#F7FAFC'),
                                            borderColor: formPrioridad === p ? PRIORIDAD_COLORS[p].text : (isDarkMode ? '#475569' : '#CBD5E0'),
                                        }
                                    ]}
                                    onPress={() => setFormPrioridad(p)}
                                >
                                    <Text style={[styles.selectorBtnText, { color: formPrioridad === p ? PRIORIDAD_COLORS[p].text : colors.subText }]}>
                                        {p === 'Alta' ? '🔴' : p === 'Media' ? '🟡' : '🟢'} {p}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Módulo Afectado */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Módulo Afectado</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modulosScroll}>
                            <View style={styles.selectorRow}>
                                {MODULOS.map(m => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[
                                            styles.selectorBtn,
                                            {
                                                backgroundColor: formModulo === m ? '#E3F2FD' : (isDarkMode ? '#1E293B' : '#F7FAFC'),
                                                borderColor: formModulo === m ? '#1565C0' : (isDarkMode ? '#475569' : '#CBD5E0'),
                                            }
                                        ]}
                                        onPress={() => setFormModulo(formModulo === m ? '' : m)}
                                    >
                                        <Text style={[styles.selectorBtnText, { color: formModulo === m ? '#1565C0' : colors.subText }]}>
                                            {m}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Capturas de pantalla */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Capturas de Pantalla</Text>
                        <View style={styles.imageGallery}>
                            {formImagenes.map((url, i) => (
                                <View key={i} style={styles.imageContainer}>
                                    <Image
                                        source={{ uri: `${API_BASE.replace('/api', '')}${url}` }}
                                        style={styles.imageThumb}
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        style={styles.removeImageBtn}
                                        onPress={() => setFormImagenes(prev => prev.filter((_, idx) => idx !== i))}
                                    >
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                style={[styles.addImageBtn, { borderColor: isDarkMode ? '#475569' : '#CBD5E0' }]}
                                onPress={handlePickImage}
                            >
                                <Text style={{ fontSize: 28, color: colors.subText }}>📷</Text>
                                <Text style={{ fontSize: 11, color: colors.subText, marginTop: 4 }}>Agregar</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Comentarios */}
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>Comentarios / Notas</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { color: colors.text, borderColor: isDarkMode ? '#475569' : '#CBD5E0', backgroundColor: isDarkMode ? '#1E293B' : '#F7FAFC' }]}
                            placeholder="Notas adicionales..."
                            placeholderTextColor={colors.subText}
                            value={formComentarios}
                            onChangeText={setFormComentarios}
                            multiline
                            numberOfLines={2}
                        />

                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.cancelBtn, { borderColor: isDarkMode ? '#475569' : '#CBD5E0' }]}
                            onPress={() => { setShowCreateModal(false); resetForm(); }}
                        >
                            <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>
                                    {isEditing ? 'Actualizar' : 'Crear Ticket'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderDetailModal = () => {
        if (!selectedTicket) return null;
        const t = selectedTicket;
        return (
            <Modal visible={showDetailModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Ticket #{t.id}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Text style={{ fontSize: 24, color: colors.subText }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                            {/* Title + badges */}
                            <Text style={[styles.detailTitle, { color: colors.text }]}>{t.titulo}</Text>
                            <View style={styles.badgeRow}>
                                {renderBadge(t.prioridad, PRIORIDAD_COLORS)}
                                {renderBadge(t.estado, ESTADO_COLORS)}
                                {t.moduloAfectado && (
                                    <View style={[styles.badge, { backgroundColor: isDarkMode ? '#1E293B' : '#EDF2F7' }]}>
                                        <Text style={[styles.badgeText, { color: colors.subText }]}>{t.moduloAfectado}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Info */}
                            <View style={[styles.detailSection, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Descripción</Text>
                                <Text style={[styles.detailText, { color: colors.subText }]}>{t.descripcion}</Text>
                            </View>

                            {t.pasosReproducir && (
                                <View style={[styles.detailSection, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Pasos para Reproducir</Text>
                                    <Text style={[styles.detailText, { color: colors.subText }]}>{t.pasosReproducir}</Text>
                                </View>
                            )}

                            {t.comentarios && (
                                <View style={[styles.detailSection, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Comentarios / Notas</Text>
                                    <Text style={[styles.detailText, { color: colors.subText }]}>{t.comentarios}</Text>
                                </View>
                            )}

                            {/* Metadata */}
                            <View style={[styles.detailSection, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                                <View style={styles.metaRow}>
                                    <Text style={[styles.metaLabel, { color: colors.subText }]}>Reportado por:</Text>
                                    <Text style={[styles.metaValue, { color: colors.text }]}>{t.reportadoPor}</Text>
                                </View>
                                <View style={styles.metaRow}>
                                    <Text style={[styles.metaLabel, { color: colors.subText }]}>Fecha creación:</Text>
                                    <Text style={[styles.metaValue, { color: colors.text }]}>{formatDate(t.fechaCreacion)}</Text>
                                </View>
                                {t.fechaResolucion && (
                                    <View style={styles.metaRow}>
                                        <Text style={[styles.metaLabel, { color: colors.subText }]}>Fecha resolución:</Text>
                                        <Text style={[styles.metaValue, { color: '#2E7D32' }]}>{formatDate(t.fechaResolucion)}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Imagenes */}
                            {t.imagenes && t.imagenes.length > 0 && (
                                <View style={[styles.detailSection, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Capturas de Pantalla</Text>
                                    <View style={styles.imageGallery}>
                                        {t.imagenes.map((img, i) => (
                                            <Image
                                                key={i}
                                                source={{ uri: `${API_BASE.replace('/api', '')}${img.imagenUrl}` }}
                                                style={styles.detailImage}
                                                resizeMode="contain"
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        {/* Actions */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.deleteBtn]}
                                onPress={() => handleDelete(t)}
                            >
                                <Text style={styles.deleteBtnText}>🗑️ Eliminar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editBtn]}
                                onPress={() => openEdit(t)}
                            >
                                <Text style={styles.editBtnText}>✏️ Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.cancelBtn, { borderColor: isDarkMode ? '#475569' : '#CBD5E0' }]}
                                onPress={() => setShowDetailModal(false)}
                            >
                                <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: isDarkMode ? colors.background : '#F0F4F8' }]}>
            {/* Header area */}
            <View style={[styles.screenHeader, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.screenTitle, { color: colors.text }]}>🎫 Tickets de Errores</Text>
                    <Text style={[styles.screenSubtitle, { color: colors.subText }]}>
                        Reporta y da seguimiento a errores del sistema
                    </Text>
                </View>
                <TouchableOpacity style={styles.newTicketBtn} onPress={openCreate}>
                    <Text style={styles.newTicketBtnText}>+ Nuevo Ticket</Text>
                </TouchableOpacity>
            </View>

            {/* Stats */}
            {renderStatsCards()}

            {/* Filters */}
            {renderFilters()}

            {/* Tickets list */}
            {loading ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.subText }]}>Cargando tickets...</Text>
                </View>
            ) : tickets.length === 0 ? (
                <View style={styles.centerView}>
                    <Text style={{ fontSize: 48, marginBottom: 12 }}>🎫</Text>
                    <Text style={[styles.emptyText, { color: colors.subText }]}>
                        No hay tickets {filtroEstado || filtroPrioridad ? 'con estos filtros' : 'registrados'}
                    </Text>
                    <TouchableOpacity style={styles.newTicketBtn} onPress={openCreate}>
                        <Text style={styles.newTicketBtnText}>Crear Primer Ticket</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView style={styles.ticketsList} showsVerticalScrollIndicator={false}>
                    {tickets.map(renderTicketRow)}
                    <View style={{ height: 20 }} />
                </ScrollView>
            )}

            {renderCreateModal()}
            {renderDetailModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    screenHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    screenTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    screenSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    newTicketBtn: {
        backgroundColor: '#3182CE',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    newTicketBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    filtersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        gap: 16,
        flexWrap: 'wrap',
    },
    filterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    filterButtons: {
        flexDirection: 'row',
        gap: 4,
    },
    filterBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#EDF2F7',
    },
    filterBtnActive: {
        backgroundColor: '#3182CE',
    },
    filterBtnText: {
        fontSize: 11,
        color: '#4A5568',
        fontWeight: '500',
    },
    filterBtnTextActive: {
        color: '#FFFFFF',
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        fontSize: 13,
        minWidth: 180,
    },
    ticketsList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    ticketRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
    },
    ticketRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    ticketId: {
        fontSize: 12,
        fontWeight: '600',
        minWidth: 36,
    },
    ticketTitulo: {
        fontSize: 14,
        fontWeight: '600',
    },
    ticketMeta: {
        fontSize: 11,
        marginTop: 2,
    },
    ticketRowRight: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    centerView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    emptyText: {
        fontSize: 15,
        marginBottom: 16,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 700,
        maxHeight: '90%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    formScroll: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    selectorRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    selectorBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    selectorBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    modulosScroll: {
        maxHeight: 50,
    },
    imageGallery: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 8,
    },
    imageContainer: {
        position: 'relative',
    },
    imageThumb: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
    },
    removeImageBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#E53E3E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addImageBtn: {
        width: 80,
        height: 80,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    cancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    cancelBtnText: {
        fontWeight: '600',
        fontSize: 14,
    },
    submitBtn: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#3182CE',
    },
    submitBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    editBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#EDF2F7',
    },
    editBtnText: {
        fontWeight: '600',
        fontSize: 14,
        color: '#2D3748',
    },
    deleteBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#FED7D7',
    },
    deleteBtnText: {
        fontWeight: '600',
        fontSize: 14,
        color: '#C53030',
    },
    // Detail modal
    detailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    detailSection: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    detailText: {
        fontSize: 14,
        lineHeight: 21,
    },
    detailImage: {
        width: 200,
        height: 150,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    metaLabel: {
        fontSize: 13,
    },
    metaValue: {
        fontSize: 13,
        fontWeight: '600',
    },
});
