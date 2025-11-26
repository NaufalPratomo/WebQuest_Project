// backend/src/index.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Estate from "./models/Estate.js";
import Company from "./models/Company.js";
import Employee from "./models/Employee.js";
import User from "./models/User.js";
import Target from "./models/Target.js";
import Report from "./models/Report.js";
import Taksasi from "./models/Taksasi.js";
import TaksasiSelection from "./models/TaksasiSelection.js";
import CustomWorker from "./models/CustomWorker.js";
import Panen from "./models/Panen.js";
import Angkut from "./models/Angkut.js";
import Attendance from "./models/Attendance.js";
import JobCode from "./models/JobCode.js";
import ClosingPeriod from "./models/ClosingPeriod.js";
import ActivityLog from "./models/ActivityLog.js";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Load .env from backend/ and fallback to repo root
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const app = express();
app.use(express.json({ limit: "50mb" })); // Increase limit for large imports
app.use(cookieParser());

const PORT = process.env.PORT || 5000;
const API_BASE_PATH = process.env.API_BASE_PATH || "/api";
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Support multiple origins via comma-separated list, or '*' to allow all (dev only)
const allowedOrigins = (CORS_ORIGIN || "").split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
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
    console.error("Missing Mongo URI");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("Connected to MongoDB");
}

