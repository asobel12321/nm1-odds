import Link from "next/link";
import StandingsTable from "@/components/StandingsTable";
import GamesTable from "@/components/GamesTable";
import {
  findSombId,
  loadData,
  loadOddsCache,
  remainingGames,
  teamsById,
} from "@/lib/data";
import { DEFAULT_HOME_ADV, DEFAULT_K } from "@/lib/model";
import { simulateSeason } from "@/lib/simulate";

export default function Home() {
  const data = loadData();
  const remaining = remainingGames(data.games);
  const sombId = findSombId(data) ?? "SOMB";
  const cached = loadOddsCache();
  const simulation =
    cached && cached.sombId === sombId
      ? cached
      : simulateSeason(data, {
          simulations: 5000,
          k: DEFAULT_K,
          homeAdv: DEFAULT_HOME_ADV,
          sombId,
        });
  const teamLookup = teamsById(data.teams);
  const rows = [...data.teams]
    .sort((a, b) => {
      const aGames = a.wins + a.losses;
      const bGames = b.wins + b.losses;
      const aPct = aGames > 0 ? a.wins / aGames : 0;
      const bPct = bGames > 0 ? b.wins / bGames : 0;
      if (bPct !== aPct) {
        return bPct - aPct;
      }
      if (a.id === sombId && b.id !== sombId) {
        return -1;
      }
      if (b.id === sombId && a.id !== sombId) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((team, index) => ({
      rank: index + 1,
      team,
      top7Odds: simulation.top7Odds[team.id] ?? 0,
    }));
  const upcoming = [...remaining].sort((a, b) => {
    if (a.date === "TBD" && b.date !== "TBD") {
      return 1;
    }
    if (b.date === "TBD" && a.date !== "TBD") {
      return -1;
    }
    return a.date.localeCompare(b.date);
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#f8fafc_45%,_#e2e8f0)] px-6 pb-16 pt-12 text-slate-900 md:px-12">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
              NM1 Poule B
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Playoff odds, matchups, and momentum at a glance.
            </h1>
            <p className="max-w-xl text-base text-slate-600">
              Updated using current standings and a simple win% + home-court model.
              Toggle SOMB outcomes for a custom what-if view.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-white/80 p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
              Next tools
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">SOMB What-If</div>
                <div className="text-xs text-slate-500">Force wins & losses</div>
              </div>
              <Link
                href="/what-if/somb"
                className="rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-amber-500"
              >
                Open
              </Link>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Simulations: {cached?.simulations ?? 5000} • k={DEFAULT_K} • homeAdv=
              {DEFAULT_HOME_ADV}
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Current Standings</h2>
            <StandingsTable rows={rows} />
          </div>
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Upcoming Games</h2>
            <GamesTable games={upcoming} teamsById={teamLookup} />
          </div>
        </section>
      </main>
    </div>
  );
}
