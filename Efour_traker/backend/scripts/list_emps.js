const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

mongoose.connect(MONGO_URI).then(async () => {
    const Employee = require('./models/Employee');
    const employees = await Employee.find({}, 'emp_no role email');
    console.log('--- DATABASE CONTENTS ---');
    console.log(JSON.stringify(employees, null, 2));
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
