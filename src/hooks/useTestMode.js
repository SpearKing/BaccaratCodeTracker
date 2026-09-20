// src/hooks/useTestMode.js
//
// Test mode: play hands to try something out without teaching the engine
// anything or moving the numbers.
//
// What it changes:
//   - decisions are logged with mode: 'test', and every reader skips them
//   - the card lives in its own slot, so a real shoe cannot be clobbered
//
// What it deliberately does NOT change: predictions still use the live rule
// records, because the point is to watch the real engine behave.
//
// Test hands are marked rather than dropped. Dropping them would make an
// accidental test session unrecoverable, and the likeliest mistake here is
// forgetting which mode you are in -- which is also why the banner is loud.

import { useState, useEffect } from 'react';

export const TEST_MODE_KEY = 'baccarat_test_mode';

export const useTestMode = () => {
    const [testMode, setTestMode] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(TEST_MODE_KEY) || 'false') === true;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(TEST_MODE_KEY, JSON.stringify(testMode));
        } catch (error) {
            console.error('Could not remember the test-mode setting.', error);
        }
    }, [testMode]);

    return { testMode, setTestMode };
};
