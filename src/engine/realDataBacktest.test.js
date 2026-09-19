// src/engine/realDataBacktest.test.js
//
// Runs the backtest over a real export of saved scorecards and prints a report.
// Skipped unless BACKTEST_DATA points at a JSON file in the shape the
// /api/games endpoint returns.
//
//   npm run backtest -- /path/to/games.json
//
// This is analysis, not a regression test: it asserts only that the replay
// produced something. The numbers it prints are the output.

/* eslint-disable no-console */
import fs from 'fs';
import { replaySavedCards } from './backtest';
import { beatsBreakEven } from './stats';

const dataPath = process.env.BACKTEST_DATA;
const run = dataPath && fs.existsSync(dataPath) ? describe : describe.skip;

const pct = (x) => (x === null || x === undefined ? '  --  ' : `${(x * 100).toFixed(2)}%`);
const ci = (t) => (t.n === 0 ? 'no data' : `${pct(t.interval.estimate)}  [${pct(t.interval.low)} – ${pct(t.interval.high)}]`);
const ev = (x) => (x === null || x === undefined ? '  --  ' : `${x >= 0 ? '+' : ''}${x.toFixed(4)}`);

run('backtest over real saved scorecards', () => {
    const games = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const { entries, perCard, summary: s } = replaySavedCards(games);

    it('replayed the saved cards', () => {
        console.log('\n' + '='.repeat(78));
        console.log('BACKTEST — engine replayed over already-played hands');
        console.log('='.repeat(78));
        console.log(`cards replayed      ${perCard.length}`);
        console.log(`decision points     ${s.decisions.toLocaleString()}`);
        console.log(`offered an opinion  ${pct(s.coverage)}`);
        console.log(`resolved bets       ${s.overall.n.toLocaleString()}  (${s.overall.pushes} pushes)`);

        console.log('\n--- THE ENGINE ---');
        console.log(`hit rate            ${ci(s.overall)}`);
        console.log(`break-even needed   ${pct(s.overall.breakEven)}`);
        console.log(`per unit staked     ${ev(s.overall.evPerUnit)}   (${s.overall.units.toFixed(1)} units over ${s.overall.n} bets)`);
        console.log(`record              ${s.overall.correct}W / ${s.overall.wrong}L`);
        console.log(`beats break-even?   ${beatsBreakEven(s.overall) ? 'YES' : 'no'}`);

        console.log('\n--- BASELINES ON THE SAME HANDS ---');
        const rows = [
            ['the engine', s.overall],
            ['always Banker', s.baselines.alwaysBanker],
            ['always Player', s.baselines.alwaysPlayer],
            ['always repeat', s.baselines.alwaysRepeat],
            ['always switch', s.baselines.alwaysSwitch],
        ];
        rows.forEach(([label, t]) =>
            console.log(`${label.padEnd(20)}${ci(t).padEnd(34)}${ev(t.evPerUnit)}   n=${t.n}`)
        );

        console.log('\n--- BY RULE ---');
        [...s.bySource.entries()].filter(([, t]) => t.n > 0).forEach(([src, t]) =>
            console.log(`${String(src).padEnd(28)}n=${String(t.n).padStart(5)}   ${ci(t)}`)
        );

        console.log('\n--- BY C-LEVEL ---');
        [...s.byConfidence.entries()].filter(([, t]) => t.n > 0).forEach(([lvl, t]) =>
            console.log(`C=${String(lvl).padEnd(26)}n=${String(t.n).padStart(5)}   ${ci(t)}`)
        );

        console.log('\n--- BY DRIVING PATTERN ---');
        [...s.byPattern.entries()].filter(([, t]) => t.n > 0).forEach(([p, t]) =>
            console.log(`${String(p).padEnd(28)}n=${String(t.n).padStart(5)}   ${ci(t)}`)
        );

        console.log('\n' + '='.repeat(78) + '\n');

        expect(entries.length).toBeGreaterThan(0);
    });

    // A result found by sifting subgroups is a hypothesis, not a finding. The
    // only honest test is fresh data, so the cards are split by date and the
    // earlier half is used to pick a candidate, the later half to check it.
    it('checks subgroup results out of sample', () => {
        const dateOf = (name) => {
            const m = String(name).match(/(\d{2})\/(\d{2})\/(\d{2})$/);
            if (!m) return 0;
            return new Date(2000 + Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime();
        };
        const dated = perCard
            .map((c) => ({ ...c, t: dateOf(c.name) }))
            .filter((c) => c.t > 0)
            .sort((a, b) => a.t - b.t);

        const half = Math.floor(dated.length / 2);
        const earlyNames = new Set(dated.slice(0, half).map((c) => c.name));
        const lateNames = new Set(dated.slice(half).map((c) => c.name));

        const early = entries.filter((e) => earlyNames.has(e.card));
        const late = entries.filter((e) => lateNames.has(e.card));

        const { summarise } = require('./stats');
        const a = summarise(early);
        const b = summarise(late);

        console.log('\n' + '='.repeat(78));
        console.log('OUT-OF-SAMPLE CHECK — cards split by date');
        console.log('='.repeat(78));
        console.log(`earlier ${earlyNames.size} cards, ${a.overall.n} bets   |   later ${lateNames.size} cards, ${b.overall.n} bets`);

        const line = (label, ta, tb) =>
            console.log(
                label.padEnd(28) +
                (ta.n ? `${pct(ta.interval.estimate)} (n=${ta.n})`.padEnd(22) : 'no data'.padEnd(22)) +
                (tb.n ? `${pct(tb.interval.estimate)} (n=${tb.n})` : 'no data')
            );

        console.log('\n' + 'rule'.padEnd(28) + 'EARLIER'.padEnd(22) + 'LATER');
        console.log('-'.repeat(78));
        line('overall', a.overall, b.overall);
        new Set([...a.bySource.keys(), ...b.bySource.keys()]).forEach((k) => {
            const ta = a.bySource.get(k) || { n: 0 };
            const tb = b.bySource.get(k) || { n: 0 };
            if (ta.n || tb.n) line(String(k), ta, tb);
        });

        console.log('\n' + 'C-Level'.padEnd(28) + 'EARLIER'.padEnd(22) + 'LATER');
        console.log('-'.repeat(78));
        new Set([...a.byConfidence.keys(), ...b.byConfidence.keys()]).forEach((k) => {
            const ta = a.byConfidence.get(k) || { n: 0 };
            const tb = b.byConfidence.get(k) || { n: 0 };
            if (ta.n || tb.n) line(`C=${k}`, ta, tb);
        });
        console.log('='.repeat(78) + '\n');

        expect(a.overall.n + b.overall.n).toBeGreaterThan(0);
    });

    // Some saved cards look like app testing rather than recorded play. If they
    // are hand-entered sequences they are not baccarat outcomes at all, and
    // would quietly distort every figure above.
    it('separates likely test cards from likely real play', () => {
        const looksSynthetic = (name) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(name);
        const { summarise } = require('./stats');

        const synth = entries.filter((e) => looksSynthetic(e.card));
        const real = entries.filter((e) => !looksSynthetic(e.card));
        const a = summarise(synth);
        const b = summarise(real);

        console.log('\n' + '='.repeat(78));
        console.log('DATA PROVENANCE — suspected test cards vs the rest');
        console.log('='.repeat(78));
        console.log('suspected test cards:');
        perCard.filter((c) => looksSynthetic(c.name)).forEach((c) =>
            console.log(`   ${c.name.padEnd(38)} ${String(c.decided).padStart(5)} hands`));
        console.log('');
        console.log(`suspected test   ${String(a.overall.n).padStart(5)} bets   ${pct(a.overall.interval.estimate)}  [${pct(a.overall.interval.low)} – ${pct(a.overall.interval.high)}]   ev ${ev(a.overall.evPerUnit)}`);
        console.log(`likely real play ${String(b.overall.n).padStart(5)} bets   ${pct(b.overall.interval.estimate)}  [${pct(b.overall.interval.low)} – ${pct(b.overall.interval.high)}]   ev ${ev(b.overall.evPerUnit)}`);
        console.log(`   break-even needed on real play: ${pct(b.overall.breakEven)}`);
        console.log('');
        console.log('   real play, by rule:');
        [...b.bySource.entries()].filter(([, t]) => t.n > 0).forEach(([k, t]) =>
            console.log(`   ${String(k).padEnd(28)}n=${String(t.n).padStart(5)}   ${pct(t.interval.estimate)}  [${pct(t.interval.low)} – ${pct(t.interval.high)}]`));
        console.log('');
        console.log('   real play, by C-Level:');
        [...b.byConfidence.entries()].filter(([, t]) => t.n > 0).forEach(([k, t]) =>
            console.log(`   C=${String(k).padEnd(26)}n=${String(t.n).padStart(5)}   ${pct(t.interval.estimate)}  [${pct(t.interval.low)} – ${pct(t.interval.high)}]`));
        console.log('='.repeat(78) + '\n');

        expect(b.overall.n).toBeGreaterThan(0);
    });
});
