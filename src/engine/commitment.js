// src/engine/commitment.js
//
// A test declared before the data is collected.
//
// Everything measured so far shares one weakness: the question was chosen after
// looking at the answers. "Do these rules work at physical tables?" came from
// noticing that physical tables looked good, which is the same evidence, not
// new evidence. A pre-registered test fixes the question, the sample size and
// the decision rule first, so the result means what it appears to mean.
//
// The part that does the work is hiding the running rate. A rate that can be
// watched will be stopped on. Simulated over 20,000 runs of a rule set with
// ZERO edge: checking once at 153 bets called it a winner 5.6% of the time --
// the 5% you signed up for -- while checking after every shoe and stopping when
// it looked good called it a winner 16.6% of the time, typically declaring
// victory around bet 54. Nothing about the rules differed. Only when you looked.
//
// Looking early is still allowed, because this is a tool and not a warden. It
// is recorded when it happens, because a test that was peeked at is a different
// test and the record should say so.

export const COMMITMENT_KEY = 'baccarat_commitment';

/** Bets needed to confirm a 60% edge at 80% power -- see stats.requiredSampleSize. */
export const DEFAULT_TARGET = 153;

/**
 * The rule set under test.
 *
 * The question is about Wiener and Snake specifically, so the count has to be
 * of hands where one of THOSE fired -- not of every hand the engine had an
 * opinion on. Counting all of them would reach the target roughly three times
 * too early, on a different question from the one asked.
 */
export const DEFAULT_RULES = ['wiener-3', 'wiener-4', 'wiener-5', 'snake-box-2', 'snake-box-3'];

/** True when one of the rules under test fired on this hand. */
export const firedForTest = (entry, ruleIds) => {
    if (!ruleIds || ruleIds.length === 0) return true;
    const allowed = new Set(ruleIds);
    return (entry.candidates || []).some((c) => allowed.has(c.id) && (c.call === 'P' || c.call === 'B'));
};

/**
 * Only decisions recorded AFTER the commitment count.
 *
 * The bets already in hand are what raised the question, so counting them as
 * the answer would be using one piece of evidence twice.
 */
export const countsToward = (entry, commitment) => {
    if (!commitment || !entry) return false;
    if (entry.mode === 'test') return false;
    if (!entry.predicted) return false;                 // no call, no bet
    if (entry.actual !== 'P' && entry.actual !== 'B') return false;  // a tie pushes
    if (!entry.at || entry.at < commitment.setAt) return false;
    if (!firedForTest(entry, commitment.rules)) return false;
    return true;
};

/** Progress against a commitment: how many qualifying bets, and whether it is done. */
export const progressFor = (entries, isInArm, commitment) => {
    if (!commitment) return null;

    let bets = 0;
    let correct = 0;
    (entries || []).forEach((e) => {
        if (!countsToward(e, commitment)) return;
        if (!isInArm(e)) return;
        bets += 1;
        if (e.predicted === e.actual) correct += 1;
    });

    return {
        bets,
        correct,
        target: commitment.target,
        remaining: Math.max(0, commitment.target - bets),
        complete: bets >= commitment.target,
        // Revealed early, or reached honestly. Both show the number; only one
        // of them supports a conclusion.
        revealed: Boolean(commitment.revealedAt),
        setAt: commitment.setAt,
        revealedAt: commitment.revealedAt || null,
        arm: commitment.arm,
    };
};

/** True when the result should stay hidden: committed, not finished, not peeked at. */
export const shouldHide = (progress) =>
    Boolean(progress) && !progress.complete && !progress.revealed;

export const loadCommitment = () => {
    try {
        const raw = localStorage.getItem(COMMITMENT_KEY);
        if (!raw) return null;
        const c = JSON.parse(raw);
        if (!c || !c.setAt || !Number.isFinite(c.target)) return null;
        return c;
    } catch (error) {
        console.error('Could not read the pre-registered test; ignoring it.', error);
        return null;
    }
};

export const saveCommitment = (commitment) => {
    try {
        localStorage.setItem(COMMITMENT_KEY, JSON.stringify(commitment));
        return true;
    } catch (error) {
        console.error('Could not store the pre-registered test.', error);
        return false;
    }
};

export const startCommitment = ({ target = DEFAULT_TARGET, arm = 'table', rules = DEFAULT_RULES, now } = {}) => {
    const commitment = {
        arm,
        target,
        rules,
        setAt: now || new Date().toISOString(),
        revealedAt: null,
    };
    saveCommitment(commitment);
    return commitment;
};

/** Records that the result was looked at before the sample was complete. */
export const revealEarly = (commitment, now) => {
    if (!commitment || commitment.revealedAt) return commitment;
    const next = { ...commitment, revealedAt: now || new Date().toISOString() };
    saveCommitment(next);
    return next;
};

export const clearCommitment = () => {
    try {
        localStorage.removeItem(COMMITMENT_KEY);
    } catch (error) {
        console.error('Could not clear the pre-registered test.', error);
    }
};
