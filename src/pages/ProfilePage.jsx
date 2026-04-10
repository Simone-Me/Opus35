import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import CategoryModal from "../components/CategoryModal";
import { DETAILED_CATEGORIES, PROFILE_TABS } from "../lib/categories";
import {
  getUserLogs,
  removeUserLogCategory,
  upsertUserLogCategory,
} from "../services/logService";
import {
  deleteProfileNote,
  getProfileNotes,
  insertProfileNote,
} from "../services/noteService";

const NOTE_MAX_LENGTH = 500;

function getComposerName(work) {
  const composer = work?.composers;

  if (Array.isArray(composer)) {
    return composer[0]?.name || "Unknown composer";
  }

  return composer?.name || "Unknown composer";
}

function ProfilePage() {
  const { user } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [error, setError] = useState("");
  const [modalState, setModalState] = useState({
    isOpen: false,
    category: null,
    workId: null,
    workTitle: "",
    initialValues: {},
  });

  useEffect(() => {
    async function loadLogs() {
      if (!user?.id) {
        setLogs([]);
        setNotes([]);
        return;
      }

      setIsLoading(true);
      setIsNotesLoading(true);

      try {
        const [logsData, notesData] = await Promise.all([
          getUserLogs(user.id),
          getProfileNotes(user.id),
        ]);

        setLogs(logsData);
        setNotes(notesData);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
        setIsNotesLoading(false);
      }
    }

    loadLogs();
  }, [user?.id]);

  const rows = useMemo(() => {
    if (activeTab === "notes") {
      return [];
    }

    const expandedRows = [];

    logs.forEach((log) => {
      const categories = log.categories || [];
      const scopedCategories =
        activeTab === "all"
          ? categories
          : categories.filter((category) => category === activeTab);

      scopedCategories.forEach((category) => {
        expandedRows.push({
          id: `${log.id}:${category}`,
          logId: log.id,
          workId: log.work_id,
          category,
          details: log.details?.[category] || {},
          createdAt: log.created_at,
          updatedAt: log.updated_at,
          work: log.works,
        });
      });
    });

    return expandedRows.sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
  }, [logs, activeTab]);

  async function refreshLogs() {
    if (!user?.id) {
      return;
    }

    const data = await getUserLogs(user.id);
    setLogs(data);
  }

  async function refreshNotes() {
    if (!user?.id) {
      return;
    }

    const data = await getProfileNotes(user.id);
    setNotes(data);
  }

  async function handleDelete(row) {
    if (!user?.id) {
      return;
    }

    try {
      await removeUserLogCategory({
        userId: user.id,
        workId: row.workId,
        category: row.category,
      });
      await refreshLogs();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function handleEditSave(values) {
    if (!user?.id || !modalState.workId || !modalState.category) {
      return;
    }

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
    }
  }

  async function handleAddNote(event) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    const normalizedNote = noteDraft.trim();

    if (!normalizedNote) {
      setError("Write a note before saving.");
      return;
    }

    if (normalizedNote.length > NOTE_MAX_LENGTH) {
      setError("Note must be 500 characters or fewer.");
      return;
    }

    setError("");
    setIsSavingNote(true);

    try {
      await insertProfileNote({
        userId: user.id,
        note: normalizedNote,
      });
      setNoteDraft("");
      await refreshNotes();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId) {
    if (!user?.id) {
      return;
    }

    try {
      await deleteProfileNote({
        userId: user.id,
        noteId,
      });
      await refreshNotes();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function getDetailsPreview(row) {
    if (!DETAILED_CATEGORIES.includes(row.category)) {
      return "Flag only";
    }

    const details = row.details || {};
    const values = Object.values(details).filter(Boolean);

    if (values.length === 0) {
      return "No details yet";
    }

    return values.slice(0, 3).join(" · ");
  }

  if (!user) {
    return (
      <main className="page">
        <h1>User profile</h1>
        <p className="text-muted">
          Sign in to inspect and edit your marked pieces.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>User profile</h1>
          <p className="text-muted">
            Inspect your pieces by tab and edit each category entry.
          </p>
        </div>
      </div>

      <div className="tab-row" role="tablist" aria-label="Profile categories">
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {activeTab === "notes" ? (
        <section className="profile-notes-section">
          <h2>Personal notes</h2>
          <p className="text-muted">
            Add quick private notes (up to 500 characters).
          </p>

          <form className="profile-note-form" onSubmit={handleAddNote}>
            <textarea
              className="textarea"
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Write your note here"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <div className="profile-note-form-row">
              <span className="text-muted">
                {noteDraft.trim().length}/{NOTE_MAX_LENGTH}
              </span>
              <button
                className="btn btn-small"
                type="submit"
                disabled={isSavingNote}
              >
                {isSavingNote ? "Saving..." : "Add note"}
              </button>
            </div>
          </form>

          {isNotesLoading ? (
            <div className="table-skeleton">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-muted">No personal notes yet.</p>
          ) : (
            <ul className="profile-notes-list">
              {notes.map((note) => (
                <li className="profile-note-item" key={note.id}>
                  <p>{note.note}</p>
                  <div className="profile-note-meta">
                    <span className="text-muted">
                      Updated {format(new Date(note.updated_at), "yyyy-MM-dd")}
                    </span>
                    <button
                      className="btn btn-small"
                      onClick={() => handleDeleteNote(note.id)}
                      type="button"
                    >
                      Delete note
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : isLoading ? (
        <div className="table-skeleton">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Work</th>
              <th>Composer</th>
              <th>Category</th>
              <th>Details</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.work?.title || "Untitled work"}</td>
                <td>{getComposerName(row.work)}</td>
                <td>{row.category}</td>
                <td>{getDetailsPreview(row)}</td>
                <td>{format(new Date(row.updatedAt), "yyyy-MM-dd")}</td>
                <td>
                  <div className="table-actions">
                    {DETAILED_CATEGORIES.includes(row.category) && (
                      <button
                        className="btn btn-small"
                        onClick={() =>
                          setModalState({
                            isOpen: true,
                            category: row.category,
                            workId: row.workId,
                            workTitle: row.work?.title || "",
                            initialValues: row.details || {},
                          })
                        }
                      >
                        Edit
                      </button>
                    )}

                    <button
                      className="btn btn-small"
                      onClick={() => handleDelete(row)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No entries in this tab yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

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
        onSave={handleEditSave}
      />
    </main>
  );
}

export default ProfilePage;
