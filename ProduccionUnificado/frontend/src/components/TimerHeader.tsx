import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Actividad } from '../types';

interface TimerHeaderProps {
    formattedTime: string;
    selectedActividad: Actividad | null;
    isRunning: boolean;
    isPaused: boolean;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    canStart: boolean;
}

export function TimerHeader({
    formattedTime,
    selectedActividad,
    isRunning,
    isPaused,
    onStart,
    onPause,
    onResume,
    onStop,
    canStart,
}: TimerHeaderProps) {
    const { width } = useWindowDimensions();
    const isPhone = width < 600;

    const isStartDisabled = isRunning && !isPaused;
    const isPauseDisabled = !isRunning || isPaused;
    const isStopDisabled = !isRunning && !isPaused;

    return (
        <View style={[styles.container, isPhone && styles.containerMobile]}>
            <View style={[styles.leftContent, isPhone && styles.leftContentMobile]}>
                {/* Cronómetro */}
                <Text style={[styles.timer, isPhone && styles.timerMobile]}>{formattedTime}</Text>

                <View style={[styles.activityInfo, isPhone && styles.activityInfoMobile]}>
                    <Text style={styles.activityLabel}>ACTIVIDAD ACTUAL</Text>
                    <Text
                        style={[styles.activityName, isPhone && styles.activityNameMobile]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                    >
                        {selectedActividad
                            ? selectedActividad.nombre
                            : 'Sin actividad'}
                    </Text>
                </View>
            </View>

            {/* Botones de control */}
            <View style={[styles.buttonsContainer, isPhone && styles.buttonsContainerMobile]}>
                {/* Botón START (Verde) */}
                <TouchableOpacity
                    style={[styles.button, styles.startButton, isStartDisabled && styles.buttonDisabled]}
                    onPress={isPaused ? onResume : onStart}
                    disabled={isStartDisabled && !isPaused}
                >
                    <Text style={styles.buttonIcon}>▶</Text>
                </TouchableOpacity>

                {/* Botón PAUSE (Beige/Amarillo) */}
                <TouchableOpacity
                    style={[styles.button, styles.pauseButton, isPauseDisabled && styles.buttonDisabled]}
                    onPress={onPause}
                    disabled={isPauseDisabled}
                >
                    <Text style={styles.buttonIcon}>⏸</Text>
                </TouchableOpacity>

                {/* Botón STOP (Rojo) */}
                <TouchableOpacity
                    style={[styles.button, styles.stopButton, isStopDisabled && styles.buttonDisabled]}
                    onPress={onStop}
                    disabled={isStopDisabled}
                >
                    <Text style={styles.buttonIcon}>⏹</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#96BDF0',
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 8,
        marginBottom: 20,
        width: '100%',
    },
    containerMobile: {
        flexDirection: 'column',
        padding: 16,
        gap: 20,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 30,
        flex: 1,
    },
    leftContentMobile: {
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        alignItems: 'center',
    },
    timer: {
        fontSize: 72,
        fontWeight: '300',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    timerMobile: {
        fontSize: 56, // Smaller font for mobile
        textAlign: 'center',
        letterSpacing: 1,
    },
    activityInfo: {
        justifyContent: 'center',
        flex: 1, // Take available space
        overflow: 'hidden', // Ensure no spillover
    },
    activityInfoMobile: {
        alignItems: 'center',
    },
    activityLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 1,
        marginBottom: 4,
        fontWeight: '600',
    },
    activityName: {
        fontSize: 28,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    activityNameMobile: {
        fontSize: 20,
        textAlign: 'center',
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    buttonsContainerMobile: {
        width: '100%',
        justifyContent: 'center',
        gap: 20,
    },
    button: {
        width: 60,
        height: 60,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    startButton: {
        backgroundColor: '#A8D5BA', // Verde pastel suave
    },
    pauseButton: {
        backgroundColor: '#E6D5A7', // Beige/Amarillo suave
    },
    stopButton: {
        backgroundColor: '#D68C8C', // Rojo suave
    },
    buttonDisabled: {
        opacity: 0.5,
        backgroundColor: '#E0E0E0',
    },
    buttonIcon: {
        fontSize: 24,
        color: '#FFFFFF',
    },
});
