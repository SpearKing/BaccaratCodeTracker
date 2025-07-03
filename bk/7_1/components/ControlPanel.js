// src/components/ControlPanel.js
import React from 'react';
import { DEFAULT_GAME_NAME } from '../utils/constants';

const ControlPanel = ({
    showControls, setShowControls,
    isDarkMode, setIsDarkMode,
    showAnalytics, setShowAnalytics,
    currentScorecardName,
    saveGameInput, setSaveGameInput,
    handleSaveCurrentGame,
    loadGameSelect, setLoadGameSelect,
    allSavedScorecards,
    handleLoadSelectedGame,
    handleDeleteSelectedGame,
    handleFullReset, // This is now "New Game"
    predictedWinType,
    highlightedCount,
    saveGameDate, // PROP for date input
    setSaveGameDate // PROP setter for date input
}) => {
    return (
        <div className="header-section">
            {/* Prediction Display */}
            {showAnalytics && (
                <div className="prediction-display">
                    Prediction: <span className={predictedWinType === 'P' ? 'p-color' : (predictedWinType === 'B' ? 'b-color' : '')}>{predictedWinType || 'N/A'}</span>
                    {' '} Confidence: <span>{highlightedCount}</span>
                </div>
            )}

            {/* Pull-Down Handle */}
            <div className="pull-down-handle" onClick={() => setShowControls(!showControls)} aria-expanded={showControls} aria-controls="controls-container-id">
                <span className="handle-text">Game Options</span>
                <svg className={`pull-down-arrow ${showControls ? 'rotated' : ''}`} viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {/* Controls Container (Show/Hide) */}
            <div id="controls-container-id" className={`controls-container ${showControls ? '' : 'controls-hidden'}`}>

                {/* Stealth Mode and Analytics Buttons (Grouped) */}
                <div className="button-group">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="toggle-button theme-toggle">
                        {isDarkMode ? 'Exit Stealth Mode' : 'Stealth Mode'}
                    </button>
                    <button onClick={() => setShowAnalytics(!showAnalytics)} className="toggle-button analytics-toggle">
                        Analytics: {showAnalytics ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div className="current-game-display">
                    Current Game: <span>{currentScorecardName}</span>
                </div>

                {/* Load Game, Delete Game, and New Game Buttons (Moved Up & Grouped) */}
                <div className="button-group">
                    <select
                        value={loadGameSelect}
                        onChange={(e) => setLoadGameSelect(e.target.value)}
                        className="uniform-select" // NEW CLASS for uniformity
                    >
                        <option value="">-- Select Game --</option>
                        {Object.keys(allSavedScorecards)
                            .filter(name => name !== DEFAULT_GAME_NAME)
                            .map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                    </select>
                    <button onClick={handleLoadSelectedGame} className="load-button uniform-button" disabled={!loadGameSelect}> {/* NEW CLASS */}
                        Load Game
                    </button>
                    <button onClick={handleDeleteSelectedGame} className="delete-button uniform-button" disabled={!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME}> {/* NEW CLASS */}
                        Delete Game
                    </button>
                    <button onClick={handleFullReset} className="reset-button uniform-button">New Game</button> {/* NEW CLASS */}
                </div>

                <div className="save-game-section">
                    {/* Date Picker (Smaller & Left) and Text Input */}
                    <input
                        type="date"
                        value={saveGameDate}
                        onChange={(e) => setSaveGameDate(e.target.value)}
                        className="date-input uniform-input" // NEW CLASS for uniformity
                    />
                    <input
                        type="text"
                        value={saveGameInput}
                        onChange={(e) => setSaveGameInput(e.target.value)}
                        placeholder="Enter game name"
                        className="uniform-input" // NEW CLASS for uniformity
                    />
                    <button onClick={handleSaveCurrentGame} className="save-button uniform-button"> {/* NEW CLASS */}
                        Save Game
                    </button>
                </div>

            </div>
        </div>
    );
};

export default React.memo(ControlPanel);