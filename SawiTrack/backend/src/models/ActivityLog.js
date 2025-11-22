import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: false },
    user_name: { type: String, default: 'System' },
    role: { type: String, default: 'system' },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip_address: { type: String, default: '0.0.0.0' },
    timestamp: { type: Date, default: Date.now },
}, {
    timestamps: false,
    versionKey: false
});

// Add index for faster queries
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ action: 1 });

export default mongoose.model("ActivityLog", activityLogSchema);
