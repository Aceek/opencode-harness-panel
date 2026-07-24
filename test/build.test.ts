import { describe, expect, test } from "bun:test"

describe("compiled package", () => {
  test("imports without a source JSX transform", async () => {
    const plugin = (await import("../dist/index.js")).default

    expect(plugin.id).toBe("opencode-harness-panel")
    expect(plugin.tui).toBeFunction()
  })
})
