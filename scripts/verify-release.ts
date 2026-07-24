const pkg = (await Bun.file(new URL("../package.json", import.meta.url)).json()) as { version?: unknown }
const tag = process.env.GITHUB_REF_NAME

if (typeof pkg.version !== "string" || !pkg.version) throw new Error("package.json must define a version")
if (!tag) throw new Error("GITHUB_REF_NAME is required to verify a release tag")
if (tag !== `v${pkg.version}`) {
  throw new Error(`Release tag ${tag} does not match package version ${pkg.version}`)
}
