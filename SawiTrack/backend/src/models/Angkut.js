import mongoose from "mongoose";

const AngkutSchema = new mongoose.Schema(
  {
    date_panen: { type: Date, required: true }, // locked to harvest date
    date_angkut: { type: Date, required: true },
    companyId: { type: String }, // PT/Perusahaan ID
    companyName: { type: String }, // PT/Perusahaan Name
    estateId: { type: String, required: true },
    division_id: { type: mongoose.Schema.Types.Mixed, required: true },
    block_id: { type: String },
    block_no: { type: String, required: true },
    no_spb: { type: String }, // Nomor SPB for aggregation
    weightKg: { type: Number, required: true, min: 0 },
    jumlah: { type: Number, default: 0 }, // Manual input by mandor (berapa yang diangkut)
    notes: { type: String },
  },
  { timestamps: true },
);

AngkutSchema.index({
  date_panen: 1,
  date_angkut: 1,
  estateId: 1,
  division_id: 1,
  block_no: 1,
});

export default mongoose.models.Angkut || mongoose.model("Angkut", AngkutSchema);
