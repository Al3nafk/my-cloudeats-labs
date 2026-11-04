const express = require('express');
const { MongoClient } = require('mongodb');
const redis   = require('redis');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const CART_TTL = parseInt(process.env.CART_TTL || '3600', 10);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'order-service', port: 3003 })
);

// MongoDB connection (orders), retries until Mongo is ready
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017';
const mongoClient = new MongoClient(MONGO_URL);
let ordersDb = null;

async function connectMongo() {
  for (let i = 1; i <= 20; i++) {
    try {
      await mongoClient.connect();
      ordersDb = mongoClient.db('cloudeats_db');
      console.log('[order-service] MongoDB connected');
      return;
    } catch (err) {
      console.log(`[order-service] MongoDB not ready (attempt ${i}): ${err.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('[order-service] MongoDB connection failed');
}
connectMongo();

// Redis connection (cart)
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('[order-service] Redis error:', err.message));
redisClient.connect().then(() => console.log('[order-service] Redis connected'));

const cartKey = (userId) => `cart:user${userId}`;
const calcTotal = (items) =>
  Math.round(items.reduce((sum, i) => sum + i.qty * i.price, 0) * 100) / 100;

// GET /api/cart/:userId
app.get('/api/cart/:userId', async (req, res) => {
  try {
    const raw = await redisClient.get(cartKey(req.params.userId));
    res.json(raw ? JSON.parse(raw) : { items: [], total: 0 });
  } catch (err) {
    console.error('Get cart error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// POST /api/cart/:userId/items   body: { name, qty, price }
app.post('/api/cart/:userId/items', async (req, res) => {
  const { name, qty, price } = req.body;
  if (!name || !qty || price === undefined) {
    return res.status(400).json({ error: 'name, qty and price are required' });
  }

  try {
    const key = cartKey(req.params.userId);
    const raw = await redisClient.get(key);
    const cart = raw ? JSON.parse(raw) : { items: [], total: 0 };

    const existing = cart.items.find(i => i.name === name);
    if (existing) {
      existing.qty += Number(qty);
    } else {
      cart.items.push({ name, qty: Number(qty), price: Number(price) });
    }
    cart.total = calcTotal(cart.items);

    await redisClient.set(key, JSON.stringify(cart), { EX: CART_TTL });
    res.status(201).json(cart);
  } catch (err) {
    console.error('Add to cart error:', err.message);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// POST /api/orders   body: { customerName?, deliveryAddress?, items? }
// If items is omitted, the order is built from the user's Redis cart.
app.post('/api/orders', async (req, res) => {
  const { customerName, deliveryAddress } = req.body;
  let { items } = req.body;

  // Identity comes from the gateway (verified JWT), never from the body
  const userId = Number(req.headers['x-user-id']);
  if (!userId) {
    return res.status(400).json({ error: 'Missing x-user-id — call this service through the gateway' });
  }
  if (!ordersDb) {
    return res.status(503).json({ error: 'Order database not ready' });
  }

  // Cross-service call: verify the user exists in User Service
  try {
    const userRes = await fetch(`http://user-service:3001/api/users/${userId}`);
    if (!userRes.ok) {
      return res.status(404).json({
        error: 'User not found',
        hint: 'Order Service checked User Service'
      });
    }
  } catch (err) {
    return res.status(503).json({ error: 'User Service unreachable' });
  }

  try {
    if (!items) {
      const raw = await redisClient.get(cartKey(userId));
      items = raw ? JSON.parse(raw).items : [];
    }
    if (!items.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const order = {
      userId: Number(userId),
      customerName: customerName || null,
      items,
      total: calcTotal(items),
      status: 'pending',
      deliveryAddress: deliveryAddress || null,
      statusHistory: [{ status: 'pending', at: new Date() }],
      placedAt: new Date()
    };

    const result = await ordersDb.collection('orders').insertOne(order);
    await redisClient.del(cartKey(userId));

    res.status(201).json({
      message: 'Order placed',
      orderId: result.insertedId,
      total: order.total
    });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET /api/orders/user/:userId
app.get('/api/orders/user/:userId', async (req, res) => {
  if (!ordersDb) {
    return res.status(503).json({ error: 'Order database not ready' });
  }
  try {
    const orders = await ordersDb.collection('orders')
      .find({ userId: Number(req.params.userId) })
      .sort({ placedAt: -1 })
      .toArray();
    res.json(orders);
  } catch (err) {
    console.error('Get orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () =>
  console.log(`[order-service] Running on http://localhost:${PORT}`)
);
