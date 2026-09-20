// src/engine/strategy.js
//
// "What if I only played these rules?"
//
// Takes a decision log -- live or replayed -- and re-scores it as though only
// a chosen set of rules were allowed to speak. Hands where none of them fire
// are passes: no bet, no result, and they are not counted against you.
//
// The candidates on each entry make this possible without replaying the grid:
// every rule that fired is already recorded, so restricting the set is a matter
// of ignoring the others and settling between what is left.
//
// Records are built as it goes, from the chosen rules only, so a rule's weight
// on any hand still comes from hands before it.

import { arbitrate, applyToRecords, applyToHeadToHead } from './arbitrate';
import { ruleById, firingRules } from './rules';
import { summarise } from './stats';

/**
 * Only the `pattern` rule reads the grid; every other rule reads the hand
 * sequence alone. So a strategy that leaves `pattern` out can be scored
 * straight from the hands, with no grid to rebuild -- which turns a fifty
 * second replay into a few milliseconds, and makes a 200-replicate null test
 * practical instead of a three-hour one.
 */
export const needsGrid = (ruleIds) => (ruleIds || []).includes('pattern');

/**
 * Re-scores a log under a restricted rule set.
 *
 * Returns entries in the same shape, so everything in stats.js reads them
 * unchanged, plus the hands that were passed on.
 */
export const simulateStrategy = (entries, ruleIds) => {
    const allowed = new Set(ruleIds);
    const records = new Map();
    const pairs = new Map();

    const played = [];
    let passed = 0;

    (entries || []).forEach((entry) => {
        const candidates = (entry.candidates || [])
            .filter((c) => allowed.has(c.id) && (c.call === 'P' || c.call === 'B'))
            .map((c) => ({ rule: ruleById(c.id) || { id: c.id, specificity: 0 }, call: c.call }));

        if (candidates.length === 0) { passed += 1; return; }

        const { call, winner, contested } = arbitrate(candidates, records, pairs);
        const scored = {
            ...entry,
            predicted: call,
            source: winner,
            contested,
            candidates: candidates.map(({ rule, call: c }) => ({ id: rule.id, call: c })),
        };

        played.push(scored);
        applyToRecords(records, scored);
        applyToHeadToHead(pairs, scored);
    });

    return {
        entries: played,
        passed,
        coverage: entries.length ? played.length / entries.length : null,
        records,
        summary: summarise(played),
    };
};

/**
 * Scores a strategy straight from hand sequences, without building any grids.
 *
 * Only valid when the chosen rules do not include `pattern` -- callers should
 * check needsGrid first and replay properly if it does.
 */
export const simulateFromCards = (cards, ruleIds) => {
    const allowed = new Set(ruleIds);
    const records = new Map();
    const pairs = new Map();
    const played = [];
    let passed = 0;
    let decisions = 0;

    (cards || []).forEach(({ name, hands }) => {
        for (let i = 1; i < hands.length; i++) {
            const before = hands.slice(0, i);
            const actual = hands[i];
            decisions += 1;

            const candidates = firingRules({ hands: before, scorecard: null, highlights: null, anchorRow: 0 })
                .filter((c) => allowed.has(c.rule.id));

            if (candidates.length === 0) { passed += 1; continue; }

            const { call, winner, contested } = arbitrate(candidates, records, pairs);
            const entry = {
                v: 2, engine: 'strategy', card: name, hand: i + 1,
                predicted: call, source: winner, contested,
                candidates: candidates.map(({ rule, call: c }) => ({ id: rule.id, call: c })),
                actual, confidence: 0, pattern: null, history: before.slice(-12).join(''), at: null,
            };

            played.push(entry);
            // The engine stamp differs from the running one, so the usual
            // version gate would drop everything; pass it explicitly.
            applyToRecords(records, entry, 'strategy');
            applyToHeadToHead(pairs, entry, 'strategy');
        }
    });

    return {
        entries: played,
        passed,
        decisions,
        coverage: decisions ? played.length / decisions : null,
        records,
        summary: summarise(played),
    };
};
