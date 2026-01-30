"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatTopOdds } from "@/lib/format";
import { DEFAULT_HOME_ADV, DEFAULT_K, winProb } from "@/lib/model";
import type { ForcedOutcomes, Game, TeamRecord } from "@/lib/types";

interface OddsResponse {
  top7Odds: Record<string, number>;
  bestWorst: {
    roundDate: string;
    scenarios: number;
    best: { label: string; odds: number };
    worst: { label: string; odds: number };
  } | null;
  winTable?: WinTable | null;
  matchdayImpact?: MatchdayImpact | null;
}

interface SombWhatIfClientProps {
  teamId: string;
  teams: TeamRecord[];
  games: Game[];
  allRemainingGames: Game[];
}

type ToggleValue = "auto" | "win" | "loss";

interface WinTableRow {
  remainingWins: number;
  remainingLosses: number;
  wins: number;
  losses: number;
  winPct: number;
  rankProbs: number[];
  noPlayoffs: number;
}

interface WinTable {
  remainingGames: number;
  rows: WinTableRow[];
}

interface MatchdayImpactGame {
  game: Game;
  homeWinOdds: number;
  awayWinOdds: number;
  better: "home" | "away";
  delta: number;
}

interface MatchdayImpact {
  roundDate: string;
  games: MatchdayImpactGame[];
}

