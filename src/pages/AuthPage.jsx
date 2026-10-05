import { useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  checkPasswordPolicy,
  getPasswordPolicyError,
  PASSWORD_MIN_LENGTH,
} from "../lib/password";
import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const EMAIL_RATE_LIMIT_PER_HOUR = 2;
const AUTH_MODES = ["login", "signup", "recovery"];

function getMode(searchParams) {
  const mode = searchParams.get("mode");
  return AUTH_MODES.includes(mode) ? mode : "login";
}

// Where the reset-password email sends the user back (must be listed in
// Supabase Auth > URL Configuration > Redirect URLs).
function getRecoveryRedirectUrl() {
  return `${window.location.origin}/auth?mode=recovery`;
}

function getRetryDelayMsFromMessage(message) {
  if (!message) {
    return null;
  }

  const retryAfterMatch = message.match(
    /retry[-\s]?after[:=\s]+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hour|hours)?/i,
  );

  if (retryAfterMatch) {
    const amount = Number(retryAfterMatch[1]);
    const unit = (retryAfterMatch[2] || "seconds").toLowerCase();

    if (Number.isFinite(amount) && amount > 0) {
      if (["h", "hr", "hour", "hours"].includes(unit)) {
        return amount * 60 * 60 * 1000;
      }

      if (["m", "min", "mins", "minute", "minutes"].includes(unit)) {
        return amount * 60 * 1000;
      }

      return amount * 1000;
    }
  }

  const afterMatch = message.match(
    /after\s+(\d+)\s*(seconds?|minutes?|hours?)/i,
  );

  if (!afterMatch) {
    return null;
  }

  const amount = Number(afterMatch[1]);
  const unit = afterMatch[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit.startsWith("hour")) {
    return amount * 60 * 60 * 1000;
  }

  if (unit.startsWith("minute")) {
    return amount * 60 * 1000;
  }

  return amount * 1000;
}

function isEmailRateLimitError(error) {
  const combined = [error?.message, error?.code, error?.name, error?.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    combined.includes("rate limit") ||
    combined.includes("too many requests") ||
    combined.includes("over_email_send_rate_limit") ||
    combined.includes("security purposes you can only request this after")
  );
}

function getEmailRateLimitMessage(actionLabel, error) {
  const retryDelayMs = getRetryDelayMsFromMessage(error?.message || "");
  const preciseTimeMessage = retryDelayMs
    ? ` Come back after ${new Date(
        Date.now() + retryDelayMs,
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}.`
    : " Please come back later.";

  return `Email could not be sent because the Supabase limit (${EMAIL_RATE_LIMIT_PER_HOUR}/hour) was reached while trying to ${actionLabel}.${preciseTimeMessage}`;
}

function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  withConfirmation,
  policy,
  passwordLabel = "Password",
  autoComplete,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <>
      <label className="form-field">
        <span>{passwordLabel}</span>
        <div className="password-input-row">
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete={autoComplete}
            required
          />
          <button
            className="btn btn-small"
            type="button"
            onClick={() => setShowPassword((previous) => !previous)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      {withConfirmation && (
        <>
          <label className="form-field">
            <span>Confirm password</span>
            <div className="password-input-row">
              <input
                className="input"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) =>
                  onConfirmPasswordChange(event.target.value)
                }
                autoComplete="new-password"
                required
              />
              <button
                className="btn btn-small"
                type="button"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="auth-requirements text-muted">
            <div>
              {policy.minLengthOk ? "✓" : "•"} Minimum {PASSWORD_MIN_LENGTH}{" "}
              characters
            </div>
            <div>
              {policy.specialCharacterOk ? "✓" : "•"} At least one special
              character
            </div>
            <div>{policy.confirmOk ? "✓" : "•"} Passwords match</div>
          </div>
        </>
      )}
    </>
  );
}

