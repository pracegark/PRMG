/* Use SQLite locally and the branch-specific API URL injected during deployment. */
const isLocalSite = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
window.SITE_API_BASE_URL = isLocalSite
  ? `${window.location.origin}/api`
  : (window.PRMG_API_BASE_URL || "https://kqf48x7cwc.execute-api.us-east-2.amazonaws.com");

(() => {
  const apiBase = window.SITE_API_BASE_URL;
  const configured = apiBase && !apiBase.includes("PASTE_API_GATEWAY");

  function setMessage(element, text, isError = false) {
    if (!element) return;
    element.textContent = text;
    element.setAttribute("role", isError ? "alert" : "status");
    element.classList.toggle("site-form-status-error", isError);
  }

  async function request(path, options = {}) {
    if (!configured) throw new Error("The API URL has not been configured yet.");
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  }

  function confirmDuplicateContact(matches) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "duplicate-contact-dialog";
      dialog.setAttribute("aria-labelledby", "duplicate-contact-title");
      const content = document.createElement("div");
      content.className = "duplicate-contact-dialog-content";
      const heading = document.createElement("h2");
      heading.id = "duplicate-contact-title";
      heading.textContent = "We may already have your information";
      const explanation = document.createElement("p");
      explanation.textContent = "We found an existing contact with the email or phone number you entered. If this is you, you don’t need to submit again.";
      const matchList = document.createElement("div");
      matches.forEach((match) => {
        const card = document.createElement("section");
        card.className = "duplicate-contact-match";
        const name = [match.firstName, match.lastName].filter(Boolean).join(" ");
        const greeting = document.createElement("h3");
        greeting.textContent = name ? `Hi ${name} — is this you?` : "Hi, is this you?";
        const details = document.createElement("dl");
        [["First name", match.firstName], ["Last name", match.lastName], ["Email", match.email], ["Phone", match.phone]].forEach(([label, value]) => {
          const term = document.createElement("dt");
          term.textContent = label;
          const description = document.createElement("dd");
          description.textContent = value || "—";
          details.append(term, description);
        });
        card.append(greeting, details);
        matchList.appendChild(card);
      });
      const actions = document.createElement("div");
      actions.className = "duplicate-contact-dialog-actions";
      const alreadyKnown = document.createElement("button");
      alreadyKnown.type = "button";
      alreadyKnown.textContent = "That’s me — don’t submit";
      alreadyKnown.addEventListener("click", () => finish(false));
      const continueButton = document.createElement("button");
      continueButton.type = "button";
      continueButton.className = "duplicate-contact-continue";
      continueButton.textContent = "That isn’t me — continue";
      continueButton.addEventListener("click", () => finish(true));
      actions.append(alreadyKnown, continueButton);
      content.append(heading, explanation, matchList, actions);
      dialog.appendChild(content);
      document.body.appendChild(dialog);

      let settled = false;
      const finish = (shouldContinue) => {
        if (settled) return;
        settled = true;
        if (dialog.open) dialog.close();
        dialog.remove();
        resolve(shouldContinue);
      };
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(false);
      });
      dialog.showModal();
      alreadyKnown.focus();
    });
  }

  async function checkForExistingContact(email, phone) {
    const result = await request("/contacts/check-existing", {
      method: "POST",
      body: JSON.stringify({ email, phone })
    });
    return !result.matches?.length || await confirmDuplicateContact(result.matches);
  }

  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    const status = document.createElement("p");
    status.className = "site-form-status";
    status.setAttribute("aria-live", "polite");
    contactForm.appendChild(status);
    const jobSelect = document.getElementById("job-interest");
    const jobStatus = document.getElementById("job-interest-status");
    const jobSelectToggle = document.getElementById("job-interest-toggle");
    const jobSelectValue = document.getElementById("job-interest-value");
    const jobSelectMenu = document.getElementById("job-interest-menu");
    const jobSelectOptions = document.getElementById("job-interest-options");
    const jobSelectSearch = document.getElementById("job-interest-search");
    const jobSelectSelected = document.getElementById("job-interest-selected");
    const selectedJobTitles = new Set();
    const resumeReview = document.getElementById("resume-review");
    const resumeReviewMessage = document.getElementById("resume-review-message");
    const resumeFileInput = document.getElementById("resume");
    let pendingResume = null;
    let duplicateApprovalIdentity = "";
    const identityFor = (values) => `${String(values.email || "").trim().toLowerCase()}|${String(values.phone || "").replace(/\D/g, "")}`;
    const fillIfEmpty = (name, value) => {
      const input = contactForm.elements.namedItem(name);
      if (input && !input.value.trim() && value) input.value = value;
    };
    const sectionText = (items) => (Array.isArray(items) ? items : []).join("\n");
    if (resumeFileInput) {
      resumeFileInput.addEventListener("change", () => {
        pendingResume = null;
        duplicateApprovalIdentity = "";
        resumeReview.hidden = true;
        resumeReview.querySelectorAll("textarea").forEach((field) => { field.value = ""; });
        contactForm.querySelector('[type="submit"]').textContent = "Review resume details";
      });
    }
    if (jobSelect) {
      const closeJobMenu = () => {
        jobSelectMenu.hidden = true;
        jobSelectToggle.setAttribute("aria-expanded", "false");
      };
      jobSelectToggle.addEventListener("click", () => {
        const opening = jobSelectMenu.hidden;
        jobSelectMenu.hidden = !opening;
        jobSelectToggle.setAttribute("aria-expanded", String(opening));
        if (opening) jobSelectSearch.focus();
      });
      jobSelectMenu.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeJobMenu();
          jobSelectToggle.focus();
        }
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".job-interest-dropdown")) closeJobMenu();
      });
      const updateSelectedJobTitles = () => {
        jobSelect.value = JSON.stringify([...selectedJobTitles]);
        jobSelectValue.textContent = selectedJobTitles.size
          ? `${selectedJobTitles.size} job${selectedJobTitles.size === 1 ? "" : "s"} selected`
          : "Select one or more jobs";
        jobSelectSelected.replaceChildren();
        selectedJobTitles.forEach((title) => {
          const chip = document.createElement("span");
          chip.className = "job-interest-chip";
          const name = document.createElement("span");
          name.textContent = title;
          const remove = document.createElement("button");
          remove.type = "button";
          remove.setAttribute("aria-label", `Remove ${title}`);
          remove.textContent = "×";
          remove.addEventListener("click", () => {
            selectedJobTitles.delete(title);
            renderJobOptions();
            updateSelectedJobTitles();
          });
          chip.append(name, remove);
          jobSelectSelected.appendChild(chip);
        });
      };
      const renderJobOptions = () => {
        const query = jobSelectSearch.value.trim().toLocaleLowerCase();
        jobSelectOptions.querySelectorAll(".job-interest-option").forEach((option) => {
          option.hidden = !option.textContent.toLocaleLowerCase().includes(query);
          option.setAttribute("aria-pressed", String(selectedJobTitles.has(option.dataset.title)));
        });
      };
      jobSelectSearch.addEventListener("input", renderJobOptions);
      request("/general-jobs").then((result) => {
        const jobs = Array.isArray(result) ? result : (result.items || result.jobs || []);
        jobSelectOptions.replaceChildren();
        jobs.forEach((job) => {
          if (!job.id) return;
          const option = document.createElement("button");
          option.type = "button";
          option.className = "job-interest-option";
          option.setAttribute("aria-pressed", "false");
          option.dataset.title = job.title || job.name || "Untitled job";
          option.textContent = job.title || job.name || "Untitled job";
          option.addEventListener("click", () => {
            if (selectedJobTitles.has(option.dataset.title)) selectedJobTitles.delete(option.dataset.title);
            else selectedJobTitles.add(option.dataset.title);
            renderJobOptions();
            updateSelectedJobTitles();
            setMessage(jobStatus, "");
          });
          jobSelectOptions.appendChild(option);
        });
        if (jobSelectOptions.children.length) {
          jobSelectToggle.disabled = false;
          updateSelectedJobTitles();
          setMessage(jobStatus, "");
        }
        else {
          jobSelectToggle.disabled = true;
          jobSelectValue.textContent = "No job titles available";
          setMessage(jobStatus, "There are no job titles available to select right now.");
        }
      }).catch((error) => {
        jobSelectToggle.disabled = true;
        jobSelectValue.textContent = "Job titles could not be loaded";
        setMessage(jobStatus, `Could not load job titles: ${error.message}`, true);
      });
    }
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = contactForm.querySelector('[type="submit"]');
      if (jobSelect && selectedJobTitles.size === 0) {
        setMessage(jobStatus, "Please choose at least one job you’re interested in.", true);
        if (!jobSelectToggle.disabled) jobSelectToggle.focus();
        return;
      }
      const resumeFile = resumeFileInput && resumeFileInput.files[0];
      const values = Object.fromEntries(new FormData(contactForm).entries());
      delete values.resume;
      if (!pendingResume) {
        if (!resumeFile) {
          setMessage(status, "Please attach your resume.", true);
          return;
        }
        const allowedTypes = new Set([
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]);
        const allowedExtensions = /\.(pdf|doc|docx)$/i;
        if ((!allowedTypes.has(resumeFile.type) && resumeFile.type !== "") || !allowedExtensions.test(resumeFile.name)) {
          setMessage(status, "Please choose a PDF, DOC, or DOCX resume.", true);
          return;
        }
        if (resumeFile.size > 10 * 1024 * 1024) {
          setMessage(status, "Your resume must be 10 MB or smaller.", true);
          return;
        }
      }
      if (button) button.disabled = true;
      try {
        const identity = identityFor(values);
        if ((values.email || values.phone) && identity !== duplicateApprovalIdentity) {
          setMessage(status, "Checking for existing contact information…");
          const shouldContinue = await checkForExistingContact(values.email, values.phone);
          if (!shouldContinue) {
            setMessage(status, "No new application was submitted. Contact recruiting if you need to update your information.");
            return;
          }
          duplicateApprovalIdentity = identity;
        }

        if (!pendingResume) {
          setMessage(status, "Uploading and reading your resume securely…");
          const presign = await request("/resumes/presign", {
            method: "POST",
            body: JSON.stringify({ filename: resumeFile.name, contentType: resumeFile.type || "application/octet-stream", size: resumeFile.size })
          });
          if (!presign.uploadUrl || !presign.objectKey) throw new Error("Resume upload details were missing from the API response.");
          const uploadResponse = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": resumeFile.type || "application/octet-stream" },
            body: resumeFile
          });
          if (!uploadResponse.ok) throw new Error(`Resume upload failed (${uploadResponse.status}).`);
          pendingResume = { resumeKey: presign.objectKey, resumeId: presign.resumeId || "", resumeFilename: resumeFile.name };

          let analysis = null;
          try {
            analysis = await request("/resumes/analyze", { method: "POST", body: JSON.stringify({ resumeKey: pendingResume.resumeKey }) });
          } catch (error) {
            analysis = { readable: false, message: "We couldn’t read text from this file. You can still enter your details manually." };
          }
          Object.entries(analysis?.fields || {}).forEach(([name, field]) => fillIfEmpty(name, field?.value || ""));
          const sections = analysis?.sections || {};
          document.getElementById("resume-work-history").value = sectionText(sections.workHistory);
          document.getElementById("resume-certifications").value = sectionText(sections.certifications);
          document.getElementById("resume-education").value = sectionText(sections.education);
          document.getElementById("resume-skills").value = sectionText(sections.skills);
          resumeReviewMessage.textContent = analysis?.message || "Review the suggestions below and correct anything that needs updating.";
          resumeReview.hidden = false;
          ["firstName", "lastName", "email", "phone"].forEach((name) => { contactForm.elements.namedItem(name).required = true; });
          button.textContent = "Confirm details and send";
          setMessage(status, "Your resume is uploaded. Review the suggested details, then confirm to submit your application.");
          resumeReview.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        const workLines = document.getElementById("resume-work-history").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const certificationLines = document.getElementById("resume-certifications").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        values.workHistory = workLines.map((duties) => ({ company: "", title: "", from: "", to: "", duties }));
        values.certifications = certificationLines.map((name) => ({ name, expiration: "" }));
        values.highestEducation = document.getElementById("resume-education").value.trim();
        values.skills = document.getElementById("resume-skills").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        values.resumeKey = pendingResume.resumeKey;
        values.resumeId = pendingResume.resumeId;
        values.resumeFilename = pendingResume.resumeFilename;
        values.applicationType = "resume";
        await request("/contacts", { method: "POST", body: JSON.stringify(values) });
        contactForm.reset();
        pendingResume = null;
        duplicateApprovalIdentity = "";
        resumeReview.hidden = true;
        resumeReview.querySelectorAll("textarea").forEach((field) => { field.value = ""; });
        ["firstName", "lastName", "email", "phone"].forEach((name) => { contactForm.elements.namedItem(name).required = false; });
        button.textContent = "Review resume details";
        if (jobSelect) {
          selectedJobTitles.clear();
          jobSelect.value = "[]";
          jobSelectSearch.value = "";
          updateSelectedJobTitles();
          renderJobOptions();
          jobSelectMenu.hidden = true;
          jobSelectToggle.setAttribute("aria-expanded", "false");
        }
        setMessage(status, "Thanks. Your information has been sent.");
      } catch (error) {
        setMessage(status, `${error.message} Please try again later.`, true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  const nonResumeForm = document.getElementById("non-resume-form");
  if (nonResumeForm) {
    const status = document.createElement("p");
    status.className = "site-form-status";
    status.setAttribute("aria-live", "polite");
    nonResumeForm.appendChild(status);

    nonResumeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = nonResumeForm.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      setMessage(status, "Sending your trade checklist…");

      const formData = new FormData(nonResumeForm);
      const firstName = String(formData.get("firstName") || "").trim();
      const lastName = String(formData.get("lastName") || "").trim();
      const workHistory = Array.from(nonResumeForm.querySelectorAll("[data-work-entry]"), (entry) => {
        const read = (field) => entry.querySelector(`[name$=".${field}"]`)?.value.trim() || "";
        return {
          company: read("company"),
          title: read("title"),
          from: read("from"),
          to: read("to"),
          duties: read("duties")
        };
      }).filter((job) => Object.values(job).some(Boolean));
      const certifications = Array.from(nonResumeForm.querySelectorAll("[data-certification-entry]"), (entry) => ({
        name: entry.querySelector('[name$=".name"]')?.value.trim() || "",
        expiration: entry.querySelector('[name$=".expiration"]')?.value || ""
      })).filter((item) => item.name || item.expiration);
      const candidateTrades = [
        ...Array.from(nonResumeForm.querySelectorAll('[name="desiredPositions"]:checked'), (input) => ({
          tradeName: input.value,
          category: "",
          selectionType: "desired_position"
        })),
        ...Array.from(nonResumeForm.querySelectorAll('[name="skillProficiency"]:checked'), (input) => ({
          tradeName: input.value,
          category: input.closest("details")?.querySelector("summary")?.textContent.replace(/^[A-I]\.\s*/, "") || "",
          selectionType: "skill_proficiency"
        }))
      ];

      const application = {
        applicationType: "non-resume-trade-checklist",
        firstName,
        lastName,
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("primaryPhone") || "").trim(),
        alternatePhone: String(formData.get("alternatePhone") || "").trim(),
        fullAddress: String(formData.get("fullAddress") || "").trim(),
        emergencyContact: String(formData.get("emergencyContact") || "").trim(),
        emergencyPhone: String(formData.get("emergencyPhone") || "").trim(),
        primaryTrade: String(formData.get("primaryTrade") || "").trim(),
        desiredPayRate: String(formData.get("desiredPayRate") || "").trim(),
        availableStart: String(formData.get("availableStart") || ""),
        travelRelocation: String(formData.get("travelRelocation") || ""),
        shiftAvailability: formData.getAll("shiftAvailability"),
        driversLicense: formData.getAll("driversLicense"),
        ownTransport: String(formData.get("ownTransport") || ""),
        twicStatus: String(formData.get("twicStatus") || ""),
        twicExpiration: String(formData.get("twicExpiration") || ""),
        workHistory,
        certifications,
        skillProficiency: formData.getAll("skillProficiency"),
        desiredPositions: formData.getAll("desiredPositions"),
        candidateTrades,
        otherRoles: String(formData.get("otherRoles") || "").trim(),
        highestEducation: String(formData.get("highestEducation") || "").trim(),
        applicantSignature: String(formData.get("applicantSignature") || "").trim(),
        signatureDate: String(formData.get("signatureDate") || ""),
        acknowledgement: formData.get("acknowledgement") === "true",
        resumeKey: null,
        resumeFilename: null,
        jobId: null
      };

      try {
        setMessage(status, "Checking for existing contact information…");
        const shouldContinue = await checkForExistingContact(application.email, application.phone);
        if (!shouldContinue) {
          setMessage(status, "No new checklist was submitted. Contact recruiting if you need to update your information.");
          return;
        }
        setMessage(status, "Sending your trade checklist…");
        await request("/contacts", { method: "POST", body: JSON.stringify(application) });
        nonResumeForm.reset();
        setMessage(status, "Thanks. Your trade checklist has been sent to our recruiting team.");
      } catch (error) {
        setMessage(status, `${error.message} Please try again later.`, true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  const jobForm = document.getElementById("job-upload-form");
  if (jobForm) {
    const status = document.createElement("p");
    status.className = "site-form-status";
    status.setAttribute("aria-live", "polite");
    jobForm.appendChild(status);
    jobForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = jobForm.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      setMessage(status, "Publishing…");
      const values = Object.fromEntries(new FormData(jobForm).entries());
      const job = {
        title: values.title,
        type: values.type,
        link: values.link,
        location: values.location,
        description: values.description
      };
      try {
        await request("/jobs", { method: "POST", body: JSON.stringify(job) });
        jobForm.reset();
        setMessage(status, "Job posted.");
      } catch (error) {
        setMessage(status, `${error.message} Please try again later.`, true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  const jobList = document.getElementById("jobList");
  if (jobList) {
    const empty = document.getElementById("job-list-status");
    const displayDate = (value) => {
      if (!value) return "";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
    };
    (async () => {
      setMessage(empty, "Loading current openings…");
      try {
        const result = await request("/jobs");
        const jobs = Array.isArray(result) ? result : (result.items || result.jobs || []);
        jobList.replaceChildren();
        if (!jobs.length) {
          setMessage(empty, "There are no current openings. Please check back soon.");
          return;
        }
        setMessage(empty, "");
        jobs.forEach((job) => {
          const card = document.createElement("article");
          card.className = "job-box";

          if (job.type) {
            const type = document.createElement("span");
            type.className = "job-card-type";
            type.textContent = job.type;
            card.appendChild(type);
          }

          const title = document.createElement("h3");
          title.className = "job-title";
          title.textContent = String(job.title || job.name || "Job opening");
          card.appendChild(title);

          const meta = document.createElement("div");
          meta.className = "job-card-meta";
          if (job.location) {
            const location = document.createElement("span");
            location.className = "meta-location";
            location.textContent = `Location: ${job.location}`;
            meta.appendChild(location);
          }
          const posted = displayDate(job.createdAt);
          if (posted) {
            const date = document.createElement("span");
            date.className = "meta-posted";
            date.textContent = `Posted: ${posted}`;
            meta.appendChild(date);
          }
          if (meta.childElementCount) card.appendChild(meta);

          const description = String(job.description || job.desc || "").trim();
          if (description.length > 260) {
            const details = document.createElement("details");
            const summary = document.createElement("summary");
            summary.className = "job-description-toggle";
            summary.textContent = "Read full description";
            const text = document.createElement("p");
            text.className = "job-description";
            text.textContent = description;
            details.append(summary, text);
            card.appendChild(details);
          } else if (description) {
            const text = document.createElement("p");
            text.className = "job-description";
            text.textContent = description;
            card.appendChild(text);
          }

          if (job.link) {
            const link = document.createElement("a");
            link.href = job.link;
            link.className = "job-apply-button";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.append(document.createTextNode("View job & apply"));
            const arrow = document.createElement("span");
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = "→";
            link.appendChild(arrow);
            card.appendChild(link);
          }
          jobList.appendChild(card);
        });
      } catch (error) {
        setMessage(empty, `${error.message} Jobs could not be loaded.`, true);
      }
    })();
  }
})();
