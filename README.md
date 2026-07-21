# SkillBridge AI

**An AI Career Operating System.** SkillBridge builds a living **Career Twin** for each student — an evidence-based model of their real skills, built from their resume, GitHub repositories, completed projects, and mock interviews — and uses it to generate and continuously adapt a personalized roadmap toward a target role.

Nothing here is a chatbot. Every AI call is a structured-output agent with a Zod-validated schema, sitting behind deterministic engines that do the actual math (skill gaps, readiness scoring, evidence merging). Agents propose; deterministic code decides what gets written to the database.

---

## What it does

- **Resume Intelligence** — uploads a PDF resume, extracts text, and separates *claimed* skills from *demonstrated* ones with cited evidence.
- **GitHub Evidence Engine** — analyzes a student's public repositories (no OAuth) to find real, demonstrated skills, citing actual repo names as evidence.
- **Career Readiness Engine** — a deterministic formula combining role-competency weights, required skill levels, and evidence-weighted current levels into a single 0–100 readiness score.
- **Career Planner** — generates a milestone-based roadmap from the student's actual skill gap matrix, not generic advice.
- **Adaptive Roadmap Engine** — reacts to real events (a failed assessment, more weekly hours, a new GitHub skill, a completed project, a changed career goal) by patching the *affected* parts of the roadmap while preserving completed work, versioning every change.
- **Project Coach** — turns the highest-priority skill gaps into a single portfolio-quality project plan (not a to-do app), complete with milestones, a README template, a resume bullet, and interview questions.
- **Interview Agent** — generates a role-specific mock interview (technical/behavioral/project-discussion/follow-up questions), evaluates answers, and feeds weak competencies back into the roadmap.
- **Event-driven architecture** — every meaningful action (`resume.analyzed`, `github.analyzed`, `roadmap.generated`, `roadmap.changed`, `assessment.completed/failed`, `project.completed`, `interview.completed`, …) is logged and can trigger adaptation through a single orchestrator.

---

## Tech stack

- **Next.js 15** (App Router, Turbopack), **React 19**, **TypeScript**
- **Tailwind CSS 4**
- **Supabase** — Postgres, Row Level Security, Auth (Google OAuth), Storage (resume PDFs)
- **OpenAI Responses API** — structured outputs only, validated with **Zod** before anything touches the database
- **lucide-react** for icons

No other runtime dependencies were added beyond what a standard Next.js + Supabase + OpenAI app needs — celebrations/confetti, skeleton loaders, progress rings, and the interview radar chart are all hand-built (no charting or animation library).

---

## Getting started

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a new project, and from **Project Settings → API** copy:
- the **Project URL**
- the **anon public key**

### 2. Run the database migrations
In the Supabase **SQL Editor**, run every file in `supabase/migrations/` **in filename order** (they're timestamped, so alphabetical order is correct order). If you have the Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates all tables (with RLS enabled on every one) and the private `resumes` storage bucket.

### 3. Enable Google sign-in
In Supabase **Authentication → Providers → Google**, enable it and add a Google OAuth Client ID/Secret (create one in Google Cloud Console → APIs & Credentials, redirect URI `https://<your-project-ref>.supabase.co/auth/v1/callback`). In **Authentication → URL Configuration**, add `http://localhost:3000/**` as a redirect URL for local dev.

### 4. Configure environment variables
```bash
cp .env.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `OPENAI_API_KEY` at minimum. See `.env.example` for optional variables (a `GITHUB_TOKEN` to raise GitHub API rate limits, and per-agent model overrides).

### 5. Install and run
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

---

## Deploying

This is a standard Next.js app — deploy to **Vercel** (recommended) by importing the repo and adding the same environment variables from step 4 under Project Settings → Environment Variables. After the first deploy, update Supabase's **Site URL** and **Redirect URLs** to your real production domain.

---

## Available scripts

```bash
npm run dev     # start the dev server (Turbopack)
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```

---

## Project structure

```
src/
  app/                    # routes (App Router)
    dashboard/            # Career Twin overview, activity timeline, demo mode
    resume/ analyze/       # resume upload + evidence breakdown
    github/                 # GitHub evidence analysis
    roadmap/                # generated roadmap + skill gap visualization
    projects/                # Project Coach
    interview/                # mock interview flow
    api/                       # route handlers (see below)
  components/
    ui/                     # shared primitives (Button, ProgressRing, Skeleton, EmptyState, Celebration, ...)
    dashboard/ roadmap/ resume/ github/ projects/ interview/ demo/
  lib/
    agents/                  # AI agents — Responses API + Zod, one file per agent
    career/                  # deterministic engines: skill-gap, readiness-score,
                              # adaptation-engine, orchestrator, events, assessment,
                              # generate-roadmap, notifications, evidence-merge helpers
    github/                   # GitHub REST API client (public data only)
    resume/                    # PDF text extraction
    supabase/                   # client/server Supabase helpers
    validations/                 # Zod schemas for every AI agent's output
  types/                          # shared TypeScript types
supabase/migrations/               # timestamped, sequential SQL migrations
```

### API routes

| Route | Purpose |
|---|---|
| `POST /api/resume/upload`, `/extract`, `/analyze` | Resume Intelligence pipeline |
| `POST /api/github/analyze` | GitHub Evidence Engine |
| `POST /api/roadmap/generate` | Career Planner → new roadmap version |
| `POST /api/assessments/start`, `/submit` | Skill assessments (feed evidence + adaptation) |
| `POST /api/projects/generate`, `GET /api/projects`, `POST /api/projects/:id/complete` | Project Coach |
| `POST /api/interviews/start`, `POST /api/interviews/:id/respond`, `GET /api/interviews` | Interview Agent |
| `POST /api/demo/simulate` | Developer-only: triggers real events to demo live roadmap adaptation |

### Architecture principle

Every feature follows the same pipeline:

```
Event → deterministic calculation → AI agent (structured output) → Zod validation → database write → UI
```

The AI never writes to the database directly, and the roadmap adaptation logic lives in exactly one place (`src/lib/career/orchestrator.ts` + `adaptation-engine.ts`) that every trigger — assessments, GitHub sync, project completion, interviews, career goal changes — reuses rather than duplicates.
