-- backend/schema.sql
--
-- The database shape, kept in the repo. Until this file existed it lived only
-- inside the running Postgres instance, so there was no way to stand the
-- backend up again or to review a change to it.
--
-- Safe to run repeatedly.

-- Saved scorecards. `data` holds { scorecard, lastWinType, lastWinRow }, and
-- `stats` now holds only that card's own Player/Banker counts -- prediction
-- accuracy moved to the predictions table below.
CREATE TABLE IF NOT EXISTS scorecards (
    name  TEXT PRIMARY KEY,
    data  JSONB NOT NULL,
    stats JSONB
);

-- The decision log: one row per prediction the engine made, with what actually
-- happened next. Append-only. Nothing updates a row here.
--
-- engine_version is the reason this table can be trusted over time. Without it,
-- changing the prediction rules silently blends two different engines into one
-- accuracy figure that can never be separated again.
CREATE TABLE IF NOT EXISTS predictions (
    id             BIGSERIAL PRIMARY KEY,
    schema_version INT         NOT NULL DEFAULT 1,
    engine_version TEXT        NOT NULL,
    card           TEXT,
    hand_index     INT         NOT NULL,
    predicted      TEXT,                  -- 'P' | 'B' | NULL when it had no opinion
    confidence     INT,
    source         TEXT,                  -- which rule fired
    pattern        TEXT,                  -- driving pattern, when source = 'pattern'
    actual         TEXT        NOT NULL,  -- 'P' | 'B' | 'T'
    history        TEXT,                  -- preceding hands, oldest first
    decided_at     TIMESTAMPTZ NOT NULL,  -- when the hand was played
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Every rule that fired on the hand and what it called, not just the one
    -- that won. Arbitration is rebuilt from this, so a log downloaded without
    -- it would restore the history and lose the engine's memory.
    candidates     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    contested      BOOLEAN     NOT NULL DEFAULT false,
    mode           TEXT,                  -- 'test' for hands that must not count
    replayed       BOOLEAN     NOT NULL DEFAULT false   -- reconstructed, not recorded live
);

-- Added after the table first shipped; harmless to re-run.
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS candidates JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS contested  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS mode       TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS replayed   BOOLEAN NOT NULL DEFAULT false;

-- A card may be replayed, so the same (card, hand) can appear more than once.
-- Reads take the most recent, which this index supports.
CREATE INDEX IF NOT EXISTS predictions_card_hand_idx
    ON predictions (card, hand_index, decided_at DESC);

CREATE INDEX IF NOT EXISTS predictions_engine_idx
    ON predictions (engine_version);

-- The client retries unsynced entries, so the same entry can arrive twice.
-- This makes a repeat delivery a no-op instead of a duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS predictions_dedupe_idx
    ON predictions (engine_version, card, hand_index, decided_at);
