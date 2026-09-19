// src/engine/proposedRules.test.js
//
// Scores candidate rules against already-played hands. Skipped unless
// BACKTEST_DATA points at a /api/games export.
//
// Rules are written as runs of S-column transitions: R = this hand repeated
// the previous one, O = it switched. A pattern of L characters spans L
// transitions and therefore L+1 hands -- the first is not shown in the stated
// example, because the leading character only describes the step into it.

/* eslint-disable no-console */
import fs from 'fs';
import { cardsInOrder, dropDuplicateCards } from './backtest';
import { wilsonInterval, BANKER_BREAKEVEN, PLAYER_BREAKEVEN } from './stats';

const dataPath = process.env.BACKTEST_DATA;
const run = dataPath && fs.existsSync(dataPath) ? describe : describe.skip;

const RULES = [
    { name: 'WienerStrat-3', pattern: 'OORRO',    stated: ['BPPPB', 'PBBBP'] },
    { name: 'WienerStrat-4', pattern: 'OORRRO',   stated: ['BPPPPB', 'PBBBBP'] },
    // Stated as "OORRRO", but the examples show a run of five. Each Strat-N has
    // N-1 R's, so five needs four: OORRRRO. Scored as the examples describe.
    { name: 'WienerStrat-5', pattern: 'OORRRRO',  stated: ['BPPPPPB', 'PBBBBBP'] },
    { name: 'Snake/Box-2',   pattern: 'OOROR',    stated: ['BPPBB', 'PBBPP'] },
    { name: 'Snake/Box-3',   pattern: 'OORRORR',  stated: ['BPPPBBB', 'PBBBPPP'] },
];

const flip = (h) => (h === 'P' ? 'B' : 'P');
const handsFor = (pattern, first) => {
    const out = [first];
    for (let i = 1; i < pattern.length; i++) {
        out.push(pattern[i] === 'R' ? out[out.length - 1] : flip(out[out.length - 1]));
    }
    return out.join('');
};

