/**
 * Data Validation Utility
 * Pre-fetch optimization for PT and Estate lookups
 */

import { api } from "@/lib/api";
import type { Company } from "@/lib/api";
import type { CompanyEstateMap, ExcelRowData, Estate } from "../types";

/**
 * Pre-fetch all companies and estates once
 * Creates Maps for O(1) lookup performance
 */
export async function prefetchMasterData(): Promise<CompanyEstateMap> {
  // Fetch all companies and estates in parallel
  const [companies, estates] = await Promise.all([
    api.companies(),
    api.estates(),
  ]);

  // Create Maps for fast lookup
  const companyMap = new Map<string, Company>();
  const estateMap = new Map<string, Estate>();

  companies.forEach((company) => {
    // Store by normalized name (case-insensitive)
    const normalizedName = company.company_name.trim().toLowerCase();
    companyMap.set(normalizedName, company);
  });

  estates.forEach((estate) => {
    const normalizedName = estate.estate_name.trim().toLowerCase();
    estateMap.set(normalizedName, estate);
  });

  return {
    companyMap,
    estateMap,
    newCompanies: new Set<string>(),
    newEstates: new Map<string, string>(),
  };
}

/**
 * Identify new companies and estates that need to be created
 * Collects them without making API calls in the loop
 * Only PT is required - estate is optional
 */
export function identifyNewMasterData(
  rows: ExcelRowData[],
  masterData: CompanyEstateMap,
): CompanyEstateMap {
  const { companyMap, estateMap } = masterData;
  const newCompanies = new Set<string>();
  const newEstates = new Map<string, string>(); // estateName -> companyName

  rows.forEach((row) => {
    // Only PT is required
    if (!row.pt) return;

    const ptNormalized = row.pt.trim().toLowerCase();

    // Check if company exists
    if (!companyMap.has(ptNormalized)) {
      newCompanies.add(row.pt.trim());
    }

    // Check if estate exists (only if estate is provided)
    if (row.estate) {
      const estateNormalized = row.estate.trim().toLowerCase();
      if (!estateMap.has(estateNormalized)) {
        newEstates.set(row.estate.trim(), row.pt.trim());
      }
    }
  });

  return {
    ...masterData,
    newCompanies,
    newEstates,
  };
}

/**
 * Bulk create new companies
 * Creates all new companies at once instead of one by one
 */
export async function bulkCreateCompanies(
  companyNames: Set<string>,
  onProgress?: (current: number, total: number) => void,
): Promise<Map<string, Company>> {
  const createdCompanies = new Map<string, Company>();
  const names = Array.from(companyNames);

  if (names.length === 0) return createdCompanies;

  // Create companies with concurrency limit to avoid overwhelming server
  const CONCURRENT_LIMIT = 5;

  for (let i = 0; i < names.length; i += CONCURRENT_LIMIT) {
    const batch = names.slice(i, i + CONCURRENT_LIMIT);

    const results = await Promise.all(
      batch.map(async (name) => {
        try {
          const company = await api.createCompany({
            company_name: name,
            address: "Auto-created",
            estates: [],
          });
          return { name, company };
        } catch (error) {
          console.error(`Failed to create company ${name}:`, error);
          return null;
        }
      }),
    );

    results.forEach((result) => {
      if (result) {
        createdCompanies.set(result.name.toLowerCase(), result.company);
      }
    });

    if (onProgress) {
      onProgress(Math.min(i + CONCURRENT_LIMIT, names.length), names.length);
    }
  }

  return createdCompanies;
}

/**
 * Bulk create new estates
 * Creates estates grouped by company to minimize API calls
 */
export async function bulkCreateEstates(
  newEstates: Map<string, string>, // estateName -> companyName
  companyMap: Map<string, Company>,
  onProgress?: (current: number, total: number) => void,
): Promise<Map<string, Estate>> {
  const createdEstates = new Map<string, Estate>();

  if (newEstates.size === 0) return createdEstates;

  // Group estates by company
  const estatesByCompany = new Map<string, string[]>();

  newEstates.forEach((companyName, estateName) => {
    const normalizedCompanyName = companyName.toLowerCase();

    if (!estatesByCompany.has(normalizedCompanyName)) {
      estatesByCompany.set(normalizedCompanyName, []);
    }

    estatesByCompany.get(normalizedCompanyName)!.push(estateName);
  });

  let processed = 0;
  const total = newEstates.size;

  // Create estates for each company
  for (const [companyNameLower, estateNames] of estatesByCompany.entries()) {
    const company = companyMap.get(companyNameLower);

    if (!company) {
      console.warn(`Company not found: ${companyNameLower}`);
      continue;
    }

    // Create estates concurrently for this company
    const results = await Promise.all(
      estateNames.map(async (estateName) => {
        try {
          const estate = (await api.createEstate({
            _id: `${company._id}_${estateName
              .replace(/\s+/g, "_")
              .toLowerCase()}`,
            estate_name: estateName,
            divisions: [],
          })) as any as Estate;
          return { estateName, estate };
        } catch (error) {
          console.error(`Failed to create estate ${estateName}:`, error);
          return null;
        }
      }),
    );

    results.forEach((result) => {
      if (result) {
        createdEstates.set(result.estateName.toLowerCase(), result.estate);
        processed++;

        if (onProgress) {
          onProgress(processed, total);
        }
      }
    });
  }

  return createdEstates;
}

