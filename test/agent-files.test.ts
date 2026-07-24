import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { collectAgentFileEvidence } from "../src/agent-files"

const temporaryDirectories: string[] = []

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "opencode-harness-panel-"))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("agent file evidence collection", () => {
  test("scans recursive markdown filenames and normalizes their names", async () => {
    const root = await temporaryDirectory()
    const config = path.join(root, "config")
    const worktree = path.join(root, "project")
    const directory = path.join(worktree, "packages", "app")
    await Promise.all([
      mkdir(path.join(config, "agent"), { recursive: true }),
      mkdir(path.join(directory, ".opencode", "agents", "nested"), { recursive: true }),
    ])
    await Promise.all([
      writeFile(path.join(config, "agent", "user.agent.md"), "secret user prompt"),
      writeFile(path.join(config, "agent", "ignored.txt"), "not markdown"),
      writeFile(path.join(directory, ".opencode", "agents", "project-agent.md"), "secret project prompt"),
      writeFile(path.join(directory, ".opencode", "agents", "nested", "reviewer.md"), "nested"),
    ])

    const result = await collectAgentFileEvidence({ config, directory, worktree })

    expect(result).toEqual({
      agents: [
        { name: "nested/reviewer", contributions: ["project file"] },
        { name: "project-agent", contributions: ["project file"] },
        { name: "user.agent", contributions: ["user file"] },
      ],
      status: "complete",
    })
    expect(JSON.stringify(result)).not.toContain(root)
    expect(JSON.stringify(result)).not.toContain("secret")
  })

  test("follows file and directory symlinks without looping", async () => {
    const root = await temporaryDirectory()
    const config = path.join(root, "config")
    const worktree = path.join(root, "project")
    const agents = path.join(config, "agents")
    const external = path.join(root, "external")
    await Promise.all([mkdir(agents, { recursive: true }), mkdir(worktree, { recursive: true }), mkdir(external)])
    await writeFile(path.join(external, "linked.md"), "private")
    await Promise.all([
      symlink(path.join(external, "linked.md"), path.join(agents, "file-link.md")),
      symlink(external, path.join(agents, "team")),
      symlink(agents, path.join(external, "loop")),
    ])

    const result = await collectAgentFileEvidence({ config, directory: worktree, worktree })

    expect(result.agents).toEqual([
      { name: "file-link", contributions: ["user file"] },
      { name: "team/linked", contributions: ["user file"] },
    ])
  })

  test("ignores broken symlinks without hiding valid agents", async () => {
    const root = await temporaryDirectory()
    const config = path.join(root, "config")
    const worktree = path.join(root, "project")
    const agents = path.join(config, "agents")
    await Promise.all([mkdir(agents, { recursive: true }), mkdir(worktree, { recursive: true })])
    await Promise.all([
      symlink(path.join(root, "missing.md"), path.join(agents, "broken.md")),
      writeFile(path.join(agents, "valid.md"), "private"),
    ])

    const result = await collectAgentFileEvidence({ config, directory: worktree, worktree })

    expect(result).toEqual({
      agents: [{ name: "valid", contributions: ["user file"] }],
      status: "complete",
    })
  })

  test("merges collisions across singular, plural, user, and project directories", async () => {
    const root = await temporaryDirectory()
    const config = path.join(root, "config")
    const worktree = path.join(root, "project")
    const directory = path.join(worktree, "child")
    const directories = [
      path.join(config, "agent"),
      path.join(config, "agents"),
      path.join(worktree, ".opencode", "agent"),
      path.join(directory, ".opencode", "agents"),
    ]
    await Promise.all(directories.map((item) => mkdir(item, { recursive: true })))
    await Promise.all(directories.map((item) => writeFile(path.join(item, "shared.md"), "private")))

    const result = await collectAgentFileEvidence({ config, directory, worktree })

    expect(result.agents).toEqual([{ name: "shared", contributions: ["user file", "project file"] }])
  })

  test("treats absent conventional directories as an empty successful scan", async () => {
    const root = await temporaryDirectory()
    const config = path.join(root, "config")
    const worktree = path.join(root, "project")
    const directory = path.join(worktree, "missing-child")

    const result = await collectAgentFileEvidence({ config, directory, worktree })

    expect(result).toEqual({ agents: [], status: "complete" })
  })

  test("fails closed without throwing when public roots cannot define a project range", async () => {
    const root = await temporaryDirectory()

    await expect(
      collectAgentFileEvidence({
        config: path.join(root, "config"),
        directory: path.join(root, "outside"),
        worktree: path.join(root, "project"),
      }),
    ).resolves.toEqual({ agents: [], status: "unavailable" })
  })

  test("skips project files when project configuration is disabled", async () => {
    const root = await temporaryDirectory()
    const config = path.join(root, "config")
    const worktree = path.join(root, "project")
    await Promise.all([
      mkdir(path.join(config, "agents"), { recursive: true }),
      mkdir(path.join(worktree, ".opencode", "agents"), { recursive: true }),
    ])
    await Promise.all([
      writeFile(path.join(config, "agents", "shared.md"), "user"),
      writeFile(path.join(worktree, ".opencode", "agents", "shared.md"), "project"),
    ])

    const result = await collectAgentFileEvidence({
      config,
      directory: worktree,
      worktree,
      projectConfigEnabled: false,
    })

    expect(result.agents).toEqual([{ name: "shared", contributions: ["user file"] }])
  })
})
