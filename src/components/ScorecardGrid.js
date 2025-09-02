// src/components/ScorecardGrid.js
import React from 'react';
import GridCell from './GridCell';

const ScorecardGrid = ({ scorecard, handleCellClick, maxRenderableColumns, highlightedCells, showAnalytics, handleDeleteRow }) => {
    const handleRightClick = (e, rowIdx) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to delete row ${rowIdx}?`)) {
            handleDeleteRow(rowIdx);
        }
    };

    return (
        <div className="scorecard-grid">
            {/* Header Row */}
            <div className="grid-row header-row">
                <div className="grid-cell header header-pound sticky-col">#</div>
                <div className="grid-cell header">P</div>
                <div className="grid-cell header">B</div>
                {/* Conditionally render 'S' column header */}
                {showAnalytics && <div className="grid-cell header">S</div>}
                
                {Array.from({ length: maxRenderableColumns - 3 }).map((_, colIdx) => (
                    <div key={`header-${colIdx + 1}`} className="grid-cell header">{colIdx + 1}</div>
                ))}
            </div>

            {/* Data Rows */}
            {scorecard.map((row, rowIdx) => (
                rowIdx === 0 ? null : (
                    <div key={rowIdx} className={`grid-row`}>
                        <div 
                            className="grid-cell row-number sticky-col"
                            onContextMenu={(e) => handleRightClick(e, rowIdx)}
                        >
                            {rowIdx}
                        </div>
                        
                        {row.slice(0, maxRenderableColumns).map((cell, colIdx) => {
                            const isP = colIdx === 0;
                            const isB = colIdx === 1;
                            const isS = colIdx === 2;
                            const isNumber = colIdx >= 3;
                            const isClickable = (isP || isB);

                            // Conditionally hide the 'S' column data cell
                            if (colIdx === 2 && !showAnalytics) {
                                return null;
                            }

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

export default React.memo(ScorecardGrid);