/** @jest-environment node */

import { mediaApi } from '@/lib/api/media';

describe('mediaApi.upload', () => {
  const realFetch = global.fetch;
  let calls: Request[];

  function answer(response: () => Response) {
    calls = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(new URL(String(input)), init));
      return response();
    }) as typeof fetch;
  }

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('sends the Media purpose with the file', async () => {
    answer(() => Response.json({ id: 'm1', purpose: 'event_cover' }, { status: 201 }));

    await mediaApi.upload(new File(['x'], 'kapak.png', { type: 'image/png' }), 'event_cover');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(new URL(calls[0].url).pathname).toBe('/v1/media');
    const form = await calls[0].formData();
    expect(form.get('purpose')).toBe('event_cover');
    expect((form.get('file') as File).name).toBe('kapak.png');
  });

  it('refuses with core problem code and fields', async () => {
    answer(() =>
      Response.json(
        {
          type: 'about:blank',
          title: 'Content Too Large',
          status: 413,
          detail: 'The file is larger than this purpose allows.',
          code: 'media_too_large',
          purpose: 'event_gallery',
          maxBytes: 10485760,
        },
        { status: 413, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const failure = mediaApi.upload(new File(['x'], 'buyuk.png'), 'event_gallery');

    await expect(failure).rejects.toMatchObject({
      status: 413,
      code: 'media_too_large',
      detail: 'The file is larger than this purpose allows.',
      fields: { purpose: 'event_gallery', maxBytes: 10485760 },
    });
  });
});
