// src/components/SimModal.js
//
// The simulation panel.
//
// It is built to make the honest reading the easy one. The headline is a
// verdict, not a hit rate, because a hit rate on its own invites the reader to
// compare it to 50% and stop there. Every rate carries its interval, every
// interval is compared to that rule's own break-even bar, and the chart shows
// the band a worthless rule set would occupy.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { SIMULATABLE_RULES } from '../engine/sim';
import { GENERATORS } from '../engine/shoe';
import { EquityChart, RuleChart } from './SimChart';
import SimHelp from './SimHelp';

const pct = (x, dp = 2) => (x === null || x === undefined ? '--' : `${(x * 100).toFixed(dp)}%`);
const signed = (x, dp = 4) => (x === null || x === undefined ? '--' : `${x >= 0 ? '+' : ''}${x.toFixed(dp)}`);
const num = (n) => (n === null || n === undefined ? '--' : n.toLocaleString());

const PRESETS = {
    'wiener-snake': {
        label: 'Wiener + Snake',
        ids: ['wiener-3', 'wiener-4', 'wiener-5', 'snake-box-2', 'snake-box-3'],
    },
    'rule-of-three': {
        label: 'Rule of Three',
        ids: ['rule-of-three-player', 'rule-of-three-banker', 'rule-of-three-alternating'],
    },
    everything: { label: 'Every rule', ids: SIMULATABLE_RULES.map((r) => r.id) },
};

const SHOE_COUNTS = [1000, 10000, 100000, 1000000];

// Measured on this engine: a hand costs about 4.4 microseconds without the
// grid and about 1.1 milliseconds with it, the difference being that only
// `pattern` reads the board and reading it means recomputing the highlights.
const US_PER_HAND_FLAT = 4.4;
const US_PER_HAND_GRID = 1116;
const HANDS_PER_SHOE = 80;

const estimateSeconds = (shoes, usesGrid, workers) =>
    (shoes * HANDS_PER_SHOE * (usesGrid ? US_PER_HAND_GRID : US_PER_HAND_FLAT)) / 1e6 / Math.max(1, workers);

const humanDuration = (seconds) => {
    if (seconds < 1) return 'under a second';
    if (seconds < 90) return `about ${Math.round(seconds)}s`;
    if (seconds < 3600) return `about ${Math.round(seconds / 60)} min`;
    return `about ${(seconds / 3600).toFixed(1)} hours`;
};

/** The one-line answer, stated in terms of the decision it informs. */
const Verdict = ({ result }) => {
    const { pooled, z } = result;
    if (!pooled || pooled.n === 0) return <p className="sim-verdict">No bets were placed.</p>;

    if (pooled.beatsBreakEven) {
        return (
            <p className="sim-verdict verdict-good">
                Clears break-even over {num(pooled.n)} bets
                {z !== null && <> — {z.toFixed(1)} standard errors above the bar</>}.
            </p>
        );
    }
    if (pooled.belowBreakEven) {
        return (
            <p className="sim-verdict verdict-bad">
                Loses money over {num(pooled.n)} bets. The whole interval sits below break-even.
            </p>
        );
    }
    return (
        <p className="sim-verdict verdict-unknown">
            Indistinguishable from betting blind over {num(pooled.n)} bets — the
            interval straddles break-even.
        </p>
    );
};

