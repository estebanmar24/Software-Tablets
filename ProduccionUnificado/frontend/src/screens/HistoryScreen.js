import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { API_URL } from '../services/productionApi';
// CustomNavBar removed - navigation handled by AdminDashboard
import { useTheme } from '../contexts/ThemeContext';

const HistoryScreen = ({ navigation }) => { // Recibimos navigation prop
    const { colors } = useTheme();
    // State for filters
    const [mesInicio, setMesInicio] = useState(new Date().getMonth() + 1);
    const [anioInicio, setAnioInicio] = useState(new Date().getFullYear());
    const [mesFin, setMesFin] = useState(new Date().getMonth() + 1);
    const [anioFin, setAnioFin] = useState(new Date().getFullYear());

    const [maquinas, setMaquinas] = useState([]);
    const [operarios, setOperarios] = useState([]);
    const [selectedMaquina, setSelectedMaquina] = useState(''); // Empty = All
    const [selectedOperario, setSelectedOperario] = useState(''); // Empty = All

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load Lists on Mount
    useEffect(() => {
        loadLists();
    }, []);

    const loadLists = async () => {
        try {
            const maquinasRes = await axios.get(`${API_URL}/maquinas`);
            setMaquinas(maquinasRes.data);
            const usuariosRes = await axios.get(`${API_URL}/usuarios`);
            setOperarios(usuariosRes.data.filter(u => u.estado));
        } catch (error) {
            console.error("Error loading lists", error);
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Construct params
            // Start Date: 1st of mesInicio
            const fechaInicio = `${anioInicio}-${mesInicio.toString().padStart(2, '0')}-01`;

            // End Date: Last day of mesFin
            // Trick: parameters to new Date(year, month, 0) gives last day of previous month. 
            // So new Date(anioFin, mesFin, 0) gives last day of mesFin.
            const lastDay = new Date(anioFin, mesFin, 0).getDate();
            const fechaFin = `${anioFin}-${mesFin.toString().padStart(2, '0')}-${lastDay}`;

            const params = {
                fechaInicio,
                fechaFin,
                usuarioId: selectedOperario || null,
                maquinaId: selectedMaquina || null
            };

            const response = await axios.get(`${API_URL}/produccion/historial`, { params });
            setResults(response.data);

            if (response.data.length === 0) {
                if (Platform.OS === 'web') alert('No se encontraron registros con estos filtros.');
                else Alert.alert('Sin resultados', 'No se encontraron registros con estos filtros.');
            }

        } catch (error) {
            console.error("Search error", error);
            if (Platform.OS === 'web') alert('Error al buscar datos.');
            else Alert.alert('Error', 'Error al buscar datos.');
        } finally {
            setLoading(false);
        }
    };

    // Helpers
    const getMesNombre = (mes) => {
        const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return meses[mes] || '';
    };

    const formatCurrency = (val) => {
        return `$${(val || 0).toFixed(0)}`;
    };

    const logoSource = require('../../assets/LOGO_ALEPH_IMPRESORES.jpg');

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Logo */}
            <View style={styles.headerContainer}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                <Text style={[styles.header, { color: colors.text }]}>Explorador de Producción</Text>
            </View>

            {/* Top Navigation Bar - Consistent with other screens */}
            {/* Top Navigation Bar - Consistent with other screens */}


            {/* Filters Section */}
            <View style={[styles.filtersContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Filtros de Búsqueda</Text>

                {/* Date Range Row */}
                <View style={styles.filterRow}>
                    <View style={styles.filterGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Desde:</Text>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                            <View style={[styles.pickerContainer, { minWidth: 100 }]}>
                                <Picker selectedValue={mesInicio} onValueChange={(v) => setMesInicio(parseInt(v))} style={styles.picker}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <Picker.Item key={m} label={getMesNombre(m)} value={m} />)}
                                </Picker>
                            </View>
                            <View style={[styles.pickerContainer, { minWidth: 80 }]}>
                                <Picker selectedValue={anioInicio} onValueChange={(v) => setAnioInicio(parseInt(v))} style={styles.picker}>
                                    {[2024, 2025, 2026].map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                                </Picker>
                            </View>
                        </View>
                    </View>

                    <View style={styles.filterGroup}>
                        <Text style={[styles.label, { color: colors.text }]}>Hasta:</Text>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                            <View style={[styles.pickerContainer, { minWidth: 100 }]}>
                                <Picker selectedValue={mesFin} onValueChange={(v) => setMesFin(parseInt(v))} style={styles.picker}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <Picker.Item key={m} label={getMesNombre(m)} value={m} />)}
                                </Picker>
                            </View>
                            <View style={[styles.pickerContainer, { minWidth: 80 }]}>
                                <Picker selectedValue={anioFin} onValueChange={(v) => setAnioFin(parseInt(v))} style={styles.picker}>
                                    {[2024, 2025, 2026].map(a => <Picker.Item key={a} label={a.toString()} value={a} />)}
                                </Picker>
                            </View>
                        </View>
                    </View>
                </View>

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

                <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
                    <Text style={styles.searchButtonText}>{loading ? 'Buscando...' : '🔍 Buscar Registros'}</Text>
                </TouchableOpacity>
            </View>

            {/* Results Table */}
            <View style={styles.resultsContainer}>
                <Text style={[styles.resultsCount, { color: colors.subText }]}>Resultados: {results.length} registros</Text>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.columnHeader, { flex: 0.8 }]}>Fecha</Text>
                    <Text style={[styles.columnHeader, { flex: 1.2 }]}>Operario</Text>
                    <Text style={[styles.columnHeader, { flex: 1.2 }]}>Máquina</Text>
                    <Text style={[styles.columnHeader, { flex: 0.8, textAlign: 'right' }]}>Tiros</Text>
                    <Text style={[styles.columnHeader, { flex: 0.8, textAlign: 'right' }]}>Horas</Text>
                    <Text style={[styles.columnHeader, { flex: 0.8, textAlign: 'right' }]}>Pago</Text>
                </View>

                {/* Rows */}
                {results.map((item, index) => (
                    <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.rowEven : colors.rowOdd }]}>
                        <Text style={[styles.cell, { flex: 0.8, color: colors.text }]}>{new Date(item.fecha).toLocaleDateString()}</Text>
                        <Text style={[styles.cell, { flex: 1.2, color: colors.text }]}>{item.usuario?.nombre}</Text>
                        <Text style={[styles.cell, { flex: 1.2, color: colors.text }]}>{item.maquina?.nombre}</Text>
                        <Text style={[styles.cell, { flex: 0.8, textAlign: 'right', color: colors.text }]}>{item.tirosDiarios}</Text>
                        <Text style={[styles.cell, { flex: 0.8, textAlign: 'right', color: colors.text }]}>{item.totalHorasProductivas?.toFixed(2)}</Text>
                        <Text style={[styles.cell, { flex: 0.8, textAlign: 'right', fontWeight: 'bold', color: colors.text }]}>{formatCurrency(item.valorAPagar)}</Text>
                    </View>
                ))}

                {results.length > 0 && (
                    <View style={[styles.totalsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.totalCell, { flex: 3.2, color: colors.text }]}>TOTALES</Text>
                        <Text style={[styles.totalCell, { flex: 0.8, textAlign: 'right', color: colors.text }]}>
                            {results.reduce((sum, item) => sum + item.tirosDiarios, 0)}
                        </Text>
                        <Text style={[styles.totalCell, { flex: 0.8, textAlign: 'right', color: colors.text }]}>
                            {results.reduce((sum, item) => sum + (item.totalHorasProductivas || 0), 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.totalCell, { flex: 0.8, textAlign: 'right', color: colors.text }]}>
                            {formatCurrency(results.reduce((sum, item) => sum + (item.valorAPagar || 0), 0))}
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
    // Navigation Styles (Shared)
    navBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 10,
        marginBottom: 20,
        backgroundColor: '#f5f5f5',
        borderBottomWidth: 1,
        borderColor: '#ddd',
        flexWrap: 'wrap' // Allow wrapping on small screens
    },
    navButton: {
        padding: 8,
        backgroundColor: 'white',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ccc',
        minWidth: 100,
        alignItems: 'center'
    },
    activeNavButton: {
        backgroundColor: '#e8f0fe',
        borderColor: '#2196f3',
    },
    navButtonText: {
        color: '#333',
        fontSize: 12
    },
    activeNavButtonText: {
        color: '#1565c0',
        fontWeight: 'bold',
    },
    // Filter Styles
    filtersContainer: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#495057',
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
    select: {
        padding: 8,
        borderRadius: 4,
        borderColor: '#ced4da',
        borderWidth: 1,
        backgroundColor: 'white',
        minWidth: 200,
        height: 35
    },
    selectSmall: {
        padding: 8,
        borderRadius: 4,
        borderColor: '#ced4da',
        borderWidth: 1,
        backgroundColor: 'white',
        minWidth: 80,
        height: 35
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
    evenRow: {
        backgroundColor: 'white',
    },
    oddRow: {
        backgroundColor: '#f8f9fa',
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
