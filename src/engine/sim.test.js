// src/engine/sim.test.js
//
// The harness has to be checked before anything it produces is believed.
//
// The load-bearing test is `scores break-even on independent hands`. Every rule
// here reads nothing but the sequence of past results, and in the independent
// generator the sequence carries no information about the next hand. So the
// rules MUST come out at break-even. If they do not, the bug is in the harness
// -- a lookahead, an off-by-one between the call and the observation -- and
// every other number this module produces would be wrong in the same direction.

import { runBatch, mergeResults, emptyResult, finalise, scoreTally } from './sim';

const WIENER_SNAKE = ['wiener-3', 'wiener-4', 'wiener-5', 'snake-box-2', 'snake-box-3'];

describe('runBatch', () => {
    it('is reproducible from its seed', () => {
        const opts = { seed: 42, shoes: 60, ruleIds: WIENER_SNAKE };
        expect(runBatch(opts).pooled).toEqual(runBatch(opts).pooled);
    });

    it('gives different answers for different seeds', () => {
        const a = runBatch({ seed: 1, shoes: 60, ruleIds: WIENER_SNAKE });
        const b = runBatch({ seed: 2, shoes: 60, ruleIds: WIENER_SNAKE });
        expect(a.pooled.correct).not.toBe(b.pooled.correct);
    });

    it('counts every hand and accounts for each one', () => {
        const r = runBatch({ seed: 3, shoes: 50, ruleIds: WIENER_SNAKE });

        // Every decision either placed a bet or passed. Nothing is lost.
        expect(r.passed + r.pooled.fired).toBe(r.decisions);
        // Every bet either resolved or pushed.
        expect(r.pooled.n + r.pooled.pushes).toBe(r.pooled.fired);

        // A shoe's opening hand is never a decision, so decisions fall short of
        // hands by at least one per shoe -- and by more when a shoe OPENS on a
        // tie, because a tie is not a result and leaves the rules with still
        // nothing to read. At a 9.5% tie rate that is a few extra per fifty
        // shoes, which is why this is a bound and not an equality.
        expect(r.decisions).toBeLessThanOrEqual(r.hands - r.shoes);
        expect(r.decisions).toBeGreaterThan(r.hands - r.shoes * 2);
    });

    it('scores break-even on independent hands', () => {
        // The null made concrete. ~6,000 shoes is enough that a real bias of
        // even half a percent would show clearly.
        const r = finalise(runBatch({
            seed: 20260920, shoes: 6000, ruleIds: WIENER_SNAKE, generator: 'iid',
        }));

        expect(r.pooled.n).toBeGreaterThan(20000);

        // Within three standard errors of the break-even bar, in both
        // directions. Beating it would be as much a bug as losing to it.
        const se = Math.sqrt((r.pooled.breakEven * (1 - r.pooled.breakEven)) / r.pooled.n);
        expect(Math.abs(r.pooled.rate - r.pooled.breakEven)).toBeLessThan(3 * se);
    });

    it('scores break-even on dealt shoes too', () => {
        // The interesting one. Real cards leave the shoe and do not come back,
        // so hands are not quite independent -- but the effect is worth
        // hundredths of a percent, far too small to read a pattern from.
        const r = finalise(runBatch({
            seed: 7, shoes: 6000, ruleIds: WIENER_SNAKE, generator: 'shoe',
        }));

        const se = Math.sqrt((r.pooled.breakEven * (1 - r.pooled.breakEven)) / r.pooled.n);
        expect(Math.abs(r.pooled.rate - r.pooled.breakEven)).toBeLessThan(3 * se);
    });

    it('records a firing for every rule that fired, not just the winner', () => {
        const r = runBatch({ seed: 11, shoes: 200, ruleIds: WIENER_SNAKE });

        // These five can never co-fire (see the matrix in rules.js), so the
        // firings must add up to exactly the pooled count.
        const summed = WIENER_SNAKE.reduce((acc, id) => acc + r.rules[id].fired, 0);
        expect(summed).toBe(r.pooled.fired);
    });

    it('counts a rule-of-three board for both the pooled row and the rule', () => {
        const r = runBatch({ seed: 13, shoes: 200, ruleIds: ['rule-of-three-banker'] });
        expect(r.rules['rule-of-three-banker'].fired).toBe(r.pooled.fired);
        expect(r.rules['rule-of-three-banker'].correct).toBe(r.pooled.correct);
    });

    it('treats a tie as a push rather than a loss', () => {
        const r = runBatch({ seed: 17, shoes: 300, ruleIds: WIENER_SNAKE });

        expect(r.pooled.pushes).toBeGreaterThan(0);
        // Pushes are outside the hit rate entirely: n counts resolved bets only.
        expect(r.pooled.n).toBe(r.pooled.fired - r.pooled.pushes);
    });

    it('runs the grid-reading rule when it is asked for', () => {
        const r = runBatch({ seed: 19, shoes: 40, ruleIds: ['pattern'] });
        expect(r.rules.pattern.fired).toBeGreaterThan(0);
    });

    it('stops early when told to', () => {
        let calls = 0;
        const r = runBatch({
            seed: 23, shoes: 100000, ruleIds: WIENER_SNAKE,
            shouldStop: () => { calls += 1; return calls >= 2; },
        });
        expect(r.shoes).toBeLessThan(1000);
    });

    it('bets only inside the hand window', () => {
        const full = runBatch({ seed: 31, shoes: 300, ruleIds: WIENER_SNAKE });
        const window = runBatch({ seed: 31, shoes: 300, ruleIds: WIENER_SNAKE, fromHand: 20, toHand: 70 });

        // Same shoes, same cards -- only the betting window differs.
        expect(window.hands).toBe(full.hands);
        expect(window.shoes).toBe(full.shoes);
        expect(window.decisions).toBeLessThan(full.decisions);
        expect(window.pooled.fired).toBeLessThan(full.pooled.fired);
        expect(window.pooled.fired).toBeGreaterThan(0);
    });

    it('still lets the rules read the hands it is not betting on', () => {
        // A rule needs several hands of history before it can fire at all. If
        // the window cut the history as well as the betting, a window starting
        // at hand 20 would spend its first hands unable to fire -- so the test
        // is that firings start immediately at the window edge.
        const late = runBatch({ seed: 37, shoes: 400, ruleIds: WIENER_SNAKE, fromHand: 60, toHand: 62 });

        // Three hands per shoe, and rules fire on roughly 9% of hands.
        expect(late.decisions).toBeGreaterThan(1000);
        expect(late.pooled.fired).toBeGreaterThan(50);
    });

    it('covers the whole shoe when no window is given', () => {
        const opts = { seed: 41, shoes: 100, ruleIds: WIENER_SNAKE };
        expect(runBatch(opts).pooled).toEqual(runBatch({ ...opts, fromHand: 1, toHand: null }).pooled);
    });

    it('samples a curve at the interval asked for', () => {
        const r = runBatch({ seed: 29, shoes: 100, ruleIds: WIENER_SNAKE, sampleEvery: 10 });
        expect(r.curve).toHaveLength(10);
        expect(r.curve[0].shoes).toBe(10);
        expect(r.curve[9].shoes).toBe(100);
        // Bets only ever accumulate.
        for (let i = 1; i < r.curve.length; i++) {
            expect(r.curve[i].bets).toBeGreaterThanOrEqual(r.curve[i - 1].bets);
        }
    });
});

