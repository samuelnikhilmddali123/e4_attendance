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

        res.json({
            office_wifi_ssid: settings.office_wifi_ssid,
            office_public_ip: settings.office_public_ip
        });
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
        const { office_wifi_ssid, office_public_ip } = req.body;

        if (!office_wifi_ssid && !office_public_ip) {
            return res.status(400).json({ message: 'Wi-Fi SSID or Public IP is required' });
        }

        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({ office_wifi_ssid, office_public_ip });
        } else {
            if (office_wifi_ssid !== undefined) settings.office_wifi_ssid = office_wifi_ssid;
            if (office_public_ip !== undefined) settings.office_public_ip = office_public_ip;
            await settings.save();
        }

        res.json({
            message: 'Settings updated successfully',
            office_wifi_ssid: settings.office_wifi_ssid,
            office_public_ip: settings.office_public_ip
        });
    } catch (error) {
        console.error('Error updating Wi-Fi settings:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getWifiSettings,
    updateWifiSettings
};
