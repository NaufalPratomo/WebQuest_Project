import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import ForemanGroup from '../src/models/ForemanGroup.js';

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

function rand(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

const firstNames = ['Abdul','Ahmad','Asep','Budi','Dedi','Eko','Fajar','Gafar','Hadi','Irfan','Joko','Kamal','Lukman','Maman','Nurdin','Otis','Paiman','Rizal','Sandy','Tono','Udin','Vian','Wawan','Yusuf','Zulkifli'];
const lastNames = ['Nasiliu','Ismail','Husuna','Bakoja','Lamara','Malopo','Tamani','Usman','Djokilo','Rauf','Ibrahim','Huladu','Paramata','Ginting','Sutrisno','Hakim','Putra','Santoso','Kusuma','Wijaya'];

(async () => {
  try {
    if (!MONGO_URI) throw new Error('Missing MONGO URI in environment');
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('Connected to DB');

    // Remove any existing demo users/employees created earlier to keep seeder idempotent
    await User.deleteMany({ email: /@demo\.local$/ });
    await Employee.deleteMany({ nik: { $regex: '^7501' } });
    await ForemanGroup.deleteMany({});

    // Create some foremen users + their employee record
    const foremenCount = 5;
    const assistantCount = 4;
    const adminCount = 2;
    const pemanenCount = 50;

    const createdUsers = [];
    // create foremen users
    for (let i=1;i<=foremenCount;i++){
      const name = `${rand(firstNames)} ${rand(lastNames)}`;
      const email = `foreman${i}@demo.local`;
      const password = bcrypt.hashSync('Password123!', 10);
      const user = await User.create({ name, email, password, role: 'foreman', status: 'active' });
      createdUsers.push(user);
      // create employee corresponding to this user (position mandor)
      const empNik = `75011${String(1000000 + i).slice(1)}`;
      await Employee.create({ nik: empNik, name, position: 'mandor', mandorId: '', division: `Div${i%3+1}`, status: 'active' });
      console.log(`Created foreman user: ${name} (${email})`);
    }

    // create assistants and admins as users+employees
    for (let i=1;i<=assistantCount;i++){
      const name = `${rand(firstNames)} ${rand(lastNames)}`;
      const email = `asisten${i}@demo.local`;
      const password = bcrypt.hashSync('Password123!', 10);
      const user = await User.create({ name, email, password, role: 'employee', status: 'active' });
      const empNik = `75012${String(1000000 + i).slice(1)}`;
      await Employee.create({ nik: empNik, name, position: 'asisten', mandorId: '', division: `Div${i%3+1}`, status: 'active' });
      console.log(`Created assistant user: ${name} (${email})`);
    }

    for (let i=1;i<=adminCount;i++){
      const name = `Admin ${i}`;
      const email = `admin${i}@demo.local`;
      const password = bcrypt.hashSync('AdminPass123!', 10);
      const user = await User.create({ name, email, password, role: 'manager', status: 'active' });
      const empNik = `75013${String(1000000 + i).slice(1)}`;
      await Employee.create({ nik: empNik, name, position: 'admin', mandorId: '', division: `AdminDiv`, status: 'active' });
      console.log(`Created admin user: ${name} (${email})`);
    }

    // fetch foreman users to assign mandorId values
    const foremenUsers = await User.find({ role: 'foreman' }).lean();
    if (foremenUsers.length === 0) throw new Error('No foremen users found after creation');

    // create pemanen employees and assign to random foreman (mandorId = user._id)
    for (let i=1;i<=pemanenCount;i++){
      const name = `${rand(firstNames)} ${rand(lastNames)}`;
      const nik = `75014${String(1000000 + i).slice(1)}`;
      const chosen = rand(foremenUsers);
      await Employee.create({ nik, name, position: 'pemanen', mandorId: String(chosen._id), division: `Div${(i%5)+1}`, status: 'active' });
    }
    console.log(`Created ${pemanenCount} pemanen employees`);

    // Build foreman groups from employees referencing mandorId
    await ForemanGroup.deleteMany({});
    for (const f of foremenUsers) {
      const members = await Employee.find({ mandorId: String(f._id), position: 'pemanen' }).lean();
      const memberIds = members.map(m => String(m._id));
      await ForemanGroup.create({ mandorId: String(f._id), name: f.name, memberIds, division: null, companyId: null });
      console.log(`Created foreman group for ${f.name} with ${memberIds.length} members`);
    }

    console.log('Seeding completed successfully.');
  } catch (e) {
    console.error('Seeder error:', e);
  } finally {
    await mongoose.disconnect();
  }
})();
