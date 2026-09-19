// src/components/StealthModeView.js
import React, { useState, useEffect } from 'react';
import StealthIcon from './StealthIcon';
import { predictNextHand } from '../engine/predict';

// NEW: Helper function to format the C-Level display
const formatConfidence = (level) => {
    if (level <= 2) {
        return `Low (${level})`;
    } else if (level === 3) {
        return `Med (${level})`;
    } else if (level >= 4) {
        return `HIGH (${level})`;
    }
    return `Low (${level})`; // Default case for 0 or unexpected values
};


const StealthModeView = ({
    onExit,
    scorecard,
    lastWinRow,
    lastPlayedRow,
    handleCellClick,
    recordTie,
    highlightedCells,
}) => {
    const [viewRow, setViewRow] = useState(lastWinRow);

    useEffect(() => {
        setViewRow(lastWinRow);
    }, [lastWinRow]);

    const handleNavUp = () => {
        setViewRow(prev => Math.max(prev - 1, 1));
    };

    const handleNavDown = () => {
        setViewRow(prev => Math.min(prev + 1, lastWinRow));
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
    const formattedConfidence = formatConfidence(confidence);

    return (
        <div className="stealth-mode-overlay">
            <div className="stealth-exit-button" onClick={onExit}>
                <StealthIcon className="stealth-icon" />
            </div>

            <div className="stealth-main-display">
                <div className="stealth-hand-display">
                    <button onClick={handleNavUp} disabled={viewRow === 1}>
                        <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"></path></svg>
                    </button>
                    <span>H: {viewRow}</span>
                    <button onClick={handleNavDown} disabled={viewRow === lastWinRow}>
                        <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"></path></svg>
                    </button>
                </div>

                <div className="stealth-prediction-display">
                    <span className="prediction-value">P: {prediction || 'N/A'}</span>
                    <span className="confidence-value">C: {formattedConfidence}</span>
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