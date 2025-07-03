// src/App.js
import React, { useState, useCallback } from 'react';
import './App.css';

// Import Hooks
import { useTheme } from './hooks/useTheme';
import { useAnalytics } from './hooks/useAnalytics';
import { useScorecardLogic } from './hooks/useScorecardLogic';
import { useGameManagement } from './hooks/useGameManagement';
import { usePrediction } from './hooks/usePrediction';

// Import Components
import ScorecardGrid from './components/ScorecardGrid';
import ControlPanel from './components/ControlPanel';

function App() {
    // UI state for control panel visibility
    const [showControls, setShowControls] = useState(false);

    // Core Scorecard Logic
    const {
        scorecard,
        setScorecard,
        lastWinType,
        setLastWinType,
        lastWinRow,
        setLastWinRow,
        handleCellClick,
        resetScorecard,
        maxRenderableColumns,
    } = useScorecardLogic();

    // State for the date input
    const [saveGameDate, setSaveGameDate] = useState(''); // NEW STATE

    // Game Management Logic
    const {
        allSavedScorecards,
        currentScorecardName,
        saveGameInput,
        setSaveGameInput,
        loadGameSelect,
        setLoadGameSelect,
        handleSaveCurrentGame, // This now takes the date
        handleLoadSelectedGame,
        handleDeleteSelectedGame,
        resetGameManagementState,
    } = useGameManagement(
        scorecard,
        lastWinType,
        lastWinRow,
        setScorecard,
        setLastWinType,
        setLastWinRow,
        resetScorecard,
        saveGameDate // PASS NEW STATE
    );

    // Theme Logic
    const { isDarkMode, setIsDarkMode } = useTheme();

    // Analytics Logic
    const { showAnalytics, setShowAnalytics, highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);

    // Prediction Logic
    const { predictedWinType, highlightedCount } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);

    // Combined reset function for UI button
    const handleFullReset = useCallback(() => {
        resetGameManagementState();
    }, [resetGameManagementState]);


    // Override handleSaveCurrentGame to pass the date
    const saveGameWithDate = useCallback(() => {
        // If no date is selected, use today's date
        const dateToUse = saveGameDate || new Date().toISOString().slice(0, 10);
        handleSaveCurrentGame(dateToUse);
        setSaveGameDate(''); // Clear date input after saving
    }, [saveGameDate, handleSaveCurrentGame]);


    return (
        <div className="app-container">
            <ControlPanel
                showControls={showControls}
                setShowControls={setShowControls}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                showAnalytics={showAnalytics}
                setShowAnalytics={setShowAnalytics}
                currentScorecardName={currentScorecardName}
                saveGameInput={saveGameInput}
                setSaveGameInput={setSaveGameInput}
                handleSaveCurrentGame={saveGameWithDate} // Use the new wrapper function
                loadGameSelect={loadGameSelect}
                setLoadGameSelect={setLoadGameSelect}
                allSavedScorecards={allSavedScorecards}
                handleLoadSelectedGame={handleLoadSelectedGame}
                handleDeleteSelectedGame={handleDeleteSelectedGame}
                handleFullReset={handleFullReset}
                predictedWinType={predictedWinType}
                highlightedCount={highlightedCount}
                saveGameDate={saveGameDate} // PASS NEW STATE
                setSaveGameDate={setSaveGameDate} // PASS NEW SETTER
            />
            <ScorecardGrid
                scorecard={scorecard}
                handleCellClick={handleCellClick}
                maxRenderableColumns={maxRenderableColumns}
                highlightedCells={highlightedCells}
            />
        </div>
    );
}

export default App;