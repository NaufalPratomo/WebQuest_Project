import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import ClosingPeriod from "../src/models/ClosingPeriod.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from backend root or project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (!process.env.MONGO_ATLAS_URI && !process.env.MONGO_URI) {
    dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME;

async function fix() {
    if (!MONGO_URI) {
        console.error("Missing Mongo URI");
        process.exit(1);
    }
    try {
        await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
        console.log("Connected to MongoDB");

        const periods = await ClosingPeriod.find({
            $or: [{ month: { $exists: false } }, { year: { $exists: false } }, { month: null }, { year: null }]
        });

        console.log(`Found ${periods.length} periods to fix.`);

        for (const p of periods) {
            const d = new Date(p.startDate);
            const month = d.getMonth() + 1;
            const year = d.getFullYear();
            p.month = month;
            p.year = year;
            await p.save();
            console.log(`Fixed period ${p._id}: ${month}/${year}`);
        }

        console.log("Done.");
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fix();
