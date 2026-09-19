// Golden-master fixture generator for Phase 0.
//
// The functions below are a VERBATIM copy of the pre-extraction logic from
// src/hooks/useScorecardLogic.js at commit 301f190 (line 22, md5
// cd1045a2e0121f58997aa6a5b150fcad). They are intentionally NOT imported from
// src/engine/grid.js -- the whole point is that the fixtures are produced by
// the OLD code, so the new module has something independent to be checked
// against.
//
// Run: node genFixtures.js  (writes src/engine/__fixtures__/golden-master.json)

const fs = require('fs');
const path = require('path');

const NUM_INITIAL_COLUMNS = 10;
const X_MARK_THRESHOLD = 4;

// --- verbatim from useScorecardLogic.js -------------------------------------

const createInitialScorecard = (NUM_INITIAL_ROWS) => { const initialScorecard = []; for (let i = 0; i < NUM_INITIAL_ROWS + 1; i++) { const row = []; row.push({ type: 'P', value: '', editable: true, displayValue: '' }); row.push({ type: 'B', value: '', editable: true, displayValue: '' }); row.push({ type: 'S', value: '', editable: false, displayValue: '' }); for (let j = 0; j < NUM_INITIAL_COLUMNS; j++) { row.push({ type: 'Number', value: null, editable: false, displayValue: '' }); } initialScorecard.push(row); } return initialScorecard; };

const findNextAvailableCol = (scorecardRow) => { for (let col = 3; col < scorecardRow.length; col++) { if (scorecardRow[col].value === null && scorecardRow[col].displayValue === '') { return col; } } return -1; };

const calculateSingleRow = (currentScorecard, rowIdx, winType, prevWinType) => { if (rowIdx === 0) return currentScorecard; let newScorecard = JSON.parse(JSON.stringify(currentScorecard)); let currentRow = newScorecard[rowIdx]; let rowBelow = rowIdx + 1 < newScorecard.length ? newScorecard[rowIdx + 1] : null; currentRow[0] = { ...currentRow[0], value: '', displayValue: '' }; currentRow[1] = { ...currentRow[1], value: '', displayValue: '' }; currentRow[2] = { ...currentRow[2], displayValue: '' }; if (winType === 'P') { currentRow[0] = { ...currentRow[0], value: 'O', displayValue: 'O' }; } else if (winType === 'B') { currentRow[1] = { ...currentRow[1], value: 'O', displayValue: 'O' }; } const isRepeater = winType === prevWinType; if (winType) { currentRow[2].displayValue = isRepeater ? 'R' : 'O'; } else { currentRow[2].displayValue = ''; } if (!winType) { for (let i = 3; i < currentRow.length; i++) { currentRow[i] = { ...currentRow[i], value: null, displayValue: '' }; } return newScorecard; } let previousColHasValueInSequence = true; for (let col = 3; col < currentRow.length; col++) { const cellAbove = rowIdx > 0 ? newScorecard[rowIdx - 1][col] : null; currentRow[col] = { ...currentRow[col], value: null, displayValue: '' }; if (cellAbove && cellAbove.displayValue === 'X') { currentRow[col].displayValue = 'X'; previousColHasValueInSequence = false; continue; } if (cellAbove && cellAbove.value !== null && cellAbove.displayValue !== 'X') { let newValue; if (isRepeater) { newValue = cellAbove.value - 1; } else { newValue = cellAbove.value + 1; } if (Math.abs(cellAbove.value) >= X_MARK_THRESHOLD) { currentRow[col] = { ...currentRow[col], value: null, displayValue: 'X' }; if (rowBelow && col < rowBelow.length) { rowBelow[col] = { ...rowBelow[col], value: null, displayValue: 'X' }; } previousColHasValueInSequence = false; } else { currentRow[col] = { ...currentRow[col], value: newValue, displayValue: newValue.toString() }; previousColHasValueInSequence = true; } } else if (col === 3 && previousColHasValueInSequence) { currentRow[col] = { ...currentRow[col], value: isRepeater ? -1 : 1, displayValue: isRepeater ? '-1' : '1' }; previousColHasValueInSequence = true; } else { currentRow[col] = { ...currentRow[col], value: null, displayValue: '' }; previousColHasValueInSequence = false; } } const finalCurrentRowForMissingCheck = newScorecard[rowIdx]; const rowHasOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '1'); const rowHasMinusOne = finalCurrentRowForMissingCheck.some(cell => cell.displayValue === '-1'); if (!rowHasOne) { let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]); if (nextAvailCol === -1) { newScorecard = newScorecard.map(r => { const newR = [...r]; newR.push({ type: 'Number', value: null, editable: false, displayValue: '' }); return newR; }); nextAvailCol = newScorecard[rowIdx].length - 1; } newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: 1, displayValue: '1' }; } if (!rowHasMinusOne) { let nextAvailCol = findNextAvailableCol(newScorecard[rowIdx]); if (nextAvailCol === -1) { newScorecard = newScorecard.map(r => { const newR = [...r]; newR.push({ type: 'Number', value: null, editable: false, displayValue: '' }); return newR; }); nextAvailCol = newScorecard[rowIdx].length - 1; } newScorecard[rowIdx][nextAvailCol] = { ...newScorecard[rowIdx][nextAvailCol], value: -1, displayValue: '-1' }; } return newScorecard; };

