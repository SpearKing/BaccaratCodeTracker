// src/hooks/useScorecardLogic.test.js
//
// Tests the hook itself, so the delete-row fix is covered through the same path
// the UI uses rather than only at the engine level.

import { renderHook, act } from '@testing-library/react';
import { useScorecardLogic } from './useScorecardLogic';
import { handsFromGrid, deriveGrid } from '../engine/grid';

// The prediction is supplied by the caller in the real app too -- App owns the
// single analytics instance and passes it down.
const setup = (onDecision = () => {}, getPrediction = () => null) =>
    renderHook(() => useScorecardLogic(onDecision, getPrediction));

// Plays a single hand on a given row.
const play2 = (result, row, hand) => {
    act(() => {
        result.current.handleCellClick(row, hand === 'P' ? 0 : 1);
    });
};

// Plays hands in order by clicking the P or B cell on each successive row.
const play = (result, hands) => {
    hands.forEach((hand, i) => {
        act(() => {
            result.current.handleCellClick(i + 1, hand === 'P' ? 0 : 1);
        });
    });
};

beforeEach(() => {
    localStorage.clear();
});

describe('useScorecardLogic', () => {
    it('records hands as they are clicked', () => {
        const { result } = setup();
        play(result, ['P', 'B', 'B']);

        expect(handsFromGrid(result.current.scorecard)).toEqual(['P', 'B', 'B']);
        expect(result.current.lastWinRow).toBe(3);
        expect(result.current.lastWinType).toBe('B');
    });
});

describe('deleteRow', () => {
    const hands = ['P', 'P', 'B', 'P', 'B', 'B', 'B', 'P'];

    it('removes the hand and rebuilds the rows below it', () => {
        const { result } = setup();
        play(result, hands);

        act(() => { result.current.deleteRow(4); });

        const expected = hands.filter((_, i) => i !== 3);
        expect(handsFromGrid(result.current.scorecard)).toEqual(expected);

        // The rebuilt grid must match a clean replay of the remaining hands --
        // this is exactly what the old splice-the-array version got wrong.
        const rebuilt = deriveGrid(expected, result.current.scorecard.length - 1);
        expect(result.current.scorecard.map((r) => r.map((c) => c.displayValue)))
            .toEqual(rebuilt.map((r) => r.map((c) => c.displayValue)));
    });

    it('moves the prediction anchor up with the hands', () => {
        const { result } = setup();
        play(result, hands);
        expect(result.current.lastWinRow).toBe(8);

        act(() => { result.current.deleteRow(4); });

        // The old version left lastWinRow pointing one row past the real end.
        expect(result.current.lastWinRow).toBe(7);
        expect(result.current.lastWinType).toBe('P');
        expect(result.current.scorecard[7][0].value).toBe('O');
        expect(result.current.scorecard[8][0].value).toBe('');
        expect(result.current.scorecard[8][1].value).toBe('');
    });

    it('keeps the grid the same height', () => {
        const { result } = setup();
        play(result, hands);
        const before = result.current.scorecard.length;

        act(() => { result.current.deleteRow(2); });
        act(() => { result.current.deleteRow(2); });

        expect(result.current.scorecard).toHaveLength(before);
    });

    it('clears the board when the only hand is deleted', () => {
        const { result } = setup();
        play(result, ['P']);

        act(() => { result.current.deleteRow(1); });

        expect(handsFromGrid(result.current.scorecard)).toEqual([]);
        expect(result.current.lastWinRow).toBe(-1);
        expect(result.current.lastWinType).toBeNull();
    });

    it('ignores row indexes outside the played range', () => {
        const { result } = setup();
        play(result, hands);
        const before = JSON.stringify(result.current.scorecard);

        [0, -1, hands.length + 1, 999].forEach((bad) => {
            act(() => { result.current.deleteRow(bad); });
        });

        expect(JSON.stringify(result.current.scorecard)).toBe(before);
        expect(result.current.lastWinRow).toBe(hands.length);
    });
});

