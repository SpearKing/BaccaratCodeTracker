// src/components/StatsModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { summarise, beatsBreakEven, wilsonInterval } from '../engine/stats';
import { dedupe, byEngine } from '../engine/decisionLog';
import { recordsFrom, headToHeadFrom, MIN_FIRINGS } from '../engine/arbitrate';
import { ENGINE_VERSION } from '../engine/predict';
import { RULES, ruleLabel } from '../engine/rules';
import StatsHelp from './StatsHelp';

const pct = (x) => (x === null || x === undefined ? '--' : `${(x * 100).toFixed(1)}%`);
const signed = (x) => (x === null || x === undefined ? '--' : `${x >= 0 ? '+' : ''}${x.toFixed(3)}`);

/** A hit rate with its confidence interval. The interval is the point. */
const Rate = ({ tally: t }) => {
    if (!t || t.n === 0) return <span className="stat-muted">no data</span>;
    return (
        <span>
            {pct(t.interval.estimate)}
            <span className="stat-interval"> ({pct(t.interval.low)}–{pct(t.interval.high)})</span>
        </span>
    );
};

const Verdict = ({ tally: t }) => {
    if (!t || t.n === 0) return null;
    if (beatsBreakEven(t)) {
        return <span className="verdict-good">clears break-even</span>;
    }
    if (t.interval.high !== null && t.interval.high < t.breakEven) {
        return <span className="verdict-bad">below break-even</span>;
    }
    return <span className="verdict-unknown">indistinguishable from chance</span>;
};

