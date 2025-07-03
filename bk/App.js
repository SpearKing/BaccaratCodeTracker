import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';

const NUM_INITIAL_ROWS = 82;
const NUM_INITIAL_COLUMNS = 10; // For columns 1-10
const X_MARK_THRESHOLD = 4; // 'X' appears when absolute value of the cell above reaches this or higher

// NEW CONSTANTS FOR SAVING/LOADING
const ALL_SAVED_SCORECARDS_KEY = 'baccarat_all_saved_scorecards';
const LAST_ACTIVE_SCORECARD_NAME_KEY = 'baccarat_last_active_scorecard_name';
const DEFAULT_GAME_NAME = 'Last Session'; // Name for the automatically saved session
const DARK_MODE_KEY = 'baccarat_dark_mode'; // Key for dark mode preference
const ANALYTICS_MODE_KEY = 'baccarat_analytics_mode'; // Key for analytics preference <--- NEW

// Define the patterns for analytics
// Each pattern has a sequence (seq), a minimum length to be recognized (minLength),
// and a flag if it's a repeating pattern (isRepeating).
// Patterns like {+/- 10101..} mean a sequence like [1,0,1,0,1] or [-1,0,-1,0,-1]
// They are assumed to maintain the sign of their non-zero elements.
const ANALYTICS_PATTERNS = [
    { seq: [1, 0], minLength: 3, isRepeating: true, name: '1010' },
    { seq: [1, 2], minLength: 3, isRepeating: true, name: '121' },
    { seq: [2, 3], minLength: 3, isRepeating: true, name: '232' },
    { seq: [3, 4, 3], minLength: 3, isRepeating: false, name: '343' } // Fixed length
];


