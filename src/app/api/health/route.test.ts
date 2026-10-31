/** @jest-environment node */

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('answers 200 without a session or any upstream call', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
