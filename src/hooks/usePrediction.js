// src/hooks/usePrediction.js
import { useMemo } from 'react';
import { ANALYTICS_PATTERNS } from '../utils/constants';

export const usePrediction = (scorecard, lastWinType, lastWinRow, highlightedCells) => {
    const { predictedWinType, confidenceLevel } = useMemo(() => {
        let prediction = null;
        let isNextRepeater = null;
        let isNextOpposite = null;
        let confidence = 0;
        let ruleApplied = false;

        // --- NEW: Rule of Three Logic ---
        if (lastWinRow >= 3) {
            const lastRow = scorecard[lastWinRow];
            const prevRow = scorecard[lastWinRow - 1];
            const twoRowsAgo = scorecard[lastWinRow - 2];

            // Check for three 'P's in a row
            if (lastRow[0].value === 'O' && prevRow[0].value === 'O' && twoRowsAgo[0].value === 'O') {
                prediction = 'P';
                confidence = 3;
                ruleApplied = true;
            }
            // Check for three 'B's in a row
            else if (lastRow[1].value === 'O' && prevRow[1].value === 'O' && twoRowsAgo[1].value === 'O') {
                prediction = 'B';
                confidence = 3;
                ruleApplied = true;
            }
            // Check for three 'O's (Opposites) in the 'S' column
            else if (lastRow[2].displayValue === 'O' && prevRow[2].displayValue === 'O' && twoRowsAgo[2].displayValue === 'O') {
                prediction = lastWinType === 'P' ? 'B' : 'P';
                confidence = 3;
                ruleApplied = true;
            }
        }

        // --- Fallback to Pattern-Based Logic ---
        if (!ruleApplied && lastWinRow !== -1 && scorecard[lastWinRow]) {
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
            
            // Confidence is the count of highlighted cells in the last row
            for (let col = 3; col < currentRow.length; col++) {
                const cellKey = `${lastWinRow}-${col}`;
                if (highlightedCells.has(cellKey)) {
                    confidence++;
                }
            }

            // Final Prediction from pattern logic
            if (lastWinType === 'P') {
                prediction = isNextRepeater ? 'P' : (isNextOpposite ? 'B' : null);
            } else if (lastWinType === 'B') {
                prediction = isNextRepeater ? 'B' : (isNextOpposite ? 'P' : null);
            }
        }

        return { predictedWinType: prediction, confidenceLevel: confidence };
    }, [scorecard, lastWinType, lastWinRow, highlightedCells]);

    return { predictedWinType, confidenceLevel };
};