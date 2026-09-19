// src/engine/model.test.js

import {
    createModel, predict, learn, callFor, logLoss, brier, BASE_PRIOR,
} from './model';

const feed = (model, sequence, order = model.order) => {
    for (let i = 0; i < sequence.length; i++) {
        learn(model, sequence.slice(Math.max(0, i - order), i), sequence[i]);
    }
    return model;
};

describe('predict', () => {
    it('falls back to the baccarat base rate with no data', () => {
        const m = createModel();
        expect(predict(m, ['P', 'B'])).toEqual(BASE_PRIOR);
    });

    it('learns a deterministic sequence', () => {
        const m = createModel({ order: 3 });
        feed(m, 'PBPBPBPBPBPBPBPBPBPBPBPBPBPBPBPB'.split(''));
        // After a P, the next is always B in this sequence.
        expect(predict(m, ['P']).B).toBeGreaterThan(0.85);
        expect(predict(m, ['B']).P).toBeGreaterThan(0.85);
    });

    it('does not claim certainty from a handful of observations', () => {
        const m = createModel({ order: 3 });
        feed(m, ['B', 'B', 'B', 'B']);
        // Three or four agreeing observations must not produce ~100%.
        const p = predict(m, ['B', 'B', 'B']);
        expect(p.B).toBeLessThan(0.9);
        expect(p.B).toBeGreaterThan(0.5);
    });

    it('lets a deep context override a shorter one once it has evidence', () => {
        const m = createModel({ order: 3 });
        // Globally Banker-heavy, but after 'PPP' it is always Player.
        feed(m, 'BBBBBBBBBBBBBBBBBBBB'.split(''));
        for (let i = 0; i < 30; i++) learn(m, ['P', 'P', 'P'], 'P');

        expect(predict(m, ['B', 'B']).B).toBeGreaterThan(0.5);
        expect(predict(m, ['P', 'P', 'P']).P).toBeGreaterThan(0.8);
    });

    it('produces a proper distribution', () => {
        const m = createModel();
        feed(m, 'PBBPBPPBPB'.split(''));
        const p = predict(m, ['P', 'B']);
        expect(p.P + p.B).toBeCloseTo(1, 10);
        expect(p.P).toBeGreaterThan(0);
        expect(p.B).toBeGreaterThan(0);
    });

    it('is unchanged by context beyond its order', () => {
        const m = createModel({ order: 2 });
        feed(m, 'PBBPBPPBPB'.split(''));
        const short = predict(m, ['P', 'B']);
        const long = predict(m, ['B', 'P', 'B', 'B', 'P', 'B']);
        expect(long).toEqual(short);
    });
});

describe('callFor', () => {
    it('declines when neither side clears its break-even', () => {
        expect(callFor({ B: 0.505, P: 0.495 }).side).toBeNull();
    });

    it('backs Banker only above 51.28%, not above 50%', () => {
        expect(callFor({ B: 0.51, P: 0.49 }).side).toBeNull();
        expect(callFor({ B: 0.52, P: 0.48 }).side).toBe('B');
    });

    it('backs Player above 50%', () => {
        expect(callFor({ B: 0.47, P: 0.53 }).side).toBe('P');
    });

    it('demands more when a margin is set', () => {
        expect(callFor({ B: 0.52, P: 0.48 }, { margin: 0.05 }).side).toBeNull();
        expect(callFor({ B: 0.60, P: 0.40 }, { margin: 0.05 }).side).toBe('B');
    });

    it('reports the edge it is acting on', () => {
        const call = callFor({ B: 0.60, P: 0.40 });
        expect(call.edge).toBeCloseTo(0.6 - 1 / 1.95, 6);
    });
});

describe('scoring', () => {
    it('punishes confident wrong answers more than hedged ones', () => {
        expect(logLoss({ B: 0.99, P: 0.01 }, 'P')).toBeGreaterThan(logLoss({ B: 0.6, P: 0.4 }, 'P'));
        expect(brier({ B: 0.99, P: 0.01 }, 'P')).toBeGreaterThan(brier({ B: 0.6, P: 0.4 }, 'P'));
    });

    it('scores a perfect call at zero', () => {
        expect(logLoss({ B: 1, P: 0 }, 'B')).toBeCloseTo(0, 6);
        expect(brier({ B: 1, P: 0 }, 'B')).toBeCloseTo(0, 6);
    });
});
