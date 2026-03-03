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

            // Only accumulate if the gap is small (e.g. < 45s) and WiFi is active
            if (is_on_wifi && diffMs > 0 && diffMs < 45000) {
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

module.exports = { heartbeat };
