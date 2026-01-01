import mongoose from "mongoose";

const operationalCostSchema = new mongoose.Schema({
    date: { type: Date, required: true }, // We will store the 1st of the month
    category: { type: String, required: true }, // e.g., "Panen", "Rawat", "Umum"
    jenisPekerjaan: { type: String, required: true },
    aktivitas: { type: String, default: "" },
    satuan: { type: String, default: "" },
    hk: { type: Number, default: 0 },
    hasilKerja: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
    satuanOutput: { type: String, default: "" },
    rpKhl: { type: Number, default: 0 },
    rpPremi: { type: Number, default: 0 },
    rpBorongan: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("OperationalCost", operationalCostSchema);
