// src/engine/arbitrate.js
//
// Settles conflicts between rules by their track record.
//
// A conflict is settled by how the rules involved have done AGAINST EACH OTHER,
// not by their rates in general. Those are different questions. `pattern` sits
// near 49% across every board it fires on, but the boards where it collides
// with `rule-of-three-banker` are specifically three-banker boards, and its
// rate there is its own number. Conditioning on the conflict uses it;
// comparing overall rates averages it away.
//
// Head-to-head is the better evidence and the thinner evidence, so it is used
// where it exists and backed off where it does not:
//
//   1. the pair's own record, once they have clashed enough times
//   2. failing that, each rule's overall hit rate
//   3. failing that, neutral -- no claim either way
//
// This started out as the Wilson LOWER bound, which sounds more rigorous and
// is wrong for the job. Measured on real hands it ranked `pattern` (49.3% over
// 2,289, lower bound 47.3%) above `rule-of-three-player` (51.0% over 473,
// lower bound 46.5%) -- the worse rule winning purely for having five times
// the sample. A lower bound answers "which rule am I most sure is not bad".
// The question here is "which rule is most likely to be right on this hand".
//
// Records are built only from hands BEFORE the one being called. That falls
// out of reading an append-only log, and it is what keeps the arbitration
// honest: a rule's future performance can never influence its present weight.

import { ENGINE_VERSION } from './version';

/**
 * Firings a rule needs before its hit rate is used at all.
 *
 * Below this it sits neutral rather than being trusted or distrusted, because
 * a rate over a handful of hands is not a rate. Without a floor, a rule at 60%
 * over 20 firings outranks one at 57% over 457 -- and the first of those is
 * noise: its interval runs from 39% to 78%.
 */
export const MIN_FIRINGS = 20;

/** Where a rule with no record sits: neutral, neither trusted nor distrusted. */
export const NO_RECORD_WEIGHT = 0.5;

/**
 * Each rule's record, from every hand where it fired -- including hands where
 * it lost the arbitration.
 *
 * That inclusion matters. If only the winner were recorded, a rule that keeps
 * losing would never accumulate the evidence it needs to start winning, and
 * whichever rule happened to lead early would lead for ever.
 */
export const recordsFrom = (log, engine = ENGINE_VERSION) => {
    const records = new Map();

    (log || []).forEach((entry) => {
        // Only decisions made by the engine now running. A rule's record under
        // one version says nothing about it under another, and blending them
        // produces a number that can never be unpicked. Entries from before
        // candidates were logged carry none, so they were already skipped --
        // but by accident rather than on purpose, which is not a guarantee.
        if (engine && entry.engine !== engine) return;
        // Test hands never reach the engine's memory. Filtered here as well as
        // at the call site, because a reader that forgets is exactly how the
        // engine-version leak nearly happened.
        if (entry.mode === 'test') return;
        if (entry.actual !== 'P' && entry.actual !== 'B') return;   // ties push
        (entry.candidates || []).forEach(({ id, call }) => {
            if (call !== 'P' && call !== 'B') return;
            if (!records.has(id)) records.set(id, { n: 0, correct: 0 });
            const r = records.get(id);
            r.n += 1;
            if (call === entry.actual) r.correct += 1;
        });
    });

    return records;
};

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * How each pair of rules has done when they disagreed.
 *
 * Stored once per unordered pair as { n, firstWins }, where `first` is the
 * lexically smaller id. A conflict is zero-sum -- exactly one side is right on
 * a decided hand -- so the other rate is one minus this one.
 */
export const headToHeadFrom = (log, engine = ENGINE_VERSION) => {
    const pairs = new Map();
    (log || []).forEach((entry) => applyToHeadToHead(pairs, entry, engine));
    return pairs;
};

