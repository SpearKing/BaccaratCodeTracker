// src/engine/stats.js
//
// The statistics behind the stats panel.
//
// These are pure functions with reference-value tests, because a wrong formula
// here does not crash -- it prints a confident, wrong number forever, which is
// the exact failure this work exists to fix.
//
// The headline point: a raw hit rate is not the thing to look at. Banker bets
// pay 0.95 to 1, so a Banker call has to be right 51.28% of the time merely to
// break even. An engine sitting at "50.5% correct" that leans Banker is losing
// money while appearing to be ahead.

/** Banker wins pay 19:20 after the 5% commission. Player pays even money. */
export const BANKER_PAYOUT = 0.95;
export const PLAYER_PAYOUT = 1;

/** Hit rate a flat bet must beat just to break even. */
export const BANKER_BREAKEVEN = 1 / (1 + BANKER_PAYOUT); // 0.512820...
export const PLAYER_BREAKEVEN = 1 / (1 + PLAYER_PAYOUT); // 0.5

/** Baccarat's own rates over decided (non-tie) hands. */
export const BASE_RATE_BANKER = 0.5068;
export const BASE_RATE_PLAYER = 0.4932;

const Z_95 = 1.959963984540054;

/**
 * Wilson score interval for a binomial proportion.
 *
 * Preferred over the textbook normal interval because it stays inside [0, 1]
 * and behaves sensibly at small n and at 0% / 100%, which is exactly where a
 * few hundred hands of baccarat sit.
 *
 * Returns nulls for n = 0 rather than inventing an interval.
 */
export const wilsonInterval = (successes, n, z = Z_95) => {
    if (!n || n <= 0) return { estimate: null, low: null, high: null, n: 0 };

    const p = successes / n;
    const zSq = z * z;
    const denominator = 1 + zSq / n;
    const centre = (p + zSq / (2 * n)) / denominator;
    const halfWidth =
        (z / denominator) * Math.sqrt((p * (1 - p)) / n + zSq / (4 * n * n));

    return {
        estimate: p,
        low: Math.max(0, centre - halfWidth),
        high: Math.min(1, centre + halfWidth),
        n,
    };
};

// Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.15e-9).
// Used only for sample-size arithmetic, never in a hot path.
const normalQuantile = (p) => {
    if (p <= 0 || p >= 1) return NaN;

    const a = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2,
               1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239e+0];
    const b = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2,
               6.680131188771972e+1, -1.328068155288572e+1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e+0,
               -2.549732539343734e+0, 4.374664141464968e+0, 2.938163982698783e+0];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e+0,
               3.754408661907416e+0];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q;
    let r;

    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
               ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > pHigh) {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
};

/**
 * How many predictions are needed to tell `rate` apart from `baseline`.
 *
 * One-sided test of a single proportion. The answer is the reason Phase 3 was
 * deferred: separating 52% from 50% takes on the order of 3,900 predictions,
 * which is something like 56 shoes of real play.
 */
export const requiredSampleSize = (rate, baseline = 0.5, alpha = 0.05, power = 0.8) => {
    const delta = rate - baseline;
    if (!delta) return Infinity;

    const zAlpha = normalQuantile(1 - alpha);
    const zBeta = normalQuantile(power);
    const numerator =
        zAlpha * Math.sqrt(baseline * (1 - baseline)) + zBeta * Math.sqrt(rate * (1 - rate));

    return Math.ceil((numerator / delta) ** 2);
};

/** What one unit staked on `side` returns when the call is right or wrong. */
export const unitResult = (side, correct) => {
    if (!correct) return -1;
    return side === 'B' ? BANKER_PAYOUT : PLAYER_PAYOUT;
};

/** The hit rate a side has to beat to break even. */
export const breakEvenFor = (side) => (side === 'B' ? BANKER_BREAKEVEN : PLAYER_BREAKEVEN);

const isDecided = (result) => result === 'P' || result === 'B';

/**
 * A prediction counts towards accuracy only when a side was called AND the hand
 * settled. A tie is a push: the bet is returned, so it is neither a win nor a
 * loss and must not be folded into the hit rate.
 */
