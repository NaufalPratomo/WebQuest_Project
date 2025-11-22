import mongoose from 'mongoose';

// Employee untuk data pekerja/pemanen (bukan akun login)
const EmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nik: { type: String }, // NIK pekerja
    companyId: { type: String }, // ref to Company
    division_id: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    // Biodata pekerja
    salary: { type: Number, default: 0 },
    address: { type: String },
    phone: { type: String },
    birthDate: { type: Date },
    position: { type: String }, // jabatan: pemanen, mandor, dll
  },
  { timestamps: true, collection: 'employees', strict: false }
);

const Employee = mongoose.model('Employee', EmployeeSchema);
export default Employee;
