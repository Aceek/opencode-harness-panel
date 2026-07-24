import { readdir, realpath, stat } from "node:fs/promises"
import path from "node:path"

export type AgentFileContribution = "user file" | "project file"

export type AgentFileEvidence = {
  name: string
  contributions: AgentFileContribution[]
}

export type AgentFileCollection = {
  agents: AgentFileEvidence[]
  status: "complete" | "partial" | "unavailable"
}

export type AgentFileRoots = {
  config: string
  directory: string
  worktree: string
  projectConfigEnabled?: boolean
}

const contributionOrder: readonly AgentFileContribution[] = ["user file", "project file"]

export function agentNameFromMarkdownFilename(filename: string): string | undefined {
  const normalized = filename.replaceAll("\\", "/")
  if (!normalized.endsWith(".md")) return
  const name = normalized.slice(0, -3)
  return name || undefined
}

function missingDirectory(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false
  return error.code === "ENOENT" || error.code === "ENOTDIR"
}

function projectDirectories(directory: string, worktree: string): string[] | undefined {
  if (!path.isAbsolute(directory) || !path.isAbsolute(worktree)) return
  const start = path.resolve(directory)
  const stop = path.resolve(worktree)
  const relative = path.relative(stop, start)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return

  const result: string[] = []
  let current = start
  while (true) {
    result.push(current)
    if (current === stop) return result
    const parent = path.dirname(current)
    if (parent === current) return
    current = parent
  }
}

async function scanDirectory(
  directory: string,
  contribution: AgentFileContribution,
  agents: Map<string, Set<AgentFileContribution>>,
): Promise<"ok" | "missing" | "failed"> {
  try {
    const visited = new Set<string>()
    async function scan(current: string): Promise<void> {
      const canonical = await realpath(current)
      if (visited.has(canonical)) return
      visited.add(canonical)
      const entries = await readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const absolute = path.join(current, entry.name)
        let kind: { isDirectory(): boolean; isFile(): boolean } = entry
        if (entry.isSymbolicLink()) {
          try {
            kind = await stat(absolute)
          } catch (error) {
            if (missingDirectory(error)) continue
            throw error
          }
        }
        if (kind.isDirectory()) {
          await scan(absolute)
          continue
        }
        if (!kind.isFile()) continue
        const name = agentNameFromMarkdownFilename(path.relative(directory, absolute))
        if (!name) continue
        const contributions = agents.get(name) ?? new Set<AgentFileContribution>()
        contributions.add(contribution)
        agents.set(name, contributions)
      }
    }
    await scan(directory)
    return "ok"
  } catch (error) {
    return missingDirectory(error) ? "missing" : "failed"
  }
}

/**
 * Collects only direct markdown directory-entry names. It never reads agent
 * files or returns any filesystem path.
 */
export async function collectAgentFileEvidence(roots: AgentFileRoots): Promise<AgentFileCollection> {
  try {
    if (!path.isAbsolute(roots.config)) return { agents: [], status: "unavailable" }
    const projects = projectDirectories(roots.directory, roots.worktree)
    if (!projects) return { agents: [], status: "unavailable" }

    const agents = new Map<string, Set<AgentFileContribution>>()
    const candidates: { directory: string; contribution: AgentFileContribution }[] = [
      { directory: path.join(path.resolve(roots.config), "agent"), contribution: "user file" },
      { directory: path.join(path.resolve(roots.config), "agents"), contribution: "user file" },
      ...(roots.projectConfigEnabled === false
        ? []
        : projects.flatMap((directory) => [
            { directory: path.join(directory, ".opencode", "agent"), contribution: "project file" as const },
            { directory: path.join(directory, ".opencode", "agents"), contribution: "project file" as const },
          ])),
    ]

    let failed = false
    for (const candidate of candidates) {
      if ((await scanDirectory(candidate.directory, candidate.contribution, agents)) === "failed") failed = true
    }

    return {
      agents: [...agents]
        .map(([name, values]) => ({
          name,
          contributions: contributionOrder.filter((contribution) => values.has(contribution)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      status: failed ? "partial" : "complete",
    }
  } catch {
    return { agents: [], status: "unavailable" }
  }
}
