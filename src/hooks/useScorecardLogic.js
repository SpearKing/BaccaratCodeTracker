// src/hooks/useScorecardLogic.js
import { useState, useCallback, useMemo, useEffect } from 'react';
import { NUM_INITIAL_COLUMNS } from '../utils/constants';
import { createInitialScorecard, calculateSingleRow, deriveGrid, handsFromGrid, isDecided, TIE } from '../engine/grid';
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

    // A sitting holds several shoes. The board shows one of them, and the
    // ACTIVE shoe lives only in `scorecard` -- `shoes` holds the others and a
    // stale copy of the active one. Keeping a second live copy of the hands on
    // screen is how the grid and the log came to disagree once already, so
    // `allShoes()` below is the single place the two are reconciled.
    //
    // This is also the boundary fix: the rules read transition history, and
    // because the board only ever contains one shoe, they cannot see across a
    // boundary. Before this, a long sitting was one continuous card and 6.3%
    // of bets came from patterns straddling two unrelated shoes.
    const [shoes, setShoes] = useState([[]]);
    const [activeShoe, setActiveShoe] = useState(0);
    /**
     * Which mode's card the state currently reflects, or null before the
     * device has been read.
     *
     * This is state rather than a ref on purpose. A ref set inside the restore
     * effect flips to true SYNCHRONOUSLY, so the save effect on the same commit
     * saw "restored" while the board was still blank and wrote an empty card
     * over the stored one. Under StrictMode's double invocation the second pass
     * then read that empty card back and found nothing to restore, so a reload
     * lost the session. Batched with the restored data, the save effect cannot
     * run until the board actually holds it.
     *
     * It also guards the mode switch: until the new mode's card has been read,
     * nothing is written, so the live card can never be saved into the test
     * slot or the other way round.
     */
    const [restoredMode, setRestoredMode] = useState(null);
    const [restoredFromLocal, setRestoredFromLocal] = useState(false);

    // Restore whatever this device was in the middle of. The old version read
    // a localStorage key that nothing had written since scorecards moved to the
    // server, so it never fired and every reload came back to a blank card.
    useEffect(() => {
        const local = loadLocalCard(testMode);

        if (!local) {
            // Nothing stored for this mode. On the first run that means the
            // server fallback should take over; on a mode switch it means the
            // board must clear, because leaving the other mode's card up is how
            // you end up playing test hands onto a live shoe.
            setScorecard(createInitialScorecard());
            setLastWinType(null);
            setLastWinRow(-1);
            setShoes([[]]);
            setActiveShoe(0);
            setRestoredMode(testMode);
            return;
        }

        setRestoredFromLocal(true);
        const index = Math.min(local.activeShoe ?? 0, local.shoes.length - 1);
        setShoes(local.shoes);
        setActiveShoe(index);
        const restored = stateFromHands(local.shoes[index] || []);
        setScorecard(restored.scorecard);
        setLastWinType(restored.lastWinType);
        setLastWinRow(restored.lastWinRow);
        setRestoredMode(testMode);
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
    /**
     * Every shoe in the sitting, with the one on the board brought up to date.
     *
     * The active shoe is read off the grid rather than from `shoes`, so there
     * is never a moment where the two could disagree about what was played.
     */
    const allShoes = useCallback(() => {
        const out = shoes.slice();
        out[activeShoe] = handsFromGrid(scorecard);
        return out;
    }, [shoes, activeShoe, scorecard]);

    useEffect(() => {
        // Never overwrite a stored card with state that has not been restored
        // into yet -- see the note on restoredMode above.
        if (restoredMode !== testMode) return;
        saveLocalCard(allShoes(), cardName, testMode, activeShoe);
    }, [restoredMode, allShoes, cardName, testMode, activeShoe]);


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
            shoe: activeShoe,
            mode: testMode ? 'test' : undefined,
        }));
    }, [onDecision, getPrediction, testMode, activeShoe]);
    
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
    
    const resetScorecard = useCallback(() => {
        setScorecard(createInitialScorecard());
        setLastWinType(null);
        setLastWinRow(-1);
        setShoes([[]]);
        setActiveShoe(0);
    }, []);

    /** Puts one shoe's hands on the board. */
    const showShoe = useCallback((hands) => {
        const restored = stateFromHands(hands || []);
        setScorecard(restored.scorecard);
        setLastWinType(restored.lastWinType);
        setLastWinRow(restored.lastWinRow);
    }, []);

    /** Replaces the whole sitting -- used by Load and the server fallback. */
    const loadShoes = useCallback((incoming) => {
        const next = (incoming && incoming.length) ? incoming : [[]];
        setShoes(next);
        setActiveShoe(next.length - 1);   // resume on the shoe you were last in
        showShoe(next[next.length - 1]);
    }, [showShoe]);

    /** Kept for callers that still hand over a single flat run. */
    const loadHands = useCallback((hands) => loadShoes([hands || []]), [loadShoes]);

    /** Switches the board to another shoe in this sitting. */
    const selectShoe = useCallback((index) => {
        if (index === activeShoe) return;
        const committed = allShoes();
        if (index < 0 || index >= committed.length) return;
        setShoes(committed);
        setActiveShoe(index);
        showShoe(committed[index]);
    }, [activeShoe, allShoes, showShoe]);

    /**
     * Starts a new shoe in the same sitting.
     *
     * The board clears, so the rules start again with no history -- which is
     * the point. A new shoe shares nothing with the one before it.
     */
    const addShoe = useCallback(() => {
        const committed = allShoes();
        const next = [...committed, []];
        setShoes(next);
        setActiveShoe(next.length - 1);
        showShoe([]);
    }, [allShoes, showShoe]);

    /** Removes a shoe from the sitting. The last one is emptied, not removed. */
    const deleteShoe = useCallback((index) => {
        const committed = allShoes();
        if (index < 0 || index >= committed.length) return;
        if (committed.length === 1) {
            setShoes([[]]);
            setActiveShoe(0);
            showShoe([]);
            return;
        }
        const next = committed.filter((_, i) => i !== index);
        const moved = Math.min(activeShoe > index ? activeShoe - 1 : activeShoe, next.length - 1);
        setShoes(next);
        setActiveShoe(moved);
        showShoe(next[moved]);
    }, [allShoes, activeShoe, showShoe]);

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
     * Records a tie on a specific row.
     *
     * A tie is not a result: it takes a row so hand numbers stay truthful, but
     * it leaves the running counts and the prediction anchor untouched.
     *
     * Clicking T on a row that already holds a Player or Banker win replaces it,
     * which is an edit rather than a prediction -- so it is not logged, and the
     * anchor has to be recomputed because the hand it pointed at may be the one
     * that just became a tie.
     */
    const recordTieAt = useCallback((rowIdx) => {
        if (rowIdx < 1 || rowIdx >= scorecard.length) return;

        const hands = handsFromGrid(scorecard);
        const isForwardPlay = rowIdx === hands.length + 1;

        const next = [...hands];
        // Clicking below the last played row leaves the rows between as gaps,
        // which deriveGrid skips -- the same thing clicking P or B there does.
        while (next.length < rowIdx) next.push(null);
        next[rowIdx - 1] = TIE;

        setScorecard(deriveGrid(next, scorecard.length - 1));

        let newLastRow = -1;
        for (let i = next.length - 1; i >= 0; i--) {
            if (isDecided(next[i])) { newLastRow = i + 1; break; }
        }
        setLastWinRow(newLastRow);
        setLastWinType(newLastRow === -1 ? null : next[newLastRow - 1]);

        // A tie played forward is still a decision point: the engine had an
        // opinion and the hand pushed. Leaving it out would overstate coverage.
        if (isForwardPlay) logDecision(rowIdx, TIE, next);
    }, [scorecard, logDecision]);

    /** The Tie button: a tie on the next free row. */
    const recordTie = useCallback(
        () => recordTieAt(handsFromGrid(scorecard).length + 1),
        [recordTieAt, scorecard]
    );

    return {
        scorecard, lastWinType, lastWinRow, lastPlayedRow,
        handleCellClick, resetScorecard, deleteRow, recordTie, recordTieAt,
        loadHands, loadShoes, restoredFromLocal, maxRenderableColumns,
        shoes, activeShoe, shoeCount: shoes.length, allShoes, selectShoe, addShoe, deleteShoe,
    };
};