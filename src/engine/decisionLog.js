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

/**
 * Shape version for the stored records, separate from the engine version.
 *
 * v2 adds `candidates`: every rule that fired on the hand and what it called,
 * not just the one that won. Arbitration needs that -- if only winners were
 * recorded, a rule that keeps losing could never build the record it needs to
 * start winning, and whichever rule led first would lead for ever.
 */
export const LOG_SCHEMA_VERSION = 2;

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
export const makeEntry = ({ card, handIndex, prediction, actual, hands, at, mode }) => ({
    v: LOG_SCHEMA_VERSION,
    engine: ENGINE_VERSION,
    card: card || null,
    hand: handIndex,
    predicted: prediction?.prediction ?? null,
    confidence: prediction?.confidence ?? 0,
    source: prediction?.source ?? null,
    pattern: prediction?.pattern ?? null,
    // Only id and call are kept: the record each rule held at the time is
    // derivable from the entries before this one, so storing it would both
    // bloat the log and let a stale copy disagree with the log itself.
    candidates: (prediction?.candidates ?? []).map(({ id, call }) => ({ id, call })),
    contested: prediction?.contested ?? false,
    actual,
    history: historyBefore(hands, handIndex),
    at: at || new Date().toISOString(),
    // 'test' marks a hand played to try something out. Such entries are kept
    // -- discarding them would make an accidental test session unrecoverable --
    // but every reader excludes them, so they never reach the engine's memory
    // or the headline numbers.
    ...(mode === 'test' ? { mode: 'test' } : {}),
});

/** Real play. This is what the engine learns from and what the stats report. */
export const liveEntries = (log) => (log || []).filter((e) => e.mode !== 'test');

/** Hands played in test mode, kept separate rather than thrown away. */
export const testEntries = (log) => (log || []).filter((e) => e.mode === 'test');

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

/**
 * A server row as a log entry.
 *
 * The table uses snake_case column names; the log uses the shape the engine
 * reads. Kept beside makeEntry so the two cannot drift.
 */
export const fromServerRow = (row) => ({
    v: row.schema_version ?? 1,
    engine: row.engine_version,
    card: row.card ?? null,
    hand: row.hand_index,
    predicted: row.predicted ?? null,
    confidence: row.confidence ?? 0,
    source: row.source ?? null,
    pattern: row.pattern ?? null,
    candidates: Array.isArray(row.candidates) ? row.candidates : [],
    contested: Boolean(row.contested),
    actual: row.actual,
    history: row.history ?? '',
    at: row.decided_at,
    ...(row.mode ? { mode: row.mode } : {}),
    ...(row.replayed ? { replayed: true } : {}),
});
