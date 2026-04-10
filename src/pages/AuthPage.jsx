import { useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const PASSWORD_MIN_LENGTH = 12;
const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/;
const EMAIL_RATE_LIMIT_PER_HOUR = 2;

function getInitialMode(searchParams) {
  const mode = searchParams.get("mode");
  return mode === "signup" ? "signup" : "login";
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

function AuthPage() {
  const { user } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [mode, setMode] = useState(() => getInitialMode(searchParams));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const passwordPolicy = useMemo(
    () => ({
      minLengthOk: password.length >= PASSWORD_MIN_LENGTH,
      specialCharacterOk: SPECIAL_CHARACTER_REGEX.test(password),
      confirmOk: password === confirmPassword && confirmPassword.length > 0,
    }),
    [password, confirmPassword],
  );

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSearchParams({ mode: nextMode });
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Signed in.");
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!passwordPolicy.minLengthOk) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (!passwordPolicy.specialCharacterOk) {
      setError("Password must contain at least one special character.");
      return;
    }

    if (!passwordPolicy.confirmOk) {
      setError("Passwords do not match.");
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      if (isEmailRateLimitError(signUpError)) {
        setError(
          getEmailRateLimitMessage("send the confirmation email", signUpError),
        );
        return;
      }

      setError(signUpError.message);
      return;
    }

    setMessage("Sign-up submitted. Check your email for confirmation.");
  }

  async function handleResetPassword() {
    setError("");
    setMessage("");

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email);

    if (resetError) {
      if (isEmailRateLimitError(resetError)) {
        setError(
          getEmailRateLimitMessage("send the reset password email", resetError),
        );
        return;
      }

      setError(resetError.message);
      return;
    }

    setMessage("Password reset email sent.");
  }

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setMessage("Signed out.");
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

      {user ? (
        <div className="alert">
          Signed in as {user.email}
          <div style={{ marginTop: "0.6rem" }}>
            <button className="btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-mode-row">
            <button
              className={`tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              className={`tab-btn ${mode === "signup" ? "active" : ""}`}
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
                required
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <div className="password-input-row">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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

            {mode === "signup" && (
              <>
                <label className="form-field">
                  <span>Confirm password</span>
                  <div className="password-input-row">
                    <input
                      className="input"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
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
                    {passwordPolicy.minLengthOk ? "✓" : "•"} Minimum 12
                    characters
                  </div>
                  <div>
                    {passwordPolicy.specialCharacterOk ? "✓" : "•"} At least one
                    special character
                  </div>
                  <div>
                    {passwordPolicy.confirmOk ? "✓" : "•"} Passwords match
                  </div>
                </div>
              </>
            )}

            <div className="table-actions auth-actions">
              <button
                className="btn"
                type="submit"
                disabled={!hasSupabaseCredentials}
              >
                {mode === "login" ? "Login" : "Sign up"}
              </button>

              {mode === "login" && (
                <button
                  className="btn"
                  type="button"
                  onClick={handleResetPassword}
                  disabled={!hasSupabaseCredentials || !email}
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
