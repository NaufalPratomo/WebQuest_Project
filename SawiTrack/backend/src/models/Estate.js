import mongoose from 'mongoose';

const GeoSchema = new mongoose.Schema({
  type: { type: String, enum: ['Polygon'], required: true },
  coordinates: { type: [[[Number]]], required: true },
});

const BlockSchema = new mongoose.Schema(
  {
    id_blok: String,
    no_blok: String,
    jenis_tanah: String,
    topografi: String,
    luas_tanam_: Number,
    tahun_: Number,
    jumlak_pokok: Number,
    jenis_bibit: String,
    luas_blok: Number,
    location: { type: GeoSchema, index: '2dsphere' },
  },
  { _id: false }
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
});

const Estate = mongoose.model('Estate', EstateSchema);
export default Estate;
