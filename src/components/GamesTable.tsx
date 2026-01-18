import type { Game, TeamRecord } from "@/lib/types";

interface GamesTableProps {
  games: Game[];
  teamsById: Record<string, TeamRecord>;
  title?: string;
}

function formatDate(date: string): string {
  if (!date) {
    return "TBD";
  }
  return date;
}

export default function GamesTable({ games, teamsById, title }: GamesTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      {title ? (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {title}
        </div>
      ) : null}
      <div className="divide-y divide-slate-100">
        {games.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No games scheduled.</div>
        ) : (
          games.map((game) => {
            const homeTeam = teamsById[game.home];
            const awayTeam = teamsById[game.away];
            const home = homeTeam?.name ?? game.home;
            const away = awayTeam?.name ?? game.away;
            const homeAbbr = homeTeam?.abbr ?? game.home;
            const awayAbbr = awayTeam?.abbr ?? game.away;
            return (
              <div
                key={game.id}
                className="grid grid-cols-12 gap-2 px-4 py-3 text-sm text-slate-700"
              >
                <div className="col-span-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {formatDate(game.date)}
                </div>
                <div className="col-span-4">
                  <div className="font-semibold text-slate-900">{away}</div>
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">
                    {awayAbbr}
                  </div>
                </div>
                <div className="col-span-1 text-center text-slate-400">@</div>
                <div className="col-span-4">
                  <div className="font-semibold text-slate-900">{home}</div>
                  <div className="text-xs uppercase tracking-[0.15em] text-slate-400">
                    {homeAbbr}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
