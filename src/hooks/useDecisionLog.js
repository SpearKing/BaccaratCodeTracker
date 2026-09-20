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
import { fromServerRow } from '../engine/decisionLog';

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
    const fetchedRemote = useRef(false);

    useEffect(() => { persist(log); }, [log]);

    // A device with no log of its own pulls one down. Same rule as the card:
    // local is authoritative when it exists, because it holds every hand played
    // here and the server only holds what has been synced. This runs once, on a
    // genuinely empty log, so a cold start is worth the wait.
    useEffect(() => {
        if (!apiUrl || fetchedRemote.current) return;
        if (log.length > 0) { fetchedRemote.current = true; return; }
        fetchedRemote.current = true;

        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(`${apiUrl}/predictions?limit=50000`);
                if (!response.ok) throw new Error(`Server returned ${response.status}`);
                const rows = await response.json();
                if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
                // Marked synced: they came from the server, so pushing them
                // straight back would be a round trip for nothing.
                setLog(rows.map((r) => ({ ...fromServerRow(r), synced: true })));
            } catch (error) {
                // Offline, or the backend asleep. Starting empty is correct.
                console.error('Could not fetch the decision log from the server.', error);
            }
        })();
        return () => { cancelled = true; };
    }, [apiUrl, log.length]);

    const append = useCallback((entry) => {
        if (!entry) return;
        setLog((prev) => [...prev, { ...entry, synced: false }]);
    }, []);

    const clear = useCallback(() => setLog([]), []);

    /**
     * Merges entries in from a file.
     *
     * Deduplicated on card, hand and engine, so importing the same file twice
     * does not double-count a rule's record. Existing entries win, because what
     * this device recorded live is the better evidence.
     */
    const importDecisions = useCallback((incoming) => {
        setLog((prev) => {
            const seen = new Set(prev.map((e) => `${e.engine}#${e.card}#${e.hand}`));
            const added = (incoming || []).filter((e) => {
                const key = `${e.engine}#${e.card}#${e.hand}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            return [...prev, ...added.map((e) => ({ ...e, synced: false }))];
        });
    }, []);

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

    return { log, append, importDecisions, clear, sync, pendingSync, syncError };
};
