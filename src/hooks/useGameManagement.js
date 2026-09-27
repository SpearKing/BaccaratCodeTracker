// src/hooks/useGameManagement.js
//
// Named saves, on the server.
//
// The server hears from you when you press Save, and not before. The live card
// is kept on the device instead (useLocalCard), written on every tap, and that
// is what a reload restores from. The server is consulted only when this device
// has never held a card -- a first run, or cleared storage -- where a cold
// start is worth waiting for because it happens almost never.
//
// What used to happen: a POST after every hand into a slot named "Last Session"
// that the load dropdown filtered out, so the app wrote constantly to something
// nothing could ever read.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME, API_URL } from '../utils/constants';
import { toStored, shoesFrom } from '../engine/cardFormat';
import { metaFrom, metaPayload, EMPTY_META } from '../engine/cardMeta';
import { venuesFrom, canonicalVenue, saveNameFor } from '../engine/venues';

const formatDate = (dateString) => { if (!dateString) return ''; const date = new Date(dateString); const offset = date.getTimezoneOffset(); const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000)); const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0'); const day = adjustedDate.getDate().toString().padStart(2, '0'); const year = adjustedDate.getFullYear().toString().slice(-2); return `${month}/${day}/${year}`; };

export const useGameManagement = ({ shoes, loadShoes, resetScorecard, restoredFromLocal, stats }) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState({});
    const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);
    // The save-name box IS the venue picker. One place to enter it, so the
    // name and the stored venue cannot disagree.
    const [saveGameInput, setSaveGameInput] = useState('');
    const [saveLabel, setSaveLabel] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);

    // What kind of game this card is being recorded at. It rides along in the
    // save payload rather than in the name, because the name could not carry it
    // reliably -- "L'auberge Video" and "L'auberge Revised" are a machine and a
    // table, and no reading of those names says so.
    const [cardMeta, setCardMeta] = useState(EMPTY_META);

    // Whether the last save reached the server. Failures used to disappear into
    // a console.error, so a sleeping backend looked exactly like success.
    const [saveState, setSaveState] = useState({ status: 'idle', at: null, error: null });
    const triedServerFallback = useRef(false);

    const save = useCallback(async (name, metaOverride) => {
        setSaveState((prev) => ({ ...prev, status: 'saving' }));
        try {
            const response = await fetch(`${API_URL}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data: toStored(shoes, metaPayload(metaOverride || cardMeta)), stats: stats || {} }),
            });
            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            setSaveState({ status: 'saved', at: Date.now(), error: null });
            return true;
        } catch (error) {
            console.error('Failed to save:', error);
            setSaveState((prev) => ({ status: 'failed', at: prev.at, error: error.message }));
            return false;
        }
    }, [shoes, stats, cardMeta]);

    const loadAllGamesFromDB = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/games`);
            if (!response.ok) throw new Error('Failed to fetch games');
            setAllSavedScorecards(await response.json());
        } catch (error) { console.error('Failed to fetch games:', error); }
    }, []);

    useEffect(() => { loadAllGamesFromDB(); }, [loadAllGamesFromDB]);

    // Only when this device had nothing of its own. Local is always fresher --
    // it has every hand, the server only has what was last saved -- so reading
    // the server over a live local card would silently discard hands.
    useEffect(() => {
        if (restoredFromLocal || triedServerFallback.current) return;
        const last = allSavedScorecards[DEFAULT_GAME_NAME];
        if (!last) return;
        triedServerFallback.current = true;
        const recovered = shoesFrom(last);
        if (recovered.length > 0) {
            loadShoes(recovered);
            setCardMeta(metaFrom(last));
            setCurrentScorecardName(DEFAULT_GAME_NAME);
        }
    }, [allSavedScorecards, restoredFromLocal, loadShoes]);

    const handleQuickSave = useCallback(async () => {
        if (!currentScorecardName) return alert('No active game to save.');
        if (await save(currentScorecardName)) {
            setAllSavedScorecards((prev) => ({ ...prev, [currentScorecardName]: toStored(shoes, metaPayload(cardMeta)) }));
            alert(`Game "${currentScorecardName}" saved successfully!`);
        } else {
            alert('Could not reach the server. The card is still safe on this device.');
        }
    }, [currentScorecardName, save, shoes, cardMeta]);

    /** Every place already played, most-used first. Feeds the venue dropdown. */
    const venues = useMemo(() => venuesFrom(allSavedScorecards), [allSavedScorecards]);

    const handleSaveAs = useCallback(async () => {
        const venue = canonicalVenue(saveGameInput, venues);
        if (!venue) return alert('Please choose or enter a venue for the new save.');
        if (venue === DEFAULT_GAME_NAME) return alert(`The name "${DEFAULT_GAME_NAME}" is reserved.`);

        const formattedDate = formatDate(saveDate);
        const base = saveNameFor(venue, saveLabel, '');
        let finalName = `${base} - ${formattedDate}`;
        const existingNames = Object.keys(allSavedScorecards);
        let counter = 1;
        while (existingNames.includes(finalName)) { counter++; finalName = `${base} (${counter}) - ${formattedDate}`; }

        // The venue is written from the same value the name was built from, so
        // the two can never drift apart again.
        setCardMeta((prev) => ({ ...prev, venue }));

        if (await save(finalName, { ...cardMeta, venue })) {
            setAllSavedScorecards((prev) => ({ ...prev, [finalName]: toStored(shoes, metaPayload({ ...cardMeta, venue })) }));
            setCurrentScorecardName(finalName);
            setLoadGameSelect(finalName);
            localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, finalName);
            setSaveGameInput('');
            alert(`Scorecard "${finalName}" saved!`);
        } else {
            alert('Could not reach the server. The card is still safe on this device.');
        }
    }, [saveGameInput, saveLabel, saveDate, allSavedScorecards, save, shoes, cardMeta, venues]);

    const handleLoadSelectedGame = useCallback(() => {
        if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
            return alert('Please select a scorecard to load.');
        }
        // shoesFrom reads v2 sittings, v1 single runs and the old full-grid
        // saves alike; the last two come back as one-shoe cards.
        loadShoes(shoesFrom(allSavedScorecards[loadGameSelect]));
        // Bring its classification up with it, so re-saving a card cannot
        // silently overwrite the type with whatever was last on screen.
        setCardMeta(metaFrom(allSavedScorecards[loadGameSelect]));
        setCurrentScorecardName(loadGameSelect);
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, loadGameSelect);
        alert(`Scorecard "${loadGameSelect}" loaded!`);
    }, [loadGameSelect, allSavedScorecards, loadShoes]);

    const handleDeleteSelectedGame = useCallback(async () => {
        if (!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME) {
            return alert('Please select a valid game to delete.');
        }
        if (!window.confirm(`Are you sure you want to delete scorecard "${loadGameSelect}"?`)) return;
        try {
            const response = await fetch(`${API_URL}/games/${encodeURIComponent(loadGameSelect)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete game');
            setAllSavedScorecards((prev) => {
                const next = { ...prev };
                delete next[loadGameSelect];
                return next;
            });
            alert(`Scorecard "${loadGameSelect}" deleted.`);
            setLoadGameSelect('');
        } catch (error) {
            console.error('Failed to delete game:', error);
            alert('Error deleting game.');
        }
    }, [loadGameSelect]);

    const resetGameManagementState = useCallback(() => {
        resetScorecard();
        setCurrentScorecardName(DEFAULT_GAME_NAME);
        setSaveGameInput('');
        setSaveLabel('');
        setLoadGameSelect('');
        setCardMeta(EMPTY_META);
    }, [resetScorecard]);

    return {
        saveState, allSavedScorecards, currentScorecardName,
        saveGameInput, setSaveGameInput, saveLabel, setSaveLabel, venues,
        saveDate, setSaveDate,
        loadGameSelect, setLoadGameSelect,
        cardMeta, setCardMeta,
        handleQuickSave, handleSaveAs, handleLoadSelectedGame,
        handleDeleteSelectedGame, resetGameManagementState,
    };
};
