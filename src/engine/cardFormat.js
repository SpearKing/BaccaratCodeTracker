// src/engine/cardFormat.js
//
// How a scorecard is stored, in one place.
//
// Only the hands are kept -- the string of P, B and T that was actually dealt.
// Everything else on the board is derived from them, so storing the grid meant
// storing 6 MB of arithmetic that deriveGrid reproduces exactly from 647 bytes.
// Across the whole database that was 45 MB of grids for 3,411 hands of data.
//
// Old saves hold the full grid. Reading handles both shapes; writing only ever
// produces the new one.

import { deriveGrid, handsFromGrid, isDecided, TIE } from './grid';
import { NUM_INITIAL_ROWS } from '../utils/constants';

export const CARD_FORMAT_VERSION = 1;

const VALID = new Set(['P', 'B', TIE]);

/** The hands, as a compact string. Nulls become gaps so row numbers survive. */
export const toStored = (hands, extra = {}) => ({
    v: CARD_FORMAT_VERSION,
    hands: (hands || []).map((h) => (VALID.has(h) ? h : '-')).join(''),
    savedAt: new Date().toISOString(),
    ...extra,
});

/**
 * The hands out of whatever shape was stored.
 *
 * Accepts the current form, the old full-grid form, and anything unreadable --
 * which comes back as an empty card rather than throwing, because a corrupt
 * save should cost you a card, not the app.
 */
export const fromStored = (data) => {
    if (!data || typeof data !== 'object') return [];

    if (typeof data.hands === 'string') {
        return data.hands.split('').map((c) => (VALID.has(c) ? c : null));
    }

    // Pre-versioned saves: a fully derived 1,000-row grid.
    if (Array.isArray(data.scorecard)) {
        try {
            return handsFromGrid(data.scorecard);
        } catch (error) {
            console.error('Could not read a saved scorecard; treating it as empty.', error);
            return [];
        }
    }

    return [];
};

/** True when a stored card still holds a full grid rather than just its hands. */
export const isLegacy = (data) => Boolean(data && Array.isArray(data.scorecard));

/**
 * Everything the app needs on screen, rebuilt from the hands.
 *
 * lastWinType and lastWinRow used to be stored alongside the grid. They are
 * both functions of the hands, so keeping them was a third copy of the same
 * fact and a third thing that could disagree with the other two.
 */
export const stateFromHands = (hands, numRows = NUM_INITIAL_ROWS) => {
    const safe = hands || [];
    const scorecard = deriveGrid(safe, numRows);

    let lastWinRow = -1;
    for (let i = safe.length - 1; i >= 0; i--) {
        if (isDecided(safe[i])) { lastWinRow = i + 1; break; }
    }

    let lastPlayedRow = 0;
    for (let i = safe.length - 1; i >= 0; i--) {
        if (safe[i]) { lastPlayedRow = i + 1; break; }
    }

    return {
        scorecard,
        lastWinType: lastWinRow === -1 ? null : safe[lastWinRow - 1],
        lastWinRow,
        lastPlayedRow,
    };
};
