import { spawn } from "node:child_process";
import { join } from "node:path";

const forwarded = process.argv.slice(2);
const args = [];

for (let index = 0; index < forwarded.length; index += 1) {
  const argument = forwarded[index];
  if (argument === "--strictPort") continue;
  if (argument === "--host") {
    args.push("--hostname");
    if (forwarded[index + 1]) args.push(forwarded[index += 1]);
    continue;
  }
  args.push(argument);
}

const executable = join(process.cwd(), "node_modules", ".bin", "next");
const child = spawn(executable, ["dev", ...args], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
