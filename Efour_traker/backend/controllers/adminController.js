const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const ProxyAttempt = require('../models/ProxyAttempt');
const bcrypt = require('bcryptjs');
const { getISTTime } = require('./utilsController');

// AI Feature Vector Matcher (Euclidean Distance fallback for 128-d face embeddings)
const calculateFaceSimilarity = (descriptor1, descriptor2) => {
    try {
        // Ensure we're working with arrays or typed arrays
        const a1 = Array.isArray(descriptor1) ? descriptor1 :
            (descriptor1 instanceof Float32Array || descriptor1 instanceof Float64Array) ? Array.from(descriptor1) :
                Object.values(descriptor1 || {}); // Handle objects with index keys

        const a2 = Array.isArray(descriptor2) ? descriptor2 :
            (descriptor2 instanceof Float32Array || descriptor2 instanceof Float64Array) ? Array.from(descriptor2) :
                Object.values(descriptor2 || {});

        if (a1.length === 0 || a2.length === 0) {
            console.log("[AI-Matcher] Skipping calculation: Empty descriptor(s)");
            return 999;
        }

        let sum = 0;
        // Face descriptors are typically 128-dimensional vectors
        const len = Math.min(a1.length, a2.length, 128);
        for (let i = 0; i < len; i++) {
            const val1 = Number(a1[i]) || 0;
            const val2 = Number(a2[i]) || 0;
            const diff = val1 - val2;
            sum += diff * diff;
        }
        const distance = Math.sqrt(sum);
        console.log(`[AI-Matcher] Calculated Distance: ${distance.toFixed(4)} (Vectors: ${a1.length} vs ${a2.length})`);
        return distance;
    } catch (e) {
        console.error("AI Matcher Error:", e);
        return 999;
    }
};

