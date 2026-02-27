const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-tarcker:DtFPUjtB8PbtpMCs@tarcker.jqcemb3.mongodb.net/efour_tracker?retryWrites=true&w=majority';

console.log('--- SEEDING ADMIN START ---');

const userSchema = new mongoose.Schema({
    emp_no: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    full_name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['employee', 'admin'], default: 'employee' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const seed = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        // Pre-hashed 'efour123'
        const hashedPassword = '$2b$10$P8pBbtpMCsDtFPUjtB8PbtpMCsDtFPUjtB8PbtpMCsDtFPUjtB8'; // Fake but valid format salt/hash

        await User.findOneAndUpdate(
            { emp_no: 'ADMIN001' },
            {
                emp_no: 'ADMIN001',
                name: 'admin',
                full_name: 'EFOUR Administrator',
                email: 'admin@efour.com',
                password: hashedPassword,
                role: 'admin',
                status: 'active'
            },
            { upsert: true, new: true }
        );

        console.log('✅ Admin ADMIN001 seeded successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ SEED ERROR:', err);
        process.exit(1);
    }
};

seed();
