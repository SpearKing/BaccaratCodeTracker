// src/engine/predict.js
//
// The prediction rules, extracted so that the main view and stealth mode share
// one implementation. Before this existed, StealthModeView carried its own copy
// that omitted the Rule of Three, so the two screens disagreed on roughly 37%
// of hands -- and because the Rule of Three inverts the pattern rule every time
// it fires, they disagreed by predicting opposite sides.
//
// This is a behaviour-preserving extraction of the MAIN view's logic. Stealth
// mode now matches it, which means stealth predictions changed.
//
// What these rules actually compute, measured over ~100k simulated hands:
// the output is fully determined by the last three decided hands. predict.test.js
// pins that as an executable table.

import { ANALYTICS_PATTERNS } from '../utils/constants';

const opposite = (winType) => (winType === 'P' ? 'B' : 'P');

/** Which side won on this row, or null if it has not been played. */
export const winnerAtRow = (scorecard, rowIdx) => {
    const row = scorecard?.[rowIdx];
    if (!row) return null;
    if (row[0].value === 'O') return 'P';
    if (row[1].value === 'O') return 'B';
    return null;
};

/**
 * Predicts the hand that follows `rowIdx`.
 *
 * `rowIdx` is the last played row. Returns the prediction, the C-Level, and
 * which rule produced it -- the last of which is what the Phase 2 decision log
 * needs in order to tell the two rules apart after the fact.
 */
export const predictNextHand = (scorecard, highlightedCells, rowIdx) => {
    const none = { prediction: null, confidence: 0, source: null };

    if (!scorecard || rowIdx === -1 || rowIdx === null || rowIdx === undefined) return none;
    if (!scorecard[rowIdx]) return none;

    // A tie is not a result, so predictions are anchored to the most recent
    // decided row at or above the one asked for.
    let anchorRow = rowIdx;
    while (anchorRow >= 1 && !winnerAtRow(scorecard, anchorRow)) anchorRow--;
    if (anchorRow < 1) return none;

    const lastWinType = winnerAtRow(scorecard, anchorRow);
    if (!lastWinType) return none;

    const highlights = highlightedCells ?? new Map();

    // The three most recent decided rows, newest first. Ties are stepped over,
    // so a tie in the middle of a streak does not break the Rule of Three.
    const recent = [];
    for (let r = anchorRow; r >= 1 && recent.length < 3; r--) {
        if (winnerAtRow(scorecard, r)) recent.push(r);
    }

    // --- Rule of Three -------------------------------------------------------
    // Three of the same result, or three switches in a row, overrides everything
    // below it.
    if (recent.length === 3) {
        const [lastRow, prevRow, twoRowsAgo] = recent.map((r) => scorecard[r]);

        if (lastRow[0].value === 'O' && prevRow[0].value === 'O' && twoRowsAgo[0].value === 'O') {
            return { prediction: 'P', confidence: 3, source: 'rule-of-three-player' };
        }
        if (lastRow[1].value === 'O' && prevRow[1].value === 'O' && twoRowsAgo[1].value === 'O') {
            return { prediction: 'B', confidence: 3, source: 'rule-of-three-banker' };
        }
        if (
            lastRow[2].displayValue === 'O' &&
            prevRow[2].displayValue === 'O' &&
            twoRowsAgo[2].displayValue === 'O'
        ) {
            return {
                prediction: opposite(lastWinType),
                confidence: 3,
                source: 'rule-of-three-alternating',
            };
        }
    }

    // --- Pattern rule --------------------------------------------------------
    const currentRow = scorecard[anchorRow];

    // Take the rightmost highlighted column. NOTE: because fresh columns are
    // seeded at the right edge every row, this is on average the youngest
    // column on the board (~2.4 hands old).
    let lastHighlightedCol = -1;
    let patternName = null;
    for (let colIdx = currentRow.length - 1; colIdx >= 3; colIdx--) {
        if (highlights.has(`${anchorRow}-${colIdx}`)) {
            lastHighlightedCol = colIdx;
            patternName = highlights.get(`${anchorRow}-${colIdx}`);
            break;
        }
    }

    let isNextRepeater = null;
    let isNextOpposite = null;

    if (lastHighlightedCol !== -1 && patternName !== null) {
        const patternDef = ANALYTICS_PATTERNS.find((p) => p.name === patternName);
        if (patternDef && patternDef.isRepeating) {
            const n2Value = scorecard[anchorRow]?.[lastHighlightedCol]?.value;
            let n1Value = null;

            for (let row = anchorRow - 1; row >= 1; row--) {
                if (highlights.get(`${row}-${lastHighlightedCol}`) === patternName) {
                    const cellValue = scorecard[row]?.[lastHighlightedCol]?.value;
                    if (typeof cellValue === 'number') {
                        n1Value = cellValue;
                        break;
                    }
                }
            }

            if (n1Value !== null && n2Value !== null && n2Value !== undefined) {
                if (n2Value - 1 === n1Value) {
                    isNextRepeater = true;
                    isNextOpposite = false;
                } else if (n2Value + 1 === n1Value) {
                    isNextRepeater = false;
                    isNextOpposite = true;
                }
            }
        }
    }

    // C-Level is the count of highlighted cells on the row. Measured: this is
    // ~97% determined by the same three hands as the prediction, and accuracy
    // is flat across levels. Phase 3 replaces it with a calibrated probability.
    let confidence = 0;
    for (let col = 3; col < currentRow.length; col++) {
        if (highlights.has(`${anchorRow}-${col}`)) confidence++;
    }

    let prediction = null;
    if (isNextRepeater) prediction = lastWinType;
    else if (isNextOpposite) prediction = opposite(lastWinType);

    return {
        prediction,
        confidence,
        source: prediction ? 'pattern' : null,
    };
};
