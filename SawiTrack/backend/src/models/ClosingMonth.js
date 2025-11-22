import mongoose from "mongoose";

const ClosingMonthSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, min: 1900 },
    month: { type: Number, required: true, min: 1, max: 12 },
    closedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Ensure (year, month) combination is unique
ClosingMonthSchema.index({ year: 1, month: 1 }, { unique: true });

const ClosingMonth = mongoose.model("ClosingMonth", ClosingMonthSchema);
export default ClosingMonth;