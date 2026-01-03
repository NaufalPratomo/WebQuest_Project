import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import DailyReport from "../src/models/DailyReport.js";
import Employee from "../src/models/Employee.js";

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
  if (u && p && h) {
    const encUser = encodeURIComponent(u);
    const encPass = encodeURIComponent(p);
    MONGO_URI = `mongodb+srv://${encUser}:${encPass}@${h}/?retryWrites=true&w=majority`;
  }
}

function parseArgs(argv) {
  const args = {
    file: "",
    reset: true,
    createMissingEmployees: false,
    skipDuplicates: true,
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
    if (t === "--create-missing-employees") {
      args.createMissingEmployees = true;
      continue;
    }
    if (t === "--no-skip-duplicates") {
      args.skipDuplicates = false;
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
  console.log(`
Seed Daily Reports (Laporan Harian) from semicolon CSV

Usage:
  node scripts/seed-daily-reports-from-csv.js --file "/path/to/input_laporan_harian.csv"

If --file is omitted, it will try:
  backend/data/input_laporan_harian.csv

Options:
  --no-reset                    Do not delete existing daily reports
  --create-missing-employees    Create employee records for NIKs not found in DB
  --no-skip-duplicates          Allow inserting duplicates (same date+nik+coa+block)

CSV Format (semicolon-separated):
  PT;DIVISI;Tanggal;NIK;Nama Karyawan;Mandoran;No COA;Aktivitas;Jenis Pekerjaan;
  Batch/Blok;Unit;Tahun Tanam;Lokasi;HK;Rp HK;Premi;HK Premi;Rp Premi;satuan;
  Hasil Kerja;Janjang;Nama Bahan;Jumlah Bahan;Satuan Bahan

Date format: 1-Dec-25, 2-Dec-25, etc.
Decimals: Use comma or dot (0,5 or 0.5)
`);
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseDecimal(input) {
  const s = String(input || "").trim();
  if (!s || s === "-" || s === "- ") return null;
  const normalized = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseDate(dateStr) {
  // Parse "1-Dec-25" or "2-Dec-25" format
  const s = normalizeText(dateStr);
  if (!s) return null;

  // Try standard format first
  const parts = s.split("-");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  };
  const monthKey = parts[1].toLowerCase().slice(0, 3);
  const month = monthMap[monthKey];
  if (month === undefined) return null;

  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000; // Assume 25 = 2025

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date;
}

function parseSemicolonLines(text) {
  const lines = text.split(/\r?\n/);
  const records = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(";");
    records.push(cells);
  }
  return records;
}

async function seedDailyReports(args) {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("Connected to MongoDB");

  const csvPath = args.file || path.resolve(__dirname, "../data/input_laporan_harian.csv");
  console.log(`Reading CSV from: ${csvPath}`);

  const text = await fs.readFile(csvPath, "utf-8");
  const lines = parseSemicolonLines(text);

  // Find header row (the one with "PT", "DIVISI", "Tanggal", etc.)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    const firstCells = row.slice(0, 10).map(c => normalizeText(c).toLowerCase());
    if (firstCells.includes("pt") && firstCells.includes("divisi") && firstCells.includes("tanggal")) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    console.error("Header row not found in CSV (expected: PT, DIVISI, Tanggal, etc.)");
    process.exit(1);
  }

  const header = lines[headerIdx].map(c => normalizeText(c));
  console.log(`Header found at row ${headerIdx + 1}:`, header);

  // Map columns
  const colMap = {};
  for (let i = 0; i < header.length; i++) {
    const key = header[i].toLowerCase();
    colMap[key] = i;
  }

  // Expected columns
  const ptIdx = colMap["pt"];
  const divIdx = colMap["divisi"];
  const dateIdx = colMap["tanggal"];
  const nikIdx = colMap["nik"];
  const nameIdx = colMap["nama karyawan"];
  const mandorIdx = colMap["mandoran"];
  const coaIdx = colMap["no coa"];
  const actIdx = colMap["aktivitas"];
  const jobIdx = colMap["jenis pekerjaan"];
  const blockIdx = colMap["batch/blok"];
  const unitIdx = colMap["unit"];
  const ypIdx = colMap["tahun tanam"];
  const locIdx = colMap["lokasi"];
  const hkIdx = colMap["hk"];
  const rpHkIdx = colMap["rp hk"];
  const premiIdx = colMap["premi"];
  const hkPremiIdx = colMap["hk premi"];
  const rpPremiIdx = colMap["rp premi"];
  const unitResultIdx = colMap["satuan"];
  const resultIdx = colMap["hasil kerja"];
  const janjangIdx = colMap["janjang"];
  const matNameIdx = colMap["nama bahan"];
  const matQtyIdx = colMap["jumlah bahan"];
  const matUnitIdx = colMap["satuan bahan"];

  if (dateIdx === undefined || nikIdx === undefined || nameIdx === undefined) {
    console.error("Required columns missing (Tanggal, NIK, Nama Karyawan)");
    process.exit(1);
  }

  // Reset if requested
  if (args.reset) {
    const deleteCount = await DailyReport.deleteMany({});
    console.log(`Deleted ${deleteCount.deletedCount} existing daily reports.`);
  }

  const dataRows = lines.slice(headerIdx + 1);
  console.log(`Processing ${dataRows.length} data rows...`);

  const employeeCache = new Map();
  const allEmployees = await Employee.find({}).lean();
  for (const emp of allEmployees) {
    employeeCache.set(emp.nik, emp);
  }

  const toInsert = [];
  const skipped = [];
  const errors = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const dateStr = normalizeText(row[dateIdx] || "");
    const nikRaw = normalizeText(row[nikIdx] || "");
    const name = normalizeText(row[nameIdx] || "");

    // Skip if no date or name
    if (!dateStr || !name) {
      skipped.push(`Row ${headerIdx + r + 2}: Missing date or name`);
      continue;
    }

    // Skip summary rows
    if (name.toLowerCase().includes("total") || name.toLowerCase().includes("subtotal")) {
      skipped.push(`Row ${headerIdx + r + 2}: Summary row`);
      continue;
    }

    const date = parseDate(dateStr);
    if (!date) {
      errors.push(`Row ${headerIdx + r + 2}: Invalid date "${dateStr}"`);
      continue;
    }

    const nik = nikRaw || null;

    // Create missing employee if enabled
    if (nik && !employeeCache.has(nik) && args.createMissingEmployees) {
      const newEmp = await Employee.create({
        nik,
        name,
        status: "active",
      });
      employeeCache.set(nik, newEmp);
      console.log(`Created missing employee: ${nik} - ${name}`);
    }

    const pt = normalizeText(row[ptIdx] || "");
    const division = normalizeText(row[divIdx] || "");
    const mandor = normalizeText(row[mandorIdx] || "");
    const coa = normalizeText(row[coaIdx] || "");
    const activity = normalizeText(row[actIdx] || "");
    const jobType = normalizeText(row[jobIdx] || "");
    const block = normalizeText(row[blockIdx] || "");
    const unit = normalizeText(row[unitResultIdx] || "");
    const yearPlanted = normalizeText(row[ypIdx] || "");
    const location = normalizeText(row[locIdx] || "");

    const hk = parseDecimal(row[hkIdx]) || 0;
    const hkPrice = parseDecimal(row[rpHkIdx]) || 0;
    const premi = parseDecimal(row[premiIdx]) || 0;
    const hkPremi = parseDecimal(row[hkPremiIdx]) || 0;
    const rpPremi = parseDecimal(row[rpPremiIdx]) || 0;
    const result = parseDecimal(row[resultIdx]) || 0;
    const janjang = parseDecimal(row[janjangIdx]) || 0;

    const materialName = normalizeText(row[matNameIdx] || "");
    const materialQty = parseDecimal(row[matQtyIdx]) || 0;
    const materialUnit = normalizeText(row[matUnitIdx] || "");

    const doc = {
      date,
      pt: pt || "HJA",
      division: division || null,
      nik: nik || null,
      employeeName: name,
      mandorName: mandor || null,
      coa: coa || null,
      activity: activity || null,
      jobType: jobType || null,
      block: block || null,
      unit: unit || null,
      yearPlanted: yearPlanted || null,
      location: location || null,
      hk,
      hkPrice,
      premi,
      hkPremi,
      rpPremi,
      result,
      janjang,
      materialName: materialName || null,
      materialQty: materialQty || 0,
      materialUnit: materialUnit || null,
      notes: null,
    };

    // Check duplicate if enabled
    if (args.skipDuplicates) {
      const sig = `${date.toISOString().slice(0, 10)}|${nik}|${coa}|${block}`;
      const exists = toInsert.some(d =>
        `${d.date.toISOString().slice(0, 10)}|${d.nik}|${d.coa}|${d.block}` === sig
      );
      if (exists) {
        skipped.push(`Row ${headerIdx + r + 2}: Duplicate (date=${dateStr}, nik=${nik}, coa=${coa}, block=${block})`);
        continue;
      }
    }

    toInsert.push(doc);
  }

  console.log(`\nReady to insert: ${toInsert.length} records`);
  console.log(`Skipped: ${skipped.length} rows`);
  console.log(`Errors: ${errors.length} rows`);

  if (toInsert.length > 0) {
    const inserted = await DailyReport.insertMany(toInsert, { ordered: false });
    console.log(`✅ Inserted ${inserted.length} daily reports.`);
  } else {
    console.log("⚠️  No records to insert.");
  }

  if (errors.length > 0) {
    console.log("\n🚨 Errors:");
    errors.forEach(e => console.log("  -", e));
  }

  if (skipped.length > 5) {
    console.log(`\n⚠️  Skipped ${skipped.length} rows (showing first 5):`);
    skipped.slice(0, 5).forEach(s => console.log("  -", s));
  } else if (skipped.length > 0) {
    console.log("\n⚠️  Skipped rows:");
    skipped.forEach(s => console.log("  -", s));
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

seedDailyReports(args).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
