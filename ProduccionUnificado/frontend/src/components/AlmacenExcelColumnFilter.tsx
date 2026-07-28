import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ColumnSortState } from '../utils/almacenColumnFilters';

interface ThemeColors {
    text: string;
    subText: string;
    primary: string;
    border: string;
}

interface AlmacenExcelColumnFilterProps {
    label: string;
    columnKey: string;
    flex: number;
    minWidth: number;
    values: string[];
    selectedValues: string[] | null;
    sortState: ColumnSortState;
    filterable?: boolean;
    onApplyFilter: (selected: string[] | null) => void;
    onSort: (dir: 'asc' | 'desc') => void;
    colors: ThemeColors;
    isDarkMode: boolean;
}

export default function AlmacenExcelColumnFilter({
    label,
    columnKey,
    flex,
    minWidth,
    values,
    selectedValues,
    sortState,
    filterable = true,
    onApplyFilter,
    onSort,
    colors,
    isDarkMode,
}: AlmacenExcelColumnFilterProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());

    const isActive = selectedValues != null;
    const isSortColumn = sortState?.key === columnKey;

    useEffect(() => {
        if (!open) return;
        const initial = selectedValues ?? values;
        setDraftSelected(new Set(initial));
        setSearch('');
    }, [open, selectedValues, values]);

    const filteredValues = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return values;
        return values.filter((v) => v.toLowerCase().includes(q));
    }, [values, search]);

    const allDraftSelected =
        filteredValues.length > 0 && filteredValues.every((v) => draftSelected.has(v));

    const toggleValue = (value: string) => {
        setDraftSelected((prev) => {
            const next = new Set(prev);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    };

    const toggleSelectAll = () => {
        setDraftSelected((prev) => {
            const next = new Set(prev);
            if (allDraftSelected) {
                filteredValues.forEach((v) => next.delete(v));
            } else {
                filteredValues.forEach((v) => next.add(v));
            }
            return next;
        });
    };

    const handleApply = () => {
        const selected = Array.from(draftSelected);
        if (selected.length === 0) {
            onApplyFilter([]);
        } else if (selected.length === values.length) {
            onApplyFilter(null);
        } else {
            onApplyFilter(selected);
        }
        setOpen(false);
    };

    const handleClear = () => {
        onApplyFilter(null);
        setOpen(false);
    };

    const panelBg = isDarkMode ? '#1E293B' : '#FFFFFF';
    const rowHover = isDarkMode ? '#334155' : '#F1F5F9';

    if (!filterable) {
        return (
            <View style={[styles.cell, { flex, minWidth }]}>
                <Text style={[styles.label, { color: colors.subText }]}>{label}</Text>
            </View>
        );
    }

    return (
        <>
            <Pressable
                style={[styles.cell, { flex, minWidth }]}
                onPress={() => setOpen(true)}
            >
                <View style={styles.headerInner}>
                    <Text
                        style={[
                            styles.label,
                            { color: isActive || isSortColumn ? colors.primary : colors.subText },
                        ]}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                    <MaterialCommunityIcons
                        name={isActive ? 'filter' : isSortColumn ? 'sort' : 'chevron-down'}
                        size={14}
                        color={isActive || isSortColumn ? colors.primary : colors.subText}
                    />
                </View>
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
                    <Pressable
                        style={[styles.panel, { backgroundColor: panelBg, borderColor: colors.border }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={[styles.panelTitle, { color: colors.text }]}>{label}</Text>

                        <TouchableOpacity
                            style={[styles.sortRow, { backgroundColor: rowHover }]}
                            onPress={() => {
                                onSort('asc');
                                setOpen(false);
                            }}
                        >
                            <MaterialCommunityIcons name="sort-alphabetical-ascending" size={18} color={colors.text} />
                            <Text style={[styles.sortText, { color: colors.text }]}>Ordenar A → Z</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortRow, { backgroundColor: rowHover }]}
                            onPress={() => {
                                onSort('desc');
                                setOpen(false);
                            }}
                        >
                            <MaterialCommunityIcons name="sort-alphabetical-descending" size={18} color={colors.text} />
                            <Text style={[styles.sortText, { color: colors.text }]}>Ordenar Z → A</Text>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <TextInput
                            style={[
                                styles.searchInput,
                                {
                                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            placeholder="Buscar..."
                            placeholderTextColor={colors.subText}
                            value={search}
                            onChangeText={setSearch}
                        />

                        <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
                            <MaterialCommunityIcons
                                name={allDraftSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={20}
                                color={colors.primary}
                            />
                            <Text style={[styles.checkLabel, { color: colors.text }]}>Seleccionar todo</Text>
                        </TouchableOpacity>

                        <ScrollView style={styles.valuesList} nestedScrollEnabled>
                            {filteredValues.length === 0 ? (
                                <Text style={[styles.emptyValues, { color: colors.subText }]}>
                                    Sin coincidencias
                                </Text>
                            ) : (
                                filteredValues.map((value) => {
                                    const checked = draftSelected.has(value);
                                    return (
                                        <TouchableOpacity
                                            key={value}
                                            style={styles.valueRow}
                                            onPress={() => toggleValue(value)}
                                        >
                                            <MaterialCommunityIcons
                                                name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                                size={20}
                                                color={checked ? colors.primary : colors.subText}
                                            />
                                            <Text style={[styles.checkLabel, { color: colors.text }]} numberOfLines={2}>
                                                {value}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.footerBtn} onPress={handleClear}>
                                <Text style={{ color: colors.subText, fontWeight: '600' }}>Limpiar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.footerBtn, styles.footerBtnPrimary, { backgroundColor: colors.primary }]}
                                onPress={handleApply}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '700' }}>Aplicar</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    cell: {
        paddingRight: 8,
        justifyContent: 'center',
    },
    headerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.6,
        flexShrink: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    panel: {
        width: '100%',
        maxWidth: 320,
        maxHeight: '80%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    panelTitle: {
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 10,
    },
    sortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 4,
    },
    sortText: { fontSize: 14, fontWeight: '600' },
    divider: { height: 1, marginVertical: 10 },
    searchInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        marginBottom: 8,
    },
    selectAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    valuesList: {
        maxHeight: 220,
        marginBottom: 8,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: 5,
    },
    checkLabel: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    emptyValues: {
        fontSize: 13,
        paddingVertical: 8,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 4,
    },
    footerBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    footerBtnPrimary: {},
});
