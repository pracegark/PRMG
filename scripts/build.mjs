import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = join(projectRoot, "dist");
const publicApiBaseUrl = String(process.env.PRMG_API_BASE_URL || "").trim().replace(/\/$/, "");
if (process.env.AWS_BRANCH && !publicApiBaseUrl) {
  throw new Error("Set the PRMG_API_BASE_URL Amplify environment variable for this branch before building.");
}
const excludedEntries = new Set([
  ".azure", ".git", ".github", ".vscode", "data", "dist", "node_modules", "partials", "scripts", "_notes",
  ".DS_Store", ".gitignore", "README.md", "local-api.mjs", "package-lock.json", "package.json", "server.mjs"
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
    const pathFromPageToRoot = relative(dirname(filePath), outputRoot).split(sep).join("/");
    const rootPrefix = pathFromPageToRoot ? `${pathFromPageToRoot}/` : "";
    const header = headerTemplate.replaceAll("{{ROOT}}", rootPrefix);
    const footer = footerTemplate.replaceAll("{{ROOT}}", rootPrefix);
    let builtHtml = source.replaceAll(headerMarker, header).replaceAll(footerMarker, footer);
    const runtimeConfigPath = `${rootPrefix}js/deployment-config.js`;
    if (!builtHtml.includes(runtimeConfigPath) && builtHtml.includes("</head>")) {
      builtHtml = builtHtml.replace("</head>", `  <script src="${runtimeConfigPath}"></script>\n</head>`);
    }
    const mobileStylesheetPath = `${rootPrefix}css/mobile.css`;
    if (!builtHtml.includes(mobileStylesheetPath) && builtHtml.includes("</head>")) {
      builtHtml = builtHtml.replace("</head>", `  <link rel="stylesheet" href="${mobileStylesheetPath}">\n</head>`);
    }
    if (builtHtml !== source) writeFileSync(filePath, builtHtml);
  }
}

buildHtml(outputRoot);
const runtimeConfig = `window.PRMG_API_BASE_URL = ${JSON.stringify(publicApiBaseUrl).replaceAll("<", "\\u003c")};\n`;
writeFileSync(join(outputRoot, "js", "deployment-config.js"), runtimeConfig);
console.log(`Built site into ${relative(projectRoot, outputRoot)}.`);
