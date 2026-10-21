import { NextResponse } from "next/server";
import { findFocusTeamId } from "@/lib/data";
import { loadSnapshot } from "@/lib/snapshot";
import { DEFAULT_HOME_ADV, DEFAULT_K } from "@/lib/model";
import { DEFAULT_SEED } from "@/lib/competition";
import { simulateSeason } from "@/lib/simulate";
import type { ForcedOutcomes } from "@/lib/types";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Expected an object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const { data, odds } = await loadSnapshot();
  const raw = input.forcedOutcomes ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return NextResponse.json({ error: "Invalid outcomes." }, { status: 400 });
  const remaining = new Set(
    data.games.filter((g) => !g.played).map((g) => g.id),
  );
  for (const [id, result] of Object.entries(raw)) {
    if (!remaining.has(id) || (result !== "home" && result !== "away"))
      return NextResponse.json(
        { error: "Choose a valid result for a remaining game." },
        { status: 400 },
      );
  }
  const forcedOutcomes = raw as ForcedOutcomes;
  const cache = Object.keys(forcedOutcomes).length === 0 ? odds : null;
  const params = {
    simulations: 5000,
    k: DEFAULT_K,
    homeAdv: DEFAULT_HOME_ADV,
    seed: DEFAULT_SEED,
    focusId: findFocusTeamId(data),
    forcedOutcomes,
  };
  const result = cache ?? simulateSeason(data, params);
  return NextResponse.json({
    ...result,
    simulations: cache?.simulations ?? params.simulations,
  });
}
