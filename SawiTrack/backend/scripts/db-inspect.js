#!/usr/bin/env node
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

if (!MONGO_URI) {
  console.error('Missing Mongo URI');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      const coll = db.collection(c.name);
      const count = await coll.countDocuments();
      const sample = await coll.findOne({});
      console.log(`- ${c.name}: ${count} documents`);
      if (sample) {
        const keys = Object.keys(sample).slice(0, 8);
        console.log('  sample keys:', keys.join(', '));
      }
    }
  } catch (e) {
    console.error('Error inspecting DB:', e?.message || e);
  } finally {
    await mongoose.disconnect();
  }
})();
