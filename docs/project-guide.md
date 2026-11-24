# PRMG website and application guide

This guide describes the repository as it is currently organized. Pages and features marked **Legacy** are retained in the source tree, but they are not the current route for that function.

## Main site pages

| Page | Purpose | Status |
| --- | --- | --- |
| `index.html` | Public home page. | Current |
| `staffing-solutions.html` | Staffing overview and links into industry pages. | Current |
| `about.html` | Company background and staffing overview. | Current |
| `contacts.html` | Main contact and location information. | Current contact page |
| `safety.html` | Safety program and training information. | Current |
| `energy-staffing.html` | Energy and oil and gas staffing details. | Current |
| `construction-staffing.html` | Construction staffing details. | Current |
| `environmental-staffing.html` | Environmental staffing details and training list. | Current |
| `other-staffing.html` | Other staffing services. | Current |
| `therapy-staffing.html` | Therapy staffing services. | Current |
| `job-page.html` | Public job listings, loaded from the API. | Current public job board |
| `job-seeker.html` | Resume application, resume review, and job interest selection. | Current application |
| `non-resume.html` | Trade checklist application for applicants without a resume. | Current application |
| `job-admin.html` | Admin dashboard for job management, applicant exports, and outreach. Requires API authentication. | Current admin page |

## Legacy pages and aliases

| Page or group | What it is / current destination |
| --- | --- |
| `job-board.html` | **Legacy alias.** Redirects to `job-admin.html`; public job listings are on `job-page.html`. |
| `job-seeker-pg.html` | **Legacy alias.** Redirects to `job-seeker.html`. |
| `job-update.html` | **Legacy alias.** Redirects to `job-page.html`. |
| `contact-energy.html`, `contact-construction.html`, `contact-environmental.html`, `contact-therapy.html` | **Legacy industry-specific contact pages.** `contacts.html` is the canonical contact page. |
| `thing.html` | **Legacy duplicate** of the About page. Use `about.html`. |
| `login.html` | **Legacy login page; do not use for administration.** It relies on client-side code and a hard-coded username check. Admin authentication belongs to the protected login panel in `job-admin.html`, backed by `/admin/login`. |
| `layouts/*.html` | **Legacy theme/demo templates**, including blog, team, careers, project, and sample service pages. They are not the maintained PRMG content pages. Some contain RD Mailform forms still wired to the old `theroomisred.info` email endpoint through `js/script.js`. |
| `function.js` | **Legacy helper code.** It contains localStorage login helpers and a sample CSV export function. It is not the admin authentication implementation. |

The legacy RD Mailform endpoint is separate from the current application API. If a page under `layouts/` is published or linked, its form may still submit to that old service. The normal applicant and admin flows do not use those template forms.

## Shared page shell and front-end code

- `partials/site-header.html` and `partials/site-footer.html` are the shared header and footer fragments.
- `scripts/build.mjs` copies public files to `dist/`, expands the shared header/footer markers, adds the mobile stylesheet where needed, and writes `dist/js/deployment-config.js` with the configured API base URL.
- `js/site-api.js` is the public application client used by the job board, resume application, and trade checklist. It handles job-title loading, duplicate-contact checks, contact submission, resume upload/review, and related API calls.
- `js/job-admin.js` drives the admin dashboard and uses the same deployment-injected `window.PRMG_API_BASE_URL` for login, job management, CSV export, and email-recipient filtering.
- `js/non-resume-form.js` handles the trade checklist UI, searchable/multiple selections, and repeatable work history fields before submission through `js/site-api.js`.
- `js/script.js` and `js/core.min.js` are the legacy theme's shared interaction and vendor bundles. `js/html5shiv.min.js` and `js/pointer-events.min.js` are compatibility shims.
- `css/style.css` and `css/fonts.css` hold the theme styles and fonts. `css/mobile.css` covers small screens. `css/non-resume-form.css`, `css/resume-review.css`, and `css/duplicate-contact.css` style the application-specific UI.
- `images/`, `fonts/`, and `video/` contain the public site media, logos, icons, and font assets. `images/indeed-logo.svg` is the Indeed footer mark.
- `PEB-Incentives.pdf` and `Prime-Benefits-Incentives.pdf` are benefits documents. `database/general-jobs.json` is the seed list for searchable job titles.

## Application API and data flow

The hosted API is an API Gateway endpoint backed by Lambda and private PostgreSQL. The local API is implemented separately in `local-api.mjs` and uses SQLite at `data/prmg.sqlite`.

