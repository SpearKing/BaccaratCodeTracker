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
import StealthModeView from './components/StealthModeView';

function App() {
    const [showControls, setShowControls] = useState(false);
    const [isStealthMode, setIsStealthMode] = useState(false);

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

    const {
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
    } = useGameManagement(
        scorecard,
        lastWinType,
        lastWinRow,
        setScorecard,
        setLastWinType,
        setLastWinRow,
        resetScorecard
    );

    const { isDarkMode, setIsDarkMode } = useTheme();
    const { showAnalytics, setShowAnalytics, highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);
    const { predictedWinType, confidenceLevel } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);

    const handleFullReset = useCallback(() => {
        if (window.confirm("Are you sure you want to start a new game? This will clear the current scorecard.")) {
            resetGameManagementState();
        }
    }, [resetGameManagementState]);

    // MODIFIED: This function now also enables Dark Mode
    const handleEnterStealthMode = () => {
        setIsDarkMode(true);
        setIsStealthMode(true);
    };

    return (
        <div className={`app-container ${isStealthMode ? 'stealth-active' : ''}`}>
            <div className="main-view">
                <ControlPanel
                    onStealthClick={handleEnterStealthMode}
                    showControls={showControls}
                    setShowControls={setShowControls}
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    showAnalytics={showAnalytics}
                    setShowAnalytics={setShowAnalytics}
                    currentScorecardName={currentScorecardName}
                    saveGameInput={saveGameInput}
                    setSaveGameInput={setSaveGameInput}
                    saveDate={saveDate}
                    setSaveDate={setSaveDate}
                    handleSaveCurrentGame={handleSaveCurrentGame}
                    loadGameSelect={loadGameSelect}
                    setLoadGameSelect={setLoadGameSelect}
                    allSavedScorecards={allSavedScorecards}
                    handleLoadSelectedGame={handleLoadSelectedGame}
                    handleDeleteSelectedGame={handleDeleteSelectedGame}
                    handleFullReset={handleFullReset}
                    predictedWinType={predictedWinType}
                    confidenceLevel={confidenceLevel}
                />
                <ScorecardGrid
                    scorecard={scorecard}
                    handleCellClick={handleCellClick}
                    maxRenderableColumns={maxRenderableColumns}
                    highlightedCells={highlightedCells}
                    showAnalytics={showAnalytics}
                />
            </div>

            {isStealthMode && (
                <StealthModeView
                    onExit={() => setIsStealthMode(false)}
                    scorecard={scorecard}
                    lastWinRow={lastWinRow}
                    handleCellClick={handleCellClick}
                    highlightedCells={highlightedCells}
                />
            )}
        </div>
    );
}

export default App;