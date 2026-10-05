import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithShell } from "../test/renderWithShell";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  hasSupabaseCredentials: true,
  supabase: { auth },
}));

const { default: AuthPage } = await import("./AuthPage");

beforeEach(() => {
  Object.values(auth).forEach((fn) => fn.mockReset().mockResolvedValue({ error: null }));
});

describe("password reset", () => {
  it("sends the reset email with a redirect back to the recovery form", async () => {
    renderWithShell(<AuthPage />, { path: "/auth" });

    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.com", {
      redirectTo: `${window.location.origin}/auth?mode=recovery`,
    });
    expect(await screen.findByText(/Password reset email sent/)).toBeInTheDocument();
  });

  it("lets a user coming from the email link choose a new password", async () => {
    renderWithShell(<AuthPage />, {
      path: "/auth",
      route: "/auth?mode=recovery",
      context: { user: { id: "u1", email: "a@example.com" } },
    });

    await userEvent.type(screen.getByLabelText("New password"), "a-new-password!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "a-new-password!");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "a-new-password!" });
    expect(await screen.findByText(/Password updated/)).toBeInTheDocument();
  });

  it("enforces the password policy before calling Supabase", async () => {
    renderWithShell(<AuthPage />, {
      path: "/auth",
      route: "/auth?mode=recovery",
      context: { user: { id: "u1", email: "a@example.com" } },
    });

    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 12 characters/)).toBeInTheDocument();
  });

  it("explains an expired link when there is no recovery session", () => {
    renderWithShell(<AuthPage />, { path: "/auth", route: "/auth?mode=recovery" });
    expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
  });
});

describe("login", () => {
  it("submits once while a request is in flight", async () => {
    let resolveSignIn;
    auth.signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    renderWithShell(<AuthPage />, { path: "/auth" });

    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "whatever-password");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    const busyButton = screen.getByRole("button", { name: "Please wait..." });
    expect(busyButton).toBeDisabled();
    await userEvent.click(busyButton);
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);

    resolveSignIn({ error: null });
    expect(await screen.findByText("Signed in.")).toBeInTheDocument();
  });
});
