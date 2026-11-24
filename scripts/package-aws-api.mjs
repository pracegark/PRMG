import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDir = join(root, "dist");
const work = await mkdtemp(join(tmpdir(), "prmg-api-"));
const packageConfig = JSON.parse(await readFile(join(root, "aws-api", "package.json"), "utf8"));
try {
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(work, "package.json"), JSON.stringify(packageConfig, null, 2));
  const install = spawnSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: work, stdio: "inherit" });
  if (install.status !== 0) throw new Error("Could not install the AWS API runtime packages.");

  await cp(join(root, "aws-api"), join(work, "aws-api"), { recursive: true });
  await mkdir(join(work, "database"), { recursive: true });
  await cp(join(root, "database", "schema.postgres.sql"), join(work, "database", "schema.postgres.sql"));
  await cp(join(root, "database", "general-jobs.json"), join(work, "database", "general-jobs.json"));
  await mkdir(join(work, "scripts"), { recursive: true });
  await cp(join(root, "scripts", "resume-contact-algorithm.mjs"), join(work, "scripts", "resume-contact-algorithm.mjs"));
  const zip = spawnSync("zip", ["-qr", join(outputDir, "prmg-api.zip"), "."], { cwd: work, stdio: "inherit" });
  if (zip.status !== 0) throw new Error("Could not create the AWS API deployment package.");
  console.log(`Created ${join(outputDir, "prmg-api.zip")}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
