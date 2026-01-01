#!/usr/bin/env node
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import Employee from "../src/models/Employee.js";
import User from "../src/models/User.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;

function normalizePT(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.toUpperCase();
}

async function main() {
  if (!MONGO_URI) throw new Error("Missing MongoDB connection env. Set MONGO_ATLAS_URI or MONGO_URI.");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);

  // Fix mandor employees that were created without linking to a foreman user.
  const mandorEmployeesAll = await Employee.find(
    { position: "mandor" },
    { mandorId: 1, pt: 1, division: 1, name: 1 }
  ).lean();

  const foremanUsers = await User.find(
    { role: "foreman" },
    { name: 1 }
  ).lean();
  const foremanIdByName = new Map(
    foremanUsers.map((u) => [String(u.name || "").trim().toLowerCase(), String(u._id)])
  );

  let linkedMandorToUser = 0;
  for (const m of mandorEmployeesAll) {
    const current = String(m.mandorId || "").trim();
    if (current) continue;
    const userId = foremanIdByName.get(String(m.name || "").trim().toLowerCase());
    if (!userId) continue;
    await Employee.updateOne({ _id: m._id }, { $set: { mandorId: userId } });
    linkedMandorToUser++;
  }

  // Reload mandor employees with a valid mandorId
  const mandorEmployees = await Employee.find(
    { position: "mandor", mandorId: { $exists: true, $ne: null, $ne: "" } },
    { mandorId: 1, pt: 1, division: 1, name: 1 }
  ).lean();

  const ptByMandorId = new Map();
  for (const m of mandorEmployees) {
    const key = String(m.mandorId || "").trim();
    const pt = normalizePT(m.pt);
    if (!key || !pt) continue;
    // keep first; typically consistent
    if (!ptByMandorId.has(key)) ptByMandorId.set(key, pt);
  }

  // Fallback: infer mandor PT from their workers (mode PT per mandorId)
  const workersWithPT = await Employee.find(
    {
      position: { $ne: "mandor" },
      mandorId: { $exists: true, $ne: null, $ne: "" },
      pt: { $exists: true, $ne: null, $ne: "" },
    },
    { mandorId: 1, pt: 1 }
  ).lean();

  const countsByMandor = new Map();
  for (const w of workersWithPT) {
    const mid = String(w.mandorId || "").trim();
    const pt = normalizePT(w.pt);
    if (!mid || !pt) continue;
    if (!countsByMandor.has(mid)) countsByMandor.set(mid, new Map());
    const m = countsByMandor.get(mid);
    m.set(pt, (m.get(pt) || 0) + 1);
  }

  let inferredMandorPT = 0;
  for (const [mid, ptCounts] of countsByMandor.entries()) {
    if (ptByMandorId.has(mid)) continue;
    let bestPT = "";
    let bestCount = -1;
    for (const [pt, c] of ptCounts.entries()) {
      if (c > bestCount) {
        bestCount = c;
        bestPT = pt;
      }
    }
    if (!bestPT) continue;
    ptByMandorId.set(mid, bestPT);
    inferredMandorPT++;
  }

  // Ensure mandor employee docs also get PT populated (nice for Master Karyawan)
  let updatedMandorEmployees = 0;
  for (const m of mandorEmployees) {
    const mid = String(m.mandorId || "").trim();
    if (!mid) continue;
    const pt = ptByMandorId.get(mid);
    if (!pt) continue;
    const current = normalizePT(m.pt);
    if (current === pt) continue;
    await Employee.updateOne({ _id: m._id }, { $set: { pt } });
    updatedMandorEmployees++;
  }

  // 1) Normalize PT for employees that already have PT.
  const allWithPT = await Employee.find(
    { pt: { $exists: true, $ne: null, $ne: "" } },
    { pt: 1 }
  ).lean();

  let normalizedCount = 0;
  for (const e of allWithPT) {
    const current = String(e.pt || "");
    const normalized = normalizePT(current);
    if (normalized && normalized !== current) {
      await Employee.updateOne({ _id: e._id }, { $set: { pt: normalized } });
      normalizedCount++;
    }
  }

  // 2) Backfill missing PT from mandor mapping.
  const missing = await Employee.find(
    { $or: [{ pt: { $exists: false } }, { pt: null }, { pt: "" }] },
    { mandorId: 1, position: 1, division: 1, name: 1 }
  ).lean();

  let filledCount = 0;
  let skippedNoMandor = 0;

  for (const e of missing) {
    // Skip mandor employees missing PT; those should be fixed by CSV seed.
    if (String(e.position || "").toLowerCase() === "mandor") continue;

    const mandorId = String(e.mandorId || "").trim();
    if (!mandorId) {
      skippedNoMandor++;
      continue;
    }

    const pt = ptByMandorId.get(mandorId);
    if (!pt) {
      skippedNoMandor++;
      continue;
    }

    await Employee.updateOne({ _id: e._id }, { $set: { pt } });
    filledCount++;
  }

  console.log("Done.");
  console.log({
    linkedMandorToUser,
    mandorWithPT: ptByMandorId.size,
    inferredMandorPT,
    updatedMandorEmployees,
    normalizedPT: normalizedCount,
    filledFromMandor: filledCount,
    stillMissingOrNoMandor: skippedNoMandor,
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
