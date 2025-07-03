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
    handleFullReset,
    predictedWinType,
    confidenceLevel,
}) => {
    return (
        <div className="header-section">
            {/* Prediction Display */}
            {showAnalytics && (
                <div className="prediction-display">
                    Prediction: <span className={predictedWinType === 'P' ? 'p-color' : (predictedWinType === 'B' ? 'b-color' : '')}>{predictedWinType || 'N/A'}</span>
                    {/* UPDATED LABEL AND SPACING */}
                    &nbsp;&nbsp;&nbsp; C-Level: <span>{confidenceLevel}</span>
                </div>
            )}

            {/* Pull-Down Handle */}
            <div className="pull-down-handle" onClick={() => setShowControls(!showControls)} aria-expanded={showControls} aria-controls="controls-container-id">
                <span className="handle-text">Game Options</span>
                <svg className={`pull-down-arrow ${showControls ? 'rotated' : ''}`} viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {/* Controls Container (Show/Hide) - remains hidden/shown */}
            <div id="controls-container-id" className={`controls-container ${showControls ? '' : 'controls-hidden'}`}>
                {/* Theme Toggle */}
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="toggle-button theme-toggle">
                    {isDarkMode ? 'Exit Stealth Mode' : 'Stealth Mode'}
                </button>

                {/* Analytics Toggle */}
                <button onClick={() => setShowAnalytics(!showAnalytics)} className="toggle-button analytics-toggle">
                    Analytics: {showAnalytics ? 'ON' : 'OFF'}
                </button>

                <div className="current-game-display">
                    Current Game: <span>{currentScorecardName}</span>
                </div>

                <div className="save-game-section">
                    <input
                        type="text"
                        value={saveGameInput}
                        onChange={(e) => setSaveGameInput(e.target.value)}
                        placeholder="Enter game name"
                    />
                    <button onClick={handleSaveCurrentGame} className="save-button">
                        Save Game
                    </button>
                </div>

                <div className="load-game-section">
                    <select
                        value={loadGameSelect}
                        onChange={(e) => setLoadGameSelect(e.target.value)}
                    >
                        <option value="">-- Select Game --</option>
                        {Object.keys(allSavedScorecards)
                            .filter(name => name !== DEFAULT_GAME_NAME)
                            .map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                    </select>
                    <button onClick={handleLoadSelectedGame} className="load-button" disabled={!loadGameSelect}>
                        Load Game
                    </button>
                    <button onClick={handleDeleteSelectedGame} className="delete-button" disabled={!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME}>
                        Delete Game
                    </button>
                </div>
                <button onClick={handleFullReset} className="reset-button">Reset Scorecard</button>
            </div>
        </div>
    );
};

export default React.memo(ControlPanel);