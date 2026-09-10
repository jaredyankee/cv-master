# CV Master

Build tailored resumes from a single "resume dump" of everything you've done.

You write about yourself once, freely and in whatever shape you like. CV Master uses Claude to organize that into a structured profile, asks you to confirm any edits it suggests, and raises questions where it thinks information is missing. From then on, each job application is *assembled* from pieces of that profile rather than generated from scratch, so nothing on the resume is something you didn't actually say.

## How it works

1. **Dump.** Paste your professional story (structured or not, existing resumes welcome) along with your own Anthropic API key.
2. **Ingest.** A background function sends the text to Claude with a forced tool call, so the output always matches the profile schema. The model may reorganize and lightly reword for clarity, but it is instructed never to invent content.
3. **Review.** Suggested edits appear Word-style: the original text highlighted and uneditable, the model's note, and an editable suggestion you can accept or ignore. Missing information comes back as questions with a text box.
4. **Dashboard.** Your profile sits on the left. On the right you add job applications: a job description, optional notes, and any extra questions the posting asks.
5. **Apply.** For each application the model returns a fit rating, a resume built from your profile, a cover-letter outline (mission, culture, points of overlap, gaps), answers to any questions the posting asks, and a warning if the posting hides an instruction meant to catch automated applicants. It does not write the cover letter.

## Bring your own key

There is no shared API key. You enter your own on the first screen. It is sent to the background function once, used for that request, and stored encrypted (AES-256-GCM) in Postgres so you don't have to re-enter it. The key is never logged.

## Stack

- **Front end:** React 19 + Vite. No UI framework; plain CSS with light/dark theming.
- **Functions:** Netlify Functions. The ingestion step is a background function so it isn't bound by the 10-second synchronous limit; the UI polls a small GET function until the result is stored.
- **Database:** Neon (Postgres) via `@neondatabase/serverless`.
- **Auth:** Neon Auth (managed Better Auth). The browser signs in against Neon directly; functions verify the resulting JWT against the project's JWKS and take the user id from it.
- **AI:** Anthropic SDK with tool-forced structured output.

```
src/                      React app
  auth.js                 Neon Auth client + token helper
  components/Auth/        sign in / sign up
  components/Onboarding/  dump form + review step
  components/Dashboard/   profile panel, applications, new-application form
  schemas/                JSDoc types and mock data for the two AI payloads
netlify/functions/        HTTP entry points (thin; delegate to private/)
private/
  objects/                business logic (createResumeDump, load, poll)
  db/                     SQL for users, dumps, review diffs
  lib/auth.js             bearer JWT verification (jose + Neon JWKS)
  lib/crypto.js           encrypt / decrypt for stored API keys
  registry/               system prompt, tool schema, function registry
  cors/                   origin allow-list
```

## Running locally

```bash
npm install
cp .env.example .env      # then fill it in (see below)
npx netlify dev           # serves the Vite app and the functions together
```

`npm run dev` runs the Vite app alone, which is fine for UI work but has no functions behind it.

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | functions | Neon connection string |
| `ENCRYPTION_KEY` | functions | 64-char hex key for encrypting stored API keys. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SEYONA_KEY` | functions | Shared secret used by the CORS layer |
| `ANTHROPIC_API_KEY` | functions, optional | Fallback when no key is sent from the form. Useful for a single-user deployment |
| `NEON_AUTH_BASE_URL` | functions | Neon Auth base URL, from Neon console → Auth → Configuration. Used as the JWT issuer |
| `NEON_AUTH_JWKS_URL` | functions, optional | Defaults to `<NEON_AUTH_BASE_URL>/.well-known/jwks.json` |
| `VITE_NEON_AUTH_URL` | front end | Same value as `NEON_AUTH_BASE_URL`, baked into the browser build |
| `VITE_CURRENT_ENVIRONMENT` | front end | Set to `localenvironment` to point the app at `netlify dev` |

`.env` is only read locally. For a deployed site, add the same variables under **Site configuration → Environment variables** in Netlify (Functions scope, all deploy contexts) and redeploy.

### Auth

Enable Auth on the Neon project (console → Auth). Copy the Base URL into both `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL`, and add the app's origins (your `localhost` dev port and the deployed site) to Neon Auth's trusted origins. Users are stored by Neon in the `neon_auth` schema of the same database; this app's own `users` table is keyed by the same id, which is the `sub` claim of the JWT.

### Database

Four tables are expected: `users`, `resume_dumps` (one per user), `resume_dump_diffs` (one row per review pass), and `job_applications`, plus the enums `fit_level` and `job_application_status`. The column names can be read off the queries in `private/db/`.

## Status

Working today: sign in / sign up, onboarding, AI ingestion, review, dashboard, returning-user detection, job applications (fit, built resume, cover-letter outline), and editing — every section of your profile and of each built resume can be corrected, reordered, or extended by hand.

Not yet: a confirmation step before spending tokens on a Mismatch or Out of Reach role.

## License

[AGPL-3.0](LICENSE)
