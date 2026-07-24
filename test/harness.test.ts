import { describe, expect, test } from "bun:test"
import type { Message, Part, Session } from "@opencode-ai/sdk/v2"
import {
  buildHarnessSections,
  buildSessionSummary,
  buildToolActivity,
  groupHarnessItems,
  sessionSummaryLabel,
  type HarnessInput,
} from "../src/harness"

const session: Session = {
  id: "session-1",
  slug: "session-1",
  projectID: "project-1",
  directory: "/home/alice/private-project",
  title: "Private task",
  version: "1.18.4",
  time: { created: 1, updated: 2 },
  agent: "build",
  model: { providerID: "openai", id: "gpt-test" },
  cost: 0.125,
  tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 2, write: 1 } },
}

const userMessage: Message = {
  id: "message-1",
  sessionID: session.id,
  role: "user",
  time: { created: 1 },
  agent: "build",
  model: { providerID: "openai", modelID: "gpt-test" },
  tools: { execute: true },
}

const skillPart = {
  id: "part-1",
  sessionID: session.id,
  messageID: userMessage.id,
  type: "tool",
  callID: "call-1",
  tool: "skill",
  state: {
    status: "completed",
    input: { name: "typescript", token: "must-not-render" },
    output: "private output",
    title: "Loaded",
    metadata: {},
    time: { start: 1, end: 2 },
  },
} satisfies Part

const executePart = {
  ...skillPart,
  id: "part-2",
  callID: "call-2",
  tool: "execute",
  state: { ...skillPart.state, input: { code: "private code" } },
} satisfies Part

const subtaskPart = {
  id: "part-3",
  sessionID: session.id,
  messageID: userMessage.id,
  type: "subtask",
  prompt: "private prompt",
  description: "research",
  agent: "explore",
} satisfies Part

const taskPart = {
  ...skillPart,
  id: "part-4",
  callID: "call-4",
  tool: "task",
  state: {
    ...skillPart.state,
    input: {
      subagent_type: "tui-plugin-engineer",
      description: "private description",
      prompt: "private task prompt",
    },
  },
} satisfies Part

function input(overrides: Partial<HarnessInput> = {}): HarnessInput {
  return {
    appVersion: "1.18.4",
    session,
    messages: [userMessage],
    parts: [skillPart, executePart, subtaskPart, taskPart],
    plugins: [
      {
        id: "internal:sidebar-context",
        source: "internal",
        spec: "internal:sidebar-context",
        target: "tui",
        enabled: true,
        active: true,
      },
      {
        id: "opencode-harness-panel",
        source: "file",
        spec: "/home/alice/private/plugin.tsx",
        target: "tui",
        enabled: true,
        active: true,
      },
    ],
    serverPlugins: ["file:///home/alice/plugins/hooks.ts", "safe-package@1.0.0"],
    catalog: {
      skills: [
        { name: "typescript", location: "/home/alice/private-project/.opencode/skills/typescript/SKILL.md" },
        { name: "security", location: "/home/alice/.config/opencode/skills/security/SKILL.md" },
      ],
      agents: [
        { name: "build", mode: "primary", native: true },
        { name: "explore", mode: "subagent", native: true },
        { name: "general", mode: "subagent", native: true },
        { name: "tui-plugin-engineer", mode: "subagent", native: false },
      ],
      commands: ["review"],
    },
    catalogStatus: "ready",
    showProvenance: true,
    agentFiles: [],
    mcp: [{ name: "notion", status: "connected" }],
    lsp: [{ id: "typescript", root: "/home/alice/private-project", status: "connected" }],
    files: [{ file: "/home/alice/private-project/src/secret.ts", additions: 3, deletions: 1 }],
    todos: [
      { content: "private todo", status: "pending" },
      { content: "another private todo", status: "completed" },
    ],
    permissionCount: 1,
    questionCount: 2,
    references: ["upstream"],
    branch: "main",
    worktree: "/home/alice/private-project",
    pathPolicy: "basename",
    ...overrides,
  }
}

