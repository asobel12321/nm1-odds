import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { loadData, findFocusTeamId, dataFingerprint } from "../src/lib/data";
import { DEFAULT_HOME_ADV, DEFAULT_K } from "../src/lib/model";
import { DEFAULT_SEED, PLAYOFF_CUTOFF } from "../src/lib/competition";
import { simulateSeason } from "../src/lib/simulate";
import { buildWinTable } from "../src/lib/winTable";
import type { OddsCache } from "../src/lib/types";

export async function recomputeOdds() {
  const data = loadData();
  const focusId = findFocusTeamId(data);
  const params = {
    simulations: 20000,
    k: DEFAULT_K,
    homeAdv: DEFAULT_HOME_ADV,
    seed: DEFAULT_SEED,
    focusId,
  };
  const odds: OddsCache = {
    ...simulateSeason(data, params),
    ...params,
    cutoff: PLAYOFF_CUTOFF,
    dataHash: dataFingerprint(data),
    updated: new Date().toISOString(),
    focusWinTable: buildWinTable(data, focusId, params),
  };
  const file = path.join(process.cwd(), "data", "odds.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(odds, null, 2) + "\n");
  fs.renameSync(file + ".tmp", file);
  console.log(
    `Vitré top-seven estimate: ${(100 * odds.playoffOdds[focusId]).toFixed(1)}% (${params.simulations} simulations).`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  recomputeOdds().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
