import solidPlugin from "@opentui/solid/bun-plugin"
import { rm } from "node:fs/promises"

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true })

const build = await Bun.build({
  entrypoints: [new URL("../src/index.tsx", import.meta.url).pathname],
  outdir: new URL("../dist", import.meta.url).pathname,
  target: "bun",
  format: "esm",
  packages: "external",
  sourcemap: "external",
  plugins: [solidPlugin],
})

if (!build.success) {
  for (const log of build.logs) console.error(log)
  process.exit(1)
}

const declarations = Bun.spawn(["bunx", "tsc", "--emitDeclarationOnly"], {
  cwd: new URL("..", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
})

process.exit(await declarations.exited)
