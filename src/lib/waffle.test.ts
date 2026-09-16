import { waffleAppIsCurrent, waffleApps } from './waffle';

describe('waffleApps', () => {
  it('lists admin, forms, and Place', () => {
    expect(waffleApps().map((a) => a.id)).toEqual(['admin', 'forms', 'place']);
  });

  it('marks the current origin', () => {
    expect(
      waffleAppIsCurrent('https://admin.yildizskylab.com/users', 'https://admin.yildizskylab.com'),
    ).toBe(true);
    expect(
      waffleAppIsCurrent('https://forms.yildizskylab.com', 'https://admin.yildizskylab.com'),
    ).toBe(false);
  });
});
