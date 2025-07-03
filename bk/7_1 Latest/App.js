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

    // Game Management Logic
    const {
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
    } = useGameManagement(
        scorecard,
        lastWinType,
        lastWinRow,
        setScorecard,
        setLastWinType,
        setLastWinRow,
        resetScorecard
    );

    // Theme Logic
    const { isDarkMode, setIsDarkMode } = useTheme();

    // Analytics Logic
    const { showAnalytics, setShowAnalytics, highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);

    // Prediction Logic --- now returns confidenceLevel
    const { predictedWinType, confidenceLevel } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);

    // Combined reset function for UI button
    const handleFullReset = useCallback(() => {
        resetGameManagementState();
    }, [resetGameManagementState]);


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
                handleSaveCurrentGame={handleSaveCurrentGame}
                loadGameSelect={loadGameSelect}
                setLoadGameSelect={setLoadGameSelect}
                allSavedScorecards={allSavedScorecards}
                handleLoadSelectedGame={handleLoadSelectedGame}
                handleDeleteSelectedGame={handleDeleteSelectedGame}
                handleFullReset={handleFullReset}
                predictedWinType={predictedWinType}
                confidenceLevel={confidenceLevel} // UPDATED PROP NAME
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