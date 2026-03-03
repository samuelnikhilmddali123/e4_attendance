const Employee = require('../models/Employee');

// @desc    Update employee heartbeat/presence
// @route   POST /api/utils/heartbeat
const heartbeat = async (req, res) => {
    const { emp_no } = req.user;

    try {
        const now = new Date();
        const employee = await Employee.findOne({ emp_no });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const oldStatus = employee.status;
        employee.last_seen = now;
        employee.status = 'online';

        await employee.save();

        if (oldStatus !== 'online') {
            console.log(`[PRESENCE] Employee ${emp_no} marked ONLINE`);
        }

        // Moderate logging to avoid spam
        if (Math.random() < 0.1) { // Log 10% of heartbeats to console for debugging
            console.log(`[PRESENCE] Heartbeat received from ${emp_no}`);
        }

        res.json({ success: true, status: 'online' });
    } catch (error) {
        console.error('[PRESENCE-ERROR] Heartbeat failed:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { heartbeat };
