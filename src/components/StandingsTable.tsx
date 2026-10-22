import type { TeamRecord } from "@/lib/types";
import { FOCUS_TEAM_ID, PLAYOFF_CUTOFF } from "@/lib/competition";
export interface StandingsRow {
  rank: number;
  team: TeamRecord;
  playoffOdds: number;
}
export default function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <div className="table-scroll">
      <table className="standings">
        <caption className="sr-only">
          Group B standings ranked by winning percentage and simulated top-seven
          chances
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team</th>
            <th scope="col">GP</th>
            <th scope="col">W–L</th>
            <th scope="col">Win %</th>
            <th scope="col">Top 7</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.team.id}
              className={`${row.team.id === FOCUS_TEAM_ID ? "focus-row" : ""} ${row.rank === PLAYOFF_CUTOFF ? "cutoff-row" : ""}`}
            >
              <td>
                <span
                  className={
                    row.rank <= PLAYOFF_CUTOFF ? "rank qualified" : "rank"
                  }
                >
                  {row.rank}
                </span>
              </td>
              <th scope="row">
                {row.team.name}
                {row.team.id === FOCUS_TEAM_ID && (
                  <span className="you-tag">YOUR TEAM</span>
                )}
              </th>
              <td>{row.team.wins + row.team.losses}</td>
              <td>
                {row.team.wins}–{row.team.losses}
              </td>
              <td>
                {(
                  (100 * row.team.wins) /
                  (row.team.wins + row.team.losses || 1)
                ).toFixed(1)}
                %
              </td>
              <td>
                <div className="table-odds">
                  {(100 * row.playoffOdds).toFixed(1)}%
                  <span className="mini-track">
                    <span style={{ width: `${100 * row.playoffOdds}%` }} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
