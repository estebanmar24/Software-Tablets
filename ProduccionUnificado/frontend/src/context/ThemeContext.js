import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';

const ThemeContext = createContext({
    isDarkMode: false,
    toggleTheme: () => { },
});

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Initial load from storage if web
    useEffect(() => {
        if (Platform.OS === 'web') {
            const storedTheme = localStorage.getItem('appTheme');
            if (storedTheme === 'dark') {
                setIsDarkMode(true);
            }
        }
    }, []);

    const toggleTheme = () => {
        setIsDarkMode(prev => {
            const newState = !prev;
            if (Platform.OS === 'web') {
                localStorage.setItem('appTheme', newState ? 'dark' : 'light');
            }
            return newState;
        });
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
