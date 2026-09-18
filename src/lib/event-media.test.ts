import { teamEventPhotos } from '@/lib/event-media';

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
});
