# TalentMatch

**Registered project title:** Intelligent CV Screening and Candidate Shortlisting Platform

**Application name:** TalentMatch

TalentMatch is a recruitment application for publishing vacancies, receiving CVs, and helping HR teams review applications through text extraction and rule-based keyword matching. The current screening does not use artificial intelligence or machine learning. Applicants can browse and apply without an account. HR users sign in to manage their company's jobs and applications.

Repository: [justinharshan7/TalentMatch](https://github.com/justinharshan7/TalentMatch)

## Implemented Features

- Public job browsing, search, company filtering, and sorting by newest, oldest, or title.
- Public job details and application submission, including a Continue as Guest link from HR Login.
- PDF and Word (`.docx`) CV uploads with accessible format guidance.
- Immediate CV text extraction, category scoring, and application status storage. Applicants receive a confirmation with the job title and company name; scores and status are omitted from the public success response.
- HR login using hashed passwords and JWT authentication.
- Company-scoped job creation and editing, including keyword requirements.
- HR application ranking, category breakdowns, and protected CV viewing or downloading.
- Individual application deletion with applicant-name confirmation, ownership checks, shared-CV protection, and list/count refresh.
- Job deletion with an application-count confirmation, CV/application cleanup, and retry handling for incomplete deletion.
- Job-level coordination between application submission, editing, and deletion within one Node.js server process.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, React Router 7, Axios, Tailwind CSS, Create React App |
| Backend | Node.js, Express 5, Mongoose 9, MongoDB |
| Authentication | JSON Web Tokens, bcryptjs |
| CV processing | Multer, pdf-parse 1.1.1, Mammoth |
| Tests | Node.js test runner, Jest and React Testing Library |

## Local Setup

Prerequisites: a recent Node.js release with npm and the built-in test runner, Git, and an accessible MongoDB database. No Node.js version is pinned in this repository. The backend tests use modern Node APIs; Node.js 24 was used for the recorded checks below.

Clone the repository and install dependencies separately for each application:

```sh
git clone https://github.com/justinharshan7/TalentMatch.git
cd TalentMatch/server
npm install
cd ../client
npm install
```

There is no root package script that starts both applications.

### Backend configuration

Create `server/.env` locally using your own values:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/talentmatch
JWT_SECRET=replace-with-your-own-long-random-secret
PORT=5000
```

These are example values and placeholders, not deployment credentials. `MONGO_URI` and `JWT_SECRET` must be configured; `PORT` defaults to `5000`. Do not commit `.env` files or secrets.

Ensure `server/uploads` exists and is writable before accepting applications. Multer uses this directory; the application does not create it automatically. From the repository root, this cross-platform command creates it if needed:

```sh
node -e "require('node:fs').mkdirSync('server/uploads', { recursive: true })"
```

Start the backend from `server` so dotenv loads `server/.env`:

```sh
cd server
npm start
```

The API runs at `http://localhost:5000/api` by default. `npm run dev` invokes `nodemon`, which is not declared in the backend dependencies; it requires a separately available installation. Use `npm start` for the documented setup.

### Frontend

In a separate terminal, from the repository root:

```sh
cd client
npm start
```

Open `http://localhost:3000`. The Axios base URL is currently fixed to `http://localhost:5000/api` in `client/src/services/api.js`; changing the backend port alone does not update it.

### Initial HR and company setup

There is no bundled seed command or HR registration page. HR login requires an existing user associated with a Company document. The backend exposes `POST /api/auth/register`, accepting `name`, `email`, `password`, and `companyId`; registration does not itself create or verify the Company. Company creation through `POST /api/companies` requires authentication. For a fresh database, provision a valid Company and associated HR user through an authorised database/API setup before using the dashboard. Applicants need no account.

## CV Storage and Extraction

- CV files are stored locally in `server/uploads` with UUID filenames and a lowercased extension. Application records store the corresponding path in MongoDB.
- The picker accepts `.pdf,.docx`; the backend also checks the filename extension. This is an extension check, not content-based validation, malware scanning, or a configured upload-size limit.
- PDF text is extracted with `pdf-parse`; DOCX text is extracted with Mammoth. There is no OCR pipeline for scanned/image-only PDFs.
- Files are served through an authenticated candidate CV endpoint that checks company ownership. The former public `/uploads` route is not exposed.
- Safe storage helpers restrict paths to the uploads directory and refuse unsafe paths, symlinks, and non-regular files.
- Individual deletion refuses CVs referenced by another application. A missing file can be treated as already cleaned. If file removal succeeds but record deletion cannot be confirmed, the response reports that partial outcome and requests refresh/retry.
- Job deletion can partially complete. The persisted `isDeleting` flag closes the job to applications and editing until cleanup is retried successfully.

MongoDB records and local files are separate resources. Preserve both when backing up or moving the application. Do not commit uploaded CVs or use real applicant data as test fixtures.

## Scoring

Scoring uses case-insensitive substring matching against the job's keyword arrays. Each matching keyword earns an equal share of its category's available points; category scores are rounded.

| Category | Maximum points |
| --- | ---: |
| Skills | 400 |
| Education | 200 |
| Experience | 200 |
| Certifications | 100 |
| Soft skills | 100 |
| **Total** | **1000** |

Empty categories contribute zero; points are not redistributed. Normal submission stores `shortlisted` when the total is at least `700`, and `rejected` otherwise. These are automated screening labels available to HR, not a hiring decision or an applicant-facing result. The schema also allows `pending` as its default, but the submission controller explicitly sets the calculated outcome.

Create/update validation requires at least one skill and trims/deduplicates category keywords. Editing a job's requirements does not rescore previously stored applications. Scores are calculated using explicit keyword rules, without AI models or machine learning.

## Tests and Build

Run backend tests from `server`:

```sh
node --test controllers/jobController.test.js controllers/jobDeletion.test.js controllers/candidateAccess.test.js controllers/candidateDeletion.test.js
```

The backend `npm test` script is still a placeholder that exits with an error. Use the explicit Node command above. Tests mock database operations and use disposable synthetic files; they do not require connecting to the application database.

Run all frontend tests once from `client`:

```sh
npm test -- --watchAll=false --runInBand
```

The existing `src/App.test.js` suite fails to load because Jest cannot resolve `react-router/dom`. Do not interpret the full frontend run as passing. To run the current page regression suites separately:

```sh
npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/HRLogin.test.jsx src/pages/Home.test.jsx src/pages/ManageJobs.test.jsx src/pages/HRDashboard.test.jsx src/pages/Apply.test.jsx
```

Build the frontend from `client`:

```sh
npm run build
```

Output is written to `client/build`. Check whitespace from the repository root:

```sh
git diff --check
```

On Windows PowerShell, use `npm.cmd` in place of `npm` if the local execution policy blocks `npm.ps1`.

The last recorded pre-documentation checks passed **223 backend tests**, **50 frontend tests across five page suites**, the frontend build, and the diff check. The full frontend run still had the router-resolution failure above. Dashboard tests also reported an existing React list-key warning. These are recorded results, not a guarantee for a different environment or a later revision.

## Future Improvements

- Resolve the App test's router compatibility issue and the dashboard list-key warning.
- Improve PDF extraction reliability: isolated checks have reproduced `bad XRef entry` with the current Buffer-based parser call, although retries can succeed. A typed-array conversion was investigated but has not been implemented.
- Add OCR support for scanned PDFs and improve scoring beyond substring matching.
- Add content-based file validation, upload-size limits, and malware scanning.
- Provide a documented first-run company/HR provisioning workflow and strengthen registration validation.
- Move API URLs into environment configuration and document production deployment.
- Add coordination across multiple server instances; the current job lock is process-local.
- Improve recovery and consistency between file cleanup and database deletion, plus storage/backup administration.
- Review legacy records and tracked sample uploads before production use; ignoring an uploads directory does not untrack files already in Git.
