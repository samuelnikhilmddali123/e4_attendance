const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getISTTime, getServerTime } = require('./utilsController');
const crypto = require('crypto');
const Session = require('../models/Session');
const Settings = require('../models/Settings');
const ProxyAttempt = require('../models/ProxyAttempt');

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
    const { emp_no, password, device_info, wifi_ssid } = req.body;
    const cleanEmpNo = emp_no?.trim().toUpperCase();

    const log = (msg) => {
        console.log(`[AUTH-DEBUG] ${msg}`);
    };

    try {
        log(`Attempting login for: "${emp_no}"`);
        log(`DB State: ${mongoose.connection.readyState}`);


        if (mongoose.connection.readyState !== 1) {
            log(`[AUTH-ERROR] Database not ready. State: ${mongoose.connection.readyState}`);
            return res.status(503).json({ message: 'Database initialization in progress. Please retry in 5 seconds.' });
        }

        let employee;
        try {
            // Use a lean query with a manual timeout for max safety
            employee = await Employee.findOne({
                $or: [
                    { emp_no: cleanEmpNo },
                    { email: emp_no?.toLowerCase().trim() }
                ]
            }).maxTimeMS(5000);
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
                status: 'offline' // Fixed: Use 'offline' instead of 'active' to match schema enum
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

        // --- WiFi / Network Restriction Check ---
        if (employee.role !== 'admin') {
            try {
                const settings = await Settings.findOne();
                const allowedSsid = settings?.office_wifi_ssid;
                const allowedIp = settings?.office_public_ip;

                // Detect Client IP (Vercel uses x-forwarded-for)
                const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();
                log(`[AUTH-NETWORK] Client IP: ${clientIp}, SSID: ${wifi_ssid || 'NONE'}`);

                // 1. If SSID is provided (Native App), prioritize SSID check
                if (wifi_ssid) {
                    if (allowedSsid && allowedSsid !== 'Your_Office_WiFi_Name' && allowedSsid !== 'Efour_Net') {
                        if (wifi_ssid.trim() !== allowedSsid.trim()) {
                            log(`[AUTH-DENIED] SSID mismatch. Expected: "${allowedSsid}", Received: "${wifi_ssid}"`);
                            return res.status(403).json({
                                message: 'Login Denied: You must be connected to the authorized Office Wi-Fi network.',
                                debug_info: { error: 'SSID_MISMATCH', expected: allowedSsid.trim(), received: wifi_ssid.trim() }
                            });
                        }
                    }
                }
                // 2. If NO SSID is provided (Browser), fallback to Public IP check
                else if (allowedIp && allowedIp.trim() !== '') {
                    // Note: IPv6 and IPv4 compatibility
                    if (clientIp !== allowedIp.trim()) {
                        log(`[AUTH-DENIED] IP mismatch. Expected: "${allowedIp}", Received: "${clientIp}"`);
                        return res.status(403).json({
                            message: 'Login Denied: Unauthorized network. Mobile browser users must be on Office WiFi.',
                            debug_info: {
                                error: 'IP_MISMATCH',
                                expected: allowedIp.trim(),
                                received: clientIp,
                                tip: 'SSID cannot be detected in browsers. Your Public IP must match the Office IP.'
                            }
                        });
                    }
                }
            } catch (settingsErr) {
                log(`[AUTH-WARN] Network settings lookup failed: ${settingsErr.message}`);
            }
        }
        // ------------------------------------

        log(`[AUTH-DEBUG] IST Time...`);
        const istTimeNow = getISTTime();

        log(`[AUTH-DEBUG] Signing token...`);
        const session_token = crypto.randomBytes(32).toString('hex');
        const token = jwt.sign(
            { id: employee._id, emp_no: employee.emp_no, role: employee.role, session_token, isRestricted: false },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '15m' } // Short-lived Access Token
        );

        const ist = getISTTime();
        try {
            await Attendance.updateMany({ emp_no: employee.emp_no, logout_time: null }, { $set: { logout_time: ist.timestamp, session_status: 'Forced Logout' } });

            const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();

            await Attendance.create({
                emp_no: employee.emp_no,
                login_time: ist.timestamp,
                date: ist.date,
                session_status: 'Active',
                device_info: device_info || 'Unknown',
                wifi_ip: clientIp,
                is_on_wifi: true,
                last_ping: Date.now(),
                wifi_history: [{ status: 'Connected', timestamp: Date.now() }]
            });

            // Deactivate old sessions and create a new session record
            await Session.updateMany({ emp_no: employee.emp_no, is_active: true }, { $set: { is_active: false } });
            await Session.create({
                emp_no: employee.emp_no,
                session_token: session_token,
                device_info: device_info || 'Unknown'
            });

            log(`[AUTH-DEBUG] Attendance & Session saved`);
        } catch (e) { log(`[AUTH-ERROR] Attendance fail: ${e.message}`); }

        log(`[AUTH-DEBUG] Success`);

        // Set persistent HTTP-only cookie with the long-lived refresh token
        res.cookie('refresh_token', session_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 Days
        });
        res.json({
            token,
            session_token,
            user: {
                emp_no: employee.emp_no,
                role: employee.role,
                is_face_enabled: employee.is_face_enabled || false,
                face_descriptor: employee.face_descriptor || []
            }
        });
    } catch (error) {
        log(`[AUTH-FATAL] ${error.message}\n${error.stack}`);
        // Return structured error info to help debug 500s on Vercel
        res.status(500).json({
            message: 'Server error during login',
            error: error.message,
            stack: error.stack,
            at: new Date().toISOString()
        });
    }
};

