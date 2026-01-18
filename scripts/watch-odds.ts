import fs from "fs";
import path from "path";
import { recomputeOdds } from "./recompute-odds";

const dataPath = path.join(process.cwd(), "data", "poule-b.json");
const debounceMs = 300;

let timer: NodeJS.Timeout | null = null;

function schedule() {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(async () => {
    timer = null;
    console.log("Detected data change, recomputing odds...");
    try {
      await recomputeOdds();
    } catch (error) {
      console.error("Recompute failed:", error);
    }
  }, debounceMs);
}

console.log(`Watching ${dataPath} for changes...`);
fs.watch(dataPath, { persistent: true }, () => {
  schedule();
});

recomputeOdds().catch((error) => {
  console.error("Initial recompute failed:", error);
  process.exit(1);
});
