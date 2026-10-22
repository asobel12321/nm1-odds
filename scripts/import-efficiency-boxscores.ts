import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { load } from "cheerio";
import { parseRegularSeason } from "../src/lib/ffbb";
import { parseBoxScore, type BoxGame } from "../src/lib/ffbbBoxScore";
import { possessionData } from "../src/lib/efficiency";
const source = "https://nm1.ffbb.com/saison-reguliere";
const refresh = process.argv.includes("--refresh");
const dir = path.resolve("outputs/efficiency"),
  raw = path.join(dir, "raw");
fs.mkdirSync(raw, { recursive: true });
async function page(url: string, key: string) {
  const file = path.join(raw, key + ".html"),
    meta = file + ".json";
  if (!refresh && fs.existsSync(file))
    return {
      html: fs.readFileSync(file, "utf8"),
      ...JSON.parse(fs.readFileSync(meta, "utf8")),
    };
  let error: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "NM1-Odds research/1.0" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text(),
        info = {
          url,
          retrieved: new Date().toISOString(),
          sha256: crypto.createHash("sha256").update(html).digest("hex"),
        };
      fs.writeFileSync(file, html);
      fs.writeFileSync(meta, JSON.stringify(info, null, 2));
      return { html, ...info };
    } catch (e) {
      error = e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw error;
}
async function main() {
  const root = await page(source, "schedule"),
    data = parseRegularSeason(root.html, root.retrieved);
  const $ = load(root.html),
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
      .get();
    const href = e.find("a[href*='/match/']").first().attr("href");
    if (ids.length === 2 && href)
      links.set(ids.join("-"), new URL(href, source).href);
  });
  const completed = data.games.filter((g) => g.played),
    boxes: BoxGame[] = [],
    errors: { id: string; error: string }[] = [],
    manifest: unknown[] = [];
  let index = 0;
  async function worker() {
    while (index < completed.length) {
      const game = completed[index++];
      try {
        const url = links.get(game.id);
        if (!url) throw new Error("Missing match link");
        const p = await page(url, game.id),
          box = parseBoxScore(p.html, game, url);
        const possessions = possessionData(box);
        boxes.push(box);
        manifest.push({
          id: game.id,
          url,
          retrieved: p.retrieved,
          sha256: p.sha256,
          minutes: box.minutes,
          possessions: possessions.possessions,
          discrepancy: possessions.discrepancy,
        });
        console.log(
          "Validated " + boxes.length + "/" + completed.length + " " + game.id,
        );
      } catch (e) {
        errors.push({ id: game.id, error: String(e) });
        console.log("REJECTED " + game.id + " " + String(e));
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await Promise.all([worker(), worker()]);
  boxes.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const statsUrl = source + "/leaders/equipes",
    stats = await page(statsUrl, "team-leaders"),
    s = load(stats.html);
  const standingsAudit: unknown[] = [];
  s("main table tbody tr").each((_, row) => {
    const cells = s(row).find("td"),
      id = cells
        .eq(0)
        .find("a[href*='/equipe/']")
        .attr("href")
        ?.match(/\/equipe\/(\d+)-/)?.[1];
    if (!id || !data.teams.some((t) => t.id === id)) return;
    const own = boxes
      .filter((g) => g.home === id || g.away === id)
      .map((g) => (g.home === id ? g.homeBox : g.awayBox));
    const fields = {
      points: 2,
      twoAttempted: 5,
      threeAttempted: 8,
      ftAttempted: 11,
      offensiveRebounds: 14,
      turnovers: 18,
    } as const;
    const discrepancies: string[] = [];
    if (Number(cells.eq(1).text()) !== own.length)
      discrepancies.push("game count");
    for (const [field, column] of Object.entries(fields)) {
      const avg =
          own.reduce((n, b) => n + b[field as keyof typeof b], 0) / own.length,
        reported = Number(cells.eq(column).text().trim());
      if (!Number.isFinite(reported) || Math.abs(avg - reported) > 0.051)
        discrepancies.push(field + ": " + avg + " versus " + reported);
    }
    standingsAudit.push({
      id,
      matched: discrepancies.length === 0,
      discrepancies,
    });
  });
  const audit = {
    created: new Date().toISOString(),
    expected: completed.length,
    validated: boxes.length,
    errors,
    schedule: { url: source, retrieved: root.retrieved, sha256: root.sha256 },
    teamLeaders: {
      url: statsUrl,
      retrieved: stats.retrieved,
      sha256: stats.sha256,
      teams: standingsAudit,
    },
    games: manifest,
  };
  fs.writeFileSync(
    path.join(dir, "source-audit.json"),
    JSON.stringify(audit, null, 2) + "\n",
  );
  if (errors.length || boxes.length !== completed.length)
    throw new Error(
      "Incomplete box scores; experimental input was not replaced. See source-audit.json",
    );
  if (
    standingsAudit.length !== data.teams.length ||
    standingsAudit.some((x) => !(x as { matched: boolean }).matched)
  )
    throw new Error(
      "Team leaders do not reconcile; experimental input was not replaced. See source-audit.json",
    );
  fs.mkdirSync("data/experimental", { recursive: true });
  const output = "data/experimental/poule-b-boxscores.json";
  fs.writeFileSync(
    output + ".tmp",
    JSON.stringify(
      {
        schema: 1,
        source: statsUrl,
        updated: root.retrieved,
        data,
        boxes,
        audit,
      },
      null,
      2,
    ) + "\n",
  );
  fs.renameSync(output + ".tmp", output);
  console.log(
    "Saved " +
      boxes.length +
      " validated box scores for " +
      data.teams.length +
      " teams",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
