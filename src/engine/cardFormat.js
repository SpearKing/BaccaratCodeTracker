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

/**
 * v2 stores an ARRAY of shoes rather than one run of hands.
 *
 * A save is a sitting; a shoe is a shoe. Before this they were the same thing,
 * so a long session was recorded as one continuous card -- and because the
 * rules read transition history, they fired on patterns straddling two
 * unrelated shoes. Measured on 2,000 simulated shoes, 6.3% of all bets came
 * from reading across a boundary, roughly half a spurious bet per boundary.
 * Those bets are coin flips, so they dilute any real edge toward chance.
 *
 * v1 saves hold a single run and are read as a one-shoe card, which is what
 * they are. The boundaries inside the long ones were never recorded and cannot
 * be recovered.
 */
export const CARD_FORMAT_VERSION = 2;

const VALID = new Set(['P', 'B', TIE]);

const encode = (hands) => (hands || []).map((h) => (VALID.has(h) ? h : '-')).join('');
const decode = (text) => String(text || '').split('').map((c) => (VALID.has(c) ? c : null));

/**
 * Normalises either shape into an array of shoes.
 *
 * A flat run of hands is taken as a single shoe. The two are told apart by
 * what is inside: hands are strings, shoes are arrays. This is forgiving on
 * purpose -- the alternative is throwing inside `saveLocalCard`, which runs on
 * every tap at a table, and losing a live card to a signature mismatch is a
 * far worse outcome than quietly doing the obvious thing.
 */
const asShoes = (input) => {
    if (!Array.isArray(input) || input.length === 0) return [];
    const first = input.find((x) => x !== null && x !== undefined);
    return Array.isArray(first) ? input : [input];
};

/**
 * Stores a card as its shoes. Nulls become gaps so row numbers survive.
 *
 * Takes an array of shoes -- each an array of hands -- or a single flat run,
 * which is stored as a one-shoe card.
 */
export const toStored = (shoes, extra = {}) => ({
    v: CARD_FORMAT_VERSION,
    shoes: asShoes(shoes).map(encode),
    savedAt: new Date().toISOString(),
    ...extra,
});

/**
 * Every shoe on a stored card, oldest first.
 *
 * Reads all three shapes: v2's array of shoes, v1's single run, and the
 * pre-versioned full grid. The last two are one-shoe cards -- whatever
 * boundaries they contained were not recorded.
 *
 * Anything unreadable comes back empty rather than throwing, because a corrupt
 * save should cost you a card, not the app.
 */
export const shoesFrom = (data) => {
    if (!data || typeof data !== 'object') return [];

    if (Array.isArray(data.shoes)) {
        return data.shoes.map(decode).filter((shoe) => shoe.length > 0);
    }

    if (typeof data.hands === 'string') {
        const hands = decode(data.hands);
        return hands.length ? [hands] : [];
    }

    // Pre-versioned saves: a fully derived 1,000-row grid.
    if (Array.isArray(data.scorecard)) {
        try {
            const hands = handsFromGrid(data.scorecard);
            return hands.length ? [hands] : [];
        } catch (error) {
            console.error('Could not read a saved scorecard; treating it as empty.', error);
            return [];
        }
    }

    return [];
};

/**
 * Every hand on a stored card as one flat run, boundaries discarded.
 *
 * Kept because a good deal of the app only wants "what was played here" and
 * does not care where the shoes divide. Anything that scores predictions should
 * use `shoesFrom` instead -- pooling shoes is what produced the boundary bets
 * described above.
 */
export const fromStored = (data) => shoesFrom(data).flat();

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
