import Link from "next/link";
import type { BestCaseResult, TeamRecord } from "@/lib/types";
function displayDate(value: string) {
  return new Date(value.slice(0, 10) + "T12:00:00Z").toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", timeZone: "Europe/Paris" },
  );
}
export default function BestCaseRound({
  scenario,
  teams,
  currentOdds,
}: {
  scenario: BestCaseResult;
  teams: Record<string, TeamRecord>;
  currentOdds: number;
}) {
  const start = displayDate(scenario.roundDate),
    end = displayDate(scenario.roundEndDate);
  return (
    <section className="best-case-section" aria-labelledby="best-case-title">
      <div className="best-case-copy">
        <span className="eyebrow green">
          {scenario.roundNumber != null
            ? "ROUND " + scenario.roundNumber
            : "NEXT MATCHDAY"}{" "}
          · {start}
          {start !== end ? "–" + end : ""}
        </span>
        <h2 id="best-case-title">The best round for Vitré.</h2>
        <p>
          If all these results happen, Vitré’s projected chance of finishing in
          the top seven becomes:
        </p>
        <div className="best-case-odds">
          {(100 * scenario.odds).toFixed(1)}
          <span>%</span>
        </div>
        <p className="small muted">
          Current estimate: {(100 * currentOdds).toFixed(1)}% ·{" "}
          {scenario.odds >= currentOdds ? "+" : ""}
          {((scenario.odds - currentOdds) * 100).toFixed(1)} percentage points
        </p>
      </div>
      <div className="best-case-results">
        <span className="eyebrow">RESULTS TO ROOT FOR</span>
        <ul>
          {scenario.games.map((g) => {
            const winner = scenario.outcomes[g.id] === "home" ? g.home : g.away,
              loser = winner === g.home ? g.away : g.home;
            return (
              <li
                key={g.id}
                className={winner === "269" ? "best-case-vitre" : ""}
              >
                <span>
                  <strong>{teams[winner].name}</strong> beat {teams[loser].name}
                </span>
                <span className="small muted">
                  {displayDate(g.date)} · {g.date.slice(11)} France time
                </span>
              </li>
            );
          })}
        </ul>
        <p className="footnote">
          The most favorable combination in the model, conditional on all listed
          results. Other remaining games follow the current ratings. This is a
          scenario estimate, not a clinch.
        </p>
        <Link href="/what-if/vitre" className="text-link">
          Try your own results ↗
        </Link>
      </div>
    </section>
  );
}
