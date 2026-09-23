import { NextResponse } from 'next/server';

/** RFC 7807 problem shape shared with the sky-handoff admin API. */
export type HandoffProblem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  field?: string;
};

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  415: 'Unsupported Media Type',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

/** Answers with a problem document as received (already reduced by `asProblem`). */
export function relayProblem(problem: HandoffProblem): NextResponse {
  return NextResponse.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE },
  });
}

/** Answers with a problem superadmin writes itself. */
export function problemResponse(status: number, detail: string): NextResponse {
  return relayProblem({ type: 'about:blank', title: TITLES[status] ?? 'Error', status, detail });
}

/** Reads an RFC 7807 body, keeping only the documented members. */
export function asProblem(body: unknown, status: number): HandoffProblem | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.detail !== 'string' || !raw.detail.trim()) return null;
  const problem: HandoffProblem = {
    type: typeof raw.type === 'string' ? raw.type : 'about:blank',
    title: typeof raw.title === 'string' ? raw.title : (TITLES[status] ?? 'Error'),
    status,
    detail: raw.detail,
  };
  if (typeof raw.field === 'string' && raw.field) problem.field = raw.field;
  return problem;
}
