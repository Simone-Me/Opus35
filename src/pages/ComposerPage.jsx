import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import IconStreamlineUltimateBinocular from "~icons/streamline-ultimate/binocular";
import IconStreamlineUltimateCdPlaying from "~icons/streamline-ultimate/cd-playing";
import IconStreamlineUltimateMusicOnOff1 from "~icons/streamline-ultimate/music-on-off-1";
import IconStreamlineUltimateSafetyDrownHand from "~icons/streamline-ultimate/safety-drown-hand";
import IconStreamlineUltimateSmileySmile1Bold from "~icons/streamline-ultimate/smiley-smile-1-bold";
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
  deleteComposerNote,
  getComposerNote,
  upsertComposerNote,
} from "../services/composerNoteService";
import {
  getUserLogs,
  removeUserLogCategory,
  toggleUserLogCategory,
  upsertUserLogCategory,
} from "../services/logService";

const COMPOSER_NOTE_MAX_LENGTH = 500;
const WORK_ACTION_FILTERS = ["heard", "favorite", "bought", "alert"];

const WORK_ACTION_METADATA = {
  heard: {
    icon: IconStreamlineUltimateBinocular,
    actionLabel: "attended",
    filterLabel: "Attended",
    hint: "attended a performance of the opus",
  },
  bought: {
    icon: IconStreamlineUltimateCdPlaying,
    actionLabel: "own",
    filterLabel: "Record",
    hint: "bought a recording of the opus",
  },
  favorite: {
    icon: IconStreamlineUltimateSmileySmile1Bold,
    actionLabel: "favorite",
    filterLabel: "Favorite",
    hint: "marked as a favorite",
  },
  alert: {
    icon: IconStreamlineUltimateSafetyDrownHand,
    actionLabel: "alert",
    filterLabel: "Alert",
    hint: "interested to go to a performance or buy a record",
  },
};

function getShortBio(value) {
  return (value || "").trim();
}

