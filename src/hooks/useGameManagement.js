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

import { useState, useEffect, useCallback, useRef } from 'react';
import { LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME, API_URL } from '../utils/constants';
import { toStored, fromStored } from '../engine/cardFormat';

const formatDate = (dateString) => { if (!dateString) return ''; const date = new Date(dateString); const offset = date.getTimezoneOffset(); const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000)); const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0'); const day = adjustedDate.getDate().toString().padStart(2, '0'); const year = adjustedDate.getFullYear().toString().slice(-2); return `${month}/${day}/${year}`; };
const toTitleCase = (str) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

export const useGameManagement = ({ hands, loadHands, resetScorecard, restoredFromLocal, stats }) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState({});
    const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);
    const [saveGameInput, setSaveGameInput] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);

    // Whether the last save reached the server. Failures used to disappear into
    // a console.error, so a sleeping backend looked exactly like success.
    const [saveState, setSaveState] = useState({ status: 'idle', at: null, error: null });
    const triedServerFallback = useRef(false);

    const save = useCallback(async (name) => {
        setSaveState((prev) => ({ ...prev, status: 'saving' }));
        try {
            const response = await fetch(`${API_URL}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data: toStored(hands), stats: stats || {} }),
            });
            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            setSaveState({ status: 'saved', at: Date.now(), error: null });
            return true;
        } catch (error) {
            console.error('Failed to save:', error);
            setSaveState((prev) => ({ status: 'failed', at: prev.at, error: error.message }));
            return false;
        }
    }, [hands, stats]);

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
        const recovered = fromStored(last);
        if (recovered.length > 0) {
            loadHands(recovered);
            setCurrentScorecardName(DEFAULT_GAME_NAME);
        }
    }, [allSavedScorecards, restoredFromLocal, loadHands]);

    const handleQuickSave = useCallback(async () => {
        if (!currentScorecardName) return alert('No active game to save.');
        if (await save(currentScorecardName)) {
            setAllSavedScorecards((prev) => ({ ...prev, [currentScorecardName]: toStored(hands) }));
            alert(`Game "${currentScorecardName}" saved successfully!`);
        } else {
            alert('Could not reach the server. The card is still safe on this device.');
        }
    }, [currentScorecardName, save, hands]);

    const handleSaveAs = useCallback(async () => {
        const nameToSave = saveGameInput.trim();
        if (!nameToSave) return alert('Please enter a name for the new save.');
        if (nameToSave === DEFAULT_GAME_NAME) return alert(`The name "${DEFAULT_GAME_NAME}" is reserved.`);

        const processedBaseName = toTitleCase(nameToSave);
        const formattedDate = formatDate(saveDate);
        let finalName = `${processedBaseName} - ${formattedDate}`;
        const existingNames = Object.keys(allSavedScorecards);
        let counter = 1;
        while (existingNames.includes(finalName)) { counter++; finalName = `${processedBaseName} (${counter}) - ${formattedDate}`; }

        if (await save(finalName)) {
            setAllSavedScorecards((prev) => ({ ...prev, [finalName]: toStored(hands) }));
            setCurrentScorecardName(finalName);
            setLoadGameSelect(finalName);
            localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, finalName);
            setSaveGameInput('');
            alert(`Scorecard "${finalName}" saved!`);
        } else {
            alert('Could not reach the server. The card is still safe on this device.');
        }
    }, [saveGameInput, saveDate, allSavedScorecards, save, hands]);

    const handleLoadSelectedGame = useCallback(() => {
        if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
            return alert('Please select a scorecard to load.');
        }
        // fromStored reads both the current shape and the old full-grid saves.
        loadHands(fromStored(allSavedScorecards[loadGameSelect]));
        setCurrentScorecardName(loadGameSelect);
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, loadGameSelect);
        alert(`Scorecard "${loadGameSelect}" loaded!`);
    }, [loadGameSelect, allSavedScorecards, loadHands]);

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
        setLoadGameSelect('');
    }, [resetScorecard]);

    return {
        saveState, allSavedScorecards, currentScorecardName,
        saveGameInput, setSaveGameInput, saveDate, setSaveDate,
        loadGameSelect, setLoadGameSelect,
        handleQuickSave, handleSaveAs, handleLoadSelectedGame,
        handleDeleteSelectedGame, resetGameManagementState,
    };
};
