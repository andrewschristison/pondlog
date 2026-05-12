import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getTaxaLocales,
  getTaxonomicForms,
  getTaxonomicGroups,
  getTaxonomy,
  getTaxonomyVersions,
} from "@pondlog/source-ebird";
import { z } from "zod";
import { failure, success } from "../respond.js";
import {
  speciesCodeField,
  speciesGroupingField,
  sppLocaleField,
} from "../schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function registerTaxonomyTools(server: McpServer): void {
  server.registerTool(
    "get_taxonomy",
    {
      title: "eBird Taxonomy (full or filtered)",
      description:
        "Returns eBird's taxonomy entries: scientific name, common name, species code, category (species/issf/hybrid/etc.), taxon order, family. Useful for looking up a species code by name, or browsing the full eBird taxonomy. " +
        "Filter via `cat` (categories) or `species` (specific codes) to avoid downloading the entire taxonomy (~17k entries).",
      inputSchema: {
        cat: z
          .union([z.string(), z.array(z.string()).min(1)])
          .optional()
          .describe(
            "Filter by category (single string or array). Categories: species, issf (subspecies), hybrid, form, intergrade, domestic, slash, spuh.",
          ),
        species: z
          .union([speciesCodeField, z.array(speciesCodeField).min(1)])
          .optional()
          .describe(
            "Filter to specific species codes (single or array). Returns only these entries, useful when you have known codes and want full taxonomy details.",
          ),
        locale: sppLocaleField.optional(),
        version: z
          .string()
          .optional()
          .describe(
            "Specific taxonomy version (year) to fetch, e.g. \"2024\". Default: latest. Use `get_taxonomy_versions` to list available versions.",
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getTaxonomy({
        ...(args.cat ? { cat: args.cat } : {}),
        ...(args.species ? { species: args.species } : {}),
        ...(args.locale ? { locale: args.locale } : {}),
        ...(args.version ? { version: args.version } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_taxonomic_forms",
    {
      title: "Subspecies / Forms of a Species",
      description:
        "Returns the recognized subspecies and identifiable forms (issf entries) of a given species. Returns a list of subspecies species codes that resolve under the parent species. Use to enumerate variants when the parent species code is known.",
      inputSchema: {
        species_code: speciesCodeField,
      },
      annotations: READ_ONLY,
    },
    async ({ species_code }) => {
      const result = await getTaxonomicForms(species_code);
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_taxa_locales",
    {
      title: "Available Common-Name Locales",
      description:
        "Returns the full list of locale codes eBird supports for common names (en, es, fr, de, etc.) with their human-readable names and last-updated dates. Use to discover which locales are valid before passing them to other tools.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const result = await getTaxaLocales();
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_taxonomy_versions",
    {
      title: "eBird Taxonomy Versions",
      description:
        "Returns the list of eBird taxonomy versions (typically annual: 2024, 2023, 2022...) with a flag marking the latest. Use when you need a specific historical taxonomy version, or to confirm the current version for stable processing pipelines.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const result = await getTaxonomyVersions();
      return result.ok ? success(result.data) : failure(result.error);
    },
  );

  server.registerTool(
    "get_taxonomic_groups",
    {
      title: "Taxonomic Groups for Browsing",
      description:
        "Returns species groupings used to organize the taxonomy for human browsing. Two flavors: \"ebird\" returns standard taxonomic-order groups (waterfowl, shorebirds, raptors, etc.); \"merlin\" returns life-list-style groups used in the Merlin Bird ID app.",
      inputSchema: {
        grouping: speciesGroupingField,
        group_name_locale: z
          .string()
          .optional()
          .describe("Locale for group names (e.g. \"en\", \"es\"). Default \"en\"."),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = await getTaxonomicGroups(args.grouping, {
        ...(args.group_name_locale ? { groupNameLocale: args.group_name_locale } : {}),
      });
      return result.ok ? success(result.data) : failure(result.error);
    },
  );
}