const SimModal = ({ onClose }) => {
    const [ruleIds, setRuleIds] = useState(PRESETS['wiener-snake'].ids);
    const [generator, setGenerator] = useState('shoe');
    const [shoes, setShoes] = useState(10000);
    const [arbitration, setArbitration] = useState('adaptive');
    const [wholeShoe, setWholeShoe] = useState(true);
    const [fromHand, setFromHand] = useState(20);
    const [toHand, setToHand] = useState(70);
    const [seed, setSeed] = useState(1);
    const [view, setView] = useState('equity');
    const [showHelp, setShowHelp] = useState(false);

    const { run, cancel, running, progress, result, error, elapsed, workers } = useSimulation();

    // Both views share one scrolling element, so without this the help opens at
    // whatever offset the results were left at -- and since the link that opens
    // it sits beside the chart, a long way down, it reliably lands mid-sentence.
    const bodyRef = useRef(null);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [showHelp]);

    const usesGrid = ruleIds.includes('pattern');
    const estimate = useMemo(
        () => estimateSeconds(shoes, usesGrid, workers),
        [shoes, usesGrid, workers]
    );

    const toggleRule = (id) =>
        setRuleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

    const start = () => run({
        ruleIds, generator, shoes, arbitration, seed,
        fromHand: wholeShoe ? 1 : Math.max(1, Number(fromHand) || 1),
        toHand: wholeShoe ? null : Math.max(1, Number(toHand) || 1),
    });

    const pooled = result?.pooled;
    const bankerFraction = pooled && pooled.n ? pooled.bankerCalls / pooled.n : 0.5;
    const pctDone = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <div className="stats-modal-overlay" onClick={onClose}>
            <div className="stats-modal-content sim-modal" onClick={(e) => e.stopPropagation()}>
                <button
                    className="stats-help-button"
                    aria-label={showHelp ? 'Back to the simulator' : 'What do these mean?'}
                    title={showHelp ? 'Back to the simulator' : 'What do these mean?'}
                    onClick={() => setShowHelp((v) => !v)}
                >
                    {showHelp ? '←' : '?'}
                </button>
                <h2>{showHelp ? 'What these mean' : 'Simulator'}</h2>

                {/* A run keeps going while the help is open -- the workers do not
                    care what is on screen -- so reading the explanation never
                    costs you the simulation you started. */}
                <div className="stats-modal-body" ref={bodyRef}>
                    {showHelp ? <SimHelp /> : <>
                    <section className="sim-controls">
                        <h3>Rules</h3>
                        <div className="sim-presets">
                            {Object.entries(PRESETS).map(([key, p]) => (
                                <button
                                    key={key} type="button" className="sim-chip"
                                    onClick={() => setRuleIds(p.ids)} disabled={running}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="sim-rule-grid">
                            {SIMULATABLE_RULES.map((r) => (
                                <label key={r.id} className="sim-check" title={r.note || ''}>
                                    <input
                                        type="checkbox" checked={ruleIds.includes(r.id)}
                                        onChange={() => toggleRule(r.id)} disabled={running}
                                    />
                                    <span>{r.label}{r.needsGrid ? ' *' : ''}</span>
                                </label>
                            ))}
                        </div>
                        {usesGrid && (
                            <p className="sim-note">
                                * <strong>pattern</strong> is the only rule that reads the grid, so
                                selecting it makes the run roughly 250× slower.
                            </p>
                        )}

                        <h3>Hands</h3>
                        <label className="sim-check">
                            <input
                                type="checkbox" checked={wholeShoe} disabled={running}
                                onChange={(e) => setWholeShoe(e.target.checked)}
                            />
                            <span>Bet the entire shoe</span>
                        </label>
                        {!wholeShoe && (
                            <div className="sim-range">
                                <label>
                                    From #
                                    <input
                                        type="number" min="1" max="120" value={fromHand} disabled={running}
                                        onChange={(e) => setFromHand(e.target.value)}
                                    />
                                </label>
                                <label>
                                    To #
                                    <input
                                        type="number" min="1" max="120" value={toHand} disabled={running}
                                        onChange={(e) => setToHand(e.target.value)}
                                    />
                                </label>
                            </div>
                        )}
                        <p className="sim-note">
                            Rules still watch every hand — the window only decides which
                            hands you bet. A shoe runs about 80 hands.
                        </p>

                        <h3>Run</h3>
                        <div className="sim-field">
                            <label>
                                Shoes
                                <select
                                    value={shoes} disabled={running}
                                    onChange={(e) => setShoes(Number(e.target.value))}
                                >
                                    {SHOE_COUNTS.map((n) => (
                                        <option key={n} value={n}>
                                            {num(n)} ({num(n * HANDS_PER_SHOE)} hands)
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Cards
                                <select
                                    value={generator} disabled={running}
                                    onChange={(e) => setGenerator(e.target.value)}
                                >
                                    {Object.values(GENERATORS).map((g) => (
                                        <option key={g.id} value={g.id}>{g.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <p className="sim-note">{GENERATORS[generator]?.note}</p>

                        <div className="sim-field">
                            <label>
                                Conflicts
                                <select
                                    value={arbitration} disabled={running}
                                    onChange={(e) => setArbitration(e.target.value)}
                                >
                                    <option value="adaptive">Settled on track record</option>
                                    <option value="off">Not settled (measure rules alone)</option>
                                </select>
                            </label>
                            <label>
                                Seed
                                <input
                                    type="number" value={seed} disabled={running}
                                    onChange={(e) => setSeed(Number(e.target.value) || 0)}
                                />
                            </label>
                        </div>

                        <div className="sim-actions">
                            {running ? (
                                <button type="button" className="delete-button" onClick={cancel}>
                                    Stop
                                </button>
                            ) : (
                                <button
                                    type="button" className="save-button"
                                    onClick={start} disabled={ruleIds.length === 0}
                                >
                                    Run simulation
                                </button>
                            )}
                            <span className="sim-note">
                                {running
                                    ? `${pctDone}% — ${num(progress.done)} of ${num(progress.total)} shoes`
                                    : `${workers} workers · ${humanDuration(estimate)}`}
                            </span>
                        </div>

                        {running && (
                            <div className="sim-progress"><div style={{ width: `${pctDone}%` }} /></div>
                        )}
                        {error && <p className="sim-note verdict-bad">{error}</p>}
                    </section>

                    {result && pooled && (
                        <section>
                            <h3>Result</h3>
                            <Verdict result={result} />

                            <table className="stats-table">
                                <tbody>
                                    <tr><td>Shoes played</td><td>{num(result.shoes)}</td></tr>
                                    <tr><td>Hands dealt</td><td>{num(result.hands)}</td></tr>
                                    <tr><td>Hands in window</td><td>{num(result.decisions)}</td></tr>
                                    <tr className="row-highlight">
                                        <td>Bets placed</td>
                                        <td>{num(pooled.n)}{pooled.pushes > 0 && <span className="stat-muted"> (+{num(pooled.pushes)} pushed)</span>}</td>
                                    </tr>
                                    <tr>
                                        <td>You would bet</td>
                                        <td>{pct(result.coverage)} of hands in window</td>
                                    </tr>
                                    <tr className="row-highlight">
                                        <td>Hit rate</td>
                                        <td>
                                            {pct(pooled.rate)}
                                            <span className="stat-interval"> ({pct(pooled.low)}–{pct(pooled.high)})</span>
                                        </td>
                                    </tr>
                                    <tr><td>Break-even needed</td><td>{pct(pooled.breakEven)}</td></tr>
                                    <tr>
                                        <td>Per unit staked</td>
                                        <td>{signed(pooled.evPerUnit)} <span className="stat-muted">({signed(pooled.units, 0)} units)</span></td>
                                    </tr>
                                    <tr>
                                        <td>Above break-even</td>
                                        <td>{result.z === null ? '--' : `${result.z.toFixed(2)} SE`}</td>
                                    </tr>
                                    {elapsed !== null && (
                                        <tr><td>Took</td><td>{(elapsed / 1000).toFixed(1)}s</td></tr>
                                    )}
                                </tbody>
                            </table>

                            <div className="sim-tabs">
                                <button
                                    type="button" className={view === 'equity' ? 'sim-chip active' : 'sim-chip'}
                                    onClick={() => setView('equity')}
                                >
                                    Equity curve
                                </button>
                                <button
                                    type="button" className={view === 'rules' ? 'sim-chip active' : 'sim-chip'}
                                    onClick={() => setView('rules')}
                                >
                                    By rule
                                </button>
                                {/* Beside the charts as well as in the corner. A
                                    "?" at the top of a panel is easy to miss, and
                                    the equity curve is the one thing here that is
                                    actively misleading if read without it. */}
                                <button
                                    type="button" className="sim-help-link"
                                    onClick={() => setShowHelp(true)}
                                >
                                    What am I looking at?
                                </button>
                            </div>

                            {view === 'equity'
                                ? <EquityChart curve={result.curve} bankerFraction={bankerFraction} />
                                : <RuleChart rows={result.ruleRows} />}

                            <h3>By rule</h3>
                            <table className="stats-table">
                                <thead>
                                    <tr><th>Rule</th><th>Bets</th><th>Hit rate</th><th>Per unit</th></tr>
                                </thead>
                                <tbody>
                                    {result.ruleRows.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.label}</td>
                                            <td>{num(r.n)}</td>
                                            <td className={r.beatsBreakEven ? 'verdict-good' : r.belowBreakEven ? 'verdict-bad' : undefined}>
                                                {pct(r.rate)}
                                                <span className="stat-interval"> ({pct(r.low, 1)}–{pct(r.high, 1)})</span>
                                            </td>
                                            <td>{signed(r.evPerUnit, 3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {result.contested > 0 && (
                                <p className="sim-note">
                                    Rules disagreed on {num(result.contested)} hands
                                    ({pct(result.contested / Math.max(1, pooled.fired), 1)} of bets).
                                </p>
                            )}

                            <p className="sim-note">
                                Seed {result.seed} · {GENERATORS[result.generator]?.label}
                                {result.toHand !== null && result.toHand !== undefined
                                    ? ` · hands ${result.fromHand}–${result.toHand}`
                                    : ' · whole shoe'}
                                . The same settings always give the same answer.
                            </p>
                        </section>
                    )}
                    </>}
                </div>

                <button type="button" className="load-button" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default SimModal;
