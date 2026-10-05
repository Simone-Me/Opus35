import { useEffect, useId, useMemo, useRef, useState } from "react";
import IconStreamlineUltimateArrowButtonRight1 from "~icons/streamline-ultimate/arrow-button-right-1";
import IconStreamlineUltimateMultipleUsers1 from "~icons/streamline-ultimate/multiple-users-1";
import { DEFAULT_PLACE_OPTIONS } from "../lib/categories";
const VOCAL_ROLE_OPTIONS = [
  "Choir",
  "Solo",
  "Soprano",
  "Mezzo-soprano",
  "Alto",
  "Tenor",
  "Baritone",
  "Bass",
  "Countertenor",
  "Other",
];

// Generic field list for the "Record" form; the "Attended" form has a custom layout.
const RECORD_FIELDS = [
  { name: "dateBought", label: "Date acquired", type: "date" },
  { name: "recordingDate", label: "Recording date", type: "date" },
  { name: "place", label: "Place", type: "place" },
  { name: "conductor", label: "Director", type: "text" },
  { name: "orchestra", label: "Orchestra", type: "text" },
  { name: "comment", label: "Record / comment", type: "textarea" },
];

function createVocalLine(line = {}) {
  return {
    id: line.id || `vocal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: line.role || "Choir",
    name: line.name || "",
  };
}

function normalizeVocals(vocalsValue) {
  if (!Array.isArray(vocalsValue)) {
    return [];
  }

  return vocalsValue
    .map((item) => createVocalLine(item))
    .filter((item) => item.role || item.name);
}

function serializeVocals(vocalsValue) {
  return normalizeVocals(vocalsValue).map((item) => ({
    role: item.role || "Choir",
    name: item.name || "",
  }));
}

// Mount it only while open, with a `key` that changes on every open
// (see useCategoryModal): the form state is initialised from props once.
function CategoryModal({
  category,
  workTitle,
  initialValues,
  onClose,
  onSave,
  onRemove,
  canRemove = false,
  isSaving = false,
  placeOptions = [],
}) {
  const [values, setValues] = useState(() => ({
    ...(initialValues || {}),
    vocals: normalizeVocals(initialValues?.vocals),
  }));
  const [isChoirOpen, setIsChoirOpen] = useState(
    () => category === "heard" && values.vocals.length > 0,
  );
  const [isStageDirectorOpen, setIsStageDirectorOpen] = useState(() =>
    Boolean(values.stageDirector),
  );
  const [isCommentOpen, setIsCommentOpen] = useState(() =>
    Boolean(values.comment),
  );
  const titleId = useId();
  const dialogRef = useRef(null);
  const mergedPlaceOptions = useMemo(
    () =>
      Array.from(new Set([...DEFAULT_PLACE_OPTIONS, ...placeOptions])).sort(
        (left, right) => left.localeCompare(right),
      ),
    [placeOptions],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.querySelector("input, select, textarea, button")?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  if (category !== "heard" && category !== "bought") {
    return null;
  }

  function updateValue(name, value) {
    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function addVocalLine() {
    setIsChoirOpen(true);
    setValues((previous) => ({
      ...previous,
      vocals: [...normalizeVocals(previous.vocals), createVocalLine()],
    }));
  }

  function updateVocalLine(index, name, value) {
    setValues((previous) => {
      const vocals = normalizeVocals(previous.vocals);
      const next = [...vocals];
      next[index] = {
        ...next[index],
        [name]: value,
      };

      return {
        ...previous,
        vocals: next,
      };
    });
  }

  function removeVocalLine(index) {
    setValues((previous) => {
      const vocals = normalizeVocals(previous.vocals);
      const next = vocals.filter((_, currentIndex) => currentIndex !== index);

      return {
        ...previous,
        vocals: next,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave({
      ...values,
      vocals: serializeVocals(values.vocals),
    });
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="modal-card" ref={dialogRef}>
        <h2 id={titleId}>
          {category === "heard" ? "Attended details" : "Record details"}
        </h2>
        <p className="text-muted">{workTitle}</p>

        <form onSubmit={handleSubmit}>
          {category === "heard" ? (
            <div className="heard-details-grid">
              <label className="form-field">
                <span>Date</span>
                <input
                  className="input"
                  type="date"
                  value={values.date || ""}
                  onChange={(event) => updateValue("date", event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Place</span>
                <input
                  className="input"
                  list="heard-place-options"
                  value={values.place || ""}
                  onChange={(event) => updateValue("place", event.target.value)}
                  placeholder="Choose or type a place"
                />
                <datalist id="heard-place-options">
                  {mergedPlaceOptions.map((place) => (
                    <option key={place} value={place} />
                  ))}
                </datalist>
              </label>

              <label className="form-field">
                <span>Orchestra</span>
                <input
                  className="input"
                  type="text"
                  value={values.orchestra || ""}
                  onChange={(event) =>
                    updateValue("orchestra", event.target.value)
                  }
                />
              </label>

              <label className="form-field heard-director-field">
                <span>Director orchestra</span>
                <input
                  className="input"
                  type="text"
                  value={values.conductor || ""}
                  onChange={(event) =>
                    updateValue("conductor", event.target.value)
                  }
                />
              </label>

              <div className="form-field heard-choir-field">
                <div className="heard-field-head">
                  <span>
                    Choir{" "}
                    <IconStreamlineUltimateMultipleUsers1
                      aria-hidden="true"
                      height="16"
                      width="16"
                    />
                  </span>
                  <button
                    className="btn btn-small heard-symbol-btn"
                    type="button"
                    onClick={addVocalLine}
                    aria-label="Add choir line"
                  >
                    <IconStreamlineUltimateArrowButtonRight1
                      aria-hidden="true"
                      height="16"
                      width="16"
                    />
                  </button>
                </div>

                {isChoirOpen && (
                  <div className="choir-section">
                    <div className="choir-grid">
                      {normalizeVocals(values.vocals).map((line, index) => (
                        <div className="choir-row" key={line.id}>
                          <select
                            className="select"
                            value={line.role || "Choir"}
                            onChange={(event) =>
                              updateVocalLine(index, "role", event.target.value)
                            }
                          >
                            {VOCAL_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>

                          <input
                            className="input"
                            maxLength={140}
                            placeholder="Name(s) of singer, soloist, or choir"
                            type="text"
                            value={line.name || ""}
                            onChange={(event) =>
                              updateVocalLine(index, "name", event.target.value)
                            }
                          />

                          <button
                            className="btn btn-small"
                            type="button"
                            onClick={() => removeVocalLine(index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      {normalizeVocals(values.vocals).length === 0 && (
                        <p className="text-muted">
                          Click the arrow icon to add one or more lines.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-field heard-metteur-field">
                <div className="heard-field-head">
                  <span>Metteur en scene</span>
                  <button
                    className="btn btn-small heard-symbol-btn"
                    type="button"
                    onClick={() =>
                      setIsStageDirectorOpen((previous) => !previous)
                    }
                    aria-label="Toggle metteur en scene input"
                  >
                    <IconStreamlineUltimateArrowButtonRight1
                      aria-hidden="true"
                      height="16"
                      width="16"
                    />
                  </button>
                </div>

                {isStageDirectorOpen && (
                  <input
                    className="input"
                    type="text"
                    value={values.stageDirector || ""}
                    placeholder="Name of stage director"
                    onChange={(event) =>
                      updateValue("stageDirector", event.target.value)
                    }
                  />
                )}
              </div>

              <div className="form-field heard-comment-field">
                <div className="heard-field-head">
                  <span>Comment</span>
                  <button
                    className="btn btn-small heard-symbol-btn"
                    type="button"
                    onClick={() => setIsCommentOpen((previous) => !previous)}
                    aria-label="Toggle comment input"
                  >
                    <IconStreamlineUltimateArrowButtonRight1
                      aria-hidden="true"
                      height="16"
                      width="16"
                    />
                  </button>
                </div>

                {isCommentOpen && (
                  <textarea
                    className="textarea"
                    value={values.comment || ""}
                    placeholder="Any note about this performance"
                    onChange={(event) =>
                      updateValue("comment", event.target.value)
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="form-grid">
              {RECORD_FIELDS.map((field) => (
                <label className="form-field" key={field.name}>
                  <span>{field.label}</span>
                  {field.type === "textarea" ? (
                    <textarea
                      className="textarea"
                      value={values[field.name] || ""}
                      onChange={(event) =>
                        updateValue(field.name, event.target.value)
                      }
                    />
                  ) : field.type === "place" ? (
                    <>
                      <input
                        className="input"
                        list={`${category}-place-options`}
                        value={values[field.name] || ""}
                        onChange={(event) =>
                          updateValue(field.name, event.target.value)
                        }
                        placeholder="Choose or type a place"
                      />
                      <datalist id={`${category}-place-options`}>
                        {mergedPlaceOptions.map((place) => (
                          <option key={place} value={place} />
                        ))}
                      </datalist>
                    </>
                  ) : (
                    <input
                      className="input"
                      type={field.type}
                      value={values[field.name] || ""}
                      onChange={(event) =>
                        updateValue(field.name, event.target.value)
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="modal-actions">
            {canRemove && onRemove && (
              <button
                type="button"
                className="btn"
                onClick={onRemove}
                disabled={isSaving}
              >
                Remove category
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryModal;
