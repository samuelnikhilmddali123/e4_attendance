const cron = require('node-cron');
const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');
const Session = require('./models/Session');
const { getISTTime } = require('./controllers/utilsController');

const initScheduler = (io) => {
    // Run daily at 7:00 PM IST (19:00 IST is 13:30 UTC)
    // IST is UTC + 5:30. So 19:00 IST - 5:30 = 13:30 UTC.
    // Cron format: 'minute hour day-of-month month day-of-week'

    // We'll run it every minute to check if it's 7 PM IST or later, 
    // but the requirement says "Run daily at 7:00 PM IST".
    // 13:30 UTC is exactly 19:00 IST.

    cron.schedule('30 13 * * *', async () => {
        console.log('[SCHEDULER] Running daily 7 PM IST auto-logout...');

        try {
            const istTime = getISTTime();
            const nowStr = istTime.datetime;
            const today = istTime.date;

            // 1. Find all active attendance records for employees
            // We need to join with Employee to check role, or we can just find all active ones and filter
            const attendees = await Attendance.find({ logout_time: null });

            for (const record of attendees) {
                const employee = await Employee.findOne({ emp_no: record.emp_no });

                if (employee && employee.role === 'employee') {
                    console.log(`[SCHEDULER] Auto-logging out employee: ${employee.emp_no}`);

                    // Update attendance record
                    record.logout_time = nowStr;
                    record.session_status = 'Auto Logout';
                    record.logout_reason = 'Office hours ended';
                    await record.save();

                    // Deactivate auth sessions
                    await Session.updateMany(
                        { emp_no: employee.emp_no, is_active: true },
                        { is_active: false }
                    );

                    // Notify via socket
                    if (io) {
                        io.to(employee.emp_no).emit('force_logout', {
                            message: 'Office hours ended. You have been automatically logged out.'
                        });
                    }
                }
            }

            console.log('[SCHEDULER] Daily auto-logout completed.');
        } catch (error) {
            console.error('[SCHEDULER] Error in auto-logout job:', error);
        }
    });

    // Run every 2 minutes to check WiFi connection drops
    cron.schedule('*/2 * * * *', async () => {
        try {
            const threeMinutesAgo = Date.now() - (3 * 60 * 1000);

            const disconnectedAttendances = await Attendance.find({
                logout_time: null,
                is_on_wifi: true,
                last_ping: { $lt: threeMinutesAgo }
            });

            for (const record of disconnectedAttendances) {
                record.is_on_wifi = false;
                record.wifi_history.push({
                    status: 'Disconnected',
                    timestamp: Date.now()
                });
                await record.save();

                console.log(`[SCHEDULER] Marked ${record.emp_no} as Disconnected (Ping timeout)`);

                if (io) {
                    io.emit('employee_wifi_status_changed', {
                        emp_no: record.emp_no,
                        is_on_wifi: false,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (error) {
            console.error('[SCHEDULER] Error in ping timeout job:', error);
        }
    });

    console.log('[SCHEDULER] Scheduler initialized (Job set for 13:30 UTC / 19:00 IST and WiFi Ping check)');
};

module.exports = initScheduler;
