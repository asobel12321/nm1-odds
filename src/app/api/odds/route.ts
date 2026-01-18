import { NextResponse } from "next/server";
import { findSombId, loadData, loadOddsCache } from "@/lib/data";
import { DEFAULT_HOME_ADV, DEFAULT_K } from "@/lib/model";
import { simulateSeason } from "@/lib/simulate";
import { bestWorstNextRound } from "@/lib/bestWorst";
import type { ForcedOutcomes } from "@/lib/types";

interface OddsRequest {
  simulations?: number;
  k?: number;
  homeAdv?: number;
  teamId?: string;
  includeBestWorst?: boolean;
  forcedOutcomes?: ForcedOutcomes;
}

export async function POST(req: Request) {
  const body = (await req.json()) as OddsRequest;
  const data = loadData();
  const simulations = body.simulations ?? 5000;
  const k = body.k ?? DEFAULT_K;
  const homeAdv = body.homeAdv ?? DEFAULT_HOME_ADV;
  const teamId = body.teamId ?? "SOMB";
  const sombId = findSombId(data) ?? "SOMB";
  const forcedOutcomes = body.forcedOutcomes ?? {};
  const cached = loadOddsCache();
  const shouldUseCache =
    Object.keys(forcedOutcomes).length === 0 &&
    !body.includeBestWorst &&
    cached &&
    cached.sombId === sombId;

  if (shouldUseCache) {
    return NextResponse.json({
      top7Odds: cached.top7Odds,
      rankHist: cached.rankHist,
      winHist: cached.winHist,
      bestWorst: null,
    });
  }

  const result = simulateSeason(data, {
    simulations,
    k,
    homeAdv,
    sombId,
    forcedOutcomes,
  });

  const bestWorst = body.includeBestWorst
    ? bestWorstNextRound(data, teamId, {
        simulations,
        k,
        homeAdv,
        sombId,
        forcedOutcomes,
      })
    : null;

  return NextResponse.json({
    top7Odds: result.top7Odds,
    rankHist: result.rankHist,
    winHist: result.winHist,
    bestWorst,
  });
}