function ComposerPage() {
  const { composerId } = useParams();
  const { user } = useOutletContext();

  const [composer, setComposer] = useState(null);
  const [works, setWorks] = useState([]);
  const [logs, setLogs] = useState([]);

  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [actionFilters, setActionFilters] = useState([]);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [expandedWorkId, setExpandedWorkId] = useState(null);
  const [activeTab, setActiveTab] = useState("works");
  const [composerNote, setComposerNote] = useState(null);
  const [composerNoteDraft, setComposerNoteDraft] = useState("");
  const [isComposerNoteLoading, setIsComposerNoteLoading] = useState(false);
  const [isComposerNoteSaving, setIsComposerNoteSaving] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isWorksLoading, setIsWorksLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [hasTriedEnrichment, setHasTriedEnrichment] = useState(false);
  const [enrichmentNotice, setEnrichmentNotice] = useState("");
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [canExpandBio, setCanExpandBio] = useState(false);

  const [error, setError] = useState("");
  const bioRef = useRef(null);

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
      setEnrichmentNotice("");

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
    async function loadComposerNote() {
      if (!user?.id || !composer?.id) {
        setComposerNote(null);
        setComposerNoteDraft("");
        return;
      }

      setIsComposerNoteLoading(true);

      try {
        const note = await getComposerNote({
          userId: user.id,
          composerId: composer.id,
        });
        setComposerNote(note);
        setComposerNoteDraft(note?.note || "");
      } catch (noteError) {
        setError(noteError.message);
      } finally {
        setIsComposerNoteLoading(false);
      }
    }

    loadComposerNote();
  }, [user?.id, composer?.id]);

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
        console.warn("Biography enrichment unavailable", enrichError);
        setEnrichmentNotice(
          "Biography enrichment is temporarily unavailable. You can continue browsing works.",
        );
      } finally {
        setIsEnriching(false);
      }
    }

    enrichComposer();
  }, [composer, hasTriedEnrichment]);

  useEffect(() => {
    setPage(1);
  }, [query, genreFilter, actionFilters, pageSize]);

  useEffect(() => {
    setExpandedWorkId(null);
  }, [composerId]);

  useEffect(() => {
    setActiveTab("works");
  }, [composerId]);

  useEffect(() => {
    setIsBioExpanded(false);
  }, [composer?.id, composer?.bio]);

  useEffect(() => {
    if (isBioExpanded) {
      return;
    }

    const element = bioRef.current;

    if (!element || !composer?.bio) {
      setCanExpandBio(false);
      return;
    }

    // Delay measurement so layout and line-clamp styles are fully applied.
    const frame = requestAnimationFrame(() => {
      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      setCanExpandBio(hasOverflow);
    });

    return () => cancelAnimationFrame(frame);
  }, [composer?.bio, isBioExpanded]);

  const workLogLookup = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      map.set(log.work_id, log);
    });

    return map;
  }, [logs]);

  const placeOptions = useMemo(() => {
    const values = new Set(["Philharmonie de Paris", "Opera de Paris"]);

    logs.forEach((log) => {
      const heardPlace = log?.details?.heard?.place;
      const recordPlace = log?.details?.bought?.place;

      if (heardPlace) {
        values.add(heardPlace);
      }

      if (recordPlace) {
        values.add(recordPlace);
      }
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right));
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
      const activeCategories = workLogLookup.get(work.id)?.categories || [];
      const matchesActionFilter =
        actionFilters.length === 0 ||
        actionFilters.some((category) => activeCategories.includes(category));

      return matchesQuery && matchesGenre && matchesActionFilter;
    });
  }, [works, query, genreFilter, workLogLookup, actionFilters]);

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

  function handleActionFilterToggle(category) {
    setActionFilters((previous) => {
      if (previous.includes(category)) {
        return previous.filter((value) => value !== category);
      }

      return [...previous, category];
    });
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

  async function handleSaveComposerNote(event) {
    event.preventDefault();

    if (!user?.id || !composer?.id) {
      setError("Sign in first to save a composer note.");
      return;
    }

    const normalizedNote = composerNoteDraft.trim();

    if (!normalizedNote) {
      setError("Write a note before saving.");
      return;
    }

    if (normalizedNote.length > COMPOSER_NOTE_MAX_LENGTH) {
      setError("Note must be 500 characters or fewer.");
      return;
    }

    setError("");
    setIsComposerNoteSaving(true);

    try {
      const savedNote = await upsertComposerNote({
        userId: user.id,
        composerId: composer.id,
        note: normalizedNote,
      });

      setComposerNote(savedNote);
      setComposerNoteDraft(savedNote.note);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsComposerNoteSaving(false);
    }
  }

  async function handleDeleteComposerNote() {
    if (!user?.id || !composer?.id || !composerNote) {
      return;
    }

    setIsComposerNoteSaving(true);

    try {
      await deleteComposerNote({
        userId: user.id,
        composerId: composer.id,
      });
      setComposerNote(null);
      setComposerNoteDraft("");
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsComposerNoteSaving(false);
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
        <p className="text-muted">
          If this artist is not present, you can suggest it in the{" "}
          <a href="#footer-contact">contact area</a>.
        </p>
        <Link className="btn" to="/browse">
          Back to browse
        </Link>
      </main>
    );
  }

  const composerDisplayName = composer.complete_name || composer.name;
  const biography = getShortBio(composer.bio);

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
          <h1>{composerDisplayName}</h1>
          <p className="text-muted">
            {composer.epoch || "Unknown epoch"}
            {composer.birth ? ` · ${composer.birth}` : ""}
            {composer.death ? ` - ${composer.death}` : ""}
          </p>
          {composer.complete_name &&
            composer.name !== composer.complete_name && (
              <p className="text-muted">Listed as {composer.name}</p>
            )}
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
          <p className="text-muted composer-contact-hint">
            Missing an artist? Suggest it <a href="#footer-contact">here</a>.
          </p>
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
        <p
          ref={bioRef}
          className={`text-muted composer-bio-text ${isBioExpanded ? "is-expanded" : ""}`}
        >
          {biography ||
            "No biography yet. Visit again to trigger lazy enrichment."}
        </p>
        {biography && canExpandBio && (
          <button
            type="button"
            className="btn btn-small composer-bio-toggle"
            onClick={() => setIsBioExpanded((current) => !current)}
          >
            {isBioExpanded ? "See less" : "See more"}
          </button>
        )}
        {enrichmentNotice && <p className="text-muted">{enrichmentNotice}</p>}
      </section>

      <div className="tab-row" role="tablist" aria-label="Composer sections">
        <button
          className={`tab-btn ${activeTab === "works" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("works")}
        >
          Works
        </button>
        <button
          className={`tab-btn ${activeTab === "notes" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
      </div>

      {activeTab === "notes" && (
        <section className="composer-note-section">
          <h2>Private composer note</h2>

          {!user ? (
            <p className="text-muted">
              Sign in to save a private note for this composer.
            </p>
          ) : isComposerNoteLoading ? (
            <div className="table-skeleton">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
            </div>
          ) : (
            <form
              className="composer-note-form"
              onSubmit={handleSaveComposerNote}
            >
              <textarea
                className="textarea"
                maxLength={COMPOSER_NOTE_MAX_LENGTH}
                placeholder="Write your private note for this composer"
                value={composerNoteDraft}
                onChange={(event) => setComposerNoteDraft(event.target.value)}
              />

              <div className="composer-note-actions">
                <span className="text-muted">
                  {composerNoteDraft.trim().length}/{COMPOSER_NOTE_MAX_LENGTH}
                </span>

                <div className="composer-note-buttons">
                  {composerNote && (
                    <button
                      className="btn btn-small"
                      type="button"
                      onClick={handleDeleteComposerNote}
                      disabled={isComposerNoteSaving}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    className="btn btn-small"
                    type="submit"
                    disabled={isComposerNoteSaving}
                  >
                    {isComposerNoteSaving
                      ? "Saving..."
                      : composerNote
                        ? "Update"
                        : "Save"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      )}

      {activeTab === "works" && (
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

          <div className="filter-chip-row work-action-filter-row">
            <span className="text-muted">Actions</span>
            <button
              className={`chip ${actionFilters.length === 0 ? "active" : ""}`}
              onClick={() => setActionFilters([])}
              type="button"
            >
              Show all
            </button>
            {WORK_ACTION_FILTERS.map((category) => {
              const metadata = WORK_ACTION_METADATA[category];

              return (
                <button
                  key={category}
                  className={`chip ${actionFilters.includes(category) ? "active" : ""}`}
                  onClick={() => handleActionFilterToggle(category)}
                  type="button"
                >
                  {metadata.filterLabel}
                </button>
              );
            })}
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
                    <div className="work-row-main">
                      <div className="work-head">
                        <p className="work-title">{work.title}</p>
                        <span className="work-publication-date">
                          Date: {work.publication_year || "TBD"}
                        </span>
                        <div className="work-active-categories">
                          {(workLogLookup.get(work.id)?.categories || []).map(
                            (category) => (
                              <span
                                className={`active-category-pill active-${category}`}
                                key={`${work.id}-${category}`}
                              >
                                {CATEGORIES[category]?.label || category}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="work-controls-row">
                        <button
                          aria-expanded={expandedWorkId === work.id}
                          aria-label={`Toggle category controls for ${work.title}`}
                          className={`btn btn-small work-toggle-btn ${expandedWorkId === work.id ? "expanded" : ""}`}
                          onClick={() =>
                            setExpandedWorkId((previous) =>
                              previous === work.id ? null : work.id,
                            )
                          }
                          type="button"
                        >
                          <IconStreamlineUltimateMusicOnOff1
                            aria-hidden="true"
                            height="18"
                            width="18"
                          />
                        </button>

                        <div
                          className={`category-row work-category-panel ${expandedWorkId === work.id ? "is-open" : ""}`}
                        >
                          {CATEGORY_ORDER.map((category) => {
                            const metadata = CATEGORIES[category];
                            const actionMetadata =
                              WORK_ACTION_METADATA[category];
                            const Icon = actionMetadata.icon;
                            const isActive = Boolean(
                              workLogLookup
                                .get(work.id)
                                ?.categories?.includes(category),
                            );

                            return (
                              <button
                                key={category}
                                className={`btn btn-small btn-${category} action-category-btn ${isActive ? "active" : ""}`}
                                onClick={() =>
                                  handleCategoryAction(
                                    work.id,
                                    work.title,
                                    category,
                                  )
                                }
                                title={actionMetadata.hint || undefined}
                                aria-label={
                                  actionMetadata.hint
                                    ? `${metadata.label}. ${actionMetadata.hint}`
                                    : metadata.label
                                }
                                disabled={
                                  isSaving || expandedWorkId !== work.id
                                }
                                type="button"
                              >
                                <Icon
                                  aria-hidden="true"
                                  height="16"
                                  width="16"
                                />
                                <span>{actionMetadata.actionLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="pagination-row">
                <button
                  className="btn btn-small"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setPage((previous) => Math.max(1, previous - 1))
                  }
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
      )}

      <CategoryModal
        isOpen={modalState.isOpen}
        category={modalState.category}
        workTitle={modalState.workTitle}
        initialValues={modalState.initialValues}
        placeOptions={placeOptions}
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
