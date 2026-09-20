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
import { confidenceCalibration } from './engine/stats';
import { recordsFrom, headToHeadFrom } from './engine/arbitrate';
import { handsFromGrid } from './engine/grid';
import { API_URL } from './utils/constants';

function App() {
    const [showControls, setShowControls] = useState(false);
    const [isStealthMode, setIsStealthMode] = useState(false);
    const [showStats, setShowStats] = useState(false);

    const { log, append: appendDecision, pendingSync, syncError } = useDecisionLog(API_URL);

    // App owns the ONLY analytics instance and the ONLY prediction, and feeds
    // both to the logger through refs. The refs are what break the cycle --
    // the grid hook produces the scorecard that the prediction is computed
    // from, but logging happens inside an event handler, after render, so
    // reading the current value there is well defined.
    //
    // This matters: when the grid hook computed its own prediction from its own
    // analytics instance, flipping the analytics switch never reached it, and
    // the log recorded something different from what the screen showed.
    const cardNameRef = useRef(null);
    const predictionRef = useRef(null);

    const handleDecision = useCallback(
        (entry) => appendDecision({ ...entry, card: cardNameRef.current }),
        [appendDecision]
    );
    const getPrediction = useCallback(() => predictionRef.current, []);

    const cardNameForCard = cardNameRef.current;
    const {
        scorecard, lastWinType, lastWinRow, lastPlayedRow,
        handleCellClick, resetScorecard, deleteRow, recordTie,
        loadHands, restoredFromLocal, maxRenderableColumns,
    } = useScorecardLogic(handleDecision, getPrediction, cardNameForCard);

    // The hands are what gets stored, locally and on the server. The board is
    // rebuilt from them, so nothing else needs keeping.
    const hands = useMemo(() => handsFromGrid(scorecard), [scorecard]);

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

    const gameManagement = useGameManagement({
        hands,
        loadHands,
        resetScorecard,
        restoredFromLocal,
        stats: tallies,
    });

    useEffect(() => {
        cardNameRef.current = gameManagement.currentScorecardName;
    }, [gameManagement.currentScorecardName]);

    // What each C-Level has actually been worth, measured from this player's
    // own log rather than asserted.
    const calibration = useMemo(() => confidenceCalibration(log), [log]);

    // Each rule's track record. The log only ever holds hands already played,
    // so a rule's weight can never be influenced by the hand it is calling.
    const records = useMemo(() => recordsFrom(log), [log]);

    // How rules have fared against each other specifically, which is what
    // settles a conflict when the pair has clashed often enough.
    const pairs = useMemo(() => headToHeadFrom(log), [log]);

    const { result: predictionResult, predictedWinType, confidenceLevel } =
        usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells, records, pairs);

    // Kept current during render so the event handlers below log exactly what
    // the screen is showing at that moment.
    predictionRef.current = predictionResult;

    const handleEnterStealthMode = () => { setIsDarkMode(true); setIsStealthMode(true); };

    // Saving a copy is the only destructive-adjacent thing worth offering: the
    // log is the engine's memory and nothing pulls it back from the server.
    const handleExportLog = useCallback(() => {
        const blob = new Blob([JSON.stringify(log, null, 1)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `baccarat-decision-log-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [log]);

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
                    calibration={calibration}
                    {...gameManagement}
                />
                <ScorecardGrid
                    scorecard={scorecard} handleCellClick={handleCellClick}
                    maxRenderableColumns={maxRenderableColumns}
                    highlightedCells={highlightedCells} showAnalytics={showAnalytics}
                    handleDeleteRow={deleteRow}
                />
            </div>

            {isStealthMode && ( <StealthModeView onExit={() => setIsStealthMode(false)} scorecard={scorecard} lastWinRow={lastWinRow} lastPlayedRow={lastPlayedRow} handleCellClick={handleCellClick} recordTie={recordTie} highlightedCells={highlightedCells} calibration={calibration} /> )}

            {showStats && (
                <StatsModal
                    tallies={tallies}
                    log={log}
                    card={gameManagement.currentScorecardName}
                    pendingSync={pendingSync}
                    syncError={syncError}
                    onExportLog={handleExportLog}
                    onClose={() => setShowStats(false)}
                />
            )}
        </div>
    );
}

export default App;
