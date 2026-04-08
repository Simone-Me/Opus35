import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getWorksIndex } from "../services/catalogService";

const SORTABLE_COLUMNS = {
  title: "title",
  composer: "composer",
  epoch: "epoch",
  genre: "genre",
};

function normalizeValue(value) {
  return (value || "").toString().toLowerCase();
}

function ZibaldonePage() {
  const [works, setWorks] = useState([]);
  const [query, setQuery] = useState("");
  const [epochFilter, setEpochFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(SORTABLE_COLUMNS.title);
  const [sortDirection, setSortDirection] = useState("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadIndex() {
      try {
        setIsLoading(true);
        setError("");
        const data = await getWorksIndex();
        setWorks(data);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadIndex();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, epochFilter, genreFilter, pageSize, sortBy, sortDirection]);

  const availableEpochs = useMemo(() => {
    const values = new Set();

    works.forEach((work) => {
      if (work.composer?.epoch) {
        values.add(work.composer.epoch);
      }
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [works]);

  const availableGenres = useMemo(() => {
    const values = new Set();

    works.forEach((work) => {
      if (work.genre) {
        values.add(work.genre);
      }
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [works]);

  const filteredWorks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = works.filter((work) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeValue(work.title).includes(normalizedQuery) ||
        normalizeValue(work.composer?.name).includes(normalizedQuery);

      const matchesEpoch =
        epochFilter === "all" || work.composer?.epoch === epochFilter;
      const matchesGenre = genreFilter === "all" || work.genre === genreFilter;

      return matchesQuery && matchesEpoch && matchesGenre;
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftValue =
        sortBy === SORTABLE_COLUMNS.composer
          ? normalizeValue(left.composer?.name)
          : sortBy === SORTABLE_COLUMNS.epoch
            ? normalizeValue(left.composer?.epoch)
            : normalizeValue(left[sortBy]);

      const rightValue =
        sortBy === SORTABLE_COLUMNS.composer
          ? normalizeValue(right.composer?.name)
          : sortBy === SORTABLE_COLUMNS.epoch
            ? normalizeValue(right.composer?.epoch)
            : normalizeValue(right[sortBy]);

      if (leftValue < rightValue) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (leftValue > rightValue) {
        return sortDirection === "asc" ? 1 : -1;
      }

      return 0;
    });

    return sorted;
  }, [works, query, epochFilter, genreFilter, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedWorks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWorks.slice(start, start + pageSize);
  }, [filteredWorks, currentPage, pageSize]);

  function toggleSort(columnKey) {
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
      </div>

      <div className="zibaldone-toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search by opus title or composer"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          className="select"
          value={epochFilter}
          onChange={(event) => setEpochFilter(event.target.value)}
        >
          <option value="all">All epochs</option>
          {availableEpochs.map((epoch) => (
            <option key={epoch} value={epoch}>
              {epoch}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={genreFilter}
          onChange={(event) => setGenreFilter(event.target.value)}
        >
          <option value="all">All genres</option>
          {availableGenres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
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
          <p className="text-muted">{filteredWorks.length} works found.</p>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button
                    className="table-sort-btn"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.title)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.title, "Opus")}
                  </button>
                </th>
                <th>
                  <button
                    className="table-sort-btn"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.composer)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.composer, "Composer")}
                  </button>
                </th>
                <th>
                  <button
                    className="table-sort-btn"
                    onClick={() => toggleSort(SORTABLE_COLUMNS.epoch)}
                  >
                    {sortLabel(SORTABLE_COLUMNS.epoch, "Epoch")}
                  </button>
                </th>
                <th>
                  <button
                    className="table-sort-btn"
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
                  <td>{work.composer?.name || "Unknown composer"}</td>
                  <td>{work.composer?.epoch || "Unknown"}</td>
                  <td>{work.genre || "Unknown"}</td>
                  <td>
                    {work.composer?.id ? (
                      <Link
                        className="btn btn-small"
                        to={`/composer/${work.composer.id}`}
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

          <div className="pagination-row">
            <button
              className="btn btn-small"
              disabled={currentPage <= 1}
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            >
              Prev
            </button>
            <span className="text-muted">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-small"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setPage((previous) => Math.min(totalPages, previous + 1))
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default ZibaldonePage;
