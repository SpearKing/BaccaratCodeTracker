// src/hooks/usePrediction.js
import { useMemo } from 'react';
import { ANALYTICS_PATTERNS } from '../utils/constants';

export const usePrediction = (scorecard, lastWinType, lastWinRow, highlightedCells) => {
    const { predictedWinType, confidenceLevel } = useMemo(() => {
        let prediction = null;
        let isNextRepeater = null;
        let isNextOpposite = null;

        // --- Prediction Logic (No changes needed here) ---
        if (lastWinRow !== -1 && scorecard[lastWinRow]) {
            const currentRow = scorecard[lastWinRow];
            let lastHighlightedCol = -1;
            let patternName = null;

            for (let colIdx = currentRow.length - 1; colIdx >= 3; colIdx--) {
                const cellKey = `${lastWinRow}-${colIdx}`;
                if (highlightedCells.has(cellKey)) {
                    lastHighlightedCol = colIdx;
                    patternName = highlightedCells.get(cellKey);
                    break;
                }
            }

            if (lastHighlightedCol !== -1 && patternName !== null) {
                const patternDef = ANALYTICS_PATTERNS.find(p => p.name === patternName);
                if (patternDef && patternDef.isRepeating) {
                    const n2_value = scorecard[lastWinRow]?.[lastHighlightedCol]?.value;
                    let n1_value = null;

                    for (let row = lastWinRow - 1; row >= 1; row--) {
                        const cellKey = `${row}-${lastHighlightedCol}`;
                        if (highlightedCells.get(cellKey) === patternName) {
                            const cellValue = scorecard[row]?.[lastHighlightedCol]?.value;
                            if (typeof cellValue === 'number') {
                                n1_value = cellValue;
                                break;
                            }
                        }
                    }

                    if (n1_value !== null && n2_value !== null) {
                        const absN1 = n1_value;
                        const absN2 = n2_value;

                        if (absN2 - 1 === absN1) {
                            isNextRepeater = true;
                            isNextOpposite = false;
                        } else if (absN2 + 1 === absN1) {
                            isNextRepeater = false;
                            isNextOpposite = true;
                        }
                    }
                }
            }
        }

        // --- FINAL, SIMPLIFIED Confidence Calculation ---
        let calculatedConfidence = 0;
        // The confidence is a direct count of the number of highlighted cells in the last winning row.
        if (lastWinRow !== -1 && scorecard[lastWinRow]) {
            for (let col = 3; col < scorecard[lastWinRow].length; col++) {
                const cellKey = `${lastWinRow}-${col}`;
                if (highlightedCells.has(cellKey)) {
                    calculatedConfidence++;
                }
            }
        }
        
        // --- Final Prediction ---
        if (lastWinType === 'P') {
            prediction = isNextRepeater ? 'P' : (isNextOpposite ? 'B' : null);
        } else if (lastWinType === 'B') {
            prediction = isNextRepeater ? 'B' : (isNextOpposite ? 'P' : null);
        }

        return { predictedWinType: prediction, confidenceLevel: calculatedConfidence };
    }, [scorecard, lastWinType, lastWinRow, highlightedCells]);

    return { predictedWinType, confidenceLevel };
};