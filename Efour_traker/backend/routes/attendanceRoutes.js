const express = require('express');
const router = express.Router();
const { getAttendanceHistory, getEmployeeAttendanceForAdmin, getWorkDuration, pingWiFi } = require('../controllers/attendanceController');
const { protect, admin } = require('../middleware/auth');

router.get('/history', protect, getAttendanceHistory);
router.get('/duration', protect, getWorkDuration);
router.post('/ping', protect, pingWiFi);
router.get('/admin/history/:emp_no', protect, admin, getEmployeeAttendanceForAdmin);

module.exports = router;