| Method and path | Purpose | Access |
| --- | --- | --- |
| `GET /health` | API/database health response. | Public |
| `GET /jobs` | Visible job listings for the public job board. | Public |
| `GET /general-jobs` | Searchable general job-title list. | Public |
| `POST /contacts/check-existing` | Look up possible duplicate contacts by email or phone. | Public |
| `POST /contacts` | Save an applicant/contact and selected trade data. | Public |
| `POST /resumes/presign` | Create a short-lived signed S3 upload URL for a resume. | Public |
| `POST /resumes/analyze` | Extract resume text and suggested work, education, certification, and skill details. | Public |
| `GET /admin/session` | Check whether the caller has a valid admin session. | Public session check; reports unauthenticated when no valid token is supplied |
| `POST /admin/login` | Verify username/password and return an admin session token. | Public login route |
| `POST /admin/logout` | Clear the client-side admin session. | Public; logout response does not require a valid token |
| `GET /admin/jobs` | List all jobs, including hidden listings. | Admin token |
| `POST /jobs` | Add a job listing. | Admin token |
| `PATCH /admin/jobs/{id}/visibility` | Show or hide a job listing. | Admin token |
| `DELETE /jobs/{id}` | Delete a job listing. | Admin token |
| `GET /admin/outreach-recipients` | Return deduplicated emails matching job interest and optional date filters. | Admin token |
| `GET /admin/contacts.csv` | Download the filtered applicant/contact CSV. | Admin token |

Resume uploads go directly from the browser to S3 using a signed URL. The contact API validates that the uploaded object exists before attaching its resume ID/key to the contact. Resume content and checklist answers are represented in the contact payload.

## Database tables

| Table | Purpose |
| --- | --- |
| `jobs` | Job listings, type, location, description, URL, creation date, and visibility flag. |
| `general_jobs` | Searchable general job titles used for candidate interests and admin job type selection. |
| `users` | Admin accounts. Passwords are stored as salted scrypt hashes; `testCredentials` is a boolean flag. |
| `contacts` | Applicant/contact identity, application type, optional job/resume references, JSON application payload, and `dateAdded`. |
| `candidate_trades` | Normalized trade and role selections linked to a contact. |

The hosted schema is `database/schema.postgres.sql`. The local SQLite schema and migration-on-start behavior are in `local-api.mjs`. `data/` is git-ignored and is local-only; it is not the hosted database.

## Local development

1. Install dependencies with `npm install` (or `npm ci` for a clean install).
2. Run `npm start`.
3. Open `http://localhost:3000/`.
4. Create a local administrator with `npm run admin:create`, then sign in at `http://localhost:3000/job-admin.html`.

The local server serves the built `dist/` tree and routes `/api/*` to the SQLite API. Local resume files are stored under `data/resumes/`. Do not copy local DB files or applicant uploads into Git.

## Hosting and deployment

Current AWS deployment state was checked on 2026-11-24:

- Amplify app `app6678` (`d1047s1zoy2x8i`) is in `us-east-1`. Its `staging` branch is marked `PRODUCTION` and maps to `primermg.com` and `www.primermg.com`.
- The Amplify app has no Git repository connected. The current site was deployed manually as an Amplify static bundle; Git pushes alone do not deploy it.
- `PRMG_API_BASE_URL` is configured on the Amplify `staging` branch as `https://kqf48x7cwc.execute-api.us-east-2.amazonaws.com`.
- The active CloudFormation stack is `prmg-app-backend-v2` in `us-east-2`. It provisions the private PostgreSQL database, Lambda API, migration Lambda, API Gateway, networking, and secrets. A previous failed stack named `prmg-app-backend` remains in `ROLLBACK_COMPLETE`.
- The database migration completed, creating the schema and seeding 139 general job titles. The first admin is `admin`; its generated password is held in Secrets Manager. Never put the password or database secret values in documentation or source control.
- The API and public site were smoke-checked after deployment: `/health` reported PostgreSQL, and `/general-jobs` returned 139 titles.
- RDS and the Secrets Manager interface endpoint have ongoing AWS charges. The custom domain DNS was not changed as part of the API setup.

`amplify.yml` defines an Amplify build (`npm ci`, `npm run build`, publish `dist/`) if a repository connection is configured in the future. It is not what currently deploys this Amplify app.

