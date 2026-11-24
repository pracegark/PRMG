import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { OfficeParser } from "officeparser";
import WordExtractor from "word-extractor";
import { extractResumeContactDetails } from "./scripts/resume-contact-algorithm.mjs";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const dataRoot = resolve(projectRoot, "data");
const resumeRoot = resolve(dataRoot, "resumes");
const maxJsonBytes = 2 * 1024 * 1024;
const maxResumeBytes = 10 * 1024 * 1024;
const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");
const uploadTokens = new Map();
const adminSessions = new Map();
const adminSessionLifetime = 8 * 60 * 60 * 1000;

mkdirSync(dataRoot, { recursive: true });
const database = new DatabaseSync(resolve(dataRoot, "prmg.sqlite"));
database.exec([
  "PRAGMA foreign_keys = ON;",
  "PRAGMA journal_mode = WAL;",
  "CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, type TEXT NOT NULL, link TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)));",
  "CREATE TABLE IF NOT EXISTS general_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL UNIQUE COLLATE NOCASE, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS users (userid INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, userpassword TEXT NOT NULL, testCredentials INTEGER NOT NULL DEFAULT 0 CHECK (testCredentials IN (0, 1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', full_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', phone_normalized TEXT NOT NULL DEFAULT '', application_type TEXT NOT NULL DEFAULT 'resume', job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL, resume_id TEXT, resume_key TEXT, resume_filename TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, dateAdded TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS candidate_trades (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, trade_name TEXT NOT NULL, trade_category TEXT NOT NULL DEFAULT '', selection_type TEXT NOT NULL DEFAULT 'desired_position', proficiency TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);",
  "CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);",
  "CREATE INDEX IF NOT EXISTS idx_candidate_trades_contact_id ON candidate_trades(contact_id);"
].join("\n"));