const StatsModal = ({ tallies, log, card, testCount = 0, pendingSync, syncError, onExportLog, onImportLog, onClose }) => {
    const [showHelp, setShowHelp] = useState(false);
    const entries = useMemo(() => dedupe(log || []), [log]);

    // Both views share one scrolling element, so without this the help opens at
    // whatever offset the statistics were left at. The "?" stays pinned to the
    // panel while the body scrolls, so it is reachable from the bottom of a long
    // page -- which is exactly where it lands you mid-sentence.
    const bodyRef = useRef(null);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [showHelp]);

    // Never average two engines together. Only the current one is scored.
    const engines = useMemo(() => byEngine(entries), [entries]);
    const current = useMemo(() => engines.get(ENGINE_VERSION) || [], [engines]);
    const otherEngines = useMemo(
        () => [...engines.keys()].filter((k) => k !== ENGINE_VERSION),
        [engines]
    );

    const s = useMemo(() => summarise(current), [current]);

    // Each rule's record from every hand it FIRED on, win or lose -- which is
    // what arbitration actually weighs. That differs from "by rule" below,
    // which counts only the hands a rule won.
    const overallRecords = useMemo(() => recordsFrom(current), [current]);
    const sessionRecords = useMemo(
        () => recordsFrom(current.filter((e) => e.card === card)),
        [current, card]
    );

    // How rules have fared against each other. This is what settles a conflict
    // once a pair has clashed often enough, so it is worth being able to see.
    const pairs = useMemo(() => headToHeadFrom(current), [current]);
    const clashes = useMemo(
        () => [...pairs.entries()]
            .map(([key, rec]) => {
                const [a, b] = key.split('|');
                return { a, b, n: rec.n, aRate: rec.firstWins / rec.n };
            })
            .sort((x, y) => y.n - x.n),
        [pairs]
    );

    const pWins = tallies?.pWins ?? 0;
    const bWins = tallies?.bWins ?? 0;
    const totalHands = pWins + bWins;

    const scored = (grouped) => [...grouped.entries()].filter(([, t]) => t.n > 0);

    // One renderer for both rule tables. They ask the same question of
    // different slices, so they should not be able to drift apart.
    const ruleRows = (records) => RULES.map((rule) => {
        const rec = records.get(rule.id);
        if (!rec || rec.n === 0) return null;
        const ci = wilsonInterval(rec.correct, rec.n);
        const thin = rec.n < MIN_FIRINGS;
        return (
            <tr key={rule.id}>
                <td>{rule.label || rule.id}</td>
                <td>{rec.n}</td>
                <td className={thin ? 'stat-muted' : undefined}>{pct(ci.estimate)}</td>
            </tr>
        );
    }).filter(Boolean);

    // Only meaningful when the engine is actually ahead of the bar. Below it,
    // "how many more hands to confirm this" would be asking how long to keep
    // going to prove you are losing, which the verdict line already says.
    const isAhead =
        s.overall.n > 0 &&
        s.overall.breakEven !== null &&
        s.overall.interval.estimate >= s.overall.breakEven;
    const shortfall = isAhead && s.needed && s.needed !== Infinity
        ? Math.max(0, s.needed - s.overall.n)
        : null;

    return (
        <div className="stats-modal-overlay" onClick={onClose}>
            <div className="stats-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="stats-close-button" onClick={onClose}>&times;</button>
                <button
                    className="stats-help-button"
                    aria-label={showHelp ? 'Back to the statistics' : 'What do these mean?'}
                    title={showHelp ? 'Back to the statistics' : 'What do these mean?'}
                    onClick={() => setShowHelp((v) => !v)}
                >
                    {showHelp ? '\u2190' : '?'}
                </button>
                <h2>{showHelp ? 'What these mean' : 'Statistics'}</h2>

                {/* Only the body scrolls, so the heading and the close button
                    stay put. The panel has grown a lot -- baselines, per-rule
                    records, the clash table -- and had no max height at all,
                    so on a phone the lower half was simply unreachable. */}
                <div className="stats-modal-body" ref={bodyRef}>
                {showHelp ? <StatsHelp /> : <>

                {/* ---- This session --------------------------------------- */}
                <h3>This session</h3>
                <table className="stats-table">
                    <tbody>
                        <tr>
                            <td className="bold">Banker</td>
                            <td>{bWins}</td>
                            <td>{totalHands ? pct(bWins / totalHands) : '--'}</td>
                        </tr>
                        <tr>
                            <td className="bold">Player</td>
                            <td>{pWins}</td>
                            <td>{totalHands ? pct(pWins / totalHands) : '--'}</td>
                        </tr>
                    </tbody>
                </table>

                {ruleRows(sessionRecords).length > 0 && (
                    <>
                        <h3 className="stats-subhead">By rule, this session</h3>
                        <table className="stats-table">
                            <thead>
                                <tr><th>Rule</th><th>Fired</th><th>Hit rate</th></tr>
                            </thead>
                            <tbody>{ruleRows(sessionRecords)}</tbody>
                        </table>
                    </>
                )}

                {/* ---- Predictions ---------------------------------------- */}
                <h3>Predictions <span className="stat-muted">(all cards)</span></h3>

                {s.overall.n === 0 ? (
                    <p className="stat-muted">
                        No predictions recorded yet. Play some hands and they will be logged here.
                    </p>
                ) : (
                    <>
                        <table className="stats-table">
                            <tbody>
                                <tr>
                                    <td className="bold">Hit rate</td>
                                    <td colSpan="2"><Rate tally={s.overall} /></td>
                                </tr>
                                <tr>
                                    <td>Break-even needed</td>
                                    <td colSpan="2">{pct(s.overall.breakEven)}</td>
                                </tr>
                                <tr>
                                    <td>Verdict</td>
                                    <td colSpan="2"><Verdict tally={s.overall} /></td>
                                </tr>
                                <tr>
                                    <td>Per unit staked</td>
                                    <td colSpan="2">
                                        {signed(s.overall.evPerUnit)}
                                        <span className="stat-muted"> ({signed(s.overall.units)} total)</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Record</td>
                                    <td colSpan="2">
                                        {s.overall.correct}W / {s.overall.wrong}L
                                        {s.overall.pushes > 0 && ` / ${s.overall.pushes} push`}
                                    </td>
                                </tr>
                                <tr>
                                    <td>Offered an opinion</td>
                                    <td colSpan="2">
                                        {pct(s.coverage)}
                                        <span className="stat-muted"> of {s.decisions} hands</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {shortfall > 0 && (
                            <p className="stat-note">
                                At this hit rate it would take about {s.needed.toLocaleString()} predictions
                                to tell a real edge from noise — roughly {shortfall.toLocaleString()} more
                                than recorded so far.
                            </p>
                        )}

                        {/* ---- Baselines ------------------------------------ */}
                        <h3>Compared with betting blind</h3>
                        <table className="stats-table">
                            <thead>
                                <tr><th>Strategy</th><th>Hit rate</th><th>Per unit</th></tr>
                            </thead>
                            <tbody>
                                <tr className="row-highlight">
                                    <td className="bold">The engine</td>
                                    <td><Rate tally={s.overall} /></td>
                                    <td>{signed(s.overall.evPerUnit)}</td>
                                </tr>
                                {[
                                    ['Always Banker', s.baselines.alwaysBanker],
                                    ['Always Player', s.baselines.alwaysPlayer],
                                    ['Always repeat', s.baselines.alwaysRepeat],
                                    ['Always switch', s.baselines.alwaysSwitch],
                                ].map(([label, t]) => (
                                    <tr key={label}>
                                        <td>{label}</td>
                                        <td><Rate tally={t} /></td>
                                        <td>{signed(t.evPerUnit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* ---- By rule -------------------------------------- */}
                        <h3>By rule, all sessions</h3>
                        <p className="stat-note">
                            Every hand a rule fired on, whether or not it won the call —
                            this is what decides conflicts. A rule needs {MIN_FIRINGS} firings
                            before its rate counts.
                        </p>
                        <table className="stats-table">
                            <thead>
                                <tr><th>Rule</th><th>Fired</th><th>Hit rate</th></tr>
                            </thead>
                            <tbody>{ruleRows(overallRecords)}</tbody>
                        </table>
                        <p className="stat-note stat-muted">
                            Greyed rates have fewer than {MIN_FIRINGS} firings and are not yet used.
                        </p>

                        {clashes.length > 0 && (
                            <>
                                <h3>When rules disagree</h3>
                                <p className="stat-note">
                                    Who has been right when these two called opposite sides. This
                                    settles the conflict once the pair has clashed {MIN_FIRINGS} times —
                                    a rule can be good in general and poor against one particular
                                    opponent, and it is the second that matters here.
                                </p>
                                <table className="stats-table">
                                    <thead>
                                        <tr><th>Clash</th><th>n</th><th>Winner</th></tr>
                                    </thead>
                                    <tbody>
                                        {clashes.map(({ a, b, n, aRate }) => {
                                            const leader = aRate >= 0.5 ? a : b;
                                            const rate = aRate >= 0.5 ? aRate : 1 - aRate;
                                            const thin = n < MIN_FIRINGS;
                                            return (
                                                <tr key={`${a}|${b}`}>
                                                    <td>{ruleLabel(a)} v {ruleLabel(b)}</td>
                                                    <td>{n}</td>
                                                    <td className={thin ? 'stat-muted' : undefined}>
                                                        {aRate === 0.5
                                                            ? 'even'
                                                            : `${ruleLabel(leader)} ${pct(rate)}`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}

                        {/* The By C-Level table was here. The level is a count of
                            lit columns and the table said nothing the measured
                            percentage on the prediction bar does not. The
                            calibration behind that percentage is unchanged. */}

                        {scored(s.byPattern).length > 0 && (
                            <>
                                <h3>By pattern</h3>
                                <p className="stat-note">
                                    Credited only to the pattern that actually drove the call.
                                </p>
                                <table className="stats-table">
                                    <thead>
                                        <tr><th>Pattern</th><th>n</th><th>Hit rate</th></tr>
                                    </thead>
                                    <tbody>
                                        {scored(s.byPattern).map(([name, t]) => (
                                            <tr key={name}>
                                                <td>{name.replace('pattern-', '')}</td>
                                                <td>{t.n}</td>
                                                <td><Rate tally={t} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </>
                )}

                {/* ---- Log housekeeping ----------------------------------- */}
                <h3>Log</h3>
                {testCount > 0 && (
                    <p className="stat-note">
                        {testCount.toLocaleString()} test {testCount === 1 ? 'hand is' : 'hands are'} excluded
                        from everything above, and from what the engine learns.
                    </p>
                )}
                <p className="stat-note">
                    {entries.length.toLocaleString()} decisions recorded
                    {pendingSync > 0 && ` · ${pendingSync} waiting to sync`}
                    {syncError && ` · offline (${syncError})`}
                    {otherEngines.length > 0 &&
                        ` · ${otherEngines.length} older engine version${otherEngines.length > 1 ? 's' : ''} excluded`}
                </p>
                <p className="stat-note stat-muted">Engine: {ENGINE_VERSION}</p>
                {/* There used to be a "clear the log" button here. The log is
                    the engine's memory now -- every rule's record comes out of
                    it, and nothing restores it from the server -- so one tap
                    was total amnesia in exchange for nothing. Saving a copy is
                    the useful thing to be able to do. */}
                <button className="load-button" onClick={onExportLog}>
                    Download decision log
                </button>
                <label className="load-button import-log-button">
                    Import decision log
                    <input
                        type="file"
                        accept="application/json,.json"
                        style={{ display: 'none' }}
                        onChange={(e) => { onImportLog?.(e.target.files?.[0]); e.target.value = ''; }}
                    />
                </label>
                </>}
                </div>
            </div>
        </div>
    );
};

export default StatsModal;
