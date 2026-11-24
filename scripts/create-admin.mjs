import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataRoot = resolve(projectRoot, "data");
mkdirSync(dataRoot, { recursive: true });
const database = new DatabaseSync(resolve(dataRoot, "prmg.sqlite"));
database.exec("CREATE TABLE IF NOT EXISTS users (userid INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, userpassword TEXT NOT NULL, testCredentials INTEGER NOT NULL DEFAULT 0 CHECK (testCredentials IN (0, 1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");

const readline = createInterface({ input: stdin, output: stdout });
const username = (await readline.question("Admin username: ")).trim();
readline.close();
if (!username || username.length > 150) throw new Error("Username must contain 1 to 150 characters.");

function readHidden(prompt) {
  return new Promise((resolvePromise, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Run this command in a terminal so the password can be entered without echoing."));
      return;
    }
    stdout.write(prompt);
    let value = "";
    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolvePromise(value);
    };
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") return finish(new Error("Cancelled."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " " && char !== "\u007f") value += char;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

const password = await readHidden("Admin password (12+ characters): ");
if (password.length < 12 || password.length > 1024) throw new Error("Password must contain 12 to 1024 characters.");
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
try {
  database.prepare("INSERT INTO users (username, userpassword, testCredentials) VALUES (?, ?, 0)").run(username, `${salt}:${hash}`);
  console.log(`Administrator account “${username}” created.`);
} catch (error) {
  if (String(error.message).includes("UNIQUE")) throw new Error("That username already exists.");
  throw error;
} finally {
  database.close();
}
