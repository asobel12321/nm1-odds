import type { BoxGame, TeamBox } from "./ffbbBoxScore";
import type { DataFile, TeamId } from "./types";
import { sigmoid } from "./model";

export const EFFICIENCY_CONFIG = {
  version: "adjusted-efficiency-draft-v1",
  ftCoefficient: 0.44,
  marginCap: 20,
  homeAdv: 3,
  ridge: 4,
  paceRidge: 4,
  probabilityScale: 10,
} as const;
export interface EfficiencyOptions {
  ftCoefficient: number;
  marginCap: number;
  homeAdv: number;
  ridge: number;
  paceRidge: number;
  probabilityScale: number;
}
export interface EfficiencyTeam {
  games: number;
  possessions: number;
  rawOffense: number | null;
  rawDefense: number | null;
  rawPace: number | null;
  adjustedOffense: number;
  adjustedDefense: number;
  net: number;
  pace: number;
}
export interface EfficiencyFit {
  config: EfficiencyOptions;
  averageEfficiency: number;
  averagePace: number;
  teams: Record<TeamId, EfficiencyTeam>;
  games: number;
}
export function estimatedPossessions(
  box: TeamBox,
  coefficient: number,
): number {
  return (
    box.twoAttempted +
    box.threeAttempted -
    box.offensiveRebounds +
    box.turnovers +
    coefficient * box.ftAttempted
  );
}
export function possessionData(game: BoxGame, coefficient = 0.44) {
  const home = estimatedPossessions(game.homeBox, coefficient),
    away = estimatedPossessions(game.awayBox, coefficient);
  const possessions = (home + away) / 2,
    pace = (possessions * 40) / game.minutes;
  if (
    ![home, away, possessions, pace].every(Number.isFinite) ||
    pace < 40 ||
    pace > 130 ||
    home <= 0 ||
    away <= 0
  )
    throw new Error("Implausible possessions: " + game.id);
  if ((Math.abs(home - away) * 40) / game.minutes > 20)
    throw new Error("Possession estimates disagree: " + game.id);
  return {
    possessions,
    pace,
    discrepancy: (Math.abs(home - away) * 40) / game.minutes,
  };
}
/** Small dense ridge least-squares solve; no external numerical dependency. */
function solve(
  rows: { x: number[]; y: number }[],
  penalties: number[],
): number[] {
  const n = penalties.length,
    m = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (j === i ? penalties[i] : 0)),
    );
  for (const { x, y } of rows)
    for (let i = 0; i < n; i++) {
      if (x[i] === 0) continue;
      m[i][n] += x[i] * y;
      for (let j = 0; j < n; j++) if (x[j] !== 0) m[i][j] += x[i] * x[j];
    }
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const d = m[col][col];
    if (Math.abs(d) < 1e-10) throw new Error("Singular efficiency system");
    for (let j = col; j <= n; j++) m[col][j] /= d;
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const k = m[i][col];
      for (let j = col; j <= n; j++) m[i][j] -= k * m[col][j];
    }
  }
  return m.map((row) => row[n]);
}
export function fitEfficiency(
  data: Pick<DataFile, "teams">,
  games: BoxGame[],
  options: Partial<EfficiencyOptions> = {},
): EfficiencyFit {
  const c: EfficiencyOptions = { ...EFFICIENCY_CONFIG, ...options };
  if (
    !Number.isFinite(c.homeAdv) ||
    ![c.ridge, c.paceRidge, c.probabilityScale, c.marginCap].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    !(c.ftCoefficient >= 0 && c.ftCoefficient <= 1)
  )
    throw new Error("Invalid efficiency options");
  const ids = data.teams.map((t) => t.id),
    n = ids.length,
    index = new Map(ids.map((id, i) => [id, i]));
  if (!n || index.size !== n) throw new Error("Invalid team IDs");
  const seen = new Set<string>(),
    rows: { x: number[]; y: number }[] = [],
    paceRows: { x: number[]; y: number }[] = [];
  const totals = Object.fromEntries(
    ids.map((id) => [
      id,
      { games: 0, possessions: 0, offense: 0, defense: 0, pace: 0 },
    ]),
  );
  for (const g of games) {
    const h = index.get(g.home),
      a = index.get(g.away);
    if (
      h == null ||
      a == null ||
      h === a ||
      seen.has(g.id) ||
      !g.played ||
      g.homeScore !== g.homeBox.points ||
      g.awayScore !== g.awayBox.points ||
      g.minutes !== g.homeBox.minutes ||
      g.minutes !== g.awayBox.minutes
    )
      throw new Error("Invalid efficiency game: " + g.id);
    seen.add(g.id);
    const { possessions, pace } = possessionData(g, c.ftCoefficient),
      mean = (g.homeScore + g.awayScore) / 2;
    const capped = Math.max(
      -c.marginCap,
      Math.min(c.marginCap, g.homeScore - g.awayScore),
    );
    // Preserve total scoring; cap only the differential, then neutralize venue once.
    const neutralHome =
      ((mean + capped / 2 - c.homeAdv / 2) * 100) / possessions;
    const neutralAway =
      ((mean - capped / 2 + c.homeAdv / 2) * 100) / possessions;
    for (const [off, def, y] of [
      [h, a, neutralHome],
      [a, h, neutralAway],
    ]) {
      const x = Array(1 + 2 * n).fill(0);
      x[0] = 1;
      x[1 + off] = 1;
      x[1 + n + def] = 1;
      rows.push({ x, y });
    }
    const px = Array(1 + n).fill(0);
    px[0] = 1;
    px[1 + h] = 1;
    px[1 + a] = 1;
    paceRows.push({ x: px, y: pace });
    for (const [id, scored, allowed] of [
      [g.home, g.homeScore, g.awayScore],
      [g.away, g.awayScore, g.homeScore],
    ] as [string, number, number][]) {
      const t = totals[id];
      t.games++;
      t.possessions += possessions;
      t.offense += (100 * scored) / possessions;
      t.defense += (100 * allowed) / possessions;
      t.pace += pace;
    }
  }
  // With no observations the net prior is zero. Baselines are explicit cold-start
  // conveniences only; equal teams still get sigmoid(3/10), never last year's ratings.
  const coeff = games.length
    ? solve(rows, [0, ...Array(2 * n).fill(c.ridge)])
    : [100, ...Array(2 * n).fill(0)];
  const tempo = games.length
    ? solve(paceRows, [0, ...Array(n).fill(c.paceRidge)])
    : [75, ...Array(n).fill(0)];
  const teams = Object.fromEntries(
    ids.map((id, i) => {
      const t = totals[id],
        off = coeff[0] + coeff[1 + i],
        def = coeff[0] + coeff[1 + n + i];
      return [
        id,
        {
          games: t.games,
          possessions: t.possessions,
          rawOffense: t.games ? t.offense / t.games : null,
          rawDefense: t.games ? t.defense / t.games : null,
          rawPace: t.games ? t.pace / t.games : null,
          adjustedOffense: off,
          adjustedDefense: def,
          net: off - def,
          pace: tempo[0] + 2 * tempo[1 + i],
        },
      ];
    }),
  );
  return {
    config: c,
    averageEfficiency: coeff[0],
    averagePace: tempo[0],
    teams,
    games: games.length,
  };
}
export function predictEfficiency(
  fit: EfficiencyFit,
  home: TeamId,
  away: TeamId,
) {
  if (home === away || !fit.teams[home] || !fit.teams[away])
    throw new Error("Invalid matchup");
  const h = fit.teams[home],
    a = fit.teams[away],
    possessions = (h.pace + a.pace) / 2;
  const homeEfficiency =
    h.adjustedOffense + a.adjustedDefense - fit.averageEfficiency;
  const awayEfficiency =
    a.adjustedOffense + h.adjustedDefense - fit.averageEfficiency;
  const margin =
    ((homeEfficiency - awayEfficiency) * possessions) / 100 +
    fit.config.homeAdv;
  return {
    possessions,
    homeEfficiency,
    awayEfficiency,
    homeScore: (homeEfficiency * possessions) / 100 + fit.config.homeAdv / 2,
    awayScore: (awayEfficiency * possessions) / 100 - fit.config.homeAdv / 2,
    margin,
    homeWinProbability: sigmoid(margin / fit.config.probabilityScale),
  };
}
