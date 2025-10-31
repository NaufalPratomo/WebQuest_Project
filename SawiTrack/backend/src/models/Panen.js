import mongoose from 'mongoose';

const PanenSchema = new mongoose.Schema(
  {
    date_panen: { type: Date, required: true },
    estateId: { type: String, required: true },
    division_id: { type: Number, required: true },
    block_id: { type: String },
    block_no: { type: String, required: true },
    weightKg: { type: Number, required: true, min: 0 },
    employeeId: { type: String },
    employeeName: { type: String },
    jobCode: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

PanenSchema.index({ date_panen: 1, estateId: 1, division_id: 1, block_no: 1 });

export default mongoose.models.Panen || mongoose.model('Panen', PanenSchema);
