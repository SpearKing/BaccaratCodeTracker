// src/components/StealthModeView.js
import React, { useState, useEffect } from 'react';
import StealthIcon from './StealthIcon';
import { predictNextHand } from '../engine/predict';

// Reads as "B : 42%" -- back Banker, and hands like this one have come in 42%
// of the time in this player's own log. Below 30 such hands there is no rate
// worth quoting, and it reads "B : —".
//
// The number used to be a raw count of highlighted cells shown as "Low" /
// "Med" / "HIGH". Those labels were never measured, and when they finally were
// they ran backwards: over ~2,500 real hands the loudest level returned 46.80%
// while a quieter one returned 53.98%. What is shown now is the measured rate
// itself, so the number cannot disagree with the outcome it describes. Below
// 30 resolved bets there is nothing to show and the side stands alone.


const StealthModeView = ({
    onExit,
    scorecard,
    lastWinRow,
    lastPlayedRow,
    handleCellClick,
    recordTie,
    highlightedCells,
    calibration,
    testMode,
}) => {
    // Bounded by the last row holding anything, ties included -- not by the
    // last DECIDED row. Using lastWinRow here meant that after a tie the
    // counter under-reported (7 rows on the board, "H: 6" on screen) and the
    // tie row could not be reached at all.
    const [viewRow, setViewRow] = useState(lastPlayedRow);

    useEffect(() => {
        setViewRow(lastPlayedRow);
    }, [lastPlayedRow]);

    const handleNavUp = () => {
        setViewRow(prev => Math.max(prev - 1, 1));
    };

    const handleNavDown = () => {
        setViewRow(prev => Math.min(prev + 1, lastPlayedRow));
    };

    const handleWin = (type) => {
        // Land below whatever was recorded last, ties included.
        const nextRow = lastPlayedRow + 1;
        if (scorecard[nextRow]) {
            const colIdx = type === 'P' ? 0 : 1;
            handleCellClick(nextRow, colIdx);
        } else {
            alert("End of scorecard.");
        }
    };

    // Shares engine/predict.js with the main view. Before this, stealth mode
    // had its own copy that left out the Rule of Three and so disagreed with
    // the main screen on roughly 37% of hands.
    const { prediction, confidence } = predictNextHand(scorecard, highlightedCells, viewRow);
    const measured = calibration?.get(confidence);

    return (
        <div className="stealth-mode-overlay">
            {testMode && <div className="stealth-test-marker">TEST</div>}
            <div className="stealth-exit-button" onClick={onExit}>
                <StealthIcon className="stealth-icon" />
            </div>

            <div className="stealth-main-display">
                <div className="stealth-hand-display">
                    <button onClick={handleNavUp} disabled={viewRow === 1}>
                        <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"></path></svg>
                    </button>
                    <span>H: {viewRow}</span>
                    <button onClick={handleNavDown} disabled={viewRow >= lastPlayedRow}>
                        <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"></path></svg>
                    </button>
                </div>

                <div className="stealth-prediction-display">
                    <span className="prediction-value">{prediction || 'N/A'}</span>
                    {prediction && (
                        measured ? (
                            <span className={`confidence-value${measured.belowBreakEven ? ' confidence-losing' : ''}`}>
                                &nbsp;: {Math.round(measured.rate * 100)}%
                            </span>
                        ) : (
                            // A dash rather than nothing. Showing the side alone
                            // left no way to tell "this level has no record yet"
                            // apart from "this screen does not report one", and
                            // the second would be worth chasing while the first
                            // just needs hands.
                            <span className="confidence-value confidence-unknown">&nbsp;: —</span>
                        )
                    )}
                </div>
            </div>

            <div className="stealth-action-buttons">
                <button className="p-win" onClick={() => handleWin('P')}>P</button>
                <button className="t-win" onClick={recordTie}>T</button>
                <button className="b-win" onClick={() => handleWin('B')}>B</button>
            </div>
        </div>
    );
};

export default StealthModeView;