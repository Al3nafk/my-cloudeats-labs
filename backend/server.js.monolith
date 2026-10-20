const express = require('express');
const cors    = require('cors');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));        // Serve HTML/CSS from /public

// ── HEALTH CHECK ───────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cloudeats-backend' });
});

// ── GET ALL MENU ITEMS ──────────────────────────────
app.get('/api/menu', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu_items ORDER BY category, name');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Menu fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load menu' });
  }
});

// ── GET MENU BY CATEGORY ───────────────────────────
app.get('/api/menu/category/:category', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM menu_items WHERE category = ? ORDER BY name',
      [req.params.category]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`CloudEats backend running on port ${PORT}`));

// Add this near the top, after existing requires:
const authRoutes = require('./auth');

// Add this after app.use(express.json()):
app.use('/api/auth', authRoutes);

// Your routes are now:
//   POST /api/auth/register  ← new
//   POST /api/auth/login     ← new
//   GET  /api/menu           ← existing