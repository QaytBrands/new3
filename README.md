# Wortweg — German vocabulary learning platform

Students learn German vocabulary level by level (A1, A2, …), chapter by chapter and day by day, with sentence practice, pronunciation practice, daily and weekly tests, and progress tracking. Admins and permission-scoped staff manage the curriculum and control what each student can access.

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions), TypeScript, Tailwind CSS v4
- **PostgreSQL** via **Prisma 6** (Neon in production)
- **Auth.js v5** credentials: two providers, `student` (`/login`) and `staff` (`/admin/login`). Each provider rejects accounts of the other kind.
- Vitest (unit), Playwright (e2e)

## Getting started

```bash
cp .env.example .env            # set DATABASE_URL, AUTH_SECRET, SEED_ADMIN_PASSWORD
npm install
npx prisma migrate dev          # create schema
npm run db:seed                 # admin account + sample A1 curriculum (+ optional demo student)
npm run dev
```

Students sign in at `/login`; admin and staff sign in at `/admin/login`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc` |
| `npm test` | Unit tests. No database needed. Covers permissions, access, question generation, grading, SRS, time zones, audio, pronunciation contract and CSV import. |
| `npm run test:integration` | DB-backed tests for authorization boundaries, time-zone "today" calculations and the login throttle. Needs `DATABASE_URL` pointing at a migrated **non-production** database. |
| `npm run test:e2e` | Playwright against `next start`, covering the learning flow, direct-URL/API bypass attempts and phone layout. Run `npm run build` first. Set `PW_CHROMIUM_PATH` to use a preinstalled Chromium. |
| `npm run db:deploy` | Apply migrations in production |

## Configuration

All variables are listed in `.env.example`. Never commit a real `.env`; `.env` is git-ignored.

| Variable | Dev | Prod | Secret | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | required | required | **yes** (contains the DB password) | Dev: local Postgres. Prod: Neon **pooled** connection string. |
| `DIRECT_URL` | required | required | **yes** | Dev: same as `DATABASE_URL`. Prod: Neon **direct** (non-pooled) string, used by `prisma migrate`. |
| `AUTH_SECRET` | required | required | **yes** | Signs session cookies. `openssl rand -base64 32`, with a different value per environment. Rotating it signs everyone out. |
| `AUTH_TRUST_HOST` | `true` for `next start` | not needed on Vercel | no | Needed only when self-hosting behind a proxy. |
| `SEED_ADMIN_USERNAME` | optional | seed only | no | Defaults to `admin`. |
| `SEED_ADMIN_PASSWORD` | required for seeding | seed only | **yes** | Used once by `npm run db:seed` to create the first admin. Pass it in the shell running the seed; don't store it in Vercel. Change the password after first sign-in. |
| `SEED_DEMO_STUDENT_PASSWORD` | optional | **leave empty** | yes | Creates a `demo` student. Development only. |
| `STORAGE_PROVIDER` | `local` | `vercel-blob` | no | Where student recordings are stored (see below). |
| `LOCAL_UPLOAD_DIR` | optional | unused | no | Local recording directory (default `.data/uploads`). It is never served publicly. |
| `BLOB_READ_WRITE_TOKEN` | optional | required with `vercel-blob` | **yes** | Injected automatically when a Blob store is connected to the Vercel project. |
| `PRONUNCIATION_ENGINE` | optional | optional | no | `browser-transcript` (default) or `none`. |

### Vercel Blob (student recordings)

1. In Vercel, go to **Storage → Create → Blob** and create the store with **private** access. Connect it to the project for the Production (and Preview) environments. This injects `BLOB_READ_WRITE_TOKEN`.
2. Set `STORAGE_PROVIDER=vercel-blob`.

Recordings are uploaded with `access: "private"` and are never exposed by URL. The database stores only the blob pathname (`PronunciationAttempt.audioKey`). Audio is streamed through `/api/recordings/[id]/audio`, which checks that the viewer is the student who recorded it, an admin, or staff with `VIEW_PROGRESS`.

## Deploying (Vercel + Neon)

1. Create a Neon project. Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in Vercel.
2. Set `AUTH_SECRET`. Create and connect a private Blob store, and set `STORAGE_PROVIDER=vercel-blob`.
3. Vercel runs `npm run vercel-build`, which generates the Prisma client, runs `prisma migrate deploy` and builds.
4. Seed the first admin once, from a trusted machine:
   `DATABASE_URL=… DIRECT_URL=… SEED_ADMIN_PASSWORD=… npm run db:seed`. Leave `SEED_DEMO_STUDENT_PASSWORD` unset.
5. Sign in at `/admin/login`, change the admin password, set your time zone under **My account**, and create staff and students.

## Architecture

```
src/
  app/(student)/…        student UI: dashboard, levels, chapters, lessons (learn / sentences / pronounce), tests, attempts, words, progress
  app/admin/(panel)/…    admin UI: dashboard, students, staff, curriculum, vocabulary + import, tests, results, pronunciation, settings
  app/api/recordings     pronunciation upload → server/pronunciation-service (storage + engine)
  app/api/recordings/[id]/audio  authorised streaming of private recordings
  lib/permissions.ts     deny-by-default permission checks (admin = all, staff = only granted, student = none)
  lib/access.ts          unlock resolution: level ⊇ chapter ⊇ lesson
  lib/auth/              Auth.js config, providers, server guards (re-read user from DB on every request)
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

