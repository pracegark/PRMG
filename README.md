# Prime Resources Management Group site

For the full page inventory, legacy-page labels, application/API flow, database tables, local workflow, and current AWS deployment notes, see [the project guide](docs/project-guide.md).

## Run locally

1. Install the project dependencies with `npm install`.
2. Start the local site with `npm start`.
3. Open `http://localhost:3000/`.

## Create an administrator account

Open a second terminal in the project folder and run `npm run admin:create`. The command asks for a username and a password (the password is hidden while typing). Use a password with at least 12 characters. The account is stored in the local SQLite database at `data/prmg.sqlite`; the password is stored as a salted hash.

Open `http://localhost:3000/job-admin.html` for the administrator dashboard. The dashboard stays locked until an administrator signs in. It can publish jobs, hide or restore listings, and download applicant CSV files, optionally filtered by date added. `job-board.html` redirects to the dashboard for older bookmarks. Job listings remain public on `job-page.html`.

The `users` table has `userid`, `username`, `userpassword`, and `testCredentials` fields. `testCredentials` is stored as SQLite integer `0` or `1` (SQLite's boolean representation); administrator accounts created by the setup command default to `0`. Jobs have an `is_visible` flag; new and existing listings default to visible. Contacts record first name, last name, email, phone, application type, and `dateAdded`; checklist answers are also stored in the contact payload and normalized trade selections link to the contact in `candidate_trades`. Resume applicants have a `resume_id` attached to their contact record. Applicant CSV exports omit contact/job/resume IDs and filenames, and format the application payload as readable labeled details. Existing contacts keep their original creation timestamp.
