import { authFetch } from '../services/authFetch';
import { getToken } from '../services/authStorage';
import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ScrollView, TextInput, ActivityIndicator, Keyboard, Modal, Dimensions, RefreshControl } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/productionApi';

// --- Local Helpers (matching CalidadScreen.js style) ---
const SectionCard = memo(function SectionCard({ title, icon, children, style }: any) {
    return (
        <View style={[styles.sectionCard, style]}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{icon}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
});

const FormField = memo(function FormField({ label, required, children, style }: any) {
    return (
        <View style={[styles.formField, style]}>
            <Text style={styles.fieldLabel}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>
            {children}
        </View>
    );
});

const ChoiceField = memo(function ChoiceField({ value, onSelect, options = ['SI', 'NO'], label }: any) {
    return (
        <View style={styles.choiceContainer}>
            {options.map((opt: string) => {
                const isSelected = (opt === 'SI' || opt === 'CUMPLE' || opt === 'si') ? value === true : value === false;
                // Special case for true/false mapping
                let currentIsSelected = false;
                if (opt === 'SI' || opt === 'CUMPLE' || opt === 'si' || opt === 'Si') currentIsSelected = value === true;
                if (opt === 'NO' || opt === 'no' || opt === 'No' || opt === 'NO CUMPLE') currentIsSelected = value === false;

                return (
                    <TouchableOpacity 
                        key={opt} 
                        style={styles.choiceOption} 
                        onPress={() => onSelect(opt === 'SI' || opt === 'CUMPLE' || opt === 'si' || opt === 'Si')}
                    >
                        <View style={[styles.choiceCircle, currentIsSelected && styles.choiceCircleActive]} />
                        <Text style={[styles.choiceOptionText, currentIsSelected && styles.choiceOptionTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});

interface Taller {
    id: number;
    nombre: string;
}

interface EncuestaResumen {
    id: number;
    tallerNombre: string;
    ordenProduccion: string;
    estadoProceso: string;
    fechaCreacion: string;
}

interface CalidadTalleresScreenProps {
    onLogout: () => void;
    username: string;
}

export default function CalidadTalleresScreen({ onLogout, username }: CalidadTalleresScreenProps) {
const [view, setView] = useState<'history' | 'form'>('history');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Data
    const [talleres, setTalleres] = useState<Taller[]>([]);
    const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([]);
    
    // Form State - Identificación
    const [tallerId, setTallerId] = useState<number | 'otro' | null>(null);
    const [nombreTallerNuevo, setNombreTallerNuevo] = useState('');
    
    // Form State - Tiempos
    const [horaLlegada, setHoraLlegada] = useState('');
    const [periodoLlegada, setPeriodoLlegada] = useState('AM');
    const [horaSalida, setHoraSalida] = useState('');
    const [periodoSalida, setPeriodoSalida] = useState('PM');
    
    // Form State - Producción
    const [ordenProduccion, setOrdenProduccion] = useState('');
    const [numeroRemision, setNumeroRemision] = useState('');
    const [cantidadProducir, setCantidadProducir] = useState('');
    const [cantidadEvaluada, setCantidadEvaluada] = useState('');
    const [estadoProceso, setEstadoProceso] = useState('');

    // Form State - Requerimientos (CUMPLE / NO CUMPLE)
    const [tieneMuestra, setTieneMuestra] = useState<boolean | null>(null);
    const [tipoProducto, setTipoProducto] = useState('');
    const [conoceFormaEmpaque, setConoceFormaEmpaque] = useState<boolean | null>(null);
    const [tieneRemision, setTieneRemision] = useState<boolean | null>(null);
    const [tieneInsumosCompletos, setTieneInsumosCompletos] = useState<boolean | null>(null);

    // Form State - Puntos Críticos (SI / NO)
    const [variacionTono, setVariacionTono] = useState<boolean>(false);
    const [quebradoArrugado, setQuebradoArrugado] = useState<boolean>(false);
    const [esquinaDefectuosa, setEsquinaDefectuosa] = useState<boolean>(false);
    const [presenciaPestanas, setPresenciaPestanas] = useState<boolean>(false);
    const [desgasteImpresion, setDesgasteImpresion] = useState<boolean>(false);
    const [manchas, setManchas] = useState<boolean>(false);
    const [reservaPega, setReservaPega] = useState<boolean>(false);
    const [grafadoRoto, setGrafadoRoto] = useState<boolean>(false);

    // Form State - Logística
    const [novedadBPM, setNovedadBPM] = useState<boolean | null>(null);
    const [usaCofia, setUsaCofia] = useState<boolean | null>(null);
    const [insumosPendientes, setInsumosPendientes] = useState<boolean | null>(null);
    const [tipoInsumosPendientes, setTipoInsumosPendientes] = useState('Ninguno');
    const [observaciones, setObservaciones] = useState('');

    // --- Helpers for validations ---
    const formatTimeInput = (text: string) => {
        // Remove non-numbers
        const cleaned = text.replace(/[^0-9]/g, '');
        // Limit to 4 digits
        const limited = cleaned.slice(0, 4);
        
        if (limited.length > 2) {
            return `${limited.slice(0, 2)}:${limited.slice(2)}`;
        }
        return limited;
    };

    const timeToMinutes = (timeStr: string, period: string) => {
        if (!timeStr || !timeStr.includes(':')) return 0;
        let [hours, minutes] = timeStr.split(':').map(Number);
        
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [talleresRes, encuestasRes] = await Promise.all([
                api.get('/CalidadTalleres/talleres'),
                api.get('/CalidadTalleres/encuestas')
            ]);
            setTalleres(talleresRes.data);
            setEncuestas(encuestasRes.data);
        } catch (error) {
            console.error("Error loading data", error);
            Alert.alert("Error", "No se pudo cargar la información del servidor.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTallerId(null);
        setNombreTallerNuevo('');
        setHoraLlegada('');
        setPeriodoLlegada('AM');
        setHoraSalida('');
        setPeriodoSalida('PM');
        setOrdenProduccion('');
        setNumeroRemision('');
        setCantidadProducir('');
        setCantidadEvaluada('');
        setEstadoProceso('');
        
        // Reset news
        setTieneMuestra(null);
        setTipoProducto('');
        setConoceFormaEmpaque(null);
        setTieneRemision(null);
        setTieneInsumosCompletos(null);
        setVariacionTono(false);
        setQuebradoArrugado(false);
        setEsquinaDefectuosa(false);
        setPresenciaPestanas(false);
        setDesgasteImpresion(false);
        setManchas(false);
        setReservaPega(false);
        setGrafadoRoto(false);
        setNovedadBPM(null);
        setUsaCofia(null);
        setInsumosPendientes(null);
        setTipoInsumosPendientes('Ninguno');
        setObservaciones('');
    };

    const handleSave = async () => {
        // Validation of mandatory fields from screenshots
        if (!tallerId || !ordenProduccion || !estadoProceso || !cantidadProducir || 
            tieneMuestra === null || conoceFormaEmpaque === null || tieneRemision === null || 
            tieneInsumosCompletos === null || novedadBPM === null || usaCofia === null || 
            insumosPendientes === null) {
            Alert.alert("Campos incompletos", "Por favor completa todos los campos obligatorios (*)");
            return;
        }

        if (tallerId === 'otro' && !nombreTallerNuevo.trim()) {
            Alert.alert("Nombre faltante", "Por favor ingresa el nombre del taller externo.");
            return;
        }

        // Time Validations
        const minsLlegada = timeToMinutes(horaLlegada, periodoLlegada);
        const minsSalida = timeToMinutes(horaSalida, periodoSalida);

        if (minsLlegada >= minsSalida) {
            Alert.alert("Horario inválido", "La hora de llegada debe ser menor a la hora de salida.");
            return;
        }

        if (horaLlegada.length < 5 || horaSalida.length < 5) {
            Alert.alert("Hora incompleta", "Por favor ingresa las horas en formato HH:mm");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                tallerId: tallerId === 'otro' ? 0 : tallerId,
                nombreTallerNuevo: tallerId === 'otro' ? nombreTallerNuevo : null,
                horaLlegada: `${horaLlegada.trim()} ${periodoLlegada}`,
                horaSalida: `${horaSalida.trim()} ${periodoSalida}`,
                ordenProduccion,
                numeroRemision,
                cantidadProducir: parseFloat(cantidadProducir) || 0,
                cantidadEvaluada: parseFloat(cantidadEvaluada) || 0,
                estadoProceso,
                // New fields
                tieneMuestra,
                tipoProducto,
                conoceFormaEmpaque,
                tieneRemision,
                tieneInsumosCompletos,
                variacionTono,
                quebradoArrugado,
                esquinaDefectuosa,
                presenciaPestanas,
                desgasteImpresion,
                manchas,
                reservaPega,
                grafadoRoto,
                novedadBPM,
                usaCofia,
                insumosPendientes,
                tipoInsumosPendientes,
                observaciones
            };

            await api.post('/CalidadTalleres/encuestas', payload);
            Alert.alert("Éxito", "Encuesta guardada correctamente.");
            resetForm();
            setView('history');
            loadInitialData();
        } catch (error) {
            console.error("Error saving encuesta", error);
            Alert.alert("Error", "No se pudo guardar la encuesta.");
        } finally {
            setSaving(false);
        }
    };

    const renderHistoryItem = ({ item }: { item: EncuestaResumen }) => (
        <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
                <View style={styles.historyOP}>
                    <Text style={styles.historyOPLabel}>OP</Text>
                    <Text style={styles.historyOPValue}>{item.ordenProduccion}</Text>
                </View>
                <View style={[styles.estadoPill, { backgroundColor: item.estadoProceso === 'Finalizado' ? '#10B981' : '#F59E0B' }]}>
                    <Text style={styles.estadoPillText}>{item.estadoProceso}</Text>
                </View>
            </View>
            <View style={styles.historyBody}>
                <View style={styles.historyRow}>
                    <Text style={styles.historyIcon}>🏭</Text>
                    <Text style={styles.historyText}>{item.tallerNombre}</Text>
                </View>
                <View style={styles.historyRow}>
                    <Text style={styles.historyIcon}>🕒</Text>
                    <Text style={styles.historyText}>{new Date(item.fechaCreacion).toLocaleString()}</Text>
                </View>
            </View>
        </View>
    );

    if (view === 'form') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerBackBtn} onPress={() => setView('history')}>
                        <Text style={styles.headerBackText}>← Volver</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Nueva Toma de Calidad</Text>
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.formContainer}>
                    <SectionCard title="Identificación del Taller" icon="🏬">
                        <FormField label="Nombre del Taller Externo" required>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={tallerId}
                                    onValueChange={(val) => setTallerId(val)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="-- Seleccionar --" value={null} />
                                    {talleres.map(t => (
                                        <Picker.Item key={t.id} label={t.nombre} value={t.id} />
                                    ))}
                                    <Picker.Item label="+ OTRO (Ingresar nuevo)" value="otro" color="#1E40AF" />
                                </Picker>
                            </View>
                        </FormField>

                        {tallerId === 'otro' && (
                            <FormField label="Especifique el nombre del Taller" required>
                                <TextInput
                                    style={styles.input}
                                    value={nombreTallerNuevo}
                                    onChangeText={setNombreTallerNuevo}
                                    placeholder="Nombre del nuevo taller..."
                                    autoCapitalize="characters"
                                />
                            </FormField>
                        )}
                    </SectionCard>

                    <SectionCard title="Tiempos y Logística" icon="⏱️">
                        <FormField label="Hora Llegada" required>
                            <View style={styles.timeInputContainer}>
                                <TextInput
                                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                    value={horaLlegada}
                                    onChangeText={(text) => setHoraLlegada(formatTimeInput(text))}
                                    placeholder="HH:mm"
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                                <TouchableOpacity 
                                    style={styles.periodToggle} 
                                    onPress={() => setPeriodoLlegada(p => p === 'AM' ? 'PM' : 'AM')}
                                >
                                    <Text style={styles.periodToggleText}>{periodoLlegada}</Text>
                                </TouchableOpacity>
                            </View>
                        </FormField>

                        <FormField label="Hora Salida" required>
                            <View style={styles.timeInputContainer}>
                                <TextInput
                                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                    value={horaSalida}
                                    onChangeText={(text) => setHoraSalida(formatTimeInput(text))}
                                    placeholder="HH:mm"
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                                <TouchableOpacity 
                                    style={styles.periodToggle} 
                                    onPress={() => setPeriodoSalida(p => p === 'AM' ? 'PM' : 'AM')}
                                >
                                    <Text style={styles.periodToggleText}>{periodoSalida}</Text>
                                </TouchableOpacity>
                            </View>
                        </FormField>
                    </SectionCard>

                    <SectionCard title="Requerimientos Iniciales" icon="📋">
                        <FormField label="Tiene Muestra del producto a elaborar" required>
                            <ChoiceField value={tieneMuestra} onSelect={setTieneMuestra} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>

                        <FormField label="TIPO DE PRODUCTO ELABORADO">
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={tipoProducto}
                                    onValueChange={setTipoProducto}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="-- Elegir --" value="" />
                                    <Picker.Item label="BOLSAS" value="BOLSAS" />
                                    <Picker.Item label="PLEGADIZA LINEAL" value="PLEGADIZA LINEAL" />
                                    <Picker.Item label="PLEGADIZA LINEAL + AUTOMATICO" value="PLEGADIZA LINEAL + AUTOMATICO" />
                                    <Picker.Item label="PLEGADIZA LINEAL + AUTOMATICO+VENTANILLA" value="PLEGADIZA LINEAL + AUTOMATICO+VENTANILLA" />
                                    <Picker.Item label="PLEGADIZA 04 PUNTAS" value="PLEGADIZA 04 PUNTAS" />
                                    <Picker.Item label="PLEGADIZA 06 PUNTAS" value="PLEGADIZA 06 PUNTAS" />
                                </Picker>
                            </View>
                        </FormField>

                        <FormField label="Conoce la forma de empaque ?" required>
                            <ChoiceField value={conoceFormaEmpaque} onSelect={setConoceFormaEmpaque} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>

                        <FormField label="Tiene remisión del producto a elaborar ?" required>
                            <ChoiceField value={tieneRemision} onSelect={setTieneRemision} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>

                        <FormField label="Tiene insumos completo para elaborar el producto ?" required>
                            <ChoiceField value={tieneInsumosCompletos} onSelect={setTieneInsumosCompletos} options={['CUMPLE', 'NO CUMPLE']} />
                        </FormField>
                    </SectionCard>

                    <SectionCard title="Datos de Producción" icon="📦">
                        <FormField label="Número de Orden de Producción" required>
                            <TextInput
                                style={styles.input}
                                value={ordenProduccion}
                                onChangeText={setOrdenProduccion}
                                placeholder="Ej: OP-123456"
                            />
                        </FormField>
                        <FormField label="Número de Remisión" required>
                            <TextInput
                                style={styles.input}
                                value={numeroRemision}
                                onChangeText={setNumeroRemision}
                                placeholder="Ej: REM-789"
                            />
                        </FormField>
                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <FormField label="Cantidad a Producir" required>
                                    <TextInput
                                        style={styles.input}
                                        value={cantidadProducir}
                                        onChangeText={setCantidadProducir}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </FormField>
                            </View>
                            <View style={styles.halfField}>
                                <FormField label="Cantidad Evaluada" required>
                                    <TextInput
                                        style={styles.input}
                                        value={cantidadEvaluada}
                                        onChangeText={setCantidadEvaluada}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </FormField>
                            </View>
                        </View>
                    </SectionCard>

                    <SectionCard title="Puntos Críticos de Calidad" icon="🔍">
                        <FormField label="Variación de Tono">
                            <ChoiceField value={variacionTono} onSelect={setVariacionTono} options={['Si', 'No']} />
                        </FormField>
                        <FormField label="Quebrado o arrugado">
                            <ChoiceField value={quebradoArrugado} onSelect={setQuebradoArrugado} options={['Si', 'No']} />
                        </FormField>
                        <FormField label="Esquina defectuosa">
                            <ChoiceField value={esquinaDefectuosa} onSelect={setEsquinaDefectuosa} options={['si', 'No']} />
                        </FormField>
                        <FormField label="Presencia de PESTAÑAS">
                            <ChoiceField value={presenciaPestanas} onSelect={setPresenciaPestanas} options={['si', 'No']} />
                        </FormField>
                        <FormField label="Desgaste de la impresión por roce o fricción">
                            <ChoiceField value={desgasteImpresion} onSelect={setDesgasteImpresion} options={['si', 'No']} />
                        </FormField>
                        <FormField label="Manchas">
                            <ChoiceField value={manchas} onSelect={setManchas} options={['si', 'no']} />
                        </FormField>
                        <FormField label="Reserva para pega">
                            <ChoiceField value={reservaPega} onSelect={setReservaPega} options={['si', 'No']} />
                        </FormField>
                        <FormField label="Grafado roto y/o falta de corte">
                            <ChoiceField value={grafadoRoto} onSelect={setGrafadoRoto} options={['si', 'No']} />
                        </FormField>
                    </SectionCard>

                    <SectionCard title="Higiene y Logística" icon="🧼">
                        <FormField label="Tiene novedad en BPM ?" required>
                            <ChoiceField value={novedadBPM} onSelect={setNovedadBPM} options={['SI', 'NO']} />
                        </FormField>
                        <FormField label="La persona usa cofia ?" required>
                            <ChoiceField value={usaCofia} onSelect={setUsaCofia} options={['SI', 'NO']} />
                        </FormField>
                        <FormField label="Insumos pendientes x recoger en taller?" required>
                            <ChoiceField value={insumosPendientes} onSelect={setInsumosPendientes} options={['SI', 'NO']} />
                        </FormField>
                        
                        {insumosPendientes && (
                            <FormField label="Tipo de Insumos pendientes x recoger" required>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={tipoInsumosPendientes}
                                        onValueChange={setTipoInsumosPendientes}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Goma" value="Goma" />
                                        <Picker.Item label="Cajas" value="Cajas" />
                                        <Picker.Item label="Strech" value="Strech" />
                                        <Picker.Item label="Ninguno" value="Ninguno" />
                                    </Picker>
                                </View>
                            </FormField>
                        )}
                    </SectionCard>

                    <SectionCard title="Finalización" icon="🏁">
                        <FormField label="Estado del Proceso" required>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={estadoProceso}
                                    onValueChange={(val) => setEstadoProceso(val)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="-- Elegir --" value="" />
                                    <Picker.Item label="Iniciando proceso" value="Iniciando proceso" />
                                    <Picker.Item label="En proceso bolsas armadas" value="En proceso bolsas armadas" />
                                    <Picker.Item label="Finalizado" value="Finalizado" />
                                </Picker>
                            </View>
                        </FormField>

                        <FormField label="Observación del proceso">
                            <TextInput
                                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                                value={observaciones}
                                onChangeText={setObservaciones}
                                placeholder="Tu respuesta..."
                                multiline
                            />
                        </FormField>
                    </SectionCard>

                    <TouchableOpacity 
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text style={styles.saveBtnIcon}>💾</Text>
                                <Text style={styles.saveBtnText}>Guardar Registro</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Encuestas Calidad - Talleres</Text>
                <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                    <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newBtn} onPress={() => { setView('form'); resetForm(); }}>
                <Text style={styles.newBtnIcon}>+</Text>
                <Text style={styles.newBtnText}>Nueva Toma de Calidad</Text>
            </TouchableOpacity>

            <Text style={styles.listTitle}>📋 Historial ({username})</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 50 }} />
            ) : encuestas.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📝</Text>
                    <Text style={styles.emptyText}>No hay registros hoy</Text>
                    <Text style={styles.emptySubtext}>Pulsa el botón verde para empezar</Text>
                </View>
            ) : (
                <FlatList
                    data={encuestas}
                    renderItem={renderHistoryItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInitialData} />}
                />
            )}
        </View>
    );
}

