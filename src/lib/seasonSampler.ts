import { createRng } from "./rng";
import { createProjectionModel, type GameForecast } from "./projectionModel";
import { resolveStandingsByTiebreaks } from "./tiebreak";
import type {
  DataFile,
  Game,
  GameResult,
  GameScore,
  SimParams,
  TeamId,
} from "./types";

export function sampleGameScore(
  forecast: GameForecast,
  draw: number,
  scale: number,
  forced?: GameResult,
): GameScore {
  const p = forecast.homeWinProbability;
  const homeWon = forced ? forced === "home" : draw < p;
  // The same draw picks the winner and margin. Forcing a winner samples only
  // its side of the logistic distribution, without advancing the RNG again.
  const conditional =
    forced === "home"
      ? p * draw
      : forced === "away"
        ? p + (1 - p) * draw
        : draw;
  const u = Math.min(1 - 1e-12, Math.max(1e-12, conditional));
  const margin = forecast.margin + scale * Math.log((1 - u) / u);
  const spread = Math.max(1, Math.round(homeWon ? margin : -margin));
  const loser = Math.max(
    0,
    Math.round((forecast.homeScore + forecast.awayScore - spread) / 2),
  );
  return homeWon
    ? { homeScore: loser + spread, awayScore: loser }
    : { homeScore: loser, awayScore: loser + spread };
}

/** Shared season draws for headline, win targets and conditional scenarios. */
export function createSeasonSampler(
  data: DataFile,
  params: SimParams,
  forecastFor?: (game: Game) => GameForecast,
) {
  const predict = forecastFor ?? createProjectionModel(data, params).forecast;
  const rng = createRng(params.seed ?? Date.now());
  const baseWins: Record<TeamId, number> = {};
  const pointsWithoutWins: Record<TeamId, number> = {};
  const remainingCounts: Record<TeamId, number> = {};
  for (const team of data.teams) {
    baseWins[team.id] = team.wins;
    remainingCounts[team.id] = 0;
  }
  const fixtures = data.games
    .filter((game) => !game.played)
    .map((game) => {
      remainingCounts[game.home]++;
      remainingCounts[game.away]++;
      return {
        game,
        forecast: predict(game),
        forced: params.forcedOutcomes?.[game.id],
      };
    });
  const indexes = new Map(fixtures.map(({ game }, index) => [game.id, index]));
  const draws = new Float64Array(fixtures.length);
  for (const team of data.teams) {
    // Start with the FFBB table. Each future game awards one point plus
    // another for a win; existing reported points are kept as recorded.
    pointsWithoutWins[team.id] =
      (team.points ?? 2 * team.wins + team.losses) +
      remainingCounts[team.id] -
      team.wins;
  }
  function sampleWins() {
    const wins = { ...baseWins };
    for (let i = 0; i < fixtures.length; i++) {
      const { game, forecast, forced } = fixtures[i];
      const draw = rng();
      draws[i] = draw;
      const homeWon = forced
        ? forced === "home"
        : draw < forecast.homeWinProbability;
      wins[homeWon ? game.home : game.away]++;
    }
    return wins;
  }
  const pointsFor = (id: TeamId, wins: Record<TeamId, number>) =>
    pointsWithoutWins[id] + wins[id];
  function rank(wins: Record<TeamId, number>, teams = data.teams) {
    return resolveStandingsByTiebreaks(teams, wins, {
      classificationPoints: Object.fromEntries(
        teams.map(({ id }) => [id, pointsFor(id, wins)]),
      ),
      games: data.games,
      scoreFor: (game) => {
        const index = indexes.get(game.id);
        if (index === undefined) return undefined;
        const { forecast, forced } = fixtures[index];
        return sampleGameScore(
          forecast,
          draws[index],
          params.probabilityScale,
          forced,
        );
      },
    });
  }
  return { sampleWins, rank, pointsFor, remainingCounts };
}
