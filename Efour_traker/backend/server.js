const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// Basic Middleware
app.use(express.json());
app.use(morgan('dev'));

// CORS - Standard serverless configuration
app.use(cors({
    origin: true,
    credentials: true
}));

// Global Request Logger for Vercel Debugging
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

// Warm-up database middleware
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('[SYSTEM] DB Error during request:', err.message);
        res.status(503).json({
            message: 'Database is momentarily unavailable. Please retry.',
            error: err.message
        });
    }
});

// Diagnostic/Health route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '4.0-VERCEL-SAFE',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        node: process.version
    });
});

// API Routes - Explicitly mapped
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/utils', require('./routes/utilsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

// Root route
app.get('/', (req, res) => {
    res.send('EFOUR Work Monitoring API (Serverless Ready)');
});

// Socket.io Stub to prevent crashes in inherited code
app.set('io', {
    to: () => ({
        emit: () => { } // Silent stub
    })
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// Error Handler
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
});

// Export for Vercel
module.exports = app;
