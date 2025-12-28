import mongoose from 'mongoose';

const ForemanGroupSchema = new mongoose.Schema(
  {
    mandorId: { type: String, required: true },
    name: { type: String },
    companyId: { type: String },
    division: { type: String },
    memberIds: { type: [String], default: [] }, // employee _id list
    notes: { type: String },
  },
  { timestamps: true, collection: 'foreman_groups' }
);

const ForemanGroup = mongoose.model('ForemanGroup', ForemanGroupSchema);
export default ForemanGroup;
