// src/engine/sim.js
//
// Runs a rule set over generated shoes and accumulates the result.
//
// Two things shape this module.
//
// First, it never builds an array of entries. `strategy.js` does, and that is
// right for a few thousand real hands, but a million shoes is eighty million
// hands and materialising those would exhaust the tab long before the run
// finished. Everything here is counters, folded forward. What comes back from a
// run of eighty million hands is the same few hundred bytes as a run of eighty.
//
// Second, it uses the shipped rules rather than a copy. `firingRules` and
// `arbitrate` are the same functions the live engine calls on every hand, so a
// simulated result is a statement about the engine that is actually running.
// The only concession is a precomputed transitions array (see rules.js), which
// changes the cost and not the answer.

import { RULES, ruleById, firingRules } from './rules';
import { arbitrate, applyToRecords, applyToHeadToHead } from './arbitrate';
import { unitResult, BANKER_BREAKEVEN, PLAYER_BREAKEVEN, wilsonInterval } from './stats';
import { needsGrid } from './strategy';
import { GENERATORS, mulberry32 } from './shoe';
import { deriveGrid } from './grid';
import { computeHighlights } from './analytics';

/** The engine stamp simulated decisions carry, so they never mix with real ones. */
export const SIM_ENGINE = 'sim';

const zeroTally = () => ({ fired: 0, n: 0, correct: 0, pushes: 0, units: 0, bankerCalls: 0 });

/** A zeroed accumulator. Also the identity for `mergeResults`. */
export const emptyResult = (ruleIds = []) => ({
    ruleIds: [...ruleIds],
    shoes: 0,
    hands: 0,
    decisions: 0,
    passed: 0,
    contested: 0,
    pooled: zeroTally(),
    rules: Object.fromEntries(ruleIds.map((id) => [id, zeroTally()])),
    curve: [],
});

const foldTally = (t, call, actual) => {
    t.fired += 1;
    if (actual === 'T') { t.pushes += 1; return; }   // a push is not a result
    t.n += 1;
    if (call === 'B') t.bankerCalls += 1;
    const won = call === actual;
    if (won) t.correct += 1;
    t.units += unitResult(call, won);
};

/**
 * Plays one generated shoe and folds it into `acc`.
 *
 * Mirrors the live engine's order of events exactly: the call is formed from
 * the hands already decided, THEN the hand is observed. A tie is a push -- the
 * bet is returned -- and the tie is not added to the history the rules read,
 * because `predictNextHand` filters ties out before the rules ever see them.
 */
/**
 * Scores one hand: asks the rules, settles between them, folds the answer in.
 *
 * Shared by both traversals below so the grid and grid-free paths cannot come
 * to different conclusions about the same board.
 */
const scoreHand = (acc, context, actual, allowed, records, pairs) => {
    acc.decisions += 1;

    const candidates = firingRules(context).filter((c) => allowed.has(c.rule.id));
    if (candidates.length === 0) { acc.passed += 1; return; }

    const { call, contested } = arbitrate(candidates, records, pairs);
    if (contested) acc.contested += 1;

    // Every rule that fired is scored on its own merits, win or lose the
    // arbitration. That is what `recordsFrom` measures on real play, so the
    // simulated per-rule table means the same thing as the live one.
    candidates.forEach(({ rule, call: ruleCall }) => foldTally(acc.rules[rule.id], ruleCall, actual));
    foldTally(acc.pooled, call, actual);

    // Feed the arbitrator, exactly as a played hand would.
    const entry = {
        engine: SIM_ENGINE,
        actual,
        candidates: candidates.map(({ rule, call: c }) => ({ id: rule.id, call: c })),
    };
    applyToRecords(records, entry, SIM_ENGINE);
    applyToHeadToHead(pairs, entry, SIM_ENGINE);
};

/**
 * Hands are numbered from one over everything dealt, ties included, which is
 * how they are counted at a table.
 *
 * Outside the betting window a hand is still watched -- it joins the history
 * the rules read -- but nothing is scored and no record is updated. The window
 * is the experiment; everything before it is just sitting down and looking.
 */
const inWindow = (handNo, from, to) => handNo >= from && (to === null || handNo <= to);

