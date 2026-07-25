# Repository Guide

## Purpose

This repository provides a configurable OpenCode TUI plugin that adds harness
and session introspection to the right sidebar without modifying OpenCode core.

## Source Of Truth

- Treat current OpenCode source and public types as authoritative.
- Inspect `@opencode-ai/plugin/tui` and the built-in sidebar feature plugins
  before changing slot integration or UI conventions.
- Do not rely on undocumented runtime behavior without a focused test.

## Architecture

- Keep data collection, normalization, configuration, and rendering separate.
- Register UI through the public `sidebar_content` slot.
- Label information by scope: session, workspace, or global.
- Distinguish available capabilities from capabilities used in the session.
- Treat hook introspection as partial unless OpenCode exposes authoritative data.
- Never expose credentials, resolved environment values, OAuth tokens, or
  sensitive tool arguments in the panel or logs.

## Development

- Use TypeScript, SolidJS, and OpenTUI patterns already used by OpenCode.
- Prefer small components and pure normalization functions.
- Avoid compatibility shims without a concrete supported-version requirement.
- Add tests for configuration resolution and every non-trivial data projection.
- Run `bun run check` before considering a change complete.

## Releases

- Read `RELEASING.md` before changing a package version, creating a release tag,
  or publishing to npm.
- Prefer the GitHub Actions Trusted Publishing workflow; never add npm tokens or
  other credentials to the repository, workflow secrets, logs, or documentation.
- A release tag must exactly equal `v` followed by the package version.
- Run the documented release checks before pushing a release tag.

## Documentation

- Keep configuration examples in `README.md` synchronized with runtime defaults.
- Record externally visible behavior changes in the README before release.
- Do not claim full introspection when the underlying OpenCode API is partial.
