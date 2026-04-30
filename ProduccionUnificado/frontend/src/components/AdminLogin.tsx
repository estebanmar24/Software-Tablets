import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminLogin } from '../services/api';
import { setToken } from '../services/authStorage';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface AdminLoginProps {
    onLoginSuccess: (role: string, nombreMostrar: string, username: string, area: string, permissions: string) => void;
    onBack: () => void;
}

export function AdminLogin({ onLoginSuccess, onBack }: AdminLoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { colors, isDarkMode } = useTheme();

    const handleLogin = async () => {
        if (!username || !password) {
            setError('Ingrese usuario y contraseña');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await adminLogin(username.trim(), password.trim());
            await setToken(data.token);
            if (data.id) {
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem('adminId', data.id.toString());
                    if (data.area) window.localStorage.setItem('adminArea', data.area);
                    if (data.permissions) window.localStorage.setItem('adminPermissions', data.permissions);
                } else {
                    await AsyncStorage.setItem('adminId', data.id.toString());
                    if (data.area) await AsyncStorage.setItem('adminArea', data.area);
                    if (data.permissions) await AsyncStorage.setItem('adminPermissions', data.permissions);
                }
            }
            onLoginSuccess(data.role, data.nombreMostrar, data.username, data.area || '', data.permissions || '');
        } catch (err: any) {
            setError(err.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}>
                <Image
                    source={colors.alephLogo}
                    style={[styles.logo, isDarkMode && { opacity: 0.95 }]}
                    resizeMode="contain"
                />

                <Text style={[styles.title, { color: colors.text }]}>Acceso Administrativo</Text>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Usuario</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Ingrese usuario"
                        placeholderTextColor={colors.subText}
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Contraseña</Text>
                    <View style={[styles.passwordWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                        <TextInput
                            style={[styles.passwordInput, { color: colors.text }]}
                            secureTextEntry={!showPassword}
                            value={password}
                            autoCapitalize="none"
                            onChangeText={(text) => {
                                setPassword(text);
                                setError('');
                            }}
                            placeholder="Ingrese contraseña"
                            placeholderTextColor={colors.subText}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeIcon}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons
                                name={showPassword ? "visibility" : "visibility-off"}
                                size={24}
                                color={colors.subText}
                            />
                        </TouchableOpacity>
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                <TouchableOpacity
                    style={[styles.loginButton, { backgroundColor: colors.primary }, loading && { backgroundColor: isDarkMode ? '#374151' : '#A0AEC0' }]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    <Text style={styles.loginButtonText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={[styles.backButtonText, { color: colors.subText }]}>Volver al Timer</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent', // Use dynamic theme background
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        maxWidth: 400,
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    logo: {
        width: 200,
        height: 70,
        marginBottom: 30,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 30,
    },
    inputContainer: {
        width: '100%',
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4A5568',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#2D3748',
    },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
    },
    passwordInput: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        color: '#2D3748',
    },
    eyeIcon: {
        paddingRight: 12,
    },
    errorText: {
        color: '#E53E3E',
        fontSize: 14,
        marginTop: 6,
    },
    loginButton: {
        backgroundColor: '#96BDF0',
        width: '100%',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    backButton: {
        padding: 10,
    },
    backButtonText: {
        color: '#718096',
        fontSize: 14,
        fontWeight: '500',
    },
});
