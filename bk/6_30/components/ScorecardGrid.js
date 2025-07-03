// src/components/ScorecardGrid.js
import React from 'react';
import GridCell from './GridCell'; // Import the new GridCell component

const ScorecardGrid = ({ scorecard, handleCellClick, maxRenderableColumns, highlightedCells }) => {
    return (
        <div className="scorecard-grid">
            {/* Header Row */}
            <div className="grid-row header-row">
                <div className="grid-cell header">#</div>
                <div className="grid-cell header">P</div>
                <div className="grid-cell header">B</div>
                <div className="grid-cell header">S</div>
                {/* Render headers only up to maxRenderableColumns */}
                {Array.from({ length: maxRenderableColumns - 3 }).map((_, colIdx) => (
                    <div key={`header-${colIdx + 1}`} className="grid-cell header">{colIdx + 1}</div>
                ))}
            </div>

            {/* Data Rows */}
            {scorecard.map((row, rowIdx) => (
                rowIdx === 0 ? null : ( // Hide the Ref# row (row 0)
                    <div key={rowIdx} className={`grid-row`}>
                        <div className="grid-cell row-number">{rowIdx}</div>
                        {/* Slice the row to only render up to maxRenderableColumns */}
                        {row.slice(0, maxRenderableColumns).map((cell, colIdx) => {
                            const isP = colIdx === 0;
                            const isB = colIdx === 1;
                            const isS = colIdx === 2;
                            const isNumber = colIdx >= 3;
                            const isClickable = (isP || isB);

                            return (
                                <GridCell
                                    key={`${rowIdx}-${colIdx}`}
                                    cell={cell}
                                    rowIdx={rowIdx}
                                    colIdx={colIdx}
                                    isP={isP}
                                    isB={isB}
                                    isS={isS}
                                    isNumber={isNumber}
                                    isClickable={isClickable}
                                    highlightedCells={highlightedCells}
                                    handleCellClick={handleCellClick}
                                />
                            );
                        })}
                    </div>
                )
            ))}
        </div>
    );
};

export default React.memo(ScorecardGrid); // Memoize for performance