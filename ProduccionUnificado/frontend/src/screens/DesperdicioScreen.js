import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.227:5144/api';

const DesperdicioScreen = () => {
    // Estados principales
    const [maquinas, setMaquinas] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    // Filtros
    // Filtros
    const [selectedMaquina, setSelectedMaquina] = useState('');
    const [selectedFecha, setSelectedFecha] = useState(null);
    const [selectedUsuario, setSelectedUsuario] = useState(''); // Nuevo filtro
    const [selectedOP, setSelectedOP] = useState(''); // Nuevo filtro

    // Modales
    const [modalConfigVisible, setModalConfigVisible] = useState(false);
    const [modalRegistroVisible, setModalRegistroVisible] = useState(false);

    // Estado para nuevo registro
    const [newRegistro, setNewRegistro] = useState({
        id: null,
        maquinaId: '',
        usuarioId: '',
        fecha: new Date(),
        ordenProduccion: '',
        codigoDesperdicioId: '',
        cantidad: '',
        nota: ''
    });

    // Estado para gestión de códigos
    const [newCodigo, setNewCodigo] = useState({ codigo: '', descripcion: '', activo: true });
    const [editingCodigoId, setEditingCodigoId] = useState(null);

    useEffect(() => {
        loadInitialData();
        loadRegistros(); // Cargar registros del día al inicio
    }, []);

    useEffect(() => {
        // Recargar si cambian filtros
        loadRegistros();
    }, [selectedMaquina, selectedFecha, selectedUsuario, selectedOP]);

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
            // Solo formatear fecha si está seleccionada
            let dateStr = '';
            if (selectedFecha) {
                const year = selectedFecha.getFullYear();
                const month = String(selectedFecha.getMonth() + 1).padStart(2, '0');
                const day = String(selectedFecha.getDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
            }

            let url = `${API_URL}/desperdicio?`;
            if (dateStr) url += `fecha=${dateStr}&`;
            if (selectedMaquina) url += `maquinaId=${selectedMaquina}&`;
            if (selectedUsuario) url += `usuarioId=${selectedUsuario}&`;
            if (selectedOP) url += `ordenProduccion=${selectedOP}&`;

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
        // Código ahora es opcional. Solo Maquina, Usuario y Cantidad obligatorios.
        if (!newRegistro.maquinaId || !newRegistro.usuarioId || !newRegistro.cantidad) {
            Alert.alert('Error', 'Máquina, Operario y Cantidad son obligatorios');
            return;
        }

        if (isNaN(newRegistro.fecha.getTime())) {
            Alert.alert('Error', 'Fecha inválida');
            return;
        }

        try {
            const body = {
                maquinaId: parseInt(newRegistro.maquinaId),
                usuarioId: parseInt(newRegistro.usuarioId),
                ordenProduccion: newRegistro.ordenProduccion,
                codigoDesperdicioId: newRegistro.codigoDesperdicioId ? parseInt(newRegistro.codigoDesperdicioId) : null,
                cantidad: parseFloat(newRegistro.cantidad),
                fecha: newRegistro.fecha.toISOString(),
                nota: newRegistro.nota
            };

            console.log("PAYLOAD:", JSON.stringify(body)); // DEBUG

            if (newRegistro.id) {
                body.id = newRegistro.id;
            }

            let res;
            if (newRegistro.id) {
                // UPDATE (PUT)
                res = await fetch(`${API_URL}/desperdicio/${newRegistro.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } else {
                // CREATE (POST)
                res = await fetch(`${API_URL}/desperdicio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }

            if (res.ok) {
                Alert.alert('Éxito', newRegistro.id ? 'Desperdicio actualizado' : 'Desperdicio registrado');
                setModalRegistroVisible(false);

                // Actualizar filtro a la fecha del registro guardado para verlo inmediatamente
                setSelectedFecha(newRegistro.fecha);

                // Resetear form
                setNewRegistro({
                    id: null,
                    maquinaId: '',
                    usuarioId: '',
                    fecha: new Date(),
                    ordenProduccion: '',
                    codigoDesperdicioId: '',
                    cantidad: '',
                    nota: ''
                });
                // loadRegistros se llamará automáticamente por el useEffect al cambiar selectedFecha
            } else {
                const txt = await res.text();
                Alert.alert('Error', `No se pudo guardar: ${txt}`);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error de conexión');
        }
    };

    const handleEditRegistro = (item) => {
        // Parsear fecha
        const date = new Date(item.fecha);
        // Ajustar zona horaria local manualmente si viene UTC
        // const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000); 
        // El backend devuelve DateTime, el navegador lo parsea como local o UTC según formato.
        // Asumimos que viene ISO y new Date lo maneja.

        setNewRegistro({
            id: item.id,
            maquinaId: item.maquinaId,
            usuarioId: item.usuarioId,
            fecha: date,
            ordenProduccion: item.ordenProduccion || '',
            codigoDesperdicioId: item.codigoDesperdicioId || '',
            cantidad: item.cantidad.toString(),
            nota: item.nota || ''
        });
        setModalRegistroVisible(true);
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
        if (!date || isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    };

    const getBase64FromUrl = async (url) => {
        if (Platform.OS !== 'web') {
            try {
                const base64 = await FileSystem.readAsStringAsync(url, { encoding: 'base64' });
                return `data:image/jpeg;base64,${base64}`;
            } catch (err) {
                const tempPath = FileSystem.cacheDirectory + 'temp_logo.jpg';
                await FileSystem.downloadAsync(url, tempPath);
                const base64 = await FileSystem.readAsStringAsync(tempPath, { encoding: 'base64' });
                return `data:image/jpeg;base64,${base64}`;
            }
        }
        const data = await fetch(url);
        const blob = await data.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });
    };

    const generatePDF = async () => {
        setGeneratingPdf(true);
        try {
            let jsPDF, autoTable;
            if (Platform.OS === 'web') {
                const jsPDFModule = await import('jspdf');
                jsPDF = jsPDFModule.jsPDF;
                const autoTableModule = await import('jspdf-autotable');
                autoTable = autoTableModule.default;
            } else {
                alert("PDF disponible solo en Web por ahora.");
                setGeneratingPdf(false);
                return;
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Logo
            try {
                const asset = Asset.fromModule(logoSource);
                await asset.downloadAsync();
                const base64Logo = await getBase64FromUrl(asset.uri);
                doc.addImage(base64Logo, 'JPEG', 10, 10, 30, 30);
            } catch (err) { console.log("Error logo", err); }

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('REPORTE DE DESPERDICIOS', pageWidth / 2, 20, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const fechaStr = selectedFecha ? formatDate(selectedFecha) : 'Todo el Historial';
            doc.text(`Fecha: ${fechaStr}`, pageWidth / 2, 30, { align: 'center' });

            if (selectedMaquina) {
                const maquina = maquinas.find(m => m.id == selectedMaquina)?.nombre || 'Desconocida';
                doc.text(`Máquina: ${maquina}`, pageWidth / 2, 36, { align: 'center' });
            }

            // Summary Stats
            const totalItems = registros.length;
            const totalCantidad = registros.reduce((sum, r) => sum + r.cantidad, 0);

            doc.setFontSize(10);
            doc.text(`Total Registros: ${totalItems}   |   Total Cantidad: ${totalCantidad.toFixed(2)}`, 14, 50);

            // Table
            const columns = ['Fecha', 'Máquina', 'Operario', 'Código', 'OP', 'Cant', 'Nota'];
            const data = registros.map(r => [
                formatDate(new Date(r.fecha)),
                r.maquinaNombre,
                r.usuarioNombre,
                r.codigo,
                r.ordenProduccion || '-',
                r.cantidad.toString(),
                r.nota || '-'
            ]);

            autoTable(doc, {
                head: [columns],
                body: data,
                startY: 55,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                columnStyles: {
                    0: { cellWidth: 22 },
                    6: { cellWidth: 60 }
                }
            });

            // Resumen por Código (Gráfica Simple simulada con barras de texto o tabla pequeña)
            let finalY = doc.lastAutoTable.finalY + 15;

            // Agrupar por código
            const group = {};
            registros.forEach(r => {
                const k = r.codigo;
                if (!group[k]) group[k] = 0;
                group[k] += r.cantidad;
            });
            const summaryData = Object.keys(group).map(k => [k, group[k].toFixed(2)]);

            doc.text('Resumen por Código:', 14, finalY);
            autoTable(doc, {
                head: [['Código', 'Total Cantidad']],
                body: summaryData,
                startY: finalY + 5,
                theme: 'grid',
                styles: { fontSize: 8 },
                tableWidth: 80
            });

            doc.save(`reporte_desperdicios_${new Date().getTime()}.pdf`);

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo generar el PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };


    return (
        <View style={styles.container}>
            {/* Header / Botones Superiores */}
            <View style={styles.header}>
                <View style={[styles.filterRow, { flexWrap: 'wrap', gap: 10 }]}>
                    {/* Filtro Fecha */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Fecha:</Text>
                        {selectedFecha ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={selectedFecha && !isNaN(selectedFecha.getTime()) ? selectedFecha.toISOString().split('T')[0] : ''}
                                        onChange={(e) => {
                                            if (!e.target.value) { setSelectedFecha(null); return; }
                                            const d = new Date(e.target.value);
                                            if (isNaN(d.getTime())) return;
                                            const localDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                                            setSelectedFecha(localDate);
                                        }}
                                        style={{ padding: 5, borderRadius: 4, border: '1px solid #ccc', marginRight: 5 }}
                                    />
                                ) : (
                                    <Text style={{ marginRight: 5 }}>{formatDate(selectedFecha)}</Text>
                                )}
                                <TouchableOpacity onPress={() => setSelectedFecha(null)} style={{ backgroundColor: '#dc3545', padding: 5, borderRadius: 4 }}>
                                    <Text style={{ color: 'white', fontSize: 10 }}>X</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => setSelectedFecha(new Date())} style={{ backgroundColor: '#007bff', padding: 5, borderRadius: 4 }}>
                                <Text style={{ color: 'white', fontSize: 12 }}>📅 Hoy</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Filtro Máquina */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Máq:</Text>
                        <Picker
                            selectedValue={selectedMaquina}
                            onValueChange={(v) => setSelectedMaquina(v)}
                            style={{ height: 30, width: 150, padding: 0 }}
                        >
                            <Picker.Item label="Todas" value="" />
                            {maquinas.map(m => (
                                <Picker.Item key={m.id} label={m.nombre} value={m.id} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro Operario */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>Op:</Text>
                        <Picker
                            selectedValue={selectedUsuario}
                            onValueChange={(v) => setSelectedUsuario(v)}
                            style={{ height: 30, width: 150, padding: 0 }}
                        >
                            <Picker.Item label="Todos" value="" />
                            {usuarios.map(u => (
                                <Picker.Item key={u.id} label={u.nombre} value={u.id} />
                            ))}
                        </Picker>
                    </View>

                    {/* Filtro OP */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.label, { marginBottom: 0, marginRight: 5 }]}>OP:</Text>
                        <TextInput
                            style={{
                                height: 30,
                                borderColor: '#ccc',
                                borderWidth: 1,
                                borderRadius: 4,
                                paddingHorizontal: 5,
                                width: 80,
                                backgroundColor: 'white'
                            }}
                            placeholder="Buscar..."
                            value={selectedOP}
                            onChangeText={setSelectedOP}
                        />
                    </View>
                </View>

                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#6c757d', marginRight: 10 }]}
                        onPress={generatePDF}
                        disabled={generatingPdf}
                    >
                        {generatingPdf ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>📄 PDF</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.configButton]}
                        onPress={() => setModalConfigVisible(true)}
                    >
                        <Text style={styles.buttonText}>⚙️ Configuración</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.addButton]}
                        onPress={() => {
                            setNewRegistro({
                                id: null,
                                maquinaId: '',
                                usuarioId: '',
                                fecha: selectedFecha || new Date(),
                                ordenProduccion: '',
                                codigoDesperdicioId: '',
                                cantidad: '',
                                nota: ''
                            });
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
                    <View style={{ borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8 }}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowCode}>{item.codigo}</Text>
                                <Text style={styles.rowDesc}>{item.descripcion}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text>OP: {item.ordenProduccion || 'N/A'}</Text>
                                <Text>Máq: {item.maquinaNombre}</Text>
                                <Text>Oper: {item.usuarioNombre}</Text>
                                <Text>Fecha: {formatDate(new Date(item.fecha))}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.rowCant}>{item.cantidad}</Text>
                                <TouchableOpacity onPress={() => handleEditRegistro(item)} style={{ marginBottom: 5 }}>
                                    <Text style={[styles.deleteText, { color: '#007bff' }]}>✏️ Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteRegistro(item.id)}>
                                    <Text style={styles.deleteText}>🗑️ Eliminar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {item.nota ? <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginLeft: 10 }}>Nota: {item.nota}</Text> : null}
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
                        <Text style={styles.modalTitle}>{newRegistro.id ? 'Editar Desperdicio' : 'Registrar Desperdicio'}</Text>

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
                                        if (isNaN(d.getTime())) return;
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

                        <TextInput
                            style={styles.input}
                            placeholder="OP..."
                            value={newRegistro.ordenProduccion}
                            onChangeText={t => setNewRegistro({ ...newRegistro, ordenProduccion: t })}
                        />

                        <Text style={styles.label}>Nota (Opcional)</Text>
                        <TextInput
                            style={[styles.input, { height: 60 }]}
                            placeholder="Nota adicional..."
                            multiline
                            value={newRegistro.nota}
                            onChangeText={t => setNewRegistro({ ...newRegistro, nota: t })}
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
        </View >
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
