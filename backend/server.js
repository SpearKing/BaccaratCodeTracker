// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3001; // Port for the backend server

// Create a new pool of connections to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Allow the server to parse JSON bodies

// --- API Endpoints ---

// GET endpoint to load all saved games
app.get('/api/games', async (req, res) => {
  try {
    const result = await pool.query('SELECT name, data FROM scorecards');
    // Convert the array of results into an object, like the original localStorage structure
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

  // This SQL command will UPDATE a game if it exists, or INSERT it if it doesn't.
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
  try {
    await pool.query('DELETE FROM scorecards WHERE name = $1', [name]);
    res.status(200).send('Game deleted successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});