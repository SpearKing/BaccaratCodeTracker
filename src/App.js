// src/App.js
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import './App.css';
import { useTheme } from './hooks/useTheme';
import { useAnalytics } from './hooks/useAnalytics';
import { useScorecardLogic } from './hooks/useScorecardLogic';
import { useGameManagement } from './hooks/useGameManagement';
import { useDecisionLog } from './hooks/useDecisionLog';
import { usePrediction } from './hooks/usePrediction';
import ScorecardGrid from './components/ScorecardGrid';
import ControlPanel from './components/ControlPanel';
import StealthModeView from './components/StealthModeView';
import StatsModal from './components/StatsModal';
import { API_URL } from './utils/constants';

function App() {
    const [showControls, setShowControls] = useState(false);
    const [isStealthMode, setIsStealthMode] = useState(false);
    const [showStats, setShowStats] = useState(false);

    const { log, append: appendDecision, clear: clearLog, pendingSync, syncError } =
        useDecisionLog(API_URL);

    // The card name lives in useGameManagement, which is built on top of
    // useScorecardLogic -- so it is stamped on here rather than passed down,
    // which would make the two hooks circular.
    const cardNameRef = useRef(null);
    const handleDecision = useCallback(
        (entry) => appendDecision({ ...entry, card: cardNameRef.current }),
        [appendDecision]
    );

    const {
        scorecard, setScorecard, lastWinType, setLastWinType, lastWinRow,
        setLastWinRow, lastPlayedRow, handleCellClick, resetScorecard, deleteRow,
        recordTie, maxRenderableColumns,
    } = useScorecardLogic(handleDecision);

    const { isDarkMode, setIsDarkMode } = useTheme();
    const { showAnalytics, setShowAnalytics, highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);

    // Player/Banker counts are cheap to derive and never need storing.
    const tallies = useMemo(() => {
        let pWins = 0;
        let bWins = 0;
        for (let i = 1; i < scorecard.length; i++) {
            if (scorecard[i][0].value === 'O') pWins++;
            if (scorecard[i][1].value === 'O') bWins++;
        }
        return { pWins, bWins };
    }, [scorecard]);

    const gameManagement = useGameManagement(
        scorecard, lastWinType, lastWinRow, setScorecard,
        setLastWinType, setLastWinRow, resetScorecard, tallies
    );

    useEffect(() => {
        cardNameRef.current = gameManagement.currentScorecardName;
    }, [gameManagement.currentScorecardName]);

    const { predictedWinType, confidenceLevel } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);

    const handleEnterStealthMode = () => { setIsDarkMode(true); setIsStealthMode(true); };

    const handleFullReset = useCallback(() => {
        if (window.confirm("Are you sure you want to start a new game?")) {
            // Note: the decision log deliberately survives this. It has to
            // accumulate across cards -- telling a real edge from noise takes
            // thousands of predictions, far more than one shoe.
            gameManagement.resetGameManagementState();
        }
    }, [gameManagement]);

    return (
        <div className={`app-container ${isStealthMode ? 'stealth-active' : ''}`}>
            <div className="main-view">
                <ControlPanel
                    onStealthClick={handleEnterStealthMode}
                    onStatsClick={() => setShowStats(true)}
                    showControls={showControls} setShowControls={setShowControls}
                    isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
                    showAnalytics={showAnalytics} setShowAnalytics={setShowAnalytics}
                    handleFullReset={handleFullReset}
                    recordTie={recordTie}
                    predictedWinType={predictedWinType} confidenceLevel={confidenceLevel}
                    {...gameManagement}
                />
                <ScorecardGrid
                    scorecard={scorecard} handleCellClick={handleCellClick}
                    maxRenderableColumns={maxRenderableColumns}
                    highlightedCells={highlightedCells} showAnalytics={showAnalytics}
                    handleDeleteRow={deleteRow}
                />
            </div>

            {isStealthMode && ( <StealthModeView onExit={() => setIsStealthMode(false)} scorecard={scorecard} lastWinRow={lastWinRow} lastPlayedRow={lastPlayedRow} handleCellClick={handleCellClick} recordTie={recordTie} highlightedCells={highlightedCells} /> )}

            {showStats && (
                <StatsModal
                    tallies={tallies}
                    log={log}
                    pendingSync={pendingSync}
                    syncError={syncError}
                    onClearLog={clearLog}
                    onClose={() => setShowStats(false)}
                />
            )}
        </div>
    );
}

export default App;
