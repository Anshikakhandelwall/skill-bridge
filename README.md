# SkillBridge AI

**An AI Career Operating System.**

SkillBridge AI builds a living **Career Twin** for each student—an evidence-based model of their real skills, built from their resume, GitHub repositories, completed projects, assessments, and mock interviews—and uses it to generate and continuously adapt a personalized roadmap toward a target role.

Nothing here is just a chatbot. Every AI call is a structured-output agent with a Zod-validated schema, sitting behind deterministic engines that do the actual math: skill gaps, readiness scoring, and evidence merging.

**Agents propose. Deterministic systems validate, decide, and persist.**

---

## What it does

* **Resume Intelligence** — Uploads a PDF resume, extracts text, and separates *claimed* skills from *demonstrated* skills with cited evidence.
* **GitHub Evidence Engine** — Analyzes a student's public repositories to find real, demonstrated skills, citing actual repository names as evidence.
* **Career Readiness Engine** — Uses a deterministic formula combining role-competency weights, required skill levels, and evidence-weighted current levels to calculate a 0–100 readiness score.
* **Career Planner** — Generates a milestone-based roadmap from the student's actual skill-gap matrix rather than generic career advice.
* **Adaptive Roadmap Engine** — Reacts to real events such as a failed assessment, increased weekly hours, new GitHub evidence, completed projects, or a changed career goal. It patches affected parts of the roadmap while preserving completed work and versioning every change.
* **Project Coach** — Converts the highest-priority skill gaps into a portfolio-quality project plan with milestones, README templates, resume bullets, and interview questions.
* **Interview Agent** — Generates role-specific mock interviews with technical, behavioral, project-discussion, and follow-up questions, evaluates answers, and feeds weak competencies back into the Career Twin and roadmap.
* **Event-driven architecture** — Meaningful actions such as `resume.analyzed`, `github.analyzed`, `roadmap.generated`, `roadmap.changed`, `assessment.completed`, `assessment.failed`, `project.completed`, and `interview.completed` are logged and can trigger adaptation through a single orchestrator.

---

## Built with OpenAI Codex & GPT-5.6

SkillBridge AI was developed using **OpenAI Codex powered by GPT-5.6** as an AI-assisted software engineering workflow.

Instead of using AI only to generate isolated code snippets, we used Codex and GPT-5.6 throughout the development process as an **engineering partner** for designing, implementing, reviewing, and iterating on the complete system.

The AI-assisted development workflow helped us:

* Architect the **Career Twin** and evidence-based skill model.
* Design the event-driven **Adaptive Career Engine**.
* Implement specialized AI agents for resume analysis, GitHub analysis, project coaching, and interview evaluation.
* Build structured-output pipelines using the OpenAI Responses API and Zod validation.
* Design and implement Supabase database schemas and sequential migrations.
* Develop evidence-ranking logic that prevents stronger skill evidence from being downgraded.
* Integrate multiple independent features into a shared Career Twin architecture.
* Review implementation decisions and identify opportunities to reuse existing deterministic engines instead of duplicating logic.
* Debug TypeScript, Next.js, Supabase, authentication, and build issues during development.
* Run iterative linting and production builds to verify that new phases integrated cleanly with the existing codebase.

A key part of our workflow was treating GPT-5.6 and Codex not as a replacement for engineering judgment, but as an **AI development collaborator**. We provided architectural requirements, constraints, and existing implementation context, then used AI-assisted iteration to build and validate each feature while maintaining deterministic control over critical career calculations.

This allowed us to move from a basic career-planning concept to a multi-agent, event-driven career operating system with a continuously evolving Career Twin.

---

## Tech Stack

### Frontend

* **Next.js 15** — App Router and Turbopack
* **React 19**
* **TypeScript**
* **Tailwind CSS 4**
* **shadcn/ui**
* **lucide-react**

### Backend & Data

* **Next.js Route Handlers**
* **Supabase**
* **PostgreSQL**
* **Row Level Security (RLS)**
* **Supabase Storage** for resume PDFs
* **Supabase Authentication** with email/password authentication

### AI & Intelligence

* **OpenAI Responses API**
* **GPT-5.6**
* **OpenAI Codex** — AI-assisted software development
* **Structured Outputs**
* **Zod** — AI output validation
* Specialized AI agents for:

  * Resume Intelligence
  * GitHub Evidence Analysis
  * Career Planning
  * Project Coaching
  * Interview Generation and Evaluation
  * Roadmap Adaptation

### External APIs & Deployment

* **GitHub REST API** — public repository evidence
* **Vercel** — deployment

No additional runtime dependencies were added beyond what the application requires. Visual features such as celebrations, confetti, skeleton loaders, progress rings, and the interview radar chart are implemented using lightweight custom components.

---

## Getting Started

### 1. Create a Supabase Project

Create a project in Supabase and obtain:

* **Project URL**
* **Publishable/Anon Public Key**

These values are required for the application to communicate with Supabase.

### 2. Run the Database Migrations

The migrations are located in:

```text
supabase/migrations/
```

Run them in filename order. They are timestamped, so alphabetical order is the correct execution order.

