const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// 1. Hardened CORS for production/localhost testing
app.use(cors({
    origin: true, // Mirror request origin (best for localhost + deployment)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200
}));

// Explicitly handle OPTIONS preflight
app.options('*', cors());

// 2. Global Request Logger 
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use(express.json());
app.use(morgan('dev'));

// 3. Database Connection Middleware (Ensures warm connection on every serverless invocation)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('[SYSTEM] DB Connection Error during request:', err.message);
        return res.status(503).json({
            message: 'Database is currently unavailable. Please wait 10 seconds and try again.',
            error: err.message
        });
    }
});

// 4. Diagnostic/Health route
app.get('/api/health', (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    res.json({
        status: 'ok',
        version: '6.1-HYBRID-NET',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        node: process.version,
        time: new Date().toISOString(),
        client_ip: clientIp
    });
});

// 5. API Routes - Explicitly mapped
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/utils', require('./routes/utilsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

// Root route
app.get('/', (req, res) => {
    res.send('EFOUR Work Monitoring API (Serverless Ready - Production Mode)');
});

// Socket.io Stub to prevent crashes in inherited code
app.set('io', {
    to: () => ({
        emit: () => { } // Silent stub
    }),
    emit: () => { }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// Error Handler
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    console.error(`[ERROR] ${err.message}\n${err.stack}`);
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
});

// Export for Vercel
module.exports = app;
