import mongoose from "mongoose";

const GeoSchema = new mongoose.Schema({
  type: { type: String, enum: ["Polygon"], required: true },
  coordinates: { type: [[[Number]]], required: true },
});

const BlockSchema = new mongoose.Schema(
  {
    id_blok: String,
    no_blok: String,
    no_tph: String, // Nomor TPH per blok
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    location_type: String,
    jenis_tanah: String,
    topografi: String,
    luas_tanam_: Number,
    tahun_: Number,
    jumlak_pokok: Number,
    jenis_bibit: String,
    luas_land_preparation: Number,
    luas_nursery: Number,
    luas_lain___lain: Number,
    luas_lebungan: Number,
    luas_garapan: Number,
    luas_rawa: Number,
    luas_tanggul: Number,
    luas_area_non_efektif: Number,
    luas_konservasi: Number,
    luas_pks: Number,
    luas_jalan: Number,
    luas_drainase: Number,
    luas_perumahan: Number,
    luas_sarana_prasanara: Number,
    luas_blok: Number,
    SPH: Number,
  },
  { _id: false, strict: false }
);

const DivisionSchema = new mongoose.Schema(
  {
    division_id: Number,
    blocks: [BlockSchema],
  },
  { _id: false }
);

const EstateSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  estate_name: { type: String, required: true },
  divisions: [DivisionSchema],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
});

// Clear any cached model to force reload
if (mongoose.models.Estate) {
  delete mongoose.models.Estate;
}

const Estate = mongoose.model("Estate", EstateSchema);
export default Estate;
