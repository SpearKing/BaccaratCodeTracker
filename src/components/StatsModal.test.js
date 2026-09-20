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

// Entries now carry the rules that fired, which is what arbitration weighs.
const withCandidates = (e, candidates) => ({ ...e, candidates });

describe('StatsModal', () => {
    it('says so plainly when there is nothing recorded yet', () => {
        render(<StatsModal tallies={tallies} log={[]} onClose={noop} onExportLog={noop} />);
        expect(screen.getByText(/No predictions recorded yet/i)).toBeInTheDocument();
    });

    it('still shows the card tallies with an empty log', () => {
        render(<StatsModal tallies={tallies} log={[]} onClose={noop} onExportLog={noop} />);
        expect(screen.getByText('60')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('does not present a 52% result as success', () => {
        // 104 right out of 200 -- above 50%, but nowhere near significant.
        const log = Array.from({ length: 200 }, (_, i) =>
            entry(i + 1, 'P', i < 104 ? 'P' : 'B')
        );
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);

        expect(screen.getByText(/indistinguishable from chance/i)).toBeInTheDocument();
        expect(screen.queryByText(/clears break-even/i)).not.toBeInTheDocument();
    });

    it('tells you how much more data would be needed', () => {
        const log = Array.from({ length: 200 }, (_, i) =>
            entry(i + 1, 'P', i < 104 ? 'P' : 'B')
        );
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);
        expect(screen.getByText(/more than recorded so far/i)).toBeInTheDocument();
    });

    it('shows the baselines next to the engine', () => {
        const log = Array.from({ length: 50 }, (_, i) => entry(i + 1, 'B', 'B'));
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);

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
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);
        expect(screen.getByText(/of 10 hands/i)).toBeInTheDocument();
    });

    it('excludes entries from an older engine rather than blending them in', () => {
        const log = [
            ...Array.from({ length: 5 }, (_, i) => entry(i + 1, 'B', 'B')),
            ...Array.from({ length: 5 }, (_, i) =>
                entry(i + 100, 'B', 'B', { engine: 'ancient@0' })
            ),
        ];
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);

        expect(screen.getByText(/1 older engine version excluded/i)).toBeInTheDocument();
        // 5 current-engine wins, not 10.
        expect(screen.getByText(/5W \/ 0L/)).toBeInTheDocument();
    });

    it('surfaces unsynced entries instead of hiding them', () => {
        const log = Array.from({ length: 3 }, (_, i) => entry(i + 1, 'B', 'B'));
        render(
            <StatsModal
                tallies={tallies} log={log} pendingSync={3} syncError="Failed to fetch"
                onClose={noop} onExportLog={noop}
            />
        );
        expect(screen.getByText(/3 waiting to sync/i)).toBeInTheDocument();
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('names the engine that produced the numbers', () => {
        render(<StatsModal tallies={tallies} log={[]} onClose={noop} onExportLog={noop} />);
        expect(screen.getByText(new RegExp(ENGINE_VERSION.replace(/[+@]/g, '.'), 'i'))).toBeInTheDocument();
    });
});

describe('panel restraint', () => {
    it('does not ask how much more data is needed when the engine is losing', () => {
        // 2 right out of 7 -- well below break-even. Telling the user how many
        // more hands would confirm this is not useful.
        const log = Array.from({ length: 7 }, (_, i) => entry(i + 1, 'P', i < 2 ? 'P' : 'B'));
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);
        expect(screen.queryByText(/more than recorded so far/i)).not.toBeInTheDocument();
    });

    it('does not print empty rows for groups with nothing resolved', () => {
        // Hands with no opinion carry confidence 0 and never resolve.
        const log = [
            ...Array.from({ length: 4 }, (_, i) => entry(i + 1, 'B', 'B')),
            entry(5, null, 'P', { confidence: 0 }),
            entry(6, null, 'B', { confidence: 0 }),
        ];
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);
        expect(screen.queryByText('no data')).not.toBeInTheDocument();
    });
});

describe('C-Level presentation', () => {
    it('shows levels in the order measured, without implying higher is better', () => {
        // The real ordering: C=3 beats C=5.
        const log = [
            ...Array.from({ length: 100 }, (_, i) => entry(i + 1, 'P', i < 54 ? 'P' : 'B', { confidence: 3 })),
            ...Array.from({ length: 100 }, (_, i) => entry(i + 200, 'P', i < 47 ? 'P' : 'B', { confidence: 5 })),
        ];
        render(<StatsModal tallies={tallies} log={log} onClose={noop} onExportLog={noop} />);
        expect(screen.getByText(/higher levels should verify more often/i)).toBeInTheDocument();
        // C=3 is shown ahead of C=5 with its higher rate, so the inversion is
        // visible rather than hidden behind a "HIGH" label.
        const body = document.body.textContent;
        expect(body).toMatch(/54\.0%/);
        expect(body).toMatch(/47\.0%/);
        expect(body.indexOf('54.0%')).toBeLessThan(body.indexOf('47.0%'));
    });
});

describe('per-rule records', () => {
    const fired = (i, id, call, actual, cardName) =>
        withCandidates(
            { ...entry(i, call, actual), card: cardName },
            [{ id, call }]
        );

    it('separates this card from the overall record', () => {
        const log = [
            ...Array.from({ length: 40 }, (_, i) => fired(i + 1, 'wiener-3', 'B', i < 30 ? 'B' : 'P', 'Tonight')),
            ...Array.from({ length: 40 }, (_, i) => fired(i + 100, 'wiener-3', 'B', i < 10 ? 'B' : 'P', 'Last week')),
        ];
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);

        const body = document.body.textContent;
        expect(body).toMatch(/wiener 3/);
        expect(body).toMatch(/75\.0%/);   // this card: 30 of 40
        expect(body).toMatch(/50\.0%/);   // overall: 40 of 80
    });

    it('greys a rate with too few firings behind it', () => {
        const log = Array.from({ length: 5 }, (_, i) => fired(i + 1, 'snake-box-3', 'B', 'B', 'Tonight'));
        const { container } = render(
            <StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />
        );
        expect(container.textContent).toMatch(/not yet used/);
    });

    it('offers a download instead of a way to wipe the log', () => {
        const log = Array.from({ length: 5 }, (_, i) => fired(i + 1, 'wiener-3', 'B', 'B', 'Tonight'));
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);
        expect(screen.getByText(/download decision log/i)).toBeInTheDocument();
        expect(screen.queryByText(/clear decision log/i)).not.toBeInTheDocument();
    });
});

describe('the clash table', () => {
    const clash = (i, aCall, bCall, actual) => ({
        ...entry(i, aCall, actual),
        card: 'Tonight',
        candidates: [{ id: 'pattern', call: aCall }, { id: 'rule-of-three-banker', call: bCall }],
    });

    it('shows who wins when two rules call opposite sides', () => {
        const log = Array.from({ length: 100 }, (_, i) =>
            clash(i + 1, 'P', 'B', i < 60 ? 'B' : 'P')     // banker right 60%
        );
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);
        const body = document.body.textContent;
        expect(body).toMatch(/When rules disagree/);
        expect(body).toMatch(/pattern v rule of three banker/);
        expect(body).toMatch(/rule of three banker 60\.0%/);
    });

    it('calls a dead heat even rather than picking a side', () => {
        const log = Array.from({ length: 100 }, (_, i) =>
            clash(i + 1, 'P', 'B', i < 50 ? 'B' : 'P')
        );
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);
        expect(document.body.textContent).toMatch(/even/);
    });
});
