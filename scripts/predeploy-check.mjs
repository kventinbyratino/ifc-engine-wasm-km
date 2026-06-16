#!/usr/bin/env node
import { spawn } from "node:child_process";

const releaseGateCommands = [
  ["npm", ["run", "build"]],
  ["npm", ["run", "smoke:regression"]],
];

function formatCommand([command, args]) {
  return [command, ...args].join(" ");
}

function runCommand([command, args]) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${formatCommand([command, args])} failed with exit code ${code}`));
    });
  });
}

export async function runPredeployCheck({ dryRun = false } = {}) {
  if (dryRun) {
    console.log("predeploy-check plan:");
    releaseGateCommands.forEach((entry, index) => {
      console.log(`${index + 1}. ${formatCommand(entry)}`);
    });
    return;
  }

  for (const entry of releaseGateCommands) {
    console.log(`\n[predeploy-check] ${formatCommand(entry)}`);
    await runCommand(entry);
  }
  console.log("\npredeploy-check ok");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPredeployCheck({ dryRun: process.argv.includes("--dry-run") }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
