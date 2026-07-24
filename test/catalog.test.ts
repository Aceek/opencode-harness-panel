import { describe, expect, test } from "bun:test"
import { loadCatalog } from "../src/panel"

function api(responses: {
  skills: { data?: { name: string; location: string }[]; error?: unknown }
  agents: { data?: { name: string; mode: "primary" | "subagent" | "all"; native?: boolean }[]; error?: unknown }
  commands: { data?: { name: string }[]; error?: unknown }
}) {
  return {
    client: {
      app: {
        skills: async () => responses.skills,
        agents: async () => responses.agents,
      },
      command: {
        list: async () => responses.commands,
      },
    },
  }
}

describe("catalog loading", () => {
  test("normalizes successful public SDK responses", async () => {
    const result = await loadCatalog(
      api({
        skills: { data: [{ name: "security", location: "<built-in>" }] },
        agents: { data: [{ name: "explore", mode: "subagent", native: true }] },
        commands: { data: [{ name: "review" }] },
      }) as never,
      "/workspace",
    )

    expect(result).toEqual({
      skills: [{ name: "security", location: "<built-in>" }],
      agents: [{ name: "explore", mode: "subagent", native: true }],
      commands: ["review"],
    })
  })

  test("rejects resolved SDK errors without exposing their details", async () => {
    const request = loadCatalog(
      api({
        skills: { error: { message: "API_KEY=private" } },
        agents: { data: [] },
        commands: { data: [] },
      }) as never,
      "/workspace",
    )

    expect(request).rejects.toThrow("Catalog request failed")
    expect(request).rejects.not.toThrow("private")
  })
})