describe('mergeResults', () => {
    const a = runBatch({ seed: 100, shoes: 40, ruleIds: WIENER_SNAKE, sampleEvery: 10 });
    const b = runBatch({ seed: 200, shoes: 40, ruleIds: WIENER_SNAKE, sampleEvery: 10 });

    it('adds the counters', () => {
        const m = mergeResults(a, b);
        expect(m.shoes).toBe(a.shoes + b.shoes);
        expect(m.hands).toBe(a.hands + b.hands);
        expect(m.pooled.n).toBe(a.pooled.n + b.pooled.n);
        expect(m.pooled.correct).toBe(a.pooled.correct + b.pooled.correct);
        expect(m.pooled.units).toBeCloseTo(a.pooled.units + b.pooled.units, 9);
    });

    it('lifts the second curve onto the end of the first', () => {
        const m = mergeResults(a, b);
        expect(m.curve).toHaveLength(a.curve.length + b.curve.length);

        // The join has to be continuous: the first point of b's section must
        // sit at a's final totals plus b's own first step, never restart at
        // zero. A curve that resets mid-run would read as a crash on the graph.
        const joinIndex = a.curve.length;
        expect(m.curve[joinIndex].bets).toBe(a.pooled.n + b.curve[0].bets);
        expect(m.curve[joinIndex].shoes).toBe(a.shoes + b.curve[0].shoes);

        for (let i = 1; i < m.curve.length; i++) {
            expect(m.curve[i].bets).toBeGreaterThanOrEqual(m.curve[i - 1].bets);
            expect(m.curve[i].shoes).toBeGreaterThan(m.curve[i - 1].shoes);
        }
    });

    it('treats an empty accumulator as the identity', () => {
        const m = mergeResults(emptyResult(WIENER_SNAKE), a);
        expect(m.pooled).toEqual(a.pooled);
        expect(m.shoes).toBe(a.shoes);
    });

    it('is associative over three batches, which is what a worker pool needs', () => {
        const c = runBatch({ seed: 300, shoes: 40, ruleIds: WIENER_SNAKE, sampleEvery: 10 });
        const left = mergeResults(mergeResults(a, b), c);
        const right = mergeResults(a, mergeResults(b, c));

        expect(left.pooled).toEqual(right.pooled);
        expect(left.curve).toEqual(right.curve);
    });
});

describe('scoreTally', () => {
    it('only claims an edge when the whole interval clears the bar', () => {
        // 55% over 229 bets -- the real result that prompted all of this. The
        // estimate is above break-even; the interval is not.
        const marginal = scoreTally({
            fired: 229, n: 229, correct: 126, pushes: 0, units: 19.8, bankerCalls: 115,
        });
        expect(marginal.rate).toBeGreaterThan(marginal.breakEven);
        expect(marginal.beatsBreakEven).toBe(false);

        // The same rate over 20,000 bets is a different matter entirely.
        const settled = scoreTally({
            fired: 20000, n: 20000, correct: 11000, pushes: 0, units: 1730, bankerCalls: 10000,
        });
        expect(settled.beatsBreakEven).toBe(true);
    });

    it('flags a losing rule rather than leaving it to be misread as neutral', () => {
        const bad = scoreTally({
            fired: 20000, n: 20000, correct: 9400, pushes: 0, units: -1200, bankerCalls: 10000,
        });
        expect(bad.belowBreakEven).toBe(true);
    });
});
