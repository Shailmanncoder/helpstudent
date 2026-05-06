const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ── Global crash protection ──────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[CRASH] Uncaught Exception:', err.message);
    console.error(err.stack);
    // Keep running — don't exit on non-fatal errors
});

process.on('unhandledRejection', (reason) => {
    console.error('[CRASH] Unhandled Promise Rejection:', reason?.message || String(reason));
    // Keep running
});

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const authRoutes    = require('./controllers/authController');
const userRoutes    = require('./controllers/userController');
const aiRoutes      = require('./controllers/aiController');
const paymentRoutes = require('./controllers/paymentController');

app.use('/api/auth',    authRoutes);
app.use('/api/user',    userRoutes);
app.use('/api/ai',      aiRoutes);
app.use('/api/payment', paymentRoutes);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// ── Express error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[EXPRESS ERROR]', err.stack);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ── Start server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${PORT} already in use. Another instance may be running.`);
    } else {
        console.error('[SERVER ERROR]', err.message);
    }
});
