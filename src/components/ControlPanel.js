// src/components/ControlPanel.js
import React from 'react';
import { DEFAULT_GAME_NAME } from '../utils/constants';
import { ruleLabel } from '../engine/rules';
import StealthIcon from './StealthIcon';
import { TABLE_TYPES, SHUFFLES } from '../engine/cardMeta';

const ControlPanel = ({
    onStealthClick, onStatsClick, onSimClick,
    showControls, setShowControls,
    isDarkMode, setIsDarkMode,
    showAnalytics, setShowAnalytics,
    testMode, setTestMode,
    currentScorecardName,
    saveGameInput, setSaveGameInput,
    saveDate, setSaveDate,
    cardMeta, setCardMeta,
    handleQuickSave, // New prop for quick save
    handleSaveAs, // Renamed for clarity
    loadGameSelect, setLoadGameSelect,
    allSavedScorecards,
    handleLoadSelectedGame,
    handleDeleteSelectedGame,
    handleFullReset,
    recordTie,
    saveState,
    predictedWinType, confidenceLevel, predictionSource, calibration,
}) => {
    const gameNamePresets = ["Boomtown", "L'auberge", "Treasure Chest", "Ceaser's NO."];

    return (
        <div className="header-section">
            <div className="prediction-bar-container clickable-bar" onClick={() => setShowControls(!showControls)}>
                <div className="prediction-display">
                    {showAnalytics ? (
                        <>
                            Prediction: <span className={predictedWinType === 'P' ? 'p-color' : (predictedWinType === 'B' ? 'b-color' : '')}>{predictedWinType || 'N/A'}</span>
                            {(() => {
                                // Each figure carries its own label. An earlier
                                // version put the rule name where the C-Level
                                // label had been, which read as though the
                                // percentage described the rule -- it does not.
                                // "Wiener-3 51% over 834" paired a rule that had
                                // fired 89 times with a confidence level that
                                // had 834 hands behind it.
                                const m = calibration?.get(confidenceLevel);
                                return (
                                    <>
                                        {predictionSource && (
                                            <span className="prediction-rule">
                                                &nbsp;&nbsp;&nbsp; Rule: {ruleLabel(predictionSource)}
                                            </span>
                                        )}
                                        &nbsp;&nbsp;&nbsp; C:{' '}
                                        {m ? (
                                            <span className={m.belowBreakEven ? 'confidence-losing' : undefined}>
                                                {(m.rate * 100).toFixed(0)}%
                                            </span>
                                        ) : (
                                            <span className="c-level-measured">—</span>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    ) : (
                        <span>
                            {currentScorecardName === DEFAULT_GAME_NAME ? "Code Tracker" : currentScorecardName}
                        </span>
                    )}
                </div>
                {/* Recording a tie used to mean opening the controls panel and
                    hunting for a button beside New/Save/Stats. P and B are one
                    tap on the grid, so T should be one tap too. */}
                <button
                    className="toolbar-tie-button"
                    title="Record a tie on the next hand"
                    onClick={(e) => { e.stopPropagation(); recordTie(); }}
                >
                    T
                </button>
                <button className="toolbar-icon-button" onClick={(e) => { e.stopPropagation(); onStealthClick(); }}>
                    <StealthIcon className="stealth-icon" />
                </button>
            </div>

            <div id="controls-container-id" className={`controls-container ${showControls ? '' : 'controls-hidden'}`}>
                {/* Current Session Name Display */}
                <div className="current-session-display">
                    Current Session: <span>{currentScorecardName}</span>
                </div>
                {saveState?.status === 'failed' && (
                    <div className="save-warning">
                        Not saved to the server ({saveState.error}).
                        {saveState.at
                            ? ' Your card is safe on this device; the last copy that reached the server is older.'
                            : ' Your card is safe on this device but has never reached the server.'}
                    </div>
                )}
                <div className="quick-save-container">
                    <button onClick={handleFullReset} className="reset-button">New</button>
                    <button onClick={handleQuickSave} className="quick-save-button">Save</button>
                    <button onClick={onStatsClick} className="stats-button">Stats</button>
                    <button onClick={onSimClick} className="sim-button" title="Run rules over generated shoes">Sim</button>
                    <button onClick={recordTie} className="tie-button" title="Record a tie on the next hand">Tie</button>
                </div>
                <hr className="divider" />
                <div className="toggle-switch-container">
                    <span>Dark Mode</span>
                    <label className="toggle-switch"> <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} /> <span className="slider round"></span> </label>
                </div>
                <div className="toggle-switch-container">
                    <span>Test mode</span>
                    <label className="toggle-switch"> <input type="checkbox" checked={testMode} onChange={() => setTestMode(!testMode)} /> <span className="slider round"></span> </label>
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

                    {/* What kind of game this is. A video machine has no shuffle
                        to leave a trace, no cut card and no burns, so it is the
                        control arm rather than a weaker version of table play --
                        and pooling the two destroys both. This used to live in
                        the card's name, where it could not be read reliably. */}
                    <div className="card-meta-row">
                        <label>
                            Table
                            <select
                                value={cardMeta?.tableType || 'unknown'}
                                onChange={(e) => setCardMeta({ ...cardMeta, tableType: e.target.value })}
                            >
                                {TABLE_TYPES.map((t) => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Shuffle
                            <select
                                value={cardMeta?.shuffle || 'unknown'}
                                onChange={(e) => setCardMeta({ ...cardMeta, shuffle: e.target.value })}
                            >
                                {SHUFFLES.map((s) => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Venue
                            <input
                                type="text" value={cardMeta?.venue || ''} placeholder="optional"
                                onChange={(e) => setCardMeta({ ...cardMeta, venue: e.target.value })}
                            />
                        </label>
                    </div>

                    <button onClick={handleSaveAs} className="save-button"> Save As New </button>
                </div>
                <hr className="divider" />
                <div className="load-game-section">
                    <select value={loadGameSelect} onChange={(e) => setLoadGameSelect(e.target.value)}>
                        <option value="">-- Select Game to Load --</option>
                        {Object.keys(allSavedScorecards).map(name => ( <option key={name} value={name}>{name === DEFAULT_GAME_NAME ? `${name} (last device)` : name}</option> ))}
                    </select>
                    <button onClick={handleLoadSelectedGame} className="load-button" disabled={!loadGameSelect}> Load </button>
                </div>
                <button onClick={handleDeleteSelectedGame} className="delete-button" disabled={!loadGameSelect || loadGameSelect === DEFAULT_GAME_NAME}> Delete Selected Game </button>
            </div>
        </div>
    );
};

export default React.memo(ControlPanel);