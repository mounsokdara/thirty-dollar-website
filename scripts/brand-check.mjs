#!/usr/bin/env node
/**
 * Brand-asset gate shared by browser-smoke.mjs (and unit-testable without a
 * browser): a canvas app is almost always a game / visually rich app, and
 * those must ship a custom share card — the default og.grok.me placeholder is
 * not acceptable for them (see .grok/skills/og/SKILL.md).
 *
 * Games must also set type=x:game in src/lib/og/site.json so the platform
 * injector emits og:type for X game-card unfurls, and public/x-banner.jpg for
 * the 50:11 X feed card. A card file is enough for bake to emit /og.jpg, but
 * brand-check still requires site.json `"card": "custom"` so the agent-facing
 * contract stays explicit.
 *
 * Checked on the filesystem (not the served head) so preview and mid-scaffold
 * workspaces are judged the same way.
 *
 * Also runnable, so the background brand task can check its own work before it
 * reports (the parent answers without waiting for it):
 *
 *   node scripts/brand-check.mjs [--game] [--placeholder-ok] [--root <dir>]
 *
 * That run judges the files on disk even though the task is holding the
 * og-pending marker; the marker only silences what the parent's gates see. It
 * also requires the custom card: its caller is normally the pass that exists to
 * produce one, so the placeholder the parent tolerates for a plain utility is a
 * failed pass here. --placeholder-ok is for the other launch — a pass doing
 * favicon, PWA icons and title for a plain utility that keeps the og.grok.me
 * card — where no card is the expected verdict rather than a failure.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OG_SITE_REL_PATH, readOgSite, siteHasCustomCard } from "./pwa-shared.mjs";