describe("harness projections", () => {
  test("distinguishes observed and available capabilities", () => {
    const sections = buildHarnessSections(input())
    const skills = sections.find((section) => section.id === "skills")!
    const subagents = sections.find((section) => section.id === "subagents")!

    expect(skills.items).toContainEqual(expect.objectContaining({ label: "typescript", state: "used" }))
    expect(skills.items).toContainEqual(
      expect.objectContaining({
        label: "security",
        state: "available",
        origin: { label: "user?", confidence: "derived" },
      }),
    )
    expect(subagents.items).toContainEqual(expect.objectContaining({ label: "explore", state: "used" }))
    expect(subagents.items).toContainEqual(expect.objectContaining({ label: "tui-plugin-engineer", state: "used" }))
    expect(subagents.items).toContainEqual(expect.objectContaining({ label: "general", state: "available" }))
  })

  test("projects agent file evidence without claiming a unique origin", () => {
    const catalog = {
      ...input().catalog!,
      agents: [
        { name: "explore", mode: "subagent" as const, native: true },
        { name: "general", mode: "subagent" as const, native: true },
        { name: "user-agent", mode: "subagent" as const, native: false },
        { name: "project-agent", mode: "subagent" as const, native: false },
        { name: "both-files", mode: "subagent" as const, native: false },
        { name: "unknown-agent", mode: "subagent" as const, native: false },
      ],
    }
    const subagents = buildHarnessSections(
      input({
        parts: [],
        catalog,
        agentFiles: [
          { name: "explore", contributions: ["user file"] },
          { name: "user-agent", contributions: ["user file"] },
          { name: "project-agent", contributions: ["project file"] },
          { name: "both-files", contributions: ["user file", "project file"] },
        ],
      }),
    ).find((section) => section.id === "subagents")!

    expect(subagents.items.find((item) => item.label === "explore")?.origin).toEqual({
      label: "built-in base + user file?",
      confidence: "partial",
    })
    expect(subagents.items.find((item) => item.label === "general")?.origin).toEqual({
      label: "built-in base",
      confidence: "partial",
    })
    expect(subagents.items.find((item) => item.label === "user-agent")?.origin).toEqual({
      label: "user file?",
      confidence: "partial",
    })
    expect(subagents.items.find((item) => item.label === "project-agent")?.origin).toEqual({
      label: "project file?",
      confidence: "partial",
    })
    expect(subagents.items.find((item) => item.label === "both-files")?.origin).toEqual({
      label: "user file? + project file?",
      confidence: "partial",
    })
    expect(subagents.items.find((item) => item.label === "unknown-agent")?.origin).toEqual({
      label: "source unknown",
      confidence: "partial",
    })
  })

  test("hides all capability provenance when disabled", () => {
    const sections = buildHarnessSections(input({ showProvenance: false }))
    const capabilities = sections.filter((section) => section.id === "skills" || section.id === "subagents")

    expect(capabilities.flatMap((section) => section.items).every((item) => item.origin === undefined)).toBeTrue()
  })

  test("groups session use separately from workspace availability", () => {
    const skills = buildHarnessSections(input()).find((section) => section.id === "skills")!
    const groups = groupHarnessItems(skills.items)

    expect(groups.map((group) => group.title)).toEqual(["Used this session", "Available now"])
    expect(groups[0]?.items.map((item) => item.label)).toEqual(["typescript"])
    expect(groups[1]?.items.map((item) => item.label)).toEqual(["security"])
  })

  test("summarizes use and aggregates tool calls without rendering inputs or outputs", () => {
    const activity = buildToolActivity([skillPart, executePart, taskPart])
    const summary = buildSessionSummary([skillPart, executePart, taskPart])

    expect(activity).toEqual([
      expect.objectContaining({ label: "execute", detail: "1 call" }),
      expect.objectContaining({ label: "skill", detail: "1 call" }),
      expect.objectContaining({ label: "task", detail: "1 call" }),
    ])
    expect(summary).toEqual({ skills: 1, subagents: 1, toolCalls: 3 })
    expect(sessionSummaryLabel(summary)).toBe("1 skill · 1 subagent · 3 tool calls total")
  })

  test("reads only the public skill name field", () => {
    const guardedInput = new Proxy(
      { name: "security" },
      {
        get(target, property) {
          if (property !== "name") throw new Error(`unexpected skill input read: ${String(property)}`)
          return target.name
        },
        ownKeys() {
          throw new Error("skill input enumerated")
        },
      },
    )
    const guardedSkill = { ...skillPart, state: { ...skillPart.state, input: guardedInput } } satisfies Part

    const skills = buildHarnessSections(input({ parts: [guardedSkill] })).find((section) => section.id === "skills")!
    expect(skills.items).toContainEqual(expect.objectContaining({ label: "security", state: "used" }))
  })

  test("reads only the public task subagent field", () => {
    const guardedInput = new Proxy(
      { subagent_type: "general" },
      {
        get(target, property) {
          if (property !== "subagent_type") throw new Error(`unexpected task input read: ${String(property)}`)
          return target.subagent_type
        },
        ownKeys() {
          throw new Error("task input enumerated")
        },
      },
    )
    const guardedTask = { ...taskPart, state: { ...taskPart.state, input: guardedInput } } satisfies Part

    const subagents = buildHarnessSections(input({ parts: [guardedTask] })).find(
      (section) => section.id === "subagents",
    )!
    expect(subagents.items).toContainEqual(expect.objectContaining({ label: "general", state: "used" }))
  })

  test("marks hook introspection as partial", () => {
    const hooks = buildHarnessSections(input()).find((section) => section.id === "hooks")!

    expect(hooks.title).toBe("Hooks")
    expect(hooks.items.every((item) => item.confidence === "partial")).toBeTrue()
    expect(hooks.items.map((item) => item.label)).toEqual(["hooks.ts", "safe-package", "Registry and activity"])
  })

  test("lists external plugins before built-ins", () => {
    const plugins = buildHarnessSections(input()).find((section) => section.id === "plugins")!

    expect(plugins.items.map((item) => item.label)).toEqual(["opencode-harness-panel", "internal:sidebar-context"])
  })

  test("reports Code Mode without reading tool arguments", () => {
    const integrations = buildHarnessSections(input()).find((section) => section.id === "integrations")!
    const serialized = JSON.stringify(buildHarnessSections(input()))

    expect(integrations.items[0]).toEqual(expect.objectContaining({ label: "Code Mode", detail: "observed" }))
    expect(serialized).not.toContain("must-not-render")
    expect(serialized).not.toContain("private code")
    expect(serialized).not.toContain("private output")
    expect(serialized).not.toContain("private prompt")
  })

  test("never reads unrelated tool input fields", () => {
    const guardedPart = {
      ...skillPart,
      state: {
        ...skillPart.state,
        input: new Proxy(
          {},
          {
            get(_target, property) {
              if (property === "name") return "typescript"
              throw new Error(`unexpected tool input read: ${String(property)}`)
            },
          },
        ),
      },
    } satisfies Part

    expect(() => buildHarnessSections(input({ parts: [guardedPart] }))).not.toThrow()
  })

  test("does not expose absolute paths or todo contents", () => {
    const sections = buildHarnessSections(input())
    const serialized = JSON.stringify(sections)

    expect(serialized).not.toContain("/home/alice")
    expect(serialized).not.toContain("private todo")
    expect(sections.find((section) => section.id === "files")?.items[0]?.label).toBe("secret.ts")
    expect(sections.find((section) => section.id === "todos")?.items).toContainEqual(
      expect.objectContaining({ label: "1 pending" }),
    )
  })

  test("labels an unavailable catalog as loading rather than absent", () => {
    const skills = buildHarnessSections(input({ catalog: undefined, catalogStatus: "loading", parts: [] })).find(
      (section) => section.id === "skills",
    )!

    expect(skills.items).toEqual([])
    expect(skills.empty).toBe("Catalog loading")
  })

  test("reports catalog failures without exposing error details", () => {
    const skills = buildHarnessSections(input({ catalog: undefined, catalogStatus: "unavailable", parts: [] })).find(
      (section) => section.id === "skills",
    )!

    expect(skills.empty).toBe("Catalog unavailable")
  })
})
