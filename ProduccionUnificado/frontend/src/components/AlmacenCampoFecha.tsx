import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatFechaDisplay } from '../data/almacenMockData';

type ThemeColors = {
    text: string;
    subText: string;
    border: string;
};

function fechaToIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface AlmacenCampoFechaProps {
    value: string;
    onChange: (iso: string) => void;
    colors: ThemeColors;
    isDarkMode: boolean;
    inputBg: string;
    buttonStyle?: object;
}

export default function AlmacenCampoFecha({
    value,
    onChange,
    colors,
    isDarkMode,
    inputBg,
    buttonStyle,
}: AlmacenCampoFechaProps) {
    const [showPicker, setShowPicker] = useState(false);

    if (Platform.OS === 'web') {
        return (
            <input
                type="date"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    padding: '0 14px',
                    fontSize: 15,
                    color: colors.text,
                    backgroundColor: inputBg,
                    boxSizing: 'border-box',
                    colorScheme: isDarkMode ? 'dark' : 'light',
                }}
            />
        );
    }

    const fechaDate = value ? new Date(`${value}T12:00:00`) : new Date();
    return (
        <View>
            <TouchableOpacity
                style={[
                    {
                        height: 48,
                        borderRadius: 10,
                        borderWidth: 1,
                        paddingHorizontal: 14,
                        justifyContent: 'center',
                        backgroundColor: inputBg,
                        borderColor: colors.border,
                    },
                    buttonStyle,
                ]}
                onPress={() => setShowPicker(true)}
            >
                <Text style={{ color: value ? colors.text : colors.subText, fontSize: 15 }}>
                    {value ? formatFechaDisplay(value) : 'Seleccionar...'}
                </Text>
            </TouchableOpacity>
            {showPicker && (
                <DateTimePicker
                    value={fechaDate}
                    mode="date"
                    onChange={(event, date) => {
                        if (Platform.OS === 'android') setShowPicker(false);
                        if (event.type === 'dismissed') {
                            setShowPicker(false);
                            return;
                        }
                        if (date) onChange(fechaToIso(date));
                        if (Platform.OS === 'ios') setShowPicker(false);
                    }}
                />
            )}
        </View>
    );
}
