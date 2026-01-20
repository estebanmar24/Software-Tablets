import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ScrollView, StyleProp, ViewStyle, FlatList } from 'react-native';
import React, { useState, useEffect } from 'react';
// import { Picker } from '@react-native-picker/picker'; // Reemplazado por CustomDropdown
import { Usuario, Maquina, OrdenProduccion, Actividad } from '../types';

interface SidebarProps {
    usuarios: Usuario[];
    maquinas: Maquina[];
    ordenes: OrdenProduccion[];
    selectedUsuario: number | null;
    selectedMaquina: number | null;
    selectedOrden: number | null;
    selectedActividad: Actividad | null;
    observaciones: string;
    onUsuarioChange: (id: number | null) => void;
    onMaquinaChange: (id: number | null) => void;
    onOrdenChange: (id: number | null) => void;
    onObservacionesChange: (text: string) => void;
    onAdminPress?: () => void;
    style?: StyleProp<ViewStyle>;
    scrollEnabled?: boolean;
    isCollapsible?: boolean;
    opSearchText: string;
    onOpSearchTextChange: (text: string) => void;
}

// Dropdown personalizado para reemplazar Picker nativo
function CustomDropdown({
    label,
    items,
    selectedValue,
    onValueChange,
    placeholder
}: {
    label: string,
    items: { id: number, nombre: string }[],
    selectedValue: number | null,
    onValueChange: (val: number | null) => void,
    placeholder: string
}) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedItem = items.find(i => i.id === selectedValue);

    return (
        <View style={styles.dropdownWrapper}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
                style={[styles.dropdownButton, isOpen && styles.dropdownButtonOpen]}
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.7}
            >
                <Text style={[styles.dropdownButtonText, !selectedItem && { color: '#A0AEC0' }]}>
                    {selectedItem ? selectedItem.nombre : placeholder}
                </Text>
                <Text style={{ fontSize: 12, color: '#A0AEC0' }}>{isOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {isOpen && (
                <View style={styles.dropdownList}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => { onValueChange(null); setIsOpen(false); }}
                        >
                            <Text style={[styles.dropdownItemText, { color: '#A0AEC0', fontStyle: 'italic' }]}>
                                {placeholder}
                            </Text>
                        </TouchableOpacity>
                        {items.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.dropdownItem, item.id === selectedValue && styles.dropdownItemSelected]}
                                onPress={() => { onValueChange(item.id); setIsOpen(false); }}
                            >
                                <Text style={[
                                    styles.dropdownItemText,
                                    item.id === selectedValue && styles.dropdownItemTextSelected
                                ]}>
                                    {item.nombre}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

export function Sidebar({
    usuarios,
    maquinas,
    ordenes,
    selectedUsuario,
    selectedMaquina,
    selectedOrden,
    selectedActividad,
    observaciones,
    onUsuarioChange,
    onMaquinaChange,
    onOrdenChange,
    onObservacionesChange,
    onAdminPress,
    style,
    scrollEnabled = true,
    isCollapsible = false,
    opSearchText,
    onOpSearchTextChange,
}: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    // const [showOpList, setShowOpList] = useState(false); // Unused warning fix

    const Container = scrollEnabled ? ScrollView : View;
    const containerProps = scrollEnabled ? { style: { flexGrow: 1 }, showsVerticalScrollIndicator: false } : { style: { flex: 1 } };

    const toggleMenu = () => setIsOpen(!isOpen);

    const filteredOrdenes = ordenes.filter(op =>
        op.numero.includes(opSearchText) && op.id !== selectedOrden
    );

    const handleOpSearch = (text: string) => {
        // Only numbers
        const numericText = text.replace(/[^0-9]/g, '');
        onOpSearchTextChange(numericText);
        // setShowOpList(true);
        if (numericText === '') {
            onOrdenChange(null);
        }
    };

    const selectOp = (op: OrdenProduccion) => {
        onOrdenChange(op.id);
        onOpSearchTextChange(op.numero);
        // setShowOpList(false);
    };

    return (
        <View style={[styles.container, style]}>
            {/* Logo siempre visible */}
            <View style={styles.logoContainer}>
                <Image
                    source={require('../../assets/LOGO ALEPH IMPRESORES_page-0001.jpg')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={{ fontSize: 10, color: '#718096', marginTop: 4 }}>v1.0.4 - Captura Mensual Fix 📝</Text>
            </View>

            {/* Toggle Button for Phones */}
            {isCollapsible && (
                <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                    <Text style={styles.menuButtonText}>
                        {isOpen ? '▲ Ocultar Menú' : '▼ Mostrar Menú (Máquina/Operario)'}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Contenido desplazable del sidebar - Condicional si es colapsable */}
            {(!isCollapsible || isOpen) && (
                <>
                    <Container {...containerProps}>
                        {/* Selectores */}
                        <View style={styles.selectorsContainer}>
                            <CustomDropdown
                                label="Máquina"
                                items={[...maquinas].sort((a, b) => {
                                    // Natural Sort Order: Extract leading numbers
                                    const regex = /^(\d+)/;
                                    const matchA = a.nombre.match(regex);
                                    const matchB = b.nombre.match(regex);

                                    const numA = matchA ? parseInt(matchA[0], 10) : Number.MAX_VALUE;
                                    const numB = matchB ? parseInt(matchB[0], 10) : Number.MAX_VALUE;

                                    if (numA !== numB) {
                                        return numA - numB;
                                    }
                                    return a.nombre.localeCompare(b.nombre);
                                })}
                                selectedValue={selectedMaquina}
                                onValueChange={onMaquinaChange}
                                placeholder="Seleccionar máquina"
                            />

                            <CustomDropdown
                                label="Operario"
                                items={usuarios}
                                selectedValue={selectedUsuario}
                                onValueChange={onUsuarioChange}
                                placeholder="Seleccionar operario"
                            />

                            <Text style={styles.label}>Orden de Producción</Text>
                            <View>
                                <TextInput
                                    style={styles.pickerContainer} // Reusing container style for border
                                    placeholder="Buscar OP (Números)"
                                    placeholderTextColor="#A0AEC0"
                                    value={opSearchText}
                                    keyboardType="numeric"
                                    onChangeText={handleOpSearch}
                                />
                                {opSearchText !== '' && filteredOrdenes.length > 0 && (
                                    <View style={styles.autocompleteList}>
                                        {filteredOrdenes.map(op => (
                                            <TouchableOpacity
                                                key={op.id}
                                                style={styles.autocompleteItem}
                                                onPress={() => selectOp(op)}
                                            >
                                                <Text style={styles.autocompleteText}>{op.numero}</Text>
                                                <Text style={styles.autocompleteDesc} numberOfLines={1}>{op.descripcion}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Observaciones Input */}
                        <View style={styles.observationsContainer}>
                            <Text style={styles.label}>Observaciones</Text>
                            <TextInput
                                style={styles.observationsInput}
                                multiline
                                placeholder="---"
                                placeholderTextColor="#A0AEC0"
                                value={observaciones}
                                onChangeText={onObservacionesChange}
                            />
                        </View>
                    </Container>

                    {/* Botón Admin - Fijo abajo si está expandido */}
                    <TouchableOpacity style={styles.adminButton} onPress={onAdminPress}>
                        <Text style={styles.adminButtonText}>⚙ Admin</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 280, // Ancho por defecto, sobrescribible via style prop
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: '#E8ECF0',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
    },
    adminButton: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#EDF2F7',
        borderRadius: 6,
        alignItems: 'center',
    },
    adminButtonText: {
        color: '#4A5568',
        fontWeight: '600',
        fontSize: 14,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E8ECF0',
    },
    logo: {
        width: 180,
        height: 60,
    },
    selectorsContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '800',
        color: '#2D3748', // Color oscuro y negrita para mejor visibilidad
        marginBottom: 6,
        marginTop: 12,
        textTransform: 'uppercase',
    },
    // DROPDOWN PERSONALIZADO
    dropdownWrapper: {
        marginBottom: 16,
        zIndex: 10,
    },
    dropdownButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    dropdownButtonOpen: {
        borderColor: '#3182CE', // Azul al abrir
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    dropdownButtonText: {
        fontSize: 16,
        color: '#2D3748',
        fontWeight: '500',
    },
    dropdownList: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: '#E2E8F0',
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        maxHeight: 200,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    dropdownItemSelected: {
        backgroundColor: '#EBF8FF', // Azul muy claro
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#4A5568',
    },
    dropdownItemTextSelected: {
        color: '#2B6CB0', // Azul fuerte
        fontWeight: '600',
    },
    // FIN DROPDOWN 
    pickerContainer: { // Para el input de OP
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 50,
        justifyContent: 'center',
        paddingHorizontal: 12,
        color: '#2D3748',
        fontSize: 16, // Tamaño de fuente más grande para mejor legibilidad
    },
    observationsContainer: {
        marginBottom: 10,
    },
    observationsInput: {
        backgroundColor: '#F7FAFC', // Background azul muy claro
        borderRadius: 4,
        padding: 12,
        minHeight: 100,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        color: '#2D3748',
        fontSize: 14,
        textAlignVertical: 'top',
    },
    menuButton: {
        backgroundColor: '#E2E8F0',
        padding: 10,
        borderRadius: 6,
        marginBottom: 10,
        alignItems: 'center',
    },
    menuButtonText: {
        color: '#4A5568',
        fontWeight: 'bold',
        fontSize: 14,
    },
    autocompleteList: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 4,
        marginTop: 4,
        maxHeight: 150,
    },
    autocompleteItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    autocompleteText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    autocompleteDesc: {
        fontSize: 12,
        color: '#718096',
    },
});
