import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Pool } from "pg";
import { OfficeParser } from "officeparser";
import WordExtractor from "word-extractor";
import { extractResumeContactDetails } from "../scripts/resume-contact-algorithm.mjs";
import { readFile } from "node:fs/promises";

const secrets = new SecretsManagerClient({});
const rdsCa = await readFile(new URL("./certs/global-bundle.pem", import.meta.url));
const s3 = new S3Client({});
const maxResumeBytes = 10 * 1024 * 1024;
const allowedOrigins = new Set(String(process.env.ALLOWED_ORIGINS || "https://primermg.com,https://www.primermg.com")
  .split(",").map((origin) => origin.trim()).filter(Boolean));
let dbPool;
let cachedSessionSecret;

function jsonResponse(statusCode, payload, origin, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin),
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function corsHeaders(origin) {
  const headers = {
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type,Authorization",
    "access-control-max-age": "600",
    "vary": "Origin"
  };
  if (origin && allowedOrigins.has(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

function clean(value, maxLength = 10000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength);
}

const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

async function getPool() {
  if (dbPool) return dbPool;
  if (!process.env.APP_DB_SECRET_ARN) throw new Error("APP_DB_SECRET_ARN is not configured.");
  const secretResult = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.APP_DB_SECRET_ARN }));
  const credentials = JSON.parse(secretResult.SecretString || "{}");
  dbPool = new Pool({
    host: process.env.DB_HOST || credentials.host,
    port: Number(process.env.DB_PORT || credentials.port || 5432),
    database: process.env.DB_NAME || credentials.dbname || "prmg",
    user: process.env.DB_USER || credentials.username,
    password: credentials.password,
    // PostgreSQL connections use TLS with certificate verification enabled.
    ssl: { ca: rdsCa, rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });
  return dbPool;
}

