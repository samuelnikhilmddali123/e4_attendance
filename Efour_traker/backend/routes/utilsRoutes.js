const express = require('express');
const router = express.Router();
const { getServerTime } = require('../controllers/utilsController');

router.get('/time', getServerTime);

module.exports = router;
