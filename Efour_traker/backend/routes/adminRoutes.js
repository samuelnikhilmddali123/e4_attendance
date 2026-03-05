const express = require('express');
const router = express.Router();
const {
    getEmployees,
    getDailyReports,
    getAnalytics,
    createEmployee,
    deleteEmployee,
    getLoginRequests,
    handleLoginRequest,
    forceLogoutAll,
    forceLogoutEmployee,
    getEmployeeStatuses,
    getProxyAttempts
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');

router.get('/employees', protect, admin, getEmployees);
router.get('/employees/status', protect, admin, getEmployeeStatuses);
router.get('/proxy-attempts', protect, admin, getProxyAttempts);
router.delete('/proxy-attempts/:id', protect, admin, deleteProxyAttempt);
router.delete('/proxy-attempts', protect, admin, clearAllProxyAttempts);
router.post('/employees', protect, admin, createEmployee);
router.delete('/employees/:emp_no', protect, admin, deleteEmployee);
router.get('/reports/daily', protect, admin, getDailyReports);
router.get('/analytics', protect, admin, getAnalytics);

router.get('/login-requests', protect, admin, getLoginRequests);
router.post('/handle-login-request/:id', protect, admin, handleLoginRequest);
router.post('/force-logout-all', protect, admin, forceLogoutAll);
router.post('/force-logout/:emp_no', protect, admin, forceLogoutEmployee);


module.exports = router;
