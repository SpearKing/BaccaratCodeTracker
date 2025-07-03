// src/hooks/useAnalytics.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ANALYTICS_MODE_KEY, ANALYTICS_PATTERNS } from '../utils/constants';

export const useAnalytics = (scorecard, maxRenderableColumns) => {
    const [showAnalytics, setShowAnalytics] = useState(() => {
        const savedAnalytics = localStorage.getItem(ANALYTICS_MODE_KEY);
        return savedAnalytics ? JSON.parse(savedAnalytics) : false; // Default to off
    });

    useEffect(() => {
        localStorage.setItem(ANALYTICS_MODE_KEY, JSON.stringify(showAnalytics));
    }, [showAnalytics]);

    const getHighlightsForColumn = useCallback((colValues, patterns, colIdx) => {
        const highlights = new Map(); // Stores "scorecardRowIdx-colIdx" -> "pattern-name"

        patterns.forEach(p => {
            const patternToMatch = Array.isArray(p.seq) ? p.seq : [p.seq];
            const minLength = p.minLength || patternToMatch.length;
            const isRepeating = p.isRepeating || false;
            // Retrieve the new property, default to false if not defined
            const allowMixedSigns = p.allowMixedSigns || false;

            for (let i = 0; i <= colValues.length - minLength; i++) {
                let currentSequenceValues = []; // Stores the actual values from colValues for the potential match
                let segmentMatchesInitial = true;

                // First, check if the initial segment matches the pattern (absolute values)
                for (let j = 0; j < patternToMatch.length; j++) {
                    const cellValue = colValues[i + j];
                    const patternVal = patternToMatch[j];
                    if (cellValue === null || Math.abs(cellValue) !== Math.abs(patternVal)) {
                        segmentMatchesInitial = false;
                        break;
                    }
                    currentSequenceValues.push(cellValue);
                }

                if (!segmentMatchesInitial) continue;

                // --- CONDITIONAL SIGN CONSISTENCY CHECK FOR INITIAL SEGMENT ---
                // Only perform this check if the pattern does NOT allow mixed signs
                if (!allowMixedSigns) {
                    const firstNonZeroInSequence = currentSequenceValues.find(val => val !== 0);
                    if (firstNonZeroInSequence !== undefined) {
                        let signConsistent = true;
                        for (let j = 0; j < currentSequenceValues.length; j++) {
                            const val = currentSequenceValues[j];
                            if (val !== 0 && ((firstNonZeroInSequence > 0 && val < 0) || (firstNonZeroInSequence < 0 && val > 0))) {
                                signConsistent = false;
                                break;
                            }
                        }
                        if (!signConsistent) continue; // If signs are not consistent, this segment is not a match
                    }
                }
                // --- END OF CONDITIONAL SIGN CONSISTENCY CHECK ---


                let actualLength = patternToMatch.length;
                if (isRepeating) {
                    while (i + actualLength < colValues.length) {
                        const nextVal = colValues[i + actualLength];
                        const expectedVal = patternToMatch[actualLength % patternToMatch.length];

                        // Check if the next value matches the expected pattern value (absolute values)
                        if (nextVal === null || Math.abs(nextVal) !== Math.abs(expectedVal)) {
                            break; // Pattern broken
                        }

                        // --- CONDITIONAL SIGN CONSISTENCY CHECK FOR REPEATING PART ---
                        // Only perform this check if the pattern does NOT allow mixed signs
                        if (!allowMixedSigns) {
                            // Find the first non-zero value from the *entire* sequence matched so far
                            // This considers the values from the initial segment plus any successfully matched repeating values.
                            let firstNonZeroInFullSequence = currentSequenceValues.find(val => val !== 0);
                            if (firstNonZeroInFullSequence === undefined && nextVal !== 0) {
                                firstNonZeroInFullSequence = nextVal; // If no non-zero found yet, use current nextVal
                            }

                            if (nextVal !== 0 && firstNonZeroInFullSequence !== undefined && ((firstNonZeroInFullSequence > 0 && nextVal < 0) || (firstNonZeroInFullSequence < 0 && nextVal > 0))) {
                                break; // Pattern broken due to inconsistent signs
                            }
                        }
                        // --- END OF CONDITIONAL SIGN CONSISTENCY CHECK FOR REPEATING PART ---

                        currentSequenceValues.push(nextVal); // Add to sequence for next iteration's consistency check
                        actualLength++;
                    }
                }

                // If the detected pattern length meets the minimum requirement, highlight it
                if (actualLength >= minLength) {
                    for (let k = 0; k < actualLength; k++) {
                        highlights.set(`${i + k + 1}-${colIdx}`, p.name);
                    }
                    // Skip ahead in the column to avoid re-matching the same pattern start
                    i += actualLength - 1;
                }
            }
        });
        return highlights;
    }, []); // Dependencies of useCallback remain the same

    // Memoized function to calculate all highlights for the entire scorecard
    const highlightedCells = useMemo(() => {
        if (!showAnalytics) return new Map();

        const allHighlights = new Map();
        for (let colIdx = 3; colIdx < maxRenderableColumns; colIdx++) {
            const columnValues = [];
            for (let rowIdx = 1; rowIdx < scorecard.length; rowIdx++) {
                columnValues.push(scorecard[rowIdx][colIdx].value);
            }
            const colHighlights = getHighlightsForColumn(columnValues, ANALYTICS_PATTERNS, colIdx);
            colHighlights.forEach((patternName, key) => allHighlights.set(key, patternName));
        }
        return allHighlights;
    }, [scorecard, showAnalytics, maxRenderableColumns, getHighlightsForColumn]);

    return { showAnalytics, setShowAnalytics, highlightedCells };
};