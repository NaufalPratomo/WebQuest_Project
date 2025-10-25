// backend/src/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Estate from './models/Estate.js';
import Employee from './models/Employee.js';
import Target from './models/Target.js';
import Report from './models/Report.js';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Load .env from backend/ and fallback to repo root
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const API_BASE_PATH = process.env.API_BASE_PATH || '/api';
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Support multiple origins via comma-separated list, or '*' to allow all (dev only)
const allowedOrigins = CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

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

async function connectMongo() {
  if (!MONGO_URI) {
    console.error('Missing Mongo URI');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log('Connected to MongoDB');
}

// Health
app.get(`${API_BASE_PATH}/health`, (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Auth
app.post(`${API_BASE_PATH}/auth/login`, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const doc = await Employee.findOne({ email }, { name: 1, email: 1, role: 1, division_id: 1, status: 1, password: 1 }).lean();
    if (!doc) return res.status(401).json({ error: 'Invalid credentials' });
    if (doc.status && doc.status !== 'active') return res.status(403).json({ error: 'Account inactive' });
    const stored = doc.password;
    let ok = false;
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      // bcrypt hash
      ok = await bcrypt.compare(password, stored);
    } else if (typeof stored === 'string') {
      // legacy plaintext (not recommended)
      ok = stored === password;
    }
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: String(doc._id), role: doc.role }, JWT_SECRET, { expiresIn: '7d' });
    const user = { _id: doc._id, name: doc.name, email: doc.email, role: doc.role, division: doc.division_id ?? null, status: doc.status };
    return res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_BASE_PATH}/auth/me`, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    if (!token) return res.status(401).json({ error: 'Missing token' });
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const d = await Employee.findById(payload.sub, { name: 1, email: 1, role: 1, division_id: 1, status: 1 }).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    return res.json({ _id: d._id, name: d.name, email: d.email, role: d.role, division: d.division_id ?? null, status: d.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estates
app.get(`${API_BASE_PATH}/estates`, async (_req, res) => {
  try {
    const estates = await Estate.find({}, { _id: 1, estate_name: 1 }).lean();
    res.json(estates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create estate (basic fields only)
app.post(`${API_BASE_PATH}/estates`, async (req, res) => {
  try {
    const { _id, estate_name, divisions } = req.body;
    if (!_id || !estate_name) return res.status(400).json({ error: 'Missing required fields' });
    const created = await Estate.create({ _id, estate_name, divisions: divisions || [] });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update estate name (or divisions if provided)
app.put(`${API_BASE_PATH}/estates/:id`, async (req, res) => {
  try {
    const { estate_name, divisions } = req.body;
    const update = {};
    if (estate_name !== undefined) update.estate_name = estate_name;
    if (divisions !== undefined) update.divisions = divisions;
    const updated = await Estate.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete estate
app.delete(`${API_BASE_PATH}/estates/:id,`, async (req, res) => {
  try {
    const deleted = await Estate.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/estates/:id`, async (req, res) => {
  try {
    const estate = await Estate.findById(req.params.id, { divisions: 0 }).lean();
    if (!estate) return res.status(404).json({ error: 'Not found' });
    res.json(estate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/estates/:id/divisions`, async (req, res) => {
  try {
    const estate = await Estate.findById(req.params.id, { divisions: 1 }).lean();
    if (!estate) return res.status(404).json({ error: 'Not found' });
    res.json(estate.divisions || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/estates/:id/divisions/:divisionId/blocks`, async (req, res) => {
  try {
    const { id, divisionId } = req.params;
    const estate = await Estate.findById(id, { divisions: { $elemMatch: { division_id: Number(divisionId) } } }).lean();
    if (!estate || !estate.divisions || estate.divisions.length === 0) {
      return res.json([]);
    }
    res.json(estate.divisions[0].blocks || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Employees
app.get(`${API_BASE_PATH}/employees`, async (_req, res) => {
  try {
    const docs = await Employee.find({}, { name: 1, email: 1, role: 1, division_id: 1, status: 1 }).lean();
    const employees = docs.map((d) => ({
      _id: d._id,
      name: d.name,
      email: d.email,
      role: d.role,
      division: d.division_id ?? null,
      status: d.status,
    }));
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get employee by id
app.get(`${API_BASE_PATH}/employees/:id`, async (req, res) => {
  try {
    const d = await Employee.findById(req.params.id, { name: 1, email: 1, role: 1, division_id: 1, status: 1 }).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json({ _id: d._id, name: d.name, email: d.email, role: d.role, division: d.division_id ?? null, status: d.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create employee
app.post(`${API_BASE_PATH}/employees`, async (req, res) => {
  try {
    const { name, email, role, division, status, password } = req.body;
    if (!name || !email || !role) return res.status(400).json({ error: 'Missing required fields' });
    // Store division into division_id field to match existing schema; additional fields allowed via strict:false
    let hashed;
    if (typeof password === 'string' && password.trim()) {
      try {
        hashed = await bcrypt.hash(password, 10);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to hash password' });
      }
    }
    const created = await Employee.create({ name, email, role, division_id: division ?? null, status, ...(hashed ? { password: hashed } : {}) });
    const safe = { _id: created._id, name, email, role, division: division ?? null, status: created.status };
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update employee
app.put(`${API_BASE_PATH}/employees/:id`, async (req, res) => {
  try {
    const { name, email, role, division, status, password } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (role !== undefined) update.role = role;
    if (division !== undefined) update.division_id = division;
    if (status !== undefined) update.status = status;
    if (typeof password === 'string' && password.trim()) {
      try {
        update.password = await bcrypt.hash(password, 10);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to hash password' });
      }
    }
    const updated = await Employee.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    const safe = { _id: updated._id, name: updated.name, email: updated.email, role: updated.role, division: updated.division_id ?? null, status: updated.status };
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete employee
app.delete(`${API_BASE_PATH}/employees/:id`, async (req, res) => {
  try {
    const deleted = await Employee.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Targets
app.get(`${API_BASE_PATH}/targets`, async (_req, res) => {
  try {
    const targets = await Target.find({}).lean();
    res.json(targets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get target by id
app.get(`${API_BASE_PATH}/targets/:id`, async (req, res) => {
  try {
    const doc = await Target.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create target
app.post(`${API_BASE_PATH}/targets`, async (req, res) => {
  try {
    const { division, period, target, achieved, status } = req.body;
    if (!division || !period || target === undefined) return res.status(400).json({ error: 'Missing required fields' });
    const created = await Target.create({ division, period, target, achieved, status });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update target
app.put(`${API_BASE_PATH}/targets/:id`, async (req, res) => {
  try {
    const updated = await Target.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete target
app.delete(`${API_BASE_PATH}/targets/:id`, async (req, res) => {
  try {
    const deleted = await Target.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports
app.get(`${API_BASE_PATH}/reports`, async (req, res) => {
  try {
    const { status, division, employeeId, employeeName, startDate, endDate } = req.query;
    const q = {};
    if (status) q.status = status;
    if (division) q.division = division;
    if (employeeId) q.employeeId = employeeId;
    if (employeeName) q.employeeName = employeeName;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(String(startDate));
      if (endDate) q.date.$lte = new Date(String(endDate));
    }
    const reports = await Report.find(q).sort({ date: -1 }).lean();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get report by id
app.get(`${API_BASE_PATH}/reports/:id`, async (req, res) => {
  try {
    const doc = await Report.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update report
app.put(`${API_BASE_PATH}/reports/:id`, async (req, res) => {
  try {
    const updated = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete report
app.delete(`${API_BASE_PATH}/reports/:id`, async (req, res) => {
  try {
    const deleted = await Report.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/reports`, async (req, res) => {
  try {
    const { employeeId, employeeName, date, division, jobType, hk, notes } = req.body;
    if (!employeeName || !date || !division || !jobType || hk === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const doc = await Report.create({ employeeId, employeeName, date, division, jobType, hk, notes });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch(`${API_BASE_PATH}/reports/:id/approve`, async (req, res) => {
  try {
    const updated = await Report.findByIdAndUpdate(req.params.id, { status: 'approved', rejectedReason: null }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch(`${API_BASE_PATH}/reports/:id/reject`, async (req, res) => {
  try {
    const { reason } = req.body;
    const updated = await Report.findByIdAndUpdate(req.params.id, { status: 'rejected', rejectedReason: reason || null }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recap HK
app.get(`${API_BASE_PATH}/recap/hk`, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(String(startDate));
      if (endDate) match.date.$lte = new Date(String(endDate));
    }
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { employeeName: '$employeeName', division: '$division' },
          totalHK: { $sum: '$hk' },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$hk', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$hk', 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, '$hk', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          employee: '$_id.employeeName',
          division: '$_id.division',
          totalHK: 1,
          approved: 1,
          pending: 1,
          rejected: 1,
        },
      },
      { $sort: { employee: 1 } },
    ];
    const rows = await Report.aggregate(pipeline);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
app.get(`${API_BASE_PATH}/stats`, async (_req, res) => {
  try {
    const [totalEmployees, pendingCount, targets] = await Promise.all([
      Employee.countDocuments({}),
      Report.countDocuments({ status: 'pending' }),
      Target.find({ status: 'active' }, { target: 1, achieved: 1 }).lean(),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayReports = await Report.countDocuments({ date: { $gte: today, $lt: tomorrow } });

    const percent = targets.length
      ? Math.round(
          (targets.reduce((sum, t) => sum + (t.achieved || 0), 0) /
            targets.reduce((sum, t) => sum + (t.target || 0), 0)) *
            100
        )
      : 0;

    res.json({ totalEmployees, todayReports, pendingCount, targetsPercent: percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}${API_BASE_PATH}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
