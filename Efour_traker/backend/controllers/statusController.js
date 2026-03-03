const Employee = require('../models/Employee');

// @desc    Update employee heartbeat/presence
// @route   POST /api/utils/heartbeat
const heartbeat = async (req, res) => {
    const { emp_no } = req.user;
    const { is_on_wifi } = req.body;

    try {
        const now = new Date();
        const employee = await Employee.findOne({ emp_no });
        const Attendance = require('../models/Attendance');

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const oldStatus = employee.status;
        employee.last_seen = now;

        // Employee is "online" ONLY if active and on WiFi
        employee.status = is_on_wifi ? 'online' : 'offline';
        await employee.save();

        // 1. Update Attendance Duration if on WiFi
        const attendance = await Attendance.findOne({
            emp_no,
            logout_time: null
        }).sort({ login_time: -1 });

        if (attendance) {
            const lastPing = attendance.last_ping || attendance.login_time;
            const diffMs = now - lastPing;

            // Strict Accumulation: 
            // 1. Must be on WiFi
            // 2. Diff must be positive
            // 3. Diff must be <= 15 seconds (prevents massive jumps if device goes to sleep and wakes up)
            if (is_on_wifi && diffMs > 0 && diffMs <= 15000) {
                attendance.total_duration_ms = (attendance.total_duration_ms || 0) + diffMs;
            }

            attendance.last_ping = now;
            attendance.is_on_wifi = !!is_on_wifi;
            await attendance.save();
        }

        if (oldStatus !== employee.status) {
            console.log(`[PRESENCE] Employee ${emp_no} is now ${employee.status.toUpperCase()}`);
        }

        res.json({ success: true, status: employee.status });
    } catch (error) {
        console.error('[PRESENCE-ERROR] Heartbeat failed:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const checkNetworkStatus = async (req) => {
    try {
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne();

        const allowedSsid = settings?.office_wifi_ssid;
        const allowedIp = settings?.office_public_ip;
        const wifi_ssid = req.body.wifi_ssid || req.query.wifi_ssid;

        const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();

        if (wifi_ssid) {
            if (allowedSsid && allowedSsid !== 'Your_Office_WiFi_Name' && allowedSsid !== 'Efour_Net') {
                if (wifi_ssid.trim() === allowedSsid.trim()) return true;
                return false;
            }
            return true; // Default allow if no specific SSID configured
        } else if (allowedIp && allowedIp.trim() !== '') {
            if (clientIp === allowedIp.trim()) return true;
            return false;
        }

        return true; // Fallback if no network restrictions are set
    } catch (err) {
        console.error('[NETWORK-CHECK-ERROR]', err);
        return true; // Default open on error to prevent locking out
    }
};

// @desc    Poll active network status
// @route   GET /api/utils/network-check
const networkCheck = async (req, res) => {
    const is_on_wifi = await checkNetworkStatus(req);
    res.json({ is_on_wifi });
};

module.exports = { heartbeat, networkCheck, checkNetworkStatus };
