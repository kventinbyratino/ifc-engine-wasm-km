import { execSync } from "node:child_process";

const url = process.env.KM_SMOKE_URL ?? "https://dev.lab-tim.ru/blue/km/";
const expectedCommit = (process.env.KM_EXPECTED_COMMIT ?? execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()) || "dev";

const response = await fetch(url, {
  headers: {
    "cache-control": "no-cache",
  },
});

if (!response.ok) {
  throw new Error(`Smoke failed: ${url} returned ${response.status} ${response.statusText}`);
}

const html = await response.text();
const checks = [
  ["build commit marker", expectedCommit],
  ["KM title", "IFC KM Viewer"],
  ["load button", "Загрузить IFC"],
  ["KM body marker", 'data-profile="km"'],
];

for (const [label, needle] of checks) {
  if (!html.includes(needle)) {
    throw new Error(`Smoke failed: missing ${label} (${needle}) in ${url}`);
  }
}

console.log(`Smoke OK: ${url} (${expectedCommit})`);
