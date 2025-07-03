// src/hooks/useTheme.js
import { useState, useEffect } from 'react';
import { DARK_MODE_KEY } from '../utils/constants';

export const useTheme = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem(DARK_MODE_KEY);
        // Default to dark mode if nothing is saved
        return savedTheme ? JSON.parse(savedTheme) : true; 
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