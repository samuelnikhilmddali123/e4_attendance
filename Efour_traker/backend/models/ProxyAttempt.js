const mongoose = require('mongoose');

const proxyAttemptSchema = new mongoose.Schema({
    login_employee_id: {
        type: String,
        required: true,
        trim: true
    },
    login_employee_name: {
        type: String,
        required: true,
        trim: true
    },
    detected_face_employee_id: {
        type: String,
        trim: true
    },
    detected_employee_name: {
        type: String,
        trim: true
    },
    image_data: {
        type: String, // Store base64 image data string
        required: true
    },
    device_info: {
        type: String,
        default: 'Unknown'
    },
    ip_address: {
        type: String,
        default: 'Unknown'
    },
    status: {
        type: String,
        default: 'Proxy Attempt Detected'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const ProxyAttempt = mongoose.model('ProxyAttempt', proxyAttemptSchema);
module.exports = ProxyAttempt;
