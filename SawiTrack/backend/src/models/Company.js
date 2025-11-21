import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema(
  {
    company_name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    estates: [{ type: String, ref: "Estate" }], // Array of estate IDs
  },
  {
    timestamps: true,
  }
);

// Clear any cached model to force reload
if (mongoose.models.Company) {
  delete mongoose.models.Company;
}

const Company = mongoose.model("Company", CompanySchema);
export default Company;
