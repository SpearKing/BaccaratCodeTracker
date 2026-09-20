// src/engine/backtest.test.js

import { replayCard } from './backtest';
import { predictNextHand } from './predict';
import { deriveGrid } from './grid';
import { computeHighlights } from './analytics';
import { recordsFrom } from './arbitrate';

describe('replayCard', () => {
    const hands = ['P', 'P', 'B', 'P', 'B', 'B', 'B', 'P', 'P', 'B'];

    it('produces one entry per hand', () => {
        expect(replayCard('test', hands)).toHaveLength(hands.length);
    });

    it('reconstructs the prediction the live engine would have made', () => {
        const entries = replayCard('test', hands);

        // Independently: rebuild the board AND the records the engine would
        // have held at that point, from the entries before it. Arbitration
        // depends on those records, so a fair check has to supply them.
        const grid = deriveGrid(hands.slice(0, 5), 30);
        const live = predictNextHand(
            grid,
            computeHighlights(grid, grid[0].length),
            5,
            recordsFrom(entries.slice(0, 5))
        );

        expect(entries[5].predicted).toBe(live.prediction);
        expect(entries[5].confidence).toBe(live.confidence);
        expect(entries[5].source).toBe(live.source);
    });

    it('never lets a rule be weighed by the hand it is calling', () => {
        const entries = replayCard('test', hands);
        // Rebuilt from strictly earlier entries, the records must reproduce the
        // same call. If the replay leaked, this would differ.
        entries.forEach((e, i) => {
            if (i < 2 || !e.predicted) return;
            const grid = deriveGrid(hands.slice(0, i), 30);
            const live = predictNextHand(
                grid,
                computeHighlights(grid, grid[0].length),
                i,
                recordsFrom(entries.slice(0, i))
            );
            expect(e.predicted).toBe(live.prediction);
        });
    });

    it('never lets a prediction see the hand it is predicting', () => {
        // The first hand has nothing before it, so there can be no opinion.
        expect(replayCard('test', hands)[0].predicted).toBeNull();
    });

    it('records the actual outcome against each prediction', () => {
        const entries = replayCard('test', hands);
        expect(entries.map((e) => e.actual)).toEqual(hands);
    });

    it('handles ties and gaps without counting them as decisions', () => {
        const withGaps = ['P', 'B', null, 'T', 'B', 'P'];
        const entries = replayCard('test', withGaps);
        // Nulls are unplayed rows and produce no entry; ties do.
        expect(entries.map((e) => e.actual)).toEqual(['P', 'B', 'T', 'B', 'P']);
    });

    it('agrees with the live engine across a whole card', () => {
        const long = Array.from({ length: 60 }, (_, i) =>
            ['P', 'B', 'B', 'P', 'P', 'B', 'P'][i % 7]
        );
        const entries = replayCard('test', long);

        // Spot-check every 7th hand against a direct computation, supplying the
        // records the engine held at that point.
        for (let i = 7; i < long.length; i += 7) {
            const grid = deriveGrid(long.slice(0, i), long.length + 5);
            const live = predictNextHand(
                grid,
                computeHighlights(grid, grid[0].length),
                i,
                recordsFrom(entries.slice(0, i))
            );
            expect(entries[i].predicted).toBe(live.prediction);
        }
    });
});
