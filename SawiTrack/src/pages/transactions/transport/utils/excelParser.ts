/**
 * Excel Parser Utility
 * Handles Excel file parsing with column normalization
 */

import ExcelJS from "exceljs";
import type { ExcelRowData, ParsedExcelData } from "../types";

/**
 * Normalize column names for matching
 * Removes dots, spaces, underscores, converts to lowercase
 */
export function normalizeColumnName(name: string): string {
  return name
    .replace(/\./g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Find column index by normalized name with alternatives
 */
export function findColumnIndex(
  headers: string[],
  primaryName: string,
  alternatives: string[] = [],
): number {
  const normalizedHeaders = headers.map(normalizeColumnName);

  // Try primary name first
  let idx = normalizedHeaders.indexOf(normalizeColumnName(primaryName));
  if (idx !== -1) return idx;

  // Try alternatives
  for (const alt of alternatives) {
    idx = normalizedHeaders.indexOf(normalizeColumnName(alt));
    if (idx !== -1) return idx;
  }

  return -1;
}

/**
 * Get cell value as string, handling various Excel formats
 */
export function getCellValue(row: any, colIndex: number): string {
  if (colIndex === -1) return "";

  const cell = row.getCell(colIndex + 1); // Excel is 1-indexed
  let val = cell.value;

  if (val === null || val === undefined) return "";

  // Handle Excel date objects
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }

  // Handle rich text
  if (typeof val === "object" && "richText" in val) {
    return val.richText.map((rt: any) => rt.text).join("");
  }

  // Handle formulas
  if (typeof val === "object" && "result" in val) {
    val = val.result;
  }

  // Handle hyperlinks
  if (typeof val === "object" && "text" in val) {
    val = val.text;
  }

  // Handle shared strings and other objects
  if (typeof val === "object" && "sharedString" in val) {
    val = val.sharedString;
  }

  return String(val).trim();
}

/**
 * Parse Excel file and extract transport data
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelData> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("File Excel tidak memiliki worksheet");
  }

  // Get headers from first row - try multiple methods
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  // Method 1: Try eachCell with includeEmpty
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const val = cell.value;
    if (val !== null && val !== undefined) {
      // Handle rich text
      if (typeof val === "object" && "richText" in val) {
        headers[colNumber - 1] = val.richText
          .map((rt: any) => rt.text)
          .join("")
          .trim();
      } else if (typeof val === "object" && "text" in val) {
        headers[colNumber - 1] = val.text.trim();
      } else {
        headers[colNumber - 1] = String(val).trim();
      }
    } else {
      headers[colNumber - 1] = "";
    }
  });

  // Filter out empty headers
  const nonEmptyHeaders = headers.filter((h) => h && h.length > 0);

  console.log("📋 Excel Headers detected:", nonEmptyHeaders);
  console.log("📏 Total columns:", headers.length);
  console.log(
    "🔍 All headers (with index):",
    headers.map((h, i) => `[${i}]: "${h}"`),
  );
  console.log(
    "🔍 Normalized headers:",
    headers.map((h) => normalizeColumnName(h)),
  );

  if (nonEmptyHeaders.length === 0) {
    throw new Error("File Excel tidak memiliki header yang valid");
  }

  // Map column indices with alternatives for special formats
  const columnMap = {
    date_panen: findColumnIndex(headers, "tanggal panen", [
      "tgl panen",
      "date panen",
      "tglpanen",
    ]),
    date_angkut: findColumnIndex(headers, "tanggal angkut", [
      "tgl angkut",
      "date angkut",
      "tglangkut",
      "tanggal",
    ]),
    pt: findColumnIndex(headers, "pt", ["perusahaan", "company"]),
    estate: findColumnIndex(headers, "estate", ["kebun"]),
    division_id: findColumnIndex(headers, "divisi", ["division", "div"]),
    block_no: findColumnIndex(headers, "blok", ["block", "no blok", "noblok"]),
    no_spb: findColumnIndex(headers, "no spb", [
      "spb",
      "nospb",
      "no.spb",
      "no tph",
      "tph",
      "notph",
      "no.tph",
    ]),
    tahun: findColumnIndex(headers, "tahun", ["year"]),
    no_mobil: findColumnIndex(headers, "no mobil", [
      "nomor mobil",
      "no kendaraan",
      "nomobil",
      "no.mobil",
      "No. Kenderaan",
    ]),
    nama_supir: findColumnIndex(headers, "nama supir", [
      "supir",
      "driver",
      "namasupir",
    ]),
    jumlah: findColumnIndex(headers, "jumlah", ["jjg", "janjang", "jjgangkut"]),
    brondolan: findColumnIndex(headers, "brondolan(kg)", [
      "brondolan",
      "BRONDOLAN ( KG)",
    ]),
    beratDiKirim: findColumnIndex(headers, "beratdikirim(kg)", [
      "berat di kirim",
      "beratdikirim",
      "beratdikirimkg",
    ]),
    no_tiket: findColumnIndex(headers, "no tiket", [
      "no. tiket",
      "tiket",
      "notiket",
      "no.tiket",
    ]),
    code: findColumnIndex(headers, "code", ["kode"]),
    bruto: findColumnIndex(headers, "bruto(kg)", ["bruto", "brutokg"]),
    tarra: findColumnIndex(headers, "tarra(kg)", ["tarra", "tarrakg"]),
    netto: findColumnIndex(headers, "netto(kg)", ["netto", "nettokg"]),
    potongan: findColumnIndex(headers, "potongan", ["poto", "potong"]),
    berat: findColumnIndex(headers, "berat", ["weight", "Berat /BLOCK"]),
    tonase: findColumnIndex(headers, "tonase/pengiriman", [
      "tonase",
      "tonase pengiriman",
      "tonasepengiriman",
    ]),
    jjg: findColumnIndex(headers, "jjg/pengiriman", [
      "jjg pengiriman",
      "jjgpengiriman",
    ]),
  };

  console.log("🔍 Column mapping:", columnMap);
  console.log(
    "📊 Critical columns - PT:",
    columnMap.pt,
    "value at index:",
    headers[columnMap.pt],
    "| Estate:",
    columnMap.estate,
    "value at index:",
    headers[columnMap.estate],
  );

  // Parse data rows
  const rows: ExcelRowData[] = [];
  let validRows = 0;
  let invalidRows = 0;

  console.log("🔄 Starting to parse data rows...");

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return;

    // Check if row has any data
    let hasData = false;
    let cellCount = 0;
    row.eachCell(() => {
      hasData = true;
      cellCount++;
    });

    if (!hasData) {
      console.log(`⏭️ Skipping row ${rowNumber} - no data`);
      return;
    }

    console.log(`📝 Processing row ${rowNumber} with ${cellCount} cells...`);

    const rowData: ExcelRowData = {
      date_panen: getCellValue(row, columnMap.date_panen),
      date_angkut: getCellValue(row, columnMap.date_angkut),
      pt: getCellValue(row, columnMap.pt),
      estate: getCellValue(row, columnMap.estate),
      division_id: getCellValue(row, columnMap.division_id),
      block_no: getCellValue(row, columnMap.block_no),
      no_spb: getCellValue(row, columnMap.no_spb),
      tahun: getCellValue(row, columnMap.tahun),
      no_mobil: getCellValue(row, columnMap.no_mobil),
      nama_supir: getCellValue(row, columnMap.nama_supir),
      jumlah: getCellValue(row, columnMap.jumlah),
      brondolan: getCellValue(row, columnMap.brondolan),
      beratDiKirim: getCellValue(row, columnMap.beratDiKirim),
      no_tiket: getCellValue(row, columnMap.no_tiket),
      code: getCellValue(row, columnMap.code),
      bruto: getCellValue(row, columnMap.bruto),
      tarra: getCellValue(row, columnMap.tarra),
      netto: getCellValue(row, columnMap.netto),
      potongan: getCellValue(row, columnMap.potongan),
      berat: getCellValue(row, columnMap.berat),
      tonase: getCellValue(row, columnMap.tonase),
      jjg: getCellValue(row, columnMap.jjg),
    };

    // Debug first few rows
    if (rowNumber === 2) {
      console.log("🔍 First data row (row 2):", rowData);
      console.log("🔍 PT value:", rowData.pt, "Estate value:", rowData.estate);
    }

    // Validate required fields - only PT is required
    // Estate can be empty if division_id is provided
    const hasRequiredFields = rowData.pt;

    if (hasRequiredFields) {
      validRows++;
    } else {
      invalidRows++;
      console.warn(`⚠️ Row ${rowNumber} missing required fields:`, {
        pt: rowData.pt,
        estate: rowData.estate,
        hasData,
      });
    }

    rows.push(rowData);
  });

  console.log("✅ Parsing complete:", {
    totalRows: rows.length,
    validRows,
    invalidRows,
  });
  console.log("📝 Sample row 1:", rows[0]);

  return {
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows,
  };
}

/**
 * Generate Excel template with correct headers
 */
export function generateExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transport Data");

  // Define headers matching the expected format
  worksheet.columns = [
    { header: "TANGGAL PANEN", key: "date_panen", width: 15 },
    { header: "TANGGAL ANGKUT", key: "date_angkut", width: 15 },
    { header: "PT", key: "pt", width: 20 },
    { header: "ESTATE", key: "estate", width: 20 },
    { header: "DIVISI", key: "division_id", width: 15 },
    { header: "BLOK", key: "block_no", width: 10 },
    { header: "NO SPB", key: "no_spb", width: 10 },
    { header: "TAHUN", key: "tahun", width: 10 },
    { header: "NO MOBIL", key: "no_mobil", width: 15 },
    { header: "NAMA SUPIR", key: "nama_supir", width: 20 },
    { header: "JUMLAH", key: "jumlah", width: 12 },
    { header: "BRONDOLAN (kg)", key: "brondolan", width: 15 },
    { header: "BERAT DI KIRIM (kg)", key: "beratDiKirim", width: 18 },
    { header: "NO. TIKET", key: "no_tiket", width: 15 },
    { header: "CODE", key: "code", width: 10 },
    { header: "BRUTO (kg)", key: "bruto", width: 12 },
    { header: "TARRA (kg)", key: "tarra", width: 12 },
    { header: "NETTO (kg)", key: "netto", width: 12 },
    { header: "POTONGAN", key: "potongan", width: 12 },
    { header: "BERAT", key: "berat", width: 12 },
    { header: "TONASE/PENGIRIMAN", key: "tonase", width: 18 },
    { header: "JJG/PENGIRIMAN", key: "jjg", width: 15 },
  ];

  // Add sample data
  worksheet.addRow({
    date_panen: "2026-01-14",
    date_angkut: "2026-01-14",
    pt: "PT Contoh",
    estate: "Estate 1",
    division_id: "DIV-1",
    block_no: "A01",
    no_spb: "SPB-001",
    tahun: "2026",
    no_mobil: "BK 1234 AB",
    nama_supir: "John Doe",
    jumlah: "100",
    brondolan: "50",
    beratDiKirim: "1500",
    no_tiket: "TKT-001",
    code: "C01",
    bruto: "1500",
    tarra: "200",
    netto: "1300",
    potongan: "50",
    berat: "1250",
    tonase: "1.25",
    jjg: "100",
  });

  return workbook;
}
