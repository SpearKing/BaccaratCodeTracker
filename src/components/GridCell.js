// src/components/GridCell.js
import React from 'react';

const GridCell = ({ cell, rowIdx, colIdx, isP, isB, isS, isT, isNumber, isClickable, highlightedCells, handleCellClick }) => {
    let cellClassName = 'grid-cell';
    if (isP) cellClassName += ' p-column';
    if (isB) cellClassName += ' b-column';
    if (isS) cellClassName += ' s-column'; // Restored for when analytics is on
    if (isT) cellClassName += ' t-column';
    if (isNumber) cellClassName += ' number-column';
    if (isClickable) cellClassName += ' clickable-cell';
    if (cell.displayValue === 'X') cellClassName += ' x-cell';
    if ((isS || isT) && cell.displayValue === 'T') cellClassName += ' tie-cell';

    // T and S read the same stored cell, so they split the job: T owns the tie
    // marker, S owns the R/O transition. A tie has no transition, so S is blank
    // on those rows rather than repeating the T back at you.
    const isTie = cell.displayValue === 'T';
    const shown = isT ? (isTie ? 'T' : '') : (isS && isTie ? '' : cell.displayValue);

    const patternName = isT ? null : highlightedCells.get(`${rowIdx}-${colIdx}`);
    if (patternName) {
        cellClassName += ` analytics-highlight ${patternName}`;
    }

    const cellValue = shown;

    // Restored styling logic for the 'S' column
    const cellStyle = {
        color: isP && cell.value === 'O' ? 'var(--p-color)' :
               (isB && cell.value === 'O' ? 'var(--b-color)' :
               ((isS || isT) && isTie ? 'var(--t-color)' :
               (isS && (cell.displayValue === 'R' || cell.displayValue === 'O') ? 'var(--s-color)' :
               (cell.displayValue === 'X' ? 'var(--x-color)' : 'var(--text-color)')))),
        fontWeight: ((isP || isB) && cell.value === 'O') || (isT && isTie) ? 'bold' : 'normal',
    };

    return (
        <div
            className={cellClassName}
            style={cellStyle}
            onClick={isClickable ? () => handleCellClick(rowIdx, colIdx) : undefined}
        >
            {isClickable ? (
                <span className="o-display">{shown}</span>
            ) : (
                cellValue
            )}
        </div>
    );
};

export default React.memo(GridCell);