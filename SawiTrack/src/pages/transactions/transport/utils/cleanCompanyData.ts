/**
 * Company Data Cleaning Utilities
 * Helper functions for processing company names from Excel
 */

import type { ExcelRowData, CompanyResolution } from "../types";

/**
 * Extract unique company names from Excel data
 * @param data Array of parsed Excel rows
 * @returns Array of unique company names (non-empty)
 */
export function extractUniqueCompanyNames(data: ExcelRowData[]): string[] {
  const names = new Set<string>();

  for (const row of data) {
    if (row.pt && typeof row.pt === "string" && row.pt.trim()) {
      names.add(row.pt.trim());
    }
  }

  return Array.from(names);
}

/**
 * Remove content in parentheses from company name
 * Example: "PT TPN (Bukit Aren)" -> "PT TPN"
 * @param name Company name
 * @returns Company name without parentheses content
 */
export function removeParenthesesContent(name: string): string {
  if (!name) return "";
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

/**
 * Normalize company name for matching
 * - Convert to lowercase
 * - Remove extra spaces
 * - Remove "PT" and "CV" prefixes
 * @param name Company name
 * @returns Normalized company name
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^pt\s+/i, "")
    .replace(/^cv\s+/i, "");
}

/**
 * Apply company resolution results to Excel data
 * Replaces PT names with resolved company IDs or names
 * @param data Excel row data
 * @param resolutions Resolution results
 * @returns Updated data with resolved company references
 */
export function applyCompanyResolution(
  data: ExcelRowData[],
  resolutions: CompanyResolution[],
): ExcelRowData[] {
  // Create lookup map for quick resolution
  const resolutionMap = new Map<string, CompanyResolution>();
  for (const resolution of resolutions) {
    resolutionMap.set(resolution.excelName, resolution);
  }

  // Apply resolutions to data
  return data.map((row) => {
    if (!row.pt) return row;

    const resolution = resolutionMap.get(row.pt);
    if (resolution && resolution.companyId) {
      // Replace with resolved company name or ID
      // Note: You might want to store company_id separately if needed
      return {
        ...row,
        pt: resolution.companyName || row.pt,
        // Optionally add: company_id: resolution.companyId
      };
    }

    return row;
  });
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find suggested company match for unresolved name
 * Uses fuzzy matching to find potential matches
 * @param excelName Name from Excel
 * @param availableCompanies List of available companies
 * @returns Suggested company ID and name, if found
 */
export function findSuggestedMatch(
  excelName: string,
  availableCompanies: Array<{ _id: string; company_name: string }>,
): { companyId?: string; companyName?: string } {
  if (!excelName) return {};

  // Try removing parentheses
  const cleaned = removeParenthesesContent(excelName);
  const normalizedCleaned = normalizeCompanyName(cleaned);

  // 1. Try exact match first
  for (const company of availableCompanies) {
    const normalized = normalizeCompanyName(company.company_name);
    if (normalized === normalizedCleaned) {
      return {
        companyId: company._id,
        companyName: company.company_name,
      };
    }
  }

  // 2. Try partial match (starts with)
  for (const company of availableCompanies) {
    const normalized = normalizeCompanyName(company.company_name);
    if (
      normalizedCleaned.startsWith(normalized) ||
      normalized.startsWith(normalizedCleaned)
    ) {
      return {
        companyId: company._id,
        companyName: company.company_name,
      };
    }
  }

  // 3. Try fuzzy matching with similarity threshold
  let bestMatch: {
    companyId: string;
    companyName: string;
    score: number;
  } | null = null;
  const SIMILARITY_THRESHOLD = 0.7; // 70% similarity required

  for (const company of availableCompanies) {
    const normalized = normalizeCompanyName(company.company_name);
    const similarity = calculateSimilarity(normalizedCleaned, normalized);

    if (similarity >= SIMILARITY_THRESHOLD) {
      if (!bestMatch || similarity > bestMatch.score) {
        bestMatch = {
          companyId: company._id,
          companyName: company.company_name,
          score: similarity,
        };
      }
    }
  }

  if (bestMatch) {
    return {
      companyId: bestMatch.companyId,
      companyName: bestMatch.companyName,
    };
  }

  return {};
}
