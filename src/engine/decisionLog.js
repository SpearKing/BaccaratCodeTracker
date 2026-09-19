// src/engine/decisionLog.js
//
// An append-only record of every prediction the engine made and what actually
// happened next.
//
// The app previously kept two running counters, `correct` and `wrong`, edited
// in place whenever a past hand was changed. That cannot support any claim: it
// cannot be broken down by rule or by confidence, it cannot be replayed against
// a proposed change, and a few stray edits quietly corrupt it. This replaces it.
//
// Two rules keep the log honest:
//
//   1. Only forward play is logged. Editing a hand that was already recorded is
//      not a prediction event -- the outcome is already known -- so corrections
//      never enter the log.
//   2. Entries are never mutated. Nothing in here updates a past record.

import { ENGINE_VERSION } from './predict';

/** Shape version for the stored records, separate from the engine version. */
export const LOG_SCHEMA_VERSION = 1;

/** How many preceding hands each entry carries, for re-deriving features later. */
export const HISTORY_LENGTH = 12;

/**
 * The hands leading up to `handIndex`, oldest first, as a compact string.
 *
 * Stored so that Phase 3 can compute new features from old decisions without
 * needing the original scorecard -- including ties, which a feature might care
 * about even though the current rules step over them.
 */
export const historyBefore = (hands, handIndex, length = HISTORY_LENGTH) => {
    const upto = hands.slice(0, Math.max(0, handIndex - 1));
    return upto.slice(-length).join('');
};

/**
 * Builds one immutable log entry.
 *
 * `prediction` is whatever the engine was showing BEFORE this hand landed,
 * including the case where it had no opinion -- those are kept, because
 * coverage is part of what is being measured.
 */
export const makeEntry = ({ card, handIndex, prediction, actual, hands, at }) => ({
    v: LOG_SCHEMA_VERSION,
    engine: ENGINE_VERSION,
    card: card || null,
    hand: handIndex,
    predicted: prediction?.prediction ?? null,
    confidence: prediction?.confidence ?? 0,
    source: prediction?.source ?? null,
    pattern: prediction?.pattern ?? null,
    actual,
    history: historyBefore(hands, handIndex),
    at: at || new Date().toISOString(),
});

/**
 * Drops duplicate records for the same hand, keeping the most recent.
 *
 * The log is append-only and a card can be replayed, so the same (card, hand)
 * may appear more than once. Analysis reads the latest.
 */
export const dedupe = (entries) => {
    const byKey = new Map();
    entries.forEach((e) => byKey.set(`${e.card}#${e.hand}`, e));
    return [...byKey.values()];
};

/** Entries produced by an engine other than the one running now. */
export const staleEntries = (entries, engine = ENGINE_VERSION) =>
    entries.filter((e) => e.engine !== engine);

/** Splits a log by engine version, so two engines are never averaged together. */
export const byEngine = (entries) => {
    const out = new Map();
    entries.forEach((e) => {
        if (!out.has(e.engine)) out.set(e.engine, []);
        out.get(e.engine).push(e);
    });
    return out;
};
