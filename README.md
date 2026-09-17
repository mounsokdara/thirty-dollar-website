# DON'T YOU LECTURE ME WITH YOUR THIRTY DOLLAR CLONE WEBSITE

**REMADE** of Colon's original sequencer: [thirtydollar.website](https://thirtydollar.website/)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://github.com/mounsokdara/thirty-dollar-website/actions/workflows/build.yml/badge.svg)](https://github.com/mounsokdara/thirty-dollar-website/actions/workflows/build.yml)
[![Pages](https://github.com/mounsokdara/thirty-dollar-website/actions/workflows/pages.yml/badge.svg)](https://github.com/mounsokdara/thirty-dollar-website/actions/workflows/pages.yml)

**Live (installable PWA):** https://mounsokdara.github.io/thirty-dollar-website/

**Source:** https://github.com/mounsokdara/thirty-dollar-website

Install it on **Android, Windows, macOS, or Linux**. After the first visit, sounds, icons, fonts, and the board stay cached so **Play works offline**.

Every push publishes native installers on [Releases](https://github.com/mounsokdara/thirty-dollar-website/releases/latest):

| File | OS |
| --- | --- |
| `ThirtyDollarWebsite.apk` | Android (sideload) |
| `ThirtyDollarWebsite-*-windows-setup.exe` | Windows installer |
| `ThirtyDollarWebsite-*-windows-portable.exe` | Windows, no install |
| `ThirtyDollarWebsite-*-macos.dmg` | macOS |
| `ThirtyDollarWebsite-*-linux.AppImage` | Linux |
| `thirty-dollar-website-offline.zip` | Any OS (static folder) |

These are unsigned sideload builds (Windows SmartScreen / macOS Gatekeeper will warn). iPhone uses Safari → Add to Home Screen.

## Official original

This remake is **not** the official site and is **not affiliated** with Colon / GDColon. The original is:

- **https://thirtydollar.website/** by [Colon / GDColon](https://gdcolon.com)

Please support the original. This repo exists so anyone can run, fork, and use the board offline on any OS.

The remake source is [MIT](LICENSE). Credits for the official site and third-party assets are in [NOTICE](NOTICE).

## Install (offline app)

Open the [live site](https://mounsokdara.github.io/thirty-dollar-website/) over HTTPS, then:

| OS | How |
| --- | --- |
| **Android** | Chrome/Edge → address-bar install icon, or menu → Add to Home screen |
| **Windows** | Chrome or Edge → install icon in the address bar, or ⋮ → Install app |
| **macOS** | Chrome/Edge → Install page as app. Safari 17+ → File → Add to Dock |
| **Linux** | Chrome/Chromium → install icon, or menu → Install |
| **iPhone / iPad** | Safari → Share → Add to Home Screen |

Or tap **Install** at the bottom of the board. The app icon is the original moai emoji (🗿).

## Run on any OS (from GitHub)

Needs [Node.js 22+](https://nodejs.org/).

```bash
git clone https://github.com/mounsokdara/thirty-dollar-website.git
cd thirty-dollar-website
npm install
npm run dev
```

Then open the URL printed in the terminal (default `http://localhost:8080`).

```bash
npm run build         # production build (Vercel / preview)
npm run build:pages   # static GitHub Pages bundle
npm run preview       # serve the production build locally
npm run typecheck     # TypeScript
```

GitHub Actions:

- `.github/workflows/build.yml` — typecheck + production build on every push
- `.github/workflows/pages.yml` — GitHub Pages + **APK / EXE / DMG / AppImage / zip** attached to [Releases](https://github.com/mounsokdara/thirty-dollar-website/releases)

The hosted app is `https://mounsokdara.github.io/thirty-dollar-website/`. If that URL 404s on a brand-new repo, open **Settings → Pages** once and set source to the `gh-pages` branch (or GitHub Actions). After that, every push deploys itself.

## Native installers (APK / EXE / DMG / AppImage)

GitHub Actions builds them on every push to `main` and attaches them to [Releases](https://github.com/mounsokdara/thirty-dollar-website/releases/latest).

| OS | File | How |
| --- | --- | --- |
| **Android** | `.apk` | Enable unknown sources, open the APK |
| **Windows** | `.exe` | Run setup, or use the portable exe |
| **macOS** | `.dmg` | Drag to Applications, then right-click → Open |
| **Linux** | `.AppImage` | `chmod +x` and run |
| **iPhone / iPad** | PWA | Safari → Share → Add to Home Screen |

## Offline zip (any OS)

Every push to `main` updates the [**Latest offline package**](https://github.com/mounsokdara/thirty-dollar-website/releases/latest) release. GitHub also auto-attaches source archives. The extra file is `thirty-dollar-website-offline.zip`:

1. Download and unzip on Windows, macOS, or Linux
2. Run `start.bat` (Windows) or `sh start.sh` (macOS / Linux)
3. Open the printed address, then tap **Install** so Play works without a network

Tag a version (`v1.1.0`) to keep a frozen package next to `latest`.

## License

[MIT](LICENSE) for the remake source. See [NOTICE](NOTICE) for the official site credit. Meme samples stay with their owners. Twemoji is CC-BY 4.0.



**GD Colon** Please Dont sue me for this, AI Getting too advanced/out of hand these day, This only take me 1 prompot 💀