export const isResolved = (entry) => Boolean(entry.predicted) && isDecided(entry.actual);
export const isPush = (entry) => Boolean(entry.predicted) && entry.actual === 'T';

/** Tally of a set of resolved entries: hits, EV, interval, break-even gap. */
export const tally = (entries) => {
    const resolved = entries.filter(isResolved);
    const correct = resolved.filter((e) => e.predicted === e.actual).length;
    const n = resolved.length;

    const units = resolved.reduce(
        (sum, e) => sum + unitResult(e.predicted, e.predicted === e.actual),
        0
    );

    // The break-even bar depends on which sides were actually called, so a
    // mixed set is weighted by how often each side came up.
    const bankerCalls = resolved.filter((e) => e.predicted === 'B').length;
    const blendedBreakEven = n
        ? (bankerCalls * BANKER_BREAKEVEN + (n - bankerCalls) * PLAYER_BREAKEVEN) / n
        : null;

    return {
        n,
        correct,
        wrong: n - correct,
        pushes: entries.filter(isPush).length,
        interval: wilsonInterval(correct, n),
        evPerUnit: n ? units / n : null,
        units,
        breakEven: blendedBreakEven,
        bankerCalls,
        playerCalls: n - bankerCalls,
    };
};

/**
 * What the simple alternatives would have scored on the same hands.
 *
 * Without these a hit rate is unreadable: "52%" means nothing until you know
 * that always-Banker scored 51% on the same shoe.
 */
export const baselines = (entries) => {
    const decided = entries.filter((e) => isDecided(e.actual));

    const score = (pick) => {
        const graded = decided
            .map((e) => ({ ...e, predicted: pick(e) }))
            .filter((e) => Boolean(e.predicted));
        return tally(graded);
    };

    const prevOf = (e) => {
        const history = e.history || '';
        const decidedHistory = history.split('').filter(isDecided);
        return decidedHistory[decidedHistory.length - 1] || null;
    };
    const flip = (side) => (side === 'P' ? 'B' : 'P');

    return {
        alwaysBanker: score(() => 'B'),
        alwaysPlayer: score(() => 'P'),
        alwaysRepeat: score(prevOf),
        alwaysSwitch: score((e) => (prevOf(e) ? flip(prevOf(e)) : null)),
    };
};

const groupBy = (entries, keyOf) => {
    const out = new Map();
    entries.forEach((e) => {
        const key = keyOf(e);
        if (key === null || key === undefined) return;
        if (!out.has(key)) out.set(key, []);
        out.get(key).push(e);
    });
    return out;
};

const tallyGroups = (grouped) => {
    const out = new Map();
    [...grouped.entries()]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
        .forEach(([key, group]) => out.set(key, tally(group)));
    return out;
};

/**
 * Everything the stats panel needs from a decision log.
 *
 * `coverage` is worth watching alongside accuracy: the engine currently offers
 * an opinion on ~97% of hands, and an engine that never declines is not
 * choosing its spots.
 */
export const summarise = (log) => {
    const entries = log || [];
    const overall = tally(entries);
    const offered = entries.filter((e) => Boolean(e.predicted)).length;

    return {
        overall,
        coverage: entries.length ? offered / entries.length : null,
        decisions: entries.length,
        bySource: tallyGroups(groupBy(entries, (e) => e.source)),
        byConfidence: tallyGroups(groupBy(entries, (e) => e.confidence)),
        byPattern: tallyGroups(groupBy(entries, (e) => e.pattern)),
        baselines: baselines(entries),
        // How much more data would be needed to call the observed edge real.
        needed:
            overall.interval.estimate !== null && overall.breakEven !== null
                ? requiredSampleSize(overall.interval.estimate, overall.breakEven)
                : null,
    };
};

/**
 * Is the result distinguishable from simply betting blind?
 *
 * True only when the whole confidence interval clears the break-even bar. An
 * estimate above the bar with an interval straddling it is not evidence.
 */
export const beatsBreakEven = (t) =>
    t.n > 0 && t.breakEven !== null && t.interval.low !== null && t.interval.low > t.breakEven;
