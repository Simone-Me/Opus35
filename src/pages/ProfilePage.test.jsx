import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithShell } from "../test/renderWithShell";

const logService = vi.hoisted(() => ({
  getUserLogs: vi.fn(),
  setUserLogCategory: vi.fn(),
  removeUserLogCategory: vi.fn(),
}));

vi.mock("../services/logService", async (importOriginal) => ({
  ...(await importOriginal()),
  ...logService,
}));
vi.mock("../services/noteService", () => ({
  getProfileNotes: vi.fn().mockResolvedValue([]),
  insertProfileNote: vi.fn(),
  deleteProfileNote: vi.fn(),
}));

const { default: ProfilePage } = await import("./ProfilePage");

const LOG = {
  id: "l1",
  work_id: "w1",
  categories: ["heard"],
  details: { heard: { place: "Opera de Paris", vocals: [{ role: "Solo", name: "Kaufmann" }] } },
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-02T10:00:00Z",
  works: { id: "w1", title: "Tosca", composers: { name: "Puccini" } },
};

beforeEach(() => {
  logService.getUserLogs.mockReset().mockResolvedValue([LOG]);
  logService.setUserLogCategory.mockReset();
  logService.removeUserLogCategory.mockReset();
});

function renderProfile() {
  return renderWithShell(<ProfilePage />, {
    path: "/profile",
    context: { user: { id: "u1", email: "a@example.com" } },
  });
}

describe("ProfilePage", () => {
  it("shows readable labels and details", async () => {
    renderProfile();
    const row = (await screen.findByText("Tosca")).closest("tr");

    expect(within(row).getByText("Attended")).toBeInTheDocument();
    expect(within(row).getByText("Opera de Paris · Kaufmann")).toBeInTheDocument();
    expect(row).not.toHaveTextContent("[object Object]");
  });

  it("drops unsaved edits when the modal is cancelled and reopened", async () => {
    renderProfile();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const place = screen.getByPlaceholderText("Choose or type a place");
    await userEvent.clear(place);
    await userEvent.type(place, "Unsaved place");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByPlaceholderText("Choose or type a place")).toHaveValue("Opera de Paris");
  });

  it("updates the row from the RPC result without reloading all logs", async () => {
    logService.setUserLogCategory.mockResolvedValue({
      ...LOG,
      works: undefined,
      details: { heard: { place: "Wigmore Hall" } },
    });
    renderProfile();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const place = screen.getByPlaceholderText("Choose or type a place");
    await userEvent.clear(place);
    await userEvent.type(place, "Wigmore Hall");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Wigmore Hall")).toBeInTheDocument();
    expect(screen.getByText("Tosca")).toBeInTheDocument();
    expect(logService.getUserLogs).toHaveBeenCalledTimes(1);
  });

  it("removes a category row after delete", async () => {
    logService.removeUserLogCategory.mockResolvedValue(null);
    renderProfile();

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(logService.removeUserLogCategory).toHaveBeenCalledWith({ workId: "w1", category: "heard" });
    expect(await screen.findByText("No entries in this tab yet.")).toBeInTheDocument();
  });
});
