// src/engine/predict.js
//
// Collects every rule that has an opinion on the board and settles between
// them on track record. The rules live in rules.js; the settling is in
// arbitrate.js.
//
// This replaced a chain of `if` statements where the order of writing decided
// every conflict. The Rule of Three won whenever it fired -- 37% of hands,
// contradicting the pattern rule on all of them -- purely because it was
// checked first. Nobody had measured whether that was the right call.
//
// The rules themselves are unchanged. What changed is that a rule now has to
// earn precedence, and that every firing rule is reported so the log can
// record what each one would have done.

import { ANALYTICS_PATTERNS } from '../utils/constants';
import { handsFromGrid, isDecided } from './grid';
import { firingRules } from './rules';
import { arbitrate } from './arbitrate';

/**
 * Identifies the rules AND how they are settled between.
 *
 * Bumped from 'rule-of-three+pattern@1': conflicts now go to the better track
 * record rather than to whichever rule was written first, so outputs differ.
 * Entries logged under the old version are scored separately and never blended
 * with these.
 */
export const ENGINE_VERSION = 'arbitrated@2';

/** Which side won on this row, or null if it has not been played. */
export const winnerAtRow = (scorecard, rowIdx) => {
    const row = scorecard?.[rowIdx];
    if (!row) return null;
    if (row[0].value === 'O') return 'P';
    if (row[1].value === 'O') return 'B';
    return null;
};

// The analytics pattern driving the rightmost highlight, kept so per-pattern
// stats still mean something when the pattern rule is the one that wins.
const drivingPattern = (scorecard, highlights, anchorRow) => {
    const row = scorecard?.[anchorRow];
    if (!row || !highlights) return null;
    for (let c = row.length - 1; c >= 3; c--) {
        if (highlights.has(`${anchorRow}-${c}`)) {
            const name = highlights.get(`${anchorRow}-${c}`);
            const def = ANALYTICS_PATTERNS.find((p) => p.name === name);
            return def && def.isRepeating ? name : null;
        }
    }
    return null;
};

/**
 * Predicts the hand that follows `rowIdx`.
 *
 * `records` is each rule's history, built from decisions BEFORE this one --
 * see arbitrate.recordsFrom. Passing nothing simply means no rule has a record
 * yet, which is the correct state on a fresh log.
 */
export const predictNextHand = (scorecard, highlightedCells, rowIdx, records) => {
    const none = {
        prediction: null, confidence: 0, source: null, pattern: null,
        candidates: [], contested: false,
    };

    if (!scorecard || rowIdx === -1 || rowIdx === null || rowIdx === undefined) return none;
    if (!scorecard[rowIdx]) return none;

    // A tie is not a result, so predictions anchor to the most recent decided
    // row at or above the one asked for.
    let anchorRow = rowIdx;
    while (anchorRow >= 1 && !winnerAtRow(scorecard, anchorRow)) anchorRow--;
    if (anchorRow < 1) return none;

    const highlights = highlightedCells ?? new Map();
    const hands = handsFromGrid(scorecard).slice(0, anchorRow).filter(isDecided);
    if (hands.length === 0) return none;

    const context = { scorecard, highlights, anchorRow, hands };
    const { call, winner, contested, candidates } = arbitrate(
        firingRules(context),
        records ?? new Map()
    );

    // C-Level is still the count of highlighted cells on the row. Measured, it
    // runs backwards -- higher levels verify less often -- so it is reported
    // beside its own measured rate rather than as a claim. See stats.js.
    let confidence = 0;
    const row = scorecard[anchorRow];
    for (let col = 3; col < row.length; col++) {
        if (highlights.has(`${anchorRow}-${col}`)) confidence++;
    }

    return {
        prediction: call,
        confidence,
        source: winner,
        pattern: winner === 'pattern' ? drivingPattern(scorecard, highlights, anchorRow) : null,
        candidates,
        contested,
    };
};
