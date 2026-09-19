// src/engine/model.js
//
// A variable-order Markov model over the hand sequence.
//
// This is the principled version of what the current engine does by hand. That
// engine is an eight-row lookup table on the last three hands, with the eight
// answers chosen by someone rather than measured. This keeps the same idea --
// "what usually follows this recent history?" -- but counts it from data, over
// several context lengths at once, and reports a probability instead of a
// letter.
//
// It answers with the DEEPEST context that has enough observations behind it,
// backing off to shorter ones when a long context is thin:
//
//   p(x | ctx) = (count(ctx, x) + a * prior(x)) / (N(ctx) + a)
//
// Each depth is smoothed toward the prior independently, and only one depth is
// used. An earlier version chained each depth's estimate through the one below
// it, which sounds better and is wrong: a hand appears in the counts at every
// depth, so chaining counts the same evidence repeatedly. Four Bankers in a row
// came out at 97.8% confident. Backing off keeps that at 84%, which is what
// four observations actually support.
//
// This is what stops the model inventing certainty from three observations --
// the failure the hand-written table has no defence against at all.
//
// The base case is baccarat's own rate over decided hands, so with no data at
// all the model predicts Banker 50.68% -- already better than a coin.

/** Baccarat's rate over decided hands, used as the prior at the root. */
export const BASE_PRIOR = { B: 0.5068, P: 0.4932 };

export const DEFAULT_ORDER = 6;
export const DEFAULT_ALPHA = 2;
/** Observations a context needs before it is trusted over a shorter one. */
export const DEFAULT_MIN_COUNT = 12;

export const createModel = ({
    order = DEFAULT_ORDER,
    alpha = DEFAULT_ALPHA,
    minCount = DEFAULT_MIN_COUNT,
    prior = BASE_PRIOR,
} = {}) => ({ order, alpha, minCount, prior, counts: new Map(), observations: 0 });

const keyFor = (depth, context) =>
    `${depth}|${depth === 0 ? '' : context.slice(context.length - depth)}`;

/**
 * Probability of each outcome given the context, interpolated across depths.
 * `context` is the preceding decided hands, oldest first.
 */
export const predict = (model, context) => {
    const usable = Math.min(model.order, context.length);
    const a = model.alpha;

    // Deepest first. The root (depth 0) is always allowed, so there is always
    // an answer once anything has been seen at all.
    for (let depth = usable; depth >= 0; depth--) {
        const node = model.counts.get(keyFor(depth, context));
        if (!node) continue;

        const total = node.B + node.P;
        if (depth > 0 && total < model.minCount) continue;

        return {
            B: (node.B + a * model.prior.B) / (total + a),
            P: (node.P + a * model.prior.P) / (total + a),
        };
    }

    return model.prior;
};

/** The context depth the model actually used, for diagnosis. */
export const depthUsed = (model, context) => {
    const usable = Math.min(model.order, context.length);
    for (let depth = usable; depth >= 0; depth--) {
        const node = model.counts.get(keyFor(depth, context));
        if (!node) continue;
        if (depth > 0 && node.B + node.P < model.minCount) continue;
        return depth;
    }
    return -1;
};

/** Records that `outcome` followed `context`, at every depth. */
export const learn = (model, context, outcome) => {
    if (outcome !== 'B' && outcome !== 'P') return model;

    const usable = Math.min(model.order, context.length);
    for (let depth = 0; depth <= usable; depth++) {
        const key = keyFor(depth, context);
        let node = model.counts.get(key);
        if (!node) {
            node = { B: 0, P: 0 };
            model.counts.set(key, node);
        }
        node[outcome] += 1;
    }
    model.observations += 1;
    return model;
};

/**
 * Turns a distribution into a call, or into no call at all.
 *
 * A side is only worth backing when its probability clears what that side has
 * to hit to break even -- 51.28% for Banker after commission, 50% for Player.
 * `margin` demands that much extra before bothering. This is the abstention the
 * current engine has no notion of: it offers an opinion on 97% of hands.
 */
export const callFor = (dist, { margin = 0, breakEven = { B: 1 / 1.95, P: 0.5 } } = {}) => {
    const edgeB = dist.B - breakEven.B;
    const edgeP = dist.P - breakEven.P;

    if (edgeB <= margin && edgeP <= margin) return { side: null, probability: null, edge: null };
    return edgeB >= edgeP
        ? { side: 'B', probability: dist.B, edge: edgeB }
        : { side: 'P', probability: dist.P, edge: edgeP };
};

/** How surprised the model was by what happened. Lower is better. */
export const logLoss = (dist, actual) => -Math.log(Math.max(dist[actual] ?? 1e-9, 1e-9));

/** Squared error of the probability given to what happened. Lower is better. */
export const brier = (dist, actual) => (1 - (dist[actual] ?? 0)) ** 2;
