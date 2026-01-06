import mongoose from "mongoose";

const PekerjaanSchema = new mongoose.Schema(
  {
    sub_coa: { type: String, required: false },
    coa: { type: String, required: false },
    no_akun: { type: String, required: true },
    jenis_pekerjaan: { type: String, required: true },
    aktivitas: { type: String, required: false },
    satuan: { type: String, required: false },
    tipe: { type: String, required: false },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("Pekerjaan", PekerjaanSchema);
