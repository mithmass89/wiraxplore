# Continuous integration

## Current state: Actions is blocked on this account

`.github/workflows/ci.yml` is committed and syntactically valid, but every run
fails before starting a job:

```
The job was not started because your account is locked due to a billing issue.
```

That is an account-level lock, not a problem with the workflow. Check
**Settings → Billing and plans → Actions** on GitHub. Once resolved, the workflow
starts working with no changes.

Repository-level Actions permissions are already fine:

```bash
gh api repos/mithmass89/wiraxplore/actions/permissions
# {"enabled":true,"allowed_actions":"all","sha_pinning_required":false}
```

## Use the local gate instead

```bash
pnpm verify          # or: node scripts/verify.mjs
```

Runs exactly what CI would run, in order:

1. `pnpm lint` — typecheck
2. `pnpm build` — TypeScript emit
3. `pnpm test` — unit tests
4. `parity.spec.ts` + `viewport.spec.ts` — the engine contract on both drivers
5. package smoke test — `bin --version` matches `package.json`, and the files npm
   needs are present

Skip step 4 when no browser is installed:

```bash
SKIP_ENGINE=1 pnpm verify          # bash
$env:SKIP_ENGINE=1; pnpm verify    # PowerShell
```

Needs a browser: `pnpm exec playwright-core install chromium`, or any installed
Chrome/Edge.

## What the workflow does

| job | steps |
| --- | --- |
| `build` | install, typecheck, build, unit tests, then pack the tarball and assert `npx wiraxplore --version` matches `package.json` and `init` produces a config + skill |
| `engines` | installs Chromium via `playwright-core install`, runs `parity.spec.ts` and `viewport.spec.ts` |

The `engines` job intentionally runs only those two files. `demo-app.spec.ts` and
`booking.spec.ts` are local-only (the booking checkout is not published), and the
Lightpanda paths need WSL on Windows, which a Linux runner does not have.

## Before pushing

```bash
pnpm verify
```

That is the same gate the workflow would apply, so a green local run means a green
CI run once Actions is unblocked.
