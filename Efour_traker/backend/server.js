const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ULTRA MINIMAL DIAGNOSTIC
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mode: 'ULTRA-MINIMAL-DEBUG',
        time: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send('Minimal API is running');
});

// STUBS
app.set('io', { to: () => ({ emit: () => { } }) });

module.exports = app;
