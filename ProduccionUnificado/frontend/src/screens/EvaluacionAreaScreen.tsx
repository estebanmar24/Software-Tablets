import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../services/productionApi';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ===========================================================================
 * Helpers de UI
 * ===========================================================================*/

/**
 * Select que en web usa <select> nativo con estilos del tema (el Picker de Expo
 * renderiza las opciones en blanco/blanco sobre dark mode y no se leen).
 */
function ThemedSelect({
    value,
    onChange,
    options,
    isDarkMode,
}: {
    value: string | number;
    onChange: (v: string) => void;
    options: { label: string; value: string | number }[];
    isDarkMode: boolean;
}) {
    if (Platform.OS === 'web') {
        const bg = isDarkMode ? '#0b1220' : '#ffffff';
        const fg = isDarkMode ? '#e2e8f0' : '#1a202c';
        const border = isDarkMode ? '#374151' : '#cbd5e0';
        return (
            // @ts-ignore - select HTML nativo bien soportado en RN Web
            <select
                value={String(value)}
                onChange={(e: any) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 10,
                    paddingRight: 10,
                    borderRadius: 8,
                    border: `1px solid ${border}`,
                    backgroundColor: bg,
                    color: fg,
                    fontSize: 14,
                    outline: 'none',
                    appearance: 'auto',
                    cursor: 'pointer',
                } as any}
            >
                {options.map(o => (
                    // @ts-ignore
                    <option key={String(o.value)} value={String(o.value)} style={{ backgroundColor: bg, color: fg }}>
                        {o.label}
                    </option>
                ))}
            </select>
        );
    }
    return (
        <Picker
            selectedValue={value as any}
            onValueChange={v => onChange(String(v))}
            style={{ color: isDarkMode ? '#fff' : '#000', height: 44 }}
            dropdownIconColor={isDarkMode ? '#fff' : '#000'}
        >
            {options.map(o => (
                <Picker.Item
                    key={String(o.value)}
                    label={o.label}
                    value={o.value}
                    color={isDarkMode ? '#fff' : '#000'}
                />
            ))}
        </Picker>
    );
}

/* ===========================================================================
 * Tipos
 * ===========================================================================*/

interface Actividad {
    id: number;
    area: string;
    titulo: string;
    descripcion?: string | null;
    estado: 'pendiente' | 'cumplida' | 'no_cumplida';
    razonNoCumplimiento?: string | null;
    anio: number;
    mes: number;
    creadoPorId?: number | null;
    creadoPorNombre?: string | null;
    fechaCreacion: string;
    fechaModificacion?: string | null;
    fechaCumplimiento?: string | null;
}

interface ResumenArea {
    area: string;
    total: number;
    cumplidas: number;
    noCumplidas: number;
    pendientes: number;
    porcentajeCumplimiento: number;
    noCumplidasDetalle: Actividad[];
}

interface Responsable {
    id?: number;
    checklistId?: number;
    usuarioId?: number | null;
    usuarioNombre?: string | null;
    usuarioEmail?: string | null;
    notificadoEn?: string | null;
}

interface ChecklistItem {
    id: number;
    tipo: string;
    numeroActividad?: number | null;
    titulo: string;
    descripcion?: string | null;
    estado: 'pendiente' | 'completada' | 'no_completada';
    razonNoCompletada?: string | null;
    anio: number;
    mes: number;
    creadoPorId?: number | null;
    creadoPorNombre?: string | null;
    fechaCreacion: string;
    fechaModificacion?: string | null;
    fechaCierre?: string | null;
    cerradaPorNombre?: string | null;
    responsables: Responsable[];
}

interface ResumenChecklist {
    tipo: string;
    total: number;
    completadas: number;
    noCompletadas: number;
    pendientes: number;
    porcentajeCumplimiento: number;
    items: ChecklistItem[];
}

interface UsuarioOption {
    id: number;
    nombreMostrar: string;
    email: string;
    username: string;
    area?: string | null;
}

interface AuditTipo {
    id: number;
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    anio: number;
    creadoPorNombre?: string | null;
    fechaCreacion: string;
}

interface Props {
    userRole?: string;
    userArea?: string;
    displayName?: string;
}

const AREAS_DEFAULT = [
    'Gerencia', 'SST', 'Planeacion', 'Gestion Humana', 'Talleres y Despachos',
    'Calidad', 'Produccion', 'Almacen', 'Diseño', 'Contabilidad', 'Redes', 'Maquinas',
];

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ROL_A_AREA: Record<string, string> = {
    'sst': 'SST',
    'gh': 'Gestion Humana',
    'gestion-humana': 'Gestion Humana',
    'gestion_humana': 'Gestion Humana',
    'gestion humana': 'Gestion Humana',
    'produccion': 'Produccion',
    'talleres': 'Talleres y Despachos',
    'calidad': 'Calidad',
    'modulo_calidad': 'Calidad',
    'diseno': 'Diseño',
    'diseño': 'Diseño',
    'planeacion': 'Planeacion',
    'planeador': 'Planeacion',
    'contabilidad': 'Contabilidad',
    'maquinas': 'Maquinas',
    'equipos': 'Maquinas',
    'almacen': 'Almacen',
    'redes': 'Redes',
    'gerencia': 'Gerencia',
};

function normalizarClaveRol(rol: string): string {
    return rol.toLowerCase().trim().replace(/_/g, '-');
}

function normalizarAreaNombre(raw: string): string | null {
    const t = raw.trim();
    if (!t) return null;
    return AREAS_DEFAULT.find(a => a.toLowerCase() === t.toLowerCase()) || null;
}

function resolverAreaDesdeRol(rol: string): string | null {
    const key = normalizarClaveRol(rol);
    return ROL_A_AREA[key] || null;
}

function parseRoles(userRole?: string): string[] {
    return (userRole || '').toLowerCase().split(',').map(r => r.trim()).filter(Boolean);
}

/** Solo el rol `admin` tiene vista global en Evaluación de Actividades. */
function esAdminEvaluacion(userRole?: string): boolean {
    const roles = parseRoles(userRole);
    return roles.includes('admin');
}

function resolverAreasUsuario(userRole?: string, userArea?: string, esAdmin = false): string[] {
    if (esAdmin) return [...AREAS_DEFAULT];

    const fromArea = (userArea || '')
        .split(',')
        .map(normalizarAreaNombre)
        .filter((a): a is string => !!a);

    // Si el usuario tiene área(s) asignada(s) en su perfil, usamos solo eso
    // (evita que roles extra como master/produccion abran más procesos).
    if (fromArea.length > 0) return fromArea;

    const roles = parseRoles(userRole);
    const fromRoles = roles.map(resolverAreaDesdeRol).filter((a): a is string => !!a);
    return Array.from(new Set(fromRoles));
}

type TabKey = 'AREA' | 'CTPAT' | 'ILS' | string;

const TAB_FIJOS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'AREA', label: 'Evaluación por Área', icon: 'office-building' },
    { key: 'CTPAT', label: 'Check CT-PAT', icon: 'shield-check' },
    { key: 'ILS', label: 'Check ILS', icon: 'clipboard-list-outline' },
];

/* ===========================================================================
 * Component principal: contenedor con tabs
 * ===========================================================================*/

