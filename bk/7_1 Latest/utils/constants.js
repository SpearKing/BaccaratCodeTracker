// src/utils/constants.js

export const NUM_INITIAL_ROWS = 82;
export const NUM_INITIAL_COLUMNS = 10; // For columns 1-10
export const X_MARK_THRESHOLD = 4; // 'X' appears when absolute value of the cell above reaches this or higher

// Local Storage Keys
export const ALL_SAVED_SCORECARDS_KEY = 'baccarat_all_saved_scorecards';
export const LAST_ACTIVE_SCORECARD_NAME_KEY = 'baccarat_last_active_scorecard_name';
export const DARK_MODE_KEY = 'baccarat_dark_mode';
export const ANALYTICS_MODE_KEY = 'baccarat_analytics_mode';

export const DEFAULT_GAME_NAME = 'Last Session'; // Name for the automatically saved session

// Define the patterns for analytics with a unique 'name' for CSS class generation
export const ANALYTICS_PATTERNS = [
    // Highlight pattern-1010 now allows mixed signs (e.g., 1,0,-1,0,1)
    { seq: [1, 0], minLength: 3, isRepeating: true, name: 'pattern-1010', allowMixedSigns: true },
    { seq: [1, 2], minLength: 3, isRepeating: true, name: 'pattern-121' },
    { seq: [2, 3], minLength: 3, isRepeating: true, name: 'pattern-232' },
    { seq: [3, 4, 3], minLength: 3, isRepeating: false, name: 'pattern-343' }
];