/** Folds one decision into an existing head-to-head map. */
export const applyToHeadToHead = (pairs, entry, engine = ENGINE_VERSION) => {
    if (!entry || (entry.actual !== 'P' && entry.actual !== 'B')) return pairs;
    if (engine && entry.engine !== engine) return pairs;
    if (entry.mode === 'test') return pairs;

    const called = (entry.candidates || []).filter((c) => c.call === 'P' || c.call === 'B');
    for (let i = 0; i < called.length; i++) {
        for (let j = i + 1; j < called.length; j++) {
            const a = called[i];
            const b = called[j];
            if (a.call === b.call) continue;          // agreement is not a contest
            const key = pairKey(a.id, b.id);
            if (!pairs.has(key)) pairs.set(key, { n: 0, firstWins: 0 });
            const rec = pairs.get(key);
            rec.n += 1;
            const firstId = a.id < b.id ? a.id : b.id;
            const firstCall = a.id === firstId ? a.call : b.call;
            if (firstCall === entry.actual) rec.firstWins += 1;
        }
    }
    return pairs;
};

/** How often `id` has been right when it clashed with `opponentId`. */
export const headToHeadRate = (pairs, id, opponentId, minFirings = MIN_FIRINGS) => {
    const rec = pairs?.get(pairKey(id, opponentId));
    if (!rec || rec.n < minFirings) return null;
    const firstWinRate = rec.firstWins / rec.n;
    return id < opponentId ? firstWinRate : 1 - firstWinRate;
};

/**
 * Folds one decision into an existing record map.
 *
 * The incremental twin of recordsFrom, for replaying a long history without
 * rebuilding every rule's record on every hand.
 */
export const applyToRecords = (records, entry, engine = ENGINE_VERSION) => {
    if (!entry || (entry.actual !== 'P' && entry.actual !== 'B')) return records;
    if (engine && entry.engine !== engine) return records;
    if (entry.mode === 'test') return records;
    (entry.candidates || []).forEach(({ id, call }) => {
        if (call !== 'P' && call !== 'B') return;
        if (!records.has(id)) records.set(id, { n: 0, correct: 0 });
        const r = records.get(id);
        r.n += 1;
        if (call === entry.actual) r.correct += 1;
    });
    return records;
};

/** A rule's weight: its measured hit rate, once it has enough firings to have one. */
export const weightFor = (record, minFirings = MIN_FIRINGS) => {
    if (!record || record.n < minFirings) return NO_RECORD_WEIGHT;
    return record.correct / record.n;
};

/**
 * Picks the call from the rules that fired.
 *
 * Order of preference: better record, then the more specific rule, then the
 * order rules are declared. The two fallbacks only matter early on, when no
 * rule has a record yet and there is genuinely nothing to arbitrate with.
 */
export const arbitrate = (candidates, records, pairs) => {
    if (!candidates || candidates.length === 0) {
        return { call: null, winner: null, contested: false, candidates: [] };
    }

    const scored = candidates.map((c, index) => {
        const id = c.rule.id;

        // Against every candidate calling the other way, how has this one
        // actually fared? Averaged across opponents, which for the usual case
        // of two rules clashing is simply the one pairwise rate.
        const rates = candidates
            .filter((o) => o.call !== c.call)
            .map((o) => headToHeadRate(pairs, id, o.rule.id))
            .filter((r) => r !== null);

        const headToHead = rates.length
            ? rates.reduce((a, b) => a + b, 0) / rates.length
            : null;

        return {
            id,
            call: c.call,
            specificity: c.rule.specificity ?? 0,
            record: records?.get(id) || null,
            headToHead,
            weight: headToHead ?? weightFor(records?.get(id)),
            basis: headToHead !== null ? 'head-to-head' : (records?.get(id)?.n >= MIN_FIRINGS ? 'overall' : 'none'),
            index,
        };
    });

    const ranked = [...scored].sort((a, b) =>
        b.weight - a.weight ||
        b.specificity - a.specificity ||
        a.index - b.index
    );

    const best = ranked[0];
    const contested = scored.some((c) => c.call !== best.call);

    return {
        call: best.call,
        winner: best.id,
        contested,
        candidates: scored.map(({ index, ...rest }) => rest),
    };
};
