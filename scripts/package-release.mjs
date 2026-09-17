#!/usr/bin/env node
/**
 * Pack pages-dist into a downloadable offline zip for GitHub Releases.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = existsSync(join(ROOT, "portable-dist"))
  ? join(ROOT, "portable-dist")
  : join(ROOT, "pages-dist");
const OUT_DIR = join(ROOT, "release");
const STAGE = join(OUT_DIR, "staging");
const ZIP_NAME = "thirty-dollar-website-offline.zip";
const ZIP_PATH = join(OUT_DIR, ZIP_NAME);

if (!existsSync(SRC)) {
  console.error("package-release: portable-dist/pages-dist missing. Run npm run build:portable first.");
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
cpSync(SRC, STAGE, {
  recursive: true,
  filter: (from) => !from.split(/[/\\]/).includes("__grok"),
});

function stripGrok(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.name === "__grok" || /grok/i.test(name.name)) {
      rmSync(p, { recursive: true, force: true });
      continue;
    }
    if (name.isDirectory()) stripGrok(p);
  }
}
stripGrok(STAGE);

for (const extra of ["LICENSE", "NOTICE"]) {
  const from = join(ROOT, extra);
  if (existsSync(from)) cpSync(from, join(STAGE, extra));
}

writeFileSync(
  join(STAGE, "README-OFFLINE.txt"),
  `DON'T YOU LECTURE ME WITH YOUR THIRTY DOLLAR WEBSITE — REMADE offline package

This zip is a static PWA. Sounds, icons, fonts, and the board are included.

Run it on any OS (needs a local web server — browsers block file:// for modules):

  Windows:  start.bat
  macOS / Linux:  sh start.sh

Then open the URL printed (default http://127.0.0.1:8080/).

Or from this folder:

  python3 -m http.server 8080
  npx --yes serve -l 8080

Install as an app from the browser (Install button, or Add to Home screen /
Install page as app) so Play works fully offline afterwards.

Official original: https://thirtydollar.website/
Source: https://github.com/mounsokdara/thirty-dollar-website
`,
);

writeFileSync(
  join(STAGE, "start.sh"),
  `#!/bin/sh
cd "$(dirname "$0")"
PORT="\${PORT:-8080}"
echo "Thirty Dollar Website (REMADE) — http://127.0.0.1:$PORT/"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
fi
if command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
fi
if command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT"
fi
echo "Need python3 or Node.js (npx) to serve this folder."
exit 1
`,
);

writeFileSync(
  join(STAGE, "start.bat"),
  `@echo off
cd /d "%~dp0"
set PORT=8080
echo Thirty Dollar Website (REMADE) — http://127.0.0.1:%PORT%/
where py >nul 2>&1 && py -m http.server %PORT% && goto :eof
where python >nul 2>&1 && python -m http.server %PORT% && goto :eof
where npx >nul 2>&1 && npx --yes serve -l %PORT% && goto :eof
echo Need Python or Node.js to serve this folder.
pause
`,
);

execFileSync("chmod", ["+x", join(STAGE, "start.sh")]);

if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);
execFileSync("zip", ["-r", "-q", ZIP_PATH, "."], { cwd: STAGE });

const bytes = statSync(ZIP_PATH).size;
const mb = (bytes / (1024 * 1024)).toFixed(1);

writeFileSync(
  join(OUT_DIR, "RELEASE_NOTES.md"),
  `## Offline package

Download **${ZIP_NAME}** (${mb} MB) and unzip it on Windows, macOS, or Linux.

- Run \`start.bat\` (Windows) or \`sh start.sh\` (macOS / Linux)
- Open the printed address and tap **Install** to keep it offline

This remake is not the official site. Original: https://thirtydollar.website/

Live PWA: https://mounsokdara.github.io/thirty-dollar-website/
`,
);

console.log(`package-release: wrote ${ZIP_PATH} (${mb} MB)`);
