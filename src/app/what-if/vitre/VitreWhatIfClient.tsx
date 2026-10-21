"use client";
import Link from "next/link";
import { useState } from "react";
import { PLAYOFF_CUTOFF } from "@/lib/competition";
import type { DataFile, ForcedOutcomes, SimResult } from "@/lib/types";
export default function VitreWhatIfClient({
  data,
  teamId,
  baseline,
}: {
  data: DataFile;
  teamId: string;
  baseline: number | null;
}) {
  const [picks, setPicks] = useState<ForcedOutcomes>({});
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const remaining = data.games.filter((g) => !g.played);
  const display = remaining.filter(
    (g) => showAll || g.home === teamId || g.away === teamId,
  );
  const teams = Object.fromEntries(data.teams.map((t) => [t.id, t]));
  const odds = result?.playoffOdds[teamId] ?? baseline;
  async function run() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forcedOutcomes: picks }),
      });
      if (!response.ok)
        throw new Error("The simulation could not finish. Please try again.");
      setResult(await response.json());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to calculate.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="site-shell">
      <nav className="site-nav wrap">
        <Link href="/" className="brand">
          <span className="brand-mark">V</span> VITRÉ{" "}
          <span className="brand-sub">/ WHAT IF</span>
        </Link>
        <Link href="/">← Back to the race</Link>
      </nav>
      <main className="wrap scenario-main">
        <span className="eyebrow">
          {data.season} · GROUP B · TOP {PLAYOFF_CUTOFF}
        </span>
        <h1>Write the next chapter.</h1>
        <p className="muted">
          Pick winners for Vitré and its rivals. Unpicked games follow the
          model.
        </p>
        <div className="scenario-summary">
          <div aria-live="polite">
            <span className="eyebrow">
              {result ? "LAST CALCULATED SCENARIO" : "BASELINE"}
            </span>
            <strong>
              {odds === null ? "—" : `${(100 * odds).toFixed(1)}%`}
            </strong>
            <span>
              chance of upper-group qualification
              {dirty ? " · Picks changed; recalculate below." : ""}
            </span>
            {result && baseline !== null && (
              <p>
                {((odds! - baseline) * 100).toFixed(1)} percentage points vs
                baseline
              </p>
            )}
          </div>
          <div className="scenario-actions">
            <button className="primary-link" disabled={loading} onClick={run}>
              {loading ? "Simulating…" : "Calculate scenario ↗"}
            </button>
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => {
                setPicks({});
                setResult(null);
                setDirty(false);
                setError("");
              }}
            >
              Reset picks
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="error-note">
            {error}
          </p>
        )}
        <div className="scenario-toolbar">
          <h2>
            {showAll
              ? "All remaining Group B games"
              : "Vitré’s remaining games"}
          </h2>
          <label>
            <input
              type="checkbox"
              checked={showAll}
              disabled={loading}
              onChange={(e) => setShowAll(e.target.checked)}
            />{" "}
            Include rivals’ games
          </label>
          <span className="muted">
            {Object.keys(picks).length} results picked
          </span>
        </div>
        <div className="scenario-fixtures">
          {display.map((g) => (
            <div className="scenario-game" key={g.id}>
              <span className="muted small">{g.date} · France</span>
              <strong>
                {teams[g.away].name} @ {teams[g.home].name}
              </strong>
              <label className="sr-only" htmlFor={`pick-${g.id}`}>
                Winner: {teams[g.away].name} at {teams[g.home].name}
              </label>
              <select
                id={`pick-${g.id}`}
                value={picks[g.id] ?? "auto"}
                disabled={loading}
                onChange={(e) => {
                  const next = { ...picks };
                  if (e.target.value === "auto") delete next[g.id];
                  else next[g.id] = e.target.value as "home" | "away";
                  setPicks(next);
                  setDirty(true);
                }}
              >
                <option value="auto">Model decides</option>
                <option value="home">{teams[g.home].name} win</option>
                <option value="away">{teams[g.away].name} win</option>
              </select>
            </div>
          ))}
        </div>
        <p className="footnote">
          {remaining.length} remaining fixtures. Scenarios use 5,000 simulations
          with the same seed for comparable picks. Baseline uses 20,000. Future
          wins use a one-point margin for tiebreaks.
        </p>
        <Link href="/" className="text-link">
          ← Standings, methodology & source
        </Link>
      </main>
    </div>
  );
}
