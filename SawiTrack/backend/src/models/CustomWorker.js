import mongoose from 'mongoose';

const customWorkerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

customWorkerSchema.index({ active: 1, name: 1 });

export default mongoose.model('CustomWorker', customWorkerSchema);
