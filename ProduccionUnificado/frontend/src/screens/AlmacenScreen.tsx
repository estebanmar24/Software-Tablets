import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Platform,
    useWindowDimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../contexts/ThemeContext';
import { almacenAlert, almacenConfirm } from '../utils/almacenAlert';
import {
    type ProveedorCatalogo,
    type ProductoInsumo,
    TIPOS_REQUISICION,
    UNIDADES_MEDIDA,
    formatFechaHoy,
    formatFechaDisplay,
    getCantidadTotalPedido,
    getTotalPedidoMonetario,
    formatearMonedaCop,
    parseFechaInput,
    textoIngresadoPorRequisicion,
    OPCIONES_FILTRO_ESTADO_REQUISICION,
    type Requisicion,
    type TipoRequisicionId,
    type DatosPedido,
    type RecepcionLineaProveedor,
} from '../data/almacenMockData';
import {
    getCatalogos,
    importarProductosExcel,
    getProveedores,
    getRequisiciones,
    createRequisicion,
    updateRequisicion,
    listarOpsUnicos,
    guardarPedidoRequisicion,
    consolidarPedidoOc,
    marcarProveedorPagado,
    registrarRecepcionRequisicion,
    createProveedor,
    updateProveedor,
    createProducto,
    updateProducto,
    deleteProducto,
    deleteProveedor,
    mergeRequisicionEnLista,
    extraerMensajeErrorApi,
    eliminarRequisicion,
    resetDatosPruebasAlmacen,
} from '../services/almacenApi';
import { obtenerDatosAdjuntos } from '../services/adjuntosApi';
import { buscarCatalogoOp } from '../services/catalogoOpApi';
import { camposRequisicionDesdeAdjuntos } from '../utils/adjuntosCamposResumen';
import AlmacenPedidosTab from '../components/AlmacenPedidosTab';
import AlmacenRecepcionTab from '../components/AlmacenRecepcionTab';
import AlmacenCalidadProveedoresTab from '../components/AlmacenCalidadProveedoresTab';
import AlmacenEstadoBadge from '../components/AlmacenEstadoBadge';
import AlmacenContadorBadge from '../components/AlmacenContadorBadge';
import AlmacenFiltroEstado, { type FiltroEstadoValor } from '../components/AlmacenFiltroEstado';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type TabAlmacen = 'requisicion' | 'pedidos' | 'recepcion' | 'calidad';

interface FormRequisicion {
    ordenProduccionId: string;
    ordenProduccionNumero: string;
    cliente: string;
    referencia: string;
    productoId: string;
    fechaSolicitud: string;
    fechaRequerida: string;
    cantidad: string;
    unidad: string;
    observacion: string;
}
type FormFieldKey = keyof FormRequisicion;
type OpRelacionadaForm = {
    id: string;
    ordenProduccionId: string;
    ordenProduccionNumero: string;
    opSearch: string;
    cliente: string;
    referencia: string;
    cargando: boolean;
    mensaje: string;
    lastAutofillDigits: string;
};

const TABS: { key: TabAlmacen; label: string; icon: string }[] = [
    { key: 'requisicion', label: 'Requisición', icon: '📋' },
    { key: 'pedidos', label: 'Pedidos', icon: '🛒' },
    { key: 'recepcion', label: 'Recepción', icon: '📦' },
    { key: 'calidad', label: 'Calidad proveedores', icon: '⭐' },
];

/** Requisiciones visibles por página en el listado. */
const REQUISICIONES_POR_PAGINA = 10;

function ordenarRequisicionesMasRecientesPrimero(lista: Requisicion[]): Requisicion[] {
    return [...lista].sort((a, b) => {
        const idA = Number(a.id);
        const idB = Number(b.id);
        if (!isNaN(idA) && !isNaN(idB) && idA !== idB) return idB - idA;
        const fechaCmp = b.fechaSolicitud.localeCompare(a.fechaSolicitud);
        if (fechaCmp !== 0) return fechaCmp;
        return b.codigo.localeCompare(a.codigo);
    });
}

const emptyForm = (): FormRequisicion => ({
    ordenProduccionId: '',
    ordenProduccionNumero: '',
    cliente: '',
    referencia: '',
    productoId: '',
    fechaSolicitud: formatFechaHoy(),
    fechaRequerida: '',
    cantidad: '',
    unidad: '',
    observacion: '',
});

const crearOpRelacionadaVacia = (): OpRelacionadaForm => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ordenProduccionId: '',
    ordenProduccionNumero: '',
    opSearch: '',
    cliente: '',
    referencia: '',
    cargando: false,
    mensaje: '',
    lastAutofillDigits: '',
});

function splitCampoMultiplesOps(valor?: string): string[] {
    if (!valor) return [];
    return valor
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
}

function CeldaTextoTabla({ texto, color }: { texto?: string | null; color: string }) {
    const valor = texto?.trim() || '';
    if (!valor) {
        return <Text style={[styles.td, styles.tdWrap, { color }]}>—</Text>;
    }
    return (
        <Text
            style={[styles.td, styles.tdWrap, { color }]}
            {...(Platform.OS === 'web' ? ({ title: valor } as object) : {})}
        >
            {valor}
        </Text>
    );
}

function CeldaValoresApilados({ valores, color }: { valores: string[]; color: string }) {
    if (valores.length === 0) {
        return <Text style={[styles.td, styles.tdWrap, { color }]}>—</Text>;
    }
    if (valores.length === 1) {
        return <CeldaTextoTabla texto={valores[0]} color={color} />;
    }
    return (
        <View style={styles.tdStack}>
            {valores.map((valor, idx) => (
                <View key={`${idx}-${valor}`} style={styles.tdStackRow}>
                    <Text style={[styles.tdStackIndex, { color }]}>{idx + 1}.</Text>
                    <Text
                        style={[styles.td, styles.tdWrap, styles.tdStackItem, { color }]}
                        {...(Platform.OS === 'web' ? ({ title: valor } as object) : {})}
                    >
                        {valor}
                    </Text>
                </View>
            ))}
        </View>
    );
}

/** Acepta "7680", "OP-7680", etc. y normaliza a OP-#### cuando hay suficientes dígitos. */
function normalizarNumeroOp(texto: string): string {
    const t = texto.trim();
    if (!t) return '';
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 4) return `OP-${digits}`;
    return t;
}

function campoRequisicionValido(key: FormFieldKey, form: FormRequisicion, opSearch: string): boolean {
    switch (key) {
        case 'ordenProduccionNumero': {
            const numero = form.ordenProduccionNumero.trim() || normalizarNumeroOp(opSearch);
            return !!(form.ordenProduccionId || numero);
        }
        case 'productoId':
            return !!form.productoId;
        case 'cliente':
            return !!form.cliente.trim();
        case 'referencia':
            return !!form.referencia.trim();
        case 'fechaSolicitud':
            return !!form.fechaSolicitud.trim();
        case 'fechaRequerida':
            return !!form.fechaRequerida.trim();
        case 'cantidad': {
            const cantidad = parseFloat(form.cantidad.replace(',', '.'));
            return !!cantidad && cantidad > 0;
        }
        case 'unidad':
            return !!form.unidad.trim();
        default:
            return true;
    }
}

function SelectDropdown({
    label,
    required,
    value,
    options,
    onChange,
    placeholder,
    colors,
    isDarkMode,
    open,
    onOpenChange,
    error,
    dropUp = false,
}: {
    label: string;
    required?: boolean;
    value: string;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
    placeholder: string;
    colors: ReturnType<typeof useTheme>['colors'];
    isDarkMode: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    error?: string;
    /** Abre la lista hacia arriba (útil en campos al pie del modal). */
    dropUp?: boolean;
}) {
    const selected = options.find((o) => o.id === value);
    const panelBg = isDarkMode ? '#111827' : '#FFFFFF';
    const panelItemBg = isDarkMode ? '#111827' : '#FFFFFF';
    const panelItemSelectedBg = isDarkMode ? '#1E3A5F' : '#EBF8FF';
    const contenidoAlto = Math.max(options.length, 1) * 46;
    const listMaxHeight = dropUp ? Math.min(contenidoAlto, 200) : Math.min(contenidoAlto, 220);
    const usarScroll = contenidoAlto > listMaxHeight;

    const listaOpciones = options.map((opt) => (
        <TouchableOpacity
            key={opt.id}
            style={[
                dropdownStyles.item,
                {
                    borderBottomColor: colors.border,
                    backgroundColor: opt.id === value ? panelItemSelectedBg : panelItemBg,
                },
            ]}
            onPress={() => {
                onChange(opt.id);
                onOpenChange(false);
            }}
        >
            <Text
                style={{
                    color: opt.id === value ? colors.primary : colors.text,
                    fontWeight: opt.id === value ? '600' : '400',
                    fontSize: 15,
                }}
            >
                {opt.label}
            </Text>
        </TouchableOpacity>
    ));

    return (
        <View style={dropdownStyles.wrapper}>
            <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                {label}
                {required ? <Text style={{ color: '#60A5FA' }}> *</Text> : null}
            </Text>
            <View style={[dropdownStyles.anchor, open && dropdownStyles.anchorElevated]}>
                <TouchableOpacity
                    style={[
                        dropdownStyles.button,
                        {
                            backgroundColor: isDarkMode ? '#0F172A' : colors.inputBackground,
                            borderColor: error ? '#EF4444' : open ? colors.primary : colors.border,
                        },
                    ]}
                    onPress={() => onOpenChange(!open)}
                    activeOpacity={0.8}
                >
                    <Text style={{ color: selected ? colors.text : colors.subText, fontSize: 15, flex: 1 }} numberOfLines={1}>
                        {selected ? selected.label : placeholder}
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 10, marginLeft: 8 }}>{open ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {open && (
                    <View
                        style={[
                            dropdownStyles.listOverlay,
                            dropUp ? dropdownStyles.listOverlayDropUp : dropdownStyles.listOverlayDropDown,
                            {
                                backgroundColor: panelBg,
                                borderColor: colors.border,
                            },
                            Platform.OS === 'web' && { ...dropdownStyles.listOverlayWeb, backgroundColor: panelBg },
                        ]}
                    >
                        <ScrollView
                            style={{ maxHeight: listMaxHeight, backgroundColor: panelBg }}
                            contentContainerStyle={{ backgroundColor: panelBg }}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={usarScroll}
                        >
                            {listaOpciones}
                        </ScrollView>
                    </View>
                )}
            </View>
            {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
        </View>
    );
}

