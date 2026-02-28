const express = require('express');
const router = express.Router();
const { getWifiSettings, updateWifiSettings } = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/auth');

// Public route for mobile app to verify before login
router.get('/wifi', getWifiSettings);

// Admin route to update the required Wi-Fi network
router.put('/wifi', protect, admin, updateWifiSettings);

module.exports = router;