- **Two sign-in providers.** A student can't use the staff login and staff can't use the student login.
- **Fresh checks on every request.** Each request reloads the user from the DB, so deactivation, role changes and permission changes apply immediately.
- **Login throttling.** Failed sign-ins are recorded in `AuditLog`, and 10 failures in 15 minutes lock that username for the rest of the window. Because it is stored in the DB, the throttle works across serverless instances.
- **Middleware is only a first gate.** Every page calls a server guard (`requireStudent`, `requireStaff`, `requirePagePermission`, `requirePageAdmin`). Every server action and API route re-checks authorization itself (`assertStudent`, `assertPermission`, `assertAdmin`). Hiding UI is never the control.
- **Server actions are public endpoints.** Every export of a `"use server"` file is callable, so each one starts with an authorization check and validates its arguments. Helpers stay unexported.
- **Student data is always scoped.** Queries filter by the signed-in student's id, and content access requires an `Unlock` on a **published** level. Another student's attempt, lesson, test or recording returns 404.
- **Staff get only what they are granted.** Permissions are checked against the DB. Staff can't edit their own permissions or other staff, and `EDIT_STUDENTS` only applies to student accounts. Deleting students, resetting progress, staff management, settings and the global pronunciation log are admin-only.
- **Security headers:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS, a `Permissions-Policy` limiting the microphone to this origin, and no `X-Powered-By`.
- **Test coverage:** `tests/integration/authorization.test.ts` and `tests/e2e/security.spec.ts` exercise these boundaries directly.

### CSV import

Admin → *Import vocabulary*. Columns: `level,chapter,day,german,english,article,plural,part_of_speech,ipa,phonetic,native_audio_url,example_de,example_en,difficulty,tags` (template at `/vocabulary-template.csv`). Every row is validated in a preview first; the import is all-or-nothing and skips duplicates.

## Assumptions and known limitations

- "Weekly test" is per chapter (a chapter is roughly a week of days).
- Web Speech recognition isn't available in Firefox; recording still works there, but without a transcript.
- The seed data ships no native audio. Words use the labelled synthesized voice until a `nativeAudioUrl` is set.
- Admin analytics are computed in-process and suit hundreds to low thousands of students; move them to SQL aggregates or materialized views before scaling past that.

## Branches

- `main` is the default branch. It starts from an empty initial commit.
- `claude/modest-feynman-kymdn9` holds the implementation. It has `main` merged in, so it shares history with `main` and can be reviewed and merged with a normal pull request. No history was rewritten.