// --- end verbatim ------------------------------------------------------------

// Replays hands the same way the app's handleCellClick does when hands are
// appended in order: previous winner is the hand immediately before.
const buildGrid = (outcomes, numRows) => {
    let sc = createInitialScorecard(numRows);
    for (let i = 0; i < outcomes.length; i++) {
        sc = calculateSingleRow(sc, i + 1, outcomes[i], i > 0 ? outcomes[i - 1] : null);
    }
    return sc;
};

// `value` is fully recoverable from `displayValue` plus the column index, so we
// freeze rows as comma-joined displayValue strings. Any cell that breaks that
// correspondence is encoded as "display|value" instead -- and `oddCells` below
// records how many did, so the test can assert the invariant really holds.
let oddCells = 0;

const derivedValue = (colIdx, d) => {
    if (colIdx <= 1) return d;          // P / B: '' or 'O'
    if (colIdx === 2) return '';        // S: value is never written
    if (d === '' || d === 'X') return null;
    return Number(d);
};

const encodeCell = (colIdx, cell) => {
    const expected = derivedValue(colIdx, cell.displayValue);
    if (Object.is(expected, cell.value)) return cell.displayValue;
    oddCells++;
    return `${cell.displayValue}|${JSON.stringify(cell.value)}`;
};

const serialise = (scorecard, upToRow) => {
    const rows = [];
    for (let r = 0; r <= upToRow; r++) {
        rows.push(scorecard[r].map((c, i) => encodeCell(i, c)).join(','));
    }
    return { width: scorecard[0].length, rows };
};

// Deterministic PRNG so fixtures are reproducible.
const mulberry = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const cases = [];

// 1. Hand-picked sequences that exercise the known edge cases.
const named = {
    'single-player': ['P'],
    'single-banker': ['B'],
    'all-player-12': Array(12).fill('P'),          // drives a column to X quickly
    'all-banker-12': Array(12).fill('B'),
    'perfect-chop-12': Array.from({ length: 12 }, (_, i) => (i % 2 ? 'B' : 'P')),
    'streak-then-chop': ['P','P','P','P','P','B','P','B','P','B','P','B'],
    'chop-then-streak': ['P','B','P','B','P','B','B','B','B','B','B','B'],
    'x-cascade': Array(30).fill('P'),               // many columns dying in sequence
    'column-growth': Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 'B' : 'P')),
};
for (const [name, outcomes] of Object.entries(named)) {
    cases.push({ name, outcomes, numRows: outcomes.length + 5 });
}

// 2. Randomised sequences at realistic baccarat rates.
for (let seed = 1; seed <= 40; seed++) {
    const rnd = mulberry(seed * 7919);
    const len = 20 + Math.floor(rnd() * 60);
    const outcomes = Array.from({ length: len }, () => (rnd() < 0.4932 ? 'P' : 'B'));
    cases.push({ name: `random-seed-${seed}`, outcomes, numRows: len + 5 });
}

const fixtures = cases.map(({ name, outcomes, numRows }) => ({
    name,
    outcomes,
    numRows,
    expected: serialise(buildGrid(outcomes, numRows), outcomes.length),
}));

const out = process.argv[2] || path.resolve(__dirname, 'golden-master.json');
fs.writeFileSync(out, JSON.stringify({
    generatedFrom: 'useScorecardLogic.js @ 301f190 (calculateSingleRow md5 cd1045a2e0121f58997aa6a5b150fcad)',
    note: 'Rows are comma-joined displayValues. See grid.test.js for how `value` is rederived.',
    caseCount: fixtures.length,
    oddCells,
    cases: fixtures,
}));

const cells = fixtures.reduce((n, f) => n + f.expected.rows.length * f.expected.width, 0);
console.log(`wrote ${fixtures.length} cases, ${cells} frozen cells, ${oddCells} cells breaking the value<-displayValue rule`);
console.log(`-> ${out}`);
