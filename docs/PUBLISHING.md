# Publishing to npm

The package is ready; publishing needs an npm login. Everything below was verified
locally except the final upload.

## Status

| Check | Result |
| --- | --- |
| `npm ping` | PONG (registry reachable) |
| `npm whoami` | **401 Unauthorized — not logged in** |
| name `wiraxplore` | free (404) |
| `private` field | absent |
| `publishConfig.access` | `public` |
| tarball | 54 files, 49.1 kB packed, 200.5 kB unpacked |

`~/.npmrc` contains `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` but `NPM_TOKEN`
is unset, which is why every npm command also prints:

```
WARN Issue while reading "C:\Users\ThinkPad\.npmrc". Failed to replace env in config: ${NPM_TOKEN}
```

## Two ways to fix the login

### A. Interactive (simplest)

```bash
npm login
npm whoami          # must print your username
```

### B. Automation token

1. Create a token: npmjs.com → Access Tokens → *Granular* or *Publish*.
2. Either export it (then the existing `${NPM_TOKEN}` reference starts working):

```powershell
$env:NPM_TOKEN = "npm_xxxxxxxxxxxxxxxx"
npm whoami
```

or replace the placeholder line in `~/.npmrc` with a literal token:

```
//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxx
```

## Publish

```bash
npm run publish:dry     # verify: builds, runs unit tests, lists the tarball
npm run publish:public  # actual publish, public access
```

`prepublishOnly` runs `npm run build && npm run test`, so a broken build or a
failing unit test stops the publish before anything is uploaded.

Verify afterwards:

```bash
npm view wiraxplore version
npm view wiraxplore dist-tags
npx wiraxplore@0.2.0 --version
```

## What gets published

```
LICENSE  README.md  package.json
bin/wiraxplore.js
dist/**                      (compiled JS + .d.ts + source maps)
plugins/opencode/{src,package.json}
plugins/commandcode/README.md
skills/wiraxplore/SKILL.md
```

Not published: `tests/`, `src/` (TypeScript sources), `docs/`, `examples/`,
`demo/`, `scripts/`. The `files` allowlist in `package.json` controls this.

## Version bumps

```bash
npm version patch   # 0.2.0 -> 0.2.1
npm version minor   # 0.2.0 -> 0.3.0
```

Then publish again. `npm version` creates the git tag and commit for you.

## After the first publish

Docs currently say the package is not on npm and tell people to use `file:`.
Once published, update:

- `README.md` — the "Not on npm yet" warning block
- `docs/TESTING.md` §3 (install section)
- `skills/wiraxplore/SKILL.md` §3
- `docs/REQUIREMENTS.md`

Replace `pnpm add -D file:../wiraxplore vitest` with `pnpm add -D wiraxplore vitest`,
and `npx wiraxplore ...` becomes valid.

## Troubleshooting

| Error | Cause |
| --- | --- |
| `E401 Unauthorized` on `whoami` | no token / expired token → `npm login` |
| `E404 Not Found - PUT .../wiraxplore` | unauthenticated publish; npm hides auth failures behind 404 for new packages |
| `E403 ... You do not have permission` | name taken, or token lacks publish rights |
| `EPUBLISHCONFLICT` | version already published → bump the version |
| `402 Payment Required` | scoped package published privately by mistake → `--access public` |
