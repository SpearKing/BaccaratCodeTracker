// src/engine/cardFormat.test.js

import { toStored, fromStored, isLegacy, stateFromHands, CARD_FORMAT_VERSION } from './cardFormat';
import { deriveGrid, handsFromGrid } from './grid';

describe('toStored', () => {
    it('keeps only the hands', () => {
        const out = toStored(['P', 'B', 'T', 'P']);
        expect(out).toMatchObject({ v: CARD_FORMAT_VERSION, hands: 'PBTP' });
        expect(out.scorecard).toBeUndefined();
    });

    it('marks gaps so row numbers still line up', () => {
        expect(toStored(['P', null, 'B']).hands).toBe('P-B');
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
        const converted = toStored(fromStored(legacy));
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
