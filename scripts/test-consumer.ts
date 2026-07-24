import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const root = path.resolve(import.meta.dir, "..")

async function run(command: string[], cwd: string): Promise<string> {
  const process = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed\n${stdout}\n${stderr}`)
  return stdout
}

function packedFilename(output: string): string | undefined {
  const parsed: unknown = JSON.parse(output)
  const entries = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? Object.values(parsed) : []
  for (const entry of entries) {
    if (entry && typeof entry === "object" && "filename" in entry && typeof entry.filename === "string") {
      return entry.filename
    }
  }
}

const consumer = await mkdtemp(path.join(tmpdir(), "opencode-harness-panel-consumer-"))
let tarball: string | undefined

try {
  const filename = packedFilename(await run(["npm", "pack", "--json", "--ignore-scripts"], root))
  if (!filename) throw new Error("npm pack did not report a tarball filename")
  tarball = path.join(root, filename)

  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "harness-panel-consumer", private: true, type: "module" }),
  )
  await writeFile(
    path.join(consumer, "tui.jsonc"),
    '{"$schema":"https://opencode.ai/tui.json","plugin":[["opencode-harness-panel",{"preset":"balanced"}]]}',
  )
  await run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer)
  await writeFile(
    path.join(consumer, "verify.mjs"),
    'import plugin from "opencode-harness-panel/tui"\nif (plugin.id !== "opencode-harness-panel") throw new Error("unexpected plugin ID")\nif (typeof plugin.tui !== "function") throw new Error("missing TUI entrypoint")\n',
  )
  await run(["bun", "run", "verify.mjs"], consumer)
} finally {
  await Promise.all([
    rm(consumer, { recursive: true, force: true }),
    ...(tarball ? [rm(tarball, { force: true })] : []),
  ])
}
