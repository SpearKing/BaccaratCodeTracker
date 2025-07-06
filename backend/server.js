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