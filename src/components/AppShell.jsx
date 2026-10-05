import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { getContactEmail } from "../lib/contact";
import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const NAV_ITEMS = [
  { to: "/browse", label: "Composers" },
  { to: "/zibaldone", label: "Zibaldone" },
  { to: "/profile", label: "Profile" },
  { to: "/stats", label: "Discover" },
];

function AppShell() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLogoutArmed, setIsLogoutArmed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const contactEmail = getContactEmail();
  const logoutArmTimerRef = useRef(null);
  const copyNoticeTimerRef = useRef(null);
  const navigate = useNavigate();

  function showCopyNotice(message) {
    clearTimeout(copyNoticeTimerRef.current);
    setCopyNotice(message);
    copyNoticeTimerRef.current = setTimeout(() => setCopyNotice(""), 1800);
  }

  async function handleCopyContactEmail() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contactEmail);
      } else {
        const input = document.createElement("textarea");
        input.value = contactEmail;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      showCopyNotice("Email copied");
    } catch {
      showCopyNotice("Copy failed");
    }
  }

  function clearLogoutArmTimer() {
    if (logoutArmTimerRef.current) {
      clearTimeout(logoutArmTimerRef.current);
      logoutArmTimerRef.current = null;
    }
  }

  function resetLogoutArm() {
    clearLogoutArmTimer();
    setIsLogoutArmed(false);
  }

  function armLogout() {
    clearLogoutArmTimer();
    setIsLogoutArmed(true);
    logoutArmTimerRef.current = setTimeout(() => {
      setIsLogoutArmed(false);
      logoutArmTimerRef.current = null;
    }, 5000);
  }

  async function handleLogoutClick() {
    if (!hasSupabaseCredentials || !user) {
      return;
    }

    if (!isLogoutArmed) {
      armLogout();
      return;
    }

    setAuthError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      resetLogoutArm();
    } catch (logoutError) {
      resetLogoutArm();
      setAuthError(logoutError.message || "Unable to sign out right now.");
    }
  }

  useEffect(() => {
    if (!hasSupabaseCredentials) {
      setIsAuthLoading(false);
      return undefined;
    }

    // The session comes with the event (INITIAL_SESSION on subscribe), so no
    // extra network round trip per auth event.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setIsAuthLoading(false);
      setAuthError("");
      clearTimeout(logoutArmTimerRef.current);
      logoutArmTimerRef.current = null;
      setIsLogoutArmed(false);

      if (event === "PASSWORD_RECOVERY") {
        navigate("/auth?mode=recovery", { replace: true });
      }
    });

    return () => {
      clearTimeout(logoutArmTimerRef.current);
      clearTimeout(copyNoticeTimerRef.current);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">Opus35</div>
          <nav className="nav-links" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {isAuthLoading ? (
            <div className="user-chip">Checking session...</div>
          ) : user?.email ? (
            <div className="auth-quick-actions">
              <div className="user-chip">{user.email}</div>
              <button
                className={`btn btn-small ${isLogoutArmed ? "btn-logout-armed" : ""}`}
                onClick={handleLogoutClick}
                type="button"
              >
                {isLogoutArmed ? "Click again to logout" : "Logout"}
              </button>
            </div>
          ) : (
            <div className="auth-quick-actions">
              <Link className="btn btn-small" to="/auth?mode=login">
                Login
              </Link>
              <Link className="btn btn-small" to="/auth?mode=signup">
                Sign up
              </Link>
            </div>
          )}
        </div>

        {!hasSupabaseCredentials && (
          <div className="env-warning">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to activate
            auth and DB.
          </div>
        )}

        {authError && <div className="alert error">{authError}</div>}
      </header>

      <Suspense
        fallback={
          <main className="page" aria-busy="true">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
          </main>
        }
      >
        <Outlet context={{ user, isAuthLoading }} />
      </Suspense>

      <footer className="app-footer" aria-label="App and sources">
        <div className="footer-top-grid">
          <section
            id="footer-contact"
            className="footer-col"
            aria-label="Contact and suggestions"
          >
            <h3 className="footer-heading">Contact</h3>
            <p className="footer-contact-text">
              Contact us to suggest an artist, report a bug, ask for more
              information or make a donation:
            </p>
            <div className="footer-email-row">
              <span className="footer-email-value">{contactEmail}</span>
              <button
                type="button"
                className="footer-copy-btn"
                aria-label="Copy contact email"
                onClick={handleCopyContactEmail}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  width="14"
                  height="14"
                >
                  <path
                    d="M9 9h10v12H9zM5 3h10v4H7v10H5z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            {copyNotice && <p className="footer-copy-notice">{copyNotice}</p>}
          </section>

          <section className="footer-col" aria-label="Navigation">
            <h3 className="footer-heading">Navigation</h3>
            <ul className="footer-link-list">
              <li>
                <Link to="/browse">Composers</Link>
              </li>
              <li>
                <Link to="/zibaldone">Zibaldone</Link>
              </li>
              <li>
                <Link to="/profile">Profile</Link>
              </li>
              <li>
                <Link to="/stats">Discover</Link>
              </li>
            </ul>
          </section>

          <section className="footer-col" aria-label="Sources">
            <h3 className="footer-heading">Sources</h3>
            <ul className="footer-link-list">
              <li>
                <a
                  href="https://openopus.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenOpus API
                </a>
              </li>
              <li>
                <a
                  href="https://en.wikipedia.org/wiki/Main_Page"
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikipedia
                </a>
              </li>
            </ul>
          </section>

          <section className="footer-col" aria-label="About Opus35">
            <h3 className="footer-heading">About Opus35</h3>
            <p className="text-muted footer-text">
              Classical catalog and private listening journal.
            </p>
            <p className="text-muted footer-text">
              Source data may vary by provider and can be incomplete for some
              works.
            </p>
          </section>
        </div>

        <div className="footer-bottom-bar" aria-label="Footer utility links">
          <div className="footer-bottom-links">
            <Link to="/profile">My Profile</Link>
          </div>
          <p className="footer-copyright">
            © {new Date().getFullYear()} Opus35
          </p>
        </div>
      </footer>
    </div>
  );
}

export default AppShell;
