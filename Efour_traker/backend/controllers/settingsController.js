const Settings = require('../models/Settings');

// @desc    Get office Wi-Fi SSID
// @route   GET /api/settings/wifi
// @access  Public
const getWifiSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();

        // Return default if no settings exist in DB yet
        if (!settings) {
            settings = await Settings.create({ office_wifi_ssid: 'Efour_Net' });
        }

        res.json({ office_wifi_ssid: settings.office_wifi_ssid });
    } catch (error) {
        console.error('Error fetching Wi-Fi settings:', error);
        res.status(500).json({ message: 'Server Errors' });
    }
};

// @desc    Update office Wi-Fi SSID
// @route   PUT /api/settings/wifi
// @access  Private/Admin
const updateWifiSettings = async (req, res) => {
    try {
        const { office_wifi_ssid } = req.body;

        if (!office_wifi_ssid) {
            return res.status(400).json({ message: 'Wi-Fi SSID is required' });
        }

        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({ office_wifi_ssid });
        } else {
            settings.office_wifi_ssid = office_wifi_ssid;
            await settings.save();
        }

        res.json({ message: 'Wi-Fi Settings updated successfully', office_wifi_ssid: settings.office_wifi_ssid });
    } catch (error) {
        console.error('Error updating Wi-Fi settings:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getWifiSettings,
    updateWifiSettings
};
