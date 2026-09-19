// src/components/StatsModal.test.js
//
// Renders the panel against real log shapes. The panel is where the honesty of
// this whole phase actually lands, so the cases below are the ones that matter:
// no data, a middling result that should NOT look like success, and a log
// spanning two engine versions.

import { render, screen } from '@testing-library/react';
import StatsModal from './StatsModal';
import { ENGINE_VERSION } from '../engine/predict';

const entry = (i, predicted, actual, extra = {}) => ({
    v: 1,
    engine: ENGINE_VERSION,
    card: 'Test Card',
    hand: i,
    predicted,
    confidence: 3,
    source: predicted ? 'pattern' : null,
    pattern: predicted ? 'pattern-121' : null,
    actual,
    history: 'PB',
    at: `2026-09-19T00:00:${String(i).padStart(2, '0')}.000Z`,
    ...extra,
});

const noop = () => {};
const tallies = { pWins: 40, bWins: 60 };

describe('StatsModal', () => {
    it('says so plainly when there is nothing recorded yet', () => {
        render(<StatsModal tallies={tallies} log={[]} onClose={noop} onClearLog={noop} />);
        expect(screen.getByText(/No predictions recorded yet/i)).toBeInTheDocument();
    });

    it('still shows the card tallies with an empty log', () => {
        render(<StatsModal tallies={tallies} log={[]} onClose={noop} onClearLog={noop} />);
        expect(screen.getByText('60')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('does not present a 52% result as success', () => {
        // 104 right out of 200 -- above 50%, but nowhere near significant.
        const log = Array.from({ length: 200 }, (_, i) =>
            entry(i + 1, 'P', i < 104 ? 'P' : 'B')
        );
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onClearLog={noop} />);

        expect(screen.getByText(/indistinguishable from chance/i)).toBeInTheDocument();
        expect(screen.queryByText(/clears break-even/i)).not.toBeInTheDocument();
    });

    it('tells you how much more data would be needed', () => {
        const log = Array.from({ length: 200 }, (_, i) =>
            entry(i + 1, 'P', i < 104 ? 'P' : 'B')
        );
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onClearLog={noop} />);
        expect(screen.getByText(/more than recorded so far/i)).toBeInTheDocument();
    });

    it('shows the baselines next to the engine', () => {
        const log = Array.from({ length: 50 }, (_, i) => entry(i + 1, 'B', 'B'));
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onClearLog={noop} />);

        expect(screen.getByText('Always Banker')).toBeInTheDocument();
        expect(screen.getByText('Always Player')).toBeInTheDocument();
        expect(screen.getByText('Always repeat')).toBeInTheDocument();
        expect(screen.getByText('Always switch')).toBeInTheDocument();
    });

    it('reports coverage, including hands with no opinion', () => {
        const log = [
            ...Array.from({ length: 8 }, (_, i) => entry(i + 1, 'B', 'B')),
            entry(9, null, 'P'),
            entry(10, null, 'B'),
        ];
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onClearLog={noop} />);
        expect(screen.getByText(/of 10 hands/i)).toBeInTheDocument();
    });

    it('excludes entries from an older engine rather than blending them in', () => {
        const log = [
            ...Array.from({ length: 5 }, (_, i) => entry(i + 1, 'B', 'B')),
            ...Array.from({ length: 5 }, (_, i) =>
                entry(i + 100, 'B', 'B', { engine: 'ancient@0' })
            ),
        ];
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onClearLog={noop} />);

        expect(screen.getByText(/1 older engine version excluded/i)).toBeInTheDocument();
        // 5 current-engine wins, not 10.
        expect(screen.getByText(/5W \/ 0L/)).toBeInTheDocument();
    });

    it('surfaces unsynced entries instead of hiding them', () => {
        const log = Array.from({ length: 3 }, (_, i) => entry(i + 1, 'B', 'B'));
        render(
            <StatsModal
                tallies={tallies} log={log} pendingSync={3} syncError="Failed to fetch"
                onClose={noop} onClearLog={noop}
            />
        );
        expect(screen.getByText(/3 waiting to sync/i)).toBeInTheDocument();
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('names the engine that produced the numbers', () => {
        render(<StatsModal tallies={tallies} log={[]} onClose={noop} onClearLog={noop} />);
        expect(screen.getByText(new RegExp(ENGINE_VERSION.replace(/[+@]/g, '.'), 'i'))).toBeInTheDocument();
    });
});
