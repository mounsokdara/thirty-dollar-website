#!/usr/bin/env node
/**
 * Copy the built static site into pages-dist/ (GitHub Pages) or portable-dist/
 * (Electron / APK / offline zip). Prefer prerendered index.html; otherwise snapshot.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const portable = process.env.PORTABLE === "1";
const DEST = join(ROOT, portable ? "portable-dist" : "pages-dist");
const PREFIX = portable ? "" : "/thirty-dollar-website";
const STATIC_CANDIDATES = [
  join(ROOT, ".vercel/output/static"),
  join(ROOT, ".output/public"),
  join(ROOT, "dist/client"),
  join(ROOT, "dist"),
];

const staticDir = STATIC_CANDIDATES.find((p) => existsSync(p));
if (!staticDir) {
  console.error("collect-pages: no static output found. Run PAGES=1 or PORTABLE=1 vite build first.");
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(staticDir, DEST, { recursive: true });
if (!portable) writeFileSync(join(DEST, ".nojekyll"), "");

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

async function snapshotHtml() {
  const indexPath = join(DEST, "index.html");
  if (existsSync(indexPath) && readFileSync(indexPath, "utf8").includes("<div")) {
    return;
  }
  const serverEntry = join(ROOT, ".vercel/output/functions/__server.func/index.mjs");
  if (!existsSync(serverEntry)) {
    writeFallback(indexPath);
    return;
  }
  const port = 4179;
  const child = spawn(
    "npx",
    ["srvx", "--port", String(port), "--static", staticDir, serverEntry],
    { cwd: ROOT, stdio: "ignore" },
  );
  try {
    const html = await waitForHtml(
      portable ? `http://127.0.0.1:${port}/` : `http://127.0.0.1:${port}/thirty-dollar-website/`,
      `http://127.0.0.1:${port}/`,
    );
    if (html && html.includes("<html")) {
      writeFileSync(indexPath, html);
    } else {
      writeFallback(indexPath);
    }
  } finally {
    child.kill("SIGTERM");
  }
}

function writeFallback(indexPath) {
  const assets = existsSync(join(DEST, "assets")) ? readdirSync(join(DEST, "assets")) : [];
  const js = assets.find((f) => f.startsWith("index-") && f.endsWith(".js")) || assets.find((f) => f.endsWith(".js"));
  const css = assets.find((f) => f.endsWith(".css"));
  const base = portable ? "./" : "/thirty-dollar-website/";
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=820"/>
    <title>DON'T YOU LECTURE ME WITH YOUR THIRTY DOLLAR WEBSITE</title>
    <meta name="theme-color" content="#36393c"/>
    <link rel="icon" href="${base}assets/🗿.png"/>
    <link rel="manifest" href="${base}manifest.webmanifest"/>
    <link rel="apple-touch-icon" href="${base}apple-touch-icon.png"/>
    ${css ? `<link rel="stylesheet" href="${base}assets/${css}"/>` : ""}
  </head>
  <body>
    ${js ? `<script type="module" src="${base}assets/${js}"></script>` : "<p>Build missing client bundle.</p>"}
  </body>
</html>
`;
  writeFileSync(indexPath, html);
}

function waitForHtml(...urls) {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = async () => {
      tries += 1;
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            resolve(await res.text());
            return;
          }
        } catch {
          /* not up yet */
        }
      }
      if (tries > 40) {
        resolve("");
        return;
      }
      setTimeout(tick, 250);
    };
    setTimeout(tick, 400);
  });
}

function rebaseLocalUrls(dir) {
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.html$/i.test(name.name)) continue;
      let text = readFileSync(p, "utf8");
      text = text.replace(/<script[^>]*(?:grok|__grok)[^>]*>[\s\S]*?<\/script>/gi, "");
      text = text.replace(/<link[^>]*(?:__grok|grok\.com)[^>]*>/gi, "");
      text = text.replace(/<meta[^>]*(?:grok-project-id|grok:app_id|og\.grok\.me)[^>]*>/gi, "");
      text = text.replace(/https:\/\/grok\.com\/[^"'\s>]+/g, "");
      if (portable) {
        writeFileSync(p, text);
        continue;
      }
      const next = text.replace(
        /(href|src)="(\/(?!\/)(?!thirty-dollar-website\/))/g,
        `$1="${PREFIX}/`,
      );
      writeFileSync(p, next);
    }
  };
  walk(dir);
}

await snapshotHtml();
stripGrok(DEST);
rebaseLocalUrls(DEST);
if (!portable && existsSync(join(DEST, "index.html"))) {
  cpSync(join(DEST, "index.html"), join(DEST, "404.html"));
}
console.log("collect-pages: wrote", DEST);
