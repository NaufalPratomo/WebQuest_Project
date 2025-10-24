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

// Estates
app.get(`${API_BASE_PATH}/estates`, async (_req, res) => {
  try {
    const estates = await Estate.find({}, { _id: 1, estate_name: 1 }).lean();
    res.json(estates);
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

// Targets
app.get(`${API_BASE_PATH}/targets`, async (_req, res) => {
  try {
    const targets = await Target.find({}).lean();
    res.json(targets);
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
