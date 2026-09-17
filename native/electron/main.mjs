import { app, BrowserWindow, Menu, protocol, net, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wwwDev = path.join(__dirname, "www");
const wwwRes = path.join(process.resourcesPath, "www");
const WWW = fs.existsSync(wwwDev) ? wwwDev : wwwRes;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "tdw",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveWww(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname || "/");
  if (pathname === "/" || pathname === "") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.normalize(path.join(WWW, pathname.replace(/^\/+/, "")));
  if (!filePath.startsWith(WWW)) return path.join(WWW, "index.html");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return path.join(WWW, "index.html");
  }
  return filePath;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: "#36393c",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  void win.loadURL("tdw://app/");
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("tdw", (request) => net.fetch(pathToFileURL(resolveWww(request.url)).href));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
