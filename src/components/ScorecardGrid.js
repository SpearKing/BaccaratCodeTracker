// src/components/ScorecardGrid.js
import React, { useState, useRef } from 'react';
import GridCell from './GridCell';

const ScorecardGrid = ({ scorecard, handleCellClick, recordTieAt, maxRenderableColumns, highlightedCells, showAnalytics, handleDeleteRow }) => {
    const longPressTimeout = useRef(null);
    const [isLongPress, setIsLongPress] = useState(false);

    const handleMouseDown = (rowIdx) => {
        setIsLongPress(false);
        longPressTimeout.current = setTimeout(() => {
            setIsLongPress(true);
            if (window.confirm(`Are you sure you want to delete row ${rowIdx}?`)) {
                handleDeleteRow(rowIdx);
            }
        }, 1000); // 1-second long press
    };

    const handleMouseUp = () => {
        clearTimeout(longPressTimeout.current);
    };

    const handleTouchStart = (rowIdx) => {
        handleMouseDown(rowIdx);
    };

    const handleTouchEnd = () => {
        handleMouseUp();
    };


    return (
        <div className={`scorecard-grid ${!showAnalytics ? 'analytics-off' : ''}`}>
            {/* Header Row */}
            <div className="grid-row header-row">
                <div className="grid-cell header header-pound sticky-col">#</div>
                {/* The header carries the same column classes as the cells
                    below it. Without them the phone rule widened P and B in the
                    body only, and every column drifted further out of line with
                    its heading the further right you looked. */}
                <div className="grid-cell header col-p">P</div>
                <div className="grid-cell header col-b">B</div>
                {/* T is a view onto the S cell, which is where a tie is actually
                    stored. Rendering it as its own clickable column rather than
                    adding a real column keeps the grid three-plus-N wide, so no
                    saved card and no golden-master fixture has to change. */}
                <div className="grid-cell header">T</div>
                <div className="grid-cell header">S</div>
                
                {showAnalytics && Array.from({ length: maxRenderableColumns - 3 }).map((_, colIdx) => (
                    <div key={`header-${colIdx + 1}`} className="grid-cell header">{colIdx + 1}</div>
                ))}
            </div>

            {/* Data Rows */}
            {scorecard.map((row, rowIdx) => (
                rowIdx === 0 ? null : (
                    <div key={rowIdx} 
                         className={`grid-row`}
                         onMouseDown={() => handleMouseDown(rowIdx)}
                         onMouseUp={handleMouseUp}
                         onMouseLeave={handleMouseUp}
                         onTouchStart={() => handleTouchStart(rowIdx)}
                         onTouchEnd={handleTouchEnd}
                    >
                        <div 
                            className="grid-cell row-number sticky-col"
                        >
                            {rowIdx}
                        </div>
                        
                        {row.slice(0, showAnalytics ? maxRenderableColumns : 3).map((cell, colIdx) => {
                            const isP = colIdx === 0;
                            const isB = colIdx === 1;
                            const isS = colIdx === 2;
                            const isNumber = colIdx >= 3;
                            const isClickable = (isP || isB);


                            if (!showAnalytics && isNumber) {
                                return null;
                            }

                            const gridCell = (
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
                                    isLongPress={isLongPress}
                                    showAnalytics={showAnalytics}
                                />
                            );

                            // The T cell sits before S and reads the same stored
                            // cell, so a tie shows in one place and is recorded
                            // by tapping the row rather than a separate button.
                            if (!isS) return gridCell;
                            return (
                                <React.Fragment key={`${rowIdx}-tie`}>
                                    <GridCell
                                        cell={cell}
                                        rowIdx={rowIdx}
                                        colIdx={colIdx}
                                        isT
                                        isClickable
                                        highlightedCells={highlightedCells}
                                        handleCellClick={() => recordTieAt(rowIdx)}
                                        isLongPress={isLongPress}
                                        showAnalytics={showAnalytics}
                                    />
                                    {gridCell}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )
            ))}
        </div>
    );
};

export default React.memo(ScorecardGrid);