const dropdownStyles = StyleSheet.create({
    wrapper: { marginBottom: 14, position: 'relative', width: '100%', alignSelf: 'stretch' },
    wrapperElevated: {
        zIndex: 100001,
        elevation: 100001,
        ...(Platform.OS === 'web' ? { position: 'relative' as const } : {}),
    },
    label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
    anchor: { position: 'relative', zIndex: 2, width: '100%', alignSelf: 'stretch' },
    anchorElevated: { zIndex: 100001, elevation: 100001 },
    button: {
        width: '100%',
        alignSelf: 'stretch',
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    searchInput: {
        width: '100%',
        alignSelf: 'stretch',
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    sinResultados: {
        paddingVertical: 14,
        paddingHorizontal: 14,
        fontSize: 14,
        fontStyle: 'italic',
    },
    listOverlay: {
        position: 'absolute',
        left: 0,
        width: '100%',
        minWidth: '100%',
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 100000,
        elevation: 100000,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        ...(Platform.OS === 'web'
            ? { boxShadow: '0 10px 28px rgba(0,0,0,0.22)' as const }
            : {}),
    },
    listOverlayDropDown: {
        top: 46,
        shadowOffset: { width: 0, height: 6 },
        ...(Platform.OS === 'web'
            ? { boxShadow: '0 10px 28px rgba(0,0,0,0.22)' as const }
            : {}),
    },
    listOverlayDropUp: {
        bottom: 48,
        shadowOffset: { width: 0, height: -4 },
        ...(Platform.OS === 'web'
            ? { boxShadow: '0 -8px 24px rgba(0,0,0,0.18)' as const }
            : {}),
    },
    listOverlayWeb: {
        opacity: 1,
    },
    item: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        width: '100%',
        alignSelf: 'stretch',
    },
});

function SearchableSelectDropdown({
    label,
    required,
    value,
    options,
    onChange,
    placeholder,
    colors,
    isDarkMode,
    open,
    onOpenChange,
    error,
}: {
    label: string;
    required?: boolean;
    value: string;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
    placeholder: string;
    colors: ReturnType<typeof useTheme>['colors'];
    isDarkMode: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    error?: string;
}) {
    const selected = options.find((o) => o.id === value);
    const [searchText, setSearchText] = useState(selected?.label ?? '');
    const panelBg = isDarkMode ? '#111827' : '#FFFFFF';
    const panelItemBg = isDarkMode ? '#111827' : '#FFFFFF';
    const panelItemSelectedBg = isDarkMode ? '#1E3A5F' : '#EBF8FF';

    useEffect(() => {
        if (selected) {
            setSearchText(selected.label);
        } else if (!open) {
            setSearchText('');
        }
    }, [value, selected?.label, open]);

    const opcionesFiltradas = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, searchText]);

    const seleccionar = (opt: { id: string; label: string }) => {
        onChange(opt.id);
        setSearchText(opt.label);
        onOpenChange(false);
    };

    return (
        <View style={dropdownStyles.wrapper}>
            <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                {label}
                {required ? <Text style={{ color: '#60A5FA' }}> *</Text> : null}
            </Text>
            <View style={[dropdownStyles.anchor, open && dropdownStyles.anchorElevated]}>
                <TextInput
                    style={[
                        dropdownStyles.searchInput,
                        {
                            backgroundColor: isDarkMode ? '#0F172A' : colors.inputBackground,
                            borderColor: error ? '#EF4444' : open ? colors.primary : colors.border,
                            color: colors.text,
                        },
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.subText}
                    value={searchText}
                    onChangeText={(t) => {
                        setSearchText(t);
                        onOpenChange(true);
                        if (!t.trim()) onChange('');
                    }}
                    onFocus={() => onOpenChange(true)}
                />
                {open && (
                    <View
                        style={[
                            dropdownStyles.listOverlay,
                            dropdownStyles.listOverlayDropDown,
                            {
                                backgroundColor: panelBg,
                                borderColor: colors.border,
                            },
                            Platform.OS === 'web' && { ...dropdownStyles.listOverlayWeb, backgroundColor: panelBg },
                        ]}
                    >
                        <ScrollView
                            style={{ maxHeight: 200, backgroundColor: panelBg }}
                            contentContainerStyle={{ backgroundColor: panelBg }}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                        >
                            {opcionesFiltradas.length === 0 ? (
                                <Text style={[dropdownStyles.sinResultados, { color: colors.subText }]}>
                                    No hay productos que coincidan.
                                </Text>
                            ) : (
                                opcionesFiltradas.map((opt) => (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[
                                            dropdownStyles.item,
                                            {
                                                borderBottomColor: colors.border,
                                                backgroundColor: opt.id === value ? panelItemSelectedBg : panelItemBg,
                                            },
                                        ]}
                                        onPress={() => seleccionar(opt)}
                                    >
                                        <Text
                                            style={{
                                                color: opt.id === value ? colors.primary : colors.text,
                                                fontWeight: opt.id === value ? '600' : '400',
                                                fontSize: 15,
                                            }}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>
            {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
        </View>
    );
}

/** Autocompletado de OP igual que Sidebar (operarios) y Captura Mensual. */
function OpAutocompleteField({
    label,
    required,
    value,
    options,
    loading,
    onChangeText,
    onSelect,
    onOpenChange,
    placeholder,
    colors,
    isDarkMode,
    error,
}: {
    label: string;
    required?: boolean;
    value: string;
    options: string[];
    loading?: boolean;
    onChangeText: (text: string) => void;
    onSelect: (numero: string) => void;
    onOpenChange?: (open: boolean) => void;
    placeholder: string;
    colors: ReturnType<typeof useTheme>['colors'];
    isDarkMode: boolean;
    error?: string;
}) {
    const panelBg = isDarkMode ? '#111827' : '#FFFFFF';
    const panelItemBg = isDarkMode ? '#111827' : '#FFFFFF';
    const [listaAbierta, setListaAbierta] = useState(false);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setAbierta = useCallback(
        (open: boolean) => {
            setListaAbierta(open);
            onOpenChange?.(open);
        },
        [onOpenChange]
    );

    const opcionesFiltradas = useMemo(() => {
        const term = value.trim();
        if (!term) return [];
        return options.filter((op) => op.includes(term) && op !== term);
    }, [options, value]);

    const listaVisible = listaAbierta && value.trim() !== '' && opcionesFiltradas.length > 0;

    const handleSelect = (op: string) => {
        if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
        }
        onSelect(op);
        setAbierta(false);
    };

    const handleChange = (text: string) => {
        onChangeText(text);
        setAbierta(true);
    };

    const handleFocus = () => {
        if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
        }
        if (value.trim()) setAbierta(true);
    };

    const handleBlur = () => {
        blurTimerRef.current = setTimeout(() => setAbierta(false), 180);
    };

    useEffect(
        () => () => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        },
        []
    );

    return (
        <View style={[dropdownStyles.wrapper, listaVisible && dropdownStyles.wrapperElevated]}>
            <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                {label}
                {required ? <Text style={{ color: '#60A5FA' }}> *</Text> : null}
            </Text>
            <View style={[dropdownStyles.anchor, listaVisible && dropdownStyles.anchorElevated]}>
                <TextInput
                    style={[
                        dropdownStyles.searchInput,
                        {
                            backgroundColor: isDarkMode ? '#0F172A' : colors.inputBackground,
                            borderColor: error ? '#EF4444' : listaVisible ? colors.primary : colors.border,
                            color: colors.text,
                        },
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.subText}
                    value={value}
                    keyboardType="numeric"
                    onChangeText={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                {loading && value.trim() === '' ? (
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }}>
                        Cargando listado de OP…
                    </Text>
                ) : null}
                {listaVisible ? (
                    <View
                        style={[
                            dropdownStyles.listOverlay,
                            dropdownStyles.listOverlayDropDown,
                            {
                                backgroundColor: panelBg,
                                borderColor: colors.border,
                            },
                            Platform.OS === 'web' && {
                                ...dropdownStyles.listOverlayWeb,
                                backgroundColor: panelBg,
                                boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
                            },
                        ]}
                    >
                        <ScrollView
                            style={{ maxHeight: 200, backgroundColor: panelBg }}
                            contentContainerStyle={{ backgroundColor: panelBg }}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="always"
                            showsVerticalScrollIndicator={opcionesFiltradas.length > 5}
                        >
                            {opcionesFiltradas.map((op, idx) => (
                                <TouchableOpacity
                                    key={op}
                                    style={[
                                        dropdownStyles.item,
                                        {
                                            backgroundColor: panelItemBg,
                                            borderBottomColor: colors.border,
                                            borderBottomWidth: idx < opcionesFiltradas.length - 1 ? 1 : 0,
                                        },
                                    ]}
                                    onPress={() => handleSelect(op)}
                                >
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                                        {op}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}
            </View>
            {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
        </View>
    );
}

function fechaToIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function CampoFechaRequerida({
    value,
    onChange,
    colors,
    isDarkMode,
    inputBg,
}: {
    value: string;
    onChange: (iso: string) => void;
    colors: ReturnType<typeof useTheme>['colors'];
    isDarkMode: boolean;
    inputBg: string;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const borderColor = colors.border;
    const textColor = colors.text;

    if (Platform.OS === 'web') {
        return (
            <input
                type="date"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    padding: '0 12px',
                    fontSize: 14,
                    color: textColor,
                    backgroundColor: inputBg,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    colorScheme: isDarkMode ? 'dark' : 'light',
                }}
            />
        );
    }

    const fechaDate = value ? new Date(`${value}T12:00:00`) : new Date();

    return (
        <View>
            <TouchableOpacity
                style={[fechaStyles.trigger, { backgroundColor: inputBg, borderColor }]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.8}
            >
                <Text style={{ color: value ? textColor : colors.subText, fontSize: 14 }}>
                    {value ? formatFechaDisplay(value) : 'Seleccionar fecha...'}
                </Text>
                <Text style={{ fontSize: 16 }}>📅</Text>
            </TouchableOpacity>
            {showPicker && (
                <DateTimePicker
                    value={fechaDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        if (Platform.OS === 'android') setShowPicker(false);
                        if (event.type === 'dismissed') {
                            setShowPicker(false);
                            return;
                        }
                        if (date) onChange(fechaToIso(date));
                        if (Platform.OS === 'ios') setShowPicker(false);
                    }}
                />
            )}
        </View>
    );
}

const fechaStyles = StyleSheet.create({
    trigger: {
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});

export default function AlmacenScreen() {
    const { colors, isDarkMode } = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 900;

    const [activeTab, setActiveTab] = useState<TabAlmacen>('requisicion');
    const [tipoRequisicionActivo, setTipoRequisicionActivo] = useState<TipoRequisicionId>('consumo_diario');
    const [paginaRequisicion, setPaginaRequisicion] = useState(1);
    const [filtroEstadoRequisicion, setFiltroEstadoRequisicion] = useState<FiltroEstadoValor>('todos');
    const [requisiciones, setRequisiciones] = useState<Requisicion[]>([]);
    const [catalogoProveedores, setCatalogoProveedores] = useState<ProveedorCatalogo[]>([]);
    const [productos, setProductos] = useState<ProductoInsumo[]>([]);
    const [unidadesMedida, setUnidadesMedida] = useState<string[]>(UNIDADES_MEDIDA);
    const [opsUnicos, setOpsUnicos] = useState<string[]>([]);
    const [cargandoOps, setCargandoOps] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [notificacionesCorreo, setNotificacionesCorreo] = useState<string[]>([]);
    const [notificacionesCorreoVisible, setNotificacionesCorreoVisible] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [borrandoPruebas, setBorrandoPruebas] = useState(false);
    const [importandoProductosExcel, setImportandoProductosExcel] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRequisicionId, setEditingRequisicionId] = useState<string | null>(null);
    const [form, setForm] = useState<FormRequisicion>(emptyForm);
    const [opSearch, setOpSearch] = useState('');
    const [menuDesplegableAbierto, setMenuDesplegableAbierto] = useState<'producto' | 'unidad' | null>(null);
    const [opListaAbierta, setOpListaAbierta] = useState(false);
    const [cargandoDatosOp, setCargandoDatosOp] = useState(false);
    const [mensajeAutofillOp, setMensajeAutofillOp] = useState('');
    const [erroresForm, setErroresForm] = useState<Partial<Record<FormFieldKey, string>>>({});
    const [opsRelacionadas, setOpsRelacionadas] = useState<OpRelacionadaForm[]>([]);
    const [erroresOpsRelacionadas, setErroresOpsRelacionadas] = useState<
        Record<string, Partial<Record<'ordenProduccionNumero' | 'cliente' | 'referencia', string>>>
    >({});
    const lastAutofillOpRef = useRef('');
    const autofillTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const cardBg = isDarkMode ? '#1E293B' : colors.card;
    const inputBg = isDarkMode ? '#0F172A' : colors.inputBackground;
    const pageBg = isDarkMode ? '#0F172A' : colors.background;

    const tipoActivoMeta = useMemo(
        () => TIPOS_REQUISICION.find((t) => t.id === tipoRequisicionActivo) ?? TIPOS_REQUISICION[0],
        [tipoRequisicionActivo]
    );

    const requisicionesDelTipoSinEstado = useMemo(
        () => requisiciones.filter((r) => r.tipoRequisicion === tipoRequisicionActivo),
        [requisiciones, tipoRequisicionActivo]
    );

    const conteoEstadoEnTipo = useMemo(() => {
        const base = requisicionesDelTipoSinEstado;
        return {
            todos: base.length,
            Pendiente: base.filter((r) => r.estado === 'Pendiente').length,
            Pedido: base.filter((r) => r.estado === 'Pedido').length,
            Parcial: base.filter((r) => r.estado === 'Parcial').length,
            'En Almacen': base.filter((r) => r.estado === 'En Almacen').length,
        };
    }, [requisicionesDelTipoSinEstado]);

    const requisicionesDelTipo = useMemo(() => {
        const filtradas =
            filtroEstadoRequisicion === 'todos'
                ? requisicionesDelTipoSinEstado
                : requisicionesDelTipoSinEstado.filter((r) => r.estado === filtroEstadoRequisicion);
        return ordenarRequisicionesMasRecientesPrimero(filtradas);
    }, [requisicionesDelTipoSinEstado, filtroEstadoRequisicion]);

    const totalRequisicionesTipo = requisicionesDelTipo.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRequisicionesTipo / REQUISICIONES_POR_PAGINA));
    const paginaActual = Math.min(paginaRequisicion, totalPaginas);
    const indiceInicio = (paginaActual - 1) * REQUISICIONES_POR_PAGINA;
    const indiceFin = Math.min(indiceInicio + REQUISICIONES_POR_PAGINA, totalRequisicionesTipo);
    const requisicionesPagina = useMemo(
        () => requisicionesDelTipo.slice(indiceInicio, indiceFin),
        [requisicionesDelTipo, indiceInicio, indiceFin]
    );

    useEffect(() => {
        if (paginaRequisicion > totalPaginas) {
            setPaginaRequisicion(totalPaginas);
        }
    }, [paginaRequisicion, totalPaginas, tipoRequisicionActivo, filtroEstadoRequisicion]);

    const handleCambioFiltroEstado = (estado: FiltroEstadoValor) => {
        setFiltroEstadoRequisicion(estado);
        setPaginaRequisicion(1);
    };

    const productosDelTipo = useMemo(
        () => productos.filter((p) => p.tipoRequisicion === tipoRequisicionActivo),
        [productos, tipoRequisicionActivo]
    );

    useEffect(() => {
        let cancelado = false;
        (async () => {
            setCargando(true);
            try {
                const [catalogos, reqs, provs] = await Promise.all([
                    getCatalogos(),
                    getRequisiciones(),
                    getProveedores(),
                ]);
                if (cancelado) return;
                setProductos(catalogos.productos);
                if (catalogos.unidadesMedida.length > 0) {
                    setUnidadesMedida(catalogos.unidadesMedida);
                }
                setNotificacionesCorreo(catalogos.notificaciones?.correosDestino ?? []);
                setRequisiciones(reqs);
                setCatalogoProveedores(provs);
            } catch (error) {
                if (!cancelado) {
                    almacenAlert(
                        'Error al cargar',
                        extraerMensajeErrorApi(error, 'No se pudo cargar el módulo de almacén.')
                    );
                }
            } finally {
                if (!cancelado) setCargando(false);
            }
        })();
        return () => {
            cancelado = true;
        };
    }, []);

    const cargarOpsUnicos = useCallback(async () => {
        setCargandoOps(true);
        try {
            const ops = await listarOpsUnicos();
            setOpsUnicos(ops);
        } catch {
            setOpsUnicos([]);
        } finally {
            setCargandoOps(false);
        }
    }, []);

    useEffect(() => {
        if (!modalVisible) return;
        cargarOpsUnicos();
    }, [modalVisible, cargarOpsUnicos]);

    useEffect(
        () => () => {
            Object.values(autofillTimersRef.current).forEach((t) => clearTimeout(t));
            autofillTimersRef.current = {};
        },
        []
    );

    const buscarDatosOpAutofill = useCallback(async (digits: string) => {
        const catalogo = await buscarCatalogoOp(digits);
        if (catalogo?.cliente || catalogo?.referencia) {
            return {
                cliente: catalogo.cliente?.trim() || '',
                referencia: catalogo.referencia?.trim() || '',
                ordenProduccionId: catalogo.id != null ? String(catalogo.id) : '',
                mensaje: 'Cliente y referencia desde catálogo de OP',
            };
        }

        const data = await obtenerDatosAdjuntos(digits, false);
        const mapped = camposRequisicionDesdeAdjuntos(data);
        if (!mapped) {
            return {
                cliente: '',
                referencia: '',
                ordenProduccionId: '',
                mensaje: 'Sin datos OCR para esta OP; puede escribir cliente y referencia.',
            };
        }
        const fuente = data?.op?.campos ? 'PDF/OP' : 'ficha';
        return {
            cliente: mapped.cliente?.trim() || '',
            referencia: mapped.referencia?.trim() || '',
            ordenProduccionId: '',
            mensaje: `Cliente y referencia desde adjunto OCR (${fuente})`,
        };
    }, []);

    useEffect(() => {
        if (!modalVisible) return;
        const digits = opSearch.replace(/\D/g, '');
        if (digits.length < 4) {
            setMensajeAutofillOp('');
            return;
        }
        if (lastAutofillOpRef.current === digits) return;

        let cancelado = false;
        const timer = setTimeout(async () => {
            setCargandoDatosOp(true);
            setMensajeAutofillOp('');
            try {
                if (cancelado) return;
                const auto = await buscarDatosOpAutofill(digits);
                if (cancelado) return;
                lastAutofillOpRef.current = digits;
                setForm((prev) => ({
                    ...prev,
                    cliente: auto.cliente || prev.cliente,
                    referencia: auto.referencia || prev.referencia,
                    ordenProduccionId: auto.ordenProduccionId || prev.ordenProduccionId,
                }));
                setMensajeAutofillOp(auto.mensaje);
            } catch {
                if (!cancelado) {
                    setMensajeAutofillOp('No se pudieron leer los adjuntos; complete cliente y referencia.');
                }
            } finally {
                if (!cancelado) setCargandoDatosOp(false);
            }
        }, 600);

        return () => {
            cancelado = true;
            clearTimeout(timer);
        };
    }, [modalVisible, opSearch, buscarDatosOpAutofill]);

    useEffect(() => {
        if (!modalVisible) return;
        setErroresForm((prev) => {
            const keys = Object.keys(prev) as FormFieldKey[];
            if (keys.length === 0) return prev;
            let changed = false;
            const next = { ...prev };
            for (const key of keys) {
                if (campoRequisicionValido(key, form, opSearch)) {
                    delete next[key];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [modalVisible, form, opSearch]);

    useEffect(() => {
        if (!modalVisible) return;
        setErroresOpsRelacionadas((prev) => {
            const ids = Object.keys(prev);
            if (ids.length === 0) return prev;
            let changed = false;
            const next = { ...prev };
            for (const id of ids) {
                const op = opsRelacionadas.find((r) => r.id === id);
                if (!op) continue;
                const rowErr = { ...prev[id] };
                const numero = op.ordenProduccionNumero.trim() || normalizarNumeroOp(op.opSearch);
                if (rowErr.ordenProduccionNumero && numero) {
                    delete rowErr.ordenProduccionNumero;
                    changed = true;
                }
                if (rowErr.cliente && op.cliente.trim()) {
                    delete rowErr.cliente;
                    changed = true;
                }
                if (rowErr.referencia && op.referencia.trim()) {
                    delete rowErr.referencia;
                    changed = true;
                }
                if (Object.keys(rowErr).length === 0) {
                    delete next[id];
                } else {
                    next[id] = rowErr;
                }
            }
            return changed ? next : prev;
        });
    }, [modalVisible, opsRelacionadas]);

    const conteoPorTipo = useMemo(() => {
        const map: Record<TipoRequisicionId, number> = {
            consumo_diario: 0,
            cajas_empaque: 0,
            gomas_adhesivos: 0,
            pantone: 0,
        };
        requisiciones.forEach((r) => {
            map[r.tipoRequisicion] = (map[r.tipoRequisicion] ?? 0) + 1;
        });
        return map;
    }, [requisiciones]);

    const handleOpSearchChange = useCallback((t: string) => {
        const numericText = t.replace(/[^0-9]/g, '');
        setOpSearch(numericText);
        setErroresForm((prev) => {
            if (!prev.ordenProduccionNumero) return prev;
            const next = { ...prev };
            delete next.ordenProduccionNumero;
            return next;
        });
        if (numericText !== lastAutofillOpRef.current) {
            setMensajeAutofillOp('');
        }
        if (!numericText) {
            lastAutofillOpRef.current = '';
            setForm((prev) => ({
                ...prev,
                ordenProduccionId: '',
                ordenProduccionNumero: '',
            }));
        } else {
            lastAutofillOpRef.current = '';
            setForm((prev) => ({
                ...prev,
                ordenProduccionId: '',
                ordenProduccionNumero: numericText.length >= 4 ? `OP-${numericText}` : numericText,
            }));
        }
    }, []);

    const openModal = useCallback(() => {
        setEditingRequisicionId(null);
        setForm(emptyForm());
        setErroresForm({});
        setOpsRelacionadas([]);
        setErroresOpsRelacionadas({});
        setOpSearch('');
        setMenuDesplegableAbierto(null);
        setOpListaAbierta(false);
        setMensajeAutofillOp('');
        lastAutofillOpRef.current = '';
        setModalVisible(true);
    }, []);

    const openModalEditar = useCallback((req: Requisicion) => {
        if (req.estado !== 'Pendiente') return;

        const productosTipo = productos.filter((p) => p.tipoRequisicion === req.tipoRequisicion);
        const prod =
            productosTipo.find((p) => p.nombre === req.producto) ??
            productosTipo.find((p) => p.nombre.toLowerCase() === req.producto.toLowerCase());

        const ops = splitCampoMultiplesOps(req.ordenProduccion);
        const clientes = splitCampoMultiplesOps(req.cliente);
        const referencias = splitCampoMultiplesOps(req.referencia);
        const opPrincipal = ops[0] ?? req.ordenProduccion;
        const clientePrincipal = clientes[0] ?? req.cliente;
        const referenciaPrincipal = referencias[0] ?? req.referencia;
        const extras: OpRelacionadaForm[] = ops.slice(1).map((op, idx) => {
            const digits = op.replace(/\D/g, '');
            return {
                ...crearOpRelacionadaVacia(),
                ordenProduccionNumero: op,
                opSearch: digits,
                cliente: clientes[idx + 1] ?? '',
                referencia: referencias[idx + 1] ?? '',
            };
        });

        setEditingRequisicionId(req.id);
        setErroresForm({});
        setErroresOpsRelacionadas({});
        setOpsRelacionadas(extras);
        setForm({
            ordenProduccionId: '',
            ordenProduccionNumero: opPrincipal,
            cliente: clientePrincipal,
            referencia: referenciaPrincipal,
            productoId: prod?.id ?? '',
            fechaSolicitud: req.fechaSolicitud,
            fechaRequerida: req.fechaRequerida,
            cantidad: String(req.cantidad),
            unidad: req.unidad,
            observacion: req.observacion ?? '',
        });
        setOpSearch(opPrincipal.replace(/\D/g, ''));
        setMenuDesplegableAbierto(null);
        setOpListaAbierta(false);
        setMensajeAutofillOp('');
        lastAutofillOpRef.current = opPrincipal.replace(/\D/g, '');
        setModalVisible(true);
    }, [productos]);

    const selectOpNumero = useCallback((numero: string) => {
        const digits = numero.replace(/\D/g, '');
        lastAutofillOpRef.current = '';
        setOpSearch(digits);
        setErroresForm((prev) => {
            if (!prev.ordenProduccionNumero) return prev;
            const next = { ...prev };
            delete next.ordenProduccionNumero;
            return next;
        });
        setOpListaAbierta(false);
        setForm((prev) => ({
            ...prev,
            ordenProduccionId: '',
            ordenProduccionNumero: `OP-${digits}`,
        }));
        setMensajeAutofillOp('');
    }, []);

    const limpiarErrorOpRelacionada = (
        opId: string,
        field: 'ordenProduccionNumero' | 'cliente' | 'referencia'
    ) => {
        setErroresOpsRelacionadas((prev) => {
            const rowErrors = prev[opId];
            if (!rowErrors?.[field]) return prev;
            const nextRow = { ...rowErrors, [field]: undefined };
            return { ...prev, [opId]: nextRow };
        });
    };

    const setOpRelacionadaPatch = (id: string, patch: Partial<OpRelacionadaForm>) => {
        setOpsRelacionadas((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const programarAutofillOpRelacionada = (id: string, digits: string) => {
        const prevTimer = autofillTimersRef.current[id];
        if (prevTimer) clearTimeout(prevTimer);
        if (digits.length < 4) return;

        autofillTimersRef.current[id] = setTimeout(async () => {
            setOpRelacionadaPatch(id, { cargando: true, mensaje: '' });
            try {
                const auto = await buscarDatosOpAutofill(digits);
                setOpsRelacionadas((prev) =>
                    prev.map((r) =>
                        r.id === id
                            ? {
                                  ...r,
                                  cliente: auto.cliente || r.cliente,
                                  referencia: auto.referencia || r.referencia,
                                  ordenProduccionId: auto.ordenProduccionId || r.ordenProduccionId,
                                  mensaje: auto.mensaje,
                                  cargando: false,
                                  lastAutofillDigits: digits,
                              }
                            : r
                    )
                );
            } catch {
                setOpRelacionadaPatch(id, {
                    cargando: false,
                    mensaje: 'No se pudieron leer adjuntos para esta OP.',
                });
            }
        }, 600);
    };

    const agregarOpRelacionada = () => {
        setOpsRelacionadas((prev) => [...prev, crearOpRelacionadaVacia()]);
    };

    const eliminarOpRelacionada = (id: string) => {
        const t = autofillTimersRef.current[id];
        if (t) clearTimeout(t);
        delete autofillTimersRef.current[id];
        setOpsRelacionadas((prev) => prev.filter((r) => r.id !== id));
        setErroresOpsRelacionadas((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleOpRelacionadaSearchChange = (id: string, value: string) => {
        const digits = value.replace(/\D/g, '');
        setOpsRelacionadas((prev) =>
            prev.map((r) =>
                r.id === id
                    ? {
                          ...r,
                          opSearch: digits,
                          ordenProduccionNumero: digits ? `OP-${digits}` : '',
                          ordenProduccionId: '',
                          mensaje: '',
                      }
                    : r
            )
        );
        limpiarErrorOpRelacionada(id, 'ordenProduccionNumero');
        programarAutofillOpRelacionada(id, digits);
    };

    const seleccionarOpRelacionada = (id: string, numero: string) => {
        const digits = numero.replace(/\D/g, '');
        setOpsRelacionadas((prev) =>
            prev.map((r) =>
                r.id === id
                    ? {
                          ...r,
                          opSearch: digits,
                          ordenProduccionNumero: `OP-${digits}`,
                          ordenProduccionId: '',
                          mensaje: '',
                      }
                    : r
            )
        );
        limpiarErrorOpRelacionada(id, 'ordenProduccionNumero');
        programarAutofillOpRelacionada(id, digits);
    };

    const handleProductoChange = (productoId: string) => {
        const prod = productosDelTipo.find((p) => p.id === productoId);
        setErroresForm((prev) => {
            const hasProductoError = !!prev.productoId;
            const hasUnidadError = !!prev.unidad && !!(prod?.unidadSugerida || '');
            if (!hasProductoError && !hasUnidadError) return prev;
            const next = { ...prev };
            delete next.productoId;
            if (prod?.unidadSugerida) delete next.unidad;
            return next;
        });
        setForm((prev) => ({
            ...prev,
            productoId,
            unidad: prod?.unidadSugerida || prev.unidad,
        }));
    };

    const handleCambioTipoHoja = (tipo: TipoRequisicionId) => {
        setTipoRequisicionActivo(tipo);
        setPaginaRequisicion(1);
        setForm((prev) => ({ ...prev, productoId: '', unidad: '' }));
        setMenuDesplegableAbierto(null);
    };

    const handleGuardar = async () => {
        const ordenProduccionNumero =
            form.ordenProduccionNumero.trim() || normalizarNumeroOp(opSearch);
        const clientePrincipal = form.cliente.trim();
        const referenciaPrincipal = form.referencia.trim();

        const errores: Partial<Record<FormFieldKey, string>> = {};
        if (!form.ordenProduccionId && !ordenProduccionNumero) errores.ordenProduccionNumero = 'Campo obligatorio.';
        if (!form.productoId) errores.productoId = 'Campo obligatorio.';
        if (!clientePrincipal) errores.cliente = 'Campo obligatorio.';
        if (!referenciaPrincipal) errores.referencia = 'Campo obligatorio.';
        if (!form.fechaSolicitud.trim()) errores.fechaSolicitud = 'Campo obligatorio.';
        if (!form.fechaRequerida.trim()) errores.fechaRequerida = 'Campo obligatorio.';
        const cantidad = parseFloat(form.cantidad.replace(',', '.'));
        if (!cantidad || cantidad <= 0) errores.cantidad = 'Ingrese un valor mayor a cero.';
        if (!form.unidad.trim()) errores.unidad = 'Campo obligatorio.';
        const erroresOps: Record<string, Partial<Record<'ordenProduccionNumero' | 'cliente' | 'referencia', string>>> = {};
        const opsExtrasNormalizadas = opsRelacionadas.map((op) => ({
            ...op,
            ordenProduccionNumero: op.ordenProduccionNumero.trim() || normalizarNumeroOp(op.opSearch),
            cliente: op.cliente.trim(),
            referencia: op.referencia.trim(),
        }));
        opsExtrasNormalizadas.forEach((op) => {
            const hayAlgo = !!(op.ordenProduccionNumero || op.cliente || op.referencia);
            if (!hayAlgo) return;
            const rowErr: Partial<Record<'ordenProduccionNumero' | 'cliente' | 'referencia', string>> = {};
            if (!op.ordenProduccionNumero) rowErr.ordenProduccionNumero = 'OP obligatoria.';
            if (!op.cliente) rowErr.cliente = 'Cliente obligatorio.';
            if (!op.referencia) rowErr.referencia = 'Referencia obligatoria.';
            if (Object.keys(rowErr).length > 0) erroresOps[op.id] = rowErr;
        });

        if (Object.keys(errores).length > 0 || Object.keys(erroresOps).length > 0) {
            setErroresForm(errores);
            setErroresOpsRelacionadas(erroresOps);
            return;
        }
        setErroresForm({});
        setErroresOpsRelacionadas({});

        const opsConsolidadas = [
            {
                ordenProduccionId: form.ordenProduccionId.trim(),
                ordenProduccionNumero,
                cliente: clientePrincipal,
                referencia: referenciaPrincipal,
            },
            ...opsExtrasNormalizadas
                .filter((op) => op.ordenProduccionNumero || op.cliente || op.referencia)
                .map((op) => ({
                    ordenProduccionId: op.ordenProduccionId.trim(),
                    ordenProduccionNumero: op.ordenProduccionNumero,
                    cliente: op.cliente,
                    referencia: op.referencia,
                })),
        ];
        const ordenesFinal = opsConsolidadas.map((o) => o.ordenProduccionNumero).filter(Boolean);
        const clientesFinal = opsConsolidadas.map((o) => o.cliente).filter(Boolean);
        const referenciasFinal = opsConsolidadas.map((o) => o.referencia).filter(Boolean);
        const opIdUnica = opsConsolidadas.length === 1 ? opsConsolidadas[0].ordenProduccionId || undefined : undefined;

        const payload = {
            tipoRequisicionId: tipoRequisicionActivo,
            ordenProduccionId: opIdUnica,
            ordenProduccionNumero: ordenesFinal.join(' | '),
            cliente: clientesFinal.join(' | '),
            referencia: referenciasFinal.join(' | '),
            productoId: form.productoId,
            fechaSolicitud: parseFechaInput(form.fechaSolicitud),
            fechaRequerida: parseFechaInput(form.fechaRequerida),
            cantidad,
            unidad: form.unidad,
            observacion: form.observacion.trim() || undefined,
        };

        setGuardando(true);
        try {
            const guardada = editingRequisicionId
                ? await updateRequisicion(editingRequisicionId, payload)
                : await createRequisicion(payload);
            setRequisiciones((prev) =>
                editingRequisicionId
                    ? mergeRequisicionEnLista(prev, guardada)
                    : [guardada, ...prev]
            );
            if (!editingRequisicionId) setPaginaRequisicion(1);
            setEditingRequisicionId(null);
            setMenuDesplegableAbierto(null);
            setModalVisible(false);
        } catch (error) {
            almacenAlert('Error al guardar', extraerMensajeErrorApi(error, 'No se pudo guardar la requisición.'));
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminarRequisicion = async (req: Requisicion) => {
        const ok = await almacenConfirm(
            'Eliminar requisición',
            `¿Borrar ${req.codigo} (${req.producto})?\n\nSe eliminarán también pedido y recepciones asociadas.`
        );
        if (!ok) return;
        try {
            await eliminarRequisicion(req.id);
            setRequisiciones((prev) => prev.filter((r) => r.id !== req.id));
            if (editingRequisicionId === req.id) {
                cerrarModalRequisicion();
            }
        } catch (error) {
            almacenAlert('Error al borrar', extraerMensajeErrorApi(error, 'No se pudo eliminar la requisición.'));
        }
    };

    const handleResetDatosPruebas = async () => {
        const ok = await almacenConfirm(
            'Borrar todo (pruebas)',
            '¿Eliminar TODAS las requisiciones, pedidos y recepciones?\n\nLos IDs volverán a empezar en 1. Los catálogos de productos y proveedores no se borran.'
        );
        if (!ok) return;
        setBorrandoPruebas(true);
        try {
            await resetDatosPruebasAlmacen();
            setRequisiciones([]);
            setEditingRequisicionId(null);
            setModalVisible(false);
            setPaginaRequisicion(1);
            almacenAlert('Listo', 'Datos de prueba eliminados. Puede registrar requisiciones desde REQ-001.');
        } catch (error) {
            almacenAlert('Error al borrar', extraerMensajeErrorApi(error, 'No se pudo vaciar los datos.'));
        } finally {
            setBorrandoPruebas(false);
        }
    };

    const handleGuardarPedido = async (requisicionId: string, datos: DatosPedido) => {
        const actualizada = await guardarPedidoRequisicion(requisicionId, datos);
        setRequisiciones((prev) => mergeRequisicionEnLista(prev, actualizada));
    };

    const handleConsolidarPedido = async (payload: Parameters<typeof consolidarPedidoOc>[0]) => {
        const result = await consolidarPedidoOc(payload);
        setRequisiciones((prev) => {
            let next = prev;
            for (const r of result.requisiciones) {
                next = mergeRequisicionEnLista(next, r);
            }
            return next;
        });
        return result.ordenCompra;
    };

    const handleMarcarProveedorPagado = async (
        requisicionId: string,
        proveedorId: string,
        pagado: boolean,
        formaPago?: 'credito' | 'efectivo'
    ) => {
        const actualizada = await marcarProveedorPagado(requisicionId, proveedorId, pagado, formaPago);
        setRequisiciones((prev) => mergeRequisicionEnLista(prev, actualizada));
    };

    const handleRegistrarRecepcion = async (requisicionId: string, linea: RecepcionLineaProveedor) => {
        const actualizada = await registrarRecepcionRequisicion(requisicionId, linea);
        setRequisiciones((prev) => mergeRequisicionEnLista(prev, actualizada));
        return actualizada;
    };

    const handleGuardarProveedorCatalogo = async (payload: {
        id?: string;
        nombre: string;
        nit?: string;
        correo?: string;
        telefonoTrabajo?: string;
        telefonoMovil?: string;
        direccion?: string;
        categoria?: string;
        responsableIva?: boolean;
    }) => {
        if (payload.id) {
            const actualizado = await updateProveedor(payload.id, payload);
            setCatalogoProveedores((prev) =>
                prev.map((c) => (c.id === actualizado.id ? actualizado : c))
            );
            return actualizado;
        }
        const creado = await createProveedor(payload);
        setCatalogoProveedores((prev) => [...prev, creado]);
        return creado;
    };

    const handleRecargarCatalogoProveedores = async () => {
        const provs = await getProveedores();
        setCatalogoProveedores(provs);
    };

    const handleRecargarCatalogoProductos = async () => {
        const catalogos = await getCatalogos();
        setProductos(catalogos.productos);
        if (catalogos.unidadesMedida.length > 0) {
            setUnidadesMedida(catalogos.unidadesMedida);
        }
    };

    const handleGuardarProductoCatalogo = async (payload: {
        id?: string;
        nombre: string;
        descripcion?: string;
        costoEstandar?: number;
        tipoRequisicion: TipoRequisicionId;
        unidadSugerida?: string;
    }) => {
        if (payload.id) {
            const actualizado = await updateProducto(payload.id, payload);
            setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
            return actualizado;
        }
        const creado = await createProducto(payload);
        setProductos((prev) => [...prev, creado]);
        return creado;
    };

    const handleEliminarProductoCatalogo = async (id: string) => {
        await deleteProducto(id);
        setProductos((prev) => prev.filter((p) => p.id !== id));
    };

    const handleEliminarProveedorCatalogo = async (id: string) => {
        await deleteProveedor(id);
        setCatalogoProveedores((prev) => prev.filter((p) => p.id !== id));
    };

    const handleImportarProductosExcel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                ],
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;

            const asset = result.assets[0];
            setImportandoProductosExcel(true);

            let archivo: File | Blob | { uri: string; name: string; type?: string };
            if (Platform.OS === 'web') {
                const webFile = (asset as { file?: File }).file;
                if (!webFile) {
                    almacenAlert('Importar productos', 'No se pudo leer el archivo seleccionado.');
                    return;
                }
                archivo = webFile;
            } else {
                archivo = {
                    uri: asset.uri,
                    name: asset.name || 'productos.xlsx',
                    type:
                        asset.mimeType ||
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                };
            }

            const data = await importarProductosExcel(archivo, asset.name || 'productos.xlsx');
            await handleRecargarCatalogoProductos();

            const partes = [
                `${data.importados} producto(s) importado(s).`,
                data.omitidosDuplicados > 0
                    ? `${data.omitidosDuplicados} omitido(s) por duplicado.`
                    : null,
                data.filasVacias > 0 ? `${data.filasVacias} fila(s) vacía(s) ignorada(s).` : null,
                data.filasInvalidas > 0 ? `${data.filasInvalidas} fila(s) inválida(s) ignorada(s).` : null,
            ].filter(Boolean);

            almacenAlert('Importación de productos completada', partes.join('\n'));
        } catch (error) {
            almacenAlert(
                'Error al importar productos',
                extraerMensajeErrorApi(error, 'No se pudo importar el archivo de productos.')
            );
        } finally {
            setImportandoProductosExcel(false);
        }
    };

    const cerrarModalRequisicion = () => {
        setEditingRequisicionId(null);
        setErroresForm({});
        setOpsRelacionadas([]);
        setErroresOpsRelacionadas({});
        Object.values(autofillTimersRef.current).forEach((t) => clearTimeout(t));
        autofillTimersRef.current = {};
        setMenuDesplegableAbierto(null);
        setOpListaAbierta(false);
        setOpSearch('');
        setMensajeAutofillOp('');
        lastAutofillOpRef.current = '';
        setModalVisible(false);
    };

    const tableColumns: {
        key: string;
        label: string;
        flex: number;
        minWidth: number;
        render: (req: Requisicion) => React.ReactNode;
    }[] = [
        { key: 'codigo', label: 'COD.', flex: 0.85, minWidth: 88, render: (req) => req.codigo },
        {
            key: 'fechaSolicitud',
            label: 'FECHA SOL.',
            flex: 1,
            minWidth: 108,
            render: (req) => (
                <View>
                    <Text style={[styles.td, { color: colors.text }]}>
                        {formatFechaDisplay(req.fechaSolicitud) || req.fechaSolicitud}
                    </Text>
                    {req.horaRegistro ? (
                        <Text style={[styles.tdCantidadPedido, { color: colors.subText }]}>
                            {req.horaRegistro}
                        </Text>
                    ) : null}
                </View>
            ),
        },
        {
            key: 'ordenProduccion',
            label: 'ORDEN PROD.',
            flex: 1.2,
            minWidth: 130,
            render: (req) => (
                <CeldaValoresApilados
                    valores={splitCampoMultiplesOps(req.ordenProduccion)}
                    color={colors.text}
                />
            ),
        },
        {
            key: 'cliente',
            label: 'CLIENTE',
            flex: 1.35,
            minWidth: 160,
            render: (req) => (
                <CeldaValoresApilados valores={splitCampoMultiplesOps(req.cliente)} color={colors.text} />
            ),
        },
        {
            key: 'referencia',
            label: 'REFERENCIA',
            flex: 1.35,
            minWidth: 180,
            render: (req) => (
                <CeldaValoresApilados valores={splitCampoMultiplesOps(req.referencia)} color={colors.text} />
            ),
        },
        {
            key: 'producto',
            label: 'PRODUCTO',
            flex: 1.25,
            minWidth: 170,
            render: (req) => <CeldaTextoTabla texto={req.producto} color={colors.text} />,
        },
        {
            key: 'cantidad',
            label: 'CANT.',
            flex: 1.05,
            minWidth: 120,
            render: (req) => {
                const totalPedido = req.pedido ? getCantidadTotalPedido(req.pedido) : null;
                return (
                    <View>
                        <Text style={[styles.td, { color: colors.text }]}>
                            Req: {req.cantidad} {req.unidad}
                        </Text>
                        {totalPedido !== null && totalPedido > 0 ? (
                            <Text style={[styles.tdCantidadPedido, { color: colors.subText }]}>
                                Ped: {totalPedido} {req.unidad}
                            </Text>
                        ) : (
                            <Text style={[styles.tdCantidadPedido, { color: colors.subText }]}>Ped: —</Text>
                        )}
                    </View>
                );
            },
        },
        {
            key: 'precio',
            label: 'PRECIO / TOTAL',
            flex: 1.05,
            minWidth: 130,
            render: (req) => {
                if (!req.pedido) {
                    return <Text style={[styles.td, { color: colors.subText }]}>—</Text>;
                }
                const totalMonetario = getTotalPedidoMonetario(req.pedido);
                const provs = req.pedido.proveedores ?? [];
                if (totalMonetario <= 0) {
                    return <Text style={[styles.td, { color: colors.subText }]}>—</Text>;
                }
                return (
                    <View>
                        <Text style={[styles.td, { color: colors.text, fontWeight: '700' }]}>
                            {formatearMonedaCop(totalMonetario)}
                        </Text>
                        {provs.length === 1 &&
                        provs[0]?.precioUnitario != null &&
                        provs[0].precioUnitario > 0 ? (
                            <Text style={[styles.tdCantidadPedido, { color: colors.subText }]}>
                                {formatearMonedaCop(provs[0].precioUnitario)} / {req.unidad}
                            </Text>
                        ) : provs.length > 1 ? (
                            <Text style={[styles.tdCantidadPedido, { color: colors.subText }]}>
                                {provs.length} proveedores
                            </Text>
                        ) : null}
                    </View>
                );
            },
        },
        { key: 'fechaRequerida', label: 'FECHA REQ.', flex: 1, minWidth: 108, render: (req) => req.fechaRequerida },
        {
            key: 'observacion',
            label: 'OBSERVACIÓN',
            flex: 1.15,
            minWidth: 150,
            render: (req) => <CeldaTextoTabla texto={req.observacion} color={colors.text} />,
        },
        {
            key: 'ingresadoPor',
            label: 'INGRESADO POR',
            flex: 1,
            minWidth: 120,
            render: (req) => (
                <CeldaTextoTabla texto={textoIngresadoPorRequisicion(req)} color={colors.text} />
            ),
        },
        {
            key: 'estado',
            label: 'ESTADO',
            flex: 0.95,
            minWidth: 110,
            render: (req) => <AlmacenEstadoBadge estado={req.estado} />,
        },
        {
            key: 'acciones',
            label: 'ACCIONES',
            flex: 1.1,
            minWidth: 150,
            render: (req) => (
                <View style={styles.accionesReqRow}>
                    {req.estado === 'Pendiente' ? (
                        <TouchableOpacity
                            style={[styles.btnEditarReq, { borderColor: colors.border }]}
                            onPress={() => openModalEditar(req)}
                        >
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Editar</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={[styles.btnBorrarReq, { borderColor: '#EF4444' }]}
                        onPress={() => handleEliminarRequisicion(req)}
                    >
                        <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Borrar</Text>
                    </TouchableOpacity>
                </View>
            ),
        },
    ];

    const renderRequisicionTab = () => {
        const tableMinWidth = tableColumns.reduce((sum, col) => sum + col.minWidth, 0);
        const tablaRequiereScroll = width < tableMinWidth + 32;

        const tableContent = (
            <>
                <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                    {tableColumns.map((col) => (
                        <View key={col.key} style={[styles.tableCell, { flex: col.flex, minWidth: col.minWidth }]}>
                            <Text style={[styles.th, { color: colors.subText }]}>{col.label}</Text>
                        </View>
                    ))}
                </View>

                {totalRequisicionesTipo === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.subText }]}>
                        {filtroEstadoRequisicion === 'todos'
                            ? `No hay requisiciones en «${tipoActivoMeta.label}».`
                            : `No hay requisiciones en estado «${
                                  OPCIONES_FILTRO_ESTADO_REQUISICION.find((o) => o.id === filtroEstadoRequisicion)
                                      ?.label ?? filtroEstadoRequisicion
                              }» en «${tipoActivoMeta.label}».`}
                    </Text>
                ) : (
                    requisicionesPagina.map((req, idx) => (
                        <View
                            key={req.id}
                            style={[
                                styles.tableRow,
                                {
                                    borderBottomColor: colors.border,
                                    backgroundColor:
                                        idx % 2 === 0
                                            ? isDarkMode
                                                ? 'transparent'
                                                : colors.rowEven
                                            : isDarkMode
                                              ? 'rgba(15, 23, 42, 0.4)'
                                              : colors.rowOdd,
                                },
                            ]}
                        >
                            {tableColumns.map((col) => {
                                const contenido = col.render(req);
                                return (
                                    <View
                                        key={col.key}
                                        style={[styles.tableCell, { flex: col.flex, minWidth: col.minWidth }]}
                                    >
                                        {typeof contenido === 'string' || typeof contenido === 'number' ? (
                                            <Text style={[styles.td, styles.tdWrap, { color: colors.text }]}>
                                                {contenido}
                                            </Text>
                                        ) : (
                                            contenido
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ))
                )}
            </>
        );

        return (
            <View style={[styles.card, styles.cardRequisicion, { backgroundColor: cardBg, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Listado de Requisiciones</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.subText }]}>{tipoActivoMeta.label}</Text>
                    </View>
                    <View style={styles.cardHeaderActions}>
                        <TouchableOpacity
                            style={[
                                styles.btnImportarProductos,
                                { borderColor: colors.border },
                                importandoProductosExcel && { opacity: 0.6 },
                            ]}
                            onPress={handleImportarProductosExcel}
                            disabled={importandoProductosExcel}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.btnImportarProductosText, { color: colors.text }]}>
                                {importandoProductosExcel ? 'Importando productos…' : 'Importar productos Excel'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.btnBorrarTodoPruebas,
                                { borderColor: '#EF4444' },
                                borrandoPruebas && { opacity: 0.6 },
                            ]}
                            onPress={handleResetDatosPruebas}
                            disabled={borrandoPruebas}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.btnBorrarTodoPruebasText}>
                                {borrandoPruebas ? 'Borrando…' : 'Borrar todo (pruebas)'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={openModal} activeOpacity={0.85}>
                            <Text style={styles.primaryBtnText}>+ Registrar requisición</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <AlmacenFiltroEstado
                    opciones={OPCIONES_FILTRO_ESTADO_REQUISICION}
                    activo={filtroEstadoRequisicion}
                    onChange={handleCambioFiltroEstado}
                    conteos={conteoEstadoEnTipo}
                    colors={colors}
                    isDarkMode={isDarkMode}
                />

                {tablaRequiereScroll ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={[styles.tableWrapNarrow, { minWidth: tableMinWidth }]}>{tableContent}</View>
                    </ScrollView>
                ) : (
                    <View style={styles.tableWrap}>{tableContent}</View>
                )}

                {totalRequisicionesTipo > 0 && (
                    <View style={[styles.paginationBar, { borderTopColor: colors.border }]}>
                        <Text style={[styles.paginationInfo, { color: colors.subText }]}>
                            Mostrando {indiceInicio + 1}–{indiceFin} de {totalRequisicionesTipo}
                            {' · '}
                            Página {paginaActual} de {totalPaginas}
                        </Text>
                        <View style={styles.paginationControls}>
                            <TouchableOpacity
                                style={[
                                    styles.paginationBtn,
                                    { borderColor: colors.border },
                                    paginaActual <= 1 && styles.paginationBtnDisabled,
                                ]}
                                onPress={() => setPaginaRequisicion((p) => Math.max(1, p - 1))}
                                disabled={paginaActual <= 1}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.paginationBtnText,
                                        { color: paginaActual <= 1 ? colors.subText : colors.text },
                                    ]}
                                >
                                    ← Anterior
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.paginationBtn,
                                    styles.paginationBtnPrimary,
                                    paginaActual >= totalPaginas && styles.paginationBtnDisabled,
                                ]}
                                onPress={() => setPaginaRequisicion((p) => Math.min(totalPaginas, p + 1))}
                                disabled={paginaActual >= totalPaginas}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.paginationBtnText,
                                        styles.paginationBtnTextPrimary,
                                        paginaActual >= totalPaginas && { opacity: 0.5 },
                                    ]}
                                >
                                    Siguiente →
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View
                    style={[
                        styles.sheetTabsBar,
                        {
                            backgroundColor: isDarkMode ? '#0F172A' : '#E8ECF0',
                            borderTopColor: colors.border,
                        },
                    ]}
                >
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.sheetTabsScroll}
                    >
                        {TIPOS_REQUISICION.map((tipo) => {
                            const activa = tipoRequisicionActivo === tipo.id;
                            const count = conteoPorTipo[tipo.id] ?? 0;
                            return (
                                <TouchableOpacity
                                    key={tipo.id}
                                    style={[
                                        styles.sheetTab,
                                        {
                                            backgroundColor: activa
                                                ? isDarkMode
                                                    ? '#1E293B'
                                                    : '#FFFFFF'
                                                : isDarkMode
                                                  ? '#1E293B'
                                                  : '#D1D9E6',
                                            borderTopColor: activa ? tipo.accentColor : 'transparent',
                                        },
                                        activa && styles.sheetTabActive,
                                    ]}
                                    onPress={() => handleCambioTipoHoja(tipo.id)}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.sheetTabText,
                                            {
                                                color: activa ? colors.text : colors.subText,
                                                fontWeight: activa ? '700' : '500',
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {tipo.label}
                                    </Text>
                                    {count > 0 && (
                                        <AlmacenContadorBadge
                                            count={count}
                                            accentColor={tipo.accentColor}
                                            variant="tab"
                                            activo={activa}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        );
    };

    const renderPlaceholderTab = (titulo: string) => (
        <View style={[styles.card, styles.placeholderCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <Text style={[styles.placeholderTitle, { color: colors.text }]}>{titulo}</Text>
            <Text style={[styles.placeholderSub, { color: colors.subText }]}>
                Esta sección estará disponible próximamente.
            </Text>
        </View>
    );

    const colConMenuAbierto = (id: 'producto' | 'unidad') =>
        menuDesplegableAbierto === id ? styles.formColElevated : null;

    const handleOpOpenChange = useCallback((open: boolean) => {
        setOpListaAbierta(open);
        if (open) setMenuDesplegableAbierto(null);
    }, []);

    const handleProductoOpenChange = useCallback((next: boolean) => {
        if (next) setOpListaAbierta(false);
        setMenuDesplegableAbierto(next ? 'producto' : null);
    }, []);

    const handleUnidadOpenChange = useCallback((next: boolean) => {
        if (next) setOpListaAbierta(false);
        setMenuDesplegableAbierto(next ? 'unidad' : null);
    }, []);

    const formularioRequisicion = (
        <View style={[styles.formGrid, isWide && styles.formGridWide]}>
            <View
                style={[
                    styles.formCol,
                    isWide && styles.formColHalf,
                    opListaAbierta ? styles.formColElevated : null,
                ]}
            >
                <OpAutocompleteField
                    label="Orden de producción"
                    required
                    value={opSearch}
                    options={opsUnicos}
                    loading={cargandoOps}
                    onChangeText={handleOpSearchChange}
                    onSelect={selectOpNumero}
                    onOpenChange={handleOpOpenChange}
                    placeholder="Buscar OP (números)..."
                    colors={colors}
                    isDarkMode={isDarkMode}
                    error={erroresForm.ordenProduccionNumero}
                />
                {cargandoDatosOp ? (
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }}>
                        Buscando datos de la OP en adjuntos…
                    </Text>
                ) : mensajeAutofillOp ? (
                    <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }}>{mensajeAutofillOp}</Text>
                ) : null}
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf, colConMenuAbierto('producto')]}>
                <SearchableSelectDropdown
                    label="Producto o insumo"
                    required
                    value={form.productoId}
                    options={productosDelTipo.map((p) => ({ id: p.id, label: p.nombre }))}
                    onChange={handleProductoChange}
                    placeholder="Buscar producto..."
                    colors={colors}
                    isDarkMode={isDarkMode}
                    open={menuDesplegableAbierto === 'producto'}
                    onOpenChange={handleProductoOpenChange}
                    error={erroresForm.productoId}
                />
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf]}>
                <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                    Cliente <Text style={{ color: '#60A5FA' }}> *</Text>
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: inputBg,
                            borderColor: erroresForm.cliente ? '#EF4444' : colors.border,
                            color: colors.text,
                        },
                    ]}
                    value={form.cliente}
                    placeholder="Nombre del cliente"
                    placeholderTextColor={colors.subText}
                    onChangeText={(t) => {
                        setForm((prev) => ({ ...prev, cliente: t }));
                        if (erroresForm.cliente) setErroresForm((prev) => ({ ...prev, cliente: undefined }));
                    }}
                />
                {erroresForm.cliente ? <Text style={styles.fieldErrorText}>{erroresForm.cliente}</Text> : null}
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf]}>
                <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                    Referencia <Text style={{ color: '#60A5FA' }}> *</Text>
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: inputBg,
                            borderColor: erroresForm.referencia ? '#EF4444' : colors.border,
                            color: colors.text,
                        },
                    ]}
                    value={form.referencia}
                    placeholder="Referencia del producto"
                    placeholderTextColor={colors.subText}
                    onChangeText={(t) => {
                        setForm((prev) => ({ ...prev, referencia: t }));
                        if (erroresForm.referencia) setErroresForm((prev) => ({ ...prev, referencia: undefined }));
                    }}
                />
                {erroresForm.referencia ? <Text style={styles.fieldErrorText}>{erroresForm.referencia}</Text> : null}
            </View>

            <View style={[styles.formCol, styles.formColFull, styles.opsRelacionadasWrap]}>
                <View style={styles.opsRelacionadasHeader}>
                    <Text style={[dropdownStyles.label, { color: colors.subText, marginBottom: 0 }]}>
                        OPs adicionales (opcional)
                    </Text>
                    <TouchableOpacity
                        style={[styles.btnAgregarOpRelacionada, { borderColor: colors.primary }]}
                        onPress={agregarOpRelacionada}
                    >
                        <Text style={[styles.btnAgregarOpRelacionadaText, { color: colors.primary }]}>+ Agregar otra OP</Text>
                    </TouchableOpacity>
                </View>
                {opsRelacionadas.map((op) => {
                    const rowErr = erroresOpsRelacionadas[op.id] ?? {};
                    return (
                        <View key={op.id} style={[styles.opRelacionadaCard, { borderColor: colors.border }]}>
                            <View style={styles.opRelacionadaCardHeader}>
                                <Text style={{ color: colors.subText, fontSize: 12, fontWeight: '600' }}>OP adicional</Text>
                                <TouchableOpacity onPress={() => eliminarOpRelacionada(op.id)}>
                                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Quitar</Text>
                                </TouchableOpacity>
                            </View>

                            <OpAutocompleteField
                                label="Orden de producción"
                                required
                                value={op.opSearch}
                                options={opsUnicos}
                                loading={cargandoOps || op.cargando}
                                onChangeText={(t) => handleOpRelacionadaSearchChange(op.id, t)}
                                onSelect={(n) => seleccionarOpRelacionada(op.id, n)}
                                onOpenChange={(open) => {
                                    if (open) {
                                        setOpListaAbierta(false);
                                        setMenuDesplegableAbierto(null);
                                    }
                                }}
                                placeholder="Buscar OP (números)..."
                                colors={colors}
                                isDarkMode={isDarkMode}
                                error={rowErr.ordenProduccionNumero}
                            />
                            {op.cargando ? (
                                <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                                    Buscando datos de la OP en adjuntos…
                                </Text>
                            ) : op.mensaje ? (
                                <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>{op.mensaje}</Text>
                            ) : null}

                            <View style={[styles.formGrid, isWide && styles.formGridWide, styles.opRelacionadaFields]}>
                                <View style={[styles.formCol, isWide && styles.formColHalf]}>
                                    <Text style={[dropdownStyles.label, { color: colors.subText }]}>Cliente *</Text>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: inputBg,
                                                borderColor: rowErr.cliente ? '#EF4444' : colors.border,
                                                color: colors.text,
                                            },
                                        ]}
                                        value={op.cliente}
                                        placeholder="Nombre del cliente"
                                        placeholderTextColor={colors.subText}
                                        onChangeText={(t) => {
                                            setOpRelacionadaPatch(op.id, { cliente: t });
                                            limpiarErrorOpRelacionada(op.id, 'cliente');
                                        }}
                                    />
                                    {rowErr.cliente ? <Text style={styles.fieldErrorText}>{rowErr.cliente}</Text> : null}
                                </View>
                                <View style={[styles.formCol, isWide && styles.formColHalf]}>
                                    <Text style={[dropdownStyles.label, { color: colors.subText }]}>Referencia *</Text>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: inputBg,
                                                borderColor: rowErr.referencia ? '#EF4444' : colors.border,
                                                color: colors.text,
                                            },
                                        ]}
                                        value={op.referencia}
                                        placeholder="Referencia del producto"
                                        placeholderTextColor={colors.subText}
                                        onChangeText={(t) => {
                                            setOpRelacionadaPatch(op.id, { referencia: t });
                                            limpiarErrorOpRelacionada(op.id, 'referencia');
                                        }}
                                    />
                                    {rowErr.referencia ? <Text style={styles.fieldErrorText}>{rowErr.referencia}</Text> : null}
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf]}>
                <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                    Fecha de solicitud <Text style={{ color: '#60A5FA' }}> *</Text>
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        styles.inputDisabled,
                        {
                            backgroundColor: inputBg,
                            borderColor: erroresForm.fechaSolicitud ? '#EF4444' : colors.border,
                            color: colors.subText,
                        },
                    ]}
                    value={formatFechaDisplay(form.fechaSolicitud)}
                    editable={false}
                />
                {erroresForm.fechaSolicitud ? <Text style={styles.fieldErrorText}>{erroresForm.fechaSolicitud}</Text> : null}
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf]}>
                <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                    Fecha requerida <Text style={{ color: '#60A5FA' }}> *</Text>
                </Text>
                <View style={erroresForm.fechaRequerida ? styles.fieldErrorFrame : null}>
                    <CampoFechaRequerida
                        value={form.fechaRequerida}
                        onChange={(iso) => {
                            setForm((prev) => ({ ...prev, fechaRequerida: iso }));
                            if (erroresForm.fechaRequerida) {
                                setErroresForm((prev) => ({ ...prev, fechaRequerida: undefined }));
                            }
                        }}
                        colors={colors}
                        isDarkMode={isDarkMode}
                        inputBg={inputBg}
                    />
                </View>
                {erroresForm.fechaRequerida ? <Text style={styles.fieldErrorText}>{erroresForm.fechaRequerida}</Text> : null}
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf]}>
                <Text style={[dropdownStyles.label, { color: colors.subText }]}>
                    Cantidad <Text style={{ color: '#60A5FA' }}> *</Text>
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: inputBg,
                            borderColor: erroresForm.cantidad ? '#EF4444' : colors.border,
                            color: colors.text,
                        },
                    ]}
                    placeholder=""
                    placeholderTextColor={colors.subText}
                    value={form.cantidad}
                    onChangeText={(t) => {
                        const cleaned = t.replace(/[^0-9.,]/g, '');
                        setForm((prev) => ({ ...prev, cantidad: cleaned }));
                        const cantidad = parseFloat(cleaned.replace(',', '.'));
                        if (erroresForm.cantidad && cantidad > 0) {
                            setErroresForm((prev) => ({ ...prev, cantidad: undefined }));
                        }
                    }}
                    keyboardType="decimal-pad"
                />
                {erroresForm.cantidad ? <Text style={styles.fieldErrorText}>{erroresForm.cantidad}</Text> : null}
            </View>

            <View style={[styles.formCol, isWide && styles.formColHalf, colConMenuAbierto('unidad')]}>
                <SelectDropdown
                    label="Unidad de medida"
                    required
                    value={form.unidad}
                    options={unidadesMedida.map((u) => ({ id: u, label: u }))}
                    onChange={(id) => {
                        setForm((prev) => ({ ...prev, unidad: id }));
                        if (erroresForm.unidad) setErroresForm((prev) => ({ ...prev, unidad: undefined }));
                    }}
                    placeholder="Seleccionar..."
                    colors={colors}
                    isDarkMode={isDarkMode}
                    open={menuDesplegableAbierto === 'unidad'}
                    onOpenChange={handleUnidadOpenChange}
                    dropUp
                    error={erroresForm.unidad}
                />
            </View>

            <View
                style={[
                    styles.formCol,
                    styles.formColFull,
                    styles.observacionSection,
                    { borderTopColor: colors.border },
                ]}
            >
                <Text style={[dropdownStyles.label, { color: colors.subText }]}>Observación</Text>
                <TextInput
                    style={[
                        styles.inputObs,
                        {
                            backgroundColor: inputBg,
                            borderColor: colors.border,
                            color: colors.text,
                        },
                    ]}
                    placeholder="Notas adicionales (opcional)"
                    placeholderTextColor={colors.subText}
                    value={form.observacion}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, observacion: t }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: pageBg }]}>
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsScroll}
                    style={styles.tabsScrollView}
                >
                    {TABS.map((tab) => {
                        const active = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tab, active && styles.tabActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text style={styles.tabIcon}>{tab.icon}</Text>
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                {notificacionesCorreo.length > 0 ? (
                    <TouchableOpacity
                        style={styles.notifIconBtn}
                        onPress={() => setNotificacionesCorreoVisible(true)}
                        accessibilityLabel="Ver destinatarios de correo"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <MaterialCommunityIcons
                            name="email-outline"
                            size={17}
                            color="rgba(255,255,255,0.38)"
                        />
                    </TouchableOpacity>
                ) : null}
            </View>

            <Modal
                visible={notificacionesCorreoVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setNotificacionesCorreoVisible(false)}
            >
                <TouchableOpacity
                    style={styles.notifModalOverlay}
                    activeOpacity={1}
                    onPress={() => setNotificacionesCorreoVisible(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[
                            styles.notifModalBox,
                            { backgroundColor: cardBg, borderColor: colors.border },
                        ]}
                        onPress={() => {}}
                    >
                        <Text style={[styles.notifModalTitulo, { color: colors.text }]}>
                            Notificaciones por correo
                        </Text>
                        <Text style={[styles.notifModalSubtitulo, { color: colors.subText }]}>
                            Se notifica al registrar requisiciones, pedidos y recepciones:
                        </Text>
                        {notificacionesCorreo.map((correo) => (
                            <Text key={correo} style={[styles.notifModalCorreo, { color: colors.text }]}>
                                {correo}
                            </Text>
                        ))}
                        <TouchableOpacity
                            style={[styles.notifModalCerrar, { borderColor: colors.border }]}
                            onPress={() => setNotificacionesCorreoVisible(false)}
                        >
                            <Text style={{ color: colors.subText, fontSize: 13 }}>Cerrar</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
                {cargando ? (
                    <Text style={[styles.emptyText, { color: colors.subText, marginTop: 24 }]}>
                        Cargando módulo de almacén…
                    </Text>
                ) : null}
                {!cargando && activeTab === 'requisicion' && renderRequisicionTab()}
                {!cargando && activeTab === 'pedidos' && (
                    <AlmacenPedidosTab
                        requisiciones={requisiciones}
                        productos={productos}
                        onGuardarPedido={handleGuardarPedido}
                        onConsolidarPedido={handleConsolidarPedido}
                        onMarcarProveedorPagado={handleMarcarProveedorPagado}
                        onGuardarProveedorCatalogo={handleGuardarProveedorCatalogo}
                        onRecargarCatalogoProveedores={handleRecargarCatalogoProveedores}
                        onRecargarCatalogoProductos={handleRecargarCatalogoProductos}
                        onGuardarProductoCatalogo={handleGuardarProductoCatalogo}
                        onEliminarProductoCatalogo={handleEliminarProductoCatalogo}
                        onEliminarProveedorCatalogo={handleEliminarProveedorCatalogo}
                        unidadesMedida={unidadesMedida}
                        catalogoProveedores={catalogoProveedores}
                        colors={colors}
                        isDarkMode={isDarkMode}
                        cardBg={cardBg}
                        isWide={isWide}
                    />
                )}
                {!cargando && activeTab === 'recepcion' && (
                    <AlmacenRecepcionTab
                        requisiciones={requisiciones}
                        onRegistrarRecepcion={handleRegistrarRecepcion}
                        colors={colors}
                        isDarkMode={isDarkMode}
                        cardBg={cardBg}
                        isWide={isWide}
                    />
                )}
                {!cargando && activeTab === 'calidad' && (
                    <AlmacenCalidadProveedoresTab
                        requisiciones={requisiciones}
                        colors={colors}
                        isDarkMode={isDarkMode}
                        cardBg={cardBg}
                        isWide={isWide}
                    />
                )}
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={cerrarModalRequisicion}>
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalBox,
                            { backgroundColor: isDarkMode ? '#1E293B' : colors.card, borderColor: colors.border },
                        ]}
                    >
                        <View style={[styles.modalHeader, styles.modalHeaderElevated]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    {editingRequisicionId ? 'Editar requisición' : 'Registrar nueva requisición'}
                                </Text>
                                <View style={styles.modalTipoRow}>
                                    <View
                                        style={[
                                            styles.modalTipoPill,
                                            { backgroundColor: `${tipoActivoMeta.accentColor}22`, borderColor: tipoActivoMeta.accentColor },
                                        ]}
                                    >
                                        <Text style={[styles.modalTipoPillText, { color: tipoActivoMeta.accentColor }]}>
                                            {tipoActivoMeta.label}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity onPress={cerrarModalRequisicion} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={[styles.modalClose, { color: colors.subText }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={[styles.modalBody, Platform.OS === 'web' && styles.modalBodyWeb]}
                            contentContainerStyle={styles.modalBodyContent}
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                            {formularioRequisicion}
                        </ScrollView>

                        <View
                            style={[
                                styles.modalFooter,
                                { backgroundColor: isDarkMode ? '#1E293B' : colors.card },
                            ]}
                        >
                            <TouchableOpacity
                                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                                onPress={cerrarModalRequisicion}
                            >
                                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryBtn, guardando && { opacity: 0.6 }]}
                                onPress={handleGuardar}
                                activeOpacity={0.85}
                                disabled={guardando}
                            >
                                <Text style={styles.primaryBtnText}>{guardando ? 'Guardando…' : 'Guardar'}</Text>
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
    tabsContainer: {
        backgroundColor: '#1E3A5F',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#152A45',
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabsScrollView: {
        flex: 1,
    },
    tabsScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingRight: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    tabActive: {
        backgroundColor: '#FFFFFF',
    },
    tabIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    tabText: {
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
        fontSize: 14,
    },
    tabTextActive: {
        color: '#1E3A5F',
        fontWeight: '700',
    },
    notifIconBtn: {
        paddingLeft: 6,
        paddingRight: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    notifModalBox: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
    },
    notifModalTitulo: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    notifModalSubtitulo: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
    },
    notifModalCorreo: {
        fontSize: 13,
        lineHeight: 22,
    },
    notifModalCerrar: {
        alignSelf: 'flex-end',
        marginTop: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 8,
    },
    content: { flex: 1 },
    contentInner: { padding: 20, paddingBottom: 40 },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 24,
    },
    cardRequisicion: {
        paddingBottom: 0,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
    },
    cardTitle: { fontSize: 20, fontWeight: '600' },
    cardSubtitle: { fontSize: 14, marginTop: 4, fontWeight: '500' },
    sheetTabsBar: {
        marginTop: 20,
        marginHorizontal: -24,
        marginBottom: 0,
        borderTopWidth: 1,
        paddingTop: 2,
    },
    sheetTabsScroll: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 4,
        gap: 2,
    },
    sheetTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: 3,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        minWidth: 120,
        maxWidth: 220,
    },
    sheetTabActive: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: -2 },
        elevation: 2,
    },
    sheetTabText: {
        fontSize: 12,
        flexShrink: 1,
    },
    sheetTabBadge: {
        marginLeft: 8,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    sheetTabBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    tableWrap: { width: '100%' },
    tableWrapNarrow: { width: '100%' },
    tableCell: {
        justifyContent: 'flex-start',
        paddingRight: 8,
        flexShrink: 0,
    },
    primaryBtn: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 22,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
    secondaryBtn: {
        paddingHorizontal: 22,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryBtnText: { fontWeight: '600', fontSize: 15 },
    btnEditarReq: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    accionesReqRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    btnBorrarReq: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    cardHeaderActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    btnImportarProductos: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnImportarProductosText: {
        fontWeight: '600',
        fontSize: 14,
    },
    btnBorrarTodoPruebas: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnBorrarTodoPruebasText: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14,
    },
    th: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.6,
        paddingRight: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        paddingBottom: 12,
        marginBottom: 4,
        paddingTop: 4,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
        borderBottomWidth: 1,
        minHeight: 56,
    },
    td: { fontSize: 14, lineHeight: 20, paddingRight: 10 },
    tdWrap: {
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    tdStack: {
        gap: 6,
        width: '100%',
    },
    tdStackRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
    },
    tdStackIndex: {
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 20,
        minWidth: 18,
        marginRight: 2,
        opacity: 0.55,
    },
    tdStackItem: {
        flex: 1,
        minWidth: 0,
    },
    tdCantidadPedido: { fontSize: 13, lineHeight: 18, marginTop: 2, paddingRight: 10 },
    emptyText: { paddingVertical: 32, textAlign: 'center', fontSize: 16 },
    paginationBar: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    paginationInfo: { fontSize: 14, flex: 1, minWidth: 200 },
    paginationControls: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    paginationBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 46,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
    },
    paginationBtnPrimary: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    paginationBtnDisabled: { opacity: 0.45 },
    paginationBtnText: { fontSize: 15, fontWeight: '600' },
    paginationBtnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    placeholderCard: { alignItems: 'center', justifyContent: 'center', minHeight: 200 },
    placeholderTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
    placeholderSub: { fontSize: 14 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalBox: {
        width: '100%',
        maxWidth: 720,
        height: '94%',
        maxHeight: '94%',
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'visible',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 12,
    },
    modalHeaderElevated: {
        position: 'relative',
        zIndex: 1000001,
        elevation: 1000001,
    },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    modalTipoRow: { marginTop: 8 },
    modalTipoPill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    modalTipoPillText: { fontSize: 12, fontWeight: '600' },
    modalClose: { fontSize: 18, padding: 4 },
    modalBody: {
        flex: 1,
        minHeight: 0,
        paddingHorizontal: 20,
        overflow: 'visible' as const,
    },
    modalBodyWeb: {
        paddingBottom: 8,
        overflow: 'visible' as const,
    },
    modalBodyContent: {
        paddingBottom: 20,
        overflow: 'visible' as const,
    },
    formGrid: { gap: 0, overflow: 'visible' as const },
    formGridWide: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'visible' as const },
    formCol: {
        width: '100%',
        marginBottom: 4,
        overflow: 'visible' as const,
        position: 'relative',
        zIndex: 2,
    },
    formColElevated: {
        zIndex: 999999,
        elevation: 999999,
        ...(Platform.OS === 'web' ? { position: 'relative' as const } : {}),
    },
    formColHalf: { width: '48%', minWidth: 0, alignSelf: 'stretch' },
    formColFull: { width: '100%', zIndex: 2 },
    input: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 15,
    },
    fieldErrorFrame: {
        borderWidth: 1,
        borderColor: '#EF4444',
        borderRadius: 10,
        padding: 2,
    },
    fieldErrorText: {
        color: '#EF4444',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 2,
    },
    inputDisabled: { opacity: 0.85 },
    observacionSection: {
        marginTop: 6,
        paddingTop: 14,
        borderTopWidth: 1,
    },
    opsRelacionadasWrap: {
        marginTop: 2,
        marginBottom: 10,
        overflow: 'visible' as const,
        zIndex: 3,
    },
    opsRelacionadasHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    btnAgregarOpRelacionada: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    btnAgregarOpRelacionadaText: {
        fontSize: 12,
        fontWeight: '700',
    },
    opRelacionadaCard: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 8,
        overflow: 'visible' as const,
        position: 'relative',
    },
    opRelacionadaCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    opRelacionadaFields: {
        zIndex: 1,
        position: 'relative',
    },
    inputObs: {
        minHeight: 76,
        maxHeight: 120,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
        lineHeight: 22,
        textAlignVertical: 'top',
    },
    autocompleteItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        padding: 20,
        paddingTop: 12,
        position: 'relative',
        zIndex: 1000001,
        elevation: 1000001,
    },
});
