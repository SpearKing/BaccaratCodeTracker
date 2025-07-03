// src/hooks/useGameManagement.js
import { useState, useEffect, useCallback } from 'react';
import {
    LAST_ACTIVE_SCORECARD_NAME_KEY,
    DEFAULT_GAME_NAME,
} from '../utils/constants';

const API_URL = 'http://localhost:3001/api'; // The URL of your backend

const formatDate = (dateString) => {
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
    const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = adjustedDate.getDate().toString().padStart(2, '0');
    const year = adjustedDate.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
};

const toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

export const useGameManagement = (scorecard, lastWinType, lastWinRow, setScorecard, setLastWinType, setLastWinRow, resetScorecardLogic) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState({});
    const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);
    const [saveGameInput, setSaveGameInput] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);

    // MODIFIED: Fetch all games from the database on initial load
    const loadAllGamesFromDB = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/games`);
            const games = await response.json();
            setAllSavedScorecards(games);
        } catch (error) {
            console.error('Failed to fetch games:', error);
        }
    }, []);

    useEffect(() => {
        loadAllGamesFromDB();
    }, [loadAllGamesFromDB]);

    // This effect now saves the "Last Session" game to the database automatically
    useEffect(() => {
        const saveLastSession = async () => {
            const dataToSave = {
                scorecard: scorecard,
                lastWinType: lastWinType,
                lastWinRow: lastWinRow,
            };
            try {
                await fetch(`${API_URL}/games`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: currentScorecardName, data: dataToSave }),
                });
            } catch (error) {
                console.error('Failed to save session:', error);
            }
        };

        if (scorecard) { // Only save if scorecard data is present
            saveLastSession();
        }
    }, [scorecard, lastWinType, lastWinRow, currentScorecardName]);


    const handleSaveCurrentGame = useCallback(async () => {
        const nameToSave = saveGameInput.trim();
        if (!nameToSave) return alert("Please enter a name for the scorecard.");
        if (nameToSave === DEFAULT_GAME_NAME) return alert(`The name "${DEFAULT_GAME_NAME}" is reserved.`);

        const processedBaseName = toTitleCase(nameToSave);
        const formattedDate = formatDate(saveDate);
        let finalName = `${processedBaseName} - ${formattedDate}`;
        
        const existingNames = Object.keys(allSavedScorecards);
        let counter = 1;
        while (existingNames.includes(finalName)) {
            counter++;
            finalName = `${processedBaseName} (${counter}) - ${formattedDate}`;
        }
        
        const dataToSave = {
            scorecard,
            lastWinType,
            lastWinRow,
        };

        try {
            await fetch(`${API_URL}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: finalName, data: dataToSave }),
            });
            
            // Refresh the list of games from the database
            await loadAllGamesFromDB();
            setCurrentScorecardName(finalName);
            setSaveGameInput('');
            alert(`Scorecard "${finalName}" saved!`);
        } catch (error) {
            console.error('Failed to save game:', error);
            alert('Error saving game.');
        }
    }, [saveGameInput, saveDate, scorecard, lastWinType, lastWinRow, allSavedScorecards, loadAllGamesFromDB]);


    const handleLoadSelectedGame = useCallback(() => {
        if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
            return alert("Please select a scorecard to load.");
        }
        const { scorecard: loadedScorecard, lastWinType: loadedType, lastWinRow: loadedRow } = allSavedScorecards[loadGameSelect];
        setScorecard(loadedScorecard);
        setLastWinType(loadedType);
        setLastWinRow(loadedRow);
        setCurrentScorecardName(loadGameSelect);
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, loadGameSelect);
        alert(`Scorecard "${loadGameSelect}" loaded!`);
    }, [loadGameSelect, allSavedScorecards, setScorecard, setLastWinType, setLastWinRow]);


    const handleDeleteSelectedGame = useCallback(async () => {
        if (!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME) {
            return alert("Please select a valid game to delete.");
        }
        if (!window.confirm(`Are you sure you want to delete scorecard "${loadGameSelect}"?`)) {
            return;
        }

        try {
            await fetch(`${API_URL}/games/${loadGameSelect}`, { method: 'DELETE' });
            // Refresh the list from the DB
            await loadAllGamesFromDB();
            setLoadGameSelect('');
            // Optional: load the default game after deleting
            if (allSavedScorecards[DEFAULT_GAME_NAME]) {
                handleLoadSelectedGame(DEFAULT_GAME_NAME);
            }
            alert(`Scorecard "${loadGameSelect}" deleted.`);
        } catch (error) {
            console.error('Failed to delete game:', error);
            alert('Error deleting game.');
        }
    }, [loadGameSelect, allSavedScorecards, handleLoadSelectedGame, loadAllGamesFromDB]);

    const resetGameManagementState = useCallback(() => {
        resetScorecardLogic(false);
        setCurrentScorecardName(DEFAULT_GAME_NAME);
        setSaveGameInput('');
        setLoadGameSelect('');
    }, [resetScorecardLogic]);

    return {
        allSavedScorecards,
        currentScorecardName,
        saveGameInput,
        setSaveGameInput,
        saveDate,
        setSaveDate,
        loadGameSelect,
        setLoadGameSelect,
        handleSaveCurrentGame,
        handleLoadSelectedGame,
        handleDeleteSelectedGame,
        resetGameManagementState,
    };
};