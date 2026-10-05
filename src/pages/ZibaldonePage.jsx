import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import IconStreamlineUltimateInformationCircleBold from "~icons/streamline-ultimate/information-circle-bold";
import Pagination from "../components/Pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { hasSupabaseCredentials } from "../lib/supabaseClient";
import {
  getWorkFilterOptions,
  getWorksPage,
  WORK_SORT_COLUMNS,
} from "../services/catalogService";
import {
  generateDailyRecommendation,
  getDailyRecommendation,
} from "../services/recommendationService";

const SORTABLE_COLUMNS = Object.fromEntries(
  Object.keys(WORK_SORT_COLUMNS).map((key) => [key, key]),
);

function ZibaldonePage() {
  const { user } = useOutletContext();
  const [result, setResult] = useState({ rows: [], count: 0 });
  const [filterOptions, setFilterOptions] = useState({ epochs: [], genres: [] });
  const [query, setQuery] = useState("");
  const [epochFilter, setEpochFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(SORTABLE_COLUMNS.title);
  const [sortDirection, setSortDirection] = useState("asc");
  const [isLoading, setIsLoading] = useState(hasSupabaseCredentials);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] =
    useState(false);
  const [dailyRecommendation, setDailyRecommendation] = useState(null);
  const [error, setError] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    let ignore = false;

    getWorkFilterOptions()
      .then((options) => {
        if (!ignore) {
          setFilterOptions(options);
        }
      })
      .catch((loadError) => {
        if (!ignore) {
          setError(loadError.message);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseCredentials) {
      return undefined;
    }

    let ignore = false;

    async function loadPage() {
      setIsLoading(true);

      try {
        const data = await getWorksPage({
          query: debouncedQuery,
          epoch: epochFilter,
          genre: genreFilter,
          sortBy,
          sortDirection,
          page,
          pageSize,
        });

        if (!ignore) {
          setResult(data);
          setError("");
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      ignore = true;
    };
  }, [debouncedQuery, epochFilter, genreFilter, sortBy, sortDirection, page, pageSize]);

  useEffect(() => {
    let ignore = false;

    async function loadDailyRecommendation() {
      if (!user?.id) {
        setDailyRecommendation(null);
        return;
      }

      setIsRecommendationLoading(true);

      try {
        const recommendation = await getDailyRecommendation({
          userId: user.id,
        });

        if (!ignore) {
          setDailyRecommendation(recommendation);
        }
      } catch (recommendationError) {
        if (!ignore) {
          setError(recommendationError.message);
        }
      } finally {
        if (!ignore) {
          setIsRecommendationLoading(false);
        }
      }
    }

    loadDailyRecommendation();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  async function handleGenerateRecommendation() {
    if (!user?.id) {
      setError("Sign in to generate your daily recommendation.");
      return;
    }

    setError("");
    setIsGeneratingRecommendation(true);

    try {
      const recommendation = await generateDailyRecommendation({
        userId: user.id,
      });

      setDailyRecommendation(recommendation);
    } catch (generationError) {
      setError(generationError.message);
    } finally {
      setIsGeneratingRecommendation(false);
    }
  }

  // Every filter change goes back to the first page.
  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  const totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedWorks = result.rows;

  function toggleSort(columnKey) {
    setPage(1);

    if (sortBy === columnKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(columnKey);
    setSortDirection("asc");
  }

  function sortLabel(columnKey, label) {
    if (sortBy !== columnKey) {
      return label;
    }

    return `${label} ${sortDirection === "asc" ? "↑" : "↓"}`;
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Zibaldone</h1>
          <p className="text-muted">
            Flat index of all pieces with sorting, filters, and pagination.
          </p>
        </div>

        <div className="recommendation-actions">
          <button
            className="btn"
            type="button"
            onClick={handleGenerateRecommendation}
            disabled={isGeneratingRecommendation || !user}
          >
            {isGeneratingRecommendation
              ? "Generating..."
              : "Random recommendation"}
          </button>
          <span
            className="recommendation-info-icon"
            title="It can be generated only once per day. The same recommendation is shown until midnight (your local time)."
            aria-label="Daily recommendation info"
          >
            <IconStreamlineUltimateInformationCircleBold
              aria-hidden="true"
              height="18"
              width="18"
            />
          </span>
        </div>
      </div>

      {isRecommendationLoading ? (
        <p className="text-muted">Loading your daily recommendation...</p>
      ) : dailyRecommendation?.work ? (
        <section className="daily-recommendation-card">
          <h2>Today&apos;s recommendation</h2>
          <p>
            <strong>{dailyRecommendation.work.title}</strong>
            {" · "}
            {dailyRecommendation.work.composer?.complete_name ||
              dailyRecommendation.work.composer?.name ||
              "Unknown composer"}
          </p>
          <p className="text-muted">
            Date: {dailyRecommendation.work.publication_year || "TBD"}
          </p>
        </section>
      ) : (
        <p className="text-muted">No recommendation generated today yet.</p>
      )}

      <div className="zibaldone-toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search by opus title or composer"
          value={query}
          onChange={(event) => updateFilter(setQuery)(event.target.value)}
        />

        <select
          className="select"
          value={epochFilter}
          onChange={(event) => updateFilter(setEpochFilter)(event.target.value)}
        >
          <option value="all">All epochs</option>
          {filterOptions.epochs.map((epoch) => (
            <option key={epoch} value={epoch}>
              {epoch}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={genreFilter}
          onChange={(event) => updateFilter(setGenreFilter)(event.target.value)}
        >
          <option value="all">All genres</option>
          {filterOptions.genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={pageSize}
          onChange={(event) =>
            updateFilter(setPageSize)(Number(event.target.value))
          }
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      {error && <div className="alert error">{error}</div>}

      {isLoading ? (
        <div className="table-skeleton">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </div>
      ) : (
        <>
          <p className="text-muted">{result.count} works found.</p>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button
                    className="table-sort-btn"
                    type="button"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.title)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.title, "Opus")}
                  </button>
                </th>
                <th>
                  <button
                    className="table-sort-btn"
                    type="button"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.composer)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.composer, "Composer")}
                  </button>
                </th>
                <th>
                  <button
                    className="table-sort-btn"
                    type="button"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.epoch)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.epoch, "Epoch")}
                  </button>
                </th>
                <th>
                  <button
                    className="table-sort-btn"
                    type="button"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.genre)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.genre, "Genre")}
                  </button>
                </th>
                <th>Composer page</th>
              </tr>
            </thead>
            <tbody>
              {pagedWorks.map((work) => (
                <tr key={work.id}>
                  <td>{work.title}</td>
                  <td>{work.composer_name || "Unknown composer"}</td>
                  <td>{work.composer_epoch || "Unknown"}</td>
                  <td>{work.genre || "Unknown"}</td>
                  <td>
                    {work.composer_id ? (
                      <Link
                        className="btn btn-small"
                        to={`/composer/${work.composer_id}`}
                      >
                        Open
                      </Link>
                    ) : (
                      <span className="text-muted">n/a</span>
                    )}
                  </td>
                </tr>
              ))}

              {pagedWorks.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    No works match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </main>
  );
}

export default ZibaldonePage;
