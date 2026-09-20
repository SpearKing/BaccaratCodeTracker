// src/engine/rules.js
//
// Every prediction rule, in one list.
//
// Rules used to be `if` statements inside predictNextHand, which meant the
// order they happened to be written in decided every conflict. The Rule of
// Three won whenever it fired -- 37% of hands, contradicting the pattern rule
// on every single one -- not because anyone measured it, but because it came
// first. Here each rule is a peer, and conflicts are settled by track record
// (see arbitrate.js).
//
// A rule sees the whole board and either calls a side or abstains.

import { ANALYTICS_PATTERNS } from '../utils/constants';

/** 'R' where a hand repeated the one before it, 'O' where it switched. */
export const transitionsOf = (hands) => {
    const out = [];
    for (let i = 1; i < hands.length; i++) out.push(hands[i] === hands[i - 1] ? 'R' : 'O');
    return out;
};

const flip = (side) => (side === 'P' ? 'B' : 'P');

/** True when `pattern` matches the most recent transitions. */
export const matchesTrailing = (transitions, pattern) => {
    if (transitions.length < pattern.length) return false;
    return transitions.slice(transitions.length - pattern.length).join('') === pattern;
};

/**
 * A rule written as a run of S-column transitions.
 *
 * A pattern of L characters spans L transitions and so L+1 hands; the first is
 * only context, which is why the stated examples show one fewer hand than the
 * pattern has characters. All of these call the opposite of the last hand.
 */
const transitionRule = (id, pattern, note) => ({
    id,
    pattern,
    note,
    // Longer patterns describe a more specific board, which breaks ties when
    // two rules have equally thin records.
    specificity: pattern.length,
    call: ({ hands }) => {
        if (!matchesTrailing(transitionsOf(hands), pattern)) return null;
        return flip(hands[hands.length - 1]);
    },
});

// --- the original two, unchanged in what they do -----------------------------

const lastDecided = (hands, n) => hands.slice(Math.max(0, hands.length - n));

const ruleOfThree = (id, test, decide, note) => ({
    id,
    pattern: null,
    note,
    specificity: 3,
    call: (ctx) => {
        const last3 = lastDecided(ctx.hands, 3);
        if (last3.length < 3) return null;
        return test(last3, ctx) ? decide(last3) : null;
    },
});

/**
 * The original pattern rule: read the rightmost highlighted column on the
 * anchor row and continue or reverse depending on which way it stepped.
 *
 * Measured, this resolves to "call against the last transition" on every one
 * of 26,800 cases -- but it is kept as written rather than replaced by that
 * shorthand, so its behaviour is the code's and not my summary of it.
 */
const patternRule = {
    id: 'pattern',
    pattern: null,
    note: 'rightmost highlighted column steps up or down',
    specificity: 1,
    call: ({ scorecard, highlights, anchorRow, hands }) => {
        if (!scorecard || !highlights || anchorRow < 1) return null;
        const row = scorecard[anchorRow];
        if (!row) return null;

        let col = -1;
        let name = null;
        for (let c = row.length - 1; c >= 3; c--) {
            if (highlights.has(`${anchorRow}-${c}`)) { col = c; name = highlights.get(`${anchorRow}-${c}`); break; }
        }
        if (col === -1 || name === null) return null;

        const def = ANALYTICS_PATTERNS.find((p) => p.name === name);
        if (!def || !def.isRepeating) return null;

        const n2 = scorecard[anchorRow]?.[col]?.value;
        let n1 = null;
        for (let r = anchorRow - 1; r >= 1; r--) {
            if (highlights.get(`${r}-${col}`) === name) {
                const v = scorecard[r]?.[col]?.value;
                if (typeof v === 'number') { n1 = v; break; }
            }
        }
        if (n1 === null || n2 === null || n2 === undefined) return null;

        const last = hands[hands.length - 1];
        if (n2 - 1 === n1) return last;        // stepped up: repeat
        if (n2 + 1 === n1) return flip(last);  // stepped down: switch
        return null;
    },
};

export const RULES = [
    ruleOfThree(
        'rule-of-three-player',
        (l) => l.every((h) => h === 'P'),
        () => 'P',
        'three Players running'
    ),
    ruleOfThree(
        'rule-of-three-banker',
        (l) => l.every((h) => h === 'B'),
        () => 'B',
        'three Bankers running'
    ),
    ruleOfThree(
        'rule-of-three-alternating',
        (l, ctx) => matchesTrailing(transitionsOf(ctx.hands), 'OOO'),
        (l) => flip(l[l.length - 1]),
        'three switches running'
    ),
    patternRule,

    // Supplied rules. Both families were specified before, and independently
    // of, the hands they were first measured on -- which is what makes that
    // measurement worth anything. See src/engine/proposedRules.test.js.
    transitionRule('wiener-3', 'OORRO', 'run of three, broken once'),
    transitionRule('wiener-4', 'OORRRO', 'run of four, broken once'),
    transitionRule('wiener-5', 'OORRRRO', 'run of five, broken once'),
    transitionRule('snake-box-2', 'OOROR', 'two and two'),
    transitionRule('snake-box-3', 'OORRORR', 'three and three'),
];

export const ruleById = (id) => RULES.find((r) => r.id === id) || null;

/** Every rule that has an opinion on this board. */
export const firingRules = (context) =>
    RULES.map((rule) => ({ rule, call: rule.call(context) }))
        .filter((c) => c.call === 'P' || c.call === 'B');
