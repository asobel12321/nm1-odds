import fs from "fs";
import path from "path";
import { refreshEfficiencyData } from "../src/lib/ffbbEfficiency";
import { loadData } from "../src/lib/data";
import { SOURCE_URL } from "../src/lib/competition";
async function fetchText(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { "User-Agent": "NM1-Odds/1.0", "Accept-Language": "fr-FR" },
  });
  if (!response.ok) throw new Error("FFBB returned " + response.status);
  return new TextDecoder("utf-8").decode(await response.arrayBuffer());
}
async function main() {
  const data = await refreshEfficiencyData(
    await fetchText(SOURCE_URL),
    loadData(),
    fetchText,
    process.argv.includes("--refresh-boxes"),
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
    "Validated " +
      data.season +
      " Group B: " +
      data.teams.length +
      " teams, " +
      data.games.length +
      " games, " +
      data.boxScores!.length +
      " complete box scores.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
