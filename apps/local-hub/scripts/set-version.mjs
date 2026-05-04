#!/usr/bin/env node
// Sets the local-hub version across package.json, tauri.conf.json, Cargo.toml.
// Invoked by the release workflow and runnable locally:
//   node apps/local-hub/scripts/set-version.mjs 2026.5.4

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");

const version = process.argv[2];
if (!version) {
  console.error("Usage: set-version.mjs <version>");
  process.exit(1);
}

// CalVer YYYY.M.D with optional `-N` for multiple-per-day (semver pre-release).
if (!/^\d{4}\.\d{1,2}\.\d{1,2}(-[A-Za-z0-9.]+)?$/.test(version)) {
  console.error(`Bad version "${version}" — expected YYYY.M.D or YYYY.M.D-N`);
  process.exit(1);
}

const setJsonVersion = (relPath) => {
  const p = resolve(APP_ROOT, relPath);
  const data = JSON.parse(readFileSync(p, "utf8"));
  data.version = version;
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  console.log(`  ${relPath} → ${version}`);
};

setJsonVersion("package.json");
setJsonVersion("src-tauri/tauri.conf.json");

const cargoPath = resolve(APP_ROOT, "src-tauri/Cargo.toml");
const cargo = readFileSync(cargoPath, "utf8");
const next = cargo.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`,
);
if (next === cargo) {
  console.error("Failed to update Cargo.toml [package].version");
  process.exit(1);
}
writeFileSync(cargoPath, next);
console.log(`  src-tauri/Cargo.toml → ${version}`);
