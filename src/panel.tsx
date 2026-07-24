import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { collectAgentFileEvidence } from "./agent-files"
import type { HarnessConfig, SectionName } from "./config"
import { buildHarnessSections, groupHarnessItems, type Catalog, type HarnessSection } from "./harness"

function environmentFlag(name: string): boolean {
  const value = process.env[name]?.toLowerCase()
  return value === "1" || value === "true"
}

export async function loadCatalog(api: TuiPluginApi, directory: string): Promise<Catalog> {
  const location = { directory }
  const [skills, agents, commands] = await Promise.all([
    api.client.app.skills(location),
    api.client.app.agents(location),
    api.client.command.list(location),
  ])
  if (skills.error || agents.error || commands.error) throw new Error("Catalog request failed")
  return {
    skills: (skills.data ?? []).map((skill) => ({ name: skill.name, location: skill.location })),
    agents: (agents.data ?? []).map((agent) => ({ name: agent.name, mode: agent.mode, native: agent.native })),
    commands: (commands.data ?? []).map((command) => command.name),
  }
}

function HarnessSectionView(props: {
  api: TuiPluginApi
  section: HarnessSection
  open: boolean
  itemsPerSection: number
  onToggle: () => void
}) {
  const theme = () => props.api.theme.current
  const visible = () => props.section.items.slice(0, props.itemsPerSection)
  const groups = () => groupHarnessItems(visible())
  const remainder = () => props.section.items.length - visible().length

  return (
    <box paddingTop={1}>
      <box flexDirection="row" gap={1} onMouseDown={props.onToggle}>
        <text fg={theme().text}>{props.open ? "▼" : "▶"}</text>
        <text fg={theme().text}>
          <b>{props.section.title}</b>
        </text>
      </box>
      <Show when={props.open}>
        <Show
          when={visible().length > 0}
          fallback={<text fg={theme().textMuted}>{props.section.empty ?? "No data"}</text>}
        >
          <For each={groups()}>
            {(group) => (
              <box paddingTop={group.title ? 1 : 0}>
                <Show when={group.title}>
                  <text fg={group.state === "used" ? theme().success : theme().text}>
                    <b>
                      {group.state === "used" ? "● " : "○ "}
                      {group.title}
                    </b>
                  </text>
                </Show>
                <For each={group.items}>
                  {(item) => (
                    <text fg={theme().textMuted} wrapMode="word">
                      {item.label}
                      <Show when={item.origin}>
                        {" · ["}
                        {item.origin?.label}
                        {"]"}
                      </Show>
                      <Show when={item.detail}>
                        {" · "}
                        {item.detail}
                      </Show>
                      <Show when={item.confidence !== "authoritative"}> [{item.confidence}]</Show>
                    </text>
                  )}
                </For>
              </box>
            )}
          </For>
          <Show when={remainder() > 0}>
            <text fg={theme().textMuted}>+{remainder()} more</text>
          </Show>
        </Show>
      </Show>
    </box>
  )
}

export function HarnessPanel(props: { api: TuiPluginApi; sessionID: string; config: HarnessConfig }) {
  const theme = () => props.api.theme.current
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [catalog] = createResource(
    () => (props.api.state.ready ? props.api.state.path.directory : undefined),
    (directory) => loadCatalog(props.api, directory),
  )
  const agentFileRoots = createMemo(() => {
    if (!props.config.provenance || !props.api.state.ready) return
    return {
      config: props.api.state.path.config,
      directory: props.api.state.path.directory,
      worktree: props.api.state.path.worktree,
      projectConfigEnabled: !environmentFlag("OPENCODE_DISABLE_PROJECT_CONFIG"),
    }
  })
  const [agentFiles] = createResource(agentFileRoots, collectAgentFileEvidence)
  const sections = createMemo(() => {
    const messages = props.api.state.session.messages(props.sessionID)
    const session = props.api.state.session.get(props.sessionID)
    const config = props.api.state.config
    const catalogError = catalog.error
    return buildHarnessSections({
      appVersion: props.api.app.version,
      session,
      messages,
      parts: messages.flatMap((message) => props.api.state.part(message.id)),
      plugins: props.api.plugins.list(),
      serverPlugins: config.plugin ?? [],
      catalog: catalogError ? undefined : catalog(),
      catalogStatus: !props.api.state.ready || catalog.loading ? "loading" : catalogError ? "unavailable" : "ready",
      showProvenance: props.config.provenance,
      agentFiles: agentFiles()?.agents ?? [],
      mcp: props.api.state.mcp(),
      lsp: props.api.state.lsp(),
      files: props.api.state.session.diff(props.sessionID),
      todos: props.api.state.session.todo(props.sessionID),
      permissionCount: props.api.state.session.permission(props.sessionID).length,
      questionCount: props.api.state.session.question(props.sessionID).length,
      references: Object.keys(config.references ?? config.reference ?? {}),
      branch: props.api.state.vcs?.branch,
      worktree: props.api.state.path.worktree === "/" ? props.api.state.path.directory : props.api.state.path.worktree,
      pathPolicy: props.config.privacy.paths,
    }).filter((section) => props.config.sections[section.id as SectionName])
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>Harness</b>
      </text>
      <For each={sections()}>
        {(section) => (
          <HarnessSectionView
            api={props.api}
            section={section}
            open={expanded()[section.id] ?? true}
            itemsPerSection={props.config.limits.itemsPerSection}
            onToggle={() => setExpanded((current) => ({ ...current, [section.id]: !(current[section.id] ?? true) }))}
          />
        )}
      </For>
    </box>
  )
}
