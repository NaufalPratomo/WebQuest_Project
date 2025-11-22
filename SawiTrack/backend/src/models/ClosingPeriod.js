import mongoose from "mongoose";

const closingPeriodSchema = new mongoose.Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    closedAt: { type: Date, default: Date.now },
    notes: { type: String },
    // Tambahan untuk periode bulan/tahun
    month: { type: Number, min: 1, max: 12 }, // 1-12
    year: { type: Number }, // YYYY
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
});

// Index for efficient date range queries
closingPeriodSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model("ClosingPeriod", closingPeriodSchema);
