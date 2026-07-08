import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

/**
 * Selector de varios rubros (checkboxes).
 * @param {{ rubros: {id:number, nombre:string}[], selectedIds: string[], onChange: (ids:string[]) => void, required?: boolean }} props
 */
export default function MultiRubroPicker({ rubros = [], selectedIds = [], onChange, required = false }) {
    const toggle = (id) => {
        const sid = id.toString();
        if (selectedIds.includes(sid)) {
            onChange(selectedIds.filter(x => x !== sid));
        } else {
            onChange([...selectedIds, sid]);
        }
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>
                Rubro{required ? ' *' : ''} {selectedIds.length > 0 ? `(${selectedIds.length} seleccionado${selectedIds.length !== 1 ? 's' : ''})` : ''}
            </Text>
            <ScrollView style={styles.list} nestedScrollEnabled>
                {rubros.map(r => {
                    const sid = r.id.toString();
                    const checked = selectedIds.includes(sid);
                    return (
                        <TouchableOpacity
                            key={r.id}
                            style={[styles.row, checked && styles.rowChecked]}
                            onPress={() => toggle(r.id)}
                        >
                            <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
                            <Text style={styles.name}>{r.nombre}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
    list: { maxHeight: 160, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FAFAFA' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    rowChecked: { backgroundColor: '#EFF6FF' },
    check: { fontSize: 16, marginRight: 10, width: 22 },
    name: { fontSize: 14, color: '#111827', flex: 1 },
});
