import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

export const lightColors = {
    background: '#F0F2F5',
    text: '#2D3748',
    card: '#FFFFFF',
    border: '#E2E8F0',
    headerBackground: '#2D3748',
    inputBackground: '#FFFFFF',
    primary: '#96BDF0',
    danger: '#E53E3E',
    success: '#38A169',
    subText: '#718096',
    rowEven: '#FFFFFF',
    rowOdd: '#F7FAFC',
    rowHover: '#EDF2F7',
    iconContainer: '#E2E8F0',
    alephLogo: require('../../assets/LOGO_ALEPH_IMPRESORES.jpg'),
};

export const darkColors = {
    background: '#020617',
    backgroundGradient: ['#020617', '#05070A'],
    text: '#F9FAFB',
    card: '#111827',
    border: '#1F2937',
    headerBackground: '#020617',
    inputBackground: '#111827',
    primary: '#2563EB',
    danger: '#EF4444',
    success: '#10B981',
    subText: '#9CA3AF',
    rowEven: '#111827',
    rowOdd: '#0F172A',
    rowHover: '#1F2937',
    iconContainer: '#020617',
    alephLogo: require('../../assets/image2.png'),
};

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const storedTheme = await AsyncStorage.getItem('appTheme');
                if (storedTheme === 'dark') {
                    setIsDarkMode(true);
                }
            } catch (e) {
                console.log('Error loading theme:', e);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newState = !isDarkMode;
        setIsDarkMode(newState);
        try {
            await AsyncStorage.setItem('appTheme', newState ? 'dark' : 'light');
        } catch (e) {
            console.log('Error saving theme:', e);
        }
    };

    const colors = isDarkMode ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
