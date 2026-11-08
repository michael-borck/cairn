/**
 * Usage:
 *   node dist/cli.js simulate [--learners 300] [--days 24] [--seed 42] [--out bundle.json]
 *   node dist/cli.js harness <bundle.json> [--force] [--candidate policy-overrides.json] [--self-check]
 *
 * Always prints the prediction report first. The policy report runs only if prediction acceptance
 * passed, or with --force.
 */
import { readFileSync, writeFileSync } from 'fs';
import { DEFAULT_POLICY, PolicyParams, withPolicy } from './params';
import { DataBundle, comparePolicies, evaluatePrediction, formatPolicyReport, formatPredictionReport } from './harness';
import { simulate } from './simulate';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function run(bundle: DataBundle, candidate: PolicyParams, force: boolean, selfCheck = false) {
  const pred = evaluatePrediction(bundle);
  console.log(formatPredictionReport(pred));
  console.log('');
  if (!pred.acceptance.passed && !force) {
    console.log('=== 2. POLICY DIFFERENCES: SKIPPED ===');
    console.log('Prediction acceptance failed. Fix the model first, or rerun with --force to see differences anyway.');
    process.exitCode = 2;
    return;
  }
  if (selfCheck) {
    console.log('--- Self-check: logging policy replayed against its own logs (expect agreement ~1, difference ~0) ---');
    console.log(
      formatPolicyReport(
        comparePolicies(pred, bundle, { candidatePolicy: DEFAULT_POLICY, force, itemParamsSource: 'author' }),
      ),
    );
    console.log('');
    console.log('--- Candidate policy ---');
  }
  console.log(formatPolicyReport(comparePolicies(pred, bundle, { candidatePolicy: candidate, force })));
}

const cmd = process.argv[2];
const force = process.argv.includes('--force');
const candFile = arg('candidate');
const candidate = candFile ? withPolicy(JSON.parse(readFileSync(candFile, 'utf8'))) : DEFAULT_POLICY;

if (cmd === 'simulate') {
  const bundle = simulate({
    learners: Number(arg('learners', '300')),
    days: Number(arg('days', '24')),
    seed: Number(arg('seed', '42')),
  });
  const out = arg('out');
  if (out) writeFileSync(out, JSON.stringify(bundle));
  console.log(`Simulated ${bundle.attempts.length} attempts, ${bundle.decisions?.length ?? 0} decisions.\n`);
  // Demo candidate: tighter review cap, more weight on information.
  run(bundle, candFile ? candidate : withPolicy({ review: { cap: 0.3 }, scoring: { wInfo: 1 } }), force, true);
} else if (cmd === 'harness') {
  const file = process.argv[3];
  if (!file) throw new Error('harness needs a bundle file');
  run(JSON.parse(readFileSync(file, 'utf8')) as DataBundle, candidate, force, process.argv.includes('--self-check'));
} else {
  console.log('Usage: cli.js simulate [--learners N --days D --seed S --out f.json] | harness <bundle.json> [--force] [--candidate overrides.json]');
}
