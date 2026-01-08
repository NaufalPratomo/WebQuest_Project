#!/usr/bin/env node
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Import Models
import Company from "../src/models/Company.js";
import Estate from "../src/models/Estate.js";

// Setup Environment
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;

// CSV Parser Helper
function parseIndonesianNumber(str) {
  if (!str) return 0;
  // Remove dots (thousand separators), replace comma with dot
  // remove parentheses handling for negative if needed, but here treated as value
  let clean = str.replace(/\((.*?)\)/, "-$1").trim(); // Handle (123) as -123 if needed, or just 123
  if (clean === '-') return 0;
  
  // Format: 3.616,00 -> 3616.00
  // Remove all dots
  clean = clean.replace(/\./g, "");
  // Replace comma with dot
  clean = clean.replace(",", ".");
  
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

function parseCSVLine(line) {
  const cols = line.split(";").map(c => c.trim());
  return cols;
}

// Main Function
async function main() {
  if (!MONGO_URI) throw new Error("Missing MongoDB connection env. Set MONGO_ATLAS_URI or MONGO_URI.");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);
  console.log("Connected.");

  // Path to CSV
  const csvPath = path.resolve(__dirname, "data/Master_Blok_Baru_2026.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const lines = fileContent.split("\n");

  // Global Aggregation
  // Structure: { [ESTATE_NAME]: { [DIVISION_NAME]: [BlockObjects] } }
  const globalEstateMap = {};
  // Structure: { [ESTATE_NAME]: Set<PT_NAME> }
  const estateCompanyLinks = {};

  console.log("Parsing CSV...");
  
  // Skip first 3 lines (headers)
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;

    const cols = parseCSVLine(line);
    const pt = cols[1];
    const estateName = cols[2];
    const divisionName = cols[3];

    // Identify Blok ID
    if (!pt || !estateName || !divisionName) continue;

    const blokBaru = cols[4];
    const blokLama = cols[5];
    const idBlok = blokBaru || blokLama || `UNK-${i}`;
    const noBlok = idBlok; // Use Baru as main number

    // Combined Display
    const blokDisplay = [blokBaru, blokLama].filter(Boolean).join(", ");

    const blockObj = {
      id_blok: idBlok,
      no_blok: noBlok,
      blok_baru: blokBaru,
      blok_lama: blokLama,
      no_blok_display: blokDisplay,
      tahun_: parseInt(cols[6]) || 0,
      luas_blok: parseIndonesianNumber(cols[7]),
      jumlak_pokok: parseIndonesianNumber(cols[8]),
      pokok_total: parseIndonesianNumber(cols[8]), // Alias
      pokok_produktif: parseIndonesianNumber(cols[9]),
      pokok_belum_produktif: parseIndonesianNumber(cols[10]),
      pokok_mati: parseIndonesianNumber(cols[11]),
      jenis_bibit: cols[12],
      topografi: cols[13],
      SPH: parseInt(cols[15]) || 0,
      status: "active",
      pt_ownership: pt,
      id_pt: pt // Alias
    };

    // Populate Global Map
    if (!globalEstateMap[estateName]) globalEstateMap[estateName] = {};
    if (!globalEstateMap[estateName][divisionName]) globalEstateMap[estateName][divisionName] = [];
    globalEstateMap[estateName][divisionName].push(blockObj);

    // Track Company Links
    if (!estateCompanyLinks[estateName]) estateCompanyLinks[estateName] = new Set();
    estateCompanyLinks[estateName].add(pt);
  }

  // Database Operations
  console.log("Starting DB Updates...");

  // 1. Process Estates and their Divisions
  for (const estateName of Object.keys(globalEstateMap)) {
    console.log(`Processing Estate: ${estateName}`);
    
    let estate = await Estate.findOne({ estate_name: estateName });
    if (!estate) {
      console.log(`  Creating New Estate: ${estateName}`);
      estate = new Estate({ 
        _id: estateName,
        estate_name: estateName, 
        divisions: [],
      });
    }

    const divisionsMap = globalEstateMap[estateName];
    let hasChanges = false;

    for (const divName of Object.keys(divisionsMap)) {
      const allBlocks = divisionsMap[divName];
      console.log(`  Processing Division: ${divName} (Total ${allBlocks.length} blocks)`);

      const divIndex = estate.divisions.findIndex(d => String(d.division_id) === String(divName));
      if (divIndex >= 0) {
          // Overwrite with aggregated list
          estate.divisions[divIndex].blocks = allBlocks;
      } else {
          estate.divisions.push({
            division_id: divName,
            blocks: allBlocks
          });
      }
      hasChanges = true;
    }

    if (hasChanges || estate.isNew) {
      await estate.save();
      console.log(`  Saved Estate: ${estateName}`);
    }

    // 2. Link to Companies
    const pts = estateCompanyLinks[estateName];
    for (const ptName of pts) {
       console.log(`  Linking Estate ${estateName} to Company ${ptName}`);
       let company = await Company.findOne({ company_name: ptName });
       if (!company) {
         console.log(`    Creating Company: ${ptName}`);
         company = new Company({ company_name: ptName, estates: [] });
       }
       
       const estateIdStr = estate._id.toString();
       const isLinked = company.estates.some(id => id.toString() === estateIdStr);
       
       if (!isLinked) {
         company.estates.push(estate._id);
         await company.save();
       }
    }
  }

  console.log("Seeding Completed Successfully.");
  process.exit(0);
}

main().catch(err => {
  console.error("Seeding Failed:", err);
  process.exit(1);
});
