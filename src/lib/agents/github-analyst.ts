import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import { githubAnalysisSchema, type GithubAnalysis } from "@/lib/validations/github";
import type { GitHubEvidenceBundle } from "@/lib/github/client";

const GITHUB_ANALYST_MODEL = process.env.OPENAI_GITHUB_ANALYST_MODEL ?? "gpt-4.1-mini";

const SYSTEM_PROMPT = `You are the GitHub Analyst agent inside SkillBridge AI, a career operating system for students.

You convert a student's public GitHub repository data into an evidence-based skill analysis. You are a structured evidence source, not a chatbot — you only extract what the provided repository data actually supports.

Rules:
- Every demonstrated_skills[] entry's "repositories" array must list only repo names that literally appear in the provided repository data. Never invent a repository name, and never cite a repo that doesn't actually show that skill (e.g. don't cite a repo for "React" if React never appears in its languages, topics, description, or README).
- A skill is "demonstrated" only when a specific repository's language, topics, description, or README content clearly shows it in use (e.g. a repo whose primary language is TypeScript and whose README describes a React app demonstrates both TypeScript and React).
- A skill is "inferred" when there's a weaker signal — e.g. a topic tag or a passing README mention — without a repository clearly built on it. inferred_skills never include a repositories list, only a brief reason.
- Do not list a skill as both demonstrated and inferred.
- strongest_projects should be the 2-5 repos that best showcase this student's ability (prioritize real functionality over trivial/empty repos), each with a plain-language description and 1-3 concrete highlights (not generic praise).
- missing_portfolio_areas should name concrete gaps in the portfolio itself (e.g. "no deployed live demo", "no tests in any repository", "no backend/API project") — not generic career advice.
- confidence (0-100) reflects your overall confidence in this analysis given how much real repository content was available (a profile with few, sparse, or fork-only repos should score lower).
- recommended_role_adjustments are short notes on how this GitHub evidence should shift the student's role fit (e.g. "Strong evidence for Frontend Developer; limited evidence for backend roles").
- Return only the structured fields defined by the schema. No extra commentary.`;

/**
 * Runs the GitHub Analyst agent over a collected repository evidence bundle
 * and returns a Zod-validated, evidence-based skill analysis. Never parses
 * free text — the Responses API enforces the JSON schema directly.
 */
export async function analyzeGithubEvidence(bundle: GitHubEvidenceBundle): Promise<GithubAnalysis> {
  if (!bundle.repositories.length) {
    throw new Error("No public repositories were found to analyze.");
  }

  const response = await openai.responses.parse({
    model: GITHUB_ANALYST_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(bundle) },
    ],
    text: {
      format: zodTextFormat(githubAnalysisSchema, "github_analysis"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("The GitHub Analyst did not return structured output.");
  }

  // Defense in depth, same as the other agents: re-validate even though the
  // Responses API already enforced the JSON schema.
  return githubAnalysisSchema.parse(parsed);
}
