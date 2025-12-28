import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import ForemanGroup from '../src/models/ForemanGroup.js';
import Employee from '../src/models/Employee.js';
import User from '../src/models/User.js';

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
        if (!MONGO_URI) throw new Error('Missing MONGO URI');
        await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

        console.log('Connected to DB. Building foreman groups...');

        // Clear existing groups (idempotent)
        await ForemanGroup.deleteMany({});

        // Load users with role foreman
        const foremenUsers = await User.find({ role: 'foreman' }).lean();

        // For each foreman user, find employees that reference them via mandorId
        for (const f of foremenUsers) {
            const members = await Employee.find({ mandorId: String(f._id) }).lean();
            const memberIds = members.map(m => String(m._id));

            if (memberIds.length > 0) {
                await ForemanGroup.create({
                    mandorId: String(f._id),
                    name: f.name || '',
                    companyId: null,
                    division: null,
                    memberIds,
                });
                console.log(`Created group for mandor ${f.name} -> ${memberIds.length} members`);
            } else {
                console.log(`No members found for mandor ${f.name}`);
            }
        }

        // Also handle any mandorId referenced by employees but not present in users
        const distinctMandorIds = await Employee.distinct('mandorId', { mandorId: { $exists: true, $ne: null, $ne: '' } });
        for (const mid of distinctMandorIds) {
            if (!foremenUsers.some(f => String(f._id) === String(mid))) {
                const members = await Employee.find({ mandorId: String(mid) }).lean();
                const memberIds = members.map(m => String(m._id));
                // try to find a name from an employee with that id
                const mandorEmp = await Employee.findOne({ _id: mid }).lean().catch(() => null);
                const name = mandorEmp?.name || `Mandor ${mid}`;
                await ForemanGroup.create({ mandorId: String(mid), name, memberIds });
                console.log(`Created fallback group for mandor ${name} -> ${memberIds.length} members`);
            }
        }

        console.log('Seeding foreman groups completed.');
    } catch (e) {
        console.error('Error seeding foreman groups:', e);
    } finally {
        await mongoose.disconnect();
    }
})();
