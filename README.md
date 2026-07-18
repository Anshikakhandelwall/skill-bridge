# SkillBridge AI

SkillBridge AI is an adaptive career-planning product that will turn a student's skills, goals, and constraints into an evidence-based roadmap.

## Phase 1 foundation

This repository provides a Next.js 15 application with TypeScript, App Router, Tailwind CSS, shadcn/ui components, Supabase authentication, database migrations, and a persisted student onboarding flow. AI analysis and roadmap generation are intentionally deferred.

## Run locally

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase's Connect dialog.
3. Run `supabase db push` (or paste the migration in the Supabase SQL Editor).
4. In Supabase Auth > Providers, enable Google and add its Google Cloud OAuth client ID and secret.
5. In Supabase Auth > URL Configuration, add `http://localhost:3000/auth/callback` as a redirect URL.
6. Run `npm run dev` and visit `http://localhost:3000`.

## Structure

- `src/app` — routes, layout, loading and error states
- `src/components` — planned feature and shared UI components
- `src/lib` — integration clients, utilities, and validation schemas
- `src/types` — shared TypeScript types
- `supabase/migrations` — reserved for future database migrations

## Next phase

Implement Supabase configuration, the initial database schema with row-level security, and authentication before building the onboarding flow.
