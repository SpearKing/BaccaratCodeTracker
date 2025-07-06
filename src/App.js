// src/App.js
import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import { useTheme } from './hooks/useTheme';
import { useAnalytics } from './hooks/useAnalytics';
import { useScorecardLogic } from './hooks/useScorecardLogic';
import { useGameManagement } from './hooks/useGameManagement';
import { usePrediction } from './hooks/usePrediction';
import ScorecardGrid from './components/ScorecardGrid';
import ControlPanel from './components/ControlPanel';
import StealthModeView from './components/StealthModeView';
import StatsModal from './components/StatsModal';
import { ANALYTICS_PATTERNS } from './utils/constants';

function App() {
    const [showControls, setShowControls] = useState(false);
    const [isStealthMode, setIsStealthMode] = useState(false);
    const [showStats, setShowStats] = useState(false);
    
    const [stats, setStats] = useState(() => {
        const initialPatternStats = new Map();
        ANALYTICS_PATTERNS.forEach(p => initialPatternStats.set(p.name, { count: 0, wins: 0, losses: 0 }));
        return { pWins: 0, bWins: 0, predictions: { correct: 0, wrong: 0 }, patternStats: initialPatternStats };
    });

    const {
        scorecard, setScorecard, lastWinType, setLastWinType, lastWinRow,
        setLastWinRow, handleCellClick, resetScorecard, maxRenderableColumns,
    } = useScorecardLogic(stats, setStats);

    const { isDarkMode, setIsDarkMode } = useTheme();
    const { showAnalytics, setShowAnalytics, highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);
    
    const gameManagement = useGameManagement(
        scorecard, lastWinType, lastWinRow, setScorecard,
        setLastWinType, setLastWinRow, resetScorecard, stats, setStats
    );

    const { predictedWinType, confidenceLevel } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);

    // MODIFIED: Added `stats` to the dependency array
    useEffect(() => {
        let pWins = 0;
        let bWins = 0;
        if (scorecard && scorecard.length > 0) {
            for (let i = 1; i < scorecard.length; i++) {
                if (scorecard[i][0].value === 'O') pWins++;
                if (scorecard[i][1].value === 'O') bWins++;
            }
        }
        // Check if stats have actually changed to prevent infinite loops
        if (stats.pWins !== pWins || stats.bWins !== bWins) {
            setStats(prevStats => ({...prevStats, pWins, bWins}));
        }
    }, [scorecard, stats]); // Added stats dependency

    const handleEnterStealthMode = () => { setIsDarkMode(true); setIsStealthMode(true); };
    
    const handleFullReset = useCallback(() => {
        if (window.confirm("Are you sure you want to start a new game?")) {
            gameManagement.resetGameManagementState();
            const initialPatternStats = new Map();
            ANALYTICS_PATTERNS.forEach(p => initialPatternStats.set(p.name, { count: 0, wins: 0, losses: 0 }));
            setStats({ pWins: 0, bWins: 0, predictions: { correct: 0, wrong: 0 }, patternStats: initialPatternStats });
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
                    predictedWinType={predictedWinType} confidenceLevel={confidenceLevel}
                    {...gameManagement}
                />
                <ScorecardGrid
                    scorecard={scorecard} handleCellClick={handleCellClick}
                    maxRenderableColumns={maxRenderableColumns}
                    highlightedCells={highlightedCells} showAnalytics={showAnalytics}
                />
            </div>

            {isStealthMode && ( <StealthModeView onExit={() => setIsStealthMode(false)} scorecard={scorecard} lastWinRow={lastWinRow} handleCellClick={handleCellClick} highlightedCells={highlightedCells} /> )}
            
            {showStats && ( <StatsModal stats={stats} onClose={() => setShowStats(false)} /> )}
        </div>
    );
}

export default App;