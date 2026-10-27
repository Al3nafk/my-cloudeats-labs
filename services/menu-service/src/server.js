const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'menu-service', port: 3002 })
);

const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'db',
  user:     process.env.DB_USER     || 'cloudeats_user',
  password: process.env.DB_PASSWORD || 'cloudeats_password',
  database: process.env.DB_NAME     || 'cloudeats_db',
});

// GET /api/menu
app.get('/api/menu', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu_items ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    console.error('Menu error:', err.message);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// GET /api/menu/category/:cat
app.get('/api/menu/category/:cat', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM menu_items WHERE category = ? ORDER BY name',
      [req.params.cat]
    );
    res.json(rows);
  } catch (err) {
    console.error('Menu category error:', err.message);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// GET /api/menu/:id
app.get('/api/menu/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Menu item error:', err.message);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// ===== RATING VALIDATION (add above app.listen) =====
function validateRating(rating) {
  if (rating === undefined || rating === null) {
    return { valid: false, error: 'Rating is required' };
  }
  if (typeof rating !== 'number') {
    return { valid: false, error: 'Rating must be a number' };
  }
  if (!Number.isInteger(rating)) {
    return { valid: false, error: 'Rating must be a whole number' };
  }
  if (rating < 1 || rating > 5) {
    return { valid: false, error: 'Rating must be between 1 and 5' };
  }
  return { valid: true };
}

// ===== START SERVER (skip during tests) =====
// Jest sets NODE_ENV=test automatically, only start listening otherwise
const PORT = process.env.PORT || 3002;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () =>
    console.log(`[menu-service] Running on http://localhost:${PORT}`)
  );
}

// ===== EXPORT FOR TESTING =====
// Only exports when Jest sets NODE_ENV=test
// Production server is unaffected
if (process.env.NODE_ENV === 'test') {
  module.exports = { validateRating };
}
