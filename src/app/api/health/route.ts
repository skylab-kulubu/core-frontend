// Liveness for the container health check (Swarm): no I/O, no session, so a slow core or
// Keycloak never marks the panel unhealthy. The probe: wget -qO- http://127.0.0.1:3000/api/health
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response('ok', { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
