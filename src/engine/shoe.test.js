// src/engine/shoe.test.js
//
// The dealer is the foundation of every simulated number, so it is checked
// against baccarat's published rates rather than against itself. If the tableau
// were wrong, every simulation would still run and still print confident
// results -- they would just be results about a game nobody plays.

import { mulberry32, newShoe, playHand, playShoe, iidShoe, DEFAULT_DECKS } from './shoe';

describe('the shoe', () => {
    it('holds the right cards', () => {
        const cards = newShoe(mulberry32(1));
        expect(cards).toHaveLength(52 * DEFAULT_DECKS);

        const counts = new Map();
        cards.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));

        // Four of each pip per deck, sixteen zero-valued per deck.
        for (let rank = 1; rank <= 9; rank++) {
            expect(counts.get(rank)).toBe(4 * DEFAULT_DECKS);
        }
        expect(counts.get(0)).toBe(16 * DEFAULT_DECKS);
    });

    it('shuffles differently for different seeds and identically for the same one', () => {
        const a = newShoe(mulberry32(7));
        const b = newShoe(mulberry32(7));
        const c = newShoe(mulberry32(8));

        expect(a).toEqual(b);          // reproducible
        expect(a).not.toEqual(c);      // and not a constant
    });
});

describe('the drawing tableau', () => {
    // Each case is a stacked deck: P1, B1, P2, B2, then any third cards.
    const play = (cards) => playHand(cards, 0);

    it('stands both sides on a natural', () => {
        // Player 9, Banker 5. Player has a natural, so Banker does not draw
        // even though 5 would normally take a card.
        const { result, next } = play([4, 2, 5, 3, 9, 9]);
        expect(result).toBe('P');
        expect(next).toBe(4);          // only four cards used
    });

    it('gives the Player a third card on 0-5 and not on 6-7', () => {
        // Player 5 draws.
        expect(play([2, 1, 3, 2, 4, 0]).next).toBeGreaterThan(4);
        // Player 6 stands; Banker 3 draws, so five cards.
        expect(play([2, 1, 4, 2, 9, 0]).next).toBe(5);
    });

    it('stands the Banker on 7 whatever the Player drew', () => {
        // Banker 7 (3+4), Player 0 draws a 9 and reaches 9.
        const { result } = play([5, 3, 5, 4, 9]);
        expect(result).toBe('P');      // Player 9 beats Banker 7
    });

    it('applies the Banker-3 exception on a Player third card of 8', () => {
        // Banker 3, Player third card 8: Banker stands. Player 0 + 8 = 8 wins.
        const { result, next } = play([5, 1, 5, 2, 8, 9]);
        expect(next).toBe(5);          // Banker took no card
        expect(result).toBe('P');
    });

    it('draws on Banker 6 only against a Player third card of 6 or 7', () => {
        // Player third card 5: Banker 6 stands, five cards used.
        expect(play([5, 3, 5, 3, 5, 9]).next).toBe(5);
        // Player third card 6: Banker 6 draws, six cards used.
        expect(play([5, 3, 5, 3, 6, 9]).next).toBe(6);
    });

    it('calls equal totals a tie', () => {
        // Both naturals of 8.
        expect(play([4, 5, 4, 3, 0, 0]).result).toBe('T');
    });
});

describe('measured rates', () => {
    // Published eight-deck figures: Banker 45.86%, Player 44.62%, Tie 9.52%.
    // This is the test that would catch a misread tableau, which is the failure
    // that would otherwise go unnoticed for ever.
    it('reproduces baccarat', () => {
        const rng = mulberry32(20260920);
        const counts = { P: 0, B: 0, T: 0 };

        // ~4,000 shoes is roughly 320,000 hands -- enough to pin each rate to
        // about a tenth of a percent.
        for (let s = 0; s < 4000; s++) {
            playShoe(rng).forEach((r) => { counts[r] += 1; });
        }

        const n = counts.P + counts.B + counts.T;
        expect(n).toBeGreaterThan(250000);

        expect(counts.B / n).toBeCloseTo(0.4586, 2);
        expect(counts.P / n).toBeCloseTo(0.4462, 2);
        expect(counts.T / n).toBeCloseTo(0.0952, 2);

        // Banker's edge over Player among decided hands is the 50.68% that the
        // whole break-even calculation rests on.
        //
        // Checked against its own standard error rather than a fixed number of
        // decimals. At ~290,000 decided hands one SE is about 0.0009, so a
        // tolerance of 0.0005 -- which is what `toBeCloseTo(x, 3)` means -- is
        // tighter than the noise floor and would fail a correct dealer roughly
        // half the time. Four SE is still a real test: misreading any single
        // line of the tableau moves this by whole percentage points.
        const decided = counts.P + counts.B;
        const standardError = Math.sqrt(0.25 / decided);
        expect(Math.abs(counts.B / decided - 0.50684)).toBeLessThan(4 * standardError);
    });

    it('deals a realistic number of hands per shoe', () => {
        const rng = mulberry32(5);
        const lengths = Array.from({ length: 200 }, () => playShoe(rng).length);
        const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;

        // A real eight-deck shoe yields somewhere around 70-85 hands.
        expect(mean).toBeGreaterThan(65);
        expect(mean).toBeLessThan(90);
    });

    it('gives the independent generator the same rates as the dealt one', () => {
        const rng = mulberry32(99);
        const counts = { P: 0, B: 0, T: 0 };
        for (let s = 0; s < 4000; s++) {
            iidShoe(rng).forEach((r) => { counts[r] += 1; });
        }
        const n = counts.P + counts.B + counts.T;

        // Identical marginals to playShoe, so the ONLY difference between the
        // two generators is dependence between hands. That is what makes
        // comparing them meaningful.
        expect(counts.B / n).toBeCloseTo(0.4586, 2);
        expect(counts.P / n).toBeCloseTo(0.4462, 2);
        expect(counts.T / n).toBeCloseTo(0.0952, 2);
    });
});
