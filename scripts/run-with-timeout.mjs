import { spawn } from "node:child_process";

const [timeoutValue, command, ...args] = process.argv.slice(2);
const timeoutMs = Number(timeoutValue);

if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !command) {
  console.error("Usage: node scripts/run-with-timeout.mjs <milliseconds> <command> [args...]");
  process.exit(64);
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: false,
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`Command exceeded ${timeoutMs} ms; stopping it.`);
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
}, timeoutMs);

child.once("error", (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exitCode = 69;
});

child.once("exit", (code, signal) => {
  clearTimeout(timer);
  if (timedOut) {
    process.exitCode = 124;
    return;
  }
  if (signal) {
    console.error(`Command stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
