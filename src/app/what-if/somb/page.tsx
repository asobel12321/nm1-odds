import SombWhatIfClient from "@/app/what-if/somb/SombWhatIfClient";
import { findSombId, loadData, remainingGames } from "@/lib/data";

export default function SombWhatIfPage() {
  const data = loadData();
  const sombId = findSombId(data) ?? "SOMB";
  const sombGames = remainingGames(data.games).filter(
    (game) => game.home === sombId || game.away === sombId,
  );

  return (
    <SombWhatIfClient
      teamId={sombId}
      teams={data.teams}
      games={sombGames}
      allRemainingGames={remainingGames(data.games)}
    />
  );
}
