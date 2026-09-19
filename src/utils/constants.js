// src/utils/constants.js

export const NUM_INITIAL_ROWS = 1000;
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
    // NOTE: a 'pattern-343' ([3,4,3]) used to sit here. It can never match --
    // X_MARK_THRESHOLD is 4, so a cell holding 4 always becomes an X on the
    // next row and can never be followed by a 3. Zero matches in 28,000
    // simulated hands. Removed rather than "fixed" by raising the threshold,
    // which would rewrite every number on every saved scorecard.
];

// Backend base URL, shared by the scorecard store and the decision log.
export const API_URL = 'https://baccarat-api-3hoh.onrender.com/api';
