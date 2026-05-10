import { describe, expect, it } from "vitest";
import { getPlantingPlan } from "../src/crop-calendar.js";
import { getHardinessZone } from "../src/usda-zones.js";
import type { ZoneInfo } from "../src/types.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

function findSuggestion(plan: ReturnType<typeof getPlantingPlan>, slug: string) {
  if (!plan.ok) throw new Error(`getPlantingPlan failed: ${plan.error.message}`);
  return plan.data.plantNow.find((s) => s.slug === slug);
}

function zone(): ZoneInfo {
  const r = getHardinessZone(PORT_ANGELES);
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}

describe("climate modifiers — getPlantingPlan", () => {
  // Port Angeles is zone 8b → last spring frost ~03-15.
  // Base tomato start_indoors window is fromFrostDays -56..-28
  //   → 2026-01-18 .. 2026-02-15 (8 wks before to 4 wks before)
  // Maritime tomato modifier: start_indoors -2 (shift 2 wks earlier)
  //   → 2026-01-04 .. 2026-02-01
  const FEB_FIRST = "2026-02-01";

  it("base call (no climateType) leaves windows unchanged — back-compat", () => {
    const plan = getPlantingPlan({
      zone: zone(),
      date: FEB_FIRST,
      limit: 200,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const tomato = plan.data.plantNow.find((s) => s.slug === "tomato");
    expect(tomato).toBeDefined();
    expect(tomato?.action).toBe("start_indoors");
    expect(tomato?.windowStart).toBe("2026-01-18");
    expect(tomato?.windowEnd).toBe("2026-02-15");
    expect(plan.data.climateType).toBeUndefined();
  });

  it("maritime climate shifts tomato start_indoors 14 days earlier", () => {
    const plan = getPlantingPlan({
      zone: zone(),
      date: FEB_FIRST,
      limit: 200,
      climateType: "maritime",
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const tomato = plan.data.plantNow.find((s) => s.slug === "tomato");
    expect(tomato).toBeDefined();
    expect(tomato?.action).toBe("start_indoors");
    expect(tomato?.windowStart).toBe("2026-01-04");
    expect(tomato?.windowEnd).toBe("2026-02-01");
    expect(plan.data.climateType).toBe("maritime");
  });

  it("maritime modifier appends climate-specific notes to the suggestion", () => {
    const plan = getPlantingPlan({
      zone: zone(),
      date: FEB_FIRST,
      limit: 200,
      climateType: "maritime",
    });
    if (!plan.ok) throw new Error(plan.error.message);
    const tomato = plan.data.plantNow.find((s) => s.slug === "tomato");
    expect(tomato?.notes).toBeDefined();
    expect(tomato?.notes).toMatch(/short-season determinates/);
    expect(tomato?.notes).toMatch(/blight/i);
  });

  it("arid modifier surfaces shade-cloth advice for tomato", () => {
    // Pick a date when tomato's start_indoors window is active in zone 8b.
    // For arid, base window is -56..-28; arid shifts +1 wk → -49..-21
    //   → 2026-01-25 .. 2026-02-22 in zone 8b.
    const plan = getPlantingPlan({
      zone: zone(),
      date: "2026-02-10",
      limit: 200,
      climateType: "arid",
    });
    if (!plan.ok) throw new Error(plan.error.message);
    const tomato = plan.data.plantNow.find((s) => s.slug === "tomato");
    expect(tomato).toBeDefined();
    expect(tomato?.windowStart).toBe("2026-01-25");
    expect(tomato?.notes).toMatch(/shade cloth/i);
  });

  it("crops without a modifier for a climate fall through to base values", () => {
    // Pick any cool-season crop without modifiers — e.g. carrot.
    const baseRes = getPlantingPlan({ zone: zone(), date: "2026-04-01", limit: 500 });
    const climRes = getPlantingPlan({
      zone: zone(),
      date: "2026-04-01",
      limit: 500,
      climateType: "continental",
    });
    if (!baseRes.ok || !climRes.ok) throw new Error("plan failed");
    const base = baseRes.data.plantNow.find((s) => s.slug === "carrot");
    const clim = climRes.data.plantNow.find((s) => s.slug === "carrot");
    if (base && clim) {
      expect(clim.windowStart).toBe(base.windowStart);
      expect(clim.windowEnd).toBe(base.windowEnd);
    }
  });
});
