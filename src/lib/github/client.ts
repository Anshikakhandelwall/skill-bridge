const GITHUB_API_BASE = "https://api.github.com";
const MAX_REPOS_ANALYZED = 6;
const README_EXCERPT_CHARS = 1500;

export class GitHubFetchError extends Error {
  code: "not_found" | "rate_limited" | "fetch_failed";

  constructor(code: "not_found" | "rate_limited" | "fetch_failed", message: string) {
    super(message);
    this.code = code;
    this.name = "GitHubFetchError";
  }
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  // Optional: an app-owned token (not user OAuth) just raises the rate limit
  // for public, unauthenticated reads. Analysis works without it.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubGet(path: string): Promise<Response> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, { headers: githubHeaders() });
  if (response.status === 403 || response.status === 429) {
    throw new GitHubFetchError("rate_limited", "GitHub API rate limit reached. Try again in a few minutes.");
  }
  return response;
}

export interface GitHubProfile {
  username: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  htmlUrl: string;
  avatarUrl: string;
  createdAt: string | null;
}

export interface GitHubRepoSummary {
  name: string;
  description: string | null;
  primaryLanguage: string | null;
  languages: string[];
  stars: number;
  forks: number;
  topics: string[];
  homepage: string | null;
  htmlUrl: string;
  pushedAt: string | null;
  readmeExcerpt: string | null;
  recentCommits: number | null;
}

export interface GitHubEvidenceBundle {
  profile: GitHubProfile;
  repositories: GitHubRepoSummary[];
  totalPublicReposConsidered: number;
}

export async function fetchGitHubProfile(username: string): Promise<GitHubProfile> {
  const response = await githubGet(`/users/${encodeURIComponent(username)}`);
  if (response.status === 404) {
    throw new GitHubFetchError("not_found", `No public GitHub user found for "${username}".`);
  }
  if (!response.ok) {
    throw new GitHubFetchError("fetch_failed", `GitHub profile lookup failed (${response.status}).`);
  }
  const data = await response.json();
  return {
    username: data.login,
    name: data.name ?? null,
    bio: data.bio ?? null,
    company: data.company ?? null,
    location: data.location ?? null,
    blog: data.blog || null,
    publicRepos: data.public_repos ?? 0,
    followers: data.followers ?? 0,
    htmlUrl: data.html_url,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at ?? null,
  };
}

interface RawRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
}

async function fetchRepoList(username: string): Promise<RawRepo[]> {
  const response = await githubGet(`/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100`);
  if (!response.ok) {
    throw new GitHubFetchError("fetch_failed", `Could not list repositories (${response.status}).`);
  }
  return response.json();
}

async function fetchRepoLanguages(username: string, repo: string): Promise<string[]> {
  try {
    const response = await githubGet(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/languages`);
    if (!response.ok) return [];
    const data: Record<string, number> = await response.json();
    return Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .map(([language]) => language);
  } catch {
    return [];
  }
}

async function fetchRepoReadmeExcerpt(username: string, repo: string): Promise<string | null> {
  try {
    const response = await githubGet(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/readme`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.content) return null;
    const decoded = Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf-8").toString("utf-8");
    return decoded.trim().slice(0, README_EXCERPT_CHARS) || null;
  } catch {
    return null;
  }
}

/** Best-effort: GitHub computes this stat asynchronously and may return 202 while it's warming up. */
async function fetchRecentCommitCount(username: string, repo: string): Promise<number | null> {
  try {
    const response = await githubGet(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/stats/commit_activity`);
    if (response.status !== 200) return null;
    const weeks: { total: number }[] = await response.json();
    if (!Array.isArray(weeks)) return null;
    return weeks.reduce((sum, week) => sum + (week.total ?? 0), 0);
  } catch {
    return null;
  }
}

/**
 * Fetches a student's public GitHub profile and their most relevant
 * repositories (by stars, then recency), enriching the top few with
 * languages, a README excerpt, topics, and commit activity. All reads are
 * unauthenticated public API calls — no OAuth, no private data.
 */
export async function collectGitHubEvidence(username: string): Promise<GitHubEvidenceBundle> {
  const profile = await fetchGitHubProfile(username);
  const rawRepos = await fetchRepoList(username);

  const nonForkRepos = rawRepos.filter((repo) => !repo.fork && !repo.archived);
  const candidateRepos = (nonForkRepos.length ? nonForkRepos : rawRepos)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, MAX_REPOS_ANALYZED);

  const repositories: GitHubRepoSummary[] = await Promise.all(
    candidateRepos.map(async (repo) => {
      const [languages, readmeExcerpt, recentCommits] = await Promise.all([
        fetchRepoLanguages(username, repo.name),
        fetchRepoReadmeExcerpt(username, repo.name),
        fetchRecentCommitCount(username, repo.name),
      ]);
      return {
        name: repo.name,
        description: repo.description,
        primaryLanguage: repo.language,
        languages,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        topics: repo.topics ?? [],
        homepage: repo.homepage || null,
        htmlUrl: repo.html_url,
        pushedAt: repo.pushed_at,
        readmeExcerpt,
        recentCommits,
      };
    }),
  );

  return { profile, repositories, totalPublicReposConsidered: rawRepos.length };
}
