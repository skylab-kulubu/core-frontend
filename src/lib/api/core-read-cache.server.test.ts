/** @jest-environment node */

import { keptRead, keptReadCount } from '@/lib/api/core-read-cache';

describe('kept reads on the server', () => {
  it('keeps nothing: the module is shared by every request there', async () => {
    const read = jest.fn(async () => ({ status: 200, text: '{}' }));

    await keptRead('/v1/teams', read);
    await keptRead('/v1/teams', read);

    expect(read).toHaveBeenCalledTimes(2);
    expect(keptReadCount()).toBe(0);
  });
});
