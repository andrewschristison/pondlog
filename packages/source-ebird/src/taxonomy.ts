import { err, ok, type Result, type Taxon } from "@pondlog/core";
import { z } from "zod";
import { ebirdFetch } from "./client.js";
import { normalizeTaxonomyEntry } from "./normalize.js";
import {
  EbirdTaxaLocaleListSchema,
  EbirdTaxonomicGroupListSchema,
  EbirdTaxonomyListSchema,
  EbirdTaxonomyVersionListSchema,
  type EbirdTaxaLocale,
  type EbirdTaxonomicForm,
  type EbirdTaxonomicGroup,
  type EbirdTaxonomyEntry,
  type EbirdTaxonomyVersion,
} from "./schemas.js";

const TaxonomicFormsResponseSchema = z.array(z.string());

export interface TaxonomyParams {
  /** Comma-separated list or array of category codes (species, issf, hybrid, etc.). */
  cat?: string | string[];
  /** Specific species codes to fetch (subset of full taxonomy). */
  species?: string | string[];
  /** ISO locale for common names (default "en"). */
  locale?: string;
  /** Specific taxonomy version. */
  version?: string;
}

function joinList(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v.join(",") : v;
}

// 1. GET /ref/taxonomy/ebird
export async function getTaxonomy(
  params: TaxonomyParams = {},
): Promise<Result<EbirdTaxonomyEntry[]>> {
  return ebirdFetch("/ref/taxonomy/ebird", EbirdTaxonomyListSchema, {
    searchParams: {
      fmt: "json",
      cat: joinList(params.cat),
      species: joinList(params.species),
      locale: params.locale,
      version: params.version,
    },
  });
}

// 2. GET /ref/taxonomy/forms/{speciesCode}
// API returns a bare string[]; we wrap it in {speciesCode, forms} for callers.
export async function getTaxonomicForms(
  speciesCode: string,
): Promise<Result<EbirdTaxonomicForm>> {
  if (!speciesCode.trim()) {
    return err({ source: "ebird", message: "getTaxonomicForms: speciesCode is empty" });
  }
  const result = await ebirdFetch(
    `/ref/taxonomy/forms/${encodeURIComponent(speciesCode)}`,
    TaxonomicFormsResponseSchema,
  );
  if (!result.ok) return result;
  return ok({ speciesCode, forms: result.data });
}

// 3. GET /ref/taxonomy/locales
export async function getTaxaLocales(): Promise<Result<EbirdTaxaLocale[]>> {
  return ebirdFetch("/ref/taxonomy/locales", EbirdTaxaLocaleListSchema);
}

// 4. GET /ref/taxonomy/versions
export async function getTaxonomyVersions(): Promise<Result<EbirdTaxonomyVersion[]>> {
  return ebirdFetch("/ref/taxonomy/versions", EbirdTaxonomyVersionListSchema);
}

// 5. GET /ref/taxonomy/groups/{speciesGrouping}
export type SpeciesGrouping = "merlin" | "ebird";

export interface TaxonomicGroupsParams {
  /** Locale for group names. */
  groupNameLocale?: string;
}

export async function getTaxonomicGroups(
  grouping: SpeciesGrouping,
  params: TaxonomicGroupsParams = {},
): Promise<Result<EbirdTaxonomicGroup[]>> {
  return ebirdFetch(
    `/ref/sppgroup/${encodeURIComponent(grouping)}`,
    EbirdTaxonomicGroupListSchema,
    { searchParams: { groupNameLocale: params.groupNameLocale } },
  );
}

// Convenience: normalized variant
export async function getTaxonomyNormalized(
  params: TaxonomyParams = {},
): Promise<Result<Taxon[]>> {
  const result = await getTaxonomy(params);
  if (!result.ok) return result;
  return ok(result.data.map(normalizeTaxonomyEntry));
}
