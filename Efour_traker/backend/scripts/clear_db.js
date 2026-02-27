const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const clearDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in .env file');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected.');

    const collections = await mongoose.connection.db.collections();

    for (let collection of collections) {
      console.log(`Dropping collection: ${collection.collectionName}`);
      await collection.drop();
    }

    console.log('✅ All collections dropped. Database is fresh.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

clearDB();
