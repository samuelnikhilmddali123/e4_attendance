const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('./models/Employee');
const Session = require('./models/Session');
const Settings = require('./models/Settings');
const Attendance = require('./models/Attendance');

dotenv.config();

async function diagnose() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const emp = await Employee.findOne({ emp_no: 'ADMIN001' });
        console.log('Admin found:', !!emp);

        const settings = await Settings.findOne();
        console.log('Settings found:', !!settings);

        console.log('Testing Session creation...');
        const testSession = await Session.create({
            emp_no: 'ADMIN001',
            session_token: 'test_token_' + Date.now(),
            device_info: 'Diagnostic Script'
        });
        console.log('Session created:', testSession._id);

        console.log('Clean up test session...');
        await Session.deleteOne({ _id: testSession._id });

        console.log('Diagnostic finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('DIAGNOSTIC FAILURE:', err);
        process.exit(1);
    }
}

diagnose();
