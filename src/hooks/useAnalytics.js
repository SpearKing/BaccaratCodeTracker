// src/hooks/useAnalytics.js
import { useState, useEffect, useMemo } from 'react';
import { ANALYTICS_MODE_KEY } from '../utils/constants';
import { computeHighlights } from '../engine/analytics';

export const useAnalytics = (scorecard, maxRenderableColumns) => {
    const [showAnalytics, setShowAnalytics] = useState(() => {
        const savedAnalytics = localStorage.getItem(ANALYTICS_MODE_KEY);
        return savedAnalytics ? JSON.parse(savedAnalytics) : false; // Default to off
    });

    useEffect(() => {
        localStorage.setItem(ANALYTICS_MODE_KEY, JSON.stringify(showAnalytics));
    }, [showAnalytics]);

    const highlightedCells = useMemo(
        () => (showAnalytics ? computeHighlights(scorecard, maxRenderableColumns) : new Map()),
        [scorecard, showAnalytics, maxRenderableColumns]
    );

    return { showAnalytics, setShowAnalytics, highlightedCells };
};
