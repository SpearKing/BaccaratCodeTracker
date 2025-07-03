// src/hooks/useGameManagement.js
import { useState, useEffect, useCallback } from 'react';
import {
    ALL_SAVED_SCORECARDS_KEY,
    LAST_ACTIVE_SCORECARD_NAME_KEY,
    DEFAULT_GAME_NAME,
    NUM_INITIAL_ROWS,
    NUM_INITIAL_COLUMNS
} from '../utils/constants';

export const useGameManagement = (scorecard, lastWinType, lastWinRow, setScorecard, setLastWinType, setLastWinRow, resetScorecardLogic) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState({});
    const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);
    const [saveGameInput, setSaveGameInput] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');

    // Function to load all saved scorecards from localStorage into state
    const loadAllSavedScorecardsFromStorage = useCallback(() => {
        const saved = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
        setAllSavedScorecards(saved);
        const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
        if (saved[lastActiveName]) {
            setLoadGameSelect(lastActiveName);
            setCurrentScorecardName(lastActiveName); // Ensure current game name is also set
        } else if (Object.keys(saved).length > 0) {
            setLoadGameSelect(Object.keys(saved)[0]);
        }
    }, []);

    // Effect to load all saved scorecards on component mount
    useEffect(() => {
        loadAllSavedScorecardsFromStorage();
    }, [loadAllSavedScorecardsFromStorage]);

    // Function to save the CURRENT `allSavedScorecards` object to localStorage
    const saveAllScorecardsToStorage = useCallback(() => {
        localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(allSavedScorecards));
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, currentScorecardName);
    }, [allSavedScorecards, currentScorecardName]);

    // Effect for automatically saving the current game session whenever `scorecard`, `lastWinType`, `lastWinRow`, or `currentScorecardName` changes
    // This updates the `allSavedScorecards` state, which in turn triggers `saveAllScorecardsToStorage`
    useEffect(() => {
        setAllSavedScorecards(prev => ({
            ...prev,
            [currentScorecardName]: {
                scorecard: scorecard,
                lastWinType: lastWinType,
                lastWinRow: lastWinRow,
            },
        }));
    }, [scorecard, lastWinType, lastWinRow, currentScorecardName]);

    // Effect to write `allSavedScorecards` to localStorage whenever it changes
    useEffect(() => {
        saveAllScorecardsToStorage();
    }, [allSavedScorecards, saveAllScorecardsToStorage]);

    const handleSaveCurrentGame = useCallback(() => {
        const nameToSave = saveGameInput.trim();
        if (!nameToSave) {
            alert("Please enter a name for the scorecard.");
            return;
        }
        if (nameToSave === DEFAULT_GAME_NAME) {
            alert(`The name "${DEFAULT_GAME_NAME}" is reserved for automatic session saving. Please choose a different name.`);
            return;
        }

        const processedBaseName = nameToSave.toUpperCase();
        const today = new Date();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const year = today.getFullYear().toString().slice(-2);
        const formattedDate = `${month}/${day}/${year}`;

        let finalName = `${processedBaseName} - ${formattedDate}`;

        const escapedBaseName = processedBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = new RegExp(`^${escapedBaseName}(?:_(\\d+))? - ${formattedDate}$`);

        let maxCounter = 0;
        Object.keys(allSavedScorecards).forEach(key => {
            const match = key.match(regexPattern);
            if (match) {
                const currentNum = match[1] ? parseInt(match[1], 10) : 1;
                if (!isNaN(currentNum)) {
                    maxCounter = Math.max(maxCounter, currentNum);
                }
            }
        });

        if (maxCounter > 0) {
            finalName = `${processedBaseName}_${maxCounter + 1} - ${formattedDate}`;
        }

        setAllSavedScorecards(prev => {
            const newSaved = {
                ...prev,
                [finalName]: {
                    scorecard: scorecard,
                    lastWinType: lastWinType,
                    lastWinRow: lastWinRow,
                },
            };
            return newSaved;
        });
        setCurrentScorecardName(finalName);
        setSaveGameInput('');
        alert(`Scorecard "${finalName}" saved!`);
    }, [saveGameInput, scorecard, lastWinType, lastWinRow, allSavedScorecards]);


    const handleLoadSelectedGame = useCallback(() => {
        if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
            alert("Please select a scorecard to load.");
            return;
        }

        const { scorecard: loadedScorecard, lastWinType: loadedType, lastWinRow: loadedRow } = allSavedScorecards[loadGameSelect];

        setScorecard(loadedScorecard);
        setLastWinType(loadedType);
        setLastWinRow(loadedRow);
        setCurrentScorecardName(loadGameSelect);
        alert(`Scorecard "${loadGameSelect}" loaded!`);

    }, [loadGameSelect, allSavedScorecards, setScorecard, setLastWinType, setLastWinRow]);


    const handleDeleteSelectedGame = useCallback(() => {
        if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
            alert("Please select a scorecard to delete.");
            return;
        }
        if (loadGameSelect === DEFAULT_GAME_NAME) {
            alert(`The default "${DEFAULT_GAME_NAME}" session cannot be deleted.`);
            return;
        }

        if (!window.confirm(`Are you sure you want to delete scorecard "${loadGameSelect}"?`)) {
            return;
        }

        setAllSavedScorecards(prev => {
            const newSaved = { ...prev };
            delete newSaved[loadGameSelect];
            return newSaved;
        });

        if (loadGameSelect === currentScorecardName) {
            const lastSessionData = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}')[DEFAULT_GAME_NAME];
            if (lastSessionData) {
                setScorecard(lastSessionData.scorecard);
                setLastWinType(lastSessionData.lastWinType);
                setLastWinRow(lastSessionData.lastWinRow);
                setCurrentScorecardName(DEFAULT_GAME_NAME);
            } else {
                // If default game is also gone, do a full reset
                const initialScorecard = [];
                for (let i = 0; i < NUM_INITIAL_ROWS + 1; i++) {
                    const row = [];
                    row.push({ type: 'P', value: '', editable: true, displayValue: '' });
                    row.push({ type: 'B', value: '', editable: true, displayValue: '' });
                    row.push({ type: 'S', value: '', editable: false, displayValue: '' });
                    for (let j = 0; j < NUM_INITIAL_COLUMNS; j++) {
                        row.push({ type: 'Number', value: null, editable: false, displayValue: '' });
                    }
                    initialScorecard.push(row);
                }
                setScorecard(initialScorecard);
                setLastWinType(null);
                setLastWinRow(-1);
                setCurrentScorecardName(DEFAULT_GAME_NAME);
            }
        }
        setLoadGameSelect('');
        alert(`Scorecard "${loadGameSelect}" deleted.`);
    }, [loadGameSelect, allSavedScorecards, currentScorecardName, setScorecard, setLastWinType, setLastWinRow]); // Added dependencies

    const resetGameManagementState = useCallback(() => {
        setCurrentScorecardName(DEFAULT_GAME_NAME);
        setSaveGameInput('');
        setLoadGameSelect('');
        // Ensure that the default game is removed from allSavedScorecards here
        setAllSavedScorecards(prev => {
            const newSaved = { ...prev };
            delete newSaved[DEFAULT_GAME_NAME];
            return newSaved;
        });
        resetScorecardLogic(false); // Call the scorecard reset logic
    }, [resetScorecardLogic]);


    return {
        allSavedScorecards,
        currentScorecardName,
        setCurrentScorecardName, // Exposed for App.js if needed to set current game name
        saveGameInput,
        setSaveGameInput,
        loadGameSelect,
        setLoadGameSelect,
        handleSaveCurrentGame,
        handleLoadSelectedGame,
        handleDeleteSelectedGame,
        resetGameManagementState, // New combined reset for game management
    };
};