Using the Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates the required database tables, Row Level Security policies, and storage configuration.

### 3. Configure Authentication

SkillBridge AI uses **email/password authentication**.

In your Supabase project:

**Authentication → Providers → Email**

Enable email authentication according to your desired confirmation settings.

Under:

**Authentication → URL Configuration**

Configure the Site URL and Redirect URLs for local development and production.

For local development:

```text
http://localhost:3000
```

For production, add your deployed Vercel domain.

### 4. Configure Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
OPENAI_API_KEY=your_openai_api_key
```

Optional variables may include:

```env
GITHUB_TOKEN=your_github_token
```

A GitHub token is optional and can be used to increase GitHub API rate limits.

### 5. Install and Run

```bash
npm install
npm run dev
```

Visit:

```text
http://localhost:3000
```

---

## Deploying

SkillBridge AI is a standard Next.js application and can be deployed to **Vercel**.

1. Import the GitHub repository into Vercel.
2. Add the required environment variables under **Project Settings → Environment Variables**.
3. Deploy the application.
4. Update Supabase **Site URL** and **Redirect URLs** with the production Vercel domain.
5. Ensure the Supabase database migrations have been applied to the production project.

---

## Available Scripts

```bash
npm run dev     # Start the development server with Turbopack
npm run build   # Create a production build
npm run start   # Run the production build
npm run lint    # Run ESLint
```

---

## Project Structure

```text
src/
  app/
    dashboard/              # Career Twin overview and activity
    resume/                 # Resume upload and intelligence
    analyze/                # Resume analysis flow
    github/                 # GitHub evidence analysis
    roadmap/                # Adaptive roadmap and skill gaps
    projects/               # AI Project Coach
    interview/              # AI mock interview
    login/                  # Email/password login
    signup/                 # Email/password registration
    api/                    # API route handlers

  components/
    ui/                     # Shared UI primitives
    dashboard/              # Dashboard components
    roadmap/                # Roadmap components
    resume/                 # Resume components
    github/                 # GitHub components
    projects/               # Project components
    interview/              # Interview components
    auth/                   # Authentication components
    demo/                   # Demo and simulation components

  lib/
    agents/                 # Structured-output AI agents
    career/                 # Deterministic career intelligence engines
    github/                 # GitHub REST API client
    resume/                 # Resume text extraction
    auth/                   # Authentication helpers
    supabase/               # Supabase client/server helpers
    validations/            # Zod validation schemas

  types/                    # Shared TypeScript types

supabase/
  migrations/               # Timestamped sequential SQL migrations
```

---

## API Routes

| Route                              | Purpose                                      |
| ---------------------------------- | -------------------------------------------- |
| `POST /api/resume/upload`          | Upload a resume                              |
| `POST /api/resume/extract`         | Extract resume text                          |
| `POST /api/resume/analyze`         | Analyze resume evidence                      |
| `POST /api/github/analyze`         | Analyze GitHub repositories                  |
| `POST /api/roadmap/generate`       | Generate a personalized roadmap              |
| `POST /api/assessments/start`      | Start a skill assessment                     |
| `POST /api/assessments/submit`     | Submit assessment results                    |
| `POST /api/projects/generate`      | Generate a portfolio project                 |
| `GET /api/projects`                | Retrieve student projects                    |
| `POST /api/projects/:id/complete`  | Complete a project and update evidence       |
| `POST /api/interviews/start`       | Generate a mock interview                    |
| `POST /api/interviews/:id/respond` | Evaluate interview responses                 |
| `GET /api/interviews`              | Retrieve interview history                   |
| `POST /api/demo/simulate`          | Developer-only roadmap adaptation simulation |

---

## Architecture Principle

Every major feature follows the same core pipeline:

```text
User Action / New Evidence
          ↓
        Event
          ↓
Deterministic Calculation
          ↓
   AI Agent Reasoning
          ↓
   Structured Output
          ↓
     Zod Validation
          ↓
 Deterministic Decision
          ↓
    Database Update
          ↓
   Career Twin Updated
          ↓
  Roadmap Adaptation
          ↓
       New UI State
```

The AI never writes directly to the database.

AI agents are responsible for reasoning and proposing structured outputs. Deterministic code validates those outputs and controls critical operations such as evidence ranking, readiness calculations, skill-gap analysis, and roadmap adaptation.

The roadmap adaptation logic is centralized in the career engine and reused across all triggers—including assessments, GitHub analysis, project completion, interviews, and career goal changes—rather than being duplicated across individual features.

The result is a continuously evolving system:

**Evidence → Career Twin → Skill Gap → Roadmap → Action → New Evidence → Adaptation**

---

## Vision

Most career platforms tell students what they *could* learn.

SkillBridge AI focuses on what they **actually know, what they can prove, what they are missing, and what they should do next**.

Our long-term vision is to build an intelligent career operating system that continuously connects a student's real-world evidence to their career goals.

> **SkillBridge AI doesn't give you a roadmap once. It continuously navigates with you until you're ready for where you want to go.**

**SkillBridge AI — Your Career. Continuously Evolving.**

developer-Anshika Khandelwal
