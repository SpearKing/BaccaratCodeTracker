// src/engine/decisionLog.test.js

import {
    makeEntry,
    historyBefore,
    dedupe,
    staleEntries,
    byEngine,
    LOG_SCHEMA_VERSION,
} from './decisionLog';
import { ENGINE_VERSION } from './predict';

describe('historyBefore', () => {
    const hands = ['P', 'B', 'B', 'T', 'P', 'B'];

    it('returns the hands before the one being recorded', () => {
        expect(historyBefore(hands, 4)).toBe('PBB');
    });

    it('keeps ties, since a later feature may care about them', () => {
        expect(historyBefore(hands, 6)).toBe('PBBTP');
    });

    it('is empty for the first hand', () => {
        expect(historyBefore(hands, 1)).toBe('');
    });

    it('caps the length', () => {
        const long = Array(40).fill('P');
        expect(historyBefore(long, 40, 12)).toHaveLength(12);
    });
});

describe('makeEntry', () => {
    const hands = ['P', 'B', 'B'];
    const prediction = { prediction: 'B', confidence: 4, source: 'pattern', pattern: 'pattern-121' };

    it('records what was predicted and what happened', () => {
        const e = makeEntry({ card: 'Boomtown', handIndex: 3, prediction, actual: 'B', hands });
        expect(e).toMatchObject({
            v: LOG_SCHEMA_VERSION,
            engine: ENGINE_VERSION,
            card: 'Boomtown',
            hand: 3,
            predicted: 'B',
            confidence: 4,
            source: 'pattern',
            pattern: 'pattern-121',
            actual: 'B',
            history: 'PB',
        });
    });

    it('stamps the engine version on every entry', () => {
        const e = makeEntry({ handIndex: 1, prediction, actual: 'P', hands });
        expect(e.engine).toBe(ENGINE_VERSION);
        expect(e.engine).toBeTruthy();
    });

    it('keeps hands where the engine had no opinion, so coverage stays measurable', () => {
        const e = makeEntry({ handIndex: 2, prediction: null, actual: 'B', hands });
        expect(e.predicted).toBeNull();
        expect(e.source).toBeNull();
        expect(e.confidence).toBe(0);
    });

    it('records a tie as the outcome', () => {
        const e = makeEntry({ handIndex: 3, prediction, actual: 'T', hands });
        expect(e.actual).toBe('T');
    });
});

describe('dedupe', () => {
    it('keeps the most recent record for a hand', () => {
        const out = dedupe([
            { card: 'A', hand: 1, actual: 'P' },
            { card: 'A', hand: 1, actual: 'B' },
            { card: 'A', hand: 2, actual: 'P' },
        ]);
        expect(out).toHaveLength(2);
        expect(out[0].actual).toBe('B');
    });

    it('treats the same hand number on different cards as different hands', () => {
        const out = dedupe([
            { card: 'A', hand: 1, actual: 'P' },
            { card: 'B', hand: 1, actual: 'B' },
        ]);
        expect(out).toHaveLength(2);
    });
});

describe('engine versioning', () => {
    const log = [
        { engine: 'old@0', hand: 1 },
        { engine: ENGINE_VERSION, hand: 2 },
        { engine: ENGINE_VERSION, hand: 3 },
    ];

    it('finds entries made by a different engine', () => {
        expect(staleEntries(log)).toHaveLength(1);
    });

    it('splits the log so two engines are never averaged together', () => {
        const split = byEngine(log);
        expect(split.get('old@0')).toHaveLength(1);
        expect(split.get(ENGINE_VERSION)).toHaveLength(2);
    });
});
