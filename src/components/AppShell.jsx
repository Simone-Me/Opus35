import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const NAV_ITEMS = [
  { to: "/browse", label: "Browse" },
  { to: "/zibaldone", label: "Zibaldone" },
  { to: "/profile", label: "Profile" },
  { to: "/stats", label: "Charts & stats" },
  { to: "/auth", label: "Auth" },
];

function AppShell() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
      loadUser();
    });

    return () => {
      isMounted = false;
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
            <div className="user-chip">{user.email}</div>
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
      </header>

      <Outlet context={{ user, isAuthLoading }} />
    </div>
  );
}

export default AppShell;
