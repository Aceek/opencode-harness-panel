import { describe, expect, test } from "bun:test"
import { resolveConfig, sectionNames } from "../src/config"

describe("configuration", () => {
  test("uses the safe balanced preset by default", () => {
    const config = resolveConfig(undefined)

    expect(config.preset).toBe("balanced")
    expect(config.provenance).toBeFalse()
    expect(config.sections.runtime).toBeFalse()
    expect(config.sections.skills).toBeTrue()
    expect(config.sections.subagents).toBeTrue()
    expect(config.sections.tools).toBeFalse()
    expect(config.sections.hooks).toBeFalse()
    expect(config.sections.plugins).toBeFalse()
    expect(config.sections.integrations).toBeFalse()
    expect(config.sections.mcp).toBeFalse()
    expect(config.sections.files).toBeFalse()
    expect(config.privacy).toEqual({ paths: "basename", arguments: "hidden", errors: "summary" })
    expect(config.limits.itemsPerSection).toBe(8)
  })

  test("applies section overrides after presets", () => {
    const config = resolveConfig({ preset: "minimal", provenance: true, sections: { runtime: false, mcp: true } })

    expect(config.sections.runtime).toBeFalse()
    expect(config.sections.mcp).toBeTrue()
    expect(config.sections.skills).toBeFalse()
    expect(config.sections.subagents).toBeTrue()
    expect(config.provenance).toBeTrue()
  })

  test("enables every known section for all", () => {
    const config = resolveConfig({ preset: "all" })

    expect(sectionNames.every((name) => config.sections[name])).toBeTrue()
  })

  test("ignores invalid values and clamps limits", () => {
    const low = resolveConfig({ preset: "invalid", sections: { files: "yes" }, limits: { itemsPerSection: -4 } })
    const high = resolveConfig({ limits: { itemsPerSection: 100 } })

    expect(low.preset).toBe("balanced")
    expect(low.sections.files).toBeFalse()
    expect(low.limits.itemsPerSection).toBe(1)
    expect(high.limits.itemsPerSection).toBe(20)
  })
})
