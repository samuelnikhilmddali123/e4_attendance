const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
<<<<<<< HEAD
=======
const http = require('http');
const cookieParser = require('cookie-parser');
const { Server } = require("socket.io");
>>>>>>> 9d3833c (feat: implement webview session persistence with httponly cookies)
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

<<<<<<< HEAD
// 1. Hardened CORS for production/localhost testing
=======
// Connect to Database and Seed/Fix Admin
connectDB().then(async () => {
    console.log('[SYSTEM] MongoDB Connected Successfully');
    try {
        const Employee = require('./models/Employee');

        // Find ADMIN001 and always reset password to 'efour123' to ensure login works
        let admin = await Employee.findOne({ emp_no: 'ADMIN001' });

        if (!admin) {
            console.log('[SEED] Creating fresh ADMIN001...');
            await Employee.create({
                emp_no: 'ADMIN001',
                name: 'admin',
                full_name: 'EFOUR Administrator',
                email: 'admin@efour.com',
                password: 'efour123',
                role: 'admin',
                status: 'active'
            });
            console.log('[SEED] ✅ Admin created: ADMIN001 / efour123');
        } else {
            console.log('[SEED] Resetting ADMIN001 password to ensure connectivity...');
            admin.password = 'efour123'; // Pre-save hook will hash this
            await admin.save();
            console.log('[SEED] ✅ ADMIN001 password reset to: efour123');
        }
    } catch (err) {
        console.error('[SEED] Seeding Error:', err.message);
    }
}).catch(err => {
    console.error('[SYSTEM] ❌ DB Connection Failed:', err.message);
});

// Middleware
>>>>>>> 9d3833c (feat: implement webview session persistence with httponly cookies)
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
app.use(cookieParser());
app.use(morgan('dev'));

// 3. Database Connection Middleware (Ensures warm connection on every serverless invocation)
app.use(async (req, res, next) => {
    try {
<<<<<<< HEAD
        await connectDB();
        next();
=======
        const Employee = require('./models/Employee');

        // Remove existing to force a re-save with new hash
        await Employee.deleteOne({ emp_no: 'ADMIN001' });

        const admin = await Employee.create({
            emp_no: 'ADMIN001',
            name: 'admin',
            full_name: 'EFOUR Administrator',
            email: 'admin@efour.com',
            password: 'efour123', // Model handles hashing
            role: 'admin',
            status: 'active'
        });

        res.json({ success: true, message: 'Admin recreated with correct password', admin_id: admin.emp_no });
>>>>>>> 9d3833c (feat: implement webview session persistence with httponly cookies)
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
