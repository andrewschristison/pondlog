import { describe, expect, it } from "vitest";
import {
  checkBedCompatibility,
  findByMechanism,
  getAntagonists,
  getBestCompanions,
  getCompanions,
  getCompanionsMeta,
  getRelationship,
} from "../src/companions.js";

describe("companions — fixture parse + slug guard", () => {
  it("loads with version 1 and ≥100 entries; all slugs in crop calendar", () => {
    const meta = getCompanionsMeta();
    expect(meta.version).toBe("1");
    expect(meta.totalEntries).toBeGreaterThanOrEqual(100);
    expect(meta.license).toBe("CC-BY-4.0");
  });
});

describe("getCompanions(slug)", () => {
  it("returns both forward and reverse edges with `slug` as subject", () => {
    const r = getCompanions("tomato");
    // Tomato has multiple beneficial and antagonist relationships.
    expect(r.companions.length).toBeGreaterThanOrEqual(10);
    expect(r.antagonists.length).toBeGreaterThanOrEqual(3);
    // Reverse-edge surfacing: marigold → tomato is stored as (marigold, tomato);
    // getCompanions("tomato") should still surface marigold as a companion
    // (because tomato is the named partner in the stored edge).
    const marigold = r.companions.find((e) => e.companion === "marigold");
    expect(marigold).toBeDefined();
    // The synthesized edge has tomato as crop and marigold as companion.
    expect(marigold?.crop).toBe("tomato");
  });

  it("classifies fennel-herb relationships as antagonist", () => {
    const r = getCompanions("fennel-herb");
    expect(r.antagonists.length).toBeGreaterThanOrEqual(8);
    expect(r.companions.length).toBe(0);
  });
});

describe("getRelationship(A, B) with reverse fallback", () => {
  it("returns the forward edge when stored that way", () => {
    // basil → tomato is the stored direction for the pest_repellent mechanism.
    const e = getRelationship("basil", "tomato");
    expect(e?.mechanism).toBe("pest_repellent");
  });

  it("returns the reverse edge when only the opposite direction is stored", () => {
    // marigold → tomato is stored; (tomato, marigold) should synthesize the reverse.
    const e = getRelationship("tomato", "marigold");
    expect(e).toBeDefined();
    expect(e?.crop).toBe("tomato");
    expect(e?.companion).toBe("marigold");
    expect(e?.mechanism).toBe("pest_repellent");
  });

  it("returns both stored directions independently when both exist", () => {
    // tomato↔basil has both directions stored (with different mechanisms).
    const forward = getRelationship("tomato", "basil");
    const reverse = getRelationship("basil", "tomato");
    expect(forward?.mechanism).toBe("shade_provider");
    expect(reverse?.mechanism).toBe("pest_repellent");
  });

  it("returns undefined for crops with no known relationship", () => {
    // Two unrelated random crops.
    expect(getRelationship("tomato", "rhubarb")).toBeUndefined();
  });
});

describe("Three Sisters — all six directional edges discoverable", () => {
  it("pole-bean → sweet-corn is nitrogen_fixing (strong)", () => {
    const e = getRelationship("pole-bean", "sweet-corn");
    expect(e?.mechanism).toBe("nitrogen_fixing");
    expect(e?.strength).toBe("strong");
  });

  it("sweet-corn → pole-bean is structural_support", () => {
    const e = getRelationship("sweet-corn", "pole-bean");
    expect(e?.mechanism).toBe("structural_support");
  });

  it("winter-squash → sweet-corn is ground_cover", () => {
    const e = getRelationship("winter-squash", "sweet-corn");
    expect(e?.mechanism).toBe("ground_cover");
  });

  it("winter-squash → pole-bean is ground_cover", () => {
    const e = getRelationship("winter-squash", "pole-bean");
    expect(e?.mechanism).toBe("ground_cover");
  });

  it("sweet-corn → winter-squash is shade_provider", () => {
    const e = getRelationship("sweet-corn", "winter-squash");
    expect(e?.mechanism).toBe("shade_provider");
  });

  it("pole-bean → winter-squash is nitrogen_fixing", () => {
    const e = getRelationship("pole-bean", "winter-squash");
    expect(e?.mechanism).toBe("nitrogen_fixing");
  });
});

