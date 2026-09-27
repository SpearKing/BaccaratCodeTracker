// src/engine/commitment.test.js

import {
    countsToward, progressFor, shouldHide, startCommitment, revealEarly,
    loadCommitment, clearCommitment, DEFAULT_TARGET, DEFAULT_RULES,
} from './commitment';

const C = { arm: 'table', target: 10, setAt: '2026-09-27T00:00:00.000Z', revealedAt: null };
const bet = (at, predicted = 'P', actual = 'P', extra = {}) => ({ at, predicted, actual, ...extra });

beforeEach(() => localStorage.clear());

describe('countsToward', () => {
    it('counts a resolved bet placed after the commitment', () => {
        expect(countsToward(bet('2026-09-28T00:00:00.000Z'), C)).toBe(true);
    });

    it('ignores everything recorded before it', () => {
        // The bets already in hand are what raised the question. Counting them
        // as the answer would use one piece of evidence twice.
        expect(countsToward(bet('2026-09-26T00:00:00.000Z'), C)).toBe(false);
    });

    it('ignores test hands, ties and hands with no call', () => {
        const after = '2026-09-28T00:00:00.000Z';
        expect(countsToward(bet(after, 'P', 'P', { mode: 'test' }), C)).toBe(false);
        expect(countsToward(bet(after, 'P', 'T'), C)).toBe(false);
        expect(countsToward(bet(after, null, 'P'), C)).toBe(false);
    });
});

describe('progressFor', () => {
    const inArm = () => true;
    const entries = [
        bet('2026-09-26T00:00:00.000Z', 'P', 'P'),   // before: ignored
        bet('2026-09-28T00:00:00.000Z', 'P', 'P'),
        bet('2026-09-28T00:00:01.000Z', 'B', 'P'),
        bet('2026-09-28T00:00:02.000Z', 'B', 'B'),
    ];

    it('counts only qualifying bets in the arm', () => {
        const p = progressFor(entries, inArm, C);
        expect(p.bets).toBe(3);
        expect(p.correct).toBe(2);
        expect(p.remaining).toBe(7);
        expect(p.complete).toBe(false);
    });

    it('excludes bets from the other arm', () => {
        const p = progressFor(entries, (e) => e.predicted === 'B', C);
        expect(p.bets).toBe(2);
    });

    it('is complete once the target is reached', () => {
        const many = Array.from({ length: 10 }, (_, i) =>
            bet(`2026-09-28T00:00:${String(i).padStart(2, '0')}.000Z`));
        expect(progressFor(many, inArm, C).complete).toBe(true);
    });

    it('is null with no commitment', () => {
        expect(progressFor(entries, inArm, null)).toBeNull();
    });
});

describe('shouldHide', () => {
    it('hides an unfinished test and shows a finished one', () => {
        expect(shouldHide({ complete: false, revealed: false })).toBe(true);
        expect(shouldHide({ complete: true, revealed: false })).toBe(false);
    });

    it('stops hiding once it has been looked at', () => {
        // Re-hiding after a peek would pretend the peek did not happen.
        expect(shouldHide({ complete: false, revealed: true })).toBe(false);
    });

    it('hides nothing when no test is running', () => {
        expect(shouldHide(null)).toBe(false);
    });
});

describe('storage', () => {
    it('round-trips a commitment', () => {
        const c = startCommitment({ target: 153, now: '2026-09-27T12:00:00.000Z' });
        expect(loadCommitment()).toEqual(c);
        expect(c.target).toBe(153);
    });

    it('defaults to the 60% sample size', () => {
        expect(startCommitment().target).toBe(DEFAULT_TARGET);
    });

    it('records a peek permanently, and only the first one', () => {
        const c = startCommitment({ now: '2026-09-27T12:00:00.000Z' });
        const peeked = revealEarly(c, '2026-09-29T00:00:00.000Z');
        expect(peeked.revealedAt).toBe('2026-09-29T00:00:00.000Z');
        // A second look does not overwrite when the first one happened.
        expect(revealEarly(peeked, '2026-10-01T00:00:00.000Z').revealedAt)
            .toBe('2026-09-29T00:00:00.000Z');
        expect(loadCommitment().revealedAt).toBe('2026-09-29T00:00:00.000Z');
    });

    it('survives rubbish in storage', () => {
        localStorage.setItem('baccarat_commitment', '{not json');
        expect(loadCommitment()).toBeNull();
        localStorage.setItem('baccarat_commitment', JSON.stringify({ nope: true }));
        expect(loadCommitment()).toBeNull();
    });

    it('clears', () => {
        startCommitment();
        clearCommitment();
        expect(loadCommitment()).toBeNull();
    });
});

describe('the rule set under test', () => {
    const withRules = { ...C, rules: ['snake-box-2', 'wiener-3'] };
    const entry = (ids) => ({
        at: '2026-09-28T00:00:00.000Z', predicted: 'P', actual: 'P',
        candidates: ids.map((id) => ({ id, call: 'P' })),
    });

    it('counts a hand only when a rule under test fired', () => {
        expect(countsToward(entry(['snake-box-2']), withRules)).toBe(true);
        expect(countsToward(entry(['wiener-3', 'pattern']), withRules)).toBe(true);
    });

    it('ignores a hand that only other rules fired on', () => {
        // Counting every bet the engine placed would hit the target about three
        // times too early, answering a different question.
        expect(countsToward(entry(['pattern']), withRules)).toBe(false);
        expect(countsToward(entry(['rule-of-three-banker']), withRules)).toBe(false);
        expect(countsToward(entry([]), withRules)).toBe(false);
    });

    it('counts everything when no rule set is named', () => {
        expect(countsToward(entry(['pattern']), C)).toBe(true);
    });

    it('defaults to the five supplied rules', () => {
        expect(startCommitment().rules).toEqual(
            ['wiener-3', 'wiener-4', 'wiener-5', 'snake-box-2', 'snake-box-3']
        );
    });
});
