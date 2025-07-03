// src/hooks/usePrediction.js
import { useMemo } from 'react';
import { ANALYTICS_PATTERNS } from '../utils/constants';

export const usePrediction = (scorecard, lastWinType, lastWinRow, highlightedCells) => {
    const { predictedWinType, highlightedCount } = useMemo(() => {
        let prediction = null;
        let count = 0; // This will become confidence

        // Ensure we have a valid lastWinRow to base the prediction on
        if (lastWinRow === -1 || !scorecard[lastWinRow]) {
            return { predictedWinType: null, highlightedCount: 0 };
        }

        const currentRow = scorecard[lastWinRow];
        let lastHighlightedCol = -1;
        let lastHighlightedValue = null;
        let patternName = null; // Stores the name of the pattern the last highlighted cell belongs to

        // Find the last highlighted cell in the lastWinRow
        for (let colIdx = currentRow.length - 1; colIdx >= 3; colIdx--) {
            const cellKey = `${lastWinRow}-${colIdx}`;
            if (highlightedCells.has(cellKey)) {
                lastHighlightedCol = colIdx;
                lastHighlightedValue = currentRow[colIdx].value; // Get the numerical value
                patternName = highlightedCells.get(cellKey); // Get the pattern name for this cell
                break;
            }
        }

        // --- MODIFIED COUNTING LOGIC (for Confidence) ---
        // Count all highlighted cells in the lastWinRow based on the specific rule for pattern-1010
        for (let colIdx = 3; colIdx < currentRow.length; colIdx++) {
            const cellKey = `${lastWinRow}-${colIdx}`;
            if (highlightedCells.has(cellKey)) {
                const currentCellPatternName = highlightedCells.get(cellKey); // Get pattern name for the *current* cell
                const cellValue = currentRow[colIdx].value;

                if (currentCellPatternName === 'pattern-1010') {
                    // For pattern-1010, only count if the absolute value is 1 (i.e., 1 or -1)
                    // If it is, add 3 to the confidence score.
                    if (Math.abs(cellValue) === 1) {
                        count += 3; // MODIFIED: +3 for 1 or -1 in pattern-1010
                    }
                    // Cells with value 0 in pattern-1010 are not counted, as per previous request.
                } else {
                    // For all other patterns, add 1 to the confidence score for any highlighted cell.
                    count++; // +1 for other patterns
                }
            }
        }
        // --- END OF MODIFIED COUNTING LOGIC ---


        // If no highlighted pattern found, no prediction can be made
        if (lastHighlightedCol === -1 || lastHighlightedValue === null || patternName === null) {
            return { predictedWinType: null, highlightedCount: count };
        }

        // Find the pattern definition
        const patternDef = ANALYTICS_PATTERNS.find(p => p.name === patternName);
        if (!patternDef) {
            return { predictedWinType: null, highlightedCount: count };
        }

        let isNextRepeater = false;

        // Prediction logic for repeating patterns
        if (patternDef.isRepeating) {
            const patternSeq = patternDef.seq;
            // Find the index of the absolute value of the last highlighted cell in the pattern sequence
            const lastIndexInPatternSeq = patternSeq.indexOf(Math.abs(lastHighlightedValue));

            if (lastIndexInPatternSeq !== -1) {
                const nextIndexInPatternSeq = (lastIndexInPatternSeq + 1) % patternSeq.length;
                const expectedNextAbsValue = patternSeq[nextIndexInPatternSeq];

                // Logic to determine if the next step in the pattern implies a 'repeater' or 'opposite' win
                if (expectedNextAbsValue === 0) {
                    isNextRepeater = false; // Always opposite for a 0 following a non-zero.
                } else if (Math.abs(lastHighlightedValue) === 0) {
                    isNextRepeater = true; // After 0, a non-zero typically implies a repeater.
                } else {
                    // For patterns like 121, 232, where values change by +/-1
                    if (expectedNextAbsValue === Math.abs(lastHighlightedValue) - 1) {
                        isNextRepeater = true; // Value decreases (e.g., 2 -> 1), implies repeater
                    } else if (expectedNextAbsValue === Math.abs(lastHighlightedValue) + 1) {
                        isNextRepeater = false; // Value increases (e.g., 1 -> 2), implies opposite
                    } else {
                        isNextRepeater = false; // Default if not clear
                    }
                }
            }
        } else { // Prediction logic for non-repeating patterns like 343
            const patternSeq = patternDef.seq;
            const lastIndexInPatternSeq = patternSeq.indexOf(Math.abs(lastHighlightedValue));

            if (lastIndexInPatternSeq !== -1 && lastIndexInPatternSeq < patternSeq.length - 1) {
                // If it's not the last element of the fixed sequence, predict the next in sequence
                const expectedNextAbsValue = patternSeq[lastIndexInPatternSeq + 1];
                if (expectedNextAbsValue === Math.abs(lastHighlightedValue) - 1) {
                    isNextRepeater = true; // Value decreases (e.g., 4 -> 3), implies repeater
                } else if (expectedNextAbsValue === Math.abs(lastHighlightedValue) + 1) {
                    isNextRepeater = false; // Value increases (e.g., 3 -> 4), implies opposite
                } else {
                    isNextRepeater = false; // Default if not clear
                }
            } else {
                // If it's the last element of a non-repeating pattern, the pattern "ends".
                // We can't predict a continuation of *this* pattern specifically.
                return { predictedWinType: null, highlightedCount: count };
            }
        }

        // Determine predicted win type based on lastWinType and whether the next step is a repeater
        if (lastWinType === 'P') {
            prediction = isNextRepeater ? 'P' : 'B';
        } else if (lastWinType === 'B') {
            prediction = isNextRepeater ? 'B' : 'P';
        }

        return { predictedWinType: prediction, highlightedCount: count };
    }, [scorecard, lastWinType, lastWinRow, highlightedCells]);

    return { predictedWinType, highlightedCount };
};