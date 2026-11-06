require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const ensureStockViews = require('./db/ensureStockViews');

const PORT = process.env.PORT || 5001;

const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Vercel production domain
  'https://quan-ly-kho-hang-vnqv.vercel.app',
];
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : defaultOrigins;

// Regex cho phép toàn bộ subdomain *.vercel.app (mọi link deploy chính thức, preview, v.v. của Vercel)
const vercelPreviewRegex = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;

app.use(
  cors({
    origin(origin, callback) {
      // Cho phép không có origin (server-to-server, Postman, curl)
      if (!origin) return callback(null, true);
      // Cho phép các origin trong whitelist
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Cho phép mọi subdomain *.vercel.app (Server Actions của Vercel)
      if (vercelPreviewRegex.test(origin)) return callback(null, true);
      // Local dev: cho phép tất cả
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());

// Basic health check route
app.get('/api/health', async (req, res) => {
  try {
    // Simple test query to database
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      message: 'WMS Express Backend is running and connected to Neon Database.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to connect to database.',
      error: error.message
    });
  }
});

// Register routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const locationRoutes = require('./routes/locationRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const importRoutes = require('./routes/importRoutes');
const exportRoutes = require('./routes/exportRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Logistics & Supply Chain WMS API');
});

const { createServer } = require('http');
const { Server } = require('socket.io');

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

async function startServer() {
  try {
    await ensureStockViews(prisma);
    console.log('Stock views are ready.');
  } catch (error) {
    console.error('Failed to prepare stock views:', error);
  }

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();

module.exports = { app, prisma, io };
