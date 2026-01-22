import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, Alert, ScrollView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Asegúrate de tener esta dependencia o usa un select nativo html en web
import DateTimePicker from '@react-native-community/datetimepicker'; // O input date en web

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

const DesperdicioScreen = () => {
    // Estados principales
    const [maquinas, setMaquinas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filtros
    const [selectedMaquina, setSelectedMaquina] = useState('');
    const [selectedFecha, setSelectedFecha] = useState(new Date());

    // Modales
    const [modalConfigVisible, setModalConfigVisible] = useState(false);
    const [modalRegistroVisible, setModalRegistroVisible] = useState(false);

    // Estado para nuevo registro
    const [newRegistro, setNewRegistro] = useState({
        maquinaId: '',
        usuarioId: '',
        fecha: new Date(),
        ordenProduccion: '',
        codigoDesperdicioId: '',
        cantidad: ''
    });

    // Estado para gestión de códigos
    const [newCodigo, setNewCodigo] = useState({ codigo: '', descripcion: '', activo: true });
    const [editingCodigoId, setEditingCodigoId] = useState(null);

    useEffect(() => {
        loadInitialData();
        loadRegistros(); // Cargar registros del día al inicio
    }, []);

    useEffect(() => {
        // Recargar si cambian filtros (aunque máquina está oculta por ahora)
        loadRegistros();
    }, [selectedMaquina, selectedFecha]);

    const loadInitialData = async () => {
        try {
            // Intentar inicializar DB por si faltan tablas (Hack para error 500)
            await fetch(`${API_URL}/desperdicio/init`).catch(e => console.log("Init OK/Skip"));

            const [resMaq, resUsu, resCod] = await Promise.all([
                fetch(`${API_URL}/maquinas`),
                fetch(`${API_URL}/usuarios`),
                fetch(`${API_URL}/desperdicio/codigos`)
            ]);

            if (resMaq.ok) setMaquinas(await resMaq.json());
            if (resUsu.ok) setUsuarios(await resUsu.json());
            if (resCod.ok) setCodigos(await resCod.json());
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error cargando datos iniciales');
        }
    };

    const loadRegistros = async () => {
        // Permitir carga sin máquina (trae todos los del día)
        setLoading(true);
        try {
            // Usar fecha local para evitar problemas de zona horaria UTC
            const year = selectedFecha.getFullYear();
            const month = String(selectedFecha.getMonth() + 1).padStart(2, '0');
            const day = String(selectedFecha.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            let url = `${API_URL}/desperdicio?fecha=${dateStr}`;
            if (selectedMaquina) {
                url += `&maquinaId=${selectedMaquina}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                setRegistros(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRegistro = async () => {
        if (!newRegistro.maquinaId || !newRegistro.usuarioId || !newRegistro.codigoDesperdicioId || !newRegistro.cantidad) {
            Alert.alert('Error', 'Todos los campos son obligatorios');
            return;
        }

        try {
            const body = {
                ...newRegistro,
                cantidad: parseFloat(newRegistro.cantidad),
                fecha: newRegistro.fecha.toISOString()
            };

            const res = await fetch(`${API_URL}/desperdicio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                Alert.alert('Éxito', 'Desperdicio registrado');
                setModalRegistroVisible(false);

                // Actualizar filtro a la fecha del registro guardado para verlo inmediatamente
                setSelectedFecha(newRegistro.fecha);

                // Resetear form
                setNewRegistro({
                    maquinaId: '',
                    usuarioId: '',
                    fecha: new Date(),
                    ordenProduccion: '',
                    codigoDesperdicioId: '',
                    cantidad: ''
                });
                // loadRegistros se llamará automáticamente por el useEffect al cambiar selectedFecha
            } else {
                Alert.alert('Error', 'No se pudo guardar el registro');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de conexión');
        }
    };

    const handleDeleteRegistro = async (id) => {
        if (Platform.OS === 'web') {
            if (!confirm('¿Eliminar este registro?')) return;
        }
        try {
            const res = await fetch(`${API_URL}/desperdicio/${id}`, { method: 'DELETE' });
            if (res.ok) loadRegistros();
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar');
        }
    };

    // Gestión de Códigos
    const handleSaveCodigo = async () => {
        if (!newCodigo.codigo) { // Descripción ahora es opcional
            Alert.alert('Error', 'El Código es obligatorio');
            return;
        }

        try {
            const url = editingCodigoId
                ? `${API_URL}/desperdicio/codigos/${editingCodigoId}`
                : `${API_URL}/desperdicio/codigos`;

            const method = editingCodigoId ? 'PUT' : 'POST';

            // Construir body limpio para evitar errores de deserialización (fechas, campos extra)
            const payload = {
                id: editingCodigoId ? parseInt(editingCodigoId) : 0,
                codigo: newCodigo.codigo,
                descripcion: newCodigo.descripcion,
                activo: newCodigo.activo !== undefined ? newCodigo.activo : true
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                Alert.alert('Éxito', 'Código guardado');
                setNewCodigo({ codigo: '', descripcion: '', activo: true });
                setEditingCodigoId(null);
                // Recargar códigos
                const resCod = await fetch(`${API_URL}/desperdicio/codigos`);
                if (resCod.ok) setCodigos(await resCod.json());
            } else {
                const txt = await res.text();
                Alert.alert('Error al guardar', `Detalle: ${txt}`);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error de conexión al guardar el código');
        }
    };

    const handleDeleteCodigo = async (id) => {
        if (Platform.OS === 'web') {
            if (!confirm('¿Eliminar este código?')) return;
        }
        try {
            const res = await fetch(`${API_URL}/desperdicio/codigos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                const resCod = await fetch(`${API_URL}/desperdicio/codigos`);
                if (resCod.ok) setCodigos(await resCod.json());
            } else {
                const txt = await res.text();
                Alert.alert('Error', txt);
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar');
        }
    };

    // Render helpers
    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    return (
        <View style={styles.container}>
            {/* Header / Botones Superiores (Filtros ocultos a petición) */}
            <View style={styles.header}>
                {/* 
                <View style={styles.filterRow}>
                    <Text style={styles.label}>Máquina:</Text>
                    ...
                </View> 
                */}

                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.button, styles.configButton]}
                        onPress={() => setModalConfigVisible(true)}
                    >
                        <Text style={styles.buttonText}>⚙️ Configuración</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.addButton]}
                        onPress={() => {
                            setNewRegistro(prev => ({
                                ...prev,
                                maquinaId: '', // Resetear máquina al abrir para obligar selección
                                fecha: new Date()
                            }));
                            setModalRegistroVisible(true);
                        }}
                    >
                        <Text style={styles.buttonText}>+ Agregar Desperdicio</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Lista de Registros (Mostrar alerta si no hay filtros, o mostrar los de hoy) */}
            <FlatList
                data={registros}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowCode}>{item.codigo}</Text>
                            <Text style={styles.rowDesc}>{item.descripcion}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text>OP: {item.ordenProduccion || 'N/A'}</Text>
                            <Text>Máq: {item.maquinaNombre}</Text>
                            <Text>Fecha: {formatDate(new Date(item.fecha))}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.rowCant}>{item.cantidad}</Text>
                            <TouchableOpacity onPress={() => handleDeleteRegistro(item.id)}>
                                <Text style={styles.deleteText}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No hay registros recientes.</Text>}
            />

            {/* MODAL CONFIGURACIÓN CÓDIGOS ... (sin cambios) */}
            <Modal visible={modalConfigVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Configuración de Códigos</Text>

                        <TextInput
                            style={[styles.input, { flex: 0.3 }]}
                            placeholder="Código (ej: DP01)"
                            value={newCodigo.codigo}
                            onChangeText={t => setNewCodigo({ ...newCodigo, codigo: t })}
                        />
                        <TextInput
                            style={[styles.input, { flex: 0.7 }]}
                            placeholder="Descripción"
                            value={newCodigo.descripcion}
                            onChangeText={t => setNewCodigo({ ...newCodigo, descripcion: t })}
                        />

                        <TouchableOpacity style={styles.largeSaveButton} onPress={handleSaveCodigo}>
                            <Text style={styles.largeSaveButtonText}>{editingCodigoId ? 'Actualizar Código' : 'Guardar Código'}</Text>
                        </TouchableOpacity>

                        <FlatList
                            data={codigos}
                            keyExtractor={item => item.id.toString()}
                            style={{ maxHeight: 300, marginTop: 10 }}
                            renderItem={({ item }) => (
                                <View style={styles.codeRow}>
                                    <Text style={{ width: 60, fontWeight: 'bold' }}>{item.codigo}</Text>
                                    <Text style={{ flex: 1 }}>{item.descripcion}</Text>
                                    <TouchableOpacity onPress={() => {
                                        setNewCodigo(item);
                                        setEditingCodigoId(item.id);
                                    }}>
                                        <Text style={styles.actionText}>✏️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteCodigo(item.id)} style={{ marginLeft: 10 }}>
                                        <Text style={styles.actionText}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />

                        <TouchableOpacity style={styles.closeButton} onPress={() => setModalConfigVisible(false)}>
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL AGREGAR DESPERDICIO */}
            <Modal visible={modalRegistroVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Registrar Desperdicio</Text>

                        {/* Siempre mostrar selector de máquina ya que se ocultó afuera */}
                        <Text style={styles.label}>Máquina</Text>
                        <Picker
                            selectedValue={newRegistro.maquinaId}
                            onValueChange={(v) => setNewRegistro({ ...newRegistro, maquinaId: v })}
                            style={styles.picker}
                        >
                            <Picker.Item label="Seleccionar..." value="" />
                            {maquinas.map(m => (
                                <Picker.Item key={m.id} label={m.nombre} value={m.id} />
                            ))}
                        </Picker>

                        <Text style={styles.label}>Operario</Text>
                        <Picker
                            selectedValue={newRegistro.usuarioId}
                            onValueChange={(v) => setNewRegistro({ ...newRegistro, usuarioId: v })}
                            style={styles.picker}
                        >
                            <Picker.Item label="Seleccionar..." value="" />
                            {usuarios.map(u => (
                                <Picker.Item key={u.id} label={u.nombre} value={u.id} />
                            ))}
                        </Picker>

                        {Platform.OS === 'web' ? (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={styles.label}>Fecha</Text>
                                <input
                                    type="date"
                                    value={formatDate(newRegistro.fecha)}
                                    onChange={(e) => {
                                        const d = new Date(e.target.value);
                                        // Ajustar zona horaria si es necesario, o usar string directo
                                        // Simple date parse
                                        setNewRegistro({ ...newRegistro, fecha: new Date(d.getTime() + d.getTimezoneOffset() * 60000) });
                                    }}
                                    style={{
                                        padding: 8,
                                        borderRadius: 4,
                                        border: '1px solid #ddd',
                                        fontSize: 16,
                                        width: '100%',
                                        backgroundColor: 'white' // Asegurar fondo blanco para editable
                                    }}
                                />
                            </View>
                        ) : null}

                        <Text style={styles.label}>Código Desperdicio</Text>
                        <Picker
                            selectedValue={newRegistro.codigoDesperdicioId}
                            onValueChange={(v) => setNewRegistro({ ...newRegistro, codigoDesperdicioId: v })}
                            style={styles.picker}
                        >
                            <Picker.Item label="Seleccionar..." value="" />
                            {codigos.filter(c => c.activo).map(c => (
                                <Picker.Item key={c.id} label={`${c.codigo} - ${c.descripcion}`} value={c.id} />
                            ))}
                        </Picker>

                        <Text style={styles.label}>Cantidad</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={newRegistro.cantidad}
                            onChangeText={t => setNewRegistro({ ...newRegistro, cantidad: t })}
                        />

                        <Text style={styles.label}>Orden Producción</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="OP..."
                            value={newRegistro.ordenProduccion}
                            onChangeText={t => setNewRegistro({ ...newRegistro, ordenProduccion: t })}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: '#ccc' }]} onPress={() => setModalRegistroVisible(false)}>
                                <Text style={styles.buttonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.addButton]} onPress={handleSaveRegistro}>
                                <Text style={styles.buttonText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
    header: { marginBottom: 16, backgroundColor: 'white', padding: 16, borderRadius: 8, elevation: 2 },
    filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 },
    label: { width: 80, fontWeight: 'bold' },
    pickerContainer: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 4 },
    picker: { height: 40, width: '100%' },
    webInput: { padding: 8, borderRadius: 4, border: '1px solid #ddd', fontSize: 16 },
    button: { padding: 10, borderRadius: 6, alignItems: 'center' },
    addButton: { backgroundColor: '#28a745' },
    configButton: { backgroundColor: '#6c757d' },
    buttonText: { color: 'white', fontWeight: 'bold' },
    row: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 6, marginBottom: 8, elevation: 1 },
    rowCode: { fontWeight: 'bold', fontSize: 16, color: '#007bff' },
    rowDesc: { color: '#555' },
    rowCant: { fontWeight: 'bold', fontSize: 18, color: '#dc3545' },
    deleteText: { color: 'red', fontSize: 12, marginTop: 4 },
    empty: { textAlign: 'center', color: '#888', marginTop: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxWidth: 500, backgroundColor: 'white', borderRadius: 10, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginBottom: 10 },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    saveIconBtn: { backgroundColor: '#007bff', padding: 10, borderRadius: 6, justifyContent: 'center' },
    codeRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
    actionText: { fontSize: 18 },
    closeButton: { marginTop: 20, padding: 12, backgroundColor: '#333', borderRadius: 6, alignItems: 'center' },
    closeButtonText: { color: 'white', fontWeight: 'bold' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    largeSaveButton: { backgroundColor: '#007bff', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 5, marginBottom: 15 },
    largeSaveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    readOnlyField: { padding: 10, backgroundColor: '#e9ecef', borderRadius: 6, marginBottom: 10, flexDirection: 'row' },
    readOnlyLabel: { fontWeight: 'bold', color: '#555' },
    readOnlyValue: { color: '#333' }
});

export default DesperdicioScreen;
