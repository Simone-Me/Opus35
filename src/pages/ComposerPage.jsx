import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import IconStreamlineUltimateBinocular from "~icons/streamline-ultimate/binocular";
import IconStreamlineUltimateCdPlaying from "~icons/streamline-ultimate/cd-playing";
import IconStreamlineUltimateMusicOnOff1 from "~icons/streamline-ultimate/music-on-off-1";
import IconStreamlineUltimateSafetyDrownHand from "~icons/streamline-ultimate/safety-drown-hand";
import IconStreamlineUltimateSmileySmile1Bold from "~icons/streamline-ultimate/smiley-smile-1-bold";
import CategoryModal from "../components/CategoryModal";
import Pagination from "../components/Pagination";
import { useCategoryModal } from "../hooks/useCategoryModal";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  collectPlaceOptions,
  DETAILED_CATEGORIES,
  getCategoryLabel,
} from "../lib/categories";
import { NOTE_MAX_LENGTH, validateNote } from "../lib/notes";
import { hasSupabaseCredentials } from "../lib/supabaseClient";
import { uniqueSorted } from "../lib/utils";
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
  applyLogChange,
  getUserLogsForComposer,
  getUserPlaceLogs,
  removeUserLogCategory,
  setUserLogCategory,
  toggleUserLogCategory,
} from "../services/logService";

const CATEGORY_ICONS = {
  heard: IconStreamlineUltimateBinocular,
  bought: IconStreamlineUltimateCdPlaying,
  favorite: IconStreamlineUltimateSmileySmile1Bold,
  alert: IconStreamlineUltimateSafetyDrownHand,
};

// Keyed by composerId: navigating to another composer remounts the view, so
// every filter, tab and pending request of the previous composer is dropped.
function ComposerPage() {
  const { composerId } = useParams();
  return <ComposerView key={composerId} composerId={composerId} />;
}

