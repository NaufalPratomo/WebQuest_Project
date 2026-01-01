
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'api.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Remove the last "};" to append new methods
const lastBraceIndex = content.lastIndexOf('};');
if (lastBraceIndex !== -1) {
    const before = content.substring(0, lastBraceIndex);
    const newMethods = `
  // Operational Cost (Recap)
  recapCostsList: (params: { month: string | number; year: string | number }) => {
    const search = toQS(params as any);
    return http<RecapDataRow[]>(\`/recap-costs\${search}\`);
  },
  recapCostCreate: (body: Partial<RecapDataRow>) =>
    http<RecapDataRow>(\`/recap-costs\`, { method: "POST", body: JSON.stringify(body) }),
  recapCostUpdate: (id: string, body: Partial<RecapDataRow>) =>
    http<RecapDataRow>(\`/recap-costs/\${id}\`, { method: "PUT", body: JSON.stringify(body) }),
  recapCostDelete: (id: string) =>
    http<{ ok: boolean }>(\`/recap-costs/\${id}\`, { method: "DELETE" }),
};

export interface RecapDataRow {
  _id?: string;
  date: string; // ISO date (usually 1st of month)
  category: string;
  jenisPekerjaan: string;
  aktivitas: string;
  satuan: string;
  hk: number;
  hasilKerja: number;
  output: number;
  satuanOutput: string;
  rpKhl: number;
  rpPremi: number;
  rpBorongan: number;
}
`;
    fs.writeFileSync(filePath, before + newMethods);
    console.log("Appended new API methods");
} else {
    console.error("Could not find closing brace of api object: " + lastBraceIndex);
}
