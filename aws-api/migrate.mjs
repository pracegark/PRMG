import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Pool } from "pg";

const secrets = new SecretsManagerClient({});
const rdsCa = await readFile(new URL("./certs/global-bundle.pem", import.meta.url));

export async function handler() {
  if (!process.env.DB_SECRET_ARN) throw new Error("DB_SECRET_ARN is not configured.");
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
  const credentials = JSON.parse(result.SecretString || "{}");
  const pool = new Pool({
    host: process.env.DB_HOST || credentials.host,
    port: Number(process.env.DB_PORT || credentials.port || 5432),
    database: process.env.DB_NAME || credentials.dbname || "prmg",
    user: process.env.DB_USER || credentials.username,
    password: credentials.password,
    ssl: { ca: rdsCa, rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10000
  });

  try {
    const schema = await readFile(new URL("../database/schema.postgres.sql", import.meta.url), "utf8");
    await pool.query(schema);
    const titles = JSON.parse(await readFile(new URL("../database/general-jobs.json", import.meta.url), "utf8"));
    for (let index = 0; index < titles.length; index += 1) {
      await pool.query(
        "INSERT INTO general_jobs (title, sort_order) VALUES ($1, $2) ON CONFLICT ((LOWER(title))) DO UPDATE SET sort_order = EXCLUDED.sort_order",
        [titles[index], index + 1]
      );
    }
    if (!process.env.APP_DB_SECRET_ARN) throw new Error("APP_DB_SECRET_ARN is not configured.");
    const appDbResult = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.APP_DB_SECRET_ARN }));
    const appDbCredentials = JSON.parse(appDbResult.SecretString || "{}");
    const roleName = String(appDbCredentials.username || "");
    const appPassword = String(appDbCredentials.password || "");
    if (roleName !== "prmg_app" || appPassword.length < 32) throw new Error("The application database secret is missing or invalid.");
    const roleExists = await pool.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [roleName]);
    if (!roleExists.rowCount) {
      const createRole = await pool.query("SELECT format('CREATE ROLE prmg_app LOGIN PASSWORD %L', $1::text) AS statement", [appPassword]);
      await pool.query(createRole.rows[0].statement);
    }
    const databaseGrant = await pool.query("SELECT format('GRANT CONNECT ON DATABASE %I TO prmg_app', current_database()) AS statement");
    await pool.query(databaseGrant.rows[0].statement);
    await pool.query("GRANT USAGE ON SCHEMA public TO prmg_app");
    await pool.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prmg_app");
    await pool.query("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prmg_app");
    await pool.query("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prmg_app");
    await pool.query("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO prmg_app");
    if (!process.env.INITIAL_ADMIN_SECRET_ARN) throw new Error("INITIAL_ADMIN_SECRET_ARN is not configured.");
    const adminResult = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.INITIAL_ADMIN_SECRET_ARN }));
    const initialAdmin = JSON.parse(adminResult.SecretString || "{}");
    const username = String(initialAdmin.username || "admin").trim();
    const password = String(initialAdmin.password || "");
    if (!username || password.length < 16) throw new Error("The initial administrator secret is missing or too weak.");
    const existingAdmin = await pool.query("SELECT userid FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1", [username]);
    if (!existingAdmin.rowCount) {
      const salt = randomBytes(16).toString("hex");
      const passwordHash = scryptSync(password, salt, 64).toString("hex");
      await pool.query(
        "INSERT INTO users (username, userpassword, \"testCredentials\") VALUES ($1, $2, FALSE)",
        [username, `${salt}:${passwordHash}`]
      );
    }
    return { ok: true, tables: ["jobs", "general_jobs", "users", "contacts", "candidate_trades"], seededJobTitles: titles.length };
  } finally {
    await pool.end();
  }
}
