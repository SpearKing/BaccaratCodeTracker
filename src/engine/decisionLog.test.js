// src/engine/decisionLog.test.js

import {
    makeEntry,
    historyBefore,
    dedupe,
    staleEntries,
    byEngine,
    LOG_SCHEMA_VERSION,
    fromServerRow,
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

describe('fromServerRow', () => {
    const row = {
        schema_version: 2,
        engine_version: 'arbitrated@2',
        card: 'Boomtown - 09/19/25',
        hand_index: 12,
        predicted: 'B',
        confidence: 4,
        source: 'wiener-3',
        pattern: null,
        actual: 'P',
        history: 'PBBPB',
        decided_at: '2026-09-19T18:04:05.000Z',
        candidates: [{ id: 'wiener-3', call: 'B' }, { id: 'pattern', call: 'P' }],
        contested: true,
        mode: null,
        replayed: false,
    };

    it('maps a row back into the shape the engine reads', () => {
        expect(fromServerRow(row)).toEqual({
            v: 2, engine: 'arbitrated@2', card: 'Boomtown - 09/19/25', hand: 12,
            predicted: 'B', confidence: 4, source: 'wiener-3', pattern: null,
            candidates: [{ id: 'wiener-3', call: 'B' }, { id: 'pattern', call: 'P' }],
            contested: true, actual: 'P', history: 'PBBPB',
            at: '2026-09-19T18:04:05.000Z',
        });
    });

    it('brings back the candidates, which arbitration is rebuilt from', () => {
        expect(fromServerRow(row).candidates).toHaveLength(2);
        expect(fromServerRow({ ...row, candidates: null }).candidates).toEqual([]);
    });

    it('carries the test flag through, so downloaded test hands still do not count', () => {
        expect(fromServerRow({ ...row, mode: 'test' }).mode).toBe('test');
        expect(fromServerRow(row).mode).toBeUndefined();
    });

    it('marks replayed entries as such', () => {
        expect(fromServerRow({ ...row, replayed: true }).replayed).toBe(true);
    });
});