const generalJobTitles = ["3G-4G Welder", "6GR Fluxcore Welder", "Account Manager", "Asbestos Abatement Supervisor", "Asbestos Abatement Worker", "Asphalt Distributor Truck Driver (Tack Coat Operator)", "Asphalt Paving Machine Operator / Screed Operator", "Asphalt/Concrete Plant Operator", "Barge - Crawler Crane Operator", "Barge - Deck Crane Operator", "Barge - Domestic/Galley Staff", "Barge - Foreman", "Barge - Laborer/Rigger", "Barge - Leaderman", "Barge - Oiler", "Barge - Superintendent", "Barge Supervisor (BS)", "Blaster/Painter", "Boilermaker", "Carpenter", "Carpenter Helper", "Casing Crew", "Casing Crew Supervisor", "CDL Class A Driver", "CDL Class B Driver", "Clerk", "CNA", "Combination Welder", "Communications Technician", "Compliance Technician", "Compliance/Regulatory Auditors/HSE", "Concrete Finisher", "Construction Supervisor", "Consultant - Diving", "Consultant - Construction", "Consultant - Drilling (Company Man)", "Consultant - Platform/Pipeline Decom", "Consultant - Well Plug & Abandonment", "Consultant - Wellwork", "Control Systems Technician - PLC, Programmer", "Corrosion Technician", "Craft Recruiter", "Crane Inspector/Mechanic", "Crane Inspector/Mechanic Helper", "Crane Operator", "Crane Rigger", "Designer - Piping", "Designer - Structural", "Diesel Mechanic", "Domestic Services - Catering, Janitorial", "Dump Truck Driver", "Electrician - ArcFlash, Med/High Voltage", "Electrician - Construction", "Electrician - Helper", "Electrician - Platform or Facility", "Electrician - Portable Generators, Light Plants", "Explosive Technician", "Fire Fighting Equipment Technician", "Fire Watch", "Forklift Operator", "Form Carpenter", "FRAC - Supervisor", "FRAC - Technician", "Galley Hand / Cook", "Gas Sampler Technician", "General Laborer", "Guardrail / Barrier Installer", "H2S Technician", "Hazmat Technician", "Heavy Equipment Operator", "HVAC Services Technician", "Hydraulics Technician", "Hydroblaster", "Hydrostatic Test Technician", "Industrial Carpenter ( Cooling Towers)", "Inspector - Blasting (Sand or Water)", "Inspector - Paint", "Instrument Technician - Electrical", "Insulator", "Ironworker", "Ironworker Helper", "Lead Abatement Worker / Supervisor", "Mechanic", "Mechanic - Helper", "Milling Machine Operator", "Millwright", "NDT - Non-Destructive Testing / X-Ray Technicians", "NORM Worker", "Offshore Installation Manager (OIM)", "Overhead Hoist Technician", "Paint Crew", "Painter", "Paramedic or Medic", "Pavement Marking / Striping Technician", "Pile Driver / Pile Driving Operator", "Pipe Fitter", "Pipe Welder (TIG/Fluxcore)", "Pipefitter Helper", "Pipelayer (Storm, Sanitary, Water)", "Plumber", "Potable Water Technician", "Produced Water - Technician (Wemco/Monosep)", "Production - Process Engineer/Specialist", "Production Operator - A Level", "Production Operator - B Level", "Production Operator - C Level", "Production Operator - D Level", "Production Operator - Foreman", "Production Operator - Lead", "Project Manager", "Pump Operator", "Pump Technician - Repair/Maint. (Electrical)", "Pump Technician - Repair/Maint. (Mechanical)", "QA/QC Inspector", "Rigger/Roustabout", "Rigging Supervisor / Lift Director", "RN", "Rodbuster", "Roller Operator", "Rope Access Technician", "Safety Representative", "Sandblaster", "Scaffolding - Crew", "Scaffolding - Supervisor (Competent Person)", "Scaffolding Inspector", "Shipfitter", "Soil Stabilization / Reclaimer Operator", "Structural Fiiter", "Survival Craft Technician", "Tank & Vessel Cleaning/Repair Crew", "Tank & Vessel Cleaning/Repair Supervisor", "Traffic Control Supervisor / Flagger", "Truck Driver", "Vacuum Truck Driver / Operator", "Valve Technician", "Valve Technician Helper", "Welder - Supervisor", "Welder Helper", "OTHER/PLEASE SPECIFY:"];
const insertGeneralJob = database.prepare("INSERT OR IGNORE INTO general_jobs (title, sort_order) VALUES (?, ?)");
generalJobTitles.forEach((title, index) => insertGeneralJob.run(title, index + 1));

const contactColumns = database.prepare("PRAGMA table_info(contacts)").all();
if (!contactColumns.some((column) => column.name === "dateAdded")) {
  database.exec("ALTER TABLE contacts ADD COLUMN dateAdded TEXT");
  database.exec("UPDATE contacts SET dateAdded = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE dateAdded IS NULL OR dateAdded = ''");
}
if (contactColumns.some((column) => column.name === "general_job_id")) {
  database.exec("ALTER TABLE contacts DROP COLUMN general_job_id");
}
if (!contactColumns.some((column) => column.name === "phone_normalized")) {
  database.exec("ALTER TABLE contacts ADD COLUMN phone_normalized TEXT NOT NULL DEFAULT ''");
}
if (!contactColumns.some((column) => column.name === "resume_id")) {
  database.exec("ALTER TABLE contacts ADD COLUMN resume_id TEXT");
}
const contactsNeedingResumeId = database.prepare("SELECT id, resume_key FROM contacts WHERE resume_id IS NULL AND resume_key IS NOT NULL").all();
const updateResumeId = database.prepare("UPDATE contacts SET resume_id = ? WHERE id = ?");
contactsNeedingResumeId.forEach((contact) => {
  const resumeId = contact.resume_key.match(/^resumes\/([\da-f-]{36})\//i)?.[1];
  if (resumeId) updateResumeId.run(resumeId, contact.id);
});
const contactsNeedingPhoneNormalization = database.prepare("SELECT id, phone FROM contacts WHERE phone_normalized = '' AND phone <> ''").all();
const updateNormalizedPhone = database.prepare("UPDATE contacts SET phone_normalized = ? WHERE id = ?");
contactsNeedingPhoneNormalization.forEach((contact) => updateNormalizedPhone.run(normalizePhone(contact.phone), contact.id));
database.exec("CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON contacts(phone_normalized)");
const jobColumns = database.prepare("PRAGMA table_info(jobs)").all();
if (!jobColumns.some((column) => column.name === "is_visible")) {
  database.exec("ALTER TABLE jobs ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1))");
}

const sendJson = (response, statusCode, data) => {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
};

async function readBuffer(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const body = await readBuffer(request, maxJsonBytes);
  try {
    const value = JSON.parse(body.toString("utf8") || "{}");
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error("Request body must be a valid JSON object."), { statusCode: 400 });
  }
}

