import { useEffect, useMemo, useState } from "react";

const FORM_FIELDS = {
  heard: [
    { name: "date", label: "Date", type: "date" },
    { name: "place", label: "Place", type: "text" },
    { name: "orchestra", label: "Orchestra", type: "text" },
    { name: "conductor", label: "Director orchestra", type: "text" },
    { name: "stageDirector", label: "Metteur en scene", type: "text" },
    { name: "comment", label: "Comment", type: "textarea" },
  ],
  bought: [
    { name: "dateBought", label: "Date bought", type: "date" },
    { name: "recordingDate", label: "Date record", type: "date" },
    { name: "conductor", label: "Director", type: "text" },
    { name: "orchestra", label: "Orchestra", type: "text" },
    { name: "comment", label: "Content / comment", type: "textarea" },
  ],
};

function CategoryModal({
  isOpen,
  category,
  workTitle,
  initialValues,
  onClose,
  onSave,
  onRemove,
  canRemove = false,
}) {
  const [values, setValues] = useState(initialValues || {});
  const fields = useMemo(() => FORM_FIELDS[category] || [], [category]);

  useEffect(() => {
    setValues(initialValues || {});
  }, [initialValues]);

  if (!isOpen || fields.length === 0) {
    return null;
  }

  function updateValue(name, value) {
    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave(values);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2>{category === "heard" ? "Heard details" : "Bought details"}</h2>
        <p className="text-muted">{workTitle}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {fields.map((field) => (
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

          <div className="modal-actions">
            {canRemove && (
              <button type="button" className="btn" onClick={onRemove}>
                Remove category
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryModal;
