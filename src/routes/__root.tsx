import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { asset } from "@/lib/asset";
import appCss from "../styles.css?url";

const APP_NAME = "DON'T YOU LECTURE ME WITH YOUR THIRTY DOLLAR WEBSITE";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=820" },
      { title: APP_NAME },
      { name: "theme-color", content: "#36393c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Thirty Dollar" },
      { name: "application-name", content: "Thirty Dollar" },
      {
        name: "description",
        content: "REMADE meme soundboard sequencer. Click sounds into a sequence, pitch them, and hit Play. Works offline.",
      },
    ],
    links: [
      { rel: "icon", href: asset("assets/🗿.png") },
      { rel: "icon", type: "image/svg+xml", href: asset("favicon.svg") },
      { rel: "icon", type: "image/png", sizes: "32x32", href: asset("favicon.png") },
      { rel: "apple-touch-icon", href: asset("apple-touch-icon.png") },
      { rel: "stylesheet", href: appCss },
      { rel: "preload", href: asset("fonts/discord-emoji.woff2"), as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: asset("fonts/lato-700.woff2"), as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "manifest", href: asset("manifest.webmanifest") },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
