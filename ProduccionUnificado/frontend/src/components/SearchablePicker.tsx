import React, { memo, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Keyboard,
    Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type SearchablePickerItem = Record<string, string | number | null | undefined>;

type Props = {
    data: SearchablePickerItem[];
    selectedValue: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    labelField?: string;
    valueField?: string;
    allowEmpty?: boolean;
    emptyLabel?: string;
    /** En modales usar true: la lista empuja el contenido (no flota encima). */
    inline?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export const SearchablePicker = memo(function SearchablePicker({
    data,
    selectedValue,
    onSelect,
    placeholder = 'Buscar...',
    labelField = 'label',
    valueField = 'value',
    allowEmpty = false,
    emptyLabel = 'Sin selección',
    inline = false,
    isOpen: isOpenControlled,
    onOpenChange,
}: Props) {
    const { colors, isDarkMode } = useTheme();
    const [query, setQuery] = useState('');
    const [showListInternal, setShowListInternal] = useState(false);

    const showList = isOpenControlled !== undefined ? isOpenControlled : showListInternal;
    const setShowList = (open: boolean) => {
        if (onOpenChange) onOpenChange(open);
        else setShowListInternal(open);
    };

    const listBg = isDarkMode ? '#111827' : '#ffffff';
    const itemBg = isDarkMode ? '#1f2937' : '#f9fafb';

    const itemsData = useMemo(() => {
        return data.filter((item) => {
            const v = String(item[valueField] ?? '').trim();
            const l = String(item[labelField] ?? '').trim();
            return v !== '' && l !== '';
        });
    }, [data, valueField, labelField]);

    const selectedItem = useMemo(
        () => itemsData.find((d) => String(d[valueField]) === String(selectedValue)),
        [itemsData, selectedValue, valueField]
    );

    useEffect(() => {
        if (selectedItem) {
            setQuery(String(selectedItem[labelField] ?? ''));
        } else if (!selectedValue) {
            setQuery('');
        }
    }, [selectedItem, selectedValue, labelField]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return itemsData;
        return itemsData.filter((item) =>
            String(item[labelField] ?? '')
                .toLowerCase()
                .includes(q)
        );
    }, [itemsData, query, labelField]);

    const styles = useMemo(
        () =>
            StyleSheet.create({
                wrap: {
                    position: 'relative',
                    zIndex: inline ? 1 : showList ? 100 : 1,
                    marginBottom: inline && showList ? 4 : 0,
                },
                input: {
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: colors.text,
                    backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                },
                list: {
                    ...(inline
                        ? {
                              marginTop: 6,
                              width: '100%',
                          }
                        : {
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: 2,
                              zIndex: 200,
                          }),
                    maxHeight: 220,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    backgroundColor: listBg,
                    overflow: 'hidden',
                    ...(Platform.OS === 'web'
                        ? {
                              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                              opacity: 1,
                          }
                        : {
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.35,
                              shadowRadius: 8,
                              elevation: 12,
                          }),
                },
                scroll: {
                    maxHeight: 180,
                    backgroundColor: listBg,
                },
                item: {
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: itemBg,
                },
                itemActive: {
                    backgroundColor: isDarkMode ? '#0f766e' : '#ccfbf1',
                },
                itemText: {
                    fontSize: 14,
                    color: colors.text,
                    backgroundColor: 'transparent',
                },
                itemTextMuted: {
                    fontSize: 13,
                    color: colors.subText,
                    fontStyle: 'italic',
                    textAlign: 'center',
                    padding: 12,
                    backgroundColor: listBg,
                },
                closeBtn: {
                    padding: 10,
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: isDarkMode ? '#0f172a' : '#e5e7eb',
                },
                closeText: { fontSize: 12, color: colors.subText, fontWeight: '600' },
            }),
        [colors, isDarkMode, showList, inline, listBg, itemBg]
    );

    const pick = (value: string, label: string) => {
        setQuery(label);
        setShowList(false);
        onSelect(value);
        Keyboard.dismiss();
    };

    return (
        <View style={styles.wrap}>
            <TextInput
                style={styles.input}
                value={query}
                onChangeText={(text) => {
                    setQuery(text);
                    if (text === '') onSelect('');
                    setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                placeholder={placeholder}
                placeholderTextColor={colors.subText}
            />
            {showList && (
                <View style={styles.list}>
                    <ScrollView
                        style={styles.scroll}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                    >
                        {allowEmpty && (
                            <TouchableOpacity
                                style={[styles.item, !selectedValue && styles.itemActive]}
                                onPress={() => pick('', emptyLabel)}
                            >
                                <Text style={styles.itemText}>{emptyLabel}</Text>
                            </TouchableOpacity>
                        )}
                        {filtered.length > 0 ? (
                            filtered.map((item, index) => {
                                const val = String(item[valueField] ?? '');
                                const label = String(item[labelField] ?? '');
                                const active = val === String(selectedValue);
                                return (
                                    <TouchableOpacity
                                        key={`${val}-${index}`}
                                        style={[styles.item, active && styles.itemActive]}
                                        onPress={() => pick(val, label)}
                                    >
                                        <Text style={styles.itemText}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <Text style={styles.itemTextMuted}>Sin resultados</Text>
                        )}
                    </ScrollView>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setShowList(false)}>
                        <Text style={styles.closeText}>Cerrar lista</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
});
