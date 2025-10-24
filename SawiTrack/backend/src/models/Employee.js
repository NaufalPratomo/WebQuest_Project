import mongoose from 'mongoose';

// Use 'users' collection to match existing data; allow extra fields
const EmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['manager', 'foreman', 'employee'], required: true },
    division_id: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, collection: 'users', strict: false }
);

const Employee = mongoose.model('Employee', EmployeeSchema);
export default Employee;