describe('recordTie', () => {
    it('adds a tie row without moving the prediction anchor', () => {
        const { result } = setup();
        play(result, ['P', 'B', 'B']);
        expect(result.current.lastWinRow).toBe(3);

        act(() => { result.current.recordTie(); });

        expect(handsFromGrid(result.current.scorecard)).toEqual(['P', 'B', 'B', 'T']);
        // A tie is not a result, so the anchor stays on the last real hand.
        expect(result.current.lastWinRow).toBe(3);
        expect(result.current.lastWinType).toBe('B');
        // But the next hand has to land below it.
        expect(result.current.lastPlayedRow).toBe(4);
    });

    it('leaves the counts untouched, so the next hand continues from before it', () => {
        const withTie = setup();
        play(withTie.result, ['P', 'B', 'B']);
        act(() => { withTie.result.current.recordTie(); });
        act(() => { withTie.result.current.handleCellClick(5, 0); });

        const clean = setup();
        play(clean.result, ['P', 'B', 'B', 'P']);

        const numbers = (grid, row) => grid[row].slice(3).map((c) => c.displayValue);
        expect(numbers(withTie.result.current.scorecard, 5))
            .toEqual(numbers(clean.result.current.scorecard, 4));
    });
});

describe('decision logging', () => {
    it('records one entry per hand played forward', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));

        play(result, ['P', 'B', 'B']);

        expect(logged).toHaveLength(3);
        expect(logged.map((e) => e.actual)).toEqual(['P', 'B', 'B']);
        expect(logged.map((e) => e.hand)).toEqual([1, 2, 3]);
    });

    it('stores whatever the caller was showing when the hand landed', () => {
        const logged = [];
        const shown = { prediction: 'P', confidence: 3, source: 'rule-of-three-player', pattern: null };
        const { result } = setup((e) => logged.push(e), () => shown);

        play(result, ['B', 'P', 'P', 'P', 'B']);

        const last = logged[logged.length - 1];
        expect(last.predicted).toBe('P');       // what it said
        expect(last.actual).toBe('B');          // what happened
        expect(last.source).toBe('rule-of-three-player');
    });

    it('reads the prediction at the moment of the click, not when it was wired up', () => {
        // Guards the bug this replaced: the hook used to compute its own
        // prediction from its own analytics instance, which never saw the
        // analytics toggle change. The screen and the log then disagreed.
        const logged = [];
        let shown = { prediction: 'P', confidence: 1, source: 'pattern', pattern: 'pattern-1010' };
        const { result } = setup((e) => logged.push(e), () => shown);

        play(result, ['P']);
        shown = { prediction: 'B', confidence: 5, source: 'pattern', pattern: 'pattern-232' };
        play2(result, 2, 'B');

        expect(logged[0]).toMatchObject({ predicted: 'P', confidence: 1, pattern: 'pattern-1010' });
        expect(logged[1]).toMatchObject({ predicted: 'B', confidence: 5, pattern: 'pattern-232' });
    });

    it('does NOT log an edit to a hand already recorded', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));

        play(result, ['P', 'B', 'B']);
        expect(logged).toHaveLength(3);

        // Go back and change hand 2. The outcome was already known, so this is
        // not a prediction and must not enter the record.
        act(() => { result.current.handleCellClick(2, 0); });

        expect(logged).toHaveLength(3);
    });

    it('logs a tie as a decision that pushed', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));

        play(result, ['P', 'B']);
        act(() => { result.current.recordTie(); });

        expect(logged).toHaveLength(3);
        expect(logged[2]).toMatchObject({ actual: 'T', hand: 3 });
    });

    it('keeps hands where the engine had no opinion', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e), () => null);

        play(result, ['P']);

        expect(logged[0].predicted).toBeNull();
        expect(logged[0].actual).toBe('P');
    });

    it('carries the preceding hands for re-deriving features later', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));

        play(result, ['P', 'B', 'B', 'P']);

        expect(logged[3].history).toBe('PBB');
    });

    it('stamps an engine version on every entry', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));
        play(result, ['P', 'B']);
        logged.forEach((e) => expect(e.engine).toBeTruthy());
    });
});

