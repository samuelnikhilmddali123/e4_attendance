const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins in production for ease, or restrict to FRONTEND_URL
        callback(null, true);
    },
    credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

// Database Connection Middleware
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(503).json({
            message: 'Database connection failed',
            error: err.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '3.0-SERVERLESS',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        env: {
            MONGODB_URI: !!process.env.MONGODB_URI,
            JWT_SECRET: !!process.env.JWT_SECRET
        }
    });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/utils', require('./routes/utilsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

app.get('/', (req, res) => {
    res.send('EFOUR Work Monitoring API is running (Serverless Mode)');
});

// Socket.io Stub for Serverless 
// (Real-time features like 'force_logout' will not work on Vercel Free)
app.set('io', {
    to: () => ({
        emit: () => console.log('[SOCKET-STUB] Emit called (Not supported in Serverless)')
    })
});

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`EFOUR Local Server running on port ${PORT}`);
    });
}

// Export the app for Vercel
module.exports = app;
