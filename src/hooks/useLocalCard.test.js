// src/hooks/useLocalCard.test.js

import { saveLocalCard, loadLocalCard, clearLocalCard, LOCAL_CARD_KEY } from './useLocalCard';

beforeEach(() => localStorage.clear());

describe('the live card on this device', () => {
    it('round-trips the hands', () => {
        // A flat run is stored as a one-shoe sitting.
        saveLocalCard(['P', 'B', 'T', 'P'], 'Tonight');
        expect(loadLocalCard()).toEqual({
            shoes: [['P', 'B', 'T', 'P']], card: 'Tonight', activeShoe: 0,
        });
    });

    it('round-trips several shoes and remembers which one was on screen', () => {
        saveLocalCard([['P', 'B'], ['B', 'T', 'P'], ['P']], 'Tonight', false, 1);
        expect(loadLocalCard()).toEqual({
            shoes: [['P', 'B'], ['B', 'T', 'P'], ['P']], card: 'Tonight', activeShoe: 1,
        });
    });

    it('clamps a stored shoe index that no longer exists', () => {
        // Restoring to a shoe that is gone would put the next hand on the wrong
        // board, so the index is pinned to what is actually there.
        saveLocalCard([['P', 'B']], 'Tonight', false, 7);
        expect(loadLocalCard().activeShoe).toBe(0);
    });

    it('stores hands, not a grid', () => {
        saveLocalCard(Array.from({ length: 600 }, () => 'P'), 'Long one');
        // A grid of this card would be megabytes.
        expect(localStorage.getItem(LOCAL_CARD_KEY).length).toBeLessThan(1200);
    });

    it('reports nothing when the device has never held a card', () => {
        expect(loadLocalCard()).toBeNull();
    });

    it('reports nothing for an empty card, so the caller falls through', () => {
        saveLocalCard([], 'Fresh');
        expect(loadLocalCard()).toBeNull();
    });

    it('ignores a corrupt entry rather than throwing', () => {
        localStorage.setItem(LOCAL_CARD_KEY, '{ this is not json');
        expect(loadLocalCard()).toBeNull();
    });

    it('clears', () => {
        saveLocalCard(['P'], 'Tonight');
        clearLocalCard();
        expect(loadLocalCard()).toBeNull();
    });
});