function AuthPage() {
  const { user, isAuthLoading } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = getMode(searchParams);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const passwordPolicy = useMemo(
    () => checkPasswordPolicy(password, confirmPassword),
    [password, confirmPassword],
  );

  function resetFeedback() {
    setError("");
    setMessage("");
  }

  function switchMode(nextMode) {
    resetFeedback();
    setPassword("");
    setConfirmPassword("");
    setSearchParams({ mode: nextMode });
  }

  // Runs an auth call with a single in-flight request and shared error display.
  async function submit(action) {
    if (isSubmitting) {
      return;
    }

    resetFeedback();
    setIsSubmitting(true);

    try {
      await action();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignIn(event) {
    event.preventDefault();

    return submit(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setPassword("");
      setMessage("Signed in.");
    });
  }

  function handleSignUp(event) {
    event.preventDefault();
    const policyError = getPasswordPolicyError(passwordPolicy);

    if (policyError) {
      resetFeedback();
      setError(policyError);
      return undefined;
    }

    return submit(async () => {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(
          isEmailRateLimitError(signUpError)
            ? getEmailRateLimitMessage("send the confirmation email", signUpError)
            : signUpError.message,
        );
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Sign-up submitted. Check your email for confirmation.");
    });
  }

  function handleResetPassword() {
    return submit(async () => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: getRecoveryRedirectUrl() },
      );

      if (resetError) {
        setError(
          isEmailRateLimitError(resetError)
            ? getEmailRateLimitMessage("send the reset password email", resetError)
            : resetError.message,
        );
        return;
      }

      setMessage(
        "Password reset email sent. Open the link in this browser to choose a new password.",
      );
    });
  }

  function handleUpdatePassword(event) {
    event.preventDefault();
    const policyError = getPasswordPolicyError(passwordPolicy);

    if (policyError) {
      resetFeedback();
      setError(policyError);
      return undefined;
    }

    return submit(async () => {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSearchParams({});
      setMessage("Password updated. You are signed in.");
    });
  }

  function handleSignOut() {
    return submit(async () => {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
        return;
      }

      setMessage("Signed out.");
    });
  }

  function renderRecovery() {
    if (isAuthLoading) {
      return <p className="text-muted">Checking your reset link...</p>;
    }

    if (!user) {
      return (
        <div className="alert">
          This password reset link is invalid or has expired. Request a new
          one from the login form.
          <div style={{ marginTop: "0.6rem" }}>
            <button
              className="btn"
              type="button"
              onClick={() => switchMode("login")}
            >
              Back to login
            </button>
          </div>
        </div>
      );
    }

    return (
      <form className="form-grid auth-form" onSubmit={handleUpdatePassword}>
        <p className="text-muted">Choose a new password for {user.email}.</p>
        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          withConfirmation
          policy={passwordPolicy}
          passwordLabel="New password"
          autoComplete="new-password"
        />
        <div className="table-actions auth-actions">
          <button
            className="btn"
            type="submit"
            disabled={!hasSupabaseCredentials || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Update password"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <main className="page">
      <h1>Auth</h1>
      <p className="text-muted">Email auth via Supabase.</p>

      {!hasSupabaseCredentials && (
        <div className="alert">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env before using
          auth.
        </div>
      )}

      {mode === "recovery" ? (
        renderRecovery()
      ) : user ? (
        <div className="alert">
          Signed in as {user.email}
          <div style={{ marginTop: "0.6rem" }}>
            <button
              className="btn"
              type="button"
              onClick={handleSignOut}
              disabled={isSubmitting}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-mode-row" role="tablist">
            <button
              className={`tab-btn ${mode === "login" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              className={`tab-btn ${mode === "signup" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form
            className="form-grid auth-form"
            onSubmit={mode === "login" ? handleSignIn : handleSignUp}
          >
            <label className="form-field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <PasswordFields
              key={mode}
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              withConfirmation={mode === "signup"}
              policy={passwordPolicy}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />

            <div className="table-actions auth-actions">
              <button
                className="btn"
                type="submit"
                disabled={!hasSupabaseCredentials || isSubmitting}
              >
                {isSubmitting
                  ? "Please wait..."
                  : mode === "login"
                    ? "Login"
                    : "Sign up"}
              </button>

              {mode === "login" && (
                <button
                  className="btn"
                  type="button"
                  onClick={handleResetPassword}
                  disabled={!hasSupabaseCredentials || !email || isSubmitting}
                >
                  Reset password
                </button>
              )}
            </div>
          </form>
        </>
      )}

      {message && <div className="alert">{message}</div>}
      {error && <div className="alert error">{error}</div>}
    </main>
  );
}

export default AuthPage;
