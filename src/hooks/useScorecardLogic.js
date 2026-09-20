// src/hooks/useScorecardLogic.js
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { NUM_INITIAL_COLUMNS } from '../utils/constants';
import { createInitialScorecard, calculateSingleRow, deriveGrid, handsFromGrid, TIE } from '../engine/grid';
import { makeEntry } from '../engine/decisionLog';
import { stateFromHands } from '../engine/cardFormat';
import { saveLocalCard, loadLocalCard } from './useLocalCard';

/**
 * Grid state and the actions that change it.
 *
 * This hook deliberately does NOT compute the prediction or the analytics
 * highlights. It used to, via its own useAnalytics instance -- and because that
 * instance held its own copy of the analytics toggle, flipping the switch never
 * reached it. The screen would show a pattern prediction while the log quietly
 * recorded a Rule-of-Three one, until the next page reload. Same failure as the
 * stealth-mode copy: duplicated state, silently diverging.
 *
 * `getPrediction` is supplied by the caller, which owns the single analytics
 * instance. It is read at the moment a hand is recorded, so the log stores what
 * was genuinely on screen beforehand.
 */
export const useScorecardLogic = (onDecision, getPrediction, cardName, testMode = false) => {
    const [scorecard, setScorecard] = useState(createInitialScorecard);
    const [lastWinType, setLastWinType] = useState(null);
    const [lastWinRow, setLastWinRow] = useState(-1);
    const hasRestored = useRef(false);
    const [restoredFromLocal, setRestoredFromLocal] = useState(false);

    // Restore whatever this device was in the middle of. The old version read
    // a localStorage key that nothing had written since scorecards moved to the
    // server, so it never fired and every reload came back to a blank card.
    useEffect(() => {
        const local = loadLocalCard(testMode);
        hasRestored.current = true;

        if (!local) {
            // Nothing stored for this mode. On the first run that means the
            // server fallback should take over; on a mode switch it means the
            // board must clear, because leaving the other mode's card up is how
            // you end up playing test hands onto a live shoe.
            setScorecard(createInitialScorecard());
            setLastWinType(null);
            setLastWinRow(-1);
            return;
        }

        setRestoredFromLocal(true);
        const restored = stateFromHands(local.hands);
        setScorecard(restored.scorecard);
        setLastWinType(restored.lastWinType);
        setLastWinRow(restored.lastWinRow);
        // Re-runs when the mode changes, which is what swaps the board between
        // the live card and the test card.
    }, [testMode]);

    const maxRenderableColumns = useMemo(() => { let maxContentColIndex = 3 + NUM_INITIAL_COLUMNS - 1; if (scorecard) { scorecard.forEach(row => { for (let i = 3; i < row.length; i++) { if (row[i].displayValue !== '' || row[i].value !== null) { maxContentColIndex = Math.max(maxContentColIndex, i); } } }); } return maxContentColIndex + 1; }, [scorecard]);
    
    // The last row holding anything at all, ties included. lastWinRow tracks
    // the last DECIDED row, which is what predictions anchor to; a tie must not
    // move it, but the next hand still has to land below the tie.
    const lastPlayedRow = useMemo(() => handsFromGrid(scorecard).length, [scorecard]);

    // Written on every change rather than on a timer. The 1.5s debounce on the
    // old server autosave existed because that was a network call; this is a
    // few hundred bytes to localStorage.
    useEffect(() => {
        if (!hasRestored.current) return;   // don't overwrite a restore with the blank initial state
        saveLocalCard(handsFromGrid(scorecard), cardName, testMode);
    }, [scorecard, cardName, testMode]);


    /**
     * Records a decision, but only for forward play.
     *
     * Re-clicking a hand that was already recorded is an edit, not a
     * prediction: the outcome was already known when it was made. Logging it
     * would quietly inflate the record with hindsight.
     */
    const logDecision = useCallback((rowIdx, actual, handsAfter) => {
        if (!onDecision) return;
        onDecision(makeEntry({
            handIndex: rowIdx,
            prediction: getPrediction ? getPrediction() : null,
            actual,
            hands: handsAfter,
            mode: testMode ? 'test' : undefined,
        }));
    }, [onDecision, getPrediction, testMode]);
    
    const handleCellClick = useCallback((rowIdx, colIdx) => {
        if (rowIdx === 0) return;

        const newActualWinType = colIdx === 0 ? 'P' : 'B';
        const isForwardPlay = rowIdx === lastPlayedRow + 1;

        const currentScorecardCopy = JSON.parse(JSON.stringify(scorecard));
        // The running counts continue from the nearest DECIDED row, stepping
        // over any ties in between.
        let prevWinTypeForCalc = null;
        let parentRowIdx = 0;
        for (let r = rowIdx - 1; r >= 1; r--) { if (currentScorecardCopy[r][0].value === 'O') { prevWinTypeForCalc = 'P'; parentRowIdx = r; break; } else if (currentScorecardCopy[r][1].value === 'O') { prevWinTypeForCalc = 'B'; parentRowIdx = r; break; } }
        currentScorecardCopy[rowIdx][0] = { ...currentScorecardCopy[rowIdx][0], value: '', displayValue: '' };
        currentScorecardCopy[rowIdx][1] = { ...currentScorecardCopy[rowIdx][1], value: '', displayValue: '' };
        currentScorecardCopy[rowIdx][colIdx] = { ...currentScorecardCopy[rowIdx][colIdx], value: 'O', displayValue: 'O' };
        
        let finalScorecard = calculateSingleRow(currentScorecardCopy, rowIdx, newActualWinType, prevWinTypeForCalc, parentRowIdx);
        setScorecard(finalScorecard);
        setLastWinType(newActualWinType);
        setLastWinRow(rowIdx);

        if (isForwardPlay) {
            logDecision(rowIdx, newActualWinType, [...handsFromGrid(scorecard), newActualWinType]);
        }
    }, [scorecard, lastPlayedRow, logDecision]);
    
    const resetScorecard = useCallback(() => { setScorecard(createInitialScorecard()); setLastWinType(null); setLastWinRow(-1); }, []);

    /** Replaces the board with a card's hands -- used by Load and the server fallback. */
    const loadHands = useCallback((hands) => {
        const restored = stateFromHands(hands || []);
        setScorecard(restored.scorecard);
        setLastWinType(restored.lastWinType);
        setLastWinRow(restored.lastWinRow);
    }, []);

    /**
     * Removes a hand and rebuilds the grid from the hands that remain.
     *
     * Every number on the grid is derived from the row above it, so a row
     * cannot simply be spliced out -- doing that leaves every row below it
     * doing arithmetic against the wrong parent. The only correct way to edit
     * history is to replay it, which is what deriveGrid is for.
     */
    const deleteRow = useCallback((rowIdx) => {
        const hands = handsFromGrid(scorecard);
        if (rowIdx < 1 || rowIdx > hands.length) return;

        const remaining = hands.filter((_, i) => i !== rowIdx - 1);

        // Keep the grid the same height; the old implementation shrank it by
        // one row on every delete.
        const rebuilt = deriveGrid(remaining, scorecard.length - 1);

        // The last played row moved up, so the prediction anchor must too.
        let newLastRow = -1;
        for (let i = remaining.length - 1; i >= 0; i--) {
            if (remaining[i]) { newLastRow = i + 1; break; }
        }

        setScorecard(rebuilt);
        setLastWinRow(newLastRow);
        setLastWinType(newLastRow === -1 ? null : remaining[newLastRow - 1]);
    }, [scorecard]);

    /**
     * Records a tie on the next free row.
     *
     * A tie is not a result: it takes a row so hand numbers stay truthful, but
     * it leaves the running counts and the prediction anchor untouched.
     */
    const recordTie = useCallback(() => {
        const hands = handsFromGrid(scorecard);
        const next = [...hands, TIE];
        if (next.length >= scorecard.length) return;
        setScorecard(deriveGrid(next, scorecard.length - 1));

        // A tie is still a decision point: the engine had an opinion and the
        // hand pushed. Leaving it out would overstate coverage.
        logDecision(next.length, TIE, next);
    }, [scorecard, logDecision]);

    return { scorecard, lastWinType, lastWinRow, lastPlayedRow, handleCellClick, resetScorecard, deleteRow, recordTie, loadHands, restoredFromLocal, maxRenderableColumns };
};