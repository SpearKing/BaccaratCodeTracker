// src/hooks/useScorecardLogic.test.js
//
// Tests the hook itself, so the delete-row fix is covered through the same path
// the UI uses rather than only at the engine level.

import { renderHook, act } from '@testing-library/react';
import { useScorecardLogic } from './useScorecardLogic';
import { handsFromGrid, deriveGrid } from '../engine/grid';

const setup = () => {
    const stats = { pWins: 0, bWins: 0, predictions: { correct: 0, wrong: 0 }, patternStats: new Map() };
    return renderHook(() => useScorecardLogic(stats, () => {}));
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