The deployment steps in `docs/aws-setup.md` describe the original provisioning process. The stack and domain configuration above are already in place; use that file as a record of the setup inputs, not as an instruction to create a duplicate stack.

### Manual static-site deployment

Set the deployment URL while building so the generated `js/deployment-config.js` points at the hosted API:

```sh
PRMG_API_BASE_URL=https://kqf48x7cwc.execute-api.us-east-2.amazonaws.com AWS_BRANCH=staging npm run build
cd dist && zip -qr ../prmg-site.zip .
```

Upload the ZIP through CloudShell's file upload, then use Amplify's manual deployment flow (`create-deployment`, PUT the ZIP to the returned temporary upload URL, then `start-deployment`) for app `d1047s1zoy2x8i`, branch `staging`, region `us-east-1`. Treat the signed upload URL as temporary secret material. Verify the job succeeds and check `https://primermg.com/js/deployment-config.js` and the API `/health` route afterwards.

### API and database deployment files

- `infrastructure/rds-postgres.yaml` is the CloudFormation template for the AWS API/database stack.
- `aws-api/handler.mjs` is the hosted API Lambda handler.
- `aws-api/migrate.mjs` applies the PostgreSQL schema, seeds the general job list, configures the restricted app DB role, and inserts the initial admin if absent.
- `scripts/package-aws-api.mjs` and `npm run package:aws-api` package `dist/prmg-api.zip` for Lambda deployment.
- `docs/aws-setup.md` contains the stack's original provisioning parameters and service setup details.

## Complete legacy template inventory

Every file under `layouts/` is a **Legacy theme/demo page**. These pages are retained template material and are not the maintained public PRMG pages listed above:

| Legacy template | Original template purpose |
| --- | --- |
| `layouts/about.html` | Theme About page |
| `layouts/blog-grid.html` | Blog listing |
| `layouts/blog-post.html` | Blog article |
| `layouts/careers.html` | Theme careers page |
| `layouts/coming-soon.html` | Coming soon page |
| `layouts/history.html` | Company history |
| `layouts/in-the-news.html` | News listing |
| `layouts/our-team.html` | Team listing |
| `layouts/page-404.html` | Not-found page |
| `layouts/privacy.html` | Privacy page template |
| `layouts/project-single.html` | Single project detail |
| `layouts/projects-padding.html` | Project gallery |
| `layouts/search-results.html` | Search results |
| `layouts/services.html` | Services listing |
| `layouts/single-service.html` | Single service detail |
| `layouts/team-member.html` | Team member detail |

## Configuration and asset inventory

- `package.json` and `package-lock.json` define dependencies and the `start`, `build`, `admin:create`, and `package:aws-api` scripts.
- `amplify.yml` describes the future Git-connected Amplify build. `.cpanel.yml` is a **Legacy** cPanel deployment recipe.
- `contactstyles.css` and `loginstyle.css` are page-specific stylesheets retained for their corresponding legacy contact/login pages.
- `aws-api/package.json` lists the dependencies packaged with the hosted Lambda. `aws-api/certs/global-bundle.pem` supplies the PostgreSQL CA bundle.
- `images/` contains site logos, industry photos, backgrounds, icons, loaders, and older theme graphics. `fonts/` contains Font Awesome, Linearicons, Material Icons, Glyphicons, and theme font files. `video/` contains the theme's video background and its poster image.
- `_notes/` folders and `dwsync.xml` files are **Legacy editor synchronization metadata**; they are not used by the site.
- `readme.txt` is a **Legacy** root note. `README.md` and this guide are the maintained project documentation.
- `prmg-site.zip` may appear after a manual Amplify deployment. It is a generated deployment bundle and should not be committed.

## Other repository files

- `package.json` / `package-lock.json`: scripts and JavaScript dependencies.
- `server.mjs`: local static web server and `/api/*` routing.
- `scripts/resume-contact-algorithm.mjs`: reusable resume text extraction and field-mapping logic.
- `scripts/create-admin.mjs`: local admin creation utility.
- `.cpanel.yml`: older cPanel deployment recipe that builds and copies `dist/` to `public_html`.
- `.azure/`, `.vscode/`, and `_notes/`: deployment/editor/synchronization leftovers; not part of the site runtime.
- `readme.txt`: legacy root-level note; this `README.md` and guide are the maintained documentation.
- `prmg-site.zip`: generated manual-deployment artifact when present. It is not source and should not be committed.

