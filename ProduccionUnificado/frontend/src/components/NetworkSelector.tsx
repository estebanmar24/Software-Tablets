import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { isRemoteMode, setApiBaseUrl, LOCAL_API_URL, CLOUDFLARE_API_URL } from '../services/apiConfig';

export const NetworkSelector = () => {
    const [isRemote, setIsRemote] = useState(false);
    const { colors, isDarkMode } = useTheme();

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        const remote = await isRemoteMode();
        setIsRemote(remote);
    };

    const toggleNetwork = async () => {
        const newRemote = !isRemote;
        const newUrl = newRemote ? CLOUDFLARE_API_URL : LOCAL_API_URL;

        await setApiBaseUrl(newUrl);
        setIsRemote(newRemote);

        Alert.alert(
            'Red Cambiada',
            `Ahora la aplicación se conectará via: ${newRemote ? 'Cloudflare (Remoto)' : 'WiFi Local'}`
        );
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: isRemote ? '#E53E3E' : colors.primary },
                isDarkMode && { opacity: 0.9 }
            ]}
            onPress={toggleNetwork}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>{isRemote ? '🌐' : '🏠'}</Text>
                <Text style={styles.text}>{isRemote ? 'Remoto' : 'Local'}</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginLeft: 10,
        minWidth: 90,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 14,
        marginRight: 4,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
