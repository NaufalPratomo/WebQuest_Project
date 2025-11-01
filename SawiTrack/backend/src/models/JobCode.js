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

// "code" already has a unique index via the schema path option above.
// Avoid defining a duplicate index to silence Mongoose duplicate index warning.
// JobCodeSchema.index({ code: 1 });

export default mongoose.models.JobCode || mongoose.model('JobCode', JobCodeSchema);
