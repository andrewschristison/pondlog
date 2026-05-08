import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTidePredictions, splitHighLow } from "../src/noaa.js";
import type { TideEvent } from "../src/types.js";

describe("getTidePredictions input validation", () => {
  it("rejects non-numeric station ids", async () => {
    const r = await getTidePredictions({ stationId: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/expected 6.8 digits/);
  });

  it("rejects ill-formatted dates", async () => {
    const r = await getTidePredictions({
      stationId: "9444090",
      date: "2026/05/07",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/YYYY-MM-DD/);
  });
});

describe("getTidePredictions response handling", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a valid hi/lo response into TideEvent[]", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          predictions: [
            { t: "2026-05-07 02:30", v: "1.234", type: "L" },
            { t: "2026-05-07 09:00", v: "5.678", type: "H" },
            { t: "2026-05-07 15:30", v: "0.500", type: "L" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const r = await getTidePredictions({
      stationId: "9444090",
      date: "2026-05-07",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(3);
    expect(r.data[0]).toEqual({
      time: "2026-05-07T02:30",
      heightFt: 1.234,
      type: "low",
    });
    expect(r.data[1]?.type).toBe("high");
  });

  it("surfaces NOAA's 200-with-error envelope as Result.err", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { message: "No data was found." },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const r = await getTidePredictions({ stationId: "9444090" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe("No data was found.");
  });

  it("includes the User-Agent header", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ predictions: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await getTidePredictions({ stationId: "9444090" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["user-agent"]).toMatch(/^pondlog\//);
  });
});

describe("splitHighLow", () => {
  it("partitions events by type", () => {
    const events: TideEvent[] = [
      { time: "2026-05-07T02:30", heightFt: 1.2, type: "low" },
      { time: "2026-05-07T09:00", heightFt: 5.6, type: "high" },
      { time: "2026-05-07T15:30", heightFt: 0.5, type: "low" },
    ];
    const split = splitHighLow(events);
    expect(split.high).toHaveLength(1);
    expect(split.low).toHaveLength(2);
  });
});