/**
 * Plays one generated shoe and folds it into `acc`.
 *
 * Mirrors the live engine's order of events exactly: the call is formed from
 * the hands already decided, THEN the hand is observed. A tie is a push -- the
 * bet is returned -- and the tie is not added to the history the rules read,
 * because `predictNextHand` filters ties out before the rules ever see them.
 *
 * The grid-free path is the one that runs at scale. Only `pattern` reads the
 * board, so a rule set without it needs no grid at all, and skipping the grid
 * is the difference between a million shoes and a thousand.
 */
const playInto = (acc, results, allowed, records, pairs, useGrid, from, to) => {
    acc.shoes += 1;
    acc.hands += results.length;

    const decided = [];        // P/B only: what the rules are shown
    const transitions = [];    // maintained alongside, so rules never rebuild it

    const observe = (actual) => {
        if (actual === 'T') return;
        if (decided.length > 0) {
            transitions.push(actual === decided[decided.length - 1] ? 'R' : 'O');
        }
        decided.push(actual);
    };

    if (!useGrid) {
        for (let i = 0; i < results.length; i++) {
            const actual = results[i];
            if (decided.length > 0 && inWindow(i + 1, from, to)) {
                scoreHand(
                    acc,
                    { scorecard: null, highlights: null, anchorRow: 0, hands: decided, transitions },
                    actual, allowed, records, pairs
                );
            }
            observe(actual);
        }
        return;
    }

    // The grid path rides deriveGrid's own traversal through its onStep hook,
    // which fires with the board as it stood BEFORE each hand was applied --
    // precisely the state the engine would have been looking at. Rebuilding
    // the grid per hand instead is quadratic and was measured at 1.5 seconds a
    // shoe; this is one pass. It is also the same hook `backtest.js` uses, so
    // simulated and replayed boards cannot drift apart.
    deriveGrid(results, results.length + 2, ({ grid, rowIdx, hand, parentRowIdx }) => {
        if (parentRowIdx > 0 && inWindow(rowIdx, from, to)) {
            scoreHand(
                acc,
                {
                    scorecard: grid,
                    highlights: computeHighlights(grid, grid[0].length),
                    anchorRow: parentRowIdx,
                    hands: decided,
                    transitions,
                },
                hand, allowed, records, pairs
            );
        }
        observe(hand);
    });
};

/**
 * Runs `shoes` generated shoes and returns the accumulated result.
 *
 * `arbitration` chooses whether rules learn as the run proceeds:
 *
 *   'adaptive' -- records build up and settle conflicts, as in the live app
 *   'off'      -- conflicts fall back to specificity, so each rule's own rate
 *                 is measured without the arbitrator moving underneath it
 *
 * It only affects the pooled row. Per-rule numbers count every firing either
 * way, so they are unchanged by it.
 */
export const runBatch = ({
    seed = 1,
    shoes = 1000,
    ruleIds = [],
    generator = 'shoe',
    arbitration = 'adaptive',
    fromHand = 1,
    toHand = null,
    sampleEvery = 0,
    onProgress = null,
    shouldStop = null,
} = {}) => {
    const gen = GENERATORS[generator] || GENERATORS.shoe;
    const rng = mulberry32(seed);
    const allowed = new Set(ruleIds);
    const useGrid = needsGrid(ruleIds);

    const from = Math.max(1, fromHand || 1);
    const to = toHand === null || toHand === undefined || toHand <= 0 ? null : toHand;

    const acc = emptyResult(ruleIds);
    acc.generator = generator;
    acc.arbitration = arbitration;
    acc.seed = seed;
    acc.fromHand = from;
    acc.toHand = to;

    // With arbitration off the maps stay empty, so every rule sits on the
    // neutral weight and specificity decides -- which is the point.
    const records = new Map();
    const pairs = new Map();
    const live = arbitration === 'adaptive';

    for (let s = 0; s < shoes; s++) {
        playInto(
            acc, gen.deal(rng), allowed,
            live ? records : new Map(), live ? pairs : new Map(),
            useGrid, from, to
        );

        if (sampleEvery && (s + 1) % sampleEvery === 0) {
            acc.curve.push({
                shoes: acc.shoes,
                bets: acc.pooled.n,
                units: acc.pooled.units,
                correct: acc.pooled.correct,
            });
        }

        // Checked on a shoe boundary rather than per hand: cheap, and a single
        // shoe is a few microseconds.
        if (onProgress && (s + 1) % 200 === 0) onProgress(s + 1);
        if (shouldStop && (s + 1) % 200 === 0 && shouldStop()) break;
    }

    return acc;
};

