// src/engine/cardFormat.test.js

import { toStored, fromStored, isLegacy, stateFromHands, CARD_FORMAT_VERSION, shoesFrom } from './cardFormat';
import { deriveGrid, handsFromGrid } from './grid';

describe('toStored', () => {
    it('keeps only the hands', () => {
        const out = toStored([['P', 'B', 'T', 'P']]);
        expect(out).toMatchObject({ v: CARD_FORMAT_VERSION, shoes: ['PBTP'] });
        expect(out.scorecard).toBeUndefined();
    });

    it('takes a single flat run as a one-shoe card', () => {
        // Forgiving on purpose: this runs on every tap, and losing a live card
        // to a signature mismatch is worse than doing the obvious thing.
        expect(toStored(['P', 'B', 'T', 'P']).shoes).toEqual(['PBTP']);
    });

    it('marks gaps so row numbers still line up', () => {
        expect(toStored([['P', null, 'B']]).shoes[0]).toBe('P-B');
    });

    it('is tiny next to the grid it replaces', () => {
        const hands = Array.from({ length: 645 }, (_, i) => (i % 3 ? 'P' : 'B'));
        const stored = JSON.stringify(toStored(hands)).length;
        const grid = JSON.stringify(deriveGrid(hands, 1000)).length;
        expect(stored).toBeLessThan(1000);
        expect(grid / stored).toBeGreaterThan(1000);
    });
});

describe('fromStored', () => {
    it('reads the current shape', () => {
        expect(fromStored({ v: 1, hands: 'PBTP' })).toEqual(['P', 'B', 'T', 'P']);
    });

    it('reads a gap back as a gap', () => {
        expect(fromStored({ v: 1, hands: 'P-B' })).toEqual(['P', null, 'B']);
    });

    it('reads an old full-grid save', () => {
        const hands = ['P', 'B', 'B', 'T', 'P'];
        const legacy = { scorecard: deriveGrid(hands, 30), lastWinType: 'P', lastWinRow: 5 };
        expect(fromStored(legacy)).toEqual(hands);
    });

    it('round-trips an old save into the new shape without losing hands', () => {
        const hands = ['P', 'P', 'B', 'P', 'B', 'B', 'T', 'B', 'P'];
        const legacy = { scorecard: deriveGrid(hands, 40) };
        const converted = toStored(shoesFrom(legacy));
        expect(fromStored(converted)).toEqual(hands);
    });

    it('returns an empty card rather than throwing on rubbish', () => {
        [null, undefined, 42, 'nope', {}, { scorecard: 'not an array' }].forEach((bad) => {
            expect(fromStored(bad)).toEqual([]);
        });
    });
});

describe('isLegacy', () => {
    it('spots a stored grid', () => {
        expect(isLegacy({ scorecard: deriveGrid(['P'], 10) })).toBe(true);
        expect(isLegacy({ v: 1, hands: 'P' })).toBe(false);
    });
});

describe('stateFromHands', () => {
    it('rebuilds the board exactly', () => {
        const hands = ['P', 'P', 'B', 'T', 'B'];
        const { scorecard } = stateFromHands(hands, 30);
        expect(handsFromGrid(scorecard)).toEqual(hands);
    });

    it('derives the anchor rather than storing it', () => {
        const s = stateFromHands(['P', 'B', 'B', 'T'], 30);
        // A tie does not move the prediction anchor, but it is still played.
        expect(s.lastWinRow).toBe(3);
        expect(s.lastWinType).toBe('B');
        expect(s.lastPlayedRow).toBe(4);
    });

    it('reports an empty card as unplayed', () => {
        const s = stateFromHands([], 30);
        expect(s.lastWinRow).toBe(-1);
        expect(s.lastWinType).toBeNull();
        expect(s.lastPlayedRow).toBe(0);
    });
});

describe('shoes', () => {
    it('round-trips several shoes', () => {
        const shoes = [['P', 'B', 'B'], ['B', 'T', 'P'], ['P']];
        expect(shoesFrom(toStored(shoes))).toEqual(shoes);
    });

    it('reads a v1 single-run save as a one-shoe card', () => {
        // Its boundaries were never recorded, so one shoe is the honest answer
        // -- not a guess at where the shoes divided.
        expect(shoesFrom({ v: 1, hands: 'PBBTP' })).toEqual([['P', 'B', 'B', 'T', 'P']]);
    });

    it('reads a pre-versioned grid save as a one-shoe card', () => {
        const grid = deriveGrid(['P', 'B', 'T', 'B'], 20);
        expect(shoesFrom({ scorecard: grid })).toEqual([['P', 'B', 'T', 'B']]);
    });

    it('drops empty shoes rather than storing blanks', () => {
        expect(shoesFrom(toStored([['P', 'B'], [], ['B']]))).toEqual([['P', 'B'], ['B']]);
    });

    it('flattens to the same hands fromStored always returned', () => {
        const stored = toStored([['P', 'B'], ['B', 'T']]);
        expect(fromStored(stored)).toEqual(['P', 'B', 'B', 'T']);
    });

    it('keeps card metadata alongside the shoes', () => {
        const stored = toStored([['P']], { venue: "Bally's", tableType: 'table' });
        expect(stored.venue).toBe("Bally's");
        expect(stored.tableType).toBe('table');
        expect(shoesFrom(stored)).toEqual([['P']]);
    });

    it('survives nonsense without throwing', () => {
        [null, undefined, 'text', 42, {}, { shoes: 'not an array' }].forEach((bad) => {
            expect(shoesFrom(bad)).toEqual([]);
            expect(fromStored(bad)).toEqual([]);
        });
    });
});
