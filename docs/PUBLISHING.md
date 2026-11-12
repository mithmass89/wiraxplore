# Publishing to npm

**Status: published.** `wiraxplore@0.2.0` is live on the public registry.

```bash
npm view wiraxplore version        # 0.2.0
npx wiraxplore@0.2.0 --version     # 0.2.0
```

Published by `massmith89` on 2026-11-12 after generating a granular access token
with **bypass 2FA**; the account uses `auth-and-writes`, so a classic token is
rejected with `E403 ... Two-factor authentication or granular access token with
bypass 2fa enabled is required`.

## Releasing a new version

```bash
npm version patch       # or minor / major; creates the git tag and commit
npm run publish:dry     # builds, runs unit tests, lists the tarball
npm run publish:public
```

If the token has no 2FA bypass, pass an OTP: `npm publish --access public --otp=123456`.

`prepublishOnly` runs `npm run build && npm run test`, so a broken build or a
failing unit test stops the publish before anything uploads.

## What gets published

```
LICENSE  README.md  package.json
bin/wiraxplore.js
dist/**                      (compiled JS + .d.ts + source maps)
plugins/opencode/{src,package.json}
plugins/commandcode/README.md
skills/wiraxplore/SKILL.md
```

Not published: `tests/`, `src/`, `docs/`, `examples/`, `demo/`, `scripts/`.
The `files` allowlist in `package.json` controls this. Current tarball: 54 files,
49.1 kB packed, 200.6 kB unpacked.

## Verify a release

```bash
npm view wiraxplore version dist-tags
npm view wiraxplore@<version> dist.unpackedSize
npx wiraxplore@<version> --version
```

Registry metadata can lag a few seconds behind the publish; a `HEAD` on the
tarball URL may 404 briefly while `npm install` already works.

## Troubleshooting

| Error | Cause |
| --- | --- |
| `E401 Unauthorized` on `whoami` | no token / expired token → `npm login` |
| `E403 ... granular access token with bypass 2fa enabled` | account has `auth-and-writes`; use a granular token with bypass 2FA, or `--otp=` |
| `E404 Not Found - PUT .../<name>` | unauthenticated publish; npm hides auth failures behind 404 for a new name |
| `EPUBLISHCONFLICT` | version already published → bump the version |
| `402 Payment Required` | scoped package published privately → `--access public` |
| `bin[...] script name was cleaned` | run `npm pkg fix` (already applied here) |