describe("getBestCompanions(slug, options)", () => {
  it("filters by minStrength=strong", () => {
    const strong = getBestCompanions("tomato", { minStrength: "strong" });
    expect(strong.every((e) => e.strength === "strong")).toBe(true);
    // Marigold → tomato (root-knot nematode) is the canonical strong entry.
    expect(strong.some((e) => e.companion === "marigold")).toBe(true);
  });

  it("filters by mechanism", () => {
    const pollinators = getBestCompanions("tomato", {
      mechanism: "pollinator_attractor",
    });
    expect(pollinators.every((e) => e.mechanism === "pollinator_attractor")).toBe(
      true,
    );
    expect(pollinators.length).toBeGreaterThan(0);
  });

  it("respects limit", () => {
    const top3 = getBestCompanions("tomato", { limit: 3 });
    expect(top3.length).toBeLessThanOrEqual(3);
  });

  it("sorts by strength descending", () => {
    const ranked = getBestCompanions("tomato", { minStrength: "moderate" });
    const ranks = { strong: 3, moderate: 2, weak: 1 } as const;
    for (let i = 1; i < ranked.length; i++) {
      expect(ranks[ranked[i - 1]!.strength]).toBeGreaterThanOrEqual(
        ranks[ranked[i]!.strength],
      );
    }
  });
});

describe("getAntagonists(slug)", () => {
  it("returns antagonist edges sorted strong-first", () => {
    const a = getAntagonists("tomato");
    expect(a.length).toBeGreaterThanOrEqual(3);
    // Strong-ranked ones (potato disease_vector, fennel allelopathic) come first.
    const ranks = { strong: 3, moderate: 2, weak: 1 } as const;
    for (let i = 1; i < a.length; i++) {
      expect(ranks[a[i - 1]!.strength]).toBeGreaterThanOrEqual(
        ranks[a[i]!.strength],
      );
    }
  });

  it("returns empty array when no antagonists are known", () => {
    // Basil has no stored antagonist edges in this fixture.
    expect(getAntagonists("basil")).toEqual([]);
  });
});

describe("findByMechanism", () => {
  it("nitrogen_fixing returns ≥10 entries — every entry has that mechanism", () => {
    const out = findByMechanism("nitrogen_fixing");
    expect(out.length).toBeGreaterThanOrEqual(10);
    expect(out.every((e) => e.mechanism === "nitrogen_fixing")).toBe(true);
  });

  it("trap_crop returns ≥5 entries", () => {
    const out = findByMechanism("trap_crop");
    expect(out.length).toBeGreaterThanOrEqual(5);
  });
});

describe("checkBedCompatibility", () => {
  it("flags fennel-herb as a hub antagonist in a mixed bed", () => {
    const r = checkBedCompatibility([
      "tomato",
      "basil",
      "fennel-herb",
      "bush-bean",
      "garlic",
    ]);
    expect(r.antagonist.length).toBeGreaterThanOrEqual(2);
    expect(r.warnings.some((w) => w.includes("fennel-herb"))).toBe(true);
  });

  it("returns clean reports for compatible beds with no warnings", () => {
    const r = checkBedCompatibility(["tomato", "basil", "marigold", "carrot"]);
    expect(r.antagonist).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.beneficial.length).toBeGreaterThan(0);
  });

  it("deduplicates pairs by canonical order", () => {
    // basil↔tomato has both stored directions; bed compatibility should not
    // double-count.
    const r = checkBedCompatibility(["tomato", "basil"]);
    // Storage has 2 entries (basil→tomato, tomato→basil); pairwise dedup
    // collapses to 1 in the report.
    expect(r.beneficial.length).toBe(1);
  });

  it("handles single-crop beds (no relationships possible)", () => {
    const r = checkBedCompatibility(["tomato"]);
    expect(r.beneficial).toEqual([]);
    expect(r.antagonist).toEqual([]);
  });
});
