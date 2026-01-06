
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'src', 'index.js');
const tempPath = path.join(__dirname, 'src', 'index.js.tmp');

const fileContent = fs.readFileSync(filePath, 'utf8');
const lines = fileContent.split('\n');

let cutOffLine = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('logActivity(req, "DELETE_DAILY_REPORT"') ||
        (lines[i].includes('DELETE_DAILY_REPORT') && lines[i].includes('logActivity'))) {

        // Look forward for the closing brace and paren
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].trim() === '});') {
                cutOffLine = j + 1;
                break;
            }
        }
        if (cutOffLine !== -1) break;
    }
}
 

if (cutOffLine === -1) {
    console.error("Could not find cut off point!");
    process.exit(1);
}

const goodLines = lines.slice(0, cutOffLine);
const newContent = `

// Operational Costs (Recap)
import OperationalCost from "./models/OperationalCost.js";

app.get(\`\${API_BASE_PATH}/recap-costs\`, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: "Month and Year are required" });
    }
    
    // Create Date range for the entire month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, Number(month) + 1, 0); // Last day of month
    
    const costs = await OperationalCost.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ category: 1, date: 1 }).lean();
    
    res.json(costs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(\`\${API_BASE_PATH}/recap-costs\`, async (req, res) => {
  try {
    const { date, category, jenisPekerjaan, aktivitas, satuan, hk, hasilKerja, output, satuanOutput, rpKhl, rpPremi, rpBorongan } = req.body;
    
    if (!date || !category || !jenisPekerjaan) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (await checkDateClosed(date)) {
      return res.status(400).json({ error: \`Periode untuk tanggal \${date} sudah ditutup.\` });
    }

    const created = await OperationalCost.create({
      date,
      category,
      jenisPekerjaan,
      aktivitas,
      satuan,
      hk,
      hasilKerja,
      output,
      satuanOutput,
      rpKhl,
      rpPremi,
      rpBorongan
    });
    
    logActivity(req, "CREATE_COST", { category, jenisPekerjaan });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(\`\${API_BASE_PATH}/recap-costs/:id\`, async (req, res) => {
  try {
    const existing = await OperationalCost.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (await checkDateClosed(existing.date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup." });
    }

    const updated = await OperationalCost.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    logActivity(req, "UPDATE_COST", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(\`\${API_BASE_PATH}/recap-costs/:id\`, async (req, res) => {
  try {
    const existing = await OperationalCost.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (await checkDateClosed(existing.date)) {
      return res.status(400).json({ error: "Periode transaksi ini sudah ditutup." });
    }

    await OperationalCost.findByIdAndDelete(req.params.id);
    logActivity(req, "DELETE_COST", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export app for Vercel
export default app;

// Only listen if NOT running on Vercel (e.g. local dev)
if (!process.env.VERCEL) {
  connectMongo()
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          \`API listening on http://localhost:\${PORT}\${API_BASE_PATH}\`
        );
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
} else {
  // On Vercel, just ensure DB is connected for the handler
  connectMongo().catch((e) => console.error("Vercel DB Connect Error:", e));
}
`;

fs.writeFileSync(tempPath, goodLines.join('\n') + newContent);
console.log('Successfully created temp file');