// Helper: Log Activity
async function logActivity(req, action, details = {}, userOverride = null) {
  try {
    let user = userOverride;

    if (!user) {
      let token = null;
      if (req.headers.authorization) {
        token = req.headers.authorization.split(" ")[1];
      } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }

      if (token) {
        try {
          const payload = jwt.verify(token, JWT_SECRET);
          if (!user) {
            const foundUser = await User.findById(payload.sub, { name: 1, role: 1 }).lean();
            if (foundUser) {
              user = foundUser;
            } else {
              user = { _id: payload.sub, role: payload.role };
            }
          }
        } catch (e) {
          // console.error(`[ActivityLog] Token error:`, e.message);
        }
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await ActivityLog.create({
      user_id: user?._id,
      user_name: user?.name || details.user_name || 'System/Unknown',
      role: user?.role,
      action,
      details,
      ip_address: ip
    });
  } catch (err) {
    console.error("Activity Log Error:", err);
  }
}


// Helper: Check if date is in closed period
async function checkDateClosed(dateInput) {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  // Find any period where startDate <= d <= endDate
  const closed = await ClosingPeriod.findOne({
    startDate: { $lte: d },
    endDate: { $gte: d }
  }).lean();
  return !!closed;
}

// Health
app.get(`${API_BASE_PATH}/health`, (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Auth
app.post(`${API_BASE_PATH}/auth/login`, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });
    const doc = await User.findOne(
      { email },
      { name: 1, email: 1, role: 1, division_id: 1, status: 1, password: 1 }
    ).lean();
    if (!doc) return res.status(401).json({ error: "Invalid credentials" });
    if (doc.status && doc.status !== "active")
      return res.status(403).json({ error: "Account inactive" });
    const stored = doc.password;
    let ok = false;
    if (typeof stored === "string" && stored.startsWith("$2")) {
      // bcrypt hash
      ok = await bcrypt.compare(password, stored);
    } else if (typeof stored === "string") {
      // legacy plaintext (not recommended)
      ok = stored === password;
    }
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      {
        sub: String(doc._id),
        role: doc.role,
        division: doc.division_id ?? null,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    const user = {
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      division: doc.division_id ?? null,
      status: doc.status,
    };
    // Set secure HTTP-only cookie for session persistence
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined; // set in .env for production
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: cookieDomain
    });
    logActivity(req, "LOGIN", { email }, user);
    return res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_BASE_PATH}/auth/me`, async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    let token = auth.split(" ")[1];
    if (!token && req.cookies?.token) token = req.cookies.token; // fallback to cookie
    if (!token) return res.status(401).json({ error: "Missing token" });
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    const d = await User.findById(payload.sub, {
      name: 1,
      email: 1,
      role: 1,
      division_id: 1,
      status: 1,
    }).lean();
    if (!d) return res.status(404).json({ error: "Not found" });
    return res.json({
      _id: d._id,
      name: d.name,
      email: d.email,
      role: d.role,
      division: d.division_id ?? null,
      status: d.status,
    });
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

// Companies
app.get(`${API_BASE_PATH}/companies`, async (_req, res) => {
  try {
    const companies = await Company.find()
      .populate("estates", "_id estate_name")
      .lean();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_BASE_PATH}/companies/:id`, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("estates", "_id estate_name")
      .lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/companies`, async (req, res) => {
  try {
    console.log("POST /companies - Body:", req.body);
    const { company_name, address, phone, email, estates } = req.body;
    if (!company_name || !address)
      return res
        .status(400)
        .json({ error: "company_name and address are required" });
    const created = await Company.create({
      company_name,
      address,
      phone,
      email,
      estates: estates || [],
    });
    console.log("Company created:", created);
    logActivity(req, "CREATE_COMPANY", { company_name });
    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating company:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/companies/:id`, async (req, res) => {
  try {
    const { company_name, address, phone, email, estates } = req.body;
    const update = {};
    if (company_name !== undefined) update.company_name = company_name;
    if (address !== undefined) update.address = address;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (estates !== undefined) update.estates = estates;
    const updated = await Company.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).lean();
    if (!updated) return res.status(404).json({ error: "Company not found" });
    logActivity(req, "UPDATE_COMPANY", { company_id: req.params.id, updates: update });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/companies/:id`, async (req, res) => {
  try {
    const deleted = await Company.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Company not found" });
    logActivity(req, "DELETE_COMPANY", { company_id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create estate (basic fields only)
app.post(`${API_BASE_PATH}/estates`, async (req, res) => {
  try {
    const { _id, estate_name, divisions } = req.body;
    if (!_id || !estate_name)
      return res.status(400).json({ error: "Missing required fields" });
    const created = await Estate.create({
      _id,
      estate_name,
      divisions: divisions || [],
    });
    logActivity(req, "CREATE_ESTATE", { estate_name });
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
    const updated = await Estate.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });

    logActivity(req, "UPDATE_ESTATE", { estate_id: req.params.id, updates: update });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete estate
app.delete(`${API_BASE_PATH}/estates/:id,`, async (req, res) => {
  try {
    const deleted = await Estate.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logActivity(req, "DELETE_ESTATE", { estate_id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/estates/:id`, async (req, res) => {
  try {
    const estate = await Estate.findById(req.params.id, {
      divisions: 0,
    }).lean();
    if (!estate) return res.status(404).json({ error: "Not found" });
    res.json(estate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/estates/:id/divisions`, async (req, res) => {
  try {
    const estate = await Estate.findById(req.params.id, {
      divisions: 1,
    }).lean();
    if (!estate) return res.status(404).json({ error: "Not found" });
    res.json(estate.divisions || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(
  `${API_BASE_PATH}/estates/:id/divisions/:divisionId/blocks`,
  async (req, res) => {
    try {
      const { id, divisionId } = req.params;
      const estate = await Estate.findById(id, {
        divisions: { $elemMatch: { division_id: Number(divisionId) } },
      }).lean();
      if (!estate || !estate.divisions || estate.divisions.length === 0) {
        return res.json([]);
      }
      res.json(estate.divisions[0].blocks || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Users (Web Accounts)
app.get(`${API_BASE_PATH}/users`, async (_req, res) => {
  try {
    const docs = await User.find(
      {},
      { name: 1, email: 1, role: 1, division_id: 1, status: 1 }
    ).lean();
    const users = docs.map((d) => ({
      _id: d._id,
      name: d.name,
      email: d.email,
      role: d.role,
      division: d.division_id ?? null,
      status: d.status,
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_BASE_PATH}/users/:id`, async (req, res) => {
  try {
    const d = await User.findById(req.params.id, {
      name: 1,
      email: 1,
      role: 1,
      division_id: 1,
      status: 1,
    }).lean();
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json({
      _id: d._id,
      name: d.name,
      email: d.email,
      role: d.role,
      division: d.division_id ?? null,
      status: d.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/users`, async (req, res) => {
  try {
    const { name, email, role, division, status, password } = req.body;
    if (!name || !email || !role || !password)
      return res.status(400).json({ error: "Missing required fields" });
    let hashed;
    try {
      hashed = await bcrypt.hash(password, 10);
    } catch (e) {
      return res.status(500).json({ error: "Failed to hash password" });
    }
    const user = await User.create({
      name,
      email,
      role,
      division_id: division || null,
      status: status || "active",
      password: hashed,
    });
    logActivity(req, "CREATE_USER", { name, email, role });
    const result = await User.findById(user._id, {
      name: 1,
      email: 1,
      role: 1,
      division_id: 1,
      status: 1,
    }).lean();
    res.status(201).json({
      _id: result._id,
      name: result.name,
      email: result.email,
      role: result.role,
      division: result.division_id ?? null,
      status: result.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/users/:id`, async (req, res) => {
  try {
    const { name, email, role, division, status, password } = req.body;
    const update = { name, email, role, division_id: division, status };
    if (password && password.trim()) {
      update.password = await bcrypt.hash(password, 10);
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, projection: { name: 1, email: 1, role: 1, division_id: 1, status: 1 } }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    logActivity(req, "UPDATE_USER", { id: req.params.id, name });
    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      division: updated.division_id ?? null,
      status: updated.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/users/:id`, async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logActivity(req, "DELETE_USER", { id: req.params.id, name: deleted.name });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Employees (Workers/Pemanen - no login)
app.get(`${API_BASE_PATH}/employees`, async (_req, res) => {
  try {
    const docs = await Employee.find(
      {},
      { nik: 1, name: 1, companyId: 1, position: 1, salary: 1, address: 1, phone: 1, birthDate: 1, status: 1 }
    ).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_BASE_PATH}/employees/:id`, async (req, res) => {
  try {
    const d = await Employee.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/employees`, async (req, res) => {
  try {
    const { nik, name, companyId, position, salary, address, phone, birthDate } = req.body;
    if (!nik || !name)
      return res.status(400).json({ error: "Missing required fields (NIK, name)" });

    const employee = await Employee.create({
      nik,
      name,
      companyId: companyId || null,
      position: position || null,
      salary: salary || null,
      address: address || null,
      phone: phone || null,
      birthDate: birthDate || null,
      status: "active",
    });
    logActivity(req, "CREATE_EMPLOYEE", { nik, name });
    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/employees/:id`, async (req, res) => {
  try {
    const { nik, name, companyId, position, salary, address, phone, birthDate, status } = req.body;

    const updateData = {
      nik,
      name,
      companyId: companyId || null,
      position: position || null,
      salary: salary || null,
      address: address || null,
      phone: phone || null,
      birthDate: birthDate || null,
      status
    };

    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updated) {
      console.log(`[Employee] Update failed: ID ${req.params.id} not found`);
      return res.status(404).json({ error: "Not found" });
    }

    logActivity(req, "UPDATE_EMPLOYEE", { id: req.params.id, nik, name });
    res.json(updated);
  } catch (err) {
    console.error("[Employee] Update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/employees/:id`, async (req, res) => {
  try {
    const deleted = await Employee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logActivity(req, "DELETE_EMPLOYEE", { id: req.params.id, nik: deleted.nik, name: deleted.name });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// JobCodes
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
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create target
app.post(`${API_BASE_PATH}/targets`, async (req, res) => {
  try {
    const { division, period, target, achieved, status } = req.body;
    if (!division || !period || target === undefined)
      return res.status(400).json({ error: "Missing required fields" });
    const created = await Target.create({
      division,
      period,
      target,
      achieved,
      status,
    });

    logActivity(req, "CREATE_TARGET", { division, period, target });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update target
app.put(`${API_BASE_PATH}/targets/:id`, async (req, res) => {
  try {
    const updated = await Target.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    logActivity(req, "UPDATE_TARGET", { target_id: req.params.id, updates: req.body });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete target
app.delete(`${API_BASE_PATH}/targets/:id`, async (req, res) => {
  try {
    const deleted = await Target.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logActivity(req, "DELETE_TARGET", { target_id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Closing Periods
app.get(`${API_BASE_PATH}/closing-periods`, async (_req, res) => {
  try {
    const docs = await ClosingPeriod.find({}).sort({ startDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/closing-periods`, async (req, res) => {
  try {
    const { startDate, endDate, notes, month, year } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and End date are required" });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: "Start date must be before End date" });
    }

    // Check overlap (optional, but good practice)
    const overlap = await ClosingPeriod.findOne({
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });
    if (overlap) {
      return res.status(400).json({ error: "Periode ini bertabrakan dengan periode yang sudah ditutup." });
    }

    const created = await ClosingPeriod.create({ startDate: start, endDate: end, notes, month, year });
    logActivity(req, "CLOSE_PERIOD", { startDate, endDate });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/closing-periods/:id`, async (req, res) => {
  try {
    // Only manager should be able to do this (middleware check usually, here we assume role check in frontend + trust for now or add explicit check)
    const deleted = await ClosingPeriod.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logActivity(req, "REOPEN_PERIOD", { period_id: req.params.id, startDate: deleted.startDate, endDate: deleted.endDate });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports
app.get(`${API_BASE_PATH}/reports`, async (req, res) => {
  try {
    const { status, division, employeeId, employeeName, startDate, endDate } =
      req.query;
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
app.get(`${API_BASE_PATH}/reports/:id`, async (req, res) => {
  try {
    const doc = await Report.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Redefine PUT /reports/:id correctly
app.put(`${API_BASE_PATH}/reports/:id`, async (req, res) => {
  try {
    const current = await Report.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });

    if (await checkDateClosed(current.date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup. Tidak dapat mengubah data." });
    }
    if (req.body.date && await checkDateClosed(req.body.date)) {
      return res.status(400).json({ error: "Tanggal baru berada dalam periode yang sudah ditutup." });
    }

    const updated = await Report.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).lean();
    logActivity(req, "UPDATE_REPORT", { report_id: req.params.id, updates: req.body });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete report
app.delete(`${API_BASE_PATH}/reports/:id`, async (req, res) => {
  try {
    const current = await Report.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });

    if (await checkDateClosed(current.date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup. Tidak dapat menghapus data." });
    }

    const deleted = await Report.findByIdAndDelete(req.params.id).lean();
    logActivity(req, "DELETE_REPORT", { report_id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/reports`, async (req, res) => {
  try {
    const { employeeId, employeeName, date, division, jobType, hk, notes } =
      req.body;
    if (!employeeName || !date || !division || !jobType || hk === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (await checkDateClosed(date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup." });
    }
    const doc = await Report.create({
      employeeId,
      employeeName,
      date,
      division,
      jobType,
      hk,
      notes,
    });
    logActivity(req, "INPUT_DAILY_REPORT", { employee: employeeName, job: jobType, hk });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch(`${API_BASE_PATH}/reports/:id/approve`, async (req, res) => {
  try {
    const current = await Report.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(current.date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup." });
    }

    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejectedReason: null },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    logActivity(req, "APPROVE_REPORT", { report_id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch(`${API_BASE_PATH}/reports/:id/reject`, async (req, res) => {
  try {
    const current = await Report.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(current.date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup." });
    }

    const { reason } = req.body;
    const updated = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejectedReason: reason || null },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    logActivity(req, "REJECT_REPORT", { report_id: req.params.id, reason });
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
          _id: { employeeName: "$employeeName", division: "$division" },
          totalHK: { $sum: "$hk" },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$hk", 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$hk", 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, "$hk", 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          employee: "$_id.employeeName",
          division: "$_id.division",
          totalHK: 1,
          approved: 1,
          pending: 1,
          rejected: 1,
        },
      },
      { $sort: { employee: 1 } },
    ];
    const rows = await Report.aggregate(pipeline);
    logActivity(req, "VIEW_REPORT_RECAP", { startDate, endDate });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
// Stats
app.get(`${API_BASE_PATH}/stats`, async (req, res) => {
  try {
    const { estateId } = req.query;
    let reportFilter = {};
    let targetFilter = { status: "active" };

    // If estateId is provided, filter by divisions in that estate
    if (estateId) {
      const estate = await Estate.findById(estateId).lean();
      if (estate && estate.divisions) {
        // Convert division_ids to strings as Report.division is String
        const divIds = estate.divisions.map(d => String(d.division_id));
        reportFilter.division = { $in: divIds };
        targetFilter.division = { $in: divIds };
      }
    }

    const [totalEmployees, pendingCount, targets] = await Promise.all([
      Employee.countDocuments({}), // Keep global for now
      Report.countDocuments({ status: "pending", ...reportFilter }),
      Target.find(targetFilter, { target: 1, achieved: 1 }).lean(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayReports = await Report.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      ...reportFilter
    });

    const percent = targets.length
      ? Math.round(
        (targets.reduce((sum, t) => sum + (t.achieved || 0), 0) /
          targets.reduce((sum, t) => sum + (t.target || 0), 0)) *
        100
      )
      : 0;

    res.json({
      totalEmployees,
      todayReports,
      pendingCount,
      targetsPercent: percent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== New: Taksasi, Panen (Realisasi), Angkut (Transport) ======
// Helper: role-based division filter for foreman
function restrictByDivision(req, baseFilter = {}) {
  const auth = req.headers.authorization || "";
  const [, token] = auth.split(" ");
  if (!token) return baseFilter;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload && payload.role === "foreman" && payload.division != null) {
      return { ...baseFilter, division_id: Number(payload.division) };
    }
    return baseFilter;
  } catch {
    return baseFilter;
  }
}

// Taksasi
app.post(`${API_BASE_PATH}/taksasi`, async (req, res) => {
  try {
    const body = req.body;
    // Check closing for single or array
    const datesToCheck = Array.isArray(body) ? body.map(i => i.date) : [body.date];
    for (const d of datesToCheck) {
      if (await checkDateClosed(d)) return res.status(400).json({ error: `Periode untuk tanggal ${d} sudah ditutup.` });
    }

    if (Array.isArray(body)) {
      // Batch upsert for array
      const results = [];
      for (const item of body) {
        const key = { date: item.date, estateId: item.estateId, division_id: item.division_id, block_no: item.block_no };
        const updated = await Taksasi.findOneAndUpdate(key, item, { upsert: true, new: true });
        results.push(updated);
      }
      logActivity(req, "INPUT_TAKSASI", { count: results.length });
      return res.status(201).json(results);
    }
    // Single record upsert
    const key = { date: body.date, estateId: body.estateId, division_id: body.division_id, block_no: body.block_no };
    const created = await Taksasi.findOneAndUpdate(key, body, { upsert: true, new: true });
    logActivity(req, "INPUT_TAKSASI", { count: 1 });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/taksasi`, async (req, res) => {
  try {
    const { date, startDate, endDate, estateId, division_id } = req.query;
    const q = restrictByDivision(req, {});
    if (date) {
      q.date = new Date(String(date));
    } else if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(String(startDate));
      if (endDate) q.date.$lte = new Date(String(endDate));
    }
    if (estateId) q.estateId = String(estateId);
    if (division_id !== undefined) q.division_id = Number(division_id);
    const rows = await Taksasi.find(q).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Taksasi Selections (list of selected employees per block/day) ----
app.get(`${API_BASE_PATH}/taksasi-selections`, async (req, res) => {
  try {
    const { date, estateId, division_id, block_no } = req.query;
    const q = {};
    if (date) q.date = new Date(String(date));
    if (estateId) q.estateId = String(estateId);
    if (division_id !== undefined) q.division_id = Number(division_id);
    if (block_no) q.block_no = String(block_no);
    const docs = await TaksasiSelection.find(q).lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Upsert selection (merge employeeIds)
app.post(`${API_BASE_PATH}/taksasi-selections`, async (req, res) => {
  try {
    const { date, estateId, division_id, block_no, employeeIds, notes } = req.body || {};
    if (!date || !estateId || division_id == null || !block_no) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const key = {
      date: new Date(String(date)),
      estateId: String(estateId),
      division_id: Number(division_id),
      block_no: String(block_no)
    };
    const incoming = Array.isArray(employeeIds) ? employeeIds.map(String) : [];
    const uniqueIncoming = [...new Set(incoming)];
    const existing = await TaksasiSelection.findOne(key);
    if (existing) {
      existing.employeeIds = uniqueIncoming; // replace rather than merge
      existing.notes = notes ?? existing.notes;
      existing.updatedAt = new Date();
      await existing.save();
      return res.json(existing.toObject());
    } else {
      const created = await TaksasiSelection.create({ ...key, employeeIds: uniqueIncoming, notes });
      return res.status(201).json(created.toObject());
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete(`${API_BASE_PATH}/taksasi-selections/:id`, async (req, res) => {
  try {
    const deleted = await TaksasiSelection.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Custom Workers (temporary employees) ----
app.get(`${API_BASE_PATH}/custom-workers`, async (_req, res) => {
  try {
    const docs = await CustomWorker.find({ active: true }).lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post(`${API_BASE_PATH}/custom-workers`, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const created = await CustomWorker.create({ name });
    res.status(201).json(created.toObject());
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete(`${API_BASE_PATH}/custom-workers/:id`, async (req, res) => {
  try {
    const updated = await CustomWorker.findByIdAndUpdate(req.params.id, { active: false }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Panen (Realisasi)
app.post(`${API_BASE_PATH}/panen`, async (req, res) => {
  try {
    const body = req.body;
    const datesToCheck = Array.isArray(body) ? body.map(i => i.date_panen) : [body.date_panen];
    for (const d of datesToCheck) {
      if (await checkDateClosed(d)) return res.status(400).json({ error: `Periode untuk tanggal ${d} sudah ditutup.` });
    }

    if (Array.isArray(body)) {
      const docs = await Panen.insertMany(body);
      return res.status(201).json(docs);
    }
    const created = await Panen.create(body);
    logActivity(req, "INPUT_PANEN", { count: Array.isArray(body) ? body.length : 1 });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/panen`, async (req, res) => {
  try {
    const { date_panen, startDate, endDate, estateId, division_id } = req.query;
    const q = restrictByDivision(req, {});
    if (date_panen) {
      q.date_panen = new Date(String(date_panen));
    } else if (startDate || endDate) {
      q.date_panen = {};
      if (startDate) q.date_panen.$gte = new Date(String(startDate));
      if (endDate) q.date_panen.$lte = new Date(String(endDate));
    }
    if (estateId) q.estateId = String(estateId);
    if (division_id !== undefined) q.division_id = Number(division_id);
    const rows = await Panen.find(q).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/panen/:id`, async (req, res) => {
  try {
    const existing = await Panen.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Panen record not found' });

    // Check if date is closed
    const dateToCheck = req.body.date_panen || existing.date_panen;
    if (await checkDateClosed(dateToCheck)) {
      return res.status(400).json({ error: `Periode untuk tanggal ${dateToCheck} sudah ditutup.` });
    }

    const updated = await Panen.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    logActivity(req, "UPDATE_PANEN", { panenId: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete(`${API_BASE_PATH}/panen/:id`, async (req, res) => {
  try {
    const existing = await Panen.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Panen record not found' });

    // Check if date is closed
    if (await checkDateClosed(existing.date_panen)) {
      return res.status(400).json({ error: `Periode untuk tanggal ${existing.date_panen} sudah ditutup.` });
    }

    await Panen.findByIdAndDelete(req.params.id);
    logActivity(req, "DELETE_PANEN", { panenId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Angkut (Transport) locked to date_panen
app.post(`${API_BASE_PATH}/angkut`, async (req, res) => {
  try {
    const body = req.body;
    const datesToCheck = Array.isArray(body) ? body.map(i => i.date_panen) : [body.date_panen];
    for (const d of datesToCheck) {
      if (await checkDateClosed(d)) return res.status(400).json({ error: `Periode untuk tanggal ${d} sudah ditutup.` });
    }

    if (Array.isArray(body)) {
      for (const r of body)
        if (!r.date_panen)
          return res.status(400).json({ error: "date_panen required" });
      const docs = await Angkut.insertMany(body);
      return res.status(201).json(docs);
    }
    if (!body.date_panen)
      return res.status(400).json({ error: "date_panen required" });
    const created = await Angkut.create(body);
    logActivity(req, "INPUT_ANGKUT", { count: 1 });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/angkut`, async (req, res) => {
  try {
    const { date_panen, date_angkut, estateId, division_id } = req.query;
    const q = restrictByDivision(req, {});
    if (date_panen) q.date_panen = new Date(String(date_panen));
    if (date_angkut) q.date_angkut = new Date(String(date_angkut));
    if (estateId) q.estateId = String(estateId);
    if (division_id !== undefined) q.division_id = Number(division_id);
    const rows = await Angkut.find(q).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/angkut/:id`, async (req, res) => {
  try {
    const existing = await Angkut.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Angkut record not found' });

    // Check if date is closed
    const dateToCheck = req.body.date_panen || existing.date_panen;
    if (await checkDateClosed(dateToCheck)) {
      return res.status(400).json({ error: `Periode untuk tanggal ${dateToCheck} sudah ditutup.` });
    }

    const updated = await Angkut.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    logActivity(req, "UPDATE_ANGKUT", { angkutId: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance
app.post(`${API_BASE_PATH}/attendance`, async (req, res) => {
  try {
    // enforce division for foreman
    // enforce division for foreman
    const filter = restrictByDivision(req, {});
    if (filter.division_id != null) req.body.division_id = filter.division_id;

    const datesToCheck = Array.isArray(req.body) ? req.body.map(i => i.date) : [req.body.date];
    for (const d of datesToCheck) {
      if (await checkDateClosed(d)) return res.status(400).json({ error: `Periode untuk tanggal ${d} sudah ditutup.` });
    }

    const created = await Attendance.create(req.body);
    logActivity(req, "INPUT_ATTENDANCE", { count: Array.isArray(req.body) ? req.body.length : 1 });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/attendance`, async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    const q = restrictByDivision(req, {});
    if (date) q.date = new Date(String(date));
    if (employeeId) q.employeeId = String(employeeId);
    const rows = await Attendance.find(q).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put(`${API_BASE_PATH}/attendance/:id`, async (req, res) => {
  try {
    const filter = restrictByDivision(req, {});
    if (filter.division_id != null) req.body.division_id = filter.division_id;

    if (await checkDateClosed(req.body.date)) {
      return res.status(400).json({ error: `Periode untuk tanggal ${req.body.date} sudah ditutup.` });
    }

    const updated = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Attendance not found' });
    logActivity(req, "UPDATE_ATTENDANCE", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Job Codes
app.get(`${API_BASE_PATH}/jobcodes`, async (_req, res) => {
  try {
    const rows = await JobCode.find().lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(`${API_BASE_PATH}/jobcodes`, async (req, res) => {
  try {
    const created = await JobCode.create(req.body);
    logActivity(req, "CREATE_JOBCODE", { code: req.body.code, description: req.body.description });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put(`${API_BASE_PATH}/jobcodes/:code`, async (req, res) => {
  try {
    const updated = await JobCode.findOneAndUpdate(
      { code: req.params.code },
      req.body,
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    logActivity(req, "UPDATE_JOBCODE", { code: req.params.code, updates: req.body });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete(`${API_BASE_PATH}/jobcodes/:code`, async (req, res) => {
  try {
    await JobCode.deleteOne({ code: req.params.code });
    logActivity(req, "DELETE_JOBCODE", { code: req.params.code });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: taksasi per block (tons/kg)
app.get(`${API_BASE_PATH}/reports/taksasi-per-block`, async (req, res) => {
  try {
    const { date } = req.query;
    const match = {};
    if (date) match.date = new Date(String(date));
    const rows = await Taksasi.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            estateId: "$estateId",
            division_id: "$division_id",
            block_no: "$block_no",
          },
          totalKg: { $sum: "$weightKg" },
        },
      },
      {
        $project: {
          _id: 0,
          estateId: "$_id.estateId",
          division_id: "$_id.division_id",
          block_no: "$_id.block_no",
          totalKg: 1,
        },
      },
      { $sort: { estateId: 1, division_id: 1, block_no: 1 } },
    ]);
    logActivity(req, "VIEW_REPORT_TAKSASI", { date });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: trend (top yields) - from Panen by default
app.get(`${API_BASE_PATH}/reports/trend`, async (req, res) => {
  try {
    const { type = "panen", limit = 50, sort = "desc" } = req.query;
    const col =
      String(type) === "taksasi"
        ? Taksasi
        : String(type) === "angkut"
          ? Angkut
          : Panen;
    const key = String(type) === "angkut" ? "weightKg" : "weightKg";
    const order = String(sort) === "asc" ? 1 : -1;
    const rows = await col
      .aggregate([
        {
          $group: {
            _id: {
              estateId: "$estateId",
              division_id: "$division_id",
              block_no: "$block_no",
            },
            totalKg: { $sum: `$${key}` },
          },
        },
        {
          $project: {
            _id: 0,
            estateId: "$_id.estateId",
            division_id: "$_id.division_id",
            block_no: "$_id.block_no",
            totalKg: 1,
          },
        },
        { $sort: { totalKg: order } },
        { $limit: Number(limit) },
      ])
      .exec();
    logActivity(req, "VIEW_REPORT_TREND", { type, limit, sort });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: statement summary for a period from Panen
app.get(`${API_BASE_PATH}/reports/statement`, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.date_panen = {};
      if (startDate) match.date_panen.$gte = new Date(String(startDate));
      if (endDate) match.date_panen.$lte = new Date(String(endDate));
    }
    const rows = await Panen.aggregate([
      { $match: match },
      {
        $group: {
          _id: { estateId: "$estateId", division_id: "$division_id" },
          totalKg: { $sum: "$weightKg" },
          blocks: { $addToSet: "$block_no" },
        },
      },
      {
        $project: {
          _id: 0,
          estateId: "$_id.estateId",
          division_id: "$_id.division_id",
          totalKg: 1,
          blockCount: { $size: "$blocks" },
        },
      },
      { $sort: { estateId: 1, division_id: 1 } },
    ]);
    logActivity(req, "VIEW_REPORT_STATEMENT", { startDate, endDate });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Activity Logs - Simplified Unified Handler ============
const handleActivityLogPost = async (req, res) => {
  try {
    const payload = req.body;
    const entries = Array.isArray(payload) ? payload : [payload];
    if (entries.length === 0) return res.status(400).json({ error: 'Empty payload' });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const docs = entries.map(e => ({
      user_id: e.userId && /^[0-9a-fA-F]{24}$/.test(e.userId) ? e.userId : undefined,
      user_name: e.user_name || e.userName || 'System',
      role: e.role || 'system',
      action: e.action || 'UNKNOWN',
      details: e.details || e.meta || {},
      ip_address: ip,
      timestamp: e.ts ? new Date(e.ts) : new Date(),
    }));

    await ActivityLog.insertMany(docs, { ordered: false });
    res.json({ ok: true, count: docs.length });
  } catch (err) {
    console.error('Activity log POST error:', err);
    res.status(500).json({ error: err.message });
  }
};

const handleActivityLogGet = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ActivityLog.find({}).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments({})
    ]);

    res.json({
      data: logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Activity log GET error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Register all variants
app.post(`${API_BASE_PATH}/activity-logs`, handleActivityLogPost);
app.get(`${API_BASE_PATH}/activity-logs`, handleActivityLogGet);
app.post(`${API_BASE_PATH}/activitylogs`, handleActivityLogPost);
app.get(`${API_BASE_PATH}/activitylogs`, handleActivityLogGet);
app.post('/activity-logs', handleActivityLogPost);
app.get('/activity-logs', handleActivityLogGet);
app.post('/activitylogs', handleActivityLogPost);
app.get('/activitylogs', handleActivityLogGet);

console.log('✓ Activity log routes registered (all variants)');

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}${API_BASE_PATH}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
