import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
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
  const logoutArmTimerRef = useRef(null);

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

    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setUser(data.user || null);
        setIsAuthLoading(false);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setAuthError("");
      resetLogoutArm();
      loadUser();
    });

    return () => {
      isMounted = false;
      clearLogoutArmTimer();
      subscription.unsubscribe();
    };
  }, []);

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

      <Outlet context={{ user, isAuthLoading }} />

      <footer className="app-footer" aria-label="App and sources">
        <p className="app-footer-title">
          Opus35, classical catalog and private listening journal.
        </p>
        <p className="text-muted">
          Source data may vary by provider and can be incomplete for some works.
        </p>
        <ul className="app-source-list">
          <li>
            Catalog API source:
            <a href="https://openopus.org/" target="_blank" rel="noreferrer">
              OpenOpus API
            </a>
          </li>
          <li>
            Biography enrichment source:
            <a
              href="https://en.wikipedia.org/wiki/Main_Page"
              target="_blank"
              rel="noreferrer"
            >
              Wikipedia
            </a>
          </li>
          <li>
            Backend/auth source:
            <a href="https://supabase.com/" target="_blank" rel="noreferrer">
              Supabase
            </a>
          </li>
        </ul>
      </footer>
    </div>
  );
}

export default AppShell;
