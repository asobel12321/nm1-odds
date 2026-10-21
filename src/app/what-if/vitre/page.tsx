import VitreWhatIfClient from "./VitreWhatIfClient";
import { loadData, loadOddsCache, findFocusTeamId } from "@/lib/data";
export default function WhatIfPage() {
  const data = loadData();
  return (
    <VitreWhatIfClient
      data={data}
      teamId={findFocusTeamId(data)}
      baseline={loadOddsCache(data)?.playoffOdds[findFocusTeamId(data)] ?? null}
    />
  );
}
