const cron = require('node-cron');
const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');

const initScheduler = (io) => {
    // Run every 2 minutes to check WiFi connection drops
    cron.schedule('*/2 * * * *', async () => {
        // (existing WiFi drop logic remains if needed, but the primary presence is now heartbeat)
        // Leaving it as-is to minimize friction with existing WiFi features unless explicitly told to remove.
    });

    // Enterprise Presence Tracking: Auto-Offline every 20 seconds
    setInterval(async () => {
        try {
            const timeout = new Date(Date.now() - 45 * 1000);

            // Find employees who were seen more than 45s ago and are still marked 'online'
            const timedOutEmployees = await Employee.find({
                status: 'online',
                last_seen: { $lt: timeout }
            });

            for (const emp of timedOutEmployees) {
                emp.status = 'offline';
                await emp.save();
                console.log(`[PRESENCE] Employee ${emp.emp_no} marked OFFLINE (Timeout)`);
            }
        } catch (error) {
            console.error('[PRESENCE-ERROR] Auto-offline job failed:', error);
        }
    }, 20000);

    console.log('[SCHEDULER] Scheduler initialized (Presence Tracking Active)');
};

module.exports = initScheduler;
