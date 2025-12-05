import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const DB_NAME = process.env.MONGO_DB_NAME;
let MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
    const u = process.env.MONGO_USER;
    const p = process.env.MONGO_PASS;
    const h = process.env.MONGO_HOST;
    if (u && p && h) {
        const encUser = encodeURIComponent(u);
        const encPass = encodeURIComponent(p);
        MONGO_URI = `mongodb+srv://${encUser}:${encPass}@${h}/?retryWrites=true&w=majority`;
    }
}

(async () => {
    try {
        await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
        const db = mongoose.connection.db;
        const collection = db.collection('employees');

        const employees = await collection.find({}).toArray();
        console.log(`Found ${employees.length} employees. Checking IDs...`);

        let fixedCount = 0;
        for (const emp of employees) {
            if (typeof emp._id === 'string') {
                console.log(`Fixing employee ${emp.name} (${emp._id})...`);

                const newId = new mongoose.Types.ObjectId(emp._id);
                const newDoc = { ...emp, _id: newId };

                // Insert new doc
                await collection.insertOne(newDoc);

                // Delete old doc
                await collection.deleteOne({ _id: emp._id });

                fixedCount++;
            }
        }

        console.log(`Finished. Fixed ${fixedCount} employees.`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
})();
