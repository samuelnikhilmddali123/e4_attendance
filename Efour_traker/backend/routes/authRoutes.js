const express = require('express');
const router = express.Router();
const { registerEmployee, loginEmployee, logoutEmployee, changePassword, getMe, refreshToken, logProxyAttempt } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerEmployee);
router.post('/login', loginEmployee);
router.post('/proxy-attempt', logProxyAttempt);
router.get('/login', (req, res) => {
    res.json({
        message: 'Login endpoint is active. Please use POST method with emp_no and password.',
        status: 'active'
    });
});
router.post('/refresh', refreshToken);
router.post('/logout', protect, logoutEmployee);
router.put('/password', protect, changePassword);
router.get('/me', protect, getMe);

module.exports = router;

