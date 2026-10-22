import { unstable_cache } from "next/cache";
import {
  loadData,
  loadOddsCache,
  findFocusTeamId,
  dataFingerprint,
} from "./data";
import { DEFAULT_SEED, PLAYOFF_CUTOFF, SOURCE_URL } from "./competition";
import {
  DEFAULT_PROBABILITY_SCALE,
  DEFAULT_HOME_ADV,
  MODEL_CONFIG,
  createProjectionModel,
} from "./projectionModel";
import { refreshEfficiencyData } from "./ffbbEfficiency";
import { simulateSeason } from "./simulate";
import { buildWinTable } from "./winTable";
import type { OddsCache } from "./types";
async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("FFBB returned " + response.status);
  return new TextDecoder("utf-8").decode(await response.arrayBuffer());
}
export const loadSnapshot = unstable_cache(
  async () => {
    const stored = loadData();
    let data = stored;
    try {
      data = await refreshEfficiencyData(
        await fetchText(SOURCE_URL),
        stored,
        fetchText,
      );
    } catch (error) {
      console.warn(
        "FFBB efficiency refresh unavailable; serving last complete Git snapshot.",
        error instanceof Error ? error.message : "Refresh failed",
      );
    }
    const dataAgeDays = (Date.now() - Date.parse(data.updated)) / 86400000;
    const comparable = { ...data, updated: stored.updated };
    const cache = loadOddsCache(comparable);
    if (cache) return { data, odds: cache, dataAgeDays };
    const params = {
      simulations: 20000,
      seed: DEFAULT_SEED,
      probabilityScale: DEFAULT_PROBABILITY_SCALE,
      homeAdv: DEFAULT_HOME_ADV,
      focusId: findFocusTeamId(data),
    };
    const odds: OddsCache = {
      ...createProjectionModel(data, params).metadata,
      ...simulateSeason(data, params),
      ...params,
      cutoff: PLAYOFF_CUTOFF,
      dataHash: dataFingerprint(data),
      updated: new Date().toISOString(),
      focusWinTable: buildWinTable(data, params.focusId, params),
    };
    return { data, odds, dataAgeDays };
  },
  ["vitre-group-b-2026-2027", JSON.stringify(MODEL_CONFIG)],
  { revalidate: 3600 },
);
