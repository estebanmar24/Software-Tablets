import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseTimerReturn {
    seconds: number;
    isRunning: boolean;
    isPaused: boolean;
    formattedTime: string;
    startTime: Date | null;
    start: (resumeTime?: Date) => void;
    pause: () => void;
    resume: () => void;
    stop: () => { duration: string; startTime: string; endTime: string };
    reset: () => void;
}

export function useTimer(): UseTimerReturn {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    // Ref to track start time for real-time calculation
    const startTimeRef = useRef<Date | null>(null);
    // Ref to track accumulated time when paused
    const pausedSecondsRef = useRef<number>(0);

    const formatTime = (totalSeconds: number): string => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimeOfDay = (date: Date): string => {
        return `${date.getHours().toString().padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    };

    // Calculate elapsed time based on start time (works even after background)
    const calculateElapsed = useCallback(() => {
        if (!startTimeRef.current) return pausedSecondsRef.current;
        const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        return pausedSecondsRef.current + elapsed;
    }, []);

    // Listen for app state changes to recalculate time when returning from background
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && isRunning && !isPaused && startTimeRef.current) {
                // Recalculate elapsed time when app comes back to foreground
                const elapsed = calculateElapsed();
                setSeconds(elapsed);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription?.remove();
        };
    }, [isRunning, isPaused, calculateElapsed]);

    const start = useCallback((resumeTime?: Date) => {
        if (isRunning && !resumeTime) return;

        const now = resumeTime || new Date();
        setStartTime(now);
        startTimeRef.current = now;
        pausedSecondsRef.current = 0;
        setIsRunning(true);
        setIsPaused(false);

        // Calculate initial seconds if resuming from a saved time
        if (resumeTime) {
            const diffInSeconds = Math.floor((new Date().getTime() - resumeTime.getTime()) / 1000);
            setSeconds(diffInSeconds);
            pausedSecondsRef.current = 0;
            startTimeRef.current = resumeTime;
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        // Use time-based calculation instead of incrementing
        intervalRef.current = setInterval(() => {
            const elapsed = calculateElapsed();
            setSeconds(elapsed);
        }, 1000);
    }, [isRunning, calculateElapsed]);

    const pause = useCallback(() => {
        if (!isRunning || isPaused) return;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        // Save accumulated time when pausing
        pausedSecondsRef.current = calculateElapsed();
        startTimeRef.current = null;
        setIsPaused(true);
    }, [isRunning, isPaused, calculateElapsed]);

    const resume = useCallback(() => {
        if (!isRunning || !isPaused) return;

        setIsPaused(false);
        // Start new timer from now, keeping accumulated seconds
        startTimeRef.current = new Date();

        intervalRef.current = setInterval(() => {
            const elapsed = calculateElapsed();
            setSeconds(elapsed);
        }, 1000);
    }, [isRunning, isPaused, calculateElapsed]);

    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        const endTime = new Date();
        const duration = formatTime(seconds);
        const startTimeStr = startTime ? formatTimeOfDay(startTime) : '00:00:00';
        const endTimeStr = formatTimeOfDay(endTime);

        setIsRunning(false);
        setIsPaused(false);
        setSeconds(0);
        setStartTime(null);
        startTimeRef.current = null;
        pausedSecondsRef.current = 0;

        return {
            duration,
            startTime: startTimeStr,
            endTime: endTimeStr,
        };
    }, [seconds, startTime]);

    const reset = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setSeconds(0);
        setIsRunning(false);
        setIsPaused(false);
        setStartTime(null);
        startTimeRef.current = null;
        pausedSecondsRef.current = 0;
    }, []);

    return {
        seconds,
        isRunning,
        isPaused,
        formattedTime: formatTime(seconds),
        startTime,
        start,
        pause,
        resume,
        stop,
        reset,
    };
}
