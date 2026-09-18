import { publicMediaUrl, teamEventPhotos } from '@/lib/event-media';

describe('team event photos', () => {
  const gecekodu = {
    id: 'e1',
    name: 'Gecekodu',
    ownerTeam: 'GECEKODU',
    coverImageId: 'c1',
    coverImageUrl: 'https://cdn.example.test/c1.jpg',
    images: [{ id: 'g1', url: 'https://cdn.example.test/g1.jpg' }],
  };
  const agc = {
    id: 'e2',
    name: 'AGC',
    ownerTeam: 'AGC',
    coverImageId: 'c2',
    images: [{ id: 'g2' }],
  };

  it('returns only this Owner team photos', () => {
    const photos = teamEventPhotos([gecekodu, agc], 'GECEKODU');
    expect(photos.map((row) => row.id)).toEqual(['c1', 'g1']);
    expect(photos.every((row) => row.eventName === 'Gecekodu')).toBe(true);
  });

  it('never leaks another team when owner is empty', () => {
    expect(teamEventPhotos([gecekodu, agc], '')).toEqual([]);
  });

  it('dedupes a cover that is also in the gallery', () => {
    const photos = teamEventPhotos(
      [
        {
          ...gecekodu,
          images: [{ id: 'c1', url: 'https://cdn.example.test/c1.jpg' }],
        },
      ],
      'GECEKODU',
    );
    expect(photos.map((row) => row.id)).toEqual(['c1']);
  });

  it('resolves relative cover and gallery keys onto the club CDN', () => {
    const photos = teamEventPhotos(
      [
        {
          ...gecekodu,
          coverImageUrl: 'images/b0db8eb9-5914-4db7-a39a-cabd6bf47faa',
          images: [{ id: 'g1', url: '/images/7f863471-c2b6-45f4-912d-80f97daf25f4' }],
        },
      ],
      'GECEKODU',
    );
    expect(photos.map((row) => row.url)).toEqual([
      'https://cdn.yildizskylab.com/images/b0db8eb9-5914-4db7-a39a-cabd6bf47faa',
      'https://cdn.yildizskylab.com/images/7f863471-c2b6-45f4-912d-80f97daf25f4',
    ]);
  });
});

describe('publicMediaUrl', () => {
  it('prefixes relative images/uuid against the club CDN', () => {
    expect(publicMediaUrl('images/b0db8eb9-5914-4db7-a39a-cabd6bf47faa')).toBe(
      'https://cdn.yildizskylab.com/images/b0db8eb9-5914-4db7-a39a-cabd6bf47faa',
    );
  });

  it('prefixes a leading-slash storage key', () => {
    expect(publicMediaUrl('/images/7f863471-c2b6-45f4-912d-80f97daf25f4')).toBe(
      'https://cdn.yildizskylab.com/images/7f863471-c2b6-45f4-912d-80f97daf25f4',
    );
  });

  it('leaves an already-cdn absolute url', () => {
    const href = 'https://cdn.yildizskylab.com/images/abc';
    expect(publicMediaUrl(href)).toBe(href);
  });

  it('leaves other absolute urls', () => {
    expect(publicMediaUrl('https://other.example/file.jpg')).toBe('https://other.example/file.jpg');
  });

  it('returns empty for blank values', () => {
    expect(publicMediaUrl('')).toBe('');
    expect(publicMediaUrl('   ')).toBe('');
    expect(publicMediaUrl(undefined)).toBe('');
    expect(publicMediaUrl(null)).toBe('');
  });

  it('joins against an override base without using the page origin', () => {
    expect(publicMediaUrl('images/x', 'https://cdn.example.test/')).toBe(
      'https://cdn.example.test/images/x',
    );
    expect(publicMediaUrl('images/x')).not.toContain('/events/');
  });
});