function signSession(user) {
  const secret = cachedSessionSecret || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  const payload = Buffer.from(JSON.stringify({ sub: String(user.userid), username: user.username, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function authenticatedUser(event, secret) {
  const authorization = String(event.headers?.authorization || event.headers?.Authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.exp > Math.floor(Date.now() / 1000) ? decoded : null;
  } catch { return null; }
}

async function loadSessionSecret() {
  if (cachedSessionSecret) return cachedSessionSecret;
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (!process.env.ADMIN_SESSION_SECRET_ARN) return "";
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.ADMIN_SESSION_SECRET_ARN }));
  cachedSessionSecret = String(result.SecretString || "");
  return cachedSessionSecret;
}

function verifyPassword(password, storedValue) {
  const [salt, expectedHex] = String(storedValue || "").split(":");
  if (!salt || !expectedHex || !/^[a-f\d]{128}$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function dateFilter(value) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const fieldLabels = {
  primaryTrade: "Primary trade / role", desiredPayRate: "Desired pay rate", availableStart: "Available start date",
  travelRelocation: "Travel / relocation", shiftAvailability: "Shift availability", driversLicense: "Driver’s license",
  ownTransport: "Own transportation", twicStatus: "TWIC status", twicExpiration: "TWIC expiration",
  workHistory: "Work experience", certifications: "Certifications and licenses", skillProficiency: "Skills and proficiency",
  desiredPositions: "Desired positions", candidateTrades: "Trades and roles", otherRoles: "Other skills / roles",
  highestEducation: "Education", applicantSignature: "Applicant signature", signatureDate: "Signature date",
  acknowledgement: "Acknowledgement", resumeWorkHistory: "Resume work experience", resumeCertifications: "Resume certifications",
  resumeEducation: "Resume education", resumeSkills: "Resume skills", skills: "Skills"
};
const omittedFields = new Set([
  "firstName", "lastName", "fullName", "email", "phone", "primaryPhone", "alternatePhone", "applicationType",
  "jobId", "jobInterests", "resumeKey", "resumeId", "resumeFilename", "resume"
]);

function formatApplicationDetails(payload) {
  const label = (key) => fieldLabels[key] || key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  const nested = (item) => typeof item === "object" && item !== null
    ? Object.entries(item).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .map(([key, value]) => `${label(key)}: ${Array.isArray(value) ? value.join(", ") : String(value).trim()}`).join("; ")
    : String(item ?? "").trim();
  const lines = [];
  for (const [key, value] of Object.entries(payload || {})) {
    if (omittedFields.has(key) || value === null || value === undefined || value === "") continue;
    const formatted = typeof value === "boolean" ? (value ? "Yes" : "No")
      : Array.isArray(value) ? value.map(nested).filter(Boolean).map((text, i, all) => all.length > 1 ? `${i + 1}. ${text}` : text).join("\n")
        : typeof value === "object" ? nested(value) : String(value).trim().replace(/\r?\n/g, " ");
    if (formatted) lines.push(`${label(key)}: ${formatted}`);
  }
  return lines.join("\n");
}

function tradeSelections(payload) {
  const trades = [];
  const seen = new Set();
  const add = (name, category, selectionType, proficiency = "") => {
    const tradeName = clean(name, 250);
    const key = `${selectionType}\u0000${tradeName.toLocaleLowerCase()}`;
    if (!tradeName || seen.has(key)) return;
    seen.add(key);
    trades.push([tradeName, clean(category, 180), selectionType, clean(proficiency, 80)]);
  };
  (Array.isArray(payload.candidateTrades) ? payload.candidateTrades : []).forEach((item) => {
    if (typeof item === "string") add(item, "", "candidate_trade");
    else if (item && typeof item === "object") add(item.tradeName || item.name, item.category, item.selectionType || "candidate_trade", item.proficiency);
  });
  (Array.isArray(payload.desiredPositions) ? payload.desiredPositions : []).forEach((name) => add(name, "", "desired_position"));
  (Array.isArray(payload.skillProficiency) ? payload.skillProficiency : []).forEach((name) => add(name, "", "skill_proficiency"));
  if (payload.primaryTrade) add(payload.primaryTrade, "", "primary_trade");
  if (payload.otherRoles) add(payload.otherRoles, "Other / not listed", "other_trade");
  return trades;
}

async function listJobs(pool, includeHidden = false) {
  const result = await pool.query(
    `SELECT id, title, type, link, location, description, created_at AS "createdAt", is_visible AS "isVisible"
     FROM jobs ${includeHidden ? "" : "WHERE is_visible = TRUE"} ORDER BY created_at DESC, id DESC`
  );
  return includeHidden ? result.rows : result.rows.map(({ isVisible, ...job }) => job);
}

async function uploadBucket() {
  if (!process.env.RESUME_BUCKET) throw new Error("RESUME_BUCKET is not configured.");
  return process.env.RESUME_BUCKET;
}

async function analyzeResume(bucket, key) {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of object.Body) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const extension = key.toLowerCase().split(".").pop();
  let resumeText = "";
  if (extension === "pdf") {
    const parsed = await OfficeParser.parseOffice(buffer);
    resumeText = (await parsed.to("text", { includeImages: false, textConfig: { preserveLayout: false, renderNotes: false } })).value;
  } else {
    const document = await new WordExtractor().extract(buffer);
    resumeText = document.getBody();
  }
  return { resumeText, extraction: extractResumeContactDetails(resumeText) };
}

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = decodeURI(event.rawPath || event.path || "/").replace(/\/$/, "") || "/";
  const query = event.queryStringParameters || {};
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  if (origin && !allowedOrigins.has(origin)) return jsonResponse(403, { message: "This website is not allowed to use the API." }, origin);

  try {
    const pool = await getPool();
    const user = authenticatedUser(event, await loadSessionSecret());
    const requireAdmin = () => {
      if (!user) throw Object.assign(new Error("Please log in as an administrator to continue."), { statusCode: 401 });
    };

    if (path === "/health" && method === "GET") return jsonResponse(200, { ok: true, database: "postgresql" }, origin);
    if (path === "/jobs" && method === "GET") return jsonResponse(200, await listJobs(pool), origin);
    if (path === "/general-jobs" && method === "GET") {
      const result = await pool.query("SELECT id, title FROM general_jobs ORDER BY sort_order, LOWER(title)");
      return jsonResponse(200, result.rows, origin);
    }

    if (path === "/admin/session" && method === "GET") return jsonResponse(200, { authenticated: Boolean(user), username: user?.username || "" }, origin);
    if (path === "/admin/login" && method === "POST") {
      const body = parseBody(event);
      const username = clean(body.username, 150);
      const password = String(body.password ?? "");
      const result = await pool.query("SELECT userid, username, userpassword FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1", [username]);
      const account = result.rows[0];
      if (!account || password.length > 1024 || !verifyPassword(password, account.userpassword)) {
        throw Object.assign(new Error("The username or password is incorrect."), { statusCode: 401 });
      }
      return jsonResponse(200, { authenticated: true, username: account.username, token: signSession(account) }, origin);
    }
    if (path === "/admin/logout" && method === "POST") return jsonResponse(200, { authenticated: false }, origin);

    if (path === "/admin/jobs" && method === "GET") {
      requireAdmin();
      return jsonResponse(200, await listJobs(pool, true), origin);
    }
    const visibilityMatch = path.match(/^\/admin\/jobs\/(\d+)\/visibility$/);
    if (visibilityMatch && method === "PATCH") {
      requireAdmin();
      const body = parseBody(event);
      if (typeof body.isVisible !== "boolean") throw Object.assign(new Error("Choose whether this job should be visible."), { statusCode: 400 });
      const result = await pool.query("UPDATE jobs SET is_visible = $1 WHERE id = $2 RETURNING id, is_visible AS \"isVisible\"", [body.isVisible, visibilityMatch[1]]);
      if (!result.rowCount) throw Object.assign(new Error("Job listing not found."), { statusCode: 404 });
      return jsonResponse(200, result.rows[0], origin);
    }
    if (path === "/jobs" && method === "POST") {
      requireAdmin();
      const body = parseBody(event);
      const title = clean(body.title, 250), type = clean(body.type, 120), link = clean(body.link, 2000);
      const location = clean(body.location, 250), description = clean(body.description);
      let parsedLink;
      try { parsedLink = new URL(link); } catch { parsedLink = null; }
      if (!title || !type || !link || !parsedLink || !["http:", "https:"].includes(parsedLink.protocol)) {
        throw Object.assign(new Error("Enter a title, job type, and valid HTTP or HTTPS link."), { statusCode: 400 });
      }
      const result = await pool.query(
        "INSERT INTO jobs (title, type, link, location, description) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,type,link,location,description,created_at AS \"createdAt\"",
        [title, type, link, location, description]
      );
      return jsonResponse(201, result.rows[0], origin);
    }
    const jobDeleteMatch = path.match(/^\/jobs\/(\d+)$/);
    if (jobDeleteMatch && method === "DELETE") {
      requireAdmin();
      const result = await pool.query("DELETE FROM jobs WHERE id = $1", [jobDeleteMatch[1]]);
      if (!result.rowCount) throw Object.assign(new Error("Job not found."), { statusCode: 404 });
      return jsonResponse(200, { ok: true }, origin);
    }

    if (path === "/contacts/check-existing" && method === "POST") {
      const body = parseBody(event);
      const email = clean(body.email, 320).toLowerCase();
      const phone = normalizePhone(clean(body.phone || body.primaryPhone, 80));
      if (!email && phone.length < 7) return jsonResponse(200, { matches: [] }, origin);
      const result = await pool.query(
        `SELECT first_name AS "firstName", last_name AS "lastName", email, phone FROM contacts
         WHERE ($1 <> '' AND LOWER(email) = $1) OR ($2 <> '' AND phone_normalized = $2)
         ORDER BY "dateAdded" DESC, id DESC LIMIT 5`, [email, phone.length >= 7 ? phone : ""]
      );
      return jsonResponse(200, { matches: result.rows }, origin);
    }
    if (path === "/contacts" && method === "POST") {
      const payload = parseBody(event);
      const oldName = clean(payload.fullLegalName, 300);
      const nameParts = oldName.split(/\s+/).filter(Boolean);
      const firstName = clean(payload.firstName, 150) || nameParts[0] || "";
      const lastName = clean(payload.lastName, 150) || nameParts.slice(1).join(" ");
      const fullName = oldName || [firstName, lastName].filter(Boolean).join(" ");
      const email = clean(payload.email, 320).toLowerCase();
      const phone = clean(payload.phone || payload.primaryPhone, 80);
      if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw Object.assign(new Error("A candidate name and valid email address are required."), { statusCode: 400 });
      }
      const titles = payload.jobInterests == null || payload.jobInterests === "" ? []
        : Array.isArray(payload.jobInterests) ? payload.jobInterests : JSON.parse(String(payload.jobInterests));
      if (!Array.isArray(titles)) throw Object.assign(new Error("Please select valid job interests."), { statusCode: 400 });
      const normalizedTitles = [];
      for (const value of titles) {
        const title = clean(value, 250);
        const match = title && (await pool.query("SELECT title FROM general_jobs WHERE LOWER(title) = LOWER($1) LIMIT 1", [title])).rows[0];
        if (!match) throw Object.assign(new Error("One or more selected job interests are not valid."), { statusCode: 400 });
        if (!normalizedTitles.includes(match.title)) normalizedTitles.push(match.title);
      }
      payload.jobInterests = normalizedTitles;
      const resumeKey = clean(payload.resumeKey, 500) || null;
      const resumeFilename = clean(payload.resumeFilename, 250) || null;
      const resumeId = resumeKey ? (resumeKey.match(/^resumes\/([\da-f-]{36})\//i)?.[1] || clean(payload.resumeId, 80) || null) : null;
      if (resumeKey) await s3.send(new HeadObjectCommand({ Bucket: await uploadBucket(), Key: resumeKey }));
      let jobId = null;
      if (payload.jobId != null && String(payload.jobId).trim() !== "") {
        const idResult = await pool.query("SELECT id FROM jobs WHERE id = $1", [Number(payload.jobId)]);
        if (!idResult.rowCount) throw Object.assign(new Error("Please select a valid local job posting."), { statusCode: 400 });
        jobId = Number(payload.jobId);
      }
      if (resumeId) payload.resumeId = resumeId;
      else delete payload.resumeId;
      delete payload.generalJobId;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const insert = await client.query(
          `INSERT INTO contacts (first_name,last_name,full_name,email,phone,phone_normalized,application_type,job_id,resume_id,resume_key,resume_filename,payload_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id`,
          [firstName,lastName,fullName,email,phone,normalizePhone(phone),clean(payload.applicationType,80)||(resumeKey?"resume":"contact"),jobId,resumeId,resumeKey,resumeFilename,JSON.stringify(payload)]
        );
        const contactId = insert.rows[0].id;
        for (const [tradeName, category, selectionType, proficiency] of tradeSelections(payload)) {
          await client.query(
            "INSERT INTO candidate_trades (contact_id,trade_name,trade_category,selection_type,proficiency) VALUES ($1,$2,$3,$4,$5)",
            [contactId,tradeName,category,selectionType,proficiency]
          );
        }
        await client.query("COMMIT");
        return jsonResponse(201, { id: contactId, message: "Contact saved." }, origin);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    }

    if (path === "/resumes/presign" && method === "POST") {
      const body = parseBody(event);
      const size = Number(body.size);
      if (!Number.isFinite(size) || size < 1 || size > maxResumeBytes) throw Object.assign(new Error("Resume files must be 10 MB or smaller."), { statusCode: 400 });
      const filename = basename(String(body.filename || "resume")).replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^\.+/, "").slice(0, 150) || "resume";
      const contentType = clean(body.contentType, 150) || "application/octet-stream";
      const token = randomUUID();
      const objectKey = `resumes/${token}/${filename}`;
      const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: await uploadBucket(), Key: objectKey, ContentType: contentType }), { expiresIn: 900 });
      return jsonResponse(200, { uploadUrl, objectKey, resumeId: token }, origin);
    }
    if (path === "/resumes/analyze" && method === "POST") {
      const { resumeKey = "" } = parseBody(event);
      const key = String(resumeKey).trim();
      if (!/^resumes\/[\da-f-]{36}\/[\p{L}\p{N}._-]+$/iu.test(key)) throw Object.assign(new Error("The uploaded resume could not be found."), { statusCode: 400 });
      try {
        const { resumeText, extraction } = await analyzeResume(await uploadBucket(), key);
        return jsonResponse(200, {
          readable: Boolean(String(resumeText || "").trim()), fields: extraction.fields, sections: extraction.sections,
          message: String(resumeText || "").trim() ? "Review the suggestions below and correct anything that needs updating." : "No selectable text was found. You can enter the details manually."
        }, origin);
      } catch (error) {
        console.error("Resume analysis failed:", error.message);
        return jsonResponse(200, { readable: false, fields: {}, sections: { workHistory: [], certifications: [], education: [], skills: [] }, message: "We couldn’t read text from this file. You can still submit your resume and enter any details manually." }, origin);
      }
    }

    if (path === "/admin/outreach-recipients" && method === "GET") {
      requireAdmin();
      const jobTitle = clean(query.jobTitle, 250);
      const titleResult = await pool.query("SELECT title FROM general_jobs WHERE LOWER(title) = LOWER($1) LIMIT 1", [jobTitle]);
      if (!titleResult.rowCount) throw Object.assign(new Error("Choose a valid job type or role."), { statusCode: 400 });
      const from = dateFilter(query.from || ""), to = dateFilter(query.to || "");
      if (from === null || to === null || (from && to && from > to)) throw Object.assign(new Error("Choose a valid date range."), { statusCode: 400 });
      const result = await pool.query(
        `SELECT email, payload_json FROM contacts WHERE ($1::date IS NULL OR "dateAdded"::date >= $1::date)
         AND ($2::date IS NULL OR "dateAdded"::date <= $2::date) ORDER BY "dateAdded" DESC, id DESC`, [from || null, to || null]
      );
      const emails = new Set();
      for (const contact of result.rows) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "")) continue;
        const payload = contact.payload_json || {};
        const interests = [
          ...(Array.isArray(payload.jobInterests) ? payload.jobInterests : []),
          ...(Array.isArray(payload.desiredPositions) ? payload.desiredPositions : []), payload.primaryTrade,
          ...(Array.isArray(payload.candidateTrades) ? payload.candidateTrades.map((item) => typeof item === "string" ? item : item?.tradeName || item?.name) : [])
        ].map((value) => String(value || "").trim().toLocaleLowerCase());
        if (interests.includes(titleResult.rows[0].title.toLocaleLowerCase())) emails.add(contact.email.toLocaleLowerCase());
      }
      return jsonResponse(200, { jobTitle: titleResult.rows[0].title, count: emails.size, emails: [...emails] }, origin);
    }
    if (path === "/admin/contacts.csv" && method === "GET") {
      requireAdmin();
      const from = dateFilter(query.from || ""), to = dateFilter(query.to || "");
      if (from === null || to === null || (from && to && from > to)) throw Object.assign(new Error("Choose a valid date range."), { statusCode: 400 });
      const result = await pool.query(
        `SELECT first_name AS "firstName", last_name AS "lastName", full_name AS "fullName", email, phone,
         application_type AS "applicationType", "dateAdded", payload_json AS payload FROM contacts
         WHERE ($1::date IS NULL OR "dateAdded"::date >= $1::date) AND ($2::date IS NULL OR "dateAdded"::date <= $2::date)
         ORDER BY "dateAdded" DESC, id DESC`, [from || null, to || null]
      );
      const headers = ["First Name", "Last Name", "Full Name", "Email", "Phone", "Application Type", "Jobs Interested In", "Date Added", "Application Details"];
      const rows = result.rows.map((contact) => [contact.firstName, contact.lastName, contact.fullName, contact.email, contact.phone,
        contact.applicationType, Array.isArray(contact.payload.jobInterests) ? contact.payload.jobInterests.join("; ") : "",
        contact.dateAdded, formatApplicationDetails(contact.payload)].map(csvCell).join(","));
      const csv = [["Contact List", ...Array(headers.length - 1).fill("")].map(csvCell).join(","), headers.map(csvCell).join(","), ...rows].join("\r\n");
      const rangeName = from || to ? `-${from || "start"}-to-${to || "end"}` : "-all-dates";
      return {
        statusCode: 200,
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="prmg-applicants${rangeName}.csv"`, "cache-control": "no-store", "x-export-count": String(result.rows.length), ...corsHeaders(origin), "access-control-expose-headers": "Content-Disposition,X-Export-Count" },
        body: csv
      };
    }

    return jsonResponse(404, { message: "API route not found." }, origin);
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error("PRMG API error:", error);
    return jsonResponse(status, { message: status < 500 ? error.message : "The server could not complete the request." }, origin);
  }
}
