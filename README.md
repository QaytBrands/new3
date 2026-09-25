# Wortweg — German vocabulary learning platform

Students learn German vocabulary level by level (A1, A2, …), chapter by chapter and day by day, with sentence practice, pronunciation practice, daily and weekly tests, and progress tracking. Admins and permission-scoped staff manage the curriculum and control what each student can access.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), TypeScript, Tailwind CSS v4
- **PostgreSQL** via **Prisma 6**: Neon Postgres in production
- **Neon Auth** (`@neondatabase/auth`, pinned `0.5.0-beta`) for identity. Roles, permissions and access stay in the app database (see [Authentication](#authentication)).
- **Vercel Blob** (private store) for student recordings
- Vitest (unit and integration), Playwright (e2e)

## Getting started

```bash
cp .env.example .env            # local Postgres + the local Neon Auth stand-in (defaults work as-is)
npm install
npx prisma migrate dev          # create schema
npm run auth:dev                # terminal 1: local Neon Auth stand-in; links the seed admin/demo accounts to it
npm run db:seed                 # sample A1 curriculum (+ admin, + optional demo student)
npm run dev -- -p 3100          # terminal 2: the app (APP_ORIGIN in .env is http://localhost:3100)
```

Students sign in at `/login`; admin and staff sign in at `/admin/login`, by username (or email).

To develop against real Neon Auth instead, point `NEON_AUTH_BASE_URL` at a Neon **development branch**'s Auth URL and set its provisioner credentials (see [Deploying](#deploying-vercel--neon)). The local stand-in (`tests/support/neon-auth-emulator.mts`) runs Better Auth, the library Neon Auth is built on, using the exact copy the SDK depends on. Its users live in memory, so restart `npm run auth:dev` to reset them.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc` |
| `npm test` | Unit tests. No database needed. Covers permissions, access, question generation, grading, SRS, time zones, audio, pronunciation contract and CSV import. |
| `npm run test:integration` | DB-backed tests: authorization boundaries, authentication through the real Neon Auth SDK (against the local stand-in, started automatically), time-zone calculations. Needs `DATABASE_URL` pointing at a migrated **non-production** database. |
| `npm run test:e2e` | Playwright against `next start` and the local Neon Auth stand-in (both started automatically). Covers the learning flow, sign-in portals, sessions, direct-URL/API bypass attempts and phone layout. Run `npm run build` first. Set `PW_CHROMIUM_PATH` to use a preinstalled Chromium. |
| `npm run auth:dev` | Local Neon Auth stand-in for development (port 4100). |
| `npm run db:deploy` | Apply migrations in production |

## Configuration

All variables are listed in `.env.example`. Never commit a real `.env`; `.env` is git-ignored. **No variable is exposed to the browser**: there are no `NEXT_PUBLIC_*` variables, and every value below is read only on the server.

| Variable | Purpose | Required | Secret/Public | Vercel environment |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Prisma runtime connection. Neon **pooled** URL (`…-pooler…`, `sslmode=require`). | Yes | **Secret** | Production (and Preview, pointing at a Neon branch) |
| `DIRECT_URL` | Prisma migrations (`prisma migrate deploy` in `vercel-build`). Neon **direct** URL. | Yes | **Secret** | Production, Preview |
| `NEON_AUTH_BASE_URL` | Neon Auth URL of the branch (Neon Console → Auth → Configuration). *Defined by Neon Auth.* | Yes | Not secret (server-only) | Production, Preview (the matching branch's Auth URL) |
| `NEON_AUTH_COOKIE_SECRET` | Signs the cached `session_data` cookie; ≥32 characters (`openssl rand -base64 32`). *Defined by Neon Auth.* | Yes | **Secret** | Production, Preview (different values) |
| `AUTH_PROVISIONER_EMAIL` | Neon Auth service account with the Neon Auth **admin** role. Used server-side to create accounts, set passwords and ban/unban. *App-defined.* | Yes | Not secret (server-only) | Production, Preview |
| `AUTH_PROVISIONER_PASSWORD` | Password of that service account. *App-defined.* | Yes | **Secret** | Production, Preview |
| `APP_ORIGIN` | Public origin of the app, e.g. `https://wortweg.example.org`. Sent as `Origin` on server-to-Neon-Auth calls; must be a Neon Auth **trusted domain**. Falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL`. *App-defined.* | Recommended | Public | Production, Preview |
| `STORAGE_PROVIDER` | `vercel-blob` in production, `local` in development. | Yes | Public | Production, Preview |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token. Injected automatically when the Blob store is connected to the project. | With `vercel-blob` | **Secret** | Production, Preview (automatic) |
| `PRONUNCIATION_ENGINE` | `browser-transcript` (default) or `none`. | No | Public | Any |
| `SEED_ADMIN_EMAIL` | First admin's sign-in email. | Seed only | Not secret | **Not stored in Vercel.** Set in the shell running the seed. |
| `SEED_ADMIN_PASSWORD` | First admin's initial password, used once by `npm run db:seed`. | Seed only | **Secret** | **Not stored in Vercel.** Change the password after first sign-in. |
| `SEED_ADMIN_USERNAME` | First admin's username (default `admin`). | No | Not secret | Not stored in Vercel |
| `SEED_DEMO_STUDENT_PASSWORD` / `SEED_DEMO_STUDENT_EMAIL` | Creates a `demo` student. **Development only**: the seed refuses to run if this is set with `NODE_ENV` or `VERCEL_ENV` = `production`. | No | Secret | **Never in production** |
| `LOCAL_UPLOAD_DIR` | Local recording directory (default `.data/uploads`, never served). | No | Public | Development only |
| `NEON_AUTH_EMULATOR_*`, `PW_CHROMIUM_PATH` | Test tooling. | No | Public | Development/CI only |

Removed in this release: `AUTH_SECRET` and `AUTH_TRUST_HOST` (Auth.js). Delete them from any existing Vercel project.

### Vercel Blob (student recordings)

1. In Vercel, go to **Storage → Create → Blob** and create the store with **private** access. Connect it to the project for the Production (and Preview) environments. This injects `BLOB_READ_WRITE_TOKEN`.
2. Set `STORAGE_PROVIDER=vercel-blob`.

Recordings are uploaded with `access: "private"` and are never exposed by URL. The database stores only the blob pathname (`PronunciationAttempt.audioKey`). Audio is streamed through `/api/recordings/[id]/audio`, which checks that the viewer is the student who recorded it, an admin, or staff with `VIEW_PROGRESS`.

## Authentication

**Neon Auth answers "who is this?". The application database answers everything else.**

```
browser ──(__Secure-neon-auth.* cookies)──▶ proxy.ts ── session present? (refreshes cookies)
                                             │
                     page / server action / API route
                                             │  getIdentity()  → Neon Auth user id  (@neondatabase/auth)
                                             │  getCurrentUser() → User WHERE neon_auth_user_id = id
                                             ▼
                role · active · permissions · unlocks · progress · tests · recordings  (Prisma / Neon Postgres)
```

- **Identity mapping.** `User.neonAuthUserId` (`neon_auth_user_id`, unique) stores the stable Neon Auth user id. It is the only key used to map a session to an application user; email is never used for that at runtime. An identity with no linked user gets nothing, and a linked but deactivated user gets nothing.
- **Separate logins.**
  - `/login` accepts only `STUDENT` accounts; `/admin/login` accepts only `ADMIN` and `STAFF`.
  - The app resolves the username (or email) in its own database and checks the portal's role, active status and identity link *before* asking Neon Auth to verify the password. A wrong-portal attempt therefore never produces a session.
  - After Neon Auth succeeds, the returned identity must equal the linked id; otherwise the new session is discarded.
  - Even with a valid session, every page and action re-checks the role, so a staff session can't use student pages and vice versa.
- **Accounts are provisioned by the app.**
  - Admins, and staff holding `CREATE_STUDENTS` or `EDIT_STUDENTS`, create and edit accounts in the admin UI. The app checks those permissions first.
  - The app then calls the Neon Auth admin API as a dedicated **service account** (`AUTH_PROVISIONER_*`) that holds Neon Auth's `admin` role. No person is given that role.
  - **Creating an account** creates the Neon Auth identity first, then the linked user; the identity is rolled back if the database write fails.
  - **Setting a password** changes it in Neon Auth and revokes that identity's sessions.
  - **Deactivating** is saved in the app first, which blocks access immediately; then the identity is banned and its sessions revoked.
  - **Deleting a student** removes the identity.
- **Sessions.** Neon Auth cookies are `__Secure-` prefixed, HttpOnly and SameSite=Lax. The SDK caches a signed session snapshot for 60 s (`SESSION_DATA_TTL_SECONDS`). Revocations therefore take effect within 60 s at the Neon Auth level; app-level deactivation and permission changes apply on the next request.
- **Not exposed.** No `/api/auth/*` proxy is mounted, because the app doesn't use the client SDK. Neon Auth's admin endpoints are therefore not reachable through this app's domain.
- **Passwords** live only in Neon Auth. `User.passwordHash` (Auth.js bcrypt) is kept for rollback but no longer written or read.

### Migrating existing users from Auth.js

Auth.js bcrypt hashes can't be imported into Neon Auth, so existing passwords do not carry over.

1. **Deploy the migration.** The `20260925210800_neon_auth_identity` migration adds `neon_auth_user_id` and lowercases and uniquely indexes `email`. Before deploying, this query must return no rows:
   ```sql
   SELECT lower(email), count(*) FROM "User" WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
   ```
2. **Link the first admin.** `npm run db:seed` with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` links the existing `admin` user (matched by username) to a new identity. No duplicate user is created.
3. **Re-invite everyone else.** Unlinked users show **"cannot sign in yet"** in the admin UI. Open the user, enter their email if missing, and set a new password; this creates and links their identity. Then give the student or staff member the new password.
4. **Adopting an existing identity.** If an identity with that email already exists in Neon Auth, the seed adopts it only after resetting its password and revoking its sessions. The admin UI refuses and asks you to resolve it in the Neon Console.

## Deploying (Vercel + Neon)

Do these in order. Nothing is deployed automatically.

> **Keep production values out of the repository and out of auto-loaded files.** For commands you run from your machine (migrations, seed), put them in a git-ignored `.env.neon` and load it explicitly: `set -a; . ./.env.neon; set +a`. Don't use `.env.production.local`: `next build` / `next start` load it automatically, so the local test suite would run against the production database. `.gitignore` ignores every `.env*` file except `.env.example`.

**1. Neon Postgres**
1. In your Neon project, pick the production branch. Under **Connect**, copy the **pooled** connection string (host contains `-pooler`) for `DATABASE_URL`. For `DIRECT_URL`, use the same string with `-pooler` removed from the host. Keep `sslmode=require` (and `channel_binding=require` if Neon includes it; Prisma accepts it).
2. Optionally create a `preview` branch for Vercel Preview deployments.

**2. Neon Auth**
1. In the Neon Console, open **Auth** for the same branch and enable it. Copy the Auth URL into `NEON_AUTH_BASE_URL`.
2. Enable **email + password** sign-in. Allowing sign-in with unverified email is recommended, because accounts are created by admins, not self-registered. If you require verification, you also need email delivery configured in Neon Auth.
3. Disable public **sign-up** if the console offers it. The app never uses self sign-up, and identities that aren't linked to an app user get no access anyway.
4. Add your app's domains (for example `https://wortweg.example.org` and your `*.vercel.app` production domain) as **trusted domains**. `APP_ORIGIN` must be one of them.
5. Create the provisioning service account: add a user such as `provisioner@your-domain` with a long random password, and give it the **admin** role (Auth → Users → role). Put these in `AUTH_PROVISIONER_EMAIL` and `AUTH_PROVISIONER_PASSWORD`. Don't use this account for anything else.
6. Generate `NEON_AUTH_COOKIE_SECRET` with `openssl rand -base64 32`.

**3. Vercel**
1. Import the GitHub repository. Framework: Next.js. The build command comes from `package.json` (`vercel-build`: Prisma generate → `prisma migrate deploy` → `next build`).
2. Under **Settings → Environment Variables**, add for **Production**: `DATABASE_URL`, `DIRECT_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `AUTH_PROVISIONER_EMAIL`, `AUTH_PROVISIONER_PASSWORD`, `APP_ORIGIN`, `STORAGE_PROVIDER=vercel-blob`.
3. For **Preview**, use the preview branch's values, or leave them unset to disable previews. Do **not** add `SEED_*`, `AUTH_SECRET` or `AUTH_TRUST_HOST`.

**4. Vercel Blob**
1. Go to **Storage → Create → Blob** and create the store with **Private** access.
2. **Connect** it to the project for Production (and Preview). `BLOB_READ_WRITE_TOKEN` is injected automatically; never expose it or prefix it with `NEXT_PUBLIC_`.

**5. Prisma migration**
- Migrations run automatically in `vercel-build` via `prisma migrate deploy`, using `DIRECT_URL`.
- To run them yourself first, from a trusted machine: `DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy`.
- Order: `…_init` → `…_timezones_native_audio_private_recordings` → `…_audit_log_login_throttle_index` → `…_neon_auth_identity`. All are additive or renames; none drop data.

**6. Initial admin**
From a trusted machine, once, run:
```bash
DATABASE_URL=… DIRECT_URL=… NEON_AUTH_BASE_URL=… NEON_AUTH_COOKIE_SECRET=… \
AUTH_PROVISIONER_EMAIL=… AUTH_PROVISIONER_PASSWORD=… APP_ORIGIN=https://your-domain \
SEED_ADMIN_EMAIL=you@your-domain SEED_ADMIN_PASSWORD='a-strong-temporary-password' \
npm run db:seed
```
- This creates the sample curriculum and the `admin` user, linked to a new Neon Auth identity.
- Leave `SEED_DEMO_STUDENT_PASSWORD` unset; the seed refuses it in production.
- Don't store `SEED_*` in Vercel.
- Running the seed again is safe: it never resets an existing, linked admin's password.

**7. First login**
1. Open `https://your-domain/admin/login` and sign in with username `admin` (or the admin email) and the seed password.
2. Under **My account**, change the password immediately (the seed password was a one-time secret) and set your time zone.
3. Create staff (with explicit permissions) and students, and unlock their first chapter.
4. Confirm a student can sign in at `/login` and **cannot** sign in at `/admin/login`.

## Architecture

```
src/
  app/(student)/…        student UI: dashboard, levels, chapters, lessons (learn / sentences / pronounce), tests, attempts, words, progress
  app/admin/(panel)/…    admin UI: dashboard, students, staff, curriculum, vocabulary + import, tests, results, pronunciation, settings
  app/api/recordings     pronunciation upload → server/pronunciation-service (storage + engine)
  app/api/recordings/[id]/audio  authorised streaming of private recordings
  lib/permissions.ts     deny-by-default permission checks (admin = all, staff = only granted, student = none)
  lib/access.ts          unlock resolution: level ⊇ chapter ⊇ lesson
  proxy.ts               first gate: Neon Auth session present? (per-area login URL; refreshes cookies)
  lib/auth/neon-server.ts  request-scoped Neon Auth client; getIdentity()
  lib/auth/guards.ts     identity → app user (neon_auth_user_id); role/permission guards, re-read from DB every request
  lib/auth/login.ts      portal sign-in (role checked before Neon Auth), throttle
  lib/auth/provisioning.ts  Neon Auth admin API via the service account (create / password / ban / remove)
  lib/tests/             pure question generation (7 types) and grading
  lib/srs/               review scheduling (SM-2-compatible fields; simplified v1 scheduler)
  lib/progression.ts     optional auto-unlock hooks (daily test → next day, weekly test → next chapter)
  lib/pronunciation/     PronunciationEngine contract, capability enforcement, engines
  lib/storage/           private StorageProvider (local disk for dev, private Vercel Blob for prod)
  lib/time.ts            time-zone helpers (local day ranges, DST-safe)
  lib/audio.ts           native-audio-first source resolution
  lib/recording-access.ts  who may listen to a recording
  server/                data loaders and server actions (every action re-checks authorization)
prisma/schema.prisma     data model
```

### Key design decisions

- **Access is explicit.** A student sees only content with an `Unlock` row: a level unlock grants the whole level, a chapter unlock grants its days, a lesson unlock grants one day. Auto-progression is off by default and toggled in **Settings**.
- **Staff permissions are an explicit list** on the user. Middleware only gates the area; each page and server action checks the specific permission against the DB. Deleting students, resetting progress, staff management, settings and the global pronunciation log are admin-only.
- **Tests are graded on the server.** Starting an attempt snapshots the generated questions; correct answers are never sent to the browser. Time limits are enforced server-side (20 s grace). Every attempt and answer is stored, and each graded answer updates the word's `VocabularyProgress`.
- **Daily tests** cover the lesson's words. **Weekly tests** are per chapter and cover the days of that chapter the student has completed.
- **Pronunciation** and **audio**: see the dedicated sections below.
- **Words per lesson** are configured per level (`wordsPerLesson`, default 15) and enforced when adding words and importing.
- **Spaced-repetition ready:** `VocabularyProgress` stores times seen, correct and incorrect, last and next review, mastery, the difficult flag, and SM-2 state (`easeFactor`, `intervalDays`, `repetitions`).

### Time zones

All timestamps are stored as UTC instants. Anything described as a *day* is computed in a specific user's IANA time zone, using the helpers in `src/lib/time.ts` (DST-safe, via `Intl`).

- Every `User` has a `timezone` column, default **`Asia/Kolkata`**. The migration applies it to existing and sample accounts. Admins set a student's zone when creating or editing them; admin and staff users set their own under **My account**.
- **Whose zone is used:**
  - **Student data** uses the student's zone: the dashboard "Today" line (lessons completed, tests taken, reviews due today), "due for review", and review scheduling. A correct answer schedules the next review for **local midnight** N days later, so a word becomes due at the start of the student's day. A wrong answer is due immediately.
  - **Dates shown to a viewer** use the viewer's zone. For example, attempt dates on a student's screen use the student's zone, and on an admin's screen the admin's. The exception is the admin's "next review" column for a student, which uses the student's zone because it is the student's schedule.
  - **Admin dashboard** "today" metrics (lessons completed today, tests today) and the 7-day pronunciation chart use the **viewing admin's** zone. Rolling windows (active in the last 7 days, failures in the last 14 days, average over 30 days) don't depend on a zone.
- **Daily and weekly tests:** a daily test belongs to a lesson/day of the curriculum, and a weekly test belongs to a chapter. Neither is tied to a calendar date, so zones only affect how their completion times are reported and counted ("today").
- Invalid or missing zones fall back to `Asia/Kolkata` when rendering. Writes validate the zone.

### Audio

Each vocabulary item and example sentence has a `nativeAudioUrl` column (`native_audio_url`). `resolveAudioSource()` in `src/lib/audio.ts` decides what plays:

1. If a native recording URL is set, it is played and labelled **"Native recording"**.
2. Otherwise, or if the recording fails to load, the browser's German speech synthesis is used and labelled **"Synthesized voice"**.

Native audio URLs must be `https://` or site-relative (`/…`). You can set them in the admin word/sentence forms or with the `native_audio_url` CSV column; the old `audio_url` header is still accepted.

### Pronunciation

Pronunciation analysis sits behind `PronunciationEngine` (`src/lib/pronunciation/`).

- **Input:** expected text, locale, raw audio bytes, and an optional browser transcript.
- **`PronunciationResult`:** `transcription`, `transcriptMatches` (a text comparison, **not** a score), `overallScore`, `phonemes[]` (per-phoneme feedback) and `issues[]` (detected pronunciation problems).
- **Capabilities:** each engine declares what it supports: `transcription`, `scoring`, `phonemeFeedback` and `issueDetection`. `analyzePronunciation()` enforces this, so an engine that doesn't declare `scoring` can never surface a score, even by mistake.
- **This release:** `browser-transcript` records audio, uses the browser's Web Speech API (`de-DE`) for a transcript, and shows what was heard. **No score is ever generated.**
- **Adding a scoring provider:** implement the interface with the real capabilities, register it in `src/lib/pronunciation/index.ts`, and set `PRONUNCIATION_ENGINE`. `score` and `feedback` on `PronunciationAttempt` are already persisted, and the recorder UI already renders score and issues when present.
- **Service layer:** `src/server/pronunciation-service.ts` handles access checks, private storage, engine calls and persistence. The API route is a thin wrapper around it.

### Security model

- **Neon Auth for identity, the app for authorization.** See [Authentication](#authentication). A student can't use the staff login and staff can't use the student login; the role is also re-checked on every request.
- **Fresh checks on every request.** Each request reloads the user from the DB, so deactivation, role changes and permission changes apply immediately.
- **Login throttling.** Failed sign-ins are recorded in `AuditLog`, and 10 failures in 15 minutes lock that username for the rest of the window. Because it is stored in the DB, the throttle works across serverless instances.
- **`proxy.ts` is only a first gate.** Every page calls a server guard (`requireStudent`, `requireStaff`, `requirePagePermission`, `requirePageAdmin`). Every server action and API route re-checks authorization itself (`assertStudent`, `assertPermission`, `assertAdmin`). Hiding UI is never the control.
- **Server actions are public endpoints.** Every export of a `"use server"` file is callable, so each one starts with an authorization check and validates its arguments. Helpers stay unexported.
- **Student data is always scoped.** Queries filter by the signed-in student's id, and content access requires an `Unlock` on a **published** level. Another student's attempt, lesson, test or recording returns 404.
- **Staff get only what they are granted.** Permissions are checked against the DB. Staff can't edit their own permissions or other staff, and `EDIT_STUDENTS` only applies to student accounts. Deleting students, resetting progress, staff management, settings and the global pronunciation log are admin-only.
- **Security headers:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS, a `Permissions-Policy` limiting the microphone to this origin, and no `X-Powered-By`.
- **Test coverage:** `tests/integration/authorization.test.ts`, `tests/integration/authentication.test.ts`, `tests/e2e/security.spec.ts` and `tests/e2e/auth.spec.ts` exercise these boundaries directly.

### CSV import

Admin → *Import vocabulary*. Columns: `level,chapter,day,german,english,article,plural,part_of_speech,ipa,phonetic,native_audio_url,example_de,example_en,difficulty,tags` (template at `/vocabulary-template.csv`). Every row is validated in a preview first; the import is all-or-nothing and skips duplicates.

## Assumptions and known limitations

- "Weekly test" is per chapter (a chapter is roughly a week of days).
- Web Speech recognition isn't available in Firefox; recording still works there, but without a transcript.
- The seed data ships no native audio. Words use the labelled synthesized voice until a `nativeAudioUrl` is set.
- `@neondatabase/auth` is a **beta** SDK (pinned to exactly `0.5.0-beta`). Upgrade deliberately and re-run the full test suite.
- Automated tests use a local Better Auth server in place of hosted Neon Auth. The deployment checklist above ends with a manual check against real Neon Auth.
- Admin analytics are computed in-process and suit hundreds to low thousands of students; move them to SQL aggregates or materialized views before scaling past that.

## Branches

- `main` starts from an empty initial commit.
- `main` exists but GitHub's default branch has not been changed; switch it in repository settings when ready.
- `claude/modest-feynman-kymdn9` holds the implementation. It has `main` merged in, so it shares history with `main` and can be reviewed and merged with a normal pull request. No history was rewritten.
