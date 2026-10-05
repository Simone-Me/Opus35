import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryRecorder } from "../test/supabaseMock";

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  functions: { invoke: vi.fn() },
}));

vi.mock("../lib/supabaseClient", () => ({
  hasSupabaseCredentials: true,
  supabase: supabaseMock,
}));

const {
  applyLogChange,
  getUserLogsForComposer,
  removeUserLogCategory,
  setUserLogCategory,
  toggleUserLogCategory,
} = await import("./logService");
const { enrichComposerFromWikipedia, getWorksPage } = await import("./catalogService");
const { generateDailyRecommendation } = await import("./recommendationService");

beforeEach(() => {
  supabaseMock.rpc.mockReset();
  supabaseMock.from.mockReset();
  supabaseMock.functions.invoke.mockReset();
});

describe("logService RPCs", () => {
  it("toggles through a single atomic RPC", async () => {
    const row = { id: "l1", work_id: "w1", categories: ["favorite"] };
    supabaseMock.rpc.mockResolvedValue({ data: [row], error: null });

    await expect(toggleUserLogCategory({ workId: "w1", category: "favorite" })).resolves.toEqual(row);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("toggle_user_log_category", {
      p_work_id: "w1",
      p_category: "favorite",
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("passes details to set_user_log_category", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: [{ id: "l1" }], error: null });

    await setUserLogCategory({ workId: "w1", category: "heard", details: { place: "X" } });

    expect(supabaseMock.rpc).toHaveBeenCalledWith("set_user_log_category", {
      p_work_id: "w1",
      p_category: "heard",
      p_details: { place: "X" },
    });
  });

  it("returns null when the row was deleted and throws RPC errors", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(removeUserLogCategory({ workId: "w1", category: "alert" })).resolves.toBeNull();

    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    await expect(removeUserLogCategory({ workId: "w1", category: "alert" })).rejects.toThrow(
      "denied",
    );
  });

  it("loads only the logs of one composer", async () => {
    const { builder, calls } = createQueryRecorder({ data: [], error: null });
    supabaseMock.from.mockReturnValue(builder);

    await getUserLogsForComposer("u1", "c1");

    expect(supabaseMock.from).toHaveBeenCalledWith("user_logs");
    expect(calls).toContainEqual(["eq", "works.composer_id", "c1"]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls.find(([method]) => method === "select")[1]).toContain("works!inner");
  });
});

describe("applyLogChange", () => {
  const logs = [
    { work_id: "w1", categories: ["heard"], works: { title: "Mass" } },
    { work_id: "w2", categories: ["alert"] },
  ];

  it("merges updated rows and keeps joined data", () => {
    const next = applyLogChange(logs, "w1", { work_id: "w1", categories: ["heard", "favorite"] });
    expect(next[0]).toEqual({ work_id: "w1", categories: ["heard", "favorite"], works: { title: "Mass" } });
    expect(logs[0].categories).toEqual(["heard"]);
  });

  it("removes deleted rows and prepends new ones", () => {
    expect(applyLogChange(logs, "w2", null).map((log) => log.work_id)).toEqual(["w1"]);
    expect(applyLogChange(logs, "w3", { work_id: "w3" })[0].work_id).toBe("w3");
  });
});

describe("catalogService", () => {
  it("builds a server-side filtered, sorted and paginated query", async () => {
    const { builder, calls } = createQueryRecorder({ data: [{ id: "w1" }], error: null, count: 42 });
    supabaseMock.from.mockReturnValue(builder);

    const result = await getWorksPage({
      query: " mass ",
      epoch: "Baroque",
      genre: "Vocal",
      sortBy: "composer",
      sortDirection: "desc",
      page: 3,
      pageSize: 25,
    });

    expect(result).toEqual({ rows: [{ id: "w1" }], count: 42 });
    expect(supabaseMock.from).toHaveBeenCalledWith("works_index");
    expect(calls).toContainEqual(["or", 'title.ilike."%mass%",composer_name.ilike."%mass%"']);
    expect(calls).toContainEqual(["eq", "composer_epoch", "Baroque"]);
    expect(calls).toContainEqual(["eq", "genre", "Vocal"]);
    expect(calls).toContainEqual(["order", "composer_name", { ascending: false, nullsFirst: false }]);
    expect(calls).toContainEqual(["range", 50, 74]);
  });

  it("skips filters that are not set and ignores unknown sort keys", async () => {
    const { builder, calls } = createQueryRecorder({ data: [], error: null, count: 0 });
    supabaseMock.from.mockReturnValue(builder);

    await getWorksPage({ sortBy: "id; drop table" });

    expect(calls.some(([method]) => method === "or" || method === "eq")).toBe(false);
    expect(calls).toContainEqual(["order", "title", { ascending: true, nullsFirst: false }]);
    expect(calls).toContainEqual(["range", 0, 9]);
  });

  it("returns the composer sent back by the enrichment function", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { composer: { id: "c1", bio: "Bio" }, enriched: true },
      error: null,
    });

    await expect(enrichComposerFromWikipedia("c1")).resolves.toEqual({ id: "c1", bio: "Bio" });
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith("wikipedia-enrichment", {
      body: { composerId: "c1" },
    });
  });
});

describe("recommendationService", () => {
  it("lets the database pick the work for the local day", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: "w9", error: null });
    const { builder, calls } = createQueryRecorder({
      data: { work_id: "w9", works: { id: "w9", title: "Op. 1", composers: [{ name: "Bach" }] } },
      error: null,
    });
    supabaseMock.from.mockReturnValue(builder);

    const recommendation = await generateDailyRecommendation({ userId: "u1", dayKey: "2026-10-05" });

    expect(supabaseMock.rpc).toHaveBeenCalledWith("generate_daily_recommendation", {
      p_day: "2026-10-05",
    });
    expect(calls).toContainEqual(["eq", "recommendation_date", "2026-10-05"]);
    expect(recommendation.work.composer).toEqual({ name: "Bach" });
  });
});
