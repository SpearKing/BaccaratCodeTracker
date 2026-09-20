// src/engine/arbitrate.test.js

import { arbitrate, recordsFrom, weightFor, NO_RECORD_WEIGHT } from './arbitrate';

const cand = (id, call, specificity = 1) => ({ rule: { id, specificity }, call });

const recordsOf = (obj) => new Map(Object.entries(obj));

describe('recordsFrom', () => {
    it('credits every rule that fired, not just the one that won', () => {
        const log = [
            { actual: 'P', winner: 'a', candidates: [{ id: 'a', call: 'P' }, { id: 'b', call: 'B' }] },
            { actual: 'B', winner: 'a', candidates: [{ id: 'a', call: 'P' }, { id: 'b', call: 'B' }] },
        ];
        const r = recordsFrom(log);
        // 'b' lost both arbitrations but was right once -- it must be on record,
        // or it could never overtake 'a'.
        expect(r.get('a')).toEqual({ n: 2, correct: 1 });
        expect(r.get('b')).toEqual({ n: 2, correct: 1 });
    });

    it('treats a tie as a push rather than a loss', () => {
        const r = recordsFrom([{ actual: 'T', candidates: [{ id: 'a', call: 'P' }] }]);
        expect(r.has('a')).toBe(false);
    });

    it('ignores rules that abstained', () => {
        const r = recordsFrom([{ actual: 'P', candidates: [{ id: 'a', call: null }] }]);
        expect(r.has('a')).toBe(false);
    });

    it('copes with an empty log', () => {
        expect(recordsFrom([]).size).toBe(0);
        expect(recordsFrom(null).size).toBe(0);
    });
});

describe('weightFor', () => {
    it('puts an unproven rule at an even split', () => {
        expect(weightFor(null)).toBe(NO_RECORD_WEIGHT);
        expect(weightFor({ n: 0, correct: 0 })).toBe(NO_RECORD_WEIGHT);
        // Better than a rule measured to be bad, worse than one measured good.
        expect(weightFor({ n: 500, correct: 200 })).toBeLessThan(NO_RECORD_WEIGHT);
        expect(weightFor({ n: 500, correct: 300 })).toBeGreaterThan(NO_RECORD_WEIGHT);
    });

    it('discounts a thin record toward an even split', () => {
        // 6 of 10 is 60% raw; shrunk it barely clears half.
        expect(weightFor({ n: 10, correct: 6 })).toBeLessThan(0.54);
        // 600 of 1000 keeps most of its 60%.
        expect(weightFor({ n: 1000, correct: 600 })).toBeGreaterThan(0.58);
    });

    it('does not rank a worse rule above a better one for having more hands', () => {
        // The failure that replaced the lower bound: `pattern` measured 49.3%
        // over 2,289 and rule-of-three-player 51.0% over 473. The better rule
        // must win despite the smaller sample.
        const worseButBigger = weightFor({ n: 2289, correct: 1129 });
        const betterButSmaller = weightFor({ n: 473, correct: 241 });
        expect(betterButSmaller).toBeGreaterThan(worseButBigger);
    });

    it('rises as a good rule accumulates evidence', () => {
        expect(weightFor({ n: 400, correct: 220 })).toBeGreaterThan(weightFor({ n: 40, correct: 22 }));
    });
});

describe('arbitrate', () => {
    it('abstains when nothing fired', () => {
        expect(arbitrate([], new Map()).call).toBeNull();
    });

    it('takes the only call on offer', () => {
        const r = arbitrate([cand('a', 'B')], new Map());
        expect(r).toMatchObject({ call: 'B', winner: 'a', contested: false });
    });

    it('is uncontested when rules agree', () => {
        const r = arbitrate([cand('a', 'B'), cand('b', 'B')], new Map());
        expect(r.contested).toBe(false);
    });

    it('gives a conflict to the better record', () => {
        const r = arbitrate(
            [cand('weak', 'P'), cand('strong', 'B')],
            recordsOf({ weak: { n: 200, correct: 90 }, strong: { n: 200, correct: 115 } })
        );
        expect(r).toMatchObject({ call: 'B', winner: 'strong', contested: true });
    });

    it('does not let a thin hot streak beat a proven rule', () => {
        const r = arbitrate(
            [cand('hot', 'P'), cand('proven', 'B')],
            recordsOf({ hot: { n: 12, correct: 8 }, proven: { n: 600, correct: 340 } })
        );
        expect(r.winner).toBe('proven');
    });

    it('falls back to the more specific rule when neither has a record', () => {
        const r = arbitrate([cand('general', 'P', 1), cand('specific', 'B', 7)], new Map());
        expect(r.winner).toBe('specific');
    });

    it('falls back to declaration order when specificity ties too', () => {
        const r = arbitrate([cand('first', 'P', 3), cand('second', 'B', 3)], new Map());
        expect(r.winner).toBe('first');
    });

    it('reports every candidate so the log can record them all', () => {
        const r = arbitrate([cand('a', 'P'), cand('b', 'B')], recordsOf({ a: { n: 50, correct: 30 } }));
        expect(r.candidates.map((c) => c.id).sort()).toEqual(['a', 'b']);
        expect(r.candidates.find((c) => c.id === 'a').record).toEqual({ n: 50, correct: 30 });
    });
});
