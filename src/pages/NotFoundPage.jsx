import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p className="text-muted">This route is not configured yet.</p>
      <p>
        <Link className="btn" to="/browse">
          Go to browse
        </Link>
      </p>
    </main>
  );
}

export default NotFoundPage;
