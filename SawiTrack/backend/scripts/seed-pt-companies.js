#!/usr/bin/env node
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import Company from "../src/models/Company.js";
import Employee from "../src/models/Employee.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;

function normalizePT(value) {
  return String(value || "").trim().toUpperCase();
}

async function main() {
  if (!MONGO_URI) throw new Error("Missing MongoDB connection env. Set MONGO_ATLAS_URI or MONGO_URI.");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);

  const pts = [
    { code: "HJA", phone: "0000000001", email: "hja@example.com" },
    { code: "APK", phone: "0000000002", email: "apk@example.com" },
    { code: "TPN", phone: "0000000003", email: "tpn@example.com" },
  ];

  // Replace all companies with the PT list
  const del = await Company.deleteMany({});
  const created = await Company.insertMany(
    pts.map((p) => ({
      company_name: p.code,
      address: "-",
      phone: p.phone,
      email: p.email,
      status: "active",
      estates: [],
    }))
  );

  const companyIdByPT = new Map(created.map((c) => [normalizePT(c.company_name), String(c._id)]));

  // Update employees to use companyId (id_pt) based on their existing pt field
  const employees = await Employee.find({}, { pt: 1, companyId: 1 }).lean();
  let updated = 0;
  let skippedNoPT = 0;
  let skippedUnknownPT = 0;

  for (const e of employees) {
    const pt = normalizePT(e.pt);
    if (!pt) {
      skippedNoPT++;
      continue;
    }

    const companyId = companyIdByPT.get(pt);
    if (!companyId) {
      skippedUnknownPT++;
      continue;
    }

    const currentCompanyId = String(e.companyId || "").trim();
    if (currentCompanyId === companyId) continue;

    await Employee.updateOne(
      { _id: e._id },
      { $set: { companyId, id_pt: companyId } }
    );
    updated++;
  }

  console.log("Done.");
  console.log({
    deletedCompanies: del.deletedCount,
    createdCompanies: created.length,
    employeeCompanyLinked: updated,
    employeeSkippedNoPT: skippedNoPT,
    employeeSkippedUnknownPT: skippedUnknownPT,
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
