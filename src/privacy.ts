const secretAssignment = /\b(api[_-]?key|token|secret|password|authorization)\b\s*[:=]\s*[^\s,;]+/gi
const bearerToken = /\bbearer\s+[^\s,;]+/gi
const commonToken = /\b(?:sk-[a-z0-9_-]{8,}|gh[pousr]_[a-z0-9]{8,})\b/gi

export function redactText(value: string): string {
  return value
    .replace(secretAssignment, "$1=[redacted]")
    .replace(bearerToken, "Bearer [redacted]")
    .replace(commonToken, "[redacted]")
}

export function safeLabel(value: string, maxLength = 48): string {
  const clean = redactText(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, Math.max(1, maxLength - 3))}...`
}

export function pathLabel(value: string, policy: "hidden" | "basename"): string {
  if (policy === "hidden") return "[hidden]"
  const normalized = value.replace(/[\\/]+$/, "")
  return safeLabel(normalized.split(/[\\/]/).at(-1) || ".")
}

export function pluginLabel(spec: string, policy: "hidden" | "basename"): string {
  const packageMatch = spec.match(/^(?:@[^/]+\/)?[^/@]+/)
  if (!spec.includes("/") && packageMatch) return safeLabel(packageMatch[0])
  if (spec.startsWith("@") && packageMatch) return safeLabel(packageMatch[0])
  return pathLabel(spec.replace(/^file:\/\//, ""), policy)
}
