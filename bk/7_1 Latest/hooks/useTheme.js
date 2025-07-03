// src/hooks/useTheme.js
import { useState, useEffect } from 'react';
import { DARK_MODE_KEY } from '../utils/constants';

export const useTheme = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem(DARK_MODE_KEY);
        return savedTheme ? JSON.parse(savedTheme) : false; // Default to light mode
    });

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    return { isDarkMode, setIsDarkMode };
};