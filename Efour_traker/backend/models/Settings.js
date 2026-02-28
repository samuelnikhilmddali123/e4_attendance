const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    office_wifi_ssid: {
        type: String,
        default: 'Your_Office_WiFi_Name'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
