// src/hooks/usePrediction.js
import { useMemo } from 'react';
import { predictNextHand } from '../engine/predict';

/**
 * React wrapper around the shared prediction rules.
 *
 * The rules themselves live in engine/predict.js so that stealth mode can use
 * the same implementation instead of its own copy.
 *
 * Returns the engine's own result as `result` alongside the flattened names the
 * UI already uses. The decision log takes `result` verbatim -- renaming the
 * fields on the way through is how the log ended up recording "no opinion" for
 * every hand the first time round.
 *
 * `records` is each rule's track record, from the log. It decides conflicts.
 *
 * `lastWinType` is no longer needed -- the engine reads the winner off the row
 * -- but it stays in the signature because callers already pass it, and
 * removing it is Phase 3's business.
 */
export const usePrediction = (scorecard, lastWinType, lastWinRow, highlightedCells, records) => {
    const result = useMemo(
        () => predictNextHand(scorecard, highlightedCells, lastWinRow, records),
        [scorecard, lastWinRow, highlightedCells, records]
    );

    return {
        result,
        predictedWinType: result.prediction,
        confidenceLevel: result.confidence,
        predictionSource: result.source,
    };
};
