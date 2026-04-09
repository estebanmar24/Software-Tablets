import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, Modal, Platform, TextInput
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../contexts/ThemeContext';
import * as planeacionApi from '../services/planeacionApi';
import * as api from '../services/api';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM
const DAYS = [
    { key: 1, label: 'Lunes' },
    { key: 2, label: 'Martes' },
    { key: 3, label: 'Miércoles' },
    { key: 4, label: 'Jueves' },
    { key: 5, label: 'Viernes' },
    { key: 6, label: 'Sábado' },
    { key: 0, label: 'Domingo' }
];

// Helper to get week dates
const getWeekDates = (baseDate) => {
    const d = new Date(baseDate);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to Monday start
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(d);
        date.setDate(d.getDate() + i);
        return date;
    });
};


const ACTIVITY_COLORS = {
    '01': '#22C55E', // Producción (Bright Green)
    '02': '#3B82F6', // Puesta a Punto (Bright Blue)
    '03': '#F59E0B', // Mantenimiento (Amber)
    '04': '#A855F7', // Limpieza (Purple)
    '05': '#EF4444', // Parada Técnica (Red)
    'default': '#64748B' // Otros
};

const OP_COLORS = [
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
    '#EAB308', // Yellow
];

const getOpColor = (opString) => {
    if (!opString) return '#3B82F6';
    let hash = 0;
    for (let i = 0; i < opString.length; i++) {
        hash = opString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % OP_COLORS.length;
    return OP_COLORS[index];
};


function CustomDropdown({ label, items, selectedValue, onValueChange, placeholder, isSearchable }) {
    const { colors, isDarkMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const selectedItem = useMemo(() => items.find(i => i.id?.toString() === selectedValue?.toString()), [items, selectedValue]);


    // Sincronizar searchTerm cuando cambia la selección
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm(selectedItem ? (selectedItem.numero || selectedItem.nombre || selectedItem.id.toString()) : '');
        }
    }, [selectedItem, isOpen]);


    const filteredItems = useMemo(() => {
        if (!isSearchable || !searchTerm || !isOpen) return items;
        const s = searchTerm.toLowerCase();
        return items.filter(i =>
            (i.numero && i.numero.toString().toLowerCase().includes(s)) ||
            (i.nombre && i.nombre.toLowerCase().includes(s)) ||
            (i.id && i.id.toString().toLowerCase().includes(s))
        );
    }, [items, searchTerm, isSearchable, isOpen]);

    return (
        <View style={{ marginBottom: 15, zIndex: isOpen ? 5000 : 1 }}>
            {label && <Text style={{ color: '#CBD5E0', marginBottom: 8, fontSize: 14, fontWeight: '600' }}>{label}</Text>}
            <View
                style={{
                    backgroundColor: '#2D3748',
                    borderColor: isOpen ? '#4F46E5' : '#4A5568',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    height: 50,
                    paddingHorizontal: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    elevation: 2
                }}
            >
                {isSearchable ? (
                    <TextInput
                        style={{ flex: 1, color: '#FFF', fontSize: 16, fontWeight: '500', height: '100%' }}
                        placeholder={placeholder || 'Buscar...'}
                        placeholderTextColor="#718096"
                        autoFocus={false}
                        value={isOpen ? searchTerm : (selectedItem ? (selectedItem.numero || selectedItem.nombre) : '')}
                        onChangeText={(t) => {
                            setSearchTerm(t);
                            if (!isOpen) setIsOpen(true);
                        }}
                    />

                ) : (
                    <TouchableOpacity
                        style={{ flex: 1, height: '100%', justifyContent: 'center' }}
                        onPress={() => setIsOpen(!isOpen)}
                    >
                        <Text style={{ color: selectedItem ? '#FFF' : '#718096', fontSize: 16, fontWeight: '500' }}>
                            {(selectedItem ? (selectedItem.nombre || selectedItem.numero || selectedItem.id) : (placeholder || 'Seleccionar...'))}
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsOpen(!isOpen)}>
                    <Text style={{ color: '#A0AEC0', fontSize: 12, paddingLeft: 10 }}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
            </View>


            {isOpen && (
                <View style={{
                    position: 'absolute',
                    top: 75,
                    left: 0,
                    right: 0,
                    backgroundColor: '#1A202C',
                    borderColor: '#4A5568',
                    borderWidth: 1,
                    borderRadius: 12,
                    maxHeight: 250,
                    overflow: 'hidden',
                    elevation: 10,
                    zIndex: 9999,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5
                }}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredItems.length === 0 ? (
                            <View style={{ padding: 15 }}><Text style={{ color: '#718096' }}>No hay resultados</Text></View>
                        ) : (
                            filteredItems.map((item, index) => (
                                <TouchableOpacity
                                    key={item.id || index}
                                    onPress={() => {
                                        onValueChange(item.id);
                                        setIsOpen(false);
                                        if (isSearchable) setSearchTerm(item.numero || item.nombre);
                                    }}
                                    style={{
                                        paddingVertical: 15,
                                        paddingHorizontal: 18,
                                        borderBottomWidth: index === filteredItems.length - 1 ? 0 : 1,
                                        borderBottomColor: '#2D3748',
                                        backgroundColor: item.id === selectedValue ? '#4F46E5' : 'transparent'
                                    }}
                                >
                                    <Text style={{
                                        color: item.id === selectedValue ? '#FFF' : '#E2E8F0',
                                        fontSize: 15,
                                        fontWeight: item.id === selectedValue ? '700' : '400'
                                    }}>
                                        {item.numero || (item.nombre && item.nombre.includes('Generada') ? item.id : item.nombre) || item.id}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>

                </View>
            )}

        </View>
    );
}



export default function PlaneadorMaquinasScreen() {

    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [maquinas, setMaquinas] = useState([]);
    const [selectedMaquina, setSelectedMaquina] = useState(null);
    const [pivotDate, setPivotDate] = useState(new Date());
    const [weekDates, setWeekDates] = useState(getWeekDates(new Date()));
    const [planeaciones, setPlaneaciones] = useState([]);
    const [estadoMaquinas, setEstadoMaquinas] = useState([]);

    const [ordenes, setOrdenes] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    const [formData, setFormData] = useState({
        ordenProduccionId: '',
        metaTiros: '',
        referencia: '',
        horaInicio: 7,
        horaFin: 10
    });


    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const start = weekDates[0].toISOString().split('T')[0];
            const end = weekDates[6].toISOString().split('T')[0] + 'T23:59:59';

            const [maqs, planes, estados, ords] = await Promise.all([
                api.getMaquinas(),
                planeacionApi.getPlaneadorRango(start, end),
                planeacionApi.getEstadoActualMaquinas(),
                api.getOrdenes()
            ]);

            setMaquinas(maqs);
            if (!selectedMaquina && maqs.length > 0) setSelectedMaquina(maqs[0].id);
            setPlaneaciones(planes);
            setEstadoMaquinas(estados);
            setOrdenes(ords);
        } catch (error) {
            console.error('Error loading planeador data:', error);
        } finally {
            setLoading(false);
        }
    }, [weekDates, selectedMaquina]);

    useEffect(() => {
        setWeekDates(getWeekDates(pivotDate));
    }, [pivotDate]);

    useEffect(() => {
        loadData();
        // Polling for real-time status every 10 seconds
        const interval = setInterval(async () => {
            try {
                const estados = await planeacionApi.getEstadoActualMaquinas();
                setEstadoMaquinas(estados);
            } catch (e) { }
        }, 10000);
        return () => clearInterval(interval);
    }, [loadData, pivotDate]);

    const changeWeek = (direction) => {
        const next = new Date(pivotDate);
        next.setDate(next.getDate() + (direction * 7));
        setPivotDate(next);
    };


    const handleSlotClick = (date, hour, existingPlan = null) => {
        setSelectedSlot({ date, hour });
        if (existingPlan) {
            setSelectedPlanId(existingPlan.id);
            setFormData({
                ordenProduccionId: existingPlan.ordenProduccionId.toString(),
                metaTiros: existingPlan.metaTiros.toString(),
                referencia: existingPlan.referencia || '',
                horaInicio: new Date(existingPlan.fechaInicio).getHours(),
                horaFin: new Date(existingPlan.fechaFin).getHours()
            });

        } else {
            setSelectedPlanId(null);
            setFormData({
                ordenProduccionId: '',
                metaTiros: '',
                referencia: '',
                horaInicio: hour,
                horaFin: hour + 2 > 22 ? 22 : hour + 2
            });

        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.ordenProduccionId || !formData.metaTiros) {
            Alert.alert("Campos incompletos", "Por favor seleccione una OP e ingrese la meta.");
            return;
        }

        try {
            const startDate = new Date(selectedSlot.date);
            startDate.setHours(formData.horaInicio, 0, 0, 0);

            const endDate = new Date(selectedSlot.date);
            endDate.setHours(formData.horaFin, 0, 0, 0);

            // Enviar fecha en formato local ISO sin 'Z' para que el servidor la tome como Local
            const formatLocalISO = (d) => {
                const pad = (n) => n.toString().padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`;
            };

            const payload = {
                id: selectedPlanId || 0,
                maquinaId: selectedMaquina,
                ordenProduccionId: parseInt(formData.ordenProduccionId),
                fechaInicio: formatLocalISO(startDate),
                fechaFin: formatLocalISO(endDate),
                metaTiros: parseInt(formData.metaTiros),
                referencia: formData.referencia
            };



            if (selectedPlanId) {
                await planeacionApi.actualizarPlaneacion(selectedPlanId, payload);
            } else {
                await planeacionApi.crearPlaneacion(payload);
            }

            setShowModal(false);
            loadData();
        } catch (error) {
            Alert.alert("Error", error.response?.data || "No se pudo guardar la planeación.");
        }
    };


    const handleDelete = async (planId) => {
        if (!planId) return;

        const performDelete = async () => {
            try {
                await planeacionApi.eliminarPlaneacion(planId);
                setShowModal(false);
                loadData();
            } catch (e) {
                const msg = e.response?.data || e.message;
                if (typeof Alert !== 'undefined' && Alert.alert) {
                    Alert.alert("Error", "No se pudo eliminar: " + msg);
                } else {
                    alert("Error: No se pudo eliminar - " + msg);
                }
            }
        };

        if (typeof Alert !== 'undefined' && Alert.alert &&
            (typeof window === 'undefined' || !window.confirm)) {
            Alert.alert(
                "Eliminar Planeación",
                "¿Está seguro de que desea eliminar este bloque programado?",
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Eliminar", style: "destructive", onPress: performDelete }
                ]
            );
        } else if (typeof window !== 'undefined' && window.confirm) {
            if (window.confirm("¿Está seguro de que desea eliminar este bloque programado?")) {
                performDelete();
            }
        } else {
            // Fallback for environments with neither
            performDelete();
        }
    };



    const renderGrid = () => {
        const filteredPlanes = planeaciones.filter(p => p.maquinaId == selectedMaquina);
        const machineStatus = estadoMaquinas.find(e => e.maquinaId === selectedMaquina);

        return (
            <ScrollView horizontal style={styles.gridContainer}>
                <View>
                    {/* Header: Days */}
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#4A5568' }}>
                        <View style={[styles.hourCell, { backgroundColor: colors.surface }]} />
                        {DAYS.map((day, i) => (
                            <View key={day.key} style={[styles.dayHeader, {
                                backgroundColor: weekDates[i] && weekDates[i].toDateString() === new Date().toDateString() ?
                                    (isDarkMode ? '#2D3748' : '#E2E8F0') : colors.surface
                            }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    {i === 0 && (
                                        <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.navButton}>
                                            <Text style={styles.navButtonText}>◀</Text>
                                        </TouchableOpacity>
                                    )}
                                    <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                                        <Text style={[styles.dayLabel, { color: colors.text }]}>{day.label}</Text>
                                        <Text style={[styles.dateLabel, { color: colors.subText }]}>
                                            {weekDates[i] ? `${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}` : ''}
                                        </Text>
                                    </View>
                                    {i === 6 && (
                                        <TouchableOpacity onPress={() => changeWeek(1)} style={styles.navButton}>
                                            <Text style={styles.navButtonText}>▶</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>


                    {/* Grid Body */}
                    <ScrollView>
                        {HOURS.map(hour => (
                            <View key={hour} style={styles.row}>
                                {/* Hour Label */}
                                <View style={[styles.hourCell, { backgroundColor: colors.surface }]}>
                                    <Text style={[styles.hourText, { color: colors.subText }]}>{hour}:00</Text>
                                </View>

                                {/* Day Slots */}
                                {weekDates.map((date, dayIdx) => {
                                    // Check if there is a plan for this slot
                                    const plan = filteredPlanes.find(p => {
                                        const pStart = new Date(p.fechaInicio);
                                        const pEnd = new Date(p.fechaFin);
                                        const slotDate = new Date(date);
                                        slotDate.setHours(hour, 0, 0, 0);
                                        return slotDate >= pStart && slotDate < pEnd;
                                    });

                                    // Check activity in state
                                    const machineHistory = estadoMaquinas.filter(e =>
                                        (e.maquinaId == selectedMaquina || e.MaquinaId == selectedMaquina)
                                    );

                                    const getSlotColor = (slot) => {
                                        if (!slot) return 'transparent';

                                        // Intentar encontrar coincidencia en produccion real
                                        // Buscamos si hay alguna produccion activa o terminada para esta maquina y OP
                                        const matches = estadoMaquinas.filter(m =>
                                            m.maquinaId == slot.maquinaId &&
                                            (m.ordenProduccionId == slot.ordenProduccionId ||
                                                (m.ordenProduccionNumero && slot.ordenProduccionNumero && m.ordenProduccionNumero == slot.ordenProduccionNumero))
                                        );

                                        if (matches.length > 0) {
                                            // Si hay alguno activo, es rojo (produciendo)
                                            if (matches.some(m => m.esActivo)) {
                                                return '#ef4444'; // Rojo vibrante semantic
                                            }
                                            // Si todos estan terminados, es azul oscuro (completado)
                                            return '#1e3a8a';
                                        }

                                        // Si no hay produccion real pero esta planeado, azul normal
                                        return slot.metaTiros > 1000 ? '#3b82f6' : '#60a5fa';
                                    };

                                    const doesProcessMatchPlan = (e, planObj) => {
                                        if (!planObj) return false;
                                        const Tol = 5 * 60 * 1000; // 5 minutes strict tolerance
                                        const pStart = new Date(planObj.fechaInicio).getTime();
                                        const pEnd = new Date(planObj.fechaFin).getTime();
                                        const execStart = new Date(e.horaInicio).getTime();
                                        const execEnd = e.horaFin ? new Date(e.horaFin).getTime() : new Date().getTime();

                                        const match = (execStart >= pStart - Tol && execStart < pEnd) ||
                                            (execEnd > pStart && execEnd <= pEnd + Tol) ||
                                            (execStart <= pStart && execEnd >= pEnd);

                                        if (match) {
                                            console.log(`[MATH-MATCH] OP ${planObj.ordenProduccionNumero || planObj.ordenProduccion?.numero}: pStart=${new Date(pStart).toISOString()}, pEnd=${new Date(pEnd).toISOString()} | execStart=${new Date(execStart).toISOString()}, execEnd=${new Date(execEnd).toISOString()} => ${match}`);
                                        }
                                        return match;
                                    };


                                    const activeProcess = machineHistory.find(e =>
                                        (e.esActivo || e.EsActivo) &&
                                        (
                                            String(e.ordenProduccionId || e.OrdenProduccionId) == String(plan?.ordenProduccionId) ||
                                            (e.ordenProduccionNumero || e.OrdenProduccionNumero) == plan?.ordenProduccion?.numero
                                        ) && new Date(e.horaInicio).toDateString() === new Date(date).toDateString()
                                        && (!plan || doesProcessMatchPlan(e, plan))
                                    );

                                    const finishedProcess = machineHistory.find(e =>
                                        !(e.esActivo || e.EsActivo) &&
                                        (
                                            String(e.ordenProduccionId || e.OrdenProduccionId) == String(plan?.ordenProduccionId) ||
                                            (e.ordenProduccionNumero || e.OrdenProduccionNumero) == plan?.ordenProduccion?.numero
                                        ) && new Date(e.horaInicio).toDateString() === new Date(date).toDateString()
                                        && (!plan || doesProcessMatchPlan(e, plan))
                                    );

                                    const isActive = !!activeProcess;
                                    const isFinished = !!finishedProcess && !isActive;

                                    // Si ya terminó, verificar si esta hora en particular ya pasó el tiempo de fin real
                                    let slotVisible = !!plan;
                                    if (isFinished && plan) {
                                        const hFin = new Date(finishedProcess.horaFin);
                                        const slotDate = new Date(date);
                                        slotDate.setHours(hour, 0, 0, 0);
                                        // Si la hora del slot es mayor a la hora en que terminó, ocultamos el bloque
                                        if (slotDate.getHours() > hFin.getHours()) {
                                            slotVisible = false;
                                        }
                                    }

                                    let bgColor = 'transparent';
                                    let borderColor = colors.border;
                                    let opacity = 1;

                                    if (slotVisible && plan) {
                                        const opNum = String(plan.ordenProduccionNumero || plan.ordenProduccion?.numero || '');
                                        const defaultPlanColor = getOpColor(opNum);
                                        const baseColor = isActive ? (ACTIVITY_COLORS[activeProcess.actividadCodigo] || ACTIVITY_COLORS.default) :
                                            (isFinished ? '#1E293B' : defaultPlanColor);
                                        bgColor = baseColor + (isActive ? 'CC' : '44'); // Added a bit more opacity (44) for better color pop
                                        borderColor = isActive ? '#FACC15' : (isFinished ? '#4A5568' : baseColor);
                                        opacity = isFinished ? 0.6 : 1;
                                    }


                                    return (
                                        <TouchableOpacity
                                            key={dayIdx}
                                            style={[
                                                styles.slot,
                                                {
                                                    borderColor: borderColor,
                                                    borderWidth: isActive ? 3 : 1,
                                                    backgroundColor: bgColor,
                                                    opacity: opacity
                                                }
                                            ]}
                                            onPress={() => (plan && slotVisible) ? handleSlotClick(date, hour, plan) : handleSlotClick(date, hour)}

                                        >
                                            {plan && slotVisible ? (
                                                <View style={styles.planInfo}>
                                                    <Text style={[styles.planOp, { color: isDarkMode ? '#FFF' : '#000' }]} numberOfLines={1}>
                                                        {isFinished ? '✅ ' : ''}OP: {plan.ordenProduccion?.numero}
                                                    </Text>
                                                    {(!isFinished && !isActive && new Date() > new Date(plan.fechaFin)) && (
                                                        <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: 'bold' }}>VENCIDO</Text>
                                                    )}
                                                    <Text style={[styles.planMeta, { color: isDarkMode ? '#CCC' : '#444' }]}>{plan.metaTiros} t.</Text>
                                                    {plan.referencia ? (
                                                        <Text style={[styles.planRef, { color: isDarkMode ? '#A0AEC0' : '#718096' }]} numberOfLines={1}>
                                                            {plan.referencia}
                                                        </Text>
                                                    ) : null}

                                                </View>
                                            ) : null}

                                            {isActive && (
                                                <View style={styles.activeIndicator}>
                                                    <View style={[styles.pulseDot, { backgroundColor: '#FACC15' }]} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );

                                })}
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>
        );
    };

    const renderSummarySidebar = () => {
        const today = new Date();
        const todayStr = today.toDateString();

        const todayPlanes = planeaciones.filter(p => new Date(p.fechaInicio).toDateString() === todayStr);

        const stats = {
            total: todayPlanes.length,
            enProgreso: 0,
            porArrancar: 0,
            atrasados: 0,
            completados: 0
        };

        todayPlanes.forEach(p => {
            const pStart = new Date(p.fechaInicio);
            const pEnd = new Date(p.fechaFin);

            // Buscar el estado real que MEJOR coincida con este plan
            const realStatusMatches = estadoMaquinas.filter(e =>
                (e.maquinaId == p.maquinaId) &&
                (e.ordenProduccionId == p.ordenProduccionId || e.ordenProduccionNumero == p.ordenProduccion?.numero)
            );
            const realStatus = realStatusMatches.find(e => {
                const Tol = 5 * 60 * 1000;
                const execStart = new Date(e.horaInicio).getTime();
                const execEnd = e.horaFin ? new Date(e.horaFin).getTime() : new Date().getTime();
                return (execStart >= pStart.getTime() - Tol && execStart < pEnd.getTime()) ||
                    (execEnd > pStart.getTime() && execEnd <= pEnd.getTime() + Tol) ||
                    (execStart <= pStart.getTime() && execEnd >= pEnd.getTime());
            });

            if (realStatus?.esActivo) {
                stats.enProgreso++;
            } else if (today < pStart) {
                stats.porArrancar++;
            } else if (realStatus !== undefined && realStatus.esActivo === false) {
                stats.completados++;
            } else {
                stats.atrasados++;
            }
        });

        return (
            <View style={[styles.sidebar, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB', borderLeftColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <Text style={[styles.sidebarTitle, { color: colors.text, marginBottom: 0 }]}>Hoy</Text>
                    <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>{stats.total} Total</Text>
                    </View>
                </View>

                {/* Resumen rápido de estados */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 }}>
                    <View style={{ backgroundColor: '#1C1917', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#44403C' }}>
                        <Text style={{ color: '#22C55E', fontSize: 10, fontWeight: 'bold' }}>{stats.enProgreso} On</Text>
                    </View>
                    <View style={{ backgroundColor: '#1C1917', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#44403C' }}>
                        <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: 'bold' }}>{stats.atrasados} At</Text>
                    </View>
                </View>


                <ScrollView showsVerticalScrollIndicator={false}>
                    {todayPlanes.length === 0 ? (
                        <Text style={{ color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>No hay planeación para hoy</Text>
                    ) : (
                        todayPlanes.sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio)).map((p, idx) => {
                            const maquina = maquinas.find(m => m.id === p.maquinaId);
                            const pStart = new Date(p.fechaInicio);
                            const realStatusMatches = estadoMaquinas.filter(e =>
                                (e.maquinaId == p.maquinaId) &&
                                (e.ordenProduccionId == p.ordenProduccionId || e.ordenProduccionNumero == p.ordenProduccion?.numero)
                            );
                            const realStatus = realStatusMatches.find(e => {
                                const Tol = 5 * 60 * 1000;
                                const execStart = new Date(e.horaInicio).getTime();
                                const execEnd = e.horaFin ? new Date(e.horaFin).getTime() : new Date().getTime();
                                return (execStart >= pStart.getTime() - Tol && execStart < new Date(p.fechaFin).getTime()) ||
                                    (execEnd > pStart.getTime() && execEnd <= new Date(p.fechaFin).getTime() + Tol) ||
                                    (execStart <= pStart.getTime() && execEnd >= new Date(p.fechaFin).getTime());
                            });

                            let statusLabel = "Pendiente";
                            let statusColor = "#94A3B8";
                            if (realStatus?.esActivo) {
                                statusLabel = "Produciendo";
                                statusColor = "#22C55E";
                            } else if (realStatus !== undefined && realStatus.esActivo === false) {
                                statusLabel = "Terminado";
                                statusColor = "#10B981";
                            } else if (new Date() > new Date(p.fechaFin)) {
                                statusLabel = "Vencido";
                                statusColor = "#EF4444";
                            } else if (new Date() > pStart) {
                                statusLabel = "Atrasado";
                                statusColor = "#F59E0B";
                            }

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.statCard, { borderLeftWidth: 4, borderLeftColor: statusColor, padding: 12 }]}
                                    onPress={() => {
                                        if (maquina) setSelectedMaquina(maquina.id);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>
                                                OP: {p.ordenProduccionNumero || p.ordenProduccion?.numero || 'S/N'}
                                            </Text>
                                        </View>
                                        <View style={{ backgroundColor: statusColor + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ color: statusColor, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }}>
                                                {statusLabel}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
                                        {maquina?.nombre || 'Máquina desconocida'}
                                    </Text>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                                        <Text style={{ color: '#6B7280', fontSize: 10 }}>
                                            {pStart.getHours()}:00 - {new Date(p.fechaFin).getHours()}:00
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => handleDelete(p.id)}
                                            style={{ padding: 4 }}
                                        >
                                            <Text style={{ fontSize: 16 }}>🗑️</Text>
                                        </TouchableOpacity>
                                        {realStatus?.esActivo && <View style={styles.livePulse} />}
                                    </View>

                                    {p.referencia ? (
                                        <Text style={{ color: '#4566F6', fontSize: 9, fontStyle: 'italic', marginTop: 5 }}>
                                            Ref: {p.referencia}
                                        </Text>
                                    ) : null}
                                </TouchableOpacity>
                            );

                        })
                    )}
                </ScrollView>

                {estadoMaquinas.some(e => e.esActivo) && (
                    <View style={styles.activeListContainer}>
                        <Text style={styles.activeListTitle}>Sistemas en Línea:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {estadoMaquinas.filter(e => e.esActivo).map((e, idx) => (
                                <View key={idx} style={[styles.activeMachineItem, { marginRight: 15 }]}>
                                    <View style={styles.pulseDotSmall} />
                                    <Text style={styles.activeMachineText}>{e.maquinaNombre || 'Máquina'}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>
        );

    };

    if (loading && maquinas.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border, justifyContent: 'flex-end', height: 75, zIndex: 100 }]}>
                <View style={{ width: 300 }}>
                    <CustomDropdown
                        label=""
                        placeholder="Seleccionar máquina..."
                        items={maquinas}
                        selectedValue={selectedMaquina}
                        onValueChange={setSelectedMaquina}
                    />
                </View>
            </View>

            <View style={{ flex: 1, flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                    {renderGrid()}
                </View>
                {renderSummarySidebar()}
            </View>

            {/* Modal para Crear Planeación */}
            <Modal visible={showModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Programar Actividad</Text>

                        <View style={{ zIndex: 2000, elevation: 10 }}>
                            <CustomDropdown
                                label="Orden de Producción:"
                                placeholder="Buscar OP..."
                                items={ordenes}
                                isSearchable={true}
                                selectedValue={formData.ordenProduccionId}
                                onValueChange={(v) => setFormData(p => ({ ...p, ordenProduccionId: v }))}
                            />
                        </View>



                        <Text style={styles.label}>Meta de Tiros:</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 5000"
                            placeholderTextColor="#718096"
                            keyboardType="numeric"
                            value={(formData.metaTiros || '').toString()}
                            onChangeText={(v) => setFormData(p => ({ ...p, metaTiros: v }))}
                        />

                        <Text style={styles.label}>Referencia (Texto):</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Cliente / Comentario"
                            placeholderTextColor="#718096"
                            value={formData.referencia}
                            onChangeText={(v) => setFormData(p => ({ ...p, referencia: v }))}
                        />



                        <View style={[styles.rowModal, { zIndex: 1000, elevation: 5 }]}>

                            <View style={{ flex: 1, marginRight: 10 }}>
                                <CustomDropdown
                                    label="Hora Inicio"
                                    items={HOURS.map(h => ({ id: h, nombre: `${h}:00` }))}
                                    selectedValue={formData.horaInicio}
                                    onValueChange={(v) => setFormData(p => ({ ...p, horaInicio: v }))}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <CustomDropdown
                                    label="Hora Fin"
                                    items={[...HOURS.map(h => ({ id: h, nombre: `${h}:00` })), { id: 23, nombre: '23:00' }]}
                                    selectedValue={formData.horaFin}
                                    onValueChange={(v) => setFormData(p => ({ ...p, horaFin: v }))}
                                />
                            </View>
                        </View>



                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: '#4F46E5' }]} // Indigo
                                onPress={handleSave}
                            >
                                <Text style={styles.modalButtonText}>Guardar</Text>
                            </TouchableOpacity>

                            {selectedPlanId && (
                                <TouchableOpacity
                                    style={[styles.modalButton, { backgroundColor: '#DC2626' }]} // Red-600
                                    onPress={() => handleDelete(selectedPlanId)}

                                >
                                    <Text style={styles.modalButtonText}>Eliminar</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: isDarkMode ? '#4A5568' : '#CBD5E0' }]}
                                onPress={() => setShowModal(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    machineSelector: { flexDirection: 'row', alignItems: 'center' },
    pickerContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
        justifyContent: 'center',
        paddingLeft: 5
    },

    gridContainer: { flex: 1 },
    row: { flexDirection: 'row' },
    dayHeader: {
        width: 140,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#4A5568' // Mas visible en fondo oscuro
    },

    dayLabel: { fontWeight: 'bold', fontSize: 16 },
    dateLabel: { fontSize: 12 },
    hourCell: {
        width: 80,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderBottomWidth: 2, // Resaltar linea de hora
        borderColor: '#4A5568'
    },

    hourText: { fontSize: 14, fontWeight: '500' },
    slot: {
        width: 140,
        height: 60,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#4A5568',
        padding: 5
    },

    planInfo: { flex: 1 },
    planOp: { fontSize: 11, fontWeight: 'bold', color: '#000' },
    planMeta: { fontSize: 10, color: '#444' },
    planRef: { fontSize: 9, fontStyle: 'italic', marginTop: 2 },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        width: 500,
        padding: 30,
        borderRadius: 20,
        backgroundColor: '#1A202C', // Solid deep background
        borderWidth: 1,
        borderColor: '#2D3748',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15
    },

    modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20, color: '#FFF', letterSpacing: 0.5 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 15, color: '#CBD5E0' },
    input: {
        height: 50,
        backgroundColor: '#2D3748',
        borderWidth: 1,
        borderColor: '#4A5568',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#FFF'
    },

    rowModal: { flexDirection: 'row', marginTop: 10 },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 35,
        gap: 12
    },
    modalButton: {
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 10,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3
    },
    modalButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.5
    },

    activeIndicator: {
        position: 'absolute',
        top: 5,
        right: 5
    },

    // New Styles for Sidebar and Navigation
    gridContainer: { flex: 1 },
    navButton: { padding: 8, backgroundColor: '#4F46E5', borderRadius: 8, marginHorizontal: 2 },
    navButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

    sidebar: {
        width: 280,
        padding: 20,
        borderLeftWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 5
    },
    sidebarTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20, letterSpacing: 0.5 },
    statCard: {
        backgroundColor: '#1F2937',
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#374151',
        position: 'relative',
        overflow: 'hidden'
    },
    statValue: { fontSize: 24, fontWeight: '900' },
    statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },
    livePulse: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E' // Bright green for live
    },
    activeListContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#374151' },
    activeListTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 10 },
    activeMachineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    activeMachineText: { color: '#E5E7EB', fontSize: 13, marginLeft: 8 },
    pulseDotSmall: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FACC15', // Yellow for "Produciendo"
        elevation: 3,
        shadowColor: '#FACC15',
        shadowRadius: 3,
        shadowOpacity: 0.5
    },
    pulseDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FACC15',
        borderWidth: 2,
        borderColor: '#000',
        elevation: 5,
        shadowColor: '#FACC15',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5
    }

});

