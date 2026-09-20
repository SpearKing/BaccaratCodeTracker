// src/hooks/useSimulation.js
//
// Runs a simulation across a pool of workers.
//
// The work splits by shoe, which is the natural unit: shoes are independent of
// each other, so any partition of them is valid and the pieces can be played in
// any order. Each worker gets a contiguous block and its own seed.
//
// Results are merged strictly in block order, never in the order they happen to
// come back. Counters would not care, but the equity curve would: it is a
// running total, and stitching block 3 onto block 1 because it finished first
// would draw a walk that never happened.

import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeResults, finalise } from '../engine/sim';

/** Curve points to aim for across the whole run, regardless of its length. */
const TARGET_SAMPLES = 240;

/**
 * How many workers to use.
 *
 * Capped rather than taken at face value: this runs on a phone at a casino
 * table as often as on a desktop, and saturating every core there makes the
 * interface stutter while achieving nothing, since the cores are usually
 * efficiency ones that will not keep up regardless.
 */
export const workerCount = () => {
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    return Math.max(1, Math.min(8, cores - 1));
};

/** Splits `shoes` into `n` contiguous blocks as evenly as possible. */
export const splitWork = (shoes, n) => {
    const blocks = [];
    const base = Math.floor(shoes / n);
    let remainder = shoes % n;
    let start = 0;

    for (let i = 0; i < n; i++) {
        const size = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        if (size === 0) continue;
        blocks.push({ index: blocks.length, start, shoes: size });
        start += size;
    }
    return blocks;
};

export const useSimulation = () => {
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [elapsed, setElapsed] = useState(null);

    const poolRef = useRef([]);
    const startedRef = useRef(0);

    const teardown = useCallback(() => {
        poolRef.current.forEach((w) => w.terminate());
        poolRef.current = [];
    }, []);

    // A run that outlives its panel is a leaked core. Workers are terminated on
    // unmount whether or not they have finished.
    useEffect(() => teardown, [teardown]);

    const cancel = useCallback(() => {
        teardown();
        setRunning(false);
    }, [teardown]);

    const run = useCallback((config) => {
        teardown();
        setError(null);
        setResult(null);
        setRunning(true);
        setElapsed(null);
        startedRef.current = Date.now();

        const { shoes, seed = 1 } = config;
        const blocks = splitWork(shoes, workerCount());

        setProgress({ done: 0, total: shoes });

        // Sampled often enough to draw a smooth curve and rarely enough that a
        // million-shoe run does not post back a million points.
        const sampleEvery = Math.max(1, Math.floor(shoes / TARGET_SAMPLES));

        const results = new Array(blocks.length).fill(null);
        const perBlockProgress = new Array(blocks.length).fill(0);
        let finished = 0;

        blocks.forEach((block) => {
            let worker;
            try {
                worker = new Worker(new URL('../engine/sim.worker.js', import.meta.url));
            } catch (e) {
                setError('Could not start a worker. Simulation needs a browser that supports Web Workers.');
                setRunning(false);
                teardown();
                return;
            }

            worker.onmessage = (event) => {
                const msg = event.data || {};

                if (msg.type === 'progress') {
                    perBlockProgress[msg.index] = msg.done;
                    setProgress({
                        done: perBlockProgress.reduce((a, b) => a + b, 0),
                        total: shoes,
                    });
                    return;
                }

                if (msg.type === 'error') {
                    setError(msg.message);
                    setRunning(false);
                    teardown();
                    return;
                }

                if (msg.type === 'done') {
                    results[msg.index] = msg.result;
                    perBlockProgress[msg.index] = blocks[msg.index].shoes;
                    finished += 1;

                    setProgress({
                        done: perBlockProgress.reduce((a, b) => a + b, 0),
                        total: shoes,
                    });

                    if (finished === blocks.length) {
                        // In block order, so the stitched curve is the walk that
                        // playing these shoes in sequence would have produced.
                        const merged = results.reduce((acc, r) => mergeResults(acc, r), null);
                        setResult(finalise(merged));
                        setElapsed(Date.now() - startedRef.current);
                        setRunning(false);
                        teardown();
                    }
                }
            };

            worker.onerror = (e) => {
                setError(e.message || 'A simulation worker failed.');
                setRunning(false);
                teardown();
            };

            poolRef.current.push(worker);

            worker.postMessage({
                type: 'run',
                config: {
                    ...config,
                    index: block.index,
                    shoes: block.shoes,
                    // Distinct per block, derived from the run's seed so the
                    // whole run stays reproducible.
                    seed: (seed + block.index * 2654435761) >>> 0,
                    sampleEvery,
                },
            });
        });
    }, [teardown]);

    return { run, cancel, running, progress, result, error, elapsed, workers: workerCount() };
};
