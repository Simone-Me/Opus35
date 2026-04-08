import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AuthPage from "./pages/AuthPage";
import BrowsePage from "./pages/BrowsePage";
import ComposerPage from "./pages/ComposerPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import StatsPage from "./pages/StatsPage";
import ZibaldonePage from "./pages/ZibaldonePage";

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
