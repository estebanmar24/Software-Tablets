import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';

interface AdminLoginProps {
    onLoginSuccess: (loginType: 'admin' | 'calidad') => void;
    onBack: () => void;
}

export function AdminLogin({ onLoginSuccess, onBack }: AdminLoginProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        if (password === 'admin123') {
            onLoginSuccess('admin');
        } else if (password === 'calidad123') {
            onLoginSuccess('calidad');
        } else {
            setError('Contraseña incorrecta');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Image
                    source={require('../../assets/LOGO ALEPH IMPRESORES_page-0001.jpg')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                <Text style={styles.title}>Acceso Administrativo</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Contraseña</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            setError('');
                        }}
                        placeholder="Ingrese contraseña"
                    />
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                    <Text style={styles.loginButtonText}>Ingresar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={styles.backButtonText}>Volver al Timer</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
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
