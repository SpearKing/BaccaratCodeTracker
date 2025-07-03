// src/hooks/useGameManagement.js
import { useState, useEffect, useCallback } from 'react';
import { ALL_SAVED_SCORECARDS_KEY, LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME } from '../utils/constants';

export const useGameManagement = (
    scorecard,
    lastWinType,
    lastWinRow,
    setScorecard,
    setLastWinType,
    setLastWinRow,
    resetScorecard,
    saveGameDate // NEW PARAMETER
) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState(() => {
        return JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
    });
    const [currentScorecardName, setCurrentScorecardName] = useState(() => {
        return localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
    });
    const [saveGameInput, setSaveGameInput] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');

    // Effect to automatically save the current state to DEFAULT_GAME_NAME
    useEffect(() => {
        const gameToSave = {
            scorecard: scorecard,
            lastWinType: lastWinType,
            lastWinRow: lastWinRow,
        };

        setAllSavedScorecards(prev => {
            const updated = { ...prev, [currentScorecardName]: gameToSave };
            localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(updated));
            return updated;
        });
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, currentScorecardName);

    }, [scorecard, lastWinType, lastWinRow, currentScorecardName]);


    const handleSaveCurrentGame = useCallback((dateToAppend) => { // NOW ACCEPTS DATE
        if (!saveGameInput.trim()) {
            alert('Please enter a name for your game.');
            return;
        }

        const baseName = saveGameInput.trim();
        const finalGameName = dateToAppend ? `${baseName} (${dateToAppend})` : baseName;

        const gameToSave = {
            scorecard: scorecard,
            lastWinType: lastWinType,
            lastWinRow: lastWinRow,
        };

        setAllSavedScorecards(prev => {
            const updated = { ...prev, [finalGameName]: gameToSave };
            localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(updated));
            return updated;
        });
        setCurrentScorecardName(finalGameName);
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, finalGameName);
        setSaveGameInput(''); // Clear input after saving

    }, [saveGameInput, scorecard, lastWinType, lastWinRow]); // Removed saveGameDate from dependencies as it's now an argument


    const handleLoadSelectedGame = useCallback(() => {
        if (!loadGameSelect) {
            alert('Please select a game to load.');
            return;
        }
        const loadedGame = allSavedScorecards[loadGameSelect];
        if (loadedGame) {
            setScorecard(loadedGame.scorecard);
            setLastWinType(loadedGame.lastWinType);
            setLastWinRow(loadedGame.lastWinRow);
            setCurrentScorecardName(loadGameSelect);
            localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, loadGameSelect);
        }
    }, [loadGameSelect, allSavedScorecards, setScorecard, setLastWinType, setLastWinRow]);

    const handleDeleteSelectedGame = useCallback(() => {
        if (!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME) {
            alert('Cannot delete the default session or no game selected.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete "${loadGameSelect}"?`)) {
            return;
        }

        setAllSavedScorecards(prev => {
            const updated = { ...prev };
            delete updated[loadGameSelect];
            localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(updated));
            return updated;
        });

        // If the deleted game was the current one, switch to default
        if (currentScorecardName === loadGameSelect) {
            setCurrentScorecardName(DEFAULT_GAME_NAME);
            localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME);
            resetScorecard(false); // Reset without confirmation, since we are switching to default
        }
        setLoadGameSelect(''); // Clear selection
    }, [loadGameSelect, allSavedScorecards, currentScorecardName, resetScorecard]);


    const resetGameManagementState = useCallback(() => {
        resetScorecard(false); // Call the scorecard reset without confirmation
        setCurrentScorecardName(DEFAULT_GAME_NAME);
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME);
        setSaveGameInput('');
        setLoadGameSelect('');
    }, [resetScorecard]);


    return {
        allSavedScorecards,
        currentScorecardName,
        saveGameInput,
        setSaveGameInput,
        loadGameSelect,
        setLoadGameSelect,
        handleSaveCurrentGame,
        handleLoadSelectedGame,
        handleDeleteSelectedGame,
        resetGameManagementState,
    };
};