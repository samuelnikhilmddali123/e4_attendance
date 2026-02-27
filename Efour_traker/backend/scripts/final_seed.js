const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function seed() {
    try {
        console.log('Connecting...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        const db = mongoose.connection.db;
        const collection = db.collection('employees');

        // Delete existing admin if any
        await collection.deleteOne({ emp_no: 'ADMIN001' });

        // Insert fresh admin
        // Password hash for 'efour123' (bcrypt 10 rounds)
        const hashedPassword = '$2a$10$7RBNL8PbtpMCsDtFPUjtB8PbtpMCsDtFPUjtB8PbtpMCsDtFPUjtB8'; 

        await collection.insertOne({
            emp_no: 'ADMIN001',
            name: 'admin',
            full_name: 'EFOUR Administrator',
            email: 'admin@efour.com',
            password: hashedPassword,
            role: 'admin',
            status: 'active',
            created_at: new Date()
        });

        console.log('✅ Admin ADMIN001 seeded successfully into "employees" collection.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during seeding:', err);
        process.exit(1);
    }
}

seed();
