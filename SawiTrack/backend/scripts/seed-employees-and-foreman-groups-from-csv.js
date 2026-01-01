import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Employee from "../src/models/Employee.js";
import ForemanGroup from "../src/models/ForemanGroup.js";
import User from "../src/models/User.js";
import Company from "../src/models/Company.js";

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
    karyawan: "",
    groups: "",
    companyId: "",
    companyName: "",
    deleteForemanUsers: true,
    resetAllEmployees: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--karyawan" && argv[i + 1]) {
      args.karyawan = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--groups" && argv[i + 1]) {
      args.groups = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--company-id" && argv[i + 1]) {
      args.companyId = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--company-name" && argv[i + 1]) {
      args.companyName = argv[i + 1];
      i++;
      continue;
    }
    if (token === "--keep-foreman-users") {
      args.deleteForemanUsers = false;
      continue;
    }
    if (token === "--no-reset") {
      args.resetAllEmployees = false;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeNik(nik) {
  const cleaned = String(nik || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^\(blank\)$/i, "");
  return cleaned;
}

function slugifyEmailLocalPart(name) {
  // Basic, deterministic slug (ASCII-ish). Keeps letters/numbers only.
  const base = normalizeName(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return base || "mandor";
}

async function readTextFile(filePath) {
  const buf = await fs.readFile(filePath);
  // tolerate BOM
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

function parseSemicolonCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function parseKaryawanCsvLines(lines) {
  // Expected columns: NO;NAMA;NIK;Mandor;Divisi;
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip junk headers
    if (!trimmed.includes(";")) continue;
    if (/^DATABASE\s+KARYAWAN/i.test(trimmed)) continue;
    if (/^NO;NAMA;NIK;Mandor;Divisi/i.test(trimmed)) continue;
    if (/^NO;NAMA;NIK;MANDOR;DIVISI/i.test(trimmed)) continue;

    const parts = trimmed.split(";");
    if (parts.length < 5) continue;

    const no = parts[0]?.trim();
    // skip repeated header like "NO"
    if (no?.toLowerCase() === "no") continue;

    const name = normalizeName(parts[1]);
    const nik = normalizeNik(parts[2]);
    const mandorName = normalizeName(parts[3]);
    const division = normalizeName(parts[4]);

    if (!name) continue;

    rows.push({ name, nik, mandorName, division });
  }
  return rows;
}

function parseGroupMandorLines(lines) {
  // Format:
  // Mandor;Divisi;NAMA;NIK
  // Amir Mohamad;Toyidito;Abdul Gias Ulama;750...
  // ;;Alan Huladu;750...
  const groups = new Map(); // mandorName -> { division, members: [{name, nik}] }

  let currentMandor = "";
  let currentDivision = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes(";")) continue;
    if (/^Mandor;Divisi;NAMA;NIK/i.test(trimmed)) continue;

    const parts = trimmed.split(";");
    // ensure at least 4 columns
    while (parts.length < 4) parts.push("");

    const mandorMaybe = normalizeName(parts[0]);
    const divisionMaybe = normalizeName(parts[1]);

    const memberName = normalizeName(parts[2]);
    const memberNik = normalizeNik(parts[3]);

    // If first two columns empty, continue previous mandor
    if (mandorMaybe) {
      currentMandor = mandorMaybe;
      currentDivision = divisionMaybe;
    }

    if (!currentMandor) continue;

    if (!groups.has(currentMandor)) {
      groups.set(currentMandor, { division: currentDivision, members: [] });
    } else {
      // Keep the first non-empty division if later lines have it
      const g = groups.get(currentMandor);
      if (!g.division && currentDivision) g.division = currentDivision;
    }

    if (!memberName) continue;
    groups.get(currentMandor).members.push({ name: memberName, nik: memberNik });
  }

  return groups;
}

async function resolveCompanyId({ companyId, companyName }) {
  if (companyId) return companyId;

  if (companyName) {
    const found = await Company.findOne({ company_name: companyName }).lean();
    if (!found) {
      throw new Error(`Company not found for --company-name: ${companyName}`);
    }
    return String(found._id);
  }

  const all = await Company.find({}).lean();
  if (all.length === 1) return String(all[0]._id);

  // No default
  return "";
}