export default function SombWhatIfClient({
  teamId,
  teams,
  games,
  allRemainingGames,
}: SombWhatIfClientProps) {
  const [forcedOutcomes, setForcedOutcomes] = useState<ForcedOutcomes>({});
  const [odds, setOdds] = useState<number>(0);
  const [bestWorst, setBestWorst] = useState<OddsResponse["bestWorst"]>(null);
  const [winTable, setWinTable] = useState<WinTable | null>(null);
  const [matchdayImpact, setMatchdayImpact] = useState<MatchdayImpact | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const teamLookup = useMemo(() => {
    const map: Record<string, TeamRecord> = {};
    for (const team of teams) {
      map[team.id] = team;
    }
    return map;
  }, [teams]);

  const teamWpct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const team of teams) {
      const gamesPlayed = team.wins + team.losses;
      map[team.id] = gamesPlayed > 0 ? team.wins / gamesPlayed : 0.5;
    }
    return map;
  }, [teams]);

  const displayGames = useMemo(() => {
    return [...games].sort((a, b) => {
      if (a.date === "TBD" && b.date !== "TBD") {
        return 1;
      }
      if (b.date === "TBD" && a.date !== "TBD") {
        return -1;
      }
      return a.date.localeCompare(b.date);
    });
  }, [games]);

  useEffect(() => {
    let active = true;
    async function fetchOdds() {
      setLoading(true);
      const res = await fetch("/api/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          simulations: 5000,
          includeBestWorst: false,
          forcedOutcomes,
        }),
      });
      const json = (await res.json()) as OddsResponse;
      if (!active) {
        return;
      }
      setOdds(json.top7Odds?.[teamId] ?? 0);
      setBestWorst(json.bestWorst);
      setLoading(false);
    }
    fetchOdds();
    return () => {
      active = false;
    };
  }, [forcedOutcomes, teamId]);

  useEffect(() => {
    let active = true;
    async function fetchWinTable() {
      const res = await fetch("/api/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          includeWinTable: true,
        }),
      });
      const json = (await res.json()) as OddsResponse;
      if (!active) {
        return;
      }
      setWinTable(json.winTable ?? null);
    }
    fetchWinTable();
    return () => {
      active = false;
    };
  }, [teamId]);

  useEffect(() => {
    let active = true;
    async function fetchMatchdayImpact() {
      const res = await fetch("/api/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          includeMatchdayImpact: true,
        }),
      });
      const json = (await res.json()) as OddsResponse;
      if (!active) {
        return;
      }
      setMatchdayImpact(json.matchdayImpact ?? null);
    }
    fetchMatchdayImpact();
    return () => {
      active = false;
    };
  }, [teamId]);

  function toggleGame(game: Game, value: ToggleValue) {
    setForcedOutcomes((prev) => {
      const next = { ...prev };
      if (value === "auto") {
        delete next[game.id];
        return next;
      }
      const winner =
        value === "win"
          ? game.home === teamId
            ? "home"
            : "away"
          : game.home === teamId
            ? "away"
            : "home";
      next[game.id] = winner;
      return next;
    });
  }

  function currentToggle(game: Game): ToggleValue {
    const forced = forcedOutcomes[game.id];
    if (!forced) {
      return "auto";
    }
    const isWin =
      (forced === "home" && game.home === teamId) ||
      (forced === "away" && game.away === teamId);
    return isWin ? "win" : "loss";
  }

  function formatPct(value: number): string {
    const pct = value * 100;
    if (pct >= 99.5) {
      return ">99%";
    }
    if (pct > 0 && pct < 1) {
      return "<1%";
    }
    return `${pct.toFixed(0)}%`;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fee2e2,_#f8fafc_45%,_#e2e8f0)] px-6 pb-16 pt-12 text-slate-900 md:px-12">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-700">
              SOM Boulogne
            </p>
            <h1 className="font-display text-4xl font-semibold">What-If Simulator</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Force outcomes for SOMB games and see playoff odds refresh instantly.
              SOMB wins tiebreaks against every opponent.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Back to Standings
          </Link>
        </header>

        <section className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Remaining SOMB Games</h2>
            <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white/90 shadow-sm">
              <div className="grid grid-cols-12 gap-2 border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
                <div className="col-span-3">Date</div>
                <div className="col-span-6">Matchup</div>
                <div className="col-span-3 text-right">Force</div>
              </div>
              <div className="divide-y divide-rose-100">
                {displayGames.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No remaining games listed.
                  </div>
                ) : (
                  displayGames.map((game) => {
                    const home = teamLookup[game.home]?.name ?? game.home;
                    const away = teamLookup[game.away]?.name ?? game.away;
                    const homeWpct = teamWpct[game.home] ?? 0.5;
                    const awayWpct = teamWpct[game.away] ?? 0.5;
                    const pHome = winProb(
                      homeWpct,
                      awayWpct,
                      DEFAULT_K,
                      DEFAULT_HOME_ADV,
                    );
                    const pSombWin =
                      game.home === teamId ? pHome : game.away === teamId ? 1 - pHome : null;
                    const toggle = currentToggle(game);
                    return (
                      <div
                        key={game.id}
                        className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm text-slate-700"
                      >
                        <div className="col-span-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
                          {game.date || "TBD"}
                        </div>
                        <div className="col-span-6 font-semibold text-slate-900">
                          {away} @ {home}
                          {pSombWin !== null ? (
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
                              Model SOMB win {(pSombWin * 100).toFixed(1)}%
                            </div>
                          ) : null}
                        </div>
                        <div className="col-span-3 flex justify-end gap-1">
                          {(["auto", "win", "loss"] as ToggleValue[]).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleGame(game, value)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                                toggle === value
                                  ? "bg-rose-600 text-white"
                                  : "border border-rose-200 text-rose-600 hover:border-rose-300"
                              }`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Live Odds</h2>
            <div className="rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                Top-7 Probability
              </div>
              <div className="mt-3 text-4xl font-semibold text-slate-900">
                {loading ? "..." : formatTopOdds(odds, 1)}
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Simulated from {allRemainingGames.length} remaining games.
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                Next Matchday Impact (Single Game)
              </div>
              {matchdayImpact ? (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {matchdayImpact.roundDate}
                  </div>
                  <div className="space-y-3">
                    {matchdayImpact.games.map((impact) => {
                      const home = teamLookup[impact.game.home]?.name ?? impact.game.home;
                      const away = teamLookup[impact.game.away]?.name ?? impact.game.away;
                      const homeBetter = impact.better === "home";
                      return (
                        <div
                          key={`impact-${impact.game.id}`}
                          className="rounded-xl border border-rose-100 bg-white px-4 py-3"
                        >
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
                            {away} @ {home}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                            <div className={homeBetter ? "font-semibold text-emerald-600" : ""}>
                              {home} win: {formatTopOdds(impact.homeWinOdds, 1)} top 7
                            </div>
                            <div className={!homeBetter ? "font-semibold text-emerald-600" : ""}>
                              {away} win: {formatTopOdds(impact.awayWinOdds, 1)} top 7
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">No upcoming round detected.</div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            SOMB Outcomes by Remaining Wins
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white/90 shadow-sm">
            <table className="min-w-[860px] table-auto border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-rose-50 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">
                  <th className="px-3 py-2 text-left">Remaining Games Won</th>
                  <th className="px-3 py-2 text-left">Win% of Remaining</th>
                  <th className="px-3 py-2 text-center" colSpan={2}>
                    Resultant Record
                  </th>
                  <th className="px-3 py-2 text-center" colSpan={7}>
                    Finish Rank
                  </th>
                  <th className="px-3 py-2 text-center">No Playoffs</th>
                </tr>
                <tr className="bg-rose-50 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-400">
                  <th className="px-3 pb-2 text-left" />
                  <th className="px-3 pb-2 text-left" />
                  <th className="px-2 pb-2 text-center">W</th>
                  <th className="px-2 pb-2 text-center">L</th>
                  {Array.from({ length: 7 }, (_, idx) => (
                    <th key={`rank-${idx + 1}`} className="px-2 pb-2 text-center">
                      {idx + 1}
                    </th>
                  ))}
                  <th className="px-2 pb-2 text-center">8+</th>
                </tr>
              </thead>
              <tbody>
                {winTable ? (
                  [...winTable.rows]
                    .sort((a, b) => b.remainingWins - a.remainingWins)
                    .map((row) => (
                      <tr
                        key={`row-${row.remainingWins}`}
                        className="border-t border-rose-100"
                      >
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {row.remainingWins} of {winTable.remainingGames}
                        </td>
                        <td className="px-3 py-2">{formatPct(row.winPct)}</td>
                        <td className="px-2 py-2 text-center font-semibold">
                          {row.wins}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold">
                          {row.losses}
                        </td>
                        {row.rankProbs.slice(0, 7).map((prob, idx) => (
                          <td key={`prob-${row.remainingWins}-${idx}`} className="px-2 py-2 text-center">
                            {formatPct(prob)}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center font-semibold text-rose-600">
                          {formatPct(row.noPlayoffs)}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-sm text-slate-500" colSpan={12}>
                      Win table not available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
