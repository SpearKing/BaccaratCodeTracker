// src/engine/arbitrate.js
//
// Settles conflicts between rules by their track record.
//
// The weight is a rule's measured hit rate, plain, once it has fired enough
// times to have one. Below that floor it sits neutral: it outranks a rule
// measured to be bad and loses to one measured to be good, but makes no claim
// of its own.
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

/**
 * Folds one decision into an existing record map.
 *
 * The incremental twin of recordsFrom, for replaying a long history without
 * rebuilding every rule's record on every hand.
 */
export const applyToRecords = (records, entry, engine = ENGINE_VERSION) => {
    if (!entry || (entry.actual !== 'P' && entry.actual !== 'B')) return records;
    if (engine && entry.engine !== engine) return records;
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
export const arbitrate = (candidates, records) => {
    if (!candidates || candidates.length === 0) {
        return { call: null, winner: null, contested: false, candidates: [] };
    }

    const scored = candidates.map((c, index) => ({
        id: c.rule.id,
        call: c.call,
        specificity: c.rule.specificity ?? 0,
        record: records?.get(c.rule.id) || null,
        weight: weightFor(records?.get(c.rule.id)),
        index,
    }));

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