function App() {
  // --- Global App State Management ---
  const [allSavedScorecards, setAllSavedScorecards] = useState({});
  const [currentScorecardName, setCurrentScorecardName] = useState(DEFAULT_GAME_NAME);

  // Initialize theme mode from localStorage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(DARK_MODE_KEY);
    return savedTheme ? JSON.parse(savedTheme) : false; // Default to light mode
  });

  // Initialize analytics mode from localStorage <--- NEW
  const [showAnalytics, setShowAnalytics] = useState(() => {
    const savedAnalytics = localStorage.getItem(ANALYTICS_MODE_KEY);
    return savedAnalytics ? JSON.parse(savedAnalytics) : false; // Default to off
  });

  // Toggle for showing/hiding control buttons (for UI cleanup)
  const [showControls, setShowControls] = useState(false);

  // Initialize scorecard, lastWinType, lastWinRow from localStorage or default
  const [scorecard, setScorecard] = useState(() => {
    const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
    const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;

    if (savedGames[lastActiveName]) {
      const { scorecard } = savedGames[lastActiveName];
      return scorecard;
    }

    const initialScorecard = [];
    for (let i = 0; i < NUM_INITIAL_ROWS + 1; i++) {
      const row = [];
      row.push({ type: 'P', value: '', editable: true, displayValue: '' });
      row.push({ type: 'B', value: '', editable: true, displayValue: '' });
      row.push({ type: 'S', value: '', editable: false, displayValue: '' });
      for (let j = 0; j < NUM_INITIAL_COLUMNS; j++) {
        row.push({ type: 'Number', value: null, editable: false, displayValue: '' });
      }
      initialScorecard.push(row);
    }
    return initialScorecard;
  });

  const [lastWinType, setLastWinType] = useState(() => {
    const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
    const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
    return savedGames[lastActiveName]?.lastWinType || null;
  });

  const [lastWinRow, setLastWinRow] = useState(() => {
    const savedGames = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
    const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
    return savedGames[lastActiveName]?.lastWinRow || -1;
  });

  // State for input/select elements for game management
  const [saveGameInput, setSaveGameInput] = useState('');
  const [loadGameSelect, setLoadGameSelect] = useState('');

  // --- Persistence Effects ---

  // Effect to apply dark mode class to body and save preference
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Effect to save analytics preference <--- NEW
  useEffect(() => {
    localStorage.setItem(ANALYTICS_MODE_KEY, JSON.stringify(showAnalytics));
  }, [showAnalytics]);

  // Function to load all saved scorecards from localStorage into state
  const loadAllSavedScorecardsFromStorage = useCallback(() => {
    const saved = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}');
    setAllSavedScorecards(saved);
    const lastActiveName = localStorage.getItem(LAST_ACTIVE_SCORECARD_NAME_KEY) || DEFAULT_GAME_NAME;
    if (saved[lastActiveName]) {
        setLoadGameSelect(lastActiveName);
    } else if (Object.keys(saved).length > 0) {
        setLoadGameSelect(Object.keys(saved)[0]);
    }
  }, []);

  // Effect to load all saved scorecards on component mount
  useEffect(() => {
    loadAllSavedScorecardsFromStorage();
  }, [loadAllSavedScorecardsFromStorage]);

  // Function to save the CURRENT `allSavedScorecards` object to localStorage
  const saveAllScorecardsToStorage = useCallback(() => {
    localStorage.setItem(ALL_SAVED_SCORECARDS_KEY, JSON.stringify(allSavedScorecards));
    localStorage.setItem(LAST_ACTIVE_SCORECARD_NAME_KEY, currentScorecardName);
  }, [allSavedScorecards, currentScorecardName]);

  // Effect for automatically saving the current game session whenever `scorecard`, `lastWinType`, `lastWinRow`, or `currentScorecardName` changes
  // This updates the `allSavedScorecards` state, which in turn triggers `saveAllScorecardsToStorage`
  useEffect(() => {
    setAllSavedScorecards(prev => ({
      ...prev,
      [currentScorecardName]: {
        scorecard: scorecard,
        lastWinType: lastWinType,
        lastWinRow: lastWinRow,
      },
    }));
  }, [scorecard, lastWinType, lastWinRow, currentScorecardName]);

  // Effect to write `allSavedScorecards` to localStorage whenever it changes
  useEffect(() => {
    saveAllScorecardsToStorage();
  }, [allSavedScorecards, saveAllScorecardsToStorage]);

  // --- Helper Functions for Scorecard Logic ---

  const findNextAvailableCol = useCallback((scorecardRow) => {
      for (let col = 3; col < scorecardRow.length; col++) {
          if (scorecardRow[col].value === null && scorecardRow[col].displayValue === '') {
              return col;
          }
      }
      return -1;
  }, []);

  const calculateSingleRow = useCallback((currentScorecard, rowIdx, winType, prevWinType) => {
    if (rowIdx === 0) return currentScorecard;

    let newScorecard = JSON.parse(JSON.stringify(currentScorecard)); // Deep copy for immutability

    let currentRow = newScorecard[rowIdx];
    let rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null;

    // Reset P, B, S cells and their display values for the current row
    currentRow[0] = { ...currentRow[0], value: '', displayValue: '' };
    currentRow[1] = { ...currentRow[1], value: '', displayValue: '' };
    currentRow[2] = { ...currentRow[2], displayValue: '' };

    // Set 'O' in P/B column (already handled in handleCellClick)
    if (winType === 'P') {
      currentRow[0] = { ...currentRow[0], value: 'O', displayValue: 'O' };
    } else if (winType === 'B') {
      currentRow[1] = { ...currentRow[1], value: 'O', displayValue: 'O' };
    }

    const isRepeater = winType === prevWinType;
    if (winType) {
        currentRow[2].displayValue = isRepeater ? 'R' : 'O';
    } else {
        currentRow[2].displayValue = '';
    }

    if (!winType) {
        for (let i = 3; i < currentRow.length; i++) {
            currentRow[i] = { ...currentRow[i], value: null, displayValue: '' };
        }
        return newScorecard;
    }

    let previousColHasValueInSequence = true;
    for (let col = 3; col < currentRow.length; col++) {
      const cellAbove = rowIdx > 0 ? newScorecard[rowIdx - 1][col] : null;

      currentRow[col] = { ...currentRow[col], value: null, displayValue: '' }; // Initialize current numerical cell

      if (cellAbove && cellAbove.displayValue === 'X') {
          currentRow[col].displayValue = 'X';
          previousColHasValueInSequence = false;
          continue;
      }

      if (cellAbove && cellAbove.value !== null && cellAbove.displayValue !== 'X') {
        let newValue;
        if (isRepeater) {
          newValue = cellAbove.value - 1;
        } else {
          newValue = cellAbove.value + 1;
        }

        // X-MARKING LOGIC: If absolute value of the cell *above* meets threshold.
        // This is exactly as per your confirmation: `Math.abs(cellAbove.value) >= X_MARK_THRESHOLD`
        if (Math.abs(cellAbove.value) >= X_MARK_THRESHOLD) {
          currentRow[col] = { ...currentRow[col], value: null, displayValue: 'X' };
          if (rowBelow && col < rowBelow.length) {
            rowBelow[col] = { ...rowBelow[col], value: null, displayValue: 'X' };
          }
          previousColHasValueInSequence = false;
        } else {
          currentRow[col] = { ...currentRow[col], value: newValue, displayValue: newValue.toString() };
          previousColHasValueInSequence = true;
        }
      } else if (col === 3 && previousColHasValueInSequence) {
          currentRow[col] = {
            ...currentRow[col],
            value: isRepeater ? -1 : 1,
            displayValue: isRepeater ? '-1' : '1'
          };
          previousColHasValueInSequence = true;
      } else {
          currentRow[col] = { ...currentRow[col], value: null, displayValue: '' };
          previousColHasValueInSequence = false;
      }
    }

    const finalCurrentRowForMissingCheck = newScorecard[rowIdx];
    const rowHasOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '1');
    const rowHasMinusOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '-1');

    if (!rowHasOne) {
        let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]);
        if (nextAvailCol === -1) {
            newScorecard = newScorecard.map(r => {
                const newR = [...r];
                newR.push({ type: 'Number', value: null, editable: false, displayValue: '' });
                return newR;
            });
            // Update references after potential map
            currentRow = newScorecard[rowIdx];
            rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null;
            nextAvailCol = newScorecard[rowIdx].length - 1;
        }
        newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: 1, displayValue: '1' };
    }

    if (!rowHasMinusOne) {
        let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]);
        if (nextAvailCol === -1) {
             newScorecard = newScorecard.map(r => {
                const newR = [...r];
                newR.push({ type: 'Number', value: null, editable: false, displayValue: '' });
                return newR;
            });
            // Update references after potential map
            currentRow = newScorecard[rowIdx];
            rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null;
            nextAvailCol = newScorecard[rowIdx].length - 1;
        }
        newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: -1, displayValue: '-1' };
    }

    return newScorecard;
  }, [X_MARK_THRESHOLD, findNextAvailableCol]);


  const recalculateFromRow = useCallback((startingRowIdx, initialScorecardState) => {
    let currentScorecardState = JSON.parse(JSON.stringify(initialScorecardState));
    let currentLastWinType = null;

    for (let r = startingRowIdx - 1; r >= 1; r--) {
        if (currentScorecardState[r][0].value === 'O') {
            currentLastWinType = 'P';
            break;
        } else if (currentScorecardState[r][1].value === 'O') {
            currentLastWinType = 'B';
            break;
        }
    }

    for (let r = startingRowIdx; r <= NUM_INITIAL_ROWS; r++) {
      if (!currentScorecardState[r]) {
          break;
      }

      const pCell = currentScorecardState[r][0];
      const bCell = currentScorecardState[r][1];

      let winTypeInCurrentRow = null;
      if (pCell.value === 'O') {
        winTypeInCurrentRow = 'P';
      } else if (bCell.value === 'O') {
        winTypeInCurrentRow = 'B';
      }

      currentScorecardState = calculateSingleRow(
        currentScorecardState,
        r,
        winTypeInCurrentRow,
        currentLastWinType
      );

      if (winTypeInCurrentRow) {
          currentLastWinType = winTypeInCurrentRow;
      }
    }

    let finalLastWinType = null;
    let finalLastWinRow = -1;
    for (let r = NUM_INITIAL_ROWS; r >= 1; r--) {
        if (currentScorecardState[r][0].value === 'O') {
            finalLastWinType = 'P';
            finalLastWinRow = r;
            break;
        } else if (currentScorecardState[r][1].value === 'O') {
            finalLastWinType = 'B';
            finalLastWinRow = r;
            break;
        }
    }

    setScorecard(currentScorecardState);
    setLastWinType(finalLastWinType);
    setLastWinRow(finalLastWinRow);

  }, [calculateSingleRow, NUM_INITIAL_ROWS]);

  const handleCellClick = useCallback((rowIdx, colIdx) => {
    if (rowIdx === 0) return;

    const currentScorecardCopy = JSON.parse(JSON.stringify(scorecard));

    const clickedCellHasO = currentScorecardCopy[rowIdx][colIdx].value === 'O';

    currentScorecardCopy[rowIdx][0] = { ...currentScorecardCopy[rowIdx][0], value: '', displayValue: '' };
    currentScorecardCopy[rowIdx][1] = { ...currentScorecardCopy[rowIdx][1], value: '', displayValue: '' }; // Corrected line
    currentScorecardCopy[rowIdx][2] = { ...currentScorecardCopy[rowIdx][2], displayValue: '' };

    if (!clickedCellHasO) {
      currentScorecardCopy[rowIdx][colIdx] = { ...currentScorecardCopy[rowIdx][colIdx], value: 'O', displayValue: 'O' };
    }

    recalculateFromRow(rowIdx, currentScorecardCopy);

  }, [scorecard, recalculateFromRow]);

  const resetScorecard = useCallback((confirm = true) => {
    if (confirm && !window.confirm("Are you sure you want to reset the scorecard? This action cannot be undone.")) {
        return;
    }
    const initialScorecard = [];
    for (let i = 0; i < NUM_INITIAL_ROWS + 1; i++) {
      const row = [];
      row.push({ type: 'P', value: '', editable: true, displayValue: '' });
      row.push({ type: 'B', value: '', editable: true, displayValue: '' });
      row.push({ type: 'S', value: '', editable: false, displayValue: '' });
      for (let j = 0; j < NUM_INITIAL_COLUMNS; j++) {
        row.push({ type: 'Number', value: null, editable: false, displayValue: '' });
      }
      initialScorecard.push(row);
    }
    setScorecard(initialScorecard);
    setLastWinType(null);
    setLastWinRow(-1);
    setCurrentScorecardName(DEFAULT_GAME_NAME);
    setSaveGameInput('');
    setLoadGameSelect('');

    setAllSavedScorecards(prev => {
        const newSaved = { ...prev };
        delete newSaved[DEFAULT_GAME_NAME];
        return newSaved;
    });

  }, []);

  // --- Game Management Functions ---
  const handleSaveCurrentGame = useCallback(() => {
    const nameToSave = saveGameInput.trim();
    if (!nameToSave) {
      alert("Please enter a name for the scorecard.");
      return;
    }
    if (nameToSave === DEFAULT_GAME_NAME) {
      alert(`The name "${DEFAULT_GAME_NAME}" is reserved for automatic session saving. Please choose a different name.`);
      return;
    }

    // Convert the base name to ALL CAPS for the final save title and internal logic
    const processedBaseName = nameToSave.toUpperCase();

    // Get current date for appending to the title
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const year = today.getFullYear().toString().slice(-2);
    const formattedDate = `${month}/${day}/${year}`;

    // Initial name attempt (e.g., "MY GAME - 06/30/25")
    let finalName = `${processedBaseName} - ${formattedDate}`;

    // --- Logic for appending incremented number if name exists ---

    let maxCounter = 0; // Initialize max counter found for this base name and date

    // Escape special characters in processedBaseName for regex safety
    const escapedBaseName = processedBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Define regex to match existing names like "BASENAME - Date" or "BASENAME_N - Date"
    const regexPattern = new RegExp(`^${escapedBaseName}(?:_(\\d+))? - ${formattedDate}$`);

    Object.keys(allSavedScorecards).forEach(key => {
        const match = key.match(regexPattern);
        if (match) {
            // If match[1] exists, it means we matched "BASENAME_N - Date", so parse N
            // If match[1] does NOT exist, it means we matched "BASENAME - Date", which we treat as version 1
            const currentNum = match[1] ? parseInt(match[1], 10) : 1;
            if (!isNaN(currentNum)) {
                maxCounter = Math.max(maxCounter, currentNum);
            }
        }
    });

    // If maxCounter is > 0, it means we found existing saves, and need to increment.
    if (maxCounter > 0) {
        finalName = `${processedBaseName}_${maxCounter + 1} - ${formattedDate}`;
    }
    // If maxCounter is 0, finalName remains as initialized above.

    // --- End of incrementing logic ---

    setAllSavedScorecards(prev => {
      const newSaved = {
        ...prev,
        [finalName]: {
          scorecard: scorecard,
          lastWinType: lastWinType,
          lastWinRow: lastWinRow,
        },
      };
      return newSaved;
    });
    setCurrentScorecardName(finalName); // Set current active game to this new name
    setSaveGameInput(''); // Clear input
    alert(`Scorecard "${finalName}" saved!`);
  }, [saveGameInput, scorecard, lastWinType, lastWinRow, allSavedScorecards]);


  const handleLoadSelectedGame = useCallback(() => {
    if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
      alert("Please select a scorecard to load.");
      return;
    }

    const { scorecard: loadedScorecard, lastWinType: loadedType, lastWinRow: loadedRow } = allSavedScorecards[loadGameSelect];

    setScorecard(loadedScorecard);
    setLastWinType(loadedType);
    setLastWinRow(loadedRow);
    setCurrentScorecardName(loadGameSelect);
    alert(`Scorecard "${loadGameSelect}" loaded!`);

  }, [loadGameSelect, allSavedScorecards]);


  const handleDeleteSelectedGame = useCallback(() => {
    if (!loadGameSelect || !allSavedScorecards[loadGameSelect]) {
      alert("Please select a scorecard to delete.");
      return;
    }
    if (loadGameSelect === DEFAULT_GAME_NAME) {
        alert(`The default "${DEFAULT_GAME_NAME}" session cannot be deleted.`);
        return;
    }

    if (!window.confirm(`Are you sure you want to delete scorecard "${loadGameSelect}"?`)) {
      return;
    }

    setAllSavedScorecards(prev => {
      const newSaved = { ...prev };
      delete newSaved[loadGameSelect];
      return newSaved;
    });

    if (loadGameSelect === currentScorecardName) {
        const lastSessionData = JSON.parse(localStorage.getItem(ALL_SAVED_SCORECARDS_KEY) || '{}')[DEFAULT_GAME_NAME];
        if (lastSessionData) {
            setScorecard(lastSessionData.scorecard);
            setLastWinType(lastSessionData.lastWinType);
            setLastWinRow(lastSessionData.lastWinRow);
            setCurrentScorecardName(DEFAULT_GAME_NAME);
        } else {
            resetScorecard(false);
        }
    }
    setLoadGameSelect('');
    alert(`Scorecard "${loadGameSelect}" deleted.`);
  }, [loadGameSelect, allSavedScorecards, currentScorecardName, resetScorecard]);

  // Max renderable columns logic
  const maxRenderableColumns = useMemo(() => {
    let maxContentColIndex = 3 + NUM_INITIAL_COLUMNS - 1;
    scorecard.forEach(row => {
      for (let i = 3; i < row.length; i++) {
        if (row[i].displayValue !== '' || row[i].value !== null) {
          maxContentColIndex = Math.max(maxContentColIndex, i);
        }
      }
    });
    return maxContentColIndex + 1;
  }, [scorecard, NUM_INITIAL_COLUMNS]);


  // --- Analytics Pattern Recognition Logic ---
  // Helper to find highlights in a single column
  const getHighlightsForColumn = useCallback((colValues, patterns, colIdx) => {
    const highlights = new Set(); // Stores "{rowIdx}-{colIdx}" strings

    patterns.forEach(p => {
        const patternToMatch = Array.isArray(p.seq) ? p.seq : [p.seq];
        const minLength = p.minLength || patternToMatch.length;
        const isRepeating = p.isRepeating || false;

        // Skip if repeating pattern definition is invalid
        if (isRepeating && patternToMatch.length !== 2) {
            // console.warn(`Invalid repeating pattern definition for ${p.name}. Expected length 2, got ${patternToMatch.length}.`);
            return;
        }

        // Iterate through column values to find pattern matches
        for (let i = 0; i <= colValues.length - minLength; i++) {
            let currentSegment = [];
            let segmentMatchesInitial = true; // Check if the initial segment matches

            // Check for initial match of the base pattern/segment (e.g., [1,0] or [3,4,3])
            for (let j = 0; j < patternToMatch.length; j++) {
                const cellValue = colValues[i + j];
                const patternVal = patternToMatch[j];
                // Check if value is null or absolute values don't match
                if (cellValue === null || Math.abs(cellValue) !== Math.abs(patternVal)) {
                    segmentMatchesInitial = false;
                    break;
                }
                currentSegment.push(cellValue);
            }

            if (!segmentMatchesInitial) continue; // Move to next starting position if initial segment doesn't match

            // Check sign consistency for the initial segment (all positive or all negative for non-zero values)
            const firstValInSegment = currentSegment.find(val => val !== 0); // Find first non-zero value for sign reference
            if (firstValInSegment !== undefined) { // Only check sign if there's at least one non-zero value
                let signConsistent = true;
                for (let j = 0; j < currentSegment.length; j++) {
                    const val = currentSegment[j];
                    if (val !== 0 && ((firstValInSegment > 0 && val < 0) || (firstValInSegment < 0 && val > 0))) {
                        signConsistent = false;
                        break;
                    }
                }
                if (!signConsistent) continue; // Move to next starting position if sign is inconsistent
            }

            // Determine actual length of the matched sequence (extends for repeating patterns)
            let actualLength = patternToMatch.length;
            if (isRepeating) {
                while (i + actualLength < colValues.length) {
                    const nextVal = colValues[i + actualLength];
                    const expectedVal = patternToMatch[actualLength % patternToMatch.length]; // Cycle through pattern
                    
                    // Break if value is null or absolute values don't match
                    if (nextVal === null || Math.abs(nextVal) !== Math.abs(expectedVal)) {
                        break;
                    }
                    // Break if sign is inconsistent with the initial segment's sign
                    if (nextVal !== 0 && firstValInSegment !== undefined && ((firstValInSegment > 0 && nextVal < 0) || (firstValInSegment < 0 && nextVal > 0))) {
                        break;
                    }
                    actualLength++;
                }
            }

            // If the detected actualLength meets the minimum requirement, add cells to highlights
            if (actualLength >= minLength) {
                // IMPORTANT: rowIdx in highlights needs to be the actual rowIdx from the scorecard.
                // 'i' here is the index within `colValues` (which starts from scorecard row 1).
                // So, actual scorecard rowIdx is `i + 1`.
                for (let k = 0; k < actualLength; k++) {
                    highlights.add(`${i + k + 1}-${colIdx}`); // Key format: "scorecardRowIdx-colIdx"
                }
                // Optimization: Skip already highlighted cells to prevent re-processing
                // Move 'i' to the end of the detected pattern. The outer loop will then increment it by 1.
                i += actualLength - 1;
            }
        }
    });
    return highlights;
  }, []); // No external dependencies for this helper, as colValues and patterns are passed

  // Memoized function to calculate all highlights for the entire scorecard
  const highlightedCells = useMemo(() => {
    if (!showAnalytics) return new Set();

    const allHighlights = new Set();
    // Iterate through numerical columns (from index 3)
    for (let colIdx = 3; colIdx < maxRenderableColumns; colIdx++) {
        const columnValues = [];
        for (let rowIdx = 1; rowIdx < scorecard.length; rowIdx++) { // Start from row 1, skip header
            columnValues.push(scorecard[rowIdx][colIdx].value);
        }
        const colHighlights = getHighlightsForColumn(columnValues, ANALYTICS_PATTERNS, colIdx);
        colHighlights.forEach(h => allHighlights.add(h));
    }
    return allHighlights;
  }, [scorecard, showAnalytics, maxRenderableColumns, getHighlightsForColumn]); // Re-calculate only when these dependencies change


  return (
    <div className="app-container">
      <div className="header-section">
        {/* Pull-Down Handle */}
        <div className="pull-down-handle" onClick={() => setShowControls(!showControls)} aria-expanded={showControls} aria-controls="controls-container-id">
            <span className="handle-text">Game Options</span>
            <svg className={`pull-down-arrow ${showControls ? 'rotated' : ''}`} viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </div>

        {/* Controls Container (Show/Hide) */}
        <div id="controls-container-id" className={`controls-container ${showControls ? '' : 'controls-hidden'}`}>
          {/* Theme Toggle */}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="toggle-button theme-toggle">
            {isDarkMode ? 'Exit Stealth Mode' : 'Stealth Mode'}
          </button>

          {/* Analytics Toggle <--- NEW */}
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
                .filter(name => name !== DEFAULT_GAME_NAME) // Exclude "Last Session" from dropdown
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
          <button onClick={() => resetScorecard()} className="reset-button">Reset Scorecard</button>
        </div>
      </div>

      <div className="scorecard-grid">
        {/* Header Row */}
        <div className="grid-row header-row">
          <div className="grid-cell header">#</div>
          <div className="grid-cell header">P</div>
          <div className="grid-cell header">B</div>
          <div className="grid-cell header">S</div>
          {/* Render headers only up to maxRenderableColumns */}
          {Array.from({ length: maxRenderableColumns - 3 }).map((_, colIdx) => (
            <div key={`header-${colIdx + 1}`} className="grid-cell header">{colIdx + 1}</div>
          ))}
        </div>

        {/* Data Rows */}
        {scorecard.map((row, rowIdx) => (
          rowIdx === 0 ? null : ( // Hide the Ref# row (row 0)
            <div key={rowIdx} className={`grid-row`}>
              <div className="grid-cell row-number">{rowIdx}</div>
              {/* Slice the row to only render up to maxRenderableColumns */}
              {row.slice(0, maxRenderableColumns).map((cell, colIdx) => {
                const isP = colIdx === 0;
                const isB = colIdx === 1;
                const isS = colIdx === 2;
                const isNumber = colIdx >= 3;
                const isClickable = (isP || isB);

                let cellClassName = 'grid-cell';
                if (isP) cellClassName += ' p-column';
                if (isB) cellClassName += ' b-column';
                if (isS) cellClassName += ' s-column';
                if (isNumber) cellClassName += ' number-column';
                if (isClickable) cellClassName += ' clickable-cell';

                if (cell.displayValue === 'X') cellClassName += ' x-cell';

                // NEW: Add analytics-highlight class if cell is highlighted
                // The key for highlightedCells is "rowIdx-colIdx"
                if (highlightedCells.has(`${rowIdx}-${colIdx}`)) {
                    cellClassName += ' analytics-highlight';
                }

                const cellValue = cell.displayValue;

                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={cellClassName}
                    style={{
                      color: isP && cell.value === 'O' ? 'var(--p-color)' :
                             (isB && cell.value === 'O' ? 'var(--b-color)' :
                             (isS && (cell.displayValue === 'R' || cell.displayValue === 'O') ? 'var(--s-color)' :
                             (cell.displayValue === 'X' ? 'var(--x-color)' : 'var(--text-color)'))),
                      fontWeight: (isP || isB) && cell.value === 'O' ? 'bold' : 'normal',
                    }}
                    onClick={isClickable ? () => handleCellClick(rowIdx, colIdx) : undefined}
                  >
                    {isClickable ? (
                      <span className="o-display">{cell.displayValue}</span>
                    ) : (
                      cellValue
                    )}
                  </div>
                );
              })}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default App;