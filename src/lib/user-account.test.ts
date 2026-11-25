import { clientLabel } from './user-account';

describe('clientLabel', () => {
  it('names the club apps in Turkish', () => {
    expect(clientLabel('skynotify')).toBe('SkyNotify');
    expect(clientLabel('skyforms')).toBe('Form');
  });

  it('shows an unknown client by its id', () => {
    expect(clientLabel('yeni-istemci')).toBe('yeni-istemci');
  });
});
