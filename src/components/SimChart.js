// src/components/SimChart.js
//
// Two plots, both hand-rolled SVG. A charting library would be several hundred
// kilobytes to draw a polyline and a shaded band, on an app whose whole point
// is to load on a phone on a casino floor.
//
// The equity curve is drawn against a NULL BAND rather than bare. A rising line
// on its own is the single most misleading thing this app could show: a
// worthless rule set produces rising lines all the time, and over a long enough
// run it produces spectacular ones. The band is where a worthless rule set
// lives, so the only question the picture asks is whether the line leaves it.

import React from 'react';

const W = 680;
const H = 260;
const PAD = { top: 14, right: 14, bottom: 26, left: 52 };

const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

/**
 * Variance of one unit staked, under the null that every call is a coin flip
 * at its own break-even rate.
 *
 * A Player bet is +1 or -1, so its variance is exactly 1. A Banker bet pays
 * 0.95, so at its 51.28% break-even it varies slightly less. Blending by how
 * often each side was actually called keeps the band honest for a mixed
 * strategy rather than assuming one or the other.
 */
export const nullVariancePerBet = (bankerFraction = 0.5) => {
    const player = 1;
    const banker = 0.512820 * 0.95 * 0.95 + 0.487180 * 1;
    return bankerFraction * banker + (1 - bankerFraction) * player;
};

const fmtCompact = (n) => {
    if (n === null || n === undefined) return '--';
    const abs = Math.abs(n);
    if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
    return `${Math.round(n)}`;
};

/**
 * Cumulative units staked against bets placed, with a two-sigma null band.
 *
 * Inside the band the result is consistent with having no edge whatsoever.
 * Leaving it and staying out is what a real edge looks like -- and note that a
 * genuine edge grows linearly while the band grows as the square root, so a
 * real effect separates further the longer the run goes. That divergence, not
 * the height of the line, is the thing to look for.
 */
export const EquityChart = ({ curve, bankerFraction = 0.5, sigmas = 2 }) => {
    if (!curve || curve.length < 2) {
        return <p className="sim-empty">Not enough of a run to plot yet.</p>;
    }

    const maxBets = curve[curve.length - 1].bets || 1;
    const variance = nullVariancePerBet(bankerFraction);
    const bandAt = (bets) => sigmas * Math.sqrt(variance * bets);

    // The y-axis has to hold both the walk and the band, or a line that never
    // escapes could still be drawn touching the top of the frame.
    const maxUnits = curve.reduce((m, p) => Math.max(m, Math.abs(p.units)), 0);
    const extent = Math.max(maxUnits, bandAt(maxBets)) * 1.1 || 1;

    const x = (bets) => PAD.left + (bets / maxBets) * plotW;
    const y = (units) => PAD.top + plotH / 2 - (units / extent) * (plotH / 2);

    const upper = curve.map((p) => `${x(p.bets)},${y(bandAt(p.bets))}`);
    const lower = curve.map((p) => `${x(p.bets)},${y(-bandAt(p.bets))}`).reverse();
    const bandPath = `M${upper.join('L')}L${lower.join('L')}Z`;
    const line = curve.map((p) => `${x(p.bets)},${y(p.units)}`).join('L');

    // Which SIDE the walk leaves on decides how it is drawn. Highlighting an
    // escape without its direction would paint a rule set that lost 777 units
    // in the same colour as one that won them.
    const final = curve[curve.length - 1];
    const escaped = Math.abs(final.units) > bandAt(final.bets);
    const direction = !escaped ? '' : final.units > 0 ? 'sim-line-up' : 'sim-line-down';

    return (
        <figure className="sim-chart">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="xMidYMid meet"
                 aria-label={`Cumulative units over ${maxBets} bets, against a ${sigmas}-sigma null band`}>
                <path d={bandPath} className="sim-band" />

                {/* Break-even. The only line that matters. */}
                <line x1={PAD.left} y1={y(0)} x2={W - PAD.right} y2={y(0)} className="sim-axis" />

                <path d={`M${line}`} className={`sim-line ${direction}`} fill="none" />

                <text x={PAD.left - 6} y={y(extent) + 4} className="sim-tick" textAnchor="end">
                    +{fmtCompact(extent)}
                </text>
                <text x={PAD.left - 6} y={y(0) + 4} className="sim-tick" textAnchor="end">0</text>
                <text x={PAD.left - 6} y={y(-extent) + 4} className="sim-tick" textAnchor="end">
                    -{fmtCompact(extent)}
                </text>
                <text x={PAD.left} y={H - 8} className="sim-tick">0</text>
                <text x={W - PAD.right} y={H - 8} className="sim-tick" textAnchor="end">
                    {fmtCompact(maxBets)} bets
                </text>
            </svg>
            <figcaption className="sim-caption">
                Cumulative units staked. The shaded band is where a rule set with
                no edge at all spends {sigmas === 2 ? '95%' : 'most'} of its time.
                {!escaped
                    ? ' This run stays inside it, which is what no edge looks like.'
                    : final.units > 0
                        ? ' This run ends above the band.'
                        : ' This run ends below the band — losing by more than chance explains.'}
            </figcaption>
        </figure>
    );
};

