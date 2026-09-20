// src/engine/strategy.test.js

import { simulateStrategy } from './strategy';
import { ENGINE_VERSION } from './version';

const hand = (i, candidates, actual) => ({
    v: 2, engine: ENGINE_VERSION, card: 'Test', hand: i,
    predicted: candidates[0]?.call ?? null, confidence: 1,
    source: candidates[0]?.id ?? null, pattern: null,
    candidates, contested: false, actual, history: '', at: null,
});

describe('simulateStrategy', () => {
    it('only bets hands where a chosen rule fired', () => {
        const log = [
            hand(1, [{ id: 'wiener-3', call: 'B' }], 'B'),
            hand(2, [{ id: 'pattern', call: 'P' }], 'P'),
            hand(3, [{ id: 'snake-box-2', call: 'P' }], 'B'),
        ];
        const r = simulateStrategy(log, ['wiener-3', 'snake-box-2']);
        expect(r.entries).toHaveLength(2);
        expect(r.passed).toBe(1);
        expect(r.summary.overall.n).toBe(2);
        expect(r.summary.overall.correct).toBe(1);
    });

    it('does not count passed hands against you', () => {
        const log = [
            hand(1, [{ id: 'wiener-3', call: 'B' }], 'B'),
            ...Array.from({ length: 50 }, (_, i) => hand(i + 2, [{ id: 'pattern', call: 'P' }], 'B')),
        ];
        const r = simulateStrategy(log, ['wiener-3']);
        // 50 losing pattern hands are passes, not losses.
        expect(r.summary.overall.n).toBe(1);
        expect(r.summary.overall.correct).toBe(1);
        expect(r.passed).toBe(50);
    });

    it('reports how often the strategy would have you betting', () => {
        const log = Array.from({ length: 10 }, (_, i) =>
            hand(i + 1, [{ id: i < 3 ? 'wiener-3' : 'pattern', call: 'B' }], 'B'));
        const r = simulateStrategy(log, ['wiener-3']);
        expect(r.coverage).toBeCloseTo(0.3, 10);
    });

    it('ignores the rules it was not given, even when they won originally', () => {
        const log = [hand(1, [
            { id: 'pattern', call: 'P' },
            { id: 'wiener-3', call: 'B' },
        ], 'B')];
        const r = simulateStrategy(log, ['wiener-3']);
        expect(r.entries[0].predicted).toBe('B');
        expect(r.entries[0].source).toBe('wiener-3');
    });

    it('settles a clash between two chosen rules on their own record', () => {
        // alpha is right, beta wrong, over enough hands to build a record.
        const history = Array.from({ length: 40 }, (_, i) => hand(i + 1, [
            { id: 'wiener-3', call: 'B' }, { id: 'snake-box-2', call: 'P' },
        ], 'B'));
        const r = simulateStrategy([...history, hand(99, [
            { id: 'wiener-3', call: 'P' }, { id: 'snake-box-2', call: 'B' },
        ], 'P')], ['wiener-3', 'snake-box-2']);
        // wiener-3 has the better record, so it takes the last call.
        expect(r.entries[r.entries.length - 1].source).toBe('wiener-3');
    });

    it('treats ties as pushes rather than losses', () => {
        const log = [
            hand(1, [{ id: 'wiener-3', call: 'B' }], 'T'),
            hand(2, [{ id: 'wiener-3', call: 'B' }], 'B'),
        ];
        const r = simulateStrategy(log, ['wiener-3']);
        expect(r.summary.overall.n).toBe(1);
        expect(r.summary.overall.pushes).toBe(1);
    });

    it('copes with an empty log and an empty rule set', () => {
        expect(simulateStrategy([], ['wiener-3']).entries).toHaveLength(0);
        expect(simulateStrategy([hand(1, [{ id: 'wiener-3', call: 'B' }], 'B')], []).passed).toBe(1);
    });
});

describe('simulateFromCards', () => {
    const { simulateFromCards, needsGrid } = require('./strategy');

    it('knows when a grid is needed', () => {
        expect(needsGrid(['wiener-3', 'snake-box-2'])).toBe(false);
        expect(needsGrid(['wiener-3', 'pattern'])).toBe(true);
    });

    it('finds a Wiener-3 board straight from the hands', () => {
        // ...B P P P B  -> wiener-3 fires, calling the opposite of B.
        const hands = ['P', 'B', 'P', 'P', 'P', 'B', 'P'];
        const r = simulateFromCards([{ name: 'c', hands }], ['wiener-3']);
        expect(r.entries).toHaveLength(1);
        expect(r.entries[0]).toMatchObject({ source: 'wiener-3', predicted: 'P', actual: 'P' });
    });

    it('passes on every hand where none of the chosen rules fire', () => {
        const hands = Array.from({ length: 30 }, () => 'P');   // a long run, no breaks
        const r = simulateFromCards([{ name: 'c', hands }], ['wiener-3', 'snake-box-2']);
        expect(r.entries).toHaveLength(0);
        expect(r.passed).toBe(29);
    });

    it('agrees with the grid-based path on the same hands', () => {
        const hands = ['P','B','P','P','P','B','P','B','B','P','P','B','B','B','P','P','P','B','P'];
        const fromCards = simulateFromCards([{ name: 'c', hands }], ['wiener-3', 'snake-box-2', 'snake-box-3']);

        // Build the same entries the long way, through the rule registry.
        const { firingRules } = require('./rules');
        const expected = [];
        for (let i = 1; i < hands.length; i++) {
            const fired = firingRules({ hands: hands.slice(0, i), scorecard: null, highlights: null, anchorRow: 0 })
                .filter((c) => ['wiener-3', 'snake-box-2', 'snake-box-3'].includes(c.rule.id));
            if (fired.length) expected.push({ hand: i + 1, call: fired[0].call });
        }
        expect(fromCards.entries.map((e) => ({ hand: e.hand, call: e.predicted }))).toEqual(expected);
    });
});
