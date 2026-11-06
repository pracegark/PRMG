import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = join(projectRoot, "dist");
const excludedEntries = new Set([
  ".azure", ".git", ".github", ".vscode", "dist", "node_modules", "partials", "scripts", "_notes",
  ".DS_Store", ".gitignore", "package-lock.json", "package.json", "server.mjs"
]);
const headerMarker = "<!-- SHARED_SITE_HEADER -->";
const headerTemplate = readFileSync(join(projectRoot, "partials", "site-header.html"), "utf8");
const footerMarker = "<!-- SHARED_SITE_FOOTER -->";
const footerTemplate = readFileSync(join(projectRoot, "partials", "site-footer.html"), "utf8");

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
for (const entry of readdirSync(projectRoot, { withFileTypes: true })) {
  if (excludedEntries.has(entry.name)) continue;
  cpSync(join(projectRoot, entry.name), join(outputRoot, entry.name), { recursive: true });
}

function buildHtml(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      buildHtml(filePath);
      continue;
    }
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".html") continue;

    const source = readFileSync(filePath, "utf8");
    if (!source.includes(headerMarker) && !source.includes(footerMarker)) continue;
    const pathFromPageToRoot = relative(dirname(filePath), outputRoot).split(sep).join("/");
    const rootPrefix = pathFromPageToRoot ? `${pathFromPageToRoot}/` : "";
    const header = headerTemplate.replaceAll("{{ROOT}}", rootPrefix);
    const footer = footerTemplate.replaceAll("{{ROOT}}", rootPrefix);
    const builtHtml = source.replaceAll(headerMarker, header).replaceAll(footerMarker, footer);
    writeFileSync(filePath, builtHtml);
  }
}

buildHtml(outputRoot);
console.log(`Built site into ${relative(projectRoot, outputRoot)}.`);