run('proposed rules', () => {
    const games = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const looksSynthetic = (n) => /test|pattern|wizard|loser|linda|stat\d?\s/i.test(n);
    const { kept } = dropDuplicateCards(cardsInOrder(games).filter((c) => !looksSynthetic(c.name)));
    const totalHands = kept.reduce((n, c) => n + c.hands.length, 0);

    it('decodes to the hand sequences you described', () => {
        console.log('\n' + '='.repeat(78));
        console.log('DECODING CHECK');
        console.log('='.repeat(78));
        RULES.forEach((r) => {
            const b = handsFor(r.pattern, 'B');
            const p = handsFor(r.pattern, 'P');
            const ok = r.stated.includes(b) && r.stated.includes(p);
            console.log(`${r.name.padEnd(16)} "${r.pattern}"  ->  ${b} / ${p}   ${ok ? 'matches' : 'MISMATCH vs ' + r.stated.join(' / ')}`);
        });
        expect(RULES.length).toBe(5);
    });

    it('scores each rule on real hands', () => {
        console.log('\n' + '='.repeat(78));
        console.log(`HOW THEY WOULD HAVE DONE — ${totalHands.toLocaleString()} hands, real play only`);
        console.log('='.repeat(78));
        console.log('rule'.padEnd(16) + 'fires'.padStart(6) + '  ' + 'hit rate (predicting Opposite)'.padStart(31) + '  break-even  clash');
        console.log('-'.repeat(78));

        RULES.forEach((r) => {
            let fired = 0, correct = 0, bankerCalls = 0, clashes = 0;

            kept.forEach(({ hands }) => {
                const T = [];
                for (let i = 1; i < hands.length; i++) T.push(hands[i] === hands[i - 1] ? 'R' : 'O');

                for (let j = 0; j + r.pattern.length <= T.length; j++) {
                    if (T.slice(j, j + r.pattern.length).join('') !== r.pattern) continue;
                    const lastIdx = j + r.pattern.length;      // last hand of the window
                    const nextIdx = lastIdx + 1;
                    if (nextIdx >= hands.length) continue;

                    const call = flip(hands[lastIdx]);
                    fired++;
                    if (call === 'B') bankerCalls++;
                    if (hands[nextIdx] === call) correct++;

                    // Does the existing Rule of Three fire here, and disagree?
                    const a = hands[lastIdx], b = hands[lastIdx - 1], c = hands[lastIdx - 2];
                    if (a === b && b === c && call !== a) clashes++;
                }
            });

            const ci = wilsonInterval(correct, fired);
            const be = fired
                ? (bankerCalls * BANKER_BREAKEVEN + (fired - bankerCalls) * PLAYER_BREAKEVEN) / fired
                : null;
            const shown = fired
                ? `${(ci.estimate * 100).toFixed(1)}%  [${(ci.low * 100).toFixed(1)} – ${(ci.high * 100).toFixed(1)}]`
                : 'never fired';

            console.log(
                r.name.padEnd(16) + String(fired).padStart(6) + '  ' + shown.padStart(31) +
                '  ' + (be ? (be * 100).toFixed(1) + '%' : '  --  ').padStart(9) +
                '  ' + String(clashes).padStart(5)
            );
        });
        console.log('='.repeat(78) + '\n');
        expect(totalHands).toBeGreaterThan(0);
    });

    // All five point estimates landing above break-even looks like a signal.
    // The only way to know is to ask how often five rules of this shape do that
    // on hands with no structure at all. Each card's own hands are shuffled, so
    // its Banker/Player mix and length are preserved exactly and only the ORDER
    // is destroyed -- which is the only thing these rules read.
    it('tests them against shuffled hands', () => {
        const REPLICATES = 500;
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

        // Pooled over all five rules, counting each firing once per rule.
        const score = (cards) => {
            let fired = 0, correct = 0, above = 0;
            RULES.forEach((r) => {
                let f = 0, c = 0;
                cards.forEach(({ hands }) => {
                    const T = [];
                    for (let i = 1; i < hands.length; i++) T.push(hands[i] === hands[i - 1] ? 'R' : 'O');
                    for (let j = 0; j + r.pattern.length <= T.length; j++) {
                        if (T.slice(j, j + r.pattern.length).join('') !== r.pattern) continue;
                        const lastIdx = j + r.pattern.length;
                        if (lastIdx + 1 >= hands.length) continue;
                        f++;
                        if (hands[lastIdx + 1] === flip(hands[lastIdx])) c++;
                    }
                });
                fired += f; correct += c;
                if (f > 0 && c / f > 0.5) above++;
            });
            return { rate: fired ? correct / fired : null, fired, correct, rulesAboveHalf: above };
        };

        const observed = score(kept);

        const rates = [], aboveCounts = [];
        for (let seed = 1; seed <= REPLICATES; seed++) {
            const rnd = mulberry(seed * 104729);
            const r = score(kept.map((c) => ({ name: c.name, hands: shuffle(c.hands, rnd) })));
            if (r.rate !== null) { rates.push(r.rate); aboveCounts.push(r.rulesAboveHalf); }
        }

        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / (rates.length - 1));
        const pRate = (rates.filter((x) => x >= observed.rate).length + 1) / (rates.length + 1);
        const pAll5 = (aboveCounts.filter((x) => x >= observed.rulesAboveHalf).length + 1) / (aboveCounts.length + 1);

        console.log('\n' + '='.repeat(78));
        console.log(`SHUFFLED-ORDER NULL — ${REPLICATES} replicates`);
        console.log('='.repeat(78));
        console.log(`observed      ${(observed.rate * 100).toFixed(1)}% over ${observed.fired} firings, ${observed.rulesAboveHalf}/5 rules above half`);
        console.log(`null          mean ${(mean * 100).toFixed(2)}%   sd ${(sd * 100).toFixed(2)}pp`);
        console.log(`observed is   ${((observed.rate - mean) / sd).toFixed(2)} sd above the null`);
        console.log('');
        console.log(`p (pooled hit rate)        ${pRate.toFixed(4)}`);
        console.log(`p (all five above half)    ${pAll5.toFixed(4)}`);
        console.log('');
        console.log(pRate <= 0.05
            ? '>> The combined rules beat shuffled order.'
            : '>> The combined rules do NOT beat shuffled order.');
        console.log('='.repeat(78) + '\n');

        expect(rates.length).toBeGreaterThan(100);
    });

    // The test that killed the last promising-looking result. A real effect
    // should show up in both halves of the record; one that only appears in
    // one half is a period, not a pattern.
    it('checks whether they hold in both halves of the record', () => {
        const dateOf = (name) => {
            const m = String(name).match(/(\d{2})\/(\d{2})\/(\d{2})$/);
            return m ? new Date(2000 + Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime() : 0;
        };
        const dated = kept.filter((c) => dateOf(c.name) > 0)
                          .sort((a, b) => dateOf(a.name) - dateOf(b.name));
        const half = Math.floor(dated.length / 2);
        const early = dated.slice(0, half);
        const late = dated.slice(half);

        const scoreRule = (cards, r) => {
            let f = 0, c = 0;
            cards.forEach(({ hands }) => {
                const T = [];
                for (let i = 1; i < hands.length; i++) T.push(hands[i] === hands[i - 1] ? 'R' : 'O');
                for (let j = 0; j + r.pattern.length <= T.length; j++) {
                    if (T.slice(j, j + r.pattern.length).join('') !== r.pattern) continue;
                    const lastIdx = j + r.pattern.length;
                    if (lastIdx + 1 >= hands.length) continue;
                    f++;
                    if (hands[lastIdx + 1] === flip(hands[lastIdx])) c++;
                }
            });
            return { f, c };
        };

        console.log('\n' + '='.repeat(78));
        console.log('DOES IT HOLD IN BOTH HALVES?');
        console.log('='.repeat(78));
        console.log(`earlier ${early.length} cards, ${early.reduce((n,c)=>n+c.hands.length,0)} hands   |   later ${late.length} cards, ${late.reduce((n,c)=>n+c.hands.length,0)} hands\n`);
        console.log('rule'.padEnd(16) + 'EARLIER'.padEnd(22) + 'LATER');
        console.log('-'.repeat(78));

        let ef = 0, ec = 0, lf = 0, lc = 0;
        RULES.forEach((r) => {
            const e = scoreRule(early, r);
            const l = scoreRule(late, r);
            ef += e.f; ec += e.c; lf += l.f; lc += l.c;
            const fmt = (x) => (x.f ? `${((x.c / x.f) * 100).toFixed(1)}% (n=${x.f})` : 'never fired');
            console.log(r.name.padEnd(16) + fmt(e).padEnd(22) + fmt(l));
        });
        console.log('-'.repeat(78));
        console.log('POOLED'.padEnd(16) +
            `${ef ? ((ec / ef) * 100).toFixed(1) : '--'}% (n=${ef})`.padEnd(22) +
            `${lf ? ((lc / lf) * 100).toFixed(1) : '--'}% (n=${lf})`);
        console.log('='.repeat(78) + '\n');

        expect(ef + lf).toBeGreaterThan(0);
    });
});
