/** Public-file URL that works at `/` and GitHub Pages `/thirty-dollar-website/`. */
export function asset(path: string) {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${String(path).replace(/^\//, "")}`;
}
