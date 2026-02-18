import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, FlatList, Modal, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/productionApi';

interface ProcesoEntry {
    proceso: string;
    cantidadProducida: string;
    observaciones: string;
}

interface EncuestaResumen {
    id: number;
    fecha: string;
    ordenProduccion: string;
    referencia?: string;
    material?: string;
    cliente?: string;
    cantidadAProducir: number;
    cantidadRecuperada: number;
    cantidadParaDespacho: number;
    totalProcesos: number;
    fechaCreacion: string;
}

interface EncuestaDetalle {
    id: number;
    fecha: string;
    ordenProduccion: string;
    referencia?: string;
    material?: string;
    cliente?: string;
    cabida?: string;
    cantidadAProducir: number;
    cantidadRecuperada: number;
    cantidadParaDespacho: number;
    observaciones?: string;
    fechaCreacion: string;
    procesos: { proceso: string; cantidadProducida: number; observaciones?: string }[];
}

export default function EncuestaCalidadProduccionView() {
    // Form state
    const [fecha, setFecha] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [op, setOp] = useState('');
    const [cliente, setCliente] = useState('');
    const [referencia, setReferencia] = useState('');
    const [material, setMaterial] = useState('');
    const [cabida, setCabida] = useState('');
    const [cantidadAProducir, setCantidadAProducir] = useState('');
    const [cantidadRecuperada, setCantidadRecuperada] = useState('');
    const [cantidadParaDespacho, setCantidadParaDespacho] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);

    // Procesos dinámicos
    const [procesosDisponibles, setProcesosDisponibles] = useState<string[]>([]);
    const [procesosEntries, setProcesosEntries] = useState<ProcesoEntry[]>([
        { proceso: '', cantidadProducida: '', observaciones: '' }
    ]);

    // List state
    const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Detail modal
    const [selectedEncuesta, setSelectedEncuesta] = useState<EncuestaDetalle | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    // Filter state
    const [filterMes, setFilterMes] = useState(new Date().getMonth() + 1);
    const [filterAnio, setFilterAnio] = useState(new Date().getFullYear());

    const meses = [
        { id: 1, nombre: 'Enero' }, { id: 2, nombre: 'Febrero' }, { id: 3, nombre: 'Marzo' },
        { id: 4, nombre: 'Abril' }, { id: 5, nombre: 'Mayo' }, { id: 6, nombre: 'Junio' },
        { id: 7, nombre: 'Julio' }, { id: 8, nombre: 'Agosto' }, { id: 9, nombre: 'Septiembre' },
        { id: 10, nombre: 'Octubre' }, { id: 11, nombre: 'Noviembre' }, { id: 12, nombre: 'Diciembre' }
    ];
    const anios = [2024, 2025, 2026, 2027];

    useEffect(() => {
        loadProcesos();
        loadEncuestas();
    }, []);

    useEffect(() => {
        loadEncuestas();
    }, [filterMes, filterAnio]);

    const loadProcesos = async () => {
        try {
            const res = await api.get('calidadproduccion/procesos');
            setProcesosDisponibles(res.data);
        } catch (e) {
            console.error('Error cargando procesos:', e);
        }
    };

    const loadEncuestas = async () => {
        setLoading(true);
        try {
            const res = await api.get(`calidadproduccion/encuestas?mes=${filterMes}&anio=${filterAnio}`);
            setEncuestas(res.data);
        } catch (e) {
            console.error('Error cargando encuestas:', e);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        const d = new Date();
        setFecha(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setOp('');
        setCliente('');
        setReferencia('');
        setMaterial('');
        setCabida('');
        setCantidadAProducir('');
        setCantidadRecuperada('');
        setCantidadParaDespacho('');
        setObservaciones('');
        setProcesosEntries([{ proceso: '', cantidadProducida: '', observaciones: '' }]);
        setEditingId(null);
    };

    const addProceso = () => {
        setProcesosEntries(prev => [...prev, { proceso: '', cantidadProducida: '', observaciones: '' }]);
    };

    const updateProceso = (index: number, field: keyof ProcesoEntry, value: string) => {
        setProcesosEntries(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    const removeProceso = (index: number) => {
        if (procesosEntries.length <= 1) return;
        setProcesosEntries(prev => prev.filter((_, i) => i !== index));
    };

    const guardar = async () => {
        if (!op.trim()) {
            if (Platform.OS === 'web') { window.alert('Debe ingresar la OP'); } else { Alert.alert('Error', 'Debe ingresar la OP'); }
            return;
        }
        if (!cantidadAProducir.trim()) {
            if (Platform.OS === 'web') { window.alert('Debe ingresar la cantidad a producir'); } else { Alert.alert('Error', 'Debe ingresar la cantidad a producir'); }
            return;
        }

        const validProcesos = procesosEntries.filter(p => p.proceso && p.cantidadProducida);

        setSaving(true);
        try {
            const data = {
                fecha: fecha,
                ordenProduccion: op,
                referencia: referencia ? referencia.toUpperCase() : null,
                material: material ? material.toUpperCase() : null,
                cliente: cliente ? cliente.toUpperCase() : null,
                cabida: cabida || null,
                cantidadAProducir: parseFloat(cantidadAProducir) || 0,
                cantidadRecuperada: parseFloat(cantidadRecuperada) || 0,
                cantidadParaDespacho: parseFloat(cantidadParaDespacho) || 0,
                observaciones: observaciones || null,
                procesos: validProcesos.map(p => ({
                    proceso: p.proceso,
                    cantidadProducida: parseFloat(p.cantidadProducida) || 0,
                    observaciones: p.observaciones || null
                }))
            };

            if (editingId) {
                await api.put(`calidadproduccion/encuestas/${editingId}`, data);
                if (Platform.OS === 'web') { window.alert('Encuesta actualizada correctamente'); } else { Alert.alert('Éxito', 'Encuesta actualizada correctamente'); }
            } else {
                await api.post('calidadproduccion/encuestas', data);
                if (Platform.OS === 'web') { window.alert('Encuesta guardada correctamente'); } else { Alert.alert('Éxito', 'Encuesta guardada correctamente'); }
            }
            resetForm();
            setShowForm(false);
            loadEncuestas();
        } catch (e: any) {
            console.error('Error guardando:', e);
            const msg = (editingId ? 'No se pudo actualizar: ' : 'No se pudo guardar: ') + (e?.message || '');
            if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
        } finally {
            setSaving(false);
        }
    };

    const verDetalle = async (id: number) => {
        try {
            const res = await api.get(`calidadproduccion/encuestas/${id}`);
            setSelectedEncuesta(res.data);
            setDetailModalVisible(true);
        } catch (e) {
            if (Platform.OS === 'web') { window.alert('No se pudo cargar el detalle'); } else { Alert.alert('Error', 'No se pudo cargar el detalle'); }
        }
    };

    const handleEdit = async (id: number) => {
        try {
            const res = await api.get(`calidadproduccion/encuestas/${id}`);
            const e = res.data as EncuestaDetalle;

            setEditingId(e.id);
            setFecha(e.fecha.split('T')[0]);
            setOp(e.ordenProduccion);
            setCliente(e.cliente || '');
            setReferencia(e.referencia || '');
            setMaterial(e.material || '');
            setCabida(e.cabida || '');
            setCantidadAProducir(e.cantidadAProducir.toString());
            setCantidadRecuperada(e.cantidadRecuperada.toString());
            setCantidadParaDespacho(e.cantidadParaDespacho.toString());
            setObservaciones(e.observaciones || '');

            setProcesosEntries(e.procesos.map(p => ({
                proceso: p.proceso,
                cantidadProducida: p.cantidadProducida.toString(),
                observaciones: p.observaciones || ''
            })));

            setShowForm(true);
            // Scroll to top
        } catch (error) {
            if (Platform.OS === 'web') { window.alert('No se pudo cargar la encuesta para editar'); } else { Alert.alert('Error', 'No se pudo cargar la encuesta para editar'); }
        }
    };

    const eliminar = async (id: number) => {
        const shouldDelete = Platform.OS === 'web'
            ? window.confirm('¿Está seguro de eliminar esta encuesta?')
            : await new Promise<boolean>(resolve => {
                Alert.alert('Confirmar', '¿Está seguro de eliminar esta encuesta?', [
                    { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }
                ]);
            });

        if (shouldDelete) {
            try {
                await api.delete(`calidadproduccion/encuestas/${id}`);
                loadEncuestas();
            } catch (e) {
                if (Platform.OS === 'web') { window.alert('No se pudo eliminar'); } else { Alert.alert('Error', 'No se pudo eliminar'); }
            }
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString();
    };

    // Processes already used in current entries
    const usedProcesos = procesosEntries.map(p => p.proceso).filter(Boolean);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerBar}>
                <View style={styles.filterRow}>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Mes:</Text>
                        <View style={styles.pickerWrap}>
                            <Picker selectedValue={filterMes} onValueChange={v => setFilterMes(v)} style={styles.picker}>
                                {meses.map(m => <Picker.Item key={m.id} label={m.nombre} value={m.id} />)}
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Año:</Text>
                        <View style={styles.pickerWrap}>
                            <Picker selectedValue={filterAnio} onValueChange={v => setFilterAnio(v)} style={styles.picker}>
                                {anios.map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                            </Picker>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.btnPrimary} onPress={loadEncuestas}>
                        <Text style={styles.btnText}>Actualizar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btnPrimary, { backgroundColor: '#38A169', marginLeft: 10 }]}
                        onPress={() => { resetForm(); setShowForm(!showForm); }}
                    >
                        <Text style={styles.btnText}>{showForm ? '✕ Cerrar Formulario' : '+ Nueva Encuesta'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* FORM */}
                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>
                            {editingId ? '✏️ Editar Encuesta de Producción' : '📋 Nueva Encuesta de Producción'}
                        </Text>

                        <View style={styles.formGrid}>
                            {/* Fecha */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Fecha</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={fecha}
                                        onChange={(e: any) => setFecha(e.target.value)}
                                        style={{
                                            padding: 10, borderRadius: 8, border: '1px solid #CBD5E0',
                                            fontSize: 14, backgroundColor: '#F7FAFC', width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                ) : (
                                    <TextInput
                                        style={styles.input}
                                        value={fecha}
                                        onChangeText={setFecha}
                                        placeholder="YYYY-MM-DD"
                                    />
                                )}
                            </View>

                            {/* OP */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>OP (Orden de Producción)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={op}
                                    onChangeText={text => setOp(text.replace(/[^0-9]/g, ''))}
                                    placeholder="Solo números"
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Referencia */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Referencia</Text>
                                <TextInput
                                    style={styles.input}
                                    value={referencia}
                                    onChangeText={text => setReferencia(text.toUpperCase())}
                                    placeholder="Referencia"
                                />
                            </View>

                            {/* Cliente */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Cliente</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cliente}
                                    onChangeText={text => setCliente(text.toUpperCase())}
                                    placeholder="Cliente"
                                />
                            </View>

                            {/* Material */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Material</Text>
                                <TextInput
                                    style={styles.input}
                                    value={material}
                                    onChangeText={text => setMaterial(text.toUpperCase())}
                                    placeholder="Material"
                                />
                            </View>

                            {/* Cabida */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Cabida</Text>
                                <TextInput style={styles.input} value={cabida} onChangeText={setCabida} placeholder="Cabida" />
                            </View>

                            {/* Cantidad a producir */}
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Cantidad a Producir</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cantidadAProducir}
                                    onChangeText={text => setCantidadAProducir(text.replace(/[^0-9.]/g, ''))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* PROCESOS SECTION */}
                        <View style={styles.procesosSection}>
                            <Text style={styles.sectionTitle}>📦 Cantidad Producida por Proceso</Text>

                            {procesosEntries.map((entry, index) => (
                                <View key={index} style={styles.procesoRow}>
                                    <View style={{ flex: 1.5 }}>
                                        <Text style={styles.miniLabel}>Proceso</Text>
                                        <View style={styles.pickerWrapProceso}>
                                            <Picker
                                                selectedValue={entry.proceso}
                                                onValueChange={v => updateProceso(index, 'proceso', v)}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="-- Seleccionar --" value="" />
                                                {procesosDisponibles
                                                    .filter(p => p === entry.proceso || !usedProcesos.includes(p))
                                                    .map(p => (
                                                        <Picker.Item key={p} label={p} value={p} />
                                                    ))}
                                            </Picker>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.miniLabel}>Cantidad</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={entry.cantidadProducida}
                                            onChangeText={text => updateProceso(index, 'cantidadProducida', text.replace(/[^0-9.]/g, ''))}
                                            placeholder="0"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={{ flex: 2, marginLeft: 10 }}>
                                        <Text style={styles.miniLabel}>Observaciones Proceso</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={entry.observaciones}
                                            onChangeText={text => updateProceso(index, 'observaciones', text)}
                                            placeholder="Notas..."
                                        />
                                    </View>
                                    {procesosEntries.length > 1 && (
                                        <TouchableOpacity
                                            style={styles.removeBtn}
                                            onPress={() => removeProceso(index)}
                                        >
                                            <Text style={styles.removeBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            <TouchableOpacity style={styles.addProcesoBtn} onPress={addProceso}>
                                <Text style={styles.addProcesoBtnText}>+ Ingresar otro proceso</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Bottom fields */}
                        <View style={styles.formGrid}>
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Cantidad Recuperada</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cantidadRecuperada}
                                    onChangeText={text => setCantidadRecuperada(text.replace(/[^0-9.]/g, ''))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.fieldBox}>
                                <Text style={styles.fieldLabel}>Cantidad para Despacho</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cantidadParaDespacho}
                                    onChangeText={text => setCantidadParaDespacho(text.replace(/[^0-9.]/g, ''))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={{ marginTop: 10 }}>
                            <Text style={styles.fieldLabel}>Observaciones Generales</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={observaciones}
                                onChangeText={setObservaciones}
                                placeholder="Notas adicionales..."
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        {/* Save button */}
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                            onPress={guardar}
                            disabled={saving}
                        >
                            {saving ?
                                <ActivityIndicator color="#fff" /> :
                                <Text style={styles.saveBtnText}>
                                    {editingId ? '💾 Actualizar Encuesta' : '💾 Guardar Encuesta'}
                                </Text>
                            }
                        </TouchableOpacity>
                    </View>
                )}

                {/* TABLE */}
                {loading ? (
                    <ActivityIndicator size="large" color="#3182CE" style={{ marginTop: 40 }} />
                ) : (
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { flex: 0.8 }]}>Fecha</Text>
                            <Text style={[styles.th, { flex: 0.6 }]}>OP</Text>
                            <Text style={[styles.th, { flex: 1 }]}>Referencia</Text>
                            <Text style={[styles.th, { flex: 1 }]}>Cliente</Text>
                            <Text style={[styles.th, { flex: 1 }]}>Material</Text>
                            <Text style={[styles.th, { flex: 0.8 }]}>Cant. Producir</Text>
                            <Text style={[styles.th, { flex: 0.5 }]}>Procesos</Text>
                            <Text style={[styles.th, { flex: 0.8 }]}>Cant. Recuperada</Text>
                            <Text style={[styles.th, { flex: 0.8 }]}>Cant. Despacho</Text>
                            <Text style={[styles.th, { flex: 0.6 }]}>Acciones</Text>
                        </View>

                        {encuestas.length === 0 ? (
                            <Text style={styles.emptyText}>No hay encuestas para este periodo.</Text>
                        ) : (
                            encuestas.map(item => (
                                <View key={item.id} style={styles.tableRow}>
                                    <Text style={[styles.td, { flex: 0.8 }]}>{formatDate(item.fecha)}</Text>
                                    <Text style={[styles.td, { flex: 0.6 }]}>{item.ordenProduccion}</Text>
                                    <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{item.referencia || '-'}</Text>
                                    <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{item.cliente || '-'}</Text>
                                    <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{item.material || '-'}</Text>
                                    <Text style={[styles.td, { flex: 0.8, textAlign: 'center' }]}>{item.cantidadAProducir}</Text>
                                    <Text style={[styles.td, { flex: 0.5, textAlign: 'center', fontWeight: 'bold', color: '#3182CE' }]}>{item.totalProcesos}</Text>
                                    <Text style={[styles.td, { flex: 0.8, textAlign: 'center' }]}>{item.cantidadRecuperada}</Text>
                                    <Text style={[styles.td, { flex: 0.8, textAlign: 'center' }]}>{item.cantidadParaDespacho}</Text>
                                    <View style={{ flex: 0.6, flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => verDetalle(item.id)}>
                                            <Text style={styles.actionBtnText}>👁</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EBF4FF' }]} onPress={() => handleEdit(item.id)}>
                                            <Text style={[styles.actionBtnText, { color: '#3182CE' }]}>✏️</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FED7D7' }]} onPress={() => eliminar(item.id)}>
                                            <Text style={[styles.actionBtnText, { color: '#C53030' }]}>🗑</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Detail Modal */}
            <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>📋 Detalle de Encuesta</Text>
                            {selectedEncuesta && (
                                <>
                                    <View style={styles.detailGrid}>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Fecha</Text>
                                            <Text style={styles.detailValue}>{formatDate(selectedEncuesta.fecha)}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>OP</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.ordenProduccion}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Referencia</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.referencia || '-'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Cliente</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.cliente || '-'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Material</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.material || '-'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Cabida</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.cabida || '-'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Cant. a Producir</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.cantidadAProducir}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Cant. Recuperada</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.cantidadRecuperada}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Cant. Despacho</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.cantidadParaDespacho}</Text>
                                        </View>
                                    </View>

                                    {selectedEncuesta.procesos.length > 0 && (
                                        <View style={styles.procesosDetail}>
                                            <Text style={styles.sectionTitle}>📦 Procesos</Text>
                                            {selectedEncuesta.procesos.map((p, i) => (
                                                <View key={i} style={[styles.procesoDetailRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                                                        <Text style={styles.procesoName}>{p.proceso}</Text>
                                                        <Text style={styles.procesoQty}>{p.cantidadProducida}</Text>
                                                    </View>
                                                    {p.observaciones && (
                                                        <Text style={{ fontSize: 12, color: '#4A5568', fontStyle: 'italic', marginTop: 4 }}>
                                                            Obs: {p.observaciones}
                                                        </Text>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {selectedEncuesta.observaciones && (
                                        <View style={{ marginTop: 15 }}>
                                            <Text style={styles.detailLabel}>Observaciones Generales</Text>
                                            <Text style={styles.detailValue}>{selectedEncuesta.observaciones}</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.saveBtn, { marginTop: 15, backgroundColor: '#718096' }]}
                            onPress={() => setDetailModalVisible(false)}
                        >
                            <Text style={styles.saveBtnText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    headerBar: { backgroundColor: '#FFFFFF', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    filterGroup: { flexDirection: 'row', alignItems: 'center' },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginRight: 6 },
    pickerWrap: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, backgroundColor: '#F7FAFC', minWidth: 120 },
    picker: { height: 38 },
    btnPrimary: {
        backgroundColor: '#3182CE', paddingHorizontal: 16, paddingVertical: 9,
        borderRadius: 8, shadowColor: '#3182CE', shadowOpacity: 0.3, shadowRadius: 4, elevation: 3
    },
    btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    // Form
    formCard: {
        margin: 15, backgroundColor: '#fff', borderRadius: 16, padding: 24,
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
        borderWidth: 1, borderColor: '#E2E8F0'
    },
    formTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C', marginBottom: 20 },
    formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    fieldBox: { minWidth: 200, flex: 1 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 5 },
    input: {
        borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 10,
        fontSize: 14, backgroundColor: '#F7FAFC', color: '#1A202C'
    },
    miniLabel: { fontSize: 11, color: '#718096', marginBottom: 3 },

    // Procesos
    procesosSection: {
        marginTop: 20, padding: 16, backgroundColor: '#EBF8FF',
        borderRadius: 12, borderWidth: 1, borderColor: '#BEE3F8'
    },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2B6CB0', marginBottom: 12 },
    procesoRow: {
        flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10,
        backgroundColor: '#fff', padding: 12, borderRadius: 10,
        borderWidth: 1, borderColor: '#E2E8F0'
    },
    pickerWrapProceso: {
        borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8,
        backgroundColor: '#F7FAFC', overflow: 'hidden'
    },
    addProcesoBtn: {
        marginTop: 8, backgroundColor: '#3182CE', paddingVertical: 10,
        paddingHorizontal: 20, borderRadius: 8, alignSelf: 'flex-start',
        shadowColor: '#3182CE', shadowOpacity: 0.3, shadowRadius: 4, elevation: 3
    },
    addProcesoBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    removeBtn: {
        marginLeft: 8, width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#FED7D7', alignItems: 'center', justifyContent: 'center',
        alignSelf: 'center'
    },
    removeBtnText: { color: '#C53030', fontWeight: 'bold', fontSize: 14 },

    // Save
    saveBtn: {
        marginTop: 20, backgroundColor: '#38A169', padding: 14,
        borderRadius: 12, alignItems: 'center',
        shadowColor: '#38A169', shadowOpacity: 0.3, shadowRadius: 6, elevation: 4
    },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Table
    tableContainer: { margin: 15 },
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#2D3748', padding: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10
    },
    th: { color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center' },
    tableRow: {
        flexDirection: 'row', padding: 10, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0', alignItems: 'center'
    },
    td: { fontSize: 13, color: '#2D3748', textAlign: 'center' },
    emptyText: { textAlign: 'center', padding: 30, color: '#A0AEC0', fontSize: 14 },
    actionBtn: {
        width: 30, height: 30, borderRadius: 6, backgroundColor: '#EBF8FF',
        alignItems: 'center', justifyContent: 'center'
    },
    actionBtnText: { fontSize: 14 },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: 16, padding: 30,
        width: '90%', maxWidth: 700, maxHeight: '85%',
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C', marginBottom: 20 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    detailItem: { minWidth: 140 },
    detailLabel: { fontSize: 12, color: '#718096', fontWeight: '600', marginBottom: 3 },
    detailValue: { fontSize: 15, color: '#1A202C', fontWeight: '500' },
    procesosDetail: { marginTop: 15, padding: 12, backgroundColor: '#EBF8FF', borderRadius: 10 },
    procesoDetailRow: {
        flexDirection: 'row', justifyContent: 'space-between', padding: 8,
        backgroundColor: '#fff', borderRadius: 6, marginBottom: 5
    },
    procesoName: { fontSize: 14, color: '#2D3748', fontWeight: '500' },
    procesoQty: { fontSize: 14, color: '#3182CE', fontWeight: 'bold' },
});
