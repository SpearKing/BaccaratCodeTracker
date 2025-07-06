// src/hooks/useScorecardLogic.js
import { useState, useCallback, useMemo, useEffect } from 'react';
import { NUM_INITIAL_ROWS, NUM_INITIAL_COLUMNS, X_MARK_THRESHOLD } from '../utils/constants';
import { usePrediction } from './usePrediction';
import { useAnalytics } from './useAnalytics';
import config from '../config';

const createInitialScorecard = () => { const initialScorecard = []; for (let i = 0; i < NUM_INITIAL_ROWS + 1; i++) { const row = []; row.push({ type: 'P', value: '', editable: true, displayValue: '' }); row.push({ type: 'B', value: '', editable: true, displayValue: '' }); row.push({ type: 'S', value: '', editable: false, displayValue: '' }); for (let j = 0; j < NUM_INITIAL_COLUMNS; j++) { row.push({ type: 'Number', value: null, editable: false, displayValue: '' }); } initialScorecard.push(row); } return initialScorecard; };

export const useScorecardLogic = (stats, setStats) => {
    const [scorecard, setScorecard] = useState(createInitialScorecard);
    const [lastWinType, setLastWinType] = useState(null);
    const [lastWinRow, setLastWinRow] = useState(-1);

    useEffect(() => { try { const savedGames = JSON.parse(localStorage.getItem('baccarat_all_saved_scorecards') || '{}'); const lastActiveName = localStorage.getItem('baccarat_last_active_scorecard_name') || 'Last Session'; if (savedGames[lastActiveName]) { setScorecard(savedGames[lastActiveName].scorecard || createInitialScorecard()); setLastWinType(savedGames[lastActiveName].lastWinType || null); setLastWinRow(savedGames[lastActiveName].lastWinRow || -1); } } catch (error) { console.error("Failed to load from local storage", error); } }, []);

    const maxRenderableColumns = useMemo(() => { let maxContentColIndex = 3 + NUM_INITIAL_COLUMNS - 1; if (scorecard) { scorecard.forEach(row => { for (let i = 3; i < row.length; i++) { if (row[i].displayValue !== '' || row[i].value !== null) { maxContentColIndex = Math.max(maxContentColIndex, i); } } }); } return maxContentColIndex + 1; }, [scorecard]);
    
    const { highlightedCells } = useAnalytics(scorecard, maxRenderableColumns);
    const { predictedWinType } = usePrediction(scorecard, lastWinType, lastWinRow, highlightedCells);
    const findNextAvailableCol = useCallback((scorecardRow) => { for (let col = 3; col < scorecardRow.length; col++) { if (scorecardRow[col].value === null && scorecardRow[col].displayValue === '') { return col; } } return -1; }, []);
    const calculateSingleRow = useCallback((currentScorecard, rowIdx, winType, prevWinType) => { if (rowIdx === 0) return currentScorecard; let newScorecard = JSON.parse(JSON.stringify(currentScorecard)); let currentRow = newScorecard[rowIdx]; let rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null; currentRow[0] = { ...currentRow[0], value: '', displayValue: '' }; currentRow[1] = { ...currentRow[1], value: '', displayValue: '' }; currentRow[2] = { ...currentRow[2], displayValue: '' }; if (winType === 'P') { currentRow[0] = { ...currentRow[0], value: 'O', displayValue: 'O' }; } else if (winType === 'B') { currentRow[1] = { ...currentRow[1], value: 'O', displayValue: 'O' }; } const isRepeater = winType === prevWinType; if (winType) { currentRow[2].displayValue = isRepeater ? 'R' : 'O'; } else { currentRow[2].displayValue = ''; } if (!winType) { for (let i = 3; i < currentRow.length; i++) { currentRow[i] = { ...currentRow[i], value: null, displayValue: '' }; } return newScorecard; } let previousColHasValueInSequence = true; for (let col = 3; col < currentRow.length; col++) { const cellAbove = rowIdx > 0 ? newScorecard[rowIdx - 1][col] : null; currentRow[col] = { ...currentRow[col], value: null, displayValue: '' }; if (cellAbove && cellAbove.displayValue === 'X') { currentRow[col].displayValue = 'X'; previousColHasValueInSequence = false; continue; } if (cellAbove && cellAbove.value !== null && cellAbove.displayValue !== 'X') { let newValue; if (isRepeater) { newValue = cellAbove.value - 1; } else { newValue = cellAbove.value + 1; } if (Math.abs(cellAbove.value) >= X_MARK_THRESHOLD) { currentRow[col] = { ...currentRow[col], value: null, displayValue: 'X' }; if (rowBelow && col < rowBelow.length) { rowBelow[col] = { ...rowBelow[col], value: null, displayValue: 'X' }; } previousColHasValueInSequence = false; } else { currentRow[col] = { ...currentRow[col], value: newValue, displayValue: newValue.toString() }; previousColHasValueInSequence = true; } } else if (col === 3 && previousColHasValueInSequence) { currentRow[col] = { ...currentRow[col], value: isRepeater ? -1 : 1, displayValue: isRepeater ? '-1' : '1' }; previousColHasValueInSequence = true; } else { currentRow[col] = { ...currentRow[col], value: null, displayValue: '' }; previousColHasValueInSequence = false; } } const finalCurrentRowForMissingCheck = newScorecard[rowIdx]; const rowHasOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '1'); const rowHasMinusOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '-1'); if (!rowHasOne) { let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]); if (nextAvailCol === -1) { newScorecard = newScorecard.map(r => { const newR = [...r]; newR.push({ type: 'Number', value: null, editable: false, displayValue: '' }); return newR; }); nextAvailCol = newScorecard[rowIdx].length - 1; } newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: 1, displayValue: '1' }; } if (!rowHasMinusOne) { let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]); if (nextAvailCol === -1) { newScorecard = newScorecard.map(r => { const newR = [...r]; newR.push({ type: 'Number', value: null, editable: false, displayValue: '' }); return newR; }); nextAvailCol = newScorecard[rowIdx].length - 1; } newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: -1, displayValue: '-1' }; } return newScorecard; }, [findNextAvailableCol]);
    
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
    }, [scorecard, lastWinRow, predictedWinType, highlightedCells, setStats, calculateSingleRow]);
    
    const resetScorecard = useCallback(() => { setScorecard(createInitialScorecard()); setLastWinType(null); setLastWinRow(-1); }, []);
    
    return { scorecard, setScorecard, lastWinType, setLastWinType, lastWinRow, setLastWinRow, handleCellClick, resetScorecard, maxRenderableColumns };
};