/**
 * Update master data maps with newly created items
 */
export function updateMasterDataMaps(
  masterData: CompanyEstateMap,
  newCompanies: Map<string, Company>,
  newEstates: Map<string, Estate>,
): CompanyEstateMap {
  const updatedCompanyMap = new Map(masterData.companyMap);
  const updatedEstateMap = new Map(masterData.estateMap);

  newCompanies.forEach((company, name) => {
    updatedCompanyMap.set(name.toLowerCase(), company);
  });

  newEstates.forEach((estate, name) => {
    updatedEstateMap.set(name.toLowerCase(), estate);
  });

  return {
    companyMap: updatedCompanyMap,
    estateMap: updatedEstateMap,
    newCompanies: new Set(),
    newEstates: new Map(),
  };
}

/**
 * Validate row and get company/estate IDs from pre-fetched maps
 * Now more flexible - estate is optional if company is found
 */
export function validateAndGetIds(
  row: ExcelRowData,
  masterData: CompanyEstateMap,
): { companyId: string; estateId: string } | null {
  // PT is required
  if (!row.pt) {
    console.warn("Row missing PT:", row);
    return null;
  }

  const ptNormalized = row.pt.trim().toLowerCase();
  const company = masterData.companyMap.get(ptNormalized);

  if (!company) {
    console.warn(
      `Company not found in map: "${row.pt}" (normalized: "${ptNormalized}")`,
    );
    console.log(
      "Available companies:",
      Array.from(masterData.companyMap.keys()),
    );
    return null;
  }

  // Estate is optional - try to find it, but use division_id as fallback
  let estateId = "";
  if (row.estate) {
    const estateNormalized = row.estate.trim().toLowerCase();
    const estate = masterData.estateMap.get(estateNormalized);
    if (estate) {
      estateId = estate._id;
    } else {
      console.warn(
        `Estate not found: "${row.estate}" (normalized: "${estateNormalized}") - will use division_id as fallback`,
      );
    }
  }

  // If estateId is still empty, use division_id as estateId
  if (!estateId && row.division_id) {
    // Try to find estate by division_id first
    const divisionNormalized = String(row.division_id).trim().toLowerCase();
    const estate = masterData.estateMap.get(divisionNormalized);
    if (estate) {
      estateId = estate._id;
      console.log(`Using division_id "${row.division_id}" as estate match`);
    } else {
      // Use division_id directly as estateId
      estateId = String(row.division_id).trim().toUpperCase();
      console.log(
        `Using division_id "${row.division_id}" directly as estateId`,
      );
    }
  }

  // If still no estateId, return null to skip this row
  if (!estateId) {
    console.warn(`No estateId found for row:`, row);
    return null;
  }

  return {
    companyId: company._id,
    estateId: estateId,
  };
}

/**
 * Build notes string from additional fields
 */
export function buildNotesString(row: ExcelRowData): string {
  const notes: string[] = [];

  if (row.no_mobil) notes.push(`no_mobil=${row.no_mobil}`);
  if (row.nama_supir) notes.push(`supir=${row.nama_supir}`); // Use 'supir' key for compatibility
  if (row.brondolan) notes.push(`brondolan=${row.brondolan}`);
  if (row.beratDiKirim) notes.push(`berat_di=${row.beratDiKirim}`); // Use 'berat_di' key for compatibility
  if (row.no_tiket) notes.push(`no_tiket=${row.no_tiket}`);
  if (row.code) notes.push(`code=${row.code}`);
  if (row.bruto) notes.push(`bruto=${row.bruto}`);
  if (row.tarra) notes.push(`tarra=${row.tarra}`);
  if (row.netto) notes.push(`netto=${row.netto}`);
  if (row.potongan) notes.push(`poto=${row.potongan}`); // Use 'poto' key for compatibility
  if (row.berat) notes.push(`berat=${row.berat}`);
  if (row.tonase) notes.push(`tonase=${row.tonase}`);
  if (row.jjg) notes.push(`jjg=${row.jjg}`);
  if (row.tahun) notes.push(`tahun=${row.tahun}`);
  if (row.no_spb) notes.push(`no_spb=${row.no_spb}`);

  return notes.join("; ");
}
