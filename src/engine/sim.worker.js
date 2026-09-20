// src/engine/sim.worker.js
//
// One worker runs one disjoint block of shoes.
//
// Each block gets its own seed, so blocks are independent and the whole run is
// still reproducible: the same configuration always splits into the same
// blocks with the same seeds and returns the same answer, however many cores
// happen to be available.
//
// Only counters cross the boundary. A worker that has played ten million hands
// posts back the same few hundred bytes as one that has played ten, which is
// what keeps the main thread responsive while a long run is going.

/* eslint-disable no-restricted-globals */
import { runBatch } from './sim';

self.onmessage = (event) => {
    const { type, config } = event.data || {};
    if (type !== 'run') return;

    try {
        const result = runBatch({
            ...config,
            // Reported on shoe boundaries so the main thread can show honest
            // progress on a run that takes a minute.
            onProgress: (done) => self.postMessage({ type: 'progress', index: config.index, done }),
        });

        self.postMessage({ type: 'done', index: config.index, result });
    } catch (error) {
        self.postMessage({
            type: 'error',
            index: config.index,
            message: error && error.message ? error.message : String(error),
        });
    }
};
