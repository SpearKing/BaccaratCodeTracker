// src/components/ControlPanel.js
import React from 'react';
import { DEFAULT_GAME_NAME } from '../utils/constants';
import StealthIcon from './StealthIcon';

const ControlPanel = ({
    onStealthClick, onStatsClick,
    showControls, setShowControls,
    isDarkMode, setIsDarkMode,
    showAnalytics, setShowAnalytics,
    currentScorecardName,
    saveGameInput, setSaveGameInput,
    saveDate, setSaveDate,
    handleQuickSave, // New prop for quick save
    handleSaveAs, // Renamed for clarity
    loadGameSelect, setLoadGameSelect,
    allSavedScorecards,
    handleLoadSelectedGame,
    handleDeleteSelectedGame,
    handleFullReset,
    predictedWinType, confidenceLevel,
}) => {
    const gameNamePresets = ["Boomtown", "L'auberge", "Treasure Chest", "Ceaser's NO."];

    return (
        <div className="header-section">
            <div className="prediction-bar-container clickable-bar" onClick={() => setShowControls(!showControls)}>
                <div className="prediction-display">
                    {showAnalytics ? (
                        <>
                            Prediction: <span className={predictedWinType === 'P' ? 'p-color' : (predictedWinType === 'B' ? 'b-color' : '')}>{predictedWinType || 'N/A'}</span>
                            &nbsp;&nbsp;&nbsp; C-Level: <span>{confidenceLevel}</span>
                        </>
                    ) : (
                        <span>
                            {currentScorecardName === DEFAULT_GAME_NAME ? "Code Tracker" : currentScorecardName}
                        </span>
                    )}
                </div>
                <button className="toolbar-icon-button" onClick={(e) => { e.stopPropagation(); onStealthClick(); }}>
                    <StealthIcon className="stealth-icon" />
                </button>
            </div>

            <div id="controls-container-id" className={`controls-container ${showControls ? '' : 'controls-hidden'}`}>
                {/* Current Session Name Display */}
                <div className="current-session-display">
                    Current Session: <span>{currentScorecardName}</span>
                </div>
                <div className="quick-save-container">
                    <button onClick={handleFullReset} className="reset-button">New</button>
                    <button onClick={handleQuickSave} className="quick-save-button">Save</button>
                    <button onClick={onStatsClick} className="stats-button">Stats</button>
                </div>
                <hr className="divider" />
                <div className="toggle-switch-container">
                    <span>Dark Mode</span>
                    <label className="toggle-switch"> <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} /> <span className="slider round"></span> </label>
                </div>
                <div className="toggle-switch-container">
                    <span>Analytics</span>
                    <label className="toggle-switch"> <input type="checkbox" checked={showAnalytics} onChange={() => setShowAnalytics(!showAnalytics)} /> <span className="slider round"></span> </label>
                </div>
                <hr className="divider" />
                <div className="save-game-section">
                    <div className="combo-and-date">
                        <input list="game-presets" className="combo-textbox" value={saveGameInput} onChange={(e) => setSaveGameInput(e.target.value)} placeholder="Enter new name to save as..." />
                        <datalist id="game-presets"> {gameNamePresets.map(name => <option key={name} value={name} />)} </datalist>
                        <input type="date" className="date-picker" value={saveDate} onChange={(e) => setSaveDate(e.target.value)} />
                    </div>
                    <button onClick={handleSaveAs} className="save-button"> Save As New </button>
                </div>
                <hr className="divider" />
                <div className="load-game-section">
                    <select value={loadGameSelect} onChange={(e) => setLoadGameSelect(e.target.value)}>
                        <option value="">-- Select Game to Load --</option>
                        {Object.keys(allSavedScorecards).filter(name => name !== DEFAULT_GAME_NAME).map(name => ( <option key={name} value={name}>{name}</option> ))}
                    </select>
                    <button onClick={handleLoadSelectedGame} className="load-button" disabled={!loadGameSelect}> Load </button>
                </div>
                <button onClick={handleDeleteSelectedGame} className="delete-button" disabled={!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME}> Delete Selected Game </button>
            </div>
        </div>
    );
};

export default React.memo(ControlPanel);