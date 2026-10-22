import { unstable_cache } from "next/cache";
import {
  loadData,
  loadOddsCache,
  findFocusTeamId,
  dataFingerprint,
} from "./data";
import { parseRegularSeason } from "./ffbb";
import { DEFAULT_SEED, PLAYOFF_CUTOFF, SOURCE_URL } from "./competition";
import {
  DEFAULT_PROBABILITY_SCALE,
  DEFAULT_HOME_ADV,
  MODEL_CONFIG,
  fitStrengthRatings,
} from "./model";
import { simulateSeason } from "./simulate";
import { buildWinTable } from "./winTable";
import type { OddsCache } from "./types";

// Vercel's persistent Data Cache keeps public-source refreshes independent of bot deploys.
// A refresh failure returns the last validated Git snapshot, with its original timestamp.
export const loadSnapshot = unstable_cache(
  async () => {
    let data = loadData();
    try {
      const response = await fetch(SOURCE_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`FFBB returned ${response.status}`);
      const fresh = parseRegularSeason(
        new TextDecoder("utf-8").decode(await response.arrayBuffer()),
      );
      if (fresh.season !== data.season)
        throw new Error(
          "Season changed: update competition configuration first.",
        );
      data = fresh;
    } catch (error) {
      console.warn(
        "FFBB live refresh unavailable; serving validated Git snapshot.",
        error instanceof Error ? error.message : "Refresh failed",
      );
    }
    // Ignore the checked-at timestamp when comparing an otherwise identical source snapshot.
    const stored = loadData();
    const comparable = { ...data, updated: stored.updated };
    const cache = loadOddsCache(comparable);
    if (cache) return { data, odds: cache };
    const params = {
      simulations: 20000,
      seed: DEFAULT_SEED,
      probabilityScale: DEFAULT_PROBABILITY_SCALE,
      homeAdv: DEFAULT_HOME_ADV,
      focusId: findFocusTeamId(data),
    };
    const odds: OddsCache = {
      ...MODEL_CONFIG,
      strengthRatings: fitStrengthRatings(data),
      ...simulateSeason(data, params),
      ...params,
      cutoff: PLAYOFF_CUTOFF,
      dataHash: dataFingerprint(data),
      updated: new Date().toISOString(),
      focusWinTable: buildWinTable(data, params.focusId, params),
    };
    return { data, odds };
  },
  ["vitre-group-b-2026-2027", JSON.stringify(MODEL_CONFIG)],
  { revalidate: 3600 },
);
