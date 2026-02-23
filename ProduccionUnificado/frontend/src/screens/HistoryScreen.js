import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Image, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { api, API_URL } from '../services/productionApi';
// CustomNavBar removed - navigation handled by AdminDashboard
import { useTheme } from '../contexts/ThemeContext';

const HistoryScreen = ({ navigation }) => {
    const { colors } = useTheme();

    // Helper to format date as YYYY-MM-DD
    const toDateStr = (d) => {
        const yyyy = d.getFullYear();
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // State for filters — default to today
    const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));

    const [maquinas, setMaquinas] = useState([]);
    const [operarios, setOperarios] = useState([]);
    const [selectedMaquina, setSelectedMaquina] = useState('');
    const [selectedOperario, setSelectedOperario] = useState('');

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load Lists on Mount
    useEffect(() => {
        loadLists();
    }, []);

    const loadLists = async () => {
        try {
            const maquinasRes = await api.get(`maquinas`);
            setMaquinas(maquinasRes.data);
            const usuariosRes = await api.get(`usuarios`);
            setOperarios(usuariosRes.data.filter(u => u.estado));
        } catch (error) {
            console.error("Error loading lists", error);
        }
    };

    // Polling for auto-refresh
    useEffect(() => {
        handleSearch();
        const interval = setInterval(() => {
            handleSearch(true);
        }, 4000);
        return () => clearInterval(interval);
    }, [selectedDate, selectedMaquina, selectedOperario]);

    const handleSearch = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = {
                fechaInicio: selectedDate,
                fechaFin: selectedDate,
                usuarioId: selectedOperario || null,
                maquinaId: selectedMaquina || null
            };
            const response = await api.get(`tiempoproceso/historial`, { params });
            setResults(response.data);
        } catch (error) {
            console.error("Search error", error);
            if (!silent) {
                if (Platform.OS === 'web') alert('Error al buscar datos.');
                else Alert.alert('Error', 'Error al buscar datos.');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Day navigation helpers
    const changeDay = (offset) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setSelectedDate(toDateStr(d));
    };
    const goToToday = () => setSelectedDate(toDateStr(new Date()));
    const isToday = selectedDate === toDateStr(new Date());

    // Format display date
    const displayDate = (() => {
        const d = new Date(selectedDate + 'T12:00:00');
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
    })();

    // Helpers
    const parseDuration = (str) => {
        if (!str) return 0;
        const parts = str.split(':');
        if (parts.length !== 3) return 0;
        return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    };

    const formatSeconds = (sec) => {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const logoSource = colors.alephLogo;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Logo */}
            <View style={styles.headerContainer}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                <Text style={[styles.header, { color: colors.text }]}>Explorador de Producción</Text>
            </View>

            {/* Filters Section */}
            <View style={[styles.filtersContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>

                {/* Day Navigation Row */}
                <View style={styles.dayNavRow}>
                    <TouchableOpacity style={styles.dayNavButton} onPress={() => changeDay(-1)}>
                        <Text style={styles.dayNavButtonText}>◀ Día Anterior</Text>
                    </TouchableOpacity>

                    <View style={styles.dayNavCenter}>
                        <Text style={[styles.dayNavDate, { color: colors.text }]}>{displayDate}</Text>
                        {Platform.OS === 'web' && (
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: `1px solid ${colors.border}`,
                                    backgroundColor: colors.inputBackground,
                                    color: colors.text,
                                    fontSize: 13,
                                    marginTop: 4,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                }}
                            />
                        )}
                        {Platform.OS !== 'web' && (
                            <TextInput
                                style={[styles.dateInput, { borderColor: colors.border, color: colors.text }]}
                                value={selectedDate}
                                onChangeText={setSelectedDate}
                                placeholder="YYYY-MM-DD"
                            />
                        )}
                    </View>

                    <TouchableOpacity style={styles.dayNavButton} onPress={() => changeDay(1)}>
                        <Text style={styles.dayNavButtonText}>Día Siguiente ▶</Text>
                    </TouchableOpacity>
                </View>

                {/* Today button */}
                {!isToday && (
                    <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
                        <Text style={styles.todayButtonText}>📅 Ir a Hoy</Text>
                    </TouchableOpacity>
                )}

                {/* Entity Filters Row */}
                <View style={styles.filterRow}>
                    <View style={[styles.filterGroup, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.text }]}>Máquina:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Picker selectedValue={selectedMaquina} onValueChange={(v) => setSelectedMaquina(v)} style={[styles.picker, { color: colors.text }]}>
                                <Picker.Item label="Todas las Máquinas" value="" />
                                {maquinas.map(m => <Picker.Item key={m.id} label={m.nombre} value={m.id} />)}
                            </Picker>
                        </View>
                    </View>
                    <View style={[styles.filterGroup, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.text }]}>Operario:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Picker selectedValue={selectedOperario} onValueChange={(v) => setSelectedOperario(v)} style={[styles.picker, { color: colors.text }]}>
                                <Picker.Item label="Todos los Operarios" value="" />
                                {operarios.map(u => <Picker.Item key={u.id} label={u.nombre} value={u.id} />)}
                            </Picker>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={styles.searchButton} onPress={() => handleSearch(false)} disabled={loading}>
                    <Text style={styles.searchButtonText}>{loading ? 'Buscando...' : '🔍 Actualizar Ahora'}</Text>
                </TouchableOpacity>
                <Text style={{ textAlign: 'center', fontSize: 10, color: '#888', marginTop: 5 }}>Actualización en tiempo real (4s)</Text>
            </View>

            {/* Results Table */}
            <View style={styles.resultsContainer}>
                <Text style={[styles.resultsCount, { color: colors.subText }]}>Resultados: {results.length} registros</Text>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.columnHeader, { flex: 0.7 }]}>Fecha</Text>
                    <Text style={[styles.columnHeader, { flex: 1 }]}>Operario</Text>
                    <Text style={[styles.columnHeader, { flex: 1 }]}>Máquina</Text>
                    <Text style={[styles.columnHeader, { flex: 0.6 }]}>OP</Text>
                    <Text style={[styles.columnHeader, { flex: 0.9 }]}>Actividad</Text>
                    <Text style={[styles.columnHeader, { flex: 0.7, textAlign: 'center' }]}>Inicio</Text>
                    <Text style={[styles.columnHeader, { flex: 0.7, textAlign: 'center' }]}>Fin</Text>
                    <Text style={[styles.columnHeader, { flex: 0.7, textAlign: 'right' }]}>Tiempo</Text>
                    <Text style={[styles.columnHeader, { flex: 0.6, textAlign: 'right' }]}>Tiros</Text>
                    <Text style={[styles.columnHeader, { flex: 0.5, textAlign: 'right' }]}>Desp</Text>
                    <Text style={[styles.columnHeader, { flex: 0.6, textAlign: 'right' }]}>Pago</Text>
                </View>

                {/* Rows */}
                {results.map((item, index) => {
                    const isActive = (item.horaInicio && item.horaFin && item.horaInicio.trim() === item.horaFin.trim());
                    return (
                        <View key={index} style={[styles.tableRow, { backgroundColor: isActive ? '#e3f2fd' : (index % 2 === 0 ? colors.rowEven : colors.rowOdd) }]}>
                            <Text style={[styles.cell, { flex: 0.7, color: colors.text }]}>{new Date(item.fecha).toLocaleDateString()}</Text>
                            <Text style={[styles.cell, { flex: 1, color: colors.text }]}>{item.usuarioNombre}</Text>
                            <Text style={[styles.cell, { flex: 1, color: colors.text }]}>{item.maquinaNombre}</Text>
                            <Text style={[styles.cell, { flex: 0.6, color: colors.text, fontSize: 10 }]}>{item.ordenProduccionNumero}</Text>
                            <Text style={[styles.cell, { flex: 0.9, fontWeight: 'bold', color: '#0275d8' }]}>{item.actividadNombre}</Text>
                            <Text style={[styles.cell, { flex: 0.7, textAlign: 'center', color: colors.text }]}>{item.horaInicio}</Text>
                            <Text style={[styles.cell, { flex: 0.7, textAlign: 'center', color: isActive ? '#0275d8' : colors.text, fontWeight: isActive ? 'bold' : 'normal' }]}>
                                {isActive ? '---' : item.horaFin}
                            </Text>
                            <Text style={[styles.cell, { flex: 0.7, textAlign: 'right', fontWeight: 'bold', color: isActive ? '#0275d8' : colors.text }]}>
                                {isActive ? 'En Progreso' : item.duracion}
                            </Text>
                            <Text style={[styles.cell, { flex: 0.6, textAlign: 'right', color: colors.text }]}>{item.tiros > 0 ? item.tiros : '-'}</Text>
                            <Text style={[styles.cell, { flex: 0.5, textAlign: 'right', color: '#d9534f' }]}>{item.desperdicio > 0 ? item.desperdicio : '-'}</Text>
                            <Text style={[styles.cell, { flex: 0.6, textAlign: 'right', fontWeight: 'bold', color: '#28a745' }]}>
                                {'-'}
                            </Text>
                        </View>
                    );
                })}

                {results.length > 0 && (
                    <View style={[styles.totalsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.totalCell, { flex: 5.6, color: colors.text }]}>TOTALES</Text>
                        <Text style={[styles.totalCell, { flex: 0.7, textAlign: 'right', color: colors.text }]}>
                            {formatSeconds(results.reduce((sum, item) => sum + parseDuration(item.duracion), 0))}
                        </Text>
                        <Text style={[styles.totalCell, { flex: 0.6, textAlign: 'right', color: colors.text }]}>
                            {results.reduce((sum, item) => sum + (item.tiros || 0), 0)}
                        </Text>
                        <Text style={[styles.totalCell, { flex: 0.5, textAlign: 'right', color: colors.text }]}>
                            {results.reduce((sum, item) => sum + (item.desperdicio || 0), 0)}
                        </Text>
                        <Text style={[styles.totalCell, { flex: 0.6, textAlign: 'right', color: colors.text }]}>
                            {'-'}
                        </Text>
                    </View>
                )}
            </View>

            <View style={{ height: 50 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#2c3e50',
    },
    headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' },
    logo: { width: 50, height: 50, marginRight: 15 },
    // Filter Styles
    filtersContainer: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
        marginBottom: 20,
    },
    // Day nav styles
    dayNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 10,
    },
    dayNavButton: {
        backgroundColor: '#6c757d',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    dayNavButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    dayNavCenter: {
        flex: 1,
        alignItems: 'center',
    },
    dayNavDate: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    dateInput: {
        borderWidth: 1,
        borderRadius: 6,
        padding: 6,
        marginTop: 4,
        textAlign: 'center',
        fontSize: 13,
        width: 150,
    },
    todayButton: {
        backgroundColor: '#007bff',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignSelf: 'center',
        marginBottom: 12,
    },
    todayButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 15,
        flexWrap: 'wrap',
    },
    filterGroup: {
        flexDirection: 'column',
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#6c757d',
    },
    searchButton: {
        backgroundColor: '#007bff',
        padding: 12,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 5,
    },
    searchButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    // Table Styles
    resultsContainer: {
        marginBottom: 20,
    },
    resultsCount: {
        marginBottom: 10,
        fontStyle: 'italic',
        color: '#6c757d'
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#343a40',
        padding: 10,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
    },
    columnHeader: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    tableRow: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#dee2e6',
    },
    cell: {
        fontSize: 12,
        color: '#212529',
    },
    totalsRow: {
        flexDirection: 'row',
        backgroundColor: '#e9ecef',
        padding: 10,
        borderTopWidth: 2,
        borderColor: '#dee2e6'
    },
    totalCell: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#212529'
    },
    pickerContainer: {
        borderRadius: 4,
        borderColor: '#ced4da',
        borderWidth: 1,
        backgroundColor: 'white',
        height: 35,
        justifyContent: 'center'
    },
    picker: {
        width: '100%',
        height: 35
    }
});

export default HistoryScreen;