// @desc    Get all employees
// @route   GET /api/admin/employees
const getEmployees = async (req, res) => {
    try {
        const istTime = getISTTime();
        const today = istTime.date;

        const employees = await Employee.find({});

        const activeAttendance = await Attendance.find({ date: today, logout_time: null });
        const activeEmpNos = new Set(activeAttendance.map(a => a.emp_no));

        const result = employees.map(e => ({
            id: e._id,
            emp_no: e.emp_no,
            name: e.name,
            full_name: e.full_name,
            profile_picture: e.profile_picture,
            email: e.email,
            role: e.role,
            status: e.status || 'offline'
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get daily reports
// @route   GET /api/admin/reports/daily
const getDailyReports = async (req, res) => {
    const { date } = req.query;
    const istTime = getISTTime();
    const filterDate = date || istTime.date;
    const isFilterToday = filterDate === istTime.date;

    try {
        const employees = await Employee.find({ role: 'employee' }).sort({ emp_no: 1 });
        const attendances = await Attendance.find({ date: filterDate });

        const reports = employees.map(e => {
            const empAttendances = attendances.filter(a => a.emp_no === e.emp_no);
            const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB') : 'N/A';

            let totalMs = 0;
            const sessions = empAttendances.map(att => {
                let loginTime = new Date(att.login_time);
                let logoutTime = att.logout_time ? new Date(att.logout_time) : null;

                // Use the accumulated duration from heartbeat if available, otherwise fallback to basic calc
                let durationMs = att.total_duration_ms ||
                    (logoutTime ? logoutTime - loginTime : 0);

                if (durationMs < 0) durationMs = 0;
                totalMs += durationMs;

                return {
                    login: formatTime(att.login_time),
                    logout: att.logout_time ? formatTime(att.logout_time) : 'N/A',
                    is_active: !att.logout_time,
                    is_on_wifi: att.is_on_wifi !== undefined ? att.is_on_wifi : true
                };
            });

            let working_hours = 'N/A';
            let is_half_day = false;
            if (empAttendances.length > 0) {
                const hasActive = empAttendances.some(a => !a.logout_time);

                if (totalMs > 0 || !hasActive) {
                    const hrs = Math.floor(totalMs / 3600000);
                    const mins = Math.floor((totalMs % 3600000) / 60000);
                    is_half_day = totalMs > 0 && totalMs < 5 * 3600000;

                    working_hours = `${hrs}:${mins.toString().padStart(2, '0')}:00`;
                    if (is_half_day) working_hours += ' (Half Day)';
                    if (hasActive) working_hours += ' (Active)';
                } else if (hasActive) {
                    working_hours = 'Running';
                } else {
                    working_hours = '0:00:00';
                }
            }

            return {
                emp_no: e.emp_no,
                name: e.name,
                full_name: e.full_name,
                profile_picture: e.profile_picture,
                login_time: sessions.length > 0 ? sessions[0].login : 'N/A',
                logout_time: sessions.length > 0 ? sessions[sessions.length - 1].logout : 'N/A',
                sessions,
                working_hours,
                is_half_day,
                is_on_wifi: sessions.length > 0 ? sessions[sessions.length - 1].is_on_wifi : false
            };
        });

        res.json(reports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const attendances = await Attendance.find({ logout_time: { $ne: null } });

        const empWorkingHours = {};
        attendances.forEach(a => {
            const durationMs = a.total_duration_ms ||
                (a.logout_time ? new Date(a.logout_time) - new Date(a.login_time) : 0);
            const diffHrs = durationMs / 3600000;
            empWorkingHours[a.emp_no] = (empWorkingHours[a.emp_no] || 0) + diffHrs;
        });

        const workingHoursArray = Object.keys(empWorkingHours).map(emp_no => ({
            emp_no,
            total_hours: empWorkingHours[emp_no].toFixed(2)
        }));

        res.json({
            workingHours: workingHoursArray
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create employee (Admin only)
const createEmployee = async (req, res) => {
    const { emp_no, name, email, password, role, face_descriptor, is_face_enabled } = req.body;

    try {
        if (!emp_no || !name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingEmp = await Employee.findOne({ $or: [{ emp_no }, { email }] });
        if (existingEmp) {
            return res.status(400).json({ message: 'Employee ID or email already exists' });
        }

        // Check Face Uniqueness
        if (face_descriptor && face_descriptor.length > 0) {
            // Scan ALL employees with face data, regardless of is_face_enabled
            const allFaceUsers = await Employee.find({
                face_descriptor: { $exists: true, $not: { $size: 0 } }
            });

            console.log(`[AI-Security] Scanning ${allFaceUsers.length} enrolled faces for duplication...`);

            for (const existingUser of allFaceUsers) {
                if (existingUser.face_descriptor && existingUser.face_descriptor.length > 0) {
                    const distance = calculateFaceSimilarity(face_descriptor, existingUser.face_descriptor);

                    // Duplicate check threshold (0.60)
                    // We use 0.60 for registration to be highly preventative of duplicates.
                    if (distance < 0.60) {
                        console.log(`[AI-Security] DUPLICATE DETECTED: Matches ${existingUser.name} (Dist: ${distance.toFixed(3)})`);
                        return res.status(400).json({
                            message: `Face Uniqueness Error: This face is already enrolled under employee "${existingUser.full_name || existingUser.name}" (ID: ${existingUser.emp_no}).`
                        });
                    }
                }
            }
            console.log(`[AI-Security] Face uniqueness verified.`);
        }
        const employee = new Employee({
            emp_no,
            name,
            email,
            password,
            role: role || 'employee',
            face_descriptor,
            is_face_enabled
        });
        await employee.save();

        res.status(201).json({ message: 'Employee created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete employee (Admin only)
const deleteEmployee = async (req, res) => {
    const { emp_no } = req.params;
    try {
        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        if (employee.role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete admin accounts' });
        }

        await Employee.deleteOne({ emp_no });
        await Attendance.deleteMany({ emp_no });

        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all login requests (Admin only)
const getLoginRequests = async (req, res) => {
    try {
        const LoginRequest = require('../models/LoginRequest');
        const employees = await Employee.find({});
        const empMap = employees.reduce((acc, e) => {
            acc[e.emp_no] = {
                name: e.name,
                full_name: e.full_name,
                profile_picture: e.profile_picture
            };
            return acc;
        }, {});

        const requests = await LoginRequest.find({}).sort({ createdAt: -1 });

        const result = requests.map(r => ({
            id: r._id,
            emp_no: r.emp_no,
            emp_name: empMap[r.emp_no]?.full_name || empMap[r.emp_no]?.name || 'Unknown',
            request_time: r.request_time,
            reason: r.reason,
            status: r.status,
            device_info: r.device_info,
            approved_by: r.approved_by,
            approval_time: r.approval_time,
            expiry_time: r.expiry_time
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Approve or reject login request (Admin only)
const handleLoginRequest = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'Approved' or 'Rejected'
    const admin_emp_no = req.user.emp_no;

    try {
        const LoginRequest = require('../models/LoginRequest');
        const request = await LoginRequest.findById(id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (action === 'Approved') {
            request.status = 'Approved';
            request.approved_by = admin_emp_no;
            request.approval_time = new Date();
            // Approval valid for 1 hour
            request.expiry_time = new Date(Date.now() + 60 * 60 * 1000);
        } else if (action === 'Rejected') {
            request.status = 'Rejected';
            request.approved_by = admin_emp_no;
            request.approval_time = new Date();
        } else {
            return res.status(400).json({ message: 'Invalid action' });
        }

        await request.save();

        // Notify employee via socket
        const io = req.app.get('io');
        if (io) {
            io.to(request.emp_no).emit('login_request_result', {
                status: action,
                message: action === 'Approved' ? 'Your login request has been approved.' : 'Your login request has been rejected.'
            });
        }

        res.json({ message: `Login request ${action.toLowerCase()} successfully`, request });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Force logout all active employees
const forceLogoutAll = async (req, res) => {
    try {
        const Session = require('../models/Session');
        const istTime = getISTTime();
        const now = istTime.datetime;

        // 1. Find and close ALL active attendance records (even if from previous days)
        const activeRecords = await Attendance.find({
            logout_time: null
        });

        for (const record of activeRecords) {
            record.logout_time = now;
            record.session_status = 'Forced Logout';
            record.logout_reason = 'Terminated by Admin';
            await record.save();
        }

        // 2. Deactivate all active sessions in the database
        await Session.updateMany({ is_active: true }, { is_active: false });

        // 3. Notify all employees via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('force_logout', {
                message: 'Administrator has ended all active working sessions.'
            });
        }

        res.json({ message: 'All active sessions have been terminated successfully.' });
    } catch (error) {
        console.error('Force logout all failed:', error);
        res.status(500).json({ message: 'Server error while terminating sessions' });
    }
};

// @desc    Force logout a specific employee
const forceLogoutEmployee = async (req, res) => {
    const { emp_no } = req.params;
    try {
        const Session = require('../models/Session');
        const istTime = getISTTime();
        const now = istTime.datetime;
        const today = istTime.date;

        // 1. Find and close any active attendance record for this employee (any date)
        const record = await Attendance.findOne({
            emp_no,
            logout_time: null
        }).sort({ login_time: -1 });

        if (record) {
            record.logout_time = now;
            record.session_status = 'Forced Logout';
            record.logout_reason = 'Terminated by Admin';
            await record.save();
        }

        // 2. Deactivate active sessions for this employee
        await Session.updateMany({ emp_no, is_active: true }, { is_active: false });

        // 3. Notify the employee via specific socket room
        const io = req.app.get('io');
        if (io) {
            io.to(emp_no).emit('force_logout', {
                message: 'Administrator has ended your active working session.'
            });
        }

        res.json({ success: true, message: `Session for employee #${emp_no} has been terminated.` });
    } catch (error) {
        console.error(`Force logout for ${emp_no} failed:`, error);
        res.status(500).json({ message: 'Server error while terminating session' });
    }
};

// @desc    Get light status list for all employees
// @route   GET /api/admin/employees/status
const getEmployeeStatuses = async (req, res) => {
    try {
        const employees = await Employee.find({ role: 'employee' }).select('emp_no status').lean();
        res.json(employees);
    } catch (error) {
        console.error('Failed to get employee statuses:', error);
        res.status(500).json({ message: 'Server error fetching statuses' });
    }
};

// @desc    Get all proxy login attempts
// @route   GET /api/admin/proxy-attempts
const getProxyAttempts = async (req, res) => {
    try {
        const attempts = await ProxyAttempt.find().sort({ timestamp: -1 }).limit(100);
        res.json(attempts);
    } catch (error) {
        console.error('Get Proxy Attempts Error:', error);
        res.status(500).json({ message: 'Server error fetching logs' });
    }
};

module.exports = {
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
};

