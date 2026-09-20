// src/engine/arbitrate.test.js

import {
    arbitrate, recordsFrom, weightFor, NO_RECORD_WEIGHT,
    headToHeadFrom, headToHeadRate, applyToRecords, applyToHeadToHead,
} from './arbitrate';
import { ENGINE_VERSION } from './version';

// Records are scoped to the running engine, so fixtures have to name it.
const here = (entry) => ({ engine: ENGINE_VERSION, ...entry });

const cand = (id, call, specificity = 1) => ({ rule: { id, specificity }, call });

const recordsOf = (obj) => new Map(Object.entries(obj));

describe('recordsFrom', () => {
    it('credits every rule that fired, not just the one that won', () => {
        const log = [
            here({ actual: 'P', winner: 'a', candidates: [{ id: 'a', call: 'P' }, { id: 'b', call: 'B' }] }),
            here({ actual: 'B', winner: 'a', candidates: [{ id: 'a', call: 'P' }, { id: 'b', call: 'B' }] }),
        ];
        const r = recordsFrom(log);
        // 'b' lost both arbitrations but was right once -- it must be on record,
        // or it could never overtake 'a'.
        expect(r.get('a')).toEqual({ n: 2, correct: 1 });
        expect(r.get('b')).toEqual({ n: 2, correct: 1 });
    });

    it('treats a tie as a push rather than a loss', () => {
        const r = recordsFrom([here({ actual: 'T', candidates: [{ id: 'a', call: 'P' }] })]);
        expect(r.has('a')).toBe(false);
    });

    it('ignores rules that abstained', () => {
        const r = recordsFrom([here({ actual: 'P', candidates: [{ id: 'a', call: null }] })]);
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

    it('ignores a rate built on too few firings', () => {
        // 6 of 10 is 60% on paper and means nothing.
        expect(weightFor({ n: 10, correct: 6 })).toBe(NO_RECORD_WEIGHT);
        // Once there are enough firings the rate is used as measured.
        expect(weightFor({ n: 1000, correct: 600 })).toBeCloseTo(0.6, 10);
    });

    it('does not rank a worse rule above a better one for having more hands', () => {
        // The failure that replaced the lower bound: `pattern` measured 49.3%
        // over 2,289 and rule-of-three-player 51.0% over 473. The better rule
        // must win despite the smaller sample.
        const worseButBigger = weightFor({ n: 2289, correct: 1129 });   // 49.3%
        const betterButSmaller = weightFor({ n: 473, correct: 241 });   // 51.0%
        expect(betterButSmaller).toBeGreaterThan(worseButBigger);
    });

    it('is the rate itself, so equal rates weigh equally', () => {
        expect(weightFor({ n: 400, correct: 220 })).toBeCloseTo(weightFor({ n: 40, correct: 22 }), 10);
    });

    it('starts counting a rule the moment it clears the floor', () => {
        expect(weightFor({ n: 19, correct: 19 })).toBe(NO_RECORD_WEIGHT);
        expect(weightFor({ n: 20, correct: 11 })).toBeCloseTo(0.55, 10);
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

describe('records are scoped to one engine version', () => {
    const entry = (engine, call, actual) => ({ engine, actual, candidates: [{ id: 'a', call }] });

    it('ignores decisions made by a different engine', () => {
        const r = recordsFrom([
            entry('arbitrated@2', 'P', 'P'),
            entry('something-else@9', 'P', 'P'),
            entry('something-else@9', 'P', 'P'),
        ], 'arbitrated@2');
        expect(r.get('a')).toEqual({ n: 1, correct: 1 });
    });

    it('defaults to the engine currently running', () => {
        const r = recordsFrom([entry('an-old-engine@0', 'P', 'P')]);
        expect(r.has('a')).toBe(false);
    });

    it('skips pre-v2 entries, which carry no candidates', () => {
        const r = recordsFrom([{ engine: 'arbitrated@2', actual: 'P', predicted: 'P' }]);
        expect(r.size).toBe(0);
    });
});

describe('head-to-head records', () => {
    const clash = (aCall, bCall, actual) => here({
        actual,
        candidates: [{ id: 'alpha', call: aCall }, { id: 'beta', call: bCall }],
    });

    it('counts only hands where the two disagreed', () => {
        const pairs = headToHeadFrom([
            clash('P', 'B', 'P'),
            clash('B', 'B', 'B'),   // agreement is not a contest
            clash('P', 'B', 'B'),
        ]);
        expect(pairs.get('alpha|beta').n).toBe(2);
    });

    it('credits whichever side was right', () => {
        const pairs = headToHeadFrom([clash('P', 'B', 'P'), clash('P', 'B', 'P'), clash('P', 'B', 'B')]);
        expect(headToHeadRate(pairs, 'alpha', 'beta', 1)).toBeCloseTo(2 / 3, 10);
        // Zero-sum: the other side is one minus.
        expect(headToHeadRate(pairs, 'beta', 'alpha', 1)).toBeCloseTo(1 / 3, 10);
    });

    it('withholds a rate until the pair has clashed enough times', () => {
        const pairs = headToHeadFrom([clash('P', 'B', 'P')]);
        expect(headToHeadRate(pairs, 'alpha', 'beta')).toBeNull();
    });

    it('prefers the pair record over the rules overall rates', () => {
        // beta looks better overall, but loses to alpha whenever they clash.
        const records = recordsOf({
            alpha: { n: 500, correct: 240 },   // 48%
            beta: { n: 500, correct: 300 },    // 60%
        });
        const pairs = new Map([['alpha|beta', { n: 100, firstWins: 70 }]]);

        const withPairs = arbitrate([cand('alpha', 'P'), cand('beta', 'B')], records, pairs);
        const withoutPairs = arbitrate([cand('alpha', 'P'), cand('beta', 'B')], records, new Map());

        expect(withPairs.winner).toBe('alpha');
        expect(withoutPairs.winner).toBe('beta');
    });

    it('says which evidence it used', () => {
        const records = recordsOf({ alpha: { n: 500, correct: 240 }, beta: { n: 500, correct: 300 } });
        const pairs = new Map([['alpha|beta', { n: 100, firstWins: 70 }]]);
        const r = arbitrate([cand('alpha', 'P'), cand('beta', 'B')], records, pairs);
        expect(r.candidates.every((c) => c.basis === 'head-to-head')).toBe(true);

        const fallback = arbitrate([cand('alpha', 'P'), cand('beta', 'B')], records, new Map());
        expect(fallback.candidates.every((c) => c.basis === 'overall')).toBe(true);
    });

    it('falls back to overall rates when only some opponents have a pair record', () => {
        const records = recordsOf({ alpha: { n: 500, correct: 300 }, gamma: { n: 500, correct: 200 } });
        const r = arbitrate([cand('alpha', 'P'), cand('gamma', 'B')], records, new Map());
        expect(r.winner).toBe('alpha');
    });
});

describe('test hands stay out of the engine memory', () => {
    const played = (mode, call, actual) => here({
        mode, actual, candidates: [{ id: 'alpha', call }, { id: 'beta', call: call === 'P' ? 'B' : 'P' }],
    });

    it('keeps test hands out of rule records', () => {
        const r = recordsFrom([
            played(undefined, 'P', 'P'),
            played('test', 'P', 'P'),
            played('test', 'P', 'P'),
        ]);
        expect(r.get('alpha')).toEqual({ n: 1, correct: 1 });
    });

    it('keeps test hands out of head-to-head records', () => {
        const pairs = headToHeadFrom([
            played(undefined, 'P', 'P'),
            played('test', 'P', 'P'),
        ]);
        expect(pairs.get('alpha|beta').n).toBe(1);
    });

    it('keeps them out of the incremental path too', () => {
        const records = new Map();
        applyToRecords(records, played('test', 'P', 'P'));
        expect(records.size).toBe(0);

        const pairs = new Map();
        applyToHeadToHead(pairs, played('test', 'P', 'P'));
        expect(pairs.size).toBe(0);
    });
});
