import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";

// Each page is its own chunk: Recharts, for example, only loads on /stats.
const AuthPage = lazy(() => import("./pages/AuthPage"));
const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const ComposerPage = lazy(() => import("./pages/ComposerPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const ZibaldonePage = lazy(() => import("./pages/ZibaldonePage"));

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/browse" replace />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="zibaldone" element={<ZibaldonePage />} />
        <Route path="composer/:composerId" element={<ComposerPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
