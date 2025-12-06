/**
 * Migration Script: Flatten Estate Structure
 *
 * Converts old structure:
 *   Estate -> divisions[] -> blocks[]
 *
 * To new structure:
 *   Estate (Division) -> blocks[]
 *
 * Run this ONCE on your MongoDB database before deploying new code.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const mongoUri =
  process.env.MONGO_ATLAS_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/sawitrack";

// Old schema (for reference)
const BlockSchema = new mongoose.Schema(
  {
    id_blok: String,
    no_blok: String,
    no_tph: String,
    status: String,
    jenis_tanah: String,
    topografi: String,
    luas_tanam_: Number,
    tahun_: Number,
    jumlak_pokok: Number,
    jenis_bibit: String,
    luas_nursery: Number,
    luas_lain___lain: Number,
    luas_garapan: Number,
    luas_rawa: Number,
    luas_area_non_efektif: Number,
    luas_konservasi: Number,
    luas_blok: Number,
    SPH: Number,
  },
  { _id: false, strict: false }
);

const OldDivisionSchema = new mongoose.Schema(
  {
    division_id: Number,
    blocks: [BlockSchema],
  },
  { _id: false }
);

const OldEstateSchema = new mongoose.Schema({
  _id: String,
  estate_name: String,
  divisions: [OldDivisionSchema],
  status: String,
});

const OldEstate = mongoose.model("OldEstate", OldEstateSchema, "estates");

async function migrateEstates() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected!");

    console.log("\n📊 Fetching estates with old structure...");
    const estates = await OldEstate.find({
      divisions: { $exists: true, $ne: [] },
    }).lean();
    console.log(`Found ${estates.length} estates with divisions to migrate`);

    if (estates.length === 0) {
      console.log("✨ No estates need migration!");
      await mongoose.disconnect();
      return;
    }

    console.log("\n🔄 Starting migration...\n");

    for (const estate of estates) {
      console.log(`Processing: ${estate.estate_name} (${estate._id})`);

      if (!estate.divisions || estate.divisions.length === 0) {
        console.log("  ⏭️  No divisions, skipping");
        continue;
      }

      // Flatten all blocks from all divisions
      const allBlocks = [];
      for (const division of estate.divisions) {
        if (division.blocks && division.blocks.length > 0) {
          console.log(
            `  📦 Division ${division.division_id}: ${division.blocks.length} blocks`
          );
          allBlocks.push(...division.blocks);
        }
      }

      console.log(`  ✨ Total blocks to migrate: ${allBlocks.length}`);

      // Update estate: remove divisions, add blocks at root level
      const result = await OldEstate.updateOne(
        { _id: estate._id },
        {
          $set: { blocks: allBlocks },
          $unset: { divisions: "" },
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`  ✅ Successfully migrated!\n`);
      } else {
        console.log(`  ⚠️  No changes made\n`);
      }
    }

    console.log("🎉 Migration completed!");
    console.log("\n📋 Summary:");
    console.log(`   Estates processed: ${estates.length}`);
    console.log(
      `   Total blocks migrated: ${estates.reduce((sum, e) => {
        return (
          sum +
          (e.divisions?.reduce(
            (divSum, d) => divSum + (d.blocks?.length || 0),
            0
          ) || 0)
        );
      }, 0)}`
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run migration
console.log("🚀 Estate Structure Migration Script");
console.log("=====================================\n");
migrateEstates()
  .then(() => {
    console.log("\n✅ Migration script completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Migration script failed:", err);
    process.exit(1);
  });
