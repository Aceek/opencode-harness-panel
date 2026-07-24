import { describe, expect, test } from "bun:test"
import { pathLabel, pluginLabel, redactText, safeLabel } from "../src/privacy"

describe("privacy helpers", () => {
  test("keeps only a path basename", () => {
    expect(pathLabel("/home/alice/private/project/file.ts", "basename")).toBe("file.ts")
    expect(pathLabel("C:\\Users\\alice\\secret.txt", "basename")).toBe("secret.txt")
    expect(pathLabel("/home/alice/private", "hidden")).toBe("[hidden]")
  })

  test("redacts assigned and common token formats", () => {
    const value = redactText("API_KEY=abc123 Bearer top-secret sk-1234567890 ghp_1234567890")

    expect(value).not.toContain("abc123")
    expect(value).not.toContain("top-secret")
    expect(value).not.toContain("sk-1234567890")
    expect(value).not.toContain("ghp_1234567890")
  })

  test("sanitizes labels and plugin specs", () => {
    expect(safeLabel("agent\npassword=hunter2")).toBe("agent password=[redacted]")
    expect(pluginLabel("@scope/plugin@1.2.3", "basename")).toBe("@scope/plugin")
    expect(pluginLabel("file:///home/alice/plugins/local.ts", "basename")).toBe("local.ts")
  })
})
