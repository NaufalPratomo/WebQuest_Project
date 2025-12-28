import mongoose from 'mongoose';

const DailyReportSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true },
        pt: { type: String, default: 'PALMA' },
        division: { type: String },
        nik: { type: String },
        employeeName: { type: String, required: true },
        mandorName: { type: String },
        coa: { type: String },
        activity: { type: String },
        jobType: { type: String }, // Jenis Pekerjaan
        block: { type: String },
        yearPlanted: { type: String },
        location: { type: String },
        hk: { type: Number, default: 0 },
        // rp HK calculated on frontend or pre-saved? User said formula, but usually good to save if rate changes.
        // Let's save quantities, maybe rate? Or just rely on current rate. User request: "rumus rp HK = HK * 128869.24" implies simple calc.
        // I'll store the quantities and maybe the computed value for easy reporting/summing.
        hkPrice: { type: Number, default: 0 },

        premi: { type: Number, default: 0 }, // If there's a premi quantity separate from HK Premi? The image has "Premi" column.

        hkPremi: { type: Number, default: 0 },
        rpPremi: { type: Number, default: 0 },

        unit: { type: String }, // Satuan
        result: { type: Number, default: 0 }, // Hasil Kerja
        janjang: { type: Number, default: 0 },

        materialName: { type: String },
        materialQty: { type: Number },
        materialUnit: { type: String },

        notes: { type: String },
    },
    { timestamps: true }
);

const DailyReport = mongoose.model('DailyReport', DailyReportSchema);
export default DailyReport;
