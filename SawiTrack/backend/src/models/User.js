import mongoose from 'mongoose';

// User untuk login/akun web (manager, foreman, employee yang punya akses sistem)
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // hashed
    role: { type: String, enum: ['manager', 'foreman', 'employee'], required: true },
    division_id: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, collection: 'users', strict: false }
);

const User = mongoose.model('User', UserSchema);
export default User;
