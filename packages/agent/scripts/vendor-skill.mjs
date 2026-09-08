#!/usr/bin/env node
/**
 * packages/agent/scripts/vendor-skill.mjs
 * Vendors the escalation logic from packages/ into the publishable skill.
 * Owner: Aryan
 *
 * WHY THIS EXISTS
 *
 * The skill in skills/autonomous-incident-escalation/ is submitted to
 * CALLE-AI/awesome-phone-call-agents, where `../../../packages/...` resolves
 * to nothing. It has to be self-contained.
 *
 * But hand-copying the prompt and the decision logic into the skill creates
 * two sources of truth, and the copy is exactly where a safety rule quietly
 * gets lost. So: packages/ stays authoritative, and this script generates the
 * skill's scripts/lib/ from it. Same approach as result-schema.json.
 *
 * USAGE (from the repo root)
 *   node packages/agent/scripts/vendor-skill.mjs           regenerate
 *   node packages/agent/scripts/vendor-skill.mjs --check   fail if stale
 *
 * The vendored files land flat in scripts/lib/, so every relative import is
 * rewritten to "./<basename>".
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// packages/agent/scripts/ → repo root
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUT_DIR = join(ROOT, "skills", "autonomous-incident-escalation", "scripts", "lib");

/** source path → vendored module name */
const MODULES = [
  ["packages/types/index.ts", "types"],
  ["packages/calle/schema.ts", "schema"],
  ["packages/calle/prompt.ts", "prompt"],
  ["packages/calle/progress.ts", "progress"],
  ["packages/calle/planCall.ts", "planCall"],
  ["packages/agent/state.ts", "state"],
  ["packages/agent/nodes/assessIncident.ts", "assessIncident"],
  ["packages/agent/nodes/selectResponder.ts", "selectResponder"],
  ["packages/agent/nodes/decide.ts", "decide"],
  ["packages/agent/nodes/escalate.ts", "escalate"],
];

/** Every vendored module sits in one flat directory. */
function rewriteImports(source) {
  return source.replace(
    /(\bfrom\s+")(\.[^"]*)(")/g,
    (_match, prefix, specifier, suffix) => {
      let name = basename(specifier);
      // packages/types is imported as "../types" but its file is index.ts
      if (name === "types" || name === "index") name = "types";
      return `${prefix}./${name}${suffix}`;
    }
  );
}

const BANNER = (sourcePath) =>
  `/**\n` +
  ` * VENDORED — do not edit.\n` +
  ` *\n` +
  ` * Generated from ${sourcePath} by packages/agent/scripts/vendor-skill.mjs.\n` +
  ` * Edit the source file and re-run the generator; edits here are overwritten.\n` +
  ` */\n\n`;

function build() {
  const files = new Map();
  for (const [sourcePath, moduleName] of MODULES) {
    const absolute = join(ROOT, sourcePath);
    if (!existsSync(absolute)) {
      console.error(`vendor-skill: missing source ${sourcePath}`);
      process.exit(1);
    }
    const source = readFileSync(absolute, "utf8");
    files.set(`${moduleName}.ts`, BANNER(sourcePath) + rewriteImports(source));
  }
  return files;
}

const files = build();
const check = process.argv.includes("--check");

if (check) {
  let stale = [];
  const existing = existsSync(OUT_DIR) ? new Set(readdirSync(OUT_DIR)) : new Set();

  for (const [name, content] of files) {
    const path = join(OUT_DIR, name);
    if (!existsSync(path) || readFileSync(path, "utf8") !== content) stale.push(name);
    existing.delete(name);
  }
  for (const orphan of existing) stale.push(`${orphan} (orphaned)`);

  if (stale.length) {
    console.error(
      `vendor-skill: skill/scripts/lib is stale:\n  ${stale.join("\n  ")}\n\n` +
      `Run: node scripts/vendor-skill.mjs`
    );
    process.exit(1);
  }
  console.log(`vendor-skill: up to date (${files.size} modules).`);
} else {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, content] of files) {
    writeFileSync(join(OUT_DIR, name), content);
  }
  console.log(`vendor-skill: wrote ${files.size} modules to scripts/lib/`);
  for (const [, name] of MODULES) console.log(`  ${name}.ts`);
}
