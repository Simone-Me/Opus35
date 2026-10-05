import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CategoryModal from "./CategoryModal";

function renderModal(props = {}) {
  const handlers = { onClose: vi.fn(), onSave: vi.fn(), onRemove: vi.fn() };
  render(
    <CategoryModal
      category="heard"
      workTitle="Mass in B minor"
      initialValues={{ place: "Opera de Paris", comment: "Great" }}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("CategoryModal", () => {
  it("is an accessible dialog prefilled with the initial values", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "Attended details" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Choose or type a place")).toHaveValue("Opera de Paris");
    expect(screen.getByPlaceholderText("Any note about this performance")).toHaveValue("Great");
  });

  it("closes with Escape", async () => {
    const { onClose } = renderModal();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("saves edited values with serialized vocal lines", async () => {
    const { onSave } = renderModal({ initialValues: {} });

    await userEvent.type(screen.getByPlaceholderText("Choose or type a place"), "Wigmore Hall");
    await userEvent.click(screen.getByRole("button", { name: "Add choir line" }));
    await userEvent.type(
      screen.getByPlaceholderText("Name(s) of singer, soloist, or choir"),
      "Accentus",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      place: "Wigmore Hall",
      vocals: [{ role: "Choir", name: "Accentus" }],
    });
  });

  it("disables actions while saving and hides remove when not allowed", () => {
    renderModal({ isSaving: true });

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove category" })).not.toBeInTheDocument();
  });

  it("renders the record form", () => {
    renderModal({ category: "bought", initialValues: { conductor: "Rattle" } });

    expect(screen.getByRole("dialog", { name: "Record details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Director")).toHaveValue("Rattle");
  });
});
