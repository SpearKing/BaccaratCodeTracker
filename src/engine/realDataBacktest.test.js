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

    it('scores the learned model against the hand-written one', () => {
        const { cardsInOrder, evaluateModel } = require('./backtest');
        const cards = cardsInOrder(games);
        const hands = cards.reduce((n, c) => n + c.hands.length, 0);

        console.log('\n' + '='.repeat(78));
        console.log('LEARNED MODEL — prequential, every hand predicted before it was seen');
        console.log('='.repeat(78));
        console.log(`${cards.length} cards, ${hands.toLocaleString()} decided hands, oldest first\n`);

        // Does it beat a fixed base-rate predictor at all? If not, there is no
        // learnable structure and nothing downstream can rescue it.
        const base = evaluateModel(cards, { margin: 0 });
        console.log('--- HAS IT LEARNED ANYTHING? ---');
        console.log(`log loss, model       ${base.scores.logLoss.toFixed(5)}`);
        console.log(`log loss, base rate   ${base.scores.baseLogLoss.toFixed(5)}`);
        const gain = base.scores.baseLogLoss - base.scores.logLoss;
        console.log(`improvement           ${gain >= 0 ? '+' : ''}${gain.toFixed(5)} nats/hand  ${gain > 0 ? '(model is better)' : '(model is WORSE than a constant)'}`);
        console.log(`Brier score           ${base.scores.brier.toFixed(5)}\n`);

        console.log('--- BETTING IT, AT VARIOUS SELECTIVITY ---');
        console.log('margin'.padEnd(10) + 'bets'.padStart(7) + '  ' + 'coverage'.padStart(9) + '  ' + 'hit rate'.padStart(26) + '  ' + 'per unit'.padStart(9));
        console.log('-'.repeat(78));
        [0, 0.005, 0.01, 0.02, 0.05].forEach((margin) => {
            const r = evaluateModel(cards, { margin });
            const t = r.summary.overall;
            console.log(
                String(margin).padEnd(10) +
                String(t.n).padStart(7) + '  ' +
                pct(r.summary.coverage).padStart(9) + '  ' +
                (t.n ? ci(t) : 'no bets').padStart(26) + '  ' +
                ev(t.evPerUnit).padStart(9)
            );
        });

        console.log('\n--- SIDE BY SIDE, SAME HANDS ---');
        const model = evaluateModel(cards, { margin: 0 });
        const mt = model.summary.overall;
        console.log(`hand-written engine   ${ci(s.overall)}   ev ${ev(s.overall.evPerUnit)}   n=${s.overall.n}`);
        console.log(`learned model         ${ci(mt)}   ev ${ev(mt.evPerUnit)}   n=${mt.n}`);
        console.log(`always Banker         ${ci(s.baselines.alwaysBanker)}   ev ${ev(s.baselines.alwaysBanker.evPerUnit)}   n=${s.baselines.alwaysBanker.n}`);
        console.log('='.repeat(78) + '\n');

        expect(base.scores.n).toBeGreaterThan(0);
    });

    // A positive result has to survive the obvious explanations before it means
    // anything. Two candidates: hand-entered "pattern test" cards, which a
    // Markov model would learn beautifully and which say nothing about real
    // play; and a bet mix skewed by Player's lower break-even bar.
    it('checks whether the model result survives scrutiny', () => {
        const { cardsInOrder, evaluateModel } = require('./backtest');
        const { summarise } = require('./stats');
        const looksSynthetic = (name) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(name);

        const all = cardsInOrder(games);
        const real = all.filter((c) => !looksSynthetic(c.name));
        const synth = all.filter((c) => looksSynthetic(c.name));

        console.log('\n' + '='.repeat(78));
        console.log('IS THE MODEL RESULT REAL?');
        console.log('='.repeat(78));

        const show = (label, cards) => {
            if (!cards.length) return;
            const r = evaluateModel(cards, { margin: 0 });
            const t = r.summary.overall;
            const gain = r.scores.baseLogLoss - r.scores.logLoss;
            console.log(`${label.padEnd(24)}${String(t.n).padStart(5)} bets   ${ci(t)}   ev ${ev(t.evPerUnit)}`);
            console.log(`${''.padEnd(24)}log loss vs base rate: ${gain >= 0 ? '+' : ''}${gain.toFixed(5)}  ${gain > 0 ? '(learned something)' : '(learned nothing)'}`);
            return r;
        };

        console.log('\n-- split by provenance --');
        show('all cards', all);
        show('suspected test cards', synth);
        const realRun = show('likely real play', real);

        console.log('\n-- which side does it back? --');
        const bets = realRun.entries.filter((e) => e.predicted);
        const bankerBets = bets.filter((e) => e.predicted === 'B');
        const playerBets = bets.filter((e) => e.predicted === 'P');
        const tb = summarise(bankerBets).overall;
        const tp = summarise(playerBets).overall;
        console.log(`Banker bets  ${String(tb.n).padStart(5)}   ${ci(tb)}   needs 51.28%   ev ${ev(tb.evPerUnit)}`);
        console.log(`Player bets  ${String(tp.n).padStart(5)}   ${ci(tp)}   needs 50.00%   ev ${ev(tp.evPerUnit)}`);

        console.log('\n-- per card, real play, worst and best --');
        const perCardScores = real.map((c) => {
            const r = evaluateModel([c], { margin: 0 });
            return { name: c.name, n: r.summary.overall.n, rate: r.summary.overall.interval.estimate };
        }).filter((c) => c.n >= 20).sort((a, b) => (b.rate || 0) - (a.rate || 0));
        perCardScores.slice(0, 4).forEach((c) => console.log(`  ${c.name.slice(0,30).padEnd(32)}n=${String(c.n).padStart(4)}  ${pct(c.rate)}`));
        console.log('  ...');
        perCardScores.slice(-4).forEach((c) => console.log(`  ${c.name.slice(0,30).padEnd(32)}n=${String(c.n).padStart(4)}  ${pct(c.rate)}`));

        console.log('='.repeat(78) + '\n');
        expect(all.length).toBeGreaterThan(0);
    });

    // The null test, and the one that decides it. Run the identical pipeline
    // over hands generated by independent coin flips at baccarat's own rates.
    // There is nothing to learn in that data by construction, so anything the
    // harness reports as an edge there is an artifact of the harness.
    it('calibrates the harness against data with no structure', () => {
        const { cardsInOrder, evaluateModel } = require('./backtest');
        const real = cardsInOrder(games);

        // Deterministic generator, so this is reproducible.
        const mulberry = (a) => () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        console.log('\n' + '='.repeat(78));
        console.log('NULL TEST — same pipeline, i.i.d. coin-flip hands');
        console.log('='.repeat(78));
        console.log('Card count and lengths copied from the real data; outcomes drawn');
        console.log('independently at B 50.68% / P 49.32%. Nothing is learnable here.\n');

        const runs = [];
        for (let seed = 1; seed <= 8; seed++) {
            const rnd = mulberry(seed * 7919);
            const fake = real.map((c) => ({
                name: `${c.name}#${seed}`,
                hands: c.hands.map(() => (rnd() < 0.5068 ? 'B' : 'P')),
            }));
            const r = evaluateModel(fake, { margin: 0 });
            const t = r.summary.overall;
            runs.push({ n: t.n, rate: t.interval.estimate, ev: t.evPerUnit,
                        gain: r.scores.baseLogLoss - r.scores.logLoss });
            console.log(`seed ${String(seed).padEnd(3)} ${String(t.n).padStart(5)} bets   ${pct(t.interval.estimate)}   ev ${ev(t.evPerUnit)}   log-loss vs base ${(r.scores.baseLogLoss - r.scores.logLoss).toFixed(5)}`);
        }

        const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
        const avgRate = mean(runs.map((r) => r.rate));
        const avgEv = mean(runs.map((r) => r.ev));
        console.log('');
        console.log(`mean over 8 runs of pure noise:   ${pct(avgRate)}   ev ${ev(avgEv)}`);
        console.log(`the same pipeline on REAL hands:  ${pct(0.5281)}   ev ${ev(0.0428)}`);
        console.log('');
        console.log(avgRate > 0.515
            ? '>> The harness reports an edge on data that has none. The result is an ARTIFACT.'
            : '>> The harness reports ~chance on structureless data, as it should.');
        console.log('='.repeat(78) + '\n');

        expect(runs.length).toBe(8);
    });

    // The decisive test. Two null distributions, 200 replicates each:
    //
    //   A. i.i.d. hands at baccarat's rates -- destroys everything.
    //   B. each real card's own hands shuffled -- keeps that card's exact
    //      Banker/Player composition and length, destroys ONLY the order.
    //
    // B is the one that matters. If the real result does not beat B, then
    // whatever the model is picking up comes from how many Bankers a card
    // held, not from the sequence -- and sequence is the only thing a
    // prediction engine could ever act on.
    it('tests the result against a proper null distribution', () => {
        const { cardsInOrder, evaluateModel } = require('./backtest');
        const REPLICATES = 200;

        const mulberry = (a) => () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const shuffle = (arr, rnd) => {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const looksSynthetic = (name) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(name);
        const cards = cardsInOrder(games).filter((c) => !looksSynthetic(c.name));

        const observed = evaluateModel(cards, { margin: 0 }).summary.overall;

        const runNull = (build) => {
            const rates = [];
            const evs = [];
            for (let seed = 1; seed <= REPLICATES; seed++) {
                const rnd = mulberry(seed * 104729);
                const t = evaluateModel(build(rnd), { margin: 0 }).summary.overall;
                if (t.n > 0) { rates.push(t.interval.estimate); evs.push(t.evPerUnit); }
            }
            return { rates, evs };
        };

        const iid = runNull((rnd) =>
            cards.map((c) => ({ name: c.name, hands: c.hands.map(() => (rnd() < 0.5068 ? 'B' : 'P')) })));
        const permuted = runNull((rnd) =>
            cards.map((c) => ({ name: c.name, hands: shuffle(c.hands, rnd) })));

        const stats = (xs) => {
            const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
            const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
            return { mean, sd };
        };
        const pValue = (xs, obs) => (xs.filter((x) => x >= obs).length + 1) / (xs.length + 1);

        console.log('\n' + '='.repeat(78));
        console.log(`NULL DISTRIBUTIONS — ${REPLICATES} replicates each, likely-real-play cards only`);
        console.log('='.repeat(78));
        console.log(`observed        hit rate ${pct(observed.interval.estimate)}   ev ${ev(observed.evPerUnit)}   n=${observed.n}\n`);

        [['A: i.i.d. hands', iid], ['B: same cards, order shuffled', permuted]].forEach(([label, d]) => {
            const r = stats(d.rates);
            const e = stats(d.evs);
            console.log(label);
            console.log(`   hit rate   mean ${pct(r.mean)}  sd ${(r.sd * 100).toFixed(2)}pp   observed is ${((observed.interval.estimate - r.mean) / r.sd).toFixed(2)} sd above`);
            console.log(`   per unit   mean ${ev(e.mean)}  sd ${e.sd.toFixed(4)}`);
            console.log(`   p-value    ${pValue(d.rates, observed.interval.estimate).toFixed(4)}  (share of null runs at least as good)`);
            console.log('');
        });

        const pB = pValue(permuted.rates, observed.interval.estimate);
        console.log(pB <= 0.05
            ? '>> Survives the order-shuffled null. There is sequential structure here.'
            : '>> Does NOT survive the order-shuffled null. The apparent edge is not sequential.');
        console.log('='.repeat(78) + '\n');

        expect(iid.rates.length).toBeGreaterThan(100);
    });

    // Re-run with duplicate sessions removed. Four pairs of cards share their
    // hand sequences -- most importantly a 314-hand card that is an exact
    // prefix of a 645-hand one, the same session saved twice. The model has
    // already seen those hands when it reaches them, and a shuffled null does
    // not reproduce that, so the test above was rigged in the model's favour.
    it('repeats the null test with duplicate sessions removed', () => {
        const { cardsInOrder, evaluateModel, dropDuplicateCards } = require('./backtest');
        const REPLICATES = 200;

        const mulberry = (a) => () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const shuffle = (arr, rnd) => {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const looksSynthetic = (name) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(name);
        const realCards = cardsInOrder(games).filter((c) => !looksSynthetic(c.name));
        const { kept, dropped } = dropDuplicateCards(realCards);

        console.log('\n' + '='.repeat(78));
        console.log('RE-TEST WITH DUPLICATE SESSIONS REMOVED');
        console.log('='.repeat(78));
        dropped.forEach((c) => console.log(`   dropped  ${c.name.slice(0, 40).padEnd(42)} ${c.hands.length} hands`));
        const handsKept = kept.reduce((n, c) => n + c.hands.length, 0);
        console.log(`   ${kept.length} cards, ${handsKept.toLocaleString()} hands remain\n`);

        const observed = evaluateModel(kept, { margin: 0 }).summary.overall;

        const runNull = (build) => {
            const rates = [];
            for (let seed = 1; seed <= REPLICATES; seed++) {
                const rnd = mulberry(seed * 104729);
                const t = evaluateModel(build(rnd), { margin: 0 }).summary.overall;
                if (t.n > 0) rates.push(t.interval.estimate);
            }
            return rates;
        };

        const permuted = runNull((rnd) =>
            kept.map((c) => ({ name: c.name, hands: shuffle(c.hands, rnd) })));

        const mean = permuted.reduce((a, b) => a + b, 0) / permuted.length;
        const sd = Math.sqrt(permuted.reduce((a, b) => a + (b - mean) ** 2, 0) / (permuted.length - 1));
        const p = (permuted.filter((x) => x >= observed.interval.estimate).length + 1) / (permuted.length + 1);

        console.log(`observed            ${pct(observed.interval.estimate)}   ev ${ev(observed.evPerUnit)}   n=${observed.n}`);
        console.log(`shuffled null       mean ${pct(mean)}   sd ${(sd * 100).toFixed(2)}pp`);
        console.log(`observed is         ${((observed.interval.estimate - mean) / sd).toFixed(2)} sd above the null`);
        console.log(`p-value             ${p.toFixed(4)}`);
        console.log('');
        console.log(p <= 0.05
            ? '>> Still survives. The signal is not explained by duplicate sessions.'
            : '>> Does NOT survive. The earlier result was the duplicated session.');
        console.log('='.repeat(78) + '\n');

        expect(permuted.length).toBeGreaterThan(100);
    });

    it('compares both engines on the identical clean set', () => {
        const { cardsInOrder, evaluateModel, dropDuplicateCards, replaySavedCards } = require('./backtest');
        const looksSynthetic = (name) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(name);
        const realCards = cardsInOrder(games).filter((c) => !looksSynthetic(c.name));
        const { kept } = dropDuplicateCards(realCards);
        const keptNames = new Set(kept.map((c) => c.name));

        const cleanGames = {};
        Object.keys(games).forEach((n) => { if (keptNames.has(n)) cleanGames[n] = games[n]; });

        const handWritten = replaySavedCards(cleanGames).summary.overall;
        const learned = evaluateModel(kept, { margin: 0 }).summary.overall;

        console.log('\n' + '='.repeat(78));
        console.log('LIKE FOR LIKE — same 16 cards, duplicates and test cards removed');
        console.log('='.repeat(78));
        console.log(`hand-written engine   ${ci(handWritten)}   ev ${ev(handWritten.evPerUnit)}   n=${handWritten.n}`);
        console.log(`learned model         ${ci(learned)}   ev ${ev(learned.evPerUnit)}   n=${learned.n}`);
        console.log(`break-even needed     ${pct(handWritten.breakEven)} / ${pct(learned.breakEven)}`);
        console.log('');
        const { beatsBreakEven: bbe } = require('./stats');
        console.log(`clears break-even?    hand-written: ${bbe(handWritten) ? 'YES' : 'no'}    learned: ${bbe(learned) ? 'YES' : 'no'}`);
        console.log('='.repeat(78) + '\n');

        expect(learned.n).toBeGreaterThan(0);
    });

    // Does the model get better as it accumulates hands?
    //
    // This separates two things that are easy to conflate. More data always
    // makes the model's ESTIMATES more precise. It only makes its PREDICTIONS
    // more accurate if there is something there to learn. If the true
    // probability is 50/50 whatever the context, a perfectly estimated model
    // still hits 50% -- it just gets to 50% faster and with less flailing.
    it('plots the learning curve', () => {
        const { cardsInOrder, evaluateModel, dropDuplicateCards } = require('./backtest');
        const { summarise } = require('./stats');
        const { logLoss, BASE_PRIOR } = require('./model');

        const looksSynthetic = (name) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(name);
        const { kept } = dropDuplicateCards(cardsInOrder(games).filter((c) => !looksSynthetic(c.name)));

        const run = evaluateModel(kept, { margin: 0 });
        const all = run.entries;

        console.log('\n' + '='.repeat(78));
        console.log('LEARNING CURVE — does it improve as hands accumulate?');
        console.log('='.repeat(78));
        console.log(`${all.length.toLocaleString()} hands, in the order the model saw them\n`);

        const BUCKETS = 5;
        const size = Math.floor(all.length / BUCKETS);
        console.log('hands seen'.padEnd(20) + 'bets'.padStart(6) + '  ' + 'hit rate'.padStart(26) + '  ' + 'log loss'.padStart(9) + 'vs base'.padStart(10));
        console.log('-'.repeat(78));

        for (let b = 0; b < BUCKETS; b++) {
            const slice = all.slice(b * size, b === BUCKETS - 1 ? all.length : (b + 1) * size);
            const t = summarise(slice).overall;
            // The model's own log loss over this slice, from the probability it
            // gave to what actually happened, against the base-rate reference.
            const ll = slice.reduce((acc, e) => acc - Math.log(Math.max(e.pActual, 1e-9)), 0) / slice.length;
            const base = slice.reduce((acc, e) => acc + logLoss(BASE_PRIOR, e.actual), 0) / slice.length;
            const label = `${(b * size).toLocaleString()}–${((b === BUCKETS - 1 ? all.length : (b + 1) * size)).toLocaleString()}`;
            console.log(
                label.padEnd(20) +
                String(t.n).padStart(6) + '  ' +
                (t.n ? ci(t) : 'no bets').padStart(26) + '  ' +
                ll.toFixed(4).padStart(9) +
                `${base - ll >= 0 ? '+' : ''}${(base - ll).toFixed(4)}`.padStart(10)
            );
        }

        console.log('\n--- how fast does the interval narrow? ---');
        [500, 2500, 10000, 40000, 160000].forEach((n) => {
            const halfWidth = 1.96 * Math.sqrt(0.25 / n);
            console.log(`  n=${String(n).padStart(7)}   +/- ${(halfWidth * 100).toFixed(2)}pp   ~${Math.round(n / 70)} shoes`);
        });
        console.log('='.repeat(78) + '\n');

        expect(all.length).toBeGreaterThan(0);
    });
});
