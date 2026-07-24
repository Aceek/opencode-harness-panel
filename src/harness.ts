import type { Agent, Message, Part, Session } from "@opencode-ai/sdk/v2"
import type {
  TuiPluginStatus,
  TuiSidebarFileItem,
  TuiSidebarLspItem,
  TuiSidebarMcpItem,
  TuiSidebarTodoItem,
} from "@opencode-ai/plugin/tui"
import type { AgentFileEvidence } from "./agent-files"
import { pathLabel, pluginLabel, safeLabel } from "./privacy"

export type Confidence = "authoritative" | "derived" | "partial"
export type Scope = "session" | "workspace" | "global"

export type HarnessItem = {
  label: string
  detail?: string
  state?: "used" | "available"
  origin?: {
    label: string
    confidence: Confidence
  }
  scope: Scope
  confidence: Confidence
}

export type HarnessSection = {
  id: string
  title: string
  items: HarnessItem[]
  empty?: string
}

export type HarnessItemGroup = {
  title?: string
  state?: "used" | "available"
  items: HarnessItem[]
}

export type SessionSummary = {
  skills: number
  subagents: number
  toolCalls: number
}

export function groupHarnessItems(items: HarnessItem[]): HarnessItemGroup[] {
  const used = items.filter((item) => item.state === "used")
  const available = items.filter((item) => item.state === "available")
  const other = items.filter((item) => !item.state)
  return [
    ...(used.length ? [{ title: "Used this session", state: "used" as const, items: used }] : []),
    ...(available.length ? [{ title: "Available now", state: "available" as const, items: available }] : []),
    ...(other.length ? [{ items: other }] : []),
  ]
}

export type Catalog = {
  skills: { name: string; location: string }[]
  agents: Pick<Agent, "name" | "mode" | "native">[]
  commands: string[]
}

