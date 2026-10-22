import VitreWhatIfClient from "./VitreWhatIfClient";
import { findFocusTeamId } from "@/lib/data";
import { loadSnapshot } from "@/lib/snapshot";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function WhatIfPage() {
  const { data, odds } = await loadSnapshot();
  const publicData = { ...data };
  delete publicData.boxScores;
  delete publicData.boxScoreSources;
  return (
    <VitreWhatIfClient
      data={publicData}
      teamId={findFocusTeamId(data)}
      baseline={odds.playoffOdds[findFocusTeamId(data)] ?? null}
    />
  );
}
