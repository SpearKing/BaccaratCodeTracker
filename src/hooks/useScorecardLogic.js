// src/hooks/useScorecardLogic.js
import { useState, useCallback, useMemo } from 'react';
import { NUM_INITIAL_ROWS, NUM_INITIAL_COLUMNS, X_MARK_THRESHOLD, ALL_SAVED_SCORECARDS_KEY, LAST_ACTIVE_SCORECARD_NAME_KEY, DEFAULT_GAME_NAME } from '../utils/constants';

export const useScorecardLogic = () => {
    const [scorecard, setScorecard] = useState(() => {
        const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
        const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;

        if (savedGames[lastActiveName]) {
            const { scorecard } = savedGames[lastActiveName];
            return scorecard;
        }

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
        return initialScorecard;
    });

    const [lastWinType, setLastWinType] = useState(() => {
        const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
        const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
        return savedGames[lastActiveName]?.lastWinType || null;
    });

    const [lastWinRow, setLastWinRow] = useState(() => {
        const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
        const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
        return savedGames[lastActiveName]?.lastWinRow || -1;
    });


    const findNextAvailableCol = useCallback((scorecardRow) => {
        for (let col = 3; col < scorecardRow.length; col++) {
            if (scorecardRow[col].value === null && scorecardRow[col].displayValue === '') {
                return col;
            }
        }
        return -1;
    }, []);

    const calculateSingleRow = useCallback((currentScorecard, rowIdx, winType, prevWinType) => {
        if (rowIdx === 0) return currentScorecard;

        let newScorecard = JSON.parse(JSON.stringify(currentScorecard));

        let currentRow = newScorecard[rowIdx];
        let rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null;

        currentRow[0] = { ...currentRow[0], value: '', displayValue: '' };
        currentRow[1] = { ...currentRow[1], value: '', displayValue: '' };
        currentRow[2] = { ...currentRow[2], displayValue: '' };

        if (winType === 'P') {
            currentRow[0] = { ...currentRow[0], value: 'O', displayValue: 'O' };
        } else if (winType === 'B') {
            currentRow[1] = { ...currentRow[1], value: 'O', displayValue: 'O' };
        }

        const isRepeater = winType === prevWinType;
        if (winType) {
            currentRow[2].displayValue = isRepeater ? 'R' : 'O';
        } else {
            currentRow[2].displayValue = '';
        }

        if (!winType) {
            for (let i = 3; i < currentRow.length; i++) {
                currentRow[i] = { ...currentRow[i], value: null, displayValue: '' };
            }
            return newScorecard;
        }

        let previousColHasValueInSequence = true;
        for (let col = 3; col < currentRow.length; col++) {
            const cellAbove = rowIdx > 0 ? newScorecard[rowIdx - 1][col] : null;

            currentRow[col] = { ...currentRow[col], value: null, displayValue: '' };

            if (cellAbove && cellAbove.displayValue === 'X') {
                currentRow[col].displayValue = 'X';
                previousColHasValueInSequence = false;
                continue;
            }

            if (cellAbove && cellAbove.value !== null && cellAbove.displayValue !== 'X') {
                let newValue;
                if (isRepeater) {
                    newValue = cellAbove.value - 1;
                } else {
                    newValue = cellAbove.value + 1;
                }

                if (Math.abs(cellAbove.value) >= X_MARK_THRESHOLD) {
                    currentRow[col] = { ...currentRow[col], value: null, displayValue: 'X' };
                    if (rowBelow && col < rowBelow.length) {
                        rowBelow[col] = { ...rowBelow[col], value: null, displayValue: 'X' };
                    }
                    previousColHasValueInSequence = false;
                } else {
                    currentRow[col] = { ...currentRow[col], value: newValue, displayValue: newValue.toString() };
                    previousColHasValueInSequence = true;
                }
            } else if (col === 3 && previousColHasValueInSequence) {
                currentRow[col] = {
                    ...currentRow[col],
                    value: isRepeater ? -1 : 1,
                    displayValue: isRepeater ? '-1' : '1'
                };
                previousColHasValueInSequence = true;
            } else {
                currentRow[col] = { ...currentRow[col], value: null, displayValue: '' };
                previousColHasValueInSequence = false;
            }
        }

        const finalCurrentRowForMissingCheck = newScorecard[rowIdx];
        const rowHasOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '1');
        const rowHasMinusOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '-1');

        if (!rowHasOne) {
            let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]);
            if (nextAvailCol === -1) {
                newScorecard = newScorecard.map(r => {
                    const newR = [...r];
                    newR.push({ type: 'Number', value: null, editable: false, displayValue: '' });
                    return newR;
                });
                currentRow = newScorecard[rowIdx];
                rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null;
                nextAvailCol = newScorecard[rowIdx].length - 1;
            }
            newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: 1, displayValue: '1' };
        }

        if (!rowHasMinusOne) {
            let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]);
            if (nextAvailCol === -1) {
                newScorecard = newScorecard.map(r => {
                    const newR = [...r];
                    newR.push({ type: 'Number', value: null, editable: false, displayValue: '' });
                    return newR;
                });
                currentRow = newScorecard[rowIdx];
                rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null;
                nextAvailCol = newScorecard[rowIdx].length - 1;
            }
            newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: -1, displayValue: '-1' };
        }

        return newScorecard;
    }, [X_MARK_THRESHOLD, findNextAvailableCol]);


    const recalculateFromRow = useCallback((startingRowIdx, initialScorecardState) => {
        let currentScorecardState = JSON.parse(JSON.stringify(initialScorecardState));
        let currentLastWinType = null;

        for (let r = startingRowIdx - 1; r >= 1; r--) {
            if (currentScorecardState[r][0].value === 'O') {
                currentLastWinType = 'P';
                break;
            } else if (currentScorecardState[r][1].value === 'O') {
                currentLastWinType = 'B';
                break;
            }
        }

        for (let r = startingRowIdx; r <= NUM_INITIAL_ROWS; r++) {
            if (!currentScorecardState[r]) {
                break;
            }

            const pCell = currentScorecardState[r][0];
            const bCell = currentScorecardState[r][1];

            let winTypeInCurrentRow = null;
            if (pCell.value === 'O') {
                winTypeInCurrentRow = 'P';
            } else if (bCell.value === 'O') {
                winTypeInCurrentRow = 'B';
            }

            currentScorecardState = calculateSingleRow(
                currentScorecardState,
                r,
                winTypeInCurrentRow,
                currentLastWinType
            );

            if (winTypeInCurrentRow) {
                currentLastWinType = winTypeInCurrentRow;
            }
        }

        let finalLastWinType = null;
        let finalLastWinRow = -1;
        for (let r = NUM_INITIAL_ROWS; r >= 1; r--) {
            if (currentScorecardState[r][0].value === 'O') {
                finalLastWinType = 'P';
                finalLastWinRow = r;
                break;
            } else if (currentScorecardState[r][1].value === 'O') {
                finalLastWinType = 'B';
                finalLastWinRow = r;
                break;
            }
        }

        setScorecard(currentScorecardState);
        setLastWinType(finalLastWinType);
        setLastWinRow(finalLastWinRow);

    }, [calculateSingleRow, NUM_INITIAL_ROWS]);

    const handleCellClick = useCallback((rowIdx, colIdx) => {
        if (rowIdx === 0) return;

        const currentScorecardCopy = JSON.parse(JSON.stringify(scorecard));

        const clickedCellHasO = currentScorecardCopy[rowIdx][colIdx].value === 'O';

        currentScorecardCopy[rowIdx][0] = { ...currentScorecardCopy[rowIdx][0], value: '', displayValue: '' };
        currentScorecardCopy[rowIdx][1] = { ...currentScorecardCopy[rowIdx][1], value: '', displayValue: '' };
        currentScorecardCopy[rowIdx][2] = { ...currentScorecardCopy[rowIdx][2], displayValue: '' };

        if (!clickedCellHasO) {
            currentScorecardCopy[rowIdx][colIdx] = { ...currentScorecardCopy[rowIdx][colIdx], value: 'O', displayValue: 'O' };
        }

        recalculateFromRow(rowIdx, currentScorecardCopy);

    }, [scorecard, recalculateFromRow]);

    const resetScorecard = useCallback((confirm = true) => {
        if (confirm && !window.confirm("Are you sure you want to reset the scorecard? This action cannot be undone.")) {
            return;
        }
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
        // Do NOT reset currentScorecardName or saveGameInput here
        // These are handled by useGameManagement or App.js if it's the default game

        // This reset should also clear the default game from local storage if it's the one being reset
        const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
        if (savedGames[DEFAULT_GAME_NAME]) {
            delete savedGames[DEFAULT_GAME_NAME];
            localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(savedGames));
        }

    }, []); // No dependencies on scorecard/lastWinType/lastWinRow for a hard reset

    // Max renderable columns logic
    const maxRenderableColumns = useMemo(() => {
        let maxContentColIndex = 3 + NUM_INITIAL_COLUMNS - 1;
        scorecard.forEach(row => {
            for (let i = 3; i < row.length; i++) {
                if (row[i].displayValue !== '' || row[i].value !== null) {
                    maxContentColIndex = Math.max(maxContentColIndex, i);
                }
            }
        });
        return maxContentColIndex + 1;
    }, [scorecard, NUM_INITIAL_COLUMNS]);

    return {
        scorecard,
        setScorecard,
        lastWinType,
        setLastWinType,
        lastWinRow, // Ensure this is returned
        setLastWinRow,
        handleCellClick,
        resetScorecard,
        maxRenderableColumns,
    };
};