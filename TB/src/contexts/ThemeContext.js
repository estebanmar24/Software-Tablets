import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export const lightColors = {
    background: '#ffffff',
    text: '#000000',
    card: '#f8f9fa',
    border: '#dee2e6',
    headerBackground: '#f5f5f5',
    inputBackground: '#ffffff',
    primary: '#007bff',
    danger: '#dc3545',
    success: '#28a745',
    subText: '#666666',
    rowEven: '#ffffff',
    rowOdd: '#f9f9f9',
    rowHover: '#e0e0e0',
};

export const ThemeProvider = ({ children }) => {
    // Always light
    const theme = 'light';

    // No-op
    const toggleTheme = () => { };

    const colors = lightColors;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
