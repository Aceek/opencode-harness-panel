import { describe, expect, test } from "bun:test"
import plugin from "../src/index"

describe("TUI plugin contract", () => {
  test("exports a stable ID and TUI entrypoint", () => {
    expect(plugin.id).toBe("opencode-harness-panel")
    expect(plugin.tui).toBeFunction()
  })

  test("registers exactly one sidebar content slot", async () => {
    const registrations: unknown[] = []
    const api = {
      slots: {
        register(value: unknown) {
          registrations.push(value)
          return "test-slot"
        },
      },
    }

    await plugin.tui(api as never, { preset: "minimal" }, {} as never)

    expect(registrations).toHaveLength(1)
    expect(registrations[0]).toEqual(
      expect.objectContaining({
        order: 250,
        slots: expect.objectContaining({ sidebar_content: expect.any(Function) }),
      }),
    )
  })
})
