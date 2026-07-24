# Changelog

All notable changes to this project are documented in this file.

## 0.1.0 - 2026-07-24

Initial public release.

### Added

- Read-only Harness sidebar registered through OpenCode's public `sidebar_content` slot.
- Focused default sections for skills and subagents, separating session-observed use from current availability.
- Collapsible sidebar sections and a short session activity summary.
- Optional tool-call counts, runtime details, configuration catalogs, integrations, hooks, plugins, and provenance.
- Privacy-safe projections that omit tool arguments, outputs, raw errors, todo content, credentials, and absolute paths.
- Public-package consumer test: pack, isolated installation, and `opencode-harness-panel/tui` import.

### Compatibility

- OpenCode `>=1.18.4 <2`
- Bun `>=1.2.0`