// @desc    Get current logged in user details from cookie/token
// @route   GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const employee = await Employee.findById(req.user.id).select('-password');
        if (!employee) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            user: {
                emp_no: employee.emp_no,
                role: employee.role,
                name: employee.name,
                full_name: employee.full_name,
                email: employee.email,
                profile_picture: employee.profile_picture,
                is_face_enabled: employee.is_face_enabled || false,
                face_descriptor: employee.face_descriptor || []
            }
        });
    } catch (error) {
        console.error('Get Me Error:', error);
        res.status(500).json({ message: 'Server error' });
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

        // Deactivate session
        if (req.user && req.user.session_token) {
            await Session.updateOne(
                { session_token: req.user.session_token },
                { $set: { is_active: false } }
            );
        }

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        });

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

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
const refreshToken = async (req, res) => {
    try {
        const sessionToken = req.cookies.refresh_token;

        if (!sessionToken) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        // Validate session
        const session = await Session.findOne({ session_token: sessionToken, is_active: true });

        if (!session) {
            // Session revoked or invalid, clear the cookie
            res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none' });
            return res.status(401).json({ message: 'Session expired or invalid' });
        }

        const employee = await Employee.findOne({ emp_no: session.emp_no });

        if (!employee) {
            res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none' });
            return res.status(401).json({ message: 'User not found' });
        }

        // Issue new short-lived access token
        const newAccessToken = jwt.sign(
            { id: employee._id, emp_no: employee.emp_no, role: employee.role, session_token: sessionToken, isRestricted: false },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '15m' }
        );

        // Update session last activity
        session.updateActivity();

        res.json({ token: newAccessToken });
    } catch (error) {
        console.error('Refresh Token Error:', error);
        res.status(500).json({ message: 'Failed to refresh token' });
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

// @desc    Log a proxy login attempt
// @route   POST /api/auth/proxy-attempt
const logProxyAttempt = async (req, res) => {
    const { emp_no, face_descriptor, image_data, device_info } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();

    try {
        // 1. Get the employee who tried to login
        const loginEmployee = await Employee.findOne({ emp_no });
        if (!loginEmployee) {
            return res.status(404).json({ message: 'Login Employee not found' });
        }

        let detectedEmployee = null;
        let minDistance = 1.0; // High initial distance

        // 2. Scan ALL registered employees to see whose face it is
        // NOTE: In a massive scale app, this would be optimized with a vector DB
        const allEmployees = await Employee.find({ is_face_enabled: true, face_descriptor: { $exists: true, $not: { $size: 0 } } });

        const incomingDescriptor = new Float32Array(face_descriptor);

        for (const emp of allEmployees) {
            if (emp.face_descriptor && emp.face_descriptor.length > 0) {
                const targetDescriptor = new Float32Array(emp.face_descriptor);

                // Manually calculate Euclidean Distance (Simple for 128-d vectors)
                let sum = 0;
                for (let i = 0; i < incomingDescriptor.length; i++) {
                    sum += Math.pow(incomingDescriptor[i] - targetDescriptor[i], 2);
                }
                const dist = Math.sqrt(sum);

                if (dist < 0.45 && dist < minDistance) {
                    minDistance = dist;
                    detectedEmployee = emp;
                }
            }
        }

        // 3. Create proxy log
        const attempt = await ProxyAttempt.create({
            login_employee_id: loginEmployee.emp_no,
            login_employee_name: loginEmployee.full_name || loginEmployee.name,
            detected_face_employee_id: detectedEmployee ? detectedEmployee.emp_no : 'Unknown Face',
            detected_employee_name: detectedEmployee ? (detectedEmployee.full_name || detectedEmployee.name) : 'Unknown Person',
            image_data: image_data, // Base64 string from frontend
            device_info: device_info || 'Unknown',
            ip_address: clientIp,
            status: 'Proxy Attempt Detected'
        });

        console.log(`[SECURITY] Proxy attempt logged: ${loginEmployee.emp_no} tried login, but face looks like ${attempt.detected_face_employee_id}`);

        res.status(201).json({
            success: true,
            message: 'Security log created',
            detected: attempt.detected_employee_name
        });

    } catch (error) {
        console.error('Log Proxy Attempt Error:', error);
        res.status(500).json({ message: 'Server error logging attempt' });
    }
};

module.exports = { registerEmployee, loginEmployee, logoutEmployee, changePassword, getMe, refreshToken, logProxyAttempt };