/**
 * Hit rate per rule, each with its interval and its own break-even bar.
 *
 * Every rule gets its own bar because a Banker-calling rule and a
 * Player-calling rule are not held to the same standard: 51% is losing for one
 * and winning for the other.
 */
export const RuleChart = ({ rows }) => {
    if (!rows || rows.length === 0) return <p className="sim-empty">No rule fired.</p>;

    const scored = rows.filter((r) => r.n > 0);
    if (scored.length === 0) return <p className="sim-empty">No rule resolved a bet.</p>;

    // Scaled to the widest interval so the differences are visible; a 45-55
    // axis would render every bar as the same nearly-full block.
    const lo = Math.min(...scored.map((r) => r.low), 0.45);
    const hi = Math.max(...scored.map((r) => r.high), 0.55);
    const span = hi - lo || 1;

    const rowH = 34;
    const height = scored.length * rowH + 26;
    const left = 78;
    const right = 44;
    const barW = W - left - right;

    const px = (rate) => left + ((rate - lo) / span) * barW;

    return (
        <figure className="sim-chart">
            <svg viewBox={`0 0 ${W} ${height}`} role="img" preserveAspectRatio="xMidYMid meet"
                 aria-label="Hit rate by rule with confidence intervals">
                {scored.map((r, i) => {
                    const cy = i * rowH + 18;
                    return (
                        <g key={r.id}>
                            <text x={0} y={cy + 4} className="sim-rule-label">{r.label}</text>

                            {/* The interval, then the estimate, then the bar this
                                particular rule has to clear. */}
                            <line x1={px(r.low)} y1={cy} x2={px(r.high)} y2={cy} className="sim-whisker" />
                            <line x1={px(r.low)} y1={cy - 5} x2={px(r.low)} y2={cy + 5} className="sim-whisker" />
                            <line x1={px(r.high)} y1={cy - 5} x2={px(r.high)} y2={cy + 5} className="sim-whisker" />
                            <circle
                                cx={px(r.rate)} cy={cy} r={4}
                                className={`sim-dot ${r.beatsBreakEven ? 'sim-dot-good' : r.belowBreakEven ? 'sim-dot-bad' : ''}`}
                            />
                            <line
                                x1={px(r.breakEven)} y1={cy - 9} x2={px(r.breakEven)} y2={cy + 9}
                                className="sim-breakeven"
                            />
                            <text x={W - right + 6} y={cy + 4} className="sim-tick">
                                {(r.rate * 100).toFixed(2)}%
                            </text>
                        </g>
                    );
                })}
                <text x={left} y={height - 6} className="sim-tick">{(lo * 100).toFixed(0)}%</text>
                <text x={left + barW} y={height - 6} className="sim-tick" textAnchor="end">
                    {(hi * 100).toFixed(0)}%
                </text>
            </svg>
            <figcaption className="sim-caption">
                Dot is the measured rate, whiskers the 95% interval, upright tick
                the rate that rule must beat to break even. A rule is only ahead
                when its whole interval sits right of its tick.
            </figcaption>
        </figure>
    );
};
