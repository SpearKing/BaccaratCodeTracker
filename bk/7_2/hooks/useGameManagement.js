// src/hooks/useGameManagement.js
import { useState, useEffect, useCallback } from 'react';
import {
    ALL_SAVED_SCORECARDS_KEY,
    LAST_ACTIVE_SCORECARD_NAME_KEY,
    DEFAULT_GAME_NAME,
    NUM_INITIAL_ROWS,
    NUM_INITIAL_COLUMNS
} from '../utils/constants';

// Helper function to format date as mm/dd/yy
const formatDate = (dateString) => {
    const date = new Date(dateString);
    // Add time zone offset to prevent date from shifting
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
    const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = adjustedDate.getDate().toString().padStart(2, '0');
    const year = adjustedDate.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
};

// Helper function to convert string to Title Case
const toTitleCase = (str) => {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};


export const useGameManagement = (scorecard, lastWinType, lastWinRow, setScorecard, setLastWinType, setLastWinRow, resetScorecardLogic) => {
    const [allSavedScorecards, setAllSavedScorecards] = useState({});
    const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);
    const [saveGameInput, setSaveGameInput] = useState('');
    const [loadGameSelect, setLoadGameSelect] = useState('');
    // State for the date picker
    const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);


    const loadAllSavedScorecardsFromStorage = useCallback(() => {
        const saved = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
        setAllSavedScorecards(saved);
        const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
        if (saved[lastActiveName]) {
            setLoadGameSelect(lastActiveName);
            setCurrentScorecardName(lastActiveName);
        } else if (Object.keys(saved).length > 0) {
            setLoadGameSelect(Object.keys(saved)[0]);
        }
    }, []);

    useEffect(() => {
        loadAllSavedScorecardsFromStorage();
    }, [loadAllSavedScorecardsFromStorage]);

    const saveAllScorecardsToStorage = useCallback(() => {
        localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(allSavedScorecards));
        localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, currentScorecardName);
    }, [allSavedScorecards, currentScorecardName]);

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
            alert(`The name "${DEFAULT_GAME_NAME}" is reserved. Please choose a different name.`);
            return;
        }

        // Convert to Title Case
        const processedBaseName = toTitleCase(nameToSave);
        const formattedDate = formatDate(saveDate);
        
        let finalName = `${processedBaseName} - ${formattedDate}`;

        // Check for duplicates and append a counter if necessary
        const existingNames = Object.keys(allSavedScorecards);
        let counter = 1;
        while (existingNames.includes(finalName)) {
            counter++;
            finalName = `${processedBaseName} (${counter}) - ${formattedDate}`;
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
    }, [saveGameInput, saveDate, scorecard, lastWinType, lastWinRow, allSavedScorecards]);


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
    }, [loadGameSelect, allSavedScorecards, currentScorecardName, setScorecard, setLastWinType, setLastWinRow]);

    const resetGameManagementState = useCallback(() => {
        setCurrentScorecardName(DEFAULT_GAME_NAME);
        setSaveGameInput('');
        setLoadGameSelect('');
        setAllSavedScorecards(prev => {
            const newSaved = { ...prev };
            delete newSaved[DEFAULT_GAME_NAME];
            return newSaved;
        });
        resetScorecardLogic(false);
    }, [resetScorecardLogic]);


    return {
        allSavedScorecards,
        currentScorecardName,
        saveGameInput,
        setSaveGameInput,
        saveDate, // Expose date state
        setSaveDate, // Expose date setter
        loadGameSelect,
        setLoadGameSelect,
        handleSaveCurrentGame,
        handleLoadSelectedGame,
        handleDeleteSelectedGame,
        resetGameManagementState,
    };
};