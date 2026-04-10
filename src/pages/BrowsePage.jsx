import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getComposerCatalog } from "../services/catalogService";

function LoadingCatalog() {
  return (
    <div className="composer-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <article className="composer-card" key={index}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </article>
      ))}
    </div>
  );
}

function BrowsePage() {
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState("");
  const [epochFilter, setEpochFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCatalog() {
      try {
        setError("");
        setIsLoading(true);
        const data = await getComposerCatalog();
        setCatalog(data);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadCatalog();
  }, []);

  const availableEpochs = useMemo(() => {
    const values = new Set();

    catalog.forEach((composer) => {
      if (composer.epoch) {
        values.add(composer.epoch);
      }
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalog.filter((composer) => {
      const matchesEpoch =
        epochFilter === "all" || composer.epoch === epochFilter;
      const matchesSearch =
        !normalizedQuery ||
        (composer.name || "").toLowerCase().includes(normalizedQuery);

      return matchesEpoch && matchesSearch;
    });
  }, [catalog, query, epochFilter]);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Composers</h1>
          <p className="text-muted">
            Lightweight home view. Open each composer to see full opus details.
          </p>
        </div>
        <label className="search-wrap">
          <input
            className="input"
            type="search"
            placeholder="Search composer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="filter-chip-row">
        <span className="text-muted">Epoch</span>
        <button
          className={`chip ${epochFilter === "all" ? "active" : ""}`}
          onClick={() => setEpochFilter("all")}
        >
          All
        </button>
        {availableEpochs.map((epoch) => (
          <button
            key={epoch}
            className={`chip ${epochFilter === epoch ? "active" : ""}`}
            onClick={() => setEpochFilter(epoch)}
          >
            {epoch}
          </button>
        ))}
      </div>

      <p className="text-muted">{filteredCatalog.length} composers found.</p>

      {isLoading ? (
        <LoadingCatalog />
      ) : (
        <section className="composer-grid">
          {filteredCatalog.map((composer) => (
            <article
              className="composer-card composer-card-row"
              key={composer.id}
            >
              <div className="composer-card-main">
                <h2 className="composer-title">{composer.name}</h2>
                <p className="composer-meta">
                  {composer.epoch || "Unknown period"}
                </p>
              </div>

              <div className="composer-card-actions">
                <Link
                  aria-label={`Open ${composer.name} page`}
                  className="btn"
                  to={`/composer/${composer.id}`}
                >
                  <IconStreamlineUltimateArrowThickRightBottomCorner3
                    aria-hidden="true"
                    height="18"
                    width="18"
                  />
                </Link>
              </div>
            </article>
          ))}

          {filteredCatalog.length === 0 && (
            <p className="text-muted">
              No composers match the current filters.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

export default BrowsePage;
