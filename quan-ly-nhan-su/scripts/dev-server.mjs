import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

// Turbopack's native directory watcher crashes on this Windows drive
// (exit 3221225477). Webpack with polling stays up.
const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "-p", "3010"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    WATCHPACK_POLLING: "true",
    CHOKIDAR_USEPOLLING: "true",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
