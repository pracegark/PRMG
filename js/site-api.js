/* Set this to the API Gateway invoke URL, without a trailing slash. */
window.SITE_API_BASE_URL = "https://ntd69d98a8.execute-api.us-east-2.amazonaws.com";

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

  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    const status = document.createElement("p");
    status.className = "site-form-status";
    status.setAttribute("aria-live", "polite");
    contactForm.appendChild(status);
    const jobSelect = document.getElementById("job-interest");
    const jobStatus = document.getElementById("job-interest-status");
    if (jobSelect) {
      request("/jobs").then((result) => {
        const jobs = Array.isArray(result) ? result : (result.items || result.jobs || []);
        jobSelect.replaceChildren(new Option("Select a job", ""));
        jobs.forEach((job) => {
          if (!job.id) return;
          jobSelect.add(new Option(job.title || job.name || "Untitled job", job.id));
        });
        if (jobs.length) setMessage(jobStatus, "");
        else {
          jobSelect.disabled = true;
          setMessage(jobStatus, "There are no available jobs to select right now.");
        }
      }).catch((error) => {
        jobSelect.disabled = true;
        setMessage(jobStatus, `Could not load available jobs: ${error.message}`, true);
      });
    }
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = contactForm.querySelector('[type="submit"]');
      const resumeInput = document.getElementById("resume");
      const resumeFile = resumeInput && resumeInput.files[0];
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
      if (button) button.disabled = true;
      setMessage(status, "Uploading resume and sending your information…");
      const values = Object.fromEntries(new FormData(contactForm).entries());
      delete values.resume;
      try {
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
        values.resumeKey = presign.objectKey;
        values.resumeFilename = resumeFile.name;
        await request("/contacts", { method: "POST", body: JSON.stringify(values) });
        contactForm.reset();
        if (jobSelect) {
          jobSelect.disabled = false;
          if (jobSelect.options.length > 1) jobSelect.selectedIndex = 0;
        }
        setMessage(status, "Thanks. Your information has been sent.");
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
    const escapeText = (value) => String(value || "");
    (async () => {
      setMessage(empty, "Loading jobs…");
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
          const title = document.createElement("h3");
          title.textContent = escapeText(job.title || job.name);
          card.appendChild(title);
          [["Type", job.type], ["Location", job.location], ["Description", job.description || job.desc]].forEach(([label, value]) => {
            if (!value) return;
            const row = document.createElement("p");
            row.className = "job-variable";
            const strong = document.createElement("strong");
            strong.textContent = `${label}: `;
            row.append(strong, document.createTextNode(escapeText(value)));
            card.appendChild(row);
          });
          if (job.link) {
            const link = document.createElement("a");
            link.href = job.link;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View / apply";
            card.appendChild(link);
          }
          if (job.id) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "delete-btn";
            remove.textContent = "Remove job";
            remove.addEventListener("click", async () => {
              if (!window.confirm("Remove this job listing?")) return;
              remove.disabled = true;
              try {
                await request(`/jobs/${encodeURIComponent(job.id)}`, { method: "DELETE" });
                card.remove();
                if (!jobList.children.length) setMessage(empty, "There are no current openings. Please check back soon.");
              } catch (error) {
                remove.disabled = false;
                setMessage(empty, `${error.message} The job was not removed.`, true);
              }
            });
            card.appendChild(remove);
          }
          jobList.appendChild(card);
        });
      } catch (error) {
        setMessage(empty, `${error.message} Jobs could not be loaded.`, true);
      }
    })();
  }
})();
