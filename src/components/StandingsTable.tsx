import { formatTopOdds } from "@/lib/format";
import type { TeamRecord } from "@/lib/types";

export interface StandingsRow {
  rank: number;
  team: TeamRecord;
  top7Odds: number;
  hasPlayoffChance?: boolean;
}

interface StandingsTableProps {
  rows: StandingsRow[];
}

export default function StandingsTable({ rows }: StandingsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <div className="grid grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        <div className="col-span-1">#</div>
        <div className="col-span-7">Team</div>
        <div className="col-span-2 text-right">W-L</div>
        <div className="col-span-2 text-right">Top 7</div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.team.id}
            className="grid grid-cols-12 gap-2 px-4 py-3 text-sm text-slate-700"
          >
            <div className="col-span-1 font-semibold text-slate-900">
              {row.rank}
            </div>
            <div className="col-span-7 flex flex-col">
              <span className="font-semibold text-slate-900">{row.team.name}</span>
              <span className="text-xs uppercase tracking-[0.15em] text-slate-400">
                {row.team.abbr}
              </span>
            </div>
            <div className="col-span-2 text-right font-medium text-slate-900">
              {row.team.wins}-{row.team.losses}
            </div>
            <div className="col-span-2 text-right font-semibold text-slate-900">
              {row.top7Odds <= 0 && row.hasPlayoffChance
                ? formatTopOdds(0.001, 1)
                : formatTopOdds(row.top7Odds, 1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
