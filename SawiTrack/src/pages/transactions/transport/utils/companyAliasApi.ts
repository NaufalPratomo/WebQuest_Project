/**
 * Company Alias API Client
 * Handles API calls for company alias resolution and management
 */

import type {
  CompanyAlias,
  CompanyResolution,
  CompanyMappingInput,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface ResolveResponse {
  resolved: CompanyResolution[];
  unresolved: string[];
}

interface BatchSaveResponse {
  saved: number;
  aliases: CompanyAlias[];
  errors?: Array<{ aliasName: string; error: string }>;
}

/**
 * Resolve company names from Excel against database
 * @param companyNames Array of company names from Excel
 * @returns Object with resolved and unresolved company names
 */
export async function resolveCompanyNames(
  companyNames: string[]
): Promise<ResolveResponse> {
  const response = await fetch(`${API_BASE}/company-aliases/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ companyNames }),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve company names: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Save multiple company alias mappings
 * @param mappings Array of alias name to company ID mappings
 * @returns Saved aliases
 */
export async function saveBatchAliases(
  mappings: CompanyMappingInput[]
): Promise<BatchSaveResponse> {
  const response = await fetch(`${API_BASE}/company-aliases/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mappings }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save aliases: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all company aliases
 * @returns Array of all aliases
 */
export async function getAllAliases(): Promise<CompanyAlias[]> {
  const response = await fetch(`${API_BASE}/company-aliases`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch aliases: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a company alias
 * @param id Alias ID to delete
 */
export async function deleteAlias(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/company-aliases/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete alias: ${response.statusText}`);
  }
}
