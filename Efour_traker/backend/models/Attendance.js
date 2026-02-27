const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    emp_no: {
        type: String,
        required: true,
        ref: 'Employee'
    },
    login_time: {
        type: Date,
        required: true
    },
    logout_time: {
        type: Date,
        default: null
    },
    date: {
        type: String, // Store as YYYY-MM-DD for easier filtering
        required: true
    },
    session_status: {
        type: String,
        enum: ['Active', 'Completed', 'Forced Logout', 'Auto Logout'],
        default: 'Active'
    },
    logout_reason: {
        type: String,
        default: null
    },
    device_info: {
        type: String,
        default: null
    }
}, { timestamps: true });

// Index for faster lookups
attendanceSchema.index({ emp_no: 1, date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
