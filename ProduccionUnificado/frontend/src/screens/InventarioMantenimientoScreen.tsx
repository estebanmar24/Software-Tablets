import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, Modal, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../contexts/ThemeContext';
import { mantenimientoApi } from '../services/mantenimientoApi';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';


const getEstado = (stock: number, puntoReorden: number) => {
    if (stock === 0) return 'AGOTADO';
    if (stock < puntoReorden) return 'CRÍTICO';
    if (stock === puntoReorden) return 'STOCK BAJO';
    return 'ÓPTIMO';
};

const IconSearch = ({ color, size = 16 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="11" cy="11" r="8" />
        <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
);
const IconMoon = ({ color, size = 18 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
);
const IconSun = ({ color, size = 18 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="5" />
        <Line x1="12" y1="1" x2="12" y2="3" />
        <Line x1="12" y1="21" x2="12" y2="23" />
        <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <Line x1="1" y1="12" x2="3" y2="12" />
        <Line x1="21" y1="12" x2="23" y2="12" />
        <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </Svg>
);

const IconEdit = ({ color, size = 16 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);
const IconAlert = ({ color, size = 20 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <Line x1="12" y1="9" x2="12" y2="13" />
        <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
);
const IconXCircle = ({ color, size = 20 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="10" />
        <Line x1="15" y1="9" x2="9" y2="15" />
        <Line x1="9" y1="9" x2="15" y2="15" />
    </Svg>
);
const IconBox = ({ color, size = 20 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <Polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <Line x1="12" y1="22.08" x2="12" y2="12" />
    </Svg>
);

const IconShoppingCart = ({ color, size = 16 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="9" cy="21" r="1" />
        <Circle cx="20" cy="21" r="1" />
        <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </Svg>
);

const IconHistory = ({ color, size = 16 }: { color: string, size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="10" />
        <Polyline points="12 6 12 12 16 14" />
    </Svg>
);

const formatFecha = (f: string) => (f ? f.split('T')[0] : '—');

const formatDetalle = (mov: any) => {
    const d = mov.detalle || {};
    const lineas: string[] = [];
    if (mov.origen === 'AJUSTE') {
        if (d.razon) lineas.push(`Motivo: ${d.razon}`);
        return lineas;
    }
    if (mov.origen === 'GASTO') {
        if (d.rubro) lineas.push(`Rubro: ${d.rubro}`);
        if (d.proveedor) lineas.push(`Proveedor: ${d.proveedor}`);
        if (d.numeroFactura) lineas.push(`Factura: ${d.numeroFactura}`);
        if (d.maquina) lineas.push(`Máquina: ${d.maquina}`);
        if (d.precio != null) lineas.push(`Valor gasto: $${Number(d.precio).toLocaleString('es-CO')}`);
        if (d.nota) lineas.push(`Nota: ${d.nota}`);
        if (d.numeroOP) lineas.push(`OP: ${d.numeroOP}`);
        if (d.estadoGasto) lineas.push(`Estado: ${d.estadoGasto}`);
    } else {
        if (d.maquina) lineas.push(`Máquina: ${d.maquina}`);
        if (d.tipoMantenimiento) lineas.push(`Tipo: ${d.tipoMantenimiento}`);
        if (d.ticket) lineas.push(`Ticket: ${d.ticket}`);
        if (d.actividades?.length) lineas.push(`Actividades: ${d.actividades.join(', ')}`);
        if (d.responsable) lineas.push(`Responsable: ${d.responsable}`);
        if (d.nota) lineas.push(`Nota: ${d.nota}`);
    }
    return lineas;
};

interface InventarioMantenimientoScreenProps {
    onBack: () => void;
}

const InventarioMantenimientoScreen: React.FC<InventarioMantenimientoScreenProps> = ({ onBack }) => {
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [inventoryData, setInventoryData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [tempReorderPoint, setTempReorderPoint] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState('Todos los ítems');
    const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
    const [detailsItem, setDetailsItem] = useState<any>(null);
    const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
    const [historyItem, setHistoryItem] = useState<any>(null);
    const [historyData, setHistoryData] = useState<any>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [isAjusteModalVisible, setIsAjusteModalVisible] = useState(false);
    const [ajusteItem, setAjusteItem] = useState<any>(null);
    const [ajusteTipo, setAjusteTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
    const [ajusteCantidad, setAjusteCantidad] = useState('');
    const [ajusteRazon, setAjusteRazon] = useState('');
    const [ajusteSaving, setAjusteSaving] = useState(false);

    const loadInventory = async () => {
        try {
            setLoading(true);
            let data = await mantenimientoApi.getInventario();
            const sinStock = Array.isArray(data) && data.length > 0 && data.every((i: any) => (i.stock ?? 0) === 0);
            if (sinStock) {
                try {
                    await mantenimientoApi.recalcularInventario();
                    data = await mantenimientoApi.getInventario();
                } catch (recalcErr) {
                    console.warn('No se pudo recalcular inventario desde gastos:', recalcErr);
                }
            }
            setInventoryData(data || []);
        } catch (error) {
            console.error('Error loading inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, []);

    // Get unique categories from data
    const categories = ['Todas', ...new Set(inventoryData.map(item => item.categoria).filter(Boolean))];

    const totalRegistrados = inventoryData.reduce((sum, item) => sum + item.stock, 0);
    const stockBajoCount = inventoryData.filter(item => getEstado(item.stock, item.puntoReorden) === 'STOCK BAJO').length;
    const criticosCount = inventoryData.filter(item => {
        const estado = getEstado(item.stock, item.puntoReorden);
        return estado === 'CRÍTICO' || estado === 'AGOTADO';
    }).length;

    const filteredInventory = inventoryData.filter(item => {
        const estadoCalculado = getEstado(item.stock, item.puntoReorden);

        let matchesTab = true;
        if (selectedTab === 'Óptimo') matchesTab = estadoCalculado === 'ÓPTIMO';
        else if (selectedTab === 'Stock Bajo') matchesTab = estadoCalculado === 'STOCK BAJO';
        else if (selectedTab === 'Críticos') matchesTab = estadoCalculado === 'CRÍTICO';
        else if (selectedTab === 'Agotados') matchesTab = estadoCalculado === 'AGOTADO';

        const matchesCategory = selectedCategory === 'Todas' || item.categoria === selectedCategory;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = item.codigo.toLowerCase().includes(searchLower) ||
            item.nombre.toLowerCase().includes(searchLower) ||
            item.categoria.toLowerCase().includes(searchLower);
        return matchesCategory && matchesSearch && matchesTab;
    });

    const openDetailsModal = (item: any) => {
        setDetailsItem(item);
        setIsDetailsModalVisible(true);
    };

    const openReorderModal = (item: any) => {
        setSelectedItem(item);
        setTempReorderPoint(item.puntoReorden.toString());
        setIsModalVisible(true);
    };

    const openHistoryModal = async (item: any) => {
        setHistoryItem(item);
        setHistoryData(null);
        setIsHistoryModalVisible(true);
        setHistoryLoading(true);
        try {
            const data = await mantenimientoApi.getMovimientosProducto(parseInt(item.id, 10));
            setHistoryData(data);
        } catch (error) {
            console.error('Error loading movement history:', error);
            alert('No se pudo cargar el historial de movimientos.');
            setIsHistoryModalVisible(false);
        } finally {
            setHistoryLoading(false);
        }
    };

    const openAjusteModal = (item: any, tipo: 'ENTRADA' | 'SALIDA') => {
        setAjusteItem(item);
        setAjusteTipo(tipo);
        setAjusteCantidad('');
        setAjusteRazon('');
        setIsAjusteModalVisible(true);
    };

    const saveAjusteInventario = async () => {
        if (!ajusteItem) return;
        const cantidad = parseFloat(String(ajusteCantidad).replace(',', '.'));
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            alert('Ingrese una cantidad válida mayor a cero.');
            return;
        }
        const razon = ajusteRazon.trim();
        if (razon.length < 5) {
            alert('Indique el motivo del ajuste (mínimo 5 caracteres).');
            return;
        }
        if (ajusteTipo === 'SALIDA' && cantidad > (ajusteItem.stock ?? 0)) {
            alert(`Stock insuficiente. Disponible: ${ajusteItem.stock ?? 0}`);
            return;
        }
        try {
            setAjusteSaving(true);
            const result = await mantenimientoApi.registrarAjusteInventario({
                productoId: parseInt(ajusteItem.id, 10),
                tipo: ajusteTipo,
                cantidad,
                razon,
            });
            const stockNuevo = Math.floor(Number(result?.stockActual ?? 0));
            setInventoryData((prev) =>
                prev.map((inv) =>
                    inv.id === ajusteItem.id ? { ...inv, stock: stockNuevo } : inv
                )
            );
            setIsAjusteModalVisible(false);
            alert(result?.mensaje || 'Ajuste registrado.');
        } catch (error: any) {
            const msg =
                error?.response?.data?.mensaje ||
                error?.message ||
                'No se pudo registrar el ajuste.';
            alert(msg);
        } finally {
            setAjusteSaving(false);
        }
    };

    const saveReorderPoint = async () => {
        if (!selectedItem) return;
        const newPoint = parseInt(tempReorderPoint, 10);
        if (isNaN(newPoint) || newPoint < 0) {
            alert('Ingrese un número válido (0 o mayor).');
            return;
        }
        try {
            const result = await mantenimientoApi.patchPuntoReorden(
                parseInt(selectedItem.id, 10),
                newPoint
            );
            const puntoGuardado = result?.puntoReorden ?? newPoint;
            setInventoryData(prev => prev.map(invItem =>
                invItem.id === selectedItem.id
                    ? { ...invItem, puntoReorden: puntoGuardado }
                    : invItem
            ));
            setIsModalVisible(false);
        } catch (error) {
            console.error('Error updating reorder point:', error);
            alert('No se pudo actualizar el punto de reorden. Verifique que el servidor esté actualizado.');
        }
    };

    const dynamicStyles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: isDarkMode ? '#020617' : '#F9FAFB',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingHorizontal: 24,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            ...(Platform.OS === 'web' && {
                position: 'sticky',
                top: 0,
                zIndex: 10,
            } as any),
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        backButton: {
            marginRight: 16,
            padding: 4,
        },
        title: {
            fontSize: 20,
            fontWeight: 'bold',
            color: colors.text,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginRight: 12,
            width: 300,
        },
        searchInput: {
            flex: 1,
            marginLeft: 8,
            fontSize: 14,
            color: colors.text,
            ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
        },
        iconButton: {
            padding: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            marginRight: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },

        primaryButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#0d7a78', // Teal base from reference
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 8,
        },
        primaryButtonText: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: '600',
            marginLeft: 6,
        },
        content: {
            padding: 24,
        },
        cardsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 16,
        },
        card: {
            flex: 1,
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        cardInfo: {
            flex: 1,
        },
        cardTitle: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.subText,
            marginBottom: 8,
            textTransform: 'uppercase',
        },
        cardValue: {
            fontSize: 28,
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: 4,
        },
        cardSubtitle: {
            fontSize: 12,
            color: colors.subText,
        },
        cardIconContainer: {
            width: 48,
            height: 48,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        filtersRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        tabsContainer: {
            flexDirection: 'row',
            gap: 10,
        },
        tab: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
        },
        activeTab: {
            backgroundColor: isDarkMode ? '#f9fafb' : '#1f2937',
        },
        tabText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.subText,
        },
        activeTabText: {
            color: isDarkMode ? '#111827' : '#ffffff',
        },
        dropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.card,
        },
        dropdownText: {
            fontSize: 14,
            color: colors.text,
            marginRight: 8,
        },
        tableContainer: {
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        tableHeader: {
            flexDirection: 'row',
            backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        th: {
            fontSize: 11,
            fontWeight: 'bold',
            color: colors.subText,
            textTransform: 'uppercase',
        },
        tableRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        tableRowLast: {
            borderBottomWidth: 0,
        },
        td: {
            fontSize: 14,
            color: colors.text,
        },
        tdSubtext: {
            fontSize: 12,
            color: colors.subText,
            marginTop: 4,
        },
        pill: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            alignSelf: 'flex-start',
        },
        pillDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            marginRight: 6,
        },
        pillText: {
            fontSize: 12,
            fontWeight: '600',
        },
        progressContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        progressBarBg: {
            flex: 1,
            height: 6,
            backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
            borderRadius: 3,
            marginRight: 12,
            maxWidth: 100,
        },
        progressBarFill: {
            height: '100%',
            borderRadius: 3,
        },
        progressText: {
            fontSize: 14,
            color: colors.text,
            width: 50,
        },
    });

    const StatePill = ({ state }: { state: string }) => {
        let bgColor, textColor, dotColor;
        if (state === 'ÓPTIMO') {
            bgColor = isDarkMode ? 'rgba(22, 101, 52, 0.2)' : '#dcfce7';
            textColor = isDarkMode ? '#4ade80' : '#166534';
            dotColor = isDarkMode ? '#4ade80' : '#166534';
        } else if (state === 'STOCK BAJO') {
            bgColor = isDarkMode ? 'rgba(154, 52, 18, 0.2)' : '#ffedd5';
            textColor = isDarkMode ? '#fb923c' : '#9a3412';
            dotColor = isDarkMode ? '#fb923c' : '#9a3412';
        } else { // CRÍTICO o AGOTADO
            bgColor = isDarkMode ? 'rgba(153, 27, 27, 0.2)' : '#fee2e2';
            textColor = isDarkMode ? '#f87171' : '#dc2626';
            dotColor = isDarkMode ? '#f87171' : '#dc2626';
        }

        return (
            <View style={[dynamicStyles.pill, { backgroundColor: bgColor }]}>
                <View style={[dynamicStyles.pillDot, { backgroundColor: dotColor }]} />
                <Text style={[dynamicStyles.pillText, { color: textColor }]}>{state}</Text>
            </View>
        );
    };

    const StockProgress = ({ stock, puntoReorden, state }: { stock: number, puntoReorden: number, state: string }) => {
        let progressColor;
        if (state === 'ÓPTIMO') progressColor = isDarkMode ? '#4ade80' : '#16a34a';
        else if (state === 'STOCK BAJO') progressColor = isDarkMode ? '#fb923c' : '#ea580c';
        else progressColor = isDarkMode ? '#f87171' : '#dc2626';

        const limite = Math.max(puntoReorden, 1);
        const escalaBarra = Math.max(limite, stock);
        const percentage = Math.min((stock / escalaBarra) * 100, 100);

        return (
            <View style={dynamicStyles.progressContainer}>
                <View style={dynamicStyles.progressBarBg}>
                    <View style={[dynamicStyles.progressBarFill, { width: `${percentage}%`, backgroundColor: progressColor }]} />
                </View>
                <Text style={dynamicStyles.progressText}>
                    <Text style={{ fontWeight: 'bold' }}>{stock}</Text> / {puntoReorden}
                </Text>
            </View>
        );
    };

    return (
        <>
        <View style={dynamicStyles.container}>
            <View style={dynamicStyles.header}>
                <TouchableOpacity style={dynamicStyles.backButton} onPress={onBack}>
                   <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.title}>📦 Inventario de Mantenimiento</Text>
                </View>
                <View style={dynamicStyles.searchContainer}>
                    <IconSearch color={colors.subText} />
                    <TextInput
                        style={dynamicStyles.searchInput}
                        placeholder="Buscar por código, nombre o categoría..."
                        placeholderTextColor={colors.subText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity style={[dynamicStyles.iconButton, { marginRight: 0 }]} onPress={toggleTheme}>
                    {isDarkMode ? <IconSun color={colors.text} /> : <IconMoon color={colors.text} />}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0d7a78" />
                    <Text style={{ marginTop: 12, color: colors.subText }}>Cargando inventario real...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={dynamicStyles.content}>
                <View style={dynamicStyles.cardsRow}>
                    <View style={dynamicStyles.card}>
                        <View style={dynamicStyles.cardInfo}>
                            <Text style={dynamicStyles.cardTitle}>TOTAL REGISTRADOS</Text>
                            <Text style={dynamicStyles.cardValue}>{totalRegistrados.toLocaleString()}</Text>
                            <Text style={dynamicStyles.cardSubtitle}>Unidades físicas almacenadas</Text>
                        </View>
                        <View style={[dynamicStyles.cardIconContainer, { backgroundColor: isDarkMode ? 'rgba(13, 148, 136, 0.2)' : '#ccfbf1' }]}>
                            <IconBox color={isDarkMode ? '#2dd4bf' : '#0d9488'} />
                        </View>
                    </View>

                    <View style={dynamicStyles.card}>
                        <View style={dynamicStyles.cardInfo}>
                            <Text style={dynamicStyles.cardTitle}>STOCK BAJO</Text>
                            <Text style={[dynamicStyles.cardValue, { color: isDarkMode ? '#fb923c' : '#d97706' }]}>{stockBajoCount}</Text>
                            <Text style={dynamicStyles.cardSubtitle}>En el límite de reorden</Text>
                        </View>
                        <View style={[dynamicStyles.cardIconContainer, { backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.2)' : '#fef3c7' }]}>
                            <IconAlert color={isDarkMode ? '#fb923c' : '#d97706'} />
                        </View>
                    </View>

                    <View style={dynamicStyles.card}>
                        <View style={dynamicStyles.cardInfo}>
                            <Text style={dynamicStyles.cardTitle}>CRITICOS</Text>
                            <Text style={[dynamicStyles.cardValue, { color: isDarkMode ? '#f87171' : '#dc2626' }]}>{criticosCount}</Text>
                            <Text style={dynamicStyles.cardSubtitle}>Requieren compra urgente</Text>
                        </View>
                        <View style={[dynamicStyles.cardIconContainer, { backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2' }]}>
                            <IconXCircle color={isDarkMode ? '#f87171' : '#dc2626'} />
                        </View>
                    </View>
                </View>

                <View style={dynamicStyles.filtersRow}>
                    <View style={dynamicStyles.tabsContainer}>
                        {['Todos los ítems', 'Óptimo', 'Stock Bajo', 'Críticos', 'Agotados'].map((tab, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[dynamicStyles.tab, selectedTab === tab && dynamicStyles.activeTab]}
                                onPress={() => setSelectedTab(tab)}
                            >
                                <Text style={[dynamicStyles.tabText, selectedTab === tab && dynamicStyles.activeTabText]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[dynamicStyles.dropdown, { paddingHorizontal: 4, paddingVertical: 0 }]}>
                        <Picker
                            selectedValue={selectedCategory}
                            onValueChange={(itemValue) => setSelectedCategory(itemValue)}
                            style={{
                                color: colors.text,
                                backgroundColor: isDarkMode ? colors.card : 'transparent',
                                borderWidth: 0,
                                fontSize: 14,
                                width: 220,
                                height: 38,
                                ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
                            }}
                        >
                            {categories.map((cat, idx) => (
                                <Picker.Item key={idx} label={cat} value={cat} color={Platform.OS === 'web' && isDarkMode ? '#000' : undefined} />
                            ))}
                        </Picker>
                    </View>
                </View>

                <View style={dynamicStyles.tableContainer}>
                    <View style={dynamicStyles.tableHeader}>
                        <Text style={[dynamicStyles.th, { flex: 1 }]}>CÓDIGO</Text>
                        <Text style={[dynamicStyles.th, { flex: 2.5 }]}>NOMBRE DEL ÍTEM</Text>
                        <Text style={[dynamicStyles.th, { flex: 1.5 }]}>CATEGORÍA</Text>
                        <Text style={[dynamicStyles.th, { flex: 1.5 }]}>ESTADO</Text>
                        <Text style={[dynamicStyles.th, { flex: 2 }]}>NIVEL DE STOCK</Text>
                        <Text style={[dynamicStyles.th, { flex: 1.4, textAlign: 'center' }]}>ACCIONES</Text>
                    </View>

                    {filteredInventory.map((item, index) => {
                        const estadoCalculado = getEstado(item.stock, item.puntoReorden);
                        return (
                            <View key={item.id} style={[dynamicStyles.tableRow, index === filteredInventory.length - 1 && dynamicStyles.tableRowLast]}>
                                <Text style={[dynamicStyles.td, { flex: 1, color: colors.subText }]}>{item.codigo}</Text>

                                <View style={{ flex: 2.5, paddingRight: 16, justifyContent: 'center' }}>
                                    <Text style={[dynamicStyles.td, { fontWeight: '600' }]}>{item.nombre}</Text>
                                    <TouchableOpacity onPress={() => openDetailsModal(item)} style={{ marginTop: 2 }}>
                                        <Text style={{ color: '#0d9488', fontSize: 12, fontWeight: '600' }}>Ver detalles</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[dynamicStyles.td, { flex: 1.5 }]}>{item.categoria}</Text>

                                <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                    <StatePill state={estadoCalculado} />
                                </View>

                                <View style={{ flex: 2, justifyContent: 'center', paddingRight: 16 }}>
                                    <StockProgress stock={item.stock} puntoReorden={item.puntoReorden} state={estadoCalculado} />
                                </View>

                                <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <TouchableOpacity
                                        onPress={() => openAjusteModal(item, 'ENTRADA')}
                                        accessibilityLabel="Agregar stock"
                                        style={{
                                            backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.25)' : '#dcfce7',
                                            borderRadius: 6,
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                        }}
                                    >
                                        <Text style={{ color: '#16a34a', fontWeight: '800', fontSize: 16 }}>+</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => openAjusteModal(item, 'SALIDA')}
                                        accessibilityLabel="Quitar stock"
                                        style={{
                                            backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.25)' : '#fee2e2',
                                            borderRadius: 6,
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                        }}
                                    >
                                        <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 16 }}>−</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => openHistoryModal(item)}
                                        accessibilityLabel="Historial de movimientos"
                                    >
                                        <IconHistory color="#0d9488" size={18} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openReorderModal(item)}>
                                        <IconEdit color={
                                            estadoCalculado === 'AGOTADO' || estadoCalculado === 'CRÍTICO' ? '#ef4444' :
                                                estadoCalculado === 'STOCK BAJO' ? '#f97316' :
                                                    colors.subText
                                        } />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
            )}

            <Modal visible={isAjusteModalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{
                        backgroundColor: colors.card,
                        padding: 24,
                        borderRadius: 12,
                        width: Platform.OS === 'web' ? 440 : '92%',
                        maxWidth: 440,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
                            {ajusteTipo === 'ENTRADA' ? 'Entrada manual de stock' : 'Salida manual de stock'}
                        </Text>
                        <Text style={{ color: colors.subText, marginBottom: 16, fontSize: 13 }}>
                            {ajusteItem?.codigo} — {ajusteItem?.nombre}
                        </Text>
                        <Text style={{ color: colors.text, marginBottom: 6, fontSize: 14, fontWeight: '600' }}>
                            Stock actual: {ajusteItem?.stock ?? 0}
                            {ajusteItem?.medida ? ` ${ajusteItem.medida}` : ''}
                        </Text>
                        <Text style={{ color: colors.text, marginBottom: 6, fontSize: 14, fontWeight: '600' }}>
                            Cantidad *
                        </Text>
                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 8,
                                padding: 12,
                                color: colors.text,
                                marginBottom: 14,
                                fontSize: 16,
                                backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                                ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
                            }}
                            keyboardType="decimal-pad"
                            value={ajusteCantidad}
                            onChangeText={setAjusteCantidad}
                            placeholder="Ej: 10"
                            placeholderTextColor={colors.subText}
                        />
                        <Text style={{ color: colors.text, marginBottom: 6, fontSize: 14, fontWeight: '600' }}>
                            Motivo / razón * (obligatorio)
                        </Text>
                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 8,
                                padding: 12,
                                color: colors.text,
                                marginBottom: 20,
                                fontSize: 15,
                                minHeight: 88,
                                textAlignVertical: 'top',
                                backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                                ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
                            }}
                            multiline
                            numberOfLines={3}
                            value={ajusteRazon}
                            onChangeText={setAjusteRazon}
                            placeholder={
                                ajusteTipo === 'ENTRADA'
                                    ? 'Ej: Conteo físico, donación, corrección de inventario...'
                                    : 'Ej: Pérdida, daño, merma, corrección de inventario...'
                            }
                            placeholderTextColor={colors.subText}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setIsAjusteModalVisible(false)}
                                disabled={ajusteSaving}
                                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                            >
                                <Text style={{ color: colors.subText, fontWeight: '600' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveAjusteInventario}
                                disabled={ajusteSaving}
                                style={{
                                    backgroundColor: ajusteTipo === 'ENTRADA' ? '#16a34a' : '#dc2626',
                                    paddingVertical: 10,
                                    paddingHorizontal: 20,
                                    borderRadius: 8,
                                    opacity: ajusteSaving ? 0.7 : 1,
                                }}
                            >
                                {ajusteSaving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                        {ajusteTipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar salida'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={isModalVisible} transparent={true} animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, width: 350, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>
                            Punto de Reorden
                        </Text>
                        <Text style={{ color: colors.subText, marginBottom: 16 }}>
                            {selectedItem?.descripcion}
                        </Text>
                        <Text style={{ color: colors.text, marginBottom: 8, fontSize: 14 }}>
                            Límite mínimo de unidades (Stock actual: {selectedItem?.stock})
                        </Text>
                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 8,
                                padding: 12,
                                color: colors.text,
                                marginBottom: 20,
                                fontSize: 16,
                                backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                                ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
                            }}
                            keyboardType="numeric"
                            value={tempReorderPoint}
                            onChangeText={setTempReorderPoint}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                                <Text style={{ color: colors.subText, fontWeight: '600' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveReorderPoint} style={{ backgroundColor: '#0d7a78', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Historial de movimientos */}
            <Modal visible={isHistoryModalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        width: Platform.OS === 'web' ? 720 : '95%',
                        maxWidth: 720,
                        maxHeight: '85%',
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: 'hidden',
                    }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                                Historial de movimientos
                            </Text>
                            <Text style={{ color: colors.subText, marginTop: 4, fontSize: 14 }}>
                                {historyData?.producto?.codigo || historyItem?.codigo} — {historyData?.producto?.nombre || historyItem?.nombre}
                            </Text>
                            {historyData?.resumen && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                                    <Text style={{ fontSize: 12, color: colors.subText }}>
                                        Entradas: <Text style={{ fontWeight: '700', color: '#16a34a' }}>+{historyData.resumen.totalEntradas}</Text>
                                    </Text>
                                    <Text style={{ fontSize: 12, color: colors.subText }}>
                                        Salidas: <Text style={{ fontWeight: '700', color: '#dc2626' }}>-{historyData.resumen.totalSalidas}</Text>
                                    </Text>
                                    <Text style={{ fontSize: 12, color: colors.subText }}>
                                        Stock actual: <Text style={{ fontWeight: '700', color: colors.text }}>{historyData.resumen.stockActual}</Text>
                                    </Text>
                                </View>
                            )}
                        </View>

                        {historyLoading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#0d7a78" />
                            </View>
                        ) : (
                            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16 }}>
                                {!historyData?.movimientos?.length ? (
                                    <Text style={{ color: colors.subText, textAlign: 'center', padding: 24 }}>
                                        No hay movimientos registrados para este producto.
                                    </Text>
                                ) : (
                                    historyData.movimientos.map((mov: any) => {
                                        const lineas = formatDetalle(mov);
                                        const esEntrada = mov.tipo === 'ENTRADA';
                                        const colorTipo = !mov.afectaStock
                                            ? colors.subText
                                            : esEntrada ? '#16a34a' : '#dc2626';
                                        return (
                                            <View
                                                key={mov.clave}
                                                style={{
                                                    marginBottom: 12,
                                                    padding: 14,
                                                    borderRadius: 10,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    backgroundColor: isDarkMode ? '#111827' : '#f9fafb',
                                                    opacity: mov.afectaStock ? 1 : 0.65,
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                                        <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>
                                                            {mov.etiqueta}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: colors.subText, marginTop: 2 }}>
                                                            {formatFecha(mov.fecha)} ·{' '}
                                                            {mov.origen === 'GASTO'
                                                                ? 'Gasto'
                                                                : mov.origen === 'AJUSTE'
                                                                  ? 'Ajuste manual'
                                                                  : 'Consumo'}{' '}
                                                            #{mov.id}
                                                        </Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={{ fontWeight: '800', fontSize: 16, color: colorTipo }}>
                                                            {mov.signo}{mov.cantidad}
                                                        </Text>
                                                        {mov.afectaStock && mov.saldoDespues != null && (
                                                            <Text style={{ fontSize: 11, color: colors.subText, marginTop: 2 }}>
                                                                Saldo: {mov.saldoDespues}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                                {lineas.length > 0 && (
                                                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                                                        {lineas.map((linea, idx) => (
                                                            <Text key={idx} style={{ fontSize: 12, color: colors.text, marginBottom: 3 }}>
                                                                {linea}
                                                            </Text>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>
                        )}

                        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-end' }}>
                            <TouchableOpacity
                                onPress={() => setIsHistoryModalVisible(false)}
                                style={{ backgroundColor: '#0d7a78', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Detalles Modal */}
            <Modal visible={isDetailsModalVisible} transparent={true} animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 12, width: 400, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>
                            Detalles del Producto
                        </Text>

                        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 4 }}>Nombre</Text>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 16 }}>{detailsItem?.nombre}</Text>

                        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 4 }}>Referencia</Text>
                        <Text style={{ color: colors.text, fontSize: 14, marginBottom: 16 }}>{detailsItem?.referencia}</Text>

                        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 4 }}>Descripción</Text>
                        <Text style={{ color: colors.text, fontSize: 14, marginBottom: 16 }}>{detailsItem?.descripcion}</Text>

                        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 4 }}>Medida</Text>
                        <Text style={{ color: colors.text, fontSize: 14, marginBottom: 24 }}>{detailsItem?.medida}</Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity onPress={() => setIsDetailsModalVisible(false)} style={{ backgroundColor: '#0d7a78', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
        </>
    );
};

export default InventarioMantenimientoScreen;
