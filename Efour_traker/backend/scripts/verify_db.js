const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const MONGO_URI = process.env.MONGODB_URI;

async function test() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('--- CONNECTION SUCCESSFUL ---');
        console.log('Host:', mongoose.connection.host);
        
        const User = mongoose.connection.db.collection('users');
        const admin = await User.findOne({ emp_no: 'ADMIN001' });
        
        if (admin) {
            console.log('--- ADMIN USER FOUND IN DB ---');
        } else {
            console.log('--- ADMIN USER NOT FOUND ---');
        }
        
        process.exit(0);
    } catch (e) {
        console.error('--- CONNECTION FAILED ---', e.message);
        process.exit(1);
    }
}
test();
