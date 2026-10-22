import { load } from "cheerio";
import { createHash } from "node:crypto";
import { parseRegularSeason } from "./ffbb";
import { parseBoxScore, type BoxGame } from "./ffbbBoxScore";
import { possessionData } from "./efficiency";
import { SOURCE_URL } from "./competition";
import type { DataFile } from "./types";
export type FetchText = (url: string) => Promise<string>;
export function assertEfficiencyCoverage(data: DataFile) {
  const completed = data.games.filter((g) => g.played),
    boxes = data.boxScores ?? [],
    lookup = new Map(boxes.map((g) => [g.id, g]));
  if (boxes.length !== completed.length || lookup.size !== boxes.length)
    throw new Error("Incomplete or duplicate efficiency box scores");
  for (const g of completed) {
    const box = lookup.get(g.id);
    if (
      !box ||
      box.home !== g.home ||
      box.away !== g.away ||
      box.homeScore !== g.homeScore ||
      box.awayScore !== g.awayScore ||
      box.date !== g.date
    )
      throw new Error("Efficiency box score disagrees with fixture: " + g.id);
    possessionData(box);
  }
}
export function reconcileTeamStatistics(html: string, data: DataFile) {
  const $ = load(html),
    ids = new Set<string>();
  $("main table tbody tr").each((_, row) => {
    const cells = $(row).find("td"),
      id = cells
        .eq(0)
        .find("a[href*='/equipe/']")
        .attr("href")
        ?.match(/\/equipe\/(\d+)-/)?.[1];
    if (!id || !data.teams.some((t) => t.id === id)) return;
    if (ids.has(id)) throw new Error("Duplicate team statistics");
    ids.add(id);
    const own = (data.boxScores ?? [])
      .filter((g) => g.home === id || g.away === id)
      .map((g) => (g.home === id ? g.homeBox : g.awayBox));
    if (!own.length || Number(cells.eq(1).text()) !== own.length)
      throw new Error("Team statistics game count mismatch: " + id);
    for (const [field, column] of Object.entries({
      points: 2,
      twoAttempted: 5,
      threeAttempted: 8,
      ftAttempted: 11,
      offensiveRebounds: 14,
      turnovers: 18,
    })) {
      const avg =
          own.reduce((n, b) => n + b[field as keyof typeof b], 0) / own.length,
        reported = Number(cells.eq(column).text().trim());
      if (!Number.isFinite(reported) || Math.abs(avg - reported) > 0.051)
        throw new Error("Team statistics disagree: " + id + " " + field);
    }
  });
  if (ids.size !== data.teams.length)
    throw new Error("Incomplete team statistics");
}
/** Complete snapshot or throw. Never mix new results with stale possession inputs. */
export async function refreshEfficiencyData(
  html: string,
  previous: DataFile,
  fetchText: FetchText,
  refreshAll = false,
): Promise<DataFile> {
  const fresh = parseRegularSeason(html);
  if (fresh.season !== previous.season)
    throw new Error("Season changed: update competition configuration first");
  const $ = load(html),
    links = new Map<string, string>();
  $(".display-games__third-list__entry").each((_, el) => {
    const e = $(el);
    if (!/Group B\b/.test(e.find(".game__day").text())) return;
    const ids = e
        .find(".display-games__third-list__entry__team")
        .map(
          (_, n) =>
            $(n)
              .find("img")
              .attr("src")
              ?.match(/\/team\/(\d+)\./)?.[1],
        )
        .get(),
      href = e.find("a[href*='/match/']").first().attr("href");
    if (ids.length === 2 && href)
      links.set(ids.join("-"), new URL(href, SOURCE_URL).href);
  });
  const prior = new Map((previous.boxScores ?? []).map((g) => [g.id, g])),
    completed = fresh.games.filter((g) => g.played);
  const boxes: BoxGame[] = [],
    sources: NonNullable<DataFile["boxScoreSources"]> = {};
  const collect = async (force: boolean) => {
    boxes.length = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < completed.length) {
        const game = completed[cursor++],
          old = prior.get(game.id);
        if (
          !force &&
          old &&
          old.home === game.home &&
          old.away === game.away &&
          old.homeScore === game.homeScore &&
          old.awayScore === game.awayScore
        ) {
          boxes.push({
            ...old,
            ...game,
            played: true,
            homeScore: old.homeScore,
            awayScore: old.awayScore,
          });
          if (previous.boxScoreSources?.[game.id])
            sources[game.id] = previous.boxScoreSources[game.id];
          continue;
        }
        const url = links.get(game.id);
        if (!url) throw new Error("Missing box-score URL: " + game.id);
        const text = await fetchText(url),
          box = parseBoxScore(text, game, url);
        possessionData(box);
        boxes.push(box);
        sources[game.id] = {
          url,
          retrieved: new Date().toISOString(),
          sha256: createHash("sha256").update(text).digest("hex"),
        };
      }
    };
    await Promise.all([worker(), worker()]);
    boxes.sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  };
  await collect(refreshAll);
  const stats = await fetchText(SOURCE_URL + "/leaders/equipes");
  const assemble = (): DataFile => ({
    ...fresh,
    boxScores: [...boxes],
    boxScoreSources: { ...sources },
  });
  let candidate = assemble();
  assertEfficiencyCoverage(candidate);
  try {
    reconcileTeamStatistics(stats, candidate);
  } catch (error) {
    if (refreshAll) throw error;
    // Attempts/rebounds can be corrected without changing the final score.
    await collect(true);
    candidate = assemble();
    assertEfficiencyCoverage(candidate);
    reconcileTeamStatistics(stats, candidate);
  }
  return candidate;
}
