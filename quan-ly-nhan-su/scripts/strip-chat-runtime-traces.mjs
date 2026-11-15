import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const runtime = resolve(".codex-chat");

// Next's tracing glob excludes do not normalize Windows paths; remove private runtime entries explicitly.
async function clean(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "cache" || entry.name === "dev") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await clean(path);
    } else if (entry.name.endsWith(".nft.json")) {
      const trace = JSON.parse(await readFile(path, "utf8"));
      const files = trace.files.filter((file) => {
        const location = relative(runtime, resolve(dirname(path), file));
        return location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location);
      });
      if (files.length !== trace.files.length) await writeFile(path, JSON.stringify({ ...trace, files }));
    }
  }
}

await clean(resolve(".next"));
console.log("Build traces exclude private chatbot runtime files.");
