const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LoginRequest = require('../models/LoginRequest');
const jwt = require('jsonwebtoken');
const { getISTTime, getServerTime } = require('./utilsController');
const crypto = require('crypto');
const Session = require('../models/Session');

// @desc    Register a new employee
// @route   POST /api/auth/register
const registerEmployee = async (req, res) => {
    const { emp_no, name, email, password, role } = req.body;

    try {
        // Check if employee exists
        const existingEmp = await Employee.findOne({ $or: [{ emp_no }, { email }] });
        if (existingEmp) {
            return res.status(400).json({ message: 'Employee with this ID or email already exists' });
        }

        // Create employee (Mongoose middleware handles hashing)
        const employee = new Employee({
            emp_no,
            name,
            email,
            password,
            role: role || 'employee'
        });

        await employee.save();
        res.status(201).json({ message: 'Employee registered successfully' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// @desc    Login employee & get token
// @route   POST /api/auth/login
const loginEmployee = async (req, res) => {
    const { emp_no, password, device_info } = req.body;
    const cleanEmpNo = emp_no?.trim().toUpperCase();

    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(process.cwd(), 'auth_debug.log');
    const log = (msg) => {
        const entry = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(logFile, entry);
        console.log(msg);
    };

    try {
        log(`[AUTH-DEBUG] Attempting login for: "${emp_no}"`);

        let employee;
        try {
            employee = await Employee.findOne({
                $or: [
                    { emp_no: cleanEmpNo },
                    { email: emp_no?.toLowerCase().trim() }
                ]
            });
            log(`[AUTH-DEBUG] Employee found: ${!!employee}`);
        } catch (dbErr) {
            log(`[AUTH-ERROR] DB lookup fail: ${dbErr.message}`);
            throw dbErr;
        }

        if (!employee && cleanEmpNo === 'ADMIN001') {
            log('[AUTH-DEBUG] Seeding ADMIN001...');
            employee = await Employee.create({
                emp_no: 'ADMIN001',
                name: 'admin',
                full_name: 'EFOUR Administrator',
                email: 'admin@efour.com',
                password: 'efour123',
                role: 'admin',
                status: 'active'
            });
            log('[AUTH-DEBUG] Seed Success');
        }

        if (!employee) {
            log(`[AUTH-DEBUG] 401 User not found: ${cleanEmpNo}`);
            return res.status(401).json({ message: 'Invalid Employee ID' });
        }

        log(`[AUTH-DEBUG] Checking password...`);
        const isMatch = await employee.comparePassword(password);
        log(`[AUTH-DEBUG] Password result: ${isMatch}`);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        log(`[AUTH-DEBUG] IST Time...`);
        const istTimeNow = getISTTime();
        let isRestricted = false;
        
        if (employee.role === 'employee' && (new Date() >= istTimeNow.sevenPM || istTimeNow.hour >= 19)) {
            const approval = await LoginRequest.findOne({
               emp_no: employee.emp_no,
               status: 'Approved',
               expiry_time: { $gt: new Date() }
           });
           if (!approval) isRestricted = true;
        }

        log(`[AUTH-DEBUG] Signing token...`);
        const session_token = !isRestricted ? crypto.randomBytes(32).toString('hex') : null;
        const token = jwt.sign(
            { id: employee._id, emp_no: employee.emp_no, role: employee.role, session_token, isRestricted },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        log(`[AUTH-DEBUG] Saving attendance...`);
        const ist = getISTTime();
        if (!isRestricted) {
           try {
               await Attendance.updateMany({ emp_no: employee.emp_no, logout_time: null }, { $set: { logout_time: ist.timestamp, session_status: 'Forced Logout' }});
               await Attendance.create({
                   emp_no: employee.emp_no,
                   login_time: ist.timestamp,
                   date: ist.date,
                   session_status: 'Active',
                   device_info: device_info || 'Unknown'
               });
               log(`[AUTH-DEBUG] Attendance saved`);
           } catch (e) { log(`[AUTH-ERROR] Attendance fail: ${e.message}`); }
        }

        log(`[AUTH-DEBUG] Success`);
        res.json({ 
            token, 
            session_token, 
            isRestricted, 
            user: { 
                emp_no: employee.emp_no, 
                role: employee.role,
                is_face_enabled: employee.is_face_enabled || false,
                face_descriptor: employee.face_descriptor || []
            } 
        });
    } catch (error) {
        log(`[AUTH-FATAL] ${error.message}\n${error.stack}`);
        res.status(500).json({ message: 'Server error during login', error: error.message, stack: error.stack });
    }
};

// @desc    Logout employee
// @route   POST /api/auth/logout
const logoutEmployee = async (req, res) => {
    const { emp_no } = req.user;

    try {
        const istTime = getISTTime();
        const nowStr = istTime.datetime;
        const today = istTime.date;

        // Find and close the latest active attendance record
        const record = await Attendance.findOne({
            emp_no,
            date: today,
            logout_time: null
        }).sort({ login_time: -1 });

        let duration = null;
        if (record) {
            record.logout_time = nowStr;
            record.session_status = 'Completed';
            record.logout_reason = 'User Logout';
            await record.save();

            // Calculate duration correctly
            const loginTime = new Date(record.login_time);
            const logoutTime = new Date(nowStr);
            const diffMs = logoutTime - loginTime;

            if (diffMs > 0) {
                const diffHrs = Math.floor(diffMs / 3600000);
                const diffMins = Math.floor((diffMs % 3600000) / 60000);
                duration = {
                    hours: diffHrs,
                    minutes: diffMins,
                    formatted: `${diffHrs}h ${diffMins}m`
                };
            }
        }

        res.json({
            message: 'Logged out successfully',
            duration: duration
        });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({
            message: 'Server error during logout',
            error: error.message
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/password
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { emp_no } = req.user;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const isMatch = await employee.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        employee.password = newPassword; // Mongoose middleware will hash this
        await employee.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({
            message: 'Server error during password change',
            error: error.message
        });
    }
};

// @desc    Request login permission after hours
// @route   POST /api/auth/login-request
const requestLoginPermission = async (req, res) => {
    const { emp_no, reason, device_info } = req.body;
    const cleanEmpNo = emp_no?.trim().toUpperCase();

    try {
        const employee = await Employee.findOne({ emp_no: cleanEmpNo });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Check for existing pending request
        const existingRequest = await LoginRequest.findOne({
            emp_no: cleanEmpNo,
            status: 'Pending'
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending login request.' });
        }

        const loginRequest = new LoginRequest({
            emp_no: cleanEmpNo,
            reason: reason || 'Late work requirement',
            device_info: device_info || 'Unknown'
        });

        await loginRequest.save();
        res.status(201).json({ message: 'Login request submitted successfully. Please wait for admin approval.' });
    } catch (error) {
        console.error('Login Request Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { registerEmployee, loginEmployee, logoutEmployee, changePassword, requestLoginPermission };

