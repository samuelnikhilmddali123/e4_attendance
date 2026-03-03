const express = require('express');
const router = express.Router();
const { getServerTime } = require('../controllers/utilsController');
const { heartbeat } = require('../controllers/statusController');
const { protect } = require('../middleware/auth');

router.get('/time', getServerTime);
router.post('/heartbeat', protect, heartbeat);

module.exports = router;
