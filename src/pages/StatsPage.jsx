import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getUserLogs } from "../services/logService";

const EPOCH_BUCKETS = ["Baroque", "Classical", "Romantic", "Modern", "Other"];

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

  const normalized = epoch.toLowerCase();

  if (normalized.includes("baroque")) {
    return "Baroque";
  }

  if (normalized.includes("classical")) {
    return "Classical";
  }

  if (normalized.includes("romantic")) {
    return "Romantic";
  }

  if (
    normalized.includes("modern") ||
    normalized.includes("20th") ||
    normalized.includes("21st") ||
    normalized.includes("contemporary")
  ) {
    return "Modern";
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
          EPOCH_BUCKETS.reduce(
            (accumulator, epochKey) => ({
              ...accumulator,
              [epochKey]: 0,
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
                  <XAxis dataKey="name" stroke="#acb9b3" />
                  <YAxis stroke="#acb9b3" allowDecimals={false} />
                  <Tooltip />
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
                  <Tooltip />
                  <Bar dataKey="Baroque" stackId="epochs" fill="#b88b3e" />
                  <Bar dataKey="Classical" stackId="epochs" fill="#ddb560" />
                  <Bar dataKey="Romantic" stackId="epochs" fill="#b45f5f" />
                  <Bar dataKey="Modern" stackId="epochs" fill="#5d7ebf" />
                  <Bar dataKey="Other" stackId="epochs" fill="#5a5a5a" />
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
