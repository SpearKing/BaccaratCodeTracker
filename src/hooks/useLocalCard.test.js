// src/hooks/useLocalCard.test.js

import { saveLocalCard, loadLocalCard, clearLocalCard, LOCAL_CARD_KEY } from './useLocalCard';

beforeEach(() => localStorage.clear());

describe('the live card on this device', () => {
    it('round-trips the hands', () => {
        saveLocalCard(['P', 'B', 'T', 'P'], 'Tonight');
        expect(loadLocalCard()).toEqual({ hands: ['P', 'B', 'T', 'P'], card: 'Tonight' });
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
