import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook to monitor scanner performance and provide optimization suggestions
 * Now tracks only actual decode attempts, not dialog opens
 */
export const useScannerOptimization = () => {
    const [scanAttempts, setScanAttempts] = useState(0);
    const [successfulScans, setSuccessfulScans] = useState(0);
    const [failedScans, setFailedScans] = useState(0);
    const [averageScanTime, setAverageScanTime] = useState<number | null>(null);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Start a scanning session (when dialog opens)
    const startSession = useCallback(() => {
        setSessionStartTime(Date.now());
    }, []);

    // Record a scan attempt (when camera tries to decode)
    const recordAttempt = useCallback(() => {
        setScanAttempts(prev => prev + 1);
    }, []);

    // Track successful scan
    const recordSuccess = useCallback(() => {
        setSuccessfulScans(prev => prev + 1);

        if (sessionStartTime) {
            const scanDuration = Date.now() - sessionStartTime;

            // Update average scan time
            setAverageScanTime(prev => {
                if (prev === null) return scanDuration;
                return (prev + scanDuration) / 2;
            });
        }
    }, [sessionStartTime]);

    // Record a failed scan attempt
    const recordFailure = useCallback(() => {
        setFailedScans(prev => prev + 1);
    }, []);

    // Analyze performance and provide suggestions
    useEffect(() => {
        const newSuggestions: string[] = [];

        // If success rate is low
        const successRate = scanAttempts > 0 ? (successfulScans / scanAttempts) * 100 : 100;
        if (scanAttempts >= 3 && successRate < 50) {
            newSuggestions.push('Intenta mejorar la iluminación o acercarte más al código');
        }

        // If scan time is too long
        if (averageScanTime && averageScanTime > 5000) {
            newSuggestions.push('El escaneo está tomando mucho tiempo. Asegúrate de que el código esté centrado y enfocado');
        }

        // If too many failed attempts
        if (failedScans > 10 && successfulScans === 0) {
            newSuggestions.push('¿El código está dañado? Intenta con otro código o verifica que el formato sea compatible');
        }

        // If many failures, suggest using flashlight
        if (failedScans > 5 && successfulScans === 0) {
            newSuggestions.push('Intenta activar la linterna para mejor iluminación');
        }

        setSuggestions(newSuggestions);
    }, [scanAttempts, successfulScans, failedScans, averageScanTime]);

    // Reset stats
    const reset = useCallback(() => {
        setScanAttempts(0);
        setSuccessfulScans(0);
        setFailedScans(0);
        setAverageScanTime(null);
        setSessionStartTime(null);
        setSuggestions([]);
    }, []);

    return {
        scanAttempts,
        successfulScans,
        failedScans,
        averageScanTime,
        suggestions,
        startSession,
        recordAttempt,
        recordSuccess,
        recordFailure,
        reset,
        successRate: scanAttempts > 0 ? (successfulScans / scanAttempts) * 100 : 100
    };
};

export default useScannerOptimization;
