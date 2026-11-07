require('dotenv').config({ override: true });
const http = require('http');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { initSocket } = require('./utils/socket');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const customerRoutes = require('./routes/customers');
const productRoutes = require('./routes/products');
const settingsRoutes = require('./routes/settings');
const syncRoutes = require('./routes/sync');
const billRoutes = require('./routes/bills');
const ledgerRoutes = require('./routes/ledger');
const reportRoutes = require('./routes/reports');

async function start() {
  await connectDB();

  const app = express();
  const server = http.createServer(app);
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  initSocket(server, origin);

  app.use(cors({ origin }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/bills', billRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/reports', reportRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  });

  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => {
    console.log(`AS-Store API listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
