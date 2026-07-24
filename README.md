# OpenCode Harness Panel

A configurable OpenCode TUI plugin for inspecting the active session and its
surrounding agent harness from the right sidebar.

## Status

Initial scaffold. The plugin currently validates TUI loading and renders a
placeholder section. Harness data sources and configuration are intentionally
deferred to the implementation design phase.

## Development

Requirements:

- OpenCode 1.18.2 or newer
- Bun 1.2 or newer

Install dependencies and validate the project:

```bash
bun install
bun run check
```

Run OpenCode from this repository to load the source plugin through
`tui.jsonc`:

```bash
opencode
```

## Planned Scope

- Active agent, model, provider, and Code Mode state
- Available and session-used skills
- Child subagents
- MCP, LSP, commands, references, permissions, and plugins
- Clearly marked partial hook introspection
- Presets and per-section visibility controls

## Packaging

The package reserves the `./tui` export expected by OpenCode TUI plugins. It is
not published to npm yet.

## License

MIT
