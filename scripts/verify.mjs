// Run everything CI would run, locally.
//
//   node scripts/verify.mjs
//
// Exists because GitHub Actions is blocked on this account (billing), so the
// workflow in .github/workflows/ci.yml cannot be the only gate.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

let failures = 0;
function step(name, command, args = []) {
  process.stdout.write(`\n▸ ${name}\n`);
  const r = spawnSync(process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    failures += 1;
    console.error(`✗ ${name} failed (exit ${r.status})`);
  }
  return r.status === 0;
}

step('typecheck', 'pnpm', ['lint']);
step('build', 'pnpm', ['build']);
step('unit tests', 'pnpm', ['test']);

// The contract tests need a browser. Skip them with SKIP_ENGINE=1.
if (process.env.SKIP_ENGINE === '1') {
  console.log('\n▸ engine tests — skipped (SKIP_ENGINE=1)');
} else {
  const ok = step('engine contract (parity + viewport)', 'pnpm', [
    'exec', 'vitest', 'run', 'tests/e2e/parity.spec.ts', 'tests/e2e/viewport.spec.ts',
  ]);
  if (!ok) {
    console.error('  If no browser is installed: pnpm exec playwright-core install chromium');
  }
}

// Catch the failure mode that bit the npm release: a tarball that cannot run.
process.stdout.write('\n▸ package smoke test\n');
const version = spawnSync(process.execPath, [join(root, 'bin', 'wiraxplore.js'), '--version'], { encoding: 'utf8' });
const reported = (version.stdout ?? '').trim();
if (reported === pkg.version) {
  console.log(`✓ bin reports ${reported}`);
} else {
  failures += 1;
  console.error(`✗ bin reports "${reported}", package.json says "${pkg.version}"`);
}

for (const required of ['bin/wiraxplore.js', 'dist/index.js', 'dist/cli.js', 'skills/wiraxplore/SKILL.md', 'LICENSE']) {
  if (existsSync(join(root, required))) console.log(`✓ ${required}`);
  else {
    failures += 1;
    console.error(`✗ missing ${required}`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`FAILED: ${failures} step(s)`);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
