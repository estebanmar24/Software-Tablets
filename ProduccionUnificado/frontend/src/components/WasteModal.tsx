import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Necesita ser instalado o usar el de react-native si es version vieja, pero expo usa este.
import { CodigoDesperdicio } from '../types';

interface WasteModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (codigoId: number, cantidad: number) => void;
    codigos: CodigoDesperdicio[];
}

export function WasteModal({ visible, onClose, onAdd, codigos }: WasteModalProps) {
    const [selectedCodigo, setSelectedCodigo] = useState<number | null>(null);
    const [cantidad, setCantidad] = useState('');

    useEffect(() => {
        if (visible) {
            setCantidad(''); // Reset al abrir
            if (codigos.length > 0 && !selectedCodigo) {
                setSelectedCodigo(codigos[0].id);
            }
        }
    }, [visible, codigos]);

    const handleAdd = () => {
        if (!selectedCodigo) {
            Alert.alert('Error', 'Debe seleccionar un código de desperdicio');
            return;
        }

        const qty = parseFloat(cantidad);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Error', 'Debe ingresar una cantidad válida mayor a 0');
            return;
        }

        onAdd(selectedCodigo, qty);
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Agregar Desperdicio</Text>

                    <Text style={styles.label}>Motivo / Código:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedCodigo}
                            onValueChange={(itemValue) => setSelectedCodigo(itemValue)}
                            style={styles.picker}
                        >
                            {codigos.map((cod) => (
                                <Picker.Item key={cod.id} label={`${cod.codigo} - ${cod.descripcion}`} value={cod.id} />
                            ))}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Cantidad:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ingrese cantidad..."
                        keyboardType="numeric"
                        value={cantidad}
                        onChangeText={setCantidad}
                        autoFocus={Platform.OS !== 'web'} // AutoFocus solo en mobile
                    />

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonClose]}
                            onPress={onClose}
                        >
                            <Text style={styles.textStyle}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonAdd]}
                            onPress={handleAdd}
                        >
                            <Text style={styles.textStyle}>Agregar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '80%',
        maxWidth: 500,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'stretch', // Estirar hijos
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2d3748',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4a5568',
        marginBottom: 8,
        marginTop: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#cbd5e0',
        borderRadius: 8,
        marginBottom: 15,
        backgroundColor: '#f7fafc',
    },
    picker: {
        height: 50,
        width: '100%',
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
        marginBottom: 25,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    button: {
        borderRadius: 10,
        padding: 15,
        elevation: 2,
        flex: 1,
        marginHorizontal: 5,
    },
    buttonClose: {
        backgroundColor: '#718096',
    },
    buttonAdd: {
        backgroundColor: '#e53e3e', // Rojo
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
});
