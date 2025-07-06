// src/utils/statsCalculator.js
import { ANALYTICS_PATTERNS } from './constants';

export const calculateStats = (scorecard, highlightedCells, lastWinRow, existingStats) => {
    
    let pWins = 0;
    let bWins = 0;

    if (scorecard && scorecard.length > 0) {
        for (let i = 1; i < scorecard.length; i++) {
            if (scorecard[i][0].value === 'O') pWins++;
            if (scorecard[i][1].value === 'O') bWins++;
        }
    }

    const totalWins = pWins + bWins;
    const pPct = totalWins > 0 ? ((pWins / totalWins) * 100).toFixed(2) : '0.00';
    const bPct = totalWins > 0 ? ((bWins / totalWins) * 100).toFixed(2) : '0.00';

    const patternStats = new Map();
    ANALYTICS_PATTERNS.forEach(p => {
        // Carry over win/loss data, but reset the count
        const existingPatternData = existingStats.patternStats.get(p.name);
        patternStats.set(p.name, { 
            count: 0, 
            wins: existingPatternData?.wins || 0,
            losses: existingPatternData?.losses || 0,
        });
    });
    
    // Count pattern cells only in the last active row
    if (lastWinRow > 0 && scorecard && scorecard[lastWinRow] && highlightedCells) {
        for (let col = 3; col < scorecard[lastWinRow].length; col++) {
            const cellKey = `${lastWinRow}-${col}`;
            if (highlightedCells.has(cellKey)) {
                const pName = highlightedCells.get(cellKey);
                if (patternStats.has(pName)) {
                    const currentPattern = patternStats.get(pName);
                    currentPattern.count++;
                }
            }
        }
    }

    return {
        pWins,
        bWins,
        pPct,
        bPct,
        patternStats: patternStats,
        predictions: existingStats.predictions, // Carry over prediction stats
    };
};