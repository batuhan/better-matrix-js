const execPath = process.env.npm_execpath ?? "";

if (!execPath.includes("pnpm")) {
  console.error(
    "Publish this workspace with `pnpm publish:packages` so workspace dependencies are rewritten for npm."
  );
  process.exit(1);
}
