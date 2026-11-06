import { parseArgs } from "node:util";

import { validatePack, type ContentPack } from "@cairn/content";

import { loadPack, packLabel } from "./pack";
import { simulate } from "./simulate";

function usage(): void {
  console.log(`Cairn CLI

Usage:
  cairn validate <pack.json|pack-dir> [--strict]
  cairn inspect <pack.json|pack-dir>
  cairn simulate --pack <pack.json|pack-dir> [--learners 20] [--seed 1]
                 [--max-steps 120] [--json]

A pack path can be a single JSON file or a directory containing
manifest.json, curriculum.json, items.json, rubrics.json,
misconceptions.json, labs.json, and policy.json.

Examples:
  cairn validate content-packs/docker-fundamentals
  cairn inspect content-packs/docker-fundamentals
  cairn simulate --pack content-packs/docker-fundamentals --learners 50`);
}

function readInt(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum = 1
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`--${name} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function printValidation(
  path: string,
  result: ReturnType<typeof validatePack>,
  strict: boolean
): number {
  const label = packLabel(path);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  for (const error of result.errors) console.error(`error: ${error}`);
  if (!result.ok) {
    console.error(`\n${label}: ${result.errors.length} error(s)`);
    return 1;
  }
  if (strict && result.warnings.length > 0) {
    console.error(`\n${label}: ${result.warnings.length} warning(s) with --strict`);
    return 1;
  }
  console.log(
    `${label}: ok (${result.pack?.curriculum.skills.length ?? 0} skills, ` +
      `${result.pack?.items.length ?? 0} items, ${result.pack?.labs.length ?? 0} labs)`
  );
  return 0;
}

async function loadValidPack(path: string): Promise<ContentPack> {
  const result = validatePack(await loadPack(path));
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (!result.ok || !result.pack) {
    for (const error of result.errors) console.error(`error: ${error}`);
    throw new Error(`${packLabel(path)} has validation errors`);
  }
  return result.pack;
}

function inspect(pack: ContentPack): void {
  const itemCounts: Record<string, number> = {};
  for (const item of pack.items) {
    itemCounts[item.type] = (itemCounts[item.type] ?? 0) + 1;
  }
  const itemSummary = Object.entries(itemCounts)
    .map(([type, count]) => `${type}:${count}`)
    .join(", ");
  const policy = pack.policy;

  console.log(`${pack.manifest.title} (${pack.manifest.id}@${pack.manifest.version})`);
  console.log(
    `Audience: ${pack.manifest.audience}, ${pack.manifest.level}, ` +
      `${pack.manifest.estimatedMinutes} minutes`
  );
  console.log(`Skills: ${pack.curriculum.skills.length}`);
  console.log(`Modules: ${pack.curriculum.modules.length}`);
  console.log(`Items: ${pack.items.length} (${itemSummary})`);
  console.log(`Labs: ${pack.labs.length}`);
  console.log(`Rubrics: ${pack.rubrics.length}`);
  console.log(`Misconceptions: ${pack.misconceptions.length}`);
  console.log(
    `Policy: ${policy.id}, mastery ${policy.masteryThreshold.toFixed(2)}, ` +
      `target success ${policy.targetSuccessMin.toFixed(2)}-${policy.targetSuccessMax.toFixed(2)}`
  );
}

async function main(): Promise<number> {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      pack: { type: "string" },
      learners: { type: "string" },
      seed: { type: "string" },
      "max-steps": { type: "string" },
      json: { type: "boolean" },
      strict: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  const command = parsed.positionals[0];
  const path = parsed.positionals[1] ?? parsed.values.pack;
  if (parsed.values.help || !command || command === "help") {
    usage();
    return command ? 0 : 1;
  }

  if (command === "validate") {
    if (!path) {
      usage();
      return 1;
    }
    return printValidation(
      path,
      validatePack(await loadPack(path)),
      Boolean(parsed.values.strict)
    );
  }

  if (command === "inspect") {
    if (!path) {
      usage();
      return 1;
    }
    inspect(await loadValidPack(path));
    return 0;
  }

  if (command === "simulate") {
    if (!path) {
      usage();
      return 1;
    }
    const pack = await loadValidPack(path);
    const report = await simulate(pack, {
      learners: readInt(parsed.values.learners, 20, "learners"),
      seed: readInt(parsed.values.seed, 1, "seed", 0),
      maxSteps: readInt(parsed.values["max-steps"], 120, "max-steps"),
    });
    if (parsed.values.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Cairn simulation: ${pack.manifest.title}`);
      console.log(
        `Learners: ${report.learners}, completed: ${report.completed} ` +
          `(${(report.completionRate * 100).toFixed(1)}%)`
      );
      console.log(`Average steps: ${report.averageSteps.toFixed(1)}`);
      console.log(`Average mastery: ${report.averageMastery.toFixed(3)}`);
      console.log(`Hit max steps: ${report.maxStepsHits}`);
      console.log(
        `Actions: ${Object.entries(report.actionCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([action, count]) => `${action}:${count}`)
          .join(", ")}`
      );
    }
    return 0;
  }

  usage();
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
