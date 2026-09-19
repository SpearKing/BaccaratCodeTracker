// src/engine/predict.test.js
//
// Characterisation tests for the prediction rules.
//
// These pin down what the engine currently does, including the parts Phase 3
// intends to replace. They are here so that when the rules change, the change
// is visible and deliberate rather than silent.

import { predictNextHand, winnerAtRow } from './predict';
import { deriveGrid } from './grid';
import { computeHighlights } from './analytics';

// Uses the app's own analytics implementation rather than a copy, so these
// tests cannot drift from what the grid actually highlights.
const highlightsFor = (scorecard, maxCol) => computeHighlights(scorecard, maxCol);

const predictAfter = (hands) => {
    const grid = deriveGrid(hands, hands.length + 5);
    const hl = highlightsFor(grid, grid[0].length);
    return predictNextHand(grid, hl, hands.length);
};

// 'R' = this hand repeated the previous one, 'O' = it switched.
const handsForPattern = (transitions, first = 'P') => {
    const hands = [first];
    for (const t of transitions) {
        const prev = hands[hands.length - 1];
        hands.push(t === 'R' ? prev : prev === 'P' ? 'B' : 'P');
    }
    return hands;
};

describe('winnerAtRow', () => {
    it('reads the winner off a row', () => {
        const grid = deriveGrid(['P', 'B'], 10);
        expect(winnerAtRow(grid, 1)).toBe('P');
        expect(winnerAtRow(grid, 2)).toBe('B');
    });

    it('returns null for an unplayed row rather than guessing Banker', () => {
        // The old stealth-mode copy defaulted to 'B' here, which produced
        // predictions for rows that had never been played.
        const grid = deriveGrid(['P'], 10);
        expect(winnerAtRow(grid, 5)).toBeNull();
    });
});

describe('predictNextHand', () => {
    it('declines to predict before anything has been played', () => {
        const grid = deriveGrid([], 10);
        expect(predictNextHand(grid, new Map(), -1).prediction).toBeNull();
        expect(predictNextHand(grid, new Map(), 3).prediction).toBeNull();
    });

    it('predicts a repeat after three of the same result', () => {
        const r = predictAfter(['B', 'P', 'P', 'P']);
        expect(r).toMatchObject({ prediction: 'P', source: 'rule-of-three-player' });

        const b = predictAfter(['P', 'B', 'B', 'B']);
        expect(b).toMatchObject({ prediction: 'B', source: 'rule-of-three-banker' });
    });

    it('predicts a switch after three switches in a row', () => {
        const r = predictAfter(['P', 'B', 'P', 'B']);
        expect(r).toMatchObject({ prediction: 'P', source: 'rule-of-three-alternating' });
    });

    it('reports which rule fired, so the two can be told apart later', () => {
        expect(predictAfter(['B', 'P', 'P', 'P']).source).toMatch(/^rule-of-three/);
        expect(predictAfter(['P', 'P', 'B']).source).toBe('pattern');
    });
});

describe('measured behaviour of the current rules', () => {
    // Established by replaying ~100k simulated hands: the prediction is fully
    // determined by the last three hands. This table reproduced the engine on
    // 40,200/40,200 decisions. If this test fails, that property changed.
    const TABLE = {
        OOO: 'switch', OOR: 'switch', ORO: 'repeat', ORR: 'repeat',
        ROO: 'repeat', ROR: 'switch', RRO: 'repeat', RRR: 'repeat',
    };

    Object.entries(TABLE).forEach(([last3, expected]) => {
        it(`after ${last3} it predicts a ${expected}`, () => {
            ['P', 'B'].forEach((first) => {
                // Pad the front so the pattern rule has history to work with.
                const hands = handsForPattern(['R', 'O', 'R', ...last3.split('')], first);
                const { prediction } = predictAfter(hands);
                const lastWinner = hands[hands.length - 1];
                const asMove = prediction === lastWinner ? 'repeat' : 'switch';
                expect(asMove).toBe(expected);
            });
        });
    });

    it('is decided by the last three hands regardless of what came before', () => {
        const seen = new Set();
        for (let mask = 0; mask < 64; mask++) {
            const prefix = Array.from({ length: 6 }, (_, i) => ((mask >> i) & 1 ? 'R' : 'O'));
            const hands = handsForPattern([...prefix, 'R', 'O', 'R']);
            const { prediction } = predictAfter(hands);
            seen.add(prediction === hands[hands.length - 1] ? 'repeat' : 'switch');
        }
        // Every one of the 64 different histories ending in R,O,R gives the
        // same answer -- the earlier hands are not consulted.
        expect(seen.size).toBe(1);
    });
});

describe('ties', () => {
    it('does not let a tie break the Rule of Three', () => {
        // P, P, tie, P is still three Players in a row.
        const withTie = predictAfter(['B', 'P', 'P', 'T', 'P']);
        expect(withTie).toMatchObject({ prediction: 'P', source: 'rule-of-three-player' });
    });

    it('anchors to the last decided hand when the card ends on a tie', () => {
        const grid = deriveGrid(['B', 'P', 'P', 'P', 'T'], 20);
        const hl = highlightsFor(grid, grid[0].length);

        // Asking about the tie row gives the same answer as asking about the
        // last real hand -- a tie changes nothing.
        expect(predictNextHand(grid, hl, 5)).toEqual(predictNextHand(grid, hl, 4));
        expect(predictNextHand(grid, hl, 5).prediction).toBe('P');
    });

    it('gives the same prediction as the same hands without ties', () => {
        const clean = ['P', 'B', 'B', 'P', 'B', 'P', 'P'];
        const tied = ['P', 'T', 'B', 'B', 'T', 'P', 'B', 'P', 'T', 'P'];
        expect(predictAfter(tied).prediction).toBe(predictAfter(clean).prediction);
    });

    it('declines to predict on a card holding only ties', () => {
        const grid = deriveGrid(['T', 'T'], 20);
        expect(predictNextHand(grid, new Map(), 2).prediction).toBeNull();
    });
});
