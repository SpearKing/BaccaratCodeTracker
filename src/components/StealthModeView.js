// src/components/StealthModeView.js
import React, { useState, useEffect } from 'react';
import StealthIcon from './StealthIcon';

// This is a simplified, standalone version of the prediction logic
// designed to get a prediction for any given historical row.
const getPredictionForStealthRow = (scorecard, highlightedCells, rowNumber) => {
    if (rowNumber < 1 || !scorecard[rowNumber]) {
        return { prediction: null, confidence: 0 };
    }

    const currentRow = scorecard[rowNumber];
    let lastHighlightedCol = -1;
    let patternName = null;

    for (let colIdx = currentRow.length - 1; colIdx >= 3; colIdx--) {
        const cellKey = `${rowNumber}-${colIdx}`;
        if (highlightedCells.has(cellKey)) {
            lastHighlightedCol = colIdx;
            patternName = highlightedCells.get(cellKey);
            break;
        }
    }

    if (lastHighlightedCol === -1) {
        return { prediction: null, confidence: 0 };
    }
    
    let n1_value = null;
    const n2_value = scorecard[rowNumber]?.[lastHighlightedCol]?.value;

    for (let row = rowNumber - 1; row >= 1; row--) {
        const cellKey = `${row}-${lastHighlightedCol}`;
        if (highlightedCells.get(cellKey) === patternName) {
            n1_value = scorecard[row]?.[lastHighlightedCol]?.value;
            break;
        }
    }

    let isNextRepeater = null;
    let isNextOpposite = null;

    if (n1_value !== null && n2_value !== null) {
        if (n2_value - 1 === n1_value) isNextRepeater = true;
        else if (n2_value + 1 === n1_value) isNextOpposite = true;
    }

    const lastWinType = scorecard[rowNumber][0].value === 'O' ? 'P' : 'B';
    let prediction = null;

    if (lastWinType === 'P') {
        prediction = isNextRepeater ? 'P' : (isNextOpposite ? 'B' : null);
    } else if (lastWinType === 'B') {
        prediction = isNextRepeater ? 'B' : (isNextOpposite ? 'P' : null);
    }
    
    let confidence = 0;
    for (let col = 3; col < currentRow.length; col++) {
        if (highlightedCells.has(`${rowNumber}-${col}`)) {
            confidence++;
        }
    }

    return { prediction, confidence };
};

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
    handleCellClick,
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
        const nextRow = lastWinRow + 1;
        if (scorecard[nextRow]) {
            const colIdx = type === 'P' ? 0 : 1;
            handleCellClick(nextRow, colIdx);
        } else {
            alert("End of scorecard.");
        }
    };

    const { prediction, confidence } = getPredictionForStealthRow(scorecard, highlightedCells, viewRow);
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
                <button className="b-win" onClick={() => handleWin('B')}>B</button>
            </div>
        </div>
    );
};

export default StealthModeView;