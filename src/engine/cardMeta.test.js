// src/engine/cardMeta.test.js

import {
    metaFrom, metaPayload, metaIndex, splitByTableType,
    unclassifiedCards, typeOfEntry, EMPTY_META, UNKNOWN,
} from './cardMeta';

describe('metaFrom', () => {
    it('reads a classified card', () => {
        expect(metaFrom({ venue: "L'auberge", tableType: 'table', shuffle: 'hand' }))
            .toEqual({ venue: "L'auberge", tableType: 'table', shuffle: 'hand' });
    });

    it('treats every old card as unclassified rather than guessing', () => {
        // Every card saved before this existed has no metadata at all. None of
        // them may be inferred from their names -- that inference is the exact
        // mistake this module was written to stop.
        expect(metaFrom({ v: 1, hands: 'PBBP' })).toEqual(EMPTY_META);
        expect(metaFrom(null)).toEqual(EMPTY_META);
        expect(metaFrom('nonsense')).toEqual(EMPTY_META);
    });

    it('rejects a value it does not recognise instead of passing it through', () => {
        const m = metaFrom({ tableType: 'roulette', shuffle: 'telepathy' });
        expect(m.tableType).toBe(UNKNOWN);
        expect(m.shuffle).toBe(UNKNOWN);
    });

    it('round-trips through a save payload', () => {
        const meta = { venue: "Bally's", tableType: 'table', shuffle: 'auto' };
        expect(metaFrom(metaPayload(meta))).toEqual(meta);
    });
});

describe('splitByTableType', () => {
    const saved = {
        'Queen Final 2 - 09/03/25': { hands: 'PB', tableType: 'machine' },
        "L'auberge Video - 09/05/25": { hands: 'PB', tableType: 'machine' },
        "L'auberge Revised - 06/17/25": { hands: 'PB', tableType: 'table' },
        'Old Card - 01/01/25': { hands: 'PB' },
    };
    const index = metaIndex(saved);

    const entries = [
        { card: 'Queen Final 2 - 09/03/25', predicted: 'P', actual: 'P' },
        { card: "L'auberge Video - 09/05/25", predicted: 'B', actual: 'P' },
        { card: "L'auberge Revised - 06/17/25", predicted: 'P', actual: 'P' },
        { card: 'Old Card - 01/01/25', predicted: 'B', actual: 'B' },
        { card: 'A card never saved', predicted: 'B', actual: 'B' },
    ];

    it('keeps the two video cards apart from the table card', () => {
        const split = splitByTableType(entries, index);
        expect(split.get('machine')).toHaveLength(2);
        expect(split.get('table')).toHaveLength(1);
    });

    it('puts an unclassified card and an unknown card in the same unknown bucket', () => {
        // Neither is evidence about either arm, and neither should be quietly
        // folded into one.
        expect(splitByTableType(entries, index).get(UNKNOWN)).toHaveLength(2);
    });

    it('loses nothing', () => {
        const split = splitByTableType(entries, index);
        const total = [...split.values()].reduce((n, g) => n + g.length, 0);
        expect(total).toBe(entries.length);
    });

    it('returns every arm even when empty, so a missing arm renders as zero', () => {
        const split = splitByTableType([], index);
        expect(split.get('table')).toEqual([]);
        expect(split.get('machine')).toEqual([]);
    });

    it('does not infer a type from a name that mentions video', () => {
        const noMeta = metaIndex({ "L'auberge Video - 09/05/25": { hands: 'PB' } });
        expect(typeOfEntry({ card: "L'auberge Video - 09/05/25" }, noMeta)).toBe(UNKNOWN);
    });
});

describe('unclassifiedCards', () => {
    it('names the cards still needing a type', () => {
        expect(unclassifiedCards({
            'A - 01/01/25': { hands: 'PB', tableType: 'table' },
            'B - 01/02/25': { hands: 'PB' },
            'C - 01/03/25': { hands: 'PB', tableType: 'unknown' },
        })).toEqual(['B - 01/02/25', 'C - 01/03/25']);
    });
});
