/**
 * The club's GitHub activity for the dashboard. Whatever serves it (a route in
 * this app or core-backend) returns this shape; the dashboard reads it from
 * NEXT_PUBLIC_GITHUB_ACTIVITY_URL and hides the section while that is unset.
 * Private repositories only count in the totals, never by name.
 */
export type GithubActivity = {
  /** The organisation's login, such as "skylab-kulubu". */
  org: string;
  /** When the figures were gathered (ISO 8601); they may be a few minutes old. */
  generatedAt: string;
  /** The window the figures cover: its first day (ISO 8601) and its length. */
  window: { since: string; days: number };
  totals: {
    /** Commits on default branches in the window, private ones included. */
    commits: number;
    /** The same for the window before, for the change. */
    commitsPrevious: number;
    mergedPullRequests: number;
    openPullRequests: number;
    /** People with a commit or a merged pull request in the window. */
    activeContributors: number;
    /** Private repositories with activity in the window and their commits; no names. */
    privateRepositories: { active: number; commits: number };
  };
  /** Public repositories with activity in the window, most active first. */
  repositories: GithubRepository[];
  /** Recent public happenings, newest first. */
  events: GithubEvent[];
};

export type GithubRepository = {
  name: string;
  url: string;
  description?: string | null;
  language?: string | null;
  /** Last push (ISO 8601). */
  pushedAt: string;
  commits: number;
  /** Commits per day across the window, oldest first; `window.days` long. */
  commitsByDay: number[];
  openPullRequests: number;
  /** The people behind the window's commits, most commits first. */
  contributors: { login: string; avatarUrl: string; commits: number }[];
};

export type GithubEvent = {
  kind: 'pull_request_merged' | 'release';
  repository: string;
  title: string;
  url: string;
  author?: string | null;
  /** When it happened (ISO 8601). */
  at: string;
};

const ENDPOINT = process.env.NEXT_PUBLIC_GITHUB_ACTIVITY_URL;

export const githubActivityConfigured = Boolean(ENDPOINT);

/** The activity, or null while no endpoint is configured. */
export async function fetchGithubActivity(signal?: AbortSignal): Promise<GithubActivity | null> {
  if (!ENDPOINT) return null;
  const response = await fetch(ENDPOINT, { credentials: 'include', signal });
  if (!response.ok) throw new Error(`GitHub etkinliği alınamadı (${response.status})`);
  return (await response.json()) as GithubActivity;
}
