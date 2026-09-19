// src/engine/stats.test.js
//
// The formulas are checked against published worked examples, not against a
// second implementation written by the same hand. A confidence interval that is
// subtly wrong still renders a plausible-looking number, so "it runs" proves
// nothing here.

import {
    wilsonInterval,
    requiredSampleSize,
    unitResult,
    breakEvenFor,
    tally,
    baselines,
    summarise,
    beatsBreakEven,
    BANKER_BREAKEVEN,
    PLAYER_BREAKEVEN,
} from './stats';

const near = (actual, expected, tolerance = 5e-5) => {
    expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
};

describe('wilsonInterval', () => {
    // Standard textbook cases for the Wilson score interval at 95%.
    it('matches the published interval for 0 of 10', () => {
        const r = wilsonInterval(0, 10);
        near(r.low, 0);
        near(r.high, 0.27753);
    });

    it('matches the published interval for 10 of 10', () => {
        const r = wilsonInterval(10, 10);
        near(r.low, 0.72247);
        near(r.high, 1);
    });

    it('matches the published interval for 50 of 100', () => {
        const r = wilsonInterval(50, 100);
        near(r.low, 0.40383);
        near(r.high, 0.59617);
    });

    it('matches the published interval for 10 of 100', () => {
        const r = wilsonInterval(10, 100);
        near(r.low, 0.05522);
        near(r.high, 0.17436);
    });

    it('is symmetric under swapping successes and failures', () => {
        const a = wilsonInterval(30, 100);
        const b = wilsonInterval(70, 100);
        near(a.low, 1 - b.high);
        near(a.high, 1 - b.low);
    });

    it('stays inside [0, 1] at the extremes', () => {
        [0, 1, 5, 50].forEach((k) => {
            const r = wilsonInterval(k, 50);
            expect(r.low).toBeGreaterThanOrEqual(0);
            expect(r.high).toBeLessThanOrEqual(1);
        });
    });

    it('narrows as the sample grows', () => {
        const small = wilsonInterval(26, 50);
        const large = wilsonInterval(520, 1000);
        expect(large.high - large.low).toBeLessThan(small.high - small.low);
    });

    it('refuses to invent an interval from no data', () => {
        expect(wilsonInterval(0, 0)).toMatchObject({ estimate: null, low: null, high: null });
    });

    // The point that motivates showing intervals at all.
    it('shows that 52% over 200 hands does not clear 50%', () => {
        const r = wilsonInterval(104, 200);
        near(r.estimate, 0.52);
        expect(r.low).toBeLessThan(0.5);
        expect(r.high).toBeGreaterThan(0.5);
    });
});

describe('requiredSampleSize', () => {
    it('needs roughly 3,900 predictions to tell 52% from 50%', () => {
        const n = requiredSampleSize(0.52, 0.5);
        expect(n).toBeGreaterThan(3700);
        expect(n).toBeLessThan(4000);
    });

    it('needs far more to tell 51% from 50%', () => {
        expect(requiredSampleSize(0.51, 0.5)).toBeGreaterThan(15000);
    });

    it('needs less for a bigger edge', () => {
        expect(requiredSampleSize(0.60, 0.5)).toBeLessThan(200);
    });

    it('is infinite when there is no edge to detect', () => {
        expect(requiredSampleSize(0.5, 0.5)).toBe(Infinity);
    });
});

describe('the cost of the commission', () => {
    it('prices a Banker win at 0.95 and a Player win at 1', () => {
        expect(unitResult('B', true)).toBeCloseTo(0.95, 10);
        expect(unitResult('P', true)).toBeCloseTo(1, 10);
        expect(unitResult('B', false)).toBe(-1);
        expect(unitResult('P', false)).toBe(-1);
    });

    it('puts Banker break-even at 51.28%, not 50%', () => {
        near(BANKER_BREAKEVEN, 0.512820, 1e-5);
        expect(breakEvenFor('B')).toBe(BANKER_BREAKEVEN);
        expect(breakEvenFor('P')).toBe(PLAYER_BREAKEVEN);
    });

    it('shows a Banker bettor at 51% is still losing money', () => {
        const entries = Array.from({ length: 1000 }, (_, i) => ({
            predicted: 'B',
            actual: i < 510 ? 'B' : 'P',
        }));
        const t = tally(entries);
        near(t.interval.estimate, 0.51);
        // Over half right, and still down.
        expect(t.evPerUnit).toBeLessThan(0);
        expect(beatsBreakEven(t)).toBe(false);
    });
});

