import mongoose from 'mongoose';

const TargetSchema = new mongoose.Schema(
  {
    division: { type: String, required: true },
    period: { type: String, required: true },
    target: { type: Number, required: true },
    achieved: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'done'], default: 'active' },
  },
  { timestamps: true }
);

const Target = mongoose.model('Target', TargetSchema);
export default Target;
