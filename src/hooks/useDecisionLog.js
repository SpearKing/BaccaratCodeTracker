// src/hooks/useDecisionLog.js
//
// Storage for the decision log.
//
// Written to localStorage first and pushed to the server opportunistically.
// That ordering matters: this gets used on a casino floor, where the network is
// unreliable and the backend sleeps on a free tier. A decision that only ever
// existed in a failed HTTP request is a decision lost, and the whole point of
// this phase is that the record survives.
//
// The log spans every card. It has to accumulate across sessions -- telling a
// real 2-point edge from noise needs on the order of 3,900 predictions.

import { useState, useEffect, useCallback, useRef } from 'react';

export const DECISION_LOG_KEY = 'baccarat_decision_log';

const load = () => {
    try {
        const raw = localStorage.getItem(DECISION_LOG_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Could not read the decision log; starting a fresh one.', error);
        return [];
    }
};

const persist = (entries) => {
    try {
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(entries));
        return true;
    } catch (error) {
        // Most likely the quota. Say so loudly rather than silently dropping
        // records -- roughly 800KB covers the 3,900 entries that matter.
        console.error('Could not save the decision log.', error);
        return false;
    }
};

export const useDecisionLog = (apiUrl) => {
    const [log, setLog] = useState(load);
    const [syncError, setSyncError] = useState(null);
    const syncing = useRef(false);

    useEffect(() => { persist(log); }, [log]);

    const append = useCallback((entry) => {
        if (!entry) return;
        setLog((prev) => [...prev, { ...entry, synced: false }]);
    }, []);

    const clear = useCallback(() => setLog([]), []);

    /** Pushes everything not yet on the server, then marks it. */
    const sync = useCallback(async () => {
        if (!apiUrl || syncing.current) return;

        const pending = log.filter((e) => !e.synced);
        if (pending.length === 0) return;

        syncing.current = true;
        try {
            const response = await fetch(`${apiUrl}/predictions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: pending.map(({ synced, ...rest }) => rest) }),
            });
            if (!response.ok) throw new Error(`Server returned ${response.status}`);

            const syncedKeys = new Set(pending.map((e) => `${e.card}#${e.hand}#${e.at}`));
            setLog((prev) =>
                prev.map((e) =>
                    syncedKeys.has(`${e.card}#${e.hand}#${e.at}`) ? { ...e, synced: true } : e
                )
            );
            setSyncError(null);
        } catch (error) {
            // Staying unsynced is the correct outcome; it will be retried.
            setSyncError(error.message);
        } finally {
            syncing.current = false;
        }
    }, [apiUrl, log]);

    // Retry shortly after anything changes, and on load.
    useEffect(() => {
        const timer = setTimeout(sync, 2000);
        return () => clearTimeout(timer);
    }, [sync]);

    const pendingSync = log.filter((e) => !e.synced).length;

    return { log, append, clear, sync, pendingSync, syncError };
};
