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

// --- NEW: CORS Configuration for Production ---
// Add the URL where you deployed your frontend (e.g., on Netlify, Vercel)
const whitelist = [
  'http://localhost:3000', // For local development
  'https://baccaratcodetracker.netlify.app' // <<-- IMPORTANT: REPLACE THIS WITH YOUR ACTUAL DEPLOYED FRONTEND URL
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

app.use(cors(corsOptions)); // Use the new configuration
app.use(express.json());

// --- API Endpoints (No changes needed below) ---

// GET endpoint to load all saved games
app.get('/api/games', async (req, res) => {
  try {
    const result = await pool.query('SELECT name, data FROM scorecards');
    const games = result.rows.reduce((acc, row) => {
      acc[row.name] = row.data;
      return acc;
    }, {});
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST endpoint to save or update a game
app.post('/api/games', async (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) {
    return res.status(400).send('Missing name or data');
  }

  const query = `
    INSERT INTO scorecards (name, data)
    VALUES ($1, $2)
    ON CONFLICT (name)
    DO UPDATE SET data = EXCLUDED.data;
  `;

  try {
    await pool.query(query, [name, data]);
    res.status(200).send('Game saved successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// DELETE endpoint to delete a game
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