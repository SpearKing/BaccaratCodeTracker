// src/engine/simulate.test.js
//
// "What if I only played these rules?" over already-played hands.
//
//   npm run simulate -- <games.json> [rule,rule,...]
//
// Skipped unless SIM_DATA points at a /api/games export.

/* eslint-disable no-console */
import fs from 'fs';
import { cardsInOrder, dropDuplicateCards } from './backtest';
import { simulateFromCards, needsGrid } from './strategy';
import { summarise, beatsBreakEven } from './stats';
import { RULES, ruleLabel } from './rules';

const dataPath = process.env.SIM_DATA;
const run = dataPath && fs.existsSync(dataPath) ? describe : describe.skip;

const DEFAULT_RULES = ['wiener-3', 'wiener-4', 'wiener-5', 'snake-box-2', 'snake-box-3'];
const chosen = (process.env.SIM_RULES || DEFAULT_RULES.join(',')).split(',').map((r) => r.trim()).filter(Boolean);

const pct = (x) => (x === null || x === undefined ? '  --  ' : `${(x * 100).toFixed(2)}%`);
const ci = (t) => (t.n === 0 ? 'never fired' : `${pct(t.interval.estimate)}  [${pct(t.interval.low)} – ${pct(t.interval.high)}]`);
const ev = (x) => (x === null || x === undefined ? '  --  ' : `${x >= 0 ? '+' : ''}${x.toFixed(4)}`);

const mulberry = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr, rnd) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

run('strategy simulation', () => {
    const games = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const looksSynthetic = (n) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(n);
    const { kept } = dropDuplicateCards(cardsInOrder(games).filter((c) => !looksSynthetic(c.name)));

    if (needsGrid(chosen)) {
        throw new Error('This runner scores rules that read the hand sequence. Remove "pattern" from the rule list.');
    }

    it('scores the chosen rules against playing every hand', () => {
        const hands = kept.reduce((n, c) => n + c.hands.length, 0);
        const sim = simulateFromCards(kept, chosen);
        const everyRule = simulateFromCards(kept, RULES.map((r) => r.id).filter((id) => id !== 'pattern'));
        const everything = everyRule.summary;

        console.log('\n' + '='.repeat(74));
        console.log(`PLAYING ONLY: ${chosen.map(ruleLabel).join(', ')}`);
        console.log('='.repeat(74));
        console.log(`${kept.length} cards, ${hands.toLocaleString()} hands\n`);

        console.log(`bets placed        ${sim.summary.overall.n}  (passed on ${sim.passed.toLocaleString()})`);
        console.log(`you would bet      ${pct(sim.coverage)} of hands\n`);
        console.log(`hit rate           ${ci(sim.summary.overall)}`);
        console.log(`break-even needed  ${pct(sim.summary.overall.breakEven)}`);
        console.log(`per unit staked    ${ev(sim.summary.overall.evPerUnit)}   (${sim.summary.overall.units.toFixed(1)} units)`);
        console.log(`clears break-even? ${beatsBreakEven(sim.summary.overall) ? 'YES' : 'no'}\n`);

        console.log('against the alternatives, same hands:');
        console.log(`   every rule but pattern  ${ci(everything.overall)}   ev ${ev(everything.overall.evPerUnit)}   n=${everything.overall.n}`);
        console.log(`   always Banker           ${ci(everything.baselines.alwaysBanker)}   ev ${ev(everything.baselines.alwaysBanker.evPerUnit)}`);
        console.log(`   always repeat           ${ci(everything.baselines.alwaysRepeat)}   ev ${ev(everything.baselines.alwaysRepeat.evPerUnit)}`);

        console.log('\nrule by rule, within the strategy:');
        RULES.filter((r) => chosen.includes(r.id)).forEach((r) => {
            const rec = sim.records.get(r.id);
            if (!rec) { console.log(`   ${r.label.padEnd(12)} never fired`); return; }
            console.log(`   ${r.label.padEnd(12)} n=${String(rec.n).padStart(4)}   ${((rec.correct / rec.n) * 100).toFixed(1)}%`);
        });
        console.log('='.repeat(74) + '\n');
        expect(sim.decisions).toBeGreaterThan(0);
    });

    it('tests the strategy against shuffled hands', () => {
        const REPLICATES = 200;
        const observed = simulateFromCards(kept, chosen).summary.overall;

        const rates = [];
        for (let seed = 1; seed <= REPLICATES; seed++) {
            const rnd = mulberry(seed * 104729);
            const fake = kept.map((c) => ({ name: c.name, hands: shuffle(c.hands, rnd) }));
            const t = simulateFromCards(fake, chosen).summary.overall;
            if (t.n > 0) rates.push(t.interval.estimate);
        }

        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / (rates.length - 1));
        const p = (rates.filter((x) => x >= observed.interval.estimate).length + 1) / (rates.length + 1);

        console.log('\n' + '='.repeat(74));
        console.log(`SHUFFLED-ORDER NULL — ${REPLICATES} replicates`);
        console.log('='.repeat(74));
        console.log('Each card keeps its exact Banker/Player mix; only the ORDER is destroyed,');
        console.log('which is the only thing these rules read.\n');
        console.log(`observed     ${pct(observed.interval.estimate)} over ${observed.n} bets`);
        console.log(`null         mean ${pct(mean)}   sd ${(sd * 100).toFixed(2)}pp`);
        console.log(`             observed is ${((observed.interval.estimate - mean) / sd).toFixed(2)} sd above`);
        console.log(`p-value      ${p.toFixed(4)}`);
        console.log('='.repeat(74) + '\n');
        expect(rates.length).toBeGreaterThan(100);
    });
});
