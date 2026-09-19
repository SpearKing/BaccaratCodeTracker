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

import { deriveGrid, handsFromGrid, isDecided } from './grid';
import { computeHighlights } from './analytics';
import { predictNextHand } from './predict';
import { makeEntry } from './decisionLog';
import { summarise } from './stats';
import { createModel, predict, learn, callFor, logLoss, brier, BASE_PRIOR } from './model';

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

/** Saved cards as ordered hand sequences, oldest card first. */
export const cardsInOrder = (games) => {
    const dateOf = (name) => {
        const m = String(name).match(/(\d{2})\/(\d{2})\/(\d{2})$/);
        return m ? new Date(2000 + Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime() : 0;
    };

    return Object.keys(games || {})
        .map((name) => ({
            name,
            t: dateOf(name),
            hands: Array.isArray(games[name]?.scorecard)
                ? handsFromGrid(games[name].scorecard).filter(isDecided)
                : [],
        }))
        .filter((c) => c.hands.length > 0)
        .sort((a, b) => a.t - b.t);
};

/**
 * Scores the learned model prequentially: every hand is predicted before the
 * model has seen it, then learned from.
 *
 * This is the right standard for a sequence model. A train/test split would
 * either waste data or invite leakage; predicting each hand from only its past
 * gives a genuinely out-of-sample score on every single hand.
 *
 * Counts carry across cards -- that is the learning -- but the CONTEXT resets
 * at each card, because a new card is a new shoe and the last hand of the
 * previous one tells you nothing about the first hand of this one.
 */
export const evaluateModel = (cards, { margin = 0, ...modelOptions } = {}) => {
    const model = createModel(modelOptions);
    const entries = [];

    let totalLogLoss = 0;
    let totalBrier = 0;
    let baseLogLoss = 0;
    let scored = 0;

    cards.forEach(({ name, hands }) => {
        const context = [];

        hands.forEach((hand, i) => {
            const dist = predict(model, context);
            const call = callFor(dist, { margin });

            entries.push({
                v: 1,
                engine: 'vomm',
                card: name,
                hand: i + 1,
                predicted: call.side,
                confidence: call.edge === null ? 0 : Math.round(call.edge * 1000),
                source: call.side ? 'model' : null,
                pattern: null,
                actual: hand,
                history: context.join(''),
                at: null,
                // Probability the model gave to what actually happened. Kept so
                // that log loss can be recomputed over any slice of the run.
                pActual: dist[hand],
            });

            totalLogLoss += logLoss(dist, hand);
            totalBrier += brier(dist, hand);
            baseLogLoss += logLoss(BASE_PRIOR, hand);
            scored += 1;

            learn(model, context, hand);
            context.push(hand);
        });
    });

    return {
        entries,
        summary: summarise(entries),
        model,
        scores: {
            n: scored,
            logLoss: scored ? totalLogLoss / scored : null,
            brier: scored ? totalBrier / scored : null,
            // What a fixed base-rate predictor scores on the same hands. If the
            // model cannot beat this, it has learned nothing at all.
            baseLogLoss: scored ? baseLogLoss / scored : null,
        },
    };
};

/**
 * Drops cards whose hand sequence is contained in another card's.
 *
 * Saving the same session twice -- or saving it again after playing on --
 * leaves the identical sequence in the data more than once. A model that has
 * already seen those hands is recalling them, not predicting them, and a
 * shuffled null does not reproduce that leak, so leaving duplicates in makes
 * the model look predictive when it is only remembering.
 *
 * The longer card is kept.
 */
export const dropDuplicateCards = (cards) => {
    const sorted = cards.slice().sort((a, b) => b.hands.length - a.hands.length);
    const kept = [];
    const dropped = [];

    sorted.forEach((card) => {
        const seq = card.hands.join('');
        const covered = kept.some((k) => k.hands.join('').includes(seq));
        if (covered) dropped.push(card);
        else kept.push(card);
    });

    // Restore the original ordering, which the prequential run depends on.
    const keptNames = new Set(kept.map((c) => c.name));
    return { kept: cards.filter((c) => keptNames.has(c.name)), dropped };
};
