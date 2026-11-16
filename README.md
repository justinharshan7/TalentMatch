# TalentMatch

**Project title:** Intelligent CV Screening and Candidate Shortlisting Platform

**Application name:** TalentMatch

TalentMatch is a recruitment application for publishing vacancies, receiving CVs, and helping HR teams review applications through text extraction and rule-based keyword matching. The current screening does not use artificial intelligence or machine learning. Applicants can browse and apply without an account. HR users sign in to manage their company's jobs and applications.

QA repository: [HQ-SideQuest/TalentMatch-QA](https://github.com/HQ-SideQuest/TalentMatch-QA)

The repository and clone folder are named **TalentMatch-QA** to distinguish this module's QA work. The application itself remains **TalentMatch**.

## Implemented Features

- Public job browsing, search, company filtering, and sorting by newest, oldest, or title.
- Public job details and application submission, including a Continue as Guest link from HR Login.
- PDF and Word (`.docx`) CV uploads with accessible format guidance.
- Immediate CV text extraction, category scoring, and application status storage. Applicants receive a confirmation with the job title and company name; scores and status are omitted from the public success response.
- HR registration that creates a new company and its first HR account, plus login using hashed passwords and JWT authentication.
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

### Quick setup for the QA team

Install Git, Node.js (20.19 or newer; Node.js 24 is recommended), and MongoDB Community Server. Start the local MongoDB service, then run:

```sh
git clone https://github.com/HQ-SideQuest/TalentMatch-QA.git
cd TalentMatch-QA
node setup-local.cjs
node start-local.cjs
```

Open `http://localhost:3000`. Keep the start terminal open; Ctrl+C stops both servers. The setup script installs both sets of dependencies, creates missing local settings with a random signing secret, creates the uploads directory, and adds fictional HeroVerse demo data. It does not overwrite existing settings. Each teammate has their own separate `talentmatch_qa` database on their computer.

The default QA backend port is `5001`; the frontend uses `3000`. If either port is already occupied, stop the existing app first. For a different backend port, update `PORT` in `server/.env` and `REACT_APP_API_URL` in `client/.env.local` together, then restart.

| Demo HR name | Email | Password |
| --- | --- | --- |
| Batman | batman@heroverse.test | HeroVerseDemo!2026 |
| Spider-Man | spiderman@heroverse.test | HeroVerseDemo!2026 |

Both accounts manage the fictional company **HeroVerse**. Sample jobs are Frontend Developer, Backend Developer and QA Analyst. Fictional applications from Iron Man, Wonder Woman, Thor and Hulk include sample CVs and a mix of shortlisted/rejected scores. These publicly documented credentials are for local demonstrations only. No real company, CV or applicant information is included.

To add missing demo records again without reinstalling dependencies:

```sh
cd server
npm run seed:demo
```

The seed command only accepts the local `talentmatch_qa` database. It inserts missing demo records and recreates missing original demo CV files; it does not reset passwords or overwrite edited records/files. Deleted demo records are recreated on the next run. An ID, email or company-name collision stops the command rather than taking over existing data. Previously completed inserts remain if a later step fails; correct the issue and rerun. Do not commit local settings or uploads.

### Manual setup

Prerequisites: a recent Node.js release with npm and the built-in test runner, Git, and an accessible MongoDB database. No Node.js version is pinned in this repository. The backend tests use modern Node APIs; Node.js 24 was used for the recorded checks below.

Clone the repository and install dependencies separately for each application:

```sh
git clone https://github.com/HQ-SideQuest/TalentMatch-QA.git
cd TalentMatch-QA/server
npm install
cd ../client
npm install
```

Alternatively, `node start-local.cjs` starts both configured applications after the quick setup above.

### Backend configuration

Create `server/.env` locally using your own values:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/talentmatch_qa
JWT_SECRET=replace-with-your-own-long-random-secret
PORT=5001
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

Create `client/.env.local` with `REACT_APP_API_URL=http://localhost:5001/api` for the manual QA setup. Open `http://localhost:3000`. The frontend reads `REACT_APP_API_URL` and otherwise defaults to `http://localhost:5000/api`. Restart the frontend after changing its environment file.

### Initial HR and company setup

Open HR Login and choose **Create an HR account**, or visit `http://localhost:3000/hr-register`. Enter your name, email, password and confirmation, company name, and company description. Registration creates a new Company and its first HR user. After the confirmation, sign in through the existing HR Login page. Applicants need no account.

`POST /api/auth/register` accepts `name`, `email`, `password`, `companyName`, and `companyDescription`. Email addresses are stored in lowercase; passwords require at least 8 characters and at most 72 UTF-8 bytes. Names have a 100-character limit, email a 254-character limit, and company description a 2,000-character limit. Duplicate emails/company names are rejected. A supplied `companyId` is rejected: public signup cannot join an existing company. Inviting additional HR users is not implemented. This is self-service signup; it does not verify email ownership or a company's legal identity.

Registration prepares the password hash and token before creating records. If HR creation fails, it checks whether the user was actually persisted before cleaning up the newly created company. These checks support standalone MongoDB without transactions, but do not provide crash-atomic creation across both documents. If the outcome cannot be confirmed, the response asks the user to try signing in and contact support before registering again.

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
node --test controllers/authController.test.js controllers/jobController.test.js controllers/jobDeletion.test.js controllers/candidateAccess.test.js controllers/candidateDeletion.test.js
```

You can also run `npm test` from `server`. Tests mock database operations and use disposable synthetic files; they do not require connecting to the application database.

Run all frontend tests once from `client`:

```sh
npm test -- --watchAll=false --runInBand
```

The Jest configuration maps React Router's DOM entry point for the bundled Jest version, and test setup supplies the Node text encoder/decoder APIs. App-level tests exercise the real home, login and registration routes. To run the page suites separately:

```sh
npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/HRLogin.test.jsx src/pages/HRRegister.test.jsx src/pages/Home.test.jsx src/pages/ManageJobs.test.jsx src/pages/HRDashboard.test.jsx src/pages/Apply.test.jsx
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

Final local verification on 17 November 2026 passed **249 backend tests**, **62 frontend tests across seven suites**, the production frontend build, and the whitespace check. These are results for this revision and local environment, not a guarantee that every possible defect has been found. Demo verification also checks both HeroVerse logins, candidate ranking, protected CV access and an idempotent second seed run. Company registration was checked against the local QA database, including linked HR creation, login, duplicate/blank input rejection and company isolation.

## Future Improvements

- Improve PDF extraction reliability: isolated checks have reproduced `bad XRef entry` with the current Buffer-based parser call, although retries can succeed. A typed-array conversion was investigated but has not been implemented.
- Add OCR support for scanned PDFs and improve scoring beyond substring matching.
- Add content-based file validation, upload-size limits, and malware scanning.
- Add invitation/approval for additional HR users and email verification before public deployment.
- Document production deployment separately from the local QA setup.
- Add coordination across multiple server instances; the current job lock is process-local.
- Improve recovery and consistency between file cleanup and database deletion, plus storage/backup administration.
- Review legacy records and tracked sample uploads before production use; ignoring an uploads directory does not untrack files already in Git.
