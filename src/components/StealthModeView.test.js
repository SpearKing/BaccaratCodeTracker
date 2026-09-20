// src/components/StealthModeView.test.js
//
// The at-the-table screen. Its whole job is to be read at a glance, so the
// exact string matters more here than anywhere else in the app.

import { render } from '@testing-library/react';
import StealthModeView from './StealthModeView';
import { deriveGrid } from '../engine/grid';
import { computeHighlights } from '../engine/analytics';
import { predictNextHand } from '../engine/predict';

const noop = () => {};

// A card ending in three Bankers, so the Rule of Three calls Banker next.
const hands = ['P', 'B', 'B', 'B'];
const grid = deriveGrid(hands, 20);
const highlights_ = computeHighlights(grid, grid[0].length);
const highlights = highlights_;

const show = (calibration) =>
    render(
        <StealthModeView
            onExit={noop}
            scorecard={grid}
            lastWinRow={hands.length}
            lastPlayedRow={hands.length}
            handleCellClick={noop}
            recordTie={noop}
            highlightedCells={highlights}
            calibration={calibration}
        />
    );

// A card whose most recent entry is a tie: 4 decided hands, 5 rows filled.
const tiedHands = [...hands, 'T'];
const tiedGrid = deriveGrid(tiedHands, 20);

// Scoped to the prediction line: the action buttons are also labelled P/T/B.
const line = (container) =>
    container.querySelector('.stealth-prediction-display').textContent.replace(/\s+/g, ' ').trim();

// Keyed on whatever C-Level this board actually produces. Hard-coding a level
// tied the test to a literal the engine used to return for Rule-of-Three hands
// (confidence: 3) and no longer does -- it is computed uniformly now.
const levelOf = (scorecard, highlights, row) =>
    predictNextHand(scorecard, highlights, row, new Map()).confidence;

const calibration = (rate, belowBreakEven, scorecard = grid, highlights = highlights_, row = hands.length) =>
    new Map([[levelOf(scorecard, highlights, row),
              { n: 300, rate, low: rate - 0.05, high: rate + 0.05, breakEven: 0.506, belowBreakEven }]]);

describe('StealthModeView', () => {
    it('reads "B : 42%" — the side, then the measured rate', () => {
        const { container } = show(calibration(0.42, true));
        expect(line(container)).toBe('B : 42%');
    });

    it('marks the rate when the level is measurably losing', () => {
        const { container } = show(calibration(0.42, true));
        expect(container.querySelector('.confidence-losing')).not.toBeNull();
    });

    it('leaves the rate unmarked when the level is not losing', () => {
        const { container } = show(calibration(0.54, false));
        expect(line(container)).toBe('B : 54%');
        expect(container.querySelector('.confidence-losing')).toBeNull();
    });

    it('shows the side alone until a level has enough hands behind it', () => {
        const { container } = show(new Map());
        expect(line(container)).toBe('B');
    });

    it('never shows the old Low / Med / HIGH labels', () => {
        const { container } = show(calibration(0.42, true));
        expect(container.textContent).not.toMatch(/\b(HIGH|Med|Low)\b/);
    });

    it('shows N/A rather than a bare rate when there is no call', () => {
        const blank = deriveGrid([], 20);
        const { container } = render(
            <StealthModeView
                onExit={noop} scorecard={blank} lastWinRow={-1} lastPlayedRow={0}
                handleCellClick={noop} recordTie={noop}
                highlightedCells={new Map()} calibration={calibration(0.42, true)}
            />
        );
        expect(line(container)).toBe('N/A');
    });

    it('rounds the rate to a whole number', () => {
        const { container } = show(calibration(0.4267, false));
        expect(line(container)).toBe('B : 43%');
    });
});

describe('a card whose last entry is a tie', () => {
    const showTied = () =>
        render(
            <StealthModeView
                onExit={noop}
                scorecard={tiedGrid}
                lastWinRow={hands.length}
                lastPlayedRow={tiedHands.length}
                handleCellClick={noop}
                recordTie={noop}
                highlightedCells={computeHighlights(tiedGrid, tiedGrid[0].length)}
                calibration={new Map()}
            />
        );

    it('counts the tie in the hand number', () => {
        const { container } = showTied();
        // 5 rows are filled, so it must not read "H: 4".
        expect(container.querySelector('.stealth-hand-display span').textContent.trim())
            .toBe(`H: ${tiedHands.length}`);
    });

    it('does not strand the view above the tie row', () => {
        const { container } = showTied();
        const down = container.querySelectorAll('.stealth-hand-display button')[1];
        expect(down.disabled).toBe(true); // already at the last filled row
    });

    it('still predicts from the last decided hand', () => {
        // The tie changes nothing, so the call is the same as without it.
        const { container } = showTied();
        expect(line(container)).toBe('B');
    });
});
