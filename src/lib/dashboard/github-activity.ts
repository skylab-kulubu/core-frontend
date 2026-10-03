import { bearer } from '@/lib/api/core';

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
    /**
     * Private repositories with activity in the window and their commits; no
     * names. Left out while fewer than two are active, so one is never given away.
     */
    privateRepositories?: { active: number; commits: number };
  };
  /** Core answered its last good read because GitHub could not be read just now. */
  stale?: boolean;
  /** GitHub's answer was cut short, so the figures may be low. */
  truncated?: boolean;
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

/**
 * The activity, or null while no endpoint is configured or the caller may not
 * see it (core opens it to ADMIN, YK and DK only). Sent with core's token, never
 * with cookies.
 */
export async function fetchGithubActivity(signal?: AbortSignal): Promise<GithubActivity | null> {
  if (!ENDPOINT) return null;
  const token = await bearer();
  const response = await fetch(ENDPOINT, {
    credentials: 'omit',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`GitHub etkinliği alınamadı (${response.status})`);
  return (await response.json()) as GithubActivity;
}
