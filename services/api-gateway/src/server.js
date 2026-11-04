const express      = require('express');
const cors         = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt          = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[api-gateway] JWT_SECRET is not set — exiting');
  process.exit(1);
}

const app = express();
app.use(cors());
// Do NOT add express.json() here. It would consume the request body and
// the proxied POST/PUT requests would hang. The gateway only forwards bytes.

// Service URLs (Docker Compose DNS names)
const SERVICES = {
  user:  process.env.USER_SERVICE_URL  || 'http://user-service:3001',
  menu:  process.env.MENU_SERVICE_URL  || 'http://menu-service:3002',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
};

// Health check for the gateway itself
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'api-gateway', port: 8000, version: '1.1', routes: SERVICES })
);

// Proxy factory helper
function proxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // app.use('/api/menu', ...) strips '/api/menu' from req.url, but our services
    // define full paths (/api/menu/...). Put the original URL back.
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        res.status(503).json({
          error: 'Upstream service unavailable',
          target,
          detail: err.message
        });
      }
    }
  });
}

// ── 1. Who are you? Verify the JWT ──
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    req.user = decoded;   // { userId, email, name, iat, exp }

    // Tell the services who is calling. This OVERWRITES any x-user-id the
    // client tried to send, so it cannot be forged.
    req.headers['x-user-id']    = String(decoded.userId);
    req.headers['x-user-email'] = String(decoded.email);
    next();
  });
}

// ── 2. Is this YOUR data? Compare token user with the :userId in the URL ──
function requireSelf(req, res, next) {
  if (String(req.user.userId) !== req.params.userId) {
    return res.status(403).json({
      error: 'Access denied. You can only access your own data.'
    });
  }
  next();
}

// ROUTE TABLE

// Public
app.use('/api/auth', proxy(SERVICES.user));    // register + login
app.use('/api/menu', proxy(SERVICES.menu));    // anyone may browse

// Protected: valid token AND must be your own id
app.use('/api/users/:userId',       authenticateToken, requireSelf, proxy(SERVICES.user));
app.use('/api/cart/:userId',        authenticateToken, requireSelf, proxy(SERVICES.order));
app.use('/api/orders/user/:userId', authenticateToken, requireSelf, proxy(SERVICES.order));

// Protected: valid token (the order-service reads the user from x-user-id)
app.use('/api/orders',              authenticateToken, proxy(SERVICES.order));

// 404 for unknown routes
app.use((req, res) =>
  res.status(404).json({
    error:           'Route not found in gateway',
    requestedPath:   req.path,
    availableRoutes: ['/api/auth', '/api/users', '/api/menu', '/api/cart', '/api/orders']
  })
);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`[api-gateway] Listening on :${PORT}`);
  console.log(`  /api/auth    -> ${SERVICES.user}`);
  console.log(`  /api/menu    -> ${SERVICES.menu}`);
  console.log(`  /api/orders  -> ${SERVICES.order}`);
});
