import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Button, StyleSheet, Alert } from 'react-native';
// import { Picker } from '@react-native-picker/picker'; // Instalar si se requiere
import api from '../services/productionApi';

export default function DailyCaptureScreen() {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [operarioId, setOperarioId] = useState('1'); // Mock ID
    const [maquinaId, setMaquinaId] = useState('1'); // Mock ID

    // Tiempos
    const [horaInicio, setHoraInicio] = useState('06:00');
    const [horaFin, setHoraFin] = useState('14:00');

    // Producción
    const [tirosDiarios, setTirosDiarios] = useState('');
    const [cambios, setCambios] = useState('0');
    const [tiempoPuestaPunto, setTiempoPuestaPunto] = useState('0');

    // Auxiliares
    const [horasMantenimiento, setHorasMantenimiento] = useState('0');
    const [horasDescanso, setHorasDescanso] = useState('0');

    // Cálculos
    const [totalHoras, setTotalHoras] = useState(0);

    const calcular = () => {
        // Lógica simple de horas (no exacta con AM/PM, asume 24h formato simple para demo)
        const start = parseInt(horaInicio.split(':')[0]);
        const end = parseInt(horaFin.split(':')[0]);
        let diff = end - start;
        if (diff < 0) diff += 24;
        setTotalHoras(diff);
    };

    useEffect(() => {
        calcular();
    }, [horaInicio, horaFin]);

    const handleGuardar = async () => {
        try {
            const payload = {
                Fecha: fecha,
                UsuarioId: parseInt(operarioId),
                MaquinaId: parseInt(maquinaId),
                HoraInicio: horaInicio + ":00",
                HoraFin: horaFin + ":00",
                TirosDiarios: parseInt(tirosDiarios) || 0,
                Cambios: parseInt(cambios) || 0,
                TiempoPuestaPunto: parseFloat(tiempoPuestaPunto) || 0,
                HorasMantenimiento: parseFloat(horasMantenimiento) || 0,
                HorasDescanso: parseFloat(horasDescanso) || 0,
                HorasOperativas: totalHoras,
                // Otros campos calculados irían aquí o en backend
            };

            const response = await api.post('/produccion', payload);
            if (response.status === 200) {
                Alert.alert("Éxito", "Producción registrada correctamente");
                setTirosDiarios('');
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudo guardar la producción");
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Captura Diaria</Text>

            <View style={styles.group}>
                <Text>Fecha (YYYY-MM-DD):</Text>
                <TextInput style={styles.input} value={fecha} onChangeText={setFecha} />
            </View>

            <View style={styles.group}>
                <Text>Operario ID:</Text>
                <TextInput style={styles.input} value={operarioId} onChangeText={setOperarioId} keyboardType="numeric" />
            </View>

            <View style={styles.group}>
                <Text>Máquina ID:</Text>
                <TextInput style={styles.input} value={maquinaId} onChangeText={setMaquinaId} keyboardType="numeric" />
            </View>

            <View style={styles.row}>
                <View style={styles.half}>
                    <Text>Hora Inicio:</Text>
                    <TextInput style={styles.input} value={horaInicio} onChangeText={setHoraInicio} />
                </View>
                <View style={styles.half}>
                    <Text>Hora Fin:</Text>
                    <TextInput style={styles.input} value={horaFin} onChangeText={setHoraFin} />
                </View>
            </View>

            <View style={styles.group}>
                <Text>Tiros Diarios:</Text>
                <TextInput
                    style={styles.input}
                    value={tirosDiarios}
                    onChangeText={setTirosDiarios}
                    keyboardType="numeric"
                    placeholder="Ej. 5000"
                />
            </View>

            <Text style={styles.result}>Total Horas Calc: {totalHoras}</Text>

            <Button title="Guardar Producción" onPress={handleGuardar} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    group: { marginBottom: 15 },
    input: { borderBottomWidth: 1, padding: 5, fontSize: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    half: { width: '48%' },
    result: { fontSize: 18, marginTop: 10, marginBottom: 20, color: 'blue' }
});
