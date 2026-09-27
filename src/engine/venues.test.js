// src/engine/venues.test.js

import { venuesFrom, canonicalVenue, saveNameFor, sameVenue, normalizeVenue } from './venues';

const cards = (...venues) =>
    Object.fromEntries(venues.map((v, i) => [`card ${i}`, { hands: 'PB', venue: v }]));

describe('venuesFrom', () => {
    it('collapses case variants onto the spelling used most', () => {
        // The real drift: eight lowercase against two proper-cased.
        const list = venuesFrom(cards(...Array(8).fill("l'auberge"), "L'auberge", "L'auberge"));
        expect(list).toHaveLength(1);
        expect(list[0].venue).toBe("l'auberge");
        expect(list[0].uses).toBe(10);
    });

    it('prefers a cased spelling when the counts tie', () => {
        const list = venuesFrom(cards('boomtown ms', 'Boomtown MS'));
        expect(list[0].venue).toBe('Boomtown MS');
    });

    it('orders by how often each place was played', () => {
        const list = venuesFrom(cards('Queen', 'Queen', 'Queen', "Bally's", 'Boomtown', 'Boomtown'));
        expect(list.map((v) => v.venue)).toEqual(['Queen', 'Boomtown', "Bally's"]);
    });

    it('ignores cards with no venue rather than inventing one', () => {
        expect(venuesFrom({ a: { hands: 'PB' }, b: { hands: 'PB', venue: '   ' } })).toEqual([]);
        expect(venuesFrom(null)).toEqual([]);
    });
});

describe('canonicalVenue', () => {
    const known = venuesFrom(cards('Boomtown MS', 'Boomtown MS', "L'auberge"));

    it('returns the spelling already in use', () => {
        expect(canonicalVenue('boomtown ms', known)).toBe('Boomtown MS');
        expect(canonicalVenue("  L'AUBERGE ", known)).toBe("L'auberge");
    });

    it('keeps a genuinely new venue as typed', () => {
        expect(canonicalVenue('Golden Nugget', known)).toBe('Golden Nugget');
    });

    it('is empty for nothing typed', () => {
        expect(canonicalVenue('   ', known)).toBe('');
    });
});

describe('saveNameFor', () => {
    it('builds venue, label and date', () => {
        expect(saveNameFor('Boomtown MS', '2', '06/28/26')).toBe('Boomtown MS 2 - 06/28/26');
    });

    it('leaves the label out when there is none', () => {
        expect(saveNameFor("L'auberge", '', '06/17/25')).toBe("L'auberge - 06/17/25");
    });

    it('does not title-case the venue', () => {
        // Title-casing turned "Boomtown MS" into "Boomtown Ms", which is how the
        // name and the venue field came to disagree.
        expect(saveNameFor('Boomtown MS', '', '06/28/26')).toBe('Boomtown MS - 06/28/26');
    });
});

describe('sameVenue', () => {
    it('ignores case and stray spacing', () => {
        expect(sameVenue("L'auberge", "  l'AUBERGE ")).toBe(true);
        expect(sameVenue('Boomtown', 'Boomtown MS')).toBe(false);
    });
});

describe('normalizeVenue', () => {
    it('collapses runs of whitespace', () => {
        expect(normalizeVenue('  Treasure   Chest ')).toBe('Treasure Chest');
    });
});
