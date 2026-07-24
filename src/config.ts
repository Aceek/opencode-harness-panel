export const sectionNames = [
  "runtime",
  "skills",
  "subagents",
  "tools",
  "plugins",
  "hooks",
  "integrations",
  "agents",
  "commands",
  "references",
  "permissions",
  "mcp",
  "lsp",
  "files",
  "todos",
] as const

export type SectionName = (typeof sectionNames)[number]
export type PresetName = "minimal" | "balanced" | "all"

export type HarnessConfig = {
  preset: PresetName
  provenance: boolean
  sections: Record<SectionName, boolean>
  privacy: {
    paths: "hidden" | "basename"
    arguments: "hidden"
    errors: "hidden" | "summary"
  }
  limits: {
    itemsPerSection: number
  }
}

const presetSections: Record<PresetName, readonly SectionName[]> = {
  minimal: ["subagents"],
  balanced: ["skills", "subagents"],
  all: sectionNames,
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  return value as Record<string, unknown>
}

export function resolveConfig(options: Record<string, unknown> | undefined): HarnessConfig {
  const source = record(options) ?? {}
  const preset: PresetName =
    source.preset === "minimal" || source.preset === "all" || source.preset === "balanced" ? source.preset : "balanced"
  const enabled = new Set(presetSections[preset])
  const overrides = record(source.sections)
  const sections = Object.fromEntries(
    sectionNames.map((name) => [name, typeof overrides?.[name] === "boolean" ? overrides[name] : enabled.has(name)]),
  ) as Record<SectionName, boolean>

  const privacyInput = record(source.privacy)
  const paths = privacyInput?.paths === "hidden" ? "hidden" : "basename"
  const errors = privacyInput?.errors === "hidden" ? "hidden" : "summary"
  const limits = record(source.limits)
  const requestedLimit = limits?.itemsPerSection
  const itemsPerSection =
    typeof requestedLimit === "number" && Number.isInteger(requestedLimit)
      ? Math.min(20, Math.max(1, requestedLimit))
      : 8

  return {
    preset,
    provenance: source.provenance === true,
    sections,
    privacy: { paths, arguments: "hidden", errors },
    limits: { itemsPerSection },
  }
}