// Reuse styles from CalidadScreen as requested
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    scrollView: { flex: 1 },
    header: { backgroundColor: '#96BDF0', paddingTop: 40, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    headerBackBtn: { marginRight: 15, backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    headerBackText: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
    headerTitle: { color: '#1F2937', fontSize: 18, fontWeight: 'bold', flex: 1 },
    logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
    logoutBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
    newBtn: { backgroundColor: '#10B981', margin: 16, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    newBtnIcon: { color: 'white', fontSize: 24, fontWeight: 'bold', marginRight: 8 },
    newBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    listTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 12, color: '#1F2937' },
    listContent: { paddingHorizontal: 16, paddingBottom: 20 },
    historyCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
    historyHeader: { backgroundColor: '#96BDF0', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyOP: { flexDirection: 'row', alignItems: 'center' },
    historyOPLabel: { backgroundColor: 'rgba(0,0,0,0.1)', color: '#1F2937', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    historyOPValue: { color: '#1F2937', fontSize: 16, fontWeight: 'bold' },
    estadoPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    estadoPillText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    historyBody: { padding: 14 },
    historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    historyIcon: { fontSize: 16, marginRight: 10, width: 24 },
    historyText: { fontSize: 14, color: '#4B5563', flex: 1 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyText: { fontSize: 18, color: '#4B5563', fontWeight: '600', marginBottom: 6 },
    emptySubtext: { fontSize: 14, color: '#9CA3AF' },
    formContainer: { padding: 16 },
    sectionCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#E5E7EB' },
    sectionIcon: { fontSize: 24, marginRight: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
    formField: { marginBottom: 16 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    required: { color: '#EF4444' },
    pickerWrapper: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', overflow: 'hidden' },
    picker: { height: 50, color: '#1F2937' },
    input: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', padding: 14, fontSize: 16, color: '#1F2937' },
    timeInputContainer: { flexDirection: 'row', alignItems: 'center' },
    periodToggle: { backgroundColor: '#F3F4F6', borderTopRightRadius: 12, borderBottomRightRadius: 12, borderWidth: 1.5, borderLeftWidth: 0, borderColor: '#D1D5DB', width: 60, height: 50, justifyContent: 'center', alignItems: 'center' },
    periodToggleText: { color: '#1E3A8A', fontWeight: 'bold', fontSize: 16 },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    saveBtn: { backgroundColor: '#10B981', padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    saveBtnDisabled: { backgroundColor: '#9CA3AF' },
    saveBtnIcon: { color: 'white', fontSize: 20, marginRight: 8 },
    saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    
    // ChoiceField Styles
    choiceContainer: { borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', overflow: 'hidden' },
    choiceOption: { padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'white' },
    choiceCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12 },
    choiceCircleActive: { borderColor: '#1E3A8A', backgroundColor: '#1E3A8A' },
    choiceOptionText: { fontSize: 15, color: '#374151', textTransform: 'uppercase' },
    choiceOptionTextActive: { color: '#1E3A8A', fontWeight: 'bold' },
});
