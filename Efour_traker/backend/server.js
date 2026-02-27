const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const connectDB = require('./config/db');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
                return callback(null, true);
            }
            callback(null, false);
        },
        credentials: true
    }
});

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
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
            return callback(null, true);
        }
        callback(null, false);
    },
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.0-FIX',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

// DEBUG/FIX ENDPOINT: Seed admin from browser if scripts fail
app.get('/api/debug/seed-admin', async (req, res) => {
    console.log('[DEBUG] Manual seed requested via browser');
    try {
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
    } catch (err) {
        console.error('[DEBUG] Seed fail:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/utils', require('./routes/utilsRoutes'));

app.get('/', (req, res) => {
    res.send('EFOUR Work Monitoring API is running...');
});

// Socket.io setup (Make io available in routes)
app.set('io', io);
io.on('connection', (socket) => {
    socket.on('join_room', (emp_no) => socket.join(emp_no));
});

// Initialize Scheduler
require('./scheduler')(io);

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`EFOUR Server running on port ${PORT}`);
});
