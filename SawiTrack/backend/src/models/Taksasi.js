import mongoose from 'mongoose';

const TaksasiSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    estateId: { type: String, required: true },
    division_id: { type: mongoose.Schema.Types.Mixed, required: true },
    block_id: { type: String },
    block_no: { type: String, required: true },
    weightKg: { type: Number, required: true, min: 0 },
    // Extended analytical fields for client-side reconstruction
    totalPokok: { type: Number },
    samplePokok: { type: Number },
    bm: { type: Number },
    ptb: { type: Number },
    bmbb: { type: Number },
    bmm: { type: Number },
    avgWeightKg: { type: Number },
    basisJanjangPerPemanen: { type: Number },
    akpPercent: { type: Number },
    taksasiJanjang: { type: Number },
    taksasiTon: { type: Number },
    kebutuhanPemanen: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

TaksasiSchema.index({ date: 1, estateId: 1, division_id: 1, block_no: 1 }, { unique: true });

export default mongoose.models.Taksasi || mongoose.model('Taksasi', TaksasiSchema);
