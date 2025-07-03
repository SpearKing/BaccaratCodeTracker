// src/components/GridCell.js
import React from 'react';

const GridCell = ({ cell, rowIdx, colIdx, isP, isB, isS, isNumber, isClickable, highlightedCells, handleCellClick }) => {
    let cellClassName = 'grid-cell';
    if (isP) cellClassName += ' p-column';
    if (isB) cellClassName += ' b-column';
    if (isS) cellClassName += ' s-column';
    if (isNumber) cellClassName += ' number-column';
    if (isClickable) cellClassName += ' clickable-cell';
    if (cell.displayValue === 'X') cellClassName += ' x-cell';

    const patternName = highlightedCells.get(`${rowIdx}-${colIdx}`);
    if (patternName) {
        cellClassName += ` analytics-highlight ${patternName}`;
    }

    const cellValue = cell.displayValue;

    const cellStyle = {
        color: isP && cell.value === 'O' ? 'var(--p-color)' :
               (isB && cell.value === 'O' ? 'var(--b-color)' :
               (isS && (cell.displayValue === 'R' || cell.displayValue === 'O') ? 'var(--s-color)' :
               (cell.displayValue === 'X' ? 'var(--x-color)' : 'var(--text-color)'))),
        fontWeight: (isP || isB) && cell.value === 'O' ? 'bold' : 'normal',
    };

    return (
        <div
            className={cellClassName}
            style={cellStyle}
            onClick={isClickable ? () => handleCellClick(rowIdx, colIdx) : undefined}
        >
            {isClickable ? (
                <span className="o-display">{cell.displayValue}</span>
            ) : (
                cellValue
            )}
        </div>
    );
};

export default React.memo(GridCell); // Memoize for performance