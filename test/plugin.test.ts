import { describe, expect, test } from "bun:test"
import plugin from "../src/index"

describe("TUI plugin contract", () => {
  test("exports a stable ID and TUI entrypoint", () => {
    expect(plugin.id).toBe("opencode-harness-panel")
    expect(plugin.tui).toBeFunction()
  })
})
