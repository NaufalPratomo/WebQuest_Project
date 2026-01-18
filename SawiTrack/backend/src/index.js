// backend/src/index.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Estate from "./models/Estate.js";
import Company from "./models/Company.js";
import Employee from "./models/Employee.js";
import ForemanGroup from "./models/ForemanGroup.js";
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
import Pekerjaan from "./models/Pekerjaan.js";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import compression from "compression";
import helmet from "helmet";

// Load .env from backend/ and fallback to repo root
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const app = express();

// CORS
// IMPORTANT (prod): when frontend and backend are on different origins, you must set CORS_ORIGIN
// to the frontend origin(s), e.g. "https://palmaroots.my.id,https://www.palmaroots.my.id".
const CORS_ORIGIN = process.env.CORS_ORIGIN;

// Support multiple origins via comma-separated list.
// With credentials=true we must NOT use '*'.
const allowedOrigins = (CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Safe defaults if env is not set (helps avoid accidental prod outage).
if (allowedOrigins.length === 0) {
  allowedOrigins.push("https://palmaroots.my.id", "https://www.palmaroots.my.id");
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);

    // Auto-allow all Vercel preview domains if running on Vercel
    const isVercel = process.env.VERCEL && origin.endsWith(".vercel.app");
    const isAllowed = allowedOrigins.includes(origin) || isVercel;

    if (isAllowed) return callback(null, true);
    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

// Apply CORS early (before routes)
app.use((req, res, next) => {
  // Ensure caches/CDNs vary on Origin
  res.header("Vary", "Origin");
  next();
});
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Security Headers (Helmet) - DISABLED TEMPORARILY FOR DEBUGGING
// app.use(helmet({
//   crossOriginResourcePolicy: false,
// }));

app.use(compression()); // Compress responses
app.use(express.json({ limit: "50mb" })); // Increase limit for large imports
app.use(cookieParser());
// Re-declare constants needed later
const PORT = process.env.PORT || 5000;
const API_BASE_PATH = process.env.API_BASE_PATH || "/api";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const toDivId = (v) => (v === undefined || v === null || isNaN(Number(v)) ? v : Number(v));
const divQuery = (v) => (v === undefined || v === null || isNaN(Number(v)) ? v : { $in: [Number(v), String(v)] });

// App timezone handling
// Vercel runs in UTC, while most app data entry is in local time (e.g., WIB UTC+7).
// If we store month markers as Date, we must compute month ranges in a timezone-stable way.
// Configure via APP_TZ_OFFSET_MINUTES (default 420 = UTC+7).
const APP_TZ_OFFSET_MINUTES = Number(process.env.APP_TZ_OFFSET_MINUTES ?? 420);
const APP_TZ_OFFSET_MS =
  Number.isFinite(APP_TZ_OFFSET_MINUTES) ? APP_TZ_OFFSET_MINUTES * 60 * 1000 : 0;

function getAppTzYearMonth(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  // Convert to "app local" time by shifting, then read UTC components.
  const shifted = new Date(d.getTime() + APP_TZ_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

function getMonthRangeUtc(yearInput, monthInput) {
  const year = Number(yearInput);
  const month = Number(monthInput);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  // Range corresponds to [local month start 00:00, next month start 00:00) in app timezone.
  const startMs = Date.UTC(year, month, 1, 0, 0, 0) - APP_TZ_OFFSET_MS;
  const endMs = Date.UTC(year, month + 1, 1, 0, 0, 0) - APP_TZ_OFFSET_MS - 1;
  return { startDate: new Date(startMs), endDate: new Date(endMs) };
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

async function connectMongo() {
  if (!MONGO_URI) {
    throw new Error("Missing Mongo URI (set MONGO_ATLAS_URI or MONGO_URI)");
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
            const foundUser = await User.findById(payload.sub, {
              name: 1,
              role: 1,
            }).lean();
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

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    await ActivityLog.create({
      user_id: user?._id,
      user_name: user?.name || details.user_name || "System/Unknown",
      role: user?.role,
      action,
      details,
      ip_address: ip,
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
    endDate: { $gte: d },
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
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: cookieDomain,
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
    const { company_name, address, phone, email, estates, status } = req.body;
    if (!company_name || !address)
      return res
        .status(400)
        .json({ error: "company_name and address are required" });
    const created = await Company.create({
      company_name,
      address,
      phone,
      email,
      status: status || "active",
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
    const { company_name, address, phone, email, estates, status } = req.body;
    const update = {};
    if (company_name !== undefined) update.company_name = company_name;
    if (address !== undefined) update.address = address;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (status !== undefined) update.status = status;
    if (estates !== undefined) update.estates = estates;
    const updated = await Company.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).lean();
    if (!updated) return res.status(404).json({ error: "Company not found" });
    logActivity(req, "UPDATE_COMPANY", {
      company_id: req.params.id,
      updates: update,
    });
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

    logActivity(req, "UPDATE_ESTATE", {
      estate_id: req.params.id,
      updates: update,
    });
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

      // Handle both string and number division IDs
      let queryVal = [divisionId];
      if (!isNaN(Number(divisionId))) {
        queryVal.push(Number(divisionId));
      }

      const estate = await Estate.findById(id, {
        divisions: { $elemMatch: { division_id: { $in: queryVal } } },
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
      {
        new: true,
        projection: { name: 1, email: 1, role: 1, division_id: 1, status: 1 },
      }
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
      {
        nik: 1,
        name: 1,
        companyId: 1,
        pt: 1,
        mandorId: 1,
        position: 1,
        salary: 1,
        address: 1,
        phone: 1,
        birthDate: 1,
        gender: 1,
        religion: 1,
        division: 1,
        division_id: 1,
        joinDate: 1,
        status: 1,
      }
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
    const {
      nik,
      name,
      companyId,
      pt,
      position,
      salary,
      address,
      phone,
      birthDate,
      gender,
      religion,
      division,
      division_id,
      joinDate,
    } = req.body;
    if (!nik || !name)
      return res
        .status(400)
        .json({ error: "Missing required fields (NIK, name)" });

    const employee = await Employee.create({
      nik,
      name,
      companyId: companyId || null,
      pt: pt || null,
      mandorId: req.body.mandorId || null,
      position: position || null,
      salary: salary || null,
      address: address || null,
      phone: phone || null,
      birthDate: birthDate || null,
      gender: gender || null,
      religion: religion || null,
      division: division || null,
      division_id: division_id ?? null,
      joinDate: joinDate || null,
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
    const {
      nik,
      name,
      companyId,
      pt,
      position,
      salary,
      address,
      phone,
      birthDate,
      gender,
      religion,
      division,
      division_id,
      joinDate,
      status,
    } = req.body;

    const updateData = {
      nik,
      name,
      companyId: companyId || null,
      pt: pt ?? null,
      mandorId: req.body.mandorId || null,
      position: position || null,
      salary: salary || null,
      address: address || null,
      phone: phone || null,
      birthDate: birthDate || null,
      gender: gender || null,
      religion: religion || null,
      division: division || null,
      division_id: division_id ?? null,
      joinDate: joinDate || null,
      status,
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
    logActivity(req, "DELETE_EMPLOYEE", {
      id: req.params.id,
      nik: deleted.nik,
      name: deleted.name,
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Foreman groups (grup mandor) - grouping pemanen under a mandor
app.get(`${API_BASE_PATH}/foreman-groups`, async (_req, res) => {
  try {
    const groups = await ForemanGroup.find({}).lean();
    res.json(groups);
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
    logActivity(req, "UPDATE_TARGET", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete(`${API_BASE_PATH}/targets/:id`, async (req, res) => {
  try {
    const deleted = await Target.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    logActivity(req, "DELETE_TARGET", { id: req.params.id });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Taksasi (Estimates)
app.get(`${API_BASE_PATH}/taksasi`, async (req, res) => {
  try {
    // Optional filter by date/division
    const { date, division, estate } = req.query;
    const q = {};
    if (date) q.date = date;
    if (division) q.division = divQuery(division);
    if (estate) q.estate = estate;

    // Populate helper to fetch division name from Estate
    // Since division is just a number/string in Taksasi, we might need a lookup if we want name
    const docs = await Taksasi.find(q).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(`${API_BASE_PATH}/taksasi`, async (req, res) => {
  try {
    const { estate, division, date, blokData } = req.body;
    // validation...
    if (await checkDateClosed(date)) {
      return res.status(400).json({ error: "Period is closed for this date" });
    }
    const created = await Taksasi.create({
      estate,
      division: toDivId(division),
      date,
      blokData,
    });
    logActivity(req, "CREATE_TAKSASI", { estate, division, date });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Taksasi Selection
app.get(`${API_BASE_PATH}/taksasi-selection`, async (req, res) => {
  try {
    const { date, division, estate } = req.query;
    const q = {};
    if (date) q.date = date;
    if (division) q.division = divQuery(division);
    if (estate) q.estate = estate;
    const docs = await TaksasiSelection.find(q).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(`${API_BASE_PATH}/taksasi-selection`, async (req, res) => {
  try {
    const { estate, division, date, selectedBloks } = req.body;
    if (await checkDateClosed(date)) {
      return res.status(400).json({ error: "Period is closed for this date" });
    }
    // Upsert logic typically
    const doc = await TaksasiSelection.findOneAndUpdate(
      { estate, division: toDivId(division), date },
      { selectedBloks },
      { upsert: true, new: true }
    );
    logActivity(req, "UPDATE_TAKSASI_SELECTION", { estate, division, date });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Job Codes (Jenis Pekerjaan)
app.get(`${API_BASE_PATH}/job-codes`, async (_req, res) => {
  try {
    const docs = await JobCode.find({}).sort({ code: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(`${API_BASE_PATH}/pekerjaan`, async (_req, res) => {
  try {
    const docs = await Pekerjaan.find({}).sort({ code: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom Workers (Tenaga Kerja Lain)
// ... CRUD endpoints

// Panen (Harvest)
app.get(`${API_BASE_PATH}/panen`, async (req, res) => {
  try {
    const { date, region } = req.query;
    const q = {};
    if (date) q.date = date;
    // region might map to estate/division logic
    const docs = await Panen.find(q).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(`${API_BASE_PATH}/panen`, async (req, res) => {
  try {
    if (await checkDateClosed(req.body.date)) {
      return res.status(400).json({ error: "Period is closed for this date" });
    }
    const created = await Panen.create(req.body); // simplified
    logActivity(req, "CREATE_PANEN", { date: req.body.date });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Angkut (Transport)
// ... CRUD endpoints

// Reports (Laporan Harian / Monthly)
app.get(`${API_BASE_PATH}/reports/daily`, async (req, res) => {
  try {
    const { date, estate, division } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });
    // Aggregation logic connecting Panen, Angkut, Attendance, etc.
    // For now returning mock or stored DailyReport
    const q = { date };
    if (estate) q.estate = estate;
    if (division) q.division = divQuery(division);
    const docs = await Report.find(q).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Closing Periods (Tutup Buku)
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
    const { startDate, endDate, name, isLocked } = req.body;
    const created = await ClosingPeriod.create({
      startDate,
      endDate,
      name,
      isLocked,
    });
    logActivity(req, "CREATE_CLOSING_PERIOD", { name });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete(`${API_BASE_PATH}/closing-periods/:id`, async (req, res) => {
  try {
    await ClosingPeriod.findByIdAndDelete(req.params.id);
    logActivity(req, "DELETE_CLOSING_PERIOD", {});
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activity Logs
app.get(`${API_BASE_PATH}/activity-logs`, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const docs = await ActivityLog.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Stats (Simple Aggregation)
app.get(`${API_BASE_PATH}/dashboard/stats`, async (req, res) => {
  try {
    // Example: total harvest today
    const today = new Date().toISOString().split("T")[0];
    const panenCount = await Panen.countDocuments({ date: today });
    const attendanceCount = await Attendance.countDocuments({ date: today });
    res.json({
      panenToday: panenCount,
      attendanceToday: attendanceCount,
      // ... more stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
connectMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
    console.log(`API Base Path: ${API_BASE_PATH}`);
  });
});
