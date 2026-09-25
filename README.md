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
| `npm test` | Unit tests (permissions, access, question generation, grading, SRS, CSV import, pronunciation engine) |
| `npm run test:e2e` | Playwright against `next start` (run `npm run build` first; set `PW_CHROMIUM_PATH` to use a preinstalled Chromium) |
| `npm run db:deploy` | Apply migrations in production |

## Deploying (Vercel + Neon)

1. Create a Neon project. Set `DATABASE_URL` to the **pooled** connection string and `DIRECT_URL` to the **direct** one.
2. Set `AUTH_SECRET` (`openssl rand -base64 32`).
3. For pronunciation recordings, create a Vercel Blob store and set `STORAGE_PROVIDER=vercel-blob` (`BLOB_READ_WRITE_TOKEN` is injected by Vercel).
4. Vercel runs `npm run vercel-build` (generate, migrate, build). Seed once with `SEED_ADMIN_PASSWORD=… npm run db:seed` against the production DB.

## Architecture

```
src/
  app/(student)/…        student UI: dashboard, levels, chapters, lessons (learn / sentences / pronounce), tests, attempts, words, progress
  app/admin/(panel)/…    admin UI: dashboard, students, staff, curriculum, vocabulary + import, tests, results, pronunciation, settings
  app/api/recordings     pronunciation upload → StorageProvider → PronunciationEngine
  lib/permissions.ts     deny-by-default permission checks (admin = all, staff = only granted, student = none)
  lib/access.ts          unlock resolution: level ⊇ chapter ⊇ lesson
  lib/auth/              Auth.js config, providers, server guards (re-read user from DB on every request)
  lib/tests/             pure question generation (7 types) and grading
  lib/srs/               review scheduling (SM-2-compatible fields; simplified v1 scheduler)
  lib/progression.ts     optional auto-unlock hooks (daily test → next day, weekly test → next chapter)
  lib/pronunciation/     PronunciationEngine interface + engines
  lib/storage/           StorageProvider (local disk for dev, Vercel Blob for prod)
  server/                data loaders and server actions (every action re-checks authorization)
prisma/schema.prisma     data model
```

### Key design decisions

- **Access is explicit.** A student sees only content with an `Unlock` row: a level unlock grants the whole level, a chapter unlock grants its days, a lesson unlock grants one day. Auto-progression is off by default and toggled in **Settings**.
- **Staff permissions are an explicit list** on the user. Middleware only gates the area; each page and server action checks the specific permission against the DB. Deleting students, resetting progress, staff management, settings and the global pronunciation log are admin-only.
- **Tests are graded on the server.** Starting an attempt snapshots the generated questions; correct answers are never sent to the browser. Time limits are enforced server-side (20 s grace). Every attempt and answer is stored, and each graded answer updates the word's `VocabularyProgress`.
- **Daily tests** cover the lesson's words. **Weekly tests** are per chapter and cover the days of that chapter the student has completed.
- **Pronunciation:** IPA and learner-friendly pronunciation are separate fields. Reference audio uses `audioUrl` when set, otherwise the browser's German speech synthesis, labelled "Synthesized voice". Recordings use `MediaRecorder`; transcription uses the browser Web Speech API (`de-DE`) where available. The default `browser-transcript` engine reports whether the transcript matches the word. **It never produces a pronunciation score**: `score` stays `null` until a real scoring provider is registered in `lib/pronunciation/index.ts`. Pronunciation test questions are stored but excluded from the score.
- **Words per lesson** are configured per level (`wordsPerLesson`, default 15) and enforced when adding words and importing.
- **Spaced-repetition ready:** `VocabularyProgress` stores times seen, correct and incorrect, last and next review, mastery, the difficult flag, and SM-2 state (`easeFactor`, `intervalDays`, `repetitions`).

### CSV import

Admin → *Import vocabulary*. Columns: `level,chapter,day,german,english,article,plural,part_of_speech,ipa,phonetic,audio_url,example_de,example_en,difficulty,tags` (template at `/vocabulary-template.csv`). Every row is validated in a preview first; the import is all-or-nothing and skips duplicates.

## Assumptions and known limitations

- "Weekly test" is per chapter (a chapter is roughly a week of days).
- "Today" for the admin dashboard uses the server's timezone (UTC on Vercel).
- Web Speech recognition isn't available in Firefox; recording still works there, but without a transcript.
- The seed data ships no native reference audio. Upload audio URLs per word or sentence for native recordings.
- Admin analytics are computed in-process and suit hundreds to low thousands of students; move them to SQL aggregates or materialized views before scaling past that.
