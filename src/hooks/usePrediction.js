// src/hooks/usePrediction.js
import { useMemo } from 'react';
import { predictNextHand } from '../engine/predict';

/**
 * React wrapper around the shared prediction rules.
 *
 * The rules themselves live in engine/predict.js so that stealth mode can use
 * the same implementation instead of its own copy.
 *
 * `lastWinType` is no longer needed -- the engine reads the winner off the row
 * -- but it stays in the signature because callers already pass it, and
 * removing it is Phase 3's business.
 */
export const usePrediction = (scorecard, lastWinType, lastWinRow, highlightedCells) => {
    const { predictedWinType, confidenceLevel, predictionSource } = useMemo(() => {
        const { prediction, confidence, source } = predictNextHand(
            scorecard,
            highlightedCells,
            lastWinRow
        );
        return {
            predictedWinType: prediction,
            confidenceLevel: confidence,
            predictionSource: source,
        };
    }, [scorecard, lastWinRow, highlightedCells]);

    return { predictedWinType, confidenceLevel, predictionSource };
};
