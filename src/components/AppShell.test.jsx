import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const listeners = vi.hoisted(() => []);

vi.mock("../lib/supabaseClient", () => ({
  hasSupabaseCredentials: true,
  supabase: {
    auth: {
      onAuthStateChange: (callback) => {
        listeners.push(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(),
    },
  },
}));

const { default: AppShell } = await import("./AppShell");

function Location() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

describe("AppShell", () => {
  it("uses the session from auth events and routes password recovery", async () => {
    render(
      <MemoryRouter initialEntries={["/browse"]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="*" element={<Location />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Checking session...")).toBeInTheDocument();

    act(() => listeners.at(-1)("INITIAL_SESSION", null));
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();

    act(() => listeners.at(-1)("PASSWORD_RECOVERY", { user: { id: "u1", email: "a@example.com" } }));

    expect(await screen.findByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/auth?mode=recovery");
  });
});