describe('tally', () => {
    const entries = [
        { predicted: 'B', actual: 'B' },
        { predicted: 'B', actual: 'P' },
        { predicted: 'P', actual: 'P' },
        { predicted: 'P', actual: 'B' },
        { predicted: 'B', actual: 'T' },   // push
        { predicted: null, actual: 'B' },  // no opinion
    ];

    it('counts only hands where a side was called and the hand settled', () => {
        const t = tally(entries);
        expect(t.n).toBe(4);
        expect(t.correct).toBe(2);
        expect(t.wrong).toBe(2);
    });

    it('treats a tie as a push rather than a loss', () => {
        const t = tally(entries);
        expect(t.pushes).toBe(1);
        // 0.95 - 1 + 1 - 1 = -0.05 over 4 resolved hands
        near(t.evPerUnit, -0.05 / 4);
    });

    it('blends the break-even bar across the sides actually called', () => {
        const t = tally(entries);
        expect(t.bankerCalls).toBe(2);
        expect(t.playerCalls).toBe(2);
        near(t.breakEven, (BANKER_BREAKEVEN + PLAYER_BREAKEVEN) / 2);
    });

    it('reports nothing rather than zero for an empty set', () => {
        const t = tally([]);
        expect(t.n).toBe(0);
        expect(t.evPerUnit).toBeNull();
        expect(t.interval.estimate).toBeNull();
    });
});

describe('baselines', () => {
    it('scores always-Banker and always-Player on the same hands', () => {
        const entries = [
            { actual: 'B', history: 'P' },
            { actual: 'B', history: 'PB' },
            { actual: 'P', history: 'PBB' },
        ];
        const b = baselines(entries);
        expect(b.alwaysBanker.correct).toBe(2);
        expect(b.alwaysPlayer.correct).toBe(1);
    });

    it('scores always-repeat and always-switch off the previous result', () => {
        const entries = [
            { actual: 'B', history: 'B' },  // repeat right, switch wrong
            { actual: 'P', history: 'BB' }, // repeat wrong, switch right
            { actual: 'P', history: 'BBP' },// repeat right, switch wrong
        ];
        const b = baselines(entries);
        expect(b.alwaysRepeat.correct).toBe(2);
        expect(b.alwaysSwitch.correct).toBe(1);
    });

    it('skips hands with no previous result to repeat', () => {
        const b = baselines([{ actual: 'B', history: '' }]);
        expect(b.alwaysRepeat.n).toBe(0);
        expect(b.alwaysBanker.n).toBe(1);
    });

    it('ignores ties when scoring baselines', () => {
        const b = baselines([{ actual: 'T', history: 'B' }, { actual: 'B', history: 'BT' }]);
        expect(b.alwaysBanker.n).toBe(1);
    });
});

describe('summarise', () => {
    const log = [
        { predicted: 'B', actual: 'B', confidence: 3, source: 'pattern', pattern: 'pattern-121', history: 'PB' },
        { predicted: 'B', actual: 'P', confidence: 3, source: 'pattern', pattern: 'pattern-121', history: 'PBB' },
        { predicted: 'P', actual: 'P', confidence: 4, source: 'rule-of-three-player', pattern: null, history: 'PBBP' },
        { predicted: null, actual: 'B', confidence: 0, source: null, pattern: null, history: 'PBBPP' },
    ];

    it('reports coverage, so an engine that never declines is visible', () => {
        const s = summarise(log);
        expect(s.decisions).toBe(4);
        near(s.coverage, 0.75);
    });

    it('splits results by the rule that produced them', () => {
        const s = summarise(log);
        expect(s.bySource.get('pattern').n).toBe(2);
        expect(s.bySource.get('rule-of-three-player').n).toBe(1);
    });

    it('splits results by confidence, so the level can be checked for meaning', () => {
        const s = summarise(log);
        expect(s.byConfidence.get(3).n).toBe(2);
        expect(s.byConfidence.get(4).n).toBe(1);
    });

    it('attributes pattern results only to the pattern that drove the call', () => {
        const s = summarise(log);
        expect(s.byPattern.get('pattern-121').n).toBe(2);
        expect(s.byPattern.has(null)).toBe(false);
    });

    it('survives an empty log', () => {
        const s = summarise([]);
        expect(s.decisions).toBe(0);
        expect(s.coverage).toBeNull();
        expect(s.overall.n).toBe(0);
    });
});

describe('beatsBreakEven', () => {
    it('is false when the interval straddles the bar, however good the estimate looks', () => {
        const entries = Array.from({ length: 200 }, (_, i) => ({
            predicted: 'P',
            actual: i < 104 ? 'P' : 'B',
        }));
        const t = tally(entries);
        near(t.interval.estimate, 0.52);
        expect(beatsBreakEven(t)).toBe(false);
    });

    it('is true only once the whole interval clears the bar', () => {
        const entries = Array.from({ length: 4000 }, (_, i) => ({
            predicted: 'P',
            actual: i < 2200 ? 'P' : 'B',
        }));
        const t = tally(entries);
        near(t.interval.estimate, 0.55);
        expect(beatsBreakEven(t)).toBe(true);
    });
});
