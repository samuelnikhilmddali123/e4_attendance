const { MongoClient } = require('mongodb');

// URIs identified from codebase/logs
const SOURCE_URI = 'mongodb+srv://Vercel-Admin-tarcker:DtFPUjtB8PbtpMCs@tarcker.jqcemb3.mongodb.net/efour_tracker?retryWrites=true&w=majority';
const TARGET_URI = 'mongodb+srv://Vercel-Admin-atlas-cinnabar-drawer:FKtagWa9gheI2z1T@atlas-cinnabar-drawer.pfad5wj.mongodb.net/efour_tracker?retryWrites=true&w=majority';

async function migrate() {
    console.log('--- DATA MIGRATION MISSION START ---');
    console.log(`Source: ${SOURCE_URI.split('@')[1]}`);
    console.log(`Target: ${TARGET_URI.split('@')[1]}`);

    const sourceClient = new MongoClient(SOURCE_URI);
    const targetClient = new MongoClient(TARGET_URI);

    try {
        await sourceClient.connect();
        await targetClient.connect();
        console.log('✅ Connected to both clusters');

        const sourceDb = sourceClient.db();
        const targetDb = targetClient.db();

        const collections = await sourceDb.listCollections().toArray();
        console.log(`Found ${collections.length} collections to migrate`);

        for (const collInfo of collections) {
            const collName = collInfo.name;
            if (collName.startsWith('system.')) continue;

            console.log(`\nMigrating collection: [${collName}]...`);
            const data = await sourceDb.collection(collName).find({}).toArray();
            console.log(`- Retrieved ${data.length} documents`);

            if (data.length > 0) {
                // Clear existing data in target for this collection
                await targetDb.collection(collName).deleteMany({});
                console.log(`- Cleared target collection`);

                // Insert data
                const result = await targetDb.collection(collName).insertMany(data);
                console.log(`- Inserted ${result.insertedCount} documents successfully`);
            } else {
                console.log('- Collection empty, skipped insert');
            }
        }

        console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY!');

    } catch (err) {
        console.error('❌ MIGRATION ERROR:', err);
    } finally {
        await sourceClient.close();
        await targetClient.close();
        process.exit();
    }
}

migrate();
