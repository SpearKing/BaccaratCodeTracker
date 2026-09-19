// scripts/backtest.js
//
// Runs the real-data backtest. Usage:
//   npm run backtest -- /path/to/games.json
//
// Delegates to jest (via react-scripts) because the engine modules are ES
// modules resolved the way the app resolves them; running them through the
// app's own toolchain is what guarantees the backtest measures the shipped
// engine rather than a copy of it.

const { spawnSync } = require('child_process');
const path = require('path');

const dataPath = process.argv[2];
if (!dataPath) {
  console.error('Usage: npm run backtest -- /path/to/games.json');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['react-scripts', 'test', '--testPathPattern', 'realDataBacktest', '--watchAll=false'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: 'true',
      BACKTEST_DATA: path.resolve(dataPath),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=8192`.trim(),
    },
  }
);

process.exit(result.status ?? 1);
