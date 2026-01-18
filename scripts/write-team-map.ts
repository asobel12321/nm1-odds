import fs from "fs";
import path from "path";
import { loadData } from "../src/lib/data";

async function main() {
  const data = loadData();
  const map = data.teams.map((team) => ({
    id: team.id,
    abbr: team.abbr,
    name: team.name,
  }));

  const outputPath = path.join(process.cwd(), "data", "teams-map.json");
  fs.writeFileSync(outputPath, JSON.stringify(map, null, 2));
  console.log(`Wrote team map to ${outputPath}`);
}

main().catch((error) => {
  console.error("Team map failed:", error);
  process.exit(1);
});
