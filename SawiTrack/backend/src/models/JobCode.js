import mongoose from 'mongoose';

const JobCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['panen', 'non-panen'], required: true },
    hkValue: { type: Number, required: true, min: 0 },
    description: { type: String },
  },
  { timestamps: true }
);

JobCodeSchema.index({ code: 1 });

export default mongoose.models.JobCode || mongoose.model('JobCode', JobCodeSchema);
