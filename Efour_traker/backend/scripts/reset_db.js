const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// Connect using .env URI, fallback to fresh EFOUR tracker DB
const MONGO_URI = process.env.MONGODB_URI;

console.log('--- EFOUR DATABASE RESET START ---');
console.log('Configuring connection to:', MONGO_URI.replace(/:.+@/, ':****@'));

const resetDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected Successfully!');

        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            console.log(`Dropping collection: ${collection.collectionName}`);
            await collection.drop().catch(err => console.log(`Note: ${collection.collectionName} drop ignored.`));
        }

        console.log('✅ Database cleared!');

        // Define Employee schema explicitly for seeding
        const employeeSchema = new mongoose.Schema({
            emp_no: { type: String, required: true, unique: true },
            name: { type: String, required: true },
            full_name: { type: String },
            email: { type: String, required: true, unique: true },
            password: { type: String, required: true },
            role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
            status: { type: String, enum: ['active', 'inactive'], default: 'active' }
        });

        const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

        console.log('Seeding fresh EFOUR admin...');
        const hashedPassword = await bcrypt.hash('efour123', 10);
        
        await Employee.create({
            emp_no: 'ADMIN001',
            name: 'admin',
            full_name: 'EFOUR Administrator',
            email: 'admin@efour.com',
            password: hashedPassword,
            role: 'admin',
            status: 'active'
        });

        console.log('✅ Fresh EFOUR admin seeded: ADMIN001 / efour123');
        console.log('--- EFOUR DATABASE RESET COMPLETE ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ FATAL ERROR during reset:', error);
        process.exit(1);
    }
};

resetDB();
