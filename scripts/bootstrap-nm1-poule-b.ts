import fs from "fs";
import path from "path";
import { parseRegularSeason } from "../src/lib/ffbb";
import { SOURCE_URL } from "../src/lib/competition";

async function main() {
  const response = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(30000),
    headers: { "User-Agent": "NM1-Odds/1.0", "Accept-Language": "fr-FR" },
  });
  if (!response.ok) throw new Error(`FFBB returned ${response.status}`);
  const data = parseRegularSeason(
    new TextDecoder("utf-8").decode(await response.arrayBuffer()),
  );
  const file = path.join(process.cwd(), "data", "poule-b.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(file + ".tmp", file);
  fs.writeFileSync(
    path.join(process.cwd(), "data", "teams-map.json"),
    JSON.stringify(
      data.teams.map(({ id, name, abbr }) => ({ id, name, abbr })),
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Validated ${data.season} Group B: ${data.teams.length} teams, ${data.games.length} games, ${data.games.filter((g) => g.played).length} results.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
