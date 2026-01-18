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
import DailyReport from "./models/DailyReport.js";
import OperationalCost from "./models/OperationalCost.js";
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

const PORT = process.env.PORT || 5000;
const API_BASE_PATH = process.env.API_BASE_PATH || "/api";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Expose a simple release marker to confirm which code is running on hosting.
// Set APP_RELEASE in hosting env for stable identification.
const APP_RELEASE = process.env.APP_RELEASE || `local-${new Date().toISOString()}`;

// Some hosting reverse proxies mount the Node app at a URL prefix and may strip it.
// This makes the API base path optional: both `/api/foo` and `/foo` can work.
// (Safe for an API-only subdomain; avoids hard-to-diagnose 404s.)
if (API_BASE_PATH && API_BASE_PATH !== "/") {
  const base = API_BASE_PATH.startsWith("/") ? API_BASE_PATH : `/${API_BASE_PATH}`;
  app.use((req, _res, next) => {
    // Don't double-prefix if already present.
    if (req.url === base || req.url.startsWith(`${base}/`)) return next();
    // Prefix everything else.
    req.url = `${base}${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    next();
  });
}

// Helpful header for debugging deploy/version mismatches
app.use((_req, res, next) => {
  res.setHeader("X-SawiTrack-Release", APP_RELEASE);
  next();
});

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

const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();

// Safe defaults if env is not set (helps avoid accidental prod outage).
if (allowedOrigins.length === 0) {
  allowedOrigins.push("https://palmaroots.my.id", "https://www.palmaroots.my.id");
}

const allowedOriginsNormalized = new Set(allowedOrigins.map(normalizeOrigin));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    // Auto-allow all Vercel preview domains if running on Vercel
    const isVercel =
      process.env.VERCEL && normalizedOrigin.endsWith(".vercel.app");
    const isAllowed = allowedOriginsNormalized.has(normalizedOrigin) || isVercel;

    if (isAllowed) return callback(null, true);
    console.warn("CORS blocked", {
      origin,
      normalizedOrigin,
      allowedOrigins: Array.from(allowedOriginsNormalized),
    });
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
// Note: cors() middleware already handles OPTIONS preflight automatically

// Debug endpoint (open it directly on the API domain to inspect CORS env parsing)
const corsDebugHandler = (req, res) => {
  res.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV,
    apiBasePath: API_BASE_PATH,
    corsOriginEnv: process.env.CORS_ORIGIN || null,
    requestOrigin: req.headers.origin || null,
    allowedOrigins: Array.from(allowedOriginsNormalized),
  });
};
app.get(`${API_BASE_PATH}/cors-debug`, corsDebugHandler);
app.get("/api/cors-debug", corsDebugHandler);
app.get("/cors-debug", corsDebugHandler);

// Security Headers (Helmet) - DISABLED TEMPORARILY FOR DEBUGGING
// app.use(helmet({
//   crossOriginResourcePolicy: false,
// }));

app.use(compression()); // Compress responses
app.use(express.json({ limit: "50mb" })); // Increase limit for large imports
app.use(cookieParser());

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

// Deployment/debug meta
app.get(`${API_BASE_PATH}/__meta`, (req, res) => {
  res.json({
    ok: true,
    release: APP_RELEASE,
    nodeEnv: process.env.NODE_ENV || null,
    vercel: !!process.env.VERCEL,
    apiBasePath: API_BASE_PATH,
    now: new Date().toISOString(),
    requestUrl: req.originalUrl,
  });
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

// Frontend compatibility: `/api/reports`
app.get(`${API_BASE_PATH}/reports`, async (req, res) => {
  try {
    const { date, startDate, endDate, estate, division, status } = req.query;
    const q = {};
    if (date) q.date = date;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = startDate;
      if (endDate) q.date.$lte = endDate;
    }
    if (estate) q.estate = estate;
    if (division) q.division = divQuery(division);
    if (status) q.status = status;

    const docs = await Report.find(q).sort({ date: -1 }).limit(500).lean();
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

// Stats API (for frontend compatibility)
app.get(`${API_BASE_PATH}/stats`, async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ status: "active" });
    const todayReports = await Report.countDocuments({
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const pendingCount = await Report.countDocuments({ status: "pending" });
    res.json({
      totalEmployees,
      todayReports,
      pendingCount,
      targetsPercent: 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom Workers
app.get(`${API_BASE_PATH}/custom-workers`, async (req, res) => {
  try {
    const workers = await CustomWorker.find({}).lean();
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/custom-workers`, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const created = await CustomWorker.create({ name, active: true });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/custom-workers/:id`, async (req, res) => {
  try {
    await CustomWorker.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance
app.get(`${API_BASE_PATH}/attendance`, async (req, res) => {
  try {
    const { date, startDate, endDate, employeeId } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }
    if (employeeId) filter.employeeId = employeeId;
    const records = await Attendance.find(filter).sort({ date: -1 }).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/attendance`, async (req, res) => {
  try {
    const { date, employeeId, status, division_id, notes } = req.body;
    if (!date || !employeeId || !status)
      return res.status(400).json({ error: "Missing required fields" });
    if (await checkDateClosed(date))
      return res.status(400).json({ error: "Period is closed" });
    const created = await Attendance.create({
      date,
      employeeId,
      status,
      division_id,
      notes,
    });
    logActivity(req, "CREATE_ATTENDANCE", { employeeId, date });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/attendance/:id`, async (req, res) => {
  try {
    const existing = await Attendance.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date))
      return res.status(400).json({ error: "Period is closed" });
    const updated = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    logActivity(req, "UPDATE_ATTENDANCE", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/attendance/:id`, async (req, res) => {
  try {
    const existing = await Attendance.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date))
      return res.status(400).json({ error: "Period is closed" });
    await Attendance.findByIdAndDelete(req.params.id);
    logActivity(req, "DELETE_ATTENDANCE", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Angkut
app.get(`${API_BASE_PATH}/angkut`, async (req, res) => {
  try {
    const { date_panen, estateId, division_id, block_no } = req.query;
    const filter = {};
    if (date_panen) filter.date_panen = date_panen;
    if (estateId) filter.estateId = estateId;
    if (division_id) filter.division_id = divQuery(division_id);
    if (block_no) filter.block_no = block_no;
    const records = await Angkut.find(filter).sort({ date_panen: -1 }).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/angkut`, async (req, res) => {
  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const firstDate = data[0]?.date_panen;
    if (firstDate && (await checkDateClosed(firstDate)))
      return res.status(400).json({ error: "Period is closed" });
    const created = await Angkut.insertMany(data);
    logActivity(req, "CREATE_ANGKUT", { count: data.length });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/angkut/:id`, async (req, res) => {
  try {
    const existing = await Angkut.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date_panen))
      return res.status(400).json({ error: "Period is closed" });
    const updated = await Angkut.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    logActivity(req, "UPDATE_ANGKUT", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily Reports
app.get(`${API_BASE_PATH}/daily-reports`, async (req, res) => {
  try {
    const { date, startDate, endDate, mandorName, division } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }
    if (mandorName) filter.mandorName = mandorName;
    if (division) filter.division = division;
    const records = await DailyReport.find(filter).sort({ date: -1 }).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/daily-reports`, async (req, res) => {
  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const firstDate = data[0]?.date;
    if (firstDate && (await checkDateClosed(firstDate)))
      return res.status(400).json({ error: "Period is closed" });
    const created = await DailyReport.insertMany(data);
    logActivity(req, "CREATE_DAILY_REPORT", { count: data.length });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/daily-reports/:id`, async (req, res) => {
  try {
    const existing = await DailyReport.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date))
      return res.status(400).json({ error: "Period is closed" });
    const updated = await DailyReport.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    logActivity(req, "UPDATE_DAILY_REPORT", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/daily-reports/:id`, async (req, res) => {
  try {
    const existing = await DailyReport.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date))
      return res.status(400).json({ error: "Period is closed" });
    await DailyReport.findByIdAndDelete(req.params.id);
    logActivity(req, "DELETE_DAILY_REPORT", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Operational Costs (Recap)
app.get(`${API_BASE_PATH}/recap-costs`, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year)
      return res.status(400).json({ error: "Month and Year are required" });
    const range = getMonthRangeUtc(year, month);
    if (!range)
      return res.status(400).json({ error: "Invalid month or year" });
    const costs = await OperationalCost.find({
      date: { $gte: range.startDate, $lte: range.endDate },
    })
      .sort({ category: 1, date: 1 })
      .lean();
    res.json(costs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_BASE_PATH}/recap-costs`, async (req, res) => {
  try {
    const body = req.body;
    if (!body.date || !body.category || !body.jenisPekerjaan)
      return res.status(400).json({ error: "Missing required fields" });
    if (await checkDateClosed(body.date))
      return res.status(400).json({ error: "Period is closed" });
    const nextBody = { ...body };
    if (nextBody.date) {
      const ym = getAppTzYearMonth(nextBody.date);
      if (ym) {
        const normalized = getMonthRangeUtc(ym.year, ym.month)?.startDate;
        if (normalized) nextBody.date = normalized;
      }
    }
    const created = await OperationalCost.create(nextBody);
    logActivity(req, "CREATE_COST", {
      category: body.category,
      jenisPekerjaan: body.jenisPekerjaan,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(`${API_BASE_PATH}/recap-costs/:id`, async (req, res) => {
  try {
    const existing = await OperationalCost.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date))
      return res.status(400).json({ error: "Period is closed" });
    const nextBody = { ...req.body };
    if (nextBody.date) {
      const ym = getAppTzYearMonth(nextBody.date);
      if (ym) {
        const normalized = getMonthRangeUtc(ym.year, ym.month)?.startDate;
        if (normalized) nextBody.date = normalized;
      }
    }
    const updated = await OperationalCost.findByIdAndUpdate(
      req.params.id,
      nextBody,
      { new: true }
    );
    logActivity(req, "UPDATE_COST", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_BASE_PATH}/recap-costs/:id`, async (req, res) => {
  try {
    const existing = await OperationalCost.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (await checkDateClosed(existing.date))
      return res.status(400).json({ error: "Period is closed" });
    await OperationalCost.findByIdAndDelete(req.params.id);
    logActivity(req, "DELETE_COST", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export app for Vercel
export default app;

// Start Server (only if not on Vercel)
if (!process.env.VERCEL) {
  connectMongo()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Backend running on port ${PORT}`);
        console.log(`API Base Path: ${API_BASE_PATH}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
} else {
  // On Vercel, just ensure DB is connected for the handler
  connectMongo().catch((e) => console.error("Vercel DB Connect Error:", e));
}

// Graceful Shutdown for VPS/Node.js process
const gracefulShutdown = async () => {
  console.log("Received kill signal, shutting down gracefully");
  try {
    await mongoose.connection.close(false);
    console.log("Mongo connection closed");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
