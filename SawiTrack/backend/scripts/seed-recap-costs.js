import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import OperationalCost from "../src/models/OperationalCost.js";

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
    year: new Date().getFullYear() - 1,
    resetAll: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--year" && argv[i + 1]) {
      args.year = Number(argv[i + 1]);
      i++;
      continue;
    }
    if (token === "--reset-all") {
      args.resetAll = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function monthRange(year, month1to12) {
  const start = new Date(year, month1to12 - 1, 1);
  const nextMonthStart = new Date(year, month1to12, 1);
  return { start, nextMonthStart };
}

function buildSeedDocsForMonth({ year, month }) {
  // month: 7=July, 8=August, ...
  const date = new Date(year, month - 1, 1);

  // NOTE: The UI calculates Total Rp, Rp/Kg, and Cash-to-Revenue.
  // We only seed the stored fields that map 1:1 from the sheet.

  if (month === 7) {
    return [
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Potong Buah ( Panen )",
        aktivitas: "Potong Buah",
        satuan: "",
        hk: 2145,
        hasilKerja: 853770,
        output: 0,
        satuanOutput: "",
        rpKhl: 276359571,
        rpPremi: 12317400,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir Manual",
        satuan: "",
        hk: 2333,
        hasilKerja: 303150,
        output: 0,
        satuanOutput: "",
        rpKhl: 300651377,
        rpPremi: 13400091,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir gerobak / Motor",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir PU",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading DT",
        aktivitas: "Kirim TBS ke PKS",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental Unit Langsir",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 68841,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 60786211,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental unit TBS Ke Pabrik",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 853770,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 182113500,
      },
    ];
  }

  if (month === 8) {
    return [
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Potong Buah ( Panen )",
        aktivitas: "Potong Buah",
        satuan: "",
        hk: 1680,
        hasilKerja: 673640,
        output: 0,
        satuanOutput: "",
        rpKhl: 216499920,
        rpPremi: 21299990,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir Manual",
        satuan: "",
        hk: 1795,
        hasilKerja: 253761,
        output: 0,
        satuanOutput: "",
        rpKhl: 231319855,
        rpPremi: 11079123,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir gerobak / Motor",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir PU",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading DT",
        aktivitas: "Kirim TBS ke PKS",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental Unit Langsir",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 67990,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 60153330,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental unit TBS Ke Pabrik",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 666720,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 143271000,
      },
    ];
  }

  if (month === 9) {
    return [
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Potong Buah ( Panen )",
        aktivitas: "Potong Buah",
        satuan: "",
        hk: 1926,
        hasilKerja: 828960,
        output: 0,
        satuanOutput: "",
        rpKhl: 249426138,
        rpPremi: 4096000,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir Manual",
        satuan: "",
        hk: 1795,
        hasilKerja: 286149,
        output: 0,
        satuanOutput: "",
        rpKhl: 232351138,
        rpPremi: 43381000,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir gerobak / Motor",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir PU",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading DT",
        aktivitas: "Kirim TBS ke PKS",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental Unit Langsir",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 76186,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 69634327,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental unit TBS Ke Pabrik",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 778280,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 169682750,
      },
    ];
  }

  if (month === 10) {
    return [
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Potong Buah ( Panen )",
        aktivitas: "Potong Buah",
        satuan: "",
        hk: 2318,
        hasilKerja: 1142670,
        output: 0,
        satuanOutput: "",
        rpKhl: 298718898,
        rpPremi: 10825016,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir Manual",
        satuan: "",
        hk: 493,
        hasilKerja: 339535,
        output: 0,
        satuanOutput: "",
        rpKhl: 63468101,
        rpPremi: 773215,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir gerobak / Motor",
        satuan: "",
        hk: 590,
        hasilKerja: 433524,
        output: 0,
        satuanOutput: "",
        rpKhl: 75968417,
        rpPremi: 13158247,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir PU",
        satuan: "",
        hk: 507,
        hasilKerja: 893676,
        output: 0,
        satuanOutput: "",
        rpKhl: 65304487,
        rpPremi: 25511032,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading DT",
        aktivitas: "Kirim TBS ke PKS",
        satuan: "",
        hk: 493,
        hasilKerja: 1142670,
        output: 0,
        satuanOutput: "",
        rpKhl: 63564753,
        rpPremi: 5148000,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental Unit Langsir",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 449218,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 64173990,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental unit TBS Ke Pabrik",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 1102690,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 242157250,
      },
    ];
  }

  if (month === 11) {
    return [
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Potong Buah ( Panen )",
        aktivitas: "Potong Buah",
        satuan: "",
        hk: 2295,
        hasilKerja: 161544,
        output: 70,
        satuanOutput: "Jjg/hk",
        rpKhl: 295754906,
        rpPremi: 13402401,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir Manual",
        satuan: "",
        hk: 716,
        hasilKerja: 48040,
        output: 67,
        satuanOutput: "Jjg/hk",
        rpKhl: 92205941,
        rpPremi: 260000,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir gerobak / Motor",
        satuan: "",
        hk: 838,
        hasilKerja: 121521,
        output: 145,
        satuanOutput: "Jjg/hk",
        rpKhl: 107992423,
        rpPremi: 44655153,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading Langsir TBS ke TPH DT",
        aktivitas: "Langsir PU",
        satuan: "",
        hk: 494,
        hasilKerja: 131411,
        output: 266,
        satuanOutput: "Jjg/hk",
        rpKhl: 63596970,
        rpPremi: 2143869,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "TK Loading DT",
        aktivitas: "Kirim TBS ke PKS",
        satuan: "",
        hk: 530,
        hasilKerja: 161742,
        output: 305,
        satuanOutput: "Jjg/hk",
        rpKhl: 68236263,
        rpPremi: 4414000,
        rpBorongan: 0,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental Unit Langsir",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 78265987,
      },
      {
        date,
        category: "Panen",
        jenisPekerjaan: "Rental unit TBS Ke Pabrik",
        aktivitas: "",
        satuan: "",
        hk: 0,
        hasilKerja: 0,
        output: 0,
        satuanOutput: "",
        rpKhl: 0,
        rpPremi: 0,
        rpBorongan: 251746996,
      },
    ];
  }

  return [];
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/seed-recap-costs.js --year 2025 [--reset-all]");
    console.log("  --year       Year used for July-November seed (default: previous year)");
    console.log("  --reset-all  Delete ALL OperationalCost docs before seeding");
    process.exit(0);
  }

  try {
    if (!MONGO_URI) throw new Error("Missing MONGO URI in environment");

    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log("Connected to DB");

    const year = args.year;

    const monthsToSeed = [7, 8, 9, 10, 11];
    const docs = monthsToSeed.flatMap((m) => buildSeedDocsForMonth({ year, month: m }));

    if (args.resetAll) {
      const del = await OperationalCost.deleteMany({});
      console.log(`Deleted OperationalCost docs: ${del.deletedCount}`);
    } else {
      // Delete only target months/year
      let deletedCount = 0;
      for (const month of monthsToSeed) {
        const { start, nextMonthStart } = monthRange(year, month);
        const del = await OperationalCost.deleteMany({ date: { $gte: start, $lt: nextMonthStart } });
        deletedCount += del.deletedCount || 0;
      }
      console.log(`Deleted OperationalCost docs for ${monthsToSeed.join(",")} ${year}: ${deletedCount}`);
    }

    const inserted = await OperationalCost.insertMany(docs, { ordered: true });
    console.log(`Inserted OperationalCost docs: ${inserted.length}`);

    console.log("Seeder recap-costs completed.");
  } catch (e) {
    console.error("Seeder error:", e?.message || e);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
  }
})();
