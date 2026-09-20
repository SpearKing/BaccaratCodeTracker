// src/hooks/useLocalCard.js
//
// The live card, kept on the device.
//
// This is the authoritative copy. It is written on every tap, so it is always
// current, whereas the server only hears from you when you press Save. That
// ordering is the whole point: restoring from the server on startup would hand
// you back your last SAVED hand and silently drop everything since, which is
// the bug this exists to fix.
//
// Only the hands are stored. The board is rebuilt from them.

import { toStored, fromStored } from '../engine/cardFormat';

export const LOCAL_CARD_KEY = 'baccarat_live_card';
/** Test play gets its own slot, so trying something out cannot clobber a real shoe. */
export const TEST_CARD_KEY = 'baccarat_test_card';

const keyFor = (testMode) => (testMode ? TEST_CARD_KEY : LOCAL_CARD_KEY);

/** Saves the live card. Called on every change; a few hundred bytes. */
export const saveLocalCard = (hands, cardName, testMode = false) => {
    try {
        localStorage.setItem(keyFor(testMode), JSON.stringify(toStored(hands, { card: cardName ?? null })));
        return true;
    } catch (error) {
        // Quota, or storage disabled. The card is still in memory; say so
        // rather than pretending it was kept.
        console.error('Could not save the card to this device.', error);
        return false;
    }
};

/** The live card, or null when this device has never held one. */
export const loadLocalCard = (testMode = false) => {
    try {
        const raw = localStorage.getItem(keyFor(testMode));
        if (!raw) return null;
        const data = JSON.parse(raw);
        const hands = fromStored(data);
        // An empty card is worth nothing to restore, and returning null lets
        // the caller fall through to the server.
        if (hands.length === 0) return null;
        return { hands, card: data.card ?? null };
    } catch (error) {
        console.error('Could not read the card on this device; ignoring it.', error);
        return null;
    }
};

export const clearLocalCard = (testMode = false) => {
    try {
        localStorage.removeItem(keyFor(testMode));
    } catch (error) {
        console.error('Could not clear the local card.', error);
    }
};
