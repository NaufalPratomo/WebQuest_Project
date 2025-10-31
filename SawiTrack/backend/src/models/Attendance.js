import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    employeeId: { type: String, required: true },
    division_id: { type: Number },
    status: { type: String, enum: ['present', 'absent', 'leave'], required: true },
    hk: { type: Number, default: 1 }, // basic HK credit; can be adjusted per jobCode elsewhere
    notes: { type: String },
  },
  { timestamps: true }
);

AttendanceSchema.index({ date: 1, employeeId: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
