# Releasing

This project publishes public npm packages. Releases must be reproducible, tested, and tied to a Git tag.

## One-time trusted publishing setup

Configure the following before publishing a future version from GitHub Actions:

1. In npm package settings for `opencode-harness-panel`, add a **Trusted Publisher**:
   - Provider: GitHub Actions
   - Owner: `Aceek`
   - Repository: `opencode-harness-panel`
   - Workflow filename: `publish.yml`
   - Environment: `npm`
   - Allowed action: npm publish
2. In GitHub repository settings, create an `npm` environment. Require a reviewer and restrict deployments to release
   tags if the repository policy supports it.
3. After confirming OIDC publication works, revoke local automation tokens that are no longer needed. npm recommends
   requiring 2FA and disallowing token publishing once trusted publishing is established.

The workflow `.github/workflows/publish.yml` requests only `contents: read` and `id-token: write`. It contains no npm
token: npm exchanges the GitHub Actions OIDC identity for short-lived publish credentials. npm automatically generates
provenance for a public package published through this trusted workflow. Every action is pinned to an immutable commit;
Dependabot proposes controlled updates for those pins.

## Release procedure

1. Start from an up-to-date `main` with a clean worktree.
2. Choose the next semantic version. A published npm version can never be replaced.
3. Update `package.json`, `bun.lock`, and `CHANGELOG.md`.
4. Run the release checks:

   ```bash
   bun run check
   bun run test:consumer
   bun run pack:dry-run
   ```

5. Commit and push the version changes to `main`.
6. Create and push a matching annotated tag. The workflow rejects any tag that does not equal `v` followed by the
   package version.

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

7. Approve the `npm` GitHub environment deployment. GitHub Actions builds, tests, installs the tarball in an isolated
   consumer, and publishes through OIDC.
8. Verify the registry before creating the GitHub release:

   ```bash
   npm view opencode-harness-panel@X.Y.Z version dist-tags --json
   ```

9. Create the GitHub release from the verified tag and changelog notes.

## Emergency local publication

Use local publishing only if trusted publishing is unavailable. A granular npm token must be limited to the package,
have an expiry, and have bypass 2FA only when required. Never commit, print, or share the token. Revoke it after use.
