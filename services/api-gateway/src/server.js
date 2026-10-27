const express      = require('express');
const cors         = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

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
  res.json({ status: 'ok', service: 'api-gateway', port: 8000, routes: SERVICES })
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

// ROUTE TABLE

// User Service
app.use('/api/auth',   proxy(SERVICES.user));
app.use('/api/users',  proxy(SERVICES.user));   // Week 8: add authenticateToken

// Menu Service (public, browsing doesn't need login)
app.use('/api/menu',   proxy(SERVICES.menu));

// Order Service
app.use('/api/cart',   proxy(SERVICES.order));  // Week 8: add authenticateToken
app.use('/api/orders', proxy(SERVICES.order));  // Week 8: add authenticateToken

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
