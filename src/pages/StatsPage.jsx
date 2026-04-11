import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getUserLogs } from "../services/logService";

const EPOCH_SERIES = [
  { key: "Medieval", color: "#6f7f95" },
  { key: "Renaissance", color: "#5e9a8b" },
  { key: "Baroque", color: "#b88b3e" },
  { key: "Classical", color: "#ddb560" },
  { key: "Early Romantic", color: "#9d6cc0" },
  { key: "Late Romantic", color: "#c46d8c" },
  { key: "Romantic", color: "#b45f5f" },
  { key: "20th Century", color: "#5d7ebf" },
  { key: "Post-War", color: "#4f98ad" },
  { key: "21st Century", color: "#2a8f6d" },
  { key: "Other", color: "#5a5a5a" },
];

function extractComposer(work) {
  const composer = work?.composers;

  if (Array.isArray(composer)) {
    return composer[0] || {};
  }

  return composer || {};
}

function toEpochBucket(epoch) {
  if (!epoch) {
    return "Other";
  }

  const normalized = epoch
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.includes("medieval")) {
    return "Medieval";
  }

  if (normalized.includes("renaissance")) {
    return "Renaissance";
  }

  if (normalized.includes("baroque")) {
    return "Baroque";
  }

  if (normalized.includes("classical")) {
    return "Classical";
  }

  if (normalized.includes("early romantic")) {
    return "Early Romantic";
  }

  if (normalized.includes("late romantic")) {
    return "Late Romantic";
  }

  if (normalized === "romantic" || normalized.includes(" romantic")) {
    return "Romantic";
  }

  if (normalized.includes("post-war") || normalized.includes("post war")) {
    return "Post-War";
  }

  if (
    normalized.includes("20th century") ||
    normalized.includes("20th") ||
    normalized.includes("twentieth")
  ) {
    return "20th Century";
  }

  if (
    normalized.includes("21st century") ||
    normalized.includes("21st") ||
    normalized.includes("twenty-first") ||
    normalized.includes("contemporary")
  ) {
    return "21st Century";
  }

  if (normalized.includes("modern")) {
    return "20th Century";
  }

  return "Other";
}

function getHeardYear(log) {
  const dateFromDetails = log.details?.heard?.date;
  const baseDate = dateFromDetails || log.created_at;

  if (!baseDate) {
    return "Unknown";
  }

  const parsedDate = new Date(baseDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  return String(parsedDate.getFullYear());
}

function ChartTooltip({ active, payload, label, hideZeroValues = false }) {
  if (!active || !Array.isArray(payload)) {
    return null;
  }

  const rows = payload.filter((entry) => {
    const value = Number(entry?.value ?? 0);

    if (hideZeroValues) {
      return value > 0;
    }

    return entry?.value !== null && entry?.value !== undefined;
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "#171d1d",
        border: "1px solid #2f3a39",
        borderRadius: "8px",
        color: "#e8ece9",
        padding: "8px 10px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
        opacity: 1,
      }}
    >
      <p style={{ margin: "0 0 6px", color: "#ddb560", fontWeight: 600 }}>
        {label}
      </p>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 4,
        }}
      >
        {rows.map((entry) => (
          <li
            key={`${entry.name}-${entry.dataKey}`}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: entry.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#e8ece9" }}>
              {entry.name}: {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatsPage() {
  const { user } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

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

  const heardLogs = useMemo(
    () => logs.filter((log) => (log.categories || []).includes("heard")),
    [logs],
  );

  const topComposerData = useMemo(() => {
    const composerCounter = new Map();

    heardLogs.forEach((log) => {
      const name = extractComposer(log.works).name || "Unknown";
      composerCounter.set(name, (composerCounter.get(name) || 0) + 1);
    });

    return [...composerCounter.entries()]
      .map(([name, listens]) => ({ name, listens }))
      .sort((left, right) => right.listens - left.listens)
      .slice(0, 10);
  }, [heardLogs]);

  const epochData = useMemo(() => {
    const byYear = new Map();

    heardLogs.forEach((log) => {
      const composerEpoch = extractComposer(log.works).epoch;
      const bucket = toEpochBucket(composerEpoch);
      const year = getHeardYear(log);

      if (!byYear.has(year)) {
        byYear.set(
          year,
          EPOCH_SERIES.reduce(
            (accumulator, epochKey) => ({
              ...accumulator,
              [epochKey.key]: 0,
            }),
            { year },
          ),
        );
      }

      byYear.get(year)[bucket] += 1;
    });

    return [...byYear.values()].sort((left, right) => {
      if (left.year === "Unknown") {
        return 1;
      }

      if (right.year === "Unknown") {
        return -1;
      }

      return Number(left.year) - Number(right.year);
    });
  }, [heardLogs]);

  if (!user) {
    return (
      <main className="page">
        <h1>Discover</h1>
        <p className="text-muted">Sign in to see your listening analytics.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Discover</h1>
          <p className="text-muted">
            Most listened composers and favorite periods.
          </p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {heardLogs.length === 0 ? (
        <p className="text-muted">
          No heard logs yet. Mark pieces as heard to populate charts.
        </p>
      ) : (
        <section className="chart-grid">
          <article className="chart-card">
            <h2 className="chart-title">Most listened composers</h2>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={topComposerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2f3a39" />
                  <XAxis
                    dataKey="name"
                    stroke="#acb9b3"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={90}
                    tickMargin={8}
                  />
                  <YAxis stroke="#acb9b3" allowDecimals={false} />
                  <Tooltip
                    content={<ChartTooltip />}
                    wrapperStyle={{ zIndex: 30 }}
                    cursor={{ fill: "rgba(221, 181, 96, 0.12)" }}
                  />
                  <Bar dataKey="listens" fill="#2a8f6d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="chart-card">
            <h2 className="chart-title">Epoch breakdown by year</h2>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={epochData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2f3a39" />
                  <XAxis dataKey="year" stroke="#acb9b3" />
                  <YAxis stroke="#acb9b3" allowDecimals={false} />
                  <Tooltip
                    content={<ChartTooltip hideZeroValues />}
                    wrapperStyle={{ zIndex: 30 }}
                    cursor={{ fill: "rgba(221, 181, 96, 0.12)" }}
                  />
                  <Legend wrapperStyle={{ color: "#e8ece9", fontSize: 12 }} />
                  {EPOCH_SERIES.map((epoch) => (
                    <Bar
                      key={epoch.key}
                      dataKey={epoch.key}
                      stackId="epochs"
                      fill={epoch.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}

export default StatsPage;
