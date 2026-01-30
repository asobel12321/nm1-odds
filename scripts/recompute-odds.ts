import fs from "fs";
import path from "path";
import { loadData, findSombId } from "../src/lib/data";
import { simulateSeason } from "../src/lib/simulate";
import { DEFAULT_HOME_ADV, DEFAULT_K } from "../src/lib/model";
import { buildMatchdayImpact } from "../src/lib/matchdayImpact";
import { buildWinTable } from "../src/lib/winTable";
import type { OddsCache } from "../src/lib/types";

const SIMULATIONS = 20000;

export async function recomputeOdds() {
  const data = loadData();
  const sombId = findSombId(data) ?? "SOMB";
  const result = simulateSeason(data, {
    simulations: SIMULATIONS,
    k: DEFAULT_K,
    homeAdv: DEFAULT_HOME_ADV,
    sombId,
  });
  const sombWinTable = buildWinTable(data, sombId, {
    simulations: SIMULATIONS,
    k: DEFAULT_K,
    homeAdv: DEFAULT_HOME_ADV,
    sombId,
  });
  const sombMatchdayImpact = buildMatchdayImpact(data, sombId, {
    simulations: SIMULATIONS,
    k: DEFAULT_K,
    homeAdv: DEFAULT_HOME_ADV,
    sombId,
  });

  const odds: OddsCache = {
    ...result,
    updated: new Date().toISOString(),
    simulations: SIMULATIONS,
    k: DEFAULT_K,
    homeAdv: DEFAULT_HOME_ADV,
    sombId,
    sombWinTable,
    sombMatchdayImpact,
  };

  const outputPath = path.join(process.cwd(), "data", "odds.json");
  fs.writeFileSync(outputPath, JSON.stringify(odds, null, 2));
  console.log(`Wrote odds cache to ${outputPath}`);
}

async function main() {
  await recomputeOdds();
}

main().catch((error) => {
  console.error("Recompute failed:", error);
  process.exit(1);
});
