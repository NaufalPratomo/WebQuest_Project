import mongoose from 'mongoose';

const PanenSchema = new mongoose.Schema(
  {
    date_panen: { type: Date, required: true },
    estateId: { type: String, required: true },
    division_id: { type: Number, required: true },
    block_id: { type: String },
    block_no: { type: String, required: true },
    noTPH: { type: String }, // Nomor TPH
    weightKg: { type: Number, required: true, min: 0 },
    employeeId: { type: String },
    employeeName: { type: String },
    mandorId: { type: String },
    mandorName: { type: String },
    jobCode: { type: String },
    notes: { type: String },
    // Real harvest wage calculation fields
    janjangTBS: { type: Number, default: 0 },
    janjangKosong: { type: Number, default: 0 },
    upahBasis: { type: Number, default: 0 },
    premi: { type: Number, default: 0 },
    totalUpah: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PanenSchema.index({ date_panen: 1, estateId: 1, division_id: 1, block_no: 1 });

export default mongoose.models.Panen || mongoose.model('Panen', PanenSchema);
