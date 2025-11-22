import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    user_name: { type: String },
    role: { type: String },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed }, // Can be string or object
    ip_address: { type: String },
    timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("ActivityLog", activityLogSchema);
