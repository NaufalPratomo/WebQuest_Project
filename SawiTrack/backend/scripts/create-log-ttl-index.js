import mongoose from "mongoose";
import dotenv from "dotenv";
import ActivityLog from "../src/models/ActivityLog.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI is not defined in .env");
    process.exit(1);
}

const run = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB...");

        console.log("Creating TTL index on ActivityLog collection...");
        // 90 days in seconds = 90 * 24 * 60 * 60 = 7,776,000
        await ActivityLog.collection.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

        console.log("Accessing existing indexes to verify...");
        const indexes = await ActivityLog.collection.indexes();
        console.log("Indexes on ActivityLog:", indexes);

        console.log("TTL Index successfully created! Logs older than 90 days will be automatically deleted.");
        process.exit(0);
    } catch (error) {
        console.error("Error creating index:", error);
        process.exit(1);
    }
};

run();
