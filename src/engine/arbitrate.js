// src/engine/arbitrate.js
//
// Settles conflicts between rules by their track record.
//
// The weight is a rule's hit rate shrunk toward an even split, by an amount
// that depends on how little evidence there is:
//
//     weight = (correct + k/2) / (n + k)
//
// A rule with 6 of 10 comes out near 51%, not 60%; a rule with 600 of 1000
// stays near 60%. A rule with no record sits at exactly 50%, so it outranks a
// rule measured to be bad and loses to one measured to be good.
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

/**
 * Strength of the even-split prior, in hands. A rule needs about this many
 * firings before its own rate outweighs the prior.
 *
 * Deliberately not tuned against the backtest: picking it to maximise a score
 * on a fixed set of hands is how you manufacture an edge that is not there.
 */
export const PRIOR_STRENGTH = 25;

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
export const recordsFrom = (log) => {
    const records = new Map();

    (log || []).forEach((entry) => {
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
export const applyToRecords = (records, entry) => {
    if (!entry || (entry.actual !== 'P' && entry.actual !== 'B')) return records;
    (entry.candidates || []).forEach(({ id, call }) => {
        if (call !== 'P' && call !== 'B') return;
        if (!records.has(id)) records.set(id, { n: 0, correct: 0 });
        const r = records.get(id);
        r.n += 1;
        if (call === entry.actual) r.correct += 1;
    });
    return records;
};

/** A rule's weight: its hit rate, shrunk toward even by how thin the record is. */
export const weightFor = (record, k = PRIOR_STRENGTH) => {
    if (!record || record.n === 0) return NO_RECORD_WEIGHT;
    return (record.correct + k / 2) / (record.n + k);
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