async function ensureForemanUserAndEmployee({ mandorName, division, companyId, emailDomain, existingUsersByName }) {
  const nameKey = mandorName.toLowerCase();
  if (existingUsersByName.has(nameKey)) {
    return existingUsersByName.get(nameKey);
  }

  // Create user (role foreman)
  const baseLocal = slugifyEmailLocalPart(mandorName);
  let email = `${baseLocal}@${emailDomain}`;

  // Ensure email unique (deterministic-ish)
  for (let i = 2; i < 100; i++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne({ email }).lean();
    if (!exists) break;
    email = `${baseLocal}.${i}@${emailDomain}`;
  }

  const password = bcrypt.hashSync("Password123!", 10);
  const user = await User.create({ name: mandorName, email, password, role: "foreman", status: "active" });

  // Create employee record for mandor (nik kosong)
  await Employee.create({
    name: mandorName,
    nik: "",
    division: division || "",
    position: "mandor",
    mandorId: "",
    companyId: companyId || undefined,
    status: "active",
  });

  const userId = String(user._id);
  existingUsersByName.set(nameKey, userId);
  return userId;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log("Usage: node scripts/seed-employees-and-foreman-groups-from-csv.js --karyawan <karyawan.csv> --groups <group_mandor.csv> [options]");
    console.log("Options:");
    console.log("  --company-id <id>        Set companyId for all employees");
    console.log("  --company-name <name>    Resolve companyId by company_name");
    console.log("  --keep-foreman-users     Do NOT delete existing foreman users");
    console.log("  --no-reset               Do NOT delete existing employees/foreman_groups");
    process.exit(0);
  }

  if (!args.karyawan || !args.groups) {
    console.error("Missing required args. Provide --karyawan and --groups");
    process.exit(1);
  }

  try {
    if (!MONGO_URI) throw new Error("Missing MONGO URI in environment");

    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log("Connected to DB");

    const companyId = await resolveCompanyId({ companyId: args.companyId, companyName: args.companyName });
    if (companyId) console.log("Using companyId:", companyId);

    const [karyawanText, groupsText] = await Promise.all([
      readTextFile(args.karyawan),
      readTextFile(args.groups),
    ]);

    const karyawanLines = parseSemicolonCsv(karyawanText);
    const groupLines = parseSemicolonCsv(groupsText);

    const karyawanRows = parseKaryawanCsvLines(karyawanLines);
    const groupMap = parseGroupMandorLines(groupLines);

    // Delete existing data as requested
    if (args.resetAllEmployees) {
      const delEmp = await Employee.deleteMany({});
      const delGroups = await ForemanGroup.deleteMany({});
      console.log(`Deleted employees: ${delEmp.deletedCount}`);
      console.log(`Deleted foreman_groups: ${delGroups.deletedCount}`);
    }

    if (args.deleteForemanUsers) {
      const delUsers = await User.deleteMany({ role: "foreman" });
      console.log(`Deleted foreman users: ${delUsers.deletedCount}`);
    }

    // Ensure foremen exist as users + employees
    const emailDomain = "mandor.local";
    const foremanUserIdByName = new Map();

    // Prefer groupMap for division, but also include mandor names from karyawan file
    const mandorNames = new Set();
    for (const [mandorName] of groupMap.entries()) mandorNames.add(mandorName);
    for (const row of karyawanRows) if (row.mandorName) mandorNames.add(row.mandorName);

    for (const mandorName of mandorNames) {
      const g = groupMap.get(mandorName);
      const division = g?.division || "";
      // eslint-disable-next-line no-await-in-loop
      await ensureForemanUserAndEmployee({
        mandorName,
        division,
        companyId,
        emailDomain,
        existingUsersByName: foremanUserIdByName,
      });
    }

    // Build employee docs (dedupe by NIK if present)
    const employeeByNik = new Map();

    // From karyawan.csv
    for (const row of karyawanRows) {
      const nikKey = row.nik ? row.nik : `__NONIK__:${row.name.toLowerCase()}:${row.division.toLowerCase()}`;
      if (employeeByNik.has(nikKey)) continue;

      const mandorUserId = row.mandorName
        ? foremanUserIdByName.get(row.mandorName.toLowerCase()) || ""
        : "";

      employeeByNik.set(nikKey, {
        name: row.name,
        nik: row.nik || "",
        division: row.division || "",
        position: "pemanen",
        mandorId: mandorUserId,
        companyId: companyId || undefined,
        status: "active",
      });
    }

    // Also from group mandor members (in case there are members not listed in karyawan.csv)
    for (const [mandorName, g] of groupMap.entries()) {
      const mandorUserId = foremanUserIdByName.get(mandorName.toLowerCase()) || "";
      for (const m of g.members) {
        const nikKey = m.nik ? m.nik : `__NONIK__:${m.name.toLowerCase()}:${g.division.toLowerCase()}`;
        if (employeeByNik.has(nikKey)) continue;

        employeeByNik.set(nikKey, {
          name: m.name,
          nik: m.nik || "",
          division: g.division || "",
          position: "pemanen",
          mandorId: mandorUserId,
          companyId: companyId || undefined,
          status: "active",
        });
      }
    }

    const employeeDocs = Array.from(employeeByNik.values());
    const insertedEmployees = await Employee.insertMany(employeeDocs, { ordered: false });
    console.log(`Inserted employees: ${insertedEmployees.length}`);

    // Map NIK -> employee _id
    const nikToEmployeeId = new Map();
    for (const e of insertedEmployees) {
      const nik = normalizeNik(e.nik);
      if (nik) nikToEmployeeId.set(nik, String(e._id));
    }

    // Create foreman groups, with memberIds resolved to employees
    const foremanGroupsToInsert = [];
    for (const [mandorName, g] of groupMap.entries()) {
      const mandorUserId = foremanUserIdByName.get(mandorName.toLowerCase()) || "";
      const memberIds = [];
      for (const m of g.members) {
        const nik = normalizeNik(m.nik);
        if (!nik) continue;
        const empId = nikToEmployeeId.get(nik);
        if (empId) memberIds.push(empId);
      }

      foremanGroupsToInsert.push({
        mandorId: mandorUserId,
        name: mandorName,
        division: g.division || "",
        companyId: companyId || undefined,
        memberIds,
      });
    }

    const insertedGroups = await ForemanGroup.insertMany(foremanGroupsToInsert, { ordered: false });
    console.log(`Inserted foreman_groups: ${insertedGroups.length}`);

    console.log("Seeding employees + foreman groups completed.");
    console.log("Default password for mandor users: Password123!");
  } catch (e) {
    console.error("Seeder error:", e?.message || e);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
  }
})();
