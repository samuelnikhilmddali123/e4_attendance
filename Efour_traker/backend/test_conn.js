const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

console.log('Testing connection with DNS override (8.8.8.8) to:', MONGO_URI.replace(/:.+@/, ':****@'));

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB with DNS override!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection failed even with DNS override:', err);
        process.exit(1);
    });
