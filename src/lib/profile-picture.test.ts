import { profilePictureSrc } from './profile-picture';

describe('profilePictureSrc', () => {
  it('prefers the small card size', () => {
    expect(
      profilePictureSrc({
        profilePictureUrl: 'https://cdn.example.com/images/a',
        profilePictureSizes: { card: { url: 'https://cdn.example.com/images/a/card.jpg' } },
      }),
    ).toBe('https://cdn.example.com/images/a/card.jpg');
  });

  it('falls back to the full picture, and to nothing without one', () => {
    expect(profilePictureSrc({ profilePictureUrl: 'https://cdn.example.com/images/a' })).toBe(
      'https://cdn.example.com/images/a',
    );
    expect(profilePictureSrc({})).toBeUndefined();
    expect(profilePictureSrc(null)).toBeUndefined();
  });
});
