// src/components/StatsModal.js
import React from 'react';
import { ANALYTICS_PATTERNS } from '../utils/constants';
import config from '../config';

const StatsModal = ({ stats, onClose }) => {

    if (!stats) {
        return (
            <div className="stats-modal-overlay" onClick={onClose}>
                <div className="stats-modal-content" onClick={(e) => e.stopPropagation()}>
                    <button className="stats-close-button" onClick={onClose}>&times;</button>
                    <h2>Statistics</h2>
                    <p>No statistics available to display.</p>
                </div>
            </div>
        );
    }
    
    // Helper to calculate win percentage
    const getWinPct = (wins, losses) => {
        const total = wins + losses;
        if (total === 0) return '0.00%';
        return ((wins / total) * 100).toFixed(2) + '%';
    };
    
    const pPct = ((stats.pWins / (stats.pWins + stats.bWins)) * 100 || 0).toFixed(2);
    const bPct = ((stats.bWins / (stats.pWins + stats.bWins)) * 100 || 0).toFixed(2);
    
    const patternStats = stats.patternStats instanceof Map ? stats.patternStats : new Map(Object.entries(stats.patternStats || {}));

    return (
        <div className="stats-modal-overlay" onClick={onClose}>
            <div className="stats-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="stats-close-button" onClick={onClose}>&times;</button>
                <h2>Statistics</h2>
                <table className="stats-table">
                    {config.capturePatternStats && (
                        <thead>
                            <tr>
                                <th>Codes</th>
                                <th>Count</th>
                                <th>Wins</th>
                                <th>Losses</th>
                                <th>Pct</th>
                            </tr>
                        </thead>
                    )}
                    {config.capturePatternStats && (
                        <tbody>
                            {Array.from(patternStats.entries()).map(([name, data]) => (
                                <tr key={name}>
                                    <td>{name.replace('pattern-', '')}...</td>
                                    <td>{data.count}</td>
                                    <td>{data.wins}</td>
                                    <td>{data.losses}</td>
                                    <td>{getWinPct(data.wins, data.losses)}</td>
                                </tr>
                            ))}
                            <tr className="table-spacer-major"><td colSpan="5"></td></tr>
                        </tbody>
                    )}
                    
                    <tbody>
                        <tr>
                            <td className="bold">Banker</td>
                            <td>{stats.bWins}</td>
                            <td colSpan="3" className="bold">{bPct}%</td>
                        </tr>
                        <tr>
                            <td className="bold">Player</td>
                            <td>{stats.pWins}</td>
                            <td colSpan="3" className="bold">{pPct}%</td>
                        </tr>
                         <tr className="table-spacer-major"><td colSpan="5"></td></tr>
                         <tr>
                            <th className="bold">Predictions:</th>
                            <th>Correct</th>
                            <th>Wrong</th>
                            <th>Pct</th>
                            <th></th>
                         </tr>
                         <tr>
                            <td></td>
                            <td>{stats.predictions.correct}</td>
                            <td>{stats.predictions.wrong}</td>
                            <td>{getWinPct(stats.predictions.correct, stats.predictions.wrong)}</td>
                            <td></td>
                         </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StatsModal;