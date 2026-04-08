import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import CategoryModal from "../components/CategoryModal";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  DETAILED_CATEGORIES,
} from "../lib/categories";
import { hasSupabaseCredentials } from "../lib/supabaseClient";
import {
  enrichComposerFromWikipedia,
  getComposerById,
  getWorksByComposerId,
} from "../services/catalogService";
import {
  getUserLogs,
  removeUserLogCategory,
  toggleUserLogCategory,
  upsertUserLogCategory,
} from "../services/logService";

function ComposerPage() {
  const { composerId } = useParams();
  const { user } = useOutletContext();

  const [composer, setComposer] = useState(null);
  const [works, setWorks] = useState([]);
  const [logs, setLogs] = useState([]);

  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isWorksLoading, setIsWorksLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [hasTriedEnrichment, setHasTriedEnrichment] = useState(false);

  const [error, setError] = useState("");

  const [modalState, setModalState] = useState({
    isOpen: false,
    category: null,
    workId: null,
    workTitle: "",
    initialValues: {},
  });

  useEffect(() => {
    async function loadComposerPageData() {
      if (!hasSupabaseCredentials) {
        setIsLoading(false);
        setIsWorksLoading(false);
        return;
      }

      setIsLoading(true);
      setIsWorksLoading(true);
      setError("");

      try {
        const [composerData, worksData] = await Promise.all([
          getComposerById(composerId),
          getWorksByComposerId(composerId),
        ]);

        setComposer(composerData || null);
        setWorks(worksData || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
        setIsWorksLoading(false);
      }
    }

    setHasTriedEnrichment(false);
    loadComposerPageData();
  }, [composerId]);

  useEffect(() => {
    async function loadLogs() {
      if (!user?.id) {
        setLogs([]);
        return;
      }

      try {
        const data = await getUserLogs(user.id);
        setLogs(data);
      } catch (loadError) {
        setError(loadError.message);
      }
    }

    loadLogs();
  }, [user?.id]);

  useEffect(() => {
    async function enrichComposer() {
      if (
        !composer ||
        composer.bio ||
        hasTriedEnrichment ||
        !hasSupabaseCredentials
      ) {
        return;
      }

      setHasTriedEnrichment(true);
      setIsEnriching(true);

      try {
        await enrichComposerFromWikipedia(composer.id);
        const freshComposer = await getComposerById(composer.id);
        setComposer(freshComposer || composer);
      } catch (enrichError) {
        setError(enrichError.message);
      } finally {
        setIsEnriching(false);
      }
    }

    enrichComposer();
  }, [composer, hasTriedEnrichment]);

  useEffect(() => {
    setPage(1);
  }, [query, genreFilter, pageSize]);

  const workLogLookup = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      map.set(log.work_id, log);
    });

    return map;
  }, [logs]);

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

    return works.filter((work) => {
      const matchesQuery =
        !normalizedQuery ||
        (work.title || "").toLowerCase().includes(normalizedQuery);
      const matchesGenre = genreFilter === "all" || work.genre === genreFilter;

      return matchesQuery && matchesGenre;
    });
  }, [works, query, genreFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedWorks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWorks.slice(start, start + pageSize);
  }, [filteredWorks, currentPage, pageSize]);

  async function refreshLogs() {
    if (!user?.id) {
      setLogs([]);
      return;
    }

    const data = await getUserLogs(user.id);
    setLogs(data);
  }

  async function handleCategoryAction(workId, workTitle, category) {
    if (!user?.id) {
      setError("Sign in first to save categories.");
      return;
    }

    if (DETAILED_CATEGORIES.includes(category)) {
      const existingLog = workLogLookup.get(workId);
      const existingDetails = existingLog?.details?.[category] || {};

      setModalState({
        isOpen: true,
        category,
        workId,
        workTitle,
        initialValues: existingDetails,
      });
      return;
    }

    try {
      await toggleUserLogCategory({ userId: user.id, workId, category });
      await refreshLogs();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleModalSave(values) {
    if (!user?.id || !modalState.workId || !modalState.category) {
      return;
    }

    setIsSaving(true);

    try {
      await upsertUserLogCategory({
        userId: user.id,
        workId: modalState.workId,
        category: modalState.category,
        details: values,
      });
      setModalState({
        isOpen: false,
        category: null,
        workId: null,
        workTitle: "",
        initialValues: {},
      });
      await refreshLogs();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleModalRemove() {
    if (!user?.id || !modalState.workId || !modalState.category) {
      return;
    }

    setIsSaving(true);

    try {
      await removeUserLogCategory({
        userId: user.id,
        workId: modalState.workId,
        category: modalState.category,
      });
      setModalState({
        isOpen: false,
        category: null,
        workId: null,
        workTitle: "",
        initialValues: {},
      });
      await refreshLogs();
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!hasSupabaseCredentials) {
    return (
      <main className="page">
        <h1>Composer profile</h1>
        <p className="text-muted">
          Configure Supabase env variables to load composers.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="page">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </main>
    );
  }

  if (!composer) {
    return (
      <main className="page">
        <h1>Composer not found</h1>
        <p className="text-muted">The composer id does not exist.</p>
        <Link className="btn" to="/browse">
          Back to browse
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="composer-profile-head">
        {composer.portrait_url ? (
          <img
            src={composer.portrait_url}
            alt={`Portrait of ${composer.name}`}
            className="composer-profile-image"
          />
        ) : (
          <div className="composer-profile-placeholder">No portrait</div>
        )}

        <div>
          <h1>{composer.name}</h1>
          <p className="text-muted">
            {composer.epoch || "Unknown epoch"}
            {composer.birth ? ` · ${composer.birth}` : ""}
            {composer.death ? ` - ${composer.death}` : ""}
          </p>
          {composer.wikipedia_url && (
            <p>
              <a href={composer.wikipedia_url} target="_blank" rel="noreferrer">
                Open Wikipedia source
              </a>
            </p>
          )}
          {isEnriching && (
            <p className="text-muted">Fetching Wikipedia enrichment...</p>
          )}
          <p>
            <Link className="btn btn-small" to="/zibaldone">
              Open Zibaldone index
            </Link>
          </p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <section>
        <h2>Biography</h2>
        <p className="text-muted">
          {composer.bio ||
            "No biography yet. Visit again to trigger lazy enrichment."}
        </p>
      </section>

      <section className="works-section">
        <div className="page-header">
          <div>
            <h2>All opus</h2>
            <p className="text-muted">{filteredWorks.length} works found.</p>
          </div>
          <div className="works-toolbar">
            <input
              className="input"
              type="search"
              placeholder="Search works"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        {isWorksLoading ? (
          <div className="table-skeleton">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : (
          <>
            <ul className="work-list">
              {pagedWorks.map((work) => (
                <li className="work-item" key={work.id}>
                  <div className="work-head">
                    <p className="work-title">{work.title}</p>
                    <span className="work-genre">
                      {work.genre || "genre n/a"}
                    </span>
                  </div>

                  <div className="category-row">
                    {CATEGORY_ORDER.map((category) => {
                      const metadata = CATEGORIES[category];
                      const isActive = Boolean(
                        workLogLookup
                          .get(work.id)
                          ?.categories?.includes(category),
                      );

                      return (
                        <button
                          key={category}
                          className={`btn btn-small btn-${category} ${isActive ? "active" : ""}`}
                          onClick={() =>
                            handleCategoryAction(work.id, work.title, category)
                          }
                          disabled={isSaving}
                        >
                          {metadata.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

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
      </section>

      <CategoryModal
        isOpen={modalState.isOpen}
        category={modalState.category}
        workTitle={modalState.workTitle}
        initialValues={modalState.initialValues}
        onClose={() =>
          setModalState({
            isOpen: false,
            category: null,
            workId: null,
            workTitle: "",
            initialValues: {},
          })
        }
        onSave={handleModalSave}
        onRemove={handleModalRemove}
        canRemove={Boolean(
          modalState.workId &&
          modalState.category &&
          workLogLookup
            .get(modalState.workId)
            ?.categories?.includes(modalState.category),
        )}
      />
    </main>
  );
}

export default ComposerPage;
