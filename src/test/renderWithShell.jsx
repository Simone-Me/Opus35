import { render } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

// Renders a page under a route that provides the AppShell outlet context.
export function renderWithShell(element, { path = "/", route = path, context = {} } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<Outlet context={{ user: null, isAuthLoading: false, ...context }} />}>
          <Route path={path} element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