describe('recordTieAt', () => {
    it('records a tie on the row that was tapped', () => {
        const { result } = setup();
        play(result, ['P', 'B', 'B']);

        act(() => { result.current.recordTieAt(4); });

        expect(handsFromGrid(result.current.scorecard)).toEqual(['P', 'B', 'B', 'T']);
        expect(result.current.lastWinRow).toBe(3);
        expect(result.current.lastPlayedRow).toBe(4);
    });

    it('replaces a decided hand and moves the anchor back', () => {
        // Tapping T on a row that already holds a result is a correction. The
        // anchor pointed at that row, so it has to move -- leaving it would
        // have the predictor reading a hand that no longer exists.
        const { result } = setup();
        play(result, ['P', 'B', 'B']);
        expect(result.current.lastWinRow).toBe(3);

        act(() => { result.current.recordTieAt(3); });

        expect(handsFromGrid(result.current.scorecard)).toEqual(['P', 'B', 'T']);
        expect(result.current.lastWinRow).toBe(2);
        expect(result.current.lastWinType).toBe('B');
    });

    it('logs a forward tie but not a correction', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));
        play(result, ['P', 'B']);
        expect(logged).toHaveLength(2);

        act(() => { result.current.recordTieAt(3); });   // forward play
        expect(logged).toHaveLength(3);
        expect(logged[2]).toMatchObject({ actual: 'T', hand: 3 });

        act(() => { result.current.recordTieAt(2); });   // editing a past hand
        expect(logged).toHaveLength(3);
    });

    it('ignores a row outside the grid', () => {
        const { result } = setup();
        play(result, ['P', 'B']);
        const before = JSON.stringify(result.current.scorecard);
        [0, -1, 99999].forEach((bad) => {
            act(() => { result.current.recordTieAt(bad); });
        });
        expect(JSON.stringify(result.current.scorecard)).toBe(before);
    });

    it('gives the same board as the Tie button', () => {
        const viaButton = setup();
        play(viaButton.result, ['P', 'B', 'B']);
        act(() => { viaButton.result.current.recordTie(); });

        const viaCell = setup();
        play(viaCell.result, ['P', 'B', 'B']);
        act(() => { viaCell.result.current.recordTieAt(4); });

        expect(JSON.stringify(viaCell.result.current.scorecard))
            .toBe(JSON.stringify(viaButton.result.current.scorecard));
    });
});

describe('shoes within a sitting', () => {
    it('keeps each shoe separate and remembers which was on screen', () => {
        const { result } = setup();
        play(result, ['P', 'B', 'B']);

        act(() => { result.current.addShoe(); });
        expect(result.current.shoeCount).toBe(2);
        expect(result.current.activeShoe).toBe(1);
        // A new shoe shares nothing with the one before it -- which is the
        // point, since the rules read transition history off the board.
        expect(handsFromGrid(result.current.scorecard)).toEqual([]);

        play(result, ['P', 'P']);
        expect(result.current.allShoes()).toEqual([['P', 'B', 'B'], ['P', 'P']]);

        act(() => { result.current.selectShoe(0); });
        expect(handsFromGrid(result.current.scorecard)).toEqual(['P', 'B', 'B']);
        // Switching back and forth must not lose the shoe you left.
        expect(result.current.allShoes()).toEqual([['P', 'B', 'B'], ['P', 'P']]);
    });

    it('numbers hands from one within each shoe, and logs which shoe', () => {
        const logged = [];
        const { result } = setup((e) => logged.push(e));

        play(result, ['P', 'B']);
        act(() => { result.current.addShoe(); });
        play(result, ['B']);

        expect(logged.map((e) => [e.shoe, e.hand])).toEqual([[0, 1], [0, 2], [1, 1]]);
    });

    it('does not write a blank card over a stored one before restoring it', () => {
        // The regression this guards: the save effect used to fire on mount
        // with the restore flag already set but the board still empty, so it
        // wrote an empty card over the stored one -- and StrictMode's second
        // pass then read that back and found nothing to restore, losing the
        // session on every reload.
        localStorage.setItem('baccarat_live_card', JSON.stringify({
            v: 2, shoes: ['PBB', 'PP'], card: 'Tonight', activeShoe: 1,
        }));

        const { result } = setup();

        expect(result.current.shoeCount).toBe(2);
        expect(result.current.activeShoe).toBe(1);
        expect(handsFromGrid(result.current.scorecard)).toEqual(['P', 'P']);
        expect(JSON.parse(localStorage.getItem('baccarat_live_card')).shoes)
            .toEqual(['PBB', 'PP']);
    });

    it('empties the last shoe rather than leaving a sitting with none', () => {
        const { result } = setup();
        play(result, ['P', 'B']);
        act(() => { result.current.deleteShoe(0); });
        expect(result.current.shoeCount).toBe(1);
        expect(handsFromGrid(result.current.scorecard)).toEqual([]);
    });

    it('moves the board off a removed shoe without losing the others', () => {
        const { result } = setup();
        play(result, ['P', 'B']);
        act(() => { result.current.addShoe(); });
        play(result, ['B', 'B']);
        act(() => { result.current.addShoe(); });
        play(result, ['P']);

        act(() => { result.current.selectShoe(1); });
        act(() => { result.current.deleteShoe(1); });

        expect(result.current.allShoes()).toEqual([['P', 'B'], ['P']]);
        expect(result.current.shoeCount).toBe(2);
    });
});