export default function EvaluacionAreaScreen({ userRole, userArea, displayName }: Props) {
    const { colors, isDarkMode } = useTheme();

    const esAdmin = useMemo(() => esAdminEvaluacion(userRole), [userRole]);

    const areasUsuario = useMemo(
        () => resolverAreasUsuario(userRole, userArea, esAdmin),
        [esAdmin, userRole, userArea]
    );

    const hoy = new Date();
    const [tab, setTab] = useState<TabKey>('AREA');
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [userId, setUserId] = useState<number | null>(null);
    const [customTipos, setCustomTipos] = useState<AuditTipo[]>([]);
    const [modalNuevaAuditoria, setModalNuevaAuditoria] = useState({
        visible: false,
        nombre: '',
        descripcion: '',
        saving: false,
    });

    const s = makeStyles(isDarkMode, colors);

    useEffect(() => {
        (async () => {
            try {
                let raw: string | null = null;
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                    raw = window.localStorage.getItem('adminId');
                } else {
                    raw = await AsyncStorage.getItem('adminId');
                }
                const id = raw ? parseInt(raw, 10) : NaN;
                setUserId(Number.isFinite(id) ? id : null);
            } catch {
                setUserId(null);
            }
        })();
    }, []);

    const cargarTiposAuditoria = useCallback(async () => {
        try {
            const r = await api.get('AuditChecklist/tipos', { params: { anio } });
            setCustomTipos(r.data || []);
        } catch (e: any) {
            console.error('[EvaluacionArea] Error cargando tipos de auditoría:', e?.message);
        }
    }, [anio]);

    useEffect(() => { cargarTiposAuditoria(); }, [cargarTiposAuditoria]);

    useEffect(() => {
        if (/^C\d+$/i.test(tab) && !customTipos.some(t => t.codigo === tab)) {
            setTab('AREA');
        }
    }, [customTipos, tab]);

    const checklistActivo = useMemo(() => {
        if (tab === 'CTPAT') return { tipo: 'CTPAT', titulo: 'Check CT-PAT', descripcion: 'Checklist anual de auditoría CT-PAT' };
        if (tab === 'ILS') return { tipo: 'ILS', titulo: 'Check ILS', descripcion: 'Checklist anual de auditoría ILS' };
        const custom = customTipos.find(t => t.codigo === tab);
        if (custom) return { tipo: custom.codigo, titulo: custom.nombre, descripcion: custom.descripcion || '' };
        return null;
    }, [tab, customTipos]);

    const guardarNuevaAuditoria = async () => {
        if (!modalNuevaAuditoria.nombre.trim()) {
            Alert.alert('Validación', 'El nombre es obligatorio');
            return;
        }
        setModalNuevaAuditoria(prev => ({ ...prev, saving: true }));
        try {
            const r = await api.post('AuditChecklist/tipos', {
                nombre: modalNuevaAuditoria.nombre.trim(),
                descripcion: modalNuevaAuditoria.descripcion.trim() || null,
                anio,
                creadoPorNombre: displayName || null,
            });
            const creado: AuditTipo = r.data;
            await cargarTiposAuditoria();
            setModalNuevaAuditoria({ visible: false, nombre: '', descripcion: '', saving: false });
            if (creado?.codigo) setTab(creado.codigo);
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo crear la auditoría');
            setModalNuevaAuditoria(prev => ({ ...prev, saving: false }));
        }
    };

    // Si el usuario no tiene áreas asignadas y no es admin, mostramos aviso
    // (solo aplica al tab "Área"; en CT-PAT / ILS sí puede entrar).
    const sinAreaAsignada = !esAdmin && areasUsuario.length === 0;

    return (
        <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {/* Encabezado y filtros globales */}
            <View style={s.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={s.title}>Evaluación de Actividades</Text>
                    <Text style={s.subtitle}>
                        Evaluación de porcentaje de cumplimiento de actividades
                        {esAdmin
                            ? ' · Vista de administrador'
                            : areasUsuario.length > 0
                                ? ` · ${areasUsuario.join(', ')}`
                                : ''}
                    </Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={s.tabsRow}>
                {TAB_FIJOS.map(opt => {
                    const active = tab === opt.key;
                    return (
                        <TouchableOpacity
                            key={opt.key}
                            style={[s.tabBtn, active && s.tabBtnActive]}
                            onPress={() => setTab(opt.key)}
                        >
                            <MaterialCommunityIcons
                                name={opt.icon as any}
                                size={16}
                                color={active ? '#fff' : (isDarkMode ? '#a0aec0' : '#4a5568')}
                            />
                            <Text style={[s.tabBtnText, active && s.tabBtnTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
                {customTipos.map(t => {
                    const active = tab === t.codigo;
                    return (
                        <TouchableOpacity
                            key={t.codigo}
                            style={[s.tabBtn, active && s.tabBtnActive]}
                            onPress={() => setTab(t.codigo)}
                        >
                            <MaterialCommunityIcons
                                name="clipboard-check-outline"
                                size={16}
                                color={active ? '#fff' : (isDarkMode ? '#a0aec0' : '#4a5568')}
                            />
                            <Text style={[s.tabBtnText, active && s.tabBtnTextActive]} numberOfLines={1}>
                                {t.nombre}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                {esAdmin && (
                    <TouchableOpacity
                        style={s.tabBtnAdd}
                        onPress={() => setModalNuevaAuditoria({ visible: true, nombre: '', descripcion: '', saving: false })}
                    >
                        <MaterialCommunityIcons name="plus" size={18} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                        <Text style={s.tabBtnAddText}>Nueva auditoría</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Filtros: año siempre; mes solo en "Evaluación por Área". */}
            <View style={s.filtersCard}>
                <View style={s.filterItem}>
                    <Text style={s.filterLabel}>Año</Text>
                    <ThemedSelect
                        value={anio}
                        onChange={v => setAnio(Number(v))}
                        isDarkMode={isDarkMode}
                        options={[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(y => ({
                            label: String(y),
                            value: y,
                        }))}
                    />
                </View>
                {tab === 'AREA' && (
                    <View style={s.filterItem}>
                        <Text style={s.filterLabel}>Mes</Text>
                        <ThemedSelect
                            value={mes}
                            onChange={v => setMes(Number(v))}
                            isDarkMode={isDarkMode}
                            options={MESES.map((nombre, i) => ({ label: nombre, value: i + 1 }))}
                        />
                    </View>
                )}
                {tab !== 'AREA' && (
                    <View style={[s.filterItem, { justifyContent: 'flex-end' }]}>
                        <Text style={[s.filterLabel, { fontStyle: 'italic' }]}>
                            Check list anual general (no se filtra por mes)
                        </Text>
                    </View>
                )}
            </View>

            {/* Modal: crear pestaña de auditoría personalizada */}
            <Modal
                visible={modalNuevaAuditoria.visible}
                animationType="fade"
                transparent
                onRequestClose={() => !modalNuevaAuditoria.saving && setModalNuevaAuditoria({ visible: false, nombre: '', descripcion: '', saving: false })}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>Nueva auditoría</Text>
                        <Text style={s.subtitleSmall}>
                            Se creará una pestaña nueva junto a CT-PAT e ILS para el año {anio}.
                        </Text>
                        <Text style={s.fieldLabel}>Nombre *</Text>
                        <TextInput
                            style={s.input}
                            value={modalNuevaAuditoria.nombre}
                            onChangeText={t => setModalNuevaAuditoria(prev => ({ ...prev, nombre: t }))}
                            placeholder="Ej: Auditoría ISO 9001"
                            placeholderTextColor={colors.subText}
                        />
                        <Text style={s.fieldLabel}>Descripción</Text>
                        <TextInput
                            style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                            value={modalNuevaAuditoria.descripcion}
                            onChangeText={t => setModalNuevaAuditoria(prev => ({ ...prev, descripcion: t }))}
                            placeholder="Detalle opcional de la auditoría"
                            placeholderTextColor={colors.subText}
                            multiline
                        />
                        <View style={s.modalActions}>
                            <TouchableOpacity
                                style={[s.secondaryBtn, { marginRight: 10 }]}
                                disabled={modalNuevaAuditoria.saving}
                                onPress={() => setModalNuevaAuditoria({ visible: false, nombre: '', descripcion: '', saving: false })}
                            >
                                <Text style={s.secondaryBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.primaryBtn, modalNuevaAuditoria.saving && { opacity: 0.7 }]}
                                disabled={modalNuevaAuditoria.saving}
                                onPress={guardarNuevaAuditoria}
                            >
                                {modalNuevaAuditoria.saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={s.primaryBtnText}>Crear auditoría</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {tab === 'AREA' && (
                sinAreaAsignada ? (
                    <View style={[s.emptyBox]}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.subText} />
                        <Text style={[s.emptyTitle, { marginTop: 12 }]}>Sin área asignada</Text>
                        <Text style={s.emptyDesc}>
                            Tu usuario no tiene un área asignada para registrar actividades.
                            Solicita al administrador que te asigne un área.
                        </Text>
                    </View>
                ) : (
                    <EvaluacionAreaTab
                        anio={anio}
                        mes={mes}
                        esAdmin={esAdmin}
                        areasUsuario={areasUsuario}
                        displayName={displayName}
                        isDarkMode={isDarkMode}
                        colors={colors}
                        s={s}
                    />
                )
            )}

            {checklistActivo && (
                <ChecklistTab
                    tipo={checklistActivo.tipo}
                    titulo={checklistActivo.titulo}
                    descripcion={checklistActivo.descripcion}
                    anio={anio}
                    userRole={userRole}
                    userId={userId}
                    displayName={displayName}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    s={s}
                />
            )}
        </ScrollView>
    );
}

/* ===========================================================================
 * Tab 1: Evaluación por Área (cuadros por proceso → actividades del proceso)
 * ===========================================================================*/

function EvaluacionAreaTab({
    anio, mes, esAdmin, areasUsuario, displayName, isDarkMode, colors, s,
}: any) {
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [resumen, setResumen] = useState<ResumenArea[]>([]);
    const [loading, setLoading] = useState(false);
    // Si el usuario es no-admin con 1 sola área, entramos directo a esa área.
    const areaInicial = !esAdmin && areasUsuario.length === 1 ? areasUsuario[0] : '';
    const [areaSeleccionada, setAreaSeleccionada] = useState<string>(areaInicial);

    useEffect(() => {
        if (!esAdmin && areasUsuario.length === 1) {
            setAreaSeleccionada(areasUsuario[0]);
        } else if (!esAdmin && areasUsuario.length > 0 && areaSeleccionada && !areasUsuario.includes(areaSeleccionada)) {
            setAreaSeleccionada(areasUsuario.length === 1 ? areasUsuario[0] : '');
        }
    }, [esAdmin, areasUsuario, areaSeleccionada]);

    const [modalForm, setModalForm] = useState<{
        visible: boolean;
        editingId?: number;
        titulo: string;
        descripcion: string;
        area: string;
    }>({ visible: false, titulo: '', descripcion: '', area: '' });

    const [modalNoCumplida, setModalNoCumplida] = useState<{
        visible: boolean;
        id?: number;
        razon: string;
    }>({ visible: false, razon: '' });

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const areasPermitidas = !esAdmin && areasUsuario.length > 0 ? new Set<string>(areasUsuario) : null;
            const areaConsulta = esAdmin
                ? (areaSeleccionada || undefined)
                : (areaSeleccionada || (areasUsuario.length === 1 ? areasUsuario[0] : undefined));

            const actParams: Record<string, unknown> = { anio, mes };
            if (areaConsulta) actParams.area = areaConsulta;

            const [actRes, resRes] = await Promise.all([
                api.get('EvaluacionArea/actividades', {
                    params: esAdmin && !areaSeleccionada ? { anio, mes } : actParams,
                }),
                api.get('EvaluacionArea/resumen', { params: { anio, mes } }),
            ]);

            let acts: Actividad[] = actRes.data || [];
            let res: ResumenArea[] = resRes.data || [];

            if (areasPermitidas) {
                acts = acts.filter(a => areasPermitidas.has(a.area));
                res = res.filter(r => areasPermitidas.has(r.area));
            }

            setActividades(acts);
            setResumen(res);
        } catch (e: any) {
            console.error('[EvaluacionArea] Error cargando:', e?.message);
            Alert.alert('Error', 'No se pudieron cargar las actividades');
        } finally {
            setLoading(false);
        }
    }, [anio, mes, areaSeleccionada, esAdmin, areasUsuario]);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirNuevo = (areaPrefill?: string) => {
        if (!esAdmin) return; // sólo admin crea
        const areaDefault = areaPrefill || areaSeleccionada || areasUsuario[0] || '';
        setModalForm({ visible: true, editingId: undefined, titulo: '', descripcion: '', area: areaDefault });
    };

    const abrirEditar = (act: Actividad) => {
        setModalForm({
            visible: true,
            editingId: act.id,
            titulo: act.titulo,
            descripcion: act.descripcion || '',
            area: act.area,
        });
    };

    const guardarActividad = async () => {
        if (!modalForm.titulo.trim()) { Alert.alert('Validación', 'El título es obligatorio'); return; }
        if (!modalForm.area) { Alert.alert('Validación', 'Debe seleccionar un área'); return; }
        try {
            const payload = {
                area: modalForm.area,
                titulo: modalForm.titulo.trim(),
                descripcion: modalForm.descripcion.trim() || null,
                anio, mes,
                creadoPorNombre: displayName || null,
            };
            if (modalForm.editingId) {
                await api.put(`EvaluacionArea/actividades/${modalForm.editingId}`, payload);
            } else {
                await api.post('EvaluacionArea/actividades', payload);
            }
            setModalForm({ visible: false, titulo: '', descripcion: '', area: '' });
            await cargar();
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
        }
    };

    const eliminar = (act: Actividad) => {
        const confirmar = async () => {
            try { await api.delete(`EvaluacionArea/actividades/${act.id}`); await cargar(); }
            catch { Alert.alert('Error', 'No se pudo eliminar'); }
        };
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Eliminar la actividad "${act.titulo}"?`)) confirmar();
        } else {
            Alert.alert('Eliminar', `¿Eliminar la actividad "${act.titulo}"?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: confirmar },
            ]);
        }
    };

    const marcarCumplida = async (act: Actividad) => {
        try {
            await api.put(`EvaluacionArea/actividades/${act.id}/estado`, { estado: 'cumplida', razonNoCumplimiento: null });
            await cargar();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar');
        }
    };

    const abrirNoCumplida = (act: Actividad) => {
        setModalNoCumplida({ visible: true, id: act.id, razon: act.razonNoCumplimiento || '' });
    };

    const guardarNoCumplida = async () => {
        if (!modalNoCumplida.razon.trim()) { Alert.alert('Validación', 'Debe ingresar la razón por la que no se cumplió'); return; }
        try {
            await api.put(`EvaluacionArea/actividades/${modalNoCumplida.id}/estado`, {
                estado: 'no_cumplida', razonNoCumplimiento: modalNoCumplida.razon.trim(),
            });
            setModalNoCumplida({ visible: false, razon: '' });
            await cargar();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar');
        }
    };

    const reabrir = async (act: Actividad) => {
        try {
            await api.put(`EvaluacionArea/actividades/${act.id}/estado`, { estado: 'pendiente', razonNoCumplimiento: null });
            await cargar();
        } catch { Alert.alert('Error', 'No se pudo actualizar'); }
    };

    const abrirReporte = async () => {
        try {
            const res = await api.get('EvaluacionArea/resumen', { params: { anio, mes } });
            const resumenData: ResumenArea[] = res.data || [];
            const mesNombre = MESES[mes - 1] || '';
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 40;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Reporte de Evaluación por Área', margin, 50);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(74, 85, 104);
            doc.text(`Período: ${mesNombre} ${anio}`, margin, 68);
            doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth - margin, 68, { align: 'right' });
            doc.setTextColor(0, 0, 0);

            if (resumenData.length === 0) {
                doc.setFontSize(11);
                doc.text('No hay actividades registradas en este período.', margin, 100);
            } else {
                autoTable(doc, {
                    startY: 90,
                    head: [['Área', 'Cumplidas', 'Total', '% Cumplimiento', 'Detalle']],
                    body: resumenData.map(r => [
                        r.area, String(r.cumplidas), String(r.total),
                        `${r.porcentajeCumplimiento.toFixed(1)}%`,
                        `${r.cumplidas}/${r.total} cumplidas · ${r.noCumplidas} no cumplidas · ${r.pendientes} pendientes`,
                    ]),
                    headStyles: { fillColor: [49, 130, 206], textColor: 255, fontStyle: 'bold' },
                    styles: { fontSize: 9, cellPadding: 5 },
                    columnStyles: {
                        0: { cellWidth: 110, fontStyle: 'bold' },
                        1: { cellWidth: 60, halign: 'center' },
                        2: { cellWidth: 50, halign: 'center' },
                        3: { cellWidth: 80, halign: 'center', fontStyle: 'bold' },
                        4: { cellWidth: 'auto' },
                    },
                    didParseCell: (data: any) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            const pct = resumenData[data.row.index]?.porcentajeCumplimiento ?? 0;
                            if (pct >= 80) data.cell.styles.textColor = [47, 133, 90];
                            else if (pct >= 50) data.cell.styles.textColor = [183, 121, 31];
                            else data.cell.styles.textColor = [197, 48, 48];
                        }
                    },
                });

                const conNoCumplidas = resumenData.filter(r => (r.noCumplidasDetalle || []).length > 0);
                let cursorY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 30 : 200;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(43, 108, 176);
                doc.text('Detalle de actividades no cumplidas', margin, cursorY);
                doc.setTextColor(0, 0, 0);
                cursorY += 10;

                if (conNoCumplidas.length === 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(10);
                    doc.setTextColor(74, 85, 104);
                    doc.text('Todas las áreas con actividades cumplieron o tienen pendientes (sin incumplimientos).', margin, cursorY + 14);
                    doc.setTextColor(0, 0, 0);
                } else {
                    for (const r of conNoCumplidas) {
                        if (cursorY > 720) { doc.addPage(); cursorY = 50; }
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(11);
                        doc.setTextColor(43, 108, 176);
                        doc.text(r.area, margin, cursorY + 18);
                        doc.setTextColor(0, 0, 0);

                        autoTable(doc, {
                            startY: cursorY + 24,
                            head: [['Actividad', 'Razón de incumplimiento']],
                            body: (r.noCumplidasDetalle || []).map(act => [
                                act.descripcion ? `${act.titulo}\n${act.descripcion}` : act.titulo,
                                act.razonNoCumplimiento || '(sin razón)',
                            ]),
                            headStyles: { fillColor: [197, 48, 48], textColor: 255, fontStyle: 'bold' },
                            styles: { fontSize: 9, cellPadding: 5, valign: 'top' },
                            columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: 'auto' } },
                        });
                        cursorY = (doc as any).lastAutoTable?.finalY ?? cursorY + 60;
                        cursorY += 10;
                    }
                }
            }
            doc.save(`evaluacion-area-${anio}-${String(mes).padStart(2, '0')}.pdf`);
        } catch (e: any) {
            console.error('[EvaluacionArea] Error generando PDF:', e?.message);
            Alert.alert('Error', 'No se pudo generar el reporte');
        }
    };

    /** Procesos visibles como cuadros (cuando NO hay área seleccionada). */
    const procesosVisibles = useMemo(() => {
        const lista = esAdmin ? AREAS_DEFAULT : areasUsuario;
        // Construir métricas a partir de "resumen" (admin: total; no-admin: filtrado en cliente al área).
        return lista.map((nombreArea: string) => {
            const r = resumen.find(x => x.area === nombreArea);
            const total = r?.total ?? 0;
            const cumplidas = r?.cumplidas ?? 0;
            const noCumplidas = r?.noCumplidas ?? 0;
            const pendientes = r?.pendientes ?? 0;
            const pct = total === 0 ? 0 : Math.round((cumplidas * 1000) / total) / 10;
            return { area: nombreArea, total, cumplidas, noCumplidas, pendientes, pct };
        });
    }, [esAdmin, areasUsuario, resumen]);

    const actividadesAMostrar = useMemo(() => {
        const porArea = areaSeleccionada
            ? actividades.filter(a => a.area === areaSeleccionada)
            : actividades;
        if (esAdmin) return porArea;
        const permitidas = new Set(areasUsuario);
        return porArea.filter(a => permitidas.has(a.area));
    }, [actividades, areaSeleccionada, esAdmin, areasUsuario]);

    const statsActuales = useMemo(() => {
        const list = actividadesAMostrar;
        const total = list.length;
        const cumplidas = list.filter(a => a.estado === 'cumplida').length;
        const noCumplidas = list.filter(a => a.estado === 'no_cumplida').length;
        const pendientes = list.filter(a => a.estado === 'pendiente').length;
        const pct = total === 0 ? 0 : Math.round((cumplidas * 1000) / total) / 10;
        return { total, cumplidas, noCumplidas, pendientes, pct };
    }, [actividadesAMostrar]);

    /* --- Render --- */

    const modalsActividad = (
        <>
            <Modal visible={modalForm.visible} animationType="fade" transparent onRequestClose={() => setModalForm({ ...modalForm, visible: false })}>
                <View style={s.modalBackdrop}>
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>{modalForm.editingId ? 'Editar actividad' : 'Nueva actividad'}</Text>
                        <Text style={s.fieldLabel}>Área</Text>
                        <ThemedSelect
                            value={modalForm.area}
                            onChange={v => setModalForm({ ...modalForm, area: v })}
                            isDarkMode={isDarkMode}
                            options={(esAdmin ? AREAS_DEFAULT : areasUsuario).map((a: string) => ({ label: a, value: a }))}
                        />
                        <Text style={s.fieldLabel}>Título *</Text>
                        <TextInput
                            style={s.input}
                            value={modalForm.titulo}
                            onChangeText={t => setModalForm({ ...modalForm, titulo: t })}
                            placeholder="Ej: Inspección mensual de extintores"
                            placeholderTextColor={colors.subText}
                        />
                        <Text style={s.fieldLabel}>Descripción</Text>
                        <TextInput
                            style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                            value={modalForm.descripcion}
                            onChangeText={t => setModalForm({ ...modalForm, descripcion: t })}
                            placeholder="Detalle opcional de la actividad"
                            placeholderTextColor={colors.subText}
                            multiline
                        />
                        <View style={s.modalActions}>
                            <TouchableOpacity style={[s.secondaryBtn, { marginRight: 10 }]} onPress={() => setModalForm({ ...modalForm, visible: false })}>
                                <Text style={s.secondaryBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.primaryBtn} onPress={guardarActividad}>
                                <Text style={s.primaryBtnText}>{modalForm.editingId ? 'Guardar cambios' : 'Crear actividad'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={modalNoCumplida.visible} animationType="fade" transparent onRequestClose={() => setModalNoCumplida({ visible: false, razon: '' })}>
                <View style={s.modalBackdrop}>
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>¿Por qué no se cumplió?</Text>
                        <Text style={[s.fieldLabel, { marginBottom: 6 }]}>Indica la razón (obligatoria):</Text>
                        <TextInput
                            style={[s.input, { height: 100, textAlignVertical: 'top' }]}
                            value={modalNoCumplida.razon}
                            onChangeText={t => setModalNoCumplida({ ...modalNoCumplida, razon: t })}
                            placeholder="Ej: Falta de recursos, tiempo, etc."
                            placeholderTextColor={colors.subText}
                            multiline
                        />
                        <View style={s.modalActions}>
                            <TouchableOpacity style={[s.secondaryBtn, { marginRight: 10 }]} onPress={() => setModalNoCumplida({ visible: false, razon: '' })}>
                                <Text style={s.secondaryBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#c53030' }]} onPress={guardarNoCumplida}>
                                <Text style={s.primaryBtnText}>Marcar No Cumplida</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );

    // Vista de cuadros (procesos)
    if (!areaSeleccionada) {
        return (
            <>
                <View style={s.headerSubRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Procesos</Text>
                        <Text style={s.subtitleSmall}>
                            {esAdmin
                                ? 'Selecciona un proceso para ver y administrar sus actividades del período.'
                                : 'Selecciona un proceso para ver tus actividades del período.'}
                        </Text>
                    </View>
                    {esAdmin && (
                        <TouchableOpacity style={s.reportBtn} onPress={abrirReporte}>
                            <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />
                            <Text style={s.reportBtnText}>Reporte PDF</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={s.cardsRow}>
                    {procesosVisibles.map((p: { area: string; total: number; cumplidas: number; noCumplidas: number; pendientes: number; pct: number }) => (
                        <TouchableOpacity
                            key={p.area}
                            style={s.processCard}
                            onPress={() => setAreaSeleccionada(p.area)}
                        >
                            <View style={s.processCardHeader}>
                                <MaterialCommunityIcons name="office-building" size={22} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                                <Text style={s.processName}>{p.area}</Text>
                            </View>
                            <Text style={[s.processBig, pctColor(p.pct)]}>{p.cumplidas}/{p.total}</Text>
                            <Text style={[s.processPct, pctColor(p.pct)]}>{p.pct.toFixed(1)}% cumplimiento</Text>
                            <View style={s.barBg}>
                                <View style={[s.barFill, { width: `${Math.min(100, p.pct)}%` }]} />
                            </View>
                            <Text style={s.processSmall}>
                                {p.noCumplidas} no cumplidas · {p.pendientes} pendientes
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </>
        );
    }

    // Vista detalle de actividades de un proceso
    const puedeVolverAProcesos = esAdmin || areasUsuario.length > 1;

    return (
        <>
            <View style={s.headerSubRow}>
                {puedeVolverAProcesos ? (
                    <TouchableOpacity style={s.backLink} onPress={() => setAreaSeleccionada('')}>
                        <MaterialCommunityIcons name="arrow-left" size={18} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                        <Text style={s.backLinkText}>Volver a procesos</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flex: 1 }} />
                )}
                {esAdmin && (
                    <TouchableOpacity style={s.primaryBtn} onPress={() => abrirNuevo(areaSeleccionada)}>
                        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                        <Text style={s.primaryBtnText}>Nueva actividad</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={s.miniStatsCard}>
                <View style={s.miniStatItem}>
                    <Text style={s.miniStatLabel}>Cumplimiento · {areaSeleccionada}</Text>
                    <Text style={[s.miniStatBig, pctColor(statsActuales.pct)]}>
                        {statsActuales.cumplidas}/{statsActuales.total}
                    </Text>
                    <Text style={[s.miniStatPct, pctColor(statsActuales.pct)]}>
                        {statsActuales.pct.toFixed(1)}%
                    </Text>
                </View>
                <View style={s.miniStatItem}>
                    <Text style={s.miniStatLabel}>No cumplidas</Text>
                    <Text style={[s.miniStatBig, { color: '#c53030' }]}>{statsActuales.noCumplidas}</Text>
                </View>
                <View style={s.miniStatItem}>
                    <Text style={s.miniStatLabel}>Pendientes</Text>
                    <Text style={[s.miniStatBig, { color: '#b7791f' }]}>{statsActuales.pendientes}</Text>
                </View>
            </View>

            <Text style={s.sectionTitle}>Actividades · {areaSeleccionada}</Text>
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary || '#3182ce'} style={{ marginTop: 30 }} />
            ) : actividadesAMostrar.length === 0 ? (
                <View style={s.emptyBox}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.subText} />
                    <Text style={s.emptyTitle}>Sin actividades</Text>
                    <Text style={s.emptyDesc}>
                        {esAdmin
                            ? 'Aún no hay actividades para este proceso en el período. Crea una nueva con el botón superior.'
                            : 'Aún no se han registrado actividades para este proceso en el período.'}
                    </Text>
                </View>
            ) : (
                actividadesAMostrar.map(act => (
                    <ActividadCard
                        key={act.id}
                        act={act}
                        esAdmin={esAdmin}
                        isDarkMode={isDarkMode}
                        colors={colors}
                        onEdit={() => abrirEditar(act)}
                        onDelete={() => eliminar(act)}
                        onCumplida={() => marcarCumplida(act)}
                        onNoCumplida={() => abrirNoCumplida(act)}
                        onReabrir={() => reabrir(act)}
                    />
                ))
            )}

            {modalsActividad}
        </>
    );
}

function ActividadCard({ act, esAdmin, onEdit, onDelete, onCumplida, onNoCumplida, onReabrir, isDarkMode, colors }: any) {
    const s = makeStyles(isDarkMode, colors);
    const isCumplida = act.estado === 'cumplida';
    const isNoCumplida = act.estado === 'no_cumplida';
    const isPendiente = act.estado === 'pendiente';
    const estadoColor = isCumplida ? '#2f855a' : isNoCumplida ? '#c53030' : '#b7791f';
    const estadoLabel = isCumplida ? 'Cumplida' : isNoCumplida ? 'No cumplida' : 'Pendiente';
    const estadoIcon = isCumplida ? 'check-circle' : isNoCumplida ? 'close-circle' : 'clock-outline';

    return (
        <View style={s.actCard}>
            <View style={s.actHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.actTitulo}>{act.titulo}</Text>
                    {!!act.descripcion && <Text style={s.actDesc}>{act.descripcion}</Text>}
                    <Text style={s.actArea}>Área: {act.area}</Text>
                    {!!act.fechaCumplimiento && (
                        <Text style={s.fechaCierreTag}>
                            <MaterialCommunityIcons name="check-decagram" size={11} color="#2f855a" /> Cumplida el {formatFechaHora(act.fechaCumplimiento)}
                        </Text>
                    )}
                </View>
                <View style={[s.estadoBadge, { backgroundColor: estadoColor + '22', borderColor: estadoColor }]}>
                    <MaterialCommunityIcons name={estadoIcon as any} size={16} color={estadoColor} />
                    <Text style={[s.estadoText, { color: estadoColor }]}>{estadoLabel}</Text>
                </View>
            </View>
            {isNoCumplida && !!act.razonNoCumplimiento && (
                <View style={s.razonBox}>
                    <Text style={s.razonLabel}>Razón:</Text>
                    <Text style={s.razonText}>{act.razonNoCumplimiento}</Text>
                </View>
            )}
            <View style={s.actActions}>
                {!isCumplida && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#38a169' }]} onPress={onCumplida}>
                        <MaterialCommunityIcons name="check" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>Cumplí</Text>
                    </TouchableOpacity>
                )}
                {!isNoCumplida && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#e53e3e' }]} onPress={onNoCumplida}>
                        <MaterialCommunityIcons name="close" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>No cumplí</Text>
                    </TouchableOpacity>
                )}
                {!isPendiente && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#718096' }]} onPress={onReabrir}>
                        <MaterialCommunityIcons name="undo-variant" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>Reabrir</Text>
                    </TouchableOpacity>
                )}
                {esAdmin && (
                    <>
                        <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#3182ce' }]} onPress={onEdit}>
                            <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                            <Text style={s.actionBtnText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#a0aec0' }]} onPress={onDelete}>
                            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#fff" />
                            <Text style={s.actionBtnText}>Eliminar</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
}

/* ===========================================================================
 * Tabs 2 y 3: Check CT-PAT / ILS
 * ===========================================================================*/

function ChecklistTab({ tipo, titulo, descripcion, anio, userRole, userId, displayName, isDarkMode, colors, s }: any) {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [usuariosDisponibles, setUsuariosDisponibles] = useState<UsuarioOption[]>([]);

    const esAdmin = useMemo(() => esAdminEvaluacion(userRole), [userRole]);

    const miNombre = String(displayName || '').toLowerCase().trim();

    const usuarioEsResponsable = useCallback((item: ChecklistItem) => {
        const responsables = item.responsables || [];
        if (responsables.length === 0) return false;

        if (userId != null && responsables.some(r => Number(r.usuarioId) === userId)) {
            return true;
        }

        if (miNombre) {
            return responsables.some(r =>
                (r.usuarioNombre || '').toLowerCase().trim() === miNombre
            );
        }

        return false;
    }, [userId, miNombre]);

    const [modalForm, setModalForm] = useState<{
        visible: boolean;
        editingId?: number;
        numeroActividad: string;
        titulo: string;
        descripcion: string;
        responsablesIds: number[];
    }>({ visible: false, numeroActividad: '', titulo: '', descripcion: '', responsablesIds: [] });

    const [modalNoCompletada, setModalNoCompletada] = useState<{
        visible: boolean;
        id?: number;
        razon: string;
    }>({ visible: false, razon: '' });

    /** Filtros locales (CT-PAT / ILS): categoría (= titulo backend), estado, responsable */
    const [filtroCkCategoria, setFiltroCkCategoria] = useState('');
    const [filtroCkEstado, setFiltroCkEstado] = useState('');
    /** id de usuario como string; '' = todos */
    const [filtroCkAsignadoId, setFiltroCkAsignadoId] = useState('');

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const itemsRes = await api.get('AuditChecklist', { params: { tipo, anio } });
            setItems(itemsRes.data || []);
        } catch (e: any) {
            console.error(`[Checklist ${tipo}] Error cargando:`, e?.message);
            Alert.alert('Error', 'No se pudieron cargar los items del checklist');
        } finally {
            setLoading(false);
        }
    }, [tipo, anio]);

    const cargarUsuarios = useCallback(async () => {
        if (!esAdmin) return;
        try {
            const r = await api.get('AuditChecklist/usuarios');
            setUsuariosDisponibles(r.data || []);
        } catch (e: any) {
            console.error('[Checklist] No se pudieron cargar usuarios:', e?.message);
        }
    }, [esAdmin]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

    useEffect(() => {
        setFiltroCkCategoria('');
        setFiltroCkEstado('');
        setFiltroCkAsignadoId('');
    }, [anio, tipo]);

    // Items visibles para el usuario actual: admin ve todo; el resto solo
    // ve aquellos en los que está asignado como responsable.
    const itemsVisibles = useMemo<ChecklistItem[]>(() => {
        if (esAdmin) return items;
        return items.filter(it => usuarioEsResponsable(it));
    }, [items, esAdmin, usuarioEsResponsable]);

    /** Categorías distintas en los ítems visibles (valor almacenado en `titulo`). */
    const categoriasChecklistOpciones = useMemo(() => {
        const set = new Set<string>();
        for (const it of itemsVisibles) {
            const t = (it.titulo || '').trim();
            if (t) set.add(t);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    }, [itemsVisibles]);

    /** Usuarios para filtro «Asignado»: solo responsables con actividades asignadas en el listado visible. */
    const opcionesUsuariosFiltroChecklist = useMemo(() => {
        const map = new Map<number, string>();
        for (const it of itemsVisibles) {
            for (const r of it.responsables || []) {
                const id = Number(r.usuarioId);
                if (!Number.isFinite(id)) continue;
                const lbl = String(r.usuarioNombre || r.usuarioEmail || `Usuario ${id}`).trim();
                map.set(id, lbl || `Usuario ${id}`);
            }
        }
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es'));
    }, [itemsVisibles]);

    /** Lista tras filtros locales (rol + categoría / estado / asignado). */
    const itemsListaChecklist = useMemo(() => {
        const cat = filtroCkCategoria.trim();
        const est = filtroCkEstado;
        const asig = filtroCkAsignadoId.trim();
        return itemsVisibles.filter(it => {
            if (cat && (it.titulo || '').trim() !== cat) return false;
            if (est && it.estado !== est) return false;
            if (asig) {
                const fid = Number(asig);
                const ok = (it.responsables || []).some(r => Number(r.usuarioId) === fid);
                if (!ok) return false;
            }
            return true;
        });
    }, [itemsVisibles, filtroCkCategoria, filtroCkEstado, filtroCkAsignadoId]);

    /** KPIs coherentes con la lista filtrada (incluye admin y no-admin). */
    const resumenListaChecklist = useMemo<ResumenChecklist>(() => {
        const arr = itemsListaChecklist;
        const total = arr.length;
        const completadas = arr.filter(x => x.estado === 'completada').length;
        const noCompletadas = arr.filter(x => x.estado === 'no_completada').length;
        const pendientes = arr.filter(x => x.estado === 'pendiente').length;
        const pct = total === 0 ? 0 : Math.round((completadas * 1000) / total) / 10;
        return {
            tipo,
            total,
            completadas,
            noCompletadas,
            pendientes,
            porcentajeCumplimiento: pct,
            items: arr,
        };
    }, [itemsListaChecklist, tipo]);

    const filtrosCkActivos =
        !!(filtroCkCategoria.trim() || filtroCkEstado || filtroCkAsignadoId.trim());

    const limpiarFiltrosCk = () => {
        setFiltroCkCategoria('');
        setFiltroCkEstado('');
        setFiltroCkAsignadoId('');
    };

    const abrirNuevo = () => {
        if (!esAdmin) return;
        setModalForm({ visible: true, editingId: undefined, numeroActividad: '', titulo: '', descripcion: '', responsablesIds: [] });
    };

    const abrirEditar = (item: ChecklistItem) => {
        const ids = (item.responsables || [])
            .map(r => r.usuarioId)
            .filter((v): v is number => typeof v === 'number');
        setModalForm({
            visible: true,
            editingId: item.id,
            numeroActividad: item.numeroActividad != null ? String(item.numeroActividad) : '',
            titulo: item.titulo,
            descripcion: item.descripcion || '',
            responsablesIds: ids,
        });
    };

    const guardarItem = async () => {
        if (!modalForm.titulo.trim()) { Alert.alert('Validación', 'La categoría es obligatoria'); return; }
        const numTxt = modalForm.numeroActividad.trim();
        let numeroActividad: number | null = null;
        if (numTxt) {
            const n = parseInt(numTxt, 10);
            if (!Number.isFinite(n) || n < 1) {
                Alert.alert('Validación', 'El ID numérico debe ser un entero positivo.');
                return;
            }
            numeroActividad = n;
        }
        try {
            const responsables = modalForm.responsablesIds.map(id => {
                const u = usuariosDisponibles.find(x => x.id === id);
                return {
                    usuarioId: id,
                    usuarioNombre: u?.nombreMostrar || null,
                    usuarioEmail: u?.email || null,
                };
            });
            const payload = {
                tipo,
                numeroActividad,
                titulo: modalForm.titulo.trim(),
                descripcion: modalForm.descripcion.trim() || null,
                // El check list es anual; usamos mes=1 como marcador (no se filtra por mes).
                anio, mes: 1,
                creadoPorNombre: displayName || 'Administrador',
                responsables,
                notificarPorCorreo: true,
            };
            if (modalForm.editingId) {
                await api.put(`AuditChecklist/${modalForm.editingId}`, payload);
            } else {
                await api.post('AuditChecklist', payload);
            }
            setModalForm({ visible: false, titulo: '', descripcion: '', responsablesIds: [] });
            await cargar();
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
        }
    };

    const eliminar = (item: ChecklistItem) => {
        const confirmar = async () => {
            try { await api.delete(`AuditChecklist/${item.id}`); await cargar(); }
            catch { Alert.alert('Error', 'No se pudo eliminar'); }
        };
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Eliminar el item "${item.titulo}"?`)) confirmar();
        } else {
            Alert.alert('Eliminar', `¿Eliminar el item "${item.titulo}"?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: confirmar },
            ]);
        }
    };

    const marcarCompletada = async (item: ChecklistItem) => {
        try {
            await api.put(`AuditChecklist/${item.id}/estado`, {
                estado: 'completada',
                razonNoCompletada: null,
                cerradaPorNombre: displayName || null,
            });
            await cargar();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar');
        }
    };

    const abrirNoCompletada = (item: ChecklistItem) => {
        setModalNoCompletada({ visible: true, id: item.id, razon: item.razonNoCompletada || '' });
    };

    const guardarNoCompletada = async () => {
        if (!modalNoCompletada.razon.trim()) { Alert.alert('Validación', 'Debe ingresar la razón por la que no se completó'); return; }
        try {
            await api.put(`AuditChecklist/${modalNoCompletada.id}/estado`, {
                estado: 'no_completada',
                razonNoCompletada: modalNoCompletada.razon.trim(),
                cerradaPorNombre: displayName || null,
            });
            setModalNoCompletada({ visible: false, razon: '' });
            await cargar();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar');
        }
    };

    const reabrir = async (item: ChecklistItem) => {
        try {
            await api.put(`AuditChecklist/${item.id}/estado`, {
                estado: 'pendiente', razonNoCompletada: null, cerradaPorNombre: null,
            });
            await cargar();
        } catch { Alert.alert('Error', 'No se pudo actualizar'); }
    };

    const abrirReporte = async () => {
        try {
            const res = await api.get('AuditChecklist/resumen', { params: { tipo, anio } });
            const data: ResumenChecklist = res.data;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 40;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            const tituloPdf = `Reporte de Auditoría · ${titulo}`;
            doc.text(tituloPdf, margin, 50);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(74, 85, 104);
            doc.text(`Período: Año ${anio} (check list anual)`, margin, 68);
            doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth - margin, 68, { align: 'right' });
            doc.setTextColor(0, 0, 0);

            // Métricas
            const total = data?.total ?? 0;
            const completadas = data?.completadas ?? 0;
            const noCompletadas = data?.noCompletadas ?? 0;
            const pendientes = data?.pendientes ?? 0;
            const pct = data?.porcentajeCumplimiento ?? 0;

            autoTable(doc, {
                startY: 90,
                head: [['Total', 'Completadas', 'No completadas', 'Pendientes', '% Cumplimiento']],
                body: [[String(total), String(completadas), String(noCompletadas), String(pendientes), `${pct.toFixed(1)}%`]],
                headStyles: { fillColor: tipo === 'ILS' ? [128, 90, 213] : [49, 130, 206], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 10, cellPadding: 6, halign: 'center' },
            });

            let cursorY = (doc as any).lastAutoTable?.finalY ?? 130;
            cursorY += 24;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(43, 108, 176);
            doc.text('Detalle de actividades', margin, cursorY);
            doc.setTextColor(0, 0, 0);
            cursorY += 8;

            const items = data?.items || [];
            if (items.length === 0) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.setTextColor(74, 85, 104);
                doc.text('No hay actividades registradas en este período.', margin, cursorY + 14);
                doc.setTextColor(0, 0, 0);
            } else {
                autoTable(doc, {
                    startY: cursorY + 4,
                    head: [['ID', 'Categoría', 'Estado', 'Responsables', 'Cierre', 'Observación']],
                    body: items.map(it => [
                        it.numeroActividad != null ? String(it.numeroActividad) : '—',
                        it.descripcion ? `${it.titulo}\n${it.descripcion}` : it.titulo,
                        estadoLabel(it.estado),
                        (it.responsables || [])
                            .map(r => r.usuarioNombre || r.usuarioEmail || `Usuario ${r.usuarioId ?? '?'}`)
                            .join(', ') || '—',
                        it.fechaCierre
                            ? `${formatFechaHora(it.fechaCierre)}${it.cerradaPorNombre ? `\nPor: ${it.cerradaPorNombre}` : ''}`
                            : '—',
                        it.estado === 'no_completada' ? (it.razonNoCompletada || '(sin razón)') : '',
                    ]),
                    headStyles: { fillColor: tipo === 'ILS' ? [128, 90, 213] : [49, 130, 206], textColor: 255, fontStyle: 'bold' },
                    styles: { fontSize: 9, cellPadding: 5, valign: 'top' },
                    columnStyles: {
                        0: { cellWidth: 36, halign: 'center' },
                        1: { cellWidth: 140 },
                        2: { cellWidth: 70, halign: 'center' },
                        3: { cellWidth: 100 },
                        4: { cellWidth: 80 },
                        5: { cellWidth: 'auto' },
                    },
                    didParseCell: (data: any) => {
                        if (data.section === 'body' && data.column.index === 2) {
                            const it = items[data.row.index];
                            if (it?.estado === 'completada') data.cell.styles.textColor = [47, 133, 90];
                            else if (it?.estado === 'no_completada') data.cell.styles.textColor = [197, 48, 48];
                            else data.cell.styles.textColor = [183, 121, 31];
                        }
                    },
                });
            }

            const filename = `auditoria-${tipo.toLowerCase()}-${anio}.pdf`;
            doc.save(filename);
        } catch (e: any) {
            console.error('[Checklist] PDF error:', e?.message);
            Alert.alert('Error', 'No se pudo generar el reporte');
        }
    };

    const pct = resumenListaChecklist.porcentajeCumplimiento;

    return (
        <>
            <View style={s.headerSubRow}>
                <View style={{ flex: 1 }}>
                    <Text style={s.sectionTitle}>{titulo}</Text>
                    <Text style={s.subtitleSmall}>{descripcion}</Text>
                </View>
                {esAdmin && (
                    <TouchableOpacity style={s.primaryBtn} onPress={abrirNuevo}>
                        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                        <Text style={s.primaryBtnText}>Nueva actividad</Text>
                    </TouchableOpacity>
                )}
                {esAdmin && (
                    <TouchableOpacity style={s.reportBtn} onPress={abrirReporte}>
                        <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />
                        <Text style={s.reportBtnText}>Reporte PDF</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={s.miniStatsCard}>
                <View style={s.miniStatItem}>
                    <Text style={s.miniStatLabel}>Cumplimiento</Text>
                    <Text style={[s.miniStatBig, pctColor(pct)]}>
                        {resumenListaChecklist.completadas}/{resumenListaChecklist.total}
                    </Text>
                    <Text style={[s.miniStatPct, pctColor(pct)]}>{pct.toFixed(1)}%</Text>
                </View>
                <View style={s.miniStatItem}>
                    <Text style={s.miniStatLabel}>No completadas</Text>
                    <Text style={[s.miniStatBig, { color: '#c53030' }]}>{resumenListaChecklist.noCompletadas}</Text>
                </View>
                <View style={s.miniStatItem}>
                    <Text style={s.miniStatLabel}>Pendientes</Text>
                    <Text style={[s.miniStatBig, { color: '#b7791f' }]}>{resumenListaChecklist.pendientes}</Text>
                </View>
            </View>

            {itemsVisibles.length > 0 && (
                <View style={s.filtersCard}>
                    <View style={[s.filterItem, { minWidth: 160 }]}>
                        <Text style={s.filterLabel}>Categoría</Text>
                        <ThemedSelect
                            value={filtroCkCategoria || '__todas__'}
                            onChange={v => setFiltroCkCategoria(v === '__todas__' ? '' : String(v))}
                            isDarkMode={isDarkMode}
                            options={[
                                { label: `Todas (${itemsVisibles.length})`, value: '__todas__' },
                                ...categoriasChecklistOpciones.map(c => ({ label: c, value: c })),
                            ]}
                        />
                    </View>
                    <View style={[s.filterItem, { minWidth: 160 }]}>
                        <Text style={s.filterLabel}>Estado</Text>
                        <ThemedSelect
                            value={filtroCkEstado || '__todas_est__'}
                            onChange={v =>
                                setFiltroCkEstado(v === '__todas_est__' ? '' : String(v))
                            }
                            isDarkMode={isDarkMode}
                            options={[
                                { label: 'Todos los estados', value: '__todas_est__' },
                                { label: 'Pendientes', value: 'pendiente' },
                                { label: 'Completadas', value: 'completada' },
                                { label: 'No completadas', value: 'no_completada' },
                            ]}
                        />
                    </View>
                    <View style={[s.filterItem, { minWidth: 200 }]}>
                        <Text style={s.filterLabel}>Asignado</Text>
                        <ThemedSelect
                            value={filtroCkAsignadoId || '__todos_resp__'}
                            onChange={v =>
                                setFiltroCkAsignadoId(v === '__todos_resp__' ? '' : String(v))
                            }
                            isDarkMode={isDarkMode}
                            options={[
                                { label: 'Todos los responsables', value: '__todos_resp__' },
                                ...opcionesUsuariosFiltroChecklist.map(([id, label]) => ({
                                    label,
                                    value: String(id),
                                })),
                            ]}
                        />
                    </View>
                    {filtrosCkActivos && (
                        <View style={[s.filterItem, { justifyContent: 'flex-end', minWidth: 100 }]}>
                            <TouchableOpacity style={s.secondaryBtn} onPress={limpiarFiltrosCk}>
                                <Text style={s.secondaryBtnText}>Limpiar filtros</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {!esAdmin && (
                <View style={s.infoNoteBox}>
                    <MaterialCommunityIcons name="information-outline" size={14} color={isDarkMode ? '#90cdf4' : '#2b6cb0'} />
                    <Text style={s.infoNoteText}>
                        Solo se muestran las actividades en las que estás asignado como responsable.
                    </Text>
                </View>
            )}

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary || '#3182ce'} style={{ marginTop: 30 }} />
            ) : itemsVisibles.length === 0 ? (
                <View style={s.emptyBox}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.subText} />
                    <Text style={s.emptyTitle}>
                        {esAdmin ? 'Sin items en el checklist' : 'Sin actividades asignadas'}
                    </Text>
                    <Text style={s.emptyDesc}>
                        {esAdmin
                            ? 'Crea la primera actividad para este checklist con el botón superior.'
                            : 'Aún no tienes actividades asignadas en este check list. Cuando el administrador te asigne una, aparecerá aquí.'}
                    </Text>
                </View>
            ) : itemsListaChecklist.length === 0 ? (
                <View style={s.emptyBox}>
                    <MaterialCommunityIcons name="filter-variant-remove" size={36} color={colors.subText} />
                    <Text style={s.emptyTitle}>Sin resultados</Text>
                    <Text style={s.emptyDesc}>
                        Ninguna pregunta coincide con los filtros seleccionados. Prueba otros criterios o limpia los filtros.
                    </Text>
                    <TouchableOpacity style={[s.primaryBtn, { marginTop: 12 }]} onPress={limpiarFiltrosCk}>
                        <Text style={s.primaryBtnText}>Limpiar filtros</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                itemsListaChecklist.map(it => (
                    <ChecklistItemCard
                        key={it.id}
                        item={it}
                        esAdmin={esAdmin}
                        tipo={tipo}
                        isDarkMode={isDarkMode}
                        colors={colors}
                        onCompletar={() => marcarCompletada(it)}
                        onNoCompletar={() => abrirNoCompletada(it)}
                        onReabrir={() => reabrir(it)}
                        onEditar={() => abrirEditar(it)}
                        onEliminar={() => eliminar(it)}
                    />
                ))
            )}

            {/* Modal Nueva / Editar item */}
            <Modal visible={modalForm.visible} animationType="fade" transparent onRequestClose={() => setModalForm({ ...modalForm, visible: false })}>
                <View style={s.modalBackdrop}>
                    <View style={[s.modalCard, { maxWidth: 620 }]}>
                        <Text style={s.modalTitle}>
                            {modalForm.editingId ? `Editar item · ${titulo}` : `Nueva actividad · ${titulo}`}
                        </Text>

                        <Text style={s.fieldLabel}>ID numérico (opcional)</Text>
                        <TextInput
                            style={s.input}
                            value={modalForm.numeroActividad}
                            onChangeText={t => setModalForm({ ...modalForm, numeroActividad: t.replace(/[^\d]/g, '') })}
                            placeholder="Ej: 12 — número que usted asigna al ítem"
                            placeholderTextColor={colors.subText}
                            keyboardType="number-pad"
                        />

                        <Text style={s.fieldLabel}>Categoría *</Text>
                        <TextInput
                            style={s.input}
                            value={modalForm.titulo}
                            onChangeText={t => setModalForm({ ...modalForm, titulo: t })}
                            placeholder="Ej: Candados · Contenedor"
                            placeholderTextColor={colors.subText}
                        />

                        <Text style={s.fieldLabel}>Descripción</Text>
                        <TextInput
                            style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                            value={modalForm.descripcion}
                            onChangeText={t => setModalForm({ ...modalForm, descripcion: t })}
                            placeholder="Detalle de la verificación"
                            placeholderTextColor={colors.subText}
                            multiline
                        />

                        <Text style={s.fieldLabel}>
                            Responsables (los usuarios seleccionados recibirán un correo)
                        </Text>
                        <MultiUserSelect
                            usuarios={usuariosDisponibles}
                            selectedIds={modalForm.responsablesIds}
                            onChange={ids => setModalForm({ ...modalForm, responsablesIds: ids })}
                            isDarkMode={isDarkMode}
                            colors={colors}
                        />

                        <View style={s.modalActions}>
                            <TouchableOpacity style={[s.secondaryBtn, { marginRight: 10 }]} onPress={() => setModalForm({ ...modalForm, visible: false })}>
                                <Text style={s.secondaryBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.primaryBtn} onPress={guardarItem}>
                                <Text style={s.primaryBtnText}>{modalForm.editingId ? 'Guardar cambios' : 'Crear actividad'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal No completada */}
            <Modal visible={modalNoCompletada.visible} animationType="fade" transparent onRequestClose={() => setModalNoCompletada({ visible: false, razon: '' })}>
                <View style={s.modalBackdrop}>
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>¿Por qué no se completó?</Text>
                        <Text style={[s.fieldLabel, { marginBottom: 6 }]}>Indica la razón (obligatoria):</Text>
                        <TextInput
                            style={[s.input, { height: 100, textAlignVertical: 'top' }]}
                            value={modalNoCompletada.razon}
                            onChangeText={t => setModalNoCompletada({ ...modalNoCompletada, razon: t })}
                            placeholder="Ej: Falta de información, tiempo, recursos, etc."
                            placeholderTextColor={colors.subText}
                            multiline
                        />
                        <View style={s.modalActions}>
                            <TouchableOpacity style={[s.secondaryBtn, { marginRight: 10 }]} onPress={() => setModalNoCompletada({ visible: false, razon: '' })}>
                                <Text style={s.secondaryBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#c53030' }]} onPress={guardarNoCompletada}>
                                <Text style={s.primaryBtnText}>Marcar No Completada</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

function ChecklistItemCard({ item, esAdmin, tipo, onCompletar, onNoCompletar, onReabrir, onEditar, onEliminar, isDarkMode, colors }: any) {
    const s = makeStyles(isDarkMode, colors);
    const isCompletada = item.estado === 'completada';
    const isNoCompletada = item.estado === 'no_completada';
    const isPendiente = item.estado === 'pendiente';
    const estadoColor = isCompletada ? '#2f855a' : isNoCompletada ? '#c53030' : '#b7791f';
    const estadoLbl = isCompletada ? 'Completada' : isNoCompletada ? 'No completada' : 'Pendiente';
    const estadoIcon = isCompletada ? 'check-circle' : isNoCompletada ? 'close-circle' : 'clock-outline';

    return (
        <View style={s.actCard}>
            <View style={s.actHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {item.numeroActividad != null && (
                            <View style={s.idBadge}>
                                <Text style={s.idBadgeText}>#{item.numeroActividad}</Text>
                            </View>
                        )}
                        <Text style={s.actCategoriaMuted}>Categoría</Text>
                    </View>
                    <Text style={s.actTitulo}>{item.titulo}</Text>
                    {!!item.descripcion && <Text style={s.actDesc}>{item.descripcion}</Text>}

                    {(item.responsables || []).length > 0 && (
                        <View style={s.respChipsRow}>
                            {item.responsables.map((r: Responsable, idx: number) => (
                                <View key={`${r.id || idx}-${r.usuarioId || idx}`} style={s.respChip}>
                                    <MaterialCommunityIcons name="account" size={11} color="#3182ce" />
                                    <Text style={s.respChipText}>
                                        {r.usuarioNombre || r.usuarioEmail || `Usuario ${r.usuarioId}`}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {!!item.fechaCierre && (isCompletada || isNoCompletada) && (
                        <Text style={[s.fechaCierreTag, { color: estadoColor }]}>
                            <MaterialCommunityIcons name={isCompletada ? 'check-decagram' : 'alert-octagon'} size={11} color={estadoColor} />
                            {' '}{isCompletada ? 'Completada' : 'No completada'} el {formatFechaHora(item.fechaCierre)}
                            {item.cerradaPorNombre ? ` · ${item.cerradaPorNombre}` : ''}
                        </Text>
                    )}
                </View>
                <View style={[s.estadoBadge, { backgroundColor: estadoColor + '22', borderColor: estadoColor }]}>
                    <MaterialCommunityIcons name={estadoIcon as any} size={16} color={estadoColor} />
                    <Text style={[s.estadoText, { color: estadoColor }]}>{estadoLbl}</Text>
                </View>
            </View>

            {isNoCompletada && !!item.razonNoCompletada && (
                <View style={s.razonBox}>
                    <Text style={s.razonLabel}>Razón:</Text>
                    <Text style={s.razonText}>{item.razonNoCompletada}</Text>
                </View>
            )}

            <View style={s.actActions}>
                {!isCompletada && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#38a169' }]} onPress={onCompletar}>
                        <MaterialCommunityIcons name="check" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>Completar</Text>
                    </TouchableOpacity>
                )}
                {!isNoCompletada && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#e53e3e' }]} onPress={onNoCompletar}>
                        <MaterialCommunityIcons name="close" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>No completada</Text>
                    </TouchableOpacity>
                )}
                {!isPendiente && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#718096' }]} onPress={onReabrir}>
                        <MaterialCommunityIcons name="undo-variant" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>Reabrir</Text>
                    </TouchableOpacity>
                )}
                {esAdmin && (
                    <>
                        <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#3182ce' }]} onPress={onEditar}>
                            <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                            <Text style={s.actionBtnText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#a0aec0' }]} onPress={onEliminar}>
                            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#fff" />
                            <Text style={s.actionBtnText}>Eliminar</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
}

/* ===========================================================================
 * Selector de múltiples usuarios (responsables)
 * ===========================================================================*/

function MultiUserSelect({ usuarios, selectedIds, onChange, isDarkMode, colors }: {
    usuarios: UsuarioOption[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    isDarkMode: boolean;
    colors: any;
}) {
    const [filtro, setFiltro] = useState('');

    const lista = useMemo(() => {
        const q = filtro.trim().toLowerCase();
        if (!q) return usuarios;
        return usuarios.filter(u =>
            u.nombreMostrar.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.area || '').toLowerCase().includes(q)
        );
    }, [usuarios, filtro]);

    const toggle = (id: number) => {
        if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id));
        else onChange([...selectedIds, id]);
    };

    const seleccionados = usuarios.filter(u => selectedIds.includes(u.id));

    const styles = StyleSheet.create({
        wrap: {
            borderWidth: 1,
            borderColor: isDarkMode ? '#374151' : '#cbd5e0',
            borderRadius: 8,
            backgroundColor: isDarkMode ? '#0b1220' : '#fff',
            padding: 8,
        },
        chips: {
            flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6,
        },
        chip: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: isDarkMode ? '#1e3a8a' : '#bee3f8',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
        },
        chipText: { color: isDarkMode ? '#dbeafe' : '#1a365d', fontSize: 12, fontWeight: '600' },
        search: {
            borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#cbd5e0',
            borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6,
            color: isDarkMode ? '#e2e8f0' : '#1a202c',
            backgroundColor: isDarkMode ? '#111827' : '#f7fafc',
            marginBottom: 6, fontSize: 13,
        },
        list: {
            maxHeight: 200,
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#1f2937' : '#edf2f7',
        },
        row: {
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingVertical: 6, paddingHorizontal: 4,
            borderBottomWidth: 1,
            borderBottomColor: isDarkMode ? '#1f2937' : '#edf2f7',
        },
        check: {
            width: 18, height: 18, borderRadius: 4,
            borderWidth: 1,
            borderColor: isDarkMode ? '#4a5568' : '#cbd5e0',
            backgroundColor: 'transparent',
            alignItems: 'center', justifyContent: 'center',
        },
        checkOn: { backgroundColor: '#3182ce', borderColor: '#3182ce' },
        nombre: { color: isDarkMode ? '#e2e8f0' : '#1a202c', fontSize: 13, fontWeight: '600' },
        email: { color: isDarkMode ? '#a0aec0' : '#4a5568', fontSize: 11 },
        empty: { fontSize: 12, color: isDarkMode ? '#a0aec0' : '#718096', fontStyle: 'italic', paddingVertical: 10, textAlign: 'center' },
    });

    return (
        <View style={styles.wrap}>
            <View style={styles.chips}>
                {seleccionados.length === 0 ? (
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#a0aec0' : '#718096' }}>
                        Selecciona uno o varios responsables.
                    </Text>
                ) : (
                    seleccionados.map(u => (
                        <TouchableOpacity key={u.id} style={styles.chip} onPress={() => toggle(u.id)}>
                            <Text style={styles.chipText}>{u.nombreMostrar}</Text>
                            <MaterialCommunityIcons name="close" size={12} color={isDarkMode ? '#dbeafe' : '#1a365d'} />
                        </TouchableOpacity>
                    ))
                )}
            </View>
            <TextInput
                style={styles.search}
                value={filtro}
                onChangeText={setFiltro}
                placeholder="Buscar por nombre, email o área…"
                placeholderTextColor={isDarkMode ? '#718096' : '#a0aec0'}
            />
            <View style={styles.list}>
                <ScrollView style={{ maxHeight: 190 }}>
                    {lista.length === 0 ? (
                        <Text style={styles.empty}>Sin usuarios coincidentes.</Text>
                    ) : (
                        lista.map(u => {
                            const on = selectedIds.includes(u.id);
                            return (
                                <TouchableOpacity key={u.id} style={styles.row} onPress={() => toggle(u.id)}>
                                    <View style={[styles.check, on && styles.checkOn]}>
                                        {on && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.nombre}>{u.nombreMostrar}</Text>
                                        <Text style={styles.email}>
                                            {u.email || '(sin email)'} {u.area ? ` · ${u.area}` : ''}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </View>
    );
}

/* ===========================================================================
 * Helpers de formato / estilos
 * ===========================================================================*/

function pctColor(pct: number) {
    if (pct >= 80) return { color: '#2f855a' };
    if (pct >= 50) return { color: '#b7791f' };
    return { color: '#c53030' };
}

function formatFechaHora(iso?: string | null) {
    if (!iso) return '';
    try {
        // El backend guarda en UTC (DateTime.UtcNow). Lo mostramos en hora local.
        const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return iso; }
}

function estadoLabel(e: string) {
    if (e === 'completada') return 'Completada';
    if (e === 'no_completada') return 'No completada';
    return 'Pendiente';
}

const makeStyles = (isDarkMode: boolean, colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors?.background || (isDarkMode ? '#0b0f17' : '#f7fafc'),
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
            gap: 10,
            flexWrap: 'wrap',
        },
        headerSubRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            marginBottom: 12,
            gap: 10,
            flexWrap: 'wrap',
        },
        headerActionsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        subtitle: {
            fontSize: 13,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            marginTop: 2,
        },
        subtitleSmall: {
            fontSize: 12,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            marginTop: 2,
        },
        tabsRow: {
            flexDirection: 'row',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
        },
        tabBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: isDarkMode ? '#2d3748' : '#cbd5e0',
            backgroundColor: isDarkMode ? '#111827' : '#fff',
        },
        tabBtnActive: {
            backgroundColor: '#3182ce',
            borderColor: '#3182ce',
        },
        tabBtnText: {
            fontSize: 13, fontWeight: '700',
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        tabBtnTextActive: { color: '#fff' },
        tabBtnAdd: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: isDarkMode ? '#3182ce' : '#2b6cb0',
            backgroundColor: isDarkMode ? '#0f172a' : '#ebf8ff',
        },
        tabBtnAddText: {
            fontSize: 13, fontWeight: '700',
            color: isDarkMode ? '#90cdf4' : '#2b6cb0',
        },
        primaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#3182ce',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 8,
            gap: 6,
        },
        primaryBtnText: { color: '#fff', fontWeight: '700' },
        secondaryBtn: {
            paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: isDarkMode ? '#2d3748' : '#e2e8f0',
        },
        secondaryBtnText: {
            color: isDarkMode ? '#e2e8f0' : '#2d3748',
            fontWeight: '600',
        },
        backLink: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingVertical: 6, paddingHorizontal: 4,
            flex: 1,
        },
        backLinkText: {
            color: isDarkMode ? '#90cdf4' : '#2b6cb0',
            fontWeight: '700', fontSize: 14,
        },
        filtersCard: {
            backgroundColor: isDarkMode ? '#111827' : '#fff',
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        filterItem: { minWidth: 140, flex: 1 },
        filterLabel: {
            fontSize: 12, fontWeight: '600',
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            marginBottom: 4,
        },
        reportBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#805ad5',
            paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: 8, gap: 6,
        },
        reportBtnText: { color: '#fff', fontWeight: '700' },
        sectionTitle: {
            fontSize: 16, fontWeight: '700',
            marginBottom: 4, marginTop: 6,
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        cardsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        processCard: {
            backgroundColor: isDarkMode ? '#111827' : '#fff',
            borderRadius: 14,
            padding: 16,
            minWidth: 220,
            flexGrow: 1,
            flexBasis: 220,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        processCardHeader: {
            flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
        },
        processName: {
            fontSize: 15, fontWeight: '800',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        processBig: { fontSize: 26, fontWeight: '800' },
        processPct: { fontSize: 13, fontWeight: '700', marginTop: 2 },
        processSmall: {
            fontSize: 11, marginTop: 6,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        barBg: {
            backgroundColor: isDarkMode ? '#1f2937' : '#edf2f7',
            height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6,
        },
        barFill: { backgroundColor: '#3182ce', height: '100%' },
        miniStatsCard: {
            flexDirection: 'row',
            backgroundColor: isDarkMode ? '#111827' : '#fff',
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            gap: 10,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
            flexWrap: 'wrap',
        },
        miniStatItem: { flex: 1, minWidth: 110, alignItems: 'center', paddingVertical: 4 },
        miniStatLabel: {
            fontSize: 11,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            marginBottom: 4, textTransform: 'uppercase', fontWeight: '700',
        },
        miniStatBig: { fontSize: 22, fontWeight: '800' },
        miniStatPct: { fontSize: 13, fontWeight: '700' },
        infoNoteBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: isDarkMode ? 'rgba(49,130,206,0.12)' : 'rgba(49,130,206,0.08)',
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(99,179,237,0.35)' : 'rgba(49,130,206,0.35)',
            borderRadius: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            marginBottom: 10,
        },
        infoNoteText: {
            flex: 1,
            fontSize: 12,
            color: isDarkMode ? '#90cdf4' : '#2b6cb0',
            fontWeight: '600',
        },
        actCard: {
            backgroundColor: isDarkMode ? '#111827' : '#fff',
            borderRadius: 12, padding: 14, marginBottom: 10,
            borderWidth: 1,
            borderColor: isDarkMode ? '#1f2937' : '#e2e8f0',
        },
        actHeader: { flexDirection: 'row', alignItems: 'flex-start' },
        actCategoriaMuted: {
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: colors?.subText || (isDarkMode ? '#718096' : '#718096'),
            marginBottom: 2,
        },
        idBadge: {
            backgroundColor: isDarkMode ? '#1e3a5f' : '#ebf8ff',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
            marginBottom: 2,
        },
        idBadgeText: {
            fontSize: 12,
            fontWeight: '800',
            color: isDarkMode ? '#90cdf4' : '#2b6cb0',
        },
        actTitulo: {
            fontSize: 15, fontWeight: '700',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        actDesc: {
            fontSize: 13,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            marginTop: 2,
        },
        actArea: {
            fontSize: 11,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
            marginTop: 6, fontStyle: 'italic',
        },
        fechaCierreTag: {
            fontSize: 11, fontWeight: '700',
            marginTop: 6,
            color: '#2f855a',
        },
        respChipsRow: {
            flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8,
        },
        respChip: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: isDarkMode ? '#1e3a8a' : '#bee3f8',
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
        },
        respChipText: {
            fontSize: 11, fontWeight: '600',
            color: isDarkMode ? '#dbeafe' : '#1a365d',
        },
        estadoBadge: {
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 8, paddingVertical: 4,
            borderRadius: 12, borderWidth: 1, gap: 4,
        },
        estadoText: { fontSize: 11, fontWeight: '700' },
        razonBox: {
            marginTop: 8, padding: 8,
            backgroundColor: isDarkMode ? '#2d1f1f' : '#fff5f5',
            borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#c53030',
        },
        razonLabel: { fontSize: 11, fontWeight: '700', color: '#c53030', marginBottom: 2 },
        razonText: { fontSize: 13, color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c') },
        actActions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
        actionBtn: {
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: 6, gap: 4,
        },
        actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
        emptyBox: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
        emptyTitle: {
            fontSize: 16, fontWeight: '700', marginTop: 8,
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        emptyDesc: {
            fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 360,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        modalBackdrop: {
            flex: 1, padding: 16,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', alignItems: 'center',
        },
        modalCard: {
            width: '100%', maxWidth: 520,
            backgroundColor: isDarkMode ? '#111827' : '#fff',
            borderRadius: 14, padding: 18,
        },
        modalTitle: {
            fontSize: 18, fontWeight: '800', marginBottom: 14,
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        fieldLabel: {
            fontSize: 12, fontWeight: '600', marginTop: 6, marginBottom: 4,
            color: colors?.subText || (isDarkMode ? '#a0aec0' : '#4a5568'),
        },
        input: {
            borderWidth: 1, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
            borderColor: isDarkMode ? '#374151' : '#cbd5e0',
            backgroundColor: isDarkMode ? '#0b1220' : '#fff',
            color: colors?.text || (isDarkMode ? '#e2e8f0' : '#1a202c'),
        },
        modalActions: {
            flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16,
        },
    });
