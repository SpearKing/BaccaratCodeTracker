// scripts/simulate.js
//
// Scores a subset of rules over already-played hands:
//
//   npm run simulate -- /path/to/games.json
//   npm run simulate -- /path/to/games.json wiener-3,snake-box-2
//
// With no rules given it uses the five supplied ones. Runs through the app's
// own toolchain so the simulation uses the shipped engine, not a copy.

const { spawnSync } = require('child_process');
const path = require('path');

const dataPath = process.argv[2];
const rules = process.argv[3];

if (!dataPath) {
  console.error('Usage: npm run simulate -- /path/to/games.json [rule,rule,...]');
  console.error('Rules: wiener-3 wiener-4 wiener-5 snake-box-2 snake-box-3');
  console.error('       pattern rule-of-three-player rule-of-three-banker rule-of-three-alternating');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['react-scripts', 'test', '--testPathPattern', 'simulate', '--watchAll=false'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: 'true',
      SIM_DATA: path.resolve(dataPath),
      ...(rules ? { SIM_RULES: rules } : {}),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=8192`.trim(),
    },
  }
);
process.exit(result.status ?? 1);
