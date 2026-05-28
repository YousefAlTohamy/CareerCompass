import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsAPI } from '../api/endpoints';

/**
 * Custom hook for polling scraping job status with automatic cleanup
 * @param {string} scrapingJobId - ID of the scraping job to poll
 * @param {Object} options - Configuration options
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 3000)
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 * @param {Function} options.onCompleted - Callback when job completes successfully
 * @param {Function} options.onFailed - Callback when job fails
 * @returns {Object} - { status, progress, error, isPolling, stopPolling }
 */
export function useScrapingStatus(scrapingJobId, options = {}) {
    const {
        pollInterval = 3000,
        enabled = true,
        onCompleted,
        onFailed,
    } = options;

    const [status, setStatus] = useState(null); // 'pending', 'processing', 'completed', 'failed'
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);
    const [isPolling, setIsPolling] = useState(false);
    const [pollCount, setPollCount] = useState(0); // Track poll attempts

    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    const pollStatus = useCallback(async () => {
        if (!scrapingJobId || !mountedRef.current) {
            return;
        }

        try {
            const response = await jobsAPI.checkScrapingStatus(scrapingJobId);
            const data = response.data.data || response.data;

            if (!mountedRef.current) return;

            setStatus(data.status);
            setProgress(data.progress || null);
            setError(data.error_message || null);
            setPollCount(prev => prev + 1);

            // Timeout detection: Stop polling if stuck in 'pending' for too long
            const maxPolls = 20; // 20 polls * 3s = 60 seconds
            if (data.status === 'pending' && pollCount >= maxPolls) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                setIsPolling(false);
                setError('Job processing timeout. Queue worker may not be running. Please contact support.');

                console.warn('Scraping job stuck in pending status for >60s', {
                    scrapingJobId,
                    pollCount,
                });
                return;
            }

            // Stop polling on completed or failed status
            if (data.status === 'completed') {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                setIsPolling(false);

                if (onCompleted) {
                    onCompleted(data);
                }
            } else if (data.status === 'failed') {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                setIsPolling(false);
                setError(data.error_message || 'Scraping job failed');

                if (onFailed) {
                    onFailed(data);
                }
            }
        } catch (err) {
            console.error('Error polling scraping status:', err);
            if (mountedRef.current) {
                setError(err.response?.data?.message || 'Failed to check scraping status');
            }
        }
    }, [scrapingJobId, onCompleted, onFailed, pollCount]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPolling(false);
        setPollCount(0);
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        if (enabled && scrapingJobId && !intervalRef.current) {
            queueMicrotask(() => {
                if (!mountedRef.current || intervalRef.current) {
                    return;
                }

                setIsPolling(true);
                setPollCount(0);
                pollStatus();
                intervalRef.current = setInterval(pollStatus, pollInterval);
            });
        }

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [scrapingJobId, enabled, pollInterval, pollStatus]);

    return {
        status,
        progress,
        error,
        isPolling,
        stopPolling,
        pollCount, // Expose poll count for debugging
    };
}

/**
 * Example usage in a component:
 * 
 * const { status, progress, error, isPolling } = useScrapingStatus(scrapingJobId, {
 *   pollInterval: 3000, // Poll every 3 seconds
 *   enabled: !!scrapingJobId, // Only poll when we have a job ID
 *   onCompleted: (data) => {
 *     console.log('Scraping completed!', data);
 *     loadJobs(); // Refresh job list
 *   },
 *   onFailed: (data) => {
 *     console.error('Scraping failed:', data.error_message);
 *   },
 * });
 * 
 * // UI State Management
 * if (isPolling && status === 'processing') {
 *   return <div>Scraping jobs...</div>;
 * }
 * 
 * if (status === 'completed') {
 *   return <div>Jobs scraped successfully!</div>;
 * }
 * 
 * if (status === 'failed') {
 *   return <div>{error}</div>;
 * }
 */
