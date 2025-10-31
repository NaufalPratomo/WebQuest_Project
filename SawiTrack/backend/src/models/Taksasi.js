import mongoose from 'mongoose';

const TaksasiSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    estateId: { type: String, required: true },
    division_id: { type: Number, required: true },
    block_id: { type: String },
    block_no: { type: String, required: true },
    weightKg: { type: Number, required: true, min: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

TaksasiSchema.index({ date: 1, estateId: 1, division_id: 1, block_no: 1 }, { unique: false });

export default mongoose.models.Taksasi || mongoose.model('Taksasi', TaksasiSchema);
