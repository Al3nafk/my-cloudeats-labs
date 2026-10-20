const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'db',         // Service name in docker-compose.yml
  user:             process.env.DB_USER     || 'cloudeats_user',
  password:         process.env.DB_PASSWORD || 'cloudeats_password',
  database:         process.env.DB_NAME     || 'cloudeats_db',
  waitForConnections: true,
  connectionLimit:    10,    // Max 10 simultaneous DB operations
  queueLimit:         0     // Queue unlimited requests (0 = no limit)
});

// Test the pool at startup — logs an error if MySQL is unreachable
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected — pool ready');
    conn.release();
  })
  .catch(err => console.error('❌ MySQL connection error:', err.message));

module.exports = pool;