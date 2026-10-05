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
import { EPOCH_SERIES, getHeardYear, toEpochBucket } from "../lib/epochs";
import { firstRelation } from "../lib/utils";
import { getUserLogs } from "../services/logService";

function extractComposer(work) {
  return firstRelation(work?.composers) || {};
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
    let ignore = false;

    async function loadLogs() {
      if (!user?.id) {
        setLogs([]);
        return;
      }

      try {
        const data = await getUserLogs(user.id);

        if (!ignore) {
          setLogs(data);
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
      .map(([name, works]) => ({ name, works }))
      .sort((left, right) => right.works - left.works)
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
            Composers and periods of the works you attended.
          </p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {heardLogs.length === 0 ? (
        <p className="text-muted">
          No attended works yet. Mark pieces as attended to populate charts.
        </p>
      ) : (
        <section className="chart-grid">
          <article className="chart-card">
            <h2 className="chart-title">Composers with most attended works</h2>
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
                  <Bar dataKey="works" name="Attended works" fill="#2a8f6d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="chart-card">
            <h2 className="chart-title">Attended works by year and epoch</h2>
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
