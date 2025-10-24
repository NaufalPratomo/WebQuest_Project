#!/usr/bin/env node
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from backend and fallback to repo root
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const atlasUri = process.env.MONGO_ATLAS_URI;
const fallbackUri = process.env.MONGO_URI;
const user = process.env.MONGO_USER;
const pass = process.env.MONGO_PASS;
const host = process.env.MONGO_HOST;
const dbName = process.env.MONGO_DB_NAME || 'admin';

let uri = atlasUri || fallbackUri;
if (!uri && user && pass && host) {
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(pass);
  uri = `mongodb+srv://${u}:${p}@${host}/${dbName}?retryWrites=true&w=majority`;
}

if (!uri) {
  console.error('ERROR: No MongoDB URI found. Set MONGO_ATLAS_URI or MONGO_URI or parts in .env');
  process.exit(1);
}

const redacted = uri.replace(/(mongodb\+srv:\/\/)([^@]+@)/, '$1*****@');
console.log('Using MongoDB URI (redacted):', redacted);

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  connectTimeoutMS: 10000,
});

async function run() {
  try {
    console.log('Connecting...');
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    console.log('Pinged your deployment. Successfully connected to MongoDB!');
  } catch (err) {
    console.error('Connection failed:');
    console.error(err?.message || err);
    process.exitCode = 1;
  } finally {
    try { await client.close(); } catch {}
  }
}

run();
