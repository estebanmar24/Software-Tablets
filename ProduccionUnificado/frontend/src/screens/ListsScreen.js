import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { getUsuarios, createUsuario } from '../services/productionApi';
// CustomNavBar removed - navigation handled by AdminDashboard

export default function ListsScreen({ navigation }) {
    const [usuarios, setUsuarios] = useState([]);
    const [newUsuario, setNewUsuario] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadUsuarios();
    }, []);

    const loadUsuarios = async () => {
        setLoading(true);
        try {
            const res = await getUsuarios();
            setUsuarios(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUsuario = async () => {
        if (!newUsuario.trim()) return;
        try {
            await createUsuario({ nombre: newUsuario, estado: true });
            setNewUsuario('');
            loadUsuarios();
            Alert.alert("Éxito", "Operario agregado");
        } catch (error) {
            Alert.alert("Error", "No se pudo agregar");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Gestión de Listas - Operarios</Text>

            {/* Top Navigation */}
            {/* Top Navigation */}


            <View style={styles.addBox}>
                <TextInput
                    style={styles.input}
                    value={newUsuario}
                    onChangeText={setNewUsuario}
                    placeholder="Nuevo Operario"
                />
                <Button title="Agregar" onPress={handleAddUsuario} />
            </View>

            <Text style={styles.subHeader}>Operarios Activos:</Text>
            <FlatList
                data={usuarios}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.item}>
                        <Text style={styles.itemText}>{item.nombre}</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    subHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    addBox: { flexDirection: 'row', gap: 10 },
    input: { flex: 1, borderBottomWidth: 1, padding: 5 },
    item: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
    itemText: { fontSize: 16 }
});