export type HarnessInput = {
  appVersion: string
  session?: Session
  messages: readonly Message[]
  parts: readonly Part[]
  plugins: readonly TuiPluginStatus[]
  serverPlugins: readonly (string | [string, Record<string, unknown>])[]
  catalog?: Catalog
  catalogStatus?: "loading" | "ready" | "unavailable"
  showProvenance: boolean
  agentFiles: readonly AgentFileEvidence[]
  mcp: readonly TuiSidebarMcpItem[]
  lsp: readonly TuiSidebarLspItem[]
  files: readonly TuiSidebarFileItem[]
  todos: readonly TuiSidebarTodoItem[]
  permissionCount: number
  questionCount: number
  references: readonly string[]
  branch?: string
  worktree: string
  pathPolicy: "hidden" | "basename"
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function latestMessage(messages: readonly Message[]) {
  return messages.at(-1)
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`
}

export function buildSessionSummary(parts: readonly Part[]): SessionSummary {
  return {
    skills: observedSkills(parts).names.length,
    subagents: observedSubagents(parts).length,
    toolCalls: parts.filter((part) => part.type === "tool").length,
  }
}

export function sessionSummaryLabel(summary: SessionSummary): string {
  if (!summary.skills && !summary.subagents && !summary.toolCalls) return "No activity yet"
  return [
    plural(summary.skills, "skill"),
    plural(summary.subagents, "subagent"),
    `${plural(summary.toolCalls, "tool call")} total`,
  ].join(" · ")
}

function runtime(input: HarnessInput): HarnessSection {
  const last = latestMessage(input.messages)
  const agent = last?.agent ?? input.session?.agent
  const model = last
    ? last.role === "assistant"
      ? `${last.providerID}/${last.modelID}`
      : `${last.model.providerID}/${last.model.modelID}`
    : input.session?.model
      ? `${input.session.model.providerID}/${input.session.model.id}`
      : undefined
  const tokenTotal = input.session?.tokens
    ? input.session.tokens.input +
      input.session.tokens.output +
      input.session.tokens.reasoning +
      input.session.tokens.cache.read +
      input.session.tokens.cache.write
    : undefined
  const items: HarnessItem[] = [
    { label: `OpenCode ${input.appVersion}`, scope: "global", confidence: "authoritative" },
    {
      label: `Workspace ${pathLabel(input.worktree, input.pathPolicy)}`,
      scope: "workspace",
      confidence: "authoritative",
    },
  ]
  if (input.branch)
    items.push({ label: `Branch ${safeLabel(input.branch)}`, scope: "workspace", confidence: "authoritative" })
  if (agent) items.push({ label: `Agent ${safeLabel(agent)}`, scope: "session", confidence: "authoritative" })
  if (model) items.push({ label: `Model ${safeLabel(model)}`, scope: "session", confidence: "authoritative" })
  if (tokenTotal !== undefined)
    items.push({ label: `${tokenTotal.toLocaleString()} tokens`, scope: "session", confidence: "authoritative" })
  if (input.session?.cost !== undefined)
    items.push({ label: `$${input.session.cost.toFixed(4)} spent`, scope: "session", confidence: "authoritative" })
  return { id: "runtime", title: "Runtime", items }
}

function skills(input: HarnessInput): HarnessSection {
  const observed = observedSkills(input.parts)
  const available = [...(input.catalog?.skills ?? [])].sort((left, right) => left.name.localeCompare(right.name))
  return {
    id: "skills",
    title: "Skills",
    items: [
      ...observed.names.map(
        (name): HarnessItem => ({
          label: safeLabel(name),
          state: "used",
          origin: input.showProvenance
            ? available.find((skill) => skill.name === name)
              ? skillOrigin(available.find((skill) => skill.name === name)!.location, input.worktree)
              : { label: "source unknown", confidence: "partial" }
            : undefined,
          scope: "session",
          confidence: "authoritative",
        }),
      ),
      ...(observed.unknown
        ? [
            {
              label: "Unknown skill",
              state: "used" as const,
              origin: input.showProvenance ? { label: "source unknown", confidence: "partial" as const } : undefined,
              scope: "session" as const,
              confidence: "partial" as const,
            },
          ]
        : []),
      ...available
        .filter((skill) => !observed.names.includes(skill.name))
        .map(
          (skill): HarnessItem => ({
            label: safeLabel(skill.name),
            state: "available",
            origin: input.showProvenance ? skillOrigin(skill.location, input.worktree) : undefined,
            scope: "workspace",
            confidence: "authoritative",
          }),
        ),
    ],
    empty:
      input.catalogStatus === "unavailable"
        ? "Catalog unavailable"
        : input.catalog
          ? "No skills available"
          : "Catalog loading",
  }
}

function observedSkills(parts: readonly Part[]): { names: string[]; unknown: boolean } {
  const skillParts = parts.filter((part) => part.type === "tool" && part.tool === "skill")
  return {
    names: unique(
      skillParts.flatMap((part) => {
        if (part.type !== "tool") return []
        const name = part.state.input.name
        return typeof name === "string" && name.trim() ? [name] : []
      }),
    ),
    unknown: skillParts.some((part) => {
      if (part.type !== "tool") return false
      const name = part.state.input.name
      return typeof name !== "string" || !name.trim()
    }),
  }
}

function skillOrigin(location: string, worktree: string): HarnessItem["origin"] {
  if (location === "<built-in>") return { label: "built-in", confidence: "authoritative" }
  const path = location.replace(/^file:\/\//, "").replace(/[\\/]+$/, "")
  const root = worktree.replace(/[\\/]+$/, "")
  if (root && root !== "/" && (path === root || path.startsWith(`${root}/`))) {
    return { label: "project?", confidence: "derived" }
  }
  if (/\/(?:\.config\/opencode|\.agents|\.claude)\//.test(path)) {
    return { label: "user?", confidence: "derived" }
  }
  return { label: "source unknown", confidence: "partial" }
}

function observedSubagents(parts: readonly Part[]): string[] {
  return unique(
    parts.flatMap((part) => {
      if (part.type === "subtask") return [part.agent]
      if (part.type !== "tool" || part.tool !== "task") return []
      const name = part.state.input.subagent_type
      return typeof name === "string" && name.trim() ? [name] : []
    }),
  )
}

function subagents(input: HarnessInput): HarnessSection {
  const observed = observedSubagents(input.parts)
  const available = unique(
    (input.catalog?.agents ?? []).filter((agent) => agent.mode !== "primary").map((agent) => agent.name),
  )
  return {
    id: "subagents",
    title: "Subagents",
    items: [
      ...observed.map(
        (name): HarnessItem => ({
          label: safeLabel(name),
          state: "used",
          origin: input.showProvenance
            ? agentOrigin(
                name,
                input.catalog?.agents.find((agent) => agent.name === name),
                input.agentFiles,
              )
            : undefined,
          scope: "session",
          confidence: "authoritative",
        }),
      ),
      ...available
        .filter((name) => !observed.includes(name))
        .map(
          (name): HarnessItem => ({
            label: safeLabel(name),
            state: "available",
            origin: input.showProvenance
              ? agentOrigin(
                  name,
                  input.catalog?.agents.find((agent) => agent.name === name),
                  input.agentFiles,
                )
              : undefined,
            scope: "workspace",
            confidence: "authoritative",
          }),
        ),
    ],
    empty:
      input.catalogStatus === "unavailable"
        ? "Catalog unavailable"
        : input.catalog
          ? "No subagents available"
          : "Catalog loading",
  }
}

type ToolActivity = {
  name: string
  calls: number
}

export function buildToolActivity(parts: readonly Part[]): HarnessItem[] {
  const grouped = new Map<string, ToolActivity>()
  for (const part of parts) {
    if (part.type !== "tool") continue
    const activity = grouped.get(part.tool) ?? {
      name: part.tool,
      calls: 0,
    }
    activity.calls++
    grouped.set(part.tool, activity)
  }
  return [...grouped.values()]
    .sort((left, right) => right.calls - left.calls || left.name.localeCompare(right.name))
    .map((activity) => ({
      label: safeLabel(activity.name),
      detail: plural(activity.calls, "call"),
      scope: "session",
      confidence: "authoritative",
    }))
}

function tools(input: HarnessInput): HarnessSection {
  return {
    id: "tools",
    title: "Tool activity",
    items: buildToolActivity(input.parts),
    empty: "No tool calls yet",
  }
}

function agentOrigin(
  name: string,
  agent: Catalog["agents"][number] | undefined,
  evidence: readonly AgentFileEvidence[],
): HarnessItem["origin"] {
  const contributions = [
    ...(agent?.native ? ["built-in base"] : []),
    ...(evidence.find((item) => item.name === name)?.contributions.map((contribution) => `${contribution}?`) ?? []),
  ]
  if (contributions.length) {
    return {
      label: contributions.join(" + "),
      confidence: "partial",
    }
  }
  return { label: "source unknown", confidence: "partial" }
}

function plugins(input: HarnessInput): HarnessSection {
  return {
    id: "plugins",
    title: "TUI Plugins",
    items: [...input.plugins]
      .filter((plugin) => plugin.enabled)
      .sort((left, right) => Number(left.source === "internal") - Number(right.source === "internal"))
      .map((plugin) => ({
        label: safeLabel(plugin.id),
        detail: plugin.active ? "active" : "enabled",
        scope: "global" as const,
        confidence: "authoritative" as const,
      })),
    empty: "No enabled TUI plugins",
  }
}

function hooks(input: HarnessInput): HarnessSection {
  return {
    id: "hooks",
    title: "Hooks",
    items: [
      ...input.serverPlugins.map((entry) => ({
        label: pluginLabel(typeof entry === "string" ? entry : entry[0], input.pathPolicy),
        detail: "configured source",
        scope: "workspace" as const,
        confidence: "partial" as const,
      })),
      {
        label: "Registry and activity",
        detail: "not exposed by OpenCode",
        scope: "global",
        confidence: "partial",
      },
    ],
  }
}

function integrations(input: HarnessInput): HarnessSection {
  const available = input.messages.some((message) => message.role === "user" && message.tools?.execute === true)
  const observed = input.parts.some((part) => part.type === "tool" && part.tool === "execute")
  const codeMode = observed ? "observed" : available ? "available" : "unknown"
  return {
    id: "integrations",
    title: "Integrations",
    items: [
      { label: "Code Mode", detail: codeMode, scope: "session", confidence: observed ? "authoritative" : "derived" },
      ...input.mcp.map(
        (item): HarnessItem => ({
          label: safeLabel(item.name),
          detail: item.status,
          scope: "workspace",
          confidence: "authoritative",
        }),
      ),
    ],
  }
}

export function buildHarnessSections(input: HarnessInput): HarnessSection[] {
  const catalogAgents = input.catalog?.agents ?? []
  return [
    runtime(input),
    skills(input),
    subagents(input),
    tools(input),
    plugins(input),
    hooks(input),
    integrations(input),
    {
      id: "agents",
      title: "Agents",
      items: catalogAgents.map((agent) => ({
        label: safeLabel(agent.name),
        detail: agent.mode,
        scope: "workspace",
        confidence: "authoritative",
      })),
      empty:
        input.catalogStatus === "unavailable"
          ? "Catalog unavailable"
          : input.catalog
            ? "No agents available"
            : "Catalog loading",
    },
    {
      id: "commands",
      title: "Commands",
      items: (input.catalog?.commands ?? []).map((name) => ({
        label: safeLabel(name),
        scope: "workspace",
        confidence: "authoritative",
      })),
      empty:
        input.catalogStatus === "unavailable"
          ? "Catalog unavailable"
          : input.catalog
            ? "No commands available"
            : "Catalog loading",
    },
    {
      id: "references",
      title: "References",
      items: input.references.map((name) => ({
        label: safeLabel(name),
        scope: "workspace",
        confidence: "authoritative",
      })),
      empty: "No configured references",
    },
    {
      id: "permissions",
      title: "Requests",
      items: [
        { label: `${input.permissionCount} permission requests`, scope: "session", confidence: "authoritative" },
        { label: `${input.questionCount} questions`, scope: "session", confidence: "authoritative" },
      ],
    },
    {
      id: "mcp",
      title: "MCP",
      items: input.mcp.map((item) => ({
        label: safeLabel(item.name),
        detail: item.status,
        scope: "workspace",
        confidence: "authoritative",
      })),
      empty: "No MCP servers",
    },
    {
      id: "lsp",
      title: "LSP",
      items: input.lsp.map((item) => ({
        label: safeLabel(item.id),
        detail: `${item.status} · ${pathLabel(item.root, input.pathPolicy)}`,
        scope: "workspace",
        confidence: "authoritative",
      })),
      empty: "No active language servers",
    },
    {
      id: "files",
      title: "Modified Files",
      items: input.files.map((item) => ({
        label: pathLabel(item.file, input.pathPolicy),
        detail: `+${item.additions} -${item.deletions}`,
        scope: "session",
        confidence: "authoritative",
      })),
      empty: "No modified files",
    },
    {
      id: "todos",
      title: "Todos",
      items: Object.entries(
        input.todos.reduce<Record<string, number>>((counts, todo) => {
          counts[todo.status] = (counts[todo.status] ?? 0) + 1
          return counts
        }, {}),
      ).map(([status, count]) => ({ label: `${count} ${status}`, scope: "session", confidence: "authoritative" })),
      empty: "No todos",
    },
  ]
}