const addTally = (a, b) => ({
    fired: a.fired + b.fired,
    n: a.n + b.n,
    correct: a.correct + b.correct,
    pushes: a.pushes + b.pushes,
    units: a.units + b.units,
    bankerCalls: a.bankerCalls + b.bankerCalls,
});

/**
 * Combines two accumulators.
 *
 * Counters simply add. The curve is the part that needs care: each worker
 * covers a disjoint block of shoes, so its curve starts from zero and has to be
 * lifted by everything that came before it. Merging in worker order therefore
 * produces one continuous walk, which is exactly what it would have been had
 * the shoes been played in sequence on one thread.
 */
export const mergeResults = (a, b) => {
    if (!a) return b;
    if (!b) return a;

    const offsetBets = a.pooled.n;
    const offsetUnits = a.pooled.units;
    const offsetCorrect = a.pooled.correct;
    const offsetShoes = a.shoes;

    const ruleIds = [...new Set([...a.ruleIds, ...b.ruleIds])];

    return {
        ruleIds,
        generator: a.generator ?? b.generator,
        arbitration: a.arbitration ?? b.arbitration,
        fromHand: a.fromHand ?? b.fromHand,
        toHand: a.toHand ?? b.toHand,
        seed: a.seed,
        shoes: a.shoes + b.shoes,
        hands: a.hands + b.hands,
        decisions: a.decisions + b.decisions,
        passed: a.passed + b.passed,
        contested: a.contested + b.contested,
        pooled: addTally(a.pooled, b.pooled),
        rules: Object.fromEntries(ruleIds.map((id) => [
            id,
            addTally(a.rules[id] || zeroTally(), b.rules[id] || zeroTally()),
        ])),
        curve: [
            ...a.curve,
            ...b.curve.map((p) => ({
                shoes: p.shoes + offsetShoes,
                bets: p.bets + offsetBets,
                units: p.units + offsetUnits,
                correct: p.correct + offsetCorrect,
            })),
        ],
    };
};

/** The break-even rate for a set of calls, weighted by how often each side was called. */
export const blendedBreakEven = (t) =>
    t.n ? (t.bankerCalls * BANKER_BREAKEVEN + (t.n - t.bankerCalls) * PLAYER_BREAKEVEN) / t.n : null;

/** Turns a tally's counters into the rates and interval the UI shows. */
export const scoreTally = (t) => {
    const interval = wilsonInterval(t.correct, t.n);
    const breakEven = blendedBreakEven(t);
    return {
        ...t,
        rate: interval.estimate,
        low: interval.low,
        high: interval.high,
        breakEven,
        evPerUnit: t.n ? t.units / t.n : null,
        // An edge is only claimed when the WHOLE interval clears the bar. A
        // point estimate above it with an interval straddling it is the exact
        // mistake this app exists to stop making.
        beatsBreakEven: t.n > 0 && interval.low !== null && breakEven !== null && interval.low > breakEven,
        belowBreakEven: t.n > 0 && interval.high !== null && breakEven !== null && interval.high < breakEven,
    };
};

/**
 * Everything the panel renders, derived from an accumulator.
 *
 * `z` is how many standard errors the pooled rate sits above break-even. It is
 * the number that actually answers the question: at a few hundred bets a 55%
 * hit rate is under two, and at a few hundred thousand a 50.7% one is over ten.
 */
export const finalise = (acc) => {
    if (!acc) return null;

    const pooled = scoreTally(acc.pooled);
    const rules = (acc.ruleIds || [])
        .map((id) => ({ id, label: ruleById(id)?.label || id, ...scoreTally(acc.rules[id] || zeroTally()) }))
        .filter((r) => r.fired > 0)
        .sort((a, b) => b.n - a.n);

    let z = null;
    if (pooled.n > 0 && pooled.breakEven !== null) {
        const se = Math.sqrt((pooled.breakEven * (1 - pooled.breakEven)) / pooled.n);
        z = se > 0 ? (pooled.rate - pooled.breakEven) / se : null;
    }

    return {
        ...acc,
        pooled,
        ruleRows: rules,
        z,
        coverage: acc.decisions ? pooled.fired / acc.decisions : null,
        curve: acc.curve,
    };
};

/** Rules a simulation can run. `pattern` is flagged because it needs the grid. */
export const SIMULATABLE_RULES = RULES.map((r) => ({
    id: r.id,
    label: r.label || r.id,
    note: r.note,
    needsGrid: r.id === 'pattern',
}));
