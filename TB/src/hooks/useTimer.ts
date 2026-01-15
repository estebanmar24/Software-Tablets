import { useState, useRef, useCallback } from 'react';

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

    const start = useCallback((resumeTime?: Date) => {
        if (isRunning && !resumeTime) return;

        const now = resumeTime || new Date();
        setStartTime(now);
        setIsRunning(true);
        setIsPaused(false);

        // Calculate initial seconds if resuming
        if (resumeTime) {
            const diffInSeconds = Math.floor((new Date().getTime() - resumeTime.getTime()) / 1000);
            setSeconds(diffInSeconds);
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setSeconds((prev) => prev + 1);
        }, 1000);
    }, [isRunning]);

    const pause = useCallback(() => {
        if (!isRunning || isPaused) return;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPaused(true);
    }, [isRunning, isPaused]);

    const resume = useCallback(() => {
        if (!isRunning || !isPaused) return;

        setIsPaused(false);
        intervalRef.current = setInterval(() => {
            setSeconds((prev) => prev + 1);
        }, 1000);
    }, [isRunning, isPaused]);

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
