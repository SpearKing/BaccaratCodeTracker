// src/hooks/useScorecardLogic.js
import { useState, useCallback, useMemo, useEffect } from 'react';
import { NUM_INITIAL_COLUMNS } from '../utils/constants';
import { createInitialScorecard, calculateSingleRow } from '../engine/grid';
import { usePrediction } from './usePrediction';
import { useAnalytics } from './useAnalytics';
import config from '../config';


export const useScorecardLogic = (stats, setStats) => {
    const [scorecard, setScorecard] = useState(createInitialScorecard);
    const [lastWinType, setLastWinType] = useState(null);
    const [lastWinRow, setLastWinRow] = useState(-1);

    useEffect(() => { try { const savedGames = JSON.parse(localStorage.getItem('baccarat_all_saved_scorecards') || '{}'); const lastActiveName = localStorage.getItem('baccarat_last_active_scorecard_name') || 'Last Session'; if (savedGames[lastActiveName]) { setScorecard(savedGames[lastActiveName].scorecard || createInitialScorecard()); setLastWinType(savedGames[lastActiveName].lastWinType || null); setLastWinRow(savedGames[lastActiveName].lastWinRow || -1); } } catch (error) { console.error("Failed to load from local storage", error); } }, []);

    const maxRenderableColumns = useMemo(() => { let maxContentColIndex = 3 + NUM_INITIAL_COLUMNS - 1; if (scorecard) { scorecard.forEach(row => { for (let i = 3; i < row.length; i++) { if (row[i].displayValue !== '' || row[i].value !== null) { maxContentColIndex = Math.max(maxContentColIndex, i); } } }); } return maxContentColIndex + 1; }, [scorecard]);
    
    const { highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);
    const { predictedWinType } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);
    
    const handleCellClick = useCallback((rowIdx, colIdx) => {
        if (rowIdx === 0) return;

        const predictionForThisRow = predictedWinType;
        const newActualWinType = colIdx === 0 ? 'P' : 'B';
        const oldActualWinType = scorecard[rowIdx][0].value === 'O' ? 'P' : (scorecard[rowIdx][1].value === 'O' ? 'B' : null);

        if (predictionForThisRow && lastWinRow === rowIdx - 1) {
            setStats(currentStats => {
                const newStats = { ...currentStats, predictions: { ...currentStats.predictions }, patternStats: new Map(currentStats.patternStats) };
                if (oldActualWinType && oldActualWinType !== newActualWinType) {
                    const wasOldResultCorrect = predictionForThisRow === oldActualWinType;
                    if (wasOldResultCorrect) { newStats.predictions.correct = Math.max(0, newStats.predictions.correct - 1); } else { newStats.predictions.wrong = Math.max(0, newStats.predictions.wrong - 1); }
                    if (config.capturePatternStats) {
                        const activePatterns = new Set();
                        if (lastWinRow > 0 && scorecard[lastWinRow]) { for (let col = 3; col < scorecard[lastWinRow].length; col++) { const cellKey = `${lastWinRow}-${col}`; if (highlightedCells.has(cellKey)) { activePatterns.add(highlightedCells.get(cellKey)); } } }
                        activePatterns.forEach(pName => { const patternData = newStats.patternStats.get(pName); if (patternData) { if (wasOldResultCorrect) { patternData.wins = Math.max(0, patternData.wins - 1); } else { patternData.losses = Math.max(0, patternData.losses - 1); } } });
                    }
                }
                const isNewResultCorrect = predictionForThisRow === newActualWinType;
                if (isNewResultCorrect) { newStats.predictions.correct++; } else { newStats.predictions.wrong++; }
                if (config.capturePatternStats) {
                    const activePatterns = new Set();
                    if (lastWinRow > 0 && scorecard[lastWinRow]) { for (let col = 3; col < scorecard[lastWinRow].length; col++) { const cellKey = `${lastWinRow}-${col}`; if (highlightedCells.has(cellKey)) { activePatterns.add(highlightedCells.get(cellKey)); } } }
                    activePatterns.forEach(pName => { const patternData = newStats.patternStats.get(pName); if (patternData) { if (isNewResultCorrect) { patternData.wins++; } else { patternData.losses++; } } });
                }
                return newStats;
            });
        }

        const currentScorecardCopy = JSON.parse(JSON.stringify(scorecard));
        let prevWinTypeForCalc = null;
        for (let r = rowIdx - 1; r >= 1; r--) { if (currentScorecardCopy[r][0].value === 'O') { prevWinTypeForCalc = 'P'; break; } else if (currentScorecardCopy[r][1].value === 'O') { prevWinTypeForCalc = 'B'; break; } }
        currentScorecardCopy[rowIdx][0] = { ...currentScorecardCopy[rowIdx][0], value: '', displayValue: '' };
        currentScorecardCopy[rowIdx][1] = { ...currentScorecardCopy[rowIdx][1], value: '', displayValue: '' };
        currentScorecardCopy[rowIdx][colIdx] = { ...currentScorecardCopy[rowIdx][colIdx], value: 'O', displayValue: 'O' };
        
        let finalScorecard = calculateSingleRow(currentScorecardCopy, rowIdx, newActualWinType, prevWinTypeForCalc);
        setScorecard(finalScorecard);
        setLastWinType(newActualWinType);
        setLastWinRow(rowIdx);
    // MODIFIED: Removed unnecessary dependencies
    }, [scorecard, lastWinRow, predictedWinType, highlightedCells, setStats]);
    
    const resetScorecard = useCallback(() => { setScorecard(createInitialScorecard()); setLastWinType(null); setLastWinRow(-1); }, []);

    return { scorecard, setScorecard, lastWinType, setLastWinType, lastWinRow, setLastWinRow, handleCellClick, resetScorecard, maxRenderableColumns };
};