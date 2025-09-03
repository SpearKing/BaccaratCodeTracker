// src/hooks/useGameManagement.js
import { useState, useEffect, useCallback } from 'react';
import { LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME } from '../utils/constants';

const API_URL = 'https://baccarat-api-3hoh.onrender.com/api';

const formatDate = (dateString) => { if (!dateString) return ''; const date = new Date(dateString); const offset = date.getTimezoneOffset(); const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000)); const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0'); const day = adjustedDate.getDate().toString().padStart(2, '0'); const year = adjustedDate.getFullYear().toString().slice(-2); return `${month}/${day}/${year}`; };
const toTitleCase = (str) => { return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()); };

export const useGameManagement = (scorecard, lastWinType, lastWinRow, setScorecard, setLastWinType, setLastWinRow, resetScorecardLogic, stats, setStats) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState({});
    const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);
    const [saveGameInput, setSaveGameInput] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);

    const loadAllGamesFromDB = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/games`);
            if (!response.ok) throw new Error('Failed to fetch games');
            const games = await response.json();
            setAllSavedScorecards(games);
        } catch (error) { console.error('Failed to fetch games:', error); }
    }, []);

    useEffect(() => { loadAllGamesFromDB(); }, [loadAllGamesFromDB]);

    const getSerializableStats = useCallback(() => {
        if (!stats) return {};
        const serializablePatternStats = stats.patternStats instanceof Map 
            ? Object.fromEntries(stats.patternStats) 
            : stats.patternStats;
        return { ...stats, patternStats: serializablePatternStats };
    }, [stats]);

    const autoSaveLastSession = useCallback(async () => {
        const dataToSave = { scorecard, lastWinType, lastWinRow };
        const serializableStats = getSerializableStats();
        try {
            await fetch(`${API_URL}/games`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: DEFAULT_GAME_NAME, data: dataToSave, stats: serializableStats }), });
        } catch (error) { console.error('Failed to save session:', error); }
    }, [scorecard, lastWinType, lastWinRow, getSerializableStats]);
    
    useEffect(() => {
        if (scorecard && scorecard.length > 0) {
            const timer = setTimeout(autoSaveLastSession, 1500);
            return () => clearTimeout(timer);
        }
    }, [scorecard, lastWinType, lastWinRow, autoSaveLastSession]);
    
    const handleQuickSave = useCallback(async () => {
        if (!currentScorecardName) return alert("No active game to save.");
        const dataToSave = { scorecard, lastWinType, lastWinRow };
        const serializableStats = getSerializableStats();
        try {
            await fetch(`${API_URL}/games`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: currentScorecardName, data: dataToSave, stats: serializableStats }), });
            alert(`Game "${currentScorecardName}" saved successfully!`);
        } catch (error) { alert('Error: Could not save the current game.'); }
    }, [currentScorecardName, scorecard, lastWinType, lastWinRow, getSerializableStats]);

    const handleSaveAs = useCallback(async () => {
        const nameToSave = saveGameInput.trim();
        if (!nameToSave) return alert("Please enter a name for the new save.");
        if (nameToSave === DEFAULT_GAME_NAME) return alert(`The name "${DEFAULT_GAME_NAME}" is reserved.`);
        const processedBaseName = toTitleCase(nameToSave);
        const formattedDate = formatDate(saveDate);
        let finalName = `${processedBaseName} - ${formattedDate}`;
        const existingNames = Object.keys(allSavedScorecards);
        let counter = 1;
        while (existingNames.includes(finalName)) { counter++; finalName = `${processedBaseName} (${counter}) - ${formattedDate}`; }
        const dataToSave = { scorecard, lastWinType, lastWinRow };
        const serializableStats = getSerializableStats();
        try {
            await fetch(`${API_URL}/games`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: finalName, data: dataToSave, stats: serializableStats }), });
            setAllSavedScorecards(prev => ({ ...prev, [finalName]: { ...dataToSave, stats: serializableStats } }));
            setCurrentScorecardName(finalName);
            setLoadGameSelect(finalName);
            localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, finalName);
            setSaveGameInput('');
            alert(`Scorecard "${finalName}" saved!`);
        } catch (error) { alert('Error saving new game.'); }
    }, [saveGameInput, saveDate, scorecard, lastWinType, lastWinRow, allSavedScorecards, getSerializableStats]); 

    const handleLoadSelectedGame = useCallback(() => {
        if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
            return alert("Please select a scorecard to load.");
        }
        const { scorecard: loadedScorecard, lastWinType: loadedType, lastWinRow: loadedRow, stats: loadedStats } = allSavedScorecards[loadGameSelect];
        setScorecard(loadedScorecard);
        setLastWinType(loadedType);
        setLastWinRow(loadedRow);
        setCurrentScorecardName(loadGameSelect);
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, loadGameSelect);
        
        // ** THE FIX IS HERE **
        // When loading stats, ensure patternStats is converted back to a Map.
        if(loadedStats && loadedStats.patternStats) {
            const patternStatsAsMap = new Map(Object.entries(loadedStats.patternStats));
            setStats({...loadedStats, patternStats: patternStatsAsMap});
        } else if (loadedStats) {
            setStats(loadedStats);
        }

        alert(`Scorecard "${loadGameSelect}" loaded!`);
    }, [loadGameSelect, allSavedScorecards, setScorecard, setLastWinType, setLastWinRow, setStats]);

    const handleDeleteSelectedGame = useCallback(async () => {
        if (!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME) {
            return alert("Please select a valid game to delete.");
        }
        if (!window.confirm(`Are you sure you want to delete scorecard "${loadGameSelect}"?`)) {
            return;
        }
        try {
            const response = await fetch(`${API_URL}/games/${encodeURIComponent(loadGameSelect)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete game');
            setAllSavedScorecards(prev => {
                const newSaved = { ...prev };
                delete newSaved[loadGameSelect];
                return newSaved;
            });
            alert(`Scorecard "${loadGameSelect}" deleted.`);
            setLoadGameSelect('');
        } catch (error) {
            console.error('Failed to delete game:', error);
            alert('Error deleting game.');
        }
    }, [loadGameSelect]);

    const resetGameManagementState = useCallback(() => {
        resetScorecardLogic();
        setCurrentScorecardName(DEFAULT_GAME_NAME);
        setSaveGameInput('');
        setLoadGameSelect('');
    }, [resetScorecardLogic]);

    return { allSavedScorecards, currentScorecardName, saveGameInput, setSaveGameInput, saveDate, setSaveDate, loadGameSelect, setLoadGameSelect, handleQuickSave, handleSaveAs, handleLoadSelectedGame, handleDeleteSelectedGame, resetGameManagementState };
};