const clean = (value, limit = 20000) => String(value ?? "").trim().slice(0, limit);

function sessionTokenFromRequest(request) {
  const cookieHeader = request.headers.cookie || "";
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("prmg_admin_session="));
  return entry ? entry.slice("prmg_admin_session=".length) : "";
}

function isAdminRequest(request) {
  const token = sessionTokenFromRequest(request);
  const session = adminSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) adminSessions.delete(token);
    return false;
  }
  session.expiresAt = Date.now() + adminSessionLifetime;
  return true;
}

function setSessionCookie(response, token, maxAge) {
  response.setHeader("Set-Cookie", `prmg_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
}

function verifyPassword(password, storedValue) {
  const [salt, expectedHex] = String(storedValue).split(":");
  if (!salt || !expectedHex || !/^[a-f\d]{128}$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function listJobs() {
  return database.prepare("SELECT id, title, type, link, location, description, created_at AS createdAt FROM jobs WHERE is_visible = 1 ORDER BY created_at DESC, id DESC").all();
}

function listGeneralJobs() {
  return database.prepare("SELECT id, title FROM general_jobs ORDER BY sort_order, title COLLATE NOCASE").all();
}

function listAdminJobs() {
  return database.prepare("SELECT id, title, type, link, location, description, created_at AS createdAt, is_visible AS isVisible FROM jobs ORDER BY created_at DESC, id DESC").all();
}

function listContacts() {
  return database.prepare("SELECT id, first_name AS firstName, last_name AS lastName, full_name AS fullName, email, phone, application_type AS applicationType, job_id AS jobId, resume_id AS resumeId, resume_key AS resumeKey, resume_filename AS resumeFilename, payload_json AS payload, created_at AS createdAt, dateAdded AS dateAdded FROM contacts ORDER BY dateAdded DESC, id DESC LIMIT 500")
    .all().map((contact) => ({ ...contact, payload: JSON.parse(contact.payload) }));
}

const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const applicationFieldLabels = {
  primaryTrade: "Primary trade / role",
  desiredPayRate: "Desired pay rate",
  availableStart: "Available start date",
  travelRelocation: "Travel / relocation",
  shiftAvailability: "Shift availability",
  driversLicense: "Driver’s license",
  ownTransport: "Own transportation",
  twicStatus: "TWIC status",
  twicExpiration: "TWIC expiration",
  workHistory: "Work experience",
  certifications: "Certifications and licenses",
  skillProficiency: "Skills and proficiency",
  desiredPositions: "Desired positions",
  candidateTrades: "Trades and roles",
  otherRoles: "Other skills / roles",
  highestEducation: "Education",
  applicantSignature: "Applicant signature",
  signatureDate: "Signature date",
  acknowledgement: "Acknowledgement",
  resumeWorkHistory: "Resume work experience",
  resumeCertifications: "Resume certifications",
  resumeEducation: "Resume education",
  resumeSkills: "Resume skills",
  skills: "Skills"
};
const omittedApplicationFields = new Set([
  "firstName", "lastName", "fullName", "email", "phone", "primaryPhone", "alternatePhone",
  "applicationType", "jobId", "jobInterests", "resumeKey", "resumeId", "resumeFilename", "resume"
]);
const formatApplicationLabel = (key) => applicationFieldLabels[key] || key
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/^./, (letter) => letter.toUpperCase());

function formatApplicationDetails(payload) {
  const lines = [];
  const formatNestedItem = (item) => {
    if (typeof item !== "object" || item === null) return String(item ?? "").trim();
    return Object.entries(item)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .map(([key, value]) => `${formatApplicationLabel(key)}: ${Array.isArray(value) ? value.join(", ") : String(value).trim()}`)
      .join("; ");
  };

  for (const [key, value] of Object.entries(payload || {})) {
    if (omittedApplicationFields.has(key) || value === null || value === undefined || value === "") continue;
    const label = formatApplicationLabel(key);
    let formatted;
    if (typeof value === "boolean") formatted = value ? "Yes" : "No";
    else if (Array.isArray(value)) {
      const items = value.map(formatNestedItem).filter(Boolean);
      if (!items.length) continue;
      formatted = items.length === 1 ? items[0] : items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    } else if (typeof value === "object") {
      formatted = formatNestedItem(value);
      if (!formatted) continue;
    } else {
      formatted = String(value).trim().replace(/\r?\n/g, " ");
    }
    if (formatted) lines.push(`${label}: ${formatted}`);
  }
  return lines.join("\n");
}

function parseDateFilter(value) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function saveCandidateTrades(contactId, payload) {
  const insert = database.prepare("INSERT INTO candidate_trades (contact_id, trade_name, trade_category, selection_type, proficiency) VALUES (?, ?, ?, ?, ?)");
  const seen = new Set();
  const add = (name, category, selectionType, proficiency) => {
    const tradeName = clean(name, 250);
    if (!tradeName) return;
    const key = selectionType + "\u0000" + tradeName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    insert.run(contactId, tradeName, clean(category, 180), selectionType, clean(proficiency, 80));
  };
  (Array.isArray(payload.candidateTrades) ? payload.candidateTrades : []).forEach((item) => {
    if (typeof item === "string") add(item, "", "candidate_trade", "");
    else if (item && typeof item === "object") add(item.tradeName || item.name, item.category, item.selectionType || "candidate_trade", item.proficiency);
  });
  (Array.isArray(payload.desiredPositions) ? payload.desiredPositions : []).forEach((name) => add(name, "", "desired_position", ""));
  (Array.isArray(payload.skillProficiency) ? payload.skillProficiency : []).forEach((name) => add(name, "", "skill_proficiency", ""));
  if (payload.primaryTrade) add(payload.primaryTrade, "", "primary_trade", "");
  if (payload.otherRoles) add(payload.otherRoles, "Other / not listed", "other_trade", "");
}

export async function handleLocalApi(request, response, url) {
  const apiPath = url.pathname.slice("/api".length) || "/";
  const method = request.method;

  if (apiPath === "/health" && method === "GET") {
    sendJson(response, 200, { ok: true, database: "sqlite", tables: ["contacts", "jobs", "general_jobs", "candidate_trades", "users"] });
    return true;
  }

  if (apiPath === "/jobs" && method === "GET") {
    sendJson(response, 200, listJobs());
    return true;
  }

  if (apiPath === "/general-jobs" && method === "GET") {
    sendJson(response, 200, listGeneralJobs());
    return true;
  }

  if (apiPath === "/admin/jobs" && method === "GET") {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { message: "Please log in as an administrator to view job management." });
      return true;
    }
    sendJson(response, 200, listAdminJobs());
    return true;
  }

  const adminJobVisibilityMatch = apiPath.match(/^\/admin\/jobs\/(\d+)\/visibility$/);
  if (adminJobVisibilityMatch && method === "PATCH") {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { message: "Please log in as an administrator to update job visibility." });
      return true;
    }
    const body = await readJson(request);
    const id = Number(adminJobVisibilityMatch[1]);
    if (!Number.isSafeInteger(id) || typeof body.isVisible !== "boolean") {
      sendJson(response, 400, { message: "Choose whether this job should be visible." });
      return true;
    }
    const result = database.prepare("UPDATE jobs SET is_visible = ? WHERE id = ?").run(body.isVisible ? 1 : 0, id);
    if (!result.changes) {
      sendJson(response, 404, { message: "Job listing not found." });
      return true;
    }
    sendJson(response, 200, { id, isVisible: body.isVisible });
    return true;
  }

  if (apiPath === "/jobs" && method === "POST") {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { message: "Please log in as an administrator to add a job." });
      return true;
    }
    const body = await readJson(request);
    const title = clean(body.title, 250);
    const type = clean(body.type, 120);
    const link = clean(body.link, 2000);
    const location = clean(body.location, 250);
    const description = clean(body.description);
    if (!title || !type || !link) {
      sendJson(response, 400, { message: "Job title, type, and link are required." });
      return true;
    }
    let parsedLink;
    try { parsedLink = new URL(link); } catch { parsedLink = null; }
    if (!parsedLink || !["http:", "https:"].includes(parsedLink.protocol)) {
      sendJson(response, 400, { message: "Job link must be a valid HTTP or HTTPS URL." });
      return true;
    }
    const result = database.prepare("INSERT INTO jobs (title, type, link, location, description) VALUES (?, ?, ?, ?, ?)").run(title, type, link, location, description);
    const job = database.prepare("SELECT id, title, type, link, location, description, created_at AS createdAt FROM jobs WHERE id = ?").get(Number(result.lastInsertRowid));
    sendJson(response, 201, job);
    return true;
  }

  const jobMatch = apiPath.match(/^\/jobs\/(\d+)$/);
  if (jobMatch && method === "DELETE") {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { message: "Please log in as an administrator to remove a job." });
      return true;
    }
    const result = database.prepare("DELETE FROM jobs WHERE id = ?").run(Number(jobMatch[1]));
    if (!result.changes) sendJson(response, 404, { message: "Job not found." });
    else sendJson(response, 200, { ok: true });
    return true;
  }

  if (apiPath === "/admin/session" && method === "GET") {
    sendJson(response, 200, { authenticated: isAdminRequest(request) });
    return true;
  }

  if (apiPath === "/admin/login" && method === "POST") {
    const body = await readJson(request);
    const username = clean(body.username, 150);
    const password = String(body.password ?? "");
    const user = username ? database.prepare("SELECT userid, username, userpassword FROM users WHERE username = ? COLLATE NOCASE").get(username) : null;
    if (!user || password.length > 1024 || !verifyPassword(password, user.userpassword)) {
      sendJson(response, 401, { message: "The username or password is incorrect." });
      return true;
    }
    const token = randomUUID();
    adminSessions.set(token, { userId: user.userid, expiresAt: Date.now() + adminSessionLifetime });
    setSessionCookie(response, token, Math.floor(adminSessionLifetime / 1000));
    sendJson(response, 200, { authenticated: true, username: user.username });
    return true;
  }

  if (apiPath === "/admin/logout" && method === "POST") {
    const token = sessionTokenFromRequest(request);
    if (token) adminSessions.delete(token);
    setSessionCookie(response, "", 0);
    sendJson(response, 200, { authenticated: false });
    return true;
  }

  if (apiPath === "/admin/outreach-recipients" && method === "GET") {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { message: "Please log in as an administrator to prepare an applicant email." });
      return true;
    }
    const requestedTitle = clean(url.searchParams.get("jobTitle"), 250);
    const job = requestedTitle && database.prepare("SELECT title FROM general_jobs WHERE title = ? COLLATE NOCASE").get(requestedTitle);
    if (!job) {
      sendJson(response, 400, { message: "Choose a valid job type or role." });
      return true;
    }
    const fromDate = parseDateFilter(url.searchParams.get("from") || "");
    const toDate = parseDateFilter(url.searchParams.get("to") || "");
    if (fromDate === null || toDate === null || (fromDate && toDate && fromDate > toDate)) {
      sendJson(response, 400, { message: "Choose a valid date range. The start date must be on or before the end date." });
      return true;
    }
    const conditions = [];
    const params = [];
    if (fromDate) { conditions.push("date(dateAdded) >= date(?)"); params.push(fromDate); }
    if (toDate) { conditions.push("date(dateAdded) <= date(?)"); params.push(toDate); }
    const contacts = database.prepare("SELECT email, payload_json AS payload FROM contacts" +
      (conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "") + " ORDER BY dateAdded DESC, id DESC").all(...params);
    const wantedTitle = String(job.title).toLocaleLowerCase();
    const matchingEmails = new Set();
    for (const contact of contacts) {
      const email = String(contact.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      let payload = {};
      try { payload = JSON.parse(contact.payload); } catch { continue; }
      const interests = [
        ...(Array.isArray(payload.jobInterests) ? payload.jobInterests : []),
        ...(Array.isArray(payload.desiredPositions) ? payload.desiredPositions : []),
        payload.primaryTrade,
        ...(Array.isArray(payload.candidateTrades) ? payload.candidateTrades.map((item) => typeof item === "string" ? item : item?.tradeName || item?.name) : [])
      ].map((value) => String(value || "").trim().toLocaleLowerCase());
      if (interests.includes(wantedTitle)) matchingEmails.add(email.toLocaleLowerCase());
    }
    sendJson(response, 200, { jobTitle: job.title, count: matchingEmails.size, emails: [...matchingEmails] });
    return true;
  }

  if (apiPath === "/admin/contacts.csv" && method === "GET") {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { message: "Please log in as an administrator to export applicants." });
      return true;
    }
    const fromDate = parseDateFilter(url.searchParams.get("from") || "");
    const toDate = parseDateFilter(url.searchParams.get("to") || "");
    if (fromDate === null || toDate === null || (fromDate && toDate && fromDate > toDate)) {
      sendJson(response, 400, { message: "Choose a valid date range. The start date must be on or before the end date." });
      return true;
    }
    const conditions = [];
    const params = [];
    if (fromDate) { conditions.push("date(dateAdded) >= date(?)"); params.push(fromDate); }
    if (toDate) { conditions.push("date(dateAdded) <= date(?)"); params.push(toDate); }
    const query = "SELECT first_name AS firstName, last_name AS lastName, full_name AS fullName, email, phone, application_type AS applicationType, dateAdded, payload_json AS payload FROM contacts" +
      (conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "") + " ORDER BY dateAdded DESC, id DESC";
    const contacts = database.prepare(query).all(...params);
    const headers = ["First Name", "Last Name", "Full Name", "Email", "Phone", "Application Type", "Jobs Interested In", "Date Added", "Application Details"];
    const rows = contacts.map((contact) => {
      let payload = {};
      try { payload = JSON.parse(contact.payload); } catch { /* preserve malformed legacy payload below */ }
      const jobInterests = Array.isArray(payload.jobInterests)
        ? payload.jobInterests.map((title) => String(title || "").trim()).filter(Boolean).join("; ")
        : "";
      return [
        contact.firstName, contact.lastName, contact.fullName, contact.email, contact.phone,
        contact.applicationType, jobInterests, contact.dateAdded, formatApplicationDetails(payload)
      ].map(csvCell).join(",");
    });
    const titleRow = ["Contact List", ...Array(headers.length - 1).fill("")].map(csvCell).join(",");
    const csv = [titleRow, headers.map(csvCell).join(","), ...rows].join("\r\n");
    const rangeName = fromDate || toDate ? `-${fromDate || "start"}-to-${toDate || "end"}` : "-all-dates";
    const filename = `prmg-applicants${rangeName}.csv`;
    response.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": Buffer.byteLength(csv),
      "Cache-Control": "no-store",
      "X-Export-Count": String(contacts.length)
    });
    response.end(csv);
    return true;
  }

  if (apiPath === "/contacts" && method === "GET") {
    sendJson(response, 200, listContacts());
    return true;
  }

  if (apiPath === "/contacts/check-existing" && method === "POST") {
    const body = await readJson(request);
    const email = clean(body.email, 320).toLowerCase();
    const phone = normalizePhone(clean(body.phone || body.primaryPhone, 80));
    const conditions = [];
    const params = [];
    if (email) { conditions.push("lower(email) = ?"); params.push(email); }
    if (phone.length >= 7) { conditions.push("phone_normalized = ?"); params.push(phone); }
    if (!conditions.length) {
      sendJson(response, 200, { matches: [] });
      return true;
    }
    const matches = database.prepare(`SELECT first_name AS firstName, last_name AS lastName, email, phone FROM contacts WHERE ${conditions.join(" OR ")} ORDER BY dateAdded DESC, id DESC LIMIT 5`).all(...params);
    sendJson(response, 200, { matches });
    return true;
  }

  if (apiPath === "/contacts" && method === "POST") {
    const payload = await readJson(request);
    const fullLegalName = clean(payload.fullLegalName, 300);
    const legacyNameParts = fullLegalName.split(/\s+/).filter(Boolean);
    const firstName = clean(payload.firstName, 150) || legacyNameParts[0] || "";
    const lastName = clean(payload.lastName, 150) || legacyNameParts.slice(1).join(" ");
    const fullName = fullLegalName || [firstName, lastName].filter(Boolean).join(" ");
    const email = clean(payload.email, 320).toLowerCase();
    const phone = clean(payload.phone || payload.primaryPhone, 80);
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(response, 400, { message: "A candidate name and valid email address are required." });
      return true;
    }

    const resumeKey = clean(payload.resumeKey, 500) || null;
    const resumeFilename = clean(payload.resumeFilename, 250) || null;
    const keyResumeId = resumeKey?.match(/^resumes\/([\da-f-]{36})\//i)?.[1] || "";
    const resumeId = resumeKey ? (keyResumeId || clean(payload.resumeId, 80) || null) : null;
    if (resumeKey) {
      const resumePath = resolve(dataRoot, resumeKey);
      if (!resumePath.startsWith(resumeRoot + sep) || !existsSync(resumePath)) {
        sendJson(response, 400, { message: "The uploaded resume could not be found in the local resume folder." });
        return true;
      }
    }

    let jobId = null;
    if (payload.jobId !== undefined && payload.jobId !== null && String(payload.jobId).trim() !== "") {
      jobId = Number(payload.jobId);
      if (!Number.isSafeInteger(jobId) || !database.prepare("SELECT id FROM jobs WHERE id = ?").get(jobId)) {
        sendJson(response, 400, { message: "Please select a valid local job posting." });
        return true;
      }
    }

    let selectedJobTitles = [];
    if (payload.jobInterests !== undefined && payload.jobInterests !== null && String(payload.jobInterests).trim() !== "") {
      try {
        selectedJobTitles = Array.isArray(payload.jobInterests) ? payload.jobInterests : JSON.parse(String(payload.jobInterests));
      } catch {
        sendJson(response, 400, { message: "Please select valid job interests." });
        return true;
      }
      if (!Array.isArray(selectedJobTitles)) {
        sendJson(response, 400, { message: "Please select valid job interests." });
        return true;
      }
      const findGeneralJob = database.prepare("SELECT title FROM general_jobs WHERE title = ? COLLATE NOCASE");
      const normalizedTitles = [];
      for (const value of selectedJobTitles) {
        const title = clean(value, 250);
        const match = title && findGeneralJob.get(title);
        if (!match) {
          sendJson(response, 400, { message: "One or more selected job interests are not valid." });
          return true;
        }
        if (!normalizedTitles.includes(match.title)) normalizedTitles.push(match.title);
      }
      selectedJobTitles = normalizedTitles;
    }
    payload.jobInterests = selectedJobTitles;
    if (resumeId) payload.resumeId = resumeId;
    else delete payload.resumeId;
    delete payload.generalJobId;

    database.exec("BEGIN IMMEDIATE");
    try {
      const result = database.prepare("INSERT INTO contacts (first_name, last_name, full_name, email, phone, phone_normalized, application_type, job_id, resume_id, resume_key, resume_filename, payload_json, dateAdded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)").run(
        firstName,
        lastName,
        fullName,
        email,
        phone,
        normalizePhone(phone),
        clean(payload.applicationType, 80) || (resumeKey ? "resume" : "contact"),
        jobId,
        resumeId,
        resumeKey,
        resumeFilename,
        JSON.stringify(payload)
      );
      const contactId = Number(result.lastInsertRowid);
      saveCandidateTrades(contactId, payload);
      database.exec("COMMIT");
      sendJson(response, 201, { id: contactId, message: "Contact saved locally." });
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return true;
  }

  if (apiPath === "/resumes/presign" && method === "POST") {
    const body = await readJson(request);
    const filename = basename(String(body.filename || "resume")).replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^\.+/, "").slice(0, 150) || "resume";
    const size = Number(body.size);
    if (!Number.isFinite(size) || size < 1 || size > maxResumeBytes) {
      sendJson(response, 400, { message: "Resume files must be 10 MB or smaller." });
      return true;
    }
    const token = randomUUID();
    const objectKey = "resumes/" + token + "/" + filename;
    uploadTokens.set(token, { objectKey, expiresAt: Date.now() + 15 * 60 * 1000 });
    sendJson(response, 200, { uploadUrl: "/api/resumes/upload/" + token, objectKey, resumeId: token });
    return true;
  }

  const uploadMatch = apiPath.match(/^\/resumes\/upload\/([\da-f-]{36})$/i);
  if (uploadMatch && method === "PUT") {
    const token = uploadMatch[1];
    const upload = uploadTokens.get(token);
    if (!upload || upload.expiresAt < Date.now()) {
      uploadTokens.delete(token);
      sendJson(response, 404, { message: "This local resume upload link has expired. Please try again." });
      return true;
    }
    const file = await readBuffer(request, maxResumeBytes);
    if (!file.length) {
      sendJson(response, 400, { message: "The resume upload was empty." });
      return true;
    }
    const resumePath = resolve(dataRoot, upload.objectKey);
    mkdirSync(dirname(resumePath), { recursive: true });
    writeFileSync(resumePath, file, { flag: "wx" });
    uploadTokens.delete(token);
    sendJson(response, 201, { objectKey: upload.objectKey, size: file.length });
    return true;
  }

  if (apiPath === "/resumes/analyze" && method === "POST") {
    const body = await readJson(request);
    const resumeKey = String(body.resumeKey || "").trim();
    if (!/^resumes\/[\da-f-]{36}\/[\p{L}\p{N}._-]+$/iu.test(resumeKey)) {
      sendJson(response, 400, { message: "The uploaded resume could not be found." });
      return true;
    }
    const resumePath = resolve(dataRoot, resumeKey);
    if (!resumePath.startsWith(resumeRoot + sep) || !existsSync(resumePath)) {
      sendJson(response, 404, { message: "The uploaded resume could not be found in the local resume folder." });
      return true;
    }
    try {
      const extension = resumePath.toLowerCase().split(".").pop();
      const buffer = readFileSync(resumePath);
      let resumeText = "";
      if (extension === "pdf") {
        const ast = await OfficeParser.parseOffice(buffer);
        resumeText = (await ast.to("text", { includeImages: false, textConfig: { preserveLayout: false, renderNotes: false } })).value;
      } else {
        const document = await new WordExtractor().extract(buffer);
        resumeText = document.getBody();
      }
      const extraction = extractResumeContactDetails(resumeText);
      sendJson(response, 200, {
        readable: Boolean(String(resumeText || "").trim()),
        fields: extraction.fields,
        sections: extraction.sections,
        message: String(resumeText || "").trim()
          ? "Review the suggestions below and correct anything that needs updating."
          : "No selectable text was found. You can enter the details manually."
      });
    } catch (error) {
      console.error("Resume analysis failed:", error.message);
      sendJson(response, 200, {
        readable: false,
        fields: {},
        sections: { workHistory: [], certifications: [], education: [], skills: [] },
        message: "We couldn’t read text from this file. You can still submit your resume and enter any details manually."
      });
    }
    return true;
  }

  sendJson(response, 404, { message: "Local API route not found." });
  return true;
}
