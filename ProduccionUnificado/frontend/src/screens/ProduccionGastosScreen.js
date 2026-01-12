/**
 * Produccion Gastos Screen
 * EXACT copy of SST/GH visual styling with Production-specific logic.
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
import { produccionApi } from '../services/produccionApi';

// TABS - Same structure as SST
const TABS = [
    { key: 'gastos', label: 'Captura de Gastos', icon: '💰' },
    { key: 'graficas', label: 'Gráficas', icon: '📊' },
    { key: 'rubros', label: 'Rubros', icon: '📁' },
    { key: 'proveedores', label: 'Proveedores', icon: '🏢' },
    { key: 'tiposHora', label: 'Tipos de Hora', icon: '⏱️' },
    { key: 'salarios', label: 'Salarios', icon: '💵' },
];

const MESES = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$ 0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ProduccionGastosScreen() {
    const [activeTab, setActiveTab] = useState('gastos');

    return (
        <View style={styles.container}>
            {/* Tabs - EXACT SST STYLE */}
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
            {activeTab === 'proveedores' && <ProveedoresTab />}
            {activeTab === 'tiposHora' && <TiposHoraTab />}
            {activeTab === 'salarios' && <SalariosTab />}
        </View>
    );
}

// ===================== GASTOS TAB =====================
function GastosTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth() + 1);

    const [rubros, setRubros] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [maquinas, setMaquinas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [tiposHora, setTiposHora] = useState([]);

    const [gastos, setGastos] = useState([]);
    const [resumen, setResumen] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        rubroId: '', proveedorId: '', usuarioId: '', maquinaId: '', tipoHoraId: '',
        precio: '', fecha: new Date().toISOString().split('T')[0], nota: '', cantidadHoras: ''
    });
    const [saving, setSaving] = useState(false);
    const [presupuestoInfo, setPresupuestoInfo] = useState(null);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadMasterData = useCallback(async () => {
        try {
            const data = await produccionApi.getMaestros();
            setRubros(data.rubros || []);
            setProveedores(data.proveedores || []);
            setMaquinas(data.maquinas || []);
            setUsuarios(data.usuarios || []);
            setTiposHora(data.tiposHora || []);
        } catch (error) {
            console.error('Error loading master data:', error);
        }
    }, []);

    const loadGastos = useCallback(async () => {
        setLoading(true);
        try {
            const [gastosData, resumenData] = await Promise.all([
                produccionApi.getGastos(anio, mes),
                produccionApi.getResumen(anio, mes)
            ]);
            setGastos(gastosData.gastos || []);
            setResumen(resumenData);
        } catch (error) {
            console.error('Error loading gastos:', error);
        } finally {
            setLoading(false);
        }
    }, [anio, mes]);

    useEffect(() => { loadMasterData(); }, [loadMasterData]);
    useEffect(() => { loadGastos(); }, [loadGastos]);

    // Auto-calculate for Horas Extras
    useEffect(() => {
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        if (selectedRubro?.nombre === 'Horas Extras' && formData.usuarioId && formData.tipoHoraId && formData.cantidadHoras) {
            const usuario = usuarios.find(u => u.id == formData.usuarioId);
            const tipoHora = tiposHora.find(t => t.id == formData.tipoHoraId);
            if (usuario && tipoHora) {
                const hourlyRate = (usuario.salario || 0) / 240;
                const total = hourlyRate * (tipoHora.factor || 0) * parseFloat(formData.cantidadHoras);
                setFormData(prev => ({ ...prev, precio: Math.round(total).toString() }));
            }
        }
    }, [formData.rubroId, formData.usuarioId, formData.tipoHoraId, formData.cantidadHoras, rubros, usuarios, tiposHora]);

    // Load presupuestoInfo when Horas Extras is selected - SST style
    useEffect(() => {
        const loadPresupuestoInfo = async () => {
            const selectedRubro = rubros.find(r => r.id == formData.rubroId);
            if (selectedRubro?.nombre === 'Horas Extras' && resumen?.porRubro) {
                const horasExtrasInfo = resumen.porRubro.find(r => r.rubroNombre === 'Horas Extras');

                // Get real annual budget from grid endpoint
                let presupuestoAnualReal = 0;
                try {
                    const gridData = await produccionApi.getPresupuestosGrid(anio);
                    const horasExtrasGrid = gridData.tiposServicio?.find(t => t.tipoServicioNombre === 'Horas Extras');
                    if (horasExtrasGrid) {
                        presupuestoAnualReal = horasExtrasGrid.meses.reduce((sum, m) => sum + (m.presupuesto || 0), 0);
                    }
                } catch (e) {
                    console.error('Error loading annual budget:', e);
                }

                if (horasExtrasInfo) {
                    setPresupuestoInfo({
                        rubroNombre: 'Horas Extra',
                        presupuestoAnual: presupuestoAnualReal,
                        presupuestoMensual: horasExtrasInfo.presupuesto,
                        gastadoMes: horasExtrasInfo.gastado,
                        restanteMes: horasExtrasInfo.presupuesto - horasExtrasInfo.gastado
                    });
                } else {
                    setPresupuestoInfo({ rubroNombre: 'Horas Extra', presupuestoAnual: presupuestoAnualReal, presupuestoMensual: 0, gastadoMes: 0, restanteMes: 0 });
                }
            } else {
                setPresupuestoInfo(null);
            }
        };
        loadPresupuestoInfo();
    }, [formData.rubroId, rubros, resumen, anio]);

    const resetForm = () => {
        setEditItem(null);
        setFormData({ rubroId: '', proveedorId: '', usuarioId: '', maquinaId: '', tipoHoraId: '', precio: '', fecha: new Date().toISOString().split('T')[0], nota: '', cantidadHoras: '' });
    };

    const handleEdit = (gasto) => {
        setEditItem(gasto);
        setFormData({
            rubroId: gasto.rubroId?.toString() || '', proveedorId: gasto.proveedorId?.toString() || '',
            usuarioId: gasto.usuarioId?.toString() || '', maquinaId: gasto.maquinaId?.toString() || '',
            tipoHoraId: gasto.tipoHoraId?.toString() || '', precio: gasto.precio?.toString() || '',
            fecha: gasto.fecha?.split('T')[0] || new Date().toISOString().split('T')[0],
            nota: gasto.nota || '', cantidadHoras: gasto.cantidadHoras?.toString() || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.rubroId) { Alert.alert('Error', 'Seleccione un rubro'); return; }
        const selectedRubro = rubros.find(r => r.id == formData.rubroId);
        const isHorasExtras = selectedRubro?.nombre === 'Horas Extras';
        if (isHorasExtras && (!formData.usuarioId || !formData.tipoHoraId || !formData.cantidadHoras)) {
            Alert.alert('Error', 'Complete Operario, Tipo de Hora y Cantidad'); return;
        }
        if (!isHorasExtras && !formData.precio) { Alert.alert('Error', 'Ingrese el precio'); return; }

        try {
            setSaving(true);
            const gastoData = {
                rubroId: parseInt(formData.rubroId),
                proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null,
                usuarioId: formData.usuarioId ? parseInt(formData.usuarioId) : null,
                maquinaId: formData.maquinaId ? parseInt(formData.maquinaId) : null,
                tipoHoraId: formData.tipoHoraId ? parseInt(formData.tipoHoraId) : null,
                precio: parseFloat(formData.precio || 0), fecha: formData.fecha, nota: formData.nota,
                cantidadHoras: formData.cantidadHoras ? parseFloat(formData.cantidadHoras) : null,
                anio: new Date(formData.fecha).getFullYear(), mes: new Date(formData.fecha).getMonth() + 1
            };

            if (editItem) { await produccionApi.updateGasto(editItem.id, { ...gastoData, id: editItem.id }); }
            else { await produccionApi.createGasto(gastoData); }
            Alert.alert('Éxito', editItem ? 'Gasto actualizado' : 'Gasto registrado');
            setShowModal(false); resetForm(); loadGastos();
        } catch (error) { Alert.alert('Error', 'No se pudo guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => { try { await produccionApi.deleteGasto(id); loadGastos(); } catch { Alert.alert('Error', 'No se pudo eliminar'); } };
        if (Platform.OS === 'web') { if (window.confirm('¿Eliminar gasto?')) doDelete(); }
        else { Alert.alert('Confirmar', '¿Eliminar este gasto?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: doDelete }]); }
    };

    const selectedRubroName = rubros.find(r => r.id == formData.rubroId)?.nombre;
    const isHorasExtras = selectedRubroName === 'Horas Extras';
    const isMaintenance = selectedRubroName === 'Mantenimiento' || selectedRubroName === 'Repuesto';

    // Calculate totals for summary cards - SST style
    const totalMes = resumen?.total || 0;
    const porRubro = resumen?.porRubro || {};
    const rubroKeys = Object.keys(porRubro);

    return (
        <View style={styles.contentContainer}>
            {/* Header - EXACT SST STYLE */}
            <View style={styles.header}>
                <Text style={styles.title}>📋 Gastos Producción</Text>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mes} onValueChange={setMes} style={styles.picker}>
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
            </View>

            {/* Summary Cards - EXACT SST STYLE: 3 colored cards with budget data */}
            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.presupuestoCard]}>
                    <Text style={styles.summaryLabel}>Presupuesto</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(resumen?.totalPresupuesto || 0)}</Text>
                </View>
                <View style={[styles.summaryCard, styles.gastadoCard]}>
                    <Text style={styles.summaryLabel}>Gastado</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(resumen?.totalGastado || 0)}</Text>
                </View>
                <View style={[styles.summaryCard, (resumen?.totalRestante || 0) >= 0 ? styles.restanteCard : styles.excesoCard]}>
                    <Text style={styles.summaryLabel}>{(resumen?.totalRestante || 0) >= 0 ? 'Restante' : 'Exceso'}</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(Math.abs(resumen?.totalRestante || 0))}</Text>
                </View>
            </View>

            {/* Add Button - EXACT SST STYLE */}
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
                                    <Text style={styles.gastoTipo}>{gasto.rubro?.nombre || 'Sin Rubro'}</Text>
                                    <Text style={styles.gastoPrecio}>{formatCurrency(gasto.precio)}</Text>
                                </View>
                                <Text style={styles.gastoRubro}>{gasto.tipoHora?.nombre || 'General'}</Text>
                                <View style={styles.gastoDetails}>
                                    {gasto.usuario && <Text style={styles.gastoDetail}>🏢 {gasto.usuario.nombre}</Text>}
                                    {gasto.maquina && <Text style={styles.gastoDetail}>⚙️ {gasto.maquina.nombre}</Text>}
                                    {gasto.proveedor && <Text style={styles.gastoDetail}>🏢 {gasto.proveedor.nombre}</Text>}
                                    <Text style={styles.gastoDetail}>📅 {formatDate(gasto.fecha)}</Text>
                                    {gasto.cantidadHoras && <Text style={styles.gastoDetail}>⏱️ {gasto.cantidadHoras} hrs</Text>}
                                </View>
                                {gasto.nota && <Text style={styles.gastoNota}>💬 {gasto.nota}</Text>}
                                <View style={styles.cardActions}>
                                    <TouchableOpacity style={styles.editCardButton} onPress={() => handleEdit(gasto)}>
                                        <Text style={styles.editCardButtonText}>✏️ Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(gasto.id)}>
                                        <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add/Edit Modal - EXACT SST STYLE */}
            <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editItem ? 'Editar Gasto' : 'Nuevo Gasto'}</Text>
                        <ScrollView style={styles.formContainer}>
                            <Text style={styles.label}>Rubro *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.rubroId} onValueChange={(v) => setFormData(p => ({ ...p, rubroId: v }))}>
                                    <Picker.Item label="Seleccione..." value="" />
                                    {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                                </Picker>
                            </View>

                            {isHorasExtras && (<>
                                <Text style={styles.label}>Operario *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={formData.usuarioId} onValueChange={(v) => setFormData(p => ({ ...p, usuarioId: v }))}>
                                        <Picker.Item label="Seleccione..." value="" />
                                        {usuarios.map(u => <Picker.Item key={u.id} label={u.nombre} value={u.id.toString()} />)}
                                    </Picker>
                                </View>
                                <Text style={styles.label}>Tipo de Hora *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={formData.tipoHoraId} onValueChange={(v) => setFormData(p => ({ ...p, tipoHoraId: v }))}>
                                        <Picker.Item label="Seleccione..." value="" />
                                        {tiposHora.map(t => <Picker.Item key={t.id} label={`${t.nombre} (${t.porcentaje}%)`} value={t.id.toString()} />)}
                                    </Picker>
                                </View>
                                <Text style={styles.label}>Cantidad Horas *</Text>
                                <TextInput style={styles.input} value={formData.cantidadHoras} onChangeText={(t) => setFormData(p => ({ ...p, cantidadHoras: t }))} keyboardType="numeric" placeholder="Ej: 2.5" />
                            </>)}

                            {isMaintenance && (<>
                                <Text style={styles.label}>Máquina</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={formData.maquinaId} onValueChange={(v) => setFormData(p => ({ ...p, maquinaId: v }))}>
                                        <Picker.Item label="Seleccione..." value="" />
                                        {maquinas.map(m => <Picker.Item key={m.id} label={m.nombre} value={m.id.toString()} />)}
                                    </Picker>
                                </View>
                            </>)}

                            {!isHorasExtras && (<>
                                <Text style={styles.label}>Proveedor</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={formData.proveedorId} onValueChange={(v) => setFormData(p => ({ ...p, proveedorId: v }))}>
                                        <Picker.Item label="Seleccione..." value="" />
                                        {proveedores.map(p => <Picker.Item key={p.id} label={p.nombre} value={p.id.toString()} />)}
                                    </Picker>
                                </View>
                            </>)}

                            <Text style={styles.label}>Fecha de Compra</Text>
                            {Platform.OS === 'web' ? (
                                <input type="date" value={formData.fecha} onChange={(e) => setFormData(p => ({ ...p, fecha: e.target.value }))} style={{ padding: 12, fontSize: 16, borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', width: '100%', boxSizing: 'border-box' }} />
                            ) : (
                                <TextInput style={styles.input} value={formData.fecha} onChangeText={(t) => setFormData(p => ({ ...p, fecha: t }))} placeholder="YYYY-MM-DD" />
                            )}

                            <Text style={styles.label}>Precio * {isHorasExtras && '(calculado automáticamente)'}</Text>
                            <TextInput style={[styles.input, isHorasExtras && styles.inputDisabled]} value={formData.precio} onChangeText={(t) => setFormData(p => ({ ...p, precio: t }))} keyboardType="numeric" placeholder="$ 0" editable={!isHorasExtras} />

                            {/* Cuadro de presupuesto estilo SST - DEBAJO DEL PRECIO */}
                            {isHorasExtras && presupuestoInfo && (
                                <View style={styles.budgetContainer}>
                                    <View style={styles.budgetHeader}>
                                        <Text style={styles.budgetTitle}>
                                            📊 Presupuesto: {presupuestoInfo.rubroNombre}
                                        </Text>
                                    </View>
                                    {(() => {
                                        // Live calculation like SST
                                        const currentPrice = parseFloat(formData.precio) || 0;
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
                                            ℹ️ No hay presupuesto mensual asignado para Horas Extra
                                        </Text>
                                    )}
                                </View>
                            )}

                            <Text style={styles.label}>Nota</Text>
                            <TextInput style={[styles.input, styles.textArea]} value={formData.nota} onChangeText={(t) => setFormData(p => ({ ...p, nota: t }))} multiline placeholder="Opcional..." />

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={saving}>
                                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ===================== PRESUPUESTO TAB =====================
function GraficasTab() {
    const [loading, setLoading] = useState(true);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = useState(null); // null = anual
    const [graficasData, setGraficasData] = useState(null);

    const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await produccionApi.getGraficas(anio, mesSeleccionado);
            setGraficasData(data);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    }, [anio, mesSeleccionado]);

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    // Default empty data structure (like SST shows when no data)
    const data = graficasData || { totalGastado: 0, porRubro: [], porProveedor: [], porUsuario: [], resumenMensual: [] };

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>📊 Análisis de Gastos Producción</Text>
                <View style={styles.filters}>
                    <Picker selectedValue={anio} onValueChange={setAnio} style={styles.picker}>
                        {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                    </Picker>
                    <Picker selectedValue={mesSeleccionado} onValueChange={setMesSeleccionado} style={styles.picker}>
                        <Picker.Item label="Todo el Año" value={null} />
                        {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
                    </Picker>
                </View>
            </View>

            <ScrollView style={styles.listContainer}>
                {/* Dashboard Summary Cards - SST Style */}
                <View style={grafStyles.dashboardRow}>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#EFF6FF' }]}>
                        <Text style={grafStyles.cardLabel}>💰 Presupuesto</Text>
                        <Text style={[grafStyles.cardValue, { color: '#1E40AF' }]}>
                            {formatCurrency(data.resumenMensual?.reduce((sum, m) => sum + (m.totalPresupuesto || 0), 0) || 0)}
                        </Text>
                    </View>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={grafStyles.cardLabel}>📊 Gastado</Text>
                        <Text style={[grafStyles.cardValue, { color: '#059669' }]}>
                            {formatCurrency(data.totalGastado || 0)}
                        </Text>
                    </View>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={grafStyles.cardLabel}>✅ Restante</Text>
                        <Text style={[grafStyles.cardValue, { color: '#D97706' }]}>
                            {formatCurrency((data.resumenMensual?.reduce((sum, m) => sum + (m.totalPresupuesto || 0), 0) || 0) - (data.totalGastado || 0))}
                        </Text>
                    </View>
                    <View style={[grafStyles.summaryCardSmall, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={grafStyles.cardLabel}>📋 Registros</Text>
                        <Text style={[grafStyles.cardValue, { color: '#374151' }]}>
                            {(data.porRubro?.reduce((sum, r) => sum + 1, 0) || 0)}
                        </Text>
                    </View>
                </View>

                {/* Ejecución Anual Completo - Progress Bar */}
                <View style={grafStyles.chartSection}>
                    <Text style={grafStyles.sectionTitle}>{mesSeleccionado ? `Ejecución ${MESES.find(m => m.value === mesSeleccionado)?.label}` : 'Ejecución Anual'} Completo</Text>
                    <View style={grafStyles.progressBarContainer}>
                        <View style={[grafStyles.progressBar, {
                            width: `${Math.min(100, ((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}%`,
                            backgroundColor: ((data.totalGastado || 0) > (data.totalPresupuesto || 0)) ? '#DC2626' : '#10B981'
                        }]} />
                    </View>
                    <Text style={grafStyles.progressText}>
                        {Math.round(((data.totalGastado || 0) / Math.max(1, data.totalPresupuesto || 1)) * 100)}% ejecutado ({formatCurrency(data.totalGastado)} / {formatCurrency(data.totalPresupuesto)})
                    </Text>
                </View>

                {/* Gastos por Rubro (Mensual/Anual) vs Presupuesto - Progress Bars */}
                {data.desempenoRubro?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>📁 Desempeño por Rubro ({mesSeleccionado ? 'Mensual' : 'Anual'})</Text>
                        {data.desempenoRubro.map((item, idx) => {
                            const rubroPorcentaje = (item.presupuesto > 0) ? Math.round((item.gastado / item.presupuesto) * 100) : (item.gastado > 0 ? 101 : 0);
                            const isExceeded = item.gastado > item.presupuesto && item.presupuesto > 0;
                            const isZeroBudgetWithGasto = item.presupuesto === 0 && item.gastado > 0;

                            return (
                                <View key={idx} style={grafStyles.rubroReportRow}>
                                    <View style={grafStyles.rubroReportHeader}>
                                        <Text style={grafStyles.rubroReportName}>{item.nombre}</Text>
                                        <Text style={[grafStyles.rubroReportStatus, (isExceeded || isZeroBudgetWithGasto) ? { color: '#DC2626' } : { color: '#059669' }]}>
                                            {formatCurrency(item.gastado)} / {formatCurrency(item.presupuesto)}
                                        </Text>
                                    </View>
                                    <View style={grafStyles.rubroProgressBarContainer}>
                                        <View style={[
                                            grafStyles.rubroProgressBar,
                                            {
                                                width: `${Math.min(100, rubroPorcentaje)}%`,
                                                backgroundColor: (isExceeded || isZeroBudgetWithGasto) ? '#DC2626' : '#3B82F6'
                                            }
                                        ]} />
                                    </View>
                                    {(isExceeded || isZeroBudgetWithGasto) && (
                                        <Text style={grafStyles.rubroWarningText}>⚠️ Superó presupuesto por {formatCurrency(item.gastado - item.presupuesto)}</Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Chart: Gastos por Rubro */}
                {data.porRubro?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>📁 Gastos por Rubro</Text>
                        {data.porRubro.map((item, idx) => {
                            const maxVal = data.porRubro[0]?.total || 1;
                            const width = (item.total / maxVal) * 100;
                            return (
                                <View key={idx} style={grafStyles.barRow}>
                                    <Text style={grafStyles.barLabel} numberOfLines={1}>{item.nombre}</Text>
                                    <View style={grafStyles.barContainer}>
                                        <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#3B82F6' }]} />
                                    </View>
                                    <Text style={grafStyles.barValue}>{formatCurrency(item.total)}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Chart: Gastos por Proveedor */}
                {data.porProveedor?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>🏢 Gastos por Proveedor (Top 5)</Text>
                        {data.porProveedor.map((item, idx) => {
                            const maxVal = data.porProveedor[0]?.total || 1;
                            const width = (item.total / maxVal) * 100;
                            return (
                                <View key={idx} style={grafStyles.barRow}>
                                    <Text style={grafStyles.barLabel} numberOfLines={1}>{item.nombre}</Text>
                                    <View style={grafStyles.barContainer}>
                                        <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#10B981' }]} />
                                    </View>
                                    <Text style={grafStyles.barValue}>{formatCurrency(item.total)}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Chart: Gastos por Usuario (Horas Extras) */}
                {data.porUsuario?.length > 0 && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>👷 Horas Extras por Operario (Top 5)</Text>
                        {data.porUsuario.map((item, idx) => {
                            const maxVal = data.porUsuario[0]?.total || 1;
                            const width = (item.total / maxVal) * 100;
                            return (
                                <View key={idx} style={grafStyles.barRow}>
                                    <Text style={grafStyles.barLabel} numberOfLines={1}>{item.nombre}</Text>
                                    <View style={grafStyles.barContainer}>
                                        <View style={[grafStyles.bar, { width: `${width}%`, backgroundColor: '#8B5CF6' }]} />
                                    </View>
                                    <Text style={grafStyles.barValue}>{formatCurrency(item.total)}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Monthly Summary Table (Always show in Annual view) */}
                {!mesSeleccionado && (
                    <View style={grafStyles.chartSection}>
                        <Text style={grafStyles.sectionTitle}>📅 Resumen Mensual</Text>
                        <View style={grafStyles.tableHeader}>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader, { flex: 2 }]}>Mes</Text>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Presupuesto</Text>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Gastado</Text>
                            <Text style={[grafStyles.tableCell, grafStyles.tableCellHeader]}>Restante</Text>
                        </View>
                        {(data.resumenMensual?.length > 0 ? data.resumenMensual :
                            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ mes: m, totalPresupuesto: 0, totalGastado: 0, restante: 0 }))
                        ).map((mes, idx) => (
                            <View key={idx} style={[grafStyles.tableRow, idx % 2 === 0 && grafStyles.tableRowAlt]}>
                                <Text style={[grafStyles.tableCell, { flex: 2 }]}>{produccionApi.getMesNombre(mes.mes)}</Text>
                                <Text style={grafStyles.tableCell}>{formatCurrency(mes.totalPresupuesto || 0)}</Text>
                                <Text style={[grafStyles.tableCell, { color: '#059669' }]}>{formatCurrency(mes.totalGastado || 0)}</Text>
                                <Text style={[
                                    grafStyles.tableCell,
                                    { color: (mes.restante || 0) >= 0 ? '#059669' : '#DC2626' }
                                ]}>
                                    {formatCurrency(mes.restante || 0)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
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
            const data = await produccionApi.getMaestros();
            setItems(data.rubros || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim()) { Alert.alert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            if (editItem) {
                await produccionApi.updateRubro(editItem.id, { nombre });
                Alert.alert('Éxito', 'Rubro actualizado');
            } else {
                await produccionApi.createRubro({ nombre });
                Alert.alert('Éxito', 'Rubro creado');
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try {
                await produccionApi.deleteRubro(id);
                Alert.alert('Éxito', 'Rubro eliminado');
                loadData();
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar este rubro?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar este rubro?', [
                { text: 'Cancelar' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
            ]);
        }
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
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Rubro</Text>
                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}

// ===================== PROVEEDORES TAB =====================
function ProveedoresTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [nit, setNit] = useState('');
    const [telefono, setTelefono] = useState('');
    const [rubroId, setRubroId] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await produccionApi.getMaestros();
            setItems(data.proveedores || []);
            setRubros(data.rubros || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = () => {
        setEditItem(null);
        setNombre('');
        setNit('');
        setTelefono('');
        setRubroId('');
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setNombre(item.nombre);
        setNit(item.nit || '');
        setTelefono(item.telefono || '');
        setRubroId(item.rubroId?.toString() || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!nombre.trim()) { Alert.alert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            const provData = {
                nombre,
                nit,
                telefono,
                rubroId: rubroId ? parseInt(rubroId) : null
            };
            if (editItem) {
                await produccionApi.updateProveedor(editItem.id, provData);
                Alert.alert('Éxito', 'Proveedor actualizado');
            } else {
                await produccionApi.createProveedor(provData);
                Alert.alert('Éxito', 'Proveedor creado');
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try {
                await produccionApi.deleteProveedor(id);
                Alert.alert('Éxito', 'Proveedor eliminado');
                loadData();
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar este proveedor?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar este proveedor?', [
                { text: 'Cancelar' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>🏢 Proveedores</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            {item.nit && <Text style={styles.itemDetail}>NIT: {item.nit}</Text>}
                            {item.telefono && <Text style={styles.itemDetail}>Tel: {item.telefono}</Text>}
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Proveedor</Text>
                    <ScrollView>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del proveedor" />

                        <Text style={styles.label}>NIT</Text>
                        <TextInput style={styles.input} value={nit} onChangeText={setNit} placeholder="NIT del proveedor" />

                        <Text style={styles.label}>Teléfono</Text>
                        <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="Teléfono" keyboardType="phone-pad" />

                        <Text style={styles.label}>Rubro</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={rubroId} onValueChange={setRubroId}>
                                <Picker.Item label="Seleccione un rubro..." value="" />
                                {rubros.map(r => <Picker.Item key={r.id} label={r.nombre} value={r.id.toString()} />)}
                            </Picker>
                        </View>
                    </ScrollView>
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}

// ===================== TIPOS DE HORA TAB =====================
function TiposHoraTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [nombre, setNombre] = useState('');
    const [porcentaje, setPorcentaje] = useState('');
    const [factor, setFactor] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await produccionApi.getMaestros();
            setItems(data.tiposHora || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = () => { setEditItem(null); setNombre(''); setPorcentaje(''); setFactor(''); setShowModal(true); };
    const handleEdit = (item) => { setEditItem(item); setNombre(item.nombre); setPorcentaje(item.porcentaje?.toString() || ''); setFactor(item.factor?.toString() || ''); setShowModal(true); };

    const handleSave = async () => {
        if (!nombre.trim()) { Alert.alert('Error', 'Nombre obligatorio'); return; }
        try {
            setSaving(true);
            const tipoData = {
                nombre,
                porcentaje: parseFloat(porcentaje) || 0,
                factor: parseFloat(factor) || 1
            };
            if (editItem) {
                await produccionApi.updateTipoHora(editItem.id, tipoData);
                Alert.alert('Éxito', 'Tipo de hora actualizado');
            } else {
                await produccionApi.createTipoHora(tipoData);
                Alert.alert('Éxito', 'Tipo de hora creado');
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const doDelete = async () => {
            try {
                await produccionApi.deleteTipoHora(id);
                Alert.alert('Éxito', 'Tipo de hora eliminado');
                loadData();
            } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar');
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('¿Eliminar este tipo de hora?')) doDelete();
        } else {
            Alert.alert('Confirmar', '¿Eliminar este tipo de hora?', [
                { text: 'Cancelar' },
                { text: 'Eliminar', onPress: doDelete, style: 'destructive' }
            ]);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>⏱️ Tipos de Hora</Text>
                <TouchableOpacity style={styles.addButtonSmall} onPress={handleAdd}>
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemParent}>Porcentaje: {item.porcentaje}% | Factor: {item.factor}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.editButton}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={styles.deleteButtonIcon}>🗑️</Text></TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>{editItem ? 'Editar' : 'Agregar'} Tipo de Hora</Text>
                    <Text style={styles.label}>Nombre *</Text>
                    <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Hora Extra Diurna" />
                    <Text style={styles.label}>Porcentaje (%)</Text>
                    <TextInput style={styles.input} value={porcentaje} onChangeText={setPorcentaje} keyboardType="numeric" placeholder="Ej: 25" />
                    <Text style={styles.label}>Factor</Text>
                    <TextInput style={styles.input} value={factor} onChangeText={setFactor} keyboardType="numeric" placeholder="Ej: 1.25" />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}

// ===================== SALARIOS TAB =====================
function SalariosTab() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [salario, setSalario] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await produccionApi.getMaestros();
            setItems(data.usuarios || []);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleEdit = (item) => {
        setEditItem(item);
        setSalario(item.salario != null ? item.salario.toString() : '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!salario) { Alert.alert('Error', 'Valor requerido'); return; }
        try {
            setSaving(true);
            await produccionApi.updateSalario(editItem.id, parseFloat(salario));
            Alert.alert('Éxito', 'Salario actualizado');
            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

    return (
        <View style={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>💵 Salarios de Operarios</Text>
            </View>
            <ScrollView style={styles.listContainer}>
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.nombre}</Text>
                            <Text style={styles.itemDetail}>💰 Salario: {formatCurrency(item.salario)}</Text>
                        </View>
                        <View style={styles.itemActions}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF5FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} onPress={() => handleEdit(item)}>
                                <Text style={{ fontSize: 16, marginRight: 6 }}>✏️</Text>
                                <Text style={{ color: '#2563EB', fontWeight: '600' }}>Ajustar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}><View style={styles.modalContentSmall}>
                    <Text style={styles.modalTitle}>Ajustar Salario</Text>
                    <Text style={[styles.label, { color: '#374151', marginBottom: 16, textAlign: 'center' }]}>{editItem?.nombre}</Text>

                    <Text style={styles.label}>Nuevo Salario Mensual</Text>
                    <TextInput
                        style={styles.input}
                        value={salario}
                        onChangeText={setSalario}
                        keyboardType="numeric"
                        placeholder="Ej: 1500000"
                        autoFocus={true}
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Guardar</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
        </View>
    );
}

// ===================== STYLES - EXACT COPY FROM SST =====================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // TABS - EXACT SST STYLE with dark blue background
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F', // Dark blue like SST/GH
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#152A45',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: 'transparent', // Transparent by default
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.15)', // Slight white overlay when active
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    tabIcon: {
        marginRight: 4,
        fontSize: 14,
    },
    tabText: {
        color: 'rgba(255,255,255,0.7)', // Light text
        fontWeight: '500',
        fontSize: 13,
    },
    activeTabText: {
        color: '#FFF', // Pure white when active
    },
    // CONTENT
    contentContainer: {
        flex: 1,
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
    picker: {
        width: 110,
        height: 40,
    },
    // SUMMARY - EXACT SST COLORS
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
        backgroundColor: '#DBEAFE', // Light blue - same as SST
    },
    gastadoCard: {
        backgroundColor: '#FEE2E2', // Light pink - same as SST
    },
    restanteCard: {
        backgroundColor: '#D1FAE5', // Light green - same as SST
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
    // BUTTONS
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
    // LIST
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
    // GASTO CARD - EXACT SST
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
    // ITEM CARD
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
    // MODAL
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
    // PRESUPUESTO TAB STYLES
    presupuestoNote: {
        backgroundColor: '#EBF5FF',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    noteText: {
        color: '#1E40AF',
        fontSize: 13,
    },
    presupuestoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    presupuestoLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        flex: 1,
    },
    presupuestoInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
    },
    currencyPrefix: {
        fontSize: 14,
        color: '#6B7280',
        marginRight: 4,
    },
    presupuestoInput: {
        width: 120,
        padding: 10,
        fontSize: 14,
        textAlign: 'right',
    },
    // Budget info box styles
    budgetInfoBox: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
    },
    budgetInfoBoxOk: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    budgetInfoBoxWarning: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    budgetInfoBoxNegative: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    budgetInfoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#1F2937',
    },
    budgetInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    budgetInfoTotal: {
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#D1D5DB',
    },
    budgetInfoLabel: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    budgetInfoValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'center',
    },
    budgetInfoLabelBold: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    budgetInfoValueBold: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#10B981',
    },
    budgetInfoNegative: {
        color: '#EF4444',
    },
    // Budget container styles - SST style
    budgetContainer: {
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    budgetHeader: {
        marginBottom: 12,
    },
    budgetTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0369A1',
    },
    budgetInfoItem: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    budgetWarning: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 4,
        color: '#92400E',
        fontSize: 12,
        textAlign: 'center',
    },
    budgetNoData: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#E0E7FF',
        borderRadius: 4,
        color: '#3730A3',
        fontSize: 12,
        textAlign: 'center',
    },
});

// Graficas Styles (SST style)
const grafStyles = StyleSheet.create({
    summaryCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        alignItems: 'center',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0369A1',
    },
    summarySubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    chartSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 12,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    barLabel: {
        width: 100,
        fontSize: 12,
        color: '#4B5563',
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 4,
    },
    barValue: {
        width: 80,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'right',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1E3A5F',
        borderRadius: 4,
        paddingVertical: 8,
        marginBottom: 4,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableRowAlt: {
        backgroundColor: '#F9FAFB',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        textAlign: 'center',
        color: '#1F2937',
    },
    tableCellHeader: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    // Dashboard SST style
    dashboardRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
        gap: 8,
    },
    summaryCardSmall: {
        flex: 1,
        minWidth: 150,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    progressBarContainer: {
        height: 20,
        backgroundColor: '#E5E7EB',
        borderRadius: 10,
        overflow: 'hidden',
        marginVertical: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 10,
    },
    progressText: {
        textAlign: 'center',
        fontSize: 14,
        color: '#6B7280',
    },
    // Detailed Rubro Report Styles
    rubroReportRow: { marginBottom: 16 },
    rubroReportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rubroReportName: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
    rubroReportStatus: { fontSize: 12, fontWeight: '500' },
    rubroProgressBarContainer: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden' },
    rubroProgressBar: { height: '100%', borderRadius: 6 },
    rubroWarningText: { fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '500' },
});