function ComposerView({ composerId }) {
  const { user } = useOutletContext();

  const [composer, setComposer] = useState(null);
  const [works, setWorks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [placeLogs, setPlaceLogs] = useState([]);

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

  const [isLoading, setIsLoading] = useState(hasSupabaseCredentials);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingWorkIds, setPendingWorkIds] = useState(() => new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentNotice, setEnrichmentNotice] = useState("");
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [canExpandBio, setCanExpandBio] = useState(false);

  const [error, setError] = useState("");
  const bioRef = useRef(null);
  const enrichmentRequestedRef = useRef(false);
  const { modal, openModal, closeModal } = useCategoryModal();

  useEffect(() => {
    if (!hasSupabaseCredentials) {
      return undefined;
    }

    let ignore = false;

    async function loadComposerPageData() {
      try {
        const [composerData, worksData] = await Promise.all([
          getComposerById(composerId),
          getWorksByComposerId(composerId),
        ]);

        if (!ignore) {
          setComposer(composerData || null);
          setWorks(worksData || []);
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

    loadComposerPageData();

    return () => {
      ignore = true;
    };
  }, [composerId]);

  useEffect(() => {
    let ignore = false;

    async function loadLogs() {
      if (!user?.id) {
        setLogs([]);
        setPlaceLogs([]);
        return;
      }

      try {
        const [composerLogs, userPlaceLogs] = await Promise.all([
          getUserLogsForComposer(user.id, composerId),
          getUserPlaceLogs(user.id),
        ]);

        if (!ignore) {
          setLogs(composerLogs);
          setPlaceLogs(userPlaceLogs);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
        }
      }
    }

    loadLogs();

    return () => {
      ignore = true;
    };
  }, [user?.id, composerId]);

  useEffect(() => {
    let ignore = false;

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

        if (!ignore) {
          setComposerNote(note);
          setComposerNoteDraft(note?.note || "");
        }
      } catch (noteError) {
        if (!ignore) {
          setError(noteError.message);
        }
      } finally {
        if (!ignore) {
          setIsComposerNoteLoading(false);
        }
      }
    }

    loadComposerNote();

    return () => {
      ignore = true;
    };
  }, [user?.id, composer?.id]);

  useEffect(() => {
    if (
      !composer ||
      composer.bio ||
      enrichmentRequestedRef.current ||
      !hasSupabaseCredentials
    ) {
      return undefined;
    }

    // Once per mounted composer page, whatever the outcome.
    enrichmentRequestedRef.current = true;
    let ignore = false;

    async function enrichComposer() {
      setIsEnriching(true);

      try {
        const enrichedComposer = await enrichComposerFromWikipedia(composer.id);

        if (!ignore && enrichedComposer?.bio) {
          setComposer((current) => ({ ...current, ...enrichedComposer }));
        }
      } catch (enrichError) {
        console.warn("Biography enrichment unavailable", enrichError);

        if (!ignore) {
          setEnrichmentNotice(
            "Biography enrichment is temporarily unavailable. You can continue browsing works.",
          );
        }
      } finally {
        if (!ignore) {
          setIsEnriching(false);
        }
      }
    }

    enrichComposer();

    return () => {
      ignore = true;
    };
  }, [composer]);

  useEffect(() => {
    if (isBioExpanded) {
      return undefined;
    }

    const element = bioRef.current;

    if (!element || !composer?.bio) {
      return undefined;
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

  const placeOptions = useMemo(
    () => collectPlaceOptions([...placeLogs, ...logs]),
    [placeLogs, logs],
  );

  const availableGenres = useMemo(
    () => uniqueSorted(works, (work) => work.genre),
    [works],
  );

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

  function handleActionFilterToggle(category) {
    setPage(1);
    setActionFilters((previous) => {
      if (previous.includes(category)) {
        return previous.filter((value) => value !== category);
      }

      return [...previous, category];
    });
  }

  function setWorkPending(workId, isPending) {
    setPendingWorkIds((previous) => {
      const next = new Set(previous);

      if (isPending) {
        next.add(workId);
      } else {
        next.delete(workId);
      }

      return next;
    });
  }

  async function handleCategoryAction(work, category) {
    if (!user?.id) {
      setError("Sign in first to save categories.");
      return;
    }

    if (DETAILED_CATEGORIES.includes(category)) {
      openModal({
        category,
        workId: work.id,
        workTitle: work.title,
        initialValues: workLogLookup.get(work.id)?.details?.[category],
      });
      return;
    }

    if (pendingWorkIds.has(work.id)) {
      return;
    }

    setWorkPending(work.id, true);

    try {
      const updatedLog = await toggleUserLogCategory({
        workId: work.id,
        category,
      });
      setLogs((previous) => applyLogChange(previous, work.id, updatedLog));
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setWorkPending(work.id, false);
    }
  }

  async function handleModalSave(values) {
    if (!user?.id || !modal.workId || !modal.category) {
      return;
    }

    setIsSaving(true);

    try {
      const updatedLog = await setUserLogCategory({
        workId: modal.workId,
        category: modal.category,
        details: values,
      });
      setLogs((previous) => applyLogChange(previous, modal.workId, updatedLog));
      closeModal();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleModalRemove() {
    if (!user?.id || !modal.workId || !modal.category) {
      return;
    }

    setIsSaving(true);

    try {
      const updatedLog = await removeUserLogCategory({
        workId: modal.workId,
        category: modal.category,
      });
      setLogs((previous) => applyLogChange(previous, modal.workId, updatedLog));
      closeModal();
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const handleModalClose = useCallback(() => {
    if (!isSaving) {
      closeModal();
    }
  }, [closeModal, isSaving]);

  async function handleSaveComposerNote(event) {
    event.preventDefault();

    if (!user?.id || !composer?.id) {
      setError("Sign in first to save a composer note.");
      return;
    }

    const validation = validateNote(composerNoteDraft);

    if (validation.error) {
      setError(validation.error);
      return;
    }

    setError("");
    setIsComposerNoteSaving(true);

    try {
      const savedNote = await upsertComposerNote({
        userId: user.id,
        composerId: composer.id,
        note: validation.note,
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
  const biography = (composer.bio || "").trim();

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
                maxLength={NOTE_MAX_LENGTH}
                placeholder="Write your private note for this composer"
                value={composerNoteDraft}
                onChange={(event) => setComposerNoteDraft(event.target.value)}
              />

              <div className="composer-note-actions">
                <span className="text-muted">
                  {composerNoteDraft.trim().length}/{NOTE_MAX_LENGTH}
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
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="select"
                value={genreFilter}
                onChange={(event) => {
                  setGenreFilter(event.target.value);
                  setPage(1);
                }}
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
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
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
              onClick={() => {
                setActionFilters([]);
                setPage(1);
              }}
              type="button"
            >
              Show all
            </button>
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                className={`chip ${actionFilters.includes(category) ? "active" : ""}`}
                aria-pressed={actionFilters.includes(category)}
                onClick={() => handleActionFilterToggle(category)}
                type="button"
              >
                {getCategoryLabel(category)}
              </button>
            ))}
          </div>

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
                                {getCategoryLabel(category)}
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
                            const Icon = CATEGORY_ICONS[category];
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
                                  handleCategoryAction(work, category)
                                }
                                title={metadata.hint}
                                aria-label={`${metadata.label}. ${metadata.hint}`}
                                aria-pressed={isActive}
                                disabled={
                                  isSaving ||
                                  pendingWorkIds.has(work.id) ||
                                  expandedWorkId !== work.id
                                }
                                type="button"
                              >
                                <Icon
                                  aria-hidden="true"
                                  height="16"
                                  width="16"
                                />
                                <span>{metadata.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
        </section>
      )}

      {modal.isOpen && (
        <CategoryModal
          key={modal.openKey}
          category={modal.category}
          workTitle={modal.workTitle}
          initialValues={modal.initialValues}
          placeOptions={placeOptions}
          isSaving={isSaving}
          onClose={handleModalClose}
          onSave={handleModalSave}
          onRemove={handleModalRemove}
          canRemove={Boolean(
            workLogLookup.get(modal.workId)?.categories?.includes(modal.category),
          )}
        />
      )}
    </main>
  );
}

export default ComposerPage;
