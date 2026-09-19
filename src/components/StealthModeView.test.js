// src/components/StealthModeView.test.js
//
// The at-the-table screen. Its whole job is to be read at a glance, so the
// exact string matters more here than anywhere else in the app.

import { render } from '@testing-library/react';
import StealthModeView from './StealthModeView';
import { deriveGrid } from '../engine/grid';
import { computeHighlights } from '../engine/analytics';

const noop = () => {};

// A card ending in three Bankers, so the Rule of Three calls Banker next.
const hands = ['P', 'B', 'B', 'B'];
const grid = deriveGrid(hands, 20);
const highlights = computeHighlights(grid, grid[0].length);

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

// Scoped to the prediction line: the action buttons are also labelled P/T/B.
const line = (container) =>
    container.querySelector('.stealth-prediction-display').textContent.replace(/\s+/g, ' ').trim();

const calibration = (level, rate, belowBreakEven) =>
    new Map([[level, { n: 300, rate, low: rate - 0.05, high: rate + 0.05, breakEven: 0.506, belowBreakEven }]]);

describe('StealthModeView', () => {
    it('reads "B : 42%" — the side, then the measured rate', () => {
        const { container } = show(calibration(3, 0.42, true));
        expect(line(container)).toBe('B : 42%');
    });

    it('marks the rate when the level is measurably losing', () => {
        const { container } = show(calibration(3, 0.42, true));
        expect(container.querySelector('.confidence-losing')).not.toBeNull();
    });

    it('leaves the rate unmarked when the level is not losing', () => {
        const { container } = show(calibration(3, 0.54, false));
        expect(line(container)).toBe('B : 54%');
        expect(container.querySelector('.confidence-losing')).toBeNull();
    });

    it('shows the side alone until a level has enough hands behind it', () => {
        const { container } = show(new Map());
        expect(line(container)).toBe('B');
    });

    it('never shows the old Low / Med / HIGH labels', () => {
        const { container } = show(calibration(3, 0.42, true));
        expect(container.textContent).not.toMatch(/\b(HIGH|Med|Low)\b/);
    });

    it('shows N/A rather than a bare rate when there is no call', () => {
        const blank = deriveGrid([], 20);
        const { container } = render(
            <StealthModeView
                onExit={noop} scorecard={blank} lastWinRow={-1} lastPlayedRow={0}
                handleCellClick={noop} recordTie={noop}
                highlightedCells={new Map()} calibration={calibration(0, 0.42, true)}
            />
        );
        expect(line(container)).toBe('N/A');
    });

    it('rounds the rate to a whole number', () => {
        const { container } = show(calibration(3, 0.4267, false));
        expect(line(container)).toBe('B : 43%');
    });
});
