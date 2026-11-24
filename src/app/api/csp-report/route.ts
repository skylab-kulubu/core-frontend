import { handleCspReport } from '@/lib/security/csp-report';

// Where the browser sends the panel's CSP violations; src/lib/security/csp-report.ts logs them.
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleCspReport(request);
}
