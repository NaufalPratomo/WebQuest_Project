import mongoose from "mongoose";

const CompanyAliasSchema = new mongoose.Schema(
  {
    alias_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
// Note: alias_name index is automatically created by unique: true
CompanyAliasSchema.index({ company_id: 1 });

// Clear any cached model to force reload
if (mongoose.models.CompanyAlias) {
  delete mongoose.models.CompanyAlias;
}

const CompanyAlias = mongoose.model("CompanyAlias", CompanyAliasSchema);
export default CompanyAlias;
