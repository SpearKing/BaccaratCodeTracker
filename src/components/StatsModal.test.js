// src/components/StatsModal.test.js
//
// Renders the panel against real log shapes. The panel is where the honesty of
// this whole phase actually lands, so the cases below are the ones that matter:
// no data, a middling result that should NOT look like success, and a log
// spanning two engine versions.

import { render, screen, fireEvent } from '@testing-library/react';
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
        expect(body).toMatch(/Wiener-3/);
        expect(body).toMatch(/75\.0%/);   // this session: 30 of 40
        expect(body).toMatch(/50\.0%/);   // all sessions: 40 of 80
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
        expect(body).toMatch(/pattern v R3-B/);
        expect(body).toMatch(/R3-B 60\.0%/);
    });

    it('calls a dead heat even rather than picking a side', () => {
        const log = Array.from({ length: 100 }, (_, i) =>
            clash(i + 1, 'P', 'B', i < 50 ? 'B' : 'P')
        );
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);
        expect(document.body.textContent).toMatch(/even/);
    });
});

describe('a panel that fits on a phone', () => {
    it('puts the long content in its own scrolling region', () => {
        const log = Array.from({ length: 40 }, (_, i) => entry(i + 1, 'B', 'B'));
        const { container } = render(
            <StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />
        );
        const body = container.querySelector('.stats-modal-body');
        expect(body).not.toBeNull();
        // The heading and close button sit outside it, so they stay put.
        expect(body.querySelector('.stats-close-button')).toBeNull();
        expect(body.querySelector('h2')).toBeNull();
        expect(container.querySelector('.stats-close-button')).not.toBeNull();
    });

    it('keeps the download and import controls inside the scrolling region', () => {
        const log = Array.from({ length: 40 }, (_, i) => entry(i + 1, 'B', 'B'));
        const { container } = render(
            <StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />
        );
        const body = container.querySelector('.stats-modal-body');
        expect(body.textContent).toMatch(/Download decision log/);
    });
});

describe('the help view', () => {
    const someLog = Array.from({ length: 40 }, (_, i) => entry(i + 1, 'B', 'B'));
    const open = () => render(
        <StatsModal tallies={tallies} log={someLog} card="Tonight" onClose={noop} onExportLog={noop} />
    );

    it('starts on the statistics, not the help', () => {
        const { container } = open();
        expect(container.querySelector('h2').textContent).toBe('Statistics');
    });

    it('swaps to the help and back', () => {
        const { container } = open();
        const help = container.querySelector('.stats-help-button');

        fireEvent.click(help);
        expect(container.querySelector('h2').textContent).toBe('What these mean');
        expect(container.querySelector('.stats-help')).not.toBeNull();

        fireEvent.click(container.querySelector('.stats-help-button'));
        expect(container.querySelector('h2').textContent).toBe('Statistics');
    });

    it('explains every section of the panel', () => {
        const { container } = open();
        fireEvent.click(container.querySelector('.stats-help-button'));
        const text = container.textContent;
        ['The prediction bar', 'This session', 'Predictions', 'Compared with betting blind',
         'By rule', 'When rules disagree', 'By pattern', 'Log'].forEach((heading) => {
            expect(text).toContain(heading);
        });
    });

    it('explains the headers people actually misread', () => {
        const { container } = open();
        fireEvent.click(container.querySelector('.stats-help-button'));
        const text = container.textContent;
        expect(text).toMatch(/51\.28%/);              // Banker break-even, not 50%
        expect(text).toMatch(/Per unit staked/);
        expect(text).toMatch(/range/i);
        // The distinction the bar's layout could otherwise imply: C describes
        // the confidence level, not the rule sitting next to it.
        expect(text).toMatch(/not.{0,4}the rule named beside it/i);
    });

    it('leaves the close button reachable from the help', () => {
        const { container } = open();
        fireEvent.click(container.querySelector('.stats-help-button'));
        expect(container.querySelector('.stats-close-button')).not.toBeNull();
    });
});

describe('session versus all sessions', () => {
    const fired = (i, id, call, actual, cardName) => ({
        ...entry(i, call, actual), card: cardName, candidates: [{ id, call }],
    });

    it('gives the session its own rule table, separate from the overall one', () => {
        const log = [
            ...Array.from({ length: 40 }, (_, i) => fired(i + 1, 'wiener-3', 'B', i < 30 ? 'B' : 'P', 'Tonight')),
            ...Array.from({ length: 40 }, (_, i) => fired(i + 100, 'wiener-3', 'B', i < 10 ? 'B' : 'P', 'Last week')),
        ];
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);
        const body = document.body.textContent;

        expect(body).toMatch(/By rule, this session/);
        expect(body).toMatch(/By rule, all sessions/);
        // 30 of 40 on this card; 40 of 80 across both.
        expect(body).toMatch(/75\.0%/);
        expect(body).toMatch(/50\.0%/);
        // The session table comes first, under the session heading.
        expect(body.indexOf('By rule, this session')).toBeLessThan(body.indexOf('By rule, all sessions'));
        expect(body.indexOf('This session')).toBeLessThan(body.indexOf('By rule, this session'));
    });

    it('leaves the session table out when nothing has fired on this card', () => {
        const log = Array.from({ length: 40 }, (_, i) => fired(i + 1, 'wiener-3', 'B', 'B', 'Another card'));
        render(<StatsModal tallies={tallies} log={log} card="Tonight" onClose={noop} onExportLog={noop} />);
        expect(document.body.textContent).not.toMatch(/By rule, this session/);
        expect(document.body.textContent).toMatch(/By rule, all sessions/);
    });
});
