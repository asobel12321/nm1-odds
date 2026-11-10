import Link from "next/link";
import type { BestCaseResult, NextGameResult, TeamRecord } from "@/lib/types";

function displayDate(value: string) {
  return new Date(value.slice(0, 10) + "T12:00:00Z").toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", timeZone: "Europe/Paris" },
  );
}
function percentage(odds: number) {
  return (100 * odds).toFixed(1) + "%";
}

export default function UpcomingScenarios({
  nextGame,
  bestCase,
  teams,
  focusId,
  currentOdds,
}: {
  nextGame?: NextGameResult | null;
  bestCase?: BestCaseResult | null;
  teams: Record<string, TeamRecord>;
  focusId: string;
  currentOdds: number;
}) {
  if (!nextGame && !bestCase) return null;
  const game = nextGame?.game;
  const home = game?.home === focusId;
  const opponent = game ? teams[home ? game.away : game.home] : null;
  return (
    <section className="upcoming-scenarios" aria-labelledby="upcoming-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE NEXT STEP</span>
          <h2 id="upcoming-title">How the next results change the race.</h2>
          {game && opponent && (
            <p className="small muted next-game-fixture">
              Next game: {home ? "vs " : "@ "}
              {opponent.name} · {displayDate(game.date)} · {game.date.slice(11)}{" "}
              France time
            </p>
          )}
        </div>
        <span className="small muted">
          Current top-seven chance: {percentage(currentOdds)}
        </span>
      </div>
      <div className="upcoming-grid">
        {nextGame && (
          <>
            <article className="outlook-card outlook-win">
              <h3>If Vitré wins next game</h3>
              <strong className="outlook-odds">
                {percentage(nextGame.winOdds)}
              </strong>
              <span className="small muted">
                chance of finishing in the top seven
              </span>
            </article>
            <article className="outlook-card">
              <h3>If Vitré loses next game</h3>
              <strong className="outlook-odds">
                {percentage(nextGame.lossOdds)}
              </strong>
              <span className="small muted">
                chance of finishing in the top seven
              </span>
            </article>
          </>
        )}
        {bestCase && (
          <article className="outlook-card outlook-best">
            <h3>Best-case round</h3>
            <strong className="outlook-odds">
              {percentage(bestCase.odds)}
            </strong>
            <span className="small muted">
              top-seven chance if every listed result happens
            </span>
          </article>
        )}
      </div>
      {bestCase && (
        <details className="round-details">
          <summary>
            Best-round results ·{" "}
            {bestCase.roundNumber != null
              ? "Round " + bestCase.roundNumber
              : "Next matchday"}{" "}
            · {displayDate(bestCase.roundDate)}
            {displayDate(bestCase.roundDate) !==
            displayDate(bestCase.roundEndDate)
              ? "–" + displayDate(bestCase.roundEndDate)
              : ""}
          </summary>
          <ul>
            {bestCase.games.map((g) => {
              const winner =
                bestCase.outcomes[g.id] === "home" ? g.home : g.away;
              const loser = winner === g.home ? g.away : g.home;
              return (
                <li key={g.id} className={winner === focusId ? "green" : ""}>
                  <span>
                    <strong>{teams[winner].name}</strong> beat{" "}
                    {teams[loser].name}
                  </span>
                  <span className="small muted">
                    {displayDate(g.date)} · {g.date.slice(11)} France time
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <p className="footnote outlook-note">
        Each estimate is conditional on the stated results; other games follow
        the current ratings. These are scenarios, not clinches.{" "}
        <Link href="/what-if/vitre" className="text-link">
          Try your own results ↗
        </Link>
      </p>
    </section>
  );
}
