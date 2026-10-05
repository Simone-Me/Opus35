import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithShell } from "../test/renderWithShell";

const logService = vi.hoisted(() => ({
  getUserLogsForComposer: vi.fn(),
  getUserPlaceLogs: vi.fn(),
  toggleUserLogCategory: vi.fn(),
  setUserLogCategory: vi.fn(),
  removeUserLogCategory: vi.fn(),
}));
const catalogService = vi.hoisted(() => ({
  getComposerById: vi.fn(),
  getWorksByComposerId: vi.fn(),
  enrichComposerFromWikipedia: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({ hasSupabaseCredentials: true, supabase: {} }));
vi.mock("../services/logService", async (importOriginal) => ({
  ...(await importOriginal()),
  ...logService,
}));
vi.mock("../services/catalogService", () => catalogService);
vi.mock("../services/composerNoteService", () => ({
  getComposerNote: vi.fn().mockResolvedValue(null),
  upsertComposerNote: vi.fn(),
  deleteComposerNote: vi.fn(),
}));

const { default: ComposerPage } = await import("./ComposerPage");

beforeEach(() => {
  catalogService.getComposerById.mockReset().mockResolvedValue({
    id: "c1",
    name: "Bach",
    complete_name: "Johann Sebastian Bach",
    epoch: "Baroque",
    bio: "",
  });
  catalogService.getWorksByComposerId
    .mockReset()
    .mockResolvedValue([{ id: "w1", title: "Mass in B minor", genre: "Vocal" }]);
  catalogService.enrichComposerFromWikipedia
    .mockReset()
    .mockResolvedValue({ id: "c1", bio: "A German composer." });
  logService.getUserLogsForComposer.mockReset().mockResolvedValue([]);
  logService.getUserPlaceLogs.mockReset().mockResolvedValue([]);
  logService.toggleUserLogCategory.mockReset();
});

function renderComposer() {
  return renderWithShell(<ComposerPage />, {
    path: "/composer/:composerId",
    route: "/composer/c1",
    context: { user: { id: "u1", email: "a@example.com" } },
  });
}

describe("ComposerPage", () => {
  it("loads only this composer's logs and shows the enriched bio", async () => {
    renderComposer();

    expect(await screen.findByText("A German composer.")).toBeInTheDocument();
    expect(logService.getUserLogsForComposer).toHaveBeenCalledWith("u1", "c1");
    expect(catalogService.enrichComposerFromWikipedia).toHaveBeenCalledTimes(1);
    expect(catalogService.getComposerById).toHaveBeenCalledTimes(1);
  });

  it("toggles a flag once even on a double click, then shows it", async () => {
    let resolveToggle;
    logService.toggleUserLogCategory.mockReturnValue(
      new Promise((resolve) => {
        resolveToggle = resolve;
      }),
    );
    renderComposer();

    await userEvent.click(
      await screen.findByRole("button", { name: "Toggle category controls for Mass in B minor" }),
    );
    const favorite = screen.getByRole("button", { name: /^Favorite\./ });
    await userEvent.click(favorite);
    await userEvent.click(favorite);

    expect(logService.toggleUserLogCategory).toHaveBeenCalledTimes(1);
    expect(logService.toggleUserLogCategory).toHaveBeenCalledWith({ workId: "w1", category: "favorite" });
    expect(favorite).toBeDisabled();

    resolveToggle({ id: "l1", work_id: "w1", categories: ["favorite"], details: {} });

    const item = screen.getByText("Mass in B minor").closest("li");
    expect(await within(item).findByText("Favorite", { selector: ".active-category-pill" })).toBeInTheDocument();
    expect(favorite).toHaveAttribute("aria-pressed", "true");
  });
});
