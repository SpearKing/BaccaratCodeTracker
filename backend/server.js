// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const whitelist = [
  'http://localhost:3000',
  'https://baccaratcodetracker.netlify.app'
];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// GET endpoint - Now also fetches stats
app.get('/api/games', async (req, res) => {
  try {
    const result = await pool.query('SELECT name, data, stats FROM scorecards');
    const games = result.rows.reduce((acc, row) => {
      acc[row.name] = { ...row.data, stats: row.stats }; // Combine data and stats
      return acc;
    }, {});
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST endpoint - Now also saves stats
app.post('/api/games', async (req, res) => {
  const { name, data, stats } = req.body;
  if (!name || !data) {
    return res.status(400).send('Missing name or data');
  }

  const query = `
    INSERT INTO scorecards (name, data, stats)
    VALUES ($1, $2, $3)
    ON CONFLICT (name)
    DO UPDATE SET data = EXCLUDED.data, stats = EXCLUDED.stats;
  `;

  try {
    await pool.query(query, [name, data, stats]);
    res.status(200).send('Game saved successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// --- Decision log ----------------------------------------------------------
//
// Append-only. The client keeps its own copy in localStorage and pushes here
// opportunistically, so this endpoint has to tolerate the same entry arriving
// more than once -- hence ON CONFLICT DO NOTHING against the dedupe index.

app.post('/api/predictions', async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).send('Expected an array of entries');
  }
  if (entries.length === 0) {
    return res.status(200).json({ inserted: 0 });
  }

  const query = `
    INSERT INTO predictions
      (schema_version, engine_version, card, hand_index, predicted,
       confidence, source, pattern, actual, history, decided_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT DO NOTHING;
  `;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const e of entries) {
      const result = await client.query(query, [
        e.v ?? 1, e.engine, e.card ?? null, e.hand, e.predicted ?? null,
        e.confidence ?? null, e.source ?? null, e.pattern ?? null,
        e.actual, e.history ?? null, e.at,
      ]);
      inserted += result.rowCount;
    }
    await client.query('COMMIT');
    res.status(200).json({ inserted, received: entries.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    client.release();
  }
});

app.get('/api/predictions', async (req, res) => {
  const { engine, limit } = req.query;
  try {
    const result = engine
      ? await pool.query(
          'SELECT * FROM predictions WHERE engine_version = $1 ORDER BY decided_at DESC LIMIT $2',
          [engine, Math.min(Number(limit) || 5000, 50000)]
        )
      : await pool.query(
          'SELECT * FROM predictions ORDER BY decided_at DESC LIMIT $1',
          [Math.min(Number(limit) || 5000, 50000)]
        );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// DELETE endpoint - No changes needed here
app.delete('/api/games/:name', async (req, res) => {
  const { name } = req.params;
  const decodedName = decodeURIComponent(name);
  try {
    await pool.query('DELETE FROM scorecards WHERE name = $1', [decodedName]);
    res.status(200).send('Game deleted successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});