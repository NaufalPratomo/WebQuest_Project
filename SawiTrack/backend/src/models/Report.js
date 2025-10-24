import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema(
  {
    employeeId: { type: String },
    employeeName: { type: String, required: true },
    date: { type: Date, required: true },
    division: { type: String, required: true },
    jobType: { type: String, required: true },
    hk: { type: Number, required: true },
    notes: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejectedReason: { type: String },
  },
  { timestamps: true }
);

const Report = mongoose.model('Report', ReportSchema);
export default Report;
