// src/hooks/usePrediction.js
import { useMemo } from 'react';
import { ANALYTICS_PATTERNS } from '../utils/constants';

export const usePrediction = (scorecard, lastWinType, lastWinRow, highlightedCells) => {
    const { predictedWinType, highlightedCount } = useMemo(() => {
        let prediction = null;
        let count = 0; // This will become confidence

        // --- Console Logs: Input Debug ---
        console.log('--- usePrediction Input Debug ---');
        console.log('Input lastWinType:', lastWinType);
        console.log('Input lastWinRow:', lastWinRow);
        console.log('Input highlightedCells Map:', highlightedCells);
        console.log('-------------------------------');

        if (lastWinRow === -1 || !scorecard[lastWinRow]) {
            console.log('No valid lastWinRow found. Returning null prediction.');
            return { predictedWinType: null, highlightedCount: 0 };
        }

        const currentRow = scorecard[lastWinRow];
        let lastHighlightedCol = -1;
        let lastHighlightedValue = null;
        let patternName = null;

        // Find the last highlighted cell in the lastWinRow (scanning from right to left)
        for (let colIdx = currentRow.length - 1; colIdx >= 3; colIdx--) {
            const cellKey = `${lastWinRow}-${colIdx}`;
            if (highlightedCells.has(cellKey)) {
                lastHighlightedCol = colIdx;
                lastHighlightedValue = currentRow[colIdx].value;

                console.log(`DEBUG: Value read from scorecard[${lastWinRow}][${colIdx}].value (at source):`, lastHighlightedValue);

                patternName = highlightedCells.get(cellKey);
                // --- Console Logs: Determined Values ---
                console.log('Determined lastHighlightedCol:', lastHighlightedCol);
                console.log('Determined lastHighlightedValue (from scorecard):', lastHighlightedValue);
                console.log('Determined patternName for lastHighlightedCell:', patternName);

                break; // Stop at the first (rightmost) highlighted cell in the lastWinRow
            }
        }

        // If no highlighted pattern found in lastWinRow, no prediction can be made from this hook's logic
        if (lastHighlightedCol === -1 || lastHighlightedValue === null || patternName === null) {
            console.log('No highlighted pattern found in lastWinRow for prediction. Returning null prediction.');
            return { predictedWinType: null, highlightedCount: count };
        }

        const patternDef = ANALYTICS_PATTERNS.find(p => p.name === patternName);
        if (!patternDef) {
            console.log('Pattern definition not found for:', patternName);
            return { predictedWinType: null, highlightedCount: count };
        }

        // --- CHANGED: Initialize to null to clearly see if they are set ---
        let isNextRepeater = null;
        let isNextOpposite = null;
        // -----------------------------------------------------------------

        // Prediction logic for repeating patterns
        if (patternDef.isRepeating) {
            console.log('DEBUG: Entering repeating pattern logic. Pattern Name:', patternDef.name);

            if (patternDef.name === 'pattern-1010') {
                console.log('--- Inside pattern-1010 decision logic ---');
                console.log('lastHighlightedValue at decision point:', lastHighlightedValue);

                // Pattern 1010 logic: Alternating between P/B win (1 or -1) and Tie (0).
                // If last value was a P/B win, pattern suggests next is a Tie (no P/B prediction).
                // If last value was a Tie, pattern suggests next is a P/B win, which is a REPEATER (same as lastWinType).
                if (Number(lastHighlightedValue) === 1 || Number(lastHighlightedValue) === -1) {
                    console.log('DEBUG: For pattern-1010, last was P/B win. Predicting null (Tie expected).');
                    // If the pattern indicates a Tie as the next event, we return null for P/B prediction.
                    return { predictedWinType: null, highlightedCount: count }; // Early exit
                } else if (Number(lastHighlightedValue) === 0) {
                    console.log('DEBUG: For pattern-1010, last was Tie. Predicting repeater P/B win.');
                    isNextRepeater = true; // The next P/B winner should be the same as lastWinType
                    isNextOpposite = false;
                } else {
                    console.log('DEBUG: Unexpected lastHighlightedValue for pattern-1010. Defaulting to no prediction.');
                    isNextRepeater = false;
                    isNextOpposite = false;
                }
                console.log('After 1010 decision: lastHighlightedValue type:', typeof lastHighlightedValue, 'value:', lastHighlightedValue);
            } else { // This block is for other repeating patterns (121, 232, 343)
                console.log("DEBUG: Entered ELSE block for OTHER repeating patterns (NOT pattern-1010)");
                if (lastHighlightedValue === patternDef.sequence[patternDef.sequence.length - 1]) {
                    isNextRepeater = true;
                    isNextOpposite = false;
                } else {
                    isNextRepeater = false;
                    isNextOpposite = true;
                }
            }
        } else { // This block is for non-repeating patterns
            console.log("DEBUG: Entered ELSE block for non-repeating patterns");
            isNextRepeater = false;
            isNextOpposite = false;
        }


        // --- NEW/CORRECTED COUNTING LOGIC (for Confidence) ---
        console.log('Debugging highlightedCells before confidence loop:', Array.from(highlightedCells.entries()));
        for (let [cellKey, currentCellPatternName] of highlightedCells.entries()) {
            if (currentCellPatternName === null || currentCellPatternName === undefined) {
                console.warn(`Skipping cellKey ${cellKey} in confidence calculation due to null/undefined patternName.`);
                continue;
            }

            if (currentCellPatternName === patternName) {
                const [rowIdxStr, colIdxStr] = cellKey.split('-');
                const cellRowIdx = parseInt(rowIdxStr);
                const cellColIdx = parseInt(colIdxStr);

                if (scorecard[cellRowIdx] && scorecard[cellRowIdx][cellColIdx] && scorecard[cellRowIdx][cellColIdx].value !== null) {
                    const cellValue = scorecard[cellRowIdx][cellColIdx].value;

                    if (patternName === 'pattern-1010') {
                        if (Math.abs(cellValue) === 1) {
                            count += 3;
                        }
                    } else {
                        count++;
                    }
                }
            }
        }
        // --- END NEW/CORRECTED COUNTING LOGIC ---


        // Determine predicted win type based on lastWinType and the determined Repeater/Opposite status
        if (lastWinType === 'P') {
            prediction = isNextRepeater ? 'P' : (isNextOpposite ? 'B' : null);
        } else if (lastWinType === 'B') {
            prediction = isNextRepeater ? 'B' : (isNextOpposite ? 'P' : null);
        }

        // --- Console Logs: Final Output ---
        console.log('--- usePrediction Final Output ---');
        console.log('Final isNextRepeater:', isNextRepeater);
        console.log('Final isNextOpposite:', isNextOpposite);
        console.log('Calculated predictedWinType:', prediction);
        console.log('Calculated highlightedCount (confidence):', count);
        console.log('---------------------------------');

        return { predictedWinType: prediction, highlightedCount: count };
    }, [scorecard, lastWinType, lastWinRow, highlightedCells]);

    return { predictedWinType, highlightedCount };
};