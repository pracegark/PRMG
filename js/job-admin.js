(() => {
  const overlay = document.getElementById("admin-login-overlay");
  const panel = document.getElementById("admin-panel");
  const loginForm = document.getElementById("admin-login-form");
  const jobForm = document.getElementById("admin-job-form");
  const jobTypeSelect = document.getElementById("job-type");
  const jobTypeToggle = document.getElementById("job-type-toggle");
  const jobTypeValue = document.getElementById("job-type-value");
  const jobTypeMenu = document.getElementById("job-type-menu");
  const jobTypeSearch = document.getElementById("job-type-search");
  const jobTypeOptions = document.getElementById("job-type-options");
  const jobTypeNoResults = document.getElementById("job-type-no-results");
  const exportForm = document.getElementById("admin-export-form");
  const outreachForm = document.getElementById("admin-outreach-form");
  const outreachJobType = document.getElementById("outreach-job-type");
  const outreachJobTypeToggle = document.getElementById("outreach-job-type-toggle");
  const outreachJobTypeValue = document.getElementById("outreach-job-type-value");
  const outreachJobTypeMenu = document.getElementById("outreach-job-type-menu");
  const outreachJobTypeSearch = document.getElementById("outreach-job-type-search");
  const outreachJobTypeOptions = document.getElementById("outreach-job-type-options");
  const outreachJobTypeNoResults = document.getElementById("outreach-job-type-no-results");
  const outreachStatus = document.getElementById("outreach-status");
  const outreachSubmit = document.getElementById("outreach-submit");
  const jobsTableBody = document.getElementById("admin-jobs-table-body");
  const jobsEmpty = document.getElementById("admin-jobs-empty");
  const jobFilters = {
    title: document.getElementById("job-filter-title"),
    type: document.getElementById("job-filter-type"),
    location: document.getElementById("job-filter-location"),
    description: document.getElementById("job-filter-description"),
    visibilityToggle: document.getElementById("job-filter-visibility-toggle"),
    visibilityValue: document.getElementById("job-filter-visibility-value"),
    visibilityMenu: document.getElementById("job-filter-visibility-menu")
  };
  const loginError = document.getElementById("admin-login-error");
  const jobStatus = document.getElementById("job-status");
  const exportStatus = document.getElementById("export-status");
  const adminJobsStatus = document.getElementById("admin-jobs-status");
  const logoutButton = document.getElementById("admin-logout");
  let adminJobs = [];
  let generalJobTypes = [];
  let visibilityFilterValue = "all";
  let outreachEmails = [];
  let outreachLookupSequence = 0;

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  }

  function setAuthenticated(authenticated) {
    overlay.hidden = authenticated;
    panel.classList.toggle("admin-blurred", !authenticated);
    logoutButton.hidden = !authenticated;
    if (authenticated) {
      document.getElementById("job-title").focus();
      loadAdminJobs();
    }
    else document.getElementById("admin-username").focus();
  }

  function filteredJobs() {
    const matches = (value, filter) => String(value || "").toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase());
    return adminJobs.filter((job) =>
      matches(job.title, jobFilters.title) &&
      matches(job.type, jobFilters.type) &&
      matches(job.location, jobFilters.location) &&
      matches(job.description, jobFilters.description) &&
      (visibilityFilterValue === "all" || (visibilityFilterValue === "visible") === Boolean(job.isVisible))
    );
  }

  function renderAdminJobs() {
    const jobs = filteredJobs();
    jobsTableBody.replaceChildren();
    jobs.forEach((job) => {
      const row = document.createElement("tr");
      const title = document.createElement("td");
      title.className = "admin-job-title-cell";
      title.textContent = job.title;
      row.appendChild(title);
      [job.type, job.location].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value || "—";
        row.appendChild(cell);
      });
      const description = document.createElement("td");
      description.className = "admin-job-description-cell";
      const descriptionText = document.createElement("div");
      descriptionText.className = "admin-job-description-content";
      descriptionText.textContent = job.description || "—";
      description.appendChild(descriptionText);
      row.appendChild(description);
      const status = document.createElement("td");
      const control = document.createElement("div");
      control.className = "admin-job-visibility-control";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "admin-job-visibility-toggle";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", String(Boolean(job.isVisible)));
      toggle.setAttribute("aria-label", `${job.isVisible ? "Hide" : "Show"} ${job.title}`);
      const badge = document.createElement("span");
      badge.className = `admin-job-state ${job.isVisible ? "is-visible" : "is-hidden"}`;
      badge.textContent = job.isVisible ? "Visible" : "Hidden";
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        const nextVisibility = !job.isVisible;
        adminJobsStatus.textContent = nextVisibility ? `Making “${job.title}” visible…` : `Hiding “${job.title}”…`;
        try {
          await api(`/admin/jobs/${encodeURIComponent(job.id)}/visibility`, {
            method: "PATCH",
            body: JSON.stringify({ isVisible: nextVisibility })
          });
          job.isVisible = nextVisibility;
          renderAdminJobs();
          adminJobsStatus.textContent = `“${job.title}” is now ${nextVisibility ? "visible" : "hidden"}.`;
        } catch (error) {
          toggle.disabled = false;
          if (error.message.toLowerCase().includes("log in")) setAuthenticated(false);
          adminJobsStatus.textContent = error.message;
        }
      });
      control.append(toggle, badge);
      status.appendChild(control);
      row.appendChild(status);
      jobsTableBody.appendChild(row);
    });
    jobsEmpty.hidden = jobs.length > 0;
    adminJobsStatus.textContent = adminJobs.length
      ? `Showing ${jobs.length} of ${adminJobs.length} job listing${adminJobs.length === 1 ? "" : "s"}.`
      : "No job listings yet.";
  }

  async function loadAdminJobs() {
    adminJobsStatus.textContent = "Loading job listings…";
    try {
      adminJobs = await api("/admin/jobs");
      renderAdminJobs();
    } catch (error) {
      if (error.message.toLowerCase().includes("log in")) setAuthenticated(false);
      adminJobsStatus.textContent = error.message;
    }
  }

  async function loadGeneralJobTypes() {
    try {
      generalJobTypes = await api("/general-jobs");
      jobTypeOptions.replaceChildren();
      if (outreachJobTypeOptions) outreachJobTypeOptions.replaceChildren();
      generalJobTypes.forEach((jobType) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "admin-job-type-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.textContent = jobType.title;
        option.dataset.jobType = jobType.title;
        option.addEventListener("click", () => {
          jobTypeSelect.value = jobType.title;
          jobTypeValue.textContent = jobType.title;
          jobTypeOptions.querySelectorAll("[role='option']").forEach((item) => {
            item.setAttribute("aria-selected", String(item === option));
          });
          closeJobTypeMenu();
          jobTypeToggle.focus();
          jobStatus.textContent = "";
        });
        jobTypeOptions.appendChild(option);
        if (outreachJobTypeOptions) {
          const outreachOption = document.createElement("button");
          outreachOption.type = "button";
          outreachOption.className = "admin-job-type-option";
          outreachOption.setAttribute("role", "option");
          outreachOption.setAttribute("aria-selected", "false");
          outreachOption.textContent = jobType.title;
          outreachOption.dataset.jobType = jobType.title;
          outreachOption.addEventListener("click", () => {
            outreachJobType.value = jobType.title;
            outreachJobTypeValue.textContent = jobType.title;
            outreachJobTypeOptions.querySelectorAll("[role='option']").forEach((item) => {
              item.setAttribute("aria-selected", String(item === outreachOption));
            });
            closeOutreachJobTypeMenu();
            outreachJobTypeToggle.focus();
            loadOutreachAudience();
          });
          outreachJobTypeOptions.appendChild(outreachOption);
        }
      });
      jobTypeToggle.disabled = generalJobTypes.length === 0;
      jobTypeValue.textContent = generalJobTypes.length ? "Choose a job type" : "No job types available";
      if (outreachJobTypeToggle) {
        outreachJobTypeToggle.disabled = generalJobTypes.length === 0;
        outreachJobTypeValue.textContent = generalJobTypes.length ? "Choose a job type or role" : "No job types available";
        renderOutreachJobTypeOptions();
      }
      renderJobTypeOptions();
    } catch (error) {
      jobTypeToggle.disabled = true;
      jobTypeValue.textContent = "Job types could not be loaded";
      if (outreachJobTypeToggle) {
        outreachJobTypeToggle.disabled = true;
        outreachJobTypeValue.textContent = "Job types could not be loaded";
      }
      jobStatus.textContent = error.message;
    }
  }

  function closeJobTypeMenu() {
    jobTypeMenu.hidden = true;
    jobTypeToggle.setAttribute("aria-expanded", "false");
  }

  function renderJobTypeOptions() {
    const query = jobTypeSearch.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    jobTypeOptions.querySelectorAll("[role='option']").forEach((option) => {
      const matches = option.textContent.toLocaleLowerCase().includes(query);
      option.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    jobTypeNoResults.hidden = visibleCount > 0;
  }

  function closeOutreachJobTypeMenu() {
    outreachJobTypeMenu.hidden = true;
    outreachJobTypeToggle.setAttribute("aria-expanded", "false");
  }

  function renderOutreachJobTypeOptions() {
    const query = outreachJobTypeSearch.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    outreachJobTypeOptions.querySelectorAll("[role='option']").forEach((option) => {
      const matches = option.textContent.toLocaleLowerCase().includes(query);
      option.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    outreachJobTypeNoResults.hidden = visibleCount > 0;
  }

  jobTypeToggle.addEventListener("click", () => {
    const opening = jobTypeMenu.hidden;
    jobTypeMenu.hidden = !opening;
    jobTypeToggle.setAttribute("aria-expanded", String(opening));
    if (opening) {
      jobTypeSearch.focus();
      jobTypeSearch.select();
    }
  });
  jobTypeSearch.addEventListener("input", renderJobTypeOptions);
  jobTypeSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeJobTypeMenu();
      jobTypeToggle.focus();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      jobTypeOptions.querySelector("[role='option']:not([hidden])")?.focus();
    }
    if (event.key === "Enter") {
      const firstVisibleOption = jobTypeOptions.querySelector("[role='option']:not([hidden])");
      if (firstVisibleOption) {
        event.preventDefault();
        firstVisibleOption.click();
      }
    }
  });
  jobTypeMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeJobTypeMenu();
      jobTypeToggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".admin-job-type-select")) closeJobTypeMenu();
  });

  loadGeneralJobTypes();

  if (outreachJobTypeToggle) {
    outreachJobTypeToggle.addEventListener("click", () => {
      const opening = outreachJobTypeMenu.hidden;
      outreachJobTypeMenu.hidden = !opening;
      outreachJobTypeToggle.setAttribute("aria-expanded", String(opening));
      if (opening) {
        outreachJobTypeSearch.focus();
        outreachJobTypeSearch.select();
      }
    });
    outreachJobTypeSearch.addEventListener("input", renderOutreachJobTypeOptions);
    outreachJobTypeSearch.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOutreachJobTypeMenu();
        outreachJobTypeToggle.focus();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        outreachJobTypeOptions.querySelector("[role='option']:not([hidden])")?.focus();
      }
      if (event.key === "Enter") {
        const firstVisibleOption = outreachJobTypeOptions.querySelector("[role='option']:not([hidden])");
        if (firstVisibleOption) {
          event.preventDefault();
          firstVisibleOption.click();
        }
      }
    });
    outreachJobTypeMenu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeOutreachJobTypeMenu();
        outreachJobTypeToggle.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#admin-outreach-form .admin-job-type-select")) closeOutreachJobTypeMenu();
    });
  }

  async function loadOutreachAudience() {
    if (!outreachForm || !outreachJobType || !outreachSubmit) return;
    const sequence = ++outreachLookupSequence;
    outreachEmails = [];
    outreachSubmit.disabled = true;
    const filters = new FormData(outreachForm);
    const jobTitle = String(filters.get("jobTitle") || "").trim();
    if (!jobTitle) {
      outreachStatus.textContent = "Choose a job type or role to find matching applicants.";
      return;
    }
    if (filters.get("from") && filters.get("to") && filters.get("from") > filters.get("to")) {
      outreachStatus.textContent = "The start date must be on or before the end date.";
      return;
    }
    outreachStatus.textContent = "Finding applicants…";
    const params = new URLSearchParams({ jobTitle });
    if (filters.get("from")) params.set("from", filters.get("from"));
    if (filters.get("to")) params.set("to", filters.get("to"));
    try {
      const response = await fetch(`/api/admin/outreach-recipients?${params}`, { credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) setAuthenticated(false);
        throw new Error(result.message || "Could not find matching applicants.");
      }
      if (sequence !== outreachLookupSequence) return;
      outreachEmails = Array.isArray(result.emails) ? result.emails : [];
      outreachSubmit.disabled = outreachEmails.length === 0;
      outreachStatus.textContent = outreachEmails.length
        ? `${outreachEmails.length} applicant${outreachEmails.length === 1 ? "" : "s"} with an email address match ${result.jobTitle}.`
        : `No applicants with an email address match ${result.jobTitle} and these dates.`;
    } catch (error) {
      if (sequence !== outreachLookupSequence) return;
      outreachStatus.textContent = error.message;
    }
  }

  if (outreachForm) {
    outreachForm.querySelectorAll('input[type="date"]').forEach((dateInput) => {
      dateInput.addEventListener("change", loadOutreachAudience);
    });
    outreachForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!outreachEmails.length) return;
      const bcc = encodeURIComponent(outreachEmails.join(","));
      const draftUrl = `mailto:?bcc=${bcc}`;
      outreachStatus.textContent = `Opening an email draft with ${outreachEmails.length} applicant${outreachEmails.length === 1 ? "" : "s"} in BCC…`;
      window.location.href = draftUrl;
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const submit = loginForm.querySelector("button[type='submit']");
    submit.disabled = true;
    try {
      await api("/admin/login", { method: "POST", body: JSON.stringify({
        username: loginForm.elements.username.value,
        password: loginForm.elements.password.value
      }) });
      loginForm.reset();
      setAuthenticated(true);
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    try { await api("/admin/logout", { method: "POST", body: "{}" }); }
    finally { setAuthenticated(false); }
  });

  jobForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!jobTypeSelect.value) {
      jobStatus.textContent = "Please choose a job type.";
      jobTypeToggle.focus();
      return;
    }
    jobStatus.textContent = "Saving job…";
    const submit = jobForm.querySelector("button[type='submit']");
    submit.disabled = true;
    const fields = new FormData(jobForm);
    const payload = Object.fromEntries(fields.entries());
    try {
      const job = await api("/jobs", { method: "POST", body: JSON.stringify(payload) });
      jobForm.reset();
      jobTypeValue.textContent = "Choose a job type";
      jobTypeSearch.value = "";
      jobTypeOptions.querySelectorAll("[role='option']").forEach((option) => option.setAttribute("aria-selected", "false"));
      renderJobTypeOptions();
      jobStatus.textContent = `“${job.title}” was added to the job board.`;
      await loadAdminJobs();
    } catch (error) {
      if (error.message.toLowerCase().includes("log in")) setAuthenticated(false);
      jobStatus.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  [jobFilters.title, jobFilters.type, jobFilters.location, jobFilters.description].forEach((filter) => {
    filter.addEventListener("input", renderAdminJobs);
  });

  jobFilters.visibilityToggle.addEventListener("click", () => {
    const isOpen = jobFilters.visibilityToggle.getAttribute("aria-expanded") === "true";
    jobFilters.visibilityToggle.setAttribute("aria-expanded", String(!isOpen));
    jobFilters.visibilityMenu.hidden = isOpen;
    if (!isOpen) jobFilters.visibilityMenu.querySelector("button[aria-pressed='true']")?.focus();
  });

  jobFilters.visibilityMenu.querySelectorAll("[data-visibility]").forEach((option) => {
    option.addEventListener("click", () => {
      visibilityFilterValue = option.dataset.visibility;
      jobFilters.visibilityValue.textContent = option.textContent;
      jobFilters.visibilityMenu.querySelectorAll("[data-visibility]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === option));
      });
      jobFilters.visibilityMenu.hidden = true;
      jobFilters.visibilityToggle.setAttribute("aria-expanded", "false");
      jobFilters.visibilityToggle.focus();
      renderAdminJobs();
    });
  });

  jobFilters.visibilityToggle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && jobFilters.visibilityMenu.hidden) {
      event.preventDefault();
      jobFilters.visibilityToggle.click();
    }
  });
  jobFilters.visibilityMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      jobFilters.visibilityMenu.hidden = true;
      jobFilters.visibilityToggle.setAttribute("aria-expanded", "false");
      jobFilters.visibilityToggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".admin-job-filter-select")) {
      jobFilters.visibilityMenu.hidden = true;
      jobFilters.visibilityToggle.setAttribute("aria-expanded", "false");
    }
  });

  exportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    exportStatus.textContent = "Preparing applicant download…";
    const submit = exportForm.querySelector("button[type='submit']");
    submit.disabled = true;
    const filters = new FormData(exportForm);
    const params = new URLSearchParams();
    if (filters.get("from")) params.set("from", filters.get("from"));
    if (filters.get("to")) params.set("to", filters.get("to"));
    if (filters.get("from") && filters.get("to") && filters.get("from") > filters.get("to")) {
      exportStatus.textContent = "The start date must be on or before the end date.";
      submit.disabled = false;
      return;
    }
    try {
      const response = await fetch(`/api/admin/contacts.csv${params.size ? `?${params}` : ""}`, { credentials: "same-origin" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 401) setAuthenticated(false);
        throw new Error(error.message || "Could not prepare the CSV download.");
      }
      const csv = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "prmg-applicants.csv";
      const downloadUrl = URL.createObjectURL(csv);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      const count = response.headers.get("X-Export-Count") || "0";
      exportStatus.textContent = `Downloaded ${count} applicant record${count === "1" ? "" : "s"}.`;
    } catch (error) {
      exportStatus.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  api("/admin/session").then((session) => setAuthenticated(session.authenticated)).catch(() => setAuthenticated(false));
})();
