// src/engine/backtest.js
//
// Replays the engine over hand sequences that have already been played, and
// reconstructs what it would have predicted at every hand.
//
// This works because the engine is deterministic -- its output is fully
// determined by the hands before it. So a forward-recorded decision log is not
// the only way to measure it: any saved scorecard is a hand sequence, and a
// hand sequence is enough to recover every prediction after the fact.
//
// The replay rides deriveGrid's own traversal via its onStep hook rather than
// stepping the grid itself, so it cannot drift from what the app does.

import { deriveGrid, handsFromGrid } from './grid';
import { computeHighlights } from './analytics';
import { predictNextHand } from './predict';
import { makeEntry } from './decisionLog';
import { summarise } from './stats';

/** Reconstructs the decision log for one already-played card. */
export const replayCard = (cardName, hands) => {
    const entries = [];

    deriveGrid(hands, hands.length + 5, ({ grid, rowIdx, hand, parentRowIdx }) => {
        // `parentRowIdx` is the last decided row, which is exactly the anchor
        // the predictor wants. Zero means nothing has been decided yet.
        const prediction =
            parentRowIdx > 0
                ? predictNextHand(grid, computeHighlights(grid, grid[0].length), parentRowIdx)
                : null;

        entries.push(
            makeEntry({
                card: cardName,
                handIndex: rowIdx,
                prediction,
                actual: hand,
                hands,
                at: null,
            })
        );
    });

    return entries;
};

/** Pulls hand sequences out of saved scorecards and replays every one. */
export const replaySavedCards = (games, { minHands = 1 } = {}) => {
    const perCard = [];
    let entries = [];

    Object.keys(games || {}).forEach((name) => {
        const scorecard = games[name]?.scorecard;
        if (!Array.isArray(scorecard)) return;

        const hands = handsFromGrid(scorecard);
        const decided = hands.filter((h) => h === 'P' || h === 'B').length;
        if (decided < minHands) return;

        const cardEntries = replayCard(name, hands);
        perCard.push({ name, hands: hands.length, decided, entries: cardEntries.length });
        entries = entries.concat(cardEntries);
    });

    return { entries, perCard, summary: summarise(entries) };
};
