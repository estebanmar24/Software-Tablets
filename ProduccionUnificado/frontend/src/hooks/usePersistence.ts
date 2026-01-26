import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Actividad } from '../types';

const STORAGE_KEY = '@produccion_app_state_v1';

export interface PersistedState {
    selectedUsuarioId: number | null;
    selectedMaquinaId: number | null;
    selectedHorarioId: number | null;
    selectedActividad: Actividad | null;
    selectedOrden: number | null;
    opSearchText: string;
    observaciones: string;
    tirosAcumulados: number;
    desperdicioAcumulado: number;
    timerStartTime: string | null; // ISO Date String
    lastUpdated: number; // Timestamp to expire old sessions
}

export const usePersistence = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    const saveState = async (state: Partial<PersistedState>) => {
        try {
            const currentStateStr = await AsyncStorage.getItem(STORAGE_KEY);
            const currentState = currentStateStr ? JSON.parse(currentStateStr) : {};
            const newState = { ...currentState, ...state, lastUpdated: Date.now() };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        } catch (e) {
            console.error('Error saving state', e);
        }
    };

    const loadState = async (): Promise<PersistedState | null> => {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
            if (jsonValue != null) {
                const state = JSON.parse(jsonValue) as PersistedState;
                // Only restore User/Machine/Activity if there was an active timer running
                // This satisfies the user requirement "no default selection" on fresh start
                if (!state.timerStartTime) {
                    return {
                        ...state,
                        selectedUsuarioId: null,
                        selectedMaquinaId: null,
                        selectedHorarioId: null,
                        selectedActividad: null,
                        selectedOrden: null,
                        timerStartTime: null
                    };
                }

                // Optional: Expire after 12 hours
                if (Date.now() - state.lastUpdated > 12 * 60 * 60 * 1000) {
                    await clearState();
                    return null;
                }
                return state;
            }
            return null;
        } catch (e) {
            console.error('Error loading state', e);
            return null;
        } finally {
            setIsLoaded(true);
        }
    };

    const clearState = async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Error clearing state', e);
        }
    };

    return { saveState, loadState, clearState, isLoaded };
};
