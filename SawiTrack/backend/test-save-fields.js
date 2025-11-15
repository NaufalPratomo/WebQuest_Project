import mongoose from "mongoose";
import dotenv from "dotenv";
import Estate from "./src/models/Estate.js";

dotenv.config();
dotenv.config({ path: "../.env" });

const MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;

async function testSaveAllFields() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const testBlock = {
      no_blok: "TEST001",
      id_blok: "BLK_TEST",
      jenis_tanah: "MINERAL",
      topografi: "HILLY",
      luas_tanam_: 15.407,
      tahun_: 2020,
      jumlak_pokok: 2095.352,
      jenis_bibit: "Marihat",
      luas_land_preparation: 45,
      luas_nursery: 5,
      luas_lain___lain: 5,
      luas_lebungan: 5,
      luas_garapan: 0.271,
      luas_rawa: 5,
      luas_tanggul: 5,
      luas_area_non_efektif: 1.408,
      luas_konservasi: 5,
      luas_pks: 5,
      luas_jalan: 1.314,
      luas_drainase: 5,
      luas_perumahan: 5,
      luas_sarana_prasanara: 5,
      luas_blok: 18.4,
      SPH: 136,
    };

    console.log("\n📦 Test block to save (ALL FIELDS):");
    console.log(JSON.stringify(testBlock, null, 2));
    console.log("Total fields:", Object.keys(testBlock).length);

    // Find or create test estate
    let estate = await Estate.findById("TEST_FIELDS");
    if (!estate) {
      estate = new Estate({
        _id: "TEST_FIELDS",
        estate_name: "Test All Fields",
        divisions: [],
      });
    }

    // Add test division with test block
    estate.divisions = [
      {
        division_id: 99,
        blocks: [testBlock],
      },
    ];

    const saved = await estate.save();
    console.log("\n✅ Estate saved!");

    // Retrieve and check what was actually saved
    const retrieved = await Estate.findById("TEST_FIELDS").lean();
    const savedBlock = retrieved.divisions[0]?.blocks[0];

    console.log("\n📥 Retrieved block from DB:");
    console.log(JSON.stringify(savedBlock, null, 2));
    console.log("Total fields saved:", Object.keys(savedBlock || {}).length);

    // Compare fields
    const originalKeys = Object.keys(testBlock);
    const savedKeys = Object.keys(savedBlock || {});
    const missingKeys = originalKeys.filter((k) => !savedKeys.includes(k));

    if (missingKeys.length > 0) {
      console.log("\n❌ MISSING FIELDS:", missingKeys);
    } else {
      console.log("\n✅ All fields saved successfully!");
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testSaveAllFields();
