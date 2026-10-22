import { loadSnapshot } from "@/lib/snapshot";
import Link from "next/link";
import StandingsTable from "@/components/StandingsTable";
import { findFocusTeamId, remainingGames, teamsById } from "@/lib/data";
import {
  DEFAULT_HOME_ADV,
  DEFAULT_PROBABILITY_SCALE,
  createProjectionModel,
  MODEL_CONFIG,
} from "@/lib/projectionModel";
import {
  DEFAULT_SEED,
  PLAYOFF_CUTOFF,
  RULES_URL,
  SOURCE_URL,
} from "@/lib/competition";
import { simulateSeason } from "@/lib/simulate";
import { selectWinTarget } from "@/lib/winTable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Home() {
  const { data, odds: cache, dataAgeDays: ageDays } = await loadSnapshot();
  const focusId = findFocusTeamId(data);
  const result =
    cache ??
    simulateSeason(data, {
      simulations: 5000,
      seed: DEFAULT_SEED,
      probabilityScale: DEFAULT_PROBABILITY_SCALE,
      homeAdv: DEFAULT_HOME_ADV,
      focusId,
    });
  const lookup = teamsById(data.teams);
  const team = lookup[focusId];
  const projection = createProjectionModel(data);
  const strengthRatings = cache?.strengthRatings ?? projection.strengthRatings;
  const remaining = remainingGames(data.games).filter(
    (g) => g.home === focusId || g.away === focusId,
  );
  const odds = result.playoffOdds[focusId];
  const ranks = result.rankHist[focusId];
  const expectedWins = result.winHist[focusId].reduce(
    (sum, p, i) => sum + p * i,
    0,
  );
  const updated = new Date(data.updated).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const rows = [...data.teams]
    .sort((a, b) => {
      const aPct = a.wins / (a.wins + a.losses || 1);
      const bPct = b.wins / (b.wins + b.losses || 1);
      return bPct - aPct || a.officialRank! - b.officialRank!;
    })
    .map((t, index) => ({
      rank: index + 1,
      team: t,
      playoffOdds: result.playoffOdds[t.id],
      powerRating: strengthRatings[t.id],
    }));
  const samples =
    cache?.focusWinTable?.rows.filter((row) => row.samples >= 100) ?? [];
  const target = selectWinTarget(cache?.focusWinTable);
  return (
    <div className="site-shell">
      <nav className="site-nav wrap">
        <Link href="/" className="brand">
          <span className="brand-mark">V</span> VITRÉ{" "}
          <span className="brand-sub">/ THE TOP SEVEN RACE</span>
        </Link>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">
          FFBB official ↗
        </a>
      </nav>
      <main className="wrap" data-model-version={MODEL_CONFIG.modelVersion}>
        <header className="intro">
          <span className="eyebrow">
            NM1 · {data.season} · PHASE 1 · GROUP B
          </span>
          <span className="data-date">
            <span className="status-dot" /> Data checked {updated}
          </span>
        </header>
        {ageDays > 2 && (
          <p className="stale-note">
            This is a saved snapshot from {updated}. Results since then are not
            included.
          </p>
        )}
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow green">AURORE VITRÉ BASKET BRETAGNE</div>
            <h1>
              The road to
              <br />
              the <em>top seven.</em>
            </h1>
            <p>
              One target: finish in Group B’s top seven.
              <br />
              Earn a place in the upper group for phase two.
            </p>
            {remaining.length > 0 && (
              <div className="win-target-callout">
                <span className="eyebrow green">90%+ TOP-SEVEN TARGET</span>
                {target ? (
                  <>
                    <p>
                      Vitré’s target: win{" "}
                      <strong>
                        {target.remainingWins} of the {remaining.length}{" "}
                        remaining games
                      </strong>{" "}
                      for a <strong>90%+ estimated chance</strong> of finishing
                      in the top seven.
                    </p>
                    <span className="target-detail">
                      That’s a {target.wins}–{target.losses} finish ·{" "}
                      {(100 * (1 - target.noPlayoffs)).toFixed(1)}% model
                      estimate. Results elsewhere still matter.
                    </span>
                  </>
                ) : (
                  <p>
                    A 90% win target isn’t available from the current simulation
                    samples yet.
                  </p>
                )}
              </div>
            )}
            <Link className="primary-link" href="/what-if/vitre">
              Explore Vitré’s scenarios <span>↗</span>
            </Link>
            <div className="hero-foot">
              {remaining.length} games left. Every result changes the race.
            </div>
          </div>
          <div className="odds-card">
            <div className="card-top">
              <span>PHASE 2 · UPPER GROUP</span>
              <span className="estimate-tag">MODEL ESTIMATE</span>
            </div>
            <div className="big-odds">
              {(100 * odds).toFixed(1)}
              <span>%</span>
            </div>
            <p>chance of finishing in the top {PLAYOFF_CUTOFF}</p>
            <div className="odds-track">
              <span style={{ width: `${100 * odds}%` }} />
            </div>
            <div className="odds-labels">
              <span>Miss top 7 · {(100 * (1 - odds)).toFixed(1)}%</span>
              <span>Qualify · {(100 * odds).toFixed(1)}%</span>
            </div>
            <div className="card-stats">
              <div>
                <strong>
                  {team.wins}–{team.losses}
                </strong>
                <span>CURRENT RECORD</span>
              </div>
              <div>
                <strong>
                  {team.officialRank}
                  <small> / {data.teams.length}</small>
                </strong>
                <span>OFFICIAL POSITION</span>
              </div>
              <div>
                <strong>{expectedWins.toFixed(1)}</strong>
                <span>PROJECTED WINS</span>
              </div>
            </div>
          </div>
        </section>
        <div className="context-strip">
          <span className="strip-icon">↳</span>
          <p>
            <strong>The line is seventh.</strong> Places 1–7 advance to phase
            two’s upper group (Groupe A). Places 8–13 enter the lower group.{" "}
            <a href={RULES_URL} target="_blank" rel="noreferrer">
              Competition format ↗
            </a>
          </p>
        </div>
        <section className="dashboard-grid">
          <div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">THE FIELD</span>
                <h2>Group B standings</h2>
              </div>
              <span className="muted small">
                Dashed line = qualification cutoff
              </span>
            </div>
            <StandingsTable rows={rows} />
            <p className="footnote">
              Displayed positions are ranked by winning percentage, with equal
              percentages ordered by FFBB position. Qualification odds still use
              the season simulations and tiebreak calculations. Power rating is
              adjusted net efficiency in points per 100 possessions; positive
              means above the Group B average.
            </p>
          </div>
          <aside>
            <div className="section-heading">
              <div>
                <span className="eyebrow">UP NEXT</span>
                <h2>Vitré’s schedule</h2>
              </div>
              <span className="muted small">Win chance</span>
            </div>
            <div className="fixture-list">
              {remaining.slice(0, 5).map((g) => {
                const home = g.home === focusId;
                const opponent = lookup[home ? g.away : g.home];
                const hp = projection.homeProbability(g);
                return (
                  <div key={g.id} className="fixture">
                    <div className="fixture-date">
                      {new Date(
                        g.date.slice(0, 10) + "T12:00:00Z",
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        timeZone: "Europe/Paris",
                      })}
                      <span>{home ? "HOME" : "AWAY"}</span>
                    </div>
                    <div>
                      <strong>
                        {home ? "vs " : "@ "}
                        {opponent.name}
                      </strong>
                      <span className="muted small">
                        {g.date.slice(11)} · France time
                      </span>
                    </div>
                    <strong className="fixture-prob">
                      {(100 * (home ? hp : 1 - hp)).toFixed(0)}%
                    </strong>
                  </div>
                );
              })}
            </div>
            <Link href="/what-if/vitre" className="text-link">
              All {remaining.length} games & what-if picks ↗
            </Link>
            <div className="note-card">
              <span className="eyebrow">GAMES IN HAND MATTER</span>
              <h3>
                A position is a snapshot.
                <br />A probability looks ahead.
              </h3>
              <p>
                Vitré has played {team.wins + team.losses} of{" "}
                {team.wins + team.losses + remaining.length} games. The forecast
                accounts for every team’s remaining schedule and home court.
              </p>
            </div>
          </aside>
        </section>
        <section className="distribution-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE RANGE OF OUTCOMES</span>
              <h2>Where could Vitré finish?</h2>
            </div>
            <span className="muted small">Green positions qualify</span>
          </div>
          <div className="rank-chart">
            {ranks.map((p, i) => (
              <div className="rank-column" key={i}>
                <span className="bar-value">{(100 * p).toFixed(1)}%</span>
                <div className="bar-well">
                  <div
                    className={
                      i < PLAYOFF_CUTOFF ? "rank-bar qualifying" : "rank-bar"
                    }
                    style={{
                      height: `${Math.max(1, (p / Math.max(...ranks)) * 100)}%`,
                    }}
                  />
                </div>
                <span
                  className={
                    i < PLAYOFF_CUTOFF ? "rank-label green" : "rank-label"
                  }
                >
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="bottom-grid">
          <div>
            <span className="eyebrow">THE WIN TARGET</span>
            <h2>What might be enough?</h2>
            <p className="muted">
              Qualification chances at different final records, conditional on
              reaching that record in the simulation.
            </p>
            <div className="win-targets">
              {samples
                .filter(
                  (row) =>
                    row.wins >= Math.round(expectedWins) - 2 &&
                    row.wins <= Math.round(expectedWins) + 2,
                )
                .map((row) => (
                  <div className="target-row" key={row.wins}>
                    <strong>
                      {row.wins}–{row.losses}
                    </strong>
                    <span className="mini-track">
                      <span
                        style={{ width: `${100 * (1 - row.noPlayoffs)}%` }}
                      />
                    </span>
                    <strong>{(100 * (1 - row.noPlayoffs)).toFixed(1)}%</strong>
                  </div>
                ))}
            </div>
            <p className="footnote">
              Only records with at least 100 simulated samples are shown. A win
              total is an estimate, never a guaranteed clinch.
            </p>
          </div>
          <div className="method-card">
            <span className="eyebrow">READ THE MODEL</span>
            <h2>Transparent by design.</h2>
            <p>
              {(cache?.simulations ?? 5000).toLocaleString("en-US")} seeded
              season simulations use separate opponent-adjusted offensive and
              defensive ratings from this season’s completed Group B box scores.
              Adjusted offense (ORTG) is points scored per 100 possessions
              against an average defense; adjusted defense (DRTG) is points
              allowed against an average offense. Power rating = adjusted ORTG −
              adjusted DRTG. Higher offense, lower defense and a positive net
              rating are better.
            </p>
            <p>
              Estimated possessions = field-goal attempts − offensive rebounds +
              turnovers + 0.44 × free-throw attempts. We average both teams’
              estimates for each game. Pace is adjusted for opponents and
              expressed per 40 minutes, including overtime normalization. The
              free-throw coefficient is an approximation, not a measured NM1
              constant.
            </p>
            <p>
              For fitting, we cap each game’s scoring margin at ±20 points while
              preserving total scoring, then remove the three-point home edge.
              Offense, defense and pace are fitted together against the teams
              actually faced, with a shrinkage weight of four pulling early
              estimates toward the group average. Each game has equal weight.
              Last season’s roster ratings do not carry over.
            </p>
            <p>
              Expected home margin = (home net rating − away net rating) ×
              projected possessions / 100 + 3 points. Home win probability = 1 /
              (1 + exp(−expected margin / 10)). Equal-rated teams give the home
              side a 57.4% chance. Ratings stay fixed within each simulated
              season and are refitted as validated box scores arrive.
            </p>
            <p>
              Direct-game tiebreaks use recorded scores. Future wins use a
              one-point margin; unresolved ties share positions equally. Scores
              and possession inputs must validate together; an incomplete FFBB
              update retains the last complete snapshot.
            </p>
            <p>
              This is a transparent efficiency model inspired by KenPom, not
              KenPom’s proprietary rating. The initial 39-game comparison was
              essentially even with our previous margin model; independent
              historical efficiency validation is still pending. Home advantage,
              shrinkage and the probability scale remain provisional. These are
              model estimates, not official FFBB forecasts. Injuries, future
              roster changes and point deductions are not predicted.
            </p>
            <a
              className="text-link"
              href="https://nm1.ffbb.com/saison-reguliere/leaders/equipes"
              target="_blank"
              rel="noreferrer"
            >
              Source: FFBB team statistics ↗
            </a>
          </div>
        </section>
        <footer className="site-footer">
          <span>VITRÉ / NM1 ODDS</span>
          <span>
            Phase 1 ends 19 February 2027 · Upper group begins 5 March
          </span>
          <a
            href="https://github.com/asobel12321/nm1-odds"
            target="_blank"
            rel="noreferrer"
          >
            View source ↗
          </a>
        </footer>
      </main>
    </div>
  );
}
