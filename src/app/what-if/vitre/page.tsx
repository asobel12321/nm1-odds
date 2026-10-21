import VitreWhatIfClient from "./VitreWhatIfClient";
import { findFocusTeamId } from "@/lib/data";
import { loadSnapshot } from "@/lib/snapshot";
export const dynamic = "force-dynamic";
export default async function WhatIfPage() {
  const { data, odds } = await loadSnapshot();
  return (
    <VitreWhatIfClient
      data={data}
      teamId={findFocusTeamId(data)}
      baseline={odds.playoffOdds[findFocusTeamId(data)] ?? null}
    />
  );
}
