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
            const allowMixedSigns = p.allowMixedSigns || false;

            for (let i = 0; i <= colValues.length - minLength; i++) {
                let currentSequenceValues = [];
                let segmentMatchesInitial = true;

                for (let j = 0; j < patternToMatch.length; j++) {
                    if (i + j >= colValues.length ||
                        (allowMixedSigns ?
                            Math.abs(colValues[i + j]) !== Math.abs(patternToMatch[j]) :
                            colValues[i + j] !== patternToMatch[j])
                    ) {
                        segmentMatchesInitial = false;
                        break;
                    }
                    currentSequenceValues.push(colValues[i + j]);
                }

                if (!segmentMatchesInitial) {
                    continue;
                }

                let actualLength = patternToMatch.length;
                if (isRepeating) {
                    let k = patternToMatch.length;
                    while (i + k < colValues.length) {
                        const patternVal = patternToMatch[k % patternToMatch.length];
                        const cellValue = colValues[i + k];
                        if (allowMixedSigns ?
                            Math.abs(cellValue) === Math.abs(patternVal) :
                            cellValue === patternVal) {
                            actualLength++;
                            k++;
                        } else {
                            break;
                        }
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
    }, []);

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