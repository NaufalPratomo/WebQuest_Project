import mongoose from 'mongoose';

const taksasiSelectionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  estateId: { type: String, required: true },
  division_id: { type: mongoose.Schema.Types.Mixed, required: true },
  block_no: { type: String, required: true },
  employeeIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Employee', default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  notes: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

taksasiSelectionSchema.index({ date: 1, estateId: 1, division_id: 1, block_no: 1 }, { unique: true });

export default mongoose.model('TaksasiSelection', taksasiSelectionSchema);
