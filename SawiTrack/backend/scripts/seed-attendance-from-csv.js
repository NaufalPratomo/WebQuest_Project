import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Attendance from "../src/models/Attendance.js";
import Employee from "../src/models/Employee.js";
import User from "../src/models/User.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const DB_NAME = process.env.MONGO_DB_NAME;
let MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  const u = process.env.MONGO_USER;
  const p = process.env.MONGO_PASS;
  const h = process.env.MONGO_HOST;
  const dbName = process.env.MONGO_DB_NAME || "admin";
  if (u && p && h) {
    const encUser = encodeURIComponent(u);
    const encPass = encodeURIComponent(p);
    MONGO_URI = `mongodb+srv://${encUser}:${encPass}@${h}/${dbName}?retryWrites=true&w=majority`;
  }
}

function parseArgs(argv) {
  const args = {
    file: "",
    reset: true,
    createMissingEmployees: true,
    deleteInRangeOnly: true,
    divisionMap: "", // format: "Liyodu=1,Batulayar=2"
    emailDomain: "mandor.local",
    defaultForemanPassword: "Password123!",
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];

    if (t === "--file" && argv[i + 1]) {
      args.file = argv[i + 1];
      i++;
      continue;
    }
    if (t === "--no-reset") {
      args.reset = false;
      continue;
    }
    if (t === "--no-create-missing-employees") {
      args.createMissingEmployees = false;
      continue;
    }
    if (t === "--reset-all") {
      args.deleteInRangeOnly = false;
      continue;
    }
    if (t === "--division-map" && argv[i + 1]) {
      args.divisionMap = argv[i + 1];
      i++;
      continue;
    }
    if (t === "--email-domain" && argv[i + 1]) {
      args.emailDomain = argv[i + 1];
      i++;
      continue;
    }
    if (t === "--default-foreman-password" && argv[i + 1]) {
      args.defaultForemanPassword = argv[i + 1];
      i++;
      continue;
    }
    if (t === "--help" || t === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`\nSeed Attendance from semicolon CSV\n\nUsage:\n  node scripts/seed-attendance-from-csv.js --file "/path/to/absen.csv"\n\nIf --file is omitted, it will try:\n  backend/data/absen.csv\n\nOptions:\n  --no-reset                        Do not delete existing attendance\n  --reset-all                        Delete ALL attendance docs (danger)\n  --no-create-missing-employees      Do not create employees missing in DB\n  --division-map "Name=1,Name2=2"    Override division_id mapping\n  --email-domain mandor.local        Domain for foreman emails\n  --default-foreman-password pass    Default password for newly created foreman users\n\nNotes:\n  - Only numeric day cells are inserted as status=present with hk=<value>\n  - Total rows ("... Total") are ignored\n`);
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function slugifyEmailLocalPart(name) {
  const base = normalizeText(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return base || "mandor";
}

function parseDecimal(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  // Accept Indonesian decimals like 0,5
  const normalized = s.replace(/,/g, ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseSemicolonLines(text) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
}

function isTotalRow(parts) {
  const divisionCell = normalizeText(parts[1]);
  const mandorCell = normalizeText(parts[2]);
  const nameCell = normalizeText(parts[3]);
  return (
    /\btotal\b/i.test(divisionCell) ||
    /\btotal\b/i.test(mandorCell) ||
    /\btotal\b/i.test(nameCell)
  );
}

function parseHeaderDates(headerParts) {
  // Header: PT;DIVISI;Mandoran;Nama Karyawan;01/12/25;...;Grand Total
  const dateCols = [];
  for (let i = 4; i < headerParts.length; i++) {
    const raw = normalizeText(headerParts[i]);
    if (!raw) continue;
    if (/^grand\s*total$/i.test(raw)) break;

    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!m) continue;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const fullYear = yy >= 70 ? 1900 + yy : 2000 + yy;
    const date = new Date(Date.UTC(fullYear, mm - 1, dd));
    dateCols.push({ index: i, date, label: raw });
  }
  if (dateCols.length === 0) throw new Error("No date columns found in CSV header");
  return dateCols;
}

function buildDivisionIdMap(divisionNames, override) {
  const map = new Map();

  if (override) {
    // "Liyodu=1,Batulayar=2"
    const pairs = override.split(",").map((p) => p.trim()).filter(Boolean);
    for (const p of pairs) {
      const [k, v] = p.split("=");
      if (!k || !v) continue;
      const name = normalizeText(k);
      const id = Number(String(v).trim());
      if (!name || !Number.isFinite(id)) continue;
      map.set(name, id);
    }
    return map;
  }

  const sorted = [...new Set(divisionNames.map((d) => normalizeText(d)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sorted.forEach((d, idx) => map.set(d, idx + 1));
  return map;
}

async function ensureForemanUserAndEmployee({ mandorName, divisionId, divisionName, pt, emailDomain, defaultForemanPassword, usersByName }) {
  const key = normalizeKey(mandorName);
  if (usersByName.has(key)) return usersByName.get(key);

  const emailLocal = slugifyEmailLocalPart(mandorName);
  const email = `${emailLocal}@${emailDomain}`;

  let user = await User.findOne({ email }).lean();
  if (!user) {
    const hashed = await bcrypt.hash(defaultForemanPassword, 10);
    user = await User.create({
      name: mandorName,
      email,
      password: hashed,
      role: "foreman",
      division_id: divisionId,
      status: "active",
    });
  } else {
    // keep existing role but ensure division_id is set
    await User.updateOne({ _id: user._id }, { $set: { division_id: divisionId } });
  }

  // Ensure a matching Employee entry exists for mandor (for consistency with other screens)
  const existingEmp = await Employee.findOne({ name: mandorName, position: "mandor" }).lean();
  if (!existingEmp) {
    await Employee.create({
      name: mandorName,
      nik: "",
      position: "mandor",
      mandorId: String(user._id),
      division: divisionName,
      division_id: divisionId,
      pt,
      status: "active",
    });
  } else {
    const patch = {};
    if (pt && existingEmp.pt !== pt) patch.pt = pt;
    if (divisionName && existingEmp.division !== divisionName) patch.division = divisionName;
    if (divisionId != null && existingEmp.division_id !== divisionId) patch.division_id = divisionId;
    if (String(existingEmp.mandorId || "") !== String(user._id)) patch.mandorId = String(user._id);
    if (Object.keys(patch).length > 0) {
      await Employee.updateOne({ _id: existingEmp._id }, { $set: patch });
    }
  }

  const result = { _id: String(user._id), name: user.name, email: user.email };
  usersByName.set(key, result);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file) {
    const fallback = path.resolve(__dirname, "../data/absen.csv");
    try {
      await fs.access(fallback);
      args.file = fallback;
    } catch {
      // ignore
    }
  }

  if (args.help || !args.file) {
    printHelp();
    process.exit(args.file ? 0 : 1);
  }
  if (!MONGO_URI) throw new Error("Missing MongoDB connection env. Set MONGO_ATLAS_URI or MONGO_URI.");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);

  const text = await fs.readFile(args.file, "utf8");
  const lines = parseSemicolonLines(text);

  // Find header
  const headerLine = lines.find((l) => /^PT;DIVISI;Mandoran;Nama\s+Karyawan;/i.test(l));
  if (!headerLine) throw new Error("Header row not found: PT;DIVISI;Mandoran;Nama Karyawan;...");

  const headerParts = headerLine.split(";");
  const dateCols = parseHeaderDates(headerParts);

  // Gather division names for mapping
  const divisionNames = [];
  for (const l of lines) {
    if (l === headerLine) continue;
    const parts = l.split(";");
    const div = normalizeText(parts[1]);
    if (div && !/\btotal\b/i.test(div)) divisionNames.push(div);
  }
  const divisionIdByName = buildDivisionIdMap(divisionNames, args.divisionMap);

  console.log("Division mapping (division_id):", Object.fromEntries([...divisionIdByName.entries()]));

  // Load users/employees cache
  const existingUsers = await User.find({ role: "foreman" }, { name: 1, email: 1 }).lean();
  const usersByName = new Map(existingUsers.map((u) => [normalizeKey(u.name), { _id: String(u._id), name: u.name, email: u.email }]));

  const existingEmployees = await Employee.find({}, { name: 1, division: 1, mandorId: 1 }).lean();
  const empByNameDiv = new Map();
  for (const e of existingEmployees) {
    const k = `${normalizeKey(e.name)}|${normalizeKey(e.division || "")}`;
    if (!empByNameDiv.has(k)) empByNameDiv.set(k, e);
  }

  // Date range for deletion
  const start = new Date(Math.min(...dateCols.map((c) => c.date.getTime())));
  const end = new Date(Math.max(...dateCols.map((c) => c.date.getTime())));
  end.setHours(23, 59, 59, 999);

  if (args.reset) {
    if (args.deleteInRangeOnly) {
      const del = await Attendance.deleteMany({ date: { $gte: start, $lte: end } });
      console.log(`Deleted attendance in range ${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}:`, del.deletedCount);
    } else {
      const del = await Attendance.deleteMany({});
      console.log("Deleted ALL attendance:", del.deletedCount);
    }
  }

  let currentPT = "";
  let currentDivision = "";
  let currentMandor = "";

  const attendanceDocs = [];
  let createdEmployees = 0;
  let updatedEmployees = 0;
  let skippedRows = 0;

  // Iterate data rows starting after header
  let inData = false;
  for (const line of lines) {
    if (!inData) {
      if (line === headerLine) inData = true;
      continue;
    }

    const parts = line.split(";");
    while (parts.length < headerParts.length) parts.push("");

    if (isTotalRow(parts)) {
      skippedRows++;
      continue;
    }

    const ptMaybe = normalizeText(parts[0]);
    const divMaybe = normalizeText(parts[1]);
    const mandorMaybe = normalizeText(parts[2]);
    const employeeName = normalizeText(parts[3]);

    if (ptMaybe) currentPT = ptMaybe.toUpperCase();
    if (divMaybe) currentDivision = divMaybe;
    if (mandorMaybe) currentMandor = mandorMaybe;

    if (!employeeName) {
      skippedRows++;
      continue;
    }

    const divisionId = divisionIdByName.get(currentDivision) || null;

    let foremanUser = null;
    if (currentMandor) {
      foremanUser = await ensureForemanUserAndEmployee({
        mandorName: currentMandor,
        divisionId,
        divisionName: currentDivision,
        pt: currentPT,
        emailDomain: args.emailDomain,
        defaultForemanPassword: args.defaultForemanPassword,
        usersByName,
      });
    }

    const empKey = `${normalizeKey(employeeName)}|${normalizeKey(currentDivision)}`;
    let emp = empByNameDiv.get(empKey);

    if (!emp && args.createMissingEmployees) {
      emp = await Employee.create({
        name: employeeName,
        nik: "",
        division: currentDivision,
        division_id: divisionId,
        mandorId: foremanUser ? String(foremanUser._id) : undefined,
        pt: currentPT,
        status: "active",
      });
      empByNameDiv.set(empKey, emp);
      createdEmployees++;
    }

    if (!emp) {
      skippedRows++;
      continue;
    }

    // Ensure employee points to mandor + division_id/pt
    const empUpdate = {};
    if (foremanUser && String(emp.mandorId || "") !== String(foremanUser._id)) {
      empUpdate.mandorId = String(foremanUser._id);
    }
    if (divisionId != null && emp.division_id !== divisionId) empUpdate.division_id = divisionId;
    if (currentDivision && emp.division !== currentDivision) empUpdate.division = currentDivision;
    if (currentPT && emp.pt !== currentPT) empUpdate.pt = currentPT;

    if (Object.keys(empUpdate).length > 0) {
      await Employee.updateOne({ _id: emp._id }, { $set: empUpdate });
      updatedEmployees++;
    }

    for (const col of dateCols) {
      const hk = parseDecimal(parts[col.index]);
      if (hk == null) continue;

      attendanceDocs.push({
        date: col.date,
        employeeId: String(emp._id),
        division_id: divisionId,
        status: "present",
        hk,
        notes: "",
      });
    }
  }

  // InsertMany in chunks to avoid huge payload
  const chunkSize = 2000;
  let inserted = 0;
  for (let i = 0; i < attendanceDocs.length; i += chunkSize) {
    const chunk = attendanceDocs.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    await Attendance.insertMany(chunk, { ordered: false });
    inserted += chunk.length;
  }

  console.log("Done.");
  console.log({
    createdEmployees,
    updatedEmployees,
    insertedAttendance: inserted,
    skippedRows,
    dateRange: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    defaultForemanPassword: args.defaultForemanPassword,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
