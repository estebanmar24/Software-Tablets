/**
 * SST Gastos Screen
 * SST personnel screen for recording monthly expenses and managing master data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as sstApi from '../services/sstApi';

const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },
    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'servicios', label: 'Tipos de Servicio', icon: '📋' },
    { key: 'proveedores', label: 'Proveedores', icon: '🏢' }
];

export default function SSTGastosScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('gastos');

    return (
        <View style={styles.container}>
            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={styles.tabIcon}>{tab.icon}</Text>
                        <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content based on active tab */}
            {activeTab === 'gastos' && <GastosTab />}
            {activeTab === 'graficas' && <GraficasTab />}
            {activeTab === 'rubros' && <RubrosTab />}
            {activeTab === 'servicios' && <ServiciosTab />}
            {activeTab === 'proveedores' && <ProveedoresTab />}
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    // Master data
    const [rubros, setRubros] = useState([]);
    const [tiposServicio, setTiposServicio] = useState([]);
    const [proveedores, setProveedores] = useState([]);

    // Filtered data for cascading dropdowns
    const [filteredTipos, setFilteredTipos] = useState([]);
    const [filteredProveedores, setFilteredProveedores] = useState([]);

    // Expense data
    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState(null);

    // Budget info for selected TipoServicio
    const [presupuestoInfo, setPresupuestoInfo] = useState(null);

    // Form state
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '',
        tipoServicioId: '',
        proveedorId: '',
        numeroFactura: '',
        precio: '',
        precioDisplay: '',
        fechaCompra: new Date().toISOString().split('T')[0],
        nota: '',
        archivoFactura: null,
        archivoNombre: ''
    });
    const [saving, setSaving] = useState(false);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadMasterData = useCallback(async () => {
        try {
            const [rubrosData, tiposData, proveedoresData] = await Promise.all([
                sstApi.getRubros(),
                sstApi.getTiposServicio(),
                sstApi.getProveedores()
            ]);
            setRubros(rubrosData);
            setTiposServicio(tiposData);
            setProveedores(proveedoresData);
        } catch (error) {
            console.error('Error loading master data:', error);
        }
    }, []);

    const loadGastos = useCallback(async () => {
        try {
            setLoading(true);
            const [gastosData, resumenData] = await Promise.all([
                sstApi.getGastos(anio, mes),
                sstApi.getGastosResumen(anio, mes)
            ]);
            setGastos(gastosData);
            setResumen(resumenData);
        } catch (error) {
            console.error('Error loading gastos:', error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    useEffect(() => {
        loadGastos();
    }, [loadGastos]);

    // Cascading filter: Rubro -> TipoServicio
    useEffect(() => {
        if (formData.rubroId) {
            const filtered = tiposServicio.filter(t => t.rubroId === parseInt(formData.rubroId));
            setFilteredTipos(filtered);
            if (!filtered.find(t => t.id === parseInt(formData.tipoServicioId))) {
                setFormData(prev => ({ ...prev, tipoServicioId: '', proveedorId: '' }));
            }
        } else {
            setFilteredTipos([]);
        }
    }, [formData.rubroId, tiposServicio]);

    // Cascading filter: TipoServicio -> Proveedor
    useEffect(() => {
        if (formData.tipoServicioId) {
            const filtered = proveedores.filter(p => p.tipoServicioId === parseInt(formData.tipoServicioId));
            setFilteredProveedores(filtered);
            if (!filtered.find(p => p.id === parseInt(formData.proveedorId))) {
                setFormData(prev => ({ ...prev, proveedorId: '' }));
            }
        } else {
            setFilteredProveedores([]);
        }
    }, [formData.tipoServicioId, proveedores]);

    // Load budget info when TipoServicio is selected
    useEffect(() => {
        const loadPresupuestoInfo = async () => {
            if (formData.tipoServicioId) {
                try {
                    // Get presupuesto for this TipoServicio in current month/year
                    const presupuestos = await sstApi.getPresupuestos(anio);

                    // Annual Budget for this Tipo
                    const presupuestoAnual = presupuestos
                        .filter(p => p.tipoServicioId === parseInt(formData.tipoServicioId))
                        .reduce((sum, p) => sum + p.presupuesto, 0);

                    // Monthly Budget
                    const presupuestoMes = presupuestos.find(
                        p => p.tipoServicioId === parseInt(formData.tipoServicioId) && p.mes === mes
                    );

                    // Calculate how much has been spent for this TipoServicio (Monthly)
                    const gastadoTipoMes = gastos
                        .filter(g => g.tipoServicioId === parseInt(formData.tipoServicioId))
                        .reduce((sum, g) => sum + g.precio, 0);

                    const presupuestoValor = presupuestoMes?.presupuesto || 0;
                    const restante = presupuestoValor - gastadoTipoMes;

                    setPresupuestoInfo({
                        presupuestoAnual: presupuestoAnual,
                        presupuestoMensual: presupuestoValor,
                        gastadoMes: gastadoTipoMes,
                        restanteMes: restante,
                        tipoServicioNombre: tiposServicio.find(t => t.id === parseInt(formData.tipoServicioId))?.nombre || ''
                    });
                } catch (error) {
                    console.error('Error loading presupuesto info:', error);
                    setPresupuestoInfo(null);
                }
            } else {
                setPresupuestoInfo(null);
            }
        };
        loadPresupuestoInfo();
    }, [formData.tipoServicioId, anio, mes, gastos, tiposServicio]);

    const resetForm = () => {
        setEditItem(null);
        setFormData({
            rubroId: '',
            tipoServicioId: '',
            proveedorId: '',
            numeroFactura: '',
            precio: '',
            precioDisplay: '',
            fechaCompra: new Date().toISOString().split('T')[0],
            nota: '',
            archivoFactura: null,
            archivoNombre: ''
        });
    };

    const handleEdit = (gasto) => {
        setEditItem(gasto);
        setFormData({
            rubroId: gasto.rubroId?.toString() || '',
            tipoServicioId: gasto.tipoServicioId?.toString() || '',
            proveedorId: gasto.proveedorId?.toString() || '',
            numeroFactura: gasto.numeroFactura || '',
            precio: gasto.precio?.toString() || '',
            precioDisplay: formatCurrencyInput(gasto.precio?.toString() || ''),
            fechaCompra: gasto.fechaCompra?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '',
            archivoFactura: gasto.archivoFactura || null,
            archivoNombre: gasto.archivoFactura ? 'Archivo adjunto' : ''
        });
        setShowModal(true);
    };

    // Format currency with thousands separator
    const formatCurrencyInput = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
    };

    const handlePriceChange = (value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        const formatted = formatCurrencyInput(value);
        setFormData(prev => ({ ...prev, precio: numericValue, precioDisplay: formatted }));
    };

    // Pick PDF file
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];

            // Check file size (max 5MB for Base64)
            if (file.size && file.size > 5 * 1024 * 1024) {
                Alert.alert('⚠️ Error', 'El archivo es muy grande. Máximo 5MB.');
                return;
            }

            if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({
                        ...prev,
                        archivoFactura: reader.result,
                        archivoNombre: file.name
                    }));
                    Alert.alert('✅ Éxito', `Archivo "${file.name}" cargado correctamente. Recuerde guardar el gasto para que se almacene.`);
                };
                reader.onerror = () => {
                    Alert.alert('❌ Error', 'No se pudo leer el archivo');
                };
                reader.readAsDataURL(blob);
            } else {
                setFormData(prev => ({
                    ...prev,
                    archivoFactura: file.uri,
                    archivoNombre: file.name
                }));
                Alert.alert('✅ Éxito', `Archivo "${file.name}" seleccionado. Recuerde guardar el gasto.`);
            }
        } catch (error) {
            console.error('Error picking file:', error);
            Alert.alert('❌ Error', 'No se pudo seleccionar el archivo: ' + error.message);
        }
    };

    // Generate date options for picker
    const generateDateOptions = () => {
        const dates = [];
        const today = new Date();
        for (let i = 30; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push({
                value: date.toISOString().split('T')[0],
                label: date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            });
        }
        return dates.reverse();
    };

    const handleSubmit = async () => {
        if (!formData.rubroId || !formData.tipoServicioId || !formData.proveedorId) {
            Alert.alert('Error', 'Por favor complete todos los campos requeridos');
            return;
        }
        if (!formData.numeroFactura.trim()) {
            Alert.alert('Error', 'El número de factura es obligatorio');
            return;
        }
        if (!formData.precio) {
            Alert.alert('Error', 'El precio es obligatorio');
            return;
        }

        try {
            setSaving(true);
            const gastoData = {
                rubroId: parseInt(formData.rubroId),
                tipoServicioId: parseInt(formData.tipoServicioId),
                proveedorId: parseInt(formData.proveedorId),
                anio,
                mes,
                numeroFactura: formData.numeroFactura,
                precio: parseFloat(formData.precio),
                fechaCompra: formData.fechaCompra,
                nota: formData.nota,
                archivoFactura: formData.archivoFactura,
                archivoFacturaNombre: formData.archivoNombre
            };

            if (editItem) {
                await sstApi.updateGasto(editItem.id, gastoData);
                Alert.alert('Éxito', 'Gasto actualizado correctamente');
            } else {
                await sstApi.createGasto(gastoData);
                Alert.alert('Éxito', 'Gasto registrado correctamente');
            }
            setShowModal(false);
            resetForm();
            loadGastos();
        } catch (error) {
            console.error('Error saving gasto:', error);
            Alert.alert('Error', 'No se pudo guardar el gasto');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Está seguro de eliminar este gasto?')) {
                try {
                    await sstApi.deleteGasto(id);
                    loadGastos();
                    Alert.alert('Éxito', 'Gasto eliminado correctamente');
                } catch (error) {
                    Alert.alert('Error', 'No se pudo eliminar el gasto');
                }
            }
        } else {
            Alert.alert(
                'Confirmar',
                '¿Está seguro de eliminar este gasto?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await sstApi.deleteGasto(id);
                                loadGastos();
                            } catch (error) {
                                Alert.alert('Error', 'No se pudo eliminar el gasto');
                            }
                        }
                    }
                ]
            );
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-CO');
    };

    // Check if factura is filled to enable precio
    const isPrecioEnabled = formData.numeroFactura.trim().length > 0;

    return (
        <View style={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>📋 Gastos SST</Text>
                <View style={styles.filters}>
                    <Picker
                        selectedValue={anio}
                        onValueChange={setAnio}
                        style={styles.picker}
                    >
                        {anios.map(a => (
                            <Picker.Item key={a} label={a.toString()} value={a} />
                        ))}
                    </Picker>
                    <Picker
                        selectedValue={mes}
                        onValueChange={setMes}
                        style={styles.picker}
                    >
                        {sstApi.MESES.map(m => (
                            <Picker.Item key={m.value} label={m.label} value={m.value} />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* Summary Cards */}
            {resumen && (
                <View style={styles.summaryContainer}>
                    <View style={[styles.summaryCard, styles.presupuestoCard]}>
                        <Text style={styles.summaryLabel}>Presupuesto</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(resumen.totalPresupuesto)}</Text>
                    </View>
                    <View style={[styles.summaryCard, styles.gastadoCard]}>
                        <Text style={styles.summaryLabel}>Gastado</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(resumen.totalGastado)}</Text>
                    </View>
                    <View style={[styles.summaryCard, resumen.totalRestante >= 0 ? styles.restanteCard : styles.excesoCard]}>
                        <Text style={styles.summaryLabel}>{resumen.totalRestante >= 0 ? 'Restante' : 'Exceso'}</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(Math.abs(resumen.totalRestante))}</Text>
                    </View>
                </View>
            )}

            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
                <Text style={styles.addButtonText}>+ Agregar Gasto</Text>
            </TouchableOpacity>

            {/* Gastos List */}
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={styles.loading} />
            ) : (
                <ScrollView style={styles.listContainer}>
                    {gastos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No hay gastos registrados para este período</Text>
                        </View>
                    ) : (
                        gastos.map(gasto => (
                            <View key={gasto.id} style={styles.gastoCard}>
                                <View style={styles.gastoHeader}>
                                    <Text style={styles.gastoTipo}>{gasto.tipoServicioNombre}</Text>
                                    <Text style={styles.gastoPrecio}>{formatCurrency(gasto.precio)}</Text>
                                </View>
                                <Text style={styles.gastoRubro}>{gasto.rubroNombre}</Text>
                                <View style={styles.gastoDetails}>
                                    <Text style={styles.gastoDetail}>🏢 {gasto.proveedorNombre}</Text>
                                    <Text style={styles.gastoDetail}>📅 {formatDate(gasto.fechaCompra)}</Text>
                                    <Text style={styles.gastoDetail}>📄 Factura: {gasto.numeroFactura}</Text>
                                </View>
                                {gasto.nota && (
                                    <Text style={styles.gastoNota}>💬 {gasto.nota}</Text>
                                )}
                                <View style={styles.cardActions}>
                                    {gasto.archivoFactura && (
                                        <TouchableOpacity
                                            style={styles.downloadButton}
                                            onPress={() => {
                                                if (Platform.OS === 'web') {
                                                    const link = document.createElement('a');
                                                    link.href = gasto.archivoFactura;
                                                    link.download = gasto.archivoFacturaNombre || `factura_${gasto.numeroFactura || gasto.id}.pdf`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                } else {
                                                    Alert.alert('Info', 'Descarga disponible solo en web');
                                                }
                                            }}
                                        >
                                            <Text style={styles.downloadButtonText}>📥 Descargar Factura</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.editCardButton}
                                        onPress={() => handleEdit(gasto)}
                                    >
                                        <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDelete(gasto.id)}
                                    >
                                        <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar Gasto' : 'Nuevo Gasto'}</Text>

                        <ScrollView style={styles.formContainer}>
                            {/* Rubro */}
                            <Text style={styles.label}>Rubro *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={formData.rubroId}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, rubroId: value }))}
                                >
                                    <Picker.Item label="Seleccione..." value="" />
                                    {rubros.map(r => (
                                        <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Tipo Servicio */}
                            <Text style={styles.label}>Tipo de Servicio *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={formData.tipoServicioId}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, tipoServicioId: value }))}
                                    enabled={filteredTipos.length > 0}
                                >
                                    <Picker.Item label="Seleccione..." value="" />
                                    {filteredTipos.map(t => (
                                        <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Proveedor */}
                            <Text style={styles.label}>
                                Proveedor * {formData.tipoServicioId && filteredProveedores.length === 0 && '(No hay proveedores para este tipo - agrégalos en la pestaña Proveedores)'}
                            </Text>
                            <View style={[styles.pickerContainer, filteredProveedores.length === 0 && styles.pickerDisabled]}>
                                <Picker
                                    selectedValue={formData.proveedorId}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, proveedorId: value }))}
                                    enabled={filteredProveedores.length > 0}
                                >
                                    <Picker.Item label={filteredProveedores.length === 0 ? "Sin proveedores disponibles" : "Seleccione..."} value="" />
                                    {filteredProveedores.map(p => (
                                        <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Número de Factura - Required first */}
                            <Text style={styles.label}>Número de Factura * (ingrese primero)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.numeroFactura}
                                onChangeText={(value) => setFormData(prev => ({ ...prev, numeroFactura: value }))}
                                placeholder="Obligatorio para habilitar precio"
                            />

                            {/* Precio with currency formatting - disabled until factura is filled */}
                            <Text style={styles.label}>Precio * {!isPrecioEnabled && '(ingrese factura primero)'}</Text>
                            <TextInput
                                style={[styles.input, !isPrecioEnabled && styles.inputDisabled]}
                                keyboardType="numeric"
                                value={formData.precioDisplay}
                                onChangeText={handlePriceChange}
                                placeholder="$ 0"
                                editable={isPrecioEnabled}
                            />

                            {/* Budget Info Panel */}
                            {presupuestoInfo && (
                                <View style={styles.budgetInfoPanel}>
                                    <Text style={styles.budgetInfoTitle}>
                                        📊 Presupuesto: {presupuestoInfo.tipoServicioNombre}
                                    </Text>
                                    {(() => {
                                        // Calculate live totals
                                        const currentPrice = parseFloat(formData.precioDisplay.replace(/[^0-9]/g, '')) || 0;

                                        // If editing, subtract the old price of this item from the total spent so far
                                        const originalPrice = editItem ? (editItem.precio || 0) : 0;
                                        const adjustedGastadoMes = (presupuestoInfo.gastadoMes || 0) - originalPrice;

                                        const liveGastado = adjustedGastadoMes + currentPrice;
                                        const liveRestante = (presupuestoInfo.presupuestoMensual || 0) - liveGastado;

                                        return (
                                            <>
                                                <View style={styles.budgetInfoRow}>
                                                    <View style={[styles.budgetInfoItem, { backgroundColor: '#E0E7FF' }]}>
                                                        <Text style={styles.budgetInfoLabel}>Presupuesto Anual</Text>
                                                        <Text style={styles.budgetInfoValue}>
                                                            {formatCurrency(presupuestoInfo.presupuestoAnual || 0)}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.budgetInfoItem, { backgroundColor: '#FEF3C7' }]}>
                                                        <Text style={styles.budgetInfoLabel}>Gastado</Text>
                                                        <Text style={[styles.budgetInfoValue, { color: '#D97706' }]}>
                                                            {formatCurrency(liveGastado)}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.budgetInfoItem, { backgroundColor: '#E0F2FE' }]}>
                                                        <Text style={styles.budgetInfoLabel}>Presupuesto Mensual</Text>
                                                        <Text style={styles.budgetInfoValue}>
                                                            {formatCurrency(presupuestoInfo.presupuestoMensual || 0)}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Live Restante Indicator */}
                                                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                                    <Text style={{ fontSize: 12, color: '#4B5563' }}>Restante Mensual:</Text>
                                                    <Text style={{
                                                        fontWeight: 'bold',
                                                        fontSize: 14,
                                                        color: liveRestante >= 0 ? '#059669' : '#DC2626'
                                                    }}>
                                                        {formatCurrency(liveRestante)}
                                                    </Text>
                                                </View>

                                                {liveRestante < 0 && (
                                                    <Text style={styles.budgetWarning}>
                                                        ⚠️ Este gasto excederá el presupuesto mensual en {formatCurrency(Math.abs(liveRestante))}
                                                    </Text>
                                                )}
                                            </>
                                        );
                                    })()}

                                    {presupuestoInfo.presupuestoMensual === 0 && (
                                        <Text style={styles.budgetNoData}>
                                            ℹ️ No hay presupuesto mensual asignado para este tipo de servicio
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Fecha de Compra - Beautiful Calendar Picker */}
                            <Text style={styles.label}>Fecha de Compra</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={formData.fechaCompra}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fechaCompra: e.target.value }))}
                                    style={{
                                        padding: 12,
                                        fontSize: 16,
                                        borderRadius: 8,
                                        border: '1px solid #D1D5DB',
                                        backgroundColor: '#F9FAFB',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer'
                                    }}
                                />
                            ) : (
                                <TextInput
                                    style={styles.input}
                                    value={formData.fechaCompra}
                                    onChangeText={(value) => setFormData(prev => ({ ...prev, fechaCompra: value }))}
                                    placeholder="YYYY-MM-DD"
                                />
                            )}

                            {/* PDF Attachment */}
                            <Text style={styles.label}>Factura Electrónica (PDF) - Opcional</Text>
                            <TouchableOpacity style={styles.fileButton} onPress={handlePickFile}>
                                <Text style={styles.fileButtonText}>
                                    {formData.archivoNombre || '📎 Seleccionar archivo PDF'}
                                </Text>
                            </TouchableOpacity>
                            {formData.archivoNombre && (
                                <TouchableOpacity
                                    onPress={() => setFormData(prev => ({ ...prev, archivoFactura: null, archivoNombre: '' }))}
                                >
                                    <Text style={styles.removeFile}>❌ Quitar archivo</Text>
                                </TouchableOpacity>
                            )}

                            {/* Nota */}
                            <Text style={styles.label}>Nota</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={formData.nota}
                                onChangeText={(value) => setFormData(prev => ({ ...prev, nota: value }))}
                                placeholder="Observaciones..."
                                multiline
                                numberOfLines={3}
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => { setShowModal(false); resetForm(); }}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                                onPress={handleSubmit}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ===================== RUBROS TAB =====================
function RubrosTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await sstApi.getRubros();
            setItems(data);
        } catch (error) {
            console.error('Error loading rubros:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAdd = () => {
        setEditItem(null);
        setNombre('');
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setNombre(item.nombre);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) {
            Alert.alert('Error', 'El nombre es obligatorio');
            return;
        }

        try {
            setSaving(true);
            if (editItem) {
                await sstApi.updateRubro(editItem.id, { nombre });
            } else {
                await sstApi.createRubro({ nombre });
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error('Error saving:', error);
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        Alert.alert('Confirmar', '¿Eliminar este rubro?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await sstApi.deleteRubro(id);
                        loadData();
                    } catch (error) {
                        Alert.alert('Error', 'No se pudo eliminar (puede tener datos relacionados)');
                    }
                }
            }
        ]);
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📁 Rubros</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <Text style={styles.itemName}>{item.nombre}</Text>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Rubro</Text>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ===================== SERVICIOS TAB =====================
function ServiciosTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [filterRubroId, setFilterRubroId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [rubroId, setRubroId] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [tiposData, rubrosData] = await Promise.all([
                sstApi.getTiposServicio(),
                sstApi.getRubros()
            ]);
            setItems(tiposData);
            setRubros(rubrosData);
        } catch (error) {
            console.error('Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const filteredItems = filterRubroId
        ? items.filter(i => i.rubroId === parseInt(filterRubroId))
        : items;

    const handleAdd = () => { setEditItem(null); setNombre(''); setRubroId(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setRubroId(item.rubroId?.toString() || ''); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim() || !rubroId) { Alert.alert('Error', 'Complete todos los campos'); return; }
        try {
            setSaving(true);
            if (editItem) {
                await sstApi.updateTipoServicio(editItem.id, { nombre, rubroId: parseInt(rubroId) });
            } else {
                await sstApi.createTipoServicio({ nombre, rubroId: parseInt(rubroId) });
            }
            setShowModal(false);
            loadData();
        } catch (error) { Alert.alert('Error', 'No se pudo guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        Alert.alert('Confirmar', '¿Eliminar?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await sstApi.deleteTipoServicio(id); loadData(); } catch { Alert.alert('Error', 'No se pudo eliminar'); } } }
        ]);
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📋 Tipos de Servicio</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>
            {/* Filter */}
            <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Filtrar por Rubro:</Text>
                <View style={[styles.pickerContainer, { flex: 1 }]}>
                    <Picker selectedValue={filterRubroId} onValueChange={setFilterRubroId}>
                        <Picker.Item label="Todos" value="" />
                        {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                    </Picker>
                </View>
            </View>
            <ScrollView style={styles.listContainer}>
                {filteredItems.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemParent}>Rubro: {item.rubroNombre}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Tipo de Servicio</Text>
                        <Text style={styles.label}>Rubro *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={rubroId} onValueChange={setRubroId}>
                                <Picker.Item label="Seleccione..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ===================== PROVEEDORES TAB =====================
function ProveedoresTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [tiposServicio, setTiposServicio] = useState([]);
    const [filterRubroId, setFilterRubroId] = useState('');
    const [filterTipoId, setFilterTipoId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [tipoServicioId, setTipoServicioId] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [provData, tiposData, rubrosData] = await Promise.all([
                sstApi.getProveedores(),
                sstApi.getTiposServicio(),
                sstApi.getRubros()
            ]);
            setItems(provData);
            setTiposServicio(tiposData);
            setRubros(rubrosData);
        } catch (error) {
            console.error('Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Filter tipos by rubro
    const filteredTipos = filterRubroId
        ? tiposServicio.filter(t => t.rubroId === parseInt(filterRubroId))
        : tiposServicio;

    // Filter items
    let filteredItems = items;
    if (filterTipoId) {
        filteredItems = filteredItems.filter(i => i.tipoServicioId === parseInt(filterTipoId));
    } else if (filterRubroId) {
        const tipoIds = filteredTipos.map(t => t.id);
        filteredItems = filteredItems.filter(i => tipoIds.includes(i.tipoServicioId));
    }

    // Reset tipo filter when rubro changes
    useEffect(() => {
        setFilterTipoId('');
    }, [filterRubroId]);

    const handleAdd = () => { setEditItem(null); setNombre(''); setTipoServicioId(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setTipoServicioId(item.tipoServicioId?.toString() || ''); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim() || !tipoServicioId) { Alert.alert('Error', 'Complete todos los campos'); return; }
        try {
            setSaving(true);
            if (editItem) {
                await sstApi.updateProveedor(editItem.id, { nombre, tipoServicioId: parseInt(tipoServicioId) });
            } else {
                await sstApi.createProveedor({ nombre, tipoServicioId: parseInt(tipoServicioId) });
            }
            setShowModal(false);
            loadData();
        } catch (error) { Alert.alert('Error', 'No se pudo guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        Alert.alert('Confirmar', '¿Eliminar?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await sstApi.deleteProveedor(id); loadData(); } catch { Alert.alert('Error', 'No se pudo eliminar'); } } }
        ]);
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>🏢 Proveedores</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}><Text style={styles.addButtonText}>+ Agregar</Text></TouchableOpacity>
            </View>
            {/* Filters */}
            <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Rubro:</Text>
                <View style={[styles.pickerContainer, { flex: 1, marginRight: 8 }]}>
                    <Picker selectedValue={filterRubroId} onValueChange={setFilterRubroId}>
                        <Picker.Item label="Todos" value="" />
                        {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                    </Picker>
                </View>
                <Text style={styles.filterLabel}>Tipo:</Text>
                <View style={[styles.pickerContainer, { flex: 1 }]}>
                    <Picker selectedValue={filterTipoId} onValueChange={setFilterTipoId} enabled={filteredTipos.length > 0}>
                        <Picker.Item label="Todos" value="" />
                        {filteredTipos.map(t => <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />)}
                    </Picker>
                </View>
            </View>
            <ScrollView style={styles.listContainer}>
                {filteredItems.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemParent}>Tipo: {item.tipoServicioNombre}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Proveedor</Text>
                        <Text style={styles.label}>Tipo de Servicio *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={tipoServicioId} onValueChange={setTipoServicioId}>
                                <Picker.Item label="Seleccione..." value="" />
                                {tiposServicio.map(t => <Picker.Item key={t.id} label={t.nombre} value={t.id.toString()} />)}
                            </Picker>
                        </View>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ===================== GRAFICAS TAB =====================
function GraficasTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = useState(''); // '' = Todos (Anual), 1-12 = Mes

    // Data storage
    const [gastosTotales, setGastosTotales] = useState([]); // Array of 12 months summaries
    const [allGastosRaw, setAllGastosRaw] = useState([]); // Flat list of all expenses

    // View state
    const [resumenVisual, setResumenVisual] = useState(null);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            // 1. Load Monthly Summaries (for the bottom table and annual totals)
            const gastosPromises = Array.from({ length: 12 }, (_, i) =>
                sstApi.getGastosResumen(anio, i + 1)
            );
            const resumenMeses = await Promise.all(gastosPromises);
            setGastosTotales(resumenMeses);

            // 2. Load All Raw Expenses (for filtering by month/rubro/tipo)
            const allGastos = [];
            for (let mes = 1; mes <= 12; mes++) {
                try {
                    const gastosMes = await sstApi.getGastos(anio, mes);
                    // Inject 'mes' into each record if not present, though usually it is
                    gastosMes.forEach(g => g.mes = mes);
                    allGastos.push(...gastosMes);
                } catch (e) { /* ignore */ }
            }
            setAllGastosRaw(allGastos);

        } catch (error) {
            console.error('Error loading graficas:', error);
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Recalculate Visual Summary when Data OR Month Filter changes
    useEffect(() => {
        if (loading) return;

        let filteredGastos = [];
        let totalPresupuesto = 0;
        let totalGastado = 0;

        if (mesSeleccionado) {
            // MONTHLY VIEW
            const mesNum = parseInt(mesSeleccionado);
            filteredGastos = allGastosRaw.filter(g => g.mes === mesNum);

            // Get budget/spent totals from the summary array for this specific month
            const resumenMes = gastosTotales[mesNum - 1] || {};
            totalPresupuesto = resumenMes.totalPresupuesto || 0;
            totalGastado = resumenMes.totalGastado || 0;

        } else {
            // ANNUAL VIEW
            filteredGastos = allGastosRaw;
            totalPresupuesto = gastosTotales.reduce((sum, m) => sum + (m.totalPresupuesto || 0), 0);
            totalGastado = gastosTotales.reduce((sum, m) => sum + (m.totalGastado || 0), 0);
        }

        // Calculate Breakdowns
        const porRubro = {};
        const porTipo = {};
        const porProveedor = {};

        filteredGastos.forEach(g => {
            porRubro[g.rubroNombre] = (porRubro[g.rubroNombre] || 0) + g.precio;
            porTipo[g.tipoServicioNombre] = (porTipo[g.tipoServicioNombre] || 0) + g.precio;
            porProveedor[g.proveedorNombre] = (porProveedor[g.proveedorNombre] || 0) + g.precio;
        });

        setResumenVisual({
            titulo: mesSeleccionado ? `Mensual - ${sstApi.getMesNombre(mesSeleccionado)}` : 'Anual Completo',
            totalPresupuesto,
            totalGastado,
            totalRestante: totalPresupuesto - totalGastado,
            porcentajeUsado: totalPresupuesto > 0 ? ((totalGastado / totalPresupuesto) * 100).toFixed(1) : 0,
            porRubro: Object.entries(porRubro).sort((a, b) => b[1] - a[1]),
            porTipo: Object.entries(porTipo).sort((a, b) => b[1] - a[1]),
            porProveedor: Object.entries(porProveedor).sort((a, b) => b[1] - a[1]),
            totalGastos: filteredGastos.length
        });

    }, [mesSeleccionado, gastosTotales, allGastosRaw, loading]);


    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const getProgressColor = (percentage) => {
        if (percentage >= 100) return '#DC2626';
        if (percentage >= 80) return '#F59E0B';
        return '#10B981';
    };

    // Generate HTML Report based on CURRENT VIEW
    const generateReport = async () => {
        if (!resumenVisual) return;

        const reportTitle = `Informe ${resumenVisual.titulo} SST - ${anio}`;
        const today = new Date().toLocaleDateString('es-CO', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${reportTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { color: #1E3A5F; border-bottom: 3px solid #1E3A5F; padding-bottom: 10px; }
        h2 { color: #2563EB; margin-top: 30px; }
        .kpi-container { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
        .kpi-card { background: #EBF5FF; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 180px; }
        .kpi-value { font-size: 28px; font-weight: bold; color: #1E3A5F; }
        .kpi-label { color: #6B7280; margin-top: 8px; }
        .success { background: #DCFCE7; }
        .success .kpi-value { color: #047857; }
        .warning { background: #FEF2F2; }
        .warning .kpi-value { color: #DC2626; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1E3A5F; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #E5E7EB; }
        tr:nth-child(even) { background: #F9FAFB; }
        .bar-container { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
        .bar-label { width: 200px; }
        .bar { height: 20px; background: #3B82F6; border-radius: 4px; }
        .bar-value { font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
        .progress-bar { height: 30px; background: #E5E7EB; border-radius: 15px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; border-radius: 15px; }
        .progress-text { text-align: center; margin-top: 5px; color: #6B7280; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <h1>📊 ${reportTitle}</h1>
    <p><strong>Fecha de generación:</strong> ${today}</p>

    <h2>Resumen General</h2>
    <div class="kpi-container">
        <div class="kpi-card">
            <div class="kpi-value">${formatCurrency(resumenVisual.totalPresupuesto)}</div>
            <div class="kpi-label">💰 Presupuesto</div>
        </div>
        <div class="kpi-card success">
            <div class="kpi-value">${formatCurrency(resumenVisual.totalGastado)}</div>
            <div class="kpi-label">📊 Gastado</div>
        </div>
        <div class="kpi-card ${resumenVisual.totalRestante >= 0 ? 'success' : 'warning'}">
            <div class="kpi-value">${formatCurrency(Math.abs(resumenVisual.totalRestante))}</div>
            <div class="kpi-label">${resumenVisual.totalRestante >= 0 ? '✅ Restante' : '⚠️ Exceso'}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value">${resumenVisual.totalGastos}</div>
            <div class="kpi-label">📋 Registros</div>
        </div>
    </div>

    <h2>Ejecución Presupuestal</h2>
    <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min(resumenVisual.porcentajeUsado, 100)}%; background: ${getProgressColor(resumenVisual.porcentajeUsado)};"></div>
    </div>
    <p class="progress-text">${resumenVisual.porcentajeUsado}% ejecutado</p>

    ${resumenVisual.porRubro.length > 0 ? `
    <h2>📁 Gastos por Rubro</h2>
    <table>
        <tr><th>Rubro</th><th>Monto</th><th>% del Total</th></tr>
        ${resumenVisual.porRubro.map(([nombre, valor]) => `
            <tr>
                <td>${nombre}</td>
                <td>${formatCurrency(valor)}</td>
                <td>${((valor / resumenVisual.totalGastado) * 100).toFixed(1)}%</td>
            </tr>
        `).join('')}
    </table>` : '<p>No hay gastos registrados.</p>'}

    ${resumenVisual.porTipo.length > 0 ? `
    <h2>📋 Gastos por Tipo de Servicio</h2>
    <table>
        <tr><th>Tipo de Servicio</th><th>Monto</th><th>% del Total</th></tr>
        ${resumenVisual.porTipo.map(([nombre, valor]) => `
            <tr>
                <td>${nombre}</td>
                <td>${formatCurrency(valor)}</td>
                <td>${((valor / resumenVisual.totalGastado) * 100).toFixed(1)}%</td>
            </tr>
        `).join('')}
    </table>` : ''}

    ${resumenVisual.porProveedor.length > 0 ? `
    <h2>🏢 Gastos por Proveedor</h2>
    <table>
        <tr><th>Proveedor</th><th>Monto</th><th>% del Total</th></tr>
        ${resumenVisual.porProveedor.map(([nombre, valor]) => `
            <tr>
                <td>${nombre}</td>
                <td>${formatCurrency(valor)}</td>
                <td>${((valor / resumenVisual.totalGastado) * 100).toFixed(1)}%</td>
            </tr>
        `).join('')}
    </table>` : ''}

    ${!mesSeleccionado ? `
    <h2>📅 Resumen Mensual (Anual)</h2>
    <table>
        <tr><th>Mes</th><th>Presupuesto</th><th>Gastado</th><th>Restante</th><th>Ejecución</th></tr>
        ${gastosTotales.map((mes, idx) => {
            const presup = mes.totalPresupuesto || 0;
            const gast = mes.totalGastado || 0;
            const rest = presup - gast;
            const ejec = presup > 0 ? ((gast / presup) * 100).toFixed(1) : 0;
            return `
            <tr>
                <td>${sstApi.getMesNombre(idx + 1)}</td>
                <td>${formatCurrency(presup)}</td>
                <td>${formatCurrency(gast)}</td>
                <td style="color: ${rest >= 0 ? '#059669' : '#DC2626'}">${formatCurrency(rest)}</td>
                <td>${ejec}%</td>
            </tr>
        `;
        }).join('')}
    </table>` : ''}

    <div class="footer">
        <p>Este informe fue generado automáticamente por el Sistema SST.</p>
        <p>© ${new Date().getFullYear()} - Aleph SST</p>
    </div>
</body>
</html>`;

        if (Platform.OS === 'web') {
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Informe_${anio}_${mesSeleccionado ? 'Mes_' + mesSeleccionado : 'Anual'}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            Alert.alert('✅ Éxito', 'Informe generado y descargado correctamente');
        } else {
            Alert.alert('Info', 'La generación de informes está disponible solo en web');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Cargando gráficas...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>📊 Dashboard {resumenVisual ? resumenVisual.titulo : ''}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity style={grafStyles.reportButton} onPress={generateReport}>
                        <Text style={grafStyles.reportButtonText}>📄 Generar Informe</Text>
                    </TouchableOpacity>

                    <View style={styles.yearSelector}>
                        <Picker selectedValue={mesSeleccionado} onValueChange={setMesSeleccionado} style={{ width: 130, height: 40, marginRight: 8 }}>
                            <Picker.Item label="Todo el Año" value="" />
                            {Array.from({ length: 12 }, (_, i) => <Picker.Item key={i + 1} label={sstApi.getMesNombre(i + 1)} value={(i + 1).toString()} />)}
                        </Picker>
                        <Picker selectedValue={anio} onValueChange={setAnio} style={{ width: 100, height: 40 }}>
                            {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                        </Picker>
                    </View>
                </View>
            </View>

            {resumenVisual && (
                <>
                    {/* KPI Cards */}
                    <View style={grafStyles.kpiContainer}>
                        <View style={grafStyles.kpiCard}>
                            <Text style={grafStyles.kpiLabel}>💰 Presupuesto</Text>
                            <Text style={grafStyles.kpiValue}>{formatCurrency(resumenVisual.totalPresupuesto)}</Text>
                        </View>
                        <View style={[grafStyles.kpiCard, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={grafStyles.kpiLabel}>📊 Gastado</Text>
                            <Text style={[grafStyles.kpiValue, { color: '#047857' }]}>{formatCurrency(resumenVisual.totalGastado)}</Text>
                        </View>
                        <View style={[grafStyles.kpiCard, { backgroundColor: resumenVisual.totalRestante >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
                            <Text style={grafStyles.kpiLabel}>{resumenVisual.totalRestante >= 0 ? '✅ Restante' : '⚠️ Exceso'}</Text>
                            <Text style={[grafStyles.kpiValue, { color: resumenVisual.totalRestante >= 0 ? '#059669' : '#DC2626' }]}>
                                {formatCurrency(Math.abs(resumenVisual.totalRestante))}
                            </Text>
                        </View>
                        <View style={grafStyles.kpiCard}>
                            <Text style={grafStyles.kpiLabel}>📋 Registros</Text>
                            <Text style={grafStyles.kpiValue}>{resumenVisual.totalGastos}</Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={grafStyles.progressSection}>
                        <Text style={grafStyles.sectionTitle}>Ejecución {resumenVisual.titulo}</Text>
                        <View style={grafStyles.progressBar}>
                            <View style={[
                                grafStyles.progressFill,
                                {
                                    width: `${Math.min(resumenVisual.porcentajeUsado, 100)}%`,
                                    backgroundColor: getProgressColor(resumenVisual.porcentajeUsado)
                                }
                            ]} />
                        </View>
                        <Text style={grafStyles.progressText}>
                            {resumenVisual.porcentajeUsado}% ejecutado
                        </Text>
                    </View>

                    {/* Chart: Gastos por Rubro */}
                    {resumenVisual.porRubro.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>📁 Gastos por Rubro</Text>
                            {resumenVisual.porRubro.map(([nombre, valor], idx) => {
                                const maxVal = resumenVisual.porRubro[0][1];
                                const width = (valor / maxVal) * 100;
                                return (
                                    <View key={idx} style={grafStyles.barRow}>
                                        <Text style={grafStyles.barLabel} numberOfLines={1}>{nombre}</Text>
                                        <View style={grafStyles.barContainer}>
                                            <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#3B82F6' }]} />
                                        </View>
                                        <Text style={grafStyles.barValue}>{formatCurrency(valor)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Chart: Gastos por Tipo de Servicio */}
                    {resumenVisual.porTipo.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>📋 Gastos por Servicio (Top 5)</Text>
                            {resumenVisual.porTipo.slice(0, 5).map(([nombre, valor], idx) => {
                                const maxVal = resumenVisual.porTipo[0][1];
                                const width = (valor / maxVal) * 100;
                                return (
                                    <View key={idx} style={grafStyles.barRow}>
                                        <Text style={grafStyles.barLabel} numberOfLines={1}>{nombre}</Text>
                                        <View style={grafStyles.barContainer}>
                                            <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#8B5CF6' }]} />
                                        </View>
                                        <Text style={grafStyles.barValue}>{formatCurrency(valor)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Chart: Gastos por Proveedor */}
                    {resumenVisual.porProveedor.length > 0 && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>🏢 Gastos por Proveedor (Top 5)</Text>
                            {resumenVisual.porProveedor.slice(0, 5).map(([nombre, valor], idx) => {
                                const maxVal = resumenVisual.porProveedor[0][1];
                                const width = (valor / maxVal) * 100;
                                return (
                                    <View key={idx} style={grafStyles.barRow}>
                                        <Text style={grafStyles.barLabel} numberOfLines={1}>{nombre}</Text>
                                        <View style={grafStyles.barContainer}>
                                            <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#10B981' }]} />
                                        </View>
                                        <Text style={grafStyles.barValue}>{formatCurrency(valor)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Monthly Summary Table (Only in Annual view) */}
                    {!mesSeleccionado && (
                        <View style={grafStyles.chartSection}>
                            <Text style={grafStyles.sectionTitle}>📅 Resumen Mensual</Text>
                            <View style={grafStyles.tableHeader}>
                                <Text style={[grafStyles.tableCell, { flex: 2 }]}>Mes</Text>
                                <Text style={grafStyles.tableCell}>Presupuesto</Text>
                                <Text style={grafStyles.tableCell}>Gastado</Text>
                                <Text style={grafStyles.tableCell}>Restante</Text>
                            </View>
                            {gastosTotales.map((mes, idx) => (
                                <View key={idx} style={[grafStyles.tableRow, idx % 2 === 0 && grafStyles.tableRowAlt]}>
                                    <Text style={[grafStyles.tableCell, { flex: 2 }]}>{sstApi.getMesNombre(idx + 1)}</Text>
                                    <Text style={grafStyles.tableCell}>{formatCurrency(mes.totalPresupuesto || 0)}</Text>
                                    <Text style={grafStyles.tableCell}>{formatCurrency(mes.totalGastado || 0)}</Text>
                                    <Text style={[
                                        grafStyles.tableCell,
                                        { color: (mes.totalPresupuesto - mes.totalGastado) >= 0 ? '#059669' : '#DC2626' }
                                    ]}>
                                        {formatCurrency((mes.totalPresupuesto || 0) - (mes.totalGastado || 0))}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

// Graficas-specific styles
const grafStyles = StyleSheet.create({
    kpiContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    kpiCard: {
        flex: 1,
        minWidth: 180,
        backgroundColor: '#EBF5FF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    kpiLabel: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 8,
    },
    kpiValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E3A5F',
    },
    progressSection: {
        margin: 16,
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 12,
    },
    progressBar: {
        height: 24,
        backgroundColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 12,
    },
    progressText: {
        marginTop: 8,
        textAlign: 'center',
        color: '#6B7280',
        fontWeight: '500',
    },
    chartSection: {
        margin: 16,
        marginTop: 0,
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    barLabel: {
        width: 140,
        fontSize: 12,
        color: '#374151',
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginHorizontal: 8,
    },
    bar: {
        height: '100%',
        borderRadius: 4,
    },
    barValue: {
        width: 100,
        fontSize: 12,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'right',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        padding: 10,
        borderRadius: 6,
    },
    tableRow: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableRowAlt: {
        backgroundColor: '#F9FAFB',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        color: '#374151',
    },
    reportButton: {
        backgroundColor: '#059669',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    reportButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    reportOption: {
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    contentContainer: {
        flex: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        paddingHorizontal: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#F59E0B',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
        fontSize: 13,
    },
    activeTabText: {
        color: '#FFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    filters: {
        flexDirection: 'row',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterLabel: {
        fontSize: 13,
        color: '#4B5563',
        marginRight: 8,
    },
    picker: {
        width: 110,
        height: 40,
    },
    summaryContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    presupuestoCard: {
        backgroundColor: '#DBEAFE',
    },
    gastadoCard: {
        backgroundColor: '#FEE2E2',
    },
    restanteCard: {
        backgroundColor: '#D1FAE5',
    },
    excesoCard: {
        backgroundColor: '#FEE2E2',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#4B5563',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 4,
    },
    addButton: {
        backgroundColor: '#2563EB',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonSmall: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    loading: {
        marginTop: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
    gastoCard: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#2563EB',
    },
    gastoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    gastoTipo: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        flex: 1,
    },
    gastoPrecio: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#059669',
    },
    gastoRubro: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 10,
    },
    gastoDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    gastoDetail: {
        fontSize: 14,
        color: '#4B5563',
    },
    gastoNota: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
        marginTop: 10,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 14,
        gap: 12,
        flexWrap: 'wrap',
    },
    downloadButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    downloadButtonText: {
        color: '#047857',
        fontSize: 13,
        fontWeight: '600',
    },
    editCardButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#EBF5FF',
        borderRadius: 6,
    },
    editCardButtonText: {
        color: '#2563EB',
        fontSize: 13,
        fontWeight: '500',
    },
    deleteButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    deleteButtonText: {
        color: '#DC2626',
        fontSize: 13,
    },
    itemCard: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
    itemParent: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    itemActions: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        fontSize: 18,
    },
    deleteButtonIcon: {
        fontSize: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 500,
        maxHeight: '90%',
    },
    modalContentSmall: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    formContainer: {
        maxHeight: 400,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 4,
        marginTop: 12,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
    },
    pickerDisabled: {
        backgroundColor: '#E5E7EB',
        opacity: 0.7,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
    },
    inputDisabled: {
        backgroundColor: '#E5E7EB',
        color: '#9CA3AF',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    fileButton: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderStyle: 'dashed',
    },
    fileButtonText: {
        color: '#6B7280',
        textAlign: 'center',
    },
    removeFile: {
        color: '#DC2626',
        fontSize: 12,
        marginTop: 4,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    cancelButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    cancelButtonText: {
        color: '#4B5563',
    },
    submitButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    // Budget Panel Styles
    budgetInfoPanel: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    budgetInfoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    budgetInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    budgetInfoItem: {
        flex: 1,
        alignItems: 'center',
        padding: 4,
        backgroundColor: '#FFF',
        borderRadius: 4,
    },
    budgetInfoLabel: {
        fontSize: 10,
        color: '#6B7280',
        marginBottom: 2,
    },
    budgetInfoValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    budgetWarning: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
        textAlign: 'center',
    },
    budgetNoData: {
        color: '#6B7280',
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 8,
        textAlign: 'center',
    },
});
