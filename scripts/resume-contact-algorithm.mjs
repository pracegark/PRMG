/**
 * Resume-to-contact algorithm, independent of the page UI.
 *
 * A format-specific reader (PDF/DOC/DOCX or OCR) supplies resume text to
 * extractResumeContactDetails(). The extracted values are suggestions only;
 * values explicitly provided by the candidate take precedence. Submission
 * requires an explicit confirmation flag and the selected job ID.
 */

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?1[\s().-]*)?(?:\(?\d{3}\)?[\s().-]*)\d{3}[\s.-]*\d{4}(?:\s*(?:x|ext\.?)[\s-]*\d{1,6})?/i;
const NAME_TOKEN_PATTERN = /^[A-Z][A-Z'.-]*$/i;
const NAME_EXCLUSIONS = new Set([
  "resume", "curriculum", "vitae", "profile", "summary", "objective", "experience",
  "professional", "contact", "information", "skills", "education", "references"
]);
const SECTION_RULES = [
  ["workHistory", /\b(?:work|employment|professional|career)\s+(?:experience|history|background)\b|\b(?:employment|work)\s+record\b|^experience$/],
  ["certifications", /\b(?:certifications?|licenses?|credentials?|safety training)\b|^training$/],
  ["education", /\b(?:education|academic background|university|college|schooling)\b/],
  ["skills", /\b(?:skills?|core competencies|areas of expertise|expertise|qualifications|strengths|proficiencies|technical abilities)\b/]
];
const OTHER_SECTION_HEADING = /^(?:professional )?(?:summary|objective|profile|references|projects|awards|honors|volunteer(?: experience)?|publications|additional information|interests|languages|associations|leadership|accomplishments|career highlights)$/i;
const EDUCATION_EVIDENCE = /\b(?:university|college|community college|institute of technology|high school|bachelor(?:'s)?|master(?:'s)?|associate(?:'s)? degree|doctoral|ph\.?d\.?|ged|diploma|graduat(?:ed|ion)|degree)\b/i;

function cleanLine(line) {
  return line
    .replace(/^\s*(?:[•*▪–—-]+\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyName(line) {
  const words = line.split(/[\s,]+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (words.some((word) => NAME_EXCLUSIONS.has(word.toLowerCase()))) return false;
  return words.every((word) => NAME_TOKEN_PATTERN.test(word));
}

function confidence(value, score) {
  return { value, score, needsReview: score < 0.9 };
}

/** Extract likely contact fields from already-extracted resume text. */
export function extractResumeContactDetails(resumeText) {
  const text = String(resumeText || "").replace(/\u0000/g, " ");
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const leadingLines = lines.slice(0, 12);

  const emailMatch = text.match(EMAIL_PATTERN);
  const phoneMatch = text.match(PHONE_PATTERN);
  const nameLine = leadingLines.find(isLikelyName) || "";
  const nameParts = nameLine.split(/[\s,]+/).filter(Boolean);

  const fields = {
    firstName: confidence(nameParts[0] || "", nameParts.length >= 2 ? 0.82 : 0),
    lastName: confidence(nameParts.length >= 2 ? nameParts[nameParts.length - 1] : "", nameParts.length >= 2 ? 0.78 : 0),
    email: confidence(emailMatch ? emailMatch[0] : "", emailMatch ? 0.98 : 0),
    phone: confidence(phoneMatch ? phoneMatch[0].trim() : "", phoneMatch ? 0.88 : 0)
  };

  const sections = { workHistory: [], certifications: [], education: [], skills: [] };
  let activeSections = [];
  for (const rawLine of lines) {
    const heading = rawLine.replace(/^\d+[.)]?\s*/, "").replace(/[:\s|–—-]+$/, "").trim();
    const normalizedHeading = heading.replace(/[&/]/g, " and ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const isHeadingLike = normalizedHeading.length <= 72 && normalizedHeading.split(" ").length <= 9;
    const matchedSections = isHeadingLike
      ? SECTION_RULES.filter(([, pattern]) => pattern.test(normalizedHeading)).map(([name]) => name)
      : [];
    if (matchedSections.length) {
      activeSections = matchedSections;
      continue;
    }
    if (isHeadingLike && OTHER_SECTION_HEADING.test(normalizedHeading)) {
      activeSections = [];
      continue;
    }
    for (const section of activeSections) {
      const maxLines = section === "skills" ? 25 : 60;
      const maxCharacters = section === "skills" ? 1800 : 5000;
      const currentCharacters = sections[section].join(" ").length;
      if (sections[section].length < maxLines && currentCharacters < maxCharacters) sections[section].push(rawLine);
    }
  }

  // Resume parsers sometimes flatten the Education heading into adjacent text.
  // Pick up explicit school/degree lines as a fallback, but never guess a school
  // from unrelated skills text.
  for (const line of lines) {
    if (sections.education.length >= 25) break;
    if (EDUCATION_EVIDENCE.test(line) && !sections.education.includes(line)) sections.education.push(line);
  }

  return {
    fields,
    sections,
    missingFields: Object.entries(fields)
      .filter(([, field]) => !field.value)
      .map(([fieldName]) => fieldName),
    reviewFields: Object.entries(fields)
      .filter(([, field]) => field.value && field.needsReview)
      .map(([fieldName]) => fieldName)
  };
}

/**
 * Validate an uploaded resume and pass it to a format reader (PDF/DOC/DOCX
 * parser or OCR service) before extracting contact fields. The reader is
 * injected so file decoding can live server-side without exposing resume data
 * to a third-party browser service.
 */
export async function analyzeResumeFile({ file, readResumeText }) {
  if (!file || typeof file.name !== "string") {
    throw new Error("A resume file is required.");
  }
  if (typeof readResumeText !== "function") {
    throw new Error("A private PDF/Word text reader must be configured.");
  }
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
    throw new Error("Please choose a PDF, DOC, or DOCX resume.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The resume must be 10 MB or smaller.");
  }

  const resumeText = await readResumeText(file);
  if (!String(resumeText || "").trim()) {
    throw new Error("No readable text was found. The resume may be scanned or image-only.");
  }

  return {
    resumeText,
    ...extractResumeContactDetails(resumeText)
  };
}

/** Merge candidate-entered values over parsed suggestions and report gaps. */
export function buildResumeContactSubmission({
  resumeText,
  candidateValues = {},
  jobId = "",
  resumeKey = "",
  resumeFilename = ""
}) {
  const extraction = extractResumeContactDetails(resumeText);
  const getValue = (name) => {
    const entered = String(candidateValues[name] || "").trim();
    return entered || extraction.fields[name].value;
  };

  const contact = {
    firstName: getValue("firstName"),
    lastName: getValue("lastName"),
    email: getValue("email"),
    phone: getValue("phone"),
    jobId: String(jobId || candidateValues.jobId || "").trim(),
    resumeKey: String(resumeKey || "").trim(),
    resumeFilename: String(resumeFilename || "").trim()
  };

  const requiredFields = ["firstName", "lastName", "email", "phone", "jobId", "resumeKey"];
  return {
    contact,
    extraction,
    missingFields: requiredFields.filter((fieldName) => !contact[fieldName])
  };
}

/** Submit a reviewed resume-based contact using the site's existing API. */
export async function submitResumeContact({
  apiBaseUrl,
  confirmedByCandidate,
  ...submissionOptions
}) {
  if (!confirmedByCandidate) {
    throw new Error("Candidate confirmation is required before submitting extracted resume details.");
  }

  const result = buildResumeContactSubmission(submissionOptions);
  if (result.missingFields.length) {
    throw new Error(`Missing required contact fields: ${result.missingFields.join(", ")}.`);
  }
  if (!apiBaseUrl) throw new Error("The contact API URL is not configured.");

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.contact)
  });
  const responseText = await response.text();
  let responseBody = {};
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = { message: responseText };
  }
  if (!response.ok) {
    throw new Error(responseBody.message || `Contact submission failed (${response.status}).`);
  }

  return { ...result, response: responseBody };
}
