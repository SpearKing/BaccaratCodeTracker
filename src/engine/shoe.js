// src/engine/shoe.js
//
// Deals real baccarat, card by card.
//
// The point of this module is that it is NOT a coin flip. A shoe is 416 actual
// cards dealt without replacement through punto banco's drawing tableau, so the
// sequences it produces carry whatever serial dependence the real game has.
// That is the whole reason it exists: if a rule set shows an edge on real hands
// but none here, the edge is not in the mechanics of baccarat, and the
// remaining explanations are noise or something about physical shoes.
//
// A coin-flip generator lives here too (`iidShoe`) with the same marginal
// rates and no dependence at all. Running both and comparing is how you find
// out whether depletion contributes anything -- which, at roughly a hundredth
// of a percent, it should not.
//
// Everything is seeded. A run that cannot be reproduced cannot be debugged.

/** Cards are worth their pip value; tens and faces are worth nothing. */
export const DECK_SIZE = 52;
export const DEFAULT_DECKS = 8;

/** Cards left behind the cut card, which end the shoe. */
export const CUT_CARD_DEPTH = 14;

/** Most cards a single hand can consume: two each, plus a third to each side. */
const MAX_CARDS_PER_HAND = 6;

/**
 * mulberry32 -- small, fast, and good enough for this.
 *
 * Not cryptographic and not meant to be. What matters here is that it is
 * seedable and has no short cycles at the scale we use it, both of which it
 * has: period 2^32, which is thousands of shoes per seed and we give every
 * worker its own.
 */
export const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * One deck as baccarat values: four each of ace through nine, sixteen zeros.
 *
 * 4x9 = 36 pip cards plus 16 tens and faces is 52, which is the check that
 * this is right.
 */
const oneDeck = () => {
    const cards = [];
    for (let rank = 1; rank <= 9; rank++) {
        for (let suit = 0; suit < 4; suit++) cards.push(rank);
    }
    for (let i = 0; i < 16; i++) cards.push(0);
    return cards;
};

/** A fresh shuffled shoe of `decks` decks. Fisher-Yates, unbiased. */
export const newShoe = (rng, decks = DEFAULT_DECKS) => {
    const cards = [];
    for (let d = 0; d < decks; d++) cards.push(...oneDeck());

    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = cards[i];
        cards[i] = cards[j];
        cards[j] = tmp;
    }
    return cards;
};

/** Baccarat totals are modulo ten -- 7 and 8 is 5, not 15. */
const total = (...values) => values.reduce((a, b) => a + b, 0) % 10;

/**
 * Plays one hand from `cards` starting at `index`.
 *
 * The tableau is fixed and public; neither side chooses anything. Written out
 * longhand rather than as a lookup table so it can be read against the printed
 * rules.
 *
 * Returns the winner and the index of the next undealt card.
 */
export const playHand = (cards, index) => {
    let i = index;

    // Dealt alternately, Player first.
    const p1 = cards[i++];
    const b1 = cards[i++];
    const p2 = cards[i++];
    const b2 = cards[i++];

    let player = total(p1, p2);
    let banker = total(b1, b2);

    // A natural ends the hand at once; no third card to either side.
    if (player >= 8 || banker >= 8) {
        return { result: player > banker ? 'P' : banker > player ? 'B' : 'T', next: i };
    }

    // Player draws on 0-5 and stands on 6-7.
    let playerThird = null;
    if (player <= 5) {
        playerThird = cards[i++];
        player = total(player, playerThird);
    }

    // Banker's rule depends on whether Player drew, and on what they drew.
    let bankerDraws;
    if (playerThird === null) {
        bankerDraws = banker <= 5;
    } else if (banker <= 2) {
        bankerDraws = true;
    } else if (banker === 3) {
        bankerDraws = playerThird !== 8;
    } else if (banker === 4) {
        bankerDraws = playerThird >= 2 && playerThird <= 7;
    } else if (banker === 5) {
        bankerDraws = playerThird >= 4 && playerThird <= 7;
    } else if (banker === 6) {
        bankerDraws = playerThird === 6 || playerThird === 7;
    } else {
        bankerDraws = false;   // stands on 7
    }

    if (bankerDraws) banker = total(banker, cards[i++]);

    return { result: player > banker ? 'P' : banker > player ? 'B' : 'T', next: i };
};

/**
 * Deals a whole shoe and returns its results in order.
 *
 * The burn is faithful: the first card is turned and that many more are
 * discarded (a ten or face burns ten). It changes nothing statistically, but
 * it costs one line and means the shoe depth matches a real table's.
 */
export const playShoe = (rng, decks = DEFAULT_DECKS) => {
    const cards = newShoe(rng, decks);

    // Turn one card, burn that many. A zero-valued card burns ten.
    const turned = cards[0];
    let i = 1 + (turned === 0 ? 10 : turned);

    const cutIndex = cards.length - CUT_CARD_DEPTH;
    const results = [];

    // Play until the cut card shows. A hand already begun is always finished,
    // which is why the shoe keeps a tail of spare cards behind the cut.
    while (i < cutIndex && i + MAX_CARDS_PER_HAND <= cards.length) {
        const hand = playHand(cards, i);
        results.push(hand.result);
        i = hand.next;
    }

    return results;
};

/**
 * Baccarat's own rates over all hands, ties included.
 *
 * These are the published figures for an eight-deck game, and `shoe.test.js`
 * checks the dealer above reproduces them. They are also what `iidShoe` draws
 * from, so the two generators differ ONLY in dependence between hands.
 */
export const P_BANKER = 0.458597;
export const P_PLAYER = 0.446247;
export const P_TIE = 0.095156;

/**
 * A shoe's worth of independent hands at the same marginal rates.
 *
 * The null hypothesis made concrete. Any rule that reads the history of results
 * must score exactly break-even here, because there is nothing in the history
 * to read. A rule set that beats this is either lucky or the code is wrong --
 * which makes it a useful check on the harness itself, not just on the rules.
 */
export const iidShoe = (rng, handsPerShoe = 80) => {
    const results = [];
    for (let h = 0; h < handsPerShoe; h++) {
        const r = rng();
        results.push(r < P_BANKER ? 'B' : r < P_BANKER + P_PLAYER ? 'P' : 'T');
    }
    return results;
};

/** The generators a simulation can draw from, by name. */
export const GENERATORS = {
    shoe: {
        id: 'shoe',
        label: 'Dealt shoes',
        note: 'Eight decks, real drawing rules, no replacement',
        deal: (rng) => playShoe(rng),
    },
    iid: {
        id: 'iid',
        label: 'Independent hands',
        note: 'Same rates, no memory between hands -- the null',
        deal: (rng) => iidShoe(rng),
